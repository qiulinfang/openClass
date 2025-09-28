<template>
  <div class="feedback-view">
    <!-- 顶部导航栏 -->
    <div class="header">
      <q-btn
        flat
        round
        icon="arrow_back"
        @click="goBack"
        class="back-btn"
      />
      <h2 class="title">意见反馈</h2>
      <div class="placeholder"></div>
    </div>

    <!-- 反馈表单 -->
    <div class="feedback-form">
      <!-- 反馈描述 -->
      <div class="form-section">
        <label class="form-label">描述您遇到的问题</label>
        <q-input
          v-model="feedbackText"
          type="textarea"
          placeholder="请详细描述您遇到的问题，至少5个字..."
          :rows="6"
          outlined
          class="feedback-input"
          :error="feedbackError"
          :error-message="feedbackErrorMessage"
          @blur="validateFeedback"
        />
        <div class="char-count">{{ feedbackText.length }}/500</div>
      </div>

      <!-- 图片上传 -->
      <div class="form-section">
        <label class="form-label">添加截图（可选）</label>
        <div class="image-upload-area">
          <div v-if="!selectedImage" class="upload-placeholder" @click="selectImage">
            <q-icon name="add_a_photo" size="48px" color="grey-5" />
            <div class="upload-text">点击添加截图</div>
          </div>
          <div v-else class="image-preview">
            <img :src="imagePreview" alt="反馈截图" class="preview-image" />
            <div class="image-actions">
              <q-btn
                flat
                round
                icon="edit"
                size="sm"
                @click="editImage"
                class="action-btn"
              />
              <q-btn
                flat
                round
                icon="delete"
                size="sm"
                @click="removeImage"
                class="action-btn"
              />
            </div>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          @change="handleFileSelect"
          style="display: none"
        />
      </div>

      <!-- 提交按钮 -->
      <div class="submit-section">
        <q-btn
          :loading="isSubmitting"
          :disable="!canSubmit"
          @click="submitFeedback"
          class="submit-btn"
          color="primary"
          size="lg"
          rounded
        >
          {{ isSubmitting ? '提交中...' : '提交反馈' }}
        </q-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { apiService } from '@/services/api-service'
import { getUserInfo } from '@/utils/config/config-utils'

const router = useRouter()
const $q = useQuasar()

// 响应式数据
const feedbackText = ref('')
const selectedImage = ref<File | null>(null)
const imagePreview = ref('')
const isSubmitting = ref(false)
const feedbackError = ref(false)
const feedbackErrorMessage = ref('')
const fileInput = ref<HTMLInputElement>()

// 计算属性
const canSubmit = computed(() => {
  return feedbackText.value.trim().length >= 5 && !isSubmitting.value
})

// 验证反馈内容
const validateFeedback = () => {
  if (feedbackText.value.trim().length < 5) {
    feedbackError.value = true
    feedbackErrorMessage.value = '描述您遇到的问题，至少5个字'
    return false
  } else {
    feedbackError.value = false
    feedbackErrorMessage.value = ''
    return true
  }
}

// 选择图片
const selectImage = () => {
  fileInput.value?.click()
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    // 检查文件大小（限制5MB）
    if (file.size > 5 * 1024 * 1024) {
      $q.notify({
        type: 'negative',
        message: '图片大小不能超过5MB',
        position: 'top'
      })
      return
    }
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      $q.notify({
        type: 'negative',
        message: '请选择图片文件',
        position: 'top'
      })
      return
    }
    
    selectedImage.value = file
    
    // 创建预览
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

// 编辑图片
const editImage = () => {
  // 这里可以调用Android Bridge打开图片编辑器
  if (typeof window !== 'undefined' && window.AndroidBridge?.captureImageFromCamera) {
    window.AndroidBridge.captureImageFromCamera()
  } else {
    selectImage()
  }
}

// 删除图片
const removeImage = () => {
  selectedImage.value = null
  imagePreview.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 提交反馈
const submitFeedback = async () => {
  if (!validateFeedback()) {
    return
  }
  
  isSubmitting.value = true
  
  try {
    const userInfo = getUserInfo()
    const title = `${userInfo?.userName || '用户'}的反馈`
    
    // 与Android保持一致：只依赖HTTP状态码判断成功/失败
    // 如果HTTP状态码是2xx，axios不会抛出异常，直接进入成功逻辑
    await apiService.createFeedbackTicket(
      title,
      feedbackText.value.trim(),
      selectedImage.value || undefined
    )
    
    // HTTP状态码为2xx，表示成功
    $q.notify({
      type: 'positive',
      message: '感谢您的反馈！我们会尽快处理。',
      position: 'top',
      timeout: 3000
    })
    
    // 清空表单
    feedbackText.value = ''
    removeImage()
    
    // 延迟返回上一页
    setTimeout(() => {
      goBack()
    }, 1500)
    
  } catch (error) {
    // HTTP状态码非2xx或网络异常，表示失败
    console.error('提交反馈失败:', error)
    $q.notify({
      type: 'negative',
      message: error instanceof Error ? error.message : '提交失败，请重试',
      position: 'top'
    })
  } finally {
    isSubmitting.value = false
  }
}

// 返回上一页
const goBack = () => {
  router.back()
}

onMounted(() => {
  // 页面加载完成后的初始化
})
</script>

<style scoped>
.feedback-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.back-btn {
  color: white;
  font-size: 24px;
}

.title {
  color: white;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.placeholder {
  width: 40px;
}

.feedback-form {
  padding: 24px 20px;
  max-width: 600px;
  margin: 0 auto;
}

.form-section {
  margin-bottom: 32px;
}

.form-label {
  display: block;
  color: white;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
}

.feedback-input {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
}

.feedback-input :deep(.q-field__control) {
  border-radius: 12px;
}

.feedback-input :deep(.q-field__native) {
  color: #333;
  font-size: 16px;
  line-height: 1.5;
}

.char-count {
  text-align: right;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin-top: 8px;
}

.image-upload-area {
  background: rgba(255, 255, 255, 0.1);
  border: 2px dashed rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
}

.image-upload-area:hover {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.15);
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
}

.image-preview {
  position: relative;
  display: inline-block;
}

.preview-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
}

.image-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  padding: 4px;
}

.action-btn {
  color: white;
  background: rgba(255, 255, 255, 0.2);
}

.submit-section {
  text-align: center;
  margin-top: 40px;
}

.submit-btn {
  min-width: 200px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(45deg, #ff6b6b, #ee5a24);
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.6);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .feedback-form {
    padding: 20px 16px;
  }
  
  .header {
    padding: 12px 16px;
  }
  
  .title {
    font-size: 18px;
  }
}
</style>
