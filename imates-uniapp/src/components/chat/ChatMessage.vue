<template>
  <view class="message-row" :class="[isUser ? 'user' : 'assistant']">
    <!-- 选择模式的多选框 -->
    <view
      v-if="isSelectionMode"
      class="selection-checkbox"
      @click.stop="$emit('toggle-selection', message.id)"
    >
      <view class="custom-checkbox" :class="{ checked: isSelected }">
        <svg v-if="isSelected" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#ffffff" stroke-width="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </view>
    </view>

    <!-- AI 头像 -->
    <view v-if="!isUser" class="avatar ai-avatar">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7a7cff" stroke-width="2">
        <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7z" />
        <circle cx="9" cy="14" r="1" fill="#7a7cff" />
        <circle cx="15" cy="14" r="1" fill="#7a7cff" />
      </svg>
    </view>

    <!-- 气泡容器 -->
    <view class="bubble-container">
      <!-- 引用被回复的消息 -->
      <view
        v-if="message.quotedMessage"
        class="quoted-box"
        @click.stop="handleQuoteClick"
      >
        <text class="quoted-sender">
          {{ message.quotedMessage.sender === Sender.USER ? '你' : 'AI 助手' }}：
        </text>
        <text class="quoted-content">{{ message.quotedMessage.content }}</text>
      </view>

      <!-- 主气泡内容派发 -->
      <view
        class="bubble"
        :class="[
          isUser ? 'user' : 'assistant',
          { streaming: message.isStreaming, error: message.isError }
        ]"
        @longpress="handleLongPress"
      >
        <!-- 单图消息 -->
        <ImageMessage
          v-if="message.messageType === 'image' && message.imageData"
          :image-data="message.imageData"
          @load="emit('image-loaded')"
        />

        <!-- 多图消息 -->
        <MultiImageMessage
          v-else-if="message.messageType === 'multi_image' && message.imageList"
          :image-list="message.imageList"
          @load="emit('image-loaded')"
        />

        <!-- 语音消息 -->
        <VoiceMessage
          v-else-if="message.messageType === 'voice' && message.voiceData"
          :voice-data="message.voiceData"
        />

        <!-- 默认文本/打字机消息 -->
        <StreamingMessage
          v-else
          :content="message.content"
          :is-streaming="message.isStreaming"
        />
      </view>

      <!-- 底部状态与操作按钮 -->
      <view class="meta-bar">
        <text class="time-stamp">{{ message.timestamp }}</text>
        <text
          v-if="message.canRetry"
          class="retry-btn"
          @click="$emit('retry', message)"
        >
          重试
        </text>
      </view>
    </view>

    <!-- 用户头像 -->
    <view v-if="isUser" class="avatar user-avatar">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Sender } from '@/types/enums'
import type { ChatBubble } from '@/types/chat'

import StreamingMessage from './message/StreamingMessage.vue'
import ImageMessage from './message/ImageMessage.vue'
import MultiImageMessage from './message/MultiImageMessage.vue'
import VoiceMessage from './message/VoiceMessage.vue'

const props = defineProps<{
  message: ChatBubble
  isSelected?: boolean
  isSelectionMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'retry', message: ChatBubble): void
  (e: 'quote', message: ChatBubble): void
  (e: 'edit', message: ChatBubble): void
  (e: 'delete', messageId: string): void
  (e: 'toggle-selection', messageId: string): void
  (e: 'enter-multi-select'): void
  (e: 'scroll-to-message', messageId: string): void
  (e: 'paste-to-draft', content: string): void
  (e: 'image-loaded'): void
}>()

const isUser = computed(() => props.message.sender === Sender.USER)

const handleLongPress = () => {
  emit('enter-multi-select')
}

const handleQuoteClick = () => {
  if (props.message.quotedMessage) {
    emit('scroll-to-message', props.message.quotedMessage.id)
  }
}
</script>

<style lang="scss" scoped>
.message-row {
  display: flex;
  margin-bottom: 32rpx;
  align-items: flex-start;

  &.user {
    justify-content: flex-end;
  }

  &.assistant {
    justify-content: flex-start;
  }
}

.selection-checkbox {
  padding: 10rpx;
  margin-right: 12rpx;
  align-self: center;
}

.custom-checkbox {
  width: 36rpx;
  height: 36rpx;
  border-radius: 10rpx;
  border: 2rpx solid #7a7cff;
  display: flex;
  align-items: center;
  justify-content: center;

  &.checked {
    background-color: #7a7cff;
  }
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.ai-avatar {
    background-color: #f0f2fe;
    margin-right: 16rpx;
    box-shadow: 0 2rpx 8rpx rgba(122, 124, 255, 0.12);
  }

  &.user-avatar {
    background-color: #7a7cff;
    margin-left: 16rpx;
    box-shadow: 0 2rpx 8rpx rgba(122, 124, 255, 0.25);
  }
}

.bubble-container {
  max-width: 76%;
  display: flex;
  flex-direction: column;
}

.quoted-box {
  background-color: #f1f5f9;
  border-left: 6rpx solid #7a7cff;
  padding: 10rpx 16rpx;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: #64748b;
}

.quoted-sender {
  font-weight: 600;
}

.quoted-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bubble {
  padding: 22rpx 28rpx;
  border-radius: 24rpx;
  word-break: break-word;
  font-size: 30rpx;

  &.assistant {
    background-color: #ffffff;
    color: #1f2937;
    border-top-left-radius: 6rpx;
    border: 1px solid #eef0f5;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);
  }

  &.user {
    background-color: #7a7cff;
    color: #ffffff;
    border-top-right-radius: 6rpx;
    box-shadow: 0 4rpx 14rpx rgba(122, 124, 255, 0.25);
  }

  &.streaming {
    opacity: 0.95;
  }

  &.error {
    border: 1px solid #fca5a5;
    background-color: #fef2f2;
    color: #991b1b;
  }
}

.meta-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 8rpx;
  padding: 0 4rpx;

  .user & {
    justify-content: flex-end;
  }
}

.time-stamp {
  font-size: 20rpx;
  color: #9ca3af;
}

.retry-btn {
  font-size: 22rpx;
  color: #ef4444;
  font-weight: bold;
}
</style>
