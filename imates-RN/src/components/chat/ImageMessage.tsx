/**
 * ImageMessage - 图片消息组件（React Native 版本）
 * 显示聊天中的图片消息，支持图片预览、加载状态和错误处理
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Image,
  Modal,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native'

export interface ImageMessageProps {
  base64DataUrl: string // Base64 数据 URL
  width?: number // 图片宽度（像素）
  height?: number // 图片高度（像素）
  fileSize?: number // 文件大小（字节）
  isUser?: boolean // 是否为用户消息
  maxWidth?: number // 最大显示宽度
  maxHeight?: number // 最大显示高度
  showInfo?: boolean // 是否显示图片信息
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

const ImageMessage: React.FC<ImageMessageProps> = ({
  base64DataUrl,
  width = 0,
  height = 0,
  fileSize = 0,
  isUser = false,
  maxWidth = 200,
  maxHeight = 200,
  showInfo = false,
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // 计算显示尺寸
  const calculateDisplaySize = () => {
    if (!width || !height) {
      return {
        width: maxWidth,
        height: maxHeight,
      }
    }

    // 计算缩放比例，保持宽高比
    const widthRatio = maxWidth / width
    const heightRatio = maxHeight / height
    const scale = Math.min(widthRatio, heightRatio, 1)

    return {
      width: width * scale,
      height: height * scale,
    }
  }

  const displaySize = calculateDisplaySize()

  // 图片加载成功
  const handleImageLoad = (event: any) => {
    const { width: imgWidth, height: imgHeight } = event.nativeEvent.source || {}
    if (imgWidth && imgHeight) {
      setImageDimensions({ width: imgWidth, height: imgHeight })
    }
    setIsLoading(false)
    setLoadError(false)
  }

  // 图片加载失败
  const handleImageError = () => {
    setIsLoading(false)
    setLoadError(true)
  }

  // 重试加载
  const retryLoad = () => {
    setIsLoading(true)
    setLoadError(false)
  }

  // 点击图片预览
  const handleImagePress = () => {
    if (!isLoading && !loadError) {
      setShowPreview(true)
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.imageContainer, isUser && styles.imageContainerUser]}
        onPress={handleImagePress}
        activeOpacity={0.9}
      >
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1976d2" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        )}

        {!loadError && (
          <Image
            source={{ uri: base64DataUrl }}
            style={[
              styles.messageImage,
              {
                width: displaySize.width,
                height: displaySize.height,
              },
            ]}
            onLoad={handleImageLoad}
            onError={handleImageError}
            resizeMode="contain"
          />
        )}

        {loadError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>🖼️</Text>
            <Text style={styles.errorText}>图片加载失败</Text>
            <TouchableOpacity onPress={retryLoad} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}

        {showInfo && !isLoading && !loadError && (
          <View style={styles.imageInfo}>
            <Text style={styles.imageInfoText}>{formatFileSize(fileSize)}</Text>
            <Text style={styles.imageInfoText}>
              {(imageDimensions.width || width)} × {(imageDimensions.height || height)}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 图片预览对话框 */}
      <Modal
        visible={showPreview}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPreview(false)}
      >
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setShowPreview(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.previewContent}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowPreview(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            <Image
              source={{ uri: base64DataUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minWidth: 120,
    maxWidth: 220,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  imageContainerUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  messageImage: {
    borderRadius: 12,
  },
  loadingContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  errorContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1976d2',
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  imageInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageInfoText: {
    fontSize: 10,
    color: '#fff',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  previewImage: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.8,
    borderRadius: 8,
  },
})

export default ImageMessage
