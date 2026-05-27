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
      <!-- AI 问答 Tab -->
      <div v-show="activeTab === 'ai-chat'" class="tab-content">
        <ChatView
          ref="chatViewRef"
          type="ai-homework"
          :compressed-height="360"
          :question="props.question"
          :toolbar-tools="toolbarToolNames"
          @scroll-to-bottom="emit('scroll-to-bottom')"
          @send-message="handleSuggestionSendMessage"
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
      确定要清除所有通用会话吗？此操作不可撤销。
    </Dialog>

    <!-- 全局聊天对话框 -->
    <GlobalChatDialog v-model="showGlobalChatDialog" :entry="globalChatEntry" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, watch, type ComponentPublicInstance } from 'vue'
import { useRouter } from 'vue-router'
import { CHAT_TAB_OPTIONS, AI_ROLE_OPTIONS } from '@/constants/options'
import { useAiHomeworkChatStore } from '@/stores/aiHomeworkChatStore'
import { useDraftStore } from '@/stores/draftStore'
import { useScreenSnapshot } from '@/composables/useScreenSnapshot'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { showMessage } from '@/utils'
import ChatView from '@/components/chat/ChatView.vue'
import CardStack from '@/components/base/CardStack.vue'
import MarkdownTitle from '@/components/display/MarkdownTitle.vue'
import GlobalChatDialog from '@/components/dialog/GlobalChatDialog.vue'
import Button from '@/components/base/Button.vue'
import Dialog from '@/components/base/Dialog.vue'
import type { AiGeneralSession, ChatEntry, AiTextbookSession, ExerciseItem } from '@/types'
import type { BuiltinToolType } from '@/types/toolbarTools'
import goBackBlackIcon from '/icons/goback_black.svg'
import newSessionIcon from '/icons/new.svg'
import deleteSessionIcon from '/icons/delete.svg'

const props = withDefaults(defineProps<{
  question?: ExerciseItem | null
  showCloseButton?: boolean
}>(), {
  showCloseButton: true
})

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
  'session-click': [record: any]
  'add-session': []
  'close': []
}>()

const aiHomeworkStore = useAiHomeworkChatStore()
const draftStore = useDraftStore()

// 监听题目变化，自动切换会话上下文
watch(() => props.question?.bmNo, async (newBmNo) => {
  console.log('[HomeworkChatPanel] watch question.bmNo 触发:', newBmNo)
  if (newBmNo) {
    console.log('[HomeworkChatPanel] 准备调用 store.setQuestionContext')
    try {
      await aiHomeworkStore.setQuestionContext(newBmNo)
      console.log('[HomeworkChatPanel] store.setQuestionContext 调用完成')
    } catch (e) {
      console.error('[HomeworkChatPanel] store.setQuestionContext 调用失败:', e)
    }
  }
}, { immediate: true })

// ChatView 实例引用
const chatViewRef = ref<ComponentPublicInstance | null>(null)

// 清除会话确认对话框引用
const clearAllDialogRef = ref<InstanceType<typeof Dialog> | null>(null)

// 工具栏工具配置
const toolbarToolNames: BuiltinToolType[] = ['screenshot', 'formula', 'ask-teacher', 'new-session']

// 截图工具
const { captureScreenSnapshot } = useScreenSnapshot()
const router = useRouter()

// 处理 HTML 预览点击
const handleOpenHtmlPreview = (payload: { url: string; html?: string }) => {
  const { url, html } = payload
  if (!url) return
  
  // 获取当前会话 ID
  const currentSessionId = aiHomeworkStore.currentSession?.sessionId
  console.log('[HomeworkChatPanel] handleOpenHtmlPreview:', { url, hasHtml: !!html, currentSessionId })
  
  // 如果有缓存的 HTML，存入 sessionStorage 供 HtmlPreviewView 使用
  if (html) {
    sessionStorage.setItem('htmlPreview_inlineContent', html)
  }
  
  emit('close')
  router.push({
    name: 'htmlPreview',
    query: {
      url: url,
      sessionId: currentSessionId, // 传递会话 ID
      from: 'exercise',
      returnTo: router.currentRoute.value.fullPath,
      reopenPanel: 'homework',
    },
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

// 会话卡片数据 - 使用 Store 内部过滤后的会话
const sessionCards = computed(() => {
  const sourceSessions = aiHomeworkStore.filteredSessions || []
  console.log('[HomeworkChatPanel] sessionCards 更新, 数量:', sourceSessions.length)
  return sourceSessions.map((session: AiGeneralSession, index: number) => ({
    id: session.sessionId,
    title: `会话 ${index + 1}`, // 强制使用“会话 X”形式
    updateTime: session.updateTime,
    previewMessagesMarkdown: (session as any).previewMessagesMarkdown || [],
  }))
})

// 是否存在会话
const hasAiSessions = computed(() => {
  return Array.isArray(aiHomeworkStore.filteredSessions) && aiHomeworkStore.filteredSessions.length > 0
})

// 处理会话卡片点击
const handleSessionCardClick = async (sessionId: string) => {
  if (!sessionId) return
  selectedRecordId.value = sessionId
  activeTab.value = 'ai-chat'
  await aiHomeworkStore.switchSession(sessionId)
  await nextTick()
  ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
}

// 处理删除会话请求
const handleDeleteSessionRequest = async (sessionId: string) => {
  if (!sessionId) return
  await aiHomeworkStore.deleteSession(sessionId)
  if (selectedRecordId.value === sessionId) {
    selectedRecordId.value = undefined
  }
}

// 处理截图按钮点击
const handleScreenshotClick = async () => {
  try {
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) return

    const imageInfo = {
      filePath: '',
      width: width || 0,
      height: height || 0,
      fileSize: Math.round(dataUrl.length * 0.75),
      base64DataUrl: dataUrl,
    }

    const chatView = chatViewRef.value as any
    if (chatView?.onImageSelected) {
      await chatView.onImageSelected(imageInfo)
    }
  } catch (error) {
    console.error('截图失败:', error)
  }
}

// 处理 ChatView 的截图请求
const handleRequestScreenshot = async (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => {
  if (payload?.kind !== 'screen_snapshot') return
  await handleScreenshotClick()
}

// 处理新增会话按钮点击
const handleAddSessionClick = async () => {
  aiHomeworkStore.resetState(false) // 仅重置当前会话，保留题目上下文
  activeTab.value = 'ai-chat'
  emit('add-session')
}

const handleAddSessionCard = () => {
  handleAddSessionClick()
}

// 关闭会话面板
const handleCloseSessionPanel = () => {
  activeTab.value = 'ai-chat'
}

// 处理清除所有会话
const handleClearAllSessionsClick = () => {
  if (!hasAiSessions.value) return
  clearAllDialogRef.value?.openDialog()
}

// 确认清除所有会话
const confirmClearAllSessions = async () => {
  try {
    const sessionIds = aiHomeworkStore.filteredSessions.map((session) => session.sessionId)
    for (const id of sessionIds) {
      await aiHomeworkStore.deleteSession(id)
    }
    showMessage('会话已清除', 'success')
    clearAllDialogRef.value?.closeDialog()
  } catch (error) {
    console.error('清除会话失败:', error)
    showMessage('清除会话失败', 'error')
  }
}

// 取消清除所有会话
const cancelClearAllSessions = () => {
  clearAllDialogRef.value?.closeDialog()
}

// 处理打开老师对话框
const handleOpenTeacherDialog = ({ sessionId }: { sessionId: string; message?: any }) => {
  globalChatEntry.value = { mode: 'session', category: 'teacher', sessionId }
  showGlobalChatDialog.value = true
  emit('open-teacher-dialog', { sessionId })
}

// 处理批量转发后切换到老师对话
const handleSwitchToTeacher = (forwardData: any) => {
  if (forwardData.sessionId) {
    globalChatEntry.value = { mode: 'session', category: 'teacher', sessionId: forwardData.sessionId }
    showGlobalChatDialog.value = true
    emit('switch-to-teacher', forwardData)
  }
}

// 处理点击预设问题发送
const handleSuggestionSendMessage = (suggestion: string) => {
  if (chatViewRef.value) {
    const chatView = chatViewRef.value as any
    // 发送给 AI 的内容（Store 会自动拼接题目上下文，所以这里只传建议语即可）
    chatView.inputMessage = suggestion
    // 前端气泡显示的内容
    chatView.inputDisplayContent = suggestion
    chatView.sendMessage()
  }
}

// 发送题目消息给 AI
const sendQuestion = async (question: ExerciseItem) => {
  activeTab.value = 'ai-chat'
  await nextTick()
  
  const content = question.question || question.title || ''
  if (content && chatViewRef.value) {
    console.log('[HomeworkChatPanel] 正在发送题目给 AI:', question.bmNo)
    const chatView = chatViewRef.value as any
    // 发送给 AI 的内容（Store 会自动拼接题目详情到 coversation）
    chatView.inputMessage = content
    // 前端气泡显示题目内容
    chatView.inputDisplayContent = content
    chatView.sendMessage()
  }
}

// 暴露的方法
defineExpose({
  sendQuestion,
  switchToAiChat: () => {
    activeTab.value = 'ai-chat'
  },
  switchToSessionRecord: () => {
    activeTab.value = 'question-record'
  },
  getActiveTab: () => activeTab.value,
  getChatViewRef: () => chatViewRef.value,
  scrollToSession: (sessionId: string) => {
    ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
  },
})
</script>

<style scoped>
.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #e8e9ff;
  border-radius: 20px 20px 0 0;
  overflow: hidden;
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

.tab-list {
  display: flex;
  gap: 2px;
}

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
  width: 100px;
}

.tab-item.tab-active {
  background-image: url('/icons/sessionbackfround.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: center center;
  color: #504b64;
  height: 40px;
  line-height: 24px;
}

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

.chat-content-container {
  flex: 1;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  border-radius: 20px;
  background-color: #f7f6ff;
  display: flex;
  flex-direction: column;
}

.session-card-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 12px;
  min-height: 0;
}

.session-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f7f6ff;
  z-index: 100;
  width: 100%;
}

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
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
  word-break: break-word;
  position: relative;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.snapshot-bubble.user {
  align-self: flex-end;
  background: #6e55ff;
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.snapshot-bubble.ai {
  align-self: flex-start;
  background: #ffffff;
  color: #393548;
  border-bottom-left-radius: 4px;
  border: 1px solid #eee;
}

.bubble-text {
  /* 基础文本样式 */
  user-select: none;
  pointer-events: none; /* 预览区域不可交互 */
}

/* 深度选择器适配 Markdown 渲染内容 */
.bubble-text :deep(.markdown-content) {
  font-size: 14px;
}

.bubble-text :deep(p) {
  margin: 0 0 8px 0;
}

.bubble-text :deep(p:last-child) {
  margin-bottom: 0;
}

/* MathJax 公式预览优化 */
.bubble-text :deep(mjx-container),
.bubble-text :deep(mjx-container.MathJax) {
  max-width: 100% !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  display: inline-block !important;
  vertical-align: middle !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

.bubble-text :deep(mjx-container::-webkit-scrollbar) {
  display: none !important;
}

/* Markdown 元素样式微调 */
.bubble-text :deep(h1),
.bubble-text :deep(h2),
.bubble-text :deep(h3),
.bubble-text :deep(h4) {
  font-size: 14px; /* 修改为与正文一致 */
  font-weight: 600;
  margin: 8px 0 4px 0;
}

.bubble-text :deep(ul),
.bubble-text :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}

.bubble-text :deep(li) {
  margin-bottom: 2px;
}

.bubble-text :deep(img.markdown-image) {
  max-width: 120px;
  max-height: 120px;
  border-radius: 4px;
  object-fit: contain;
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

.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548;
  z-index: 1;
}
</style>
