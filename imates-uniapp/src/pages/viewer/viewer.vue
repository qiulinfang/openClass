<template>
  <view class="resource-viewer-page">
    <view class="viewer-header">
      <view class="back-btn" @click="handleGoBack">
        <text class="back-icon">‹</text>
        <text class="back-text">返回</text>
      </view>
      <text class="header-title">{{ title || '资源预览' }}</text>
    </view>

    <view class="viewer-body">
      <!-- 视频播放器 (mp4, mkv, avi 等) -->
      <video
        v-if="resourceType === 'video' && fileUrl"
        :src="fileUrl"
        class="video-player"
        controls
        autoplay
      ></video>

      <!-- 图片预览 (png, jpg, jpeg 等) -->
      <image
        v-else-if="resourceType === 'image' && fileUrl"
        :src="fileUrl"
        mode="aspectFit"
        class="image-viewer"
        @click="previewFullImage"
      />

      <!-- PDF / Web 网页或网络文档预览 -->
      <web-view
        v-else-if="(resourceType === 'pdf' || resourceType === 'web') && fileUrl"
        :src="fileUrl"
        class="web-view-container"
      />

      <!-- 其它通用文件下载/预览提示 -->
      <view v-else class="generic-viewer">
        <text class="generic-icon">📄</text>
        <text class="generic-name">{{ title }}</text>
        <button class="open-doc-btn" @click="openDocument">使用系统应用打开</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { FileStorageService } from '@/services/fileStorageService'

const title = ref('')
const fileUrl = ref('')
const resourceType = ref<'video' | 'image' | 'pdf' | 'web' | 'other'>('other')

onLoad((options: any) => {
  if (options) {
    title.value = options.name || '资源文件'
    const rawUrl = decodeURIComponent(options.url || '')
    const fileId = decodeURIComponent(options.fileId || '')
    const textbookId = decodeURIComponent(options.textbookId || '')

    // 优先读取沙箱本地文件路径
    let targetUrl = rawUrl
    if (textbookId && fileId) {
      const localPath = FileStorageService.getLocalFilePath(textbookId, fileId)
      if (localPath) {
        console.log(`[Viewer] ⚡ 使用本地沙箱离线文件: ${localPath}`)
        targetUrl = localPath
      }
    }

    fileUrl.value = targetUrl
    resourceType.value = options.type || getFileType(options.name || '')
  }
})

const getFileType = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return 'video'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['html', 'htm'].includes(ext)) return 'web'
  return 'other'
}

const previewFullImage = () => {
  if (fileUrl.value) {
    uni.previewImage({
      urls: [fileUrl.value]
    })
  }
}

const openDocument = () => {
  if (fileUrl.value) {
    uni.openDocument({
      filePath: fileUrl.value,
      fail: () => {
        uni.showToast({ title: '无法打开该类型文件', icon: 'none' })
      }
    })
  }
}

const handleGoBack = () => {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.resource-viewer-page {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: #000000;
}

.viewer-header {
  height: 90rpx;
  background: #111827;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  z-index: 100;
}

.back-btn {
  display: flex;
  align-items: center;
  color: #ffffff;
  padding: 10rpx;
}

.back-icon {
  font-size: 40rpx;
  margin-right: 4rpx;
}

.back-text {
  font-size: 28rpx;
}

.header-title {
  flex: 1;
  text-align: center;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 500;
  margin-right: 80rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.video-player,
.image-viewer,
.web-view-container {
  width: 100%;
  height: 100%;
}

.generic-viewer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.generic-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.generic-name {
  font-size: 32rpx;
  margin-bottom: 40rpx;
}

.open-doc-btn {
  background: #6e55ff;
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 16rpx;
  padding: 0 40rpx;
}
</style>
