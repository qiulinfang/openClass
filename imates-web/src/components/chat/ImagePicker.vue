<template>
  <div class="image-picker">
    <!-- 图片选择对话框 -->
    <q-dialog v-model="isPickerVisible" class="image-picker-dialog">
      <div class="picker-modal">
        <!-- 标题栏 -->
        <div class="picker-header">
          <div class="picker-title">选择图片</div>
          <div class="picker-close" @click="closeDialog">×</div>
        </div>
        
        <!-- 选项区域 -->
        <div class="picker-options">
          <!-- 相机选项 -->
          <div class="picker-option" @click="captureFromCamera">
            <q-icon name="camera_alt" size="48px" class="option-icon" />
            <span class="option-label">相机</span>
          </div>
          
          <!-- 相册选项 -->
          <div class="picker-option" @click="selectFromGallery">
            <q-icon name="photo_library" size="48px" class="option-icon" />
            <span class="option-label">相册</span>
          </div>
        </div>
      </div>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from '../../utils'
import { useImagePicker } from '../../composables/useImagePicker'
import { ImagePickerAdapterFactory } from '../../adapters/ImagePickerAdapterFactory'
import type { IImagePickerAdapter } from '../../adapters/IImagePickerAdapter'

// 使用全局图片选择器 composable
const { isPickerVisible, handleImageSelected, handleCancel } = useImagePicker()

// 获取适配器实例（根据环境自动选择 Android 或 Web 适配器）
// 注意：适配器是单例的，事件监听器在适配器构造函数中设置，不需要在组件中管理
const adapter: IImagePickerAdapter = ImagePickerAdapterFactory.getAdapter()

// 流程：用户点击X按钮 -> 关闭对话框 -> 取消Promise
const closeDialog = () => {
  isPickerVisible.value = false
  handleCancel()
}

// 流程：用户选择了拍照或相册 -> 关闭选择对话框 -> 使用适配器选择图片
const captureFromCamera = async () => {
  try {
    // 关闭选择对话框（不取消Promise，等待适配器返回结果）
    isPickerVisible.value = false
    
    // 使用适配器拍照（适配器会根据环境自动选择实现方式）
    const imageInfo = await adapter.captureFromCamera()
    
    if (imageInfo) {
      handleImageSelected(imageInfo)
    } else {
      // 用户取消了选择
      handleCancel()
    }
  } catch (error) {
    console.error('[ImagePicker.vue] ❌ 拍照功能异常:', error)
    showMessage(error instanceof Error ? error.message : '拍照功能异常', 'error')
    handleCancel()
  }
}

const selectFromGallery = async () => {
  try {
    // 关闭选择对话框（不取消Promise，等待适配器返回结果）
    isPickerVisible.value = false
    
    // 使用适配器选择图片（适配器会根据环境自动选择实现方式）
    const imageInfo = await adapter.selectFromGallery()
    
    if (imageInfo) {
      handleImageSelected(imageInfo)
    } else {
      // 用户取消了选择
      handleCancel()
    }
  } catch (error) {
    console.error('[ImagePicker.vue] ❌ 图片选择功能异常:', error)
    showMessage(error instanceof Error ? error.message : '图片选择功能异常', 'error')
    handleCancel()
  }
}


</script>

<style scoped>
/* 图片选择对话框样式 */
.image-picker-dialog :deep(.q-dialog__inner) {
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.picker-modal {
  background: #ffffff;
  border-radius: 16px;
  min-width: 320px;
  max-width: 400px;
  width: 90%;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

/* 标题栏 */
.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 16px 20px;
}

.picker-title {
  font-size: 18px;
  font-weight: 500;
  color: #333333;
}

.picker-close {
  font-size: 28px;
  color: #666666;
  cursor: pointer;
  line-height: 1;
  user-select: none;
  transition: color 0.2s ease;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.picker-close:hover {
  color: #333333;
}

/* 选项区域 */
.picker-options {
  display: flex;
  gap: 12px;
  padding: 0 20px 20px 20px;
}

.picker-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: #f5f5f5;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.picker-option:hover {
  background: #eeeeee;
}

.picker-option:active {
  background: #e0e0e0;
  transform: scale(0.98);
}

.option-icon {
  color: #9c27b0;
  margin-bottom: 8px;
}

.option-label {
  font-size: 14px;
  font-weight: 400;
  color: #333333;
  margin-top: 4px;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .picker-modal {
    background: #2a2a2a;
  }
  
  .picker-title {
    color: #e0e0e0;
  }
  
  .picker-close {
    color: #aaaaaa;
  }
  
  .picker-close:hover {
    color: #e0e0e0;
  }
  
  .picker-option {
    background: #3a3a3a;
  }
  
  .picker-option:hover {
    background: #444444;
  }
  
  .picker-option:active {
    background: #4a4a4a;
  }
  
  .option-label {
    color: #e0e0e0;
  }
}
</style>