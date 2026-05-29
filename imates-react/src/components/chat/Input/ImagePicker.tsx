import React, { useState } from 'react'
import { Modal } from '@/components/base/Modal'
import '@/components/chat/Input/ImagePicker.css'

export interface ImagePickerProps {
  onImageSelected?: (imageInfo: { path: string; width?: number; height?: number }) => void
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ onImageSelected }) => {
  const [isPickerVisible, setIsPickerVisible] = useState(false)

  const closeDialog = () => {
    setIsPickerVisible(false)
  }

  const captureFromCamera = async () => {
    setIsPickerVisible(false)
    // TODO: 使用 ImagePickerAdapter
    console.log('[ImagePicker] 拍照功能待实现')
  }

  const selectFromGallery = async () => {
    setIsPickerVisible(false)
    // TODO: 使用 ImagePickerAdapter
    console.log('[ImagePicker] 相册选择功能待实现')
  }

  return (
    <div className="image-picker">
      <Modal
        open={isPickerVisible}
        title="选择图片"
        onClose={closeDialog}
        width={400}
        height={260}
        showFooter={false}
      >
        <div className="picker-options">
          <div className="picker-option" onClick={captureFromCamera}>
            <svg className="option-icon" viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
            </svg>
            <span className="option-label">相机</span>
          </div>
          
          <div className="picker-option" onClick={selectFromGallery}>
            <svg className="option-icon" viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
              <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
            </svg>
            <span className="option-label">相册</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ImagePicker