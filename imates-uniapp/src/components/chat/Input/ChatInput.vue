<template>
  <view class="modern-chat-container">
    <!-- 主容器上方扩展区域：顶部工具条 + 额外插槽内容 -->
    <view v-if="showToolbar !== false" class="chat-input-header-flex">
      <!-- 顶层：允许整块头部完全自定义插槽 -->
      <view class="chat-input-header-left">
        <view class="chat-top-toolbar">
          <!-- 截图/选中并问按钮 (prefix 位置) -->
          <template v-if="hasPrefixTool">
            <button
              v-for="(tool, index) in prefixTools"
              :key="index"
              type="button"
              class="toolbar-btn"
              @click="handleToolClick(tool)"
            >
              <svg class="toolbar-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
            </button>
          </template>

          <!-- 图片上传按钮 -->
          <button
            v-if="
              props.type === 'ai-general' ||
              props.type === 'ai-exercise' ||
              props.type === 'ai-homework' ||
              props.type === 'ai-textbook' ||
              props.type === 'user-client' ||
              props.type === 'teacher'
            "
            type="button"
            class="toolbar-btn"
            title="添加图片"
            @click="handleShowImagePicker"
          >
            <svg class="toolbar-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          <!-- 配置化工具 (middle 位置：公式、问老师) -->
          <template v-if="middleTools.length">
            <button
              v-for="(tool, index) in middleTools"
              :key="index"
              type="button"
              class="toolbar-btn"
              @click="handleToolClick(tool)"
            >
              <svg v-if="tool.type === 'formula'" class="toolbar-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16l-8 8 8 8H4" />
              </svg>
              <svg v-else class="toolbar-svg-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14v7" />
                <path d="M5.5 11.5V17c0 1.5 3 3 6.5 3s6.5-1.5 6.5-3v-5.5" />
              </svg>
            </button>
          </template>
        </view>
      </view>

      <!-- 右侧：额外 header 区域 -->
      <view class="chat-input-header-right">
        <template v-if="hasRightTool">
          <button
            v-for="(tool, index) in rightTools"
            :key="index"
            type="button"
            class="toolbar-btn new-session-btn"
            @click="handleToolClick(tool)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <text class="btn-label">新对话</text>
          </button>
        </template>
      </view>
    </view>

    <!-- 主容器 -->
    <view class="chat-input-wrapper" ref="inputAreaRef">
      <!-- 引用消息区域 -->
      <view v-if="props.quotedMessage" class="quote-bar">
        <view class="quote-content">
          <text class="quote-label">引用：</text>
          <text class="quote-message">{{ truncateQuoteContent(props.quotedMessage.content) }}</text>
        </view>
        <!-- 关闭引用按钮 -->
        <button type="button" class="quote-close" @click.stop="emit('remove-quote')">
          <text class="close-icon">✕</text>
        </button>
      </view>

      <!-- 截图缩略图 (支持多张) -->
      <view v-if="screenshotsToShow.length > 0" class="screenshot-thumb-bar">
        <view
          v-for="shot in screenshotsToShow"
          :key="shot.id"
          class="screenshot-thumb-inner"
          @click="handleScreenshotThumbClick(shot)"
        >
          <image :src="shot.dataUrl || shot.filePath" mode="aspectFill" class="thumb-img" />
          <text class="thumb-del" @click.stop="emit('remove-screenshot', shot.id)">✕</text>
        </view>
      </view>

      <!-- 统一文本输入区域 -->
      <view class="unified-input-area">
        <textarea
          :value="modelValue"
          :placeholder="props.placeholderText || '请输入要问的问题...'"
          :disabled="props.isLoading"
          class="main-textarea"
          :maxlength="1000"
          auto-height
          @focus="handleEditorFocus"
          @blur="handleEditorBlur"
          @input="handleEditorUpdate"
          @confirm="handleSendMessage"
        />
      </view>

      <!-- 控制栏 -->
      <view class="control-bar">
        <!-- 左侧控制组 -->
        <view class="left-controls">
          <!-- 编辑状态指示器 -->
          <view v-if="props.isEditing" class="edit-indicator">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <text class="edit-text">编辑消息</text>
            <button class="cancel-edit-btn" type="button" @click.stop="handleCancelEdit">
              <text class="cancel-icon">✕</text>
            </button>
          </view>

          <!-- 选项按钮：仅在非编辑状态下显示 -->
          <template v-if="!props.isEditing">
            <!-- 模式选择器 (同桌 / 导师 / 专家) -->
            <ModelSelector
              v-if="
                props.type === 'ai-general' ||
                props.type === 'ai-exercise' ||
                props.type === 'ai-homework' ||
                props.type === 'ai-textbook' ||
                props.type === 'html-preview'
              "
              :selected-model="props.selectedModel"
              @update:selected-model="selectModel"
            />

            <!-- 联网搜索按钮 -->
            <WebSearchToggle
              v-if="
                props.type === 'ai-general' ||
                props.type === 'ai-exercise' ||
                props.type === 'ai-homework' ||
                props.type === 'ai-textbook' ||
                props.type === 'html-preview'
              "
              :enable-web-search="props.enableWebSearch"
              @toggle-web-search="handleToggleWebSearch"
            />

            <!-- 问老师按钮 -->
            <button
              v-if="!props.hideAskTeacherIcon && normalizedTools.some(t => t.type === 'ask-teacher')"
              type="button"
              class="toolbar-btn ask-teacher-btn"
              :class="{ active: isAskTeacherSelected }"
              @click="handleAskTeacherClick"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <text class="ask-teacher-label">问老师</text>
            </button>
          </template>
        </view>

        <!-- 右侧控制组 -->
        <view class="right-controls">
          <!-- 发送按钮 (外层透明点击热区) -->
          <view class="send-button-hit-area" @click="handleSendButtonHitAreaClick">
            <button
              type="button"
              :disabled="!canSendActual || props.isLoading"
              class="send-button"
              :class="{
                'send-button--enabled': canSendActual && !props.isLoading,
                'send-button--disabled': !canSendActual || props.isLoading
              }"
            >
              <svg v-if="props.isLoading" class="loading-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ffffff" stroke-width="2.5">
                <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10" />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </view>
        </view>
      </view>
    </view>

    <!-- 公式编辑弹窗 (Modal 1:1) -->
    <view v-if="showFormulaModal" class="formula-modal-mask" @click="handleCancelFormulaDialog">
      <view class="formula-modal-card" @click.stop>
        <view class="modal-header">
          <text class="modal-title">公式键盘编辑</text>
          <text class="modal-close" @click="handleCancelFormulaDialog">✕</text>
        </view>
        <view class="modal-body">
          <view class="formula-keys-grid">
            <button
              v-for="sym in formulaSymbols"
              :key="sym"
              class="formula-key"
              @click="insertFormulaSymbol(sym)"
            >
              {{ sym }}
            </button>
          </view>
        </view>
        <view class="modal-footer">
          <button class="modal-btn cancel" @click="handleCancelFormulaDialog">取消</button>
          <button class="modal-btn confirm" @click="handleInsertFormulaFromDialog">插入</button>
        </view>
      </view>
    </view>

    <!-- 图片预览对话框 -->
    <view v-if="imageViewerVisible" class="image-viewer-mask" @click="imageViewerVisible = false">
      <image :src="imageViewerUrl" mode="aspectFit" class="viewer-full-img" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ChatBubble } from '@/types/chat'
import ModelSelector from './ModelSelector.vue'
import WebSearchToggle from './WebSearchToggle.vue'

export type BuiltinToolType =
  | 'screenshot'
  | 'select-and-ask'
  | 'new-session'
  | 'formula'
  | 'ask-teacher'
  | 'web-search'

export interface ToolbarTool {
  type: BuiltinToolType
  isActive?: boolean
  label?: string
}

export interface AttachedScreenshot {
  id: string
  dataUrl?: string
  filePath?: string
  width?: number
  height?: number
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholderText?: string
    isLoading?: boolean
    isRecording?: boolean
    enableWebSearch?: boolean
    selectedModel?: string
    type?: 'ai-general' | 'ai-exercise' | 'ai-homework' | 'ai-textbook' | 'teacher' | 'user-client' | 'html-preview'
    hideAskTeacherIcon?: boolean
    uploadedFiles?: any[]
    activeMode?: any
    canSend?: boolean
    isEditing?: boolean
    editingMessageId?: string | null
    attachedScreenshot?: { dataUrl: string; width: number; height: number }
    attachedScreenshots?: AttachedScreenshot[]
    quotedMessage?: ChatBubble | null
    showToolbar?: boolean
    toolbarTools?: (BuiltinToolType | ToolbarTool)[]
  }>(),
  {
    placeholderText: '请输入要问的问题...',
    isLoading: false,
    enableWebSearch: false,
    selectedModel: 'mate',
    type: 'ai-general',
    uploadedFiles: () => [],
    hideAskTeacherIcon: false,
    canSend: true,
    isEditing: false,
    editingMessageId: null,
    attachedScreenshots: () => [],
    quotedMessage: null,
    showToolbar: true,
    toolbarTools: () => ['screenshot', 'formula', 'new-session']
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send-message'): void
  (e: 'add-new-line'): void
  (e: 'input-focus'): void
  (e: 'input-blur'): void
  (e: 'show-image-picker'): void
  (e: 'toggle-web-search'): void
  (e: 'scroll-to-bottom'): void
  (e: 'update:selected-model', value: string): void
  (e: 'remove-file', id: string): void
  (e: 'upload-file'): void
  (e: 'cancel-edit'): void
  (e: 'focus'): void
  (e: 'blur'): void
  (e: 'remove-screenshot', id: string): void
  (e: 'send-with-screenshot', shots: AttachedScreenshot[]): void
  (e: 'edit-screenshot', id: string): void
  (e: 'remove-quote'): void
  (e: 'screenshot-click'): void
  (e: 'formula-click'): void
  (e: 'ask-teacher-click', payload?: { mode?: string }): void
  (e: 'new-session-click'): void
}>()

// 1:1 对齐 imates-web 的截图兼容逻辑
const screenshotsToShow = computed<AttachedScreenshot[]>(() => {
  if (Array.isArray(props.attachedScreenshots) && props.attachedScreenshots.length > 0) {
    return props.attachedScreenshots
  }
  if (props.attachedScreenshot) {
    return [
      {
        id: 'legacy-single',
        dataUrl: props.attachedScreenshot.dataUrl,
        width: props.attachedScreenshot.width,
        height: props.attachedScreenshot.height
      }
    ]
  }
  return []
})

// 1:1 对齐 imates-web 的截断引用逻辑
const truncateQuoteContent = (content: string): string => {
  if (!content) return ''
  const plainText = content
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plainText.length <= 50) return plainText
  return plainText.substring(0, 50) + '...'
}

const isEditorFocused = ref(false)
const showFormulaModal = ref(false)
const formulaDialogValue = ref('')
const isOnlineSearchSelected = ref(false)
const isFormulaSelected = ref(false)
const isAskTeacherSelected = ref(false)
const imageViewerVisible = ref(false)
const imageViewerUrl = ref('')

const formulaSymbols = ['x²', '√x', 'π', '∫', 'sin', 'cos', 'tan', '±', '≠', '≤', '≥', '∞', 'α', 'β', 'θ']

const TOOL_POSITION_MAP: Record<BuiltinToolType, 'prefix' | 'right' | 'middle' | 'none'> = {
  'screenshot': 'prefix',
  'select-and-ask': 'prefix',
  'new-session': 'right',
  'formula': 'middle',
  'ask-teacher': 'none',
  'web-search': 'none'
}

const normalizedTools = computed<ToolbarTool[]>(() =>
  props.toolbarTools.map((t): ToolbarTool =>
    typeof t === 'string' ? { type: t as BuiltinToolType } : (t as ToolbarTool)
  )
)

const prefixTools = computed(() => {
  if (props.type === 'html-preview') return []
  return normalizedTools.value.filter((t) => TOOL_POSITION_MAP[t.type] === 'prefix')
})
const hasPrefixTool = computed(() => prefixTools.value.length > 0)

const middleTools = computed(() =>
  normalizedTools.value.filter((t) => TOOL_POSITION_MAP[t.type] === 'middle')
)

const rightTools = computed(() =>
  normalizedTools.value.filter((t) => TOOL_POSITION_MAP[t.type] === 'right')
)
const hasRightTool = computed(() => rightTools.value.length > 0)

const handleToolClick = (tool: ToolbarTool) => {
  switch (tool.type) {
    case 'screenshot':
    case 'select-and-ask':
      emit('screenshot-click')
      break
    case 'formula':
      handleFormulaTopClick()
      break
    case 'ask-teacher':
      handleAskTeacherClick()
      break
    case 'web-search':
      handleToggleWebSearch()
      break
    case 'new-session':
      emit('new-session-click')
      break
    default:
      break
  }
}

watch(
  () => props.quotedMessage,
  (newVal) => {
    console.log('[ChatInput] quotedMessage 变化:', newVal)
  },
  { immediate: true }
)

const canSendActual = computed(() => {
  if (props.isLoading) return false
  if (props.isEditing) return true
  return !!(props.modelValue && props.modelValue.trim().length > 0 && props.canSend)
})

const handleEditorFocus = () => {
  isEditorFocused.value = true
  emit('focus')
  emit('input-focus')
}

const handleEditorBlur = () => {
  isEditorFocused.value = false
  emit('blur')
  emit('input-blur')
}

const handleEditorUpdate = (e: any) => {
  const text = e.detail?.value ?? e.target?.value ?? ''
  emit('update:modelValue', text)
}

const handleSendMessage = () => {
  if (canSendActual.value && !props.isLoading) {
    emit('send-message')
  }
}

const handleSendButtonHitAreaClick = () => {
  handleSendMessage()
}

const selectModel = (model: string) => {
  emit('update:selected-model', model)
}

const handleCancelEdit = () => {
  emit('cancel-edit')
}

const handleToggleWebSearch = () => {
  isOnlineSearchSelected.value = !isOnlineSearchSelected.value
  emit('toggle-web-search')
}

const handleFormulaTopClick = () => {
  isFormulaSelected.value = !isFormulaSelected.value
  formulaDialogValue.value = ''
  showFormulaModal.value = true
  emit('formula-click')
}

const insertFormulaSymbol = (sym: string) => {
  emit('update:modelValue', (props.modelValue || '') + sym)
}

const handleInsertFormulaFromDialog = () => {
  showFormulaModal.value = false
  emit('scroll-to-bottom')
}

const handleCancelFormulaDialog = () => {
  showFormulaModal.value = false
}

const handleAskTeacherClick = () => {
  isAskTeacherSelected.value = !isAskTeacherSelected.value
  emit('ask-teacher-click', { mode: 'ask-teacher' })
}

const handleShowImagePicker = () => {
  uni.chooseImage({
    count: 3,
    success: (res) => {
      emit('show-image-picker')
      uni.showToast({ title: `已选择 ${res.tempFilePaths.length} 张图片`, icon: 'none' })
    }
  })
}

const handleScreenshotThumbClick = (shot: AttachedScreenshot) => {
  if (!shot?.id) return
  emit('edit-screenshot', shot.id)
  if (shot.dataUrl || shot.filePath) {
    imageViewerUrl.value = shot.dataUrl || shot.filePath || ''
    imageViewerVisible.value = true
  }
}
</script>

<style lang="scss" scoped>
.modern-chat-container {
  background-color: #ffffff;
  border-top: 1rpx solid #f1f5f9;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.chat-input-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.chat-top-toolbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.toolbar-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background-color: #f8fafc;
  border: 1rpx solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  margin: 0;
  padding: 0;
  line-height: 1;

  &:active {
    background-color: #f0f2fe;
    color: #7a7cff;
  }
}

.toolbar-svg-icon {
  stroke: #64748b;
}

.new-session-btn {
  width: auto;
  height: auto;
  border-radius: 32rpx;
  padding: 10rpx 24rpx;
  background-color: #f0f2fe;
  border: 1rpx solid #e0e4ff;
  color: #7a7cff;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;

  .btn-label {
    font-size: 24rpx;
    color: #4f46e5;
  }
}

.chat-input-wrapper {
  background-color: #ffffff;
  border: 1.5px solid #eef0f5;
  border-radius: 32rpx;
  padding: 20rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.quote-bar {
  background-color: #f0f2fe;
  padding: 12rpx 20rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;

  .quote-content {
    display: flex;
    align-items: center;
    flex: 1;
    overflow: hidden;
  }

  .quote-label {
    font-size: 24rpx;
    font-weight: bold;
    color: #7a7cff;
  }

  .quote-message {
    font-size: 24rpx;
    color: #4338ca;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quote-close {
    font-size: 26rpx;
    color: #7a7cff;
    padding-left: 16rpx;
    background: transparent;
    border: none;
  }
}

.screenshot-thumb-bar {
  display: flex;
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.screenshot-thumb-inner {
  position: relative;
  width: 96rpx;
  height: 96rpx;

  .thumb-img {
    width: 100%;
    height: 100%;
    border-radius: 16rpx;
  }

  .thumb-del {
    position: absolute;
    top: -8rpx;
    right: -8rpx;
    background: rgba(0, 0, 0, 0.65);
    color: #ffffff;
    border-radius: 50%;
    width: 34rpx;
    height: 34rpx;
    font-size: 20rpx;
    text-align: center;
    line-height: 34rpx;
  }
}

.unified-input-area {
  min-height: 72rpx;
  margin-bottom: 12rpx;

  .main-textarea {
    width: 100%;
    min-height: 72rpx;
    max-height: 240rpx;
    font-size: 28rpx;
    color: #1e293b;
    line-height: 1.5;
  }
}

.control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14rpx;
  border-top: 1rpx solid #f1f5f9;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex-wrap: wrap;
}

.ask-teacher-btn {
  width: auto;
  height: auto;
  padding: 10rpx 22rpx;
  border-radius: 32rpx;
  background-color: #f1f5f9;
  border: 1rpx solid transparent;
  color: #64748b;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;

  &.active {
    background-color: #f0f2fe;
    border-color: #e0e4ff;
    color: #7a7cff;
    font-weight: 600;
  }

  .ask-teacher-label {
    font-size: 24rpx;
  }
}

.edit-indicator {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background-color: #fef3c7;
  padding: 10rpx 20rpx;
  border-radius: 24rpx;

  .edit-text { font-size: 24rpx; color: #92400e; font-weight: 600; }
  .cancel-edit-btn { background: transparent; border: none; font-size: 24rpx; color: #b45309; }
}

.right-controls {
  display: flex;
  align-items: center;
}

.send-button-hit-area {
  padding: 4rpx;
}

.send-button {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  border: none;
  transition: all 0.2s ease;

  &--enabled {
    background: #7a7cff;
    box-shadow: 0 4rpx 16rpx rgba(122, 124, 255, 0.35);

    &:active {
      transform: scale(0.95);
      background: #6366f1;
    }
  }

  &--disabled {
    background: #e2e8f0;
    opacity: 0.75;
  }
}

.formula-modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.formula-modal-card {
  width: 620rpx;
  background: #ffffff;
  border-radius: 28rpx;
  padding: 24rpx;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.modal-title {
  font-size: 30rpx;
  font-weight: bold;
}

.modal-close {
  font-size: 32rpx;
  color: #94a3b8;
}

.formula-keys-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.formula-key {
  height: 72rpx;
  background: #f1f5f9;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: bold;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
}

.modal-btn {
  font-size: 26rpx;
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 28rpx;
  border-radius: 32rpx;
  margin: 0;

  &.cancel { background: #f1f5f9; color: #64748b; }
  &.confirm { background: #7a7cff; color: #ffffff; }
}

.image-viewer-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;

  .viewer-full-img {
    width: 100%;
    height: 100%;
  }
}
</style>
