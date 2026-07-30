import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import pdfExploreViewerHtml from '@/generated/pdf-explore-viewer-html';
import storage from '@/services/storage';
import {
  TextbookService,
  type ResourceFile,
} from '../services/textbook-service';
import {
  PdfAnnotationToolbar,
  type PdfAnnotationTool,
  type PdfAnnotationToolConfig,
} from './PdfAnnotationToolbar';

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

// Keep bridge messages bounded while avoiding hundreds of synchronous
// round-trips for a typical textbook PDF.
const TRANSFER_CHUNK_BYTES =
  Platform.OS === 'web' ? 512 * 1024 : 256 * 1024;
const INITIAL_RANGE_BYTES = 512 * 1024;
const CHUNK_ACK_TIMEOUT = 8000;
const PDF_WEBVIEW_SOURCE = { html: pdfExploreViewerHtml };
const ANNOTATION_STORAGE_PREFIX = 'pdf-annotations:v1:';
const EMPTY_ANNOTATION_DOCUMENT = { version: 1, items: [] };

const bytesToBase64 = (bytes: Uint8Array<ArrayBuffer>): string => {
  let binary = '';
  const sliceSize = 32 * 1024;
  for (let offset = 0; offset < bytes.length; offset += sliceSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + sliceSize));
  }
  return globalThis.btoa(binary);
};

const getPdfCandidates = (resource: ResourceFile): string[] =>
  Array.from(
    new Set([resource.fileUrl, resource.remoteUrl].filter(Boolean) as string[])
  );

const normalizePdfRequestUrl = (candidate: string): string => {
  if (Platform.OS !== 'web') return candidate;
  try {
    const parsed = new URL(candidate, globalThis.location?.origin);
    if (
      parsed.hostname === 'www.imates.com.cn' &&
      (parsed.pathname.startsWith('/yb-release/') ||
        parsed.pathname.startsWith('/yb-test/'))
    ) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // 保留原始地址，由 fetch 返回具体错误。
  }
  return candidate;
};

const getCachedNativePdf = (resource: ResourceFile): File | null => {
  if (resource.fileUrl.startsWith('file://')) {
    const localFile = new File(resource.fileUrl);
    return localFile.exists && localFile.size > 0 ? localFile : null;
  }
  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) return null;
  const safeId = resource.id.replace(/[^\w-]/g, '_') || 'resource';
  const versionToken = String(
    resource.checksum || resource.uploadTime || resource.size || 'current'
  )
    .replace(/[^\w-]/g, '_')
    .slice(0, 48);
  const cachedFile = new File(
    `${cacheRoot}pdf-explore-${safeId}-${versionToken}.pdf`
  );
  const expectedSize = Number(resource.size) || 0;
  return cachedFile.exists &&
    cachedFile.size > 0 &&
    (expectedSize <= 0 || cachedFile.size === expectedSize)
    ? cachedFile
    : null;
};

const parseContentRange = (
  value: string | null
): { begin: number; end: number; total: number } | null => {
  const match = value?.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;
  return {
    begin: Number(match[1]),
    end: Number(match[2]) + 1,
    total: Number(match[3]),
  };
};

interface PdfRangeSource {
  transferId: number;
  url: string;
  headers: Record<string, string>;
  totalBytes: number;
}

function PdfExploreViewerComponent({
  resource,
  reloadKey,
  exploreMode,
  onReady,
  onError,
  onExploreCapture,
  onExploreCaptureError,
}: PdfExploreViewerProps) {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const transferIdRef = useRef(0);
  const rangeSourceRef = useRef<PdfRangeSource | null>(null);
  const pendingRangeRequestsRef = useRef(new Set<string>());
  const annotationLoadIdRef = useRef(0);
  const annotationSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const readyKeyRef = useRef('');
  const chunkAckRef = useRef<{
    index: number;
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [documentReady, setDocumentReady] = useState(false);
  const [annotationDataReady, setAnnotationDataReady] = useState(false);
  const [annotationTool, setAnnotationTool] =
    useState<PdfAnnotationTool>('hand');
  const [textSelectionActive, setTextSelectionActive] = useState(false);
  const [textEditingActive, setTextEditingActive] = useState(false);
  const [textComposerVisible, setTextComposerVisible] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [annotationHistory, setAnnotationHistory] = useState({
    canUndo: false,
    canRedo: false,
  });
  const [toolConfigs, setToolConfigs] = useState<{
    pen: PdfAnnotationToolConfig;
    highlighter: PdfAnnotationToolConfig;
    text: PdfAnnotationToolConfig;
  }>({
    pen: {
      color: '#242638',
      width: 0.0035,
      fontSize: 0.024,
      hasBackground: true,
    },
    highlighter: {
      color: '#FFD84D',
      width: 0.01,
      fontSize: 0.024,
      hasBackground: true,
    },
    text: {
      color: '#242638',
      width: 0.0035,
      fontSize: 0.024,
      hasBackground: true,
    },
  });
  const annotationStorageKey = `${ANNOTATION_STORAGE_PREFIX}${resource.id}`;
  const activeToolConfig =
    annotationTool === 'highlighter'
      ? toolConfigs.highlighter
      : annotationTool === 'text'
        ? toolConfigs.text
        : toolConfigs.pen;
  const toolbarConfig = textSelectionActive
    ? toolConfigs.text
    : activeToolConfig;

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

  const sendFullBytes = useCallback(
    async (bytes: Uint8Array<ArrayBuffer>, transferId: number) => {
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
      if (transferId === transferIdRef.current) send({ type: 'pdf-end' });
    },
    [send, waitForChunkAck]
  );

  const requestPdfRange = useCallback(
    async (beginValue: unknown, endValue: unknown) => {
      const source = rangeSourceRef.current;
      const begin = Math.max(0, Number(beginValue) || 0);
      const end = Math.min(source?.totalBytes || 0, Number(endValue) || 0);
      if (!source || end <= begin) return;
      const requestKey = `${source.transferId}:${begin}:${end}`;
      if (pendingRangeRequestsRef.current.has(requestKey)) return;
      pendingRangeRequestsRef.current.add(requestKey);
      try {
        const response = await fetch(source.url, {
          headers: {
            ...source.headers,
            Range: `bytes=${begin}-${end - 1}`,
          },
        });
        if (source.transferId !== transferIdRef.current) return;
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const responseBytes = new Uint8Array(await response.arrayBuffer());
        const contentRange = parseContentRange(
          response.headers.get('content-range')
        );
        const actualBegin = contentRange?.begin ?? begin;
        const bytes =
          response.status === 200 && responseBytes.length >= end
            ? responseBytes.subarray(begin, end)
            : responseBytes;
        send({
          type: 'pdf-range-data',
          begin: actualBegin,
          data: bytesToBase64(bytes),
        });
      } catch (caught) {
        if (source.transferId !== transferIdRef.current) return;
        send({
          type: 'pdf-range-error',
          message:
            caught instanceof Error ? caught.message : 'PDF 分段读取失败',
        });
      } finally {
        pendingRangeRequestsRef.current.delete(requestKey);
      }
    },
    [send]
  );

  const transferPdf = useCallback(async () => {
    const transferId = ++transferIdRef.current;
    rangeSourceRef.current = null;
    pendingRangeRequestsRef.current.clear();
    let nativeHandle: ReturnType<File['open']> | null = null;
    try {
      if (Platform.OS === 'web' && typeof globalThis.caches !== 'undefined') {
        const cachedResponse = await globalThis.caches.match(resource.fileUrl);
        if (cachedResponse?.ok) {
          const bytes = new Uint8Array(await cachedResponse.arrayBuffer());
          if (transferId !== transferIdRef.current) return;
          await sendFullBytes(bytes, transferId);
          return;
        }
      }

      if (Platform.OS !== 'web') {
        const cachedFile = getCachedNativePdf(resource);
        if (cachedFile) {
          nativeHandle = cachedFile.open();
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
          if (transferId === transferIdRef.current) send({ type: 'pdf-end' });
          return;
        }
      }

      const headers = await TextbookService.getYanbanAuthHeaders();
      let lastError: unknown;
      for (const candidate of getPdfCandidates(resource)) {
        const requestUrl = normalizePdfRequestUrl(candidate);
        try {
          const response = await fetch(requestUrl, {
            headers: {
              ...headers,
              Range: `bytes=0-${INITIAL_RANGE_BYTES - 1}`,
            },
          });
          if (!response.ok) {
            lastError = new Error(`HTTP ${response.status}`);
            continue;
          }
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (transferId !== transferIdRef.current) return;
          const contentRange = parseContentRange(
            response.headers.get('content-range')
          );
          const rangeTotal =
            contentRange?.total || Number(resource.size) || 0;
          if (response.status === 206 && rangeTotal > bytes.length) {
            rangeSourceRef.current = {
              transferId,
              url: requestUrl,
              headers,
              totalBytes: rangeTotal,
            };
            send({
              type: 'pdf-range-start',
              totalBytes: rangeTotal,
              rangeChunkSize: INITIAL_RANGE_BYTES,
              data: bytesToBase64(bytes),
            });
            return;
          }
          if (response.status === 206 && rangeTotal <= 0) {
            const fullResponse = await fetch(requestUrl, { headers });
            if (!fullResponse.ok) {
              throw new Error(`HTTP ${fullResponse.status}`);
            }
            const fullBytes = new Uint8Array(
              await fullResponse.arrayBuffer()
            );
            await sendFullBytes(fullBytes, transferId);
            return;
          }
          await sendFullBytes(bytes, transferId);
          return;
        } catch (caught) {
          lastError = caught;
        }
      }
      if (lastError) throw lastError;
      throw new Error('PDF 请求失败');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'PDF 文件读取失败');
    } finally {
      nativeHandle?.close();
    }
  }, [onError, resource, send, sendFullBytes, waitForChunkAck]);

  useEffect(() => {
    transferIdRef.current += 1;
    rangeSourceRef.current = null;
    pendingRangeRequestsRef.current.clear();
    annotationLoadIdRef.current += 1;
    readyKeyRef.current = '';
    setViewerReady(false);
    setDocumentReady(false);
    setAnnotationDataReady(false);
    setAnnotationTool('hand');
    setTextSelectionActive(false);
    setTextEditingActive(false);
    setTextComposerVisible(false);
    setPendingText('');
    setAnnotationHistory({ canUndo: false, canRedo: false });
  }, [reloadKey, resource.id]);

  useEffect(
    () => () => {
      transferIdRef.current += 1;
      rangeSourceRef.current = null;
      pendingRangeRequestsRef.current.clear();
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
    send({
      type: 'annotationTool',
      tool: annotationTool,
      config: activeToolConfig,
    });
  }, [activeToolConfig, annotationTool, send, viewerReady]);

  useEffect(() => {
    if (!viewerReady) return;
    const loadId = ++annotationLoadIdRef.current;
    const loadAnnotations = async () => {
      let document = EMPTY_ANNOTATION_DOCUMENT;
      try {
        const saved = await storage.getItem(annotationStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.items)
          ) {
            document = parsed;
          }
        }
      } catch (caught) {
        console.warn('[PdfAnnotations] 本地标注读取失败:', caught);
      }
      if (loadId !== annotationLoadIdRef.current) return;
      send({ type: 'annotationState', document });
      setAnnotationDataReady(true);
    };
    void loadAnnotations();
  }, [annotationStorageKey, send, viewerReady]);

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
        } else if (message.type === 'pdf-range-request') {
          void requestPdfRange(message.begin, message.end);
        } else if (message.type === 'documentLoaded') {
          setDocumentReady(true);
          onReady();
        } else if (
          message.type === 'annotationsChanged' &&
          message.document &&
          typeof message.document === 'object' &&
          Array.isArray(message.document.items)
        ) {
          setAnnotationHistory({
            canUndo: message.canUndo === true,
            canRedo: message.canRedo === true,
          });
          const serializedDocument = JSON.stringify(message.document);
          annotationSaveChainRef.current = annotationSaveChainRef.current
            .catch(() => undefined)
            .then(() =>
              storage.setItem(annotationStorageKey, serializedDocument)
            )
            .catch((caught) =>
              console.warn('[PdfAnnotations] 本地标注保存失败:', caught)
            );
        } else if (message.type === 'annotationHistoryState') {
          setAnnotationHistory({
            canUndo: message.canUndo === true,
            canRedo: message.canRedo === true,
          });
        } else if (
          message.type === 'textSelectionState' &&
          Number.isFinite(message.fontSize)
        ) {
          setTextSelectionActive(true);
          setToolConfigs((current) => ({
            ...current,
            text: {
              ...current.text,
              color:
                typeof message.color === 'string'
                  ? message.color
                  : current.text.color,
              fontSize: Math.max(
                0.014,
                Math.min(0.045, Number(message.fontSize))
              ),
              hasBackground:
                typeof message.hasBackground === 'boolean'
                  ? message.hasBackground
                  : current.text.hasBackground,
            },
          }));
        } else if (message.type === 'textSelectionCleared') {
          setTextSelectionActive(false);
        } else if (message.type === 'textEditingState') {
          setTextEditingActive(message.active === true);
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
      annotationStorageKey,
      reloadKey,
      requestPdfRange,
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

  const handleToolChange = useCallback(
    (tool: PdfAnnotationTool) => {
      if (tool === 'text') {
        setAnnotationTool('hand');
        setTextSelectionActive(false);
        setPendingText('');
        setTextComposerVisible(true);
        send({
          type: 'annotationCommand',
          command: 'clearTextSelection',
        });
        return;
      }
      if (tool !== 'hand') setTextSelectionActive(false);
      setAnnotationTool((current) =>
        current === tool && tool !== 'hand' ? 'hand' : tool
      );
    },
    [send, toolConfigs.text]
  );

  const handleCancelText = useCallback(() => {
    setTextComposerVisible(false);
    setPendingText('');
  }, []);

  const handleConfirmText = useCallback(() => {
    const text = pendingText.trim();
    if (!text) return;
    setTextComposerVisible(false);
    setPendingText('');
    send({
      type: 'annotationCommand',
      command: 'insertText',
      text,
      config: toolConfigs.text,
    });
  }, [pendingText, send, toolConfigs.text]);

  const handleConfigChange = useCallback(
    (config: PdfAnnotationToolConfig) => {
      if (textSelectionActive) {
        setToolConfigs((current) => ({ ...current, text: config }));
        send({
          type: 'annotationCommand',
          command: 'updateSelectedTextConfig',
          config,
        });
        return;
      }
      if (
        annotationTool !== 'pen' &&
        annotationTool !== 'highlighter'
      ) {
        return;
      }
      setToolConfigs((current) => ({
        ...current,
        [annotationTool]: config,
      }));
    },
    [annotationTool, send, textSelectionActive]
  );

  const handleUndo = useCallback(
    () => send({ type: 'annotationCommand', command: 'undo' }),
    [send]
  );

  const handleRedo = useCallback(
    () => send({ type: 'annotationCommand', command: 'redo' }),
    [send]
  );

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
      <PdfAnnotationToolbar
        bottomInset={insets.bottom}
        selectedTool={annotationTool}
        textSelectionActive={textSelectionActive}
        textEditingActive={textEditingActive}
        config={toolbarConfig}
        canUndo={annotationHistory.canUndo}
        canRedo={annotationHistory.canRedo}
        disabled={
          !viewerReady ||
          !documentReady ||
          !annotationDataReady ||
          exploreMode
        }
        onToolChange={handleToolChange}
        onConfigChange={handleConfigChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
      <Modal
        visible={textComposerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancelText}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCancelText}
            accessibilityRole="button"
            accessibilityLabel="取消添加文字"
          />
          <KeyboardAvoidingView
            style={styles.modalKeyboardArea}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            pointerEvents="box-none"
          >
            <View style={styles.textDialog}>
              <Text style={styles.textDialogTitle}>添加文字</Text>
              <Text style={styles.textDialogHint}>
                输入内容并确认后，再拖动文字框调整位置
              </Text>
              <TextInput
                autoFocus
                multiline
                maxLength={2000}
                value={pendingText}
                onChangeText={setPendingText}
                placeholder="请输入文字内容"
                placeholderTextColor="#9297AA"
                style={styles.textDialogInput}
                textAlignVertical="top"
                returnKeyType="done"
                accessibilityLabel="文字内容"
              />
              <View style={styles.textDialogActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.dialogButton,
                    styles.dialogCancelButton,
                    pressed && styles.dialogButtonPressed,
                  ]}
                  onPress={handleCancelText}
                  accessibilityRole="button"
                  accessibilityLabel="取消添加"
                >
                  <Text style={styles.dialogCancelText}>取消</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.dialogButton,
                    styles.dialogConfirmButton,
                    !pendingText.trim() && styles.dialogButtonDisabled,
                    pressed &&
                      pendingText.trim() &&
                      styles.dialogButtonPressed,
                  ]}
                  onPress={handleConfirmText}
                  disabled={!pendingText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="确认添加文字"
                  accessibilityState={{ disabled: !pendingText.trim() }}
                >
                  <Text style={styles.dialogConfirmText}>确认添加</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(19, 20, 34, 0.52)',
  },
  modalKeyboardArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  textDialog: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#17152A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 18,
  },
  textDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#242638',
  },
  textDialogHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#6D7188',
  },
  textDialogInput: {
    minHeight: 128,
    maxHeight: 240,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D8D9E6',
    borderRadius: 12,
    backgroundColor: '#FAFAFE',
    fontSize: 16,
    lineHeight: 23,
    color: '#242638',
  },
  textDialogActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogButton: {
    minWidth: 96,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelButton: {
    backgroundColor: '#F0F1F6',
  },
  dialogConfirmButton: {
    backgroundColor: '#6256D9',
  },
  dialogButtonDisabled: {
    opacity: 0.42,
  },
  dialogButtonPressed: {
    opacity: 0.78,
  },
  dialogCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#555A70',
  },
  dialogConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export const PdfExploreViewer = memo(PdfExploreViewerComponent);
