import React, { useState, useMemo, useEffect } from 'react'
import { Modal } from '@/components/base/Modal'
import { Button } from '@/components/base/Button'
import { ScreenshotThumb } from '@/components/display/ScreenshotThumb'
import { ImageViewer } from '@/components/display/ImageViewer'
import { useImagePicker } from '@/hooks/useImagePicker'
import '@/components/dialog/CameraUploadDialog.css'

export interface CameraUploadDialogProps {
  open?: boolean
  initialPhotos?: string[]
  questionIndexMap?: number[]
  onClose?: () => void
  onConfirm?: (photos: string[], questionIndexMap?: number[]) => void
}

export const CameraUploadDialog: React.FC<CameraUploadDialogProps> = ({
  open = false,
  initialPhotos = [],
  questionIndexMap = [],
  onClose,
  onConfirm,
}) => {
  const [photos, setPhotos] = useState<string[]>([])
  const [localQuestionIndexMap, setLocalQuestionIndexMap] = useState<number[]>([])
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const { pickImage } = useImagePicker()

  useEffect(() => {
    if (open) {
      setPhotos(initialPhotos ? [...initialPhotos] : [])
      setLocalQuestionIndexMap(Array.isArray(questionIndexMap) ? [...questionIndexMap] : [])
      setPreviewVisible(false)
      setPreviewIndex(null)
    }
  }, [open, initialPhotos, questionIndexMap])

  const previewImages = useMemo(() => {
    return photos.map((url, index) => ({
      url,
      alt: `照片 ${index + 1}`
    }))
  }, [photos])

  const groupedPhotoSections = useMemo(() => {
    if (!photos.length) return []

    const mapUsable = Array.isArray(localQuestionIndexMap) && localQuestionIndexMap.length === photos.length
    const buckets = new Map<number, { url: string; index: number }[]>()

    photos.forEach((url, index) => {
      const qIndex = mapUsable ? (localQuestionIndexMap[index] ?? index) : index
      if (!buckets.has(qIndex)) buckets.set(qIndex, [])
      buckets.get(qIndex)!.push({ url, index })
    })

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([questionIndex, items]) => ({
        questionIndex,
        questionNo: questionIndex + 1,
        items,
      }))
  }, [photos, localQuestionIndexMap])

  const openCamera = async (targetQuestionIndex?: number) => {
    try {
      const imageInfo = await pickImage()
      if (!imageInfo) return

      if (imageInfo.base64DataUrl) {
        setPhotos(prev => [...prev, imageInfo.base64DataUrl!])

        if (typeof targetQuestionIndex === 'number') {
          setLocalQuestionIndexMap(prev => [...prev, targetQuestionIndex])
        } else {
          const lastQIndex = localQuestionIndexMap.length ? Math.max(...localQuestionIndexMap) : 0
          setLocalQuestionIndexMap(prev => [...prev, lastQIndex])
        }
      } else {
        console.error('[CameraUploadDialog] ImagePicker 返回的数据缺少 base64DataUrl')
      }
    } catch (error) {
      console.error('[CameraUploadDialog] 打开相册/选择图片失败:', error)
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
    setLocalQuestionIndexMap(prev => {
      if (prev.length > index) {
        const next = [...prev]
        next.splice(index, 1)
        return next
      }
      return prev
    })
  }

  const openPreview = (index: number) => {
    if (!photos[index]) return
    setPreviewIndex(index)
    setPreviewVisible(true)
  }

  const handleCancel = () => {
    onClose?.()
  }

  const handleConfirm = () => {
    if (photos.length === 0) return
    onConfirm?.([...photos], [...localQuestionIndexMap])
    onClose?.()
  }

  return (
    <>
      <Modal
        open={open}
        title="上传作业"
        fullscreen
        initialWidth={600}
        initialHeight={500}
        minWidth={400}
        minHeight={350}
        closeOnOverlayClick={false}
        titleAlign="left"
        headerBackgroundColor="#ffffff"
        onClose={onClose}
      >
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
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dialog-footer">
            <Button
              label="取消"
              variant="outline"
              onClick={handleCancel}
            />
            <Button
              label="确定上传"
              variant="primary"
              disabled={photos.length === 0}
              onClick={handleConfirm}
            />
          </div>
        </div>
      </Modal>

      <ImageViewer
        open={previewVisible}
        images={previewImages}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewVisible(false)}
        onChange={(index) => setPreviewIndex(index)}
      />
    </>
  )
}

export default CameraUploadDialog
