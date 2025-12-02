<template>
  <div class="chat-session-list">
    <!-- 会话列表 -->
    <div class="session-list">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="session-item"
        @click="handleSessionClick(session)"
      >
        <span class="session-title">{{ session.title }}</span>
        <button class="delete-btn" @click.stop="handleDelete(session.id)">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="toolbar">
      <button class="toolbar-btn" @click="handleBack">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/>
        </svg>
        <span>返回</span>
      </button>
      
      <button class="toolbar-btn new-btn" @click="handleNew">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z" fill="currentColor"/>
        </svg>
        <span>新建</span>
      </button>

      <button class="toolbar-btn share-btn" @click="handleShare">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="currentColor"/>
        </svg>
        <span>分享</span>
      </button>
    </div>

    <!-- 输入框 -->
    <div class="input-container">
      <button class="avatar-btn" @click="handleAvatarClick">
        <img :src="avatarUrl" alt="avatar" />
        <svg viewBox="0 0 24 24" width="12" height="12" class="dropdown-icon">
          <path d="M7 10l5 5 5-5z" fill="currentColor"/>
        </svg>
      </button>
      
      <input
        v-model="inputText"
        type="text"
        class="text-input"
        placeholder="输入文本"
        @keyup.enter="handleSend"
      />
      
      <button class="voice-btn" @click="handleVoice">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" fill="currentColor"/>
        </svg>
      </button>
      
      <button class="send-btn" @click="handleSend">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Session {
  id: string
  title: string
  createdAt?: string
}

interface Props {
  sessions?: Session[]
  avatarUrl?: string
}

interface Emits {
  (e: 'session-click', session: Session): void
  (e: 'delete', sessionId: string): void
  (e: 'back'): void
  (e: 'new'): void
  (e: 'share'): void
  (e: 'avatar-click'): void
  (e: 'voice'): void
  (e: 'send', text: string): void
}

const props = withDefaults(defineProps<Props>(), {
  sessions: () => [
    { id: '1', title: '会话一' },
    { id: '2', title: '会话二' },
    { id: '3', title: '会话三' },
    { id: '4', title: '会话四' },
  ],
  avatarUrl: '/icons/default-avatar.png'
})

const emit = defineEmits<Emits>()

const inputText = ref('')

const handleSessionClick = (session: Session) => {
  emit('session-click', session)
}

const handleDelete = (sessionId: string) => {
  emit('delete', sessionId)
}

const handleBack = () => {
  emit('back')
}

const handleNew = () => {
  emit('new')
}

const handleShare = () => {
  emit('share')
}

const handleAvatarClick = () => {
  emit('avatar-click')
}

const handleVoice = () => {
  emit('voice')
}

const handleSend = () => {
  if (inputText.value.trim()) {
    emit('send', inputText.value)
    inputText.value = ''
  }
}
</script>

<style scoped>
.chat-session-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.session-item:hover {
  background-color: #f5f5f5;
}

.session-title {
  font-size: 15px;
  color: #333333;
  flex: 1;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #999999;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  padding: 0;
}

.delete-btn:hover {
  background-color: #f0f0f0;
  color: #666666;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #e8e8e8;
  border-bottom: 1px solid #e8e8e8;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #666666;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background-color: #f5f5f5;
  color: #333333;
}

.toolbar-btn svg {
  flex-shrink: 0;
}

.new-btn {
  flex: 1;
  justify-content: center;
  margin: 0 8px;
}

.share-btn {
  color: #999999;
}

.input-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 2px solid #6366f1;
  border-radius: 24px;
  margin: 12px;
  background: #ffffff;
}

.avatar-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
}

.avatar-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dropdown-icon {
  position: absolute;
  right: -2px;
  bottom: -2px;
  background: #ffffff;
  border-radius: 50%;
}

.text-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: #333333;
  padding: 8px 4px;
  background: transparent;
}

.text-input::placeholder {
  color: #999999;
}

.voice-btn,
.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s;
  padding: 0;
  color: #666666;
  flex-shrink: 0;
}

.voice-btn:hover,
.send-btn:hover {
  background-color: #f0f0f0;
}

.send-btn {
  background-color: #6366f1;
  color: #ffffff;
}

.send-btn:hover {
  background-color: #5558e3;
}

/* 滚动条样式 */
.session-list::-webkit-scrollbar {
  width: 6px;
}

.session-list::-webkit-scrollbar-track {
  background: #f5f5f5;
}

.session-list::-webkit-scrollbar-thumb {
  background: #d0d0d0;
  border-radius: 3px;
}

.session-list::-webkit-scrollbar-thumb:hover {
  background: #b0b0b0;
}
</style>
