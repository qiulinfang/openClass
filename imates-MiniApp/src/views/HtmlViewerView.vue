<template>
  <view class="html-viewer-view">
    <!-- 头部工具栏 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <image src="/static/icons/arrow.svg" mode="aspectFit" class="back-icon" />
      </view>
      <text class="title">{{ title }}</text>
      <view class="header-right"></view>
    </view>

    <!-- 内容区域 -->
    <view class="main-content">
      <!-- 小程序中使用 web-view -->
      <web-view v-if="htmlUrl" :src="htmlUrl"></web-view>
      
      <view v-else class="empty-state">
        <image src="/static/icons/folder_open.svg" mode="aspectFit" class="empty-icon" />
        <text class="empty-text">暂无 HTML 内容</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

defineOptions({
  name: 'HtmlViewerView',
})

const route = useRoute()
const title = ref('HTML 查看')
const htmlUrl = ref('')

onMounted(() => {
  const url = route.query.url as string
  if (url) {
    htmlUrl.value = url
    title.value = (route.query.title as string) || 'HTML 查看'
  }
})

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.html-viewer-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  height: 100rpx;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  border-bottom: 2rpx solid #eee;
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
}

.header-right {
  width: 60rpx;
}

.main-content {
  flex: 1;
  position: relative;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  gap: 20rpx;
}

.empty-icon {
  width: 160rpx;
  height: 160rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 28rpx;
}
</style>
