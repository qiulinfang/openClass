import { useCallback } from 'react'
import type { ChatImageData } from '@/stores/utils/chatStoreUtils'
import { useUIStore } from '@/stores/uiStore'

let resolveCallback: ((imageInfo: ChatImageData | null) => void) | null = null

/**
 * 全局图片选择器 Hook
 * 提供统一的图片选择 API，确保全局只有一个 ImagePicker 实例
 */
export function useImagePicker() {
  const isPickerVisible = useUIStore((state) => state.isImagePickerVisible)
  const setVisible = useUIStore((state) => state.setImagePickerVisible)

  // 流程：显示图片选择器 -> 等待用户选择 -> 返回选择结果
  const pickImage = useCallback((): Promise<ChatImageData | null> => {
    return new Promise((resolve) => {
      // 保存 resolve 回调
      resolveCallback = resolve
      // 显示选择器对话框
      setVisible(true)
    })
  }, [setVisible])

  // 流程：接收图片选择结果 -> 调用 resolve 返回结果
  const handleImageSelected = useCallback((imageInfo: ChatImageData) => {
    if (resolveCallback) {
      resolveCallback(imageInfo)
      resolveCallback = null
    } else {
      console.error('[ImagePicker] ❌ resolveCallback为null，Promise已经结束！')
    }
  }, [])

  // 流程：处理取消操作 -> 返回 null
  const handleCancel = useCallback(() => {
    if (resolveCallback) {
      resolveCallback(null)
      resolveCallback = null
    } else {
      console.warn('[ImagePicker] ⚠️ resolveCallback为null，Promise已经结束')
    }
  }, [])

  return {
    isPickerVisible,
    setIsPickerVisible: setVisible,
    pickImage,
    handleImageSelected,
    handleCancel
  }
}
