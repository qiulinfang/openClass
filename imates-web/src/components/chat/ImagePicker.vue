<template>
  <div class="image-picker">
    <!-- 图片选择对话框：使用可拖拽对话框，尺寸与原来 q-dialog 模态宽度接近 -->
    <DraggableDialog
      v-model="isPickerVisible"
      title="选择图片"
      :initialWidth="400"
      :initialHeight="260"
      :minWidth="320"
      :minHeight="220"
      :showFooter="false"
      :closeOnOverlayClick="true"
      :zIndex="111111"
    >
      <!-- 选项区域：只保留相机/相册两个选项 -->
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
    </DraggableDialog>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from '../../utils'
import { useImagePicker } from '../../composables/useImagePicker'
import { ImagePickerAdapterFactory } from '../../adapters/ImagePickerAdapterFactory'
import type { IImagePickerAdapter } from '../../adapters/IImagePickerAdapter'
import DraggableDialog from '@/components/DraggableDialog.vue'

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
/* 选项区域 */
.picker-options {
  display: flex;
  gap: 12px;
  padding: 20px;
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