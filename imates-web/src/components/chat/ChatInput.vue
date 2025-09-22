<template>
  <div class="modern-chat-container">
    <!-- 主容器 -->
    <div class="chat-input-wrapper" ref="inputAreaRef">
      <!-- 新的MathFormulaEditor输入区域 -->
      <div class="unified-input-area">
        <MathFormulaEditor
          ref="mathEditorRef"
          v-model="editorContent"
          :placeholder="props.placeholderText"
          :disabled="props.isLoading"
          :max-height="'200px'"
          @focus="handleEditorFocus"
          @blur="handleEditorBlur"
          @keydown="handleEditorKeydown"
          @update:modelValue="handleEditorUpdate"
        />
      </div>

      <!-- 控制栏 -->
      <div class="control-bar">
        <!-- 左侧控制组 -->
        <div class="left-controls">
          <!-- 编辑状态指示器 -->
          <div v-if="props.isEditing" class="edit-indicator">
            <q-icon name="edit" color="primary" size="16px" />
            <span class="edit-text">编辑消息</span>
            <q-btn
              flat
              dense
              round
              icon="close"
              size="sm"
              color="grey-6"
              @click="$emit('cancel-edit')"
              class="cancel-edit-btn"
            >
              <q-tooltip>取消编辑</q-tooltip>
            </q-btn>
          </div>

          <!-- 模式选择器 - 仅在AI模式下显示且非编辑状态 -->
          <q-btn-dropdown
            v-if="props.type === 'ai' && !props.isEditing"
            flat
            dense
            class="mode-selector"
            :class="{ active: false }"
            :label="getModelDisplayName(props.selectedModel)"
            icon="smart_toy"
            :icon-size="20"
            no-icon-animation
            auto-close
            anchor="top middle"
            self="bottom middle"
          >
            <q-list class="model-select-list">
              <q-item
                v-for="option in aiRoleOptions"
                :key="option.value"
                clickable
                v-close-popup
                @click="selectModel(option.value)"
                :class="{ active: props.selectedModel === option.value }"
                class="model-select-item"
              >
                <q-item-section>
                  <q-item-label>{{ option.label }}</q-item-label>
                </q-item-section>
                <q-item-section side v-if="props.selectedModel === option.value">
                  <q-icon name="check" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>

          <!-- 联网搜索 - 仅在AI对话时显示且非编辑状态 -->
          <q-btn
            v-if="props.type === 'ai' && !props.isEditing"
            flat
            dense
            class="web-search-btn"
            :class="{ active: props.enableWebSearch }"
            @click="$emit('toggle-web-search')"
          >
            <q-icon name="language" size="20px" />
            <span>联网搜索</span>
          </q-btn>
        </div>

        <!-- 右侧控制组 -->
        <div class="right-controls">
          <!-- 语音按钮 - 仅老师对话显示，AI模式下隐藏 -->
          <q-btn
            v-if="props.type === 'teacher'"
            flat
            round
            dense
            :icon="props.isRecording ? 'mic' : 'mic_none'"
            :color="props.isRecording ? 'red-6' : undefined"
            @mousedown="handleVoiceStart"
            @mouseup="handleVoiceEnd"
            @mouseleave="handleVoiceEnd"
            @touchstart="handleVoiceStart"
            @touchend="handleVoiceEnd"
            @touchmove="handleVoiceMove"
            class="control-icon-btn voice-btn"
          >
            <q-tooltip>{{ props.isRecording ? '松开结束录音' : '按住说话' }}</q-tooltip>
          </q-btn>

          <!-- 图片上传 - AI模式下隐藏 -->
          <q-btn
            v-if="props.type !== 'ai'"
            flat
            round
            dense
            icon="add_photo_alternate"
            @click="$emit('show-image-picker')"
            class="control-icon-btn"
            :class="{ active: props.activeMode?.label === '图片模式' }"
          >
            <q-tooltip>添加图片</q-tooltip>
          </q-btn>

          <!-- 插入公式按钮 -->
          <q-btn
            flat
            round
            dense
            icon="functions"
            @click="handleInsertMathFormula"
            class="math-formula-btn control-icon-btn"
          >
            <q-tooltip>插入数学公式</q-tooltip>
          </q-btn>


          <!-- 发送按钮 -->
          <q-btn
            round
            :icon="props.isLoading ? 'hourglass_empty' : (props.isEditing ? 'check' : 'send')"
            :color="props.canSend ? 'primary' : 'grey-4'"
            :disable="!props.canSend || props.isLoading"
            :loading="props.isLoading"
            @click="handleSendMessage"
            class="send-button"
            size="md"
          >
            <q-tooltip v-if="props.isEditing">更新消息</q-tooltip>
            <q-tooltip v-else>发送消息</q-tooltip>
          </q-btn>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import MathFormulaEditor from '../MathFormulaEditor.vue'
import type { 
  ContentBlock, 
  ChatInputProps, 
  ChatInputEmits 
} from '../../types'


const props = defineProps<ChatInputProps>()

const emit = defineEmits<ChatInputEmits & {
  'focus': []
  'blur': []
}>()

// 新的编辑器相关状态
const inputAreaRef = ref<HTMLElement>()
const editorContent = ref<string>('')
const isEditorFocused = ref(false)
const mathEditorRef = ref<InstanceType<typeof MathFormulaEditor>>()

// 保留原有的复杂状态用于向后兼容（如果需要）
const contentCanvasRef = ref<HTMLElement>()
const contentBlocks = ref<ContentBlock[]>([])
const currentEditingFormula = ref<ContentBlock | null>(null)
const formulaRefs = ref<Map<string, HTMLElement>>(new Map())
const mathfields = ref<Map<string, unknown>>(new Map())
const selectedBlockIndex = ref<number>(-1)
const isKeyboardTransitioning = ref(false)
const isPlaceholderClicked = ref(false)
const isReadyForTextInput = ref(false)

// 消息渲染器
const { renderMessageContent } = useMessageRenderer()

const currentInputValue = computed(() => {
  return editorContent.value
})

// 编辑器事件处理
const handleEditorFocus = () => {
  isEditorFocused.value = true
  emit('focus')
}

const handleEditorBlur = () => {
  isEditorFocused.value = false
  emit('blur')
}

const handleEditorKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSendMessage()
  }
}

const handleEditorUpdate = (content: string) => {
  editorContent.value = content
  emit('update:modelValue', content)
}

// 学习伙伴角色选项
const aiRoleOptions = [
  { label: '同桌', value: 'mate' },
  { label: '学长', value: 'mentor' },
  { label: '大神', value: 'researcher' },
]

// 根据选择的模式获取显示名称
const getModelDisplayName = (model: string) => {
  const option = aiRoleOptions.find(opt => opt.value === model)
  return option ? option.label : '同桌'
}

// 切换模型选择弹出框（使用q-btn-dropdown后不再需要此函数）

// 选择模型
const selectModel = (model: string) => {
  emit('update:selected-model', model)
}

// 语音录制事件处理
const handleVoiceStart = (event: TouchEvent | MouseEvent) => {
  // 1. 阻止默认行为
  event.preventDefault()
  
  // 2. 触发开始录音事件
  emit('start-voice-input', event)
}

const handleVoiceEnd = (event: TouchEvent | MouseEvent) => {
  // 1. 阻止默认行为
  event.preventDefault()
  
  // 2. 触发停止录音事件
  emit('stop-voice-input', event)
}

const handleVoiceMove = (event: TouchEvent | MouseEvent) => {
  // 1. 阻止默认行为
  event.preventDefault()
  
  // 2. 触发语音移动事件
  emit('voice-move', event)
}






// 完成公式编辑
const finishFormulaEditing = async (blockId: string) => {
  
  // 1. 获取MathLive实例
  const mathfield = mathfields.value.get(blockId) as HTMLElement
  if (!mathfield) {
    return
  }
  
  // 2. 获取公式内容
  const content = (mathfield as any).value || ''
  
  // 3. 开始退出动画
  isKeyboardTransitioning.value = true
  mathfield.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  mathfield.style.opacity = '0'
  mathfield.style.transform = 'translateY(-5px)'
  
  // 4. 等待动画完成
  setTimeout(() => {
    
    // 5. 检查组件挂载状态
    if (!contentCanvasRef.value) {
      return
    }
    
    // 6. 处理公式块保存
    if (currentEditingFormula.value && currentEditingFormula.value.id === blockId) {
      
      // 6.1 检查内容是否为空
      if (!content.trim()) {
        currentEditingFormula.value = null
        return
      }
      
      // 6.2 创建新的公式块
      const formulaBlock: ContentBlock = {
        id: blockId,
        type: 'formula',
        content: content,
        renderedContent: content ? renderMessageContent(content) : '',
        isEditing: false
      }
      
      // 6.3 添加到内容块列表
      contentBlocks.value.push(formulaBlock)
      currentEditingFormula.value = null
    } else {
      
      // 6.3 更新现有公式块
      const blockIndex = contentBlocks.value.findIndex(block => block.id === blockId)
      if (blockIndex !== -1) {
        contentBlocks.value[blockIndex].content = content
        contentBlocks.value[blockIndex].renderedContent = content ? renderMessageContent(content) : ''
        contentBlocks.value[blockIndex].isEditing = false
      } else {
      }
    }
    
    // 7. 清理MathLive实例
    cleanupMathLiveInstance(mathfield, blockId)
    
    // 8. 更新modelValue
    const newModelValue = currentInputValue.value
    emit('update:modelValue', newModelValue)
    
    // 9. 重置键盘切换状态
    isKeyboardTransitioning.value = false
    
  }, 200)
}

// 清理MathLive实例
const cleanupMathLiveInstance = (mathfield: HTMLElement, blockId: string) => {
  
  // 1. 从DOM中移除元素
  try {
    if (mathfield && typeof mathfield.remove === 'function') {
      mathfield.remove()
    }
  } catch {
    // 忽略错误
  }
  
  // 2. 从引用映射中删除
  mathfields.value.delete(blockId)
}

// 清理所有MathLive实例
const cleanupAllMathLiveInstances = () => {
  // 1. 遍历所有MathLive实例
  mathfields.value.forEach((mathfield: any) => {
    try {
      if (mathfield && typeof mathfield.remove === 'function') {
        mathfield.remove()
      }
    } catch {
    }
  })
  
  // 2. 清空引用映射
  mathfields.value.clear()
  formulaRefs.value.clear()
}


// 防抖定时器
let insertFormulaDebounceTimer: number | null = null

// 插入数学公式处理
const handleInsertMathFormula = async () => {
  // 防抖保护：清除之前的定时器
  if (insertFormulaDebounceTimer) {
    clearTimeout(insertFormulaDebounceTimer)
  }
  
  // 设置新的防抖定时器
  insertFormulaDebounceTimer = setTimeout(async () => {
    // 检查 MathFormulaEditor 组件是否已经正确初始化
    if (!mathEditorRef.value) {
      return
    }
    
    // 检查 insertMathField 方法是否存在
    if (typeof mathEditorRef.value.insertMathField !== 'function') {
      return
    }
    
    try {
      mathEditorRef.value.insertMathField()
      
      // 插入公式后触发滚动到底部事件
      emit('scroll-to-bottom')
    } catch (error) {
      console.error('插入数学公式失败:', error)
    }
    
    // 清除定时器引用
    insertFormulaDebounceTimer = null
  }, 300) // 300ms防抖延迟
}

// 发送消息处理
const handleSendMessage = () => {
  // 1. 调用 MathFormulaEditor 的 getMarkdownContent 方法获取完整内容
  const markdownContent = mathEditorRef.value?.getMarkdownContent();

  // 2. 检查内容是否为空
  if (!markdownContent || !markdownContent.trim()) {
    return
  }

  // 3. 更新 v-model 的值，将完整的 markdown 内容传递给父组件
  emit('update:modelValue', markdownContent);

  // 4. 使用 nextTick 确保父组件的 v-model 更新后再发送消息
  nextTick(() => {
    emit('send-message');
    clearInputContent();
  });
}


// 清空输入内容
const clearInputContent = () => {
  // 1. 调用 MathFormulaEditor 的清空方法
  if (mathEditorRef.value) {
    mathEditorRef.value.clearContent()
  }
  
  // 2. 确保父组件的 v-model 也被清空
  emit('update:modelValue', '');

  // 3. 清理所有MathLive实例（向后兼容）
  cleanupAllMathLiveInstances()
  
  // 4. 清空内容块（向后兼容）
  contentBlocks.value = []
  
  // 5. 清空当前编辑公式（向后兼容）
  currentEditingFormula.value = null
  
  // 6. 重置选中状态（向后兼容）
  selectedBlockIndex.value = -1
  
  // 7. 重置键盘切换状态（向后兼容）
  isKeyboardTransitioning.value = false
  
  // 8. 重置文本输入准备状态（向后兼容）
  isReadyForTextInput.value = false
  
  // 9. 重置占位符状态（向后兼容）
  isPlaceholderClicked.value = false
}

// 监听modelValue变化，同步到编辑器
watch(() => props.modelValue, (newValue) => {
  // 1. 检查值是否有效且与当前编辑器内容不同
  if (newValue !== editorContent.value) {
    editorContent.value = newValue || ''
  }
}, { immediate: true })


const handleNativeKeyboardClose = () => {
  // 检查是否有正在编辑的公式
  if (currentEditingFormula.value) {
    // 如果有，则完成编辑
    finishFormulaEditing(currentEditingFormula.value.id);
  }
  
  // 让主输入区域失焦
  if (contentCanvasRef.value) {
    contentCanvasRef.value.blur();
  }
}

const handleFormulaEnterPressed = () => {
  // 延迟发送消息，确保公式编辑完成
  setTimeout(() => {
    handleSendMessage()
  }, 100)
}

const handleFormulaContentUpdated = (event: Event) => {
  const customEvent = event as CustomEvent
  const { nodeId, content } = customEvent.detail
  
  // 更新当前编辑公式的内容
  if (currentEditingFormula.value && currentEditingFormula.value.id === nodeId) {
    currentEditingFormula.value.content = content
  }
}

const handleFormulaCancelEdit = (event: Event) => {
  const customEvent = event as CustomEvent
  const { nodeId } = customEvent.detail
  
  // 取消当前编辑状态
  if (currentEditingFormula.value && currentEditingFormula.value.id === nodeId) {
    currentEditingFormula.value = null
    isKeyboardTransitioning.value = false
  }
}


// 生命周期
onMounted(() => {
  // 1. 初始化编辑器内容
  if (props.modelValue) {
    editorContent.value = props.modelValue
  } else {
  }
  
  // 2. 添加键盘关闭监听器
  window.addEventListener('nativeKeyboardClose', handleNativeKeyboardClose);
  
  // 3. 添加公式回车键监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-enter-pressed', handleFormulaEnterPressed);
  
  // 4. 添加公式内容更新监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-content-updated', handleFormulaContentUpdated);
  
  // 5. 添加公式取消编辑监听器（由 TiptapEditor 触发）
  window.addEventListener('formula-cancel-edit', handleFormulaCancelEdit);

})

onUnmounted(() => {
  
  // 1. 清理编辑器内容
  editorContent.value = ''
  
  // 2. 清理编辑状态（向后兼容）
  currentEditingFormula.value = null
  
  // 3. 清理所有MathLive实例（向后兼容）
  cleanupAllMathLiveInstances()
  
  // 4. 清理内容块（向后兼容）
  contentBlocks.value = []
  selectedBlockIndex.value = -1
  
  // 5. 重置其他状态（向后兼容）
  isReadyForTextInput.value = false
  isKeyboardTransitioning.value = false
  isPlaceholderClicked.value = false
  
  // 6. 移除键盘关闭监听器
  window.removeEventListener('nativeKeyboardClose', handleNativeKeyboardClose);
  
  // 7. 移除公式回车键监听器
  window.removeEventListener('formula-enter-pressed', handleFormulaEnterPressed);
  
  // 8. 移除公式内容更新监听器
  window.removeEventListener('formula-content-updated', handleFormulaContentUpdated);
  
  // 9. 移除公式取消编辑监听器
  window.removeEventListener('formula-cancel-edit', handleFormulaCancelEdit);

})

// 暴露方法给父组件
defineExpose({
  clearInputContent,
  focus: () => {
    if (mathEditorRef.value) {
      mathEditorRef.value.focus()
    }
  }
})

</script>

<style scoped>
/* 现代聊天输入容器 */
.modern-chat-container {
  width: 100%;
  max-width: 100%;
  padding: 0 16px 8px 16px;
  background: transparent;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  z-index: 1000; /* 确保整个输入容器在消息区域上方 */
}

/* 主容器 - 现代感设计 */
.chat-input-wrapper {
  background: #f8f9fa;
  border-radius: 16px;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
  border: none;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  width: 100%;
  z-index: 1000; /* 确保输入区域在消息区域上方 */
  max-width: 100%;
  box-sizing: border-box;
}

.chat-input-wrapper:hover {
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 2px 4px rgba(0, 0, 0, 0.06);
}

.chat-input-wrapper:focus-within {
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
}

/* 附件栏 */
.attachments-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 0 4px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.uploaded-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.file-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f1f3f4;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 13px;
  color: #3c4043;
}

.file-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  width: 16px;
  height: 16px;
  min-height: 16px;
  color: #5f6368;
}

.mode-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #e8f0fe;
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 13px;
  color: #1a73e8;
}

/* 统一输入区域 */
.unified-input-area {
  background: transparent;
  border: none;
  border-radius: 12px;
  padding: 0;
  transition: all 0.2s ease;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.unified-input-area:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

.unified-input-area:focus-within {
  box-shadow: none;
}

/* 智能内容画布 */
.content-canvas {
  min-height: 40px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  outline: none;
  font-size: 16px;
  line-height: 1.4;
  color: #3c4043;
  cursor: text;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden; /* 防止占位符溢出 */
  text-decoration: none !important; /* 去除下划线 */
}

/* 隐藏contenteditable的文本内容，只显示Vue模板内容 */
.content-canvas {
  color: transparent !important;
  /* 使用更彻底的方法隐藏文本，不占用空间 */
  font-size: 0 !important;
  line-height: 0 !important;
}

/* 只对contenteditable的直接文本节点应用透明样式，不影响content-block */
.content-canvas > *:not(.canvas-content) {
  color: transparent !important;
  font-size: 0 !important;
  line-height: 0 !important;
  text-decoration: none !important; /* 去除下划线 */
}

/* 确保contenteditable内的所有元素都没有下划线 */
.content-canvas * {
  text-decoration: none !important;
}

/* 确保canvas-content内的内容正常显示 */
.canvas-content {
  font-size: 16px !important;
  line-height: 1.4 !important;
  color: #3c4043 !important;
}

/* 但是content-block要正常显示 */
.content-block {
  color: #3c4043 !important;
  font-size: 16px !important; /* 恢复正常字体大小 */
  line-height: 1.4 !important; /* 恢复正常行高 */
}

.text-block {
  color: #3c4043 !important;
  font-size: 16px !important; /* 恢复正常字体大小 */
  line-height: 1.4 !important; /* 恢复正常行高 */
}

.content-canvas:focus {
  outline: none;
}

/* 画布占位符 */
.canvas-placeholder {
  color: #9aa0a6 !important; /* 确保占位符可见 */
  font-weight: 400;
  pointer-events: auto; /* 允许点击 */
  user-select: none;
  cursor: text; /* 显示文本光标 */
  position: absolute;
  top: 8px;
  left: 12px;
  right: 12px;
  z-index: 1; /* 确保占位符在内容之上 */
  transition: opacity 0.2s ease, transform 0.2s ease; /* 添加过渡效果 */
}

/* Hover效果 - 占位符悬停时变透明 */
.canvas-placeholder:hover {
  opacity: 0.3;
  transform: translateY(-1px);
}

/* 内容区域 */
.canvas-content {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px;
  min-height: 24px;
  position: relative;
  z-index: 2; /* 确保内容在占位符之上 */
}

/* 内容块基础样式 */
.content-block {
  display: inline-block;
  position: relative;
  transition: all 0.2s ease;
}

/* 文本块样式 */
.text-block {
  color: #3c4043;
  word-wrap: break-word;
  white-space: nowrap; /* 防止文本换行，保持在一行显示 */
}

/* 公式块样式 */
.formula-block {
  display: inline-block;
  position: relative;
  margin: 0 2px;
  vertical-align: baseline;
}

/* 公式编辑状态 */
.formula-block.editing {
  background: rgba(0, 0, 0, 0.05);
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 2px 4px;
  margin: 0 1px;
}

/* 公式编辑器容器 */
.formula-editor {
  min-width: 60px;
  min-height: 24px;
  display: inline-block;
}

/* 公式渲染内容 */
.formula-rendered {
  display: inline-block;
  vertical-align: baseline;
  font-family: 'Times New Roman', serif;
  color: #1976d2;
}

/* 公式块选中状态 */
.formula-block.selected {
  background: rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 2px 4px;
  margin: 0 1px;
}

/* 键盘切换动画 */
.keyboard-transitioning {
  pointer-events: none;
}

.keyboard-transitioning .content-canvas {
  opacity: 0.7;
  transform: scale(0.98);
}

/* 公式编辑器进入动画 */
.formula-editor {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 内容块动画 */
.content-block {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.content-block:hover {
  transform: translateY(-1px);
}

/* 公式块特殊动画 */
.formula-block {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.formula-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 控制栏 */
.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1px 0;
  gap: 16px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border-top: none;
  margin-top: 4px;
  padding-top: 4px;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: nowrap;
  overflow: visible;
}

/* 模式选择器 */
.mode-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: transparent;
  border-radius: 20px;
  border: none;
  color: #3c4043;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
}

.mode-selector :deep(.q-btn__content) {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 隐藏下拉箭头 */
.mode-selector :deep(.q-btn-dropdown__arrow) {
  display: none;
}

.mode-selector:hover {
  background: #f8f9fa;
}

.mode-selector.active {
  background: #e8f0fe;
  color: #1a73e8;
}

.mode-text {
  font-weight: 500;
}

/* 当前模式显示 */
.current-mode {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: #1a73e8;
  border-radius: 20px;
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.mode-label {
  white-space: nowrap;
}

/* 编辑状态指示器 */
.edit-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #e3f2fd;
  border-radius: 20px;
  color: #1976d2;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid #bbdefb;
}

.edit-text {
  font-size: 13px;
  font-weight: 500;
}

.cancel-edit-btn {
  width: 20px;
  height: 20px;
  min-height: 20px;
  color: #666;
}

.cancel-edit-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
  color: #333;
}

/* 联网搜索按钮 */
.web-search-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: transparent;
  border-radius: 20px;
  border: none;
  color: #3c4043;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
}

.web-search-btn:hover {
  background: #f8f9fa;
}

.web-search-btn.active {
  background: #e8f5e8;
  color: #34a853;
}

/* 控制图标按钮 */
.control-icon-btn {
  width: 36px;
  height: 36px;
  color: #5f6368;
  transition: all 0.2s ease;
}

.control-icon-btn:hover {
  background-color: rgba(95, 99, 104, 0.12);
  color: #3c4043;
}

.control-icon-btn.active {
  background-color: rgba(0, 0, 0, 0.08);
  color: #1a73e8;
}

/* 公式插入按钮特殊样式 */
.formula-insert-btn {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  color: #1976d2;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.formula-insert-btn:hover {
  background: linear-gradient(135deg, #bbdefb 0%, #e1bee7 100%);
  color: #1565c0;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 语音按钮特殊样式 */
.voice-btn.recording {
  color: #ea4335;
  background-color: rgba(234, 67, 53, 0.1);
}

.voice-btn.recording:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #3c4043;
}

.control-icon-btn.active {
  background: #e8f0fe;
  color: #1a73e8;
}

/* 发送按钮 */
.send-button {
  width: 40px;
  height: 40px;
  background: #1a73e8;
  color: white;
  transition: all 0.2s ease;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.2),
    0 1px 2px rgba(0, 0, 0, 0.1);
  border: none;
}

.send-button:hover {
  background: #1557b0;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px) scale(1.05);
}

.send-button:active {
  transform: translateY(0) scale(0.98);
}

.send-button:disabled {
  background: #e8eaed;
  color: #9aa0a6;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transform: none;
}

/* 插入公式按钮 - 与其他控制按钮样式一致 */
.math-formula-btn {
  width: 36px;
  height: 36px;
  color: #5f6368;
  transition: all 0.2s ease;
  background: transparent;
  border: none;
}

.math-formula-btn:hover {
  background-color: rgba(95, 99, 104, 0.12);
  color: #3c4043;
}

.math-formula-btn:active {
  background-color: rgba(0, 0, 0, 0.08);
  color: #1a73e8;
}


/* 状态指示器 */
.status-indicators {
  display: flex;
  gap: 8px;
  padding: 0 4px;
  flex-wrap: wrap;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f1f3f4;
  border-radius: 12px;
  padding: 4px 8px;
  font-size: 12px;
  color: #5f6368;
}

.status-tag.search-enabled {
  background: #e8f5e8;
  color: #137333;
}

.status-tag.role-selected {
  background: #fce8e6;
  color: #c5221f;
}


/* 脉冲动画 */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* 平板优化 */
@media (min-width: 769px) and (max-width: 1024px) {
  .chat-input-wrapper {
    padding: 6px;
    border-radius: 20px;
  }
  
  .input-area {
    padding: 3px 5px;
    border-radius: 14px;
  }
  
  .control-icon-btn {
    width: 40px;
    height: 40px;
  }
  
  .math-formula-btn {
    width: 48px;
    height: 48px;
  }
  
  .send-button {
    width: 48px;
    height: 48px;
  }
  
  .main-textarea :deep(.q-field__native) {
    font-size: 17px;
    padding: 3px 0;
  }
  
  .control-bar {
    padding: 2px 0;
    gap: 18px;
  }
  
  .left-controls {
    gap: 14px;
  }
  
  .right-controls {
    gap: 8px;
  }
}

/* 手机响应式设计 */
@media (max-width: 768px) {
  .chat-input-wrapper {
    padding: 3px;
    border-radius: 16px;
    gap: 6px;
  }
  
  .input-area {
    padding: 2px 4px;
    border-radius: 12px;
  }
  
  .control-icon-btn {
    width: 32px;
    height: 32px;
  }
  
  .math-formula-btn {
    width: 40px;
    height: 40px;
  }
  
  .send-button {
    width: 40px;
    height: 40px;
  }
  
  .control-bar {
    padding: 1px 0;
    gap: 12px;
  }
  
  .left-controls {
    gap: 8px;
  }
  
  .right-controls {
    gap: 4px;
  }
  
  .mode-selector,
  .web-search-btn {
    padding: 4px 8px;
    font-size: 13px;
    max-width: 100px;
  }
  
  .content-canvas {
    font-size: 15px;
    padding: 6px 8px;
    min-height: 36px;
  }
  
  .formula-editor {
    min-width: 50px;
    min-height: 20px;
  }
}


/* 学习伙伴选择弹出框样式 */
.model-select-popup {
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 9999;
}

.model-select-list {
  min-width: 120px;
  padding: 4px 0;
}

.model-select-item {
  padding: 8px 16px;
  min-height: 40px;
  transition: all 0.2s ease;
}

.model-select-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.model-select-item.active {
  background-color: rgba(0, 0, 0, 0.08);
  color: #1976d2;
}

.model-select-item .q-item__label {
  font-size: 14px;
  font-weight: 500;
}


/* 减少动画效果 */
* {
  animation-duration: 0.2s !important;
  transition-duration: 0.2s !important;
}

/* 隐藏MathLive的所有装饰元素 */
.formula-editor :deep(.ML__base) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.formula-editor :deep(.ML__fieldcontainer) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.formula-editor :deep(.ML__field) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
  min-height: auto !important;
}

.formula-editor :deep(.ML__caret) {
  display: none !important;
}

.formula-editor :deep(.ML__selection) {
  display: none !important;
}

.formula-editor :deep(.ML__virtual-keyboard-toggle) {
  display: none !important;
}

.formula-editor :deep(.ML__toolbar) {
  display: none !important;
}

.formula-editor :deep(.ML__popover) {
  display: none !important;
}


/* 桌面端优化 */
@media (min-width: 1025px) {

  
  .chat-input-wrapper {
    padding: 8px;
    border-radius: 20px;
  }
  
  .input-area {
    padding: 6px 8px;
  }
  
  .control-bar {
    padding: 4px 0;
    gap: 20px;
  }
  
  .left-controls {
    gap: 16px;
  }
  
  .right-controls {
    gap: 12px;
  }
  
  .control-icon-btn {
    width: 40px;
    height: 40px;
  }
  
  .math-formula-btn {
    width: 44px;
    height: 44px;
  }
  
  .send-button {
    width: 44px;
    height: 44px;
  }
}
</style>