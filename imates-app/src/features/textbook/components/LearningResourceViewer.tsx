import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { WebView } from 'react-native-webview';
import type { ResourceFile } from '../services/textbook-service';
import {
  getLearningResourceKind,
  getLearningResourceMeta,
  getLearningResourcePreviewUri,
} from './learning-resource';

interface LearningResourceViewerProps {
  resource: ResourceFile | null;
  onClose: () => void;
}

type PreviewStatus = 'loading' | 'ready' | 'error';

const webFrameStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 0,
  background: '#FFFFFF',
};

function LearningResourceViewerComponent({
  resource,
  onClose,
}: LearningResourceViewerProps) {
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

  const kind = resource ? getLearningResourceKind(resource) : 'unknown';
  const meta = useMemo(
    () =>
      getLearningResourceMeta(resource || { fileName: '', mimeType: '' }),
    [resource]
  );
  const previewUri = resource
    ? getLearningResourcePreviewUri(resource, kind)
    : '';
  const readAccessUrl =
    previewUri.startsWith('file://') && previewUri.includes('/')
      ? previewUri.slice(0, previewUri.lastIndexOf('/') + 1)
      : undefined;
  const canRenderInline = kind !== 'archive';

  useEffect(() => {
    setStatus(kind === 'archive' ? 'ready' : 'loading');
    setError('');
    setReloadKey(0);
  }, [kind, resource?.id]);

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

  const renderPreview = () => {
    if (!resource || !previewUri || !canRenderInline) return null;

    if (kind === 'image') {
      return (
        <ScrollView
          style={styles.imageScroll}
          contentContainerStyle={styles.imageStage}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
        >
          <Image
            key={`${resource.id}-${reloadKey}`}
            source={{ uri: previewUri }}
            style={styles.previewImage}
            resizeMode="contain"
            onLoadStart={() => setStatus('loading')}
            onLoad={handleReady}
            onError={({ nativeEvent }) =>
              handleError(nativeEvent.error || '图片加载失败')
            }
          />
        </ScrollView>
      );
    }

    if (Platform.OS === 'web') {
      return (
        <iframe
          key={`${resource.id}-${reloadKey}`}
          src={previewUri}
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
        key={`${resource.id}-${reloadKey}`}
        source={{ uri: previewUri }}
        style={styles.webView}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        {...(Platform.OS === 'ios' && readAccessUrl
          ? { allowingReadAccessToURL: readAccessUrl }
          : {})}
        startInLoadingState={false}
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
        <View style={[styles.header, { paddingTop: topInset + 8 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="返回教材详情"
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.heading}>
            <View style={styles.eyebrowRow}>
              <View
                style={[styles.eyebrowDot, { backgroundColor: meta.accent }]}
              />
              <Text style={[styles.eyebrow, { color: meta.accent }]}>
                {meta.label}
              </Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {resource?.fileName || '文件预览'}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.body}>
          {resource?.fileUrl && previewUri && canRenderInline ? (
            <>
              {renderPreview()}
              {status === 'loading' ? (
                <View style={styles.loadingState} pointerEvents="none">
                  <ActivityIndicator size="large" color="#6256D9" />
                  <Text style={styles.loadingTitle}>正在打开文件</Text>
                  <Text style={styles.loadingText}>
                    正在加载{meta.label}…
                  </Text>
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
  header: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E5F0',
    backgroundColor: '#FFFFFF',
    zIndex: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
  },
  backIcon: {
    marginTop: -2,
    fontSize: 34,
    lineHeight: 36,
    color: '#6256D9',
  },
  heading: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 10,
    alignItems: 'center',
  },
  eyebrowRow: {
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    marginRight: 5,
    borderRadius: 3,
  },
  eyebrow: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  title: {
    maxWidth: '100%',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: '#20243D',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  body: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#ECEEF5',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  imageScroll: {
    flex: 1,
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
    color: '#626881',
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

