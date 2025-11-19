<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="聊聊这里？"
    :initial-width="560"
    :initial-height="520"
    :min-width="400"
    :min-height="350"
    title-align="left"
    header-background-color="#ffffff"
    class="screenshot-input-dialog"
  >
    <div class="screenshot-input-content">
      <!-- 截图预览区域（仅展示整张截图，不再支持框选） -->
      <div class="screenshot-preview">
        <div v-if="screenshotDataUrl" class="image-container">
          <img :src="screenshotDataUrl" alt="截图预览" class="preview-image" />
        </div>
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
          @click.stop.prevent="handleConfirm"
          :disable="!questionText.trim()"
          class="confirm-btn"
        />
      </div>
    </div>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import { showMessage } from '@/utils'

interface Props {
  modelValue: boolean
  screenshotDataUrl?: string
  enableCrop?: boolean  // 是否启用框选模式，默认为 true
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', question: string, screenshotDataUrl: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  screenshotDataUrl: '',
  enableCrop: true
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
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    questionText.value = ''
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
  
  // 直接使用原始截图数据（不再进行二次框选裁剪）
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
    height: 270px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    position: relative;

    .image-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .crop-container {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .crop-canvas {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      touch-action: none;
      user-select: none;
      height: auto;
    }
    
    // 灰色蒙版样式
    .crop-mask {
      position: absolute;
      background: rgba(0, 0, 0, 0.5); /* 灰色半透明蒙版 */
      pointer-events: none;
      z-index: 1;
    }
    
    .crop-overlay {
      position: absolute;
      background: transparent; /* 框选区域透明，显示清晰的图片 */
      pointer-events: none;
      z-index: 2; /* 确保框选区域在蒙版之上 */
    }
    
    .crop-corner {
      position: absolute;
      width: 24px;
      height: 24px;
      pointer-events: none;
    }
    
    .crop-corner-nw {
      top: 0;
      left: 0;
      border-top: 4px solid white;
      border-left: 4px solid white;
    }
    
    .crop-corner-ne {
      top: 0;
      right: 0;
      border-top: 4px solid white;
      border-right: 4px solid white;
    }
    
    .crop-corner-sw {
      bottom: 0;
      left: 0;
      border-bottom: 4px solid white;
      border-left: 4px solid white;
    }
    
    .crop-corner-se {
      bottom: 0;
      right: 0;
      border-bottom: 4px solid white;
      border-right: 4px solid white;
    }
    
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

