<template>
  <view class="chat-record-card">
    <view class="record-header">
      <text class="record-title">📄 聊天记录卡片</text>
    </view>
    <view class="record-messages">
      <view
        v-for="(msg, idx) in messages.slice(0, 3)"
        :key="idx"
        class="record-line"
      >
        <text class="record-sender">{{ msg.sender === Sender.USER ? '你' : 'AI' }}: </text>
        <text class="record-text">{{ msg.content }}</text>
      </view>
    </view>
    <view v-if="additionalMessage" class="record-footer">
      <text>{{ additionalMessage }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { Sender } from '@/types/enums'
import type { ChatBubble } from '@/types/chat'

defineProps<{
  messages: ChatBubble[]
  additionalMessage?: string
}>()
</script>

<style lang="scss" scoped>
.chat-record-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16rpx;
  padding: 18rpx 24rpx;
  max-width: 500rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.record-title {
  font-size: 24rpx;
  font-weight: 600;
  color: #475569;
  margin-bottom: 12rpx;
  display: block;
}

.record-messages {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.record-line {
  font-size: 22rpx;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-sender {
  font-weight: 500;
  color: #334155;
}

.record-footer {
  margin-top: 12rpx;
  padding-top: 10rpx;
  border-top: 1px dashed #e2e8f0;
  font-size: 20rpx;
  color: #94a3b8;
}
</style>
