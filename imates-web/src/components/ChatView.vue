<template>
  <!-- 聊天视图主容器 - 支持键盘动画状态 -->
  <div ref="chatViewRef" class="chat-view" :class="{ 'keyboard-animating': isKeyboardAnimating }">
    <!-- 选择模式工具栏 - Gemini风格设计 -->
    <!-- 功能：当用户进入多选模式时显示，提供批量操作功能 -->
    <q-toolbar v-if="isSelectionMode" class="selection-toolbar native-toolbar-layout">
      <!-- 左侧：关闭选择模式按钮 -->
      <q-btn flat round icon="close" @click="exitSelectionMode" class="close-btn" size="md" />

      <!-- 中间：选择状态信息显示 -->
      <div class="selection-info native-toolbar-center">
        <q-icon name="check_circle" class="selection-icon" />
        <span class="selection-text">{{ selectedMessages.size }} 条消息已选择</span>
      </div>

      <!-- 右侧：操作按钮组 -->
      <div class="action-buttons native-toolbar-actions">
        <!-- 全选/取消全选按钮 -->
        <q-btn
          flat
          round
          icon="check_box"
          @click="selectAllMessages"
          class="action-btn native-action-btn"
          size="md"
          :color="selectedMessages.size === displayedMessages.length ? 'primary' : 'grey-6'"
        />
        <!-- 转发按钮 - 仅在AI通用、AI题目和AI教材模式下显示 -->
        <q-btn
          v-if="type === 'ai-general' || type === 'ai-exercise' || type === 'ai-textbook'"
          flat
          round
          icon="forward"
          @click="() => forwardToTeacher()"
          :disable="selectedMessages.size === 0"
          class="action-btn native-action-btn"
          size="md"
          color="primary"
        />
      </div>
    </q-toolbar>

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

          <!-- 分批次渲染状态指示器 - 显示历史消息渲染进度 -->
          <div v-if="isChatRendering && !isChatLoading" class="chat-rendering-indicator">
            <q-spinner-hourglass size="20px" color="secondary" />
            <span class="rendering-text">正在渲染历史消息...</span>
          </div>

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

    <!-- 聊天输入组件插槽 - 支持自定义输入组件，默认使用 ChatInput -->
    <slot name="input">
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
    <div class="chat-footer-text">
      与学伴共学,敢质疑、会判断，思维不设限!
    </div>

  </div>
</template>

<script setup lang="ts">
// ==================== 导入依赖 ====================
// Vue 核心功能
import { ref, nextTick, onMounted, onUnmounted, computed, watch } from 'vue'

// Better Scroll
import { useBetterScroll } from '../composables/useBetterScroll'

// 状态管理和工具函数
import { useQuestionStore } from '../stores/questionStore'
import { useUserStore } from '../stores/userStore'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useAiGeneralChatStore } from '../stores/aiGeneralChatStore'
import { useAiTextbookChatStore } from '../stores/aiTextbookChatStore'
import { useTeacherChatStore } from '../stores/teacherChatStore'
import { useImagePicker } from '../composables/useImagePicker'
import { apiService } from '../services/api-service'
import { androidBridge } from '../services/android-bridge'
import { showMessage } from '../utils'
import { getCurrentUserIdOrDefault } from '../utils/user/userId'
import { Dialog } from 'quasar'

// 子组件导入
import ChatMessageComponent from './chat/ChatMessage.vue'
import ChatInput from './chat/ChatInput.vue'
import VoiceRecorder from './chat/VoiceRecorder.vue'

// 类型定义导入
import type { ChatBubble } from '../types'
import type { ChatMessageSession } from '../types'
import type { ExerciseItem } from '../types'
import { SessionType } from '../types'
import type { TeacherSession } from '../stores/teacherChatStore'

// 策略模式导入
import { ChatStrategyFactory, type ChatStrategy } from './chat/strategies'

// ==================== 组件配置 ====================
// 定义组件属性 - 支持AI和老师两种对话模式
// 使用内联类型定义的泛型形式，确保 Vue 编译器能正确提取所有 props（包括可选属性）
// 这种方式比导入外部类型接口更可靠，因为 Vue 可以在编译时直接访问类型信息
const props = withDefaults(defineProps<{
  type: 'ai-general' | 'ai-exercise' | 'ai-textbook' | 'teacher'
  currentQuestionId?: string
  sessionId?: string
  overrideQuestion?: ExerciseItem | null
}>(), {
  overrideQuestion: null,
})

// 监听 props.overrideQuestion 的变化，用于调试
watch(() => props.overrideQuestion, (newVal, oldVal) => {
  // 可以在这里添加调试逻辑
}, { immediate: true, deep: true })

// 定义组件事件 - 支持响应、切换、焦点、滚动等事件
const emit = defineEmits<{
  response: [] // 消息发送完成事件
  switchToTeacher: [{ messages: ChatBubble[]; currentQuestion: unknown }] // 切换到老师对话事件
  focus: [] // 输入框获得焦点事件
  scrollToQuestionAndSelect: [targetIndex: number] // 滚动到指定题目并选中事件
  'scroll-to-bottom': [] // 滚动到底部事件
  'open-teacher-dialog': [{ sessionId: string; message: ChatBubble }] // 打开老师对话框事件
}>()

// ==================== 状态管理 ====================
// 全局状态管理
const questionStore = useQuestionStore()
const userStore = useUserStore()

// 场景Store
const aiExerciseStore = useAiExerciseChatStore()
const aiGeneralStore = useAiGeneralChatStore()
const aiTextbookStore = useAiTextbookChatStore()
const teacherStore = useTeacherChatStore()

// 辅助函数：获取当前场景的Store
const getScenarioStore = () => {
  switch (props.type) {
    case 'ai-exercise': return aiExerciseStore
    case 'ai-general': return aiGeneralStore
    case 'ai-textbook': return aiTextbookStore
    case 'teacher': return teacherStore
    default: return aiGeneralStore
  }
}

// 策略模式：创建聊天策略实例
const chatStrategy = ref<ChatStrategy>()

// 组件引用
const scrollWrapper = ref<HTMLElement | null>(null) // 滚动区域引用
const chatViewRef = ref<HTMLElement>() // 聊天视图容器引用
const chatInputRef = ref<InstanceType<typeof ChatInput>>() // 输入组件引用

// 使用 Better Scroll 组合式函数
const {
  init: initBScroll,
  refresh: refreshBScroll,
  scrollTo,
  getInstance
} = useBetterScroll(
  scrollWrapper,
  {
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
  }
)

// 基础状态变量
const inputMessage = ref('') // 输入框内容
const isLoading = ref(false) // 消息发送加载状态
const isRecording = ref(false) // 语音录制状态

// 对话相关状态（需要在策略初始化之前声明）
const teacherSession = ref<ChatMessageSession | null>(null) // 老师对话会话对象
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
const isChatRendering = computed(() => {
  const store = getScenarioStore()
  return 'isChatRendering' in store ? store.isChatRendering : false
})

// ==================== 加载状态管理 ====================
// 优化加载指示器显示，避免快速闪烁
const showLoadingIndicator = ref(false) // 是否显示加载指示器
const loadingStartTime = ref(0) // 加载开始时间
const loadingTimeout = ref<ReturnType<typeof setTimeout> | null>(null) // 加载超时定时器

// 加载指示器显示参数
const MIN_LOADING_DISPLAY_TIME = 300 // 最小显示时间300ms，确保用户能看到加载状态
const MIN_LOADING_DELAY = 100 // 最小延迟时间100ms，避免极短时间的闪烁

// ==================== 监听器 ====================
/**
 * 监听聊天记录加载状态变化
 * 作用：智能控制加载指示器的显示和隐藏，避免快速闪烁
 * 逻辑：
 * 1. 开始加载时延迟显示，避免极短时间闪烁
 * 2. 加载完成时确保最小显示时间，提升用户体验
 */
watch(
  () => isChatLoading.value,
  (isLoading) => {
    if (isLoading) {
      // 开始加载，先延迟一小段时间再显示，避免极短时间的闪烁
      loadingStartTime.value = Date.now()

      // 清除之前的定时器
      if (loadingTimeout.value) {
        clearTimeout(loadingTimeout.value)
        loadingTimeout.value = null
      }

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
        if (loadingTimeout.value) {
          clearTimeout(loadingTimeout.value)
          loadingTimeout.value = null
        }
      }
    }
  },
  { immediate: true },
)
// ==================== 消息管理相关状态 ====================
// 选择模式相关状态
const isSelectionMode = ref(false) // 是否处于消息选择模式
const selectedMessages = ref<Set<string>>(new Set()) // 已选择的消息ID集合

// 消息显示相关状态
const displayedMessages = ref<ChatBubble[]>([]) // 用于UI显示的本地消息列表

/**
 * 监听对话类型变化，动态切换策略
 * 策略模式：根据 props.type 创建对应的策略实例
 */
watch(() => [props.type, props.sessionId] as const, ([newType, sessionId]) => {
  // 第1步：如果是教师对话且提供了sessionId，创建session信息
  let session = undefined
  if (newType === 'teacher' && sessionId) {
    // 从localStorage获取科目信息，默认为数学
    const userId = getCurrentUserIdOrDefault()
    const storeSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
    const subject = storeSubject === 'BIOLOGY' ? 'biology' : 'math'
    
    session = {
      sessionId: sessionId,
      sessionName: `${subject === 'biology' ? '生物' : '数学'}老师答疑`,
      subject: subject
    }
    currentSubject.value = subject
  } else if (teacherSession.value) {
    // 使用已有的session
    session = {
      sessionId: teacherSession.value.sessionId,
      sessionName: teacherSession.value.sessionName,
      subject: currentSubject.value
    }
  }
  
  // 第2步：创建策略实例
  chatStrategy.value = ChatStrategyFactory.create(newType, {
    subject: currentSubject.value,
    session: session
  })
}, { immediate: true })

/**
 * 监听消息数据变化，同步UI显示的消息列表
 * 策略模式：使用策略的 getMessages() 方法获取消息
 */
watch(
  () => [props.type, aiGeneralStore.messages, aiExerciseStore.messages, aiTextbookStore.messages, teacherStore.messages],
  () => {
    // 第2步：使用策略获取消息列表
    if (chatStrategy.value) {
      const newMessages = chatStrategy.value.getMessages()
      displayedMessages.value = newMessages
    }
  },
  { immediate: true, deep: true },
)

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

// ==================== 转发功能相关状态 ====================

// ==================== 工具函数 ====================

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
 * 获取当前题目（优先使用 overrideQuestion，避免污染全局状态）
 * 作用：统一获取当前题目的入口，支持通过 props 传入题目（如拍照搜题场景）
 */
const currentQuestion = computed(() => {
  // 调试日志：检查 props 和 overrideQuestion
  // 优先使用 props 传入的题目（用于避免污染全局状态）
  // 使用 'in' 操作符检查属性是否存在，更可靠
  if ('overrideQuestion' in props && props.overrideQuestion !== undefined && props.overrideQuestion !== null) {
    return props.overrideQuestion
  }
  // 否则使用全局 store 中的题目
  const storeQuestion = questionStore.currentQuestion
  return storeQuestion
})

/**
 * 检查是否有选中的题目
 * 作用：判断当前是否有选中的题目，用于控制输入框的占位符文本
 */
const hasSelectedQuestion = computed(() => {
  return currentQuestion.value !== null
})

/**
 * 基础占位符文本
 * 作用：根据是否有选中题目和对话类型生成基础占位符文本
 * 逻辑：
 * 1. 无选中题目：显示引导用户选择题目的文本
 * 2. 有选中题目：根据对话类型显示对应的提示文本
 */
const placeholderText = computed(() => {
  if (!hasSelectedQuestion.value) {
    return '可以先聊聊，或选择题目后开始讨论'
  }
  if (props.type === 'ai-general') {
    return '向AI助手提问...'
  } else if (props.type === 'ai-exercise') {
    return '向AI题目助手提问...'
  } else if (props.type === 'ai-textbook') {
    return '向AI教材助手提问...'
  } else if (props.type === 'teacher') {
    return '向老师提问...'
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
      chatViewRefExists: false
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
      originalChatViewHeight: originalChatViewHeight.value
    })
    return
  }

  if (chatViewRef.value) {
    // 根据使用场景设置固定高度
    // 如果是在习题页面，高度写死为330px
    // 如果是在对话框中，高度写死为225px
    let newHeight: number
    if (props.type === 'ai-exercise') {
      // 习题页面：固定高度330px
      newHeight = 330
    } else {
      // 对话框：固定高度225px
      newHeight = 225
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
    const currentHeight = chatViewRef.value.offsetHeight
    
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
 * 初始化聊天消息
 * 作用：设置科目、创建老师会话、加载持久化数据或添加引导消息
 */
const initializeMessages = async () => {
  // 第1步：设置当前科目
  // 如果是老师对话模式，从localStorage读取科目（由MyProfileView设置）
  if (props.type === 'teacher') {
    const userId = getCurrentUserIdOrDefault()
    const teacherSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
    currentSubject.value = teacherSubject === 'BIOLOGY' ? 'biology' : 'math'
  } else {
    // 其他模式使用userStore中的科目
    currentSubject.value = userStore.subject === 'BIOLOGY' ? 'biology' : 'math'
  }

  // 第2步：如果是老师对话模式，需要初始化老师会话
  if (props.type === 'teacher') {
    await initializeTeacherSession()
  }

  // 第3步：只有在没有选择题目且没有聊天记录时才添加引导消息（策略模式重构版）
  if (!hasSelectedQuestion.value && chatStrategy.value) {
    // 策略模式：使用策略获取欢迎消息
    const welcomeContent = chatStrategy.value.getWelcomeMessage()
    
    const welcomeMessage: ChatBubble = {
      id: 'welcome_' + Date.now(),
      content: welcomeContent,
      type: chatStrategy.value.getMessageType(),
      timestamp: '',
      sender: chatStrategy.value.getSenderType(),
    }

    const store = getScenarioStore()
    if (store.messages.length === 0) {
      store.messages.push(welcomeMessage)
    }
  }
}

/**
 * 初始化老师会话
 * 作用：创建或初始化老师对话会话，设置消息监听器和会话信息
 */
const initializeTeacherSession = async () => {
  try {
    // 步骤1：初始化老师消息监听器（使用 Store 统一方法）
    await teacherStore.initMessageReceiver()
    // 步骤2：如果有当前题目，基于AI会话创建老师会话
    if (currentQuestion.value) {
      // 2.1 生成AI会话ID（基于题目ID和时间戳，确保唯一性）
      aiSessionId.value = `ai_session_${currentQuestion.value.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 2.2 生成会话名称，清理LaTeX内容避免JSON解析问题
      const rawTitle =
        currentQuestion.value.question || currentQuestion.value.title || '题目'

      // 移除LaTeX数学公式，只保留纯文本
      const cleanTitle = rawTitle
        .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
        .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
        .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim()

      const aiSessionName = (cleanTitle || '数学题目').substring(0, 30) + '...'

      // 2.3 创建老师会话（使用 Store 统一方法）
      const createdSession = teacherStore.createTeacherSession(
        aiSessionId.value,
        aiSessionName,
        currentSubject.value as 'biology' | 'math'
      )
      if (createdSession) {
        // 构建 ChatMessageSession 格式的会话对象
        teacherSession.value = {
          sessionId: createdSession.sessionId,
          sessionName: createdSession.sessionName,
          catalogId: 'CATEGORY_TEACHER_QA',
          sessionType: currentSubject.value === 'biology' 
            ? SessionType.USER_TALK_TEACHER_BIOLOGY 
            : SessionType.USER_TALK_TEACHER_MATH,
          createTime: createdSession.createTime,
          updateTime: createdSession.createTime,
          msgCount: 0,
        }
        
        // 2.4 先从本地存储加载聊天记录（如果有）
        await teacherStore.loadChatHistory(createdSession.sessionId)
        
        // 2.5 然后从API加载聊天记录（同步远程消息）
        await loadTeacherChatHistory()
      } else {
        console.warn('[ChatView] ⚠️ 创建会话失败，使用临时会话')
        // 创建临时老师会话，用于转发消息显示
        const tempSession = {
          sessionId: `temp_teacher_${Date.now()}`,
          sessionName: '临时老师会话',
          catalogId: 'CATEGORY_TEACHER_QA',
          sessionType: SessionType.USER_TALK_TEACHER_MATH,
          createTime: Date.now(),
          updateTime: Date.now(),
          msgCount: 0,
        }

        teacherSession.value = tempSession
      }
    } else {
      // 步骤3：如果没有题目，需要区分"加载已有会话"和"创建新会话"
      // 3.1 从localStorage读取当前教师科目
      const userId = getCurrentUserIdOrDefault()
      const teacherSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
      currentSubject.value = teacherSubject === 'BIOLOGY' ? 'biology' : 'math'
      // 3.2 判断是否是已存在的会话
      // sessionId格式：
      // - 临时ID（新建）: teacher-chat-{timestamp}
      // - 真实ID（已存在）: teacher-{hex}-{timestamp}
      const isExistingSession = props.sessionId && 
                                props.sessionId.startsWith('teacher-') && 
                                !props.sessionId.startsWith('teacher-chat-')
      if (isExistingSession) {
        // 场景A：加载已有会话
        const sessionKey = `teacher_chat_${props.sessionId}_session`
        const sessionData = localStorage.getItem(sessionKey)
        
        if (sessionData) {
          const existingSession = JSON.parse(sessionData)
          
          // 直接使用已有会话，不创建新的
          teacherSession.value = {
            sessionId: existingSession.sessionId,
            sessionName: existingSession.sessionName,
            catalogId: 'CATEGORY_TEACHER_QA',
            sessionType: existingSession.subject === 'biology' 
              ? SessionType.USER_TALK_TEACHER_BIOLOGY 
              : SessionType.USER_TALK_TEACHER_MATH,
            createTime: existingSession.createTime,
            updateTime: existingSession.createTime,
            msgCount: 0,
          }
          
          // 设置到store
          teacherStore.setSession(existingSession)
          
          // 先从本地存储加载聊天记录（如果有）
          await teacherStore.loadChatHistory(existingSession.sessionId)
          
          // 然后从API加载聊天记录（同步远程消息）
          await loadTeacherChatHistory()
          
          return
        }
      }
      
      // 场景B：创建新会话（仅当是临时ID或未找到已有会话时）
      // 3.3 生成会话ID
      aiSessionId.value = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 3.4 生成会话名称
      const subjectName = teacherSubject === 'BIOLOGY' ? '生物' : '数学'
      const aiSessionName = `${subjectName}老师答疑 - ${new Date().toLocaleString()}`
      
      // 3.5 创建老师会话（使用 Store 统一方法）
      const createdSession = teacherStore.createTeacherSession(
        aiSessionId.value,
        aiSessionName,
        currentSubject.value as 'biology' | 'math'
      )
      
      if (createdSession) {
        // 构建 ChatMessageSession 格式的会话对象
        teacherSession.value = {
          sessionId: createdSession.sessionId,
          sessionName: createdSession.sessionName,
          catalogId: 'CATEGORY_TEACHER_QA',
          sessionType: currentSubject.value === 'biology' 
            ? SessionType.USER_TALK_TEACHER_BIOLOGY 
            : SessionType.USER_TALK_TEACHER_MATH,
          createTime: createdSession.createTime,
          updateTime: createdSession.createTime,
          msgCount: 0,
        }
        // 3.5 先从本地存储加载聊天记录（如果有）
        await teacherStore.loadChatHistory(createdSession.sessionId)
        
        // 3.6 然后从API加载聊天记录（同步远程消息）
        await loadTeacherChatHistory()
      } else {
        // 创建临时老师会话
        const tempSession = {
          sessionId: `temp_teacher_${Date.now()}`,
          sessionName: `${subjectName}老师答疑`,
          catalogId: 'CATEGORY_TEACHER_QA',
          sessionType: SessionType.USER_TALK_TEACHER_MATH,
          createTime: Date.now(),
          updateTime: Date.now(),
          msgCount: 0,
        }
        
        teacherSession.value = tempSession
      }
    }
  } catch (error) {
    console.error('初始化教师会话失败:', error)
    // 步骤4：创建失败时，创建临时老师会话，用于转发消息显示
    const userId = getCurrentUserIdOrDefault()
    const teacherSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
    const subjectName = teacherSubject === 'BIOLOGY' ? '生物' : '数学'
    
    const tempSession = {
      sessionId: `temp_teacher_${Date.now()}`,
      sessionName: `${subjectName}老师答疑`,
      catalogId: 'CATEGORY_TEACHER_QA',
      sessionType: SessionType.USER_TALK_TEACHER_MATH,
      createTime: Date.now(),
      updateTime: Date.now(),
      msgCount: 0,
    }

    teacherSession.value = tempSession
  }
}

// 加载老师会话列表
const loadTeacherSessions = (): TeacherSession[] => {
  const userId = getCurrentUserIdOrDefault()
  const sessionPrefix = `${userId}_teacher_chat_`
  
  const sessions: TeacherSession[] = []
  const sessionIds = new Set<string>()
  
  // 遍历localStorage查找所有教师会话
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(sessionPrefix) && key.endsWith('_session')) {
      try {
        const sessionData = localStorage.getItem(key)
        if (sessionData) {
          const session = JSON.parse(sessionData) as TeacherSession
          
          if (!session || !session.sessionId || !session.sessionName) {
            continue
          }
          
          if (sessionIds.has(session.sessionId)) {
            continue
          }
          
          sessions.push(session)
          sessionIds.add(session.sessionId)
        }
      } catch (error) {
        console.error('[ChatView] ❌ 解析会话数据失败:', key, error)
      }
    }
  }
  
  sessions.sort((a, b) => b.createTime - a.createTime)
  return sessions
}

// 加载老师聊天历史
// 作用：从API加载老师对话的历史消息记录（现在主要用于同步远程消息到本地存储）
const loadTeacherChatHistory = async () => {
  if (!teacherSession.value) return

  try {
    const history = await apiService.getTeacherChatHistory(teacherSession.value.sessionId)
    if (history && history.length > 0) {
      // 获取当前已存在的消息ID集合，避免覆盖已正确设置的消息
      const existingMessageIds = new Set(teacherStore.messages.map((msg: ChatBubble) => msg.id))

      const historyMessages: ChatBubble[] = history.map((msg) => {
        // 第1步：解析消息类型
        // API返回的type字段：0=TEXT, 1=IMAGE, 2=VOICE, 3=DATE
        let messageType: 'text' | 'voice' | 'image' | 'chat_record' = 'text'
        if (msg.type !== undefined) {
          if (msg.type === 1) {
            messageType = 'image'
          } else if (msg.type === 2) {
            messageType = 'voice'
          }
        }

        // 第2步：构建基础消息对象
        const baseMessage: ChatBubble = {
          id: msg.messageId,
          content: msg.content || '',
          type: msg.isSelf ? 'user' : 'teacher',
          timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
          sender: msg.isSelf ? 'user' : 'teacher',
          messageType: messageType,
        }

        // 第3步：根据消息类型解析附加数据
        if (messageType === 'voice' && msg.content) {
          // 语音消息格式：duration + "," + filePath
          const parts = msg.content.split(',')
          if (parts.length >= 2) {
            const duration = parseInt(parts[0], 10) || 0
            const filePath = parts.slice(1).join(',') // 处理filePath中可能包含逗号的情况
            baseMessage.voiceData = {
              filePath: filePath,
              duration: duration, // duration是毫秒
              fileSize: 0, // 历史消息可能没有文件大小信息
            }
            baseMessage.content = '' // 语音消息不显示文字内容
          }
        } else if (messageType === 'image' && msg.content) {
          // 图片消息：content字段是filePath
          baseMessage.imageData = {
            filePath: msg.content,
            width: 0, // 历史消息可能没有尺寸信息
            height: 0,
            fileSize: 0,
          }
          baseMessage.content = '' // 图片消息不显示文字内容
        }

        return baseMessage
      })

      // 只添加不存在的消息，避免覆盖已正确设置的消息
      const newMessages = historyMessages.filter((msg) => !existingMessageIds.has(msg.id))
      if (newMessages.length > 0) {
        await addMessagesToStore(newMessages)
      }
    }
  } catch (error) {
    console.error('[ChatView] 加载老师聊天历史失败:', error)
    // 加载老师聊天历史失败
  }
}

// 作用：发送用户消息，支持文本和文件附件，根据对话类型选择AI或老师
const sendMessage = async (attachedFile?: File) => {
  if ((!inputMessage.value.trim() && !attachedFile) || isLoading.value) {
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
    // 教师场景：采用乐观发送，预先添加文本消息（与图片消息保持一致）
    if (props.type === 'teacher' && teacherSession.value) {
      const userMessage: ChatBubble = {
        id: Date.now().toString(),
        content: messageContent,
        type: 'user',
        timestamp: new Date().toISOString(),
        sender: 'user',
        messageType: 'text'
      }
      await addMessageToStore(userMessage)
      await scrollToBottom()
    }

    // AI通用、AI题目、AI教材和教师答疑模式：统一使用策略模式发送消息
    await chatStrategy.value?.sendMessage(messageContent, { 
      selectedModel: selectedModel.value
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

// 作用：发送语音消息，创建语音消息对象并发送到后端
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

  // 发送语音消息到后端
  isLoading.value = true
  try {
    let sendResult: { success: boolean; message?: string }

    if (props.type === 'teacher' && teacherSession.value) {
      // 发送语音消息给老师 - 使用API服务
      const success = await apiService.sendVoiceMessageToTeacher(
        voiceInfo.filePath,
        voiceInfo.duration.toString(),
        teacherSession.value.sessionId,
        currentSubject.value,
      )
      sendResult = { success }
    } else {
      // 发送语音消息给AI（暂时模拟）
      sendResult = { success: true }
    }

    if (sendResult.success) {
      // 语音消息发送成功，等待真实回复
      await scrollToBottom()
      emit('response')
    } else {
      console.error('[ChatView] 语音消息发送失败', sendResult.message)
      showMessage(sendResult.message || '发送失败', 'error')
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

// 作用：处理图片选择结果，创建图片消息并发送到后端
const onImageSelected = async (imageInfo: {
  filePath: string
  width: number
  height: number
  fileSize: number
  base64DataUrl?: string
}): Promise<void> => {
  if (typeof imageInfo === 'object' && 'filePath' in imageInfo) {
    // 发送图片消息到后端
    isLoading.value = true
    try {
      if (props.type === 'teacher' && teacherSession.value) {
        // 教师场景：采用乐观发送，预先添加消息（与AI场景保持一致）
        // 创建图片消息
        const imageMessage: ChatBubble = {
          id: Date.now().toString(),
          content: '', // 图片消息不显示文字内容
          type: 'user',
          timestamp: '',
          sender: 'user',
          messageType: 'image',
          imageData: {
            filePath: imageInfo.filePath,  // 保留原始 filePath，用于发送给后端等用途
            width: imageInfo.width,
            height: imageInfo.height,
            fileSize: imageInfo.fileSize,
            base64DataUrl: imageInfo.base64DataUrl,  // 使用 base64DataUrl 字段用于UI显示
          },
        }

        await addMessageToStore(imageMessage)
        await scrollToBottom()

        // 需要确保imageInfo有filePath和base64DataUrl
        if (!imageInfo.filePath || !imageInfo.base64DataUrl) {
          showMessage('图片数据不完整，请重试', 'error')
          return
        }
        await chatStrategy.value?.sendMessage('', {
          imageData: {
            filePath: imageInfo.filePath,  // 用于发送给Android端
            width: imageInfo.width,
            height: imageInfo.height,
            fileSize: imageInfo.fileSize,
            base64DataUrl: imageInfo.base64DataUrl  // 用于前端渲染
          }
        })
        emit('response')
      } else {
        // AI场景：需要预先添加消息，因为AI的sendMessage不会自动添加用户消息
        // 创建图片消息
        const imageMessage: ChatBubble = {
          id: Date.now().toString(),
          content: '', // 图片消息不显示文字内容
          type: 'user',
          timestamp: '',
          sender: 'user',
          messageType: 'image',
          imageData: {
            filePath: imageInfo.filePath,  // 保留原始 filePath，用于发送给后端等用途
            width: imageInfo.width,
            height: imageInfo.height,
            fileSize: imageInfo.fileSize,
            base64DataUrl: imageInfo.base64DataUrl,  // 使用 base64DataUrl 字段用于UI显示
          },
        }

        await addMessageToStore(imageMessage)
        await scrollToBottom()

        // 发送图片消息给AI（AI通用、AI题目和AI教材模式）
        const messageText = inputMessage.value || ''
        // 需要确保imageInfo有base64DataUrl
        if (!imageInfo.base64DataUrl) {
          showMessage('图片数据不完整，请重试', 'error')
          return
        }
        await chatStrategy.value?.sendMessage(messageText, { 
          selectedModel: selectedModel.value,
          imageData: {
            filePath: imageInfo.filePath,
            width: imageInfo.width,
            height: imageInfo.height,
            fileSize: imageInfo.fileSize,
            base64DataUrl: imageInfo.base64DataUrl
          }
        })

        // 清空输入框
        inputMessage.value = ''

        // 计算属性会自动响应 store 变化，无需手动同步
        await scrollToBottom()
        emit('response')
      }
    } catch {
      showMessage('发送失败', 'error')
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

/**
 * 转换消息类型，将角色类型转换为数据类型并添加前缀
 * 作用：将聊天消息转换为转发格式，清理LaTeX内容并添加角色前缀
 */
const convertMessageForForwarding = (msg: ChatBubble) => {
  
  // 获取数据类型，默认为text
  const dataType = msg.messageType || 'text'
  const messageType = dataType.toUpperCase() // text -> TEXT, voice -> VOICE, image -> IMAGE
  let messageContent = msg.content || ''

  // 根据角色类型添加前缀
  if (msg.type === 'user') {
    messageContent = '[学生] ' + messageContent
  } else if (msg.type === 'ai') {
    messageContent = '[AI助手] ' + messageContent
  }

  const cleanedContent = messageContent
    ? messageContent
        .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
        .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
        .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim()
      : ''
  
  const result = {
    id: msg.id,
    type: messageType,
    content: cleanedContent,
    timestamp: '',
  }
  
  return result
}

/**
 * 选择老师会话
 * 流程：1. 根据科目查找localStorage中对应老师的会话 2. 如果找到则使用，否则创建新会话
 * @param forwardMessages 如果提供，会在选择会话后转发这些消息
 * @returns 返回是否成功选择会话（如果提供forwardMessages，则返回是否转发成功）
 */
const selectTeacherSessionAndForward = async (
  forwardMessages?: ChatBubble[]
): Promise<boolean> => {
  try {
    // 获取当前科目
    const subject = currentSubject.value as 'biology' | 'math'
    // 加载老师会话列表
    const sessions = loadTeacherSessions()
    
    // 查找对应科目的会话（每个老师只维护一个会话）
    const existingSession = sessions.find(s => s.subject === subject)
    
    if (existingSession) {
      // 找到对应科目的会话，直接使用
      // 设置选中的会话
      teacherSession.value = {
        sessionId: existingSession.sessionId,
        sessionName: existingSession.sessionName,
        catalogId: 'CATEGORY_TEACHER_QA',
        sessionType: existingSession.subject === 'biology' 
          ? SessionType.USER_TALK_TEACHER_BIOLOGY 
          : SessionType.USER_TALK_TEACHER_MATH,
        createTime: existingSession.createTime,
        updateTime: existingSession.createTime,
        msgCount: 0,
      }
      
      // 设置到store
      teacherStore.setSession(existingSession)
      
      // 加载该会话的历史消息
      await teacherStore.loadChatHistory(existingSession.sessionId)
      
      // 如果提供了消息，转发消息
      if (forwardMessages && forwardMessages.length > 0) {
        const success = await forwardMessageToTeacher(forwardMessages)
        return success
      } else {
        return true
      }
    } else {
      // 没找到对应科目的会话，创建新会话
      await initializeTeacherSession()
      
      if (teacherSession.value) {
        if (forwardMessages && forwardMessages.length > 0) {
          const success = await forwardMessageToTeacher(forwardMessages)
          return success
        } else {
          return true
        }
      } else {
        return false
      }
    }
  } catch (error) {
    console.error('[ChatView] ❌ selectTeacherSessionAndForward() - 错误:', error)
    return false
  }
}

/**
 * 处理单条消息转发（仅在AI通用、AI题目和AI教材页面触发）
 * 流程：1. 验证当前页面类型 2. 选择老师会话 3. 转发消息 4. 显示结果
 * 作用：处理AI对话中的单条消息转发到老师对话
 */
const handleForwardMessage = async (message: ChatBubble) => {
  console.log('[ChatView] 🔵 handleForwardMessage 开始执行')
  console.log('[ChatView] 🔵 当前页面类型:', props.type)
  console.log('[ChatView] 🔵 要转发的消息:', message)
  
  // 确保只在AI通用、AI题目和AI教材页面触发
  if (props.type !== 'ai-general' && props.type !== 'ai-exercise' && props.type !== 'ai-textbook') {
    console.warn('[ChatView] ⚠️ 当前页面类型不支持转发:', props.type)
    return
  }

  try {
    console.log('[ChatView] 🔵 开始选择老师会话并转发消息')
    // 选择老师会话并转发
    const success = await selectTeacherSessionAndForward([message])
    console.log('[ChatView] 🔵 selectTeacherSessionAndForward 返回结果:', success)

    if (success) {
      console.log('[ChatView] 🔵 转发成功，准备显示提示')
      // AI题目对话页面不显示对话框，只显示简单提示
      if (props.type === 'ai-exercise') {
        console.log('[ChatView] 🔵 当前是 ai-exercise 类型，只显示简单提示，不显示对话框')
        showMessage('转发成功', 'success')
      } else {
        console.log('[ChatView] 🔵 当前页面类型:', props.type, '，显示前往老师对话对话框')
        // 转发成功后，询问用户是否前往老师对话
        Dialog.create({
          title: '转发成功',
          message: '消息已成功转发给老师，是否前往老师对话查看？',
          cancel: {
            label: '留在当前会话',
            color: 'grey-7',
            flat: true,
          },
          ok: {
            label: '前往老师对话',
            color: 'primary',
            unelevated: true,
          },
          persistent: false,
        }).onOk(() => {
          console.log('[ChatView] 🔵 用户点击了"前往老师对话"按钮')
          console.log('[ChatView] 🔵 teacherSession.value:', teacherSession.value)
          // 用户选择前往老师对话
          if (teacherSession.value) {
            console.log('[ChatView] 🔵 teacherSession 存在，sessionId:', teacherSession.value.sessionId)
            console.log('[ChatView] 🔵 准备触发 open-teacher-dialog 事件')
            emit('open-teacher-dialog', {
              sessionId: teacherSession.value.sessionId,
              message: message,
            })
            console.log('[ChatView] 🔵 open-teacher-dialog 事件已触发')
          } else {
            console.error('[ChatView] ❌ teacherSession.value 不存在，无法跳转到老师对话')
            showMessage('无法获取老师会话信息，请重试', 'error')
          }
        }).onCancel(() => {
          console.log('[ChatView] 🔵 用户点击了"留在当前会话"按钮')
          // 用户选择留在当前会话
          showMessage('转发成功，已留在当前会话', 'success')
        })
      }
    } else {
      console.error('[ChatView] ❌ 转发失败或用户取消')
      // 用户取消时不显示错误消息
    }
  } catch (error) {
    console.error('[ChatView] ❌ 转发消息失败 - 异常:', error)
    console.error('[ChatView] ❌ 错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息')
    showMessage('转发失败: ' + (error instanceof Error ? error.message : String(error)), 'error')
  }
}

// 统一的转发函数
const forwardMessageToTeacher = async (messages: ChatBubble[]) => {

  
  // 第1步：转换消息格式
  const cleanedMessages = messages.map(convertMessageForForwarding)

  // 第2步：序列化消息数据
  let selectedMessagesData: string
  try {
    selectedMessagesData = JSON.stringify(cleanedMessages)
  } catch (error) {
    console.error('[ChatView] ❌ 序列化失败:', error)
    return false
  }
  
  // 第3步：验证会话ID
  if (!teacherSession.value?.sessionId) {
    console.error('[ChatView] ❌ teacherSession.value 或 sessionId 不存在')
    return false
  }
  
  const sessionId = teacherSession.value.sessionId
  // 第4步：调用API转发
  try {
    const success = await apiService.forwardAiChatToTeacher(
      selectedMessagesData,
      sessionId,
    )
    if (success) {
      const convertedMessages = messages.map((msg) => {
        // 确定消息类型
        let messageType: 'text' | 'voice' | 'image' = msg.messageType || 'text'
        if (!messageType) {
          // 如果没有 messageType，根据数据判断
          if (msg.imageData?.filePath || msg.imageData?.base64DataUrl) {
            messageType = 'image'
          } else if (msg.voiceData?.filePath) {
            messageType = 'voice'
          } else {
            messageType = 'text'
          }
        }
        
        return {
          ...msg,
          id: msg.id.startsWith('forwarded_') ? msg.id : 'forwarded_' + msg.id,
          sender: 'user' as const,
          type: 'user' as const,
          messageType: messageType
        }
      })
      
      // 直接添加到老师消息存储并持久化
      teacherStore.messages.push(...convertedMessages)
      await teacherStore.saveChatHistory()
    } else {
      console.error('[ChatView] ❌ API返回 false，转发失败')
    }
    
    return success
  } catch (error) {
    console.error('[ChatView] ❌ forwardMessageToTeacher 异常:', error)
    console.error('[ChatView] ❌ 错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息')
    return false
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
  const inlineFormulaRegex = /<span[^>]*class="[^"]*mjx[^"]*"[^>]*data-mjx-texclass="mord"[^>]*>(.*?)<\/span>/gs
  processedContent = processedContent.replace(inlineFormulaRegex, (match, content) => {
    const latexContent = extractLatexFromMathJax(content)
    if (latexContent) {
      return `$${latexContent}$`
    }
    return match
  })

  // 2. 处理MathJax渲染的公式（块级公式）
  const displayFormulaRegex = /<span[^>]*class="[^"]*mjx[^"]*"[^>]*data-mjx-texclass="mord"[^>]*>(.*?)<\/span>/gs
  processedContent = processedContent.replace(displayFormulaRegex, (match, content) => {
    const latexContent = extractLatexFromMathJax(content)
    if (latexContent) {
      return `$${latexContent}$`
    }
    return match
  })

  // 3. 处理可能存在的其他HTML格式的公式
  const htmlFormulaRegex = /<span[^>]*data-formula="([^"]*)"[^>]*class="[^"]*formula[^"]*"[^>]*>.*?<\/span>/gs
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

// 更新编辑的消息
// 作用：更新已编辑的消息内容，删除后续消息并重新发送给AI
const updateEditedMessage = async (newContent: string) => {
  if (!editingMessageId.value) return

  try {
    // 根据场景获取对应的消息记录
    const targetMessages: ChatBubble[] = getScenarioStore().messages

    // 查找要更新的消息
    const messageIndex = targetMessages.findIndex(
      (msg) => msg.id === editingMessageId.value,
    )
    if (messageIndex === -1) {
      cancelEditMessage()
      return
    }

    // 更新消息内容
    targetMessages[messageIndex].content = newContent

    // 删除该消息之后的所有消息（因为编辑会改变对话上下文）
    const messagesToKeep = targetMessages.slice(0, messageIndex + 1)

    // 更新场景Store的消息列表
    const store = getScenarioStore()
    store.messages.length = 0 // 清空现有消息
    store.messages.push(...messagesToKeep) // 添加保留的消息（包括更新后的消息）

    // 保存聊天记录（根据场景调用不同的方法）
    if (props.type === 'ai-exercise' && currentQuestion.value?.id) {
      await aiExerciseStore.saveChatHistory(currentQuestion.value.id)
    } else if (props.type === 'ai-general') {
      await aiGeneralStore.saveChatHistory()
    } else if (props.type === 'ai-textbook') {
      await aiTextbookStore.saveChatHistory()
    } else if (props.type === 'teacher') {
      await teacherStore.saveChatHistory()
    }

    // 清除编辑状态
    cancelEditMessage()

    // 第1步：检查是否需要选择题目（策略模式重构版）
    // 策略模式：使用策略的 requiresQuestion() 方法判断是否需要选择题目
    if (!hasSelectedQuestion.value && chatStrategy.value?.requiresQuestion()) {
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

    // 发送编辑后的消息给AI（这会自动添加用户消息和AI回复）
    if (props.type === 'ai-general' || props.type === 'ai-exercise' || props.type === 'ai-textbook') {
      isLoading.value = true

      try {
        // 使用策略模式发送编辑后的消息
        await chatStrategy.value?.sendMessage(newContent, { selectedModel: selectedModel.value })

      } catch (aiError) {
        console.error('❌ [更新消息] AI回复发送失败:', aiError)
        showMessage('发送消息失败', 'error')
      } finally {
        isLoading.value = false
      }
    }

    // 滚动到底部
    await scrollToBottom()
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
 * 处理多选消息转发（仅在AI通用、AI题目和AI教材页面触发）
 * 流程：1. 验证页面类型 2. 获取选中消息 3. 直接逐条转发
 * 作用：处理AI对话中的多条消息转发操作，直接逐条转发
 */
const forwardToTeacher = async (messageList?: ChatBubble[]) => {
  // 确保只在AI通用、AI题目和AI教材页面触发
  if (props.type !== 'ai-general' && props.type !== 'ai-exercise' && props.type !== 'ai-textbook') {
    return
  }

  // 流程1：获取要转发的消息列表
  const selectedMessageList =
    messageList ||
    displayedMessages.value.filter((message) => selectedMessages.value.has(message.id))
  if (selectedMessageList.length === 0) return

  // 流程2：直接逐条转发
  if (isSelectionMode.value) {
    exitSelectionMode()
    await forwardAsSeparateMessages(selectedMessageList, '')
  } else {
    // 兜底逻辑：单条消息直接转发
    await handleForwardMessage(selectedMessageList[0])
  }
}

/**
 * 逐条转发：一条一条发送（仅在AI通用、AI题目和AI教材页面触发）
 * 流程：1. 验证页面类型 2. 创建老师会话 3. 发送到后端 4. 切换页面
 * 作用：将多条消息逐条发送给老师
 */
const forwardAsSeparateMessages = async (messages: ChatBubble[], additionalMessage: string) => {
  // 确保只在AI通用、AI题目和AI教材页面触发
  if (props.type !== 'ai-general' && props.type !== 'ai-exercise' && props.type !== 'ai-textbook') {
    return
  }

  try {
    // 选择老师会话（不转发，仅选择）
    const selected = await selectTeacherSessionAndForward()
    if (!selected || !teacherSession.value) {
      // 用户取消选择或会话不存在
      return
    }

    // 逐条转发消息
    let successCount = 0
    for (const message of messages) {
        const selectedMessagesData = JSON.stringify([convertMessageForForwarding(message)])

        const success = await apiService.forwardAiChatToTeacher(
          selectedMessagesData,
          teacherSession.value!.sessionId,
        )

        if (success) {
          successCount++
        }
      }

      if (successCount > 0) {
        // 转发成功后，将消息添加到老师消息存储并持久化
        const convertedMessages = messages.map((msg) => ({
          ...msg,
          id: msg.id.startsWith('forwarded_') ? msg.id : 'forwarded_' + msg.id,
          sender: 'user' as const,
          type: 'user' as const,
        }))

        // 直接添加到老师消息存储
        teacherStore.messages.push(...convertedMessages)
        await teacherStore.saveChatHistory()

        // AI题目对话页面不显示对话框，只显示简单提示
        if (props.type === 'ai-exercise') {
          showMessage(`转发成功，已转发 ${successCount} 条消息`, 'success')
        } else {
          // 转发成功后询问用户是否前往老师对话
          Dialog.create({
            title: '转发成功',
            message: `已成功转发 ${successCount} 条消息给老师，是否前往老师对话查看？`,
            cancel: {
              label: '留在当前会话',
              color: 'grey-7',
              flat: true,
            },
            ok: {
              label: '前往老师对话',
              color: 'primary',
              unelevated: true,
            },
            persistent: false,
          }).onOk(() => {
            console.log('[ChatView] 🔵 用户点击了批量转发的"前往老师对话"按钮')
            console.log('[ChatView] 🔵 teacherSession.value:', teacherSession.value)
            // 用户选择前往老师对话
            const forwardData = {
              messages: messages,
              currentQuestion: currentQuestion.value,
              additionalMessage: additionalMessage,
              forwardMode: 'separate',
              successCount: successCount,
              sessionId: teacherSession.value?.sessionId, // 添加会话ID
            }
            console.log('[ChatView] 🔵 forwardData:', forwardData)
            console.log('[ChatView] 🔵 准备触发 switchToTeacher 事件')
            emit('switchToTeacher', forwardData)
            console.log('[ChatView] 🔵 switchToTeacher 事件已触发')
          }).onCancel(() => {
            console.log('[ChatView] 🔵 用户点击了批量转发的"留在当前会话"按钮')
            // 用户选择留在当前会话
            showMessage(`转发成功，已转发 ${successCount} 条消息`, 'success')
          })
        }
      } else {
        showMessage('转发失败，请重试', 'error')
      }
  } catch (error) {
    console.error('[CHAT_DEBUG] ❌ 逐条转发失败:', error)
    showMessage('转发失败', 'error')
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

// 注意：原生图片选择和拍照的结果处理已经移到 ImagePicker 组件中
// 这里不再重复处理，避免图片重复发送

// 老师消息接收处理已统一由 teacherChatStore.initMessageReceiver() 管理
// 所有消息接收逻辑都在 store 中处理，这里不再需要单独的回调函数

// ==================== 生命周期钩子 ====================
/**
 * 组件挂载时的初始化
 * 作用：初始化聊天消息、设置事件监听器、配置语音识别等
 */
onMounted(async () => {
  // 步骤1：初始化聊天消息
  initializeMessages()
  
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
  if (typeof window !== 'undefined') {
    // 3.1 设置语音识别结果回调
    ;(
      window as unknown as { onVoiceRecognitionResult: (text: string) => void }
    ).onVoiceRecognitionResult = onVoiceRecognitionResult

    // 3.2 老师消息接收回调已由 teacherChatStore.initMessageReceiver() 统一管理
    // 不需要在这里重复设置，避免覆盖 store 中的回调

    // 3.3 监听原生键盘事件（处理系统键盘，只压缩页面不滚动）
    // 动态控制原生键盘事件监听，避免与公式键盘冲突
    let nativeKeyboardListenersEnabled = true
    
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

    // 3.4 监听公式键盘事件（MathLive虚拟键盘，只滚动不压缩）
    window.addEventListener('formula-keyboard-toggle', handleFormulaKeyboardToggle)
    
    
    // 3.6 监听强制重置动画状态事件
    window.addEventListener('force-reset-animation-state', handleForceResetAnimationState)
  }
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
  
  // 步骤1：清理键盘事件监听器
  if (typeof window !== 'undefined') {
    // 注意：内联函数无法直接移除，但组件卸载时会自动清理
    // 清理录音事件监听器
    window.removeEventListener('nativeVoiceRecordingStarted', handleNativeVoiceRecordingStarted)
    // 清理公式键盘事件监听器
    window.removeEventListener('formula-keyboard-toggle', handleFormulaKeyboardToggle)
    
    
    // 清理强制重置动画状态事件监听器
    window.removeEventListener('force-reset-animation-state', handleForceResetAnimationState)
  }

  // 步骤2：清理定时器
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  if (loadingTimeout.value) {
    clearTimeout(loadingTimeout.value)
  }

  // 步骤3：清理老师消息监听器（仅在老师模式下）
  // 注意：回调函数 window.onTeacherMessageReceived 由 teacherChatStore 统一管理
  // 不应该在这里清理，因为：
  // 1. 回调函数是全局的，应该在应用生命周期中保持存在
  // 2. 用户可能在 AI 会话和老师会话之间切换，不应该在切换时清理回调
  // 3. 清理应该只在 UnifiedChatDialog 完全关闭时进行（由 teacherChatStore.cleanupMessageReceiver 统一处理）
  if (props.type === 'teacher') {
    try {
      // 清理 Android 原生监听器（这是 Android 端的资源清理，需要执行）
      if (typeof window !== 'undefined' && window.AndroidBridge?.cleanupTeacherMessageListener) {
        window.AndroidBridge.cleanupTeacherMessageListener()
      }
    } catch {
      // 清理老师消息监听器失败
    }
    // 不再清理 window.onTeacherMessageReceived，由 teacherChatStore 统一管理
  }

  // 步骤4：清理原始高度记录
  originalChatViewHeight.value = 0
})

// ==================== 监听器 ====================
/**
 * 监听题目选择状态变化
 * 作用：当题目选择状态改变时，重新初始化消息并滚动到底部
 */
watch(hasSelectedQuestion, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    initializeMessages()
    scrollToBottom()
  }
})

/**
 * 监听AI聊天消息数量变化
 * 作用：当AI聊天消息数量变化时，处理UI更新
 * 逻辑：如果消息数量从有变为0，说明可能是清除了记录，需要重新初始化
 */
watch(
  () => getScenarioStore().messages.length,
  (newLength, oldLength) => {
    // 如果消息数量从有变为0，说明可能是清除了记录，需要重新初始化
    if (oldLength > 0 && newLength === 0 && (props.type === 'ai-general' || props.type === 'ai-exercise' || props.type === 'ai-textbook')) {
      initializeMessages()
      nextTick(() => {
        refreshBScroll()
        scrollToBottom()
      })
    }
  },
)

/**
 * 监听聊天消息变化，处理滚动
 * 作用：当聊天消息变化时，智能处理滚动行为
 */
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * 图片加载刷新定时器
 * 作用：防抖处理图片加载完成后的滚动容器刷新
 */
const imageLoadRefreshTimer = ref<ReturnType<typeof setTimeout> | null>(null)

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
          if (scrollTimeout) {
            clearTimeout(scrollTimeout)
          }
          scrollTimeout = setTimeout(() => {
            scrollToBottom()
            showNewMessageIndicator.value = false
          }, 50)
        }
      }

      // 【重要】移除MathJax全局渲染调用
      // 数学公式渲染由各个ChatMessage组件独立处理，避免阻塞主线程
    }
  },
  { deep: true, immediate: false },
)

watch(
  () => currentQuestion.value,
  (newQuestion, oldQuestion) => {
    if (newQuestion?.id !== oldQuestion?.id) {
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

watch(
  () => userStore.subject,
  (newSubject) => {
    currentSubject.value = newSubject === 'BIOLOGY' ? 'biology' : 'math'

    // 检查是否正在编辑消息
    if (isEditingMessage.value) {
      // 设置待执行的切换操作
      pendingSwitchAction.value = () => {
        // 退出编辑模式
        cancelEditMessage()
        // 清空输入内容
        if (chatInputRef.value && typeof chatInputRef.value.clearInputContent === 'function') {
          chatInputRef.value.clearInputContent()
        }
        // 执行正常的切换逻辑
        executeSubjectSwitch()
      }
      return
    }

    // 如果没有编辑状态，直接执行切换
    executeSubjectSwitch()
  },
)

/**
 * 监听待发送图片状态（用于拍作业场景）
 * 流程：检测到待发送图片 → 自动调用onImageSelected发送图片 → 清除待发送图片状态
 */
watch(
  () => aiGeneralStore.pendingImage,
  async (pendingImageData) => {
    // 第1步：检查是否为AI通用聊天场景
    if (props.type !== 'ai-general') {
      return
    }
    
    // 第2步：检查是否有待发送图片
    if (!pendingImageData) {
      return
    }
    
    try {
      // 第3步：调用onImageSelected发送图片
      await onImageSelected(pendingImageData)
      
      // 第4步：清除待发送图片状态
      aiGeneralStore.clearPendingImage()
    } catch (error) {
      console.error('[ChatView] ❌ 自动发送图片失败:', error)
      // 清除待发送图片状态（即使失败也要清除，避免重复发送）
      aiGeneralStore.clearPendingImage()
      showMessage('图片发送失败，请重试', 'error')
    }
  },
  { immediate: true } // 立即执行一次，检查是否有待发送图片
)

/**
 * 监听待发送图片状态（用于拍作业场景 - 教师场景）
 * 流程：检测到待发送图片 → 自动调用onImageSelected发送图片 → 清除待发送图片状态
 */
watch(
  () => teacherStore.pendingImage,
  async (pendingImageData) => {
    // 第1步：检查是否为教师聊天场景
    if (props.type !== 'teacher') {
      return
    }
    
    // 第2步：检查是否有待发送图片
    if (!pendingImageData) {
      return
    }
    
    try {
      // 第3步：调用onImageSelected发送图片
      await onImageSelected(pendingImageData)
      
      // 第4步：清除待发送图片状态
      teacherStore.clearPendingImage()
    } catch (error) {
      console.error('[ChatView] ❌ 自动发送图片失败:', error)
      // 清除待发送图片状态（即使失败也要清除，避免重复发送）
      teacherStore.clearPendingImage()
      showMessage('图片发送失败，请重试', 'error')
    }
  },
  { immediate: true } // 立即执行一次，检查是否有待发送图片
)

// 执行题目切换逻辑
// 作用：执行题目切换，退出选择模式，重置老师会话状态并重新初始化消息
const executeQuestionSwitch = () => {

  // 退出选择模式（如果正在选择模式）
  if (isSelectionMode.value) {
    exitSelectionMode()
  }

  // 重置老师会话状态
  if (props.type === 'teacher') {
    teacherSession.value = null
    aiSessionId.value = ''
  }

  // 注意：不要在这里清空聊天记录！
  // 聊天记录的清空和加载应该由 questionStore.selectQuestion 统一管理
  // 避免与 loadChatHistory 产生竞态条件

  initializeMessages()
  nextTick(() => {
    scrollToBottom()
  })
}

// 执行科目切换逻辑
// 作用：执行科目切换，重新初始化老师会话
const executeSubjectSwitch = () => {

  // 如果是老师对话模式，需要重新初始化会话
  if (props.type === 'teacher') {
    teacherSession.value = null
    initializeMessages()
  }
}
// 暴露给父组件的方法和状态
defineExpose({
  inputMessage,
  sendMessage,
  isLoading,
  scrollToBottom
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
  0%, 100% {
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
  background: #f8f9fa;
  border-bottom: 1px solid #e8eaed;
}

.close-btn {
  color: #5f6368;
  margin-right: 16px;
}

.close-btn:hover {
  background-color: rgba(60, 64, 67, 0.08);
}

.selection-icon {
  font-size: 20px;
  color: #1a73e8;
}

.selection-text {
  font-size: 14px;
  font-weight: 500;
  color: #3c4043;
  letter-spacing: 0.25px;
}

.action-btn[color='primary'] {
  background-color: rgba(26, 115, 232, 0.12);
}

.action-btn[color='grey-6']:hover {
  background-color: rgba(95, 99, 104, 0.08);
}

.message-selectable {
  cursor: pointer;
}

.message-selectable .ai-message,
.message-selectable .user-message {
  padding-left: 60px;
}

.message-selected {
  background-color: rgba(25, 118, 210, 0.08);
  border-radius: 8px;
  margin: 0 12px;
  padding: 8px 0;
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

/* 聊天记录渲染状态指示器 - 显示历史消息渲染进度 */
.chat-rendering-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 8px;
  color: #888;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  margin: 10px 20px;
}

/* 渲染文本样式 */
.rendering-text {
  font-size: 13px;
  color: #888;
  font-weight: 400;
}

/* ==================== 底部提示文案样式 ==================== */
.chat-footer-text {
  text-align: center;
  padding: 0px  20px 2px;
  color: #b0b0b0;
  font-size: 12px;
  line-height: 1.5;
}

/* ==================== 其他样式 ==================== */
/* 移除hover效果 - 已禁用背景色变化 */
</style>
