import React, { useState } from 'react'
import { Dialog } from '../base/Dialog'
import { ScreenshotThumb } from '../display/ScreenshotThumb'
import './CameraUploadDialog.css'

export interface PhotoItem {
  index: number
  url: string
}

export interface QuestionSection {
  questionIndex: number
  questionNo: string
  items: PhotoItem[]
}

export interface CameraUploadDialogProps {
  open?: boolean
  photos?: PhotoItem[]
  onClose?: () => void
  onConfirm?: (photos: PhotoItem[]) => void
}

export const CameraUploadDialog: React.FC<CameraUploadDialogProps> = ({
  open = false,
  photos = [],
  onClose,
  onConfirm,
}) => {
  const [localPhotos, setLocalPhotos] = useState<PhotoItem[]>(photos)

  const groupedPhotoSections: QuestionSection[] = [
    {
      questionIndex: 0,
      questionNo: '1',
      items: localPhotos,
    },
  ]

  const openCamera = (questionIndex: number) => {
    console.log('[CameraUploadDialog] 打开相机', questionIndex)
  }

  const removePhoto = (index: number) => {
    setLocalPhotos(localPhotos.filter(p => p.index !== index))
  }

  const openPreview = (index: number) => {
    console.log('[CameraUploadDialog] 打开预览', index)
  }

  const handleCancel = () => {
    onClose?.()
  }

  const handleConfirm = () => {
    onConfirm?.(localPhotos)
  }

  if (!open) return null

  return (
    <Dialog open={open} title="上传作业" onClose={onClose}>
      <div className="camera-upload-content">
        <div className="photo-grid-section">
          <div className="question-sections">
            {groupedPhotoSections.map((section) => (
              <div key={section.questionIndex} className="question-section">
                <div className="question-title">第{section.questionNo}题</div>
                <div className="photo-grid">
                  {section.items.map((item) => (
                    <div key={item.index} className="photo-item">
                      <ScreenshotThumb
                        imageUrl={item.url}
                        showDelete
                        onClick={() => openPreview(item.index)}
                        onRemove={() => removePhoto(item.index)}
                      />
                    </div>
                  ))}
                  <div className="add-photo-btn" onClick={() => openCamera(section.questionIndex)}>
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="#999">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-outline" onClick={handleCancel}>取消</button>
          <button 
            className="btn-primary" 
            onClick={handleConfirm}
            disabled={localPhotos.length === 0}
          >
            确定上传
          </button>
        </div>
      </div>
    </Dialog>
  )
}

export default CameraUploadDialog
