<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="Hello, 给出你的建议吧~"
    :initial-width="600"
    :initial-height="600"
    :min-width="400"
    :min-height="400"
  >
    <div class="feedback-dialog-content">
      <!-- 问题反馈区域 -->
      <div class="feedback-section">
        <label class="feedback-label">
          请反馈你在使用中遇到的问题(点击图片可与编辑):
        </label>
        <div class="feedback-textarea-wrapper">
          <q-input
            v-model="feedbackForm.problem"
            type="textarea"
            class="feedback-textarea"
            rows="4"
            outlined
            placeholder="请输入您遇到的问题..."
          />
          <!-- 图片上传区域 -->
          <div class="feedback-image-upload" @click="uploadFeedbackImage">
            <div v-if="feedbackForm.imagePreview" class="feedback-image-preview">
              <img :src="feedbackForm.imagePreview" alt="预览图片" />
              <q-btn
                round
                dense
                flat
                icon="close"
                size="sm"
                class="feedback-image-remove"
                @click.stop="removeFeedbackImage"
              />
            </div>
            <div v-else class="feedback-image-placeholder">
              <q-icon name="add" size="32px" />
            </div>
          </div>
        </div>
      </div>

      <!-- 新功能建议区域 -->
      <div class="feedback-section">
        <label class="feedback-label">
          你还希望有哪些新功能?(选填)
        </label>
        <q-input
          v-model="feedbackForm.suggestion"
          type="textarea"
          class="feedback-textarea"
          rows="4"
          outlined
          placeholder="请输入您的建议..."
        />
      </div>

      <!-- 提交按钮 -->
      <div class="feedback-dialog-footer">
        <q-btn
          class="feedback-submit-btn"
          label="提交"
          @click="submitFeedback"
          :loading="isSubmittingFeedback"
        />
      </div>
    </div>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useImagePicker } from '@/composables/useImagePicker'
import { showMessage } from '@/utils'
import DraggableDialog from '@/components/DraggableDialog.vue'

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 响应式数据
const isSubmittingFeedback = ref(false)
const { pickImage } = useImagePicker()

// 反馈表单数据
const feedbackForm = ref({
  problem: '',
  suggestion: '',
  imagePreview: '' as string | null,
  imageData: null as { filePath: string; base64DataUrl: string } | null
})

// 监听对话框打开，重置表单
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    resetForm()
  }
})

// 重置表单
const resetForm = () => {
  feedbackForm.value = {
    problem: '',
    suggestion: '',
    imagePreview: null,
    imageData: null
  }
}

// 上传反馈图片
const uploadFeedbackImage = async () => {
  try {
    const imageInfo = await pickImage()
    if (!imageInfo) {
      return
    }

    if (imageInfo.base64DataUrl) {
      feedbackForm.value.imagePreview = imageInfo.base64DataUrl
      feedbackForm.value.imageData = {
        filePath: imageInfo.filePath,
        base64DataUrl: imageInfo.base64DataUrl
      }
    } else {
      showMessage('图片数据不完整，请重试', 'error')
    }
  } catch (error) {
    console.error('[FeedbackDialog] ❌ 上传反馈图片失败:', error)
    showMessage('上传图片失败，请重试', 'error')
  }
}

// 移除反馈图片
const removeFeedbackImage = () => {
  feedbackForm.value.imagePreview = null
  feedbackForm.value.imageData = null
}

// 提交反馈
const submitFeedback = async () => {
  // 验证必填项
  if (!feedbackForm.value.problem.trim()) {
    showMessage('请填写您遇到的问题', 'warning')
    return
  }

  isSubmittingFeedback.value = true
  
  try {
    // TODO: 调用后端API提交反馈
    // 这里先模拟提交
    console.log('[FeedbackDialog] 📤 提交反馈:', {
      problem: feedbackForm.value.problem,
      suggestion: feedbackForm.value.suggestion,
      hasImage: !!feedbackForm.value.imageData
    })

    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000))

    showMessage('反馈提交成功，感谢您的建议！', 'success')
    
    // 关闭对话框并重置表单
    localVisible.value = false
    resetForm()
  } catch (error) {
    console.error('[FeedbackDialog] ❌ 提交反馈失败:', error)
    showMessage('提交失败，请重试', 'error')
  } finally {
    isSubmittingFeedback.value = false
  }
}
</script>

<style lang="scss" scoped>
// 反馈对话框样式
.feedback-dialog-content {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.feedback-section {
  margin-bottom: 24px;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.feedback-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 8px;
}

.feedback-textarea-wrapper {
  position: relative;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  min-height: 200px;
  
  &:focus-within {
    border-color: #ab47bc;
  }
}

.feedback-textarea {
  margin-bottom: 0;

  :deep(.q-field__control) {
    background: transparent;
    border-radius: 0;
    min-height: auto;
    padding-bottom: 0;
    height: auto;
  }

  :deep(.q-field__inner) {
    padding-bottom: 0;
  }

  :deep(.q-field__native) {
    color: #1f2937;
    padding: 0;
    padding-bottom: 0;
  }

  :deep(textarea) {
    resize: none;
    padding-bottom: 0;
    background: transparent;
  }

  :deep(.q-field__outline) {
    display: none;
  }

  :deep(.q-field--focused .q-field__outline) {
    display: none;
  }
}

.feedback-image-upload {
  width: 100%;
  min-height: 80px;
  margin-top: 12px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #ffffff;
  position: relative;

  &:hover {
    border-color: #ab47bc;
    background: #faf5ff;
  }

  &:active {
    transform: scale(0.98);
  }
}

.feedback-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  width: 100%;
  height: 100%;
  min-height: 80px;
}

.feedback-image-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;

  img {
    max-width: 100%;
    max-height: 150px;
    border-radius: 8px;
    object-fit: contain;
  }
}

.feedback-image-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  backdrop-filter: blur(4px);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
}

.feedback-dialog-footer {
  padding: 20px 0 0 0;
  margin-top: auto;
  display: flex;
  justify-content: center;
}

.feedback-submit-btn {
  width: 100%;
  max-width: 400px;
  height: 48px;
  background: #ab47bc !important;
  color: white !important;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 600;
  text-transform: none;
  box-shadow: 0 2px 8px rgba(171, 71, 188, 0.3);
  transition: all 0.2s ease;

  &:hover {
    background: #9c27b0 !important;
    box-shadow: 0 4px 12px rgba(171, 71, 188, 0.4);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  :deep(.q-btn__content) {
    color: white;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .feedback-dialog-content {
    padding: 16px 20px;
  }

  .feedback-dialog-footer {
    padding: 16px 0 0 0;
  }
}
</style>

