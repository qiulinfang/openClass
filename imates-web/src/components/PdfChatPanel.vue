<template>
  <div class="chat-panel-container">
    <!-- 探索遮罩（在选择探索/截图工具时显示） -->
    <div v-if="isExploring" class="explore-overlay" @click.stop>
      <img :src="textbookipIcon" alt="textbookip" class="explore-icon textbookip" />
      <img :src="ipWordIcon" alt="ipWord" class="explore-icon ipWord" />
    </div>
    <!-- 遮罩层上的按钮（独立于遮罩层，避免被覆盖） -->
    <button
      v-if="isExploring && overlayButtonReady"
      type="button"
      class="pdf-toolbar-btn explore-icon pdf-toolbar-icon-overlay"
      :class="{ 'explore-icon-large': hasAttachedScreenshots }"
      :style="overlayButtonStyle"
      @click.stop="handleSelectAndAskClick"
    >
      <img :src="selectAndAskIconToUse" alt="选中并问" style="width: 100%; height: 100%" />
    </button>

    <!-- 对话面板头部 -->
    <div class="chat-panel-header">
      <!-- Tab 切换 -->
      <div class="chat-tabs">
        <div class="tab-list">
          <div
            v-for="tab in tabOptions"
            :key="tab.value"
            :class="['tab-item', { 'tab-active': activeTab === tab.value }]"
            @click="activeTab = tab.value"
          >
            <span>{{ tab.label }}</span>
          </div>
        </div>
      </div>
      <!-- 关闭按钮 -->
      <q-btn flat round dense icon="close" size="md" @click="handleClose" class="close-button" />
    </div>

    <!-- Tab 内容区域 -->
    <div class="chat-content-container">
      <!-- AI 问答 Tab -->
      <div v-show="activeTab === 'ai-chat'" class="tab-content">
        <ChatView
          ref="chatViewRef"
          type="ai-textbook"
          :compressed-height="360"
          @send-with-screenshot="
            (text, shots, selectedModel) => emit('send-with-screenshot', text, shots, selectedModel)
          "
          @remove-screenshot="(id) => emit('remove-screenshot', id)"
          @edit-screenshot="(id) => emit('edit-screenshot', id)"
          @open-teacher-dialog="handleOpenTeacherDialog"
          @switch-to-teacher="handleSwitchToTeacher"
        >
          <!-- 通过 ChatView 的 header-prefix 插槽引入“选中并问”按钮 -->
          <template #header-prefix>
            <button type="button" class="pdf-toolbar-btn" @click="handleSelectAndAskClick">
              <img :src="selectAndAskIconToUse" alt="选中并问" class="pdf-toolbar-icon" />
            </button>
          </template>
        </ChatView>
      </div>
      <!-- 会话记录 Tab -->
      <div v-show="activeTab === 'question-record'" class="tab-content">
        <div class="session-list-wrapper">
          <SessionList
            :records="sessions"
            :selectedRecordId="selectedRecordId"
            @record-click="handleSessionClick"
            @record-delete="handleSessionDelete"
            @record-pin="handleSessionPin"
            @batch-delete="handleBatchDelete"
            :showHeader="false"
          />
        </div>
      </div>
    </div>

    <!-- 全局聊天对话框 -->
    <GlobalChatDialog v-model="showGlobalChatDialog" :entry="globalChatEntry" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch, type ComponentPublicInstance } from 'vue'
import { CHAT_TAB_OPTIONS } from '../constants/options'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import ChatView from '@/components/ChatView.vue'
import SessionList from '@/components/SessionList.vue'
import GlobalChatDialog from '@/components/dialog/GlobalChatDialog.vue'
import { useRoute } from 'vue-router'
import type { AiTextbookSession, AttachedScreenshot, ChatEntry } from '@/types'
import {
  getScreenshotSessionsByResourceId,
  deleteScreenshotSession,
  batchDeleteScreenshotSessions,
  updateScreenshotSession,
} from '@/utils/storage/screenshotSessions'
import selectAndAskIcon from '/icons/selectAndAsk.svg'
import selectAndAskIconSelected from '/icons/selectAndAsk_select.svg'
import textbookipIcon from '/icons/textbookip.png'
import ipWordIcon from '/icons/ipWord.svg'

const pdfViewerStore = usePdfViewerStore()
const aiTextbookStore = useAiTextbookChatStore()
const route = useRoute()

const props = defineProps<{
  // 目前不再通过 props 传递截图数组，保留占位以兼容旧调用方（不使用）
  attachedScreenshots?: AttachedScreenshot[]
}>()

const emit = defineEmits<{
  'select-and-ask-click': []
  close: []
  'send-with-screenshot': [string, AttachedScreenshot[], string]
  'remove-screenshot': [string]
  'edit-screenshot': [string]
}>()

// ChatView 实例引用
const chatViewRef = ref<ComponentPublicInstance | null>(null)

// Tab 状态
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

// Tab 选项
const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>

// 会话数据
const sessions = ref<AiTextbookSession[]>([])

// 选中的会话ID
const selectedRecordId = ref<string | undefined>(undefined)

// 全局聊天对话框显示状态
const showGlobalChatDialog = ref(false)

const globalChatEntry = ref<ChatEntry | undefined>(undefined)

// “选中并问”按钮选中状态：与截图工具是否被选中保持一致
const isSelectAndAskSelected = computed(() => pdfViewerStore.selectedTool === 'screenshot')

// 是否处于“探索/截图”选择状态 —— 当工具为 screenshot 且当前为 AI 问答 tab 时显示遮罩
const isExploring = computed(() => {
  return pdfViewerStore.selectedTool === 'screenshot' && activeTab.value === 'ai-chat'
})

// 计算当前使用的"选中并问"图标
const selectAndAskIconToUse = computed(() =>
  isSelectAndAskSelected.value ? selectAndAskIconSelected : selectAndAskIcon
)

// 计算是否有附加截图，用于动态调整按钮尺寸
const hasAttachedScreenshots = computed(() => {
  return aiTextbookStore.attachedScreenshots.length > 0
})

const attachedScreenshotCount = computed(() => aiTextbookStore.attachedScreenshots.length)

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getSessionId = (session: AiTextbookSession): string => {
  return session.sessionId || session.id || ''
}

// 获取当前 resourceId（仅从路由参数获取）
const getCurrentResourceId = (): string | undefined => {
  return (route.query.resourceId as string) || undefined
}

// 设置store的resourceId，确保会话ID基于资源生成
const setupResourceId = () => {
  const resourceId = getCurrentResourceId()
  if (resourceId) {
    aiTextbookStore.setResourceId(resourceId)
    console.log('[PdfChatPanel] 设置资源ID:', resourceId)
  }
}

// 加载会话列表
const loadSessions = async () => {
  const currentResourceId = getCurrentResourceId() || ''
  const byResource = await getScreenshotSessionsByResourceId(currentResourceId)
  sessions.value = byResource
  console.log('[会话] 加载(按 resourceId)', { currentResourceId, sessions: sessions.value })
}

// 处理会话点击
const handleSessionClick = async (record: AiTextbookSession) => {
  selectedRecordId.value = getSessionId(record)
  const sessionId = getSessionId(record)

  // 打开对话面板
  pdfViewerStore.openChatPanel()
  // 切换到 AI 问答 Tab
  activeTab.value = 'ai-chat'

  await nextTick()
  ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
}

// 处理会话删除
const handleSessionDelete = async (record: AiTextbookSession) => {
  const sessionId = getSessionId(record)
  const ok = await deleteScreenshotSession(sessionId)
  if (ok) {
    if (selectedRecordId.value === sessionId) {
      selectedRecordId.value = undefined
    }
    await loadSessions()
  }
}

// 处理批量删除
const handleBatchDelete = async (recordIds: string[]) => {
  const ok = await batchDeleteScreenshotSessions(recordIds)
  if (ok) {
    if (selectedRecordId.value && recordIds.includes(selectedRecordId.value)) {
      selectedRecordId.value = undefined
    }
    await loadSessions()
  }
}

// 处理置顶
const handleSessionPin = async (record: AiTextbookSession) => {
  record.pinned = !record.pinned
  const ok = await updateScreenshotSession(record)
  if (ok) {
    await loadSessions()
  }
}

// 关闭对话面板
const handleClose = () => {
  emit('close')
}

// 处理打开老师对话框
const handleOpenTeacherDialog = ({ sessionId }: { sessionId: string; message?: any }) => {
  console.log('[PdfChatPanel] handleOpenTeacherDialog 被调用:', sessionId)
  console.log('[PdfChatPanel] 设置 showGlobalChatDialog 为 true')
  globalChatEntry.value = { mode: 'session', category: 'teacher', sessionId }
  showGlobalChatDialog.value = true
}

// 处理批量转发后切换到老师对话
const handleSwitchToTeacher = (forwardData: {
  messages?: any[]
  currentQuestion?: unknown
  additionalMessage?: string
  forwardMode?: string
  successCount?: number
  sessionId?: string
}) => {
  if (forwardData.sessionId) {
    console.log('[PdfChatPanel] handleSwitchToTeacher 被调用:', forwardData.sessionId)
    console.log('[PdfChatPanel] 设置 showGlobalChatDialog 为 true')
    globalChatEntry.value = { mode: 'session', category: 'teacher', sessionId: forwardData.sessionId }
    showGlobalChatDialog.value = true
  }
}

// 处理"选中并问"点击：交给父组件触发截图工具与后续流程
const handleSelectAndAskClick = () => {
  emit('select-and-ask-click')
}

// 遮罩层按钮位置样式
const overlayButtonStyle = ref<Record<string, string>>({
  position: 'fixed', // 使用 fixed 定位相对于视口
  left: '24px',
  top: '16px',
  width: '32px',
  height: '32px',
  zIndex: '35'
})

const overlayButtonReady = ref(false)

// 计算并更新遮罩层按钮位置，确保覆盖实际按钮
const updateOverlayButtonPosition = async () => {
  overlayButtonReady.value = false
  await nextTick()

  try {
    // 获取实际按钮元素
    const actualButton = document.querySelector('.chat-content-container .tab-content .pdf-toolbar-btn') as HTMLElement
    if (!actualButton) {
      console.warn('[PdfChatPanel] 找不到实际按钮元素')
      return
    }

    // 获取按钮相对于视口的位置
    const buttonRect = actualButton.getBoundingClientRect()

    // 更新遮罩层按钮样式 - 使用视口固定定位
    overlayButtonStyle.value = {
      position: 'fixed' as const,
      left: `${buttonRect.left}px`,
      top: `${buttonRect.top}px`,
      width: `${buttonRect.width}px`,
      height: `${buttonRect.height}px`,
      zIndex: '35'
    }

    overlayButtonReady.value = true

    console.log('[PdfChatPanel] 遮罩层按钮位置已更新:', overlayButtonStyle.value)
  } catch (error) {
    console.error('[PdfChatPanel] 计算按钮位置失败:', error)
  }
}

// 监听相关状态变化，更新遮罩层按钮位置
watch([isExploring, activeTab, attachedScreenshotCount], async (newValues) => {
  const [exploring, tab] = newValues
  if (exploring && tab === 'ai-chat') {
    // 延迟执行，确保DOM已更新
    setTimeout(updateOverlayButtonPosition, 100)
  } else {
    overlayButtonReady.value = false
  }
}, { immediate: false })

onMounted(async () => {
  // 设置资源ID，确保基于资源的会话ID生成
  setupResourceId()
  await loadSessions()

  // 初始计算按钮位置
  setTimeout(updateOverlayButtonPosition, 200)
})

defineExpose({
  reloadSessions: loadSessions,
})
</script>

<style scoped>
.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #e8e9ff;
}

/* 聊天面板头部 */
.chat-panel-header {
  background: #e8e9ff;
  padding-top: 10px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
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

.chat-content-container {
  flex: 1;
  overflow: hidden;
}

/* PDF 对话面板顶部工具按钮：选中并问 */
.pdf-toolbar-btn {
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative; /* 为覆盖层提供定位上下文 */
}

.pdf-toolbar-icon {
  display: block;
  height: 32px;
  object-fit: contain;
}

/* PDF 对话面板按钮覆盖层：遮罩时显示在按钮相同位置 */
.pdf-toolbar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(230, 225, 255, 0.75); /* 与遮罩层相同的颜色 */
  z-index: 35; /* 高于遮罩层 */
  border-radius: 4px;
  pointer-events: none; /* 不阻止点击，但提供视觉覆盖 */
}

.tab-content {
  height: 100%;
  border-radius: 20px;
}

.session-list-wrapper {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
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

/* 当有附加截图时，按钮更大 */
.explore-icon-large {
  bottom: 26.7%  !important;;
}
</style>
