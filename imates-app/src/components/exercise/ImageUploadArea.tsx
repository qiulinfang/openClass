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

export interface ImageUploadAreaProps {
  value?: any;
  modelValue?: any;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  imageValue?: string;
  onImageChange?: (uri: string) => void;
  onChange?: (val: any) => void;
}

/**
 * 极简风格答题画板/图片上传组件 (原 MixedInputArea 重构重命名)
 */
export function ImageUploadArea({
  value,
  modelValue,
  label = '',
  disabled = false,
  imageValue = '',
  onImageChange,
  onChange,
}: ImageUploadAreaProps) {
  const actualVal = modelValue !== undefined ? modelValue : value;
  const currentImage =
    actualVal?.photoUrl ||
    actualVal?.boardImg ||
    (actualVal?.type === 'img'
      ? actualVal.content
      : typeof actualVal === 'string' &&
        (actualVal.startsWith('http') ||
          actualVal.startsWith('file:') ||
          actualVal.startsWith('data:image') ||
          actualVal.startsWith('blob:'))
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
          Alert.alert('提示', '请允许开启相机/相册权限以拍照或选择过程图片');
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
      console.warn('[ImageUploadArea] 拍照/上传失败, 尝试使用相册:', e);
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
        console.warn('[ImageUploadArea] 图库选择亦失败:', err);
      }
    }
  };

  // 执行清除操作
  const doRemove = () => {
    setPhotoUrl('');
    if (onImageChange) onImageChange('');
    if (onChange) onChange('');
  };

  // 移除照片
  const handleRemovePhoto = () => {
    if (disabled) return;

    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      const isConfirmed =
        typeof window !== 'undefined' && window.confirm
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
        {photoUrl ? (
          /* 已上传照片展示区 */
          <TouchableOpacity
            style={styles.photoContainer}
            activeOpacity={0.9}
            onPress={handleUploadPhoto}
            disabled={disabled}
          >
            <Image
              source={{ uri: photoUrl }}
              style={styles.photoImage}
              resizeMode="contain"
              onError={() => {
                console.warn('[ImageUploadArea] 图片资源不可用或已过期, 清空当前失效路径');
                setPhotoUrl('');
              }}
            />
            {!disabled && (
              <TouchableOpacity
                style={styles.deleteFloatingBadge}
                activeOpacity={0.8}
                onPress={handleRemovePhoto}
              >
                <Text style={styles.deleteBadgeText}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ) : (
          /* 极简拍照/上传引导画布区 */
          <TouchableOpacity
            style={styles.canvasPlaceholder}
            onPress={handleUploadPhoto}
            activeOpacity={0.85}
            disabled={disabled}
          >
            <View style={styles.uploadCircle}>
              <Text style={styles.uploadIconText}>+</Text>
            </View>
            <Text style={styles.uploadTitleText}>点击拍照 / 上传答题步骤照片</Text>
          </TouchableOpacity>
        )}
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
    minHeight: 180,
    borderWidth: 1.5,
    borderColor: '#6366F1', // 靛蓝色极简线条
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  disabledCard: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  canvasPlaceholder: {
    width: '100%',
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  uploadCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadIconText: {
    fontSize: 22,
  },
  uploadTitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  photoContainer: {
    width: '100%',
    padding: 10,
    position: 'relative',
    alignItems: 'center',
  },
  photoImage: {
    width: '100%',
    height: 260,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  deleteFloatingBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
