<template>
  <view class="photo-search-view">
    <!-- 顶部状态栏占位 -->
    <view class="status-bar"></view>
    
    <!-- 返回按钮 -->
    <view class="back-btn" @click="handleBack">
      <image src="/static/icons/goback.svg" mode="aspectFit" class="back-icon" />
    </view>

    <!-- 相机预览区域 -->
    <view class="camera-area">
      <camera
        v-if="showCamera"
        device-position="back"
        flash="off"
        class="camera-preview"
        @error="handleCameraError"
      >
        <!-- 扫码/框选辅助线 -->
        <view class="scan-focus">
          <view class="corner top-left"></view>
          <view class="corner top-right"></view>
          <view class="corner bottom-left"></view>
          <view class="corner bottom-right"></view>
        </view>
      </camera>
      
      <image v-else-if="previewImage" :src="previewImage" mode="aspectFit" class="preview-image" />
    </view>

    <!-- 底部操作区 -->
    <view class="action-bar">
      <!-- 学科选择 -->
      <view class="subject-selector">
        <view 
          class="subject-item" 
          :class="{ active: selectedSubject === 'math' }"
          @click="selectedSubject = 'math'"
        >
          <image src="/static/icons/searchMath.svg" mode="aspectFit" class="subject-icon" />
          <text>数学</text>
        </view>
        <view 
          class="subject-item" 
          :class="{ active: selectedSubject === 'biology' }"
          @click="selectedSubject = 'biology'"
        >
          <image src="/static/icons/searchBio.svg" mode="aspectFit" class="subject-icon" />
          <text>生物</text>
        </view>
      </view>

      <!-- 拍照/相册按钮 -->
      <view class="main-actions">
        <view class="gallery-btn" @click="handleGallery">
          <image src="/static/icons/Album.svg" mode="aspectFit" class="action-icon" />
        </view>
        <view class="capture-btn" @click="handleCapture">
          <view class="inner-circle"></view>
        </view>
        <view class="retake-btn" v-if="previewImage" @click="handleRetake">
          <image src="/static/icons/researh.svg" mode="aspectFit" class="action-icon" />
        </view>
      </view>
    </view>

    <!-- 搜索结果抽屉 (模拟) -->
    <view class="result-drawer" v-if="showResult" :class="{ open: showResult }">
      <view class="drawer-header">
        <text class="drawer-title">搜索结果</text>
        <view class="close-btn" @click="showResult = false">✕</view>
      </view>
      <scroll-view scroll-y class="result-content">
        <view class="question-card" v-if="resultQuestion">
          <rich-text :nodes="resultQuestion.content"></rich-text>
        </view>
        <view v-else class="empty-result">
          <text>未找到匹配题目</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineOptions({
  name: 'PhotoSearchView',
})

const showCamera = ref(true)
const previewImage = ref('')
const selectedSubject = ref('math')
const showResult = ref(false)
const resultQuestion = ref<any>(null)

const handleBack = () => {
  uni.navigateBack()
}

const handleCameraError = (e: any) => {
  console.error('Camera error:', e)
  uni.showToast({ title: '相机权限受限', icon: 'none' })
}

const handleCapture = () => {
  if (!showCamera.value) return
  
  const ctx = uni.createCameraContext()
  ctx.takePhoto({
    quality: 'high',
    success: (res) => {
      previewImage.value = res.tempImagePath
      showCamera.value = false
      performSearch()
    },
    fail: () => {
      uni.showToast({ title: '拍照失败', icon: 'none' })
    }
  })
}

const handleGallery = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: (res) => {
      previewImage.value = res.tempFilePaths[0]
      showCamera.value = false
      performSearch()
    }
  })
}

const handleRetake = () => {
  previewImage.value = ''
  showCamera.value = true
  showResult.value = false
}

const performSearch = () => {
  uni.showLoading({ title: '正在识别...' })
  // 模拟搜索
  setTimeout(() => {
    uni.hideLoading()
    showResult.value = true
    resultQuestion.value = {
      content: '<p>这是一个识别出的示例题目内容...</p>'
    }
  }, 1500)
}

onMounted(() => {
  // 检查权限等
})
</script>

<style scoped>
.photo-search-view {
  width: 100vw;
  height: 100vh;
  background-color: #000;
  display: flex;
  flex-direction: column;
}

.status-bar {
  height: var(--status-bar-height);
}

.back-btn {
  position: absolute;
  top: calc(var(--status-bar-height) + 20rpx);
  left: 32rpx;
  z-index: 10;
  width: 80rpx;
  height: 80rpx;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  width: 48rpx;
  height: 48rpx;
}

.camera-area {
  flex: 1;
  position: relative;
}

.camera-preview {
  width: 100%;
  height: 100%;
}

.preview-image {
  width: 100%;
  height: 100%;
}

.scan-focus {
  position: absolute;
  top: 20%;
  left: 10%;
  width: 80%;
  height: 40%;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
}

.corner {
  position: absolute;
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid #6e55ff;
}

.top-left { top: -2rpx; left: -2rpx; border-right: none; border-bottom: none; }
.top-right { top: -2rpx; right: -2rpx; border-left: none; border-bottom: none; }
.bottom-left { bottom: -2rpx; left: -2rpx; border-right: none; border-top: none; }
.bottom-right { bottom: -2rpx; right: -2rpx; border-left: none; border-top: none; }

.action-bar {
  background-color: #000;
  padding: 40rpx 32rpx;
  padding-bottom: calc(env(safe-area-inset-bottom) + 40rpx);
}

.subject-selector {
  display: flex;
  justify-content: center;
  gap: 60rpx;
  margin-bottom: 60rpx;
}

.subject-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  opacity: 0.5;
  transition: all 0.3s;
}

.subject-item.active {
  opacity: 1;
  transform: scale(1.1);
}

.subject-icon {
  width: 80rpx;
  height: 80rpx;
}

.subject-item text {
  color: #fff;
  font-size: 24rpx;
}

.main-actions {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.capture-btn {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.inner-circle {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  border: 4rpx solid #000;
}

.action-icon {
  width: 64rpx;
  height: 64rpx;
}

.result-drawer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #fff;
  border-radius: 32rpx 32rpx 0 0;
  height: 70vh;
  z-index: 100;
  display: flex;
  flex-direction: column;
  transform: translateY(100%);
  transition: transform 0.3s ease-out;
}

.result-drawer.open {
  transform: translateY(0);
}

.drawer-header {
  padding: 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2rpx solid #eee;
}

.drawer-title {
  font-size: 32rpx;
  font-weight: 600;
}

.result-content {
  flex: 1;
  padding: 32rpx;
}

.question-card {
  background-color: #f9fafb;
  padding: 24rpx;
  border-radius: 16rpx;
}

.empty-result {
  text-align: center;
  color: #999;
  padding-top: 100rpx;
}
</style>
