import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactDOM from 'react-dom'
import downloadIcon from '/icons/download.svg'
import { androidBridge } from '@/services/business/android-bridge'
import { showMessage } from '@/utils'
import '@/components/display/ImageViewer.css'

interface ImageItem {
  url: string
  alt?: string
}

interface ImageViewerProps {
  open: boolean
  onClose: () => void
  imageUrl?: string
  alt?: string
  images?: ImageItem[]
  initialIndex?: number
  onChange?: (index: number) => void
}

type Point = { x: number; y: number }

export const ImageViewer: React.FC<ImageViewerProps> = ({
  open,
  onClose,
  imageUrl = '',
  alt = '图片预览',
  images = [],
  initialIndex = 0,
  onChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [translateX, setTranslateX] = useState(0)
  const [translateY, setTranslateY] = useState(0)
  const [scale, setScale] = useState(1)
  const [rotationDeg, setRotationDeg] = useState(0)
  const [enableTransition, setEnableTransition] = useState(false)

  const previewContentRef = useRef<HTMLDivElement>(null)
  const activePointers = useRef(new Map<number, Point>())
  const lastSinglePointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const gestureStart = useRef<{
    distance: number
    angleDeg: number
    midpoint: Point
    startScale: number
    startRotationDeg: number
    startTranslateX: number
    startTranslateY: number
  } | null>(null)

  const MIN_SCALE = 0.5
  const MAX_SCALE = 5
  const ROTATION_THRESHOLD = 7

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex)
      resetTransform()
    }
  }, [open, initialIndex])

  const resetTransform = useCallback(() => {
    setTranslateX(0)
    setTranslateY(0)
    setScale(1)
    setRotationDeg(0)
    setEnableTransition(false)
    activePointers.current.clear()
    gestureStart.current = null
  }, [])

  useEffect(() => {
    resetTransform()
  }, [currentIndex, imageUrl, resetTransform])

  const snapToNearest90 = (deg: number, startDeg: number) => {
    const deltaDeg = deg - startDeg
    const absoluteDelta = Math.abs(deltaDeg)
    if (absoluteDelta <= 30) {
      return startDeg
    } else {
      return Math.round(deg / 90) * 90
    }
  }

  const imageStyle = useMemo(() => {
    const transition = enableTransition ? 'transform 0.3s ease' : 'none'
    return {
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale}) rotate(${rotationDeg}deg)`,
      transformOrigin: 'center center',
      transition,
    }
  }, [translateX, translateY, scale, rotationDeg, enableTransition])

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const getAngleDeg = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  const getMidpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!open) return
    e.preventDefault()
    e.stopPropagation()
    setEnableTransition(false)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch (err) {}

    if (activePointers.current.size === 1) {
      lastSinglePointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
      gestureStart.current = null
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      const a = pts[0]
      const b = pts[1]
      gestureStart.current = {
        distance: getDistance(a, b),
        angleDeg: getAngleDeg(a, b),
        midpoint: getMidpoint(a, b),
        startScale: scale,
        startRotationDeg: rotationDeg,
        startTranslateX: translateX,
        startTranslateY: translateY,
      }
      lastSinglePointer.current = null
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!open || !activePointers.current.has(e.pointerId)) return
    e.preventDefault()
    e.stopPropagation()
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 1 && lastSinglePointer.current?.id === e.pointerId) {
      const dx = e.clientX - lastSinglePointer.current.x
      const dy = e.clientY - lastSinglePointer.current.y
      setTranslateX(prev => prev + dx)
      setTranslateY(prev => prev + dy)
      lastSinglePointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    } else if (activePointers.current.size >= 2 && gestureStart.current) {
      const pts = Array.from(activePointers.current.values())
      const a = pts[0]
      const b = pts[1]
      const distance = getDistance(a, b)
      const angleDeg = getAngleDeg(a, b)
      const midpoint = getMidpoint(a, b)

      const scaleFactor = gestureStart.current.distance > 0 ? distance / gestureStart.current.distance : 1
      const newScale = clamp(gestureStart.current.startScale * scaleFactor, MIN_SCALE, MAX_SCALE)
      const deltaAngle = angleDeg - gestureStart.current.angleDeg

      let newRotation = rotationDeg
      if (Math.abs(deltaAngle) > ROTATION_THRESHOLD) {
        newRotation = gestureStart.current.startRotationDeg + deltaAngle
      }

      const containerRect = previewContentRef.current?.getBoundingClientRect()
      if (containerRect) {
        const centerX = containerRect.left + containerRect.width / 2
        const centerY = containerRect.top + containerRect.height / 2
        const scaleRatio = newScale / gestureStart.current.startScale
        const startRelativeX = gestureStart.current.midpoint.x - centerX - gestureStart.current.startTranslateX
        const startRelativeY = gestureStart.current.midpoint.y - centerY - gestureStart.current.startTranslateY

        setTranslateX(midpoint.x - centerX - startRelativeX * scaleRatio)
        setTranslateY(midpoint.y - centerY - startRelativeY * scaleRatio)
        setScale(newScale)
        setRotationDeg(newRotation)
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return
    e.preventDefault()
    e.stopPropagation()
    activePointers.current.delete(e.pointerId)

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch (err) {}

    if (activePointers.current.size === 1) {
      const remainingId = Array.from(activePointers.current.keys())[0]
      const pt = activePointers.current.get(remainingId)
      if (pt) {
        lastSinglePointer.current = { id: remainingId, x: pt.x, y: pt.y }
      }
      gestureStart.current = null
    } else if (activePointers.current.size < 1) {
      const startRotationDeg = gestureStart.current?.startRotationDeg || 0
      lastSinglePointer.current = null
      gestureStart.current = null

      const snappedRotation = snapToNearest90(rotationDeg, startRotationDeg)
      if (snappedRotation !== rotationDeg) {
        setEnableTransition(true)
        setRotationDeg(snappedRotation)
        setTimeout(() => setEnableTransition(false), 300)
      }
    }
  }

  const currentImageUrl = images.length > 0 ? images[currentIndex]?.url : imageUrl
  const currentAlt = images.length > 0 ? images[currentIndex]?.alt || alt : alt
  const totalImages = images.length > 0 ? images.length : 1
  const showPrev = images.length > 1 && currentIndex > 0
  const showNext = images.length > 1 && currentIndex < images.length - 1

  const handlePrev = () => {
    if (currentIndex > 0) {
      const next = currentIndex - 1
      setCurrentIndex(next)
      onChange?.(next)
    }
  }

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      const next = currentIndex + 1
      setCurrentIndex(next)
      onChange?.(next)
    }
  }

  const handleClose = () => {
    onClose()
    resetTransform()
  }

  const handleSave = async () => {
    if (!currentImageUrl) return
    try {
      if (androidBridge.isAndroidBridgeAvailable() && androidBridge.saveBase64ImageToGallery) {
        let dataUrl = currentImageUrl
        if (!dataUrl.startsWith('data:image/')) {
          const resp = await fetch(currentImageUrl)
          const blob = await resp.blob()
          dataUrl = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.readAsDataURL(blob)
          })
        }
        const ext = dataUrl.match(/data:image\/([^;]+);/)?.[1] || 'png'
        const filename = `image_${Date.now()}.${ext}`
        const result = androidBridge.saveBase64ImageToGallery(dataUrl, filename)
        if (result?.success) {
          showMessage('已保存到相册', 'success')
          return
        }
      }

      if (currentImageUrl.startsWith('data:image/')) {
        const link = document.createElement('a')
        link.href = currentImageUrl
        link.download = `image_${Date.now()}.png`
        link.click()
        showMessage('开始下载', 'success')
      } else {
        const resp = await fetch(currentImageUrl)
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `image_${Date.now()}.png`
        link.click()
        URL.revokeObjectURL(url)
        showMessage('开始下载', 'success')
      }
    } catch (err) {
      window.open(currentImageUrl, '_blank', 'noopener')
      showMessage('已在新窗口打开，请长按/右键保存', 'info')
    }
  }

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
      else if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [open, currentIndex, images.length])

  if (!open) return null

  return ReactDOM.createPortal(
    <div className="image-viewer-root">
      <div className="preview-overlay" onClick={handleClose}>
        <button type="button" className="close-btn" onClick={(e) => { e.stopPropagation(); handleClose(); }}>✕</button>
        <button type="button" className="save-btn" onClick={(e) => { e.stopPropagation(); handleSave(); }} title="保存到本地">
          <img src={downloadIcon} alt="下载" className="save-icon" />
        </button>

        {showPrev && <button type="button" className="nav-btn prev-btn" onClick={(e) => { e.stopPropagation(); handlePrev(); }} title="上一张">‹</button>}
        {showNext && <button type="button" className="nav-btn next-btn" onClick={(e) => { e.stopPropagation(); handleNext(); }} title="下一张">›</button>}

        {totalImages > 1 && <div className="image-counter">{currentIndex + 1} / {totalImages}</div>}

        <div
          ref={previewContentRef}
          className="preview-content"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {currentImageUrl && (
            <img
              src={currentImageUrl}
              alt={currentAlt}
              className="preview-image"
              style={imageStyle}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ImageViewer
