import React from 'react'
import { Modal } from '@/components/base/Modal'
import { showMessage } from '@/utils'
import { useImagePicker } from '@/hooks/useImagePicker'
import { ImagePickerAdapterFactory } from '@/adapters/ImagePickerAdapterFactory'
import '@/components/chat/Input/ImagePicker.css'

export const ImagePicker: React.FC = () => {
  const { isPickerVisible, setIsPickerVisible, handleImageSelected, handleCancel } = useImagePicker()
  const adapter = ImagePickerAdapterFactory.getAdapter()

  const closeDialog = () => {
    setIsPickerVisible(false)
    handleCancel()
  }

  const captureFromCamera = async () => {
    try {
      setIsPickerVisible(false)
      const imageInfo = await adapter.captureFromCamera()
      if (imageInfo) {
        handleImageSelected(imageInfo)
      } else {
        handleCancel()
      }
    } catch (error) {
      console.error('[ImagePicker] 拍照功能异常:', error)
      showMessage(error instanceof Error ? error.message : '拍照功能异常', 'error')
      handleCancel()
    }
  }

  const selectFromGallery = async () => {
    try {
      setIsPickerVisible(false)
      const imageInfo = await adapter.selectFromGallery()
      if (imageInfo) {
        handleImageSelected(imageInfo)
      } else {
        handleCancel()
      }
    } catch (error) {
      console.error('[ImagePicker] 图片选择功能异常:', error)
      showMessage(error instanceof Error ? error.message : '图片选择功能异常', 'error')
      handleCancel()
    }
  }

  return (
    <div className="image-picker">
      <Modal
        open={isPickerVisible}
        title="选择图片"
        onClose={closeDialog}
        initialWidth={400}
        initialHeight={260}
        minWidth={320}
        minHeight={220}
        showFooter={false}
        closeOnOverlayClick={true}
        zIndex={111111}
      >
        <div className="picker-options">
          <div className="picker-option" onClick={captureFromCamera}>
            <svg className="option-icon" viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-2c3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6 2.69 6 6 6z"/>
            </svg>
            <span className="option-label">相机</span>
          </div>
          
          <div className="picker-option" onClick={selectFromGallery}>
            <svg className="option-icon" viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
            </svg>
            <span className="option-label">相册</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ImagePicker
