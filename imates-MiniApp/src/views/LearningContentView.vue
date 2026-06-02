<template>
  <view class="learning-content-view">
    <!-- 根据文件类型动态加载不同的查看器 -->
    <PdfViewerView v-if="viewerType === 'pdf'" />
    <HtmlViewerView v-else-if="viewerType === 'html'" />
    <VideoViewerView v-else-if="viewerType === 'video'" />
    
    <!-- 不支持的文件类型 -->
    <view v-else class="unsupported-viewer">
      <view class="unsupported-content">
        <image src="/static/icons/folder_open.svg" mode="aspectFit" class="error-icon" />
        <text class="error-title">不支持的文件类型</text>
        <text class="error-desc">当前文件类型（{{ fileExtension }}）暂不支持预览</text>
        <text class="file-name">文件名：{{ fileName }}</text>
        <Button
          variant="primary"
          label="返回"
          @click="handleGoBack"
          class="back-btn"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import PdfViewerView from './PdfViewerView.vue'
import HtmlViewerView from './HtmlViewerView.vue'
import VideoViewerView from './VideoViewerView.vue'
import Button from '../components/base/Button.vue'

defineOptions({
  name: 'LearningContentView'
})

const route = useRoute()

const fileName = computed(() => (route.query.fileName as string) || '')
const fileExtension = computed(() => {
  const ext = fileName.value.split('.').pop()?.toLowerCase() || ''
  return ext
})

const viewerType = computed(() => {
  const ext = fileExtension.value
  
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'html':
    case 'htm':
      return 'html'
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
    case 'flv':
    case 'webm':
      return 'video'
    default:
      return 'unsupported'
  }
})

const handleGoBack = () => {
  uni.navigateBack()
}

onMounted(() => {
  console.log('LearningContentView mounted', {
    fileName: fileName.value,
    viewerType: viewerType.value,
    query: route.query,
  })
})
</script>

<style scoped>
.learning-content-view {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.unsupported-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
}

.unsupported-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  background-color: #ffffff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
  width: 80%;
}

.error-icon {
  width: 160rpx;
  height: 160rpx;
  margin-bottom: 32rpx;
  opacity: 0.5;
}

.error-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}

.error-desc {
  font-size: 28rpx;
  color: #999;
  margin-bottom: 32rpx;
}

.file-name {
  font-size: 24rpx;
  color: #666;
  margin-bottom: 48rpx;
  text-align: center;
}

.back-btn {
  width: 240rpx;
}
</style>
