<template>
  <view class="chat-view">
    <!-- 顶栏导航（高质感极简对齐 imates-web） -->
    <view class="chat-header">
      <view class="header-left">
        <view v-if="!props.hideHistory" class="drawer-toggle-btn" @click="showDrawer = true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4b5563" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </view>
        <text class="header-title">{{ headerTitle }}</text>
      </view>

      <view class="header-actions">
        <!-- 正常模式选项 -->
        <template v-if="!isSelectionMode">
          <view class="header-action-btn pill-btn" @click="handleCreateNewChat">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <text class="btn-text">新对话</text>
          </view>
          <view class="header-action-btn pill-btn danger" @click="handleClearHistory">
            <text class="btn-text">清空</text>
          </view>
        </template>

        <!-- 多选模式取消按键 -->
        <template v-else>
          <view class="header-action-btn pill-btn danger" @click="exitSelectionMode">
            <text class="btn-text">取消选择</text>
          </view>
        </template>
      </view>
    </view>

    <!-- 侧边会话抽屉组件 -->
    <SessionSidebar
      v-if="!props.hideHistory"
      :visible="showDrawer"
      :sessions="sessionList"
      :active-session-id="currentSessionId"
      @close="showDrawer = false"
      @create="handleCreateNewChat"
      @select="handleSelectSession"
      @delete="handleDeleteSession"
      @pin="handlePinSession"
      @rename="handleRenameSession"
    />

    <!-- 消息滚动列表主区域 -->
    <scroll-view
      scroll-y
      class="messages-scroll"
      :scroll-top="scrollTop"
      :scroll-into-view="scrollIntoViewId"
      :scroll-with-animation="true"
      @scroll="handleScroll"
    >
      <!-- 推荐快捷提问卡片组件 (仅 AI 题目/作业场景且无消息时展示，1:1 对齐 imates-web) -->
      <SuggestedQuestions
        v-if="
          displayedMessages.length === 0 &&
          !isGenerating &&
          (props.type === 'ai-exercise' || props.type === 'ai-homework')
        "
        :size="props.size"
        :type="props.type as 'ai-exercise' | 'ai-homework'"
        @select="onSelectPrompt"
      />

      <!-- 消息气泡组件列表 -->
      <view class="messages-container">
        <ChatMessage
          v-for="msg in displayedMessages"
          :id="'msg-' + msg.id"
          :key="msg.id"
          :message="msg"
          :is-selected="selectedMessageIds.has(msg.id)"
          :is-selection-mode="isSelectionMode"
          @retry="handleRetry"
          @quote="handleQuote"
          @edit="handleEditMessage"
          @delete="handleDelete"
          @toggle-selection="toggleSelection"
          @enter-multi-select="isSelectionMode = true"
          @scroll-to-message="handleScrollToMessage"
          @paste-to-draft="handlePasteToDraft"
          @image-loaded="handleImageLoaded"
        />
      </view>
    </scroll-view>

    <!-- 调试上下文悬浮按钮组 (对齐 imates-web debug-btn-group) -->
    <view v-if="showDebugBtn" class="debug-btn-group">
      <view class="debug-context-btn" @click="openDebugDialog">
        <text class="debug-btn-icon">📜</text>
        <text class="debug-btn-text">显示上下文</text>
      </view>
    </view>

    <!-- 新消息触底提示悬浮按钮 (对齐 imates-web new-message-indicator) -->
    <view
      v-if="showNewMessageIndicator"
      class="new-message-indicator-badge"
      @click="scrollToBottom"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
      <text class="indicator-text">回到底部</text>
    </view>

    <!-- 多选批量操作工具栏 (对齐 imates-web selection-toolbar) -->
    <view v-if="isSelectionMode" class="selection-toolbar">
      <view class="selection-left" @click="toggleSelectAll">
        <text class="checkbox-icon">{{ isAllSelected ? '☑️' : '⏹️' }}</text>
        <text class="select-all-text">全选</text>
        <text class="selection-count">已选 {{ selectedMessageIds.size }}/{{ displayedMessages.length }}</text>
      </view>
      <view class="selection-actions">
        <button
          class="toolbar-btn danger"
          :disabled="selectedMessageIds.size === 0"
          @click="handleBatchDelete"
        >
          删除选中的
        </button>
        <button
          class="toolbar-btn primary"
          :disabled="selectedMessageIds.size === 0"
          @click="showForwardDialog = true"
        >
          转发发送
        </button>
      </view>
    </view>

    <!-- 底部 ChatInput 工具栏组件与说明文案 -->
    <view v-else class="chat-input-area">
      <ChatInput
        v-model="inputText"
        v-model:selected-model="selectedModel"
        :placeholder-text="placeholderText"
        :is-loading="isGenerating"
        :enable-web-search="enableWebSearch"
        :type="props.type"
        :hide-ask-teacher-icon="props.hideAskTeacherIcon"
        :show-toolbar="props.showToolbar"
        :is-editing="isEditingMessage"
        :editing-message-id="editingMessageId"
        :quoted-message="quotedMessage"
        :attached-screenshots="props.attachedScreenshots"
        :toolbar-tools="props.toolbarTools"
        @send-message="handleSend"
        @cancel-edit="cancelEditMessage"
        @toggle-web-search="toggleWebSearch"
        @remove-quote="quotedMessage = null"
        @screenshot-click="emit('screenshot-click')"
        @new-session-click="handleCreateNewChat"
        @ask-teacher-click="handleAskTeacherClick"
      />

      <!-- 底部标语文案 (1:1 对齐 imates-web showFooterText) -->
      <view v-if="props.showFooterText" class="chat-footer-text">
        <text class="footer-tip">与学伴共学，敢质疑、会判断，思维不设限!</text>
      </view>
    </view>

    <!-- 消息转发模式弹窗组件 -->
    <ForwardModeDialog
      :visible="showForwardDialog"
      :message-count="selectedMessageIds.size"
      @close="showForwardDialog = false"
      @confirm="handleForwardConfirm"
    />

    <!-- 调试历史上下文弹窗 (1:1 对齐 imates-web 调试模态框) -->
    <view v-if="showDebugContextModal" class="debug-modal-mask" @click="showDebugContextModal = false">
      <view class="debug-modal-card" @click.stop>
        <view class="modal-header">
          <text class="modal-title">🔍 历史上下文记忆调试</text>
          <text class="modal-close" @click="showDebugContextModal = false">✕</text>
        </view>
        <scroll-view scroll-y class="modal-body-scroll">
          <text class="debug-json-text" selectable>{{ debugContextJson }}</text>
        </scroll-view>
        <view class="modal-footer">
          <button class="copy-btn" @click="copyDebugContext">复制 JSON</button>
          <button class="close-btn" @click="showDebugContextModal = false">关闭</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { ChatStrategyFactory } from './strategies/ChatStrategyFactory'
import type { ChatStrategy } from './strategies/ChatStrategy'
import type { ChatType, ChatBubble, AttachedScreenshot } from '@/types/chat'
import type { BuiltinToolType, ToolbarTool } from '@/components/chat/Input/ChatInput.vue'

import SessionSidebar from './session/SessionSidebar.vue'
import SuggestedQuestions from './message/SuggestedQuestions.vue'
import ChatMessage from './ChatMessage.vue'
import ChatInput from './Input/ChatInput.vue'
import ForwardModeDialog from './ForwardModeDialog.vue'
import { useAiGeneralChatStore } from '@/store/aiGeneralChatStore'

const props = withDefaults(
  defineProps<{
    type?: ChatType
    resourceId?: string
    compressedHeight?: number
    inputMode?: 'full' | 'simple'
    size?: 'large' | 'small'
    question?: unknown
    attachedScreenshots?: AttachedScreenshot[]
    showFooterText?: boolean
    showToolbar?: boolean
    hideAskTeacherIcon?: boolean
    showActionButtons?: boolean
    enableLongPress?: boolean
    showReadStatus?: boolean
    showTime?: boolean
    toolbarTools?: (BuiltinToolType | ToolbarTool)[]
    hideHistory?: boolean
  }>(),
  {
    type: 'ai-general',
    inputMode: 'full',
    size: 'large',
    showFooterText: true,
    showToolbar: true,
    hideAskTeacherIcon: false,
    showActionButtons: true,
    enableLongPress: true,
    showReadStatus: false,
    showTime: false,
    hideHistory: false
  }
)

const emit = defineEmits<{
  (e: 'response'): void
  (e: 'focus'): void
  (e: 'scroll-to-bottom'): void
  (e: 'screenshot-click'): void
  (e: 'new-session-click'): void
  (e: 'send-message', message: string): void
  (e: 'open-html-preview', payload: { url: string; html?: string }): void
}>()

const chatStrategy = ref<ChatStrategy>(ChatStrategyFactory.create(props.type || 'ai-general'))
const inputText = ref('')
const scrollTop = ref(99999)
const scrollIntoViewId = ref('')
const showDrawer = ref(false)
const showForwardDialog = ref(false)
const showNewMessageIndicator = ref(false)
const showDebugContextModal = ref(false)
const debugContextJson = ref('')
const quotedMessage = ref<any>(null)
const selectedModel = ref<string>('mate')
const isEditingMessage = ref(false)
const editingMessageId = ref<string | null>(null)

const showDebugBtn = computed(() => true)

const headerTitle = computed(() => {
  if (props.type === 'ai-exercise') return 'AI 题目解答助手'
  if (props.type === 'ai-homework') return 'AI 作业批改助手'
  if (props.type === 'ai-textbook') return 'AI 教材精读助手'
  return 'AI 学习助手'
})

const placeholderText = computed(() => {
  return chatStrategy.value.getPlaceholderText(!!props.question)
})

const isSelectionMode = ref(false)
const selectedMessageIds = ref<Set<string>>(new Set())

const displayedMessages = computed(() => {
  return chatStrategy.value.getMessages() || []
})

const isGenerating = computed(() => {
  return chatStrategy.value.isChatLoading?.() ?? false
})

const enableWebSearch = computed(() => {
  return chatStrategy.value.getEnableWebSearch?.() ?? false
})

const sessionList = computed(() => {
  return (chatStrategy.value.getSessionCards?.() as any[]) || []
})

const currentSessionId = computed(() => {
  return ''
})

const isAllSelected = computed(() => {
  return displayedMessages.value.length > 0 && selectedMessageIds.value.size === displayedMessages.value.length
})

onMounted(async () => {
  chatStrategy.value = ChatStrategyFactory.create(props.type || 'ai-general')
  await chatStrategy.value.initialize({
    question: props.question,
    hasSelectedQuestion: !!props.question,
    resourceId: props.resourceId,
  })
  scrollToBottom()
})

watch(
  () => props.type,
  async (newType) => {
    chatStrategy.value = ChatStrategyFactory.create(newType || 'ai-general')
    await chatStrategy.value.initialize({
      question: props.question,
      hasSelectedQuestion: !!props.question,
      resourceId: props.resourceId,
    })
    scrollToBottom()
  }
)

watch(
  displayedMessages,
  () => {
    scrollToBottom()
  },
  { deep: true }
)

const handleScroll = (e: any) => {
  const detail = e.detail
  if (detail.scrollHeight - detail.scrollTop > 600) {
    showNewMessageIndicator.value = true
  } else {
    showNewMessageIndicator.value = false
  }
}

const scrollToBottom = () => {
  showNewMessageIndicator.value = false
  nextTick(() => {
    scrollTop.value = scrollTop.value === 99999 ? 100000 : 99999
  })
}

// 1:1 对齐图片加载防抖置底逻辑
let imageLoadTimer: any = null
const handleImageLoaded = () => {
  if (imageLoadTimer) clearTimeout(imageLoadTimer)
  imageLoadTimer = setTimeout(() => {
    scrollToBottom()
  }, 100)
}

// 1:1 对齐引用消息定位跳转逻辑
const handleScrollToMessage = (msgId: string) => {
  scrollIntoViewId.value = ''
  nextTick(() => {
    scrollIntoViewId.value = 'msg-' + msgId
  })
}

// 1:1 对齐编辑历史消息逻辑
const handleEditMessage = (msg: ChatBubble) => {
  isEditingMessage.value = true
  editingMessageId.value = msg.id
  inputText.value = msg.content
}

const cancelEditMessage = () => {
  isEditingMessage.value = false
  editingMessageId.value = null
  inputText.value = ''
}

// 1:1 对齐草稿同步逻辑
const handlePasteToDraft = (content: string) => {
  uni.setClipboardData({
    data: content,
    success: () => {
      uni.showToast({ title: '已同步至草稿本/剪贴板', icon: 'success' })
    }
  })
}

const handleSend = async () => {
  if (!inputText.value.trim() || isGenerating.value) return
  const text = inputText.value
  inputText.value = ''

  if (isEditingMessage.value) {
    isEditingMessage.value = false
    editingMessageId.value = null
  }

  try {
    await chatStrategy.value.sendMessage(text, {
      selectedModel: selectedModel.value,
      quotedMessage: quotedMessage.value,
      question: props.question,
      currentQuestion: props.question,
    })
    quotedMessage.value = null
    scrollToBottom()
    emit('response')
  } catch (err: any) {
    uni.showToast({ title: err.message || '发送失败', icon: 'none' })
  }
}

const onSelectPrompt = async (prompt: string) => {
  emit('send-message', prompt)
  if (isGenerating.value) return

  try {
    await chatStrategy.value.sendMessage(prompt, {
      selectedModel: selectedModel.value,
      quotedMessage: quotedMessage.value,
      question: props.question,
      currentQuestion: props.question,
    })
    quotedMessage.value = null
    scrollToBottom()
    emit('response')
  } catch (err: any) {
    uni.showToast({ title: err.message || '发送失败', icon: 'none' })
  }
}

const handleRetry = async (msg: ChatBubble) => {
  if (chatStrategy.value.retryMessage) {
    await chatStrategy.value.retryMessage(msg.id, { currentQuestion: props.question })
  }
}

const handleQuote = (msg: ChatBubble) => {
  quotedMessage.value = msg
}

const handleDelete = async (msgId: string) => {
  if (chatStrategy.value.deleteMessage) {
    await chatStrategy.value.deleteMessage(msgId, { currentQuestion: props.question })
  }
}

const toggleSelection = (msgId: string) => {
  if (selectedMessageIds.value.has(msgId)) {
    selectedMessageIds.value.delete(msgId)
  } else {
    selectedMessageIds.value.add(msgId)
  }
  selectedMessageIds.value = new Set(selectedMessageIds.value)
}

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedMessageIds.value.clear()
  } else {
    selectedMessageIds.value = new Set(displayedMessages.value.map((m) => m.id))
  }
}

const handleBatchDelete = () => {
  uni.showModal({
    title: '批量删除提示',
    content: `确定删除选中的 ${selectedMessageIds.value.size} 条消息吗？`,
    success: (res) => {
      if (res.confirm) {
        selectedMessageIds.value.forEach((id) => handleDelete(id))
        exitSelectionMode()
      }
    },
  })
}

const exitSelectionMode = () => {
  isSelectionMode.value = false
  selectedMessageIds.value.clear()
}

const handleCreateNewChat = async () => {
  if (chatStrategy.value.createNewSession) {
    await chatStrategy.value.createNewSession({ currentQuestion: props.question })
  }
}

const handleSelectSession = async (sessionId: string) => {
  if (chatStrategy.value.switchToSession) {
    await chatStrategy.value.switchToSession(sessionId)
    showDrawer.value = false
  }
}

const handleDeleteSession = async (sessionId: string) => {
  if (chatStrategy.value.deleteSession) {
    await chatStrategy.value.deleteSession(sessionId, { currentQuestion: props.question })
  }
}

const handlePinSession = async (sessionId: string) => {
  const generalStore = useAiGeneralChatStore()
  await generalStore.togglePinSession(sessionId)
}

const handleRenameSession = async (sessionId: string, newName: string) => {
  const generalStore = useAiGeneralChatStore()
  await generalStore.renameSession(sessionId, newName)
}

const handleClearHistory = () => {
  uni.showModal({
    title: '清空确认',
    content: '确定清空当前会话的消息记录吗？',
    success: async (res) => {
      if (res.confirm) {
        displayedMessages.value.forEach((m) => handleDelete(m.id))
      }
    },
  })
}

const toggleWebSearch = () => {
  if (chatStrategy.value.toggleWebSearch) {
    chatStrategy.value.toggleWebSearch()
  }
}

const handleAskTeacherClick = () => {
  uni.showToast({ title: '已发起呼叫教师', icon: 'none' })
}

const handleForwardConfirm = async () => {
  const msgs = displayedMessages.value.filter((m) => selectedMessageIds.value.has(m.id))
  await chatStrategy.value.forwardMessages(msgs)
  showForwardDialog.value = false
  exitSelectionMode()
}

const openDebugDialog = () => {
  debugContextJson.value = JSON.stringify(displayedMessages.value, null, 2)
  showDebugContextModal.value = true
}

const copyDebugContext = () => {
  uni.setClipboardData({
    data: debugContextJson.value,
    success: () => {
      uni.showToast({ title: '调试数据已复制', icon: 'success' })
    },
  })
}
</script>

<style lang="scss" scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background-color: #ffffff;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 28rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #f1f5f9;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.drawer-toggle-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: #eef2ff;
  }
}

.header-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1e293b;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.header-action-btn {
  font-size: 24rpx;
  border: none;
}

.pill-btn {
  padding: 10rpx 24rpx;
  border-radius: 32rpx;
  background: #eef2ff;
  color: #6366f1;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8rpx;

  &:active {
    opacity: 0.85;
  }

  &.danger {
    background: #fef2f2;
    color: #ef4444;
  }
}

.messages-scroll {
  flex: 1;
  overflow-y: auto;
  background-color: #f7f6ff;
}

.messages-container {
  padding: 24rpx 20rpx;
}

/* 调试上下文悬浮按钮组 */
.debug-btn-group {
  position: absolute;
  bottom: 180rpx;
  right: 24rpx;
  z-index: 99;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  align-items: flex-end;
}

.debug-context-btn {
  background: #ffffff;
  border: 1rpx solid #e2e8f0;
  border-radius: 32rpx;
  color: #1e293b;
  padding: 10rpx 24rpx;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 14rpx rgba(0, 0, 0, 0.08);

  &:active {
    background: #f8fafc;
    color: #6366f1;
  }
}

.debug-btn-icon {
  font-size: 24rpx;
}

.debug-btn-text {
  font-size: 22rpx;
}

.new-message-indicator-badge {
  position: absolute;
  bottom: 140rpx;
  right: 30rpx;
  background: #7a7cff;
  color: #ffffff;
  padding: 12rpx 24rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(122, 124, 255, 0.35);
  z-index: 10;

  &:active {
    opacity: 0.9;
  }
}

.selection-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 30rpx;
  background: #ffffff;
  border-top: 1rpx solid #eef0f2;
}

.selection-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 26rpx;
  color: #374151;
}

.selection-actions {
  display: flex;
  gap: 16rpx;
}

.toolbar-btn {
  font-size: 24rpx;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  border: none;
}

.toolbar-btn.danger {
  background: #ef4444;
  color: #ffffff;
}

.toolbar-btn.primary {
  background: #7a7cff;
  color: #ffffff;
}

.chat-input-area {
  background: #ffffff;
  border-top: 1rpx solid #eef0f2;
}

.chat-footer-text {
  text-align: center;
  padding: 10rpx 0 16rpx;
}

.footer-tip {
  font-size: 20rpx;
  color: #9ca3af;
}

.debug-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.debug-modal-card {
  width: 85%;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 24rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.modal-title {
  font-size: 30rpx;
  font-weight: 600;
}

.modal-body-scroll {
  flex: 1;
  max-height: 55vh;
  background: #1e1e1e;
  padding: 20rpx;
  border-radius: 16rpx;
}

.debug-json-text {
  font-family: monospace;
  font-size: 22rpx;
  color: #4ec9b0;
  white-space: pre-wrap;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 20rpx;
}

.copy-btn, .close-btn {
  font-size: 24rpx;
  padding: 12rpx 28rpx;
  border-radius: 16rpx;
  border: none;
}

.copy-btn {
  background: #7a7cff;
  color: #ffffff;
}

.close-btn {
  background: #f1f5f9;
  color: #374151;
}
</style>
