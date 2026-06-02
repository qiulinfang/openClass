<template>
  <view class="interactive-canvas-view">
    <!-- 顶部标签切换 (针对移动端优化) -->
    <view class="tabs">
      <view 
        class="tab-item" 
        :class="{ active: activeTab === 'canvas' }"
        @click="activeTab = 'canvas'"
      >
        画布
      </view>
      <view 
        class="tab-item" 
        :class="{ active: activeTab === 'chat' }"
        @click="activeTab = 'chat'"
      >
        对话
      </view>
    </view>

    <!-- 主体区域 -->
    <view class="main-content">
      <!-- 画布区域 -->
      <view class="canvas-area" v-show="activeTab === 'canvas'">
        <view class="canvas-header">
          <text class="title">创意画布</text>
          <text class="subtitle">支持移动与点击编辑</text>
        </view>
        
        <view class="canvas-viewport" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
          <!-- 画布元素 -->
          <view
            v-for="item in items"
            :key="item.id"
            class="canvas-item"
            :style="{ left: item.x + 'rpx', top: item.y + 'rpx', zIndex: activeItemId === item.id ? 100 : 10 }"
            @click="handleItemClick(item)"
          >
            <view class="item-content">
              <rich-text :nodes="item.content"></rich-text>
            </view>
            <view class="delete-btn" v-if="activeItemId === item.id" @click.stop="removeItem(item.id)">✕</view>
          </view>
          
          <view v-if="items.length === 0" class="empty-state">
            <image src="/static/icons/draw.svg" mode="aspectFit" class="empty-icon" />
            <text>暂无内容，请在对话中划选添加</text>
          </view>
        </view>
      </view>

      <!-- 对话区域 -->
      <view class="chat-area" v-show="activeTab === 'chat'">
        <scroll-view scroll-y class="chat-messages">
          <view v-for="(msg, index) in messages" :key="index" class="message-wrapper">
            <view class="chat-bubble" @click="handleMessageClick(msg)">
              <rich-text :nodes="renderMarkdown(msg)"></rich-text>
              <view class="add-to-canvas" @click.stop="addToCanvas(msg)">
                <text>添加至画布</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="chat-input-bar">
          <input 
            v-model="inputMessage" 
            placeholder="发送消息..." 
            class="msg-input" 
            confirm-type="send"
            @confirm="sendMessage"
          />
          <button class="send-btn" @click="sendMessage">发送</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineOptions({
  name: 'InteractiveCanvasView',
})

const activeTab = ref('chat')
const items = ref<any[]>([])
const activeItemId = ref<number | null>(null)
const inputMessage = ref('')
const messages = ref<string[]>([
  '你好。你可以点击气泡中的“添加至画布”将其加入左侧画布。',
  '公式支持：$E=mc^2$ 或复杂公式：\n\n$$\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}$$'
])

// 模拟 Markdown 渲染 (简单替换)
const renderMarkdown = (content: string) => {
  return content.replace(/\n/g, '<br/>')
}

const sendMessage = () => {
  if (!inputMessage.value.trim()) return
  messages.value.push(inputMessage.value)
  inputMessage.value = ''
}

const addToCanvas = (content: string) => {
  const newItem = {
    id: Date.now(),
    x: 50,
    y: 50,
    content: renderMarkdown(content),
    type: 'html'
  }
  items.value.push(newItem)
  uni.showToast({ title: '已添加至画布' })
  activeTab.value = 'canvas'
}

const handleItemClick = (item: any) => {
  activeItemId.value = item.id
}

const removeItem = (id: number) => {
  items.value = items.value.filter(i => i.id !== id)
  if (activeItemId.value === id) activeItemId.value = null
}

// 简单的拖拽实现
let startX = 0
let startY = 0
let itemStartX = 0
let itemStartY = 0

const handleTouchStart = (e: any) => {
  if (activeItemId.value) {
    const item = items.value.find(i => i.id === activeItemId.value)
    if (item) {
      const touch = e.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      itemStartX = item.x
      itemStartY = item.y
    }
  }
}

const handleTouchMove = (e: any) => {
  if (activeItemId.value) {
    const item = items.value.find(i => i.id === activeItemId.value)
    if (item) {
      const touch = e.touches[0]
      const dx = (touch.clientX - startX) * 2 // 转换为 rpx (大概)
      const dy = (touch.clientY - startY) * 2
      item.x = itemStartX + dx
      item.y = itemStartY + dy
    }
  }
}

const handleTouchEnd = () => {
  // 结束拖拽
}

const handleMessageClick = (msg: string) => {
  // 处理点击消息
}

onMounted(() => {
  // 初始化
})
</script>

<style scoped>
.interactive-canvas-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f9fafb;
}

.tabs {
  display: flex;
  background-color: #fff;
  border-bottom: 2rpx solid #eee;
  height: 88rpx;
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
  position: relative;
}

.canvas-area {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.canvas-header {
  padding: 20rpx 32rpx;
  background-color: #fff;
  border-bottom: 2rpx solid #eee;
}

.canvas-header .title {
  font-size: 32rpx;
  font-weight: 600;
}

.canvas-header .subtitle {
  font-size: 20rpx;
  color: #999;
  margin-left: 16rpx;
}

.canvas-viewport {
  flex: 1;
  position: relative;
  background-image: radial-gradient(#e5e7eb 2rpx, transparent 2rpx);
  background-size: 40rpx 40rpx;
}

.canvas-item {
  position: absolute;
  background-color: #fff;
  padding: 20rpx;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
  min-width: 100rpx;
  max-width: 500rpx;
}

.delete-btn {
  position: absolute;
  top: -16rpx;
  right: -16rpx;
  width: 40rpx;
  height: 40rpx;
  background-color: #ef4444;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
}

.empty-state {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #999;
  gap: 20rpx;
}

.empty-icon {
  width: 120rpx;
  height: 120rpx;
  opacity: 0.2;
}

.chat-area {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f1f3ff;
}

.chat-messages {
  flex: 1;
  padding: 32rpx;
}

.message-wrapper {
  margin-bottom: 32rpx;
}

.chat-bubble {
  background-color: #fff;
  padding: 24rpx;
  border-radius: 16rpx;
  border-top-left-radius: 4rpx;
  display: inline-block;
  max-width: 80%;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.add-to-canvas {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 2rpx solid #f3f4f6;
  color: #6e55ff;
  font-size: 24rpx;
  text-align: right;
}

.chat-input-bar {
  padding: 20rpx 32rpx;
  padding-bottom: calc(env(safe-area-inset-bottom) + 20rpx);
  background-color: #fff;
  display: flex;
  gap: 20rpx;
  align-items: center;
}

.msg-input {
  flex: 1;
  height: 80rpx;
  background-color: #f3f4f6;
  border-radius: 40rpx;
  padding: 0 32rpx;
  font-size: 28rpx;
}

.send-btn {
  width: 140rpx;
  height: 80rpx;
  background-color: #6e55ff;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
