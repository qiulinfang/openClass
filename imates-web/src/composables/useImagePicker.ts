import { ref } from 'vue'
import type { ImageData } from '../types'

// 全局单例状态
const isPickerVisible = ref(false)
let resolveCallback: ((imageInfo: ImageData | null) => void) | null = null

/**
 * 全局图片选择器 Composable
 * 提供统一的图片选择 API，确保全局只有一个 ImagePicker 实例
 */
export function useImagePicker() {
  // 流程：显示图片选择器 -> 等待用户选择 -> 返回选择结果
  const pickImage = (): Promise<ImageData | null> => {
    console.log('[ImagePicker] 🎬 pickImage() 开始 - 创建新Promise')
    return new Promise((resolve) => {
      // 第1步：保存 resolve 回调
      resolveCallback = resolve
      console.log('[ImagePicker] 📝 resolve回调已保存')
      
      // 第2步：显示选择器对话框
      isPickerVisible.value = true
      console.log('[ImagePicker] 📂 对话框已显示 - isPickerVisible = true')
    })
  }

  // 流程：接收图片选择结果 -> 调用 resolve 返回结果
  // 注意：不负责关闭对话框，由 ImagePicker 组件自行管理 UI 状态
  const handleImageSelected = (imageInfo: ImageData) => {
    console.log('[ImagePicker] ✅ handleImageSelected() 被调用', {
      filePath: imageInfo.filePath,
      hasResolveCallback: !!resolveCallback
    })
    if (resolveCallback) {
      resolveCallback(imageInfo)
      console.log('[ImagePicker] 🎉 Promise已resolve - 返回图片数据')
      resolveCallback = null
    } else {
      console.error('[ImagePicker] ❌ resolveCallback为null，Promise已经结束！')
    }
  }

  // 流程：处理取消操作 -> 返回 null
  // 注意：不负责关闭对话框，由 ImagePicker 组件自行管理 UI 状态
  const handleCancel = () => {
    console.log('[ImagePicker] ❌ handleCancel() 被调用', {
      hasResolveCallback: !!resolveCallback
    })
    if (resolveCallback) {
      resolveCallback(null)
      console.log('[ImagePicker] 🚫 Promise已resolve(null) - 用户取消')
      resolveCallback = null
    } else {
      console.warn('[ImagePicker] ⚠️ resolveCallback为null，Promise已经结束')
    }
  }

  return {
    isPickerVisible,
    pickImage,
    handleImageSelected,
    handleCancel
  }
}

