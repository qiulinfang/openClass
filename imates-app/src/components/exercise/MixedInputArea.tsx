import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface MixedInputAreaProps {
  value?: any;
  modelValue?: any;
  questionType?: 'fill' | 'subjective';
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  activeBlankIndex?: number | null;
  textValue?: string;
  imageValue?: string;
  onTextChange?: (text: string) => void;
  onImageChange?: (uri: string) => void;
  onChange?: (val: any) => void;
}

export function MixedInputArea({
  value,
  modelValue,
  label = '',
  disabled = false,
  imageValue = '',
  onImageChange,
  onChange,
}: MixedInputAreaProps) {
  const actualVal = modelValue !== undefined ? modelValue : value;
  const currentImage =
    actualVal?.photoUrl ||
    actualVal?.boardImg ||
    (actualVal?.type === 'img'
      ? actualVal.content
      : typeof actualVal === 'string' && (actualVal.startsWith('http') || actualVal.startsWith('file:') || actualVal.startsWith('data:image') || actualVal.startsWith('blob:'))
      ? actualVal
      : imageValue);

  const [photoUrl, setPhotoUrl] = useState(currentImage || '');

  useEffect(() => {
    setPhotoUrl(currentImage || '');
  }, [currentImage]);

  // 拍照 / 选取照片 (支持 Web 和 Native)
  const handleUploadPhoto = async () => {
    if (disabled) return;
    try {
      let result: ImagePicker.ImagePickerResult | null = null;

      if (Platform.OS === 'web') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          allowsEditing: false,
        });
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('提示', '请允许开启相机/相册权限以拍照或选择过程图片 📸');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          base64: true,
          allowsEditing: false,
        });
      }

      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoUrl(uri);
        if (onImageChange) onImageChange(uri);
        if (onChange) {
          onChange({
            type: 'img',
            content: uri,
            photoUrl: uri,
          });
        }
      }
    } catch (e) {
      console.warn('[MixedInputArea] 拍照/上传失败, 尝试使用相册:', e);
      try {
        const fallbackResult = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          allowsEditing: false,
        });
        if (
          fallbackResult &&
          !fallbackResult.canceled &&
          fallbackResult.assets &&
          fallbackResult.assets.length > 0
        ) {
          const asset = fallbackResult.assets[0];
          const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          setPhotoUrl(uri);
          if (onImageChange) onImageChange(uri);
          if (onChange) {
            onChange({
              type: 'img',
              content: uri,
              photoUrl: uri,
            });
          }
        }
      } catch (err) {
        console.warn('[MixedInputArea] 图库选择亦失败:', err);
      }
    }
  };

  // 执行清除操作
  const doRemove = () => {
    setPhotoUrl('');
    if (onImageChange) onImageChange('');
    if (onChange) onChange('');
  };

  // 移除照片 (兼容 React Native Web Alert 无法调起原生弹窗的问题)
  const handleRemovePhoto = () => {
    if (disabled) return;

    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      const isConfirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm('确定要移除当前上传的解答过程照片吗？')
        : true;
      if (isConfirmed) {
        doRemove();
      }
    } else {
      Alert.alert('确认移除', '确定要移除当前上传的解答过程照片吗？', [
        { text: '取消', style: 'cancel' },
        {
          text: '确认移除',
          style: 'destructive',
          onPress: doRemove,
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.boardCard, disabled && styles.disabledCard]}>
        {/* 顶部右侧极简浮动工具栏 (对标截图: ↩ ↪ ✒ 🧹 ↕ 🗑 📷) */}
        {!disabled && (
          <View style={styles.floatingToolbar}>
            <TouchableOpacity style={styles.toolIconBtn} activeOpacity={0.7} onPress={() => Alert.alert('提示', '已撤销上一步笔迹')}>
              <Text style={styles.toolIconText}>↩</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolIconBtn} activeOpacity={0.7} onPress={() => Alert.alert('提示', '已重做笔迹')}>
              <Text style={styles.toolIconText}>↪</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toolIconBtn, styles.activeToolBtn]} activeOpacity={0.7}>
              <Text style={[styles.toolIconText, styles.activeToolText]}>✒</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolIconBtn} activeOpacity={0.7}>
              <Text style={styles.toolIconText}>🧹</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolIconBtn} activeOpacity={0.7}>
              <Text style={styles.toolIconText}>↕</Text>
            </TouchableOpacity>
            {photoUrl ? (
              <TouchableOpacity style={styles.toolIconBtn} activeOpacity={0.7} onPress={handleRemovePhoto}>
                <Text style={[styles.toolIconText, { color: '#EF4444' }]}>🗑</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.cameraPillBtn} activeOpacity={0.8} onPress={handleUploadPhoto}>
              <Text style={styles.cameraPillText}>📷</Text>
            </TouchableOpacity>
          </View>
        )}

        {photoUrl ? (
          /* 已上传/手写照片展示区 */
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUrl }} style={styles.photoImage} resizeMode="contain" />
          </View>
        ) : (
          /* 极简书写/拍照引导画布区 */
          <TouchableOpacity
            style={styles.canvasPlaceholder}
            onPress={handleUploadPhoto}
            activeOpacity={0.9}
            disabled={disabled}
          >
            <View style={styles.mockHandwritingLine}>
              <Text style={styles.mockWaveText}>✍️ 支持手写作答 / 拍照上传答题步骤</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 右下角极简小动物可爱印章装饰 (对标截图右下角 mascot) */}
        <View style={styles.mascotBadge} pointerEvents="none">
          <Text style={styles.mascotText}>🦦</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  boardCard: {
    width: '100%',
    minHeight: 220,
    borderWidth: 1.8,
    borderColor: '#6366F1', // 靛蓝色极简高亮框 (与截图一致)
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  disabledCard: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  floatingToolbar: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  toolIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeToolBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  toolIconText: {
    fontSize: 14,
    color: '#64748B',
  },
  activeToolText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  cameraPillBtn: {
    backgroundColor: '#6366F1',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPillText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  canvasPlaceholder: {
    width: '100%',
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  mockHandwritingLine: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  mockWaveText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  photoContainer: {
    width: '100%',
    padding: 12,
    paddingTop: 46, // 为顶部悬浮工具栏留出展示空间
    alignItems: 'center',
  },
  photoImage: {
    width: '100%',
    height: 260,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  mascotBadge: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    opacity: 0.85,
  },
  mascotText: {
    fontSize: 22,
  },
});
