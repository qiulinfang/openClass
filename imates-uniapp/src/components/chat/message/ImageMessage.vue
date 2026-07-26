<template>
  <view class="image-message" :class="{ 'image-message-user': isUser }">
    <view class="image-container" @click="handleImageClick">
      <!-- 加载中状态 -->
      <view v-if="isLoading" class="image-loading">
        <text class="loading-icon">⏳</text>
        <text class="loading-text">加载中...</text>
      </view>

      <!-- 图片展示 -->
      <image
        v-else-if="!loadError"
        :src="imageUrl"
        mode="aspectFit"
        class="message-image"
        :style="imageStyle"
        @load="handleImageLoad"
        @error="handleImageError"
      />

      <!-- 加载失败重试 -->
      <view v-else class="image-error">
        <text class="error-icon">🖼️</text>
        <text class="error-text">图片加载失败</text>
        <button class="retry-btn" @click.stop="retryLoad">重试</button>
      </view>

      <!-- 图片信息覆盖层 -->
      <view v-if="showInfo && !isLoading && !loadError" class="image-info">
        <text class="image-size">{{ formatFileSize(fileSize) }}</text>
        <text class="image-dimensions">{{ width }} × {{ height }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    imageData?: {
      filePath?: string
      base64DataUrl?: string
      width?: number
      height?: number
      fileSize?: number
      [key: string]: any
    }
    base64DataUrl?: string
    width?: number
    height?: number
    fileSize?: number
    isUser?: boolean
    maxWidth?: number
    maxHeight?: number
    showInfo?: boolean
  }>(),
  {
    width: 0,
    height: 0,
    fileSize: 0,
    isUser: false,
    maxWidth: 200,
    maxHeight: 200,
    showInfo: false
  }
)

const isLoading = ref(false)
const loadError = ref(false)

const imageUrl = computed(() => {
  return props.base64DataUrl || props.imageData?.base64DataUrl || props.imageData?.filePath || ''
})

const imageStyle = computed(() => {
  const w = props.width || props.imageData?.width || 0
  const h = props.height || props.imageData?.height || 0

  if (!w || !h) {
    return {
      maxWidth: `${props.maxWidth}px`,
      maxHeight: `${props.maxHeight}px`
    }
  }

  const widthRatio = props.maxWidth / w
  const heightRatio = props.maxHeight / h
  const scale = Math.min(widthRatio, heightRatio, 1)

  return {
    width: `${w * scale}px`,
    height: `${h * scale}px`
  }
})

const handleImageLoad = () => {
  isLoading.value = false
  loadError.value = false
}

const handleImageError = () => {
  isLoading.value = false
  loadError.value = true
}

const handleImageClick = () => {
  if (!isLoading.value && !loadError.value && imageUrl.value) {
    uni.previewImage({
      urls: [imageUrl.value]
    })
  }
}

const retryLoad = () => {
  isLoading.value = true
  loadError.value = false
  setTimeout(() => {
    isLoading.value = false
  }, 500)
}

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style lang="scss" scoped>
.image-message {
  min-width: 120px;
  max-width: 220px;
}

.image-container {
  position: relative;
  border-radius: 20rpx;
  overflow: hidden;
  background: #f5f5f5;
}

.message-image {
  width: 100%;
  border-radius: 20rpx;
}

.image-loading,
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30rpx 20rpx;
  min-height: 140rpx;
}

.loading-text,
.error-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #64748b;
}

.retry-btn {
  margin-top: 12rpx;
  font-size: 22rpx;
  background-color: #6e55ff;
  color: #ffffff;
  border-radius: 16rpx;
  padding: 4rpx 16rpx;
  height: auto;
  line-height: 1.4;
}

.image-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: #ffffff;
  padding: 8rpx 16rpx;
  font-size: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
