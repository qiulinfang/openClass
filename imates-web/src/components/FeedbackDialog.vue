<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="Hello, 给出你的建议吧~"
    :initial-width="600"
    :initial-height="560"
    :min-width="400"
    :min-height="500"
    title-align="left"
    header-background-color="#ffffff"
    class="feedback-dialog"
  >
    <div class="feedback-dialog-content">
      <!-- 问题反馈区域 -->
      <div class="feedback-section">
        <label class="feedback-label">
          请反馈你在使用中遇到的问题(点击图片可与编辑):
        </label>
        <div class="feedback-textarea-wrapper feedback-textarea-wrapper-with-image">
          <div class="feedback-textarea-container">
            <q-input
              v-model="feedbackForm.problem"
              type="textarea"
              class="feedback-textarea"
              rows="4"
              borderless
              filled
            />
            <!-- 图片上传区域 - 定位在左下角 -->
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
                <q-icon name="add" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新功能建议区域 -->
      <div class="feedback-section">
        <label class="feedback-label">
          你还希望有哪些新功能?(选填)
        </label>
        <div class="feedback-textarea-wrapper">
          <div class="feedback-textarea-container">
            <q-input
              v-model="feedbackForm.suggestion"
              type="textarea"
              class="feedback-textarea"
              rows="4"
              borderless
              filled
            />
          </div>
        </div>
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
.feedback-dialog {
  // 第1步：覆盖标题样式，使其更大更粗
  :deep(.text-h6) {
    font-size: 24px !important;
    font-weight: 700 !important;
    color: #1f2937 !important;
  }

  // 移除 header 底部边框
  :deep(.dialog-header-section) {
    border-bottom: none !important;
  }
}

.feedback-dialog-content {
  padding: 20px 14px;
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
  // 第2步：标签样式
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 8px;
}

// 第3步：文本输入区域容器
.feedback-textarea-wrapper {
  position: relative;
  background: #f7f7f7;
  border-radius: 8px;
  min-height: 120px;
}

.feedback-textarea-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 120px;
  padding: 12px;
}

// 第6步：带图片上传的输入区域需要额外的底部空间
.feedback-textarea-wrapper-with-image .feedback-textarea-container {
  padding-bottom: 72px;
}

.feedback-textarea {
  margin-bottom: 0;
  width: 100%;

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

  :deep(.q-field__bottom) {
    display: none;
  }

  :deep(.q-field__messages) {
    display: none;
  }

  :deep(.q-field__control::after) {
    display: none;
  }

  :deep(.q-field__control::before) {
    display: none;
  }

  :deep(.q-field__control-container) {
    border: none !important;
  }

  :deep(.q-field__control-container::after) {
    display: none !important;
  }

  :deep(.q-field) {
    border: none !important;
    border-bottom: none !important;
  }

  :deep(.q-field__wrapper) {
    border: none !important;
    border-bottom: none !important;
  }

  :deep(.q-field--filled .q-field__control) {
    border: none !important;
    border-bottom: none !important;
  }

  :deep(.q-field--borderless .q-field__control) {
    border: none !important;
    border-bottom: none !important;
  }
}

// 第4步：图片上传区域 - 定位在左下角，约60px x 60px
.feedback-image-upload {
  position: absolute;
  left: 12px;
  bottom: 12px;
  width: 60px;
  height: 60px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

  &:hover {
    border-color: #8A63FF;
    background: #faf5ff;
    box-shadow: 0 2px 6px rgba(138, 99, 255, 0.15);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0) scale(0.98);
    box-shadow: 0 1px 3px rgba(138, 99, 255, 0.1);
  }
}

.feedback-image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  width: 100%;
  height: 100%;

  .q-icon {
    font-size: 28px;
    transition: all 0.2s ease;
  }
}

// hover 时图标颜色变化
.feedback-image-upload:hover .feedback-image-placeholder .q-icon {
  color: #8A63FF;
}

.feedback-image-preview {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;

  img {
    max-width: 100%;
    max-height: 100%;
    border-radius: 6px;
    object-fit: cover;
  }
}

.feedback-image-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  backdrop-filter: blur(4px);

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
}

.feedback-dialog-footer {
  padding: 20px 0 0 0;
  display: flex;
  justify-content: center;
}

// 第5步：提交按钮样式 - 紫色背景，约100px宽，40px高，圆角20-25px
.feedback-submit-btn {
  width: 100px;
  height: 40px;
  background: #8A63FF !important;
  color: white !important;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  text-transform: none;
  box-shadow: 0 2px 8px rgba(138, 99, 255, 0.3);
  transition: all 0.2s ease;

  &:hover {
    background: #7A53EF !important;
    box-shadow: 0 4px 12px rgba(138, 99, 255, 0.4);
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

