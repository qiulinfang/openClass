import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Platform,
  Pressable,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import { AppModal } from '@/components/AppSafeArea';
import { getUserInfo, UserInfo } from '@/services/auth-service';
import { storage } from '@/services/storage';
import appJson from '../../app.json';

interface ProfileScreenProps {
  onLogout: () => void;
  onOpenTeacherRecords: () => void;
  onOpenFavorites: () => void;
  onOpenQuestionRecords: () => void;
  onOpenSupport: () => void;
}

const APP_VERSION = appJson.expo.version;
const AVATAR_STORAGE_KEY = 'userInfo';
const MIN_CROP_SCALE = 1;
const MAX_CROP_SCALE = 4;

interface SelectedAvatarImage {
  uri: string;
  width: number;
  height: number;
}

interface AvatarCropTransform {
  scale: number;
  x: number;
  y: number;
}

const INITIAL_CROP_TRANSFORM: AvatarCropTransform = {
  scale: 1,
  x: 0,
  y: 0,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const getTouchDistance = (touches: readonly any[]): number => {
  if (touches.length < 2) return 0;
  return Math.hypot(
    touches[0].pageX - touches[1].pageX,
    touches[0].pageY - touches[1].pageY
  );
};

const getCoverImageSize = (
  image: SelectedAvatarImage,
  viewportSize: number
): { width: number; height: number } => {
  const aspect = image.width / image.height;
  if (aspect >= 1) {
    return {
      width: viewportSize * aspect,
      height: viewportSize,
    };
  }
  return {
    width: viewportSize,
    height: viewportSize / aspect,
  };
};

const resolveAvatarUri = (userInfo: UserInfo | null): string | null => {
  const avatar = userInfo?.avatarNew || userInfo?.avatar;
  if (!avatar) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(avatar)) return avatar;
  return `https://www.imates.com.cn${avatar.startsWith('/') ? '' : '/'}${avatar}`;
};

const LightColors = {
  background: '#f1f3ff', // Soft purple-blue matching Web
  cardBackground: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  primary: '#4F46E5', // Indigo-600
  primaryLight: '#EEF2FF',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
};

export function ProfileScreen({
  onLogout,
  onOpenTeacherRecords,
  onOpenFavorites,
  onOpenQuestionRecords,
  onOpenSupport,
}: ProfileScreenProps) {
  const { width: windowWidth, height: windowHeight } =
    useWindowDimensions();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [pendingAvatarUri, setPendingAvatarUri] =
    useState<string | null>(null);
  const [selectedAvatarImage, setSelectedAvatarImage] =
    useState<SelectedAvatarImage | null>(null);
  const [cropTransform, setCropTransform] =
    useState<AvatarCropTransform>(INITIAL_CROP_TRANSFORM);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const selectedAvatarImageRef =
    useRef<SelectedAvatarImage | null>(null);
  const cropViewportSizeRef = useRef(220);
  const cropGestureAreaRef = useRef<View | null>(null);
  const cropTransformRef =
    useRef<AvatarCropTransform>(INITIAL_CROP_TRANSFORM);
  const cropGestureStartRef = useRef({
    scale: 1,
    x: 0,
    y: 0,
    pinchDistance: 0,
  });
  const webCropGestureStartRef = useRef({
    scale: 1,
    x: 0,
    y: 0,
    pinchDistance: 0,
    centerX: 0,
    centerY: 0,
    pointerX: 0,
    pointerY: 0,
  });

  const constrainCropTransform = (
    transform: AvatarCropTransform
  ): AvatarCropTransform => {
    const image = selectedAvatarImageRef.current;
    const viewportSize = cropViewportSizeRef.current;
    const scale = clamp(
      transform.scale,
      MIN_CROP_SCALE,
      MAX_CROP_SCALE
    );
    if (!image) return { scale, x: 0, y: 0 };
    const baseSize = getCoverImageSize(image, viewportSize);
    const maxX = Math.max(
      0,
      (baseSize.width * scale - viewportSize) / 2
    );
    const maxY = Math.max(
      0,
      (baseSize.height * scale - viewportSize) / 2
    );
    return {
      scale,
      x: clamp(transform.x, -maxX, maxX),
      y: clamp(transform.y, -maxY, maxY),
    };
  };

  const updateCropTransform = (
    transform: AvatarCropTransform
  ) => {
    const next = constrainCropTransform(transform);
    cropTransformRef.current = next;
    setCropTransform(next);
  };

  const cropPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          !!selectedAvatarImageRef.current,
        onStartShouldSetPanResponderCapture: () =>
          !!selectedAvatarImageRef.current,
        onMoveShouldSetPanResponder: () =>
          !!selectedAvatarImageRef.current,
        onMoveShouldSetPanResponderCapture: () =>
          !!selectedAvatarImageRef.current,
        onPanResponderGrant: (event) => {
          const current = cropTransformRef.current;
          cropGestureStartRef.current = {
            ...current,
            pinchDistance: getTouchDistance(
              event.nativeEvent.touches
            ),
          };
        },
        onPanResponderStart: (event) => {
          const touches = event.nativeEvent.touches;
          if (touches.length < 2) return;
          cropGestureStartRef.current = {
            ...cropTransformRef.current,
            pinchDistance: getTouchDistance(touches),
          };
        },
        onPanResponderMove: (event, gestureState) => {
          const start = cropGestureStartRef.current;
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            const nextDistance = getTouchDistance(touches);
            if (start.pinchDistance <= 0) {
              cropGestureStartRef.current = {
                ...cropTransformRef.current,
                pinchDistance: nextDistance,
              };
              return;
            }
            updateCropTransform({
              scale:
                start.scale *
                (nextDistance / start.pinchDistance),
              x: start.x,
              y: start.y,
            });
            return;
          }
          if (start.pinchDistance > 0) {
            cropGestureStartRef.current = {
              ...cropTransformRef.current,
              pinchDistance: 0,
            };
            return;
          }
          updateCropTransform({
            scale: start.scale,
            x: start.x + gestureState.dx,
            y: start.y + gestureState.dy,
          });
        },
        onPanResponderEnd: (event) => {
          const touches = event.nativeEvent.touches;
          cropGestureStartRef.current = {
            ...cropTransformRef.current,
            pinchDistance:
              touches.length >= 2
                ? getTouchDistance(touches)
                : 0,
          };
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    []
  );

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      !selectedAvatarImage ||
      !avatarModalVisible
    ) {
      return;
    }

    const gestureArea =
      cropGestureAreaRef.current as unknown as HTMLElement | null;
    if (!gestureArea) return;

    gestureArea.style.touchAction = 'none';
    gestureArea.style.overscrollBehavior = 'contain';

    const getCenter = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });
    const getDistance = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );

    const beginGesture = (event: TouchEvent) => {
      event.preventDefault();
      const current = cropTransformRef.current;
      if (event.touches.length >= 2) {
        const center = getCenter(event.touches);
        webCropGestureStartRef.current = {
          ...current,
          pinchDistance: getDistance(event.touches),
          centerX: center.x,
          centerY: center.y,
          pointerX: 0,
          pointerY: 0,
        };
      } else if (event.touches.length === 1) {
        webCropGestureStartRef.current = {
          ...current,
          pinchDistance: 0,
          centerX: 0,
          centerY: 0,
          pointerX: event.touches[0].clientX,
          pointerY: event.touches[0].clientY,
        };
      }
    };

    const moveGesture = (event: TouchEvent) => {
      if (event.touches.length === 0) return;
      event.preventDefault();
      const start = webCropGestureStartRef.current;

      if (event.touches.length >= 2) {
        const distance = getDistance(event.touches);
        if (start.pinchDistance <= 0) {
          beginGesture(event);
          return;
        }
        const center = getCenter(event.touches);
        const ratio = distance / start.pinchDistance;
        const nextScale = clamp(
          start.scale * ratio,
          MIN_CROP_SCALE,
          MAX_CROP_SCALE
        );
        const appliedRatio = nextScale / start.scale;
        const rect = gestureArea.getBoundingClientRect();
        const focalX =
          start.centerX - (rect.left + rect.width / 2);
        const focalY =
          start.centerY - (rect.top + rect.height / 2);

        updateCropTransform({
          scale: nextScale,
          x:
            start.x +
            (center.x - start.centerX) +
            (1 - appliedRatio) * (focalX - start.x),
          y:
            start.y +
            (center.y - start.centerY) +
            (1 - appliedRatio) * (focalY - start.y),
        });
        return;
      }

      if (start.pinchDistance > 0) {
        beginGesture(event);
        return;
      }
      updateCropTransform({
        scale: start.scale,
        x: start.x + event.touches[0].clientX - start.pointerX,
        y: start.y + event.touches[0].clientY - start.pointerY,
      });
    };

    const endGesture = (event: TouchEvent) => {
      if (event.touches.length > 0) beginGesture(event);
    };

    const listenerOptions: AddEventListenerOptions = {
      passive: false,
    };
    gestureArea.addEventListener(
      'touchstart',
      beginGesture,
      listenerOptions
    );
    gestureArea.addEventListener(
      'touchmove',
      moveGesture,
      listenerOptions
    );
    gestureArea.addEventListener(
      'touchend',
      endGesture,
      listenerOptions
    );
    gestureArea.addEventListener(
      'touchcancel',
      endGesture,
      listenerOptions
    );

    return () => {
      gestureArea.removeEventListener('touchstart', beginGesture);
      gestureArea.removeEventListener('touchmove', moveGesture);
      gestureArea.removeEventListener('touchend', endGesture);
      gestureArea.removeEventListener('touchcancel', endGesture);
    };
  }, [avatarModalVisible, selectedAvatarImage]);

  useEffect(() => {
    async function loadUser() {
      setIsLoading(true);
      const info = await getUserInfo();
      setUserInfo(info);
      setIsLoading(false);
    }
    loadUser();
  }, []);

  const handleChangeAvatar = async () => {
    try {
      setIsPreparingAvatar(true);
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('需要相册权限', '请允许访问相册后再更换头像。');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const selectedImage = {
        uri: asset.uri,
        width: asset.width || 1,
        height: asset.height || 1,
      };
      selectedAvatarImageRef.current = selectedImage;
      setSelectedAvatarImage(selectedImage);
      setPendingAvatarUri(null);
      updateCropTransform(INITIAL_CROP_TRANSFORM);
    } catch (error) {
      console.warn('[ProfileScreen] 更换头像失败:', error);
      Alert.alert('更换失败', '暂时无法读取所选图片，请稍后重试。');
    } finally {
      setIsPreparingAvatar(false);
    }
  };

  const handleCloseAvatarModal = () => {
    if (isPreparingAvatar) return;
    setPendingAvatarUri(null);
    setSelectedAvatarImage(null);
    selectedAvatarImageRef.current = null;
    updateCropTransform(INITIAL_CROP_TRANSFORM);
    setAvatarModalVisible(false);
  };

  const handleApplyAvatarCrop = async () => {
    if (!selectedAvatarImage || isPreparingAvatar) return;
    try {
      setIsPreparingAvatar(true);
      const viewportSize = cropViewportSizeRef.current;
      const baseSize = getCoverImageSize(
        selectedAvatarImage,
        viewportSize
      );
      const displayWidth = baseSize.width * cropTransform.scale;
      const displayHeight = baseSize.height * cropTransform.scale;
      const imageLeft =
        (viewportSize - displayWidth) / 2 + cropTransform.x;
      const imageTop =
        (viewportSize - displayHeight) / 2 + cropTransform.y;
      const pixelsPerPoint =
        selectedAvatarImage.width / displayWidth;
      const rawCropSize = viewportSize * pixelsPerPoint;
      const cropSize = Math.min(
        rawCropSize,
        selectedAvatarImage.width,
        selectedAvatarImage.height
      );
      const originX = clamp(
        -imageLeft * pixelsPerPoint,
        0,
        selectedAvatarImage.width - cropSize
      );
      const originY = clamp(
        -imageTop * pixelsPerPoint,
        0,
        selectedAvatarImage.height - cropSize
      );

      const imageContext = ImageManipulator.manipulate(
        selectedAvatarImage.uri
      );
      imageContext.crop({
        originX,
        originY,
        width: cropSize,
        height: cropSize,
      });
      imageContext.resize({ width: 512, height: 512 });
      const renderedImage = await imageContext.renderAsync();
      const optimizedImage = await renderedImage.saveAsync({
        base64: true,
        compress: 0.72,
        format: SaveFormat.JPEG,
      });
      const previewUri = optimizedImage.base64
        ? `data:image/jpeg;base64,${optimizedImage.base64}`
        : optimizedImage.uri;
      setPendingAvatarUri(previewUri);
      setSelectedAvatarImage(null);
      selectedAvatarImageRef.current = null;
    } catch (error) {
      console.warn('[ProfileScreen] 裁切头像失败:', error);
      Alert.alert('裁切失败', '暂时无法裁切图片，请重新选择。');
    } finally {
      setIsPreparingAvatar(false);
    }
  };

  const handleAdjustCropScale = (delta: number) => {
    const current = cropTransformRef.current;
    updateCropTransform({
      ...current,
      scale: current.scale + delta,
    });
  };

  const handleSaveAvatar = async () => {
    if (!pendingAvatarUri || isPreparingAvatar) return;
    try {
      setIsPreparingAvatar(true);
      const nextUserInfo: UserInfo = {
        ...(userInfo || { id: '', name: '学伴用户' }),
        avatarNew: pendingAvatarUri,
      };
      await storage.setItem(
        AVATAR_STORAGE_KEY,
        JSON.stringify(nextUserInfo)
      );
      setUserInfo(nextUserInfo);
      setAvatarLoadFailed(false);
      setPendingAvatarUri(null);
      setSelectedAvatarImage(null);
      selectedAvatarImageRef.current = null;
      setAvatarModalVisible(false);
      Alert.alert('头像已更新', '新的头像已保存。');
    } catch (error) {
      console.warn('[ProfileScreen] 保存头像失败:', error);
      Alert.alert('保存失败', '头像暂时无法保存，请稍后重试。');
    } finally {
      setIsPreparingAvatar(false);
    }
  };

  const handleConfirmLogout = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm('确定要退出当前账号并返回登录界面吗？')) {
        onLogout();
      }
      return;
    }

    Alert.alert(
      '退出登录',
      '确定要退出当前账号并返回登录界面吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={LightColors.primary} />
      </View>
    );
  }

  const avatarUri = resolveAvatarUri(userInfo);
  const previewAvatarUri = pendingAvatarUri || avatarUri;
  const canShowPreviewAvatar =
    !!previewAvatarUri && (!!pendingAvatarUri || !avatarLoadFailed);
  const compactAvatarModal = windowHeight < 500;
  const avatarPreviewSize = compactAvatarModal
    ? 112
    : Math.min(220, windowWidth - 112);
  cropViewportSizeRef.current = avatarPreviewSize;
  selectedAvatarImageRef.current = selectedAvatarImage;
  cropTransformRef.current = cropTransform;
  const cropBaseSize = selectedAvatarImage
    ? getCoverImageSize(selectedAvatarImage, avatarPreviewSize)
    : null;
  const cropDisplayWidth =
    (cropBaseSize?.width || 0) * cropTransform.scale;
  const cropDisplayHeight =
    (cropBaseSize?.height || 0) * cropTransform.scale;

  return (
    <View style={styles.container}>
      {/* 顶部蓝紫渐变区 */}
      <View style={styles.gradientHeader}>
        {/* 头像及基本信息 */}
        <View style={styles.userProfileRow}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => setAvatarModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="查看头像大图"
            accessibilityHint="打开后可以裁切并更换头像"
          >
            {avatarUri && !avatarLoadFailed ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImage}
                resizeMode="cover"
                onError={() => setAvatarLoadFailed(true)}
                accessibilityLabel="用户头像"
              />
            ) : (
              <>
                <View style={styles.avatarHead} />
                <View style={styles.avatarBody} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.profileTextInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userNameText}>{userInfo?.name || '张同学'}</Text>
            </View>
          </View>
        </View>
      </View>

      <AppModal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseAvatarModal}
      >
        <View style={styles.avatarModalScrim}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCloseAvatarModal}
            accessible={false}
          />
          <View
            style={[
              styles.avatarModalCard,
              compactAvatarModal && styles.avatarModalCardCompact,
            ]}
          >
            <View style={styles.avatarModalHeader}>
              <View style={styles.avatarModalHeaderSpacer} />
              <Text style={styles.avatarModalTitle}>
                {selectedAvatarImage
                  ? '调整头像'
                  : pendingAvatarUri
                    ? '圆形头像预览'
                    : '头像预览'}
              </Text>
              <TouchableOpacity
                style={styles.avatarModalClose}
                onPress={handleCloseAvatarModal}
                disabled={isPreparingAvatar}
                accessibilityRole="button"
                accessibilityLabel="关闭头像预览"
              >
                <Text style={styles.avatarModalCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.avatarPreviewFrame,
                {
                  width: avatarPreviewSize,
                  height: avatarPreviewSize,
                  borderRadius: avatarPreviewSize / 2,
                },
                compactAvatarModal &&
                  styles.avatarPreviewFrameCompact,
              ]}
            >
              {selectedAvatarImage && cropBaseSize ? (
                <View
                  ref={cropGestureAreaRef}
                  collapsable={false}
                  style={[
                    styles.avatarCropGestureArea,
                    Platform.OS === 'web' &&
                      ({
                        touchAction: 'none',
                        overscrollBehavior: 'contain',
                      } as any),
                  ]}
                  {...(Platform.OS === 'web'
                    ? {}
                    : cropPanResponder.panHandlers)}
                  accessibilityRole="adjustable"
                  accessibilityLabel="头像裁切区域"
                  accessibilityHint="拖动调整位置，双指缩放图片"
                  accessibilityValue={{
                    min: MIN_CROP_SCALE * 100,
                    max: MAX_CROP_SCALE * 100,
                    now: Math.round(cropTransform.scale * 100),
                    text: `${Math.round(
                      cropTransform.scale * 100
                    )}%`,
                  }}
                  accessibilityActions={[
                    { name: 'increment', label: '放大头像' },
                    { name: 'decrement', label: '缩小头像' },
                  ]}
                  onAccessibilityAction={(event) => {
                    if (
                      event.nativeEvent.actionName === 'increment'
                    ) {
                      handleAdjustCropScale(0.25);
                    } else if (
                      event.nativeEvent.actionName === 'decrement'
                    ) {
                      handleAdjustCropScale(-0.25);
                    }
                  }}
                >
                  <Image
                    source={{ uri: selectedAvatarImage.uri }}
                    style={[
                      styles.avatarCropImage,
                      {
                        width: cropDisplayWidth,
                        height: cropDisplayHeight,
                        left:
                          (avatarPreviewSize - cropDisplayWidth) /
                            2 +
                          cropTransform.x,
                        top:
                          (avatarPreviewSize - cropDisplayHeight) /
                            2 +
                          cropTransform.y,
                      },
                    ]}
                    resizeMode="stretch"
                    accessibilityLabel="待裁切头像"
                  />
                </View>
              ) : canShowPreviewAvatar ? (
                <Image
                  source={{ uri: previewAvatarUri! }}
                  style={styles.avatarPreviewImage}
                  resizeMode="cover"
                  accessibilityLabel="头像圆形预览"
                />
              ) : (
                <>
                  <View style={styles.avatarPreviewHead} />
                  <View style={styles.avatarPreviewBody} />
                </>
              )}
            </View>

            <Text
              style={[
                styles.avatarModalHint,
                compactAvatarModal && styles.avatarModalHintCompact,
              ]}
            >
              {pendingAvatarUri
                ? '确认头像在圆形区域内显示完整后再保存'
                : selectedAvatarImage
                  ? '拖动调整位置，双指或按钮放大缩小'
                  : '选择图片后可自由调整头像位置和大小'}
            </Text>

            {selectedAvatarImage ? (
              <>
                <View style={styles.avatarZoomControls}>
                  <TouchableOpacity
                    style={[
                      styles.avatarZoomButton,
                      (isPreparingAvatar ||
                        cropTransform.scale <= MIN_CROP_SCALE) &&
                        styles.avatarButtonDisabled,
                    ]}
                    onPress={() => handleAdjustCropScale(-0.25)}
                    disabled={
                      isPreparingAvatar ||
                      cropTransform.scale <= MIN_CROP_SCALE
                    }
                    accessibilityRole="button"
                    accessibilityLabel="缩小头像"
                  >
                    <Text style={styles.avatarZoomButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.avatarZoomValue}>
                    {Math.round(cropTransform.scale * 100)}%
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.avatarZoomButton,
                      (isPreparingAvatar ||
                        cropTransform.scale >= MAX_CROP_SCALE) &&
                        styles.avatarButtonDisabled,
                    ]}
                    onPress={() => handleAdjustCropScale(0.25)}
                    disabled={
                      isPreparingAvatar ||
                      cropTransform.scale >= MAX_CROP_SCALE
                    }
                    accessibilityRole="button"
                    accessibilityLabel="放大头像"
                  >
                    <Text style={styles.avatarZoomButtonText}>＋</Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.avatarModalActions,
                    compactAvatarModal &&
                      styles.avatarModalActionsCompact,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.avatarSecondaryButton}
                    onPress={() => void handleChangeAvatar()}
                    disabled={isPreparingAvatar}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel="重新选择头像图片"
                  >
                    <Text style={styles.avatarSecondaryButtonText}>
                      重新选择
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.avatarPrimaryButton,
                      isPreparingAvatar &&
                        styles.avatarButtonDisabled,
                    ]}
                    onPress={() => void handleApplyAvatarCrop()}
                    disabled={isPreparingAvatar}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel="确认裁切头像"
                  >
                    {isPreparingAvatar ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.avatarPrimaryButtonText}>
                        确认裁切
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : pendingAvatarUri ? (
              <View
                style={[
                  styles.avatarModalActions,
                  compactAvatarModal &&
                    styles.avatarModalActionsCompact,
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.avatarSecondaryButton,
                    isPreparingAvatar && styles.avatarButtonDisabled,
                  ]}
                  onPress={() => void handleChangeAvatar()}
                  disabled={isPreparingAvatar}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel="重新选择并裁切头像"
                >
                  <Text style={styles.avatarSecondaryButtonText}>
                    重新选择
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.avatarPrimaryButton,
                    isPreparingAvatar && styles.avatarButtonDisabled,
                  ]}
                  onPress={() => void handleSaveAvatar()}
                  disabled={isPreparingAvatar}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel="保存头像"
                >
                  {isPreparingAvatar ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.avatarPrimaryButtonText}>
                      保存头像
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.avatarPrimaryButtonFull,
                  compactAvatarModal &&
                    styles.avatarPrimaryButtonFullCompact,
                  isPreparingAvatar && styles.avatarButtonDisabled,
                ]}
                onPress={() => void handleChangeAvatar()}
                disabled={isPreparingAvatar}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="从相册选择并裁切头像"
              >
                {isPreparingAvatar ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.avatarPrimaryButtonText}>
                    更换头像
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </AppModal>

      {/* 下方流式卡片区 */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentInner} showsVerticalScrollIndicator={false}>
        {/* 菜单列表主卡片组 */}
        <View style={styles.menuGroupCard}>
          {/* 老师答疑记录 */}
          <TouchableOpacity style={styles.menuItem} onPress={onOpenTeacherRecords}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#EFF6FF' }]}>
                <Text style={styles.menuItemIcon}>💬</Text>
              </View>
              <Text style={styles.menuItemLabel}>老师答疑记录</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 我的收藏 */}
          <TouchableOpacity style={styles.menuItem} onPress={onOpenFavorites}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Text style={styles.menuItemIcon}>⭐</Text>
              </View>
              <Text style={styles.menuItemLabel}>我的收藏</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 问答记录 */}
          <TouchableOpacity style={styles.menuItem} onPress={onOpenQuestionRecords}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F3E8FF' }]}>
                <Text style={styles.menuItemIcon}>📝</Text>
              </View>
              <Text style={styles.menuItemLabel}>问答记录</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* 在线客服 */}
          <TouchableOpacity style={styles.menuItem} onPress={onOpenSupport}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#F1F5F9' }]}>
                <Text style={styles.menuItemIcon}>🎧</Text>
              </View>
              <Text style={styles.menuItemLabel}>在线客服</Text>
            </View>
            <Text style={styles.arrowIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconBg, { backgroundColor: '#EEF2FF' }]}>
                <Text style={styles.versionIcon}>v</Text>
              </View>
              <Text style={styles.menuItemLabel}>版本号</Text>
            </View>
            <Text style={styles.versionText}>v{APP_VERSION}</Text>
          </View>
        </View>

        {/* 退出登录 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleConfirmLogout}>
          <Text style={styles.logoutBtnText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LightColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LightColors.background,
  },
  gradientHeader: {
    backgroundColor: '#3E3FD8', // Vibrant Indigo header base
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#5C60E6', // Slightly lighter circle border accent
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  avatarBody: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: -20,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileTextInfo: {
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  avatarModalScrim: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 18, 38, 0.62)',
  },
  avatarModalCard: {
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    borderRadius: 28,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.22,
        shadowRadius: 30,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  avatarModalCardCompact: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  avatarModalHeader: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarModalHeaderSpacer: {
    width: 44,
  },
  avatarModalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#20243D',
  },
  avatarModalClose: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F8',
  },
  avatarModalCloseText: {
    marginTop: -2,
    fontSize: 28,
    lineHeight: 30,
    color: '#656B80',
  },
  avatarPreviewFrame: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: '#E8E5FF',
    backgroundColor: '#7775E8',
  },
  avatarPreviewFrameCompact: {
    marginTop: 8,
    borderWidth: 4,
  },
  avatarPreviewImage: {
    width: '100%',
    height: '100%',
  },
  avatarCropGestureArea: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  avatarCropImage: {
    position: 'absolute',
  },
  avatarPreviewHead: {
    width: 72,
    height: 72,
    marginTop: 20,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
  },
  avatarPreviewBody: {
    position: 'absolute',
    bottom: -72,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFFFFF',
  },
  avatarModalHint: {
    marginTop: 18,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#74798C',
  },
  avatarModalHintCompact: {
    marginTop: 8,
  },
  avatarZoomControls: {
    height: 44,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarZoomButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: '#DADCE6',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7FC',
  },
  avatarZoomButtonText: {
    marginTop: -2,
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '700',
    color: '#4F46E5',
  },
  avatarZoomValue: {
    minWidth: 70,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '800',
    color: '#555B70',
    fontVariant: ['tabular-nums'],
  },
  avatarModalActions: {
    width: '100%',
    marginTop: 22,
    flexDirection: 'row',
    gap: 12,
  },
  avatarModalActionsCompact: {
    marginTop: 10,
  },
  avatarPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  avatarPrimaryButtonFull: {
    width: '100%',
    minHeight: 48,
    marginTop: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
  },
  avatarPrimaryButtonFullCompact: {
    marginTop: 10,
  },
  avatarPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#DADCE6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  avatarSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#555B70',
  },
  avatarButtonDisabled: {
    opacity: 0.55,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  arrowIcon: {
    fontSize: 10,
    color: '#94A3B8',
  },
  versionText: {
    fontSize: 13,
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
  versionIcon: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F46E5',
  },
  menuGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 18,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemIcon: {
    fontSize: 16,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  logoutBtn: {
    height: 48,
    borderRadius: 24, // Pill button matching design
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
