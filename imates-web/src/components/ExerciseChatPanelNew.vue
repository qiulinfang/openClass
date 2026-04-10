<template>
  <div class="chat-panel-container">
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
      <!-- AI 问答 Tab -->
      <div v-show="activeTab === 'ai-chat'" class="tab-content">
        <ChatView
          ref="chatViewRef"
          type="ai-exercise"
          :compressed-height="360"
          :question="question"
          :hide-ask-teacher-icon="false"
          :toolbar-tools="toolbarToolNames"
          @scroll-to-bottom="emit('scroll-to-bottom')"
          @send-message="emit('send-message', $event)"
          @open-teacher-dialog="handleOpenTeacherDialog"
          @switch-to-teacher="handleSwitchToTeacher"
          @paste-to-draft="emit('paste-to-draft', $event)"
          @screenshot-click="handleScreenshotClick"
          @request-screenshot="handleRequestScreenshot"
          @new-session-click="handleAddSessionClick"
          @open-html-preview="handleOpenHtmlPreview"
        />
      </div>
      <!-- 会话记录 Tab -->
      <div v-show="activeTab === 'question-record'" class="tab-content">
        <div class="session-card-wrapper">
          <CardStack
            :model-value="sessionCards"
            empty-text="暂无会话记录"
            :swipe-to-delete="false"
            @card-remove-request="handleDeleteSessionRequest"
            @card-add="handleAddSessionCard"
          >
            <!-- 标题使用 Markdown 渲染 -->
            <template #title="{ card }">
              <MarkdownTitle :title="card.title" />
            </template>
            <template #card-body="{ card }">
              <div class="chat-snapshot" @click="handleSessionCardClick(card.id)">
                <div class="snapshot-messages">
                  <template v-if="card.previewMessagesMarkdown && card.previewMessagesMarkdown.length">
                    <div
                      v-for="(content, idx) in card.previewMessagesMarkdown"
                      :key="idx"
                      class="snapshot-bubble"
                      :class="idx % 2 === 0 ? 'user' : 'ai'"
                    >
                      <div
                        class="bubble-text markdown-content"
                        v-html="renderMessageContent(content)"
                        v-mathjax-preview
                      ></div>
                    </div>
                  </template>
                  <div v-else class="snapshot-empty">
                    <span>点击开始对话</span>
                  </div>
                </div>
                <div class="snapshot-fade"></div>
              </div>
            </template>
          </CardStack>
        </div>
        <!-- 底部操作条 -->
        <div class="session-bottom-bar">
          <Button
            label="返回"
            :icon="goBackBlackIcon"
            size="xs"
            variant="ghost"
            @click="handleCloseSessionPanel"
          />
          <Button
            label="新建"
            :icon="newSessionIcon"
            size="xs"
            variant="ghost"
            @click="handleAddSessionCard"
          />
          <Button
            label="清除会话"
            :icon="deleteSessionIcon"
            size="xs"
            variant="ghost"
            :disabled="!hasAiSessions"
            @click="handleClearAllSessionsClick"
          />
        </div>
      </div>
    </div>

    <!-- 清除会话确认对话框 -->
    <Dialog
      ref="clearAllDialogRef"
      title="清除确认"
      :confirmButtonText="'清除'"
      :cancelButtonText="'取消'"
      @confirm="confirmClearAllSessions"
      @cancel="cancelClearAllSessions"
    >
      确定要清除当前题目的所有会话吗？此操作不可撤销。
    </Dialog>

    <!-- 全局聊天对话框 -->
    <GlobalChatDialog v-model="showGlobalChatDialog" :entry="globalChatEntry" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, onUnmounted, type ComponentPublicInstance } from 'vue'
import { useRouter } from 'vue-router'
import { CHAT_TAB_OPTIONS } from '../constants/options'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useDraftStore } from '@/stores/draftStore'
import { useScreenSnapshot } from '@/composables/useScreenSnapshot'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { showMessage } from '../utils'
import ChatView from '@/components/ChatView.vue'
import CardStack from '@/components/base/CardStack.vue'
import MarkdownTitle from '@/components/MarkdownTitle.vue'
import GlobalChatDialog from '@/components/dialog/GlobalChatDialog.vue'
import Button from '@/components/base/Button.vue'
import Dialog from '@/components/base/Dialog.vue'
import type { AiTextbookSession, ChatEntry, ExerciseItem } from '@/types'
import type { BuiltinToolType } from '../types/toolbarTools'
import goBackBlackIcon from '/icons/goback_black.svg'
import newSessionIcon from '/icons/new.svg'
import deleteSessionIcon from '/icons/delete.svg'

const props = defineProps<{
  // 当前题目
  question?: ExerciseItem | null
  // 会话数据
  sessions?: AiTextbookSession[]
}>()

const emit = defineEmits<{
  'scroll-to-bottom': []
  'send-message': [message: string]
  'open-teacher-dialog': [data: { sessionId: string; message?: any }]
  'switch-to-teacher': [forwardData: {
    messages?: any[]
    currentQuestion?: unknown
    additionalMessage?: string
    forwardMode?: string
    successCount?: number
    sessionId?: string
  }]
  'paste-to-draft': [payload: any]
  'session-click': [record: AiTextbookSession]
  'add-session': []
  'close': []
}>()

const aiExerciseStore = useAiExerciseChatStore()
const draftStore = useDraftStore()

// ChatView 实例引用
const chatViewRef = ref<ComponentPublicInstance | null>(null)

// 清除会话确认对话框引用
const clearAllDialogRef = ref<InstanceType<typeof Dialog> | null>(null)

// 工具栏工具配置 - 极简版：只传工具名称字符串数组
const toolbarToolNames: BuiltinToolType[] = ['screenshot', 'formula', 'ask-teacher', 'new-session']

// 截图工具
const { captureScreenSnapshot } = useScreenSnapshot()
const router = useRouter()

// 处理 HTML 预览点击 - 跳转到 HtmlPreviewView
const lastHtmlPreviewOpen = ref<{ url: string; ts: number } | null>(null)
const handleOpenHtmlPreview = (url: string) => {
  if (!url) return
  const now = Date.now()
  const lastOpen = lastHtmlPreviewOpen.value
  if (lastOpen && lastOpen.url === url && now - lastOpen.ts < 800) {
    console.log('[ExerciseChatPanel] 忽略重复 open-html-preview:', url)
    return
  }
  lastHtmlPreviewOpen.value = { url, ts: now }
  emit('close')
  router.push({
    name: 'htmlPreview',
    query: {
      url,
      from: 'exercise',
      returnTo: router.currentRoute.value.fullPath,
      reopenPanel: 'exercise',
    }
  })
}

// Tab 状态
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

// Tab 选项
const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>

const { renderMessageContent } = useMessageRenderer()

// 选中的会话ID
const selectedRecordId = ref<string | undefined>(undefined)

// 全局聊天对话框显示状态
const showGlobalChatDialog = ref(false)

const globalChatEntry = ref<ChatEntry | undefined>(undefined)

const sessionCards = computed(() => {
  if (typeof aiExerciseStore.getSessionCards === 'function') {
    const cards = aiExerciseStore.getSessionCards()
    // 统一使用 会话+数字 作为标题，删除后会自动更新编号
    return cards.map((card: any, index: number) => ({
      ...card,
      title: `会话 ${index + 1}`
    }))
  }
  const sourceSessions = props.sessions || aiExerciseStore.sessions || []
  // 统一使用 会话+数字 作为标题，删除后会自动更新编号
  return sourceSessions.map((session: any, index: number) => ({
    id: session.id || session.sessionId,
    title: `会话 ${index + 1}`,
    updateTime: session.updatedAt || session.updateTime,
    previewMessagesMarkdown: session.previewMessagesMarkdown || [],
  }))
})

// 当前题目下是否存在 AI 会话
const hasAiSessions = computed(() => {
  return Array.isArray(aiExerciseStore.sessions) && aiExerciseStore.sessions.length > 0
})

// 处理会话点击
const handleSessionClick = async (record: AiTextbookSession) => {
  selectedRecordId.value = record.id || record.sessionId
  // 切换到 AI 问答 Tab
  activeTab.value = 'ai-chat'
  emit('session-click', record)
  console.log("record",record)
  // 切换到对应会话，加载该会话的消息
  const sessionId = record.id || record.sessionId
  if (sessionId) {
    await aiExerciseStore.switchToSession(sessionId)
  }
  
  await nextTick()
  ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
}

const handleSessionCardClick = async (sessionId: string) => {
  if (!sessionId) return
  selectedRecordId.value = sessionId
  activeTab.value = 'ai-chat'
  await aiExerciseStore.switchToSession(sessionId)
  await nextTick()
  ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
}

// 处理单条删除
const handleSessionDelete = async (record: AiTextbookSession) => {
  const sessionId = record.id || record.sessionId
  if (!sessionId) return
  const index = aiExerciseStore.sessions.findIndex((s: any) => (s.id || s.sessionId) === sessionId)
  if (index !== -1) {
    aiExerciseStore.sessions.splice(index, 1)
    if (selectedRecordId.value === sessionId) {
      selectedRecordId.value = undefined
    }
    // 如果删除后没有会话了，重置 store 状态
    if (aiExerciseStore.sessions.length === 0) {
      aiExerciseStore.resetState()
    }
  }
}

const handleDeleteSessionRequest = async (sessionId: string) => {
  const session = (props.sessions || aiExerciseStore.sessions || []).find(
    (item: any) => (item.id || item.sessionId) === sessionId
  )
  if (!sessionId || !session) return

  const runtimeSession = session as Record<string, unknown>
  const questionBmNo = (
    runtimeSession.questionBmNo ||
    props.question?.bmNo ||
    props.question?.id ||
    ''
  ).toString()
  if (!questionBmNo) return

  // 检查是否是最后一个会话
  const sessions = props.sessions || aiExerciseStore.sessions || []
  const isLastSession = sessions.length === 1

  // 删除会话对应的草稿
  const draftKey = `${questionBmNo}::${sessionId}`
  try {
    await draftStore.deleteDraft(draftKey)
  } catch (error) {
    console.warn('[草稿链路] 删除会话草稿失败:', error)
  }

  // 如果是最后一个会话，同时删除默认草稿
  if (isLastSession) {
    try {
      await draftStore.deleteDraft(`${questionBmNo}::default`)
    } catch (error) {
      console.warn('[草稿链路] 删除默认草稿失败:', error)
    }
  }

  await aiExerciseStore.deleteSession(sessionId, questionBmNo)
  if (selectedRecordId.value === sessionId) {
    selectedRecordId.value = undefined
  }
}

// 处理批量删除
const handleBatchDelete = async (recordIds: string[]) => {
  aiExerciseStore.sessions = aiExerciseStore.sessions.filter(
    (s: any) => !recordIds.includes(s.id || s.sessionId)
  )
  if (selectedRecordId.value && recordIds.includes(selectedRecordId.value)) {
    selectedRecordId.value = undefined
  }
  // 如果删除后没有会话了，重置 store 状态
  if (aiExerciseStore.sessions.length === 0) {
    aiExerciseStore.resetState()
  }
}

// 处理置顶
const handleSessionPin = async (record: AiTextbookSession) => {
  record.pinned = !record.pinned
}

// 处理截图按钮点击 - 通过 ChatView 的 screenshot-click 触发
const handleScreenshotClick = async () => {
  // 检查是否已选中题目
  if (!props.question) {
    showMessage('请先选择一道题目', 'warning')
    return
  }

  try {
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) return

    // 将截图添加到聊天输入框
    const imageInfo = {
      filePath: '',
      width: width || 0,
      height: height || 0,
      fileSize: Math.round(dataUrl.length * 0.75),
      base64DataUrl: dataUrl,
    }

    // 调用 ChatView 的 onImageSelected 方法添加图片到输入框
    const chatView = chatViewRef.value as any
    if (chatView?.onImageSelected) {
      await chatView.onImageSelected(imageInfo)
    }
  } catch (error) {
    console.error('截图失败:', error)
  }
}

// 处理 ChatView 的截图请求 - ScreenshotInputDialog 点击"添加更多"时触发
const handleRequestScreenshot = async (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => {
  console.log('[ExerciseChatPanel] 处理截图请求:', payload)

  // 检查是否已选中题目
  if (!props.question) {
    showMessage('请先选择一道题目', 'warning')
    return
  }

  if (payload?.kind !== 'screen_snapshot') return

  try {
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) return

    // 将截图添加到 ChatView 输入框
    const chatView = chatViewRef.value as any
    if (chatView?.onImageSelected) {
      await chatView.onImageSelected({
        filePath: '',
        width: width || 0,
        height: height || 0,
        fileSize: Math.round(dataUrl.length * 0.75),
        base64DataUrl: dataUrl,
      })
    }
  } catch (error) {
    console.error('[ExerciseChatPanel] 截图失败:', error)
  }
}

// 处理新增会话按钮点击
const handleAddSessionClick = () => {
  emit('add-session')
}

const handleAddSessionCard = () => {
  emit('add-session')
  activeTab.value = 'ai-chat'
}

// 关闭会话面板，切换回 AI 问答 Tab
const handleCloseSessionPanel = () => {
  activeTab.value = 'ai-chat'
}

// 处理清除所有会话按钮点击
const handleClearAllSessionsClick = () => {
  if (!hasAiSessions.value) return
  if (clearAllDialogRef.value && typeof clearAllDialogRef.value.openDialog === 'function') {
    clearAllDialogRef.value.openDialog()
  }
}

// 确认清除所有会话
const confirmClearAllSessions = async () => {
  try {
    const questionBmNo = (props.question?.bmNo || props.question?.id || '').toString()

    if (!questionBmNo) return

    const sessionIds = aiExerciseStore.sessions.map((session) => session.id || session.sessionId)

    // 删除所有会话对应的草稿
    const draftKeys = sessionIds.map((sessionId) => `${questionBmNo}::${sessionId}`)
    // 同时删除默认草稿
    draftKeys.push(`${questionBmNo}::default`)

    try {
      await draftStore.deleteDrafts(draftKeys)
    } catch (error) {
      console.warn('[草稿链路] 批量删除会话草稿失败:', error)
    }

    await Promise.all(
      sessionIds.map((sessionId) => aiExerciseStore.deleteSession(sessionId, questionBmNo))
    )

    showMessage('会话已清除', 'success')
    clearAllDialogRef.value?.closeDialog()
  } catch (error) {
    console.error('清除会话失败:', error)
    showMessage('清除会话失败', 'error')
  }
}

// 取消清除所有会话
const cancelClearAllSessions = () => {
  if (clearAllDialogRef.value && typeof clearAllDialogRef.value.closeDialog === 'function') {
    clearAllDialogRef.value.closeDialog()
  }
}

// 处理打开老师对话框
const handleOpenTeacherDialog = ({ sessionId }: { sessionId: string; message?: any }) => {
  globalChatEntry.value = { mode: 'session', category: 'teacher', sessionId }
  showGlobalChatDialog.value = true
  emit('open-teacher-dialog', { sessionId })
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
    globalChatEntry.value = { mode: 'session', category: 'teacher', sessionId: forwardData.sessionId }
    showGlobalChatDialog.value = true
    emit('switch-to-teacher', forwardData)
  }
}

// 暴露的方法
defineExpose({
  // 切换到 AI 问答 Tab
  switchToAiChat: () => {
    activeTab.value = 'ai-chat'
  },
  // 切换到会话记录 Tab
  switchToSessionRecord: () => {
    activeTab.value = 'question-record'
  },
  // 获取当前 Tab
  getActiveTab: () => activeTab.value,
  // 获取 ChatView 引用
  getChatViewRef: () => chatViewRef.value,
  // 滚动到指定会话
  scrollToSession: (sessionId: string) => {
    ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
  },
  // 设置选中的会话ID
  setSelectedRecordId: (id: string | undefined) => {
    selectedRecordId.value = id
  },
})
</script>

<style scoped>
.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #e8e9ff;
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
.tab-item.tab-active {
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
.tab-item.tab-active::after {
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
  overflow: hidden;
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

.pdf-toolbar-icon {
  display: block;
  height: 32px;
  object-fit: contain;
}

.tab-content {
  height: 100%;
  border-radius: 20px;
  background-color: #f7f6ff;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 40px;
  line-height: 1.4;
}

/* MathJax 公式在标题中的样式 */
.card-title .math {
  display: inline-block;
  vertical-align: middle;
  font-size: 0.9em;
}

.session-card-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 12px;
  min-height: 0;
}

/* 会话底部操作条样式 */
.session-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f7f6ff;
  z-index: 100;
  width: 100%;
}

/* 去除底部操作条按钮的边框和背景 */
.session-bottom-bar :deep(button) {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}

.chat-snapshot {
  position: relative;
  height: 100%;
  cursor: pointer;
  overflow: hidden;
}

.snapshot-messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  overflow: hidden;
}

.snapshot-bubble {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.snapshot-bubble.user {
  align-self: flex-end;
  background: #6e55ff;
  color: #ffffff;
}

.snapshot-bubble.ai {
  align-self: flex-start;
  background: #f4f2ff;
  color: #393548;
}

.bubble-text {
  overflow: hidden;
}

.snapshot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #8e89a3;
  font-size: 14px;
}

.snapshot-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 44px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.92));
  pointer-events: none;
}

/* 头部右侧操作区 */
.header-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 新增会话按钮 */
.add-session-btn {
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.add-session-icon {
  width: 32px;
  height: 32px;
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548;
  z-index: 1;
}
</style>
