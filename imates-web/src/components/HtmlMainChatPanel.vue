<template>
  <div class="chat-panel-container">
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
              :toolbar-tools="toolbarToolNames"
              @open-teacher-dialog="handleOpenTeacherDialog"
              @switch-to-teacher="handleSwitchToTeacher"
              @screenshot-click="handleScreenshotClick"
              @request-screenshot="handleRequestScreenshot"
              @new-session-click="handleNewChatClick"
              @open-html-preview="handleOpenHtmlPreview"
            />
            <!-- 老师聊天内容区域 -->
            <ChatView
              v-else-if="
                activeCategory === 'teacher' && teacherChatStore.currentSession?.sessionId
              "
              type="teacher"
              :compressed-height="339"
              :sessionId="teacherChatStore.currentSession.sessionId"
              :key="teacherChatStore.currentSession.sessionId"
              @open-html-preview="handleOpenHtmlPreview"
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
            @session-selected="handleSessionSelected"
            @create-new-chat="handleCreateNewChatFromTree"
            @ai-session-deleted="handleAiSessionDeleted"
            @teacher-session-deleted="handleTeacherSessionDeleted"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { CHAT_TAB_OPTIONS } from '../constants/options'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { showMessage } from '../utils'
import SessionTree from './SessionTree.vue'
import ChatView from './ChatView.vue'
import type { ChatBubble } from '../types'
import type { BuiltinToolType } from '../types/toolbarTools'
import { useScreenSnapshot } from '@/composables/useScreenSnapshot'

const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherChatStore()
const router = useRouter()

const emit = defineEmits<{
  close: []
  'open-html-preview': [url: string] // HTML 预览点击事件，向上传递
}>()

// 引用
const sessionTreeRef = ref<InstanceType<typeof SessionTree> | null>(null)
const aiGeneralChatViewRef = ref<InstanceType<typeof ChatView> | null>(null)

// 截图工具
const { captureScreenSnapshot } = useScreenSnapshot()

// 工具栏工具配置
const toolbarToolNames: BuiltinToolType[] = ['screenshot', 'formula', 'ask-teacher', 'new-session']

// Tab 状态
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

// Tab 选项
const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>

// 当前激活的分类（AI 或 老师）
const activeCategory = ref<'ai-general' | 'teacher'>('ai-general')

// 是否为开发模式
const isDev = computed(() => import.meta.env.DEV)

// 同步逻辑：当需要切换到老师分类时，若还没有当前老师会话，则默认选中第一个老师会话
const ensureTeacherSessionSelected = () => {
  console.log('[EmbeddedMainChatPanel] ensureTeacherSessionSelected 被调用')
  if (teacherChatStore.currentSession?.sessionId) {
    console.log('[EmbeddedMainChatPanel] 已有当前教师会话，跳过选择:', teacherChatStore.currentSession.sessionId)
    return
  }
  const allSessions = Object.values(teacherChatStore.loadAllSessions())
  console.log('[EmbeddedMainChatPanel] 获取所有教师会话:', allSessions?.length || 0, '个会话')
  if (!allSessions || allSessions.length === 0) {
    console.log('[EmbeddedMainChatPanel] 无可用教师会话')
    return
  }
  const firstSession = allSessions[0]
  console.log('[EmbeddedMainChatPanel] 选择第一个教师会话:', firstSession.sessionId)
  teacherChatStore.setSession(firstSession)
}

// 处理会话切换（用户在 SessionTree 点击）
const handleSessionSelected = async (type: 'ai' | 'teacher', sessionId: string) => {
  console.log('[EmbeddedMainChatPanel] handleSessionSelected 被调用:', {
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

// 处理新增对话
const handleNewChatClick = async () => {
  const selectedCategory = sessionTreeRef.value?.getSelectedCategory()

  if (selectedCategory === 'BIOLOGY' || selectedCategory === 'MATH') {
    const availableTeachers = teacherChatStore.getAvailableTeachers()

    if (availableTeachers.length === 0) {
      showMessage('所有老师都有对话记录', 'info')
      return
    }

    return
  }

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
    sessionTreeRef.value?.highlightSession?.(sessionId)
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
    sessionTreeRef.value?.highlightSession?.(forwardData.sessionId)
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

// 处理截图点击
const handleScreenshotClick = async () => {
  try {
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) return

    if (activeCategory.value === 'ai-general') {
      const imageInfo = {
        filePath: '',
        width: width || 0,
        height: height || 0,
        fileSize: Math.round(dataUrl.length * 0.75),
        base64DataUrl: dataUrl,
      }
      await aiGeneralChatViewRef.value?.onImageSelected?.(imageInfo)
    }
  } catch (error) {
    console.error('截图失败:', error)
    showMessage('截图失败', 'error')
  }
}

// 处理 HTML 预览点击 - 向上传递到父组件
const handleOpenHtmlPreview = (url: string) => {
  if (!url) return
  emit('open-html-preview', url)
}

// 处理 ChatView 的截图请求
const handleRequestScreenshot = async (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => {
  console.log('[EmbeddedMainChatPanel] 处理截图请求:', payload)

  if (payload?.kind !== 'screen_snapshot') return

  try {
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) return

    if (activeCategory.value === 'ai-general') {
      const imageInfo = {
        filePath: '',
        width: width || 0,
        height: height || 0,
        fileSize: Math.round(dataUrl.length * 0.75),
        base64DataUrl: dataUrl,
      }
      await aiGeneralChatViewRef.value?.onImageSelected?.(imageInfo)
    }
  } catch (error) {
    console.error('[EmbeddedMainChatPanel] 截图失败:', error)
  }
}

onMounted(async () => {
  console.log('[EmbeddedMainChatPanel] onMounted: 初始化')
})

defineExpose({
  attachImageToAiGeneral: async (imageInfo: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }) => {
    activeTab.value = 'ai-chat'
    activeCategory.value = 'ai-general'
    await nextTick()
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
.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #e8e9ff;
  overflow: hidden;
}

/* 聊天面板头部 */
.chat-panel-header {
  background: #e8e9ff;
  padding-top: 10px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  position: relative;
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548;
  z-index: 1;
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

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  max-width: 100%;
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
