<template>
  <div class="chat-panel-container">
    <!-- 背景层 -->
    <div class="panel-bg"></div>

    <div class="panel-main">
      <!-- 探索遮罩（在选择探索/截图工具时显示） -->
      <div v-if="isExploring" class="explore-overlay" @click.stop>
        <img :src="textbookipIcon" alt="textbookip" class="explore-icon textbookip" />
        <img :src="ipWordIcon" alt="ipWord" class="explore-icon ipWord" />
      </div>
      <!-- 遮罩层上的按钮（独立于遮罩层，使用 Teleport 挂载到 body 以确保 fixed 定位正确） -->
      <Teleport to="body">
        <button
          v-if="isExploring && overlayButtonReady"
          type="button"
          class="pdf-toolbar-btn explore-icon pdf-toolbar-icon-overlay"
          :class="{ 'explore-icon-large': hasAttachedScreenshots }"
          :style="overlayButtonStyle"
          @click.stop="handleExploreClick"
        >
          <img :src="selectAndAskIconToUse" alt="选中并问" style="width: 100%; height: 100%" />
        </button>
      </Teleport>

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
          v-if="props.showCloseButton"
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
                @screenshot-click="handleScreenshotClickAction"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { CHAT_TAB_OPTIONS } from '@/constants/options'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useDraftStore } from '@/stores/draftStore'
import { showMessage } from '@/utils'
import SessionTree from '@/components/chat/session/SessionTree.vue'
import ChatView from '@/components/chat/ChatView.vue'
import type { ChatBubble } from '@/types'
import type { BuiltinToolType } from '@/types/toolbarTools'
import { useScreenSnapshot } from '@/composables/useScreenSnapshot'
import selectAndAskIcon from '/icons/selectAndAsk.svg'
import selectAndAskIconSelected from '/icons/selectAndAsk_select.svg'
import textbookipIcon from '/icons/textbookip.png'
import ipWordIcon from '/icons/ipWord.svg'

const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherChatStore()
const draftStore = useDraftStore()
const router = useRouter()

const props = withDefaults(defineProps<{
  showCloseButton?: boolean
  // 是否处于探索/截图模式（由外部驱动）
  isExploring?: boolean
  // 是否正在截图中（框选模式）
  isCapturing?: boolean
}>(), {
  showCloseButton: true,
  isExploring: false,
})

const emit = defineEmits<{
  close: []
  'open-html-preview': [payload: { url: string; html?: string; sessionId?: string | null }] // HTML 预览点击事件，向上传递
  'screenshot-click': [active: boolean]
  'request-screenshot': [payload: { kind: 'screen_snapshot' | 'pdf_page' }]
}>()

// 引用
const sessionTreeRef = ref<InstanceType<typeof SessionTree> | null>(null)
const aiGeneralChatViewRef = ref<InstanceType<typeof ChatView> | null>(null)

// 截图工具
const { captureScreenSnapshot } = useScreenSnapshot()

// Tab 状态
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

// Tab 选项
const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>

// 当前激活的分类（AI 或 老师）
const activeCategory = ref<'ai-general' | 'teacher'>('ai-general')

// 是否为开发模式
const isDev = computed(() => import.meta.env.DEV)

// 移除对 pdfViewerStore 的依赖，改用 props.isExploring 或 props.isCapturing
const isExploring = computed(() => {
  return (props.isExploring || props.isCapturing) && activeTab.value === 'ai-chat'
})

// 工具栏工具配置 - 注入激活状态以同步底层按钮样式
const toolbarToolNames = computed(() => {
  return [
    { type: 'select-and-ask' as BuiltinToolType, isActive: isExploring.value },
    { type: 'formula' as BuiltinToolType },
    { type: 'ask-teacher' as BuiltinToolType },
    { type: 'new-session' as BuiltinToolType },
  ]
})

// 计算当前使用的"选中并问"图标
const selectAndAskIconToUse = computed(() =>
  isExploring.value ? selectAndAskIconSelected : selectAndAskIcon
)

// 计算是否有附加截图，用于动态调整按钮尺寸
const hasAttachedScreenshots = computed(() => {
  return (aiGeneralStore.inputAttachedScreenshots?.length ?? 0) > 0
})

const attachedScreenshotCount = computed(
  () => aiGeneralStore.inputAttachedScreenshots?.length ?? 0
)

// 遮罩层按钮位置样式
const overlayButtonStyle = ref<Record<string, string>>({
  position: 'fixed', // 使用 fixed 定位相对于视口
  left: '24px',
  top: '16px',
  width: '32px',
  height: '32px',
  zIndex: '35',
})

const overlayButtonReady = ref(false)

// 计算并更新遮罩层按钮位置，确保覆盖实际按钮
const updateOverlayButtonPosition = async () => {
  overlayButtonReady.value = false
  await nextTick()

  try {
    // 获取实际按钮元素（使用 .toolbar-btn 匹配 ChatInput 中的按钮类名）
    const actualButton = document.querySelector(
      '.chat-content-container .tab-content .toolbar-btn'
    ) as HTMLElement
    if (!actualButton) {
      console.warn('[DraftNoteChatPanel] 找不到实际按钮元素')
      return
    }

    // 获取按钮相对于视口的位置
    const buttonRect = actualButton.getBoundingClientRect()

    // 更新遮罩层按钮样式 - 使用视口固定定位，大小与实际按钮一致
    overlayButtonStyle.value = {
      position: 'fixed' as const,
      left: `${buttonRect.left}px`,
      top: `${buttonRect.top}px`,
      width: `${buttonRect.width}px`,
      height: `${buttonRect.height}px`,
      zIndex: '35',
    }

    overlayButtonReady.value = true
  } catch (error) {
    console.error('[DraftNoteChatPanel] 计算按钮位置失败:', error)
  }
}

// 监听相关状态变化，更新遮罩层按钮位置
watch(
  [isExploring, activeTab, attachedScreenshotCount],
  async (newValues) => {
    const [exploring, tab] = newValues
    if (exploring && tab === 'ai-chat') {
      // 延迟执行，确保DOM已更新
      setTimeout(updateOverlayButtonPosition, 100)
    } else {
      overlayButtonReady.value = false
    }
  },
  { immediate: false }
)

// 处理探索/截图点击（统一处理：遮罩层按钮和 ChatView 截图按钮）
const handleExploreClick = () => {
  // 逻辑变更：如果当前正在截图/捕获，点击遮罩按钮应视为取消/关闭
  if (props.isCapturing) {
    emit('screenshot-click', false)
  } else {
    const targetState = !props.isExploring
    emit('screenshot-click', targetState)
  }
}

// 处理截图按钮点击 - 通过 ChatView 的 screenshot-click 触发
const handleScreenshotClickAction = async () => {
  try {
    // 逻辑变更：不再使用 screen_snapshot (captureScreenSnapshot)，而是从外部 DrawingBoardNew 获取数据
    emit('request-screenshot', { kind: 'screen_snapshot' })
  } catch (error) {
    console.error('截图请求失败:', error)
  }
}

const handleRequestScreenshot = (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => {
  emit('request-screenshot', payload)
}

onMounted(async () => {
  console.log('[DraftNoteChatPanel] onMounted: 初始化')
  // 初始计算按钮位置
  setTimeout(updateOverlayButtonPosition, 200)
  window.addEventListener('resize', updateOverlayButtonPosition)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateOverlayButtonPosition)
})

// 同步逻辑：当需要切换到老师分类时，若还没有当前老师会话，则默认选中第一个老师会话
const ensureTeacherSessionSelected = () => {
  if (teacherChatStore.currentSession?.sessionId) {
    return
  }
  const allSessions = Object.values(teacherChatStore.loadAllSessions())
  if (!allSessions || allSessions.length === 0) {
    return
  }
  const firstSession = allSessions[0]
  teacherChatStore.setSession(firstSession)
}

// 处理会话切换（用户在 SessionTree 点击）
const handleSessionSelected = async (type: 'ai' | 'teacher', sessionId: string) => {
  activeTab.value = 'ai-chat'
  activeCategory.value = type === 'ai' ? 'ai-general' : 'teacher'

  if (type === 'ai') {
    await aiGeneralStore.loadSessions()
    await aiGeneralStore.switchSession(sessionId)
  } else {
    await teacherChatStore.activateTeacherSession(sessionId)
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

// 处理 HTML 预览点击 - 向上传递到父组件
const handleOpenHtmlPreview = (payload: { url: string; html?: string }) => {
  if (!payload || !payload.url) return
  emit('open-html-preview', payload)
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
  const session = allSessions.find((s: any) => s.sessionId === sessionId)
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
  position: relative;
  overflow: hidden;
}

/* 背景层 */
.panel-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, #0a0020 50%, #ffffff 50%);
  z-index: -1;
  opacity: 1;
}

/* 主内容层 (背景层的下一层) */
.panel-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 20px 0 0 20px;
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
  border-top-left-radius: 20px;
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548;
  z-index: 2222;
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

/* 探索遮罩层：浅紫色半透明覆盖整个面板，禁止背后的元素交互 */
.explore-overlay {
  position: absolute;
  inset: 0;
  background: rgba(230, 225, 255, 0.75); /* 淡紫色遮罩，可根据需要微调透明度 */
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed; /* 显示禁用光标 */
  border-radius: 16px;
}

.explore-icon {
  position: absolute;
  width: 120px;
  height: auto;
  pointer-events: none;
  user-select: none;
}

.explore-icon.textbookip {
  right: -60px;
  bottom: 30%;
}

.explore-icon.ipWord {
  right: 13%;
  bottom: 41%;
  width: 225px;
  height: auto;
}

/* 遮罩层按钮样式：位置由JavaScript动态计算和设置 */
.explore-icon.pdf-toolbar-icon-overlay {
  position: fixed;
  z-index: 35;
  pointer-events: auto;
  cursor: pointer;
  /* 基础样式，具体位置由:style动态设置 */
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

/* PDF 对话面板顶部工具按钮：截图 */
.pdf-toolbar-btn {
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
}

/* 当有附加截图时，按钮更大 (仅控制大小，不参与定位) */
.explore-icon-large {
  /* 可以根据需要在此添加大小调整逻辑 */
}
</style>
