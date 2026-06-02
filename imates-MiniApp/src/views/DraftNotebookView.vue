<template>
  <view class="draft-notebook-view">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="header-left" @click="handleBack">
        <image src="/static/icons/goback.svg" mode="aspectFit" class="back-icon" />
      </view>
      <view class="header-center">
        <text class="title">草稿本</text>
      </view>
      <view class="header-right" @click="toggleChat">
        <image src="/static/icons/xuebanask.svg" mode="aspectFit" class="chat-icon" />
      </view>
    </view>

    <!-- 主体区域 -->
    <view class="main-content">
      <!-- 模式切换 (针对移动端优化，不使用 Splitter) -->
      <view class="content-container">
        <!-- 画图区域 -->
        <view class="drawing-section" v-show="!showChat">
          <DrawingBoardNew
            ref="drawingBoardRef"
            @clear="handleClearRequest"
            @ask-ai-image-selected="handleAskAiImageSelected"
          />
        </view>

        <!-- 聊天区域 -->
        <view class="chat-section" v-show="showChat">
          <DraftNoteChatPanel
            ref="chatPanelRef"
            @close="showChat = false"
            @request-screenshot="handleChatPanelScreenshotRequest"
          />
        </view>
      </view>
    </view>

    <!-- 清空确认对话框 -->
    <Dialog
      ref="clearDialogRef"
      title="清空确认"
      confirm-button-text="清空"
      cancel-button-text="取消"
      @confirm="confirmClearCanvas"
    >
      确定要清空画布吗？
    </Dialog>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import DrawingBoardNew from '../components/drawing/DrawingBoardNew.vue'
import DraftNoteChatPanel from '../components/chat/chatpanel/DraftNoteChatPanel.vue'
import Dialog from '../components/base/Dialog.vue'

defineOptions({
  name: 'DraftNotebookView',
})

const drawingBoardRef = ref(null)
const clearDialogRef = ref(null)
const chatPanelRef = ref(null)
const showChat = ref(false)

const handleBack = () => {
  uni.navigateBack()
}

const toggleChat = () => {
  showChat.value = !showChat.value
}

const handleClearRequest = () => {
  clearDialogRef.value?.openDialog()
}

const confirmClearCanvas = () => {
  (drawingBoardRef.value as any)?.clearAll()
  clearDialogRef.value?.closeDialog()
}

const handleAskAiImageSelected = async (imageInfo: any) => {
  showChat.value = true
  await nextTick()
  if (chatPanelRef.value) {
    (chatPanelRef.value as any).attachImageToAiGeneral(imageInfo)
  }
}

const handleChatPanelScreenshotRequest = () => {
  showChat.value = false
  uni.showToast({ title: '请在画布上划选截图区域', icon: 'none' })
}
</script>

<style scoped>
.draft-notebook-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #0a0020;
}

.header {
  height: 100rpx;
  background-color: #0f002e;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  color: #fff;
}

.back-icon, .chat-icon {
  width: 48rpx;
  height: 48rpx;
}

.header-center {
  flex: 1;
  text-align: center;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
}

.main-content {
  flex: 1;
  overflow: hidden;
}

.content-container {
  width: 100%;
  height: 100%;
}

.drawing-section, .chat-section {
  width: 100%;
  height: 100%;
}
</style>
