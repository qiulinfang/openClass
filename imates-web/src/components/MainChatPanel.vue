<template>
  <!-- 全屏遮罩：点击遮罩空白区域时关闭面板 -->
  <div class="main-chat-overlay" @click.self="emit('close')">
    <div class="main-chat-panel" @click.stop>
      <!-- 头部：Tab + 关闭按钮 -->
      <div class="chat-panel-header">
        <!-- Tab -->
        <div class="chat-tabs">
          <div class="tab-list">
            <div
              v-for="tab in tabOptions"
              :key="tab.value"
              :class="['tab-item', { 'tab-active': activeTab === tab.value }]"
              @click="activeTab = tab.value"
            >
              <span>
                {{
                  tab.value === 'ai-chat'
                    ? activeCategory === 'teacher'
                      ? '老师答疑'
                      : 'AI问答'
                    : tab.label
                }}
              </span>
            </div>
          </div>
        </div>
        <!-- 形态切换按钮：panel <-> dialog -->
        <button type="button" class="toggle-mode-button" @click="emit('toggle-mode')">
          <img src="icons/Switcher.svg" alt="switch mode" class="toggle-mode-icon" />
        </button>
        <!-- WebSocket连接状态 -->
        <div v-if="isDev" class="connection-status" @click="logWebSocketStatus">
          <div
            :class="['status-indicator', {
              'status-connected': wsStatus.teacher?.isConnected,
              'status-disconnected': !wsStatus.teacher?.isConnected
            }]"
            :title="wsStatus.teacher ? `WebSocket: ${wsStatus.teacher.readyStateText}` : 'WebSocket未初始化'"
          ></div>
        </div>
        <!-- 关闭按钮 -->
        <q-btn
          flat
          round
          dense
          icon="close"
          size="md"
          @click="emit('close')"
          class="close-button"
        />
      </div>

      <!-- Tab 内容区域 -->
      <div class="chat-content-container">
        <!-- AI 问答 Tab：仅展示聊天内容区域 -->
        <div v-show="activeTab === 'ai-chat'" class="tab-content">
          <div class="main-chat-body">
            <!-- 右侧聊天内容区域 -->
            <div class="right-panel">
              <!-- AI 问答 -->
              <ChatView
                v-if="activeCategory === 'ai-general'"
                type="ai-general"
                :compressed-height="339"
                @open-teacher-dialog="handleOpenTeacherDialog"
                @switch-to-teacher="handleSwitchToTeacher"
              >
                <!-- 新增会话按钮 -->
                <template #header-right>
                  <div @click="handleNewChatClick" class="add-session-btn">
                    <img :src="addSessionIcon" class="add-session-icon" alt="新增会话" />
                  </div>
                </template>
              </ChatView>
              <!-- 老师聊天内容区域 -->
              <ChatView
                v-else-if="
                  activeCategory === 'teacher' && teacherChatStore.currentSession?.sessionId
                "
                type="teacher"
                :compressed-height="339"
                :sessionId="teacherChatStore.currentSession.sessionId"
                :key="teacherChatStore.currentSession.sessionId"
              />
              <!-- 无会话 -->
              <div v-else class="empty-chat">
                <q-icon name="chat" size="48px" color="grey-4" />
                <div class="empty-text">请选择或创建一个会话</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 会话记录 Tab：仅展示会话列表 -->
        <div v-show="activeTab === 'question-record'" class="tab-content">
          <div class="session-list-wrapper">
            <SessionTree
              ref="sessionTreeRef"
              @session-switched="handleSessionSwitched"
              @ai-session-deleted="handleAiSessionDeleted"
              @teacher-session-deleted="handleTeacherSessionDeleted"
              @category-should-change="handleCategoryShouldChange"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { showMessage } from '../utils'
import { getUserId } from '@/services'
import { useWebSocketStatusMonitor } from '@/services/websocket/webSocketService'
import SessionTree from './SessionTree.vue'
import ChatView from './ChatView.vue'
import addSessionIcon from '/icons/addsession.png'
import type { ChatBubble } from '@/types'
const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherChatStore()

const emit = defineEmits<{
  close: []
  'toggle-mode': []
}>()

// 引用
const sessionTreeRef = ref<InstanceType<typeof SessionTree> | null>(null)

// 老师选择相关状态（与 UnifiedChatDialog 逻辑保持一致）
const availableTeachers = ref<any[]>([])
const showTeacherSelectDialog = ref(false)

// Tab 状态
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

// Tab 选项
const tabOptions = [
  { label: '会话记录', value: 'question-record', icon: 'quiz' },
  { label: 'AI问答', value: 'ai-chat', icon: 'chat' },
]

// 当前激活的分类（AI 或 老师）
const activeCategory = ref<'ai-general' | 'teacher'>('ai-general')

// 是否为开发模式
const isDev = computed(() => import.meta.env.DEV)

// WebSocket连接状态监控
const { status: wsStatus, startMonitoring } = useWebSocketStatusMonitor()

// 同步逻辑：当需要切换到老师分类时，若还没有当前老师会话，则默认选中第一个老师会话
const ensureTeacherSessionSelected = () => {
  console.log('[MainChatPanel] ensureTeacherSessionSelected 被调用')
  // 已经有当前老师会话则不干预
  if (teacherChatStore.currentSession?.sessionId) {
    console.log('[MainChatPanel] 已有当前教师会话，跳过选择:', teacherChatStore.currentSession.sessionId)
    return
  }
  const allSessions = Object.values(teacherChatStore.loadAllSessions())
  console.log('[MainChatPanel] 获取所有教师会话:', allSessions?.length || 0, '个会话')
  if (!allSessions || allSessions.length === 0) {
    console.log('[MainChatPanel] 无可用教师会话')
    return
  }
  const firstSession = allSessions[0]
  console.log('[MainChatPanel] 选择第一个教师会话:', firstSession.sessionId)
  teacherChatStore.setSession(firstSession)
}

// 处理会话切换（由 SessionTree 通知）
const handleSessionSwitched = (type: 'ai' | 'teacher', sessionId: string) => {
  console.log('[MainChatPanel] handleSessionSwitched 被调用:', { type, sessionId, currentActiveCategory: activeCategory.value })
  activeCategory.value = type === 'ai' ? 'ai-general' : 'teacher'
  console.log('[MainChatPanel] activeCategory 设置为:', activeCategory.value)
  if (type === 'teacher') {
    ensureTeacherSessionSelected()
  }
}

// AI 会话删除
const handleAiSessionDeleted = (
  sessionId: string,
  success: boolean,
  wasCurrentSession: boolean
) => {
  if (!success) return
  if (wasCurrentSession) {
    activeCategory.value = 'ai-general'
  }
}

// 处理新增对话（可以是AI对话或教师对话）
const handleNewChatClick = async () => {
  // 根据当前选中的节点类型来决定创建哪种类型的对话
  const selectedCategory = sessionTreeRef.value?.getSelectedCategory()

  if (selectedCategory === 'biology' || selectedCategory === 'math') {
    // 如果选中的是教师分类，显示老师选择对话框
    availableTeachers.value = teacherChatStore.getAvailableTeachers()

    if (availableTeachers.value.length === 0) {
      showMessage('所有老师都有对话记录', 'info')
      return
    }

    showTeacherSelectDialog.value = true
    return
  }

  // 默认创建AI对话
  if (!aiGeneralStore.canCreateSession) {
    if (!aiGeneralStore.isCreatingSession) {
      showMessage('请先在当前会话中发送消息', 'warning')
    }
    return
  }
  aiGeneralStore.resetState()
  activeCategory.value = 'ai-general'
}

// 老师会话删除
const handleTeacherSessionDeleted = (
  sessionId: string,
  success: boolean,
  wasCurrentSession: boolean
) => {
  if (!success) return
  if (wasCurrentSession) {
    activeCategory.value = 'ai-general'
  }
}

// 切换分类事件
const handleCategoryShouldChange = (category: 'ai-general' | 'teacher') => {
  console.log('[MainChatPanel] handleCategoryShouldChange 被调用:', { category, currentActiveCategory: activeCategory.value })

  if (category === 'teacher') {
    // 设置为教师分类（不管当前状态如何）
    activeCategory.value = 'teacher'
    console.log('[MainChatPanel] 设置为教师分类，开始选择教师会话')
    ensureTeacherSessionSelected()

    // 初始化教师消息轮询系统（每次切换到教师模式都要重新初始化）
    console.log('[MainChatPanel] 初始化教师消息轮询系统')
    teacherChatStore.initMessageReceiver().catch(error => {
      console.error('[MainChatPanel] 初始化教师消息轮询失败:', error)
    })
  } else {
    // 从教师模式切换到AI模式
    if (activeCategory.value === 'teacher') {
      activeCategory.value = 'ai-general'
      console.log('[MainChatPanel] 设置为AI分类')
    }
  }
}

// 设置当前教师会话
const setTeacherSession = (sessionId: string) => {
  const allSessions = Object.values(teacherChatStore.loadAllSessions())
  const session = allSessions.find((s) => s.sessionId === sessionId)
  if (session) {
    teacherChatStore.setSession(session)
    const userId = getUserId()
    const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
  }
}

// 从 AI 聊天转老师：打开指定老师会话
const handleOpenTeacherDialog = async ({
  sessionId,
}: {
  sessionId: string
  message?: ChatBubble
}) => {
  try {
    setTeacherSession(sessionId)
    activeCategory.value = 'teacher'
    ensureTeacherSessionSelected()
  } catch (error) {
    console.error('设置老师会话失败:', error)
    showMessage('设置老师会话失败', 'error')
  }
}

// 批量转发后切换到老师
const handleSwitchToTeacher = async (forwardData?: {
  messages?: ChatBubble[]
  currentQuestion?: unknown
  additionalMessage?: string
  forwardMode?: string
  successCount?: number
  sessionId?: string
}) => {
  if (!forwardData?.sessionId) return
  try {
    setTeacherSession(forwardData.sessionId)
    activeCategory.value = 'teacher'
    ensureTeacherSessionSelected()
  } catch (error) {
    console.error('设置老师会话失败:', error)
    showMessage('设置老师会话失败', 'error')
  }
}

// WebSocket状态相关函数
const logWebSocketStatus = () => {
  console.log('=== WebSocket 连接状态检查 ===')
  console.log('教师聊天WebSocket状态:', wsStatus.value.teacher)
  console.log('客服聊天WebSocket状态:', wsStatus.value.client)
}

// 启动WebSocket状态监控
startMonitoring()

// 组件挂载时的初始化
onMounted(async () => {
  console.log('[MainChatPanel] onMounted: 初始化写死教师会话')
  // 写死会话通过 loadAllSessions() 方法动态获取，无需预加载
})
</script>

<style scoped>
.main-chat-overlay {
  position: fixed;
  inset: 0;
  z-index: 11000;
  /* 如需半透明遮罩可打开下一行 */
  /* background: rgba(0, 0, 0, 0.1); */
}

.main-chat-panel {
  position: absolute;
  right: 0;
  top: 0;
  height: 100vh;
  width: 460px;
  background-color: #ffffff;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  /* 为绝对定位的形态切换按钮提供定位上下文 */
  overflow: visible;
}

.chat-panel-header {
  background: #e8e9ff;
  padding-top: 10px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  position: relative;
}

.connection-status {
  position: absolute;
  right: 60px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid #ccc;
}

.status-connected {
  background-color: #52c41a;
  border-color: #52c41a;
  box-shadow: 0 0 4px rgba(82, 196, 26, 0.4);
}

.status-disconnected {
  background-color: #ff4d4f;
  border-color: #ff4d4f;
  box-shadow: 0 0 4px rgba(255, 77, 79, 0.4);
}

/* Tab 列表 */
.tab-list {
  display: flex;
  gap: 2px;
}

/* 每个 Tab 项 */
.tab-item {
  position: relative;
  padding: 8px 18px;
  color: #a19cb6;
  text-decoration: none;
  font-size: 15px;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  width: 100px;
}

/* 激活的 Tab 项 */
.tab-active {
  background-image: url('/icons/sessionbackfround.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: center center;
  color: #504b64;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  height: 40px;
  line-height: 24px;
  width: 100px;
}

/* 激活 Tab 底部下划线 */
.tab-active::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 30%;
  height: 3px;
  background: #6e55ff;
  border-radius: 2px;
}

/* Tab hover */
.tab-item:hover:not(.tab-active) {
  opacity: 0.85;
  background: transparent;
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548;
  z-index: 1;
}

.toggle-mode-button {
  position: absolute;
  /* 紧贴 main-chat-panel 左上角外部边框 */
  top: 4px;
  left: -38px;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 12000;
  border-radius: 8px;
}

.toggle-mode-icon {
  width: 32px;
  height: 32px;
  display: block;
}

.chat-content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-content {
  flex: 1;
  height: 100%;
  display: flex;
  border-radius: 20px;
}

.session-list-wrapper {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.main-chat-body {
  flex: 1;
  display: flex;
  height: 100%;
  overflow: hidden;
}

.left-panel {
  width: 260px;
  border-right: 1px solid #e0e0e0;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  max-width: 100%;
}

.add-session-icon {
  width: 32px;
  height: 32px;
}

.empty-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 16px;
}

.empty-text {
  margin-top: 12px;
  font-size: 13px;
  color: #999999;
}
</style>
