<template>
  <view class="html-preview-view">
    <!-- 顶部状态栏 -->
    <view class="status-bar"></view>
    
    <!-- 头部页签 -->
    <view class="tabs">
      <view 
        class="tab-item" 
        :class="{ active: activeTab === 'preview' }"
        @click="activeTab = 'preview'"
      >
        预览
      </view>
      <view 
        class="tab-item" 
        :class="{ active: activeTab === 'chat' }"
        @click="activeTab = 'chat'"
      >
        助教
      </view>
    </view>

    <!-- 内容区域 -->
    <view class="main-content">
      <!-- HTML 预览区域 -->
      <view class="preview-section" v-show="activeTab === 'preview'">
        <web-view v-if="htmlUrl" :src="htmlUrl"></web-view>
        <view v-else class="empty-state">
          <image src="/static/icons/folder_open.svg" mode="aspectFit" class="empty-icon" />
          <text class="empty-text">暂无预览内容</text>
        </view>
      </view>

      <!-- 聊天区域 -->
      <view class="chat-section" v-show="activeTab === 'chat'">
        <HtmlChatPanel
          @close="activeTab = 'preview'"
        />
      </view>
    </view>

    <!-- 底部返回按钮 (浮动) -->
    <view class="back-fab" @click="goBack">
      <image src="/static/icons/goback.svg" mode="aspectFit" class="back-icon" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import HtmlChatPanel from '../components/chat/chatpanel/HtmlChatPanel.vue'

defineOptions({
  name: 'HtmlPreviewView',
})

const route = useRoute()
const activeTab = ref('preview')
const htmlUrl = ref('')

onMounted(() => {
  const url = route.query.url as string
  if (url) {
    htmlUrl.value = url
  }
})

const goBack = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.html-preview-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.status-bar {
  height: var(--status-bar-height);
  background-color: #0f002e;
}

.tabs {
  display: flex;
  background-color: #ffffff;
  height: 88rpx;
  border-bottom: 2rpx solid #eee;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.tab-item.active {
  color: #6e55ff;
  font-weight: 600;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 4rpx;
  background-color: #6e55ff;
  border-radius: 2rpx;
}

.main-content {
  flex: 1;
  overflow: hidden;
}

.preview-section, .chat-section {
  width: 100%;
  height: 100%;
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

.back-fab {
  position: fixed;
  left: 32rpx;
  bottom: 32rpx;
  width: 100rpx;
  height: 100rpx;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.2);
  z-index: 100;
}

.back-icon {
  width: 60rpx;
  height: 60rpx;
}
</style>
