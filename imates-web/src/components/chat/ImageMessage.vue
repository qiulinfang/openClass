<template>
  <div class="image-message" :class="{ 'image-message-user': isUser }">
    <div class="image-container" @click="handleImageClick">
      <!-- 图片加载状态 -->
      <div v-if="isLoading" class="image-loading">
        <q-spinner-dots color="primary" size="24px" />
        <span class="loading-text">加载中...</span>
      </div>
      <!-- 图片内容 -->
      <img
        v-else-if="!loadError"
        :src="imageUrl"
        :alt="altText"
        class="message-image"
        @load="handleImageLoad"
        @error="handleImageError"
        :style="imageStyle"
      />
      
      <!-- 加载失败状态 -->
      <div v-else class="image-error">
        <q-icon name="broken_image" size="32px" color="grey-5" />
        <span class="error-text">图片加载失败</span>
        <q-btn
          flat
          size="sm"
          color="primary"
          label="重试"
          @click="retryLoad"
        />
      </div>
      
      <!-- 图片信息覆盖层 -->
      <div v-if="showInfo && !isLoading && !loadError" class="image-info">
        <div class="image-size">{{ formatFileSize(fileSize) }}</div>
        <div class="image-dimensions">{{ width }} × {{ height }}</div>
      </div>
    </div>
    
    <!-- 图片预览对话框 -->
    <q-dialog 
      v-model="showPreview" 
      class="image-preview-dialog"
      :maximized="true"
      transition-show="fade"
      transition-hide="fade"
    >
      <div class="preview-overlay" @click="showPreview = false">
        <!-- 关闭按钮 -->
        <q-btn
          flat
          round
          dense
          icon="close"
          color="white"
          class="close-btn"
          @click.stop="showPreview = false"
        />
        
        <!-- 图片预览区域 -->
        <div class="preview-content" @click.stop>
          <img
            :src="imageUrl"
            :alt="altText"
            class="preview-image"
          />
        </div>
      </div>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// 导入类型定义
import type { ImageMessageProps } from '../../types'

// 定义Props（直接使用类型，避免空接口）
type Props = ImageMessageProps

const props = withDefaults(defineProps<Props>(), {
  width: 0,
  height: 0,
  fileSize: 0,
  isUser: false,
  maxWidth: 200,
  maxHeight: 200,
  showInfo: false
})

const isLoading = ref(true)
const loadError = ref(false)
const showPreview = ref(false)

const imageUrl = computed(() => {
  // 只使用 base64DataUrl
  return props.base64DataUrl
})

const altText = computed(() => {
  return `图片消息 ${props.width}×${props.height}`
})

const imageStyle = computed(() => {
  if (!props.width || !props.height) {
    return {
      maxWidth: `${props.maxWidth}px`,
      maxHeight: `${props.maxHeight}px`
    }
  }
  
  // 计算缩放比例，保持宽高比
  const widthRatio = props.maxWidth / props.width
  const heightRatio = props.maxHeight / props.height
  const scale = Math.min(widthRatio, heightRatio, 1)
  
  return {
    width: `${props.width * scale}px`,
    height: `${props.height * scale}px`
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
  if (!isLoading.value && !loadError.value) {
    showPreview.value = true
  }
}

const retryLoad = () => {
  isLoading.value = true
  loadError.value = false
  // 强制重新加载图片
  const img = new Image()
  img.onload = handleImageLoad
  img.onerror = handleImageError
  img.src = imageUrl.value + '?t=' + Date.now()
}


const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

onMounted(() => {
  // 预加载图片
  const img = new Image()
  img.onload = handleImageLoad
  img.onerror = handleImageError
  img.src = imageUrl.value
})
</script>

<style scoped>
.image-message {
  min-width: 120px;
  max-width: 220px;
  cursor: pointer;
  user-select: none;
}

.image-container {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f5f5;
  transition: all 0.2s ease;
}

.image-container:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.message-image {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 12px;
}

.image-loading,
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  min-height: 120px;
  color: #666;
}

.loading-text,
.error-text {
  margin-top: 8px;
  font-size: 14px;
}

.image-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  padding: 8px 12px;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-container:hover .image-info {
  opacity: 1;
}

.image-message-user .image-container {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

/* 全屏预览对话框样式 */
.image-preview-dialog {
  z-index: 9999;
}

.preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  cursor: pointer;
}


.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.1);
}

.preview-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 20px;
}

.preview-image {
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  user-select: none;
  pointer-events: none;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .image-container {
    background: #3a3a3a;
  }
  
  .image-loading,
  .image-error {
    color: #ccc;
  }
  
  .preview-header {
    border-bottom-color: #4a4a4a;
  }
}
</style>