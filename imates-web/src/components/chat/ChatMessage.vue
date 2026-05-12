<template>
  <!-- 时间分隔符消息 -->
  <div v-if="message.messageType === 'time_separator'" class="time-separator">
    <span class="time-separator-text">{{ formatTimeSeparator(message.timestamp) }}</span>
  </div>

  <!-- 普通消息 -->
  <div
    v-else
    class="message-item"
    :class="{
      'message-user': message.sender === 'user',
      'message-ai': message.sender === 'ai' || message.sender === 'teacher',
      'message-selectable': isSelectionMode,
    }"
    :data-message-id="message.id"
    :data-message-sender="message.sender"
    :data-message-type="message.type"
    @click.capture="handleLinkClickCapture"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <!-- 选择模式下的复选框 -->
    <div v-if="isSelectionMode" class="message-checkbox" @click.stop>
      <Checkbox
        :modelValue="isSelected"
        :indeterminate="false"
        size="sm"
        @update:modelValue="handleToggleSelection"
        @click.native.stop
      />
    </div>

    <!-- AI/老师消息 -->
    <div v-if="message.sender !== 'user'" class="ai-message">
      <div class="ai-avatar">
        <img :src="aiAvatarIcon" alt="头像" class="avatar-img" />
      </div>
      <div class="ai-content">
        <!-- AI内容容器 -->
        <div class="ai-content-container">
          <!-- 使用整块 AI 气泡作为 BubblePopup 的 trigger，使菜单在气泡上方居中显示 -->
          <BubblePopup
            v-model="showActionMenu"
            trigger="manual"
          >
            <template #trigger>
              <div class="ai-message-content" :ref="(el) => setBubbleRef(el, 'ai')">
                <!-- 语音消息 -->
                <VoiceMessage
                  v-if="message.messageType === 'voice' && message.voiceData"
                  :file-path="message.voiceData.filePath"
                  :duration="message.voiceData.duration / 1000"
                  :is-user="false"
                />
                <!-- 多图消息（网格展示） -->
                <MultiImageMessage
                  v-else-if="
                    (message.messageType === 'multi_image' ||
                     (!message.messageType && message.imageList && message.imageList.length > 1)) &&
                    message.imageList &&
                    message.imageList.length
                  "
                  :images="message.imageList"
                  :text-content="message.content"
                  :is-user="false"
                  @image-click="handleMultiImageClick"
                  @paste-to-draft="({ dataUrl }) => handlePasteToDraft(dataUrl)"
                />
                <!-- 单图消息（只显示图片，文字已拆分为独立消息） -->
                <template
                  v-else-if="
                    message.messageType === 'image' &&
                    message.imageData &&
                    message.imageData.base64DataUrl
                  "
                >
                  <div v-paste-to-draft="{ onPaste: handlePasteToDraft, enabled: isPasteToDraftEnabled }">
                    <!-- 显示图片 -->
                    <ImageMessage
                      :base64-data-url="message.imageData.base64DataUrl"
                      :width="message.imageData.width"
                      :height="message.imageData.height"
                      :file-size="message.imageData.fileSize"
                      :is-user="false"
                      :show-info="false"
                    />
                  </div>
                </template>
                <!-- 聊天记录卡片 -->
                <ChatRecordCard
                  v-else-if="message.messageType === 'chat_record' && message.chatRecordData"
                  :messages="message.chatRecordData.messages"
                  :additional-message="message.chatRecordData.additionalMessage"
                />
                <!-- 文本消息 -->
                <div
                  v-else
                  class="message-text"
                  :ref="(el) => setMessageRef(el)"
                  @click="handleImageClick"
                >
                  <!-- 错误消息：直接渲染，不使用打字机 -->
                  <div
                    v-if="message.isError"
                    class="error-message-wrapper"
                    :ref="(el) => setStaticRef(el)"
                  >
                    <div class="error-message">
                      <div v-html="renderedContent" @click="handleImageClick"></div>
                      <div v-if="message.retryCount && message.retryCount > 0" class="retry-count">
                        {{ message.retryCount }}/3
                      </div>
                    </div>
                  </div>
                  <!-- AI 消息：始终使用 StreamingMessage 组件，内部根据 messageType 决定渲染模式 -->
                  <div
                    v-else-if="message.sender === 'ai' || message.sender === 'teacher'"
                    v-paste-to-draft="{ onPaste: handlePasteToDraft, enabled: isPasteToDraftEnabled }"
                  >
                    <StreamingMessage
                      :content="message.content"
                      :is-streaming="message.isStreaming"
                      :message-type="message.messageType === 'html' ? 'html' : 'text'"
                      :raw-html-map="message.rawHtmlMap"
                      @reload-html-image="(url) => handleReloadHtmlImage(url)"
                      @open-html-preview="(url) => handleOpenHtmlPreview(url)"
                      :ref="setStreamingRef"
                    />
                  </div>
                  <!-- 用户消息：直接渲染 -->
                  <div
                    v-else
                    v-html="renderedContent"
                    :ref="(el) => setStaticRef(el)"
                    @click="handleImageClick"
                  ></div>
                </div>
              </div>
            </template>

            <!-- 长按气泡确认框（AI/老师消息） -->
            <ActionList :items="buildAiActions()" class="message-action-menu" />
          </BubblePopup>
        </div>

        <!-- 功能按钮区域 - 统一区域，使用 v-for 渲染 -->
        <div v-if="actionButtons.length > 0" class="message-actions">
          <button
            v-for="(button, index) in actionButtons"
            :key="index"
            class="action-button"
            :class="{ 'action-button--active': button.active }"
            @click.stop="button.handler"
            :title="button.title"
          >
            <img v-if="button.iconPath" :src="button.iconPath" alt="" class="action-icon" />
            <img
              v-else-if="button.icon"
              :src="`/icons/${button.icon}.svg`"
              alt=""
              class="action-icon"
            />
            <q-icon v-else name="help" size="18px" />
          </button>
        </div>
      </div>
    </div>

    <!-- 用户消息 -->
    <div v-else class="user-message">
      <div class="user-content">
        <div class="user-bubble-row">
          <!-- 已读状态标签 -->
          <div v-if="showReadStatus && message.sender === 'user'" class="read-status">
            <span class="read-status-text">{{ message.isRead ? '已读' : '未读' }}</span>
          </div>
          <!-- 用户气泡 -->
          <BubblePopup
            v-model="showActionMenu"
            trigger="manual"
          >
            <!-- 引用消息区域 -->
            <template #trigger>
              <div class="user-bubble" :ref="(el) => setBubbleRef(el, 'user')">
                <!-- 语音消息 -->
                <VoiceMessage
                  v-if="message.messageType === 'voice' && message.voiceData"
                  :file-path="message.voiceData.filePath"
                  :duration="message.voiceData.duration / 1000"
                  :is-user="true"
                />
                <!-- 多图消息（网格展示） -->
                <MultiImageMessage
                  v-else-if="
                    (message.messageType === 'multi_image' ||
                     (!message.messageType && message.imageList && message.imageList.length > 1)) &&
                    message.imageList &&
                    message.imageList.length
                  "
                  :images="message.imageList"
                  :text-content="message.content"
                  :is-user="true"
                  @image-click="handleMultiImageClick"
                  @paste-to-draft="({ dataUrl }) => handlePasteToDraft(dataUrl)"
                />
                <!-- 单图消息（只显示图片，文字已拆分为独立消息） -->
                <template
                  v-else-if="
                    message.messageType === 'image' &&
                    message.imageData &&
                    message.imageData.base64DataUrl
                  "
                >
                  <div v-paste-to-draft="{ onPaste: handlePasteToDraft, enabled: isPasteToDraftEnabled }">
                    <!-- 显示图片 -->
                    <ImageMessage
                      :base64-data-url="message.imageData.base64DataUrl"
                      :width="message.imageData.width"
                      :height="message.imageData.height"
                      :file-size="message.imageData.fileSize"
                      :is-user="true"
                      :show-info="false"
                    />
                  </div>
                </template>
                <!-- 聊天记录卡片 -->
                <ChatRecordCard
                  v-else-if="message.messageType === 'chat_record' && message.chatRecordData"
                  :messages="message.chatRecordData.messages"
                  :additional-message="message.chatRecordData.additionalMessage"
                />
                <!-- 文本消息 -->
                <div
                  v-else
                  class="message-text"
                  v-html="renderedContent"
                  v-paste-to-draft="{ onPaste: handlePasteToDraft, enabled: isPasteToDraftEnabled }"
                  :ref="(el) => setLazyMessageRef(el)"
                ></div>
              </div>
            </template>

            <!-- 长按气泡确认框（用户消息） -->
            <ActionList :items="buildUserActions()" class="message-action-menu" />
          </BubblePopup>
        </div>

        <!-- 功能按钮区域 - 统一区域，使用 v-for 渲染 -->
        <div v-if="actionButtons.length > 0" class="message-actions">
          <button
            v-for="(button, index) in actionButtons"
            :key="index"
            class="action-button"
            :class="{ 'action-button--active': button.active }"
            @click.stop="button.handler"
            :title="button.title"
          >
            <img v-if="button.iconPath" :src="button.iconPath" alt="" class="action-icon" />
            <img
              v-else-if="button.icon"
              :src="`/icons/${button.icon}.svg`"
              alt=""
              class="action-icon"
            />
            <q-icon v-else name="help" size="18px" />
          </button>
        </div>
      </div>
    </div>

    <!-- Markdown 图片预览对话框 -->
    <ImageViewer v-model="showImagePreview" :image-url="previewImageUrl || ''" alt="图片预览" />

    <Dialog
      ref="deleteDialogRef"
      title="删除确认"
      :confirmButtonText="'删除'"
      :cancelButtonText="'取消'"
      @confirm="confirmDelete"
    >
      确定要删除这条消息吗？
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  onUnmounted,
  type ComponentPublicInstance,
  type Ref,
  watch,
  onMounted,
} from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { MathJaxUtils } from '../../utils/math/mathjax'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import { useLazyMessageRender } from '../../utils/render/lazy-message-renderer'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useAiHomeworkChatStore } from '@/stores/aiHomeworkChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { getApiPaths } from '@/config/env-config'
import { useQuestionStore } from '../../stores/questionStore'
import { useHomeworkStore } from '../../stores/homeworkStore'
import { useUserClientStore } from '../../stores/userClientStore'
import { getUserInfo, getSubject } from '../../services'
import { showMessage } from '../../utils'
import VoiceMessage from './VoiceMessage.vue'
import ImageMessage from './ImageMessage.vue'
import StreamingMessage from './StreamingMessage.vue'
import ChatRecordCard from './ChatRecordCard.vue'
import ImageViewer from '../ImageViewer.vue'
import Dialog from '../base/Dialog.vue'
import BubblePopup from '../base/Popover.vue'
import ActionList from '../ActionList.vue'
import MultiImageMessage from './MultiImageMessage.vue'
import Checkbox from '../base/Checkbox.vue'
import {
  canEditUserMessage,
  shouldShowMessageActionButtons,
} from './messageActionVisibility'
import type { ChatBubble, SceneType } from '../../types'
import copyIcon from '/icons/copy.svg'
import editIcon from '/icons/edit.svg'
import refreshIcon from '/icons/refresh.svg'
import DeskmateIcon from '/icons/Deskmate.svg'
import RepresentativeIcon from '/icons/Representative.svg'
import GuruIcon from '/icons/Guru.svg'

// 定义Props - 直接在组件中定义，确保 Vue 正确识别所有 props
interface Props {
  message: ChatBubble
  type:
    | 'ai-general'
    | 'ai-exercise'
    | 'ai-homework'
    | 'ai-textbook'
    | 'teacher'
    | 'user-client'
  // 当前题目（由父组件 ChatView 传入；用于刷新/重试等需要题目上下文的操作）
  currentQuestion?: unknown
  isSelected?: boolean
  isSelectionMode?: boolean
  messageIndex?: number
  isLastMessage?: boolean
  isLastUserMessage?: boolean
  showActionButtons?: boolean // 是否显示消息功能按钮
  enableLongPress?: boolean // 是否启用长按功能
  showReadStatus?: boolean // 是否显示已读状态
  showTime?: boolean // 是否显示消息时间
}

const handlePasteToDraft = (dataUrl: string) => {
  if (!dataUrl) return
  emit('paste-to-draft', { dataUrl, messageId: props.message.id })
}

// 是否启用贴到草稿本功能：仅在 ai-exercise 类型下启用
const props = withDefaults(defineProps<Props>(), {
  isSelected: false, // 是否选中消息（多选模式）
  isSelectionMode: false, // 是否处于多选模式
  messageIndex: 0, // 消息在列表中的索引
  isLastMessage: false, // 是否为最后一条消息
  isLastUserMessage: false, // 是否为最后一条用户消息
  showActionButtons: true, // 是否显示消息功能按钮
  enableLongPress: true, // 是否启用长按功能
  showReadStatus: false, // 是否显示消息已读状态
  showTime: false, // 是否显示消息时间
})
const emit = defineEmits<{
  'toggle-selection': [messageId: string] // 切换消息选择状态
  'message-click': [message: ChatBubble] // 消息点击事件
  'forward-message': [message: ChatBubble] // 转发消息
  'edit-message': [message: ChatBubble] // 编辑消息
  'image-loaded': [] // 图片加载完成事件，用于刷新滚动容器
  'quote-message': [message: ChatBubble] // 引用消息
  'scroll-to-message': [messageId: string] // 滚动到指定消息
  'delete-message': [messageId: string] // 删除消息，由父组件处理实际删除逻辑
  'paste-to-draft': [payload: { dataUrl: string; messageId: string }] // 粘贴到草稿本
  'open-html-preview': [url: string] // HTML 预览点击事件
}>()

// 是否启用贴到草稿本功能：仅在 ai-exercise 类型下启用
const isPasteToDraftEnabled = computed(() => props.type === 'ai-exercise')

// 长按相关状态
const showActionMenu = ref(false)
const longPressTimer = ref<number | null>(null)
const isLongPressing = ref(false)
// 标记：本次交互是否已判定为长按，用于阻止这次松手后的 click 触发图片预览
const ignoreClickAfterLongPress = ref(false)
const touchStartTime = ref(0)
const touchStartX = ref(0)
const touchStartY = ref(0)

// 气泡定位 - 动态计算
const anchor = ref<'top middle' | 'bottom middle'>('top middle')
const self = ref<'top middle' | 'bottom middle'>('bottom middle')
const bubbleTarget = ref<HTMLElement | null>(null)
const currentBubbleType = ref<'ai' | 'user' | null>(null)

const { renderMessageContent } = useMessageRenderer()

const deleteDialogRef = ref<InstanceType<typeof Dialog>>()
const pendingDeleteMessageId = ref<string | null>(null)

// 场景Store
const aiExerciseStore = useAiExerciseChatStore()
const aiGeneralStore = useAiGeneralChatStore()
const aiTextbookStore = useAiTextbookChatStore()
const aiHomeworkStore = useAiHomeworkChatStore()
const teacherStore = useTeacherChatStore()
const questionStore = useQuestionStore()
const homeworkStore = useHomeworkStore()
const userClientStore = useUserClientStore()
const route = useRoute()

// 统一的 currentQuestion：根据场景选择来源（与 ExerciseSolveView 保持一致）
const { currentQuestion: exerciseCurrentQuestion } = storeToRefs(questionStore)
const { currentQuestion: homeworkCurrentQuestion } = storeToRefs(homeworkStore)

const isFromHomework = computed(() => {
  const scene = route.query.scene as SceneType | undefined
  return scene === 'homework' || route.name === 'homeworkExercise'
})

const currentQuestion = computed(() => {
  // 优先使用父组件透传的题目（避免非题目列表场景下全局 store 为空）
  if (props.currentQuestion) {
    return props.currentQuestion as any
  }
  return isFromHomework.value ? homeworkCurrentQuestion.value : exerciseCurrentQuestion.value
})

const handleReloadHtmlImage = async (url: string) => {
  if (!url) return
  try {
    if (props.type === 'ai-general') {
      await aiGeneralStore.reloadHtmlImage(props.message.id, url)
      return
    }
    if (props.type === 'ai-textbook') {
      await aiTextbookStore.reloadHtmlImage(props.message.id, url)
      return
    }
    if (props.type === 'ai-exercise') {
      const bmNo = (currentQuestion.value as any)?.bmNo
      if (!bmNo) {
        showMessage('题目信息缺失，无法重新生成', 'warning')
        return
      }
      await aiExerciseStore.reloadHtmlImage(props.message.id, url, bmNo)
    }
  } catch (e) {
    console.warn('重新生成失败:', e)
    showMessage('重新生成失败', 'error')
  }
}

// 处理 HTML 预览点击事件 - 向上传递到 ChatPanel
const handleOpenHtmlPreview = (url: string) => {
  if (!url) return
  emit('open-html-preview', url)
}

// 消息状态由收到消息时自动管理，不需要额外处理

// 重发相关状态
const isRetrying = ref(false)

// 懒加载渲染
const { elementRef: messageElementRef } = useLazyMessageRender({
  rootMargin: '100px',
  threshold: 0.1,
})

// 根据模式值获取对应的图标
const getModelIcon = (model?: string) => {
  const iconMap: Record<string, string> = {
    mate: DeskmateIcon,
    mentor: RepresentativeIcon,
    researcher: GuruIcon,
  }
  return iconMap[model || 'mate'] || DeskmateIcon
}

// 计算AI/老师消息的头像图标
const aiAvatarIcon = computed(() => {
  // 如果是AI消息且有selectedModel，使用对应模式的头像
  if (props.message.sender === 'ai' && props.message.selectedModel) {
    return getModelIcon(props.message.selectedModel)
  }
  // 如果是老师消息，使用默认老师头像
  if (props.message.sender === 'teacher') {
    return DeskmateIcon
  }
  // 默认使用AI头像
  return DeskmateIcon
})

// 移除调试日志以提高性能

// 重发方法
const handleRetry = async () => {
  if (!props.message.canRetry || isRetrying.value) {
    return
  }

  try {
    isRetrying.value = true

    // 根据不同场景调用不同的retryMessage方法
    const subject = getSubject() as 'MATH' | 'BIOLOGY'
    const userInfo = getUserInfo()

    switch (props.type) {
      case 'ai-exercise':
        await aiExerciseStore.retryMessage(
          props.message.id,
          currentQuestion.value,
          userInfo,
          subject,
          props.message.selectedModel || 'mate',
          props.message.imageData,
        )
        break
      case 'ai-general':
        await aiGeneralStore.retryMessage(
          props.message.id,
          userInfo,
          subject,
          props.message.selectedModel || 'mate',
        )
        break
      case 'ai-textbook':
        await aiTextbookStore.retryAiMessage(
          props.message.id,
          props.message.selectedModel || 'mate',
          props.message.imageData,
        )
        break
      case 'ai-homework':
        await aiHomeworkStore.retryMessage(
          props.message.id,
          userInfo,
          subject,
          currentQuestion.value,
          props.message.selectedModel || 'mate'
        )
        break
      case 'teacher':
        // 教师消息现在通过 WebSocket 发送，不支持重试
        showMessage('教师消息不支持重试，请重新发送', 'warning')
        break
      default:
        throw new Error('未知的聊天类型')
    }

    showMessage('正在重新生成消息', 'success')
  } catch (error) {
    console.error('重发失败:', error)
    showMessage('重发失败，请稍后重试', 'error')
  } finally {
    isRetrying.value = false
  }
}

const setLazyMessageRef = (el: unknown) => {
  const safeEl = el instanceof HTMLElement ? el : null
  setMessageRef(safeEl, messageElementRef)
}

// 判断是否可以转发 - 已移除，避免误发送单个消息给老师

// 判断是否可以编辑（仅最后一条用户消息可编辑）
const canEdit = computed(() => {
  return canEditUserMessage({
    sender: props.message.sender,
    isLastUserMessage: props.isLastUserMessage ?? false,
  })
})

// 功能按钮配置 - 根据消息类型生成按钮列表
const actionButtons = computed(() => {
  const buttons: Array<{
    icon: string
    iconPath?: string
    title: string
    handler: () => void
    show: boolean
    active?: boolean
  }> = []

  // 记录判断过程

  const isUser = props.message.sender === 'user'
  if (
    !shouldShowMessageActionButtons({
      showActionButtons: props.showActionButtons,
      type: props.type,
      sender: props.message.sender,
      isLastMessage: props.isLastMessage ?? false,
      isLastUserMessage: props.isLastUserMessage ?? false,
      messageId: props.message.id,
      content: props.message.content,
      isError: props.message.isError,
      isStreaming: props.message.isStreaming,
    })
  ) {
    return buttons
  }

  // 复制按钮 - 所有消息都显示
  buttons.push({
    icon: '',
    iconPath: copyIcon,
    title: '复制',
    handler: handleCopy,
    show: true,
  })

  // 编辑按钮 - 仅用户消息且可编辑时显示
  if (isUser && canEdit.value) {
    buttons.push({
      icon: '',
      iconPath: editIcon,
      title: '编辑',
      handler: handleEdit,
      show: true,
    })
  }

  // 转发按钮已移除，避免误发送单个消息给老师

  // AI消息专属按钮
  if (!isUser) {
    // 刷新按钮
    buttons.push({
      icon: '',
      iconPath: refreshIcon,
      title: '刷新',
      handler: handleRefresh,
      show: true,
    })
  }

  return buttons
})

const renderedContent = computed(() => {
  const rendered = renderMessageContent(props.message.content)
  return rendered
})

// 处理复选框选择
const handleToggleSelection = (_value: boolean) => {
  emit('toggle-selection', props.message.id)
}

const handleClick = () => {
  // 如果当前已经显示长按菜单，再次点击消息时优先关闭菜单
  if (showActionMenu.value) {
    showActionMenu.value = false
    return
  }

  if (props.isSelectionMode) {
    emit('toggle-selection', props.message.id)
  } else {
    emit('message-click', props.message)
  }
}

// 屏蔽右键菜单
const handleContextMenu = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  return false
}

// 触摸开始
const handleTouchStart = (event: TouchEvent) => {
  if (props.isSelectionMode || !props.enableLongPress) return

  // 检查是否点击在公式元素上
  const target = event.target as HTMLElement
  if (
    target &&
    (target.classList.contains('mjx-chtml') ||
      target.classList.contains('mjx-math') ||
      target.hasAttribute('data-mjx-texclass') ||
      target.closest('.mjx-chtml') ||
      target.closest('.mjx-math') ||
      target.closest('[data-mjx-texclass]'))
  ) {
    // 如果是公式元素，阻止事件传播
    event.stopPropagation()
    return
  }

  // 检查是否点击在超链接上
  const linkElement = target?.closest?.('a[href]') as HTMLAnchorElement | null
  if (linkElement && linkElement.href) {
    // 如果是超链接元素，阻止事件传播，不触发长按
    event.stopPropagation()
    return
  }

  // 确保能找到气泡元素
  ensureBubbleTarget(target)

  // 如果找不到气泡元素，直接返回
  if (!bubbleTarget.value) {
    return
  }

  // 记录触摸开始时间和坐标
  touchStartTime.value = Date.now()
  isLongPressing.value = false

  // 记录触摸开始坐标
  const touch = event.touches[0]
  if (touch) {
    touchStartX.value = touch.clientX
    touchStartY.value = touch.clientY
  }

  // 设置长按定时器
  longPressTimer.value = window.setTimeout(() => {
    if (!props.isSelectionMode && bubbleTarget.value) {
      isLongPressing.value = true
      // 标记本次交互为长按，后续产生的 click 不再触发图片预览
      ignoreClickAfterLongPress.value = true

      // 使用气泡位置定位
      calculateBubblePosition(target)

      // 显示气泡菜单
      showActionMenu.value = true
    }
  }, 400) // 400ms长按触发
}

// 触摸移动
const handleTouchMove = (event: TouchEvent) => {
  // 检查移动距离
  const touch = event.touches[0]
  if (!touch) return

  const moveDistance = Math.sqrt(
    Math.pow(touch.clientX - touchStartX.value, 2) + Math.pow(touch.clientY - touchStartY.value, 2),
  )

  // 如果移动距离超过阈值，取消长按定时器
  if (moveDistance > 10 && longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

// 触摸结束
const handleTouchEnd = (event: TouchEvent) => {
  // 检查是否点击在公式元素上
  const target = event.target as HTMLElement
  if (
    target &&
    (target.classList.contains('mjx-chtml') ||
      target.classList.contains('mjx-math') ||
      target.hasAttribute('data-mjx-texclass') ||
      target.closest('.mjx-chtml') ||
      target.closest('.mjx-math') ||
      target.closest('[data-mjx-texclass]'))
  ) {
    // 如果是公式元素，阻止事件传播
    event.stopPropagation()
    return
  }

  // 检查是否点击在超链接上
  const linkElement = target?.closest?.('a[href]') as HTMLAnchorElement | null
  if (linkElement && linkElement.href) {
    // 如果是超链接元素，阻止事件传播，不触发长按相关逻辑
    event.stopPropagation()
    return
  }

  // 取消长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 如果气泡框已经显示，说明是长按成功触发的，保持显示状态
  // 只重置长按状态，不关闭气泡框
  if (showActionMenu.value) {
    isLongPressing.value = false
    return
  }

  // 如果不是长按，则正常处理点击
  if (!isLongPressing.value && Date.now() - touchStartTime.value < 500) {
    handleClick()
  }

  // 重置长按状态
  isLongPressing.value = false
}

// 触摸取消
const handleTouchCancel = () => {
  // 取消长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 重置长按状态（不主动关闭已显示的菜单，交由 BubblePopup 和显式逻辑处理）
  isLongPressing.value = false
}

// 已不支持 PC 鼠标长按，相关逻辑已移除，保留触摸长按逻辑

// 处理转发 - 已移除，避免误发送单个消息给老师

// 截断引用内容用于展示，最多显示30个字符
const truncateQuotedContent = (content: string): string => {
  if (!content) return ''
  // 移除HTML标签和多余空白
  const plainText = content
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plainText.length <= 30) return plainText
  return plainText.substring(0, 30) + '...'
}

// 格式化时间分隔符文本 - 直接显示具体时间
const formatTimeSeparator = (timestamp: string): string => {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return timestamp
  }
}

// 处理引用消息
const handleQuote = () => {
  showActionMenu.value = false
  emit('quote-message', props.message)
}

// 点击引用区域，滚动到被引用的消息
const handleQuotedMessageClick = () => {
  if (props.message.quotedMessage?.id) {
    emit('scroll-to-message', props.message.quotedMessage.id)
  }
}

// 处理编辑消息
const handleEdit = () => {
  showActionMenu.value = false
  emit('edit-message', props.message)
  showMessage('进入编辑模式', 'info')
}

// 构造 AI/老师消息侧长按菜单 items
const buildAiActions = () => {
  const items = [
    {
      key: 'copy',
      label: '复制',
      icon: copyIcon,
      visible: true,
      onClick: () => handleCopy(),
    },
    {
      key: 'quote',
      label: '引用',
      iconName: 'format_quote',
      visible: true,
      onClick: () => handleQuote(),
    },
    {
      key: 'delete',
      label: '删除',
      iconName: 'delete_outline',
      iconColor: 'negative',
      visible: props.type !== 'teacher', // 教师对话不支持删除消息
      onClick: () => handleDelete(),
    },
  ]

  return items
}

// 构造用户消息侧长按菜单 items
const buildUserActions = () => {
  const items = [
    {
      key: 'copy',
      label: '复制',
      icon: copyIcon,
      visible: true,
      onClick: () => handleCopy(),
    },
    {
      key: 'quote',
      label: '引用',
      iconName: 'format_quote',
      visible: true,
      onClick: () => handleQuote(),
    },
    {
      key: 'edit',
      label: '编辑',
      icon: editIcon,
      visible: canEdit.value,
      onClick: () => handleEdit(),
    },
    {
      key: 'delete',
      label: '删除',
      iconName: 'delete_outline',
      iconColor: 'negative',
      visible: props.type !== 'teacher', // 教师对话不支持删除消息
      onClick: () => handleDelete(),
    },
  ]

  return items
}

// 处理删除消息
const handleDelete = async () => {
  // 关闭菜单
  showActionMenu.value = false

  pendingDeleteMessageId.value = props.message.id
  deleteDialogRef.value?.openDialog()
}

const handleCancelDelete = () => {
  deleteDialogRef.value?.closeDialog()
  pendingDeleteMessageId.value = null
}

const confirmDelete = async () => {
  try {
    if (!pendingDeleteMessageId.value) return
    emit('delete-message', pendingDeleteMessageId.value)
  } catch (error) {
    console.error('删除消息失败:', error)
    showMessage('删除失败，请稍后重试', 'error')
  } finally {
    deleteDialogRef.value?.closeDialog()
    pendingDeleteMessageId.value = null
  }
}

// 处理刷新按钮点击
const handleRefresh = async () => {
  if (props.message.isStreaming) {
    return
  }

  if (isRetrying.value) {
    return
  }

  // 如果是错误消息且有 canRetry 和 originalMessage，使用重试逻辑
  if (props.message.canRetry && props.message.originalMessage) {
    await handleRetry()
    return
  }

  // 否则，对于正常消息，需要找到前一条用户消息并重新发送
  // 获取当前场景的 store
  let storeMessages: ChatBubble[] = []
  switch (props.type) {
    case 'ai-exercise':
      storeMessages = aiExerciseStore.messages
      break
    case 'ai-general':
      storeMessages = aiGeneralStore.messages
      break
      case 'ai-textbook':
        storeMessages = aiTextbookStore.messages
      break
    case 'ai-homework':
        storeMessages = aiHomeworkStore.messages
      break
      case 'teacher':
      storeMessages = teacherStore.messages
      break
    default:
      console.error('未知的聊天类型')
      return
  }

  // 找到当前消息在列表中的索引
  const currentIndex = storeMessages.findIndex((msg) => msg.id === props.message.id)
  if (currentIndex < 0) {
    console.error('未找到当前消息')
    showMessage('刷新失败：未找到消息', 'error')
    return
  }

  // 向前查找前一条用户消息
  let userMessage: ChatBubble | null = null
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (storeMessages[i].sender === 'user') {
      userMessage = storeMessages[i]
      break
    }
  }

  if (!userMessage) {
    console.error('未找到前一条用户消息')
    showMessage('刷新失败：未找到对应的用户消息', 'error')
    return
  }
  // 方案A：刷新严格跟随原接口
  // 仅当当前 AI 消息最初是通过 /ai/2.0/previewPictureQA 生成时，刷新才携带截图信息；
  // 如果最初走的是 /ai/2.0/chats，则刷新也保持走文本接口，不再从历史中补图。
  let textbookImageData = undefined as ChatBubble['imageData'] | undefined
  let textbookImageList = undefined as ChatBubble['imageList'] | undefined
  let shouldUseScreenshotOnRefresh = false

  // ai-textbook / ai-general 场景：根据 originalDstUrl 判断是否使用截图接口
  if (props.type === 'ai-textbook' || props.type === 'ai-general') {
    const originalDstUrl = props.message.originalDstUrl
    const screenshotUrl = '/ai/2.0/previewPictureQA'
    shouldUseScreenshotOnRefresh = originalDstUrl === screenshotUrl

    if (props.type === 'ai-textbook' && shouldUseScreenshotOnRefresh) {
      // 对于 ai-textbook 场景，可能存在「一条纯图片 + 一条纯文字」的组合：
      // 此时 userMessage 往往是纯文字，需要向前再找一条带图片的用户消息，
      // 以确保刷新时仍然走 /ai/2.0/previewPictureQA。
      textbookImageData = userMessage.imageData
      textbookImageList = userMessage.imageList

      const currentIndexInStore = storeMessages.findIndex((msg) => msg.id === userMessage.id)
      if (currentIndexInStore > 0) {
        for (let i = currentIndexInStore - 1; i >= 0; i--) {
          const prev = storeMessages[i]
          if (prev.sender !== 'user') continue
          if (prev.imageData?.base64DataUrl || (prev.imageList && prev.imageList.length > 0)) {
            textbookImageData = prev.imageData || textbookImageData
            textbookImageList = prev.imageList || textbookImageList
            break
          }
        }
      }
    }
  }

    // 调试信息已移除

  // 执行刷新逻辑
  try {
    isRetrying.value = true
    const subject = getSubject() as 'MATH' | 'BIOLOGY'
    const userInfo = getUserInfo()

    showMessage('正在重新生成消息', 'success')

    switch (props.type) {
      case 'ai-exercise':
        // 先删除当前的 AI 消息
        const aiExIndex = storeMessages.findIndex((msg) => msg.id === props.message.id)
        if (aiExIndex >= 0) {
          storeMessages.splice(aiExIndex, 1)
        }
        await aiExerciseStore.sendMessage(
          userMessage.content,
          currentQuestion.value,
          userInfo,
          subject,
          'mate',
          userMessage.imageData,
          false,
          true, // skipUserMessage: true，跳过创建用户消息
        )
        break
      case 'ai-general':
        // 先删除当前的 AI 消息
        const aiGenIndex = storeMessages.findIndex((msg) => msg.id === props.message.id)
        if (aiGenIndex >= 0) {
          storeMessages.splice(aiGenIndex, 1)
        }
        await aiGeneralStore.sendMessage(
          userMessage.content,
          userInfo,
          subject,
          'mate',
          true, // skipUserMessage: true，跳过创建用户消息
          undefined,
          undefined,
          shouldUseScreenshotOnRefresh ? (userMessage.imageData as any) : undefined,
        )
        break
      case 'ai-textbook':
        // 先删除当前的 AI 消息
        const aiTbIndex = storeMessages.findIndex((msg) => msg.id === props.message.id)
        if (aiTbIndex >= 0) {
          storeMessages.splice(aiTbIndex, 1)
        }
        await aiTextbookStore.sendMessage(
          userMessage.content,
          'mate',
          shouldUseScreenshotOnRefresh ? textbookImageData : undefined,
          false,
          true, // skipUserMessage: true，跳过创建用户消息
          undefined,
          undefined,
        )
        break
      case 'ai-homework':
        // 先删除当前的 AI 消息
        const aiHwIndex = storeMessages.findIndex((msg) => msg.id === props.message.id)
        if (aiHwIndex >= 0) {
          storeMessages.splice(aiHwIndex, 1)
        }
        await aiHomeworkStore.sendMessage(
          userMessage.content,
          userInfo,
          subject,
          currentQuestion.value,
          props.message.selectedModel || 'mate',
          true, // skipUserMessage: true，跳过创建用户消息
        )
        break
      case 'teacher':
        // 教师场景需要通过 emit 事件触发，因为需要特殊处理
        showMessage('教师场景的刷新功能正在开发中', 'info')
        break
      default:
        throw new Error('未知的聊天类型')
    }
  } catch (error) {
    console.error('刷新失败:', error)
    showMessage('刷新失败，请稍后重试', 'error')
  } finally {
    isRetrying.value = false
  }
}

// 处理复制消息
const handleCopy = async () => {
  try {
    // 获取消息的纯文本内容
    let textContent = ''

    if (props.message.messageType === 'voice') {
      textContent = '[语音消息]'
    } else if (props.message.messageType === 'image') {
      textContent = '[图片消息]'
    } else if (props.message.messageType === 'chat_record') {
      textContent = '[聊天记录]'
    } else {
      // 对于文本消息，获取纯文本内容
      textContent = props.message.content

      // 移除HTML标签，获取纯文本
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = textContent
      textContent = tempDiv.textContent || tempDiv.innerText || textContent
    }

    // 复制到剪贴板
    await navigator.clipboard.writeText(textContent)

    // 显示复制成功提示
    showMessage('已复制到剪贴板', 'success')
  } catch (error) {
    console.error('复制失败:', error)

    // 降级方案：使用传统的复制方法
    try {
      let fallbackTextContent = ''
      if (props.message.messageType === 'voice') {
        fallbackTextContent = '[语音消息]'
      } else if (props.message.messageType === 'image') {
        fallbackTextContent = '[图片消息]'
      } else if (props.message.messageType === 'chat_record') {
        fallbackTextContent = '[聊天记录]'
      } else {
        fallbackTextContent = props.message.content
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = fallbackTextContent
        fallbackTextContent = tempDiv.textContent || tempDiv.innerText || fallbackTextContent
      }

      const textArea = document.createElement('textarea')
      textArea.value = fallbackTextContent
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)

      showMessage('已复制到剪贴板', 'success')
    } catch (fallbackError) {
      console.error('降级复制也失败:', fallbackError)
      showMessage('复制失败，请重试', 'error')
    }
  }
}

// 气泡框显示/隐藏的处理逻辑已交由 BubblePopup 组件内部负责

// 设置气泡引用
const setBubbleRef = (el: Element | ComponentPublicInstance | null, type: 'ai' | 'user') => {
  if (el && el instanceof HTMLElement) {
    bubbleTarget.value = el
    currentBubbleType.value = type
  }
}

// 确保气泡引用存在，如果不存在则从事件目标中查找
const ensureBubbleTarget = (eventTarget: HTMLElement) => {
  // 如果气泡引用已经存在，直接返回
  if (bubbleTarget.value) {
    return bubbleTarget.value
  }

  // 从事件目标向上查找气泡元素
  const aiBubble = eventTarget.closest('.ai-message-content') as HTMLElement
  if (aiBubble) {
    bubbleTarget.value = aiBubble
    currentBubbleType.value = 'ai'
    return aiBubble
  }

  const userBubble = eventTarget.closest('.user-bubble') as HTMLElement
  if (userBubble) {
    bubbleTarget.value = userBubble
    currentBubbleType.value = 'user'
    return userBubble
  }

  return null
}

// 动态计算气泡框位置
const calculateBubblePosition = (eventTarget?: HTMLElement) => {
  // 如果没有气泡引用，尝试从事件目标中获取
  if (!bubbleTarget.value && eventTarget) {
    ensureBubbleTarget(eventTarget)
  }

  // 如果仍然找不到气泡元素，尝试从整个消息项中查找
  if (!bubbleTarget.value && eventTarget) {
    const messageItem = eventTarget.closest('.message-item') as HTMLElement
    if (messageItem) {
      const aiBubble = messageItem.querySelector('.ai-message-content') as HTMLElement
      const userBubble = messageItem.querySelector('.user-bubble') as HTMLElement
      if (aiBubble) {
        bubbleTarget.value = aiBubble
        currentBubbleType.value = 'ai'
      } else if (userBubble) {
        bubbleTarget.value = userBubble
        currentBubbleType.value = 'user'
      }
    }
  }

  // 如果仍然找不到，直接返回
  if (!bubbleTarget.value) {
    return
  }

  // 计算气泡框位置
  const bubbleRect = bubbleTarget.value.getBoundingClientRect()

  // 确保元素有有效的尺寸（即使没有视觉气泡框，只要有内容就会有尺寸）
  if (bubbleRect.width === 0 && bubbleRect.height === 0) {
    console.warn('气泡元素尺寸为0，可能无法正确定位菜单')
    return
  }

  const viewportHeight = window.innerHeight
  const bubbleTop = bubbleRect.top
  const bubbleBottom = bubbleRect.bottom

  // 计算气泡框高度（预估）
  const estimatedMenuHeight = 80 // 预估菜单高度

  // 判断是否有足够空间在下方显示
  const spaceBelow = viewportHeight - bubbleBottom
  const spaceAbove = bubbleTop

  if (spaceBelow >= estimatedMenuHeight || spaceBelow > spaceAbove) {
    // 在下方显示
    anchor.value = 'top middle'
    self.value = 'bottom middle'
  } else {
    // 在上方显示
    anchor.value = 'bottom middle'
    self.value = 'top middle'
  }
}

const setMessageRef = (
  el: Element | ComponentPublicInstance | null,
  lazyRef?: Ref<HTMLElement | null> | undefined,
) => {
  if (el && el instanceof HTMLElement) {
    // 设置懒加载引用
    if (lazyRef) {
      lazyRef.value = el
    }

    // 延迟渲染 MathJax，使用懒加载模式
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
    })
  }
}

const setStreamingRef = (el: Element | ComponentPublicInstance | null) => {
  if (el && el instanceof HTMLElement) {
    // 对于流式消息，使用懒加载模式
    nextTick(() => {
      // 查找实际的内容容器（StreamingMessage 组件内部的内容元素）
      const contentElement = el.querySelector('.streaming-content, .typewriter-content')
      const contentContainer = (
        contentElement instanceof HTMLElement ? contentElement : el
      ) as HTMLElement
      MathJaxUtils.renderMath(contentContainer, true)
    })
  }
}

const setStaticRef = (el: Element | ComponentPublicInstance | null) => {
  if (el && el instanceof HTMLElement) {
    // 对于静态消息，使用懒加载模式
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
    })
  }
}

// 图片预览相关状态
const previewImageUrl = ref<string | null>(null)
const showImagePreview = ref(false)

// 处理多图消息中的图片点击
const handleMultiImageClick = ({ image }: { image: { base64DataUrl?: string } }) => {
  if (!image.base64DataUrl) return
  previewImageUrl.value = image.base64DataUrl
  showImagePreview.value = true
}

// 处理图片点击事件（使用事件委托）
const handleImageClick = (event: MouseEvent) => {
  // 如果本次交互已被判定为长按，则忽略这次 click，避免同时弹出图片预览
  if (ignoreClickAfterLongPress.value) {
    ignoreClickAfterLongPress.value = false
    return
  }

  const target = event.target as HTMLElement

  const linkElement = target?.closest?.('a[href]') as HTMLAnchorElement | null
  if (linkElement && linkElement.href) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  const imgElement = target?.closest?.('img') as HTMLImageElement | null
  if (!imgElement) return

  const mathContainer = imgElement.closest('.mjx-chtml, .mjx-math, [data-mjx-texclass]')
  if (mathContainer) return

  const insidePasteBtn = imgElement.closest('.paste-to-draft-btn')
  if (insidePasteBtn) return

  if (imgElement.src) {
    event.stopPropagation()
    previewImageUrl.value = imgElement.src
    showImagePreview.value = true
  }
}

const handleLinkClickCapture = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  const linkElement = target?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!linkElement || !linkElement.href) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

// 图片 DOM 增强逻辑已抽为全局指令 v-paste-to-draft

// 组件卸载时清理事件监听器（当前仅有懒加载等内部逻辑，无需额外清理 BubblePopup 的监听）
onUnmounted(() => {
  // 保留钩子以便后续扩展
})
</script>

<style scoped lang="scss">
/* 现代化聊天消息布局 - 参照主流大模型体验 */

/* 禁用MathJax右键菜单和MathLive功能列表的样式 */
:deep(.mjx-chtml),
:deep(.mjx-math),
:deep([data-mjx-texclass]) {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  cursor: default !important;
  touch-action: none !important;
  -webkit-user-drag: none !important;
  -khtml-user-drag: none !important;
  -moz-user-drag: none !important;
  -o-user-drag: none !important;

  * {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    cursor: default !important;
    touch-action: none !important;
    -webkit-user-drag: none !important;
    -khtml-user-drag: none !important;
    -moz-user-drag: none !important;
    -o-user-drag: none !important;
  }
}

:deep(p) {
  margin: 0;
}
/* 时间分隔条样式 */
.time-separator {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
}

.time-separator-text {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
}

/* 根容器 */
.message-item {
  padding-bottom: 20px;
  width: 100%;
  position: relative;
  
  /* 消息气泡内部启用文字选择 */
  .message-text,
  .user-bubble,
  .ai-message-content {
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
    user-select: text !important;
  }

  /* 选择模式 */
  &.message-selectable {
    cursor: pointer;

    .ai-message,
    .user-message {
      padding-left: 60px;
    }
  }

  /* 选择模式下的复选框 */
  .message-checkbox {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;

    :deep(.q-checkbox__bg) {
      border-color: #7a7cff;
      border-radius: 5px;
    }

    :deep(.q-checkbox__inner--truthy .q-checkbox__bg),
    :deep(.q-checkbox__inner--indet .q-checkbox__bg) {
      background-color: #7a7cff;
    }
  }

  /* AI/老师消息 */
  .ai-message {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 0 20px;
    max-width: 100%;

    .ai-avatar {
      flex-shrink: 0;
      margin-top: 4px;

      .avatar-img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }
    }

    .ai-content {
      flex: 1;
      min-width: 0;
      max-width: calc(100% - 60px);
      display: flex;
      flex-direction: column;
      position: relative;
      align-items: flex-start;

      .ai-content-container {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        width: fit-content;
        max-width: 80%;

        .ai-message-content {
          word-wrap: break-word;
          width: fit-content;
          padding: 0;
          position: relative;
          color: #000000;

          /* MathJax 公式横向滚动 */
          :deep(mjx-container),
          :deep(mjx-container.MathJax) {
            max-width: 300px !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            display: inline-block !important; /* 所有公式都用 inline-block 以支持滚动 */
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none !important; /* Firefox */
            -ms-overflow-style: none !important; /* IE/Edge */

            &::-webkit-scrollbar {
              display: none !important; /* Chrome/Safari/Opera */
            }
          }

          .message-text {
            line-height: 1.5;
            font-size: 15px;
            word-wrap: break-word;
            word-break: break-word;
            white-space: normal;
            user-select: text;
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
            color: #2c3e50;

            :deep(mjx-container),
            :deep(mjx-container.MathJax),
            :deep(.mjx-chtml),
            :deep(.mjx-math) {
              overflow-x: auto !important;
              overflow-y: hidden !important;
              max-width: 300px !important;
              display: inline-block !important;
              vertical-align: middle !important;
              scrollbar-width: none !important; /* Firefox */
              -ms-overflow-style: none !important; /* IE/Edge */

              &::-webkit-scrollbar {
                display: none !important; /* Chrome/Safari/Opera */
              }
            }

            :deep(mjx-container[display='inline']),
            :deep(.mjx-chtml[display='inline']) {
              max-width: 300px !important;
              overflow-x: auto !important;
              white-space: nowrap !important;
            }

            :deep(mjx-container[display='block']),
            :deep(.mjx-chtml[display='block']) {
              max-width: 300px !important;
              overflow-x: auto !important;
              margin: 8px 0;
              text-align: center;
              scrollbar-width: none !important; /* Firefox */
              -ms-overflow-style: none !important; /* IE/Edge */

              &::-webkit-scrollbar {
                display: none !important; /* Chrome/Safari/Opera */
              }
            }

            /* KaTeX 公式排版修复：避免与文本行重叠/错位 */
            :deep(.katex) {
              font-size: 1em;
              line-height: 1.2;
              vertical-align: baseline;
              white-space: normal;
            }

            :deep(.katex-display) {
              display: block;
              margin: 8px 0;
              overflow-x: auto;
              overflow-y: hidden;
              -webkit-overflow-scrolling: touch;
            }

            :deep(.katex-display > .katex) {
              white-space: nowrap;
            }

            :deep(h1),
            :deep(h2),
            :deep(h3),
            :deep(h4),
            :deep(h5),
            :deep(h6) {
              font-size: 16px;
              line-height: 1.5;
              font-weight: 600;
              margin: 8px 0;
            }

            :deep(li) {
              font-size: 16px;
              line-height: 1.5;
              font-weight: 400;
            }

            :deep(img.markdown-image) {
              max-width: 100%;

              &:hover {
                transform: scale(1.02);
              }

              &.image-error {
                opacity: 0.5;
                filter: grayscale(100%);
              }
            }
          }

          .error-message-wrapper {
            position: relative;

            .retry-count {
              font-size: 12px;
              color: #999;
              margin-top: 4px;
            }
          }
        }
      }

      .message-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-left: 0;

        .action-button {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: #9e9e9e;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
          position: relative;

          &:hover {
            background: #f5f5f5;
            color: #757575;
          }

          &:active {
            transform: scale(0.95);
            background: #eeeeee;
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          &--active {
            color: #1976d2;

            &:hover {
              background: #e3f2fd;
              color: #1565c0;
            }
          }

          .action-icon {
            width: 18px;
            height: 18px;
            display: block;
          }
        }
      }
    }
  }

  /* 用户消息 */
  .user-message {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 0 20px;
    justify-content: flex-end;
    width: 100%;

    .user-content {
      flex: 1;
      min-width: 0;
      max-width: 80%;
      display: flex;
      flex-direction: column;
      align-items: flex-end;

      .user-bubble-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }

      .user-bubble {
        background: #7a7cff;
        color: white;
        border-radius: 12px 0 12px 12px;
        padding: 12px 16px;
        position: relative;
        box-shadow: 0 2px 8px rgba(122, 124, 255, 0.25);
        word-wrap: break-word;

        .quoted-message-area {
          display: flex;
          align-items: stretch;
          gap: 8px;
          padding: 8px 10px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          max-width: 100%;

          &.clickable {
            cursor: pointer;
            transition: background 0.2s ease;

            &:hover {
              background: rgba(255, 255, 255, 0.25);
            }

            &:active {
              background: rgba(255, 255, 255, 0.3);
            }
          }

          .quoted-content {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
            overflow: hidden;

            .quoted-text {
              font-size: 12px;
              color: rgba(255, 255, 255, 0.9);
              line-height: 1.3;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }
        }

        .message-text {
          line-height: 1.5;
          font-size: 15px;
          word-wrap: break-word;
          word-break: break-word;
          white-space: normal;
          user-select: text;
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
          color: white;

          :deep(img) {
            max-width: 100%;
            height: auto;
          }

          :deep(h1),
          :deep(h2),
          :deep(h3),
          :deep(h4),
          :deep(h5),
          :deep(h6) {
            font-size: 16px;
            line-height: 1.5;
            font-weight: 600;
            margin: 8px 0;
          }

          :deep(img.markdown-image) {
            max-width: 100%;

            &:hover {
              transform: scale(1.02);
            }

            &.image-error {
              opacity: 0.5;
              filter: grayscale(100%);
            }
          }
        }

        /* 多图消息下方文本 */
        .multi-image-text {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }
      }

      .message-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-left: 0;

        .action-button {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: #9e9e9e;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
          position: relative;

          &:hover {
            background: #f5f5f5;
            color: #757575;
          }

          &:active {
            transform: scale(0.95);
            background: #eeeeee;
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          &--active {
            color: #1976d2;

            &:hover {
              background: #e3f2fd;
              color: #1565c0;
            }
          }

          .action-icon {
            width: 18px;
            height: 18px;
            display: block;
          }
        }
      }
    }
  }
}

/* 长按气泡确认框样式 */
.message-action-menu {
  z-index: 1000;
}

/* 已读状态标签样式 */
.read-status {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: #999;
  opacity: 0.7;
  align-self: flex-end;

  .read-status-text {
    font-weight: 400;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .message-item {
    .ai-message .ai-content {
      .ai-content-container .ai-message-content .message-text {
        color: #000000;
      }

      .message-actions .action-button {
        color: #666;

        &:hover {
          background: #333;
          color: #999;
        }

        &:active {
          background: #444;
        }

        &--active {
          color: #64b5f6;

          &:hover {
            background: #333;
            color: #90caf9;
          }
        }
      }
    }

    .user-message .user-content .message-actions .action-button {
      color: #666;

      &:hover {
        background: #333;
        color: #999;
      }

      &:active {
        background: #444;
      }

      &--active {
        color: #64b5f6;

        &:hover {
          background: #333;
          color: #90caf9;
        }
      }
    }
  }
}


</style>
