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
        <!-- 转发按钮 - 仅在AI模式下显示 -->
        <q-btn
          v-if="type === 'ai'"
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
      <!-- 滚动区域组件 - 自定义滚动条样式 -->
      <q-scroll-area ref="scrollAreaRef" class="chat-messages" :thumb-style="thumbStyle">
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
            @toggle-selection="toggleMessageSelection"
            @message-click="handleMessageClick"
            @forward-message="handleForwardMessage"
            @enter-multi-select="handleEnterMultiSelect"
            @edit-message="handleEditMessage"
          />
        </div>
      </q-scroll-area>
    </div>

    <!-- 聊天输入组件 - 支持文本、语音、图片等多种输入方式 -->
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

    <!-- 语音录制组件 - 显示录音状态和取消提示 -->
    <VoiceRecorder :is-recording="isRecording" :show-cancel-hint="showCancelHint" />

    <!-- 图片选择器对话框 - 支持拍照和相册选择 -->
    <ImagePicker v-model="showImagePicker" @image-selected="onImageSelected" />

    <!-- 转发模式选择对话框 - 支持合并转发和逐条转发 -->
    <ForwardModeDialog
      v-model="showForwardModeDialog"
      :message-count="pendingForwardMessages.length"
      @confirm="handleForwardModeConfirm"
    />

  </div>
</template>

<script setup lang="ts">
// ==================== 导入依赖 ====================
// Vue 核心功能
import { ref, nextTick, onMounted, onUnmounted, computed, watch } from 'vue'

// Quasar UI 组件
import { QScrollArea } from 'quasar'

// 状态管理和工具函数
import { useExerciseStore } from '../stores/exerciseStore'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { apiService } from '../services/api-service'
import { androidBridge } from '../services/android-bridge'

// 子组件导入
import ChatMessageComponent from './chat/ChatMessage.vue'
import ChatInput from './chat/ChatInput.vue'
import ForwardModeDialog from './chat/ForwardModeDialog.vue'
import VoiceRecorder from './chat/VoiceRecorder.vue'
import ImagePicker from './chat/ImagePicker.vue'

// 类型定义导入
import type { ChatBubble } from '../types'
import type { ChatMessageSession } from '../types'
import type { ChatViewProps } from '../types'
import { SessionType } from '../types'

// ==================== 组件配置 ====================
// 定义组件属性 - 支持AI和老师两种对话模式
const props = defineProps<ChatViewProps>()

// 定义组件事件 - 支持响应、切换、焦点、滚动等事件
const emit = defineEmits<{
  response: [] // 消息发送完成事件
  switchToTeacher: [{ messages: ChatBubble[]; currentQuestion: unknown }] // 切换到老师对话事件
  focus: [] // 输入框获得焦点事件
  scrollToQuestionAndSelect: [targetIndex: number] // 滚动到指定题目并选中事件
  'scroll-to-bottom': [] // 滚动到底部事件
}>()

// ==================== 状态管理 ====================
// 全局状态管理
const exerciseStore = useExerciseStore()

// 组件引用
const scrollAreaRef = ref<QScrollArea>() // 滚动区域引用
const chatViewRef = ref<HTMLElement>() // 聊天视图容器引用
const chatInputRef = ref<InstanceType<typeof ChatInput>>() // 输入组件引用

// 基础状态变量
const inputMessage = ref('') // 输入框内容
const isLoading = ref(false) // 消息发送加载状态
const isRecording = ref(false) // 语音录制状态

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
// 使用store中的联网搜索状态
const enableWebSearch = computed(() => exerciseStore.enableWebSearch)
const selectedModel = ref('mate') // 选中的AI模型

// 聊天记录加载状态
const isChatLoading = computed(() => exerciseStore.isChatLoading) // 聊天记录是否正在加载
const isChatRendering = computed(() => exerciseStore.isChatRendering) // 聊天记录是否正在渲染

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
  () => exerciseStore.isChatLoading,
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
        if (exerciseStore.isChatLoading) {
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
 * 监听消息数据变化，同步UI显示的消息列表
 * 作用：根据对话类型（AI/老师）选择对应的消息数据源
 * 逻辑：
 * 1. AI模式：使用exerciseStore.chatMessages
 * 2. 老师模式：使用exerciseStore.teacherMessages
 * 3. 其他情况：默认使用AI消息存储
 */
watch(
  () => [props.type, exerciseStore.chatMessages, exerciseStore.teacherMessages],
  () => {
    if (props.type === 'ai') {
      // AI 模式下，直接使用 store 中的消息
      displayedMessages.value = exerciseStore.chatMessages
    } else if (props.type === 'teacher') {
      // 老师模式下，使用老师消息存储
      displayedMessages.value = exerciseStore.teacherMessages
    } else {
      // 其他情况，显示 AI 消息存储的内容（或为空）
      displayedMessages.value = exerciseStore.chatMessages
    }
  },
  { immediate: true, deep: true },
)

// ==================== 转发功能相关状态 ====================
const showForwardModeDialog = ref(false) // 是否显示转发模式选择对话框
const pendingForwardMessages = ref<ChatBubble[]>([]) // 待转发的消息列表

// ==================== 编辑功能相关状态 ====================
const isEditingMessage = ref(false) // 是否正在编辑消息
const editingMessageId = ref<string | null>(null) // 正在编辑的消息ID
const originalMessageContent = ref<string>('') // 原始消息内容（用于取消编辑时恢复）
const editingQuestionId = ref<string | null>(null) // 记录正在编辑的题目ID

// 编辑模式确认对话框状态
const pendingSwitchAction = ref<(() => void) | null>(null) // 待执行的切换操作（用于编辑模式下的确认）

// ==================== 消息管理函数 ====================
/**
 * 添加单条消息到存储
 * 作用：将单条消息添加到store或本地消息列表，根据对话类型选择不同的存储方式
 * 参数：message - 要添加的聊天消息对象
 */
const addMessageToStore = async (message: ChatBubble) => {
  if (props.type === 'ai') {

    exerciseStore.chatMessages.push(message)

    // 保存聊天记录到存储
    await exerciseStore.saveChatHistory()
  } else if (props.type === 'teacher') {

    // 添加到老师消息存储
    exerciseStore.teacherMessages.push(message)

    // 保存老师聊天记录到存储
    await exerciseStore.saveTeacherChatHistory()
  }
}

/**
 * 批量添加消息到存储
 * 作用：批量添加消息到store或本地消息列表，用于处理多条消息的添加操作
 * 参数：messages - 要添加的聊天消息对象数组
 */
const addMessagesToStore = async (messages: ChatBubble[]) => {
  if (props.type === 'ai') {

    exerciseStore.chatMessages.push(...messages)

    // 保存聊天记录到存储
    await exerciseStore.saveChatHistory()
  } else if (props.type === 'teacher') {

    // 添加到老师消息存储
    exerciseStore.teacherMessages.push(...messages)

    // 保存老师聊天记录到存储
    await exerciseStore.saveTeacherChatHistory()
  }
}
// ==================== 其他功能相关状态 ====================
// 文件上传相关状态
const uploadedFiles = ref<Array<{ id: string; name: string; file: File }>>([]) // 已上传的文件列表
const activeMode = ref<{ label: string; icon: string; color: string } | null>(null) // 当前激活的模式

// 老师对话相关状态
const teacherSession = ref<ChatMessageSession | null>(null) // 老师对话会话对象
const aiSessionId = ref<string>('') // AI会话ID
const currentSubject = ref<string>('math') // 当前科目，默认为数学

// 图片选择相关状态
const showImagePicker = ref(false) // 是否显示图片选择器

// 语音录制相关状态
const showCancelHint = ref(false) // 是否显示取消提示
const voiceStartY = ref(0) // 语音录制开始时的Y坐标
const voiceCurrentY = ref(0) // 语音录制当前Y坐标
const CANCEL_THRESHOLD = 100 // 上滑取消的阈值（像素）

// ==================== 计算属性 ====================
// 滚动条样式配置
const thumbStyle = {
  right: '4px',
  borderRadius: '5px',
  backgroundColor: '#027be3',
  width: '5px',
  opacity: '0.75',
}

/**
 * 检查是否有选中的题目
 * 作用：判断当前是否有选中的题目，用于控制输入框的占位符文本
 */
const hasSelectedQuestion = computed(() => {
  return exerciseStore.currentQuestion !== null
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
  return props.type === 'ai' ? '向AI提问...' : '向老师提问...'
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

  // 步骤2：记录原始高度
  if (originalChatViewHeight.value === 0) {
    originalChatViewHeight.value = chatViewRef.value?.offsetHeight || 0
  }

  // 步骤3：获取CSS动画参数
  const cssParams = getCSSAnimationParams()

  // 步骤4：执行高度变化动画
  if (chatViewRef.value) {
    const newHeight = Math.max(originalChatViewHeight.value - keyboardHeight.value, 200)

    chatViewRef.value.style.height = `${newHeight}px`
    chatViewRef.value.style.transition = `height ${cssParams.duration} ${cssParams.curve}`
  }

  // 步骤5：动画完成后清理
  setTimeout(() => {
    isAnimating.value = false
    if (chatViewRef.value) {
      chatViewRef.value.style.transition = ''
    }
    // 动画完成后再次确保滚动到底部
    scrollToBottom()
  }, parseInt(cssParams.duration))
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
  }

  // 步骤4：ChatView高度变化动画完成后清理
  // 等待高度变化动画完成，然后清理所有相关状态，确保下次动画能正常执行
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
    
  }, parseInt(cssParams.duration))
}

// ==================== 初始化函数 ====================
/**
 * 初始化聊天消息
 * 作用：设置科目、创建老师会话、加载持久化数据或添加引导消息
 */
const initializeMessages = async () => {
  // 步骤1：设置当前科目
  currentSubject.value = exerciseStore.subject === 'BIOLOGY' ? 'biology' : 'math'

  // 步骤2：如果是老师对话模式，需要初始化老师会话
  if (props.type === 'teacher') {
    await initializeTeacherSession()
  }

  // 步骤3：加载历史消息（如果有选中的题目）
  // 注意：这里不直接调用 loadChatHistory，因为 selectQuestion 已经会调用
  // 避免重复加载导致的问题

  // 步骤4：只有在没有选择题目且没有聊天记录时才添加引导消息
  if (!hasSelectedQuestion.value) {
    const welcomeMessage: ChatBubble = {
      id: 'welcome_' + Date.now(),
      content: '请先选择一道题目，然后我们可以开始讨论。你可以从题目列表中选择一道感兴趣的题目。',
      type: props.type === 'ai' ? 'ai' : 'teacher',
      timestamp: '',
      sender: props.type === 'ai' ? 'ai' : 'teacher',
    }

    if (props.type === 'ai' && exerciseStore.chatMessages.length === 0) {
      exerciseStore.chatMessages = [welcomeMessage]
    } else if (props.type === 'teacher' && exerciseStore.teacherMessages.length === 0) {
      exerciseStore.teacherMessages = [welcomeMessage]
    }
  }
}

/**
 * 初始化老师会话
 * 作用：创建或初始化老师对话会话，设置消息监听器和会话信息
 */
const initializeTeacherSession = async () => {
  try {
    // 步骤1：初始化老师消息监听器
    if (typeof window !== 'undefined' && window.AndroidBridge?.initTeacherMessageListener) {
      window.AndroidBridge.initTeacherMessageListener()
    }

    // 步骤2：如果有当前题目，基于AI会话创建老师会话
    if (exerciseStore.currentQuestion) {
      // 2.1 生成AI会话ID（基于题目ID和时间戳，确保唯一性）
      aiSessionId.value = `ai_session_${exerciseStore.currentQuestion.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 2.2 生成会话名称，清理LaTeX内容避免JSON解析问题
      const rawTitle =
        exerciseStore.currentQuestion.question || exerciseStore.currentQuestion.title || '题目'

      // 移除LaTeX数学公式，只保留纯文本
      const cleanTitle = rawTitle
        .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
        .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
        .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim()

      const aiSessionName = (cleanTitle || '数学题目').substring(0, 30) + '...'

      // 2.3 创建老师会话 - 优先使用AndroidBridge
      const session = await apiService.createTeacherChatSession(
        aiSessionId.value,
        aiSessionName,
        currentSubject.value,
      )


      if (session) {
        teacherSession.value = session
        // 2.4 加载老师会话的历史消息
        await loadTeacherChatHistory()
      } else {
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
      // 步骤3：如果没有题目，创建临时老师会话，用于转发消息显示
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
  } catch {
    // 步骤4：创建失败时，创建临时老师会话，用于转发消息显示
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
}

// 加载老师聊天历史
// 作用：从API加载老师对话的历史消息记录（现在主要用于同步远程消息到本地存储）
const loadTeacherChatHistory = async () => {
  if (!teacherSession.value) return

  try {
    const history = await apiService.getTeacherChatHistory(teacherSession.value.sessionId)
    if (history && history.length > 0) {
      // 获取当前已存在的消息ID集合，避免覆盖已正确设置的消息
      const existingMessageIds = new Set(exerciseStore.teacherMessages.map((msg) => msg.id))

      const historyMessages: ChatBubble[] = history.map((msg) => ({
        id: msg.messageId,
        content: msg.content,
        type: msg.isSelf ? 'user' : 'teacher',
        timestamp: '',
        sender: msg.isSelf ? 'user' : 'teacher',
      }))

      // 只添加不存在的消息，避免覆盖已正确设置的消息
      const newMessages = historyMessages.filter((msg) => !existingMessageIds.has(msg.id))
      if (newMessages.length > 0) {
        await addMessagesToStore(newMessages)
      }
    }
  } catch {
    // 加载老师聊天历史失败
  }
}

// 作用：发送用户消息，支持文本和文件附件，根据对话类型选择AI或老师
const sendMessage = async (attachedFile?: File) => {
  if ((!inputMessage.value.trim() && !attachedFile) || isLoading.value) return

  // 检查是否在编辑模式
  if (isEditingMessage.value && editingMessageId.value) {
    await updateEditedMessage(inputMessage.value)
    return
  }

  if (!hasSelectedQuestion.value) {
    const userMessage: ChatBubble = {
      id: Date.now().toString(),
      content: inputMessage.value || (attachedFile ? '[图片消息]' : ''),
      type: 'user',
      timestamp: '',
      sender: 'user',
    }

    const botReply: ChatBubble = {
      id: (Date.now() + 1).toString(),
      content: '请先选择一道题目，然后我们可以开始讨论。你可以从题目列表中选择一道感兴趣的题目。',
      type: props.type === 'ai' ? 'ai' : 'teacher',
      timestamp: '',
      sender: props.type === 'ai' ? 'ai' : 'teacher',
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
    if (props.type === 'ai') {
      // 检查是否包含"我们开始吧"前缀，如果包含则隐藏显示
      const hidePrefix = messageContent.includes('我们开始吧')
      // 使用exerciseStore的流式响应功能，传递选中的学习伙伴角色
      await exerciseStore.sendChatMessage(
        messageContent,
        'ai',
        selectedModel.value,
        undefined,
        hidePrefix,
      )

      // 计算属性会自动响应 store 变化，无需手动同步
    } else {
      // 发送消息给老师（不使用流式响应）
      await sendMessageToTeacher(messageContent)

      const userMessage: ChatBubble = {
        id: Date.now().toString(),
        content: messageContent,
        type: 'user',
        timestamp: '',
        sender: 'user',
      }

      await addMessageToStore(userMessage)
    }

    await scrollToBottom()

    emit('response')
  } catch {
    const errorMessage: ChatBubble = {
      id: (Date.now() + 1).toString(),
      content: '抱歉，消息发送失败，请稍后重试。',
      type: props.type === 'ai' ? 'ai' : 'teacher',
      timestamp: '',
      sender: props.type === 'ai' ? 'ai' : 'teacher',
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
  if (scrollAreaRef.value) {
    // 使用更精确的滚动到底部方法
    const scrollTarget = scrollAreaRef.value.getScrollTarget()
    if (scrollTarget) {
      scrollTarget.scrollTop = scrollTarget.scrollHeight
    }
  }

  // 同时触发父组件的滚动到底部事件
  emit('scroll-to-bottom')
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
  keyboardHeight.value = dynamicKeyboardHeight.value
  isAnimating.value = true

  // 步骤4：记录原始高度 - 增强保护机制
  if (originalChatViewHeight.value === 0) {
    // 首次记录原始高度
    originalChatViewHeight.value = chatViewRef.value?.offsetHeight || 0
  } else {
    // 验证已记录的高度是否仍然有效
    const currentHeight = chatViewRef.value?.offsetHeight || 0
    if (Math.abs(originalChatViewHeight.value - currentHeight) > 50) {
      originalChatViewHeight.value = currentHeight
    }
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

// 作用：开始语音输入，记录触摸位置并调用录音接口
const startVoiceInput = (event?: TouchEvent | MouseEvent) => {
  if (isLoading.value) return

  // 记录开始位置（用于上滑取消）
  if (event && 'touches' in event && event.touches.length > 0) {
    voiceStartY.value = event.touches[0].clientY
  } else if (event && 'clientY' in event) {
    voiceStartY.value = event.clientY
  }

  isRecording.value = true
  showCancelHint.value = false

  // 调用录音接口 - 使用AndroidBridge
  try {
    const result = androidBridge.startVoiceRecording()
    if (!result.success) {
      androidBridge.showToast(result.message || '开始录音失败')
      isRecording.value = false
      return
    }
  } catch {
    androidBridge.showToast('录音功能不可用')
    isRecording.value = false
  }
}

// 作用：停止语音输入，处理上滑取消逻辑并发送语音消息
const stopVoiceInput = async (event?: TouchEvent | MouseEvent) => {
  if (!isRecording.value) return

  // 检查是否需要取消发送（上滑取消）
  let shouldCancel = false
  if (event && 'touches' in event && event.changedTouches.length > 0) {
    voiceCurrentY.value = event.changedTouches[0].clientY
    shouldCancel = voiceStartY.value - voiceCurrentY.value > CANCEL_THRESHOLD
  } else if (event && 'clientY' in event) {
    voiceCurrentY.value = event.clientY
    shouldCancel = voiceStartY.value - voiceCurrentY.value > CANCEL_THRESHOLD
  }

  isRecording.value = false
  showCancelHint.value = false

  try {
    if (shouldCancel) {
      // 取消录音 - 使用AndroidBridge
      const result = androidBridge.cancelVoiceRecording()
      if (result.success) {
        androidBridge.showToast('已取消发送')
      }
    } else {
      // 停止录音并发送 - 使用AndroidBridge
      const result = androidBridge.stopVoiceRecording()
      if (result.success && result.voiceInfo) {
        await sendVoiceMessage(result.voiceInfo)
      } else {
        androidBridge.showToast(result.message || '录音失败')
      }
    }
  } catch {
    androidBridge.showToast('录音操作失败')
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

// 发送消息给老师
// 作用：向老师发送文本消息，创建会话并调用API
const sendMessageToTeacher = async (
  content: string,
): Promise<{ success: boolean; reply: string; messageId: string; timestamp: string }> => {

  if (!teacherSession.value) {
    await initializeTeacherSession()
  }

  if (!teacherSession.value) {
    throw new Error('无法创建老师会话')
  }

  try {
    const success = await apiService.sendTextMessageToTeacher(
      content,
      teacherSession.value.sessionId,
      currentSubject.value,
    )

    if (success) {
      return {
        success: true,
        reply: '消息已发送给老师，请等待回复...',
        messageId: 'teacher_msg_' + Date.now(),
        timestamp: '',
      }
    } else {
      throw new Error('发送消息失败')
    }
  } catch (error) {
    throw error
  }
}

// 作用：发送语音消息，创建语音消息对象并发送到后端
const sendVoiceMessage = async (voiceInfo: {
  filePath: string
  duration: number
  fileSize: number
}) => {
  if (!hasSelectedQuestion.value) {
    androidBridge.showToast('请先选择题目')
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
      androidBridge.showToast(sendResult.message || '发送失败')
    }
  } catch {
    androidBridge.showToast('发送失败')
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

// 作用：显示图片选择器对话框
const showImagePickerDialog = () => {
  showImagePicker.value = true
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
    // 创建sendImageMessage方法来处理图片消息
    if (!hasSelectedQuestion.value) {
      androidBridge.showToast('请先选择题目')
      return
    }

    // 创建图片消息
    const imageMessage: ChatBubble = {
      id: Date.now().toString(),
      content: '', // 图片消息不显示文字内容
      type: 'user',
      timestamp: '',
      sender: 'user',
      messageType: 'image',
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
      },
    }

    await addMessageToStore(imageMessage)
    await scrollToBottom()

    // 发送图片消息到后端
    isLoading.value = true
    try {
      if (props.type === 'teacher' && teacherSession.value) {
        // 发送图片消息给老师 - 使用API服务
        const success = await apiService.sendPictureToTeacher(
          imageInfo.filePath,
          teacherSession.value.sessionId,
          currentSubject.value,
        )

        if (success) {
          // 图片消息发送成功，等待真实回复
          await scrollToBottom()
          emit('response')
        } else {
          androidBridge.showToast('发送失败')
        }
      } else {
        // 发送图片消息给AI
        if (imageInfo.base64DataUrl) {
          // 检查是否包含"我们开始吧"前缀，如果包含则隐藏显示
          const messageText = inputMessage.value || ''
          const hidePrefix = messageText.includes('我们开始吧')
          // 使用exerciseStore的流式响应功能发送图片消息
          // 传递包含filePath和base64DataUrl的imageData对象
          await exerciseStore.sendChatMessage(
            messageText,
            'ai',
            selectedModel.value,
            {
              filePath: imageInfo.filePath,
              base64DataUrl: imageInfo.base64DataUrl,
            },
            hidePrefix,
          )

          // 清空输入框
          inputMessage.value = ''

          // 计算属性会自动响应 store 变化，无需手动同步
          await scrollToBottom()
          emit('response')
        } else {
          androidBridge.showToast('图片处理失败，缺少Base64数据')
        }
      }
    } catch {
      androidBridge.showToast('发送失败')
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

  return {
    id: msg.id,
    type: messageType,
    content: messageContent
      ? messageContent
          .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
          .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
          .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
          .replace(/\s+/g, ' ') // 合并多个空格
          .trim()
      : '',
    timestamp: '',
  }
}

/**
 * 处理单条消息转发（仅在AI页面触发）
 * 流程：1. 验证当前页面类型 2. 创建老师会话 3. 转发消息 4. 切换页面
 * 作用：处理AI对话中的单条消息转发到老师对话
 */
const handleForwardMessage = async (message: ChatBubble) => {
  // 确保只在AI页面触发
  if (props.type !== 'ai') {
    return
  }

  try {
    // 确保老师会话已创建
    if (!teacherSession.value) {
      await initializeTeacherSession()
    }

    if (teacherSession.value) {
      // 转发消息到老师
      const success = await forwardMessageToTeacher([message])

      if (success) {
        // 转发成功后切换页面
        emit('switchToTeacher', {
          messages: [message],
          currentQuestion: exerciseStore.currentQuestion,
        })
      } else {
        androidBridge.showToast('转发失败，请重试')
      }
    } else {
      androidBridge.showToast('无法创建老师会话')
    }
  } catch (error) {
    console.error('[CHAT_DEBUG] ❌ 转发消息失败:', error)
    androidBridge.showToast('转发失败')
  }
}

// 统一的转发函数
const forwardMessageToTeacher = async (messages: ChatBubble[]) => {
  const cleanedMessages = messages.map(convertMessageForForwarding)
  const selectedMessagesData = JSON.stringify(cleanedMessages)

  const success = await apiService.forwardAiChatToTeacher(
    selectedMessagesData,
    teacherSession.value!.sessionId,
  )

  if (success) {
    const convertedMessages = messages.map((msg) => ({
      ...msg,
      id: msg.id.startsWith('forwarded_') ? msg.id : 'forwarded_' + msg.id,
      sender: 'user' as const,
      type: 'user' as const,
    }))

    // 直接添加到老师消息存储并持久化
    exerciseStore.teacherMessages.push(...convertedMessages)
    await exerciseStore.saveTeacherChatHistory()
  }

  return success
}

// 处理进入多选模式
// 作用：进入消息多选模式，允许用户选择多条消息进行批量操作
const handleEnterMultiSelect = () => {
  enterSelectionMode()
}

// 处理编辑消息
// 作用：开始编辑指定消息，将消息内容复制到输入框并设置编辑状态
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
  editingQuestionId.value = exerciseStore.currentQuestion?.id || null

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
// 作用：将消息内容转换为TiptapEditor可识别的格式，处理数学公式
const convertMessageContentForEditor = (content: string): string => {
  if (!content) return ''

  // 使用消息渲染器渲染内容
  const { renderMessageContent } = useMessageRenderer()
  const renderedContent = renderMessageContent(content)

  // 将渲染后的HTML中的公式转换为TiptapEditor的FormulaNode格式
  return convertHtmlToTiptapFormat(renderedContent)
}

// 将HTML内容转换为TiptapEditor格式
// 作用：将HTML内容转换为TiptapEditor的FormulaNode格式，处理数学公式
const convertHtmlToTiptapFormat = (htmlContent: string): string => {
  if (!htmlContent) return ''

  let processedHtml = htmlContent

  // 1. 处理MathJax渲染的公式（行内公式）
  const inlineFormulaRegex =
    /<span[^>]*class="[^"]*mjx[^"]*"[^>]*data-mjx-texclass="mord"[^>]*>(.*?)<\/span>/gs
  processedHtml = processedHtml.replace(inlineFormulaRegex, (match, content) => {
    const latexContent = extractLatexFromMathJax(content)
    if (latexContent) {
      return `<span data-formula="${latexContent}" class="formula-node"></span>`
    }
    return match
  })

  // 2. 处理MathJax渲染的公式（块级公式）
  const displayFormulaRegex =
    /<span[^>]*class="[^"]*mjx[^"]*"[^>]*data-mjx-texclass="mord"[^>]*>(.*?)<\/span>/gs
  processedHtml = processedHtml.replace(displayFormulaRegex, (match, content) => {
    const latexContent = extractLatexFromMathJax(content)
    if (latexContent) {
      return `<span data-formula="${latexContent}" class="formula-node"></span>`
    }
    return match
  })

  // 3. 处理原始的LaTeX格式（$...$ 和 $$...$$）
  const latexInlineRegex = /\$([^$]+)\$/g
  processedHtml = processedHtml.replace(latexInlineRegex, (match, content) => {
    const cleanContent = content.trim()
    return `<span data-formula="${cleanContent}" class="formula-node"></span>`
  })

  const latexDisplayRegex = /\$\$([^$]+)\$\$/g
  processedHtml = processedHtml.replace(latexDisplayRegex, (match, content) => {
    const cleanContent = content.trim()
    return `<span data-formula="${cleanContent}" class="formula-node"></span>`
  })

  return processedHtml
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
    // 查找要更新的消息
    const messageIndex = exerciseStore.chatMessages.findIndex(
      (msg) => msg.id === editingMessageId.value,
    )
    if (messageIndex === -1) {
      cancelEditMessage()
      return
    }

    // 删除该消息之后的所有消息（因为编辑会改变对话上下文）
    const messagesToKeep = exerciseStore.chatMessages.slice(0, messageIndex)

    exerciseStore.chatMessages = messagesToKeep

    // 保存聊天记录
    await exerciseStore.saveChatHistory()

    // 清除编辑状态
    cancelEditMessage()

    // 发送编辑后的消息给AI（这会自动添加用户消息和AI回复）
    if (props.type === 'ai') {
      isLoading.value = true

      try {
        // 检查是否包含"我们开始吧"前缀，如果包含则隐藏显示
        const hidePrefix = newContent.includes('我们开始吧')
        // 使用exerciseStore的流式响应功能，传递选中的学习伙伴角色
        await exerciseStore.sendChatMessage(
          newContent,
          'ai',
          selectedModel.value,
          undefined,
          hidePrefix,
        )

      } catch (aiError) {
        console.error('❌ [更新消息] AI回复发送失败:', aiError)
        androidBridge.showToast('发送消息失败')
      } finally {
        isLoading.value = false
      }
    }


    // 滚动到底部
    await scrollToBottom()
  } catch (error) {
    console.error('❌ [更新消息] 更新消息失败:', error)
    androidBridge.showToast('更新消息失败')
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
 * 处理多选消息转发（仅在AI页面触发）
 * 流程：1. 验证页面类型 2. 获取选中消息 3. 显示转发模式选择对话框
 * 作用：处理AI对话中的多条消息转发操作，显示转发模式选择对话框
 */
const forwardToTeacher = async (messageList?: ChatBubble[]) => {
  // 确保只在AI页面触发
  if (props.type !== 'ai') {
    return
  }

  // 流程1：获取要转发的消息列表
  const selectedMessageList =
    messageList ||
    displayedMessages.value.filter((message) => selectedMessages.value.has(message.id))
  if (selectedMessageList.length === 0) return


  // 流程2：显示转发模式选择对话框
  if (isSelectionMode.value) {
    pendingForwardMessages.value = selectedMessageList
    showForwardModeDialog.value = true
    exitSelectionMode()
  } else {
    // 兜底逻辑：单条消息直接转发
    await handleForwardMessage(selectedMessageList[0])
  }
}

/**
 * 处理转发模式确认
 * 流程：1. 验证消息列表 2. 根据模式执行转发 3. 处理结果
 * 作用：处理转发模式确认，根据选择的模式执行相应的转发逻辑
 */
const handleForwardModeConfirm = async (mode: 'merge' | 'separate', additionalMessage: string) => {
  // 流程1：验证消息列表
  if (pendingForwardMessages.value.length === 0) return

  try {
    // 流程2：根据模式执行转发
    if (mode === 'merge') {
      await forwardAsChatRecord(pendingForwardMessages.value, additionalMessage)
    } else {
      await forwardAsSeparateMessages(pendingForwardMessages.value, additionalMessage)
    }
  } catch {
    // 流程3：处理错误
    androidBridge.showToast('转发失败')
  }
}

/**
 * 合并转发：创建聊天记录卡片（仅在AI页面触发）
 * 流程：1. 验证页面类型 2. 创建老师会话 3. 发送到后端 4. 切换页面
 * 作用：将多条消息合并为聊天记录卡片进行转发
 */
const forwardAsChatRecord = async (messages: ChatBubble[], additionalMessage: string) => {
  // 确保只在AI页面触发
  if (props.type !== 'ai') {
    return
  }

  try {
    // 确保老师会话已创建
    if (!teacherSession.value) {
      await initializeTeacherSession()
    }

    if (teacherSession.value) {
      // 发送到后端
      const selectedMessagesData = JSON.stringify(messages.map(convertMessageForForwarding))

      const success = await apiService.forwardAiChatToTeacher(
        selectedMessagesData,
        teacherSession.value.sessionId,
      )

      if (success) {
        // 转发成功后，将消息添加到老师消息存储并持久化
        const convertedMessages = messages.map((msg) => ({
          ...msg,
          id: msg.id.startsWith('forwarded_') ? msg.id : 'forwarded_' + msg.id,
          sender: 'user' as const,
          type: 'user' as const,
        }))

        // 直接添加到老师消息存储
        exerciseStore.teacherMessages.push(...convertedMessages)
        await exerciseStore.saveTeacherChatHistory()

        // 转发成功后切换页面
        const forwardData = {
          messages: messages,
          currentQuestion: exerciseStore.currentQuestion,
          additionalMessage: additionalMessage,
          forwardMode: 'merge',
        }
        emit('switchToTeacher', forwardData)
      } else {
        androidBridge.showToast('转发失败，请重试')
      }
    } else {
      console.error('[CHAT_DEBUG] ❌ 无法创建老师会话')
      androidBridge.showToast('无法创建老师会话')
    }
  } catch (error) {
    console.error('[CHAT_DEBUG] ❌ 合并转发失败:', error)
    androidBridge.showToast('转发失败')
  }
}

/**
 * 逐条转发：一条一条发送（仅在AI页面触发）
 * 流程：1. 验证页面类型 2. 创建老师会话 3. 发送到后端 4. 切换页面
 * 作用：将多条消息逐条发送给老师
 */
const forwardAsSeparateMessages = async (messages: ChatBubble[], additionalMessage: string) => {
  // 确保只在AI页面触发
  if (props.type !== 'ai') {
    return
  }

  try {
    // 确保老师会话已创建
    if (!teacherSession.value) {
      await initializeTeacherSession()
    }

    if (teacherSession.value) {
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
        exerciseStore.teacherMessages.push(...convertedMessages)
        await exerciseStore.saveTeacherChatHistory()

        // 转发成功后切换页面
        const forwardData = {
          messages: messages,
          currentQuestion: exerciseStore.currentQuestion,
          additionalMessage: additionalMessage,
          forwardMode: 'separate',
          successCount: successCount,
        }
        emit('switchToTeacher', forwardData)
      } else {
        androidBridge.showToast('转发失败，请重试')
      }
    } else {
      androidBridge.showToast('无法创建老师会话')
    }
  } catch (error) {
    console.error('[CHAT_DEBUG] ❌ 逐条转发失败:', error)
    androidBridge.showToast('转发失败')
  }
}

// 作用：切换联网搜索功能的开启/关闭状态
const toggleWebSearch = () => {
  exerciseStore.toggleWebSearch()
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

// 老师消息接收处理
// 作用：处理从老师接收到的消息，添加到聊天记录中
const handleTeacherMessageReceived = async (messageData: {
  sessionId: string
  messageId: string
  content: string
}) => {
  try {
    // 检查消息是否属于当前会话
    if (teacherSession.value && messageData.sessionId === teacherSession.value.sessionId) {
      const teacherMessage: ChatBubble = {
        id: messageData.messageId || 'teacher_msg_' + Date.now(),
        content: messageData.content,
        type: 'teacher',
        timestamp: '',
        sender: 'teacher',
      }

      await addMessageToStore(teacherMessage)
      scrollToBottom()
    }
  } catch {
    // 处理老师消息失败
  }
}

// ==================== 生命周期钩子 ====================
/**
 * 组件挂载时的初始化
 * 作用：初始化聊天消息、设置事件监听器、配置语音识别等
 */
onMounted(() => {
  // 步骤1：初始化聊天消息
  initializeMessages()
  scrollToBottom()

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

    // 3.2 设置老师消息接收回调（仅在老师模式下）
    if (props.type === 'teacher') {
      ;(
        window as unknown as {
          onTeacherMessageReceived: (messageData: {
            sessionId: string
            messageId: string
            content: string
          }) => void
        }
      ).onTeacherMessageReceived = handleTeacherMessageReceived
    }

    // 3.3 监听原生键盘事件（处理系统键盘，只压缩页面不滚动）
    // 动态控制原生键盘事件监听，避免与公式键盘冲突
    let nativeKeyboardListenersEnabled = true
    
    const handleNativeKeyboardShow = (event: Event) => {
      if (!nativeKeyboardListenersEnabled) {
        console.log('🎯 [CHAT_VIEW] 原生键盘显示事件被忽略（公式编辑中）')
        return
      }
      console.log('🎯 [CHAT_VIEW] 原生键盘显示事件')
      const customEvent = event as CustomEvent
      // 原生键盘显示时只压缩页面，不滚动（压缩后输入框自动可见）
      handleKeyboardShown(customEvent.detail)
    }
    
    const handleNativeKeyboardHide = () => {
      if (!nativeKeyboardListenersEnabled) {
        console.log('🎯 [CHAT_VIEW] 原生键盘隐藏事件被忽略（公式编辑中）')
        return
      }
      console.log('🎯 [CHAT_VIEW] 原生键盘隐藏事件')
      // 原生键盘隐藏时恢复页面
      handleKeyboardHidden()
    }
    
    window.addEventListener('keyboard-show', handleNativeKeyboardShow)
    window.addEventListener('keyboard-hide', handleNativeKeyboardHide)
    
    // 暴露控制函数给全局使用
    ;(window as unknown as Record<string, unknown>).disableNativeKeyboardListeners = () => {
      console.log('🎯 [CHAT_VIEW] 禁用原生键盘事件监听器')
      nativeKeyboardListenersEnabled = false
    }
    
    ;(window as unknown as Record<string, unknown>).enableNativeKeyboardListeners = () => {
      console.log('🎯 [CHAT_VIEW] 启用原生键盘事件监听器')
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
  // 步骤1：清理键盘事件监听器
  if (typeof window !== 'undefined') {
    // 注意：内联函数无法直接移除，但组件卸载时会自动清理
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
  if (props.type === 'teacher') {
    try {
      if (typeof window !== 'undefined' && window.AndroidBridge?.cleanupTeacherMessageListener) {
        window.AndroidBridge.cleanupTeacherMessageListener()
      }
    } catch {
      // 清理老师消息监听器失败
    }

    // 清理回调函数
    if (typeof window !== 'undefined') {
      ;(window as unknown as { onTeacherMessageReceived: null }).onTeacherMessageReceived = null
    }
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
  () => exerciseStore.chatMessages.length,
  (newLength, oldLength) => {
    // 如果消息数量从有变为0，说明可能是清除了记录，需要重新初始化
    if (oldLength > 0 && newLength === 0 && props.type === 'ai') {
      initializeMessages()
      nextTick(() => {
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

watch(
  () => exerciseStore.chatMessages,
  (newMessages) => {
    if (newMessages && newMessages.length > 0) {
      // 如果是键盘显示状态，立即滚动；否则防抖滚动
      if (isKeyboardVisible.value || isKeyboardAnimating.value) {
        // 键盘显示时立即滚动，确保用户体验
        scrollToBottom()
      } else {
        // 防抖滚动，避免频繁触发
        if (scrollTimeout) {
          clearTimeout(scrollTimeout)
        }
        // 将延迟时间缩短，让滚动更及时
        scrollTimeout = setTimeout(() => {
          scrollToBottom()
        }, 50)
      }

      // 【重要】移除MathJax全局渲染调用
      // 数学公式渲染由各个ChatMessage组件独立处理，避免阻塞主线程
    }
  },
  { deep: true, immediate: false },
)

watch(
  () => exerciseStore.currentQuestion,
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
  () => exerciseStore.subject,
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
  // 聊天记录的清空和加载应该由 exerciseStore.selectQuestion 统一管理
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

/* 聊天消息滚动区域 */
.chat-messages {
  height: 100%;
  width: 100%;
}

/* 消息包装器 - 设置内边距和最大宽度 */
.messages-wrapper {
  padding: 16px 0;
  max-width: 100%;
  width: 100%;
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

/* ==================== 其他样式 ==================== */
/* 移除hover效果 - 已禁用背景色变化 */
</style>
