<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="聊聊这里？"
    :initial-width="900"
    :initial-height="900"
    :min-width="500"
    :min-height="450"
    title-align="left"
    header-background-color="#ffffff"
    class="screenshot-input-dialog"
  >
    <div class="screenshot-input-content">
      <!-- 截图编辑区域（集成 DrawingBoard） -->
      <div class="screenshot-editor">
        <DrawingBoard
          v-if="screenshotDataUrl"
          ref="drawingBoardRef"
          :background-image="screenshotDataUrl"
          :drawing-board-tools="['draw', 'eraser-draw','undo', 'redo']"
          :fill-container="true"
          :show-zoom-control="false"
          :force-pen-color="'red'"
        />
        <div v-else class="empty-placeholder">
          <q-icon name="image" size="48px" color="grey-5" />
          <span>暂无截图</span>
        </div>
      </div>
      
      <!-- 输入框区域 -->
      <div class="input-section">
        <q-input
          v-model="questionText"
          type="textarea"
          placeholder="请输入要问的问题"
          rows="2"
          outlined
          dense
          class="question-input"
          @keydown.enter.ctrl="handleConfirm"
          @keydown.enter.meta="handleConfirm"
        />
      </div>
      
      <!-- 按钮区域 -->
      <div class="dialog-footer">
        <q-btn
          flat
          label="取消"
          color="grey-7"
          @click="handleCancel"
          class="cancel-btn"
        />
        <q-btn
          label="确定"
          color="primary"
          @click.stop.prevent="handleConfirm"
          :disable="!questionText.trim()"
          class="confirm-btn"
        />
      </div>
    </div>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, type ComponentPublicInstance } from 'vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import DrawingBoard from '@/components/DrawingBoard.vue'
import { showMessage } from '@/utils'

// DrawingBoard 暴露的方法类型
interface DrawingBoardExposed {
  exportToJpg: (quality?: number) => string
  hasContent: () => boolean
  clearAll: () => void
}

interface Props {
  modelValue: boolean
  screenshotDataUrl?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', question: string, screenshotDataUrl: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  screenshotDataUrl: '',
})

const emit = defineEmits<Emits>()

// DrawingBoard 组件引用
const drawingBoardRef = ref<ComponentPublicInstance & DrawingBoardExposed | null>(null)

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 问题文本
const questionText = ref('')

// 监听对话框打开，重置表单
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    questionText.value = ''
    // 等待 DOM 更新后清空画板（如果有旧内容）
    await nextTick()
    if (drawingBoardRef.value?.clearAll) {
      drawingBoardRef.value.clearAll()
    }
  }
})

// 确定按钮
const handleConfirm = async () => {
  if (!questionText.value.trim()) {
    showMessage('请输入要问的问题', 'warning')
    return
  }
  
  if (!props.screenshotDataUrl) {
    showMessage('截图数据丢失，请重新截图', 'error')
    return
  }
  
  // 从 DrawingBoard 导出 JPG 图片（包含背景截图 + 用户标注）
  let finalImageData = props.screenshotDataUrl
  if (drawingBoardRef.value?.exportToJpg) {
    const exportedImage = drawingBoardRef.value.exportToJpg(0.9)
    if (exportedImage) {
      finalImageData = exportedImage
    }
  }
  
  emit('confirm', questionText.value.trim(), finalImageData)
  localVisible.value = false
}

// 取消按钮
const handleCancel = () => {
  emit('cancel')
  localVisible.value = false
}
</script>

<style lang="scss" scoped>
.screenshot-input-dialog {
  .screenshot-input-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
    gap: 12px;
  }
  
  .screenshot-editor {
    flex: 1;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    position: relative;
    overflow: hidden;

    // DrawingBoard 组件样式覆盖
    :deep(.canvas-demo-container) {
      background: transparent;
    }
    
    // fillContainer 模式下，Canvas 填满容器
    :deep(canvas) {
      width: 100% !important;
      height: 100% !important;
      display: block; 
    }

    // 工具栏样式调整（更紧凑）
    :deep(.toolbar-wrapper) {
      top: 8px;
    }

    .empty-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #9e9e9e;
      font-size: 14px;
    }
  }
  
  .input-section {
    flex-shrink: 0;
    
    .question-input {
      :deep(.q-field__control) {
        min-height: 60px;
      }
    }
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-shrink: 0;
    padding-top: 4px;
    
    .cancel-btn,
    .confirm-btn {
      min-width: 80px;
    }
  }
}
</style>

