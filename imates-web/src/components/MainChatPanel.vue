<template>
  <Teleport to="body">
    <!-- 全屏遮罩：点击遮罩空白区域时关闭面板 -->
    <div 
      v-show="!props.screenshotFlowVisible" 
      class="main-chat-overlay" 
      @click.self="emit('close')"
      @pointermove="handleResize"
      @pointerup="stopResize"
      @pointercancel="stopResize"
      @mousemove="handleResizeMouse"
      @mouseup="stopResizeMouse"
      @touchmove="handleResizeTouch"
      @touchend="stopResizeTouch"
      @touchcancel="stopResizeTouch"
    >
      <div
        class="main-chat-panel"
        :class="{ resizing: isResizing }"
        @click.stop
        :style="{ width: panelWidth + 'px' }"
      >
        <!-- 拖拽手柄 -->
        <div 
          class="resize-handle"
          @pointerdown="startResize"
          @mousedown.prevent="startResizeMouse"
          @touchstart.prevent="startResizeTouch"
          :class="{ 'resizing': isResizing }"
        ></div>
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
            <img :src="switcherIcon" alt="switch mode" class="toggle-mode-icon" />
          </button>
          <!-- WebSocket连接状态 -->
          <div v-if="isDev" class="connection-status" @click="logWebSocketStatus">
            <div
              :class="['status-indicator', {
                'status-connected': teacherChatStore.webSocketInitialized,
                'status-disconnected': !teacherChatStore.webSocketInitialized
              }]"
              :title="teacherChatStore.webSocketInitialized ? 'WebSocket已初始化' : 'WebSocket未初始化'"
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
                  ref="aiGeneralChatViewRef"
                  type="ai-general"
                  :compressed-height="339"
                  @open-teacher-dialog="handleOpenTeacherDialog"
                  @switch-to-teacher="handleSwitchToTeacher"
                  @request-screenshot="(payload) => emit('request-screenshot', payload)"
                >
                  <template #header-prefix>
                      <button type="button" class="pdf-toolbar-btn" @click="handleOpenScreenCapture">
                        <img :src="screenshotIcon" alt="截图" class="pdf-toolbar-icon" />
                      </button>
                  </template>
                  <!-- 新增会话按钮 -->
                  <template #header-right v-if="activeCategory === 'ai-general'">
                    <div class="header-right-actions">
                      <div @click="handleNewChatClick" class="add-session-btn">
                        <img :src="addSessionIcon" class="add-session-icon" alt="新增会话" />
                      </div>
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
                >
                  <!-- 教师场景不显示新增会话按钮 -->
                </ChatView>
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
                @session-selected="handleSessionSelected"
                @create-new-chat="handleCreateNewChatFromTree"
                @ai-session-deleted="handleAiSessionDeleted"
                @teacher-session-deleted="handleTeacherSessionDeleted"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { CHAT_TAB_OPTIONS } from '../constants/options'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { showMessage } from '../utils'
import { getUserId } from '@/services'
import SessionTree from './SessionTree.vue'
import ChatView from './ChatView.vue'
import addSessionIcon from '/icons/addsession.png'
import switcherIcon from '/icons/Switcher.svg'
import type { ChatBubble } from '@/types'
import type { ChatEntry } from '../types/chat'

const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherChatStore()

import screenshotIcon from '/icons/selectAndAsk.svg'

interface Props {
  entry?: ChatEntry
  screenshotFlowVisible?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  'toggle-mode': []
  'request-screenshot': [payload: { kind: 'screen_snapshot' | 'pdf_page' }]
}>()

// 引用
const sessionTreeRef = ref<InstanceType<typeof SessionTree> | null>(null)
const aiGeneralChatViewRef = ref<InstanceType<typeof ChatView> | null>(null)

// 老师选择相关状态（与 UnifiedChatDialog 逻辑保持一致）
const availableTeachers = ref<any[]>([])
const showTeacherSelectDialog = ref(false)

// Tab 状态
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

// Tab 选项
const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>

// 当前激活的分类（AI 或 老师）
const activeCategory = ref<'ai-general' | 'teacher'>('ai-general')

const entry = computed(() => props.entry)

// 是否为开发模式
const isDev = computed(() => import.meta.env.DEV)

// 拖拽调整宽度相关状态
const panelWidth = ref(460) // 初始宽度（像素）
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)
const resizingPointerId = ref<number | null>(null)

const rafId = ref<number | null>(null)
const pendingWidth = ref<number | null>(null)

const clampWidth = (w: number) => Math.max(300, Math.min(800, w))

const scheduleWidthUpdate = (nextWidth: number) => {
  pendingWidth.value = clampWidth(nextWidth)
  if (rafId.value !== null) return

  rafId.value = window.requestAnimationFrame(() => {
    rafId.value = null
    if (pendingWidth.value === null) return
    panelWidth.value = pendingWidth.value
    pendingWidth.value = null
  })
}

const startResizeMouse = (e: MouseEvent) => {
  // 避免右键等触发
  if (e.button !== 0) return

  isResizing.value = true
  resizingPointerId.value = null
  startX.value = e.clientX
  startWidth.value = panelWidth.value

  console.log('[MainChatPanel][Resize] mousedown start', {
    startX: startX.value,
    startWidth: startWidth.value,
  })

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

// 触摸事件开始
const startResizeTouch = (e: TouchEvent) => {
  if (!e.touches || e.touches.length === 0) return
  
  isResizing.value = true
  resizingPointerId.value = null
  startX.value = e.touches[0].clientX
  startWidth.value = panelWidth.value

  console.log('[MainChatPanel][Resize] touchstart start', {
    startX: startX.value,
    startWidth: startWidth.value,
    touchCount: e.touches.length,
  })
  
  // 防止页面滚动
  e.preventDefault()
}

// 拖拽开始
const startResize = (e: PointerEvent) => {
  // 只响应主按键（鼠标左键），触摸/触控板会忽略 button 限制
  if (e.pointerType === 'mouse' && e.button !== 0) return

  isResizing.value = true
  resizingPointerId.value = e.pointerId
  startX.value = e.clientX
  startWidth.value = panelWidth.value

  console.log('[MainChatPanel][Resize] pointerdown start', {
    pointerType: e.pointerType,
    pointerId: e.pointerId,
    startX: startX.value,
    startWidth: startWidth.value,
  })

  // 捕获指针，避免拖拽过程中指针移出手柄后事件丢失（部分 WebView/触摸场景会出现）
  try {
    ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  } catch {
    // ignore
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

// 拖拽中
const handleResize = (e: PointerEvent) => {
  if (!isResizing.value) return
  if (resizingPointerId.value !== null && e.pointerId !== resizingPointerId.value) return
  
  const deltaX = startX.value - e.clientX // 向左拖动为正值，增加宽度
  const newWidth = startWidth.value + deltaX
  scheduleWidthUpdate(newWidth)
}

const handleResizeMouse = (e: MouseEvent) => {
  if (!isResizing.value) return
  const deltaX = startX.value - e.clientX // 向左拖动为正值，增加宽度
  const newWidth = startWidth.value + deltaX
  scheduleWidthUpdate(newWidth)
}

// 触摸拖拽中
const handleResizeTouch = (e: TouchEvent) => {
  if (!isResizing.value || !e.touches || e.touches.length === 0) return
  
  const deltaX = startX.value - e.touches[0].clientX // 向左拖动为正值，增加宽度
  const newWidth = startWidth.value + deltaX
  scheduleWidthUpdate(newWidth)
  
  // 防止页面滚动
  e.preventDefault()
}

// 拖拽结束
const stopResize = (e?: PointerEvent) => {
  if (e && resizingPointerId.value !== null && e.pointerId !== resizingPointerId.value) return

  isResizing.value = false
  resizingPointerId.value = null

  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  if (rafId.value !== null) {
    window.cancelAnimationFrame(rafId.value)
    rafId.value = null
  }

  if (pendingWidth.value !== null) {
    panelWidth.value = pendingWidth.value
    pendingWidth.value = null
  }
  
}

const stopResizeMouse = () => {
  isResizing.value = false

  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  if (rafId.value !== null) {
    window.cancelAnimationFrame(rafId.value)
    rafId.value = null
  }

  if (pendingWidth.value !== null) {
    panelWidth.value = pendingWidth.value
    pendingWidth.value = null
  }
}

// 触摸拖拽结束
const stopResizeTouch = () => {
  isResizing.value = false

  if (rafId.value !== null) {
    window.cancelAnimationFrame(rafId.value)
    rafId.value = null
  }

  if (pendingWidth.value !== null) {
    panelWidth.value = pendingWidth.value
    pendingWidth.value = null
  }
}

// 组件卸载时清理事件监听
onBeforeUnmount(() => {
  if (rafId.value !== null) {
    window.cancelAnimationFrame(rafId.value)
    rafId.value = null
  }
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})


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

// 处理会话切换（用户在 SessionTree 点击）
const handleSessionSelected = async (type: 'ai' | 'teacher', sessionId: string) => {
  console.log('[MainChatPanel] handleSessionSelected 被调用:', {
    type,
    sessionId,
    currentActiveCategory: activeCategory.value,
  })

  activeTab.value = 'ai-chat'
  activeCategory.value = type === 'ai' ? 'ai-general' : 'teacher'

  if (type === 'ai') {
    await aiGeneralStore.loadSessions()
    await aiGeneralStore.switchSession(sessionId)
  } else {
    await teacherChatStore.activateTeacherSession(sessionId)
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

  if (selectedCategory === 'BIOLOGY' || selectedCategory === 'MATH') {
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

const handleCreateNewChatFromTree = async () => {
  activeTab.value = 'ai-chat'
  activeCategory.value = 'ai-general'

  if (!aiGeneralStore.canCreateSession) {
    if (!aiGeneralStore.isCreatingSession) {
      showMessage('请先在当前会话中发送消息', 'warning')
    }
    return
  }

  aiGeneralStore.resetState()
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

// 设置当前教师会话
const setTeacherSession = (sessionId: string) => {
  const allSessions = Object.values(teacherChatStore.loadAllSessions())
  const session = allSessions.find((s) => s.sessionId === sessionId)
  if (session) {
    teacherChatStore.setSession(session)
    const userId = getUserId()
    const storeSubject = session.subject
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
    // 通知 SessionTree 更新选中状态
    sessionTreeRef.value?.highlightSession?.(sessionId)
    // setTeacherSession已经设置了具体会话，这里不再需要ensureTeacherSessionSelected
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
    // 通知 SessionTree 更新选中状态
    sessionTreeRef.value?.highlightSession?.(forwardData.sessionId)
    // setTeacherSession已经设置了具体会话，这里不再需要ensureTeacherSessionSelected
  } catch (error) {
    console.error('设置老师会话失败:', error)
    showMessage('设置老师会话失败', 'error')
  }
}

// WebSocket状态相关函数
const logWebSocketStatus = () => {
  console.log('=== WebSocket 连接状态检查 ===')
  console.log('教师聊天WebSocket状态:', {
    initialized: teacherChatStore.webSocketInitialized,
    hasCurrentSession: !!teacherChatStore.currentSession
  })
}

// 启动WebSocket状态监控
// startMonitoring() // 不再需要 useWebSocketStatusMonitor

// 组件挂载时的初始化
onMounted(async () => {
  console.log('[MainChatPanel] onMounted: 初始化写死教师会话')
  // 写死会话通过 loadAllSessions() 方法动态获取，无需预加载
})

const applyEntry = async (nextEntry?: ChatEntry) => {
  if (!nextEntry) return

  activeTab.value = 'ai-chat'
  activeCategory.value = nextEntry.category
  await nextTick()

  if (nextEntry.mode === 'default') {
    if (nextEntry.category === 'ai-general') {
      await aiGeneralStore.loadSessions()
      const targetSessionId =
        aiGeneralStore.currentSession?.sessionId ?? aiGeneralStore.sessions[0]?.sessionId
      if (targetSessionId) {
        if (aiGeneralStore.currentSession?.sessionId !== targetSessionId) {
          await aiGeneralStore.switchSession(targetSessionId)
        }
        sessionTreeRef.value?.highlightSession?.(targetSessionId)
      }
    } else {
      const allTeacherSessions = Object.values(teacherChatStore.loadAllSessions())
      const targetSessionId = teacherChatStore.currentSession?.sessionId ?? allTeacherSessions[0]?.sessionId
      if (targetSessionId) {
        if (teacherChatStore.currentSession?.sessionId !== targetSessionId) {
          await teacherChatStore.activateTeacherSession(targetSessionId)
        }
        sessionTreeRef.value?.highlightSession?.(targetSessionId)
      }
    }
    return
  }

  if (nextEntry.mode === 'new') {
    if (nextEntry.category === 'ai-general') {
      aiGeneralStore.resetState()
    } else {
      ensureTeacherSessionSelected()
    }
    return
  }

  if (nextEntry.mode === 'session') {
    if (nextEntry.category === 'ai-general') {
      await aiGeneralStore.loadSessions()
      await aiGeneralStore.switchSession(nextEntry.sessionId)
      sessionTreeRef.value?.highlightSession?.(nextEntry.sessionId)
    } else {
      await teacherChatStore.activateTeacherSession(nextEntry.sessionId)
      sessionTreeRef.value?.highlightSession?.(nextEntry.sessionId)
    }
  }
}

watch(
  () => props.entry,
  async (nextEntry) => {
    await applyEntry(nextEntry)
  },
  { immediate: true }
)

const handleOpenScreenCapture = () => {
  // 统一协议：交给 ChatView 决定截图入口 kind，并向上抛 request-screenshot
  ;(aiGeneralChatViewRef.value as any)?.requestScreenshot?.()
}

defineExpose({
  attachImageToAiGeneral: async (imageInfo: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }) => {
    // 强制切到 AI 问答 / AI 学伴
    activeTab.value = 'ai-chat'
    activeCategory.value = 'ai-general'
    await nextTick()

    // 挂到输入框预览区（ai-general 场景下 onImageSelected 不会立即发送）
    await aiGeneralChatViewRef.value?.onImageSelected?.(imageInfo)
  },

  attachImageToAiGeneralDirect: async (imageInfo: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }) => {
    activeTab.value = 'ai-chat'
    activeCategory.value = 'ai-general'
    await nextTick()

    await aiGeneralChatViewRef.value?.attachImageDirectToPreview?.(imageInfo)
  },
})
</script>

<style scoped>
.main-chat-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-main-chat-overlay);
  /* 如需半透明遮罩可打开下一行 */
  /* background: rgba(0, 0, 0, 0.1); */
}

.main-chat-panel {
  position: absolute;
  right: 0;
  top: 0;
  height: 100vh;
  width: 460px; /* 默认宽度，会被动态覆盖 */
  background-color: #ffffff;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  transition: width 0.1s ease-out; /* 非拖拽时保留平滑过渡 */
  /* 为绝对定位的形态切换按钮提供定位上下文 */
  overflow: visible;
}

/* 在主面板上绘制 seekbar 效果 */
.main-chat-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 10px;
  height: 100%;
  pointer-events: none;
  transform: translateX(-5px);
  background-image: url('/icons/seekbar.svg');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: contain;
  opacity: 0.6;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.main-chat-panel:hover::before {
  opacity: 1;
  transform: translateX(-5px) scale(1.1);
}

.main-chat-panel.resizing::before {
  opacity: 1;
  transform: translateX(-5px) scale(1.2);
}

.main-chat-panel.resizing {
  transition: none;
}

.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 12px;
  background: transparent;
  cursor: col-resize;
  z-index: 10;
  touch-action: none;
  pointer-events: auto;
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

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pdf-toolbar-btn {
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.pdf-toolbar-icon {
  display: block;
  height: 32px;
  object-fit: contain;
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
  z-index: var(--z-main-chat-toggle);
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
  background-color: #e8e9ff;
}

.empty-text {
  margin-top: 12px;
  font-size: 13px;
  color: #999999;
}
</style>
