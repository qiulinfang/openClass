<template>
  <div class="chat-panel-container">
    <!-- 探索遮罩（在选择探索/截图工具时显示） -->
    <div v-if="isExploring" class="explore-overlay" @click.stop>
      <img :src="textbookipIcon" alt="textbookip" class="explore-icon textbookip" />
      <img :src="ipWordIcon" alt="ipWord" class="explore-icon ipWord" />
    </div>

    <!-- 对话面板头部 -->
    <div class="chat-panel-header">
      <div class="user-id">{{ xuebanUserId }}</div>
      <slot name="header-actions" />
    </div>

    <!-- Tab 内容区域 -->
    <div class="chat-content-container">
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
        <template #header-prefix>
          <button
            type="button"
            class="pdf-toolbar-btn pdf-toolbar-btn--select-and-ask"
            @click="handleSelectAndAskClick"
          >
            <img :src="selectAndAskIconToUse" alt="选中并问" class="pdf-toolbar-icon" />
          </button>

          <button
            type="button"
            class="pdf-toolbar-btn pdf-toolbar-btn--clear"
            @click="openClearChatDialog"
          >
            <img :src="deleteIcon" alt="清空记录" class="pdf-toolbar-icon pdf-toolbar-icon--clear" />
            <span class="pdf-toolbar-text">清空记录</span>
          </button>
        </template>
      </ChatView>
    </div>

    <!-- 全局聊天对话框 -->
    <GlobalChatDialog v-model="showGlobalChatDialog" :entry="globalChatEntry" />

    <Dialog
      ref="clearChatDialogRef"
      title="清空确认"
      :confirmButtonText="'清空'"
      :cancelButtonText="'取消'"
      @confirm="confirmClearChat"
      @cancel="cancelClearChat"
    >
      确定要清空聊天记录吗？此操作不可撤销。
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, watch, type ComponentPublicInstance } from 'vue'
import { storeToRefs } from 'pinia'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import ChatView from '@/components/ChatView.vue'
import GlobalChatDialog from '@/components/dialog/GlobalChatDialog.vue'
import Dialog from '@/components/base/Dialog.vue'
import { useRoute } from 'vue-router'
import type { AttachedScreenshot, ChatEntry } from '@/types'
import selectAndAskIcon from '/icons/selectAndAsk.svg'
import selectAndAskIconSelected from '/icons/selectAndAsk_select.svg'
import textbookipIcon from '/icons/textbookip.png'
import ipWordIcon from '/icons/ipWord.svg'
import deleteIcon from '/icons/delete.svg'
import { getUserId } from '@/services/http/auth-service'

const pdfViewerStore = usePdfViewerStore()
const aiTextbookStore = useAiTextbookChatStore()
const aiGeneralStore = useAiGeneralChatStore()
const { currentSessionId, isNewSession } = storeToRefs(aiTextbookStore)
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

// 全局聊天对话框显示状态
const showGlobalChatDialog = ref(false)

const globalChatEntry = ref<ChatEntry | undefined>(undefined)

// “选中并问”按钮选中状态：与截图工具是否被选中保持一致
const isSelectAndAskSelected = computed(() => pdfViewerStore.selectedTool === 'screenshot')

// 是否处于“探索/截图”选择状态 —— 当工具为 screenshot 时显示遮罩
const isExploring = computed(() => {
  return pdfViewerStore.selectedTool === 'screenshot'
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

const xuebanUserId = ref('')

const syncXuebanUserIdFromStorage = () => {
  try {
    const id = localStorage.getItem('xuebanuserid') || ''
    xuebanUserId.value = id
  } catch {
    xuebanUserId.value = ''
  }
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

const clearChatDialogRef = ref<InstanceType<typeof Dialog> | null>(null)

const openClearChatDialog = () => {
  clearChatDialogRef.value?.openDialog()
}

const cancelClearChat = () => {
  clearChatDialogRef.value?.closeDialog()
}

const confirmClearChat = async () => {
  try {
    clearChatDialogRef.value?.closeDialog()

    // 关键：教材聊天后端 thread_id 优先取 ai-general 的顶部会话ID。
    // 因此清空时强制创建一个新的 ai-general 顶部会话，确保后端 thread_id 变化。
    aiGeneralStore.resetState()
    await aiGeneralStore.createSession('清空记录')

    await aiTextbookStore.clearChatHistory()
    aiTextbookStore.clearAttachedScreenshots()
    aiTextbookStore.clearScreenshotDrawingStates()

    const userId = getUserId() || ''
    const newSessionId = `${userId ? userId + '-' : ''}textbook-session-${Date.now()}`
    currentSessionId.value = newSessionId
    isNewSession.value = true
  } catch (error) {
    console.error('[PdfChatPanel] 清空记录失败:', error)
  }
}

onMounted(async () => {
  // 设置资源ID，确保基于资源的会话ID生成
  setupResourceId()

  syncXuebanUserIdFromStorage()
  window.addEventListener('storage', (e) => {
    if (e.key === 'xuebanuserid') {
      syncXuebanUserIdFromStorage()
    }
  })
})

defineExpose({
  reloadSessions: () => {},
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
  justify-content: flex-end;
  align-items: center;
  padding-right: 12px;
  gap: 10px;
  position: relative;
}

.user-id {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: 220px;
  font-size: 14px;
  color: #2f2a45;
  opacity: 0.8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:slotted(.join-class-button) {
  height: 32px;
  padding: 0 12px;
  border-radius: 16px;
  border: 1px solid rgba(97, 94, 254, 0.5);
  background: rgba(255, 255, 255, 0.95);
  color: #2f2a45;
  font-size: 13px;
  cursor: pointer;
}

:slotted(.join-class-button.in-class) {
  border-color: rgba(239, 68, 68, 0.5);
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

.pdf-toolbar-btn--clear {
  height: 32px;
  padding: 0 10px;
  border: 1.3px solid #615efe;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.95);
  gap: 6px;
}

.pdf-toolbar-icon--clear {
  width: 19px;
  height: 16px;
}

.pdf-toolbar-text {
  font-size: 13px;
  line-height: 1;
  color: #2f2a45;
  font-weight: 400;
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

</style>
