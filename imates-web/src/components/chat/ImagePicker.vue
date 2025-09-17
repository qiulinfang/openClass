<template>
  <div class="image-picker">
    <!-- 图片选择对话框 -->
    <q-dialog v-model="showDialog" class="gemini-card-dialog image-picker-dialog">
      <q-card class="picker-card">
        <q-card-section class="picker-header">
          <div class="text-h6">选择图片</div>
          <q-btn
            flat
            round
            dense
            icon="close"
            @click="closeDialog"
          />
        </q-card-section>
        
        <q-card-section class="picker-options">
          <div class="option-grid">
            <!-- 拍照选项 -->
            <div class="picker-option" @click="captureFromCamera">
              <q-icon name="camera_alt" size="32px" color="primary" />
              <span class="option-label">拍照</span>
            </div>
            
            <!-- 相册选项 -->
            <div class="picker-option" @click="selectFromGallery">
              <q-icon name="photo_library" size="32px" color="primary" />
              <span class="option-label">从相册选择</span>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
    

    
    <!-- 加载对话框 -->
    <q-dialog v-model="showLoading" persistent>
      <q-card class="loading-card">
        <q-card-section class="text-center">
          <q-spinner-dots color="primary" size="40px" />
          <div class="loading-text">{{ loadingText }}</div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { androidBridge } from '../../services/android-bridge'
import { uriToBase64DataUrl } from '../../utils/common/imageUtils'
import type { ImageData } from '../../types'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'image-selected': [imageInfo: ImageData]
}>()

const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const showLoading = ref(false)
const loadingText = ref('处理中...')

// 防重复发送标记
let isProcessingImage = false
const PROCESSING_TIMEOUT = 2000 // 2秒防重复时间

const closeDialog = () => {
  showDialog.value = false
}

const captureFromCamera = async () => {
  try {
    showLoading.value = true
    loadingText.value = '启动相机...'
    
    const result = androidBridge.captureImageFromCamera()
    
    if (result.success) {
      closeDialog()
      // 相机启动成功，等待回调
    } else {
      androidBridge.showToast(result.message || '启动相机失败')
      showLoading.value = false
    }
  } catch (error) {
    androidBridge.showToast('拍照功能异常')
    showLoading.value = false
  }
}

const selectFromGallery = async () => {
  try {
    showLoading.value = true
    loadingText.value = '打开相册...'
    
    const result = androidBridge.selectImageFromGallery()
    
    if (result.success) {
      closeDialog()
      // 相册打开成功，等待回调
    } else {
      androidBridge.showToast(result.message || '打开相册失败')
      showLoading.value = false
    }
  } catch (error) {
    androidBridge.showToast('图片选择功能异常')
    showLoading.value = false
  }
}


// 统一的图片处理函数
const processImageResult = async (imageData: any, source: 'camera' | 'gallery') => {
  if (isProcessingImage) {
    return
  }
  
  isProcessingImage = true
  showLoading.value = false
  
  try {
    const { success, filePath, imageUri, width, height, fileSize } = imageData
    const uri = filePath || imageUri
    
    if (success && uri) {
      
      // 转换为Base64 Data URL（用于API请求）
      const base64DataUrl = await uriToBase64DataUrl(uri)
      
      // 构造图片信息，同时包含用于渲染的原始filePath和用于API请求的base64DataUrl
      const imageInfo: ImageData & { base64DataUrl?: string } = {
        filePath: uri, // 保留原始URI用于本地渲染
        width: width || 0,
        height: height || 0,
        fileSize: fileSize || 0,
        base64DataUrl: base64DataUrl // 添加Base64 Data URL用于API请求
      }
      
      emit('image-selected', imageInfo)
      androidBridge.showToast(`${source === 'camera' ? '拍照' : '图片选择'}成功并发送`)
    } else {
      androidBridge.showToast(`${source === 'camera' ? '拍照' : '图片选择'}已取消`)
    }
  } catch (error) {
    androidBridge.showToast('图片处理失败')
  }
  
  // 重置处理标记
  setTimeout(() => {
    isProcessingImage = false
  }, PROCESSING_TIMEOUT)
}

// 处理原生图片选择结果
const handleNativeImagePickResult = async (event: Event) => {
  const customEvent = event as CustomEvent
  await processImageResult(customEvent.detail, 'gallery')
}

// 处理原生拍照结果
const handleNativeImageCaptureResult = async (event: Event) => {
  const customEvent = event as CustomEvent
  await processImageResult(customEvent.detail, 'camera')
}

// 生命周期钩子
onMounted(() => {
  
  // 使用统一的事件监听机制
  if (typeof window !== 'undefined') {
    window.addEventListener('nativeImagePickResult', handleNativeImagePickResult)
    window.addEventListener('nativeImageCaptureResult', handleNativeImageCaptureResult)
  }
})

onUnmounted(() => {
  
  // 清理事件监听器
  if (typeof window !== 'undefined') {
    window.removeEventListener('nativeImagePickResult', handleNativeImagePickResult)
    window.removeEventListener('nativeImageCaptureResult', handleNativeImageCaptureResult)
  }
})


</script>

<style scoped>
@import '../../styles/gemini-dialogs.scss';
/* 图片选择对话框样式 */
.image-picker-dialog .q-dialog__inner {
  padding: 20px;
}

.picker-card {
  min-width: 300px;
  max-width: 400px;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.picker-options {
  padding: 20px;
}

.option-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.picker-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafafa;
}

.picker-option:hover {
  border-color: #2196f3;
  background: #f3f8ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15);
}

.option-label {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}



/* 加载对话框样式 */
.loading-card {
  min-width: 200px;
  padding: 20px;
}

.loading-text {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .picker-header {
    border-bottom-color: #4a4a4a;
  }
  
  .picker-option {
    border-color: #4a4a4a;
    background: #3a3a3a;
  }
  
  .picker-option:hover {
    border-color: #667eea;
    background: #404040;
  }
  
  .option-label {
    color: #e0e0e0;
  }
  
  .loading-text {
    color: #aaa;
  }
}
</style>