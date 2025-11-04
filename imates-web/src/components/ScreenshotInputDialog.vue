<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="截图提问"
    :initial-width="560"
    :initial-height="500"
    :min-width="400"
    :min-height="350"
    title-align="left"
    header-background-color="#ffffff"
    class="screenshot-input-dialog"
  >
    <div class="screenshot-input-content">
      <!-- 截图预览区域 -->
      <div class="screenshot-preview">
        <img 
          v-if="screenshotDataUrl" 
          :src="screenshotDataUrl" 
          alt="截图预览"
          class="preview-image"
        />
      </div>
      
      <!-- 输入框区域 -->
      <div class="input-section">
        <q-input
          v-model="questionText"
          type="textarea"
          placeholder="请输入要问的问题"
          rows="3"
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
          @click="handleConfirm"
          :disable="!questionText.trim()"
          class="confirm-btn"
        />
      </div>
    </div>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import { showMessage } from '@/utils'

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
  screenshotDataUrl: ''
})

const emit = defineEmits<Emits>()

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 问题文本
const questionText = ref('')

// 监听对话框打开，重置表单
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    questionText.value = ''
  }
})

// 确定按钮
const handleConfirm = () => {
  if (!questionText.value.trim()) {
    showMessage('请输入要问的问题', 'warning')
    return
  }
  
  if (!props.screenshotDataUrl) {
    showMessage('截图数据丢失，请重新截图', 'error')
    return
  }
  
  emit('confirm', questionText.value.trim(), props.screenshotDataUrl)
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
    padding: 20px;
    gap: 16px;
  }
  
  .screenshot-preview {
    flex: 1;
    min-height: 200px;
    max-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e0e0e0;
    
    .preview-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }
  
  .input-section {
    flex-shrink: 0;
    
    .question-input {
      :deep(.q-field__control) {
        min-height: 80px;
      }
    }
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-shrink: 0;
    padding-top: 8px;
    
    .cancel-btn,
    .confirm-btn {
      min-width: 80px;
    }
  }
}
</style>

