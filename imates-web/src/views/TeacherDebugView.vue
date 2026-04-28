<template>
  <div class="teacher-test-page">
    <div class="app-header">
      <div class="header-left">
        <span class="brand">教师端</span>
        <div class="env-selector">
          <select :value="getCurrentEnvType()" @change="handleEnvChange">
            <option :value="AppEnvType.RELEASE">正式环境</option>
            <option :value="AppEnvType.INTERNAL_TEST">测试环境</option>
          </select>
        </div>
      </div>
      <div class="header-right">
        <div class="status-indicator" :class="{ 'is-online': wsConnected }" :title="wsConnected ? '已连接' : '已断开'"></div>
        <CommonButton 
          label="重连" 
          size="xs" 
          variant="ghost" 
          @click="reconnect"
        />
      </div>
    </div>

    <div class="main-content">
      <!-- 会话导航栏 -->
      <aside class="session-nav">
        <div class="nav-header">
          <span class="count">共 {{ sessions.length }} 个会话</span>
          <button class="refresh-icon" @click="fetchSessions">🔄</button>
        </div>
        
        <div class="session-scroll-area">
          <div 
            v-for="session in sessions" 
            :key="session.id"
            :class="['session-card', { active: currentSessionId === session.id }]"
            @click="selectSession(session)"
          >
            <div class="session-avatar">
              {{ (session.studentName || '学').charAt(0) }}
            </div>
            <div class="session-detail">
              <div class="session-top">
                <span class="name">{{ session.studentName || '学生' }}</span>
                <span class="time">{{ session.msgTime }}</span>
              </div>
              <div class="session-bottom">
                <p class="preview">{{ session.msgContent }}</p>
                <div v-if="session.unreadCount" class="unread-dot"></div>
              </div>
            </div>
          </div>
          
          <div v-if="sessions.length === 0" class="empty-state">
            <p>暂无消息</p>
          </div>
        </div>
      </aside>

      <!-- 聊天主区域 -->
      <main class="chat-viewport">
        <template v-if="currentSessionId">
          <header class="chat-header">
            <div class="student-profile">
              <div class="avatar-sm">{{ currentSessionId.charAt(0).toUpperCase() }}</div>
              <span class="current-name">会话ID: {{ currentSessionId }}</span>
            </div>
          </header>

          <div class="message-list" ref="messageBox">
            <div 
              v-for="(msg, index) in messages" 
              :key="index"
              :class="['message-group', msg.senderType === 'TEACHER' ? 'sent' : 'received']"
            >
              <div class="message-bubble">
                <div v-if="msg.msgType === '1'" class="image-content">
                  <img :src="msg.content" alt="图片内容" @click="previewImage(msg.content)" />
                </div>
                <div v-else class="text-content">{{ msg.content }}</div>
                <div class="message-meta">
                  {{ formatTime(msg.timestamp) }}
                  <span v-if="msg.senderType === 'TEACHER'" class="check-icon">✓</span>
                </div>
              </div>
            </div>
          </div>

          <footer class="input-panel">
            <div class="input-wrapper">
              <textarea 
                v-model="replyText" 
                placeholder="输入回复内容..."
                @keyup.enter.exact="sendReply"
              ></textarea>
              <button 
                class="send-btn" 
                :disabled="!replyText.trim()"
                @click="sendReply"
              >
                发送
              </button>
            </div>
          </footer>
        </template>

        <div v-else class="hero-screen">
          <div class="hero-content">
            <div class="hero-illustration">🛋️</div>
            <h1>准备好开始答疑了吗？</h1>
            <p>从左侧列表中选择一个学生会话，开始提供专业的指导。</p>
          </div>
        </div>
      </main>
    </div>

    <!-- 增强版通知 -->
    <transition name="slide-fade">
      <div v-if="newQuestionNotice" class="smart-notice">
        <div class="notice-body">
          <div class="notice-icon">🔔</div>
          <div class="notice-info">
            <h4>新消息通知</h4>
            <p>{{ newQuestionNotice.content }}</p>
          </div>
        </div>
        <div class="notice-foot">
          <button class="btn-text" @click="newQuestionNotice = null">忽略</button>
          <button class="btn-primary" @click="goToSession(newQuestionNotice.sessionId)">立即查看</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { getTeacherWebSocket } from '@/services/websocket/teacher-websocket'
import { httpClient } from '@/services/http/http-client'
import { getUserId } from '@/services/http/auth-service'
import { getApiPaths, getEnvDisplayName, getCurrentEnvType, AppEnvType, trySwitchEnv } from '@/config/env-config'
import CommonButton from '@/components/base/Button.vue'

// 类型定义
interface TeacherSession {
  id: string
  studentId: string
  studentName: string
  studentAvatar: string | null
  msgType: string
  msgContent: string
  msgTime: string
  hasUnRead: boolean
  // 前端辅助字段
  unreadCount?: number 
}

interface MessageItem {
  senderType: 'TEACHER' | 'STUDENT' | string
  content: string
  msgType: string
  timestamp: number
}

// --- 状态定义 ---
const wsConnected = ref(false)
const sessions = ref<TeacherSession[]>([])
const currentSessionId = ref('')
const messages = ref<MessageItem[]>([])
const replyText = ref('')
const newQuestionNotice = ref<any>(null)
const messageBox = ref<HTMLElement | null>(null)

const teacherId = '1866415928790540290'

// 环境切换处理
const handleEnvChange = (event: Event) => {
  const targetEnv = (event.target as HTMLSelectElement).value as AppEnvType
  // 使用项目约定的测试环境切换密码
  const success = trySwitchEnv(targetEnv, '985211')
  if (success) {
    window.location.reload()
  } else {
    alert('环境切换失败，请检查权限')
  }
}

// WebSocket 初始化
const ws = getTeacherWebSocket()

const setupWs = () => {
  // 强制使用教师 ID 重新连接
  console.log(`[TeacherDebug] 🔌 正在以教师账号 ${teacherId} 建立连接...`)
  ws.disconnect()
  ws.connect(teacherId)
  
  console.log('[TeacherDebug] 🔌 初始化 WebSocket 监听...')

  ws.on('connected', () => {
    console.log('[TeacherDebug] WebSocket 已连接')
    wsConnected.value = true
  })
  
  ws.on('disconnected', () => {
    console.log('[TeacherDebug] ❌ WebSocket 已断开')
    wsConnected.value = false
  })

  // 增加：监听所有原始消息（用于排查路由问题）
  ws.on('message', (msg: any) => {
    console.log('[TeacherDebug] 📩 收到原始 WebSocket 消息:', msg)
    
    // 兼容多种可能的后端推送类型字段
    if (msg.type === 'TYPE_NEW_QUESTION' || msg.type === 'NEW_QUESTION') {
      handleNewQuestion(msg)
    }
  })

  // 监听学生发起的新提问 (TYPE_NEW_QUESTION)
  ws.on('TYPE_NEW_QUESTION', (msg: any) => {
    console.log('[TeacherDebug] 🔔 触发 TYPE_NEW_QUESTION 监听:', msg)
    handleNewQuestion(msg)
  })

  // 同时保留旧的监听以防后端以后改回去
  ws.on('NEW_QUESTION', (msg: any) => {
    console.log('[TeacherDebug] 🔔 触发 NEW_QUESTION 监听:', msg)
    handleNewQuestion(msg)
  })

  // 监听教师回复响应
  ws.on('TEACHER_RESPONSE', (msg: any) => {
    console.log('[TeacherDebug] 📝 收到 TEACHER_RESPONSE:', msg)
    if (msg.data && msg.data.sessionId === currentSessionId.value) {
      messages.value.push({
        senderType: 'TEACHER',
        content: msg.data.content,
        msgType: msg.data.msgType || '0',
        timestamp: msg.data.timestamp || Date.now()
      })
      scrollToBottom()
    }
  })
}

// 提取处理新问题的逻辑
const handleNewQuestion = (msg: any) => {
  console.log('[TeacherDebug] 🚀 执行新提问处理逻辑')
  if (msg.data && msg.data.payload) {
    newQuestionNotice.value = {
      sessionId: msg.data.payload.sessionId,
      content: msg.data.payload.content
    }
    fetchSessions() // 刷新列表以显示红点
  }
}

const fetchSessions = async () => {
  try {
    const apiPaths = getApiPaths()
    const apiPath = apiPaths.yanban.teacher.historyList.replace('/historyList', '')
    const finalUrl = `${apiPath}/sessionList`
    
    console.log('[TeacherDebug] 🚀 开始请求会话列表:', {
      url: finalUrl,
      teacherId,
      fullPaths: apiPaths.yanban.teacher
    })
    
    // 使用定义的泛型，确保 data.records 能被识别
    const res = await httpClient.post<any>(finalUrl, {
      teacherId: teacherId,
      page: 1,
      pageSize: 50
    })

    console.log('[TeacherDebug] 📥 接口原始返回:', res)

    if (res.success && res.data) {
      // 修复解析逻辑：处理双层 data 嵌套 res.data.data.records
      const rawData = res.data.data || res.data
      const records = rawData.records || rawData.list || (Array.isArray(rawData) ? rawData : [])
      
      console.log('[TeacherDebug] 📊 解析到的记录数量:', records.length)
      
      sessions.value = records.map((item: any) => ({
        ...item,
        unreadCount: item.hasUnRead ? 1 : 0
      }))
      console.log('[TeacherDebug] ✅ sessions 状态已更新:', sessions.value)
    } else {
      console.warn('[TeacherDebug] ⚠️ 获取会话列表数据异常或成功标记为假:', res)
    }
  } catch (err) {
    console.error('[TeacherDebug] ❌ 获取会话列表捕获到异常:', err)
  }
}

const selectSession = async (session: TeacherSession) => {
  currentSessionId.value = session.id
  await markAsRead(session.id)
  await fetchHistory(session.id)
}

const markAsRead = async (sessionId: string) => {
  try {
    const apiPath = getApiPaths().yanban.teacher.historyList.replace('/historyList', '')
    await httpClient.post(`${apiPath}/readMessage`, { sessionId, teacherId })
    
    // 本地即时更新 UI
    const s = sessions.value.find(item => item.id === sessionId)
    if (s) {
      s.hasUnRead = false
      s.unreadCount = 0
    }
  } catch (err) {
    console.error('标记已读失败:', err)
  }
}

const fetchHistory = async (sessionId: string) => {
  try {
    const res = await httpClient.post<any>(getApiPaths().yanban.teacher.historyList, {
      sessionId,
      page: 1,
      pageSize: 50
    })
    if (res.success && res.data) {
      // 适配最新接口：res.data 直接就是数组列表
      const history = Array.isArray(res.data) ? res.data : (res.data.data || [])
      messages.value = history.map((m: any) => ({
        senderType: m.senderType || (m.account === teacherId ? 'TEACHER' : 'STUDENT'),
        content: m.msgContent,
        msgType: m.msgType,
        timestamp: m.createTime ? new Date(m.createTime).getTime() : Date.now(),
        // 增加头像和姓名适配
        senderName: m.msgSendName,
        senderAvatar: m.msgSendAvatar
      }))
      scrollToBottom()
    }
  } catch (err) {
    console.error('获取历史记录失败:', err)
  }
}

const sendReply = async () => {
  if (!replyText.value.trim() || !currentSessionId.value) return

  const content = replyText.value
  const sessionId = currentSessionId.value

  try {
    const apiPath = getApiPaths().yanban.teacher.historyList.replace('/historyList', '')
    const res = await httpClient.post(`${apiPath}/replyMessage`, {
      sessionId,
      teacherId,
      msgType: '0',
      msgContent: content
    })

    if (res.success) {
      messages.value.push({
        senderType: 'TEACHER',
        content: content,
        msgType: '0',
        timestamp: Date.now()
      })
      replyText.value = ''
      scrollToBottom()
    }
  } catch (err) {
    console.error('发送回复失败:', err)
  }
}

const goToSession = (sessionId: string) => {
  newQuestionNotice.value = null
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    selectSession(session)
  } else {
    currentSessionId.value = sessionId
    fetchHistory(sessionId)
  }
}

const reconnect = () => {
  ws.disconnect()
  setupWs()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messageBox.value) {
      messageBox.value.scrollTo({
        top: messageBox.value.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

const formatTime = (ts: number) => {
  const date = new Date(ts)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

const formatSessionTime = (timeStr?: string) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const previewImage = (url: string) => {
  window.open(url, '_blank')
}

onMounted(() => {
  setupWs()
  fetchSessions()
  wsConnected.value = ws.isConnected()
})

onUnmounted(() => {
  ws.off('connected')
  ws.off('disconnected')
  ws.off('NEW_QUESTION')
  ws.off('TEACHER_RESPONSE')
})
</script>

<style scoped>
.teacher-test-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #fff;
  color: #333;
  overflow: hidden;
}

/* 精简顶部栏 */
.app-header {
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand {
  font-weight: 700;
  font-size: 14px;
  color: #6e55ff;
  letter-spacing: 0.5px;
}

.env-selector select {
  padding: 2px 6px;
  border-radius: 4px;
  border: none;
  background: #f5f5f5;
  font-size: 11px;
  color: #666;
  cursor: pointer;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff4d4f;
}

.status-indicator.is-online {
  background: #52c41a;
  box-shadow: 0 0 6px rgba(82, 196, 26, 0.4);
}

/* 主内容区 */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 会话导航栏 - 极简风格 */
.session-nav {
  width: 260px;
  background: #fafafa;
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
}

.nav-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #999;
}

.refresh-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
  opacity: 0.6;
}

.session-scroll-area {
  flex: 1;
  overflow-y: auto;
}

.session-card {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.1s;
  border-left: 3px solid transparent;
}

.session-card:hover {
  background: #f0f0f0;
}

.session-card.active {
  background: #fff;
  border-left-color: #6e55ff;
}

.session-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #eee;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.active .session-avatar {
  background: #6e55ff;
  color: #fff;
}

.session-detail {
  flex: 1;
  min-width: 0;
}

.session-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
}

.name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.time {
  font-size: 10px;
  color: #bbb;
}

.session-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview {
  font-size: 12px;
  color: #999;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-dot {
  width: 6px;
  height: 6px;
  background: #ff4d4f;
  border-radius: 50%;
}

/* 聊天窗口 - 沉浸式 */
.chat-viewport {
  flex: 1;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.chat-header {
  height: 48px;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.avatar-sm {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #f0f0f0;
  color: #6e55ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.current-name {
  font-size: 13px;
  font-weight: 600;
  margin-left: 8px;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fcfcfc;
}

.message-group {
  display: flex;
  max-width: 85%;
}

.message-group.sent { align-self: flex-end; }
.message-group.received { align-self: flex-start; }

.message-bubble {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.sent .message-bubble {
  background: #6e55ff;
  color: #fff;
  border-bottom-right-radius: 2px;
}

.received .message-bubble {
  background: #fff;
  color: #333;
  border: 1px solid #eee;
  border-bottom-left-radius: 2px;
}

.message-meta {
  font-size: 9px;
  margin-top: 4px;
  opacity: 0.6;
  text-align: right;
}

.image-content img {
  max-width: 240px;
  border-radius: 4px;
}

/* 极简输入框 */
.input-panel {
  padding: 8px 16px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
}

.input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

textarea {
  flex: 1;
  height: 32px;
  min-height: 32px;
  max-height: 80px;
  background: #f5f5f5;
  border: none;
  border-radius: 16px;
  padding: 6px 12px;
  font-size: 13px;
  outline: none;
  resize: none;
  transition: all 0.2s;
  line-height: 20px;
}

textarea:focus {
  background: #fff;
  box-shadow: 0 0 0 1px #6e55ff;
}

.send-btn {
  background: #6e55ff;
  color: #fff;
  border: none;
  border-radius: 16px;
  padding: 0 16px;
  height: 32px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background: #5a4abd;
  transform: translateY(-1px);
}

.send-btn:disabled {
  background: #eee;
  color: #ccc;
  cursor: not-allowed;
}

/* 其他辅助 */
.hero-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: #fff;
  padding: 40px;
}

.hero-illustration {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.8;
}

.hero-content h1 {
  font-size: 24px;
  color: #333;
  margin-bottom: 12px;
  font-weight: 600;
}

.hero-content p {
  color: #999;
  font-size: 14px;
  max-width: 280px;
  margin: 0 auto;
  line-height: 1.6;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #ddd;
  font-size: 12px;
}

.smart-notice {
  position: fixed;
  top: 60px;
  right: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  padding: 12px;
  border-left: 3px solid #6e55ff;
  width: 240px;
  z-index: 100;
}

.notice-info h4 { margin: 0; font-size: 13px; }
.notice-info p { margin: 4px 0 8px; font-size: 12px; color: #666; }
.notice-foot { display: flex; justify-content: flex-end; gap: 8px; }
.notice-foot button { font-size: 11px; padding: 2px 8px; border-radius: 4px; border: none; cursor: pointer; }
.btn-primary { background: #6e55ff; color: #fff; }

::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: #eee; border-radius: 2px; }
</style>

