<template>
  <div
    class="message-item"
    :class="{
      'message-user': message.sender === 'user',
      'message-ai': message.sender === 'ai' || message.sender === 'teacher',
      'message-selected': isSelected,
      'message-selectable': isSelectionMode,
    }"
    :data-message-id="message.id"
    :data-message-sender="message.sender"
    :data-message-type="message.type"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
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
        <q-avatar color="grey-4" text-color="grey-8" size="36px">
          <q-icon :name="avatarIcon" />
        </q-avatar>
      </div>
      <div class="ai-content">
        <div class="ai-bubble" :ref="(el) => setBubbleRef(el, 'ai')">
          <!-- 语音消息 -->
          <VoiceMessage
            v-if="message.messageType === 'voice' && message.voiceData"
            :file-path="message.voiceData.filePath"
            :duration="message.voiceData.duration / 1000"
            :is-user="false"
          />
          <!-- 图片消息 -->
          <ImageMessage
            v-else-if="message.messageType === 'image' && message.imageData"
            :file-path="message.imageData.filePath"
            :width="message.imageData.width"
            :height="message.imageData.height"
            :file-size="message.imageData.fileSize"
            :is-user="false"
            :show-info="true"
          />
          <!-- 聊天记录卡片 -->
          <ChatRecordCard
            v-else-if="message.messageType === 'chat_record' && message.chatRecordData"
            :messages="message.chatRecordData.messages"
            :additional-message="message.chatRecordData.additionalMessage"
          />
          <!-- 文本消息 -->
          <div v-else class="message-text" :ref="(el) => setMessageRef(el)">
            <StreamingMessage
              v-if="message.isStreaming"
              :content="message.content"
              :is-streaming="true"
              :typewriter-speed="30"
              :ref="(el) => setStreamingRef(el)"
            />
            <div v-else-if="message.isError" class="error-message" :ref="(el) => setStaticRef(el)">
              <div class="error-icon">⚠️</div>
              <div class="error-content">
                <div v-html="renderedContent"></div>
                <div v-if="message.canRetry" class="retry-section">
                  <q-btn 
                    flat 
                    dense 
                    size="sm" 
                    color="primary" 
                    icon="refresh" 
                    @click="handleRetry"
                    :loading="isRetrying"
                    class="retry-btn"
                  >
                    重发
                  </q-btn>
                  <span v-if="message.retryCount && message.retryCount > 0" class="retry-count">
                    ({{ message.retryCount }}/3)
                  </span>
                </div>
              </div>
            </div>
            <div v-else v-html="renderedContent" :ref="(el) => setStaticRef(el)"></div>
          </div>
          
          <!-- 长按气泡确认框 -->
          <q-popup-proxy
            v-model="showActionMenu"
            :anchor="anchor"
            :self="self"
            class="message-action-menu"
            :breakpoint="0"
            no-parent-event
            @before-show="onMenuShow"
            @before-hide="onMenuHide"
          >
            <q-card class="action-card">
              <q-list dense>
                <q-item clickable @click="handleForward" v-if="canForward">
                  <q-item-section avatar>
                    <q-icon name="forward" color="primary" size="20px" />
                  </q-item-section>
                  <q-item-section>转发</q-item-section>
                </q-item>
                <q-item clickable @click="handleMultiSelect">
                  <q-item-section avatar>
                    <q-icon name="checklist" color="primary" size="20px" />
                  </q-item-section>
                  <q-item-section>多选</q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </q-popup-proxy>
        </div>
      </div>
    </div>

    <!-- 用户消息 -->
    <div v-else class="user-message">
      <div class="user-content">
        <div class="user-bubble" :ref="(el) => setBubbleRef(el, 'user')">
          <!-- 语音消息 -->
          <VoiceMessage
            v-if="message.messageType === 'voice' && message.voiceData"
            :file-path="message.voiceData.filePath"
            :duration="message.voiceData.duration / 1000"
            :is-user="true"
          />
          <!-- 图片消息 -->
          <ImageMessage
            v-else-if="message.messageType === 'image' && message.imageData"
            :file-path="message.imageData.filePath"
            :width="message.imageData.width"
            :height="message.imageData.height"
            :file-size="message.imageData.fileSize"
            :is-user="true"
            :show-info="true"
          />
          <!-- 聊天记录卡片 -->
          <ChatRecordCard
            v-else-if="message.messageType === 'chat_record' && message.chatRecordData"
            :messages="message.chatRecordData.messages"
            :additional-message="message.chatRecordData.additionalMessage"
          />
          <!-- 文本消息 -->
          <div v-else class="message-text" v-html="renderedContent" :ref="(el) => setMessageRef(el, messageElementRef as unknown as Ref<HTMLElement | null>)"></div>
          
          <!-- 长按气泡确认框 -->
          <q-popup-proxy
            v-model="showActionMenu"
            :anchor="anchor"
            :self="self"
            class="message-action-menu"
            :breakpoint="0"
            no-parent-event
            @before-show="onMenuShow"
            @before-hide="onMenuHide"
          >
            <q-card class="action-card">
              <q-list dense>
                <q-item clickable @click="handleEdit" v-if="canEdit">
                  <q-item-section avatar>
                    <q-icon name="edit" color="primary" size="20px" />
                  </q-item-section>
                  <q-item-section>编辑</q-item-section>
                </q-item>
                <q-item clickable @click="handleForward" v-if="canForward">
                  <q-item-section avatar>
                    <q-icon name="forward" color="primary" size="20px" />
                  </q-item-section>
                  <q-item-section>转发</q-item-section>
                </q-item>
                <q-item clickable @click="handleMultiSelect">
                  <q-item-section avatar>
                    <q-icon name="checklist" color="primary" size="20px" />
                  </q-item-section>
                  <q-item-section>多选</q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </q-popup-proxy>
        </div>
      </div>
      <div class="user-avatar">
        <q-avatar color="primary" text-color="white" size="36px">
          <q-icon name="person" />
        </q-avatar>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onUnmounted, type ComponentPublicInstance, type Ref } from 'vue'
import { MathJaxUtils } from '../../utils/mathjax'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import { useLazyMessageRender } from '../../utils/lazy-message-renderer'
import { useExerciseStore } from '../../stores/exerciseStore'
import VoiceMessage from './VoiceMessage.vue'
import ImageMessage from './ImageMessage.vue'
import StreamingMessage from './StreamingMessage.vue'
import ChatRecordCard from './ChatRecordCard.vue'
import type  { ChatBubble } from '../../types'

interface Props {
  message: ChatBubble
  type: 'ai' | 'teacher'
  isSelected?: boolean
  isSelectionMode?: boolean
  messageIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  isSelectionMode: false,
  messageIndex: 0,
})

const emit = defineEmits<{
  'toggle-selection': [messageId: string]
  'message-click': [message: ChatBubble]
  'forward-message': [message: ChatBubble]
  'enter-multi-select': []
  'edit-message': [message: ChatBubble]
}>()

// 长按相关状态
const showActionMenu = ref(false)
const longPressTimer = ref<number | null>(null)
const isLongPressing = ref(false)
const touchStartTime = ref(0)
const mouseDownTime = ref(0)

// 气泡定位 - 动态计算
const anchor = ref('top middle')
const self = ref('bottom middle')
const bubbleTarget = ref<HTMLElement | null>(null)
const currentBubbleType = ref<'ai' | 'user' | null>(null)

// 点击外部区域关闭气泡框
let clickOutsideHandler: ((event: Event) => void) | null = null

const { renderMessageContent } = useMessageRenderer()
const exerciseStore = useExerciseStore()

// 重发相关状态
const isRetrying = ref(false)

// 懒加载渲染
const { elementRef: messageElementRef } = useLazyMessageRender({
  rootMargin: '100px',
  threshold: 0.1
})

// 移除调试日志以提高性能

// 重发方法
const handleRetry = async () => {
  if (!props.message.canRetry || isRetrying.value) {
    return
  }

  try {
    isRetrying.value = true
    await exerciseStore.retryAiMessage(props.message.id, 'mate', props.message.imageData)
  } catch (error) {
    console.error('重发失败:', error)
    // 错误处理已经在store中完成，这里不需要额外处理
  } finally {
    isRetrying.value = false
  }
}

const avatarIcon = computed(() => {
  return props.type === 'ai' ? 'smart_toy' : 'school'
})

// 判断是否可以转发（仅在AI对话场景下可用）
const canForward = computed(() => {
  return props.type === 'ai'
})

// 判断是否为第一个消息（题目消息）
const isFirstMessage = computed(() => {
  return props.messageIndex === 0
})

// 判断是否可以编辑（第一个消息不能编辑）
const canEdit = computed(() => {
  return props.message.sender === 'user' && !isFirstMessage.value
})

const renderedContent = computed(() => {
  const rendered = renderMessageContent(props.message.content)
  return rendered
})

const handleClick = () => {
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
  if (target && (
    target.classList.contains('mjx-chtml') ||
    target.classList.contains('mjx-math') ||
    target.hasAttribute('data-mjx-texclass') ||
    target.closest('.mjx-chtml') ||
    target.closest('.mjx-math') ||
    target.closest('[data-mjx-texclass]')
  )) {
    // 如果是公式元素，阻止事件传播
    event.stopPropagation()
    return
  }
  
  touchStartTime.value = Date.now()
  isLongPressing.value = false
  
  // 设置长按定时器
  longPressTimer.value = window.setTimeout(() => {
    if (!props.isSelectionMode && canForward.value) {
      isLongPressing.value = true
      // 计算气泡框位置
      calculateBubblePosition()
      showActionMenu.value = true
    }
  }, 400) // 500ms长按触发
}

// 触摸结束
const handleTouchEnd = (event: TouchEvent) => {
  // 检查是否点击在公式元素上
  const target = event.target as HTMLElement
  if (target && (
    target.classList.contains('mjx-chtml') ||
    target.classList.contains('mjx-math') ||
    target.hasAttribute('data-mjx-texclass') ||
    target.closest('.mjx-chtml') ||
    target.closest('.mjx-math') ||
    target.closest('[data-mjx-texclass]')
  )) {
    // 如果是公式元素，阻止事件传播
    event.stopPropagation()
    return
  }
  
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  // 如果不是长按，则正常处理点击
  if (!isLongPressing.value && Date.now() - touchStartTime.value < 500) {
    handleClick()
  }
  
  isLongPressing.value = false
}

// 鼠标按下
const handleMouseDown = (event: MouseEvent) => {
  if (props.isSelectionMode) return
  
  // 检查是否点击在公式元素上
  const target = event.target as HTMLElement
  if (target && (
    target.classList.contains('mjx-chtml') ||
    target.classList.contains('mjx-math') ||
    target.hasAttribute('data-mjx-texclass') ||
    target.closest('.mjx-chtml') ||
    target.closest('.mjx-math') ||
    target.closest('[data-mjx-texclass]')
  )) {
    // 如果是公式元素，阻止事件传播
    event.stopPropagation()
    return
  }
  
  mouseDownTime.value = Date.now()
  isLongPressing.value = false
  
  // 设置长按定时器
  longPressTimer.value = window.setTimeout(() => {
    if (!props.isSelectionMode && canForward.value) {
      isLongPressing.value = true
      // 计算气泡框位置
      calculateBubblePosition()
      showActionMenu.value = true
    }
  }, 500) // 500ms长按触发
}

// 鼠标抬起
const handleMouseUp = (event: MouseEvent) => {
  // 检查是否点击在公式元素上
  const target = event.target as HTMLElement
  if (target && (
    target.classList.contains('mjx-chtml') ||
    target.classList.contains('mjx-math') ||
    target.hasAttribute('data-mjx-texclass') ||
    target.closest('.mjx-chtml') ||
    target.closest('.mjx-math') ||
    target.closest('[data-mjx-texclass]')
  )) {
    // 如果是公式元素，阻止事件传播
    event.stopPropagation()
    return
  }
  
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  // 如果不是长按，则正常处理点击
  if (!isLongPressing.value && Date.now() - mouseDownTime.value < 500) {
    handleClick()
  }
  
  isLongPressing.value = false
}

// 鼠标离开
const handleMouseLeave = () => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  isLongPressing.value = false
}

// 处理转发
const handleForward = () => {
  showActionMenu.value = false
  emit('forward-message', props.message)
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
}

// 气泡框显示时的处理
const onMenuShow = () => {
  // 添加点击外部区域关闭气泡框的监听器
  nextTick(() => {
    clickOutsideHandler = (event: Event) => {
      const target = event.target as HTMLElement
      
      // 检查点击的元素是否在气泡框内
      const isInsideMenu = target.closest('.message-action-menu') || 
                          target.closest('.action-card') ||
                          target.closest('.q-popup-proxy')
      
      // 如果点击的不是气泡框内部，则关闭气泡框
      if (!isInsideMenu) {
        showActionMenu.value = false
      }
    }
    
    // 添加事件监听器，使用capture模式确保优先处理
    document.addEventListener('click', clickOutsideHandler, true)
    document.addEventListener('touchstart', clickOutsideHandler, true)
  })
}

// 气泡框隐藏时的处理
const onMenuHide = () => {
  // 移除点击外部区域关闭气泡框的监听器
  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler, true)
    document.removeEventListener('touchstart', clickOutsideHandler, true)
    clickOutsideHandler = null
  }
}

// 设置气泡引用
const setBubbleRef = (el: Element | ComponentPublicInstance | null, type: 'ai' | 'user') => {
  if (el && el instanceof HTMLElement) {
    bubbleTarget.value = el
    currentBubbleType.value = type
  }
}

// 动态计算气泡框位置
const calculateBubblePosition = () => {
  if (!bubbleTarget.value) return
  
  const bubbleRect = bubbleTarget.value.getBoundingClientRect()
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

const setMessageRef = (el: Element | ComponentPublicInstance | null, lazyRef?: Ref<HTMLElement | null>) => {
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
      MathJaxUtils.renderMath(el, true)
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


// 组件卸载时清理事件监听器
onUnmounted(() => {
  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler, true)
    document.removeEventListener('touchstart', clickOutsideHandler, true)
    clickOutsideHandler = null
  }
})
</script>

<style scoped>
/* 现代化聊天消息布局 - 参照主流大模型体验 */
.message-item {
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  /* 移除transition效果 */
  user-select: none; /* 禁用文本选择 */
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE/Edge */
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

.ai-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 60px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.ai-bubble {
  max-width: 80%; /* 与用户消息保持一致的最大宽度 */
  word-wrap: break-word;
}

.ai-bubble {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.ai-bubble::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 12px;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 8px solid #f8f9fa;
}

/* 用户消息样式 */
.user-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0 20px;
  justify-content: flex-end;
  max-width: 100%;
}

.user-avatar {
  flex-shrink: 0;
  margin-top: 4px;
}

.user-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 60px);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.user-bubble {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.25);
  max-width: 80%;
  word-wrap: break-word;
}

.user-bubble::after {
  content: '';
  position: absolute;
  right: -8px;
  top: 12px;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 8px solid #2196f3;
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

.user-bubble .message-text {
  color: white;
}

.ai-bubble .message-text {
  color: #2c3e50;
}



/* 错误消息样式 */
.error-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 12px;
  color: #c62828;
}

.error-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.error-content {
  flex: 1;
  line-height: 1.4;
}

.retry-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ffcdd2;
}

.retry-btn {
  font-size: 12px;
  padding: 4px 8px;
  min-height: 24px;
}

.retry-count {
  font-size: 11px;
  color: #666;
  font-style: italic;
}

/* 消息选择相关样式 */
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

/* 移除hover效果 - 已禁用背景色变化 */

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .ai-bubble {
    background: #3a3a3a;
    border-color: #4a4a4a;
    color: #e0e0e0;
  }

  .ai-bubble::before {
    border-right-color: #3a3a3a;
  }

  .ai-bubble .message-text {
    color: #e0e0e0;
  }

  .message-selected {
    background-color: rgba(25, 118, 210, 0.15);
  }

  /* 移除深色模式下的hover效果 - 已禁用背景色变化 */
}

/* 长按气泡确认框样式 */
.message-action-menu {
  z-index: 1000;
}

.action-card {
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.action-card .q-item {
  padding: 8px 16px;
  min-height: 40px;
}

.action-card .q-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
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
</style>
