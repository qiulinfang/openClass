import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import pdfAnnotatorHtml from '@/generated/pdf-annotator-html';
import {
  ResourceFile,
  TextbookService,
} from '../services/textbook-service';
import { storage } from '@/services/storage';

type DrawingTool = 'hand' | 'pen' | 'highlighter' | 'eraser';

export interface PdfExploreCapture {
  dataUrl: string;
  pageNumber: number;
  width: number;
  height: number;
}

interface PdfAnnotationViewerProps {
  resource: ResourceFile;
  reloadKey: number;
  exploreMode?: boolean;
  chromeVisible?: boolean;
  contentTopInset?: number;
  onReady: () => void;
  onError: (message: string) => void;
  onChromeVisibilityChange?: (visible: boolean) => void;
  onExploreCapture?: (capture: PdfExploreCapture) => void;
  onExploreCaptureError?: (message: string) => void;
}

interface DrawingConfig {
  pen: { color: string; width: number; opacity: number };
  highlighter: { color: string; width: number; opacity: number };
  eraser: { width: number };
}

const TOOL_ITEMS: Array<{ tool: DrawingTool; icon: string; label: string }> = [
  { tool: 'hand', icon: '✋', label: '拖动' },
  { tool: 'pen', icon: '✎', label: '画笔' },
  { tool: 'highlighter', icon: '▰', label: '荧光' },
  { tool: 'eraser', icon: '◇', label: '橡皮' },
];
const COLORS = ['#212529', '#E5484D', '#2F6FED', '#24A148', '#8B5CF6', '#F5C400'];
const TRANSFER_CHUNK_SIZE = 64 * 1024;
const CHUNK_ACK_TIMEOUT = 8000;
const PDF_WEBVIEW_SOURCE = { html: pdfAnnotatorHtml };

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const sliceSize = 32 * 1024;
  for (let offset = 0; offset < bytes.length; offset += sliceSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + sliceSize));
  }
  return globalThis.btoa(binary);
};

const readWebPdf = async (resource: ResourceFile): Promise<string> => {
  let response: Response | undefined;
  if (typeof globalThis.caches !== 'undefined') {
    response = await globalThis.caches.match(resource.fileUrl) || undefined;
  }
  if (!response) {
    const headers = await TextbookService.getYanbanAuthHeaders();
    const preferredUrl = resource.fileUrl.startsWith('blob:')
      ? resource.fileUrl
      : resource.remoteUrl || resource.fileUrl;
    let requestUrl = preferredUrl;
    try {
      const parsed = new URL(preferredUrl, globalThis.location?.origin);
      if (
        parsed.hostname === 'www.imates.com.cn' &&
        (parsed.pathname.startsWith('/yb-release/') ||
          parsed.pathname.startsWith('/yb-test/'))
      ) {
        requestUrl = `${parsed.pathname}${parsed.search}`;
      }
    } catch {
      // 保留原地址，让 fetch 给出明确的网络错误。
    }
    response = await fetch(requestUrl, { headers });
  }
  if (!response.ok) {
    throw new Error(`PDF 请求失败（HTTP ${response.status}）`);
  }
  return arrayBufferToBase64(await response.arrayBuffer());
};

const readNativePdf = async (resource: ResourceFile): Promise<string> => {
  let uri = resource.fileUrl;
  if (!uri.startsWith('file://')) {
    const cacheRoot = FileSystem.cacheDirectory;
    if (!cacheRoot) throw new Error('设备缓存目录不可用');
    const safeId = resource.id.replace(/[^\w-]/g, '_') || 'resource';
    const headers = await TextbookService.getYanbanAuthHeaders();
    const result = await FileSystem.downloadAsync(
      resource.remoteUrl || resource.fileUrl,
      `${cacheRoot}pdf-preview-${safeId}.pdf`,
      { headers }
    );
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`PDF 请求失败（HTTP ${result.status}）`);
    }
    uri = result.uri;
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
};

function PdfAnnotationViewerComponent({
  resource,
  reloadKey,
  exploreMode = false,
  chromeVisible = true,
  contentTopInset = 128,
  onReady,
  onError,
  onChromeVisibilityChange,
  onExploreCapture,
  onExploreCaptureError,
}: PdfAnnotationViewerProps) {
  const insets = useSafeAreaInsets();
  const bottomChromeProgress = useRef(
    new Animated.Value(chromeVisible || exploreMode ? 1 : 0)
  ).current;
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
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tool, setTool] = useState<DrawingTool>('hand');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [config, setConfig] = useState<DrawingConfig>({
    pen: { color: '#212529', width: 2.5, opacity: 1 },
    highlighter: { color: '#FFFF00', width: 8, opacity: 0.4 },
    eraser: { width: 18 },
  });

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  const annotationKey = `PDF_ANNOTATIONS_V1_${resource.id}_${resource.checksum || resource.size || 0}`;

  const send = useCallback((message: Record<string, unknown>) => {
    const serialized = JSON.stringify(message);
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(serialized, '*');
      return;
    }
    webViewRef.current?.postMessage(serialized);
  }, []);

  const sendConfig = useCallback(
    (nextConfig: DrawingConfig) => {
      setConfig(nextConfig);
      send({ type: 'config', config: nextConfig });
    },
    [send]
  );

  const waitForChunkAck = useCallback((index: number) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (chunkAckRef.current?.index === index) chunkAckRef.current = null;
        reject(new Error('PDF 数据传输超时，请重试'));
      }, CHUNK_ACK_TIMEOUT);
      chunkAckRef.current = { index, resolve, reject, timeout };
    });
  }, []);

  const transferPdf = useCallback(async () => {
    const transferId = ++transferIdRef.current;
    try {
      setTransferProgress(0.01);
      const [base64, savedAnnotations] = await Promise.all([
        Platform.OS === 'web' ? readWebPdf(resource) : readNativePdf(resource),
        storage.getItem(annotationKey),
      ]);
      if (transferId !== transferIdRef.current) return;

      let annotations: unknown[] = [];
      if (savedAnnotations) {
        try {
          const parsed = JSON.parse(savedAnnotations);
          if (Array.isArray(parsed)) annotations = parsed;
        } catch {
          // 忽略旧版本损坏的笔迹数据，PDF 本身仍然可以继续打开。
        }
      }

      const totalChunks = Math.ceil(base64.length / TRANSFER_CHUNK_SIZE);
      send({ type: 'pdf-start', totalChunks, annotations });
      for (let index = 0; index < totalChunks; index += 1) {
        if (transferId !== transferIdRef.current) return;
        const ack = waitForChunkAck(index);
        send({
          type: 'pdf-chunk',
          index,
          data: base64.slice(
            index * TRANSFER_CHUNK_SIZE,
            (index + 1) * TRANSFER_CHUNK_SIZE
          ),
        });
        await ack;
        setTransferProgress((index + 1) / totalChunks);
      }
      send({ type: 'pdf-end' });
    } catch (error) {
      onError(error instanceof Error ? error.message : 'PDF 文件读取失败');
    }
  }, [annotationKey, onError, resource, send, waitForChunkAck]);

  useEffect(() => {
    transferIdRef.current += 1;
    setViewerReady(false);
    setTransferProgress(0);
    setCanUndo(false);
    setCanRedo(false);
    readyKeyRef.current = '';
  }, [reloadKey, resource.id]);

  useEffect(() => () => {
    transferIdRef.current += 1;
    if (chunkAckRef.current) {
      clearTimeout(chunkAckRef.current.timeout);
      chunkAckRef.current.reject(new Error('PDF 预览已关闭'));
      chunkAckRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (viewerReady) return;
    const timeout = setTimeout(() => {
      onError('PDF 阅读器启动超时，请重试');
    }, 12000);
    return () => clearTimeout(timeout);
  }, [onError, reloadKey, resource.id, viewerReady]);

  useEffect(() => {
    if (!viewerReady) return;
    send({ type: 'tool', tool: exploreMode ? 'explore' : tool });
  }, [exploreMode, send, tool, viewerReady]);

  useEffect(() => {
    if (!viewerReady) return;
    send({ type: 'readerChrome', visible: chromeVisible });
  }, [chromeVisible, send, viewerReady]);

  const bottomChromeVisible = chromeVisible || exploreMode;
  useEffect(() => {
    Animated.timing(bottomChromeProgress, {
      toValue: bottomChromeVisible ? 1 : 0,
      duration: reduceMotion ? 0 : bottomChromeVisible ? 220 : 170,
      easing: bottomChromeVisible
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [bottomChromeProgress, bottomChromeVisible, reduceMotion]);

  useEffect(() => {
    if (!viewerReady) return;
    const toolConfigHeight =
      !exploreMode && tool !== 'hand' ? 54 : 0;
    send({
      type: 'readerInsets',
      top: contentTopInset,
      bottom: 74 + insets.bottom + toolConfigHeight + 18,
    });
  }, [
    contentTopInset,
    exploreMode,
    insets.bottom,
    send,
    tool,
    viewerReady,
  ]);

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
          send({ type: 'tool', tool });
          send({ type: 'config', config });
          void transferPdf();
        } else if (message.type === 'pdf-chunk-ack') {
          const pending = chunkAckRef.current;
          if (pending && pending.index === message.index) {
            clearTimeout(pending.timeout);
            chunkAckRef.current = null;
            pending.resolve();
          }
        } else if (message.type === 'documentLoaded') {
          setTransferProgress(1);
          onReady();
        } else if (message.type === 'documentError') {
          onError(message.message || 'PDF 文件无法解析');
        } else if (
          message.type === 'exploreCapture' &&
          typeof message.dataUrl === 'string'
        ) {
          onExploreCapture?.({
            dataUrl: message.dataUrl,
            pageNumber: Number(message.pageNumber) || 1,
            width: Number(message.width) || 0,
            height: Number(message.height) || 0,
          });
        } else if (message.type === 'exploreCaptureError') {
          onExploreCaptureError?.(
            message.message || '框选失败，请重新选择区域'
          );
        } else if (
          message.type === 'readerChrome' &&
          typeof message.visible === 'boolean'
        ) {
          onChromeVisibilityChange?.(message.visible);
        } else if (message.type === 'annotationsChanged' && Array.isArray(message.strokes)) {
          void storage.setItem(annotationKey, JSON.stringify(message.strokes));
        } else if (message.type === 'history') {
          setCanUndo(!!message.canUndo);
          setCanRedo(!!message.canRedo);
        }
      } catch {
        // 忽略非阅读器协议消息。
      }
    },
    [
      annotationKey,
      config,
      onError,
      onChromeVisibilityChange,
      onExploreCapture,
      onExploreCaptureError,
      onReady,
      reloadKey,
      resource.id,
      send,
      tool,
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
    return () => globalThis.window?.removeEventListener('message', receiveMessage);
  }, [processMessage]);

  const selectTool = (nextTool: DrawingTool) => {
    setTool(nextTool);
    send({ type: 'tool', tool: nextTool });
  };

  const activeColor =
    tool === 'highlighter' ? config.highlighter.color : config.pen.color;
  const activeWidth =
    tool === 'eraser'
      ? config.eraser.width
      : tool === 'highlighter'
        ? config.highlighter.width
        : config.pen.width;
  const widthOptions =
    tool === 'eraser' ? [12, 20, 32] : tool === 'highlighter' ? [8, 14, 22] : [2.5, 5, 8];

  const updateColor = (color: string) => {
    if (tool === 'highlighter') {
      sendConfig({ ...config, highlighter: { ...config.highlighter, color } });
    } else {
      sendConfig({ ...config, pen: { ...config.pen, color } });
    }
  };

  const updateWidth = (width: number) => {
    if (tool === 'eraser') {
      sendConfig({ ...config, eraser: { width } });
    } else if (tool === 'highlighter') {
      sendConfig({ ...config, highlighter: { ...config.highlighter, width } });
    } else {
      sendConfig({ ...config, pen: { ...config.pen, width } });
    }
  };

  const clearAnnotations = () => {
    Alert.alert('清空全部涂写？', '此操作可以立即撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '清空', style: 'destructive', onPress: () => send({ type: 'clear' }) },
    ]);
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          key={`${resource.id}-${reloadKey}`}
          title={resource.fileName || 'PDF 阅读器'}
          srcDoc={pdfAnnotatorHtml}
          onLoad={() => send({ type: 'host-ready' })}
          style={{
            width: '100%',
            height: '100%',
            flex: 1,
            border: 0,
            backgroundColor: '#ECEEF5',
          }}
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
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          overScrollMode="never"
        />
      )}

      <Animated.View
        pointerEvents={bottomChromeVisible ? 'auto' : 'none'}
        style={[
          styles.bottomChrome,
          {
            opacity: bottomChromeProgress,
            transform: [
              {
                translateY: bottomChromeProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [190, 0],
                }),
              },
            ],
          },
        ]}
      >
        {viewerReady && !exploreMode && tool !== 'hand' ? (
          <View style={styles.configPanel}>
            {tool !== 'eraser' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorList}
              >
                {COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorButton,
                      activeColor === color && styles.colorButtonActive,
                    ]}
                    onPress={() => updateColor(color)}
                    accessibilityLabel={`选择颜色 ${color}`}
                  >
                    <View
                      style={[styles.colorSwatch, { backgroundColor: color }]}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.configLabel}>橡皮大小</Text>
            )}
            <View style={styles.widthList}>
              {widthOptions.map((width) => (
                <TouchableOpacity
                  key={width}
                  style={[
                    styles.widthButton,
                    activeWidth === width && styles.widthButtonActive,
                  ]}
                  onPress={() => updateWidth(width)}
                >
                  <View
                    style={[
                      styles.widthDot,
                      {
                        width: Math.min(18, Math.max(4, width)),
                        height: Math.min(18, Math.max(4, width)),
                        borderRadius: 9,
                        backgroundColor:
                          tool === 'eraser' ? '#8B90A5' : activeColor,
                      },
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAnnotations}
            >
              <Text style={styles.clearButtonText}>清空</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!exploreMode ? (
          <View
            style={[
              styles.toolbar,
              {
                minHeight: 74 + insets.bottom,
                paddingBottom: 12 + insets.bottom,
              },
            ]}
          >
            {TOOL_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.tool}
                style={[
                  styles.toolButton,
                  tool === item.tool && styles.toolButtonActive,
                ]}
                onPress={() => selectTool(item.tool)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Text
                  style={[
                    styles.toolIcon,
                    tool === item.tool && styles.toolTextActive,
                  ]}
                >
                  {item.icon}
                </Text>
                <Text
                  style={[
                    styles.toolLabel,
                    tool === item.tool && styles.toolTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.toolbarDivider} />
            <TouchableOpacity
              style={[styles.historyButton, !canUndo && styles.buttonDisabled]}
              onPress={() => send({ type: 'undo' })}
              disabled={!canUndo}
              accessibilityLabel="撤销"
            >
              <Text style={styles.historyIcon}>↶</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.historyButton, !canRedo && styles.buttonDisabled]}
              onPress={() => send({ type: 'redo' })}
              disabled={!canRedo}
              accessibilityLabel="重做"
            >
              <Text style={styles.historyIcon}>↷</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.exploreModeBar,
              { paddingBottom: Math.max(12, insets.bottom + 8) },
            ]}
            accessibilityLiveRegion="polite"
          >
            <View style={styles.exploreModeIcon}>
              <View style={styles.exploreCornerTopLeft} />
              <View style={styles.exploreCornerBottomRight} />
            </View>
            <View style={styles.exploreModeCopy}>
              <Text style={styles.exploreModeTitle}>框选教材内容</Text>
              <Text style={styles.exploreModeHint}>
                在 PDF 页面上拖动手指，选择需要向 AI 提问的区域
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      {viewerReady && transferProgress > 0 && transferProgress < 1 ? (
        <View style={styles.transferBadge}>
          <ActivityIndicator size="small" color="#6256D9" />
          <Text style={styles.transferText}>
            正在载入 PDF {Math.round(transferProgress * 100)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const PdfAnnotationViewer = React.memo(PdfAnnotationViewerComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECEEF5',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ECEEF5',
  },
  bottomChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 12,
  },
  toolbar: {
    minHeight: 74,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#DADCE8',
    backgroundColor: '#FFFFFF',
  },
  toolButton: {
    width: 48,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButtonActive: {
    backgroundColor: '#EEEAFE',
  },
  toolIcon: {
    height: 25,
    fontSize: 20,
    lineHeight: 24,
    color: '#42475E',
  },
  toolLabel: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '700',
    color: '#74798F',
  },
  toolTextActive: {
    color: '#6256D9',
  },
  toolbarDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    marginHorizontal: 1,
    backgroundColor: '#DADCE8',
  },
  historyButton: {
    width: 42,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5FA',
  },
  historyIcon: {
    fontSize: 24,
    color: '#42475E',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  configPanel: {
    minHeight: 54,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#DADCE8',
    backgroundColor: '#FAFAFD',
  },
  colorList: {
    paddingRight: 4,
    alignItems: 'center',
  },
  colorButton: {
    width: 38,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorButtonActive: {
    backgroundColor: '#E8E5FA',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20, 24, 42, 0.12)',
  },
  configLabel: {
    marginRight: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#626881',
  },
  widthList: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  widthButton: {
    width: 38,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthButtonActive: {
    backgroundColor: '#E8E5FA',
  },
  widthDot: {
    minWidth: 4,
    minHeight: 4,
  },
  clearButton: {
    minWidth: 44,
    height: 42,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D64B4B',
  },
  transferBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#171B34',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  transferText: {
    marginLeft: 7,
    fontSize: 11,
    fontWeight: '700',
    color: '#42475E',
  },
  exploreModeBar: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D3F5',
    backgroundColor: '#F1EEFF',
  },
  exploreModeIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#6256D9',
  },
  exploreCornerTopLeft: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 9,
    height: 9,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: '#FFFFFF',
  },
  exploreCornerBottomRight: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 9,
    height: 9,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
  },
  exploreModeCopy: {
    flex: 1,
  },
  exploreModeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#292545',
  },
  exploreModeHint: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: '#6D6883',
  },
});
