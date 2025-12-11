<template>
  <div
    class="message-item"
    :class="{
      'message-user': message.sender === 'user',
      'message-ai': message.sender === 'ai' || message.sender === 'teacher',
      'message-selectable': isSelectionMode,
    }"
    :data-message-id="message.id"
    :data-message-sender="message.sender"
    :data-message-type="message.type"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <!-- 选择模式下的复选框 -->
    <div v-if="isSelectionMode" class="message-checkbox">
      <q-checkbox
        :model-value="isSelected"
        @update:model-value="$emit('toggle-selection', message.id)"
        color="primary"
        size="sm"
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
          <BubblePopup v-model="showActionMenu" trigger="manual">
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
                    message.messageType === 'multi_image' &&
                    message.imageList &&
                    message.imageList.length
                  "
                  :images="message.imageList"
                  :is-user="false"
                  @image-click="handleMultiImageClick"
                />
                <!-- 单图消息（只显示图片，文字已拆分为独立消息） -->
                <template
                  v-else-if="
                    message.messageType === 'image' &&
                    message.imageData &&
                    message.imageData.base64DataUrl
                  "
                >
                  <!-- 显示图片 -->
                  <ImageMessage
                    :base64-data-url="message.imageData.base64DataUrl"
                    :width="message.imageData.width"
                    :height="message.imageData.height"
                    :file-size="message.imageData.fileSize"
                    :is-user="false"
                    :show-info="true"
                  />
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
                  <!-- AI 消息：始终使用 StreamingMessage 组件，支持打字机效果 -->
                  <StreamingMessage
                    v-else-if="message.sender === 'ai' || message.sender === 'teacher'"
                    :content="message.content"
                    :is-streaming="message.isStreaming"
                    :typewriter-speed="30"
                    :enable-typewriter="false"
                    :ref="(el) => setStreamingRef(el)"
                  />
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
        <BubblePopup v-model="showActionMenu" trigger="manual">
          <template #trigger>
            <div class="user-bubble" :ref="(el) => setBubbleRef(el, 'user')">
              <!-- 引用消息区域 -->
              <div
                v-if="message.quotedMessage"
                class="quoted-message-area clickable"
                @click.stop="handleQuotedMessageClick"
              >
                <div class="quoted-content">
                  <span class="quoted-text">{{
                    truncateQuotedContent(message.quotedMessage.content)
                  }}</span>
                </div>
              </div>
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
                  message.messageType === 'multi_image' &&
                  message.imageList &&
                  message.imageList.length
                "
                :images="message.imageList"
                :is-user="true"
                @image-click="handleMultiImageClick"
              />
              <!-- 单图消息（只显示图片，文字已拆分为独立消息） -->
              <template
                v-else-if="
                  message.messageType === 'image' &&
                  message.imageData &&
                  message.imageData.base64DataUrl
                "
              >
                <!-- 显示图片 -->
                <ImageMessage
                  :base64-data-url="message.imageData.base64DataUrl"
                  :width="message.imageData.width"
                  :height="message.imageData.height"
                  :file-size="message.imageData.fileSize"
                  :is-user="true"
                  :show-info="true"
                />
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
                :ref="
              (el) => setMessageRef(el, messageElementRef as unknown as Ref<HTMLElement | null>)
            "
              ></div>
            </div>
          </template>

          <!-- 长按气泡确认框（用户消息） -->
          <ActionList :items="buildUserActions()" class="message-action-menu" />
        </BubblePopup>

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
} from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { MathJaxUtils } from '../../utils/math/mathjax'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import { useLazyMessageRender } from '../../utils/render/lazy-message-renderer'
import { useAiExerciseChatStore } from '../../stores/aiExerciseChatStore'
import { useAiGeneralChatStore } from '../../stores/aiGeneralChatStore'
import { useAiTextbookChatStore } from '../../stores/aiTextbookChatStore'
import { useTeacherGeneralChatStore } from '../../stores/teacherGeneralChatStore'
import { useQuestionStore } from '../../stores/questionStore'
import { useHomeworkStore } from '../../stores/homeworkStore'
import { useTeacherExerciseChatStore } from '../../stores/teacherExerciseChatStore'
import { getUserInfo, getSubject } from '../../services/auth-storage-service'
import VoiceMessage from './VoiceMessage.vue'
import ImageMessage from './ImageMessage.vue'
import StreamingMessage from './StreamingMessage.vue'
import ChatRecordCard from './ChatRecordCard.vue'
import ImageViewer from '../ImageViewer.vue'
import BubblePopup from '../BubblePopup.vue'
import ActionList from '../ActionList.vue'
import MultiImageMessage from './MultiImageMessage.vue'
import type { ChatBubble } from '../../types'
import copyIcon from '/icons/copy.svg'
import editIcon from '/icons/edit.svg'
import shareIcon from '/icons/share.svg'
import refreshIcon from '/icons/refresh.svg'
import DeskmateIcon from '/icons/Deskmate.svg'
import RepresentativeIcon from '/icons/Representative.svg'
import GuruIcon from '/icons/Guru.svg'

// 定义Props - 直接在组件中定义，确保 Vue 正确识别所有 props
interface Props {
  message: ChatBubble
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher-general' | 'teacher-exercise'
  isSelected?: boolean
  isSelectionMode?: boolean
  messageIndex?: number
  isLastMessage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  isSelectionMode: false,
  messageIndex: 0,
  isLastMessage: false,
})

const emit = defineEmits<{
  'toggle-selection': [messageId: string]
  'message-click': [message: ChatBubble]
  'forward-message': [message: ChatBubble]
  'enter-multi-select': []
  'edit-message': [message: ChatBubble]
  'image-loaded': [] // 图片加载完成事件，用于刷新滚动容器
  'quote-message': [message: ChatBubble] // 引用消息
  'scroll-to-message': [messageId: string] // 滚动到指定消息
  'delete-message': [messageId: string] // 删除消息，由父组件处理实际删除逻辑
}>()

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

// Quasar 通知
const $q = useQuasar()

// 场景Store
const aiExerciseStore = useAiExerciseChatStore()
const aiGeneralStore = useAiGeneralChatStore()
const aiTextbookStore = useAiTextbookChatStore()
const teacherGeneralStore = useTeacherGeneralChatStore()
const teacherExerciseStore = useTeacherExerciseChatStore()
const questionStore = useQuestionStore()
const homeworkStore = useHomeworkStore()
const route = useRoute()

// 统一的 currentQuestion：根据场景选择来源（与 ExerciseSolveView 保持一致）
const { currentQuestion: exerciseCurrentQuestion } = storeToRefs(questionStore)
const { currentQuestion: homeworkCurrentQuestion } = storeToRefs(homeworkStore)

const isFromHomework = computed(() => {
  const scene = route.query.scene as string | undefined
  return scene === 'homework' || route.name === 'homeworkExercise'
})

const currentQuestion = computed(() => {
  return isFromHomework.value ? homeworkCurrentQuestion.value : exerciseCurrentQuestion.value
})

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
          props.message.imageData
        )
        break
      case 'ai-general':
        await aiGeneralStore.retryMessage(
          props.message.id,
          userInfo,
          subject,
          props.message.selectedModel || 'mate'
        )
        break
      case 'ai-textbook':
        await aiTextbookStore.retryAiMessage(
          props.message.id,
          props.message.selectedModel || 'mate',
          props.message.imageData
        )
        break
      case 'teacher-general':
        await teacherGeneralStore.retryTeacherMessage(props.message.id, props.message.imageData)
        break
      case 'teacher-exercise':
        await teacherGeneralStore.retryTeacherMessage(props.message.id, props.message.imageData)
        break
      default:
        throw new Error('未知的聊天类型')
    }

    $q.notify({
      type: 'positive',
      message: '正在重新生成消息',
      position: 'top',
      timeout: 2000,
    })
  } catch (error) {
    console.error('重发失败:', error)
    $q.notify({
      type: 'negative',
      message: '重发失败，请稍后重试',
      position: 'top',
      timeout: 3000,
    })
  } finally {
    isRetrying.value = false
  }
}

// 判断是否可以转发（仅在AI通用、AI题目和AI教材对话场景下可用）
// 对于AI练习场景，还需要检查教师答疑是否可用（有选中题目且可以查看答案）
const canForward = computed(() => {
  if (props.type === 'ai-general' || props.type === 'ai-textbook') {
    return true
  }

  if (props.type === 'ai-exercise') {
    // AI练习场景：只有在教师答疑可用时才显示转发按钮
    // 条件：有选中题目 && 可以查看答案（与 ExerciseSolveView 的 canUseAskTeacher 逻辑一致）
    return currentQuestion.value !== null && aiExerciseStore.canViewAnswer
  }

  return false
})

// 判断是否为第一个消息（题目消息）
const isFirstMessage = computed(() => {
  return props.messageIndex === 0
})

// 判断是否可以编辑（第一个消息不能编辑）
const canEdit = computed(() => {
  return props.message.sender === 'user' && !isFirstMessage.value
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

  // 只有最后一条消息才显示功能按钮区域
  // 使用 ?? false 确保值是布尔类型，避免 undefined
  if (!(props.isLastMessage ?? false)) {
    return buttons
  }

  // 教师答疑场景下，学生和教师的消息都不显示功能按钮区域
  if (props.type === 'teacher-general') {
    return buttons
  }

  // 欢迎消息不显示功能区域
  if (props.message.id && props.message.id.startsWith('welcome_')) {
    return buttons
  }

  const isUser = props.message.sender === 'user'
  let canShow = false

  if (isUser) {
    // 用户消息：只要是最后一条、满足前置条件即可显示按钮
    canShow = true
  } else {
    // AI/老师消息：必须回复已结束且已有内容（或错误文案）才显示按钮
    const hasContentOrError = !!props.message.content || !!props.message.isError
    canShow = !props.message.isStreaming && hasContentOrError
  }

  if (!canShow) {
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

  // 转发按钮 - 根据 canForward 判断
  if (canForward.value) {
    buttons.push({
      icon: '',
      iconPath: shareIcon,
      title: '转发',
      handler: handleForward,
      show: true,
    })
  }

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

const handleClick = () => {
  console.log(11)
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
  if (props.isSelectionMode) return

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

  // 第1步：确保能找到气泡元素
  ensureBubbleTarget(target)

  // 第2步：如果找不到气泡元素，直接返回
  if (!bubbleTarget.value) {
    return
  }

  // 第3步：记录触摸开始时间和坐标
  touchStartTime.value = Date.now()
  isLongPressing.value = false

  // 记录触摸开始坐标
  const touch = event.touches[0]
  if (touch) {
    touchStartX.value = touch.clientX
    touchStartY.value = touch.clientY
  }

  // 第4步：设置长按定时器
  longPressTimer.value = window.setTimeout(() => {
    if (!props.isSelectionMode && bubbleTarget.value) {
      isLongPressing.value = true
      // 标记本次交互为长按，后续产生的 click 不再触发图片预览
      ignoreClickAfterLongPress.value = true
      // 第5步：计算气泡框位置并显示
      calculateBubblePosition(target)
      // 第6步：显示气泡菜单
      showActionMenu.value = true
    }
  }, 400) // 400ms长按触发
}

// 触摸移动
const handleTouchMove = (event: TouchEvent) => {
  // 第1步：检查移动距离
  const touch = event.touches[0]
  if (!touch) return

  const moveDistance = Math.sqrt(
    Math.pow(touch.clientX - touchStartX.value, 2) + Math.pow(touch.clientY - touchStartY.value, 2)
  )

  // 第2步：如果移动距离超过阈值，取消长按定时器
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

  // 第1步：取消长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 第2步：如果气泡框已经显示，说明是长按成功触发的，保持显示状态
  // 只重置长按状态，不关闭气泡框
  if (showActionMenu.value) {
    isLongPressing.value = false
    return
  }

  // 第3步：如果不是长按，则正常处理点击
  if (!isLongPressing.value && Date.now() - touchStartTime.value < 500) {
    handleClick()
  }

  // 第4步：重置长按状态
  isLongPressing.value = false
}

// 触摸取消
const handleTouchCancel = () => {
  // 第1步：取消长按定时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // 第2步：重置长按状态（不主动关闭已显示的菜单，交由 BubblePopup 和显式逻辑处理）
  isLongPressing.value = false
}

// 已不支持 PC 鼠标长按，相关逻辑已移除，保留触摸长按逻辑

// 处理转发
const handleForward = () => {
  showActionMenu.value = false

  try {
    emit('forward-message', props.message)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '转发失败: ' + (error instanceof Error ? error.message : String(error)),
      position: 'top',
      timeout: 3000,
    })
  }
}

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

// 处理引用消息
const handleQuote = () => {
  console.log('[ChatMessage] handleQuote 被调用', props.message)
  showActionMenu.value = false
  emit('quote-message', props.message)
}

// 点击引用区域，滚动到被引用的消息
const handleQuotedMessageClick = () => {
  if (props.message.quotedMessage?.id) {
    emit('scroll-to-message', props.message.quotedMessage.id)
  }
}

// 处理多选
const handleMultiSelect = () => {
  showActionMenu.value = false
  emit('enter-multi-select')
}

// 处理编辑消息
const handleEdit = () => {
  showActionMenu.value = false
  emit('edit-message', props.message)
  $q.notify({
    type: 'info',
    message: '进入编辑模式',
    position: 'top',
    timeout: 1500,
  })
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
      key: 'forward',
      label: '转发',
      icon: shareIcon,
      visible: canForward.value,
      onClick: () => handleForward(),
    },
    {
      key: 'multi-select',
      label: '多选',
      iconSvgType: 'multi-select',
      visible: true,
      onClick: () => handleMultiSelect(),
    },
    {
      key: 'delete',
      label: '删除',
      iconName: 'delete_outline',
      iconColor: 'negative',
      visible: true,
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
      key: 'forward',
      label: '转发',
      icon: shareIcon,
      visible: canForward.value,
      onClick: () => handleForward(),
    },
    {
      key: 'multi-select',
      label: '多选',
      iconSvgType: 'multi-select',
      visible: true,
      onClick: () => handleMultiSelect(),
    },
    {
      key: 'delete',
      label: '删除',
      iconName: 'delete_outline',
      iconColor: 'negative',
      visible: true,
      onClick: () => handleDelete(),
    },
  ]

  return items
}

// 处理删除消息
const handleDelete = async () => {
  // 第1步：关闭菜单
  showActionMenu.value = false

  // 第2步：显示确认对话框
  $q.dialog({
    title: '删除确认',
    message: '确定要删除这条消息吗？删除后无法恢复。',
    persistent: true,
    ok: {
      label: '删除',
      color: 'negative',
      flat: true,
    },
    cancel: {
      label: '取消',
      flat: true,
    },
  }).onOk(async () => {
    try {
      // 第3步：仅向父组件抛出删除事件，由父组件根据场景和当前题目决定如何删除
      emit('delete-message', props.message.id)
    } catch (error) {
      console.error('删除消息失败:', error)
      $q.notify({
        type: 'negative',
        message: '删除失败，请稍后重试',
        position: 'top',
        timeout: 3000,
      })
    }
  })
}

// 处理刷新
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
      console.log('刷新AI教材消息', props.message)
      storeMessages = aiTextbookStore.messages
      break
    case 'teacher-general':
      storeMessages = teacherGeneralStore.messages
      break
    case 'teacher-exercise':
      storeMessages = teacherExerciseStore.messages
      break
    default:
      console.error('未知的聊天类型')
      return
  }

  // 找到当前消息在列表中的索引
  const currentIndex = storeMessages.findIndex((msg) => msg.id === props.message.id)
  if (currentIndex < 0) {
    console.error('未找到当前消息')
    $q.notify({
      type: 'negative',
      message: '刷新失败：未找到消息',
      position: 'top',
      timeout: 2000,
    })
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
    $q.notify({
      type: 'negative',
      message: '刷新失败：未找到对应的用户消息',
      position: 'top',
      timeout: 2000,
    })
    return
  }
  // 方案A：刷新严格跟随原接口
  // 仅当当前 AI 消息最初是通过 /permission/previewPictureQA 生成时，刷新才携带截图信息；
  // 如果最初走的是 /permission/chats，则刷新也保持走文本接口，不再从历史中补图。
  let textbookImageData = undefined as ChatBubble['imageData'] | undefined
  let textbookImageList = undefined as ChatBubble['imageList'] | undefined
  let shouldUseScreenshotOnRefresh = false

  if (props.type === 'ai-textbook') {
    const originalDstUrl = props.message.originalDstUrl
    shouldUseScreenshotOnRefresh = originalDstUrl === '/permission/previewPictureQA'

    if (shouldUseScreenshotOnRefresh) {
      // 对于 ai-textbook 场景，可能存在「一条纯图片 + 一条纯文字」的组合：
      // 此时 userMessage 往往是纯文字，需要向前再找一条带图片的用户消息，
      // 以确保刷新时仍然走 /permission/previewPictureQA。
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

  console.log('[ChatMessage][handleRefresh]', {
    type: props.type,
    aiMessageId: props.message.id,
    userMessageId: userMessage.id,
    originalDstUrl: props.message.originalDstUrl,
    shouldUseScreenshotOnRefresh,
    hasUserImageData: !!userMessage.imageData?.base64DataUrl,
    hasTextbookImageData: !!textbookImageData?.base64DataUrl,
    textbookImageListCount: textbookImageList?.length || 0,
  })

  // 使用用户消息的内容重新发送
  try {
    isRetrying.value = true
    const subject = getSubject() as 'MATH' | 'BIOLOGY'
    const userInfo = getUserInfo()

    $q.notify({
      type: 'positive',
      message: '正在重新生成消息',
      position: 'top',
      timeout: 2000,
    })

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
          true // skipUserMessage: true，跳过创建用户消息
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
          true // skipUserMessage: true，跳过创建用户消息
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
          shouldUseScreenshotOnRefresh ? textbookImageList : undefined,
        )
        break
      case 'teacher-general':
      case 'teacher-exercise':
        // 教师场景需要通过 emit 事件触发，因为需要特殊处理
        $q.notify({
          type: 'info',
          message: '教师场景的刷新功能正在开发中',
          position: 'top',
          timeout: 2000,
        })
        break
      default:
        throw new Error('未知的聊天类型')
    }
  } catch (error) {
    console.error('刷新失败:', error)
    $q.notify({
      type: 'negative',
      message: '刷新失败，请稍后重试',
      position: 'top',
      timeout: 3000,
    })
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
    $q.notify({
      type: 'positive',
      message: '已复制到剪贴板',
      position: 'top',
      timeout: 2000,
      icon: 'content_copy',
    })

    showActionMenu.value = false
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

      $q.notify({
        type: 'positive',
        message: '已复制到剪贴板',
        position: 'top',
        timeout: 2000,
        icon: 'content_copy',
      })

      showActionMenu.value = false
    } catch (fallbackError) {
      console.error('降级复制也失败:', fallbackError)
      $q.notify({
        type: 'negative',
        message: '复制失败，请重试',
        position: 'top',
        timeout: 3000,
      })
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
  // 第1步：如果没有气泡引用，尝试从事件目标中获取
  if (!bubbleTarget.value && eventTarget) {
    ensureBubbleTarget(eventTarget)
  }

  // 第2步：如果仍然找不到气泡元素，尝试从整个消息项中查找
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

  // 第3步：如果仍然找不到，直接返回
  if (!bubbleTarget.value) {
    return
  }

  // 第4步：计算气泡框位置
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
  lazyRef?: Ref<HTMLElement | null>
) => {
  if (el && el instanceof HTMLElement) {
    // 设置懒加载引用
    if (lazyRef) {
      lazyRef.value = el
    }

    // 延迟渲染 MathJax，使用懒加载模式
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
      // 处理 Markdown 渲染出的图片
      processMarkdownImages(el)
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
      // 处理 Markdown 渲染出的图片
      processMarkdownImages(contentContainer)
    })
  }
}

const setStaticRef = (el: Element | ComponentPublicInstance | null) => {
  if (el && el instanceof HTMLElement) {
    // 对于静态消息，使用懒加载模式
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
      // 处理 Markdown 渲染出的图片
      processMarkdownImages(el)
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
  if (target && target.tagName === 'IMG' && target.classList.contains('markdown-image')) {
    event.stopPropagation()
    const imgElement = target as HTMLImageElement
    if (imgElement.src) {
      previewImageUrl.value = imgElement.src
      showImagePreview.value = true
    }
  }
}

// 处理 Markdown 渲染出的图片
const processMarkdownImages = (container: HTMLElement) => {
  // 第1步：查找容器内所有的图片元素
  const allImages = container.querySelectorAll('img')

  allImages.forEach((img) => {
    // 第2步：检查图片是否在 MathJax 公式容器内，如果是则跳过
    const mathContainer = img.closest('.mjx-chtml, .mjx-math, [data-mjx-texclass]')
    if (mathContainer) {
      return
    }

    // 第3步：检查图片是否已经被处理过
    if (img.classList.contains('markdown-image')) {
      return
    }

    // 第4步：添加标记类名和样式类名
    img.classList.add('markdown-image')

    // 第5步：设置图片样式属性
    const imgElement = img as HTMLImageElement

    // 第6步：添加错误处理
    imgElement.addEventListener('error', () => {
      imgElement.classList.add('image-error')
      imgElement.alt = '图片加载失败'
    })

    // 第7步：添加加载成功处理
    imgElement.addEventListener('load', () => {
      imgElement.classList.remove('image-error')
      // 图片加载完成后，通知父组件刷新滚动容器
      // 使用 nextTick 确保 DOM 更新完成后再刷新
      nextTick(() => {
        emit('image-loaded')
      })
    })
  })
}
watch(showActionMenu, (v) => {
  console.log('[ChatMessage] showActionMenu changed', v)
})
// 组件卸载时清理事件监听器（当前仅有懒加载等内部逻辑，无需额外清理 BubblePopup 的监听）
onUnmounted(() => {
  // 保留钩子以便后续扩展
})
</script>

<style scoped lang="scss">
/* 现代化聊天消息布局 - 参照主流大模型体验 */
.message-item {
  padding-bottom: 20px;
  width: 100%;
  position: relative;
  /* 移除transition效果 */
  user-select: none; /* 禁用文本选择 */
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE/Edge */
}

:deep(p) {
  margin: 0;
}

/* AI/老师消息样式 */
.ai-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0 20px;
  max-width: 100%;
}

.ai-avatar {
  flex-shrink: 0;
  margin-top: 4px;
}

.avatar-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.ai-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 60px);
  display: flex;
  flex-direction: column;
  position: relative;
  align-items: flex-start;
}

/* AI内容容器 */
.ai-content-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  width: fit-content; /* 根据内容自适应宽度 */
  max-width: 80%;
}

.ai-message-content {
  word-wrap: break-word;
  width: fit-content; /* 根据内容自适应宽度 */
  padding: 0;
  position: relative;
  color: #000000; /* 字体颜色为黑色 */
}

/* 用户消息样式 */
.user-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0 20px;
  justify-content: flex-end;
  width: 100%;
}

.user-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 60px);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 80%;
}

.user-bubble {
  background: #7a7cff;
  color: white;
  border-radius: 12px 0 12px 12px;
  padding: 12px 16px;
  position: relative;
  box-shadow: 0 2px 8px rgba(122, 124, 255, 0.25);
  word-wrap: break-word;
}

/* 消息中的引用区域样式 */
.quoted-message-area {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  max-width: 100%;
}

.quoted-message-area.clickable {
  cursor: pointer;
  transition: background 0.2s ease;
}

.quoted-message-area.clickable:hover {
  background: rgba(255, 255, 255, 0.25);
}

.quoted-message-area.clickable:active {
  background: rgba(255, 255, 255, 0.3);
}

.quoted-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.quoted-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 消息文本样式 */
.message-text {
  line-height: 1.5;
  font-size: 15px;
  word-wrap: break-word;
  word-break: break-word;
  white-space: pre-wrap; /* 保持换行符和空格 */
  user-select: none; /* 禁用文本选择 */
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE/Edge */
}

:deep(.message-text h1),
:deep(.message-text h2),
:deep(.message-text h3),
:deep(.message-text h4),
:deep(.message-text h5),
:deep(.message-text h6) {
  font-size: 16px; /* 所有标题统一大小 */
  line-height: 1.5;
  font-weight: 600;
  margin: 8px 0;
}

.user-bubble .message-text {
  color: white;
}

.ai-message-content .message-text {
  color: #2c3e50;
}

/* 多图消息下方文本，与图片网格之间增加间距 */
.multi-image-text {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* 错误消息包装器 */
.error-message-wrapper {
  position: relative;
}

/* 错误消息样式 - 与普通AI回复相同 */

.retry-count {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* 功能按钮区域 */
.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 0;
}

/* 功能按钮样式 */
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
}

.action-button:hover {
  background: #f5f5f5;
  color: #757575;
}

.action-button:active {
  transform: scale(0.95);
  background: #eeeeee;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button--active {
  color: #1976d2;
}

.action-button--active:hover {
  background: #e3f2fd;
  color: #1565c0;
}

/* 自定义图标样式 */
.action-icon {
  width: 18px;
  height: 18px;
  display: block;
}

/* 消息选择相关样式 */
.message-selectable {
  cursor: pointer;
}

.message-selectable .ai-message,
.message-selectable .user-message {
  padding-left: 60px;
}

.message-checkbox {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;

  :deep(q-checkbox__bg absolute) {
    border-radius: 5px;
  }

  :deep(.q-checkbox__inner--truthy .q-checkbox__bg, .q-checkbox__inner--indet .q-checkbox__bg) {
    background-color: #7a7cff;
  }

  :deep(.q-checkbox__bg) {
    border-color: #7a7cff;
  }
}

/* 移除hover效果 - 已禁用背景色变化 */

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .ai-message-content .message-text {
    color: #000000;
  }

  /* 深色模式下的功能按钮样式 */
  .action-button {
    color: #666;
  }

  .action-button:hover {
    background: #333;
    color: #999;
  }

  .action-button:active {
    background: #444;
  }

  .action-button--active {
    color: #64b5f6;
  }

  .action-button--active:hover {
    background: #333;
    color: #90caf9;
  }
}

/* 长按气泡确认框样式 */
.message-action-menu {
  z-index: 1000;
}

/* 禁用MathJax右键菜单和MathLive功能列表的样式 */
:deep(.mjx-chtml),
:deep(.mjx-math),
:deep([data-mjx-texclass]) {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  cursor: default !important;
  /* 禁用触摸事件 */
  touch-action: none !important;
  /* 禁用拖拽 */
  -webkit-user-drag: none !important;
  -khtml-user-drag: none !important;
  -moz-user-drag: none !important;
  -o-user-drag: none !important;
}

/* 确保公式元素内部所有子元素都不会触发交互 */
:deep(.mjx-chtml *),
:deep(.mjx-math *),
:deep([data-mjx-texclass] *) {
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

/* Markdown 渲染出的图片样式 */
:deep(.message-text img.markdown-image) {
  max-width: 100%;
}

:deep(.message-text img.markdown-image:hover) {
  transform: scale(1.02);
}

:deep(.message-text img.markdown-image.image-error) {
  opacity: 0.5;
  filter: grayscale(100%);
}
</style>
