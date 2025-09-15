<template>
  <div class="chat-record-card" @click="toggleExpanded">
    <div class="card-header">
      <div class="header-left">
        <q-icon name="chat" color="primary" size="20px" />
        <span class="header-title">聊天记录</span>
        <span class="message-count">{{ messageCount }}条消息</span>
      </div>
      <div class="header-right">
        <q-icon 
          :name="isExpanded ? 'expand_less' : 'expand_more'" 
          color="grey-6" 
          size="20px"
        />
      </div>
    </div>

    <div v-if="isExpanded" class="card-content">
      <div class="messages-preview">
        <div 
          v-for="(message, index) in messages" 
          :key="message.id"
          class="preview-message preview-user"
        >
          <div class="preview-avatar">
            <q-avatar 
              color="primary" 
              text-color="white" 
              size="24px"
            >
              <q-icon name="person" />
            </q-avatar>
          </div>
          <div class="preview-content">
            <div class="preview-sender">
              我
            </div>
            <div class="preview-text">
              {{ getMessagePreview(message) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="additionalMessage" class="additional-message">
      <q-icon name="note" color="grey-6" size="20px" />
      <span class="additional-text">{{ additionalMessage }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ChatBubble } from '../../types'

interface Props {
  messages: ChatBubble[]
  additionalMessage?: string
}

const props = defineProps<Props>()

const isExpanded = ref(false)

const messageCount = computed(() => props.messages.length)

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const getMessagePreview = (message: ChatBubble): string => {
  if (message.messageType === 'voice') {
    return '[语音消息]'
  } else if (message.messageType === 'image') {
    return '[图片消息]'
  } else {
    // 文本消息，截取前50个字符
    const content = message.content || ''
    return content.length > 50 ? content.substring(0, 50) + '...' : content
  }
}
</script>

<style scoped>
.chat-record-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 12px;
  margin: 8px 0;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 80%;
}

.chat-record-card:hover {
  background: #f1f3f4;
  border-color: #d1d5db;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-weight: 500;
  color: #2c3e50;
}

.message-count {
  font-size: 12px;
  color: #6c757d;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 10px;
}

.header-right {
  display: flex;
  align-items: center;
}

.card-content {
  margin-top: 8px;
  border-top: 1px solid #e9ecef;
  padding-top: 8px;
}

.messages-preview {
  max-height: 200px;
  overflow-y: auto;
}

.preview-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  padding: 6px;
  border-radius: 6px;
}

.preview-message:last-child {
  margin-bottom: 0;
}

.preview-user {
  background: rgba(33, 150, 243, 0.1);
}

.preview-ai {
  background: rgba(0, 0, 0, 0.02);
}

.preview-avatar {
  flex-shrink: 0;
}

.preview-content {
  flex: 1;
  min-width: 0;
}

.preview-sender {
  font-size: 12px;
  font-weight: 500;
  color: #6c757d;
  margin-bottom: 2px;
}

.preview-text {
  font-size: 13px;
  color: #2c3e50;
  line-height: 1.4;
  word-break: break-word;
}

.additional-message {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(33, 150, 243, 0.05);
  border-radius: 6px;
  border-left: 3px solid #2196f3;
}

.additional-text {
  font-size: 13px;
  color: #2c3e50;
  font-style: italic;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .chat-record-card {
    background: #3a3a3a;
    border-color: #4a4a4a;
  }

  .chat-record-card:hover {
    background: #424242;
    border-color: #5a5a5a;
  }

  .header-title {
    color: #e0e0e0;
  }

  .message-count {
    background: #4a4a4a;
    color: #b0b0b0;
  }

  .preview-text {
    color: #e0e0e0;
  }

  .preview-sender {
    color: #b0b0b0;
  }

  .additional-text {
    color: #e0e0e0;
  }
}
</style>
