<template>
  <Modal
    v-model="localVisible"
    title="上传作业"
    :initial-width="600"
    :initial-height="500"
    :min-width="400"
    :min-height="350"
    :close-on-overlay-click="false"
    title-align="left"
    header-background-color="#ffffff"
  >
    <div class="camera-upload-content">
      <!-- 照片网格区域 -->
      <div class="photo-grid-section">
        <div class="photo-grid">
          <!-- 已上传的照片 -->
          <div
            v-for="(photo, index) in photos"
            :key="index"
            class="photo-item"
          >
            <ScreenshotThumb
              :image-url="photo"
              :show-delete="true"
              @click="openPreview(index)"
              @remove="removePhoto(index)"
            />
          </div>
          
          <!-- 添加照片按钮 -->
          <div class="add-photo-btn" @click="openCamera">
            <q-icon name="add" size="32px" color="grey-5" />
          </div>
        </div>
      </div>

      <!-- 按钮区域 -->
      <div class="dialog-footer">
        <CommonActionButton
          label="取消"
          variant="outline"
          @click="handleCancel"
        />
        <CommonActionButton
          label="确定上传"
          variant="primary"
          :disabled="photos.length === 0"
          @click="handleConfirm"
        />
      </div>
    </div>

    <!-- 图片预览：直接使用 ImageViewer（内部 q-dialog 会 Teleport 到 body） -->
    <ImageViewer
      v-model="previewVisible"
      :image-url="currentPreviewPhoto"
    />
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Modal from '@/components/base/Modal.vue'
import CommonActionButton from '@/components/base/Button.vue'
import ScreenshotThumb from '@/components/ScreenshotThumb.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import { useImagePicker } from '@/composables/useImagePicker'
import { showMessage } from '@/utils'

interface Props {
  modelValue: boolean
  // 初始照片列表（用于白板上传等场景）
  initialPhotos?: string[]
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', photos: string[]): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 文件输入引用 
const fileInputRef = ref<HTMLInputElement | null>(null)

// 照片列表（base64 格式）
const photos = ref<string[]>([])

// 预览状态
const previewVisible = ref(false)
const previewIndex = ref<number | null>(null)

const currentPreviewPhoto = computed(() => {
  if (previewIndex.value === null) return ''
  return photos.value[previewIndex.value] || ''
})

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// 监听对话框打开，初始化状态
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      // 如果有初始照片，使用初始照片；否则清空
      photos.value = props.initialPhotos ? [...props.initialPhotos] : []
      // 重置预览状态
      previewVisible.value = false
      previewIndex.value = null
    }
  }
)

// 全局图片选择器（调起 ImagePicker 组件）
const { pickImage } = useImagePicker()

// 打开图片选择器（相册 / 拍照）
const openCamera = async () => {
  try {
    const imageInfo = await pickImage()

    // 用户取消
    if (!imageInfo) {
      return
    }

    if (imageInfo.base64DataUrl) {
      photos.value.push(imageInfo.base64DataUrl)
    } else {
      console.error('[CameraUploadDialog] ImagePicker 返回的数据缺少 base64DataUrl')
      showMessage('选择图片失败，请重试', 'error')
    }
  } catch (error) {
    console.error('[CameraUploadDialog] 打开相册/选择图片失败:', error)
    showMessage('选择图片失败，请重试', 'error')
  }
}

// 打开预览
const openPreview = (index: number) => {
  if (!photos.value[index]) return
  previewIndex.value = index
  previewVisible.value = true
}

// 关闭预览
const closePreview = () => {
  previewVisible.value = false
  previewIndex.value = null
}

// 移除照片
const removePhoto = (index: number) => {
  photos.value.splice(index, 1)
}

// 确定按钮
const handleConfirm = () => {
  if (photos.value.length === 0) return
  
  emit('confirm', [...photos.value])
  localVisible.value = false
}

// 取消按钮
const handleCancel = () => {
  emit('cancel')
  localVisible.value = false
}
</script>

<style lang="scss" scoped>
.camera-upload-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 16px 16px 16px;
  gap: 16px;
}

.photo-grid-section {
  flex: 1;
  overflow-y: auto;
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.photo-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: #e0e0e0;
}

.add-photo-btn {
  aspect-ratio: 1;
  border-radius: 8px;
  border: 2px dashed #d0d0d0;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  
  &:hover {
    border-color: #6e55ff;
    background: rgba(110, 85, 255, 0.05);
    
    :deep(.q-icon) {
      color: #6e55ff !important;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
  padding-top: 4px;
}
</style>
