import React, { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import './ImageCropper.css'

export interface ImageCropperProps {
  open: boolean
  src: string
  hintText?: string
  quality?: number
  isInline?: boolean
  onConfirm?: (croppedDataUrl: string) => void
  onCancel?: () => void
  onRetake?: () => void
  onClose?: () => void
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  open,
  src,
  hintText = '在中间区域拖动框选题目',
  quality = 0.9,
  isInline = false,
  onConfirm,
  onCancel,
  onRetake,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const imgEl = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!open || !src) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgEl.current = img
      setImageLoaded(true)
      setCropRect(null)
    }
    img.src = src
  }, [open, src])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDragStart({ x, y })
    setIsDragging(true)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const width = Math.abs(x - dragStart.x)
    const height = Math.abs(y - dragStart.y)
    const cropX = Math.min(x, dragStart.x)
    const cropY = Math.min(y, dragStart.y)

    if (width > 10 && height > 10) {
      setCropRect({ x: cropX, y: cropY, width, height })
    }
  }, [isDragging, dragStart])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleRetake = () => {
    setCropRect(null)
    onRetake?.()
  }

  const handleConfirm = () => {
    const canvas = canvasRef.current
    const img = imgEl.current
    if (!canvas || !img || !cropRect) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const croppedCanvas = document.createElement('canvas')
    croppedCanvas.width = cropRect.width
    croppedCanvas.height = cropRect.height
    const croppedCtx = croppedCanvas.getContext('2d')
    if (!croppedCtx) return

    croppedCtx.drawImage(
      img,
      cropRect.x, cropRect.y, cropRect.width, cropRect.height,
      0, 0, cropRect.width, cropRect.height
    )

    const dataUrl = croppedCanvas.toDataURL('image/jpeg', quality)
    onConfirm?.(dataUrl)
  }

  const handleCancel = () => {
    onCancel?.()
    onClose?.()
  }

  if (!open) return null

  const content = (
    <div className={`image-crop-overlay ${isInline ? 'is-inline' : ''}`} onClick={handleCancel}>
      <div className="image-crop-container" onClick={(e) => e.stopPropagation()}>
        <div className="crop-container">
          <canvas
            ref={canvasRef}
            className={`crop-canvas ${isDragging ? 'is-dragging' : ''}`}
            width={400}
            height={600}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {!cropRect && (
            <div className="crop-mask crop-mask-full">
              <div className="crop-hint-box">
                <div className="crop-hint-rect"></div>
                <div className="crop-hint-text">{hintText}</div>
              </div>
            </div>
          )}

          {cropRect && (
            <>
              <div className="crop-mask crop-mask-top" style={{ height: `${cropRect.y}px` }} />
              <div className="crop-mask crop-mask-bottom" style={{ top: `${cropRect.y + cropRect.height}px` }} />
              <div className="crop-mask crop-mask-left" style={{
                top: `${cropRect.y}px`,
                left: 0,
                width: `${cropRect.x}px`,
                height: `${cropRect.height}px`
              }} />
              <div className="crop-mask crop-mask-right" style={{
                top: `${cropRect.y}px`,
                left: `${cropRect.x + cropRect.width}px`,
                width: `${400 - cropRect.x - cropRect.width}px`,
                height: `${cropRect.height}px`
              }} />
            </>
          )}

          {cropRect && (
            <div
              className="crop-overlay"
              style={{
                left: cropRect.x,
                top: cropRect.y,
                width: cropRect.width,
                height: cropRect.height
              }}
            >
              <div className="crop-corner crop-corner-nw"></div>
              <div className="crop-corner crop-corner-ne"></div>
              <div className="crop-corner crop-corner-sw"></div>
              <div className="crop-corner crop-corner-se"></div>
            </div>
          )}
        </div>

        <div className="capture-actions">
          <Button label="重截" size="md" variant="ghost" onClick={handleRetake} />
          <Button
            label="确认"
            size="md"
            variant="primary"
            disabled={!cropRect}
            onClick={handleConfirm}
          />
        </div>

        <button className="capture-close-btn" onClick={handleCancel}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M20 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  )

  if (isInline) {
    return content
  }

  return createPortal(content, document.body)
}

export default ImageCropper
