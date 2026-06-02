<template>
  <view class="pdf-viewer-view">
    <!-- 顶部状态栏占位 -->
    <view class="status-bar"></view>
    
    <!-- 顶部页签切换 -->
    <view class="tabs">
      <view 
        class="tab-item" 
        :class="{ active: activeTab === 'pdf' }"
        @click="activeTab = 'pdf'"
      >
        阅读
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
      <!-- PDF 阅读区域 -->
      <view class="pdf-section" v-show="activeTab === 'pdf'">
        <PdfPage
          ref="pdfPageRef"
          :file="currentFile"
          @screenshot-captured="handleScreenshotCaptured"
        />
      </view>

      <!-- 聊天区域 -->
      <view class="chat-section" v-show="activeTab === 'chat'">
        <PdfChatPanel
          ref="chatPanelRef"
          @close="activeTab = 'pdf'"
          @screenshot-click="handleScreenshotClick"
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
import { resourceManager } from '../services/storage/resource-storage'
import PdfPage from '../components/pdf/PdfPage.vue'
import PdfChatPanel from '../components/chat/chatpanel/PdfChatPanel.vue'

defineOptions({
  name: 'PdfViewerView',
})

const route = useRoute()
const activeTab = ref('pdf')
const currentFile = ref<any>(null)
const pdfPageRef = ref(null)
const chatPanelRef = ref(null)

const loadFileInfo = async () => {
  const id = route.query.id as string
  const resourceId = route.query.resourceId as string
  
  if (id && resourceId) {
    const textbook = await resourceManager.getTextbookInfoById(id)
    if (textbook) {
      const localFile = textbook.localFiles?.find((f: any) => f.id === resourceId)
      if (localFile) {
        currentFile.value = {
          name: localFile.fileName,
          path: localFile.localPath
        }
      }
    }
  }
}

const handleScreenshotCaptured = (blob: any) => {
  activeTab.value = 'chat'
  // 处理截图逻辑
}

const handleScreenshotClick = (active: boolean) => {
  if (active) {
    activeTab.value = 'pdf'
    uni.showToast({ title: '请在页面上划选截图', icon: 'none' })
  }
}

const goBack = () => {
  uni.navigateBack()
}

onMounted(() => {
  loadFileInfo()
})
</script>

<style scoped>
.pdf-viewer-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #0a0020;
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

.pdf-section, .chat-section {
  width: 100%;
  height: 100%;
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
