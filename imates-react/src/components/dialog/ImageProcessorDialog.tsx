import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Modal from '../base/Modal'
import DrawingBoard from '../drawing/DrawingBoard'
import ImageCropper from '../base/ImageCropper'
import ScreenshotThumb from '../display/ScreenshotThumb'
import { showMessage } from '@/utils'
import type { AttachedScreenshot } from '@/types'
import './ImageProcessorDialog.css'

interface ScreenshotDrawingState {
  objects: any[]
  history: any[][]
  historyIndex: number
}

interface ImageProcessorDialogProps {
  open: boolean
  mode?: 'single' | 'multiple'
  initialShotId?: string
  existingScreenshots?: AttachedScreenshot[]
  drawingStatesFromParent?: Record<string, ScreenshotDrawingState>
  onConfirm?: (screenshots: AttachedScreenshot[], states: Record<string, ScreenshotDrawingState>) => void
  onAddMore?: (screenshots: AttachedScreenshot[], states: Record<string, ScreenshotDrawingState>) => void
  onCancel?: () => void
  onRemoveScreenshot?: (id: string) => void
  onClose?: () => void
}

const MAX_SCREENSHOTS = 3

export const ImageProcessorDialog: React.FC<ImageProcessorDialogProps> = ({
  open,
  mode = 'multiple',
  initialShotId = '',
  existingScreenshots = [],
  drawingStatesFromParent = {},
  onConfirm,
  onAddMore,
  onCancel,
  onRemoveScreenshot,
  onClose,
}) => {
  const [currentShotId, setCurrentShotId] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string>('')
  const [drawingStates, setDrawingStates] = useState<Record<string, ScreenshotDrawingState>>({})
  const [localScreenshots, setLocalScreenshots] = useState<AttachedScreenshot[]>([])
  const [isCropping, setIsCropping] = useState(false)
  
  const drawingBoardRef = useRef<any>(null)

  // 初始化逻辑
  useEffect(() => {
    if (!open) return

    setDrawingStates({ ...drawingStatesFromParent })
    
    const list = existingScreenshots.map(s => ({
      ...s,
      originalDataUrl: s.originalDataUrl || s.dataUrl
    }))
    setLocalScreenshots(list)

    const canUseInitialId = !!initialShotId && list.some(s => s.id === initialShotId)
    if (canUseInitialId) {
      setCurrentShotId(initialShotId)
      setPreviewImage(list.find(s => s.id === initialShotId)?.dataUrl || '')
    } else if (list.length > 0) {
      setCurrentShotId(list[0].id)
      setPreviewImage(list[0].dataUrl)
    } else {
      setCurrentShotId(null)
      setPreviewImage('')
    }
  }, [open, initialShotId, existingScreenshots, drawingStatesFromParent])

  // 加载画板数据
  useEffect(() => {
    if (currentShotId && drawingBoardRef.current) {
      const state = drawingStates[currentShotId]
      if (state && typeof drawingBoardRef.current.loadData === 'function') {
        drawingBoardRef.current.loadData(state)
      } else if (typeof drawingBoardRef.current.clearAll === 'function') {
        drawingBoardRef.current.clearAll()
      }
    }
  }, [currentShotId, drawingStates])

  const getOriginalImage = useCallback(() => {
    const currentShot = localScreenshots.find(s => s.id === currentShotId)
    return currentShot?.originalDataUrl || currentShot?.dataUrl || previewImage || ''
  }, [localScreenshots, currentShotId, previewImage])

  const saveCurrentState = useCallback(() => {
    if (!currentShotId || !drawingBoardRef.current) return

    try {
      if (typeof drawingBoardRef.current.saveData === 'function') {
        const data = drawingBoardRef.current.saveData()
        setDrawingStates(prev => ({
          ...prev,
          [currentShotId]: {
            objects: data.objects,
            history: data.history,
            historyIndex: data.historyIndex,
          }
        }))
      }

      if (typeof drawingBoardRef.current.exportToJpg === 'function') {
        const exportedImage = drawingBoardRef.current.exportToJpg(0.9)
        if (exportedImage) {
          setLocalScreenshots(prev => prev.map(s => 
            s.id === currentShotId ? { ...s, dataUrl: exportedImage } : s
          ))
        }
      }
    } catch (e) {
      console.warn('[ImageProcessorDialog] Save state failed:', e)
    }
  }, [currentShotId])

  const switchPreview = (id: string) => {
    if (id === currentShotId) return
    saveCurrentState()
    setCurrentShotId(id)
    const target = localScreenshots.find(s => s.id === id)
    setPreviewImage(target?.dataUrl || '')
  }

  const handleRemoveThumbnail = (id: string) => {
    setLocalScreenshots(prev => prev.filter(s => s.id !== id))
    setDrawingStates(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    if (currentShotId === id) {
      setCurrentShotId(null)
      setPreviewImage('')
    }
    onRemoveScreenshot?.(id)
  }

  const exportCurrentScreenshot = async (): Promise<AttachedScreenshot[] | null> => {
    if (!currentShotId) return null
    
    const currentShot = localScreenshots.find(s => s.id === currentShotId)
    if (!currentShot) {
      showMessage('截图数据丢失，请重新截图', 'error')
      return null
    }

    let finalImageData = previewImage || currentShot.dataUrl || ''
    if (drawingBoardRef.current && typeof drawingBoardRef.current.exportToJpg === 'function') {
      const exported = drawingBoardRef.current.exportToJpg(0.9)
      if (exported) finalImageData = exported
    }

    // 更新状态
    saveCurrentState()

    const size = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
      img.onerror = () => resolve({ width: 0, height: 0 })
      img.src = finalImageData
    })

    const shot: AttachedScreenshot = {
      id: currentShotId,
      dataUrl: finalImageData,
      originalDataUrl: getOriginalImage(),
      width: size.width,
      height: size.height,
    }

    return [shot]
  }

  const handleConfirm = async () => {
    const shots = await exportCurrentScreenshot()
    if (!shots) return

    const current = shots[0]
    const allShots = localScreenshots.map(s => (s.id === current.id ? current : s))
    onConfirm?.(allShots, drawingStates)
    onClose?.()
  }

  const handleAddMore = async () => {
    if (localScreenshots.length >= MAX_SCREENSHOTS) {
      showMessage(`最多只能添加${MAX_SCREENSHOTS}张截图`, 'warning')
      return
    }

    const shots = await exportCurrentScreenshot()
    if (!shots) return

    const current = shots[0]
    const allShots = localScreenshots.map(s => (s.id === current.id ? current : s))
    onAddMore?.(allShots, drawingStates)
  }

  const handleCropConfirm = (croppedDataUrl: string) => {
    setLocalScreenshots(prev => prev.map(s => 
      s.id === currentShotId ? { ...s, dataUrl: croppedDataUrl } : s
    ))
    setPreviewImage(croppedDataUrl)
    if (currentShotId) {
      setDrawingStates(prev => {
        const next = { ...prev }
        delete next[currentShotId]
        return next
      })
    }
    setIsCropping(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onClose?.()
  }

  return (
    <Modal
      open={open}
      title="你想问什么问题呢？"
      width={900}
      height={700}
      confirmText="给学伴"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      onClose={onClose}
    >
      <div className="screenshot-input-body">
        <div className="screenshot-editor">
          {previewImage ? (
            <DrawingBoard
              key={currentShotId}
              ref={drawingBoardRef}
              backgroundColor="transparent"
              onToolChange={(tool) => {
                if (tool === 'crop') setIsCropping(true)
              }}
            >
              {isCropping && (
                <ImageCropper
                  open={isCropping}
                  src={getOriginalImage()}
                  isInline={true}
                  showInfo={false}
                  onConfirm={handleCropConfirm}
                  onCancel={() => setIsCropping(false)}
                />
              )}
            </DrawingBoard>
          ) : (
            <div className="empty-placeholder">
              <span>暂无截图</span>
            </div>
          )}
        </div>

        {mode === 'multiple' && (
          <div className="screenshot-side-panel">
            <div className="side-panel-body">
              {localScreenshots.length > 0 ? (
                <div className="side-thumbs-list">
                  {localScreenshots.map(shot => (
                    <ScreenshotThumb
                      key={shot.id}
                      imageUrl={shot.dataUrl}
                      active={shot.id === currentShotId}
                      showDelete={true}
                      onClick={() => switchPreview(shot.id)}
                      onRemove={() => handleRemoveThumbnail(shot.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="side-empty-text">暂无可用截图</div>
              )}
            </div>
            {localScreenshots.length < MAX_SCREENSHOTS && (
              <div className="side-panel-footer">
                <button
                  type="button"
                  className="add-more-btn"
                  disabled={!currentShotId}
                  onClick={handleAddMore}
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ImageProcessorDialog
