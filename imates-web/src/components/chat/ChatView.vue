<template>
  <!-- 聊天视图主容器 - 支持键盘动画状态 -->
  <div ref="chatViewRef" class="chat-view" :class="{ 'keyboard-animating': isKeyboardAnimating }">
    <!-- 调试上下文按钮 (仅测试环境显示) -->
    <button
      class="debug-context-btn"
      @click="openDebugDialog"
      title="查看历史上下文"
    >
      <span class="debug-btn-icon">📜</span>
      <span class="debug-btn-text">调试上下文</span>
    </button>
    <!-- 聊天消息区域 - 占据全宽度，支持滚动 -->
    <div class="chat-messages-container">
      <RubberBandList
        ref="rubberBandListRef"
        class="chat-rubber-list"
        :enable-load-top="(props.type === 'user-client' && chatStrategy?.supportsPaginatedHistory?.()) || (props.type === 'teacher' && teacherStore.pagination.hasMore)"
        :load-top-threshold="100"
        @load-top="handleLoadTop"
      >
        <!-- 空状态：推荐问题列表（仅 AI 题目场景显示；历史加载完成后才显示，避免切题闪烁） -->
        <SuggestedQuestions
          v-if="
            displayedMessages.length === 0 &&
            !(chatStrategy?.isChatLoading?.() ?? false) &&
            (type === 'ai-exercise' || type === 'ai-homework')
          "
          :size="props.size"
          :type="type as 'ai-exercise' | 'ai-homework'"
          @select="(q) => emit('send-message', q)"
        />

        <!-- 顶部加载指示器（教师聊天分页加载） -->
        <div v-if="type === 'teacher' && teacherStore.pagination.isLoadingMore"
             class="loading-more-indicator">
          <div class="loading-spinner"></div>
          <span>正在加载历史消息...</span>
        </div>

        <!-- 没有更多数据提示（教师聊天） -->
        <div v-if="type === 'teacher' && !teacherStore.pagination.hasMore && displayedMessages.length > 0"
             class="no-more-indicator">
          没有更多历史消息了
        </div>
        <!-- 聊天消息组件列表 - 支持选择、转发、编辑等功能 -->
        <div
          v-for="(message, index) in displayedMessages"
          :key="message.id"
          class="message-item"
          :data-session-id="message.sessionId"
          :data-message-id="message.id"
        >
          <!-- 消息组件 -->
          <ChatMessage
            :message="message"
            :type="type"
            :current-question="currentQuestion"
            :is-selected="selectedMessages.has(message.id)"
            :is-selection-mode="isSelectionMode"
            :message-index="index"
            :is-last-message="isLastMessage(index)"
            :is-last-user-message="index === lastUserMessageIndex"
            :show-action-buttons="showActionButtons"
            :enable-long-press="enableLongPress"
            :show-read-status="showReadStatus"
            :show-time="showTime"
            @toggle-selection="toggleMessageSelection"
            @message-click="handleMessageClick"
            @enter-multi-select="handleEnterMultiSelect"
            @edit-message="handleEditMessage"
            @image-loaded="handleImageLoaded"
            @quote-message="handleQuoteMessage"
            @scroll-to-message="handleScrollToMessage"
            @delete-message="handleDeleteMessage"
            @paste-to-draft="handlePasteToDraft"
            @open-html-preview="(url) => emit('open-html-preview', url)"
          />
        </div>
      </RubberBandList>
      <!-- 新消息提示按钮 - 当用户不在底部时显示（原生实现） -->
      <button
        v-if="showNewMessageIndicator"
        class="new-message-indicator"
        @click="() => scrollToBottom()"
        title="有新消息，点击查看"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </button>
      <!-- 会话列表覆盖层：使用 CardStack 展示多会话管理界面（仅覆盖消息区域） -->
      <Transition name="fade">
        <div
          v-show="showSessionListPanel"
          class="chat-session-list-overlay"
          @click.self="showSessionListPanel = false"
        >
          <!-- 会话列表 -->
          <CardStack
            ref="cardStackRef"
            :model-value="sessionCards"
            empty-text="暂无会话记录"
            @card-remove-request="handleDeleteSessionRequest"
            @card-add="handleCreateNewSession"
            :swipe-to-delete="false"
          >
            <!-- 会话卡片内容插槽：聊天记录快照 -->
            <template #card-body="{ card }">
              <div class="chat-snapshot" @click="handleSwitchSession(card.id)">
                <!-- 模拟聊天界面的消息列表（使用 Markdown+公式 渲染前几条消息） -->
                <div class="snapshot-messages">
                  <template
                    v-if="card.previewMessagesMarkdown && card.previewMessagesMarkdown.length"
                  >
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
                  <!-- 空状态 -->
                  <div v-else class="snapshot-empty">
                    <span>点击开始对话</span>
                  </div>
                </div>
                <!-- 底部渐变遮罩 -->
                <div class="snapshot-fade"></div>
              </div>
            </template>
          </CardStack>
        </div>
      </Transition>
    </div>

    <!-- 选择模式工具栏 - 新设计 -->
    <!-- 功能：当用户进入多选模式时显示，提供批量操作功能，替换 ChatInput 的位置 -->
    <div v-if="isSelectionMode" class="selection-toolbar">
      <!-- 左侧：全选区域 -->
      <div class="selection-left" :title="isAllSelected ? '取消全选' : '全选'">
        <Checkbox
          :modelValue="isAllSelected"
          :indeterminate="selectedMessages.size > 0 && !isAllSelected"
          size="md"
          @update:modelValue="handleSelectAllCheckboxChange"
        />
        <span class="select-all-text">全选</span>
        <span class="selection-count">已选{{ selectedMessages.size }}/{{ displayedMessages.length }}</span>
      </div>

      <!-- 右侧：操作按钮组（使用原生按钮，样式靠 CSS 控制） -->
      <div class="selection-actions">
        <Button
          label="取消"
          variant="outline"
          size="md"
          @click="exitSelectionMode"
        />

        <Button
          v-if="chatStrategy?.shouldShowForwardButton()"
          :label="selectionMode === 'ask-teacher' ? '发送' : '发送'"
          size="md"
          :disabled="selectedMessages.size === 0"
          @click="() => forwardToTeacher()"
        />
      </div>
    </div>
    <!-- 聊天输入组件插槽 - 支持自定义输入组件，默认使用 ChatInput -->
    <!-- 在多选模式下隐藏输入组件 -->
    <div v-if="!isSelectionMode" class="chat-input-area">
      <!-- 简单输入模式前置插槽 - 用于放置操作按钮等 -->
      <slot v-if="inputMode === 'simple'" name="input-prefix"></slot>
      <slot name="input">
        <!-- 完整输入模式 (ChatInput) -->
        <ChatInput
          v-if="inputMode === 'full'"
          ref="chatInputRef"
          v-model="inputMessage"
          :placeholder-text="enhancedPlaceholderText"
          :is-loading="isLoading"
          :is-recording="isRecording"
          :enable-web-search="enableWebSearch"
          :selected-model="selectedModel"
          :type="type"
          :hide-ask-teacher-icon="props.hideAskTeacherIcon"
          :uploaded-files="uploadedFiles"
          :active-mode="activeMode ?? undefined"
          :can-send="isEditingMessage ? canSendInEditMode : canSend"
          :is-editing="isEditingMessage"
          :editing-message-id="editingMessageId"
          :quoted-message="quotedMessage"
          :attached-screenshots="strategyInputAttachedScreenshots"
          :show-toolbar="showToolbar"
          :toolbar-tools="props.toolbarTools"
          @send-message="sendMessage"
          @remove-quote="handleRemoveQuote"
          @edit-screenshot="handleEditScreenshot"
          @remove-screenshot="handleRemoveScreenshot"
          @send-with-screenshot="handleSendWithScreenshot"
          @blur="onInputBlur"
          @show-image-picker="showImagePickerDialog"
          @toggle-web-search="toggleWebSearch"
          @update:selected-model="selectedModel = $event"
          @remove-file="removeFile"
          @cancel-edit="cancelEditMessage"
          @scroll-to-bottom="scrollToBottom"
          @ask-teacher-click="handleEnterMultiSelect"
          @screenshot-click="emit('screenshot-click')"
          @new-session-click="emit('new-session-click')"
          @focus="
            () => {
              isActiveInstance = true
              emit('focus')
            }
          "
        >
          <!-- 透传 ChatView 的头部相关插槽到 ChatInput 对应插槽 -->

          <!-- 顶层整块头部：用于完全替换 ChatInput 的 header-all 区域 -->
          <template #header-all>
            <slot name="header-all"></slot>
          </template>
          <!-- 前置区域：最前面的按钮，如“选中并问”等 -->
          <template #header-prefix>
            <slot name="header-prefix"></slot>
          </template>

          <!-- 中间工具条：允许上层直接覆盖中间按钮（如公式/问老师） -->
          <template #header-middle>
            <slot name="header-middle"></slot>
          </template>

          <!-- 后置区域：工具条下方追加内容（说明文字等） -->
          <template #header-suffix>
            <slot name="header-suffix"></slot>
          </template>

          <!-- 右侧额外区域：右上角单独按钮（如新增会话） -->
          <template #header-right>
            <slot name="header-right"></slot>
          </template>
        </ChatInput>

        <!-- 简单输入模式 (SimpleChatInput) -->
        <SimpleChatInput
          v-else-if="inputMode === 'simple'"
          ref="simpleChatInputRef"
          v-model="inputMessage"
          :placeholder="enhancedPlaceholderText"
          :is-loading="isLoading"
          :selected-model="selectedModel"
          @update:selected-model="selectedModel = $event"
          @send="sendSimpleMessage"
          @focus="
            () => {
              isActiveInstance = true
              emit('focus')
            }
          "
          @blur="onInputBlur"
        >
          <template #header-prefix>
            <slot name="header-prefix"></slot>
          </template>
        </SimpleChatInput>
      </slot>

      <!-- 底部提示文案：移动到输入区域内部底部 -->
      <div v-if="showFooterText" class="chat-footer-text">
        与学伴共学，敢质疑、会判断，思维不设限!
      </div>
    </div>

    <!-- 删除会话确认对话框 -->
    <Dialog
      ref="deleteSessionDialogRef"
      title="删除确认"
      :confirmButtonText="'删除'"
      :cancelButtonText="'取消'"
      @confirm="confirmDeleteSession"
      @cancel="cancelDeleteSession"
    >
      {{ `确认删除「${pendingDeleteSessionTitle}」？` }}
    </Dialog>

    <!-- 老师选择对话框 -->
    <TeacherSelectionDialog v-model="showTeacherSelectionDialog" @confirm="handleTeacherSelected" />

    <!-- 转发成功对话框 -->
    <Dialog
      ref="forwardSuccessDialogRef"
      title="转发成功"
      :confirm-button-text="'前往老师对话'"
      :cancel-button-text="'留在当前会话'"
      @confirm="handleForwardSuccessConfirm"
      @cancel="handleForwardSuccessCancel"
    >
      {{ forwardSuccessMessage }}
    </Dialog>

    <!-- 图片裁剪组件 -->
    <ImageCropOverlay
      v-model="showImageCropDialog"
      :image-src="imageCropSrc"
      title="裁剪图片"
      hint-text="拖动选择裁剪区域"
      :show-info="true"
      @confirm="handleImageCropConfirm"
      @cancel="handleImageCropCancel"
    />

    <ScreenshotInputDialog
      v-if="screenshotEditorVisible"
      v-model="screenshotEditorVisible"
      :mode="screenshotEditorMode"
      :initial-shot-id="screenshotEditorInitialShotId"
      :existing-screenshots="strategyInputAttachedScreenshots"
      :drawing-states-from-parent="strategyInputScreenshotDrawingStatesForDialog"
      @confirm="handleScreenshotEditorConfirm"
      @add-more="handleScreenshotEditorAddMore"
      @cancel="handleScreenshotEditorCancel"
      @remove-screenshot="handleScreenshotEditorRemove"
    />

    <!-- 调试历史上下文对话框 -->
    <Dialog
      ref="debugContextDialogRef"
      title="历史上下文调试"
      :confirmButtonText="'复制 JSON'"
      :cancelButtonText="'关闭'"
      @confirm="copyDebugContext"
      @cancel="closeDebugContext"
    >
      <div class="debug-dialog-content" style="max-height: 480px; overflow-y: auto; text-align: left; padding: 4px;">
        <div v-if="!latestHistoryList || latestHistoryList.length === 0" style="color: #64748b; text-align: center; padding: 20px; font-size: 13px;">
          暂无历史消息
        </div>
        <div v-else class="debug-history-list" style="display: flex; flex-direction: column; gap: 14px;">
          <div 
            v-for="(msg, idx) in latestHistoryList" 
            :key="msg.id || idx" 
            class="debug-history-item"
            style="border-bottom: 1px solid rgba(0, 0, 0, 0.05); padding-bottom: 12px;"
          >
            <!-- 头部信息 -->
            <div style="font-size: 11px; color: #8e8e93; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                {{ msg.type === 'human' || msg.type === 'user' ? 'Human' : 'AI' }}
              </span>
              <span v-if="msg.response_metadata?.model_name" style="color: #aeaea2; font-size: 10px;">
                ({{ msg.response_metadata.model_provider }}: {{ msg.response_metadata.model_name }})
              </span>
            </div>
            <!-- 内容 -->
            <div style="color: #3a3a3c; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;">
              {{ msg.content }}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入依赖 ====================
// Vue 核心功能
import { ref, nextTick, onMounted, onUnmounted, computed, watchEffect } from 'vue'

// 状态管理和工具函数
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useUserClientStore } from '@/stores/userClientStore'
import { useAiHomeworkChatStore } from '@/stores/aiHomeworkChatStore'
import { useHtmlPreviewChatStore } from '@/stores/htmlPreviewChatStore'
import { useImagePicker } from '@/composables/useImagePicker'
import { androidBridge } from '@/services/business/android-bridge'
import { showMessage } from '@/utils'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { apiService } from '@/services'

// 子组件导入
import ChatMessage from '@/components/chat/message/ChatMessage.vue'
import ChatInput from '@/components/chat/Input/ChatInput.vue'
import SuggestedQuestions from '@/components/chat/message/SuggestedQuestions.vue'
import Modal from '@/components/base/Modal.vue'
import SimpleChatInput from '@/components/chat/Input/SimpleChatInput.vue'
import CardStack from '@/components/base/CardStack.vue'
import RubberBandList from '@/components/base/VirtualScroll.vue'
import TeacherSelectionDialog from '@/components/dialog/TeacherSelectionDialog.vue'
import Dialog from '@/components/base/Dialog.vue'
import Checkbox from '@/components/base/Checkbox.vue'
import Button from '@/components/base/Button.vue'
import ImageCropOverlay from '@/components/base/ImageCropper.vue'
import ScreenshotInputDialog from '@/components/dialog/ImageProcessorDialog.vue'

// 类型定义导入
import type { ChatBubble, AttachedScreenshot } from '@/types'
import type { ChatImageData } from '@/stores/utils/chatStoreUtils'
import type { HtmlPreviewFocus } from '@/types'
import type { BuiltinToolType, ToolbarTool } from '@/types/toolbarTools'
import { Sender } from '@/types/enums'

interface ScreenshotDrawingState {
  objects: unknown
  history: unknown
  historyIndex: number
}

// 策略模式导入
import { ChatStrategyFactory, type ChatStrategy, type ChatViewInterface } from './strategies'
import { findLastUserMessageIndex } from './messageActionVisibility'

// ==================== 组件配置 ====================
// 定义组件属性 - 支持AI和老师两种对话模式
// 使用内联类型定义的泛型形式，确保 Vue 编译器能正确提取所有 props（包括可选属性）
// 这种方式比导入外部类型接口更可靠，因为 Vue 可以在编译时直接访问类型信息
const props = withDefaults(
  defineProps<{
    type: 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client' | 'html-preview'
    resourceId?: string
    compressedHeight?: number // 键盘显示时 ChatView 的压缩高度（像素）
    inputMode?: 'full' | 'simple' // 输入模式：full=完整输入(ChatInput)，simple=简单输入(SimpleChatInput)
    size?: 'large' | 'small' // 可选：界面大小选择，large=默认大，small=紧凑
    // 当前题目对象，由外层页面维护，ChatView 不直接依赖全局 questionStore
    question?: unknown
    attachedScreenshots?: AttachedScreenshot[]
    showFooterText?: boolean // 是否显示底部提示文案
    showToolbar?: boolean // 是否显示输入区域顶部工具栏
    hideAskTeacherIcon?: boolean // 是否隐藏问老师图标
    showActionButtons?: boolean // 是否显示消息气泡的功能按钮
    enableLongPress?: boolean // 是否启用消息长按功能
    showReadStatus?: boolean // 是否显示消息已读状态
    showTime?: boolean // 是否显示消息时间
    toolbarTools?: (BuiltinToolType | ToolbarTool)[] // 工具栏工具配置数组（支持字符串或对象）
    hideHistory?: boolean // 是否隐藏历史记录
  }>(),
  {
    inputMode: 'full',
    size: 'large',
    showFooterText: true, // 默认显示底部文案
    showToolbar: true, // 默认显示顶部工具栏
    showActionButtons: true, // 默认显示消息功能按钮
    enableLongPress: true, // 默认启用长按功能
    showReadStatus: false, // 默认不显示已读状态
    showTime: false, // 默认不显示时间
    hideHistory: false, // 默认显示历史
  }
)

// 定义组件事件 - 支持响应、切换、焦点、滚动等事件
const emit = defineEmits<{
  response: [] // 消息发送完成事件
  switchToTeacher: [
    {
      messages: ChatBubble[]
      currentQuestion: unknown
      additionalMessage?: string
      forwardMode?: string
      successCount?: number
      sessionId?: string
    }
  ] // 切换到老师对话事件
  'switch-to-teacher': [
    {
      messages: ChatBubble[]
      currentQuestion: unknown
      additionalMessage?: string
      forwardMode?: string
      successCount?: number
      sessionId?: string
    }
  ]
  focus: [] // 输入框获得焦点事件
  'scroll-to-bottom': [] // 滚动到底部事件
  'scroll-to-message': [messageId: string] // 滚动到指定消息事件
  'open-teacher-dialog': [{ sessionId: string; message?: import('../../types').ChatBubble }] // 打开老师对话框事件
  'remove-screenshot': [string]
  'send-with-screenshot': [string, import('../../types').AttachedScreenshot[], string]
  'focus-input': [] // 聚焦输入框事件
  'send-message': [string] // 发送消息事件（用于推荐问题点击）
  'paste-to-draft': [payload: { dataUrl: string; messageId: string }]
  'edit-screenshot': [id: string]
  'screenshot-click': [] // 截图/选中并问按钮点击事件（统一处理 screenshot 和 select-and-ask）
  'request-screenshot': [payload: { kind: 'screen_snapshot' | 'pdf_page' }] // 请求截图事件，由父组件处理
  'new-session-click': [] // 新建会话按钮点击事件
  'open-html-preview': [payload: { url: string; html?: string }] // HTML 预览点击事件，由父组件处理
}>()

const toSenderEnum = (sender: 'ai' | 'teacher' | 'user'): Sender => {
  if (sender === 'teacher') return Sender.TEACHER
  if (sender === 'user') return Sender.USER
  return Sender.AI
}

// ==================== 状态管理 ====================
// 全局状态管理

// 场景Store
const aiExerciseStore = useAiExerciseChatStore()
const aiTextbookStore = useAiTextbookChatStore()
const teacherStore = useTeacherChatStore()
const userClientStore = useUserClientStore()

// 记录组件挂载时间，用于 hideHistory 模式下的消息过滤
const mountTime = ref(Date.now())

// 输入框截图附件与绘图状态：统一由策略内部读写 store，ChatView 仅通过策略接口访问
const strategyInputAttachedScreenshots = computed<AttachedScreenshot[]>(() => {
  return chatStrategy.value?.getInputAttachedScreenshots?.() ?? []
})

const strategyInputScreenshotDrawingStates = computed<Record<string, unknown>>(() => {
  return chatStrategy.value?.getInputScreenshotDrawingStates?.() ?? {}
})

const strategyInputScreenshotDrawingStatesForDialog = computed(() => {
  return strategyInputScreenshotDrawingStates.value as Record<string, ScreenshotDrawingState>
})

// Markdown + 公式渲染工具（用于会话卡片快照）
const { renderMessageContent } = useMessageRenderer()

const handlePasteToDraft = (payload: { dataUrl: string; messageId: string }) => {
  emit('paste-to-draft', payload)
}

// 策略模式：创建聊天策略实例
const chatStrategy = ref<ChatStrategy>()

/**
 * 创建策略实例的辅助函数
 * 根据当前 props 和状态创建对应的策略
 */
const createStrategy = () => {
  // 创建策略实例
  // 如果是teacher类型但store中没有session，延迟创建策略（等待session初始化完成）
  if (props.type === 'teacher' && !teacherStore.currentSession) {
    // 延迟创建策略，等待session初始化完成
    // 策略将在store.currentSession的watch中创建
    return
  }

  // ChatView接口实现
  // 提供给策略调用的方法和状态访问
  const chatViewInterface: ChatViewInterface = {
    // 滚动控制
    scrollToBottom,
    checkIfUserAtBottom,

    // 题目切换
    executeQuestionSwitch,

    // 状态访问
    getLastMessageCount: () => lastMessageCount.value,
    setLastMessageCount: (count: number) => lastMessageCount.value = count,
    getIsUserAtBottom: () => isUserAtBottom.value,
    setIsUserAtBottom: (isAtBottom: boolean) => isUserAtBottom.value = isAtBottom,
    getShowNewMessageIndicator: () => showNewMessageIndicator.value,
    setShowNewMessageIndicator: (show: boolean) => showNewMessageIndicator.value = show,
    getIsKeyboardVisible: () => isKeyboardVisible.value,
    getIsKeyboardAnimating: () => isKeyboardAnimating.value,

    // 消息操作
    getDisplayedMessages: () => displayedMessages.value,
    emitResponse: () => emit('response'),

    // 编辑相关
    getIsEditingMessage: () => isEditingMessage.value,
    setIsEditingMessage: (editing: boolean) => isEditingMessage.value = editing,
    getEditingQuestionId: () => editingQuestionId.value || undefined,
    cancelEditMessage,
    clearInputContent: () => {
      if (chatInputRef.value && typeof chatInputRef.value.clearInputContent === 'function') {
        chatInputRef.value.clearInputContent()
      }
    }
  }

  chatStrategy.value = ChatStrategyFactory.create(props.type, {
    chatView: chatViewInterface
  })
}

// 组件引用
const chatViewRef = ref<HTMLElement>() // 聊天视图容器引用
const chatInputRef = ref<InstanceType<typeof ChatInput>>() // 完整输入组件引用
const simpleChatInputRef = ref<InstanceType<typeof SimpleChatInput>>() // 简单输入组件引用
const cardStackRef = ref<InstanceType<typeof CardStack> | null>(null) // 会话卡片堆叠组件引用
const rubberBandListRef = ref<InstanceType<typeof RubberBandList> | null>(null) // 橡皮筋列表引用

// 调试上下文逻辑
const debugContextDialogRef = ref<any>(null)
const debugContextJson = ref('')
const latestHistoryList = ref<any[]>([])
const isTestEnv = computed(() => localStorage.getItem('app_env_type') === 'INTERNAL_TEST')

// 动态获取当前活跃的会话 ID
const currentSessionId = computed(() => {
  if (props.type === 'ai-general') {
    return useAiGeneralChatStore().currentSession?.sessionId
  }
  if (props.type === 'ai-exercise') {
    return useAiExerciseChatStore().currentSessionId
  }
  if (props.type === 'ai-homework') {
    return useAiHomeworkChatStore().currentSession?.sessionId
  }
  if (props.type === 'ai-textbook') {
    return useAiTextbookChatStore().currentSessionId
  }
  if (props.type === 'user-client') {
    return useUserClientStore().currentSession?.sessionId
  }
  if (props.type === 'html-preview') {
    return useHtmlPreviewChatStore().sessionId
  }
  return null
})

const openDebugDialog = async () => {
  const sid = currentSessionId.value
  let history = null

  if (sid) {
    try {
      const agentName = (props.type === 'ai-exercise' || props.type === 'ai-homework') ? 'solvingbot' : 'chatbot'
      const response = await apiService.getShortTermMemory(sid, agentName)
      if (response && response.success && response.data && Array.isArray(response.data.data)) {
        history = response.data.data
      }
    } catch (e) {
      console.warn('[ChatView] 获取后端短期记忆失败:', e)
    }
  }

  latestHistoryList.value = history || []
  debugContextJson.value = history && history.length > 0
    ? JSON.stringify(history, null, 2)
    : '暂无历史上下文消息，且未能从后端拉取到记忆。'
  debugContextDialogRef.value?.openDialog()
}

const closeDebugContext = () => {
  debugContextDialogRef.value?.closeDialog()
}

const copyDebugContext = () => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(debugContextJson.value)
      .then(() => showMessage('已复制到剪贴板', 'success'))
      .catch(() => showMessage('复制失败', 'warning'))
  } else {
    const textarea = document.createElement('textarea')
    textarea.value = debugContextJson.value
    textarea.style.position = 'fixed'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      showMessage('已复制到剪贴板', 'success')
    } catch (e) {
      showMessage('复制失败', 'warning')
    }
    document.body.removeChild(textarea)
  }
}

const handleSendWithScreenshot = (shots: AttachedScreenshot[]) => {
  if (
    props.type === 'ai-general' ||
    props.type === 'ai-exercise' ||
    props.type === 'ai-homework' ||
    props.type === 'ai-textbook' ||
    props.type === 'user-client' ||
    props.type === 'html-preview'
  ) {
    void sendMessage()
  } else {
    emit('send-with-screenshot', inputMessage.value, shots, selectedModel.value)
  }
}

const handleEditScreenshot = (id: string) => {
  if (!id) return

  openScreenshotEditor({
    mode: 'multiple',
    initialShotId: id,
    lastCapturedShotId: '',
  })
}

const requestScreenshot = () => {
  const kind = chatStrategy.value?.getScreenshotEntryKind?.() ?? 'screen_snapshot'
  // 直接 emit 事件给父组件处理，不再使用全局事件
  emit('request-screenshot', { kind })
}

const onImageSelected = async (imageData: ChatImageData) => {
  // ChatView 不再负责截图编辑弹窗，这里仅负责"把图挂到输入框缩略图区 / 或交给上层处理"
  if (!imageData?.base64DataUrl) return

    // ai-general / ai-exercise / ai-homework / user-client：直接打开截图编辑器（包含裁剪和标注）
    if (
      props.type === 'ai-general' ||
      props.type === 'ai-exercise' ||
      props.type === 'ai-homework' ||
      props.type === 'ai-textbook' ||
      props.type === 'user-client' ||
      props.type === 'html-preview'
    ) {
      const maxImages = chatStrategy.value?.getMaxAttachedImages?.() ?? (props.type === 'user-client' ? 5 : 3)
      if (strategyInputAttachedScreenshots.value.length >= maxImages) {
        showMessage(`最多只能添加 ${maxImages} 张图片`, 'info')
        return
      }

      // 生成截图 ID 并挂载
      const shotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const newShot: AttachedScreenshot = {
        id: shotId,
        dataUrl: imageData.base64DataUrl,
        originalDataUrl: imageData.base64DataUrl,
        width: imageData.width || 0,
        height: imageData.height || 0,
      }
      
      if (chatStrategy.value?.appendInputAttachedScreenshots) {
        chatStrategy.value.appendInputAttachedScreenshots([newShot])
      }

      // 直接打开编辑器
      openScreenshotEditor({
        mode: 'multiple',
        initialShotId: shotId,
        lastCapturedShotId: shotId,
      })
      return
    }

  // 其它场景：走策略的"发送图片"逻辑
  if (!chatStrategy.value?.sendImageMessage) return

  await chatStrategy.value.sendImageMessage(
    {
      filePath: imageData.filePath || '',
      width: imageData.width || 0,
      height: imageData.height || 0,
      fileSize: imageData.fileSize || 0,
      base64DataUrl: imageData.base64DataUrl,
    },
    inputMessage.value,
    {
      selectedModel: selectedModel.value,
    },
  )
}

// 图片裁剪取消处理
const handleImageCropCancel = () => {
  pendingImageData.value = null
  imageCropSrc.value = ''
  showImageCropDialog.value = false
}

const handlePostProcessedImage = async (imageData: ChatImageData) => {
  const mode = chatStrategy.value?.getImagePostProcessMode?.() ?? 'attach_to_input'
  if (mode === 'send_immediately') {
    if (!chatStrategy.value?.sendImageMessage) return
    await chatStrategy.value.sendImageMessage(
      {
        filePath: imageData.filePath || '',
        width: imageData.width || 0,
        height: imageData.height || 0,
        fileSize: imageData.fileSize || 0,
        base64DataUrl: imageData.base64DataUrl,
      },
      inputMessage.value,
      {
        selectedModel: selectedModel.value,
      },
    )
    return
  }

  await attachImageDirectToPreview(imageData)
}

// 处理裁剪后的图片
const processCroppedImage = async (imageData: ChatImageData) => {
  if (!imageData?.base64DataUrl) return

  // ai-general / ai-exercise / ai-homework / user-client：将裁剪后的图片挂载到输入框缩略图区
  if (
    props.type === 'ai-general' ||
    props.type === 'ai-exercise' ||
    props.type === 'ai-homework' ||
    props.type === 'ai-textbook' ||
    props.type === 'user-client' ||
    props.type === 'html-preview'
  ) {
    const shot: AttachedScreenshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dataUrl: imageData.base64DataUrl, // 裁剪后的缩略图
      originalDataUrl: imageData.base64DataUrl, // 裁剪后的原图
      width: imageData.width || 0,
      height: imageData.height || 0,
    }

    // 由策略内部操作 store
    if (chatStrategy.value?.appendInputAttachedScreenshots) {
      chatStrategy.value.appendInputAttachedScreenshots([shot])
    } else if (chatStrategy.value?.setInputAttachedScreenshots && chatStrategy.value?.getInputAttachedScreenshots) {
      const current = chatStrategy.value.getInputAttachedScreenshots() || []
      chatStrategy.value.setInputAttachedScreenshots(current.concat([shot]))
    }
    return
  }

  // 其它场景：走策略的"发送图片"逻辑
  if (!chatStrategy.value?.sendImageMessage) return

  await chatStrategy.value.sendImageMessage(
    {
      filePath: imageData.filePath || '',
      width: imageData.width || 0,
      height: imageData.height || 0,
      fileSize: imageData.fileSize || 0,
      base64DataUrl: imageData.base64DataUrl,
    },
    inputMessage.value,
    {
      selectedModel: selectedModel.value,
    },
  )
}

const attachImageDirectToPreview = async (imageData: ChatImageData) => {
  if (!imageData?.base64DataUrl) return

  // ai-general / ai-exercise / ai-homework / user-client：直接挂到输入框缩略图区（不再触发裁剪）
  if (
    props.type === 'ai-general' ||
    props.type === 'ai-exercise' ||
    props.type === 'ai-homework' ||
    props.type === 'ai-textbook' ||
    props.type === 'user-client' ||
    props.type === 'html-preview'
  ) {
    const maxImages = chatStrategy.value?.getMaxAttachedImages?.() ?? (props.type === 'user-client' ? 5 : 3)
    if (strategyInputAttachedScreenshots.value.length >= maxImages) {
      showMessage(`最多只能添加 ${maxImages} 张图片`, 'info')
      return
    }

    await processCroppedImage(imageData)
    return
  }

  // 其它场景：走策略的"发送图片"逻辑
  if (!chatStrategy.value?.sendImageMessage) return
  await chatStrategy.value.sendImageMessage(
    {
      filePath: imageData.filePath || '',
      width: imageData.width || 0,
      height: imageData.height || 0,
      fileSize: imageData.fileSize || 0,
      base64DataUrl: imageData.base64DataUrl,
    },
    inputMessage.value,
    {
      selectedModel: selectedModel.value,
    },
  )
}

// 图片裁剪确认处理 - 适配新组件
const handleImageCropConfirm = async (croppedDataUrl: string) => {
  if (!pendingImageData.value) return
  
  try {
    pendingAnnotateImageData.value = pendingImageData.value

    const shouldAnnotate = chatStrategy.value?.shouldAnnotateAfterCrop?.() ?? true
    if (shouldAnnotate) {
      // 生成正式截图ID并创建截图对象
      const shotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const newShot: AttachedScreenshot = {
        id: shotId,
        dataUrl: croppedDataUrl,
        originalDataUrl: croppedDataUrl,
        width: pendingImageData.value?.width || 0,
        height: pendingImageData.value?.height || 0,
      }
      
      // 先添加到store，再打开编辑器编辑
      if (chatStrategy.value?.appendInputAttachedScreenshots) {
        chatStrategy.value.appendInputAttachedScreenshots([newShot])
      }
      
      openScreenshotEditor({
        mode: 'multiple',
        initialShotId: shotId,
        lastCapturedShotId: shotId,
      })
    } else {
      // 不需要标记：直接进入后续处理
      const base = pendingAnnotateImageData.value
      const finalImageData: ChatImageData = {
        ...(base || { filePath: '', width: 0, height: 0, fileSize: 0 }),
        base64DataUrl: croppedDataUrl,
        width: base?.width || 0,
        height: base?.height || 0,
      }
      await handlePostProcessedImage(finalImageData)
      pendingAnnotateImageData.value = null
    }

    pendingImageData.value = null
    imageCropSrc.value = ''
    showImageCropDialog.value = false
  } catch (error) {
    console.error('[ChatView] 图片裁剪失败:', error)
    showMessage('图片裁剪失败，请重试', 'error')
  }
}

const screenshotEditorVisible = ref(false)
const screenshotEditorMode = ref<'single' | 'multiple'>('multiple')
const screenshotEditorInitialShotId = ref('')
const screenshotEditorLastCapturedShotId = ref('')

// 图片裁剪相关状态
const pendingImageData = ref<ChatImageData | null>(null)
const pendingAnnotateImageData = ref<ChatImageData | null>(null)
const imageCropSrc = ref('')
const showImageCropDialog = ref(false)
const editingShotId = ref('')

const openScreenshotEditor = (payload?: {
  mode?: 'single' | 'multiple'
  initialShotId?: string
  lastCapturedShotId?: string
}) => {
  screenshotEditorMode.value = payload?.mode ?? 'multiple'
  screenshotEditorInitialShotId.value = payload?.initialShotId || ''
  screenshotEditorLastCapturedShotId.value = payload?.lastCapturedShotId || ''
  screenshotEditorVisible.value = true
}

const closeScreenshotEditor = () => {
  screenshotEditorVisible.value = false
  screenshotEditorMode.value = 'multiple'
  screenshotEditorInitialShotId.value = ''
  screenshotEditorLastCapturedShotId.value = ''
  pendingAnnotateImageData.value = null
}

const openTextbookScreenshotEditor = (payload?: { shotId?: string; lastCapturedShotId?: string }) => {
  if (props.type !== 'ai-textbook') return
  openScreenshotEditor({
    initialShotId: payload?.shotId || '',
    lastCapturedShotId: payload?.lastCapturedShotId || '',
  })
}

const handleScreenshotEditorConfirm = (
  shots: AttachedScreenshot[],
  states: Record<string, ScreenshotDrawingState>,
) => {
  if (!shots || shots.length === 0) return

  // 教材：多图模式下全量覆盖
  if (screenshotEditorMode.value === 'multiple') {
    chatStrategy.value?.setInputAttachedScreenshots?.(shots)
    chatStrategy.value?.setInputScreenshotDrawingStates?.(states as any)
    closeScreenshotEditor()
    return
  }

  // 单图：复用原来的 confirm 行为（支持“编辑已有缩略图”与“新增”两种）
  void handleScreenshotInputConfirm(shots, states)
}

const handleScreenshotEditorAddMore = (
  shots: AttachedScreenshot[],
  states: Record<string, ScreenshotDrawingState>,
) => {
  if (!shots || shots.length === 0) return

  chatStrategy.value?.setInputAttachedScreenshots?.(shots)
  chatStrategy.value?.setInputScreenshotDrawingStates?.(states as any)

  closeScreenshotEditor()
  requestScreenshot()
}

const handleScreenshotEditorCancel = () => {
  const shotId = screenshotEditorInitialShotId.value
  const lastCapturedId = screenshotEditorLastCapturedShotId.value

  closeScreenshotEditor()
  editingShotId.value = ''

  // 取消=放弃本次“刚截图新建的那张”（仅当 lastCapturedShotId 命中时回滚）
  if (shotId && lastCapturedId && shotId === lastCapturedId) {
    chatStrategy.value?.removeInputAttachedScreenshot?.(shotId)
  }
}

const handleScreenshotEditorRemove = (id: string) => {
  if (!id) return

  chatStrategy.value?.removeInputAttachedScreenshot?.(id)

  if ((chatStrategy.value?.getInputAttachedScreenshots?.() || []).length === 0) {
    closeScreenshotEditor()
  }
}

const handleScreenshotInputConfirm = async (
  shots: AttachedScreenshot[],
  states: Record<string, ScreenshotDrawingState>,
) => {
  // 先关闭弹窗（但不要立刻清空 editingShotId，否则无法判断“编辑/新增”分支）
  screenshotEditorVisible.value = false

  // 由策略内部写 store
  chatStrategy.value?.setInputScreenshotDrawingStates?.(states as any)

  // 编辑已有缩略图：按 id 覆盖更新，不走“新增附件/发送”逻辑
  if (editingShotId.value) {
    const edited = shots?.[0]
    if (edited?.id) {
      const current = chatStrategy.value?.getInputAttachedScreenshots?.() ?? []
      const updated = current.map((s) =>
        s.id === edited.id ? { ...s, ...edited } : s
      )
      chatStrategy.value?.setInputAttachedScreenshots?.(updated)
    }

    pendingAnnotateImageData.value = null
    editingShotId.value = ''
    closeScreenshotEditor()
    return
  }

  const first = shots?.[0]
  if (!first?.dataUrl) {
    pendingAnnotateImageData.value = null
    return
  }

  const base = pendingAnnotateImageData.value
  const finalImageData: ChatImageData = {
    ...(base || { filePath: '', width: 0, height: 0, fileSize: 0 }),
    base64DataUrl: first.dataUrl,
    width: first.width || base?.width || 0,
    height: first.height || base?.height || 0,
  }

  await handlePostProcessedImage(finalImageData)

  pendingAnnotateImageData.value = null
  closeScreenshotEditor()
}

// 处理 ChatInput 发出的移除缩略图事件
const handleRemoveScreenshot = (id: string) => {
  console.log('[ChatView] 删除截图前:', { id })

  // 统一由策略内部操作 store（ai-textbook 也走策略）
  chatStrategy.value?.removeInputAttachedScreenshot?.(id)

  console.log('[ChatView] 删除截图后:', { id })
}

// 会话卡片数据（用于 CardStack v-model）- 通过策略接口获取
const sessionCards = computed(() => {
  return chatStrategy.value?.getSessionCards?.() ?? []
})

// 新建会话 - 通过策略接口
const handleCreateNewSession = async () => {
  try {
    if (!chatStrategy.value?.createNewSession) {
      return // 当前策略不支持会话管理
    }
    await chatStrategy.value.createNewSession({
      currentQuestion: currentQuestion.value ?? undefined,
    })
    showSessionListPanel.value = false
  } catch (error) {
    console.error('[ChatView] 新建会话失败:', error)
    showMessage('新建会话失败', 'error')
  }
}

// 切换会话 - 通过策略接口
const handleSwitchSession = async (sessionId: string) => {
  try {
    if (!chatStrategy.value?.switchToSession) {
      return // 当前策略不支持会话管理
    }
    await chatStrategy.value.switchToSession(sessionId)
    showSessionListPanel.value = false
  } catch (error) {
    console.error('[ChatView] 切换会话失败:', error)
    showMessage('切换会话失败', 'error')
  }
}

// 删除会话确认对话框状态
const deleteSessionDialogRef = ref<InstanceType<typeof Dialog>>()
const pendingDeleteSessionId = ref<string | null>(null)
const pendingDeleteSessionTitle = ref('')

// 老师选择对话框状态
const showTeacherSelectionDialog = ref(false)
let teacherSelectionResolve: ((subject: 'biology' | 'math') => void) | null = null

// 转发成功对话框状态
const forwardSuccessDialogRef = ref<InstanceType<typeof Dialog>>()
const forwardSuccessMessage = ref('')
let forwardSuccessResolve: ((result: { goToTeacher: boolean; sessionId?: string }) => void) | null =
  null

// 请求删除会话（显示确认对话框）
const handleDeleteSessionRequest = (sessionId: string) => {
  // 只有支持会话管理的策略才能删除会话
  if (chatStrategy.value?.deleteSession) {
    // 查找会话标题
    const cards = sessionCards.value as Array<{ id: string; title?: string }>
    const session = cards.find((s) => s.id === sessionId)
    pendingDeleteSessionId.value = sessionId
    pendingDeleteSessionTitle.value = session?.title || '该会话'
    deleteSessionDialogRef.value?.openDialog()
  }
}

// 处理老师选择
const handleTeacherSelected = (subject: 'biology' | 'math') => {
  if (teacherSelectionResolve) {
    teacherSelectionResolve(subject)
    teacherSelectionResolve = null
  }
}

// 显示老师选择对话框
const showTeacherSelection = (): Promise<'biology' | 'math'> => {
  return new Promise((resolve) => {
    teacherSelectionResolve = resolve
    showTeacherSelectionDialog.value = true
  })
}

// 确认删除会话 - 通过策略接口
const confirmDeleteSession = async () => {
  try {
    if (pendingDeleteSessionId.value && chatStrategy.value?.deleteSession) {
      // 先执行 CardStack 的删除动画
      if (cardStackRef.value?.handleRemove) {
        cardStackRef.value.handleRemove(pendingDeleteSessionId.value)
      }

      // 然后通过策略删除会话
      await chatStrategy.value.deleteSession(pendingDeleteSessionId.value, {
        currentQuestion: currentQuestion.value ?? undefined,
      })
    }
  } catch (error) {
    console.error('[ChatView] 删除会话失败:', error)
    showMessage('删除会话失败', 'error')
  } finally {
    // 关闭对话框并清理状态
    deleteSessionDialogRef.value?.closeDialog()
    pendingDeleteSessionId.value = null
    pendingDeleteSessionTitle.value = ''
  }
}

// 取消删除会话
const cancelDeleteSession = () => {
  deleteSessionDialogRef.value?.closeDialog()
  pendingDeleteSessionId.value = null
  pendingDeleteSessionTitle.value = ''
}

// 显示转发成功对话框
const showForwardSuccessDialog = (
  message: string,
  sessionId?: string
): Promise<{ goToTeacher: boolean; sessionId?: string }> => {
  return new Promise((resolve) => {
    forwardSuccessMessage.value = message
    forwardSuccessResolve = (result: { goToTeacher: boolean }) => resolve({ ...result, sessionId })
    forwardSuccessDialogRef.value?.openDialog()
  })
}

// 处理转发成功对话框确认
const handleForwardSuccessConfirm = () => {
  if (forwardSuccessResolve) {
    // 这里需要从消息中解析 sessionId，暂时传递空值，后续可以优化
    forwardSuccessResolve({ goToTeacher: true })
    forwardSuccessResolve = null
  }

  forwardSuccessDialogRef.value?.closeDialog()
}

// 处理转发成功对话框取消
const handleForwardSuccessCancel = () => {
  if (forwardSuccessResolve) {
    forwardSuccessResolve({ goToTeacher: false })
    forwardSuccessResolve = null
  }

  forwardSuccessDialogRef.value?.closeDialog()
}

// 新建会话卡片（兼容旧接口）
const addSessionCard = (cardData?: Record<string, unknown>) => {
  handleCreateNewSession()
  return cardData
}

// 基础状态变量
const inputMessage = ref('')
const inputDisplayContent = ref<string | undefined>(undefined) // 输入框内容
const isLoading = ref(false) // 消息发送加载状态
const isRecording = ref(false) // 语音录制状态
const quotedMessage = ref<ChatBubble | null>(null) // 引用的消息
// 会话列表面板显示状态（用于在 ChatView 内部管理多个会话的列表展示）
const showSessionListPanel = ref(false)
// 当前高亮的 sessionId（用于整段会话高亮）
// 对话相关状态（需要在策略初始化之前声明）
const currentSubject = ref<string>('math') // 当前科目，默认为数学

// 新消息指示器状态
const showNewMessageIndicator = ref(false) // 是否显示新消息提示按钮
const lastMessageCount = ref(0) // 上次消息数量，用于检测新消息
const isUserAtBottom = ref(true) // 用户是否在滚动底部

// ==================== 键盘动画相关状态 ====================
// 键盘显示/隐藏状态
const isKeyboardVisible = ref(false) // 键盘是否可见
const isKeyboardAnimating = ref(false) // 键盘是否正在执行动画
const isAnimating = ref(false) // 是否正在执行动画（防重复触发）
// 当前 ChatView 是否为“激活实例”（有输入焦点），用于避免多个 ChatView 同时压缩高度
const isActiveInstance = ref(false)

// 公式键盘状态标记 - 用于解决平板设备双重键盘事件冲突
const isFormulaKeyboardVisible = ref(false) // 公式虚拟键盘是否可见

// 高度相关状态
const originalChatViewHeight = ref(0) // 记录ChatView的原始高度
const keyboardHeight = ref(0) // 键盘高度
const keyboardAnimationHeight = ref(0) // 键盘动画高度
const originalViewportHeight = ref(0) // 原始视口高度

// 动画时间控制
const animationStartTime = ref(0) // 动画开始时间

// Android原生键盘动画参数 - 与系统键盘动画完全一致
// const animationDuration = ref(300) // Android系统默认键盘动画时长（毫秒）
// const animationCurve = ref('cubic-bezier(0.4, 0.0, 0.2, 1)') // Android fast_out_slow_in 缓动曲线

// ==================== 工具函数 ====================
/**
 * 获取CSS动画参数
 * 作用：从CSS变量获取键盘动画的CSS参数，包括持续时间、缓动曲线和延迟时间
 * 返回：包含动画参数的对象
 */
const getCSSAnimationParams = () => {
  if (typeof window !== 'undefined') {
    const computedStyle = getComputedStyle(document.documentElement)
    const duration = computedStyle.getPropertyValue('--keyboard-animation-duration')
    const curve = computedStyle.getPropertyValue('--keyboard-animation-curve')
    const delay = computedStyle.getPropertyValue('--keyboard-animation-delay')

    return {
      duration: duration || '150ms',
      curve: curve || 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      delay: delay || '50ms',
    }
  }
  return {
    duration: '100ms',
    curve: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    delay: '50ms',
  }
}

// ==================== 计算属性 ====================
// 使用策略接口获取联网搜索状态
const enableWebSearch = computed(() => chatStrategy.value?.getEnableWebSearch?.() ?? false)
const selectedModel = ref('mate') // 选中的AI模型

// ==================== 消息管理相关状态 ====================
// 选择模式相关状态
const isSelectionMode = ref(false) // 是否处于消息选择模式
const selectedMessages = ref<Set<string>>(new Set()) // 已选择的消息ID集合
const selectionMode = ref<'normal' | 'ask-teacher'>('normal') // 选择模式类型

// 消息显示相关状态
// 使用 computed 自动同步策略中的消息列表，无需手动 watch
// 将包含图片和文字的消息拆分成两个独立的气泡：图片在前，文字在后
const displayedMessages = computed<ChatBubble[]>(() => {
  if (!chatStrategy.value) {
    return []
  }

  const rawMessages = chatStrategy.value.getMessages() || []

  // 处理 hideHistory 逻辑：只显示挂载后产生的新消息
  let baseMessages = rawMessages
  if (props.hideHistory) {
    baseMessages = rawMessages.filter(msg => {
      // 正在流式传输的消息或者是挂载后产生的消息
      const isNew = msg.isStreaming || (msg.timestamp && new Date(msg.timestamp).getTime() > mountTime.value)
      return isNew
    })
  }

  // 对基础消息进行格式化处理（如拆分图片和文字）
  const result: ChatBubble[] = []

  for (let i = 0; i < baseMessages.length; i++) {
    const message = baseMessages[i]

    // 如果消息是图片类型，且同时包含图片和文字内容
    // 教师对话场景下：图片消息就是图片，不拆分渲染为文字
    if (
      props.type !== 'teacher' &&
      message.messageType === 'image' &&
      message.imageData &&
      message.imageData.base64DataUrl &&
      message.content &&
      message.content.trim()
    ) {
      // 第一条：只显示图片（清空文字内容）
      const imageMessage: ChatBubble = {
        ...message,
        content: '', // 清空文字内容，只显示图片
        id: message.id + '_image', // 添加后缀以区分
      }
      result.push(imageMessage)

      // 第二条：只显示文字（清空图片数据）
      const textMessage: ChatBubble = {
        ...message,
        messageType: 'text', // 改为文本类型
        imageData: undefined, // 清空图片数据
        id: message.id + '_text', // 添加后缀以区分
      }
      result.push(textMessage)

      // 注意：时间分隔符的处理移到循环外部，由正常的消息处理逻辑来处理
    } else {
      // 直接添加消息（包括时间分隔符消息）
      result.push(message)
    }
  }

  return result
})

// 判断是否全选
const isAllSelected = computed(() => {
  return (
    displayedMessages.value.length > 0 &&
    selectedMessages.value.size === displayedMessages.value.length
  )
})

// 时间分隔条相关函数

/**
 * 判断消息是否是最后一条
 * 作用：确保 isLastMessage prop 始终是布尔类型，避免传递 undefined
 * @param index 消息索引
 * @returns 是否是最后一条消息（布尔值）
 */
const isLastMessage = (index: number): boolean => {
  const messages = displayedMessages.value ?? []
  const length = messages.length
  return index === length - 1
}

const lastUserMessageIndex = computed((): number => {
  return findLastUserMessageIndex(displayedMessages.value ?? [])
})

// ==================== 编辑功能相关状态 ====================
const isEditingMessage = ref(false) // 是否正在编辑消息
const editingMessageId = ref<string | null>(null) // 正在编辑的消息ID
const originalMessageContent = ref<string>('') // 原始消息内容（用于取消编辑时恢复）
const editingQuestionId = ref<string | null>(null) // 记录正在编辑的题目ID

// 编辑模式确认对话框状态

// ==================== 消息管理函数 ====================
/**
 * 添加单条消息到存储（策略模式重构版）
 * 策略模式：使用策略的 addMessage() 方法
 */
const addMessageToStore = async (message: ChatBubble) => {
  if (chatStrategy.value) {
    await chatStrategy.value.addMessage(message)
  }
}

/**
 * 批量添加消息到存储（策略模式重构版）
 * 策略模式：循环调用策略的 addMessage() 方法
 */
const addMessagesToStore = async (messages: ChatBubble[]) => {
  if (chatStrategy.value) {
    for (const message of messages) {
      await chatStrategy.value.addMessage(message)
    }
  }
}
// ==================== 其他功能相关状态 ====================
// 文件上传相关状态
const uploadedFiles = ref<Array<{ id: string; name: string; file: File }>>([]) // 已上传的文件列表
const activeMode = ref<{ label: string; icon: string; color: string } | null>(null) // 当前激活的模式

// 全局图片选择器
const { pickImage } = useImagePicker()

// 图片裁剪相关状态

// ==================== 计算属性 ====================
// 滚动条样式配置

/**
 * 获取当前题目
 * 作用：统一获取当前题目的入口，仅使用外部通过 props 传入的题目
 */
const currentQuestion = computed(() => {
  return (props.question || null) as any
})

/**
 * 检查是否有选中的题目
 * 作用：判断当前是否有选中的题目，用于控制输入框的占位符文本
 */
const hasSelectedQuestion = computed(() => {
  return currentQuestion.value !== null
})

/**
 * 基础占位符文本（策略模式重构版）
 * 作用：根据是否有选中题目和对话类型生成基础占位符文本
 * 逻辑：使用策略的 getPlaceholderText() 方法获取占位符文本
 */
const placeholderText = computed(() => {
  if (chatStrategy.value) {
    return chatStrategy.value.getPlaceholderText(hasSelectedQuestion.value)
  }
  // 兜底逻辑
  if (!hasSelectedQuestion.value) {
    return '可以先聊聊，或选择题目后开始讨论'
  }
  return '向学伴提问...'
})

/**
 * 增强的占位符文本
 * 作用：在基础占位符文本基础上，根据当前状态添加额外信息
 * 逻辑：
 * 1. 有上传文件：显示文件数量信息
 * 2. 有激活模式：显示模式信息
 * 3. 默认：显示基础占位符文本
 */
const enhancedPlaceholderText = computed(() => {
  if (uploadedFiles.value.length > 0) {
    return `基于已上传的${uploadedFiles.value.length}个文件，${placeholderText.value}`
  }
  if (activeMode.value) {
    return `${activeMode.value.label}模式：${placeholderText.value}`
  }
  return placeholderText.value
})

/**
 * 是否可以发送消息
 * 作用：判断当前是否可以发送消息，用于控制发送按钮的启用状态
 * 条件：输入框有内容或已上传文件；且当前不处于会话管理面板（showSessionListPanel = false）
 */
const canSend = computed(() => {
  if (showSessionListPanel.value) return false
  return !!(inputMessage.value.trim() || uploadedFiles.value.length > 0)
})

// 编辑模式下是否可以发送：只有当输入内容非空且和原始内容不同时才允许，且不在会话管理面板中
const canSendInEditMode = computed(() => {
  if (showSessionListPanel.value) return false
  if (!isEditingMessage.value) return false
  const current = inputMessage.value
  const original = originalMessageContent.value || ''
  return current.trim().length > 0 && current !== original
})

// 动态键盘高度（固定值）
const dynamicKeyboardHeight = ref(334) // 固定高度

// ==================== 键盘动画函数 ====================

/**
 * 硬重置键盘相关状态（不做动画，直接清理）
 * 作用：当当前 ChatView 不是激活实例时，也要清掉旧的键盘状态，避免下次 keyboard-show 被旧状态卡住
 */
const hardResetKeyboardState = () => {
  isKeyboardVisible.value = false
  isAnimating.value = false
  isKeyboardAnimating.value = false
  keyboardAnimationHeight.value = 0
  keyboardHeight.value = 0
  originalChatViewHeight.value = 0

  if (chatViewRef.value) {
    chatViewRef.value.style.height = ''
    chatViewRef.value.style.transition = ''
  }
}

/**
 * 处理原生键盘隐藏事件
 * 作用：响应原生键盘隐藏状态，恢复页面高度和清理状态
 * 触发场景：原生键盘隐藏后需要恢复聊天界面布局
 */
const handleKeyboardHidden = () => {
  // 如果当前不是激活实例，不做动画，但需要硬重置键盘状态，防止旧状态影响下次显示
  if (!isActiveInstance.value) {
    console.log(
      '[ChatView][Keyboard] handleKeyboardHidden called for inactive instance, hard reset state only'
    )
    hardResetKeyboardState()
    return
  }
  console.log('[ChatView][Keyboard] handleKeyboardHidden called', {
    isAnimating: isAnimating.value,
    isKeyboardVisible: isKeyboardVisible.value,
  })
  // 步骤1：防重复执行检查
  // 如果正在执行动画，跳过本次调用，避免重复触发
  if (isAnimating.value) {
    console.log('[ChatView][Keyboard] handleKeyboardHidden skipped because isAnimating=true')
    return
  }

  // 步骤2：更新键盘状态
  // 设置键盘为不可见状态，标记正在执行动画
  isKeyboardVisible.value = false
  isAnimating.value = true

  // 步骤3：延迟执行动画
  // 使用nextTick确保Vue状态更新完成后再执行动画
  nextTick(() => {
    console.log('[ChatView][Keyboard] handleKeyboardHidden nextTick -> restoreChatViewHeight')
    animationStartTime.value = Date.now()
    restoreChatViewHeight()
  })
}

/**
 * 压缩ChatView高度（仅用于原生键盘）
 * 作用：将ChatView高度压缩以适应原生键盘显示，并应用平滑的过渡动画
 * 注意：原生键盘不需要滚动，因为压缩后输入框会自动保持在可见区域
 */
const compressChatViewHeight = () => {
  // 仅对当前激活的 ChatView 实例执行压缩动画，避免多实例同时变化
  if (!isActiveInstance.value) {
    return
  }
  console.log('[ChatView][Keyboard] compressChatViewHeight start', {
    isAnimating: isAnimating.value,
    isKeyboardVisible: isKeyboardVisible.value,
  })
  // 步骤1：状态验证
  if (!isAnimating.value || !isKeyboardVisible.value) {
    console.log('[ChatView][Keyboard] compressChatViewHeight aborted by state check')
    return
  }

  // 步骤1.5：检查DOM元素是否存在（关键修复）
  if (!chatViewRef.value) {
    console.warn('[ChatView] [compressChatViewHeight] DOM元素尚未准备好，等待DOM更新', {
      chatViewRefExists: false,
    })
    // 如果DOM还没准备好，等待下一个DOM更新周期
    nextTick(() => {
      if (chatViewRef.value) {
        compressChatViewHeight()
      } else {
        console.error('[ChatView] [compressChatViewHeight] DOM元素仍未准备好，无法继续执行')
      }
    })
    return
  }

  // 步骤2：记录原始高度
  const currentOffsetHeight = chatViewRef.value.offsetHeight
  // 只有在原始高度未设置或当前高度明显不同时才更新（避免设置为0）
  if (originalChatViewHeight.value === 0 && currentOffsetHeight > 0) {
    originalChatViewHeight.value = currentOffsetHeight
    console.log('[ChatView][Keyboard] compressChatViewHeight record original height', {
      originalChatViewHeight: originalChatViewHeight.value,
    })
  } else if (originalChatViewHeight.value === 0 && currentOffsetHeight === 0) {
    console.warn('[ChatView] [compressChatViewHeight] 当前高度为0，无法记录，等待DOM渲染')
    // 如果当前高度还是0，说明DOM还没完全渲染，等待下一个DOM更新周期
    nextTick(() => {
      if (chatViewRef.value && chatViewRef.value.offsetHeight > 0) {
        compressChatViewHeight()
      } else {
        console.error('[ChatView] [compressChatViewHeight] DOM高度仍为0，无法继续执行')
      }
    })
    return
  }

  // 步骤3：获取CSS动画参数
  const cssParams = getCSSAnimationParams()
  // 步骤4：执行高度变化动画
  // 确保原始高度有效（大于0）
  if (originalChatViewHeight.value <= 0) {
    console.error('[ChatView] [compressChatViewHeight] 原始高度无效，无法计算新高度', {
      originalChatViewHeight: originalChatViewHeight.value,
    })
    return
  }

  if (chatViewRef.value) {
    // 从 props 获取压缩高度，如果没有提供则使用默认值
    // 默认值：习题页面 330px，对话框 225px
    let newHeight: number
    if (props.compressedHeight !== undefined) {
      newHeight = props.compressedHeight
    } else {
      // 兼容旧逻辑：根据 type 设置默认值
      if (props.type === 'ai-exercise') {
        newHeight = 330
      } else {
        newHeight = 225
      }
    }
    chatViewRef.value.style.height = `${newHeight}px`
    chatViewRef.value.style.transition = `height ${cssParams.duration} ${cssParams.curve}`
    console.log('[ChatView][Keyboard] compressChatViewHeight apply height', {
      newHeight,
      duration: cssParams.duration,
    })
  } else {
    console.warn('[ChatView] [compressChatViewHeight] chatViewRef.value 不存在，无法设置高度')
  }

  // 步骤5：动画完成后清理
  const animationDuration = parseInt(cssParams.duration)

  setTimeout(() => {
    console.log('[ChatView][Keyboard] compressChatViewHeight animation end', {
      isKeyboardVisible: isKeyboardVisible.value,
    })
    isAnimating.value = false
    if (chatViewRef.value) {
      chatViewRef.value.style.transition = ''
    }

    // 动画完成后再次确保滚动到底部
    scrollToBottom()
  }, animationDuration)
}

/**
 * 恢复ChatView高度（仅用于原生键盘）
 * 作用：将ChatView从压缩状态恢复到原始高度，并应用平滑的过渡动画
 * 注意：仅用于原生键盘隐藏后的页面恢复
 */
const restoreChatViewHeight = () => {
  console.log('[ChatView][Keyboard] restoreChatViewHeight start', {
    isAnimating: isAnimating.value,
    isKeyboardVisible: isKeyboardVisible.value,
  })
  // 步骤1：状态验证
  // 确保只有在正确的动画状态下才执行，防止重复执行或状态冲突
  if (!isAnimating.value || isKeyboardVisible.value) {
    console.log('[ChatView][Keyboard] restoreChatViewHeight aborted by state check')
    return
  }

  // 步骤2：获取动画参数
  // 获取CSS动画参数，包括持续时间、缓动曲线等，确保ChatView高度变化动画流畅
  const cssParams = getCSSAnimationParams()
  // 步骤3：执行ChatView高度恢复动画
  // 通过设置height为空字符串让ChatView恢复到原始高度，并应用过渡效果实现平滑的高度变化
  if (chatViewRef.value) {
    // 3.1 恢复ChatView原始高度（设置为空字符串让ChatView回到自然高度）
    chatViewRef.value.style.height = ''

    // 3.2 应用CSS过渡效果（使用Android系统标准缓动曲线实现平滑高度变化）
    chatViewRef.value.style.transition = `height ${cssParams.duration} ${cssParams.curve}`
    console.log('[ChatView][Keyboard] restoreChatViewHeight apply transition', {
      duration: cssParams.duration,
    })
  } else {
    console.warn('[ChatView] [restoreChatViewHeight] chatViewRef.value 不存在，无法恢复高度')
    return
  }

  // 步骤4：ChatView高度变化动画完成后清理
  // 等待高度变化动画完成，然后清理所有相关状态，确保下次动画能正常执行
  const animationDuration = parseInt(cssParams.duration)

  setTimeout(() => {
    console.log('[ChatView][Keyboard] restoreChatViewHeight animation end, reset state')
    // 4.1 重置动画状态
    isAnimating.value = false
    isKeyboardAnimating.value = false // 清理全局键盘动画状态

    // 4.2 清理键盘相关状态
    keyboardAnimationHeight.value = 0 // 清理键盘动画高度
    keyboardHeight.value = 0

    // 4.3 清理CSS过渡效果
    if (chatViewRef.value) {
      chatViewRef.value.style.transition = ''
    }

    // 4.4 键盘隐藏并恢复高度后，确保聊天区域滚动到底部
    // 避免出现“高度恢复了但视图仍然停留在中间，需要等回复后才滚到底”的体验问题
    scrollToBottom()
  }, animationDuration)
}

// ==================== 初始化函数 ====================
/**
 * 初始化聊天消息（策略模式重构版）
 * 作用：使用策略模式统一处理不同对话类型的初始化逻辑
 */
const initializeMessages = async () => {
  // 设置当前科目（使用策略模式）
  if (chatStrategy.value) {
    currentSubject.value = chatStrategy.value.getCurrentSubject()
  }

  // 使用策略模式初始化消息
  if (!chatStrategy.value) {
    console.warn('[ChatView] ⚠️ 策略未初始化，无法执行初始化消息')
    return
  }

  try {
    // 准备初始化参数
    const initializeOptions = {
      currentSubject: currentSubject.value as 'biology' | 'math',
      // 统一使用 bmNo 作为聊天记录 key
      currentQuestionId: currentQuestion.value?.bmNo,
      currentQuestionTitle: currentQuestion.value?.question || currentQuestion.value?.title,
      resourceId: props.resourceId,
      hasSelectedQuestion: hasSelectedQuestion.value,
    }

    // 调用策略的初始化方法
    await chatStrategy.value.initialize(initializeOptions)
  } catch (error) {
    console.error('[ChatView] ❌ 初始化消息失败:', error)
  }
}

// 作用：简单输入模式发送消息
const sendSimpleMessage = async (message: string) => {
  if (!message.trim() || isLoading.value) {
    return
  }

  // 设置 inputMessage 并调用标准发送流程
  inputMessage.value = message
  await sendMessage()
}

// 作用：发送用户消息（策略模式）
const sendMessage = async (attachedFile?: File) => {
  const hasText = !!inputMessage.value.trim()
  const hasFile = !!attachedFile
  const hasImageForInlineAttach =
    (props.type === 'ai-general' ||
      props.type === 'ai-exercise' ||
      props.type === 'ai-homework' ||
      props.type === 'ai-textbook' ||
      props.type === 'user-client' ||
      props.type === 'html-preview') &&
    strategyInputAttachedScreenshots.value.length > 0

  if ((!hasText && !hasFile && !hasImageForInlineAttach) || isLoading.value) {
    console.error('[ChatView] ❌ 发送消息失败:', {
      inputMessage: inputMessage.value,
      attachedFile: attachedFile,
      hasImageForInlineAttach,
      isLoading: isLoading.value,
    })
    return
  }

  // 检查是否在编辑模式
  if (isEditingMessage.value && editingMessageId.value) {
    await updateEditedMessage(inputMessage.value)
    return
  }

  // 检查是否需要选择题目（策略模式重构版）
  // 策略模式：使用策略的 requiresQuestion() 方法判断是否需要选择题目
  if (!hasSelectedQuestion.value && chatStrategy.value?.requiresQuestion()) {
    const userMessage: ChatBubble = {
      id: Date.now().toString(),
      content: inputMessage.value || (attachedFile ? '[图片消息]' : ''),
      type: Sender.USER,
      timestamp: '',
      sender: Sender.USER,
    }

    const botReply: ChatBubble = {
      id: 'welcome_' + (Date.now() + 1).toString(),
      content: chatStrategy.value.getWelcomeMessage(),
      type: toSenderEnum(chatStrategy.value.getMessageType()),
      timestamp: '',
      sender: toSenderEnum(chatStrategy.value.getSenderType()),
    }

    await addMessagesToStore([userMessage, botReply])
    inputMessage.value = ''
    await scrollToBottom()
    return
  }

  const messageContent = inputMessage.value
  inputMessage.value = ''
  isLoading.value = true

  try {
    // 使用策略模式判断是否需要乐观发送
    if (chatStrategy.value?.shouldOptimisticSend() && teacherStore.currentSession) {
      const userMessage: ChatBubble = {
        id: Date.now().toString(),
        content: messageContent,
        type: Sender.USER,
        timestamp: new Date().toISOString(),
        sender: Sender.USER,
        messageType: 'text',
      }
      await addMessageToStore(userMessage)
      await scrollToBottom()
    }

    // AI通用、AI题目、AI教材和教师通用对话模式：统一使用策略模式发送消息
    // 引用功能：
    // - 文本引用：把被引用内容拼接到消息文本前面（后端无需 focus 字段）
    // - 图片引用：将图片内容写入 image_url（这里用 imageUrl 传给策略/Store -> request.image_url）
    const quotedMessageForUi = quotedMessage.value
      ? {
          id: quotedMessage.value.id,
          content: quotedMessage.value.content,
          sender: quotedMessage.value.sender,
        }
      : undefined

    let imageListForApi: ChatImageData[] | undefined
    const finalMessageContent = messageContent

    // ai-general / ai-exercise / ai-homework / ai-textbook / user-client：挂载截图的发送负载构建交给策略
    let imageDataForApi: ChatImageData | undefined
    if (
      (props.type === 'ai-general' ||
        props.type === 'ai-exercise' ||
        props.type === 'ai-homework' ||
        props.type === 'ai-textbook' ||
        props.type === 'user-client' ||
        props.type === 'html-preview') &&
      strategyInputAttachedScreenshots.value.length > 0 &&
      chatStrategy.value?.buildImagePayloadFromAttachedScreenshots
    ) {
      const payload = chatStrategy.value.buildImagePayloadFromAttachedScreenshots(strategyInputAttachedScreenshots.value)
      imageDataForApi = payload.imageData
      imageListForApi = payload.imageList

      // 点击发送后是否清空输入区缩略图：遵循策略
      if (chatStrategy.value.shouldClearInputAfterImage()) {
        chatStrategy.value?.clearInputAttachedScreenshots?.()
      }
    }

    if (quotedMessage.value) {
      const isUser = quotedMessage.value.sender === Sender.USER
      const isSingleImageBubble = quotedMessage.value.messageType === 'image'
      const hasBase64 = !!quotedMessage.value.imageData?.base64DataUrl
      const isMultiImageBubble = quotedMessage.value.messageType === 'multi_image'
      const hasMultiBase64 =
        Array.isArray(quotedMessage.value.imageList) &&
        quotedMessage.value.imageList.some((img) => !!img.base64DataUrl)

      // 方向A：仅允许引用“用户图片气泡”，且必须具备 base64
      if (isUser && isSingleImageBubble && hasBase64) {
        // 图片引用：走 imageData -> previewPictureQA；不使用 imageUrl 承载 base64
        if (!imageDataForApi) {
          imageDataForApi = {
            filePath: quotedMessage.value.imageData?.filePath || '',
            base64DataUrl: quotedMessage.value.imageData?.base64DataUrl,
          }
        }
      } else if (props.type === 'ai-textbook' && isUser && isMultiImageBubble && hasMultiBase64) {
        // ai-textbook 专属：支持引用用户多图，走 imageList -> previewPictureQA
        imageListForApi = (quotedMessage.value.imageList || [])
          .filter((img) => !!img.base64DataUrl)
          .map((img) => ({
            filePath: img.filePath || '',
            width: img.width || 0,
            height: img.height || 0,
            fileSize: img.fileSize || 0,
            base64DataUrl: img.base64DataUrl,
            isLargeImage: img.isLargeImage || false,
          }))
      } else {
        if (
          (quotedMessage.value.messageType === 'image' ||
            quotedMessage.value.messageType === 'multi_image') &&
          !isUser
        ) {
          showMessage('仅支持引用“用户上传/截图”的图片，AI 图片暂不支持引用', 'warning')
        } else if (
          (quotedMessage.value.messageType === 'image' ||
            quotedMessage.value.messageType === 'multi_image') &&
          isUser &&
          !hasBase64
        ) {
          showMessage('该图片缺少 base64 数据，无法引用，请重新上传/截图', 'warning')
        }

        // 非图片引用：不再将引用文本拼进发送内容，引用关系仅通过 quotedMessage 字段传递
      }
    }

    quotedMessage.value = null

    let focusForApi: HtmlPreviewFocus | undefined = undefined
    try {
      const inHtmlPreview =
        typeof window !== 'undefined' &&
        (window.location?.pathname?.includes('/html-preview') ||
          window.location?.hash?.includes('/html-preview') ||
          window.location?.href?.includes('#/app/html-preview'))
      const getFocus = (window as any).__htmlPreview_getFocus
      if (inHtmlPreview && typeof getFocus === 'function') {
        const maybeFocus = await getFocus()
        focusForApi = (maybeFocus || undefined) as HtmlPreviewFocus | undefined
      }
    } catch (e) {
      console.warn('[ChatView] get html-preview focus failed:', e)
    }

    await chatStrategy.value?.sendMessage(finalMessageContent, {
      selectedModel: selectedModel.value,
      // 将当前题目一并传给策略（如 AiExerciseStrategy），避免策略内部访问全局 questionStore
      currentQuestion: currentQuestion.value ?? undefined,
      quotedMessage: quotedMessageForUi, // 引用的消息信息（用于消息气泡展示）
      imageData: imageDataForApi,
      imageList: imageListForApi,
      focus: focusForApi,
      displayContent: inputDisplayContent.value,
    })
    inputDisplayContent.value = undefined
    await scrollToBottom()
    emit('response')
  } catch (error) {
    console.error('消息发送失败:', error)
    // 策略模式：使用策略获取消息类型和发送者类型
    const errorMessage: ChatBubble = {
      id: (Date.now() + 1).toString(),
      content: '抱歉，消息发送失败，请稍后重试。',
      type: toSenderEnum(chatStrategy.value?.getMessageType() || 'ai'),
      timestamp: '',
      sender: toSenderEnum(chatStrategy.value?.getSenderType() || 'ai'),
    }

    await addMessageToStore(errorMessage)
    await scrollToBottom()
  } finally {
    isLoading.value = false
  }
}

// 作用：处理顶部加载更多历史消息的事件
const handleLoadTop = async () => {
  console.log('[历史记录] UI: 接收到顶部加载事件')

  // 支持用户客户端和教师聊天两种类型
  if (props.type === 'user-client') {
    // 用户客户端类型：使用策略模式
    if (!chatStrategy.value?.supportsPaginatedHistory?.()) {
      console.log('[历史记录] UI: 用户客户端不支持分页历史，跳过加载')
      return
    }

    if (chatStrategy.value.isLoadingHistory?.()) {
      console.log('[历史记录] UI: 正在加载中，跳过重复请求')
      return
    }

    if (!chatStrategy.value.hasMoreHistory?.()) {
      console.log('[历史记录] UI: 没有更多历史记录')
      return
    }

    console.log('[历史记录] UI: 开始加载更多用户客户端历史消息')
    try {
      await chatStrategy.value.loadMoreHistory?.()
      console.log('[历史记录] UI: 加载更多用户客户端历史消息成功')
    } catch (error) {
      console.error('[历史记录] UI: 加载更多用户客户端历史消息失败', error)
    }
  } else if (props.type === 'teacher') {
    // 教师聊天类型：使用teacherStore
    if (teacherStore.pagination.isLoadingMore) {
      console.log('[历史记录] UI: 教师聊天正在加载中，跳过重复请求')
      return
    }

    if (!teacherStore.pagination.hasMore) {
      console.log('[历史记录] UI: 教师聊天没有更多历史记录')
      return
    }

    console.log('[历史记录] UI: 开始加载更多教师聊天历史消息')
    try {
      await teacherStore.loadMoreChatHistory()
      console.log('[历史记录] UI: 加载更多教师聊天历史消息成功')
    } catch (error) {
      console.error('[历史记录] UI: 加载更多教师聊天历史消息失败', error)
    }
  } else {
    console.log('[历史记录] UI: 不支持的历史加载类型:', props.type)
  }
}

// 作用：滚动聊天区域到底部，确保最新消息可见
const scrollToBottom = async (instant = false) => {
  await nextTick()
  const container = rubberBandListRef.value?.scrollContainerRef as HTMLElement | null
  if (container) {
    if (instant) {
      // 初始化时：瞬时跳转，无滚动动画
      container.scrollTop = container.scrollHeight
    } else {
      // 用户交互时：平滑滚动
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }

  showNewMessageIndicator.value = false
  isUserAtBottom.value = true
  emit('scroll-to-bottom')
}

// 作用：根据 sessionId 滚动到该会话的第一条消息（主要用于 ai-textbook 场景）
// 实现方式：在 DOM 中找到该 session 的所有消息元素，滚动到第一条，并为所有消息元素添加高亮 class
const scrollToSession = async (sessionId: string) => {
  console.log('[scrollToSession] start', sessionId)

  if (!sessionId) return
  if (props.type !== 'ai-textbook') return

  await nextTick()
  const wrapper = rubberBandListRef.value?.scrollContainerRef as HTMLElement | null
  if (!wrapper) return

  // 1. 先清除之前的 session 高亮
  const prevHighlighted = wrapper.querySelectorAll('.message-item.highlight-message')
  prevHighlighted.forEach((el) => el.classList.remove('highlight-message'))

  // 2. 找到当前 sessionId 下的所有消息元素
  const selector = `.message-item[data-session-id="${sessionId}"]`
  const sessionEls = Array.from(wrapper.querySelectorAll(selector)) as HTMLElement[]
  if (!sessionEls.length) return

  // 3. 滚动到第一条消息元素
  const firstEl = sessionEls[0]
  const top = firstEl.offsetTop - 50
  wrapper.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' })

  // 4. 为该 session 的所有消息元素添加高亮 class
  sessionEls.forEach((el) => el.classList.add('highlight-message'))
}

// 滚动到指定消息（点击引用区域时触发）
// 注意：实际滚动和高亮逻辑由父组件或 RubberBandList 负责，这里仅转发事件
const handleScrollToMessage = (messageId: string) => {
  emit('scroll-to-message', messageId)
}

/**
 * 检查用户是否在底部
 * 作用：检测用户滚动位置，判断是否在消息列表底部
 */
const checkIfUserAtBottom = () => {
  const container = rubberBandListRef.value?.scrollContainerRef as HTMLElement | null
  if (!container) {
    isUserAtBottom.value = true
    return
  }

  const { scrollTop, clientHeight, scrollHeight } = container
  const threshold = 50
  const distanceToBottom = scrollHeight - scrollTop - clientHeight
  isUserAtBottom.value = distanceToBottom <= threshold
}


// 作用：处理输入框失去焦点事件，响应键盘已隐藏状态
// 键盘隐藏支持失焦和全局事件两种方式
const onInputBlur = () => {
  // 当前实例失去焦点时，标记为非激活实例
  isActiveInstance.value = false
  handleKeyboardHidden()
}

// 处理公式键盘切换的函数
// 流程：接收公式键盘事件 → 滚动到底部（不压缩页面）
const handleFormulaKeyboardToggle = (event: Event) => {
  // 步骤1：解析事件数据
  const customEvent = event as CustomEvent
  const { visible } = customEvent.detail

  // 步骤2：隐藏时做额外保护，避免 WebView/焦点抖动导致的误隐藏
  if (!visible) {
    const isEditorFocused = document.activeElement?.closest('.tiptap-editor-container')
    const isMathFieldFocused = document.activeElement?.tagName === 'MATH-FIELD'
    if (isEditorFocused || isMathFieldFocused) {
      // 编辑器或公式编辑器获得焦点时跳过隐藏，避免误操作
      return
    }
  }

  // 步骤3：更新公式键盘状态标记
  isFormulaKeyboardVisible.value = visible

  // 步骤4：根据键盘显示状态执行相应逻辑
  if (visible) {
    // 3.1 显示公式键盘：只滚动到底部，不压缩页面
    scrollToBottom()
  } else {
    // 修复：公式键盘隐藏时，确保状态正确更新，为后续原生键盘处理做准备
  }
}

// 处理强制重置动画状态事件
const handleForceResetAnimationState = () => {
  // 强制重置所有动画相关状态
  isAnimating.value = false
  isKeyboardAnimating.value = false
  keyboardAnimationHeight.value = 0
  keyboardHeight.value = 0

  // 重置公式键盘状态
  isFormulaKeyboardVisible.value = false

  // 清理CSS过渡效果
  if (chatViewRef.value) {
    chatViewRef.value.style.transition = ''
    chatViewRef.value.style.height = ''
  }
}

// 处理原生键盘显示的函数
// 流程：压缩页面高度 → 焦点处理（不滚动，因为压缩后输入框自动可见）
const handleKeyboardShown = async (data: { height: number; duration: number }) => {
  console.log('[ChatView][Keyboard] handleKeyboardShown called', {
    height: data?.height,
    duration: data?.duration,
    isAnimating: isAnimating.value,
    isKeyboardVisible: isKeyboardVisible.value,
    isFormulaKeyboardVisible: isFormulaKeyboardVisible.value,
  })
  // 额外保护：WebView 下 MathLive 的 <math-field> 获得焦点时，Android 仍可能上报“原生键盘显示”
  // 如果这里继续走原生键盘逻辑，会触发对其它 input 的 focus，从而把 math-field 顶掉，导致公式键盘立刻隐藏
  const activeTagName = document.activeElement?.tagName
  if (activeTagName === 'MATH-FIELD') {
    console.log('[ChatView][Keyboard] handleKeyboardShown skipped because activeElement is MATH-FIELD')
    return
  }

  // 步骤1：检查公式键盘状态 - 如果公式键盘正在显示，跳过原生键盘处理
  if (isFormulaKeyboardVisible.value) {
    console.log('[ChatView][Keyboard] handleKeyboardShown skipped because formula keyboard visible')
    return
  }

  // 步骤2：防重复执行检查
  if (isAnimating.value) {
    console.log('[ChatView][Keyboard] handleKeyboardShown skipped because isAnimating=true')
    return
  }

  // 步骤3：数据预处理
  isKeyboardAnimating.value = true
  keyboardAnimationHeight.value = data.height
  isKeyboardVisible.value = true
  // 使用从Android端获取的实际键盘高度，如果没有则使用默认值
  keyboardHeight.value = data.height || dynamicKeyboardHeight.value
  isAnimating.value = true

  // 步骤4：记录原始高度 - 增强保护机制
  // 只有在ref存在且高度有效时才记录，避免设置为0
  if (chatViewRef.value) {
    const currentHeight = chatViewRef.value.offsetHeight
    if (originalChatViewHeight.value === 0 && currentHeight > 0) {
      // 首次记录原始高度（确保高度大于0）
      originalChatViewHeight.value = currentHeight
    } else if (originalChatViewHeight.value > 0) {
      // 验证已记录的高度是否仍然有效
      if (Math.abs(originalChatViewHeight.value - currentHeight) > 50) {
        originalChatViewHeight.value = currentHeight
      }
    }
  } else {
    console.warn('[ChatView] [handleKeyboardShown] chatViewRef.value 不存在，无法记录原始高度')
  }

  // 步骤5：移动端焦点处理
  // 原生键盘显示时不需要滚动，因为页面压缩后输入框会自动可见
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    const inputElement = document.querySelector('.chat-input-field input') as HTMLInputElement
    if (inputElement) {
      inputElement.focus()
    }
  }

  // 步骤6：延迟执行动画
  nextTick(() => {
    console.log('[ChatView][Keyboard] handleKeyboardShown nextTick -> compressChatViewHeight')
    animationStartTime.value = Date.now()
    compressChatViewHeight()
  })
}

// 作用：显示图片选择器对话框并处理选择结果
const showImagePickerDialog = async () => {
  // 检查是否需要选择题目（策略模式重构版）
  if (!hasSelectedQuestion.value && chatStrategy.value?.requiresQuestion()) {
    androidBridge.showToast('请先选择题目')
    return
  }

  if (chatStrategy.value?.supportsImagePicker && !chatStrategy.value.supportsImagePicker()) {
    showMessage('当前场景不支持选择图片', 'info')
    return
  }

  // 检查图片数量限制
  const maxImages = chatStrategy.value?.getMaxAttachedImages?.() ?? (props.type === 'user-client' ? 5 : 3)
  if (strategyInputAttachedScreenshots.value.length >= maxImages) {
    showMessage(`最多只能添加 ${maxImages} 张图片`, 'info')
    return
  }

  // 打开全局图片选择器并等待结果
  const imageInfo = await pickImage()

  // 如果用户取消，直接返回
  if (!imageInfo) {
    return
  }

  // 处理选择的图片
  await onImageSelected(imageInfo)
}

// 公式输入现在直接在ChatInput中处理，不再需要这些方法

// 作用：处理消息点击事件，在选择模式下切换消息选择状态
const handleMessageClick = (message: ChatBubble) => {
  if (isSelectionMode.value) {
    toggleMessageSelection(message.id)
  }
}

// 处理删除消息：完全通过策略接口
const handleDeleteMessage = async (messageId: string) => {
  try {
    // 教师对话不支持删除消息
    if (props.type === 'teacher') {
      showMessage('教师对话不支持删除消息', 'info')
      return
    }

    if (!chatStrategy.value?.deleteMessage) {
      throw new Error('当前聊天策略未实现 deleteMessage')
    }

    await chatStrategy.value.deleteMessage(messageId, {
      currentQuestion: currentQuestion.value ?? undefined,
    })

    showMessage('消息已删除', 'positive')
  } catch (error) {
    console.error('[ChatView] 删除消息失败:', error)
    showMessage('删除失败，请稍后重试', 'error')
  }
}

// ==================== 转发流程核心函数 ====================
// 注意：转发功能已重构为策略模式，所有转发逻辑都在各个策略类中实现

/**
 * 处理单条消息转发（策略模式）
 * 作用：使用策略模式处理AI对话中的单条消息转发到老师对话
 */
const handleForwardMessage = async (message: ChatBubble) => {
  // 检查策略是否支持转发
  if (!chatStrategy.value?.canForwardMessage()) {
    console.warn('[ChatView] ⚠️ 当前策略不支持转发')
    return
  }

  try {
    // 使用策略的转发方法（策略内部会处理是否显示对话框）
    const result = await chatStrategy.value.forwardMessages([message], {
      showDialog: true, // 默认显示对话框，策略内部可以根据需要覆盖
      // 将当前题目一并传递给策略（如 AiExerciseStrategy），用于题目校验和会话创建
      currentQuestion: currentQuestion.value || undefined,
      onTeacherSelect: showTeacherSelection, // 传入老师选择回调
      showForwardSuccessDialog: showForwardSuccessDialog, // 传入对话框显示回调
      onSuccess: async (result) => {
        // 转发成功后的回调
        if (result.sessionId) {
          console.log('[ChatView111] 转发成功，sessionId =', result.sessionId)
          // 触发跳转到老师对话的事件
          emit('open-teacher-dialog', { sessionId: result.sessionId })
        }
      },
      onError: (error) => {
        console.error('[ChatView] ❌ 转发失败:', error)
        showMessage('转发失败: ' + error, 'error')
      },
    })

    if (!result.success) {
      console.error('[ChatView] ❌ 转发失败:', result.error)
      // 错误已经在 onError 回调中处理
    }
  } catch (error) {
    console.error('[ChatView] ❌ 转发消息失败 - 异常:', error)
    showMessage('转发失败: ' + (error instanceof Error ? error.message : String(error)), 'error')
  }
}

// 处理进入多选模式
// 作用：进入消息多选模式，允许用户选择多条消息进行批量操作
const handleEnterMultiSelect = (params?: { mode?: string }) => {
  selectionMode.value = (params?.mode as any) || 'normal'
  enterSelectionMode()
}

// 处理编辑消息
// 作用：开始编辑指定消息，将消息内容复制到输入框并设置编辑状态
// 处理图片加载完成事件
// 作用：当消息中的图片加载完成后，防抖触发滚动到底部，确保图片完整显示
const handleImageLoaded = () => {
  // 使用防抖机制，避免多张图片同时加载时频繁刷新
  if (imageLoadRefreshTimer.value) {
    clearTimeout(imageLoadRefreshTimer.value)
  }
  imageLoadRefreshTimer.value = setTimeout(async () => {
    await scrollToBottom()
  }, 100) // 100ms 防抖延迟
}

const handleEditMessage = (message: ChatBubble) => {
  // 检查是否已经在编辑其他消息
  if (isEditingMessage.value && editingMessageId.value !== message.id) {
    // 取消当前编辑，开始编辑新消息
    cancelEditMessage()
  }

  // 设置编辑状态
  isEditingMessage.value = true
  editingMessageId.value = message.id
  originalMessageContent.value = message.content || ''
  editingQuestionId.value = currentQuestion.value?.bmNo || null

  // 将消息内容复制到输入框
  // 如果消息包含公式，需要将渲染后的HTML转换为TiptapEditor可识别的格式
  const messageContent = message.content || ''
  const processedContent = convertMessageContentForEditor(messageContent)
  inputMessage.value = processedContent

  // 聚焦到输入框
  nextTick(() => {
    // 触发输入框的focus事件
    emit('focus')
  })
}

// 处理引用消息
const handleQuoteMessage = (message: ChatBubble) => {
  console.log('[ChatView] handleQuoteMessage 被调用', message)
  console.log('[ChatView] message.content =', message.content)
  quotedMessage.value = message
  console.log('[ChatView] quotedMessage.value =', quotedMessage.value)
  console.log('[ChatView] quotedMessage.value?.content =', quotedMessage.value?.content)
  // 聚焦到输入框
  nextTick(() => {
    console.log('[ChatView] nextTick quotedMessage.value =', quotedMessage.value)
    emit('focus')
  })
}

// 移除引用
const handleRemoveQuote = () => {
  quotedMessage.value = null
}

// 将消息内容转换为编辑器可识别的格式
// 作用：将消息内容转换为MathFormulaEditor可识别的Markdown格式，处理数学公式
const convertMessageContentForEditor = (content: string): string => {
  if (!content) return ''

  // 直接处理Markdown格式的内容，不需要渲染为HTML
  // 因为MathFormulaEditor需要的是Markdown格式的LaTeX内容
  let processedContent = content

  // 处理可能存在的HTML格式的公式，转换为Markdown格式
  // 1. 处理MathJax渲染的公式（行内公式）
  const inlineFormulaRegex =
    /<span[^>]*class="[^"]*mjx[^"]*"[^>]*data-mjx-texclass="mord"[^>]*>(.*?)<\/span>/gs
  processedContent = processedContent.replace(inlineFormulaRegex, (match, content) => {
    const latexContent = extractLatexFromMathJax(content)
    if (latexContent) {
      return `$${latexContent}$`
    }
    return match
  })

  // 2. 处理MathJax渲染的公式（块级公式）
  const displayFormulaRegex =
    /<span[^>]*class="[^"]*mjx[^"]*"[^>]*data-mjx-texclass="mord"[^>]*>(.*?)<\/span>/gs
  processedContent = processedContent.replace(displayFormulaRegex, (match, content) => {
    const latexContent = extractLatexFromMathJax(content)
    if (latexContent) {
      return `$${latexContent}$`
    }
    return match
  })

  // 3. 处理可能存在的其他HTML格式的公式
  const htmlFormulaRegex =
    /<span[^>]*data-formula="([^"]*)"[^>]*class="[^"]*formula[^"]*"[^>]*>.*?<\/span>/gs
  processedContent = processedContent.replace(htmlFormulaRegex, (match, formula) => {
    return `$${formula}$`
  })

  // 4. 处理可能存在的HTML实体
  processedContent = processedContent
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')

  // 5. 清理多余的空白字符
  processedContent = processedContent.replace(/\s+/g, ' ').trim()

  return processedContent
}

// 从MathJax渲染的内容中提取LaTeX
// 作用：从MathJax渲染的HTML中提取原始LaTeX代码
const extractLatexFromMathJax = (mathJaxContent: string): string | null => {
  if (!mathJaxContent) return null

  // 清理HTML实体
  let cleaned = mathJaxContent
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()

  // 移除多余的空白字符
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned || null
}

// 取消编辑消息
// 作用：取消当前的消息编辑状态，清空编辑相关变量
const cancelEditMessage = () => {
  isEditingMessage.value = false
  editingMessageId.value = null
  originalMessageContent.value = ''
  editingQuestionId.value = null
  inputMessage.value = ''
}

// 更新编辑的消息（策略模式重构版）
// 作用：更新已编辑的消息内容，删除后续消息并重新发送给AI
const updateEditedMessage = async (newContent: string) => {
  if (!editingMessageId.value || !chatStrategy.value) return

  try {
    // 使用策略模式更新编辑的消息
    isLoading.value = true

    try {
      await chatStrategy.value.updateEditedMessage(editingMessageId.value, newContent, {
        selectedModel: selectedModel.value,
        // 对于 AI 题目策略：这里的 currentQuestionId 约定为 bmNo
        currentQuestionId: currentQuestion.value?.bmNo,
        currentQuestion: currentQuestion.value,
      })

      // 清除编辑状态
      cancelEditMessage()

      // 检查是否需要选择题目（策略模式重构版）
      if (!hasSelectedQuestion.value && chatStrategy.value.requiresQuestion()) {
        // 如果未选择题目，添加欢迎消息回复
        const botReply: ChatBubble = {
          id: 'welcome_' + (Date.now() + 1).toString(),
          content: chatStrategy.value.getWelcomeMessage(),
          type: toSenderEnum(chatStrategy.value.getMessageType()),
          timestamp: '',
          sender: toSenderEnum(chatStrategy.value.getSenderType()),
        }

        await addMessagesToStore([botReply])
        await scrollToBottom()
        return
      }

      // 滚动到底部
      await scrollToBottom()
    } catch (error) {
      console.error('❌ [更新消息] 更新消息失败:', error)
      showMessage(error instanceof Error ? error.message : '更新消息失败', 'error')
      cancelEditMessage()
    } finally {
      isLoading.value = false
    }
  } catch (error) {
    console.error('❌ [更新消息] 更新消息失败:', error)
    showMessage('更新消息失败', 'error')
    cancelEditMessage()
  }
}

// 作用：切换消息的选择状态，用于多选模式
const toggleMessageSelection = (messageId: string) => {
  if (selectedMessages.value.has(messageId)) {
    selectedMessages.value.delete(messageId)
  } else {
    selectedMessages.value.add(messageId)
  }
}

// 作用：进入消息选择模式，清空已选择的消息
const enterSelectionMode = () => {
  isSelectionMode.value = true
  selectedMessages.value.clear()
  // 注意：selectionMode.value 应该在调用前设置
}

// 作用：退出消息选择模式，清空已选择的消息
const exitSelectionMode = () => {
  isSelectionMode.value = false
  selectedMessages.value.clear()
  selectionMode.value = 'normal' // 重置为普通模式
}

// 作用：全选或取消全选所有消息
const selectAllMessages = () => {
  if (selectedMessages.value.size === displayedMessages.value.length) {
    selectedMessages.value.clear()
  } else {
    displayedMessages.value.forEach((message) => {
      selectedMessages.value.add(message.id)
    })
  }
}

// 处理工具栏全选复选框的变更（来自 q-checkbox）
const handleSelectAllCheckboxChange = (val: boolean) => {
  if (val) {
    // 选中所有
    selectAllMessages()
  } else {
    // 取消全选
    selectedMessages.value.clear()
  }
}

/**
 * 处理多选消息转发（策略模式）
 * 作用：使用策略模式处理AI对话中的多条消息转发操作
 */
const forwardToTeacher = async (messageList?: ChatBubble[]) => {
  // 检查策略是否支持转发
  if (!chatStrategy.value?.canForwardMessage()) {
    return
  }

  // 获取要转发的消息列表
  const selectedMessageList =
    messageList ||
    displayedMessages.value.filter((message) => selectedMessages.value.has(message.id))
  if (selectedMessageList.length === 0) return

  // 退出选择模式
  if (isSelectionMode.value) {
    exitSelectionMode()
  }

  // 使用策略转发消息
  try {
    if (selectedMessageList.length === 1) {
      // 单条消息转发
      await handleForwardMessage(selectedMessageList[0])
    } else {
      // 多条消息转发（策略内部会处理是否显示对话框）
      const result = await chatStrategy.value.forwardMessages(selectedMessageList, {
        showDialog: true, // 默认显示对话框，策略内部可以根据需要覆盖
        // 将当前题目一并传递给策略（如 AiExerciseStrategy），用于题目校验和会话创建
        currentQuestion: currentQuestion.value || undefined,
        onTeacherSelect: showTeacherSelection, // 传入老师选择回调
        showForwardSuccessDialog: showForwardSuccessDialog, // 传入对话框显示回调
        onSuccess: async (result) => {
          // 转发成功后的回调
          if (result.sessionId) {
            // 触发跳转到老师对话的事件
            emit('switch-to-teacher', {
              messages: selectedMessageList,
              currentQuestion: currentQuestion.value,
              additionalMessage: '',
              forwardMode: 'separate',
              successCount: result.successCount || selectedMessageList.length,
              sessionId: result.sessionId,
            })
          }
        },
        onError: (error) => {
          console.error('[ChatView] ❌ 批量转发失败:', error)
          showMessage('转发失败: ' + error, 'error')
        },
      })

      if (!result.success) {
        console.error('[ChatView] ❌ 批量转发失败:', result.error)
        // 错误已经在 onError 回调中处理
      }
    }
  } catch (error) {
    console.error('[ChatView] ❌ 转发消息失败 - 异常:', error)
    showMessage('转发失败: ' + (error instanceof Error ? error.message : String(error)), 'error')
  }
}

// 作用：切换联网搜索功能的开启/关闭状态 - 通过策略接口
const toggleWebSearch = () => {
  chatStrategy.value?.toggleWebSearch?.()
}

// 作用：移除已上传的文件
const removeFile = (fileId: string) => {
  const index = uploadedFiles.value.findIndex((f) => f.id === fileId)
  if (index > -1) {
    uploadedFiles.value.splice(index, 1)
  }
}

// ==================== 全局事件监听器管理 ====================
/**
 * 动态控制原生键盘事件监听，避免与公式键盘冲突
 */
let nativeKeyboardListenersEnabled = true

/**
 * 设置全局事件监听器
 * 作用：设置键盘事件监听等
 */
const setupGlobalEventListeners = () => {
  if (typeof window !== 'undefined') {
    // 3.1 老师消息接收回调已由 teacherGeneralChatStore.initMessageReceiver() 统一管理
    // 不需要在这里重复设置，避免覆盖 store 中的回调

    // 3.2 监听原生键盘事件（处理系统键盘，只压缩页面不滚动）
    // 动态控制原生键盘事件监听，避免与公式键盘冲突
    const handleNativeKeyboardShow = (event: Event) => {
      if (!nativeKeyboardListenersEnabled) {
        return
      }
      const customEvent = event as CustomEvent
      // 原生键盘显示时只压缩页面，不滚动（压缩后输入框自动可见）
      handleKeyboardShown(customEvent.detail)
    }

    const handleNativeKeyboardHide = () => {
      if (!nativeKeyboardListenersEnabled) {
        return
      }
      console.log('[ChatView][Keyboard] native keyboard hide event')
      // 原生键盘隐藏时恢复页面
      handleKeyboardHidden()
    }

    window.addEventListener('keyboard-show', handleNativeKeyboardShow)
    window.addEventListener('keyboard-hide', handleNativeKeyboardHide)

    // 暴露控制函数给全局使用
    ;(window as unknown as Record<string, unknown>).disableNativeKeyboardListeners = () => {
      nativeKeyboardListenersEnabled = false
    }
    ;(window as unknown as Record<string, unknown>).enableNativeKeyboardListeners = () => {
      nativeKeyboardListenersEnabled = true
    }

    // 3.3 监听公式键盘事件（MathLive虚拟键盘，只滚动不压缩）
    window.addEventListener('formula-keyboard-toggle', handleFormulaKeyboardToggle)

    // 3.4 监听强制重置动画状态事件
    window.addEventListener('force-reset-animation-state', handleForceResetAnimationState)
  }
}

/**
 * 清理全局事件监听器
 * 作用：移除所有全局事件监听器，防止内存泄漏
 */
const cleanupGlobalEventListeners = () => {
  if (typeof window !== 'undefined') {
    // 清理公式键盘事件监听器
    window.removeEventListener('formula-keyboard-toggle', handleFormulaKeyboardToggle)
    // 清理强制重置动画状态事件监听器
    window.removeEventListener('force-reset-animation-state', handleForceResetAnimationState)
    // 注意：原生键盘事件监听器（keyboard-show/keyboard-hide）是内联函数，无法直接移除
    // 但组件卸载时会自动清理
  }
}

// ==================== 生命周期钩子 ====================
/**
 * 组件挂载时的初始化
 * 作用：初始化聊天消息、设置事件监听器等
 */
onMounted(async () => {
  createStrategy()
  await initializeMessages()
  await scrollToBottom(true) // 初始化时使用瞬时跳转
  lastMessageCount.value = chatStrategy.value?.getMessages?.().length ?? 0
  nextTick(() => {
    const container = rubberBandListRef.value?.scrollContainerRef as HTMLElement | null
    if (container) {
      container.addEventListener('scroll', () => {
        checkIfUserAtBottom()
        showNewMessageIndicator.value = !isUserAtBottom.value
      })
    }
  })
  setTimeout(() => {
    originalViewportHeight.value = window.innerHeight
  }, 100)
  setupGlobalEventListeners()
})

/**
 * 组件卸载时的清理
 * 作用：清理事件监听器、定时器、回调函数等资源
 */
onUnmounted(() => {
  // 步骤0：BScroll 销毁由组合式函数自动处理

  // 步骤0.5：清理图片加载刷新定时器
  if (imageLoadRefreshTimer.value) {
    clearTimeout(imageLoadRefreshTimer.value)
    imageLoadRefreshTimer.value = null
  }

  // 步骤1：清理全局事件监听器
  cleanupGlobalEventListeners()
  // 步骤2：清理老师消息监听器（仅在老师模式下）
  // 注意：回调函数 window.onTeacherMessageReceived 由 teacherGeneralChatStore 统一管理
  // 不应该在这里清理，因为：
  // 1. 回调函数是全局的，应该在应用生命周期中保持存在
  // 2. 用户可能在 AI 会话和老师会话之间切换，不应该在切换时清理回调
  // 3. 清理应该只在 UnifiedChatDialog 完全关闭时进行（由 teacherGeneralChatStore.cleanupMessageReceiver 统一处理）
  // 使用策略模式清理资源
  if (chatStrategy.value?.cleanup) {
    chatStrategy.value.cleanup()
  }

  // 步骤4：清理原始高度记录
  originalChatViewHeight.value = 0
})

// ==================== 监听器 ====================
// 图片加载刷新定时器
const imageLoadRefreshTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// 消息变化监听器已移除，由策略主动调用ChatView方法处理

// 教师会话创建监听器已移除，由策略主动管理会话状态

// 题目切换监听器 - 通过ChatView主动调用策略方法处理
let previousQuestion = currentQuestion.value
watchEffect(() => {
  const newQuestion = currentQuestion.value
  if (newQuestion?.bmNo !== previousQuestion?.bmNo) {
    console.log('[ChatView] 题目切换检测到:', { old: previousQuestion, new: newQuestion })
    // 调用策略的题目切换处理方法
    if (chatStrategy.value?.onQuestionChanged) {
      chatStrategy.value.onQuestionChanged(newQuestion, previousQuestion)
    }
    previousQuestion = newQuestion
  }
})

// 题目切换处理函数已移除，由策略主动调用ChatView方法处理

// 题目切换处理函数
const executeQuestionSwitch = () => {
  // 退出选择模式（如果正在选择模式）
  if (isSelectionMode.value) {
    exitSelectionMode()
  }

  // 使用策略模式重置会话（如果策略支持）
  if (chatStrategy.value?.resetSession) {
    chatStrategy.value.resetSession()
  }

  initializeMessages()
  nextTick(() => {
    scrollToBottom(true) // 题目切换时使用瞬时跳转
  })
}

// 仅用于会话列表面板的滚动：滚动 CardStack 到底部
const scrollSessionListToBottom = () => {
  console.log('[ChatView] scrollSessionListToBottom called, cardStackRef =', cardStackRef.value)
  nextTick(() => {
    console.log('[ChatView] scrollSessionListToBottom nextTick, cardStackRef =', cardStackRef.value)
    if (cardStackRef.value?.scrollToBottom) {
      console.log('[ChatView] calling CardStack.scrollToBottom()')
      cardStackRef.value.scrollToBottom()
    } else {
      console.warn('[ChatView] cardStackRef.scrollToBottom is not available')
    }
  })
}

// 暴露给父组件的方法和状态
defineExpose({
  inputMessage,
  sendMessage,
  onImageSelected,
  attachImageDirectToPreview,
  requestScreenshot,
  openTextbookScreenshotEditor,
  isLoading,
  scrollToBottom,
  scrollSessionListToBottom,
  scrollToSession,
  handleScrollToMessage,
  showSessionListPanel,
  addSessionCard,
  handleCreateNewSession,
  handleSwitchSession,
  handleDeleteSessionRequest,
  sessionCards,
})
</script>

<style scoped>
/* ==================== 主容器样式 ==================== */
/* 聊天视图主容器 - 使用flex布局，占据全高度 */
.chat-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  position: relative;
  overflow: hidden;
  z-index: 1; /* 确保聊天视图在输入区域下方 */
}

/* ==================== 键盘动画相关样式 ==================== */
/* 键盘动画状态 - 优化动画性能 */
.chat-view.keyboard-animating {
  will-change: transform;
}

/* 键盘动画时的聊天消息容器 - 禁用CSS过渡，使用JS动画 */
.chat-view.keyboard-animating .chat-messages-container {
  transition: none; /* 禁用CSS过渡，使用JS动画 */
}

/* ==================== 消息区域样式 ==================== */
/* 聊天消息容器 - 占据剩余空间，支持滚动 */
.chat-messages-container {
  flex: 1;
  min-height: 0;
  width: 100%;
  background: #f7f6ff;
  position: relative; /* 作为会话列表覆盖层的定位容器 */
  z-index: 1; /* 确保消息区域在输入区域下方 */
  padding: 16px 0;
}

/* 会话列表覆盖层：只覆盖消息区域，不遮挡输入区 */
.chat-session-list-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

/* 聊天快照样式 - 模拟聊天界面 */
.chat-snapshot {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  position: relative;
  overflow: hidden;
}

.snapshot-messages {
  flex: 1;
  min-height: 0;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 会话快照：限制 Markdown 内容中的图片大小，避免撑破卡片 */
.chat-snapshot :deep(img) {
  max-width: 100%;
  max-height: 300px;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

/* 消息气泡 */
.snapshot-bubble {
  display: flex;
  gap: 8px;
  max-width: 85%;
}

.snapshot-bubble.ai {
  align-self: flex-start;
}

.snapshot-bubble.user {
  align-self: flex-end;
}

.bubble-text {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.snapshot-bubble.ai .bubble-text {
  background: #ffffff;
  color: #374151;
  border-top-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.snapshot-bubble.user .bubble-text {
  background: linear-gradient(135deg, #7c5cff 0%, #6366f1 100%);
  color: #ffffff;
  border-top-right-radius: 4px;
}

/* 底部渐变遮罩 */
.snapshot-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.9));
  pointer-events: none;
}

/* 选择模式工具栏样式（在 ChatView 中使用） */
.selection-toolbar {
  background: #fff;
  border-top: 1px solid #e0e0e0;
  padding: 8px 12px;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.selection-toolbar .selection-left {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.selection-toolbar .select-all-icon {
  color: #1976d2;
  font-size: 20px;
}

.selection-toolbar .select-all-text {
  color: #374151;
  font-size: 14px;
  margin-left: 4px;
}

.selection-toolbar .selection-count {
  color: #9ca3af;
  font-size: 12px;
  margin-left: 8px;
}

.selection-toolbar .selection-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}



/* 空状态 */
.snapshot-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 14px;
}

/* 新消息提示按钮：居中且悬浮在消息区域底部上方 */
.new-message-indicator {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 10;

  /* 圆形按钮样式 */
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  cursor: pointer;

  /* 颜色 */
  color: #ffffff;
  background-color: #7a7cff;

  /* 居中图标 */
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.message-checkbox {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
}

/* ==================== 加载状态指示器样式 ==================== */
/* 加载指示器过渡动画 - 淡入淡出效果 */
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
}

.loading-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.loading-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 聊天记录加载状态指示器 - 居中显示加载动画 */
.chat-loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  color: #666;
}

/* 加载文本样式 */
.loading-text {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

/* ==================== 输入区域容器样式 ==================== */
.chat-input-area {
  display: flex;
  flex-direction: column;
  background: #f7f6ff;
  gap: 0;
  z-index: 11;
}

/* ==================== 底部提示文案样式 ==================== */
.chat-footer-text {
  text-align: center;
  padding: 0px 20px 2px;
  color: #b0b0b0;
  font-size: 12px;
  line-height: 1.5;
  z-index: 111;
}

/* ==================== 其他样式 ==================== */
/* 移除hover效果 - 已禁用背景色变化 */

/* ==================== 消息高亮效果 ==================== */
/* 点击引用区域时，滚动到被引用消息并高亮 */
:deep(.message-item.highlight-message) {
  animation: highlight-pulse 1.5s ease-out;
}

/* ==================== 删除确认对话框样式 ==================== */

@keyframes highlight-pulse {
  0% {
    background-color: rgba(122, 124, 255, 0.3);
  }
  50% {
    background-color: rgba(122, 124, 255, 0.15);
  }
  100% {
    background-color: transparent;
  }
}

/* ==================== 分页加载指示器样式 ==================== */
/* 顶部加载指示器 */
.loading-more-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: #666;
  font-size: 14px;
  gap: 8px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 没有更多数据提示 */
.no-more-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: #999;
  font-size: 12px;
}

/* 调试上下文按钮 */
.debug-context-btn {
  position: absolute;
  bottom: 180px; /* 避开输入区域，悬浮在右下角 */
  right: 16px;
  z-index: 99;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  color: #1e293b;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
}
.debug-context-btn:hover {
  background-color: #f8fafc;
  border-color: #cbd5e1;
  color: #007aff;
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
}
.debug-btn-icon {
  font-size: 13px;
}
</style>
