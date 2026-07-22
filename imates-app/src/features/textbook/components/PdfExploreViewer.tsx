import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import pdfExploreViewerHtml from '@/generated/pdf-explore-viewer-html';
import {
  TextbookService,
  type ResourceFile,
} from '../services/textbook-service';

export interface PdfExploreCapture {
  dataUrl: string;
  pageNumber: number;
  width: number;
  height: number;
}

interface PdfExploreViewerProps {
  resource: ResourceFile;
  reloadKey: number;
  exploreMode: boolean;
  onReady: () => void;
  onError: (message: string) => void;
  onExploreCapture: (capture: PdfExploreCapture) => void;
  onExploreCaptureError: (message: string) => void;
}

// 96 KiB becomes exactly 128 KiB after base64 encoding. Keeping bridge messages
// small avoids duplicating an entire large PDF in the React Native JS heap.
const TRANSFER_CHUNK_BYTES = Platform.OS === 'web' ? 384 * 1024 : 96 * 1024;
const CHUNK_ACK_TIMEOUT = 8000;
const PDF_WEBVIEW_SOURCE = { html: pdfExploreViewerHtml };

const bytesToBase64 = (bytes: Uint8Array<ArrayBuffer>): string => {
  let binary = '';
  const sliceSize = 32 * 1024;
  for (let offset = 0; offset < bytes.length; offset += sliceSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + sliceSize));
  }
  return globalThis.btoa(binary);
};

const readWebPdf = async (resource: ResourceFile): Promise<ArrayBuffer> => {
  let response: Response | undefined;
  if (typeof globalThis.caches !== 'undefined') {
    response = (await globalThis.caches.match(resource.fileUrl)) || undefined;
  }
  if (!response) {
    const headers = await TextbookService.getYanbanAuthHeaders();
    const candidates = Array.from(
      new Set([resource.fileUrl, resource.remoteUrl].filter(Boolean) as string[])
    );
    let lastError: unknown;
    for (const candidate of candidates) {
      let requestUrl = candidate;
      try {
        const parsed = new URL(candidate, globalThis.location?.origin);
        if (
          parsed.hostname === 'www.imates.com.cn' &&
          (parsed.pathname.startsWith('/yb-release/') ||
            parsed.pathname.startsWith('/yb-test/'))
        ) {
          requestUrl = `${parsed.pathname}${parsed.search}`;
        }
      } catch {
        // 保留原始地址，由 fetch 返回具体错误。
      }
      try {
        const candidateResponse = await fetch(requestUrl, { headers });
        if (candidateResponse.ok) {
          response = candidateResponse;
          break;
        }
        lastError = new Error(`HTTP ${candidateResponse.status}`);
      } catch (caught) {
        lastError = caught;
      }
    }
    if (!response && lastError) throw lastError;
  }
  if (!response?.ok) {
    throw new Error(
      response ? `PDF 请求失败（HTTP ${response.status}）` : 'PDF 请求失败'
    );
  }
  return response.arrayBuffer();
};

const getNativePdfUri = async (resource: ResourceFile): Promise<string> => {
  let uri = resource.fileUrl;
  if (!uri.startsWith('file://')) {
    const cacheRoot = FileSystem.cacheDirectory;
    if (!cacheRoot) throw new Error('设备缓存目录不可用');
    const safeId = resource.id.replace(/[^\w-]/g, '_') || 'resource';
    const headers = await TextbookService.getYanbanAuthHeaders();
    const result = await FileSystem.downloadAsync(
      resource.remoteUrl || resource.fileUrl,
      `${cacheRoot}pdf-explore-${safeId}.pdf`,
      { headers }
    );
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`PDF 请求失败（HTTP ${result.status}）`);
    }
    uri = result.uri;
  }
  return uri;
};

function PdfExploreViewerComponent({
  resource,
  reloadKey,
  exploreMode,
  onReady,
  onError,
  onExploreCapture,
  onExploreCaptureError,
}: PdfExploreViewerProps) {
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const transferIdRef = useRef(0);
  const readyKeyRef = useRef('');
  const chunkAckRef = useRef<{
    index: number;
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [viewerReady, setViewerReady] = useState(false);

  const send = useCallback((message: Record<string, unknown>) => {
    const serialized = JSON.stringify(message);
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(serialized, '*');
    } else {
      webViewRef.current?.postMessage(serialized);
    }
  }, []);

  const waitForChunkAck = useCallback(
    (index: number) =>
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (chunkAckRef.current?.index === index) chunkAckRef.current = null;
          reject(new Error('PDF 数据传输超时，请重试'));
        }, CHUNK_ACK_TIMEOUT);
        chunkAckRef.current = { index, resolve, reject, timeout };
      }),
    []
  );

  const transferPdf = useCallback(async () => {
    const transferId = ++transferIdRef.current;
    let nativeHandle: ReturnType<File['open']> | null = null;
    try {
      if (Platform.OS === 'web') {
        const buffer = await readWebPdf(resource);
        if (transferId !== transferIdRef.current) return;
        const bytes = new Uint8Array(buffer);
        const totalChunks = Math.ceil(bytes.length / TRANSFER_CHUNK_BYTES);
        send({ type: 'pdf-start', totalChunks, totalBytes: bytes.length });
        for (let index = 0; index < totalChunks; index += 1) {
          if (transferId !== transferIdRef.current) return;
          const ack = waitForChunkAck(index);
          const start = index * TRANSFER_CHUNK_BYTES;
          send({
            type: 'pdf-chunk',
            index,
            offset: start,
            data: bytesToBase64(
              bytes.subarray(
                start,
                Math.min(bytes.length, start + TRANSFER_CHUNK_BYTES)
              )
            ),
          });
          await ack;
        }
      } else {
        const uri = await getNativePdfUri(resource);
        if (transferId !== transferIdRef.current) return;
        nativeHandle = new File(uri).open();
        const totalBytes = nativeHandle.size || 0;
        if (totalBytes <= 0) throw new Error('PDF 文件内容为空');
        const totalChunks = Math.ceil(totalBytes / TRANSFER_CHUNK_BYTES);
        send({ type: 'pdf-start', totalChunks, totalBytes });
        for (let index = 0; index < totalChunks; index += 1) {
          if (transferId !== transferIdRef.current) return;
          const chunk = nativeHandle.readBytes(
            Math.min(
              TRANSFER_CHUNK_BYTES,
              totalBytes - index * TRANSFER_CHUNK_BYTES
            )
          );
          const ack = waitForChunkAck(index);
          send({
            type: 'pdf-chunk',
            index,
            offset: index * TRANSFER_CHUNK_BYTES,
            data: bytesToBase64(chunk),
          });
          await ack;
        }
      }
      if (transferId !== transferIdRef.current) return;
      send({ type: 'pdf-end' });
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'PDF 文件读取失败');
    } finally {
      nativeHandle?.close();
    }
  }, [onError, resource, send, waitForChunkAck]);

  useEffect(() => {
    transferIdRef.current += 1;
    readyKeyRef.current = '';
    setViewerReady(false);
  }, [reloadKey, resource.id]);

  useEffect(
    () => () => {
      transferIdRef.current += 1;
      if (chunkAckRef.current) {
        clearTimeout(chunkAckRef.current.timeout);
        chunkAckRef.current.reject(new Error('PDF 预览已关闭'));
        chunkAckRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (viewerReady) return;
    const timeout = setTimeout(
      () => onError('PDF 阅读器启动超时，请重试'),
      12000
    );
    return () => clearTimeout(timeout);
  }, [onError, reloadKey, resource.id, viewerReady]);

  useEffect(() => {
    if (!viewerReady) return;
    send({ type: 'exploreMode', enabled: exploreMode });
  }, [exploreMode, send, viewerReady]);

  useEffect(() => {
    if (!viewerReady) return;
    send({ type: 'readerInsets', top: 16, bottom: 24 });
  }, [send, viewerReady]);

  const processMessage = useCallback(
    (rawMessage: unknown) => {
      try {
        const message =
          typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'ready') {
          const readyKey = `${resource.id}-${reloadKey}`;
          if (readyKeyRef.current === readyKey) return;
          readyKeyRef.current = readyKey;
          setViewerReady(true);
          void transferPdf();
        } else if (message.type === 'pdf-chunk-ack') {
          const pending = chunkAckRef.current;
          if (pending && pending.index === message.index) {
            clearTimeout(pending.timeout);
            chunkAckRef.current = null;
            pending.resolve();
          }
        } else if (message.type === 'documentLoaded') {
          onReady();
        } else if (message.type === 'documentError') {
          onError(message.message || 'PDF 文件无法解析');
        } else if (
          message.type === 'exploreCapture' &&
          typeof message.dataUrl === 'string'
        ) {
          onExploreCapture({
            dataUrl: message.dataUrl,
            pageNumber: Number(message.pageNumber) || 1,
            width: Number(message.width) || 0,
            height: Number(message.height) || 0,
          });
        } else if (message.type === 'exploreCaptureError') {
          onExploreCaptureError(message.message || '框选失败，请重新选择区域');
        }
      } catch {
        // 忽略非阅读器协议消息。
      }
    },
    [
      onError,
      onExploreCapture,
      onExploreCaptureError,
      onReady,
      reloadKey,
      resource.id,
      transferPdf,
    ]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => processMessage(event.nativeEvent.data),
    [processMessage]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const receiveMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      processMessage(event.data);
    };
    globalThis.window?.addEventListener('message', receiveMessage);
    return () =>
      globalThis.window?.removeEventListener('message', receiveMessage);
  }, [processMessage]);

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          key={`${resource.id}-${reloadKey}`}
          title={resource.fileName || 'PDF 阅读器'}
          srcDoc={pdfExploreViewerHtml}
          onLoad={() => send({ type: 'host-ready' })}
          style={webFrameStyle}
        />
      ) : (
        <WebView
          ref={webViewRef}
          key={`${resource.id}-${reloadKey}`}
          source={PDF_WEBVIEW_SOURCE}
          style={styles.webView}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          onMessage={handleMessage}
          onLoad={() => send({ type: 'host-ready' })}
          onError={({ nativeEvent }) =>
            onError(nativeEvent.description || 'PDF 阅读器启动失败')
          }
          onContentProcessDidTerminate={() =>
            onError('PDF 阅读器进程已退出，请重新加载')
          }
          onRenderProcessGone={() =>
            onError('PDF 阅读器进程已退出，请重新加载')
          }
          showsVerticalScrollIndicator
          scrollEnabled
          nestedScrollEnabled
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          overScrollMode="never"
        />
      )}
    </View>
  );
}

const webFrameStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 0,
  backgroundColor: '#ECEEF5',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECEEF5' },
  webView: { flex: 1, backgroundColor: '#ECEEF5' },
});

export const PdfExploreViewer = memo(PdfExploreViewerComponent);
