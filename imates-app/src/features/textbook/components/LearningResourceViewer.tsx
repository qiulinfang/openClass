import React, {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';
import {
  TextbookService,
  type ResourceFile,
} from '../services/textbook-service';
import {
  getLearningResourceKind,
  getLearningResourceMeta,
} from './learning-resource';
import { LearningResourceViewerHeader } from './LearningResourceViewerHeader';
import { PdfExplorePanel } from './PdfExplorePanel';
import type { PdfExploreCapture } from './PdfExploreViewer';
import {
  ResourceExploreOverlay,
  type ResourceExploreSelection,
} from './ResourceExploreOverlay';
import { GgbResourceViewer } from './GgbResourceViewer';

const LazyPdfExploreViewer = lazy(() =>
  import('./PdfExploreViewer').then(({ PdfExploreViewer }) => ({
    default: PdfExploreViewer,
  }))
);

interface LearningResourceViewerProps {
  resource: ResourceFile | null;
  subject: string;
  sectionName: string;
  onClose: () => void;
}

type PreviewStatus = 'loading' | 'ready' | 'error';

const webFrameStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 0,
  background: '#FFFFFF',
  touchAction: 'pan-x pan-y',
};

const webMediaStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  background: '#11131D',
};

const webImageStageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'auto',
  background: '#11131D',
  touchAction: 'pan-x pan-y',
};

const webAudioStageStyle: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: '#ECEEF5',
};

const webAudioCardStyle: React.CSSProperties = {
  width: 'min(560px, 100%)',
  padding: 24,
  borderRadius: 20,
  background: '#FFFFFF',
  boxShadow: '0 8px 28px rgba(23, 21, 42, 0.12)',
};

const webAudioLabelStyle: React.CSSProperties = {
  marginBottom: 18,
  overflow: 'hidden',
  color: '#20243D',
  fontSize: 15,
  fontWeight: 800,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

function LearningResourceViewerComponent({
  resource,
  subject,
  sectionName,
  onClose,
}: LearningResourceViewerProps) {
  const previewRef = useRef<View>(null);
  const resourceWebViewRef = useRef<WebView>(null);
  const webImageRef = useRef<HTMLImageElement | null>(null);
  const webImageStageRef = useRef<HTMLDivElement | null>(null);
  const webImageScaleRef = useRef(1);
  const webImagePinchRef = useRef<{
    distance: number;
    startScale: number;
  } | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webFrameRef = useRef<HTMLIFrameElement | null>(null);
  const nativeVideoCaptureRef = useRef<{
    resolve: (dataUrl: string) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top || 0,
    Platform.OS === 'ios' &&
      insets.top === 0 &&
      !initialWindowMetrics?.insets.top
      ? 44
      : 0,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0
  );
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exploreSelecting, setExploreSelecting] = useState(false);
  const [explorePanelVisible, setExplorePanelVisible] = useState(false);
  const [exploreCapture, setExploreCapture] =
    useState<PdfExploreCapture | null>(null);
  const [capturePending, setCapturePending] = useState(false);
  const [captureVersion, setCaptureVersion] = useState(0);
  const [pdfExploreRendererActivated, setPdfExploreRendererActivated] =
    useState(false);
  const [webMediaUri, setWebMediaUri] = useState('');
  const [webDocumentHtml, setWebDocumentHtml] = useState<string | null>(null);
  const [webImageScale, setWebImageScale] = useState(1);
  const [nativeImageViewport, setNativeImageViewport] = useState({
    width: 0,
    height: 0,
  });

  const kind = resource ? getLearningResourceKind(resource) : 'unknown';
  const meta = useMemo(
    () =>
      getLearningResourceMeta(resource || { fileName: '', mimeType: '' }),
    [resource]
  );
  const previewUri = resource?.fileUrl || '';
  const previewSource = useMemo(() => ({ uri: previewUri }), [previewUri]);
  const readAccessUrl =
    previewUri.startsWith('file://') && previewUri.includes('/')
      ? previewUri.slice(0, previewUri.lastIndexOf('/') + 1)
      : undefined;
  const canRenderInline = kind !== 'archive';
  const isPdf = kind === 'pdf';
  const canExplore =
    !!resource && canRenderInline && !!previewUri && kind !== 'ggb';

  useEffect(() => {
    setStatus(kind === 'archive' ? 'ready' : 'loading');
    setError('');
    setReloadKey(0);
    setExploreSelecting(false);
    setExplorePanelVisible(false);
    setExploreCapture(null);
    setCapturePending(false);
    setCaptureVersion(0);
    setPdfExploreRendererActivated(false);
    setWebMediaUri('');
    setWebDocumentHtml(null);
    webImageScaleRef.current = 1;
    setWebImageScale(1);
    setNativeImageViewport({ width: 0, height: 0 });
  }, [kind, resource?.id]);

  useEffect(() => {
    if (Platform.OS !== 'web' || kind !== 'image') return;
    const stage = webImageStageRef.current;
    if (!stage) return;
    const distance = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      webImagePinchRef.current = {
        distance: distance(event.touches),
        startScale: webImageScaleRef.current,
      };
    };
    const onTouchMove = (event: TouchEvent) => {
      const pinch = webImagePinchRef.current;
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const nextScale = Math.max(
        1,
        Math.min(4, pinch.startScale * (distance(event.touches) / pinch.distance))
      );
      const previousScale = webImageScaleRef.current;
      if (Math.abs(nextScale - previousScale) < 0.005) return;
      const rect = stage.getBoundingClientRect();
      const centerX =
        (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const centerY =
        (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      const contentX = stage.scrollLeft + centerX;
      const contentY = stage.scrollTop + centerY;
      const ratio = nextScale / previousScale;
      webImageScaleRef.current = nextScale;
      setWebImageScale(nextScale);
      requestAnimationFrame(() => {
        stage.scrollLeft = contentX * ratio - centerX;
        stage.scrollTop = contentY * ratio - centerY;
      });
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) webImagePinchRef.current = null;
    };
    stage.addEventListener('touchstart', onTouchStart, { passive: false });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd, { passive: false });
    stage.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      stage.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [kind, webMediaUri]);

  useEffect(
    () => () => {
      const pending = nativeVideoCaptureRef.current;
      if (!pending) return;
      clearTimeout(pending.timeout);
      pending.reject(new Error('资源预览已关闭'));
      nativeVideoCaptureRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      !resource ||
      !['image', 'video', 'audio', 'html', 'text'].includes(kind)
    ) {
      return;
    }
    let disposed = false;
    let objectUrl = '';
    const loadWebResource = async () => {
      try {
        const headers = await TextbookService.getYanbanAuthHeaders();
        const candidates = Array.from(
          new Set(
            [resource.fileUrl, resource.remoteUrl].filter(Boolean) as string[]
          )
        );
        let response =
          typeof globalThis.caches !== 'undefined'
            ? await globalThis.caches.match(resource.fileUrl)
            : undefined;
        let sourceUrl = resource.fileUrl;
        for (const candidate of candidates) {
          if (response?.ok) break;
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
              sourceUrl = candidate;
            }
          } catch {
            // 继续尝试备用地址。
          }
        }
        if (!response?.ok) throw new Error('资源请求失败');
        if (kind === 'html' || kind === 'text') {
          const content = await response.text();
          if (disposed) return;
          if (kind === 'text') {
            setWebDocumentHtml(
              `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:24px;background:#fff;color:#20243d;font:15px/1.7 -apple-system,BlinkMacSystemFont,sans-serif}pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}</style><pre>${escapeHtml(content)}</pre>`
            );
          } else {
            const base = `<base href="${sourceUrl.replaceAll('"', '&quot;')}">`;
            setWebDocumentHtml(
              /<head[\s>]/i.test(content)
                ? content.replace(/<head([^>]*)>/i, `<head$1>${base}`)
                : /<html[\s>]/i.test(content)
                  ? content.replace(/<html([^>]*)>/i, `<html$1><head>${base}</head>`)
                  : `<!doctype html><html><head>${base}</head><body>${content}</body></html>`
            );
          }
          return;
        }
        const blob = await response.blob();
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setWebMediaUri(objectUrl);
      } catch {
        if (!disposed) setWebMediaUri(resource.fileUrl);
      }
    };
    void loadWebResource();
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, resource]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !resource) return;
    const preventGesture = (event: Event) => event.preventDefault();
    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const preventBrowserZoom = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    const options: AddEventListenerOptions = { passive: false };
    document.addEventListener('gesturestart', preventGesture, options);
    document.addEventListener('gesturechange', preventGesture, options);
    document.addEventListener('gestureend', preventGesture, options);
    document.addEventListener('touchmove', preventMultiTouch, options);
    document.addEventListener('wheel', preventBrowserZoom, options);
    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchmove', preventMultiTouch);
      document.removeEventListener('wheel', preventBrowserZoom);
    };
  }, [resource]);

  useEffect(() => {
    if (!resource || status !== 'loading' || !canRenderInline) return;
    const timeout = setTimeout(() => {
      setError('文件加载超时，请检查网络后重试');
      setStatus('error');
    }, 30000);
    return () => clearTimeout(timeout);
  }, [canRenderInline, reloadKey, resource, status]);

  const handleReady = useCallback(() => setStatus('ready'), []);
  const handleError = useCallback((message: string) => {
    setError(message);
    setStatus('error');
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    setError('');
    setReloadKey((current) => current + 1);
  }, []);

  const handleExploreCapture = useCallback((capture: PdfExploreCapture) => {
    setExploreCapture(capture);
    setCaptureVersion((current) => current + 1);
    setExploreSelecting(false);
    setExplorePanelVisible(true);
  }, []);

  const captureWebPreview = useCallback(
    async (width: number, height: number): Promise<string> => {
      if (kind === 'image' && webImageRef.current) {
        const image = webImageRef.current;
        const stage = webImageStageRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('图片截图画布不可用');
        context.fillStyle = '#ECEEF5';
        context.fillRect(0, 0, width, height);
        const imageRect = image.getBoundingClientRect();
        const stageRect = stage?.getBoundingClientRect() || {
          left: 0,
          top: 0,
        };
        const scale = Math.min(
          imageRect.width / image.naturalWidth,
          imageRect.height / image.naturalHeight
        );
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        context.drawImage(
          image,
          imageRect.left - stageRect.left + (imageRect.width - drawWidth) / 2,
          imageRect.top - stageRect.top + (imageRect.height - drawHeight) / 2,
          drawWidth,
          drawHeight
        );
        return canvas.toDataURL('image/jpeg', 0.9);
      }
      if (kind === 'video' && webVideoRef.current) {
        const video = webVideoRef.current;
        video.pause();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context || !video.videoWidth || !video.videoHeight) {
          throw new Error('视频画面尚未准备好，请稍后重试');
        }
        context.fillStyle = '#11131D';
        context.fillRect(0, 0, width, height);
        const scale = Math.min(
          width / video.videoWidth,
          height / video.videoHeight
        );
        const drawWidth = video.videoWidth * scale;
        const drawHeight = video.videoHeight * scale;
        context.drawImage(
          video,
          (width - drawWidth) / 2,
          (height - drawHeight) / 2,
          drawWidth,
          drawHeight
        );
        return canvas.toDataURL('image/jpeg', 0.9);
      }
      const frame = webFrameRef.current;
      let frameDocument: Document | null = null;
      try {
        frameDocument = frame?.contentDocument || null;
      } catch {
        frameDocument = null;
      }
      if (frameDocument?.documentElement) {
        const frameWindow = frame?.contentWindow;
        const { default: html2canvas } = await import('html2canvas');
        await frameDocument.fonts?.ready;
        await Promise.allSettled(
          Array.from(frameDocument.images).map((image) => image.decode())
        );
        const renderFrame = (foreignObjectRendering: boolean) =>
          html2canvas(frameDocument.documentElement, {
            backgroundColor: '#FFFFFF',
            x: frameWindow?.scrollX || 0,
            y: frameWindow?.scrollY || 0,
            scrollX: frameWindow?.scrollX || 0,
            scrollY: frameWindow?.scrollY || 0,
            width,
            height,
            windowWidth: width,
            windowHeight: height,
            scale: 1,
            foreignObjectRendering,
            useCORS: true,
            logging: false,
          });
        let canvas = await renderFrame(true);
        const hasVisiblePixels = (target: HTMLCanvasElement) => {
          try {
            const context = target.getContext('2d', {
              willReadFrequently: true,
            });
            if (!context) return false;
            const pixels = context.getImageData(
              0,
              0,
              target.width,
              target.height
            ).data;
            const stride = Math.max(
              4,
              Math.floor(pixels.length / 16000 / 4) * 4
            );
            for (let index = 0; index < pixels.length; index += stride) {
              if (
                pixels[index + 3] > 0 &&
                (pixels[index] < 246 ||
                  pixels[index + 1] < 246 ||
                  pixels[index + 2] < 246)
              ) {
                return true;
              }
            }
          } catch {
            return false;
          }
          return false;
        };
        if (!hasVisiblePixels(canvas)) canvas = await renderFrame(false);
        if (!hasVisiblePixels(canvas)) {
          throw new Error('HTML 页面未生成可见截图，请等待内容加载后重试');
        }
        if (canvas.width !== width || canvas.height !== height) {
          const normalizedCanvas = document.createElement('canvas');
          normalizedCanvas.width = width;
          normalizedCanvas.height = height;
          const normalizedContext = normalizedCanvas.getContext('2d');
          if (!normalizedContext) throw new Error('HTML 截图画布不可用');
          normalizedContext.drawImage(canvas, 0, 0, width, height);
          canvas = normalizedCanvas;
        }
        return canvas.toDataURL('image/jpeg', 0.9);
      }
      if (kind === 'html' || kind === 'text') {
        throw new Error('HTML 页面尚未准备好，请等待内容加载后重试');
      }
      if (!previewRef.current) throw new Error('资源截图区域不可用');
      return captureRef(previewRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'data-uri',
        width,
        height,
      });
    },
    [kind]
  );

  const getCapturedImageSize = useCallback(
    (uri: string) =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(
          uri,
          (width, height) => resolve({ width, height }),
          reject
        );
      }),
    []
  );

  const captureNativePreview = useCallback(async (viewport: {
    width: number;
    height: number;
  }): Promise<{
    uri: string;
    offsetX: number;
    offsetY: number;
    sourceWidth: number;
    sourceHeight: number;
    scaleX: number;
    scaleY: number;
  }> => {
    const preview = previewRef.current;
    if (!preview) throw new Error('资源截图区域不可用');
    const uri = await captureRef(preview, {
      format: 'jpg',
      quality: 0.9,
      result: 'data-uri',
      width: viewport.width,
      height: viewport.height,
      useRenderInContext: false,
    });
    const imageSize = await getCapturedImageSize(uri);
    return {
      uri,
      offsetX: 0,
      offsetY: 0,
      sourceWidth: imageSize.width,
      sourceHeight: imageSize.height,
      scaleX: imageSize.width / viewport.width,
      scaleY: imageSize.height / viewport.height,
    };
  }, [getCapturedImageSize]);

  const captureNativeVideoFrame = useCallback(
    (width: number, height: number) =>
      new Promise<string>((resolve, reject) => {
        const webView = resourceWebViewRef.current;
        if (!webView) {
          reject(new Error('视频预览尚未准备好'));
          return;
        }
        if (nativeVideoCaptureRef.current) {
          clearTimeout(nativeVideoCaptureRef.current.timeout);
          nativeVideoCaptureRef.current.reject(new Error('截图请求已被替换'));
        }
        const timeout = setTimeout(() => {
          nativeVideoCaptureRef.current = null;
          reject(new Error('视频帧截取超时，请重试'));
        }, 8000);
        nativeVideoCaptureRef.current = { resolve, reject, timeout };
        webView.injectJavaScript(`
          (function () {
            try {
              var video = document.querySelector('video');
              if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
                throw new Error('视频画面尚未准备好');
              }
              video.pause();
              var outputWidth = ${width};
              var outputHeight = ${height};
              var viewportWidth = window.innerWidth || outputWidth;
              var viewportHeight = window.innerHeight || outputHeight;
              var scaleX = outputWidth / viewportWidth;
              var scaleY = outputHeight / viewportHeight;
              var rect = video.getBoundingClientRect();
              var containScale = Math.min(
                rect.width / video.videoWidth,
                rect.height / video.videoHeight
              );
              var drawWidth = video.videoWidth * containScale;
              var drawHeight = video.videoHeight * containScale;
              var drawX = rect.left + (rect.width - drawWidth) / 2;
              var drawY = rect.top + (rect.height - drawHeight) / 2;
              var canvas = document.createElement('canvas');
              canvas.width = outputWidth;
              canvas.height = outputHeight;
              var context = canvas.getContext('2d');
              context.fillStyle = '#11131D';
              context.fillRect(0, 0, outputWidth, outputHeight);
              context.drawImage(
                video,
                drawX * scaleX,
                drawY * scaleY,
                drawWidth * scaleX,
                drawHeight * scaleY
              );
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'resource-video-frame',
                dataUrl: canvas.toDataURL('image/jpeg', 0.9)
              }));
            } catch (error) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'resource-video-frame-error',
                message: error && error.message ? error.message : '视频帧截取失败'
              }));
            }
          })();
          true;
        `);
      }),
    []
  );

  const handleResourceWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data);
        const pending = nativeVideoCaptureRef.current;
        if (!pending) return;
        if (
          message.type === 'resource-video-frame' &&
          typeof message.dataUrl === 'string'
        ) {
          clearTimeout(pending.timeout);
          nativeVideoCaptureRef.current = null;
          pending.resolve(message.dataUrl);
        } else if (message.type === 'resource-video-frame-error') {
          clearTimeout(pending.timeout);
          nativeVideoCaptureRef.current = null;
          pending.reject(new Error(message.message || '视频帧截取失败'));
        }
      } catch {
        // 忽略资源页面中的其他消息。
      }
    },
    []
  );

  const handleResourceExploreSelection = useCallback(
    async (selection: ResourceExploreSelection) => {
      if (!previewRef.current || capturePending) return;
      setCapturePending(true);
      try {
        await waitForPaint();
        const viewportWidth = Math.max(1, Math.round(selection.viewportWidth));
        const viewportHeight = Math.max(1, Math.round(selection.viewportHeight));
        const nativeCapture =
          Platform.OS === 'web'
            ? null
            : kind === 'video'
              ? {
                  uri: await captureNativeVideoFrame(
                    viewportWidth,
                    viewportHeight
                  ),
                  offsetX: 0,
                  offsetY: 0,
                  sourceWidth: viewportWidth,
                  sourceHeight: viewportHeight,
                  scaleX: 1,
                  scaleY: 1,
                }
              : await captureNativePreview({
                  width: viewportWidth,
                  height: viewportHeight,
                });
        const capturedUri = nativeCapture
          ? nativeCapture.uri
          : await captureWebPreview(viewportWidth, viewportHeight);
        const originX = Math.max(
          0,
          Math.round(
            nativeCapture
              ? (selection.x + nativeCapture.offsetX) * nativeCapture.scaleX
              : selection.x
          )
        );
        const originY = Math.max(
          0,
          Math.round(
            nativeCapture
              ? (selection.y + nativeCapture.offsetY) * nativeCapture.scaleY
              : selection.y
          )
        );
        const sourceWidth = nativeCapture
          ? nativeCapture.sourceWidth
          : viewportWidth;
        const sourceHeight = nativeCapture
          ? nativeCapture.sourceHeight
          : viewportHeight;
        const crop = {
          originX,
          originY,
          width: Math.max(
            1,
            Math.min(
              sourceWidth - originX,
              Math.round(
                selection.width * (nativeCapture?.scaleX || 1)
              )
            )
          ),
          height: Math.max(
            1,
            Math.min(
              sourceHeight - originY,
              Math.round(
                selection.height * (nativeCapture?.scaleY || 1)
              )
            )
          ),
        };
        const result = await manipulateAsync(
          capturedUri,
          [{ crop }],
          { base64: true, compress: 0.88, format: SaveFormat.JPEG }
        );
        if (!result.base64) throw new Error('截图数据生成失败');
        handleExploreCapture({
          dataUrl: `data:image/jpeg;base64,${result.base64}`,
          pageNumber: 1,
          width: crop.width,
          height: crop.height,
        });
      } catch (caught) {
        Alert.alert(
          '探索区域',
          caught instanceof Error ? caught.message : '截图失败，请重新框选'
        );
      } finally {
        setCapturePending(false);
      }
    },
    [
      captureNativePreview,
      captureNativeVideoFrame,
      capturePending,
      captureWebPreview,
      handleExploreCapture,
      kind,
    ]
  );

  const toggleExplore = useCallback(() => {
    if (exploreSelecting) {
      setExploreSelecting(false);
    } else {
      if (kind === 'video') {
        if (Platform.OS === 'web') {
          webVideoRef.current?.pause();
        } else {
          resourceWebViewRef.current?.injectJavaScript(
            "document.querySelectorAll('video').forEach(function(video){video.pause();});true;"
          );
        }
      }
      if (isPdf && Platform.OS === 'web' && !pdfExploreRendererActivated) {
        setPdfExploreRendererActivated(true);
        setStatus('loading');
      }
      setExploreCapture(null);
      setExplorePanelVisible(false);
      setExploreSelecting(true);
    }
  }, [exploreSelecting, isPdf, kind, pdfExploreRendererActivated]);

  const renderPreview = () => {
    if (!resource || !previewUri || !canRenderInline) return null;

    if (isPdf && Platform.OS === 'web' && !pdfExploreRendererActivated) {
      return (
        <iframe
          key={`${resource.id}-${reloadKey}-native-pdf`}
          src={previewUri}
          title={resource.fileName}
          style={webFrameStyle}
          onLoad={handleReady}
          onError={() => handleError('PDF 文件加载失败')}
        />
      );
    }

    if (isPdf) {
      return (
        <Suspense fallback={null}>
          <LazyPdfExploreViewer
            resource={resource}
            reloadKey={reloadKey}
            exploreMode={exploreSelecting}
            onReady={handleReady}
            onError={handleError}
            onExploreCapture={handleExploreCapture}
            onExploreCaptureError={(message) =>
              Alert.alert('探索区域', message)
            }
          />
        </Suspense>
      );
    }

    if (kind === 'ggb') {
      return (
        <GgbResourceViewer
          key={`${resource.id}-${reloadKey}-ggb`}
          resource={resource}
          reloadKey={reloadKey}
          onReady={handleReady}
          onError={handleError}
        />
      );
    }

    if (kind === 'image' && Platform.OS === 'web') {
      if (!webMediaUri) return null;
      return (
        <div ref={webImageStageRef} style={webImageStageStyle}>
          <img
            ref={webImageRef}
            key={`${resource.id}-${reloadKey}-${webMediaUri}`}
            src={webMediaUri}
            alt={resource.fileName}
            style={{
              ...webMediaStyle,
              width: `${webImageScale * 100}%`,
              height: `${webImageScale * 100}%`,
              maxWidth: 'none',
            }}
            onLoad={handleReady}
            onError={() => handleError('图片加载失败')}
          />
        </div>
      );
    }

    if (kind === 'image') {
      if (Platform.OS === 'android') {
        return (
          <WebView
            ref={resourceWebViewRef}
            key={`${resource.id}-${reloadKey}`}
            source={previewSource}
            style={styles.imageWebView}
            originWhitelist={['*']}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            scalesPageToFit
            setBuiltInZoomControls
            setDisplayZoomControls={false}
            nestedScrollEnabled
            startInLoadingState={false}
            onLoadStart={() => setStatus('loading')}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent.progress >= 0.9) handleReady();
            }}
            onLoad={handleReady}
            onError={({ nativeEvent }) =>
              handleError(nativeEvent.description || '图片加载失败')
            }
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.url === previewUri) {
                handleError(`图片请求失败（HTTP ${nativeEvent.statusCode}）`);
              }
            }}
          />
        );
      }

      return (
        <ScrollView
          style={styles.imageScroll}
          contentContainerStyle={styles.imageStage}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          bouncesZoom
          onLayout={({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout;
            setNativeImageViewport((current) =>
              current.width === width && current.height === height
                ? current
                : { width, height }
            );
          }}
        >
          <Image
            key={`${resource.id}-${reloadKey}`}
            source={previewSource}
            style={[
              styles.previewImage,
              nativeImageViewport.width > 0 && {
                width: nativeImageViewport.width,
                height: nativeImageViewport.height,
                minHeight: nativeImageViewport.height,
              },
            ]}
            resizeMode="contain"
            onLoad={handleReady}
            onError={({ nativeEvent }) =>
              handleError(nativeEvent.error || '图片加载失败')
            }
          />
        </ScrollView>
      );
    }

    if (kind === 'video' && Platform.OS === 'web') {
      if (!webMediaUri) return null;
      return (
        <video
          ref={webVideoRef}
          key={`${resource.id}-${reloadKey}-${webMediaUri}`}
          src={webMediaUri}
          title={resource.fileName}
          style={webMediaStyle}
          controls
          playsInline
          onCanPlay={handleReady}
          onError={() => handleError('视频加载失败')}
        />
      );
    }

    if (kind === 'audio' && Platform.OS === 'web') {
      if (!webMediaUri) return null;
      return (
        <div style={webAudioStageStyle}>
          <div style={webAudioCardStyle}>
            <div style={webAudioLabelStyle}>{resource.fileName}</div>
            <audio
              key={`${resource.id}-${reloadKey}-${webMediaUri}`}
              src={webMediaUri}
              controls
              style={{ width: '100%' }}
              onCanPlay={handleReady}
              onError={() => handleError('音频加载失败')}
            />
          </div>
        </div>
      );
    }

    if (Platform.OS === 'web') {
      return (
        <iframe
          ref={webFrameRef}
          key={`${resource.id}-${reloadKey}`}
          src={previewUri}
          srcDoc={webDocumentHtml || undefined}
          title={resource.fileName}
          style={webFrameStyle}
          allow="autoplay; fullscreen"
          allowFullScreen
          onLoad={handleReady}
          onError={() => handleError('文件加载失败')}
        />
      );
    }

    return (
      <WebView
        ref={resourceWebViewRef}
        key={`${resource.id}-${reloadKey}`}
        source={previewSource}
        style={styles.webView}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        {...(Platform.OS === 'ios' && readAccessUrl
          ? { allowingReadAccessToURL: readAccessUrl }
          : {})}
        startInLoadingState={false}
        onMessage={handleResourceWebViewMessage}
        onLoadStart={() => setStatus('loading')}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.9) handleReady();
        }}
        onLoad={handleReady}
        onError={({ nativeEvent }) =>
          handleError(nativeEvent.description || '文件加载失败')
        }
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.url === previewUri) {
            handleError(`文件请求失败（HTTP ${nativeEvent.statusCode}）`);
          }
        }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={!!resource}
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      onRequestClose={onClose}
    >
      <View style={styles.safeArea}>
        <LearningResourceViewerHeader
          topInset={topInset}
          title={resource?.fileName || '文件预览'}
          meta={meta}
          exploreSelecting={exploreSelecting}
          exploreDisabled={!canExplore || status !== 'ready' || capturePending}
          showExplore={kind !== 'ggb'}
          onBack={onClose}
          onExplore={toggleExplore}
        />

        <View style={styles.body}>
          {resource?.fileUrl && previewUri && canRenderInline ? (
            <>
              <View ref={previewRef} collapsable={false} style={styles.preview}>
                {renderPreview()}
              </View>
              {!isPdf &&
              exploreSelecting &&
              !capturePending &&
              status === 'ready' ? (
                <ResourceExploreOverlay
                  onComplete={handleResourceExploreSelection}
                  onError={(message) => Alert.alert('探索区域', message)}
                />
              ) : null}
              {capturePending ? (
                <View style={styles.captureState} pointerEvents="none">
                  <ActivityIndicator size="small" color="#6256D9" />
                  <Text style={styles.captureStateText}>正在生成截图…</Text>
                </View>
              ) : null}
              {status === 'loading' ? (
                <View style={styles.loadingState} pointerEvents="none">
                  <ActivityIndicator size="large" color="#6256D9" />
                  <Text style={styles.loadingTitle}>
                    {kind === 'ggb'
                      ? '正在加载互动课件'
                      : '正在打开文件'}
                  </Text>
                  <Text style={styles.loadingText}>
                    {kind === 'ggb'
                      ? '首次打开需要加载 GeoGebra 引擎，可能需要较长时间'
                      : `正在加载${meta.label}…`}
                  </Text>
                  {kind === 'ggb' ? (
                    <Text style={styles.loadingHint}>
                      请保持网络连接，无需退出当前页面
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {status === 'error' ? (
                <View style={styles.errorState}>
                  <View style={styles.errorIcon}>
                    <Text style={styles.errorIconText}>!</Text>
                  </View>
                  <Text style={styles.errorTitle}>文件未能打开</Text>
                  <Text style={styles.errorMessage}>
                    {error || '文件地址不可访问，请稍后重试'}
                  </Text>
                  <TouchableOpacity style={styles.retryButton} onPress={retry}>
                    <Text style={styles.retryText}>重新加载</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View
                style={[styles.emptyBadge, { backgroundColor: meta.background }]}
              >
                <Text style={[styles.emptyBadgeText, { color: meta.accent }]}>
                  {meta.shortLabel}
                </Text>
              </View>
              <Text style={styles.errorTitle}>
                {kind === 'archive' ? '压缩文件不支持在线预览' : '暂无可用地址'}
              </Text>
              <Text style={styles.emptyText}>
                {kind === 'archive'
                  ? '请下载后使用设备中的应用打开'
                  : '该文件暂时无法在线预览'}
              </Text>
            </View>
          )}
        </View>
        <PdfExplorePanel
          key={`${resource?.id || 'resource'}-${captureVersion}`}
          visible={explorePanelVisible}
          capture={exploreCapture}
          resourceId={resource?.id || ''}
          resourceName={resource?.fileName || '教材 PDF'}
          subject={subject}
          sectionName={sectionName}
          showPageNumber={isPdf}
          onClose={() => setExplorePanelVisible(false)}
          onReselect={() => {
            setExploreCapture(null);
            setExplorePanelVisible(false);
            setExploreSelecting(true);
          }}
        />
      </View>
    </Modal>
  );
}

export const LearningResourceViewer = memo(LearningResourceViewerComponent);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  body: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#ECEEF5',
  },
  preview: {
    flex: 1,
    overflow: 'hidden',
  },
  captureState: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    zIndex: 20,
    minHeight: 38,
    paddingHorizontal: 15,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#17152A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 9,
    elevation: 7,
  },
  captureStateText: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#42475E',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  imageScroll: {
    flex: 1,
  },
  imageWebView: {
    flex: 1,
    backgroundColor: '#11131D',
  },
  imageStage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    minHeight: 320,
  },
  loadingState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7FC',
    zIndex: 5,
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '800',
    color: '#20243D',
  },
  loadingText: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 28,
    textAlign: 'center',
    color: '#626881',
  },
  loadingHint: {
    marginTop: 5,
    paddingHorizontal: 28,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    color: '#989DB2',
  },
  errorState: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7FC',
    zIndex: 8,
  },
  errorIcon: {
    width: 52,
    height: 52,
    marginBottom: 16,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F0',
  },
  errorIconText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#D64B4B',
  },
  errorTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    color: '#20243D',
  },
  errorMessage: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#626881',
  },
  retryButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6256D9',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBadge: {
    minWidth: 72,
    height: 72,
    marginBottom: 18,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 12,
    color: '#989DB2',
  },
});
