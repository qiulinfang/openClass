<template>
  <div class="image-picker">
    <!-- 图片选择对话框 -->
    <q-dialog v-model="isPickerVisible" class="gemini-card-dialog image-picker-dialog">
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { androidBridge } from '../../services/android-bridge'
import { showMessage } from '../../utils'
import { useImagePicker } from '../../composables/useImagePicker'

// 使用全局图片选择器 composable
const { isPickerVisible, handleImageSelected, handleCancel } = useImagePicker()

// 防重复发送标记
let isProcessingImage = false
const PROCESSING_TIMEOUT = 2000 // 2秒防重复时间

// 流程：用户点击X按钮 -> 关闭对话框 -> 取消Promise
const closeDialog = () => {
  console.log('[ImagePicker.vue] 🚪 closeDialog() - 用户点击X取消')
  isPickerVisible.value = false
  handleCancel()
}

// 流程：用户选择了拍照或相册 -> 关闭选择对话框 -> 等待原生返回结果
const closeDialogWithoutCancel = () => {
  console.log('[ImagePicker.vue] 🚪 closeDialogWithoutCancel() - 关闭对话框但不取消Promise')
  isPickerVisible.value = false
}

const captureFromCamera = async () => {
  console.log('[ImagePicker.vue] 📸 captureFromCamera() - 用户点击拍照')
  try {
    // 第1步：关闭选择对话框（不取消Promise，等待原生返回）
    closeDialogWithoutCancel()
    
    // 第2步：调用原生拍照（原生会在拍照完成后触发事件）
    const result = androidBridge.captureImageFromCamera()
    console.log('[ImagePicker.vue] 📱 原生拍照调用结果:', result)
    
    if (!result.success) {
      console.error('[ImagePicker.vue] ❌ 启动相机失败')
      showMessage(result.message || '启动相机失败', 'error')
      handleCancel()
    } else {
      console.log('[ImagePicker.vue] ⏳ 等待原生拍照完成...')
    }
    // 注意：不需要显示加载状态，因为原生会打开相机界面
    // 拍照完成后，原生会触发 nativeImageCaptureResult 事件
    // 然后 processImageResult 会调用 handleImageSelected 完成 Promise
  } catch (error) {
    console.error('[ImagePicker.vue] ❌ 拍照功能异常:', error)
    showMessage('拍照功能异常', 'error')
    handleCancel()
  }
}

const selectFromGallery = async () => {
  console.log('[ImagePicker.vue] 🖼️ selectFromGallery() - 用户点击相册')
  try {
    // 第1步：关闭选择对话框（不取消Promise，等待原生返回）
    closeDialogWithoutCancel()
    
    // 第2步：调用原生相册（原生会在选择完成后触发事件）
    const result = androidBridge.selectImageFromGallery()
    console.log('[ImagePicker.vue] 📱 原生相册调用结果:', result)
    
    if (!result.success) {
      console.error('[ImagePicker.vue] ❌ 打开相册失败')
      showMessage(result.message || '打开相册失败', 'error')
      handleCancel()
    } else {
      console.log('[ImagePicker.vue] ⏳ 等待原生相册选择...')
    }
    // 注意：不需要显示加载状态，因为原生会打开相册界面
    // 选择完成后，原生会触发 nativeImagePickResult 事件
    // 然后 processImageResult 会调用 handleImageSelected 完成 Promise
  } catch (error) {
    console.error('[ImagePicker.vue] ❌ 图片选择功能异常:', error)
    showMessage('图片选择功能异常', 'error')
    handleCancel()
  }
}


// 统一的图片处理函数
// 处理原生通过事件返回的图片数据
const processImageResult = async (imageData: {
  success: boolean
  filePath?: string
  width?: number
  height?: number
  fileSize?: number
  base64DataUrl?: string
}, source: 'camera' | 'gallery') => {
  console.log('[ImagePicker.vue] 📦 processImageResult() 开始处理', {
    source,
    success: imageData.success,
    hasFilePath: !!imageData.filePath,
    hasBase64DataUrl: !!imageData.base64DataUrl,
    isProcessing: isProcessingImage
  })
  
  if (isProcessingImage) {
    console.warn('[ImagePicker.vue] ⚠️ 正在处理中，跳过重复处理')
    return
  }
  
  isProcessingImage = true
  
  try {
  const { success, filePath, width, height, fileSize, base64DataUrl } = imageData
  
  if (success && base64DataUrl) {
    console.log('[ImagePicker.vue] ✅ 图片数据完整，开始构造图片信息')
    // 流程：构造图片信息 -> 通过全局composable返回结果 -> 显示成功提示
    // Android端已直接返回base64DataUrl，无需手动拼接
    
    const imageInfo = {
      filePath: filePath || '',
      width: width || 0,
      height: height || 0,
      fileSize: fileSize || 0,
      base64DataUrl: base64DataUrl
    }
      
      console.log('[ImagePicker.vue] 🎯 调用 handleImageSelected()', {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrlLength: base64DataUrl.length
      })
      handleImageSelected(imageInfo)
    } else if (success && !base64DataUrl) {
      // 原生端返回成功但没有base64DataUrl数据
      console.error('[ImagePicker.vue] ❌ 原生端未返回base64DataUrl数据')
      showMessage('图片处理失败：原生端未返回base64DataUrl数据', 'error')
      handleCancel()
    } else {
      // 用户在原生界面取消了选择
      console.log('[ImagePicker.vue] 🚫 用户在原生界面取消了选择')
      handleCancel()
    }
  } catch (error) {
    console.error('[ImagePicker.vue] ❌ 图片处理失败:', error)
    showMessage('图片处理失败', 'error')
    handleCancel()
  }
  
  // 重置处理标记
  setTimeout(() => {
    console.log('[ImagePicker.vue] 🔄 重置处理标记')
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

// 流程：组件挂载时添加事件监听 -> 组件卸载时移除事件监听
// 目的：全局单例模式，确保事件监听器始终存在以接收原生返回结果
onMounted(() => {
  if (typeof window === 'undefined') {
    return
  }

  // 第1步：添加原生事件监听器
  console.log('[ImagePicker.vue] 📡 添加原生事件监听器')
  window.addEventListener('nativeImagePickResult', handleNativeImagePickResult)
  window.addEventListener('nativeImageCaptureResult', handleNativeImageCaptureResult)
})

// 第2步：组件卸载时清理事件监听器
onUnmounted(() => {
  console.log('[ImagePicker.vue] 🧹 清理原生事件监听器')
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