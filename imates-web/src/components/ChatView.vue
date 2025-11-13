<template>
  <!-- 聊天视图主容器 - 支持键盘动画状态 -->
  <div ref="chatViewRef" class="chat-view" :class="{ 'keyboard-animating': isKeyboardAnimating }">
    <!-- 聊天消息区域 - 占据全宽度，支持滚动 -->
    <div class="chat-messages-container">
      <!-- 滚动区域组件 - 使用 BetterScroll -->
      <div ref="scrollWrapper" class="scroll-wrapper chat-messages">
        <div class="scroll-content">
          <div class="messages-wrapper">
            <!-- 聊天记录加载状态指示器 - 带淡入淡出动画 -->
            <Transition name="loading-fade" appear>
              <div v-if="showLoadingIndicator" class="chat-loading-indicator">
                <q-spinner-dots size="24px" color="primary" />
                <span class="loading-text">正在加载聊天记录...</span>
              </div>
            </Transition>

            <!-- 聊天消息组件列表 - 支持选择、转发、编辑等功能 -->
            <ChatMessageComponent
              v-for="(message, index) in displayedMessages"
              :key="message.id"
              :message="message"
              :type="type"
              :is-selected="selectedMessages.has(message.id)"
              :is-selection-mode="isSelectionMode"
              :message-index="index"
              :is-last-message="isLastMessage(index)"
              @toggle-selection="toggleMessageSelection"
              @message-click="handleMessageClick"
              @forward-message="handleForwardMessage"
              @enter-multi-select="handleEnterMultiSelect"
              @edit-message="handleEditMessage"
              @image-loaded="handleImageLoaded"
            />
          </div>
        </div>
      </div>

      <!-- 新消息提示按钮 - 当用户不在底部时显示 -->
      <Transition name="fade">
        <q-btn
          v-if="showNewMessageIndicator"
          round
          color="primary"
          icon="arrow_downward"
          class="new-message-indicator"
          @click="scrollToBottom"
        >
          <q-tooltip>有新消息，点击查看</q-tooltip>
        </q-btn>
      </Transition>
    </div>

    <!-- 选择模式工具栏 - 新设计 -->
    <!-- 功能：当用户进入多选模式时显示，提供批量操作功能，替换 ChatInput 的位置 -->
    <div v-if="isSelectionMode" class="selection-toolbar">
      <!-- 左侧：全选区域 -->
      <div class="selection-left" @click="selectAllMessages">
        <q-icon 
          :name="isAllSelected ? 'check_box' : selectedMessages.size > 0 ? 'indeterminate_check_box' : 'check_box_outline_blank'" 
          :class="['select-all-icon', { 'icon-selected': isAllSelected }]"
        />
        <span class="select-all-text">全选</span>
        <span class="selection-count">已选{{ selectedMessages.size }}/{{ displayedMessages.length }}</span>
      </div>

      <!-- 右侧：操作按钮组 -->
      <div class="selection-actions">
        <!-- 取消按钮 -->
        <q-btn
          flat
          @click="exitSelectionMode"
          class="cancel-btn"
          size="md"
        >
          取消
        </q-btn>
        <!-- 发送按钮 - 使用策略模式判断是否显示 -->
        <q-btn
          v-if="chatStrategy?.shouldShowForwardButton()"
          @click="() => forwardToTeacher()"
          :disable="selectedMessages.size === 0"
          class="send-btn"
          size="md"
          unelevated
        >
          发送
        </q-btn>
      </div>
    </div>

    <!-- 聊天输入组件插槽 - 支持自定义输入组件，默认使用 ChatInput -->
    <!-- 在多选模式下隐藏 ChatInput -->
    <slot v-if="!isSelectionMode" name="input">
      <ChatInput
        ref="chatInputRef"
        v-model="inputMessage"
        :placeholder-text="enhancedPlaceholderText"
        :is-loading="isLoading"
        :is-recording="isRecording"
        :enable-web-search="enableWebSearch"
        :selected-model="selectedModel"
        :type="type"
        :uploaded-files="uploadedFiles"
        :active-mode="activeMode"
        :can-send="canSend"
        :is-editing="isEditingMessage"
        :editing-message-id="editingMessageId"
        @send-message="sendMessage"
        @blur="onInputBlur"
        @start-voice-input="startVoiceInput"
        @stop-voice-input="stopVoiceInput"
        @voice-move="handleVoiceMove"
        @show-image-picker="showImagePickerDialog"
        @toggle-web-search="toggleWebSearch"
        @update:selected-model="selectedModel = $event"
        @remove-file="removeFile"
        @cancel-edit="cancelEditMessage"
        @scroll-to-bottom="scrollToBottom"
      />
    </slot>

    <!-- 语音录制组件 - 显示录音状态和取消提示 -->
    <VoiceRecorder :is-recording="isRecording" :show-cancel-hint="showCancelHint" />

    <!-- 底部提示文案 -->
    <div class="chat-footer-text">与学伴共学，敢质疑、会判断，思维不设限!</div>
  </div>
</template>

<script setup lang="ts">
// ==================== 导入依赖 ====================
// Vue 核心功能
import { ref, nextTick, onMounted, onUnmounted, computed, watch, watchEffect } from 'vue'

// Better Scroll
import { useBetterScroll } from '../composables/useBetterScroll'

// 状态管理和工具函数
import { useQuestionStore } from '../stores/questionStore'
import { useUserStore } from '../stores/userStore'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useAiGeneralChatStore } from '../stores/aiGeneralChatStore'
import { useAiTextbookChatStore } from '../stores/aiTextbookChatStore'
import { useTeacherGeneralChatStore } from '../stores/teacherGeneralChatStore'
import { useTeacherExerciseChatStore } from '../stores/teacherExerciseChatStore'
import { useImagePicker } from '../composables/useImagePicker'
import { androidBridge } from '../services/android-bridge'
import { showMessage } from '../utils'

// 子组件导入
import ChatMessageComponent from './chat/ChatMessage.vue'
import ChatInput from './chat/ChatInput.vue'
import VoiceRecorder from './chat/VoiceRecorder.vue'

// 类型定义导入
import type { ChatBubble } from '../types'

// 策略模式导入
import { ChatStrategyFactory, type ChatStrategy } from './chat/strategies'

// ==================== 组件配置 ====================
// 定义组件属性 - 支持AI和老师两种对话模式
// 使用内联类型定义的泛型形式，确保 Vue 编译器能正确提取所有 props（包括可选属性）
// 这种方式比导入外部类型接口更可靠，因为 Vue 可以在编译时直接访问类型信息
const props = withDefaults(
  defineProps<{
    type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher-general' | 'teacher-exercise'
    currentQuestionId?: string
    resourceId?: string
    compressedHeight?: number // 键盘显示时 ChatView 的压缩高度（像素）
  }>(),
  {},
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
    },
  ] // 切换到老师对话事件
  focus: [] // 输入框获得焦点事件
  'scroll-to-bottom': [] // 滚动到底部事件
  'open-teacher-dialog': [{ sessionId: string; message: ChatBubble }] // 打开老师对话框事件
}>()

// ==================== 状态管理 ====================
// 全局状态管理
const questionStore = useQuestionStore()

// 场景Store
const aiExerciseStore = useAiExerciseChatStore()
const aiGeneralStore = useAiGeneralChatStore()
const aiTextbookStore = useAiTextbookChatStore()
const teacherStore = useTeacherGeneralChatStore()
const teacherExerciseStore = useTeacherExerciseChatStore()

// 辅助函数：获取当前场景的Store
const getScenarioStore = () => {
  switch (props.type) {
    case 'ai-exercise':
      return aiExerciseStore
    case 'ai-general':
      return aiGeneralStore
    case 'ai-textbook':
      return aiTextbookStore
    case 'teacher-general':
      return teacherStore
    case 'teacher-exercise':
      return teacherExerciseStore
    default:
      return aiGeneralStore
  }
}

// 策略模式：创建聊天策略实例
const chatStrategy = ref<ChatStrategy>()

/**
 * 创建策略实例的辅助函数
 * 根据当前 props 和状态创建对应的策略
 */
const createStrategy = () => {
  if (props.type === 'ai-textbook') {
    aiTextbookStore.setResourceId(props.resourceId!)
  }

  // 创建策略实例
  // 如果是teacher-general类型但store中没有session，延迟创建策略（等待session初始化完成）
  if (props.type === 'teacher-general' && !teacherStore.currentSession) {
    // 延迟创建策略，等待session初始化完成
    // 策略将在store.currentSession的watch中创建
    return
  }

  chatStrategy.value = ChatStrategyFactory.create(props.type)
}

// 组件引用
const scrollWrapper = ref<HTMLElement | null>(null) // 滚动区域引用
const chatViewRef = ref<HTMLElement>() // 聊天视图容器引用
const chatInputRef = ref<InstanceType<typeof ChatInput>>() // 输入组件引用

// 使用 Better Scroll 组合式函数
const {
  init: initBScroll,
  refresh: refreshBScroll,
  scrollTo,
  getInstance,
} = useBetterScroll(scrollWrapper, {
  scrollY: true,
  scrollX: false,
  click: true,
  probeType: 2,
  bounce: {
    top: true,
    bottom: true,
  },
  bounceTime: 800,
  deceleration: 0.003,
  useTransition: true,
  HWCompositing: true,
})

// 基础状态变量
const inputMessage = ref('') // 输入框内容
const isLoading = ref(false) // 消息发送加载状态
const isRecording = ref(false) // 语音录制状态

// 对话相关状态（需要在策略初始化之前声明）
const aiSessionId = ref<string>('') // AI会话ID
const currentSubject = ref<string>('math') // 当前科目，默认为数学

// ==================== 键盘动画相关状态 ====================
// 键盘显示/隐藏状态
const isKeyboardVisible = ref(false) // 键盘是否可见
const isKeyboardAnimating = ref(false) // 键盘是否正在执行动画
const isAnimating = ref(false) // 是否正在执行动画（防重复触发）

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
      duration: duration || '300ms',
      curve: curve || 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      delay: delay || '50ms',
    }
  }
  return {
    duration: '300ms',
    curve: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    delay: '50ms',
  }
}

// ==================== 计算属性 ====================
// 使用场景Store中的联网搜索状态
const enableWebSearch = computed(() => getScenarioStore().enableWebSearch)
const selectedModel = ref('mate') // 选中的AI模型

// 聊天记录加载状态（从场景Store获取）
const isChatLoading = computed(() => getScenarioStore().isChatLoading)

// ==================== 加载状态管理 ====================
// 优化加载指示器显示，避免快速闪烁
const showLoadingIndicator = ref(false) // 是否显示加载指示器
const loadingStartTime = ref(0) // 加载开始时间
const loadingTimeout = ref<ReturnType<typeof setTimeout> | null>(null) // 加载超时定时器

// 加载指示器显示参数
const MIN_LOADING_DISPLAY_TIME = 300 // 最小显示时间300ms，确保用户能看到加载状态
const MIN_LOADING_DELAY = 100 // 最小延迟时间100ms，避免极短时间的闪烁


// ==================== 消息管理相关状态 ====================
// 选择模式相关状态
const isSelectionMode = ref(false) // 是否处于消息选择模式
const selectedMessages = ref<Set<string>>(new Set()) // 已选择的消息ID集合

// 消息显示相关状态
// 使用 computed 自动同步策略中的消息列表，无需手动 watch
// 将包含图片和文字的消息拆分成两个独立的气泡：图片在前，文字在后
const displayedMessages = computed<ChatBubble[]>(() => {
  if (!chatStrategy.value) {
    return []
  }
  
  const messages = chatStrategy.value.getMessages()
  const result: ChatBubble[] = []
  
  for (const message of messages) {
    // 如果消息是图片类型，且同时包含图片和文字内容
    if (
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
    } else {
      // 其他消息直接添加
      result.push(message)
    }
  }
  
  return result
})

// 判断是否全选
const isAllSelected = computed(() => {
  return displayedMessages.value.length > 0 && 
         selectedMessages.value.size === displayedMessages.value.length
})

/**
 * 判断消息是否是最后一条
 * 作用：确保 isLastMessage prop 始终是布尔类型，避免传递 undefined
 * @param index 消息索引
 * @returns 是否是最后一条消息（布尔值）
 */
const isLastMessage = (index: number): boolean => {
  const length = displayedMessages.value?.length ?? 0
  return index === length - 1
}

// ==================== 编辑功能相关状态 ====================
const isEditingMessage = ref(false) // 是否正在编辑消息
const editingMessageId = ref<string | null>(null) // 正在编辑的消息ID
const originalMessageContent = ref<string>('') // 原始消息内容（用于取消编辑时恢复）
const editingQuestionId = ref<string | null>(null) // 记录正在编辑的题目ID

// 编辑模式确认对话框状态
const pendingSwitchAction = ref<(() => void) | null>(null) // 待执行的切换操作（用于编辑模式下的确认）

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

// 语音录制相关状态
const showCancelHint = ref(false) // 是否显示取消提示
const voiceStartY = ref(0) // 语音录制开始时的Y坐标
const voiceCurrentY = ref(0) // 语音录制当前Y坐标

// 新消息提示按钮状态
const showNewMessageIndicator = ref(false) // 是否显示新消息提示按钮
const lastMessageCount = ref(0) // 上次消息数量
const isUserAtBottom = ref(true) // 用户是否在底部
const CANCEL_THRESHOLD = 100 // 上滑取消的阈值（像素）

// ==================== 计算属性 ====================
// 滚动条样式配置

/**
 * 获取当前题目
 * 作用：统一获取当前题目的入口，从全局 store 中读取
 */
const currentQuestion = computed(() => {
  console.log('当前选中的题目', questionStore.currentQuestion)
  return questionStore.currentQuestion
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
  return '向AI助手提问...'
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
 * 条件：输入框有内容或已上传文件
 */
const canSend = computed(() => {
  return !!(inputMessage.value.trim() || uploadedFiles.value.length > 0)
})

// 动态键盘高度（固定值）
const dynamicKeyboardHeight = ref(334) // 固定高度

// ==================== 键盘动画函数 ====================

/**
 * 处理原生键盘隐藏事件
 * 作用：响应原生键盘隐藏状态，恢复页面高度和清理状态
 * 触发场景：原生键盘隐藏后需要恢复聊天界面布局
 */
const handleKeyboardHidden = () => {
  // 步骤1：防重复执行检查
  // 如果正在执行动画，跳过本次调用，避免重复触发
  if (isAnimating.value) {
    return
  }

  // 步骤2：更新键盘状态
  // 设置键盘为不可见状态，标记正在执行动画
  isKeyboardVisible.value = false
  isAnimating.value = true

  // 步骤3：延迟执行动画
  // 使用nextTick确保Vue状态更新完成后再执行动画
  nextTick(() => {
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
  // 步骤1：状态验证
  if (!isAnimating.value || !isKeyboardVisible.value) {
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
  } else {
    console.warn('[ChatView] [compressChatViewHeight] chatViewRef.value 不存在，无法设置高度')
  }

  // 步骤5：动画完成后清理
  const animationDuration = parseInt(cssParams.duration)

  setTimeout(() => {
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
  // 步骤1：状态验证
  // 确保只有在正确的动画状态下才执行，防止重复执行或状态冲突
  if (!isAnimating.value || isKeyboardVisible.value) {
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
  } else {
    console.warn('[ChatView] [restoreChatViewHeight] chatViewRef.value 不存在，无法恢复高度')
    return
  }

  // 步骤4：ChatView高度变化动画完成后清理
  // 等待高度变化动画完成，然后清理所有相关状态，确保下次动画能正常执行
  const animationDuration = parseInt(cssParams.duration)

  setTimeout(() => {
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
  }, animationDuration)
}

// ==================== 初始化函数 ====================
/**
 * 初始化聊天消息（策略模式重构版）
 * 作用：使用策略模式统一处理不同对话类型的初始化逻辑
 */
const initializeMessages = async () => {
  // 第1步：设置当前科目（使用策略模式）
  if (chatStrategy.value) {
    currentSubject.value = chatStrategy.value.getCurrentSubject()
  }

  // 第2步：使用策略模式初始化消息
  if (!chatStrategy.value) {
    console.warn('[ChatView] ⚠️ 策略未初始化，无法执行初始化消息')
    return
  }

  try {
    // 准备初始化参数
    const initializeOptions = {
      currentSubject: currentSubject.value as 'biology' | 'math',
      currentQuestionId: currentQuestion.value?.id || currentQuestion.value?.bmNo,
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


// 作用：发送用户消息（策略模式）
const sendMessage = async (attachedFile?: File) => {
  if ((!inputMessage.value.trim() && !attachedFile) || isLoading.value) {
    console.error('[ChatView] ❌ 发送消息失败:', {
      inputMessage: inputMessage.value,
      attachedFile: attachedFile,
      isLoading: isLoading.value,
    })
    return
  }

  // 检查是否在编辑模式
  if (isEditingMessage.value && editingMessageId.value) {
    
    await updateEditedMessage(inputMessage.value)
    return
  }

  // 第1步：检查是否需要选择题目（策略模式重构版）
  // 策略模式：使用策略的 requiresQuestion() 方法判断是否需要选择题目
  if (!hasSelectedQuestion.value && chatStrategy.value?.requiresQuestion()) {
    const userMessage: ChatBubble = {
      id: Date.now().toString(),
      content: inputMessage.value || (attachedFile ? '[图片消息]' : ''),
      type: 'user',
      timestamp: '',
      sender: 'user',
    }

    const botReply: ChatBubble = {
      id: 'welcome_' + (Date.now() + 1).toString(),
      content: chatStrategy.value.getWelcomeMessage(),
      type: chatStrategy.value.getMessageType(),
      timestamp: '',
      sender: chatStrategy.value.getSenderType(),
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
        type: 'user',
        timestamp: new Date().toISOString(),
        sender: 'user',
        messageType: 'text',
      }
      await addMessageToStore(userMessage)
      await scrollToBottom()
    }

    // AI通用、AI题目、AI教材和教师通用对话模式：统一使用策略模式发送消息
    await chatStrategy.value?.sendMessage(messageContent, {
      selectedModel: selectedModel.value,
    })
    await scrollToBottom()
    emit('response')
  } catch (error) {
    console.error('消息发送失败:', error)
    // 策略模式：使用策略获取消息类型和发送者类型
    const errorMessage: ChatBubble = {
      id: (Date.now() + 1).toString(),
      content: '抱歉，消息发送失败，请稍后重试。',
      type: chatStrategy.value?.getMessageType() || 'ai',
      timestamp: '',
      sender: chatStrategy.value?.getSenderType() || 'ai',
    }

    await addMessageToStore(errorMessage)
    await scrollToBottom()
  } finally {
    isLoading.value = false
  }
}

// 作用：滚动聊天区域到底部，确保最新消息可见
const scrollToBottom = async () => {
  await nextTick()
  const bscrollInstance = getInstance()
  if (bscrollInstance) {
    // 使用 BScroll 滚动到底部
    const maxScrollY = bscrollInstance.maxScrollY
    scrollTo(0, maxScrollY, 300)
  }

  // 隐藏新消息提示按钮
  showNewMessageIndicator.value = false
  isUserAtBottom.value = true

  // 同时触发父组件的滚动到底部事件
  emit('scroll-to-bottom')
}

/**
 * 检查用户是否在底部
 * 作用：检测用户滚动位置，判断是否在消息列表底部
 */
const checkIfUserAtBottom = () => {
  const bscrollInstance = getInstance()
  if (!bscrollInstance) {
    isUserAtBottom.value = true
    return
  }

  // 获取当前滚动位置和最大滚动位置
  const currentY = Math.abs(bscrollInstance.y)
  const maxScrollY = Math.abs(bscrollInstance.maxScrollY)

  // 允许50px的误差，认为在底部
  const threshold = 50
  isUserAtBottom.value = currentY >= maxScrollY - threshold
}

// 作用：处理输入框失去焦点事件，响应键盘已隐藏状态
// 键盘隐藏支持失焦和全局事件两种方式
const onInputBlur = () => {
  handleKeyboardHidden()
}

// 处理公式键盘切换的函数
// 流程：接收公式键盘事件 → 滚动到底部（不压缩页面）
const handleFormulaKeyboardToggle = (event: Event) => {
  // 步骤1：解析事件数据
  const customEvent = event as CustomEvent
  const { visible } = customEvent.detail

  // 步骤2：更新公式键盘状态标记
  isFormulaKeyboardVisible.value = visible

  // 步骤3：根据键盘显示状态执行相应逻辑
  if (visible) {
    // 3.1 显示公式键盘：只滚动到底部，不压缩页面
    scrollToBottom()
  } else {
    // 3.2 隐藏公式键盘：检查焦点状态避免误隐藏
    const isEditorFocused = document.activeElement?.closest('.tiptap-editor-container')
    const isMathFieldFocused = document.activeElement?.tagName === 'MATH-FIELD'

    if (isEditorFocused || isMathFieldFocused) {
      // 编辑器或公式编辑器获得焦点时跳过隐藏，避免误操作
      return
    }

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
  // 步骤1：检查公式键盘状态 - 如果公式键盘正在显示，跳过原生键盘处理
  if (isFormulaKeyboardVisible.value) {
    return
  }

  // 步骤2：防重复执行检查
  if (isAnimating.value) {
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
    animationStartTime.value = Date.now()
    compressChatViewHeight()
  })
}

// 作用：处理录音权限授予后自动开始的录音事件
const handleNativeVoiceRecordingStarted = (event: Event) => {
  const customEvent = event as CustomEvent
  const detail = customEvent.detail as { success: boolean; isRecording: boolean; filePath?: string }
  if (detail.success && detail.isRecording) {
    // 更新录音状态
    isRecording.value = true
    showCancelHint.value = false
  }
}

// 作用：开始语音输入，记录触摸位置并调用录音接口
const startVoiceInput = (event?: TouchEvent | MouseEvent) => {
  if (isLoading.value) {
    return
  }

  // 记录开始位置（用于上滑取消）
  if (event && 'touches' in event && event.touches.length > 0) {
    voiceStartY.value = event.touches[0].clientY
  } else if (event && 'clientY' in event) {
    voiceStartY.value = event.clientY
  }

  // 先调用录音接口检查权限，只有在成功后才设置状态
  try {
    const result = androidBridge.startVoiceRecording()
    if (!result.success) {
      console.error('[ChatView] 开始录音失败', result.message)
      showMessage(result.message || '开始录音失败', 'error')
      // 确保状态为 false
      isRecording.value = false
      showCancelHint.value = false
      return
    }

    // 如果正在请求权限，不设置录音状态，等待权限请求完成
    if (result.message === '正在请求录音权限') {
      // 权限请求是异步的，权限授予后会自动启动录音
      // 不设置 isRecording 状态，等待权限授予后的回调
      return
    }

    // 只有在录音成功后才设置状态
    isRecording.value = true
    showCancelHint.value = false
  } catch (error) {
    console.error('[ChatView] 录音异常', error)
    showMessage('录音功能不可用', 'error')
    // 确保状态为 false
    isRecording.value = false
    showCancelHint.value = false
  }
}

// 作用：停止语音输入，处理上滑取消逻辑并发送语音消息
const stopVoiceInput = async (event?: TouchEvent | MouseEvent) => {
  // 如果当前未在录音，可能是权限失败后快速释放按钮，需要清理状态
  if (!isRecording.value) {
    console.warn('[ChatView] 当前未在录音，忽略停止请求')
    // 确保状态清理
    showCancelHint.value = false
    // 尝试调用取消录音，确保 Android 端状态正确
    try {
      androidBridge.cancelVoiceRecording()
    } catch {
      // 忽略错误，因为可能根本没有开始录音
    }
    return
  }

  // 检查是否需要取消发送（上滑取消）
  let shouldCancel = false
  if (event && 'touches' in event && event.changedTouches.length > 0) {
    voiceCurrentY.value = event.changedTouches[0].clientY
    shouldCancel = voiceStartY.value - voiceCurrentY.value > CANCEL_THRESHOLD
  } else if (event && 'clientY' in event) {
    voiceCurrentY.value = event.clientY
    shouldCancel = voiceStartY.value - voiceCurrentY.value > CANCEL_THRESHOLD
  }
  // 先设置录音状态为 false，确保 UI 更新
  isRecording.value = false
  showCancelHint.value = false

  try {
    if (shouldCancel) {
      // 取消录音 - 使用AndroidBridge
      androidBridge.cancelVoiceRecording()
    } else {
      // 停止录音并发送 - 使用AndroidBridge
      const result = androidBridge.stopVoiceRecording()
      if (result.success && result.voiceInfo) {
        await sendVoiceMessage(result.voiceInfo)
      } else {
        console.error('[ChatView] 录音失败', result.message)
        showMessage(result.message || '录音失败', 'error')
      }
    }
  } catch (error) {
    console.error('[ChatView] 录音操作异常', error)
    showMessage('录音操作失败', 'error')
  }
}

// 作用：处理语音录制过程中的移动事件，显示取消提示
const handleVoiceMove = (event: TouchEvent | MouseEvent) => {
  if (!isRecording.value) return

  let currentY = 0
  if ('touches' in event && event.touches.length > 0) {
    currentY = event.touches[0].clientY
  } else if ('clientY' in event) {
    currentY = event.clientY
  }

  const deltaY = voiceStartY.value - currentY
  showCancelHint.value = deltaY > CANCEL_THRESHOLD
}

// 作用：发送语音消息，创建语音消息对象并发送到后端（策略模式重构版）
const sendVoiceMessage = async (voiceInfo: {
  filePath: string
  duration: number
  fileSize: number
}) => {
  // 第1步：检查是否需要选择题目（策略模式重构版）
  // 策略模式：使用策略的 requiresQuestion() 方法判断是否需要选择题目
  if (!hasSelectedQuestion.value && chatStrategy.value?.requiresQuestion()) {
    console.warn('[ChatView] 未选择题目，取消发送语音消息')
    showMessage('请先选择题目', 'warning')
    return
  }

  // 创建语音消息
  const voiceMessage: ChatBubble = {
    id: Date.now().toString(),
    content: '', // 语音消息不显示文字内容
    type: 'user',
    timestamp: '',
    sender: 'user',
    messageType: 'voice',
    voiceData: voiceInfo,
  }
  await addMessageToStore(voiceMessage)
  await scrollToBottom()

  // 发送语音消息到后端（策略模式重构版）
  isLoading.value = true
  try {
    const sendResult = await chatStrategy.value?.sendVoiceMessage(voiceInfo)

    if (sendResult?.success) {
      // 语音消息发送成功，等待真实回复
      await scrollToBottom()
      emit('response')
    } else {
      console.error('[ChatView] 语音消息发送失败', sendResult?.message)
      showMessage(sendResult?.message || '发送失败', 'error')
    }
  } catch (error) {
    console.error('[ChatView] 发送语音消息异常', error)
    showMessage('发送失败', 'error')
  } finally {
    isLoading.value = false
  }
}

// 作用：处理语音识别结果，将识别文本填入输入框
const onVoiceRecognitionResult = (text: string) => {
  if (text && text.trim()) {
    inputMessage.value = text
  }
}

// 作用：显示图片选择器对话框并处理选择结果
const showImagePickerDialog = async () => {
  // 第1步：检查是否需要选择题目（策略模式重构版）
  if (!hasSelectedQuestion.value && chatStrategy.value?.requiresQuestion()) {
    androidBridge.showToast('请先选择题目')
    return
  }

  // 第2步：打开全局图片选择器并等待结果
  const imageInfo = await pickImage()

  // 第3步：如果用户取消，直接返回
  if (!imageInfo) {
    return
  }

  // 第4步：处理选择的图片
  await onImageSelected(imageInfo)
}

// 作用：处理图片选择结果，创建图片消息并发送到后端（策略模式重构版）
const onImageSelected = async (imageInfo: {
  filePath: string
  width: number
  height: number
  fileSize: number
  base64DataUrl?: string
}): Promise<void> => {
  if (typeof imageInfo === 'object' && 'filePath' in imageInfo) {
    // 发送图片消息到后端（策略模式重构版）
    isLoading.value = true
    try {
      // 使用策略模式判断是否需要文本内容
      const messageText = chatStrategy.value?.shouldClearInputAfterImage() 
        ? inputMessage.value || '' 
        : ''

      // 使用策略模式发送图片消息
      await chatStrategy.value?.sendImageMessage(imageInfo, messageText, {
        selectedModel: selectedModel.value,
      })

      // 使用策略模式判断是否清空输入框
      if (chatStrategy.value?.shouldClearInputAfterImage()) {
        inputMessage.value = ''
      }

      // 计算属性会自动响应 store 变化，无需手动同步
      await scrollToBottom()
      emit('response')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '发送失败'
      showMessage(errorMessage, 'error')
    } finally {
      isLoading.value = false
    }
  }
}

// 公式输入现在直接在ChatInput中处理，不再需要这些方法

// 作用：处理消息点击事件，在选择模式下切换消息选择状态
const handleMessageClick = (message: ChatBubble) => {
  if (isSelectionMode.value) {
    toggleMessageSelection(message.id)
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
    const result = await chatStrategy.value.forwardMessage(message, {
      showDialog: true, // 默认显示对话框，策略内部可以根据需要覆盖
      onSuccess: async (result) => {
        // 转发成功后的回调
        if (result.sessionId) {
          // 触发跳转到老师对话的事件
          emit('open-teacher-dialog', {
            sessionId: result.sessionId,
            message: message,
          })
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
const handleEnterMultiSelect = () => {
  enterSelectionMode()
}

// 处理编辑消息
// 作用：开始编辑指定消息，将消息内容复制到输入框并设置编辑状态
// 处理图片加载完成事件
// 作用：当消息中的图片加载完成后，刷新 BetterScroll 以确保滚动容器高度正确，并滚动到底部
const handleImageLoaded = () => {
  // 使用防抖机制，避免多张图片同时加载时频繁刷新
  if (imageLoadRefreshTimer.value) {
    clearTimeout(imageLoadRefreshTimer.value)
  }
  imageLoadRefreshTimer.value = setTimeout(async () => {
    refreshBScroll()
    // 刷新后滚动到底部，确保图片完整显示
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
  editingQuestionId.value = currentQuestion.value?.id || null

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
      })

      // 清除编辑状态
      cancelEditMessage()

      // 检查是否需要选择题目（策略模式重构版）
      if (!hasSelectedQuestion.value && chatStrategy.value.requiresQuestion()) {
        // 如果未选择题目，添加欢迎消息回复
        const botReply: ChatBubble = {
          id: 'welcome_' + (Date.now() + 1).toString(),
          content: chatStrategy.value.getWelcomeMessage(),
          type: chatStrategy.value.getMessageType(),
          timestamp: '',
          sender: chatStrategy.value.getSenderType(),
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
}

// 作用：退出消息选择模式，清空已选择的消息
const exitSelectionMode = () => {
  isSelectionMode.value = false
  selectedMessages.value.clear()
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
        onSuccess: async (result) => {
          // 转发成功后的回调
          if (result.sessionId) {
            // 触发跳转到老师对话的事件
            emit('switchToTeacher', {
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

// 作用：切换联网搜索功能的开启/关闭状态
const toggleWebSearch = () => {
  getScenarioStore().toggleWebSearch()
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
 * 作用：设置语音识别回调、键盘事件监听、录音事件监听等
 */
const setupGlobalEventListeners = () => {
  if (typeof window !== 'undefined') {
    // 3.1 设置语音识别结果回调
    ;(
      window as unknown as { onVoiceRecognitionResult: (text: string) => void }
    ).onVoiceRecognitionResult = onVoiceRecognitionResult

    // 3.2 老师消息接收回调已由 teacherGeneralChatStore.initMessageReceiver() 统一管理
    // 不需要在这里重复设置，避免覆盖 store 中的回调

    // 3.3 监听原生键盘事件（处理系统键盘，只压缩页面不滚动）
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
      // 原生键盘隐藏时恢复页面
      handleKeyboardHidden()
    }

    // 3.4 监听录音权限授予后自动开始的录音
    window.addEventListener('nativeVoiceRecordingStarted', handleNativeVoiceRecordingStarted)

    window.addEventListener('keyboard-show', handleNativeKeyboardShow)
    window.addEventListener('keyboard-hide', handleNativeKeyboardHide)

    // 暴露控制函数给全局使用
    ;(window as unknown as Record<string, unknown>).disableNativeKeyboardListeners = () => {
      nativeKeyboardListenersEnabled = false
    }
    ;(window as unknown as Record<string, unknown>).enableNativeKeyboardListeners = () => {
      nativeKeyboardListenersEnabled = true
    }

    // 3.5 监听公式键盘事件（MathLive虚拟键盘，只滚动不压缩）
    window.addEventListener('formula-keyboard-toggle', handleFormulaKeyboardToggle)

    // 3.6 监听强制重置动画状态事件
    window.addEventListener('force-reset-animation-state', handleForceResetAnimationState)
  }
}

/**
 * 清理全局事件监听器
 * 作用：移除所有全局事件监听器，防止内存泄漏
 */
const cleanupGlobalEventListeners = () => {
  if (typeof window !== 'undefined') {
    // 清理录音事件监听器
    window.removeEventListener('nativeVoiceRecordingStarted', handleNativeVoiceRecordingStarted)
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
 * 作用：初始化聊天消息、设置事件监听器、配置语音识别等
 */
onMounted(async () => {
  // 步骤0.5：创建策略实例
  createStrategy()

  // 步骤1：初始化聊天消息
  await initializeMessages()

  // 步骤1.5：初始化 BScroll
  await initBScroll()
  scrollToBottom()

  // 初始化消息计数
  lastMessageCount.value = getScenarioStore().messages.length

  // 添加滚动监听，检测用户是否在底部
  const bscrollInstance = getInstance()
  if (bscrollInstance) {
    bscrollInstance.on('scroll', () => {
      checkIfUserAtBottom()
      // 如果用户滚动到底部，隐藏新消息提示按钮
      if (isUserAtBottom.value) {
        showNewMessageIndicator.value = false
      }
    })
  }

  // 步骤2：初始化动态键盘高度
  setTimeout(() => {
    originalViewportHeight.value = window.innerHeight
  }, 100)

  // 步骤3：设置全局事件监听器
  setupGlobalEventListeners()

  // 步骤4：图片消息已直接保存到持久化存储，ChatView加载时会自动从store中读取并显示
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

  // 步骤2：清理定时器
  if (loadingTimeout.value) {
    clearTimeout(loadingTimeout.value)
  }

  // 步骤3：清理老师消息监听器（仅在老师模式下）
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
// 加载指示器控制监听器
// 注意：由于涉及定时器副作用，不能使用 computed，使用 watchEffect 简化代码
watchEffect(() => {
  // 清除之前的定时器
  if (loadingTimeout.value) {
    clearTimeout(loadingTimeout.value)
    loadingTimeout.value = null
  }

  if (isChatLoading.value) {
    // 开始加载，先延迟一小段时间再显示，避免极短时间的闪烁
    loadingStartTime.value = Date.now()

    // 延迟显示加载指示器
    loadingTimeout.value = setTimeout(() => {
      // 如果此时仍在加载中，才显示指示器
      if (isChatLoading.value) {
        showLoadingIndicator.value = true
      }
      loadingTimeout.value = null
    }, MIN_LOADING_DELAY)
  } else {
    // 加载完成，检查是否满足最小显示时间
    const elapsedTime = Date.now() - loadingStartTime.value
    const remainingTime = Math.max(0, MIN_LOADING_DISPLAY_TIME - elapsedTime)

    if (remainingTime > 0 && showLoadingIndicator.value) {
      // 延迟隐藏，确保最小显示时间
      loadingTimeout.value = setTimeout(() => {
        showLoadingIndicator.value = false
        loadingTimeout.value = null
      }, remainingTime)
    } else {
      // 已经显示足够长时间或未显示，立即隐藏
      showLoadingIndicator.value = false
    }
  }
})


// 图片加载刷新定时器
const imageLoadRefreshTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// 消息变化监听器
watch(
  () => getScenarioStore().messages,
  (newMessages) => {
    if (newMessages && newMessages.length > 0) {
      // 刷新 BScroll 以确保内容高度正确
      refreshBScroll()

      // 检测是否有新消息（消息数量增加）
      const hasNewMessage = newMessages.length > lastMessageCount.value
      lastMessageCount.value = newMessages.length

      // 检查用户是否在底部（允许50px的误差）
      checkIfUserAtBottom()

      // 如果是键盘显示状态，立即滚动；否则根据用户位置决定
      if (isKeyboardVisible.value || isKeyboardAnimating.value) {
        // 键盘显示时立即滚动，确保用户体验
        scrollToBottom()
        showNewMessageIndicator.value = false
      } else {
        // 如果用户不在底部且有新消息，显示提示按钮
        if (hasNewMessage && !isUserAtBottom.value) {
          showNewMessageIndicator.value = true
        } else if (isUserAtBottom.value) {
          // 用户在底部，自动滚动并隐藏提示按钮
          scrollToBottom()
          showNewMessageIndicator.value = false
        }
      }
    }
  },
  { deep: true, immediate: false },
)

// 教师会话创建监听器
watch(
  () => teacherStore.currentSession,
  (session) => {
    // 只有在teacher-general类型且session存在时才创建或更新策略
    if (props.type === 'teacher-general' && session) {
      // 创建或更新策略
      // 策略会直接从 store 读取 session 信息，不需要传递参数
      chatStrategy.value = ChatStrategyFactory.create(props.type)
    }
  },
)


// 题目切换处理函数
watch(
  () => currentQuestion.value,
  (newQuestion, oldQuestion) => {
    console.log('题目切换处理函数', newQuestion, oldQuestion)
    if (newQuestion?.id !== oldQuestion?.id || newQuestion?.bmNo !== oldQuestion?.bmNo) {
      // 检查是否正在编辑消息
      if (isEditingMessage.value) {
        // 检查是否切换回正在编辑的题目
        if (editingQuestionId.value && newQuestion && newQuestion.id === editingQuestionId.value) {
          // 直接执行切换，不显示确认对话框
          executeQuestionSwitch()
          return
        }

        // 设置待执行的切换操作
        pendingSwitchAction.value = () => {
          // 退出编辑模式
          cancelEditMessage()
          // 清空输入内容
          if (chatInputRef.value && typeof chatInputRef.value.clearInputContent === 'function') {
            chatInputRef.value.clearInputContent()
          }
          // 执行正常的切换逻辑
          executeQuestionSwitch()
        }
        return
      }

      // 如果没有编辑状态，直接执行切换
      executeQuestionSwitch()
    }
  },
)

// 题目切换处理函数
const executeQuestionSwitch = () => {
  // 退出选择模式（如果正在选择模式）
  if (isSelectionMode.value) {
    exitSelectionMode()
  }

  // 重置会话状态（使用策略模式）
  if (chatStrategy.value?.getSessionInfo) {
    // 教师通用策略 - session 由 store 管理，不需要在这里重置
    aiSessionId.value = ''
  }
  
  // 使用策略模式重置会话（如果策略支持）
  if (chatStrategy.value?.resetSession) {
    chatStrategy.value.resetSession()
  }

  initializeMessages()
  nextTick(() => {
    scrollToBottom()
  })
}

// 暴露给父组件的方法和状态
defineExpose({
  inputMessage,
  sendMessage,
  isLoading,
  scrollToBottom,
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
  background: #ffffff;
  position: relative;
  z-index: 1; /* 确保消息区域在输入区域下方 */
}

/* 聊天消息滚动区域 - Better Scroll */
.scroll-wrapper.chat-messages {
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
}

.scroll-content {
  min-height: calc(100% + 1px);
}

/* 消息包装器 - 设置内边距和最大宽度 */
.messages-wrapper {
  padding: 16px 0;
  max-width: 100%;
  width: 100%;
}

/* 新消息提示按钮 */
.new-message-indicator {
  position: absolute;
  bottom: 80px;
  right: 20px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: bounce 2s infinite;
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

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 选择模式工具栏特定样式 */
.selection-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 12px 16px;
  margin: 8px 16px 12px;
  flex-shrink: 0;
  min-height: 56px;
}

/* 左侧全选区域 */
.selection-left {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  flex: 1;
}

.select-all-icon {
  font-size: 20px;
  color: #5f6368;
  flex-shrink: 0;
  transition: color 0.2s;
}

.select-all-icon.icon-selected {
  color: #7c3aed;
}

.selection-left:hover .select-all-icon {
  color: #7c3aed;
}

.select-all-text {
  font-size: 15px;
  color: #3c4043;
  font-weight: 400;
  margin-right: 4px;
}

.selection-count {
  font-size: 14px;
  color: #5f6368;
}

/* 右侧操作按钮组 */
.selection-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 取消按钮 */
.cancel-btn {
  background: #ffffff !important;
  color: #5f6368 !important;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 15px;
  font-weight: 500;
  text-transform: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.cancel-btn:hover {
  background: #f5f5f5 !important;
}

/* 发送按钮 */
.send-btn {
  background: #7c3aed !important;
  color: #ffffff !important;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 15px;
  font-weight: 500;
  text-transform: none;
  box-shadow: 0 1px 2px rgba(124, 58, 237, 0.3);
}

.send-btn:hover {
  background: #6d28d9 !important;
}

.send-btn[disabled] {
  background: #d1d5db !important;
  color: #9ca3af !important;
  opacity: 0.6;
  cursor: not-allowed;
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
  transition:
    opacity 0.2s ease-in-out,
    transform 0.2s ease-in-out;
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

/* ==================== 底部提示文案样式 ==================== */
.chat-footer-text {
  text-align: center;
  padding: 0px 20px 2px;
  color: #b0b0b0;
  font-size: 12px;
  line-height: 1.5;
}

/* ==================== 其他样式 ==================== */
/* 移除hover效果 - 已禁用背景色变化 */
</style>
