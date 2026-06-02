<template>
  <view class="video-viewer-view">
    <!-- 头部工具栏 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <image src="/static/icons/arrow.svg" mode="aspectFit" class="back-icon" />
      </view>
      <text class="title">{{ fileName }}</text>
      <view class="header-right"></view>
    </view>

    <!-- 内容区域 -->
    <view class="main-content">
      <video
        v-if="videoUrl"
        :src="videoUrl"
        class="video-player"
        controls
        autoplay
        @error="handleError"
      ></video>
      
      <view v-if="isLoading" class="loading-state">
        <text>加载中...</text>
      </view>
      
      <view v-if="error" class="error-state">
        <text>{{ error }}</text>
        <Button label="重试" size="sm" @click="loadVideo" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { resourceManager } from '../services/storage/resource-storage'
import Button from '../components/base/Button.vue'

defineOptions({
  name: 'VideoViewerView',
})

const route = useRoute()
const videoUrl = ref('')
const fileName = ref('视频查看')
const isLoading = ref(false)
const error = ref('')

const loadVideo = async () => {
  const id = route.query.id as string
  const resourceId = route.query.resourceId as string
  
  if (id && resourceId) {
    isLoading.value = true
    try {
      const textbook = await resourceManager.getTextbookInfoById(id)
      if (textbook) {
        const localFile = textbook.localFiles?.find((f: any) => f.id === resourceId)
        if (localFile) {
          fileName.value = localFile.fileName
          videoUrl.value = localFile.localPath || ''
        }
      }
    } catch (err) {
      error.value = '加载失败'
    } finally {
      isLoading.value = false
    }
  }
}

const handleError = (e: any) => {
  error.value = '播放失败'
  console.error('视频播放失败', e)
}

const goBack = () => {
  uni.navigateBack()
}

onMounted(() => {
  loadVideo()
})
</script>

<style scoped>
.video-viewer-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #000000;
}

.header {
  height: 100rpx;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
}

.back-icon {
  width: 40rpx;
  height: 40rpx;
  transform: rotate(180deg);
}

.title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  width: 60rpx;
}

.main-content {
  flex: 1;
  position: relative;
}

.video-player {
  width: 100%;
  height: 100%;
}

.loading-state, .error-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  gap: 20rpx;
}
</style>
