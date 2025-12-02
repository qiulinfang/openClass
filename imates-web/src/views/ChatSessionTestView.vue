<template>
  <div class="chat-session-test-view">
    <div class="test-container">
      <h2>ChatSessionList 组件测试</h2>
      
      <div class="component-wrapper">
        <ChatSessionList
          :sessions="sessions"
          :avatar-url="avatarUrl"
          @session-click="handleSessionClick"
          @delete="handleDelete"
          @back="handleBack"
          @new="handleNew"
          @share="handleShare"
          @avatar-click="handleAvatarClick"
          @voice="handleVoice"
          @send="handleSend"
        />
      </div>

      <!-- 事件日志 -->
      <div class="event-log">
        <h3>事件日志</h3>
        <button @click="clearLog" class="clear-btn">清空日志</button>
        <div class="log-content">
          <div v-for="(log, index) in eventLogs" :key="index" class="log-item">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-event">{{ log.event }}</span>
            <span class="log-data">{{ log.data }}</span>
          </div>
        </div>
      </div>

      <!-- 控制面板 -->
      <div class="control-panel">
        <h3>控制面板</h3>
        <div class="control-group">
          <label>添加新会话：</label>
          <input v-model="newSessionTitle" placeholder="会话标题" />
          <button @click="addSession">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ChatSessionList from '@/components/ChatSessionList.vue'

defineOptions({
  name: 'ChatSessionTestView',
})

interface Session {
  id: string
  title: string
}

interface EventLog {
  time: string
  event: string
  data: string
}

const sessions = ref<Session[]>([
  { id: '1', title: '会话一' },
  { id: '2', title: '会话二' },
  { id: '3', title: '会话三' },
  { id: '4', title: '会话四' },
])

const avatarUrl = ref('/icons/default-avatar.png')
const eventLogs = ref<EventLog[]>([])
const newSessionTitle = ref('')

const addLog = (event: string, data?: any) => {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  
  eventLogs.value.unshift({
    time,
    event,
    data: data ? JSON.stringify(data) : '-'
  })
  
  // 最多保留 50 条日志
  if (eventLogs.value.length > 50) {
    eventLogs.value = eventLogs.value.slice(0, 50)
  }
}

const handleSessionClick = (session: Session) => {
  addLog('session-click', session)
  console.log('点击会话:', session)
}

const handleDelete = (sessionId: string) => {
  addLog('delete', { sessionId })
  const index = sessions.value.findIndex(s => s.id === sessionId)
  if (index !== -1) {
    sessions.value.splice(index, 1)
    console.log('删除会话:', sessionId)
  }
}

const handleBack = () => {
  addLog('back')
  console.log('返回')
}

const handleNew = () => {
  addLog('new')
  const newId = (sessions.value.length + 1).toString()
  sessions.value.push({
    id: newId,
    title: `新会话 ${newId}`
  })
  console.log('新建会话')
}

const handleShare = () => {
  addLog('share')
  console.log('分享')
}

const handleAvatarClick = () => {
  addLog('avatar-click')
  console.log('点击头像')
}

const handleVoice = () => {
  addLog('voice')
  console.log('语音输入')
}

const handleSend = (text: string) => {
  addLog('send', { text })
  console.log('发送消息:', text)
}

const clearLog = () => {
  eventLogs.value = []
}

const addSession = () => {
  if (newSessionTitle.value.trim()) {
    const newId = Date.now().toString()
    sessions.value.push({
      id: newId,
      title: newSessionTitle.value.trim()
    })
    newSessionTitle.value = ''
    addLog('添加会话', { title: newSessionTitle.value })
  }
}
</script>

<style scoped>
.chat-session-test-view {
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  overflow-y: auto;
  padding: 20px;
}

.test-container {
  max-width: 1400px;
  margin: 0 auto;
}

h2 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 24px;
}

h3 {
  margin: 0 0 12px 0;
  color: #555;
  font-size: 16px;
}

.component-wrapper {
  width: 400px;
  height: 600px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 20px;
}

.event-log {
  background: #ffffff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.clear-btn {
  float: right;
  padding: 6px 12px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.clear-btn:hover {
  background: #dd3333;
}

.log-content {
  clear: both;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.log-item {
  display: grid;
  grid-template-columns: 70px 120px 1fr;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  color: #999;
}

.log-event {
  color: #6366f1;
  font-weight: 500;
}

.log-data {
  color: #333;
  word-break: break-all;
}

.control-panel {
  background: #ffffff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.control-group:last-child {
  margin-bottom: 0;
}

.control-group label {
  font-size: 14px;
  color: #666;
  min-width: 100px;
}

.control-group input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-size: 14px;
}

.control-group input:focus {
  outline: none;
  border-color: #6366f1;
}

.control-group button {
  padding: 8px 16px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.control-group button:hover {
  background: #5558e3;
}

/* 滚动条样式 */
.log-content::-webkit-scrollbar {
  width: 6px;
}

.log-content::-webkit-scrollbar-track {
  background: #f5f5f5;
}

.log-content::-webkit-scrollbar-thumb {
  background: #d0d0d0;
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: #b0b0b0;
}
</style>
