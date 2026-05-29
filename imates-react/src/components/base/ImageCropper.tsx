import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/base/Button'
import goBackIcon from '/icons/goback.svg'
import '@/components/base/ImageCropper.css'

export interface ImageCropperProps {
  open: boolean
  src: string
  hintText?: string
  quality?: number
  isInline?: boolean
  showInfo?: boolean
  onConfirm?: (croppedDataUrl: string) => void
  onRectChange?: (rect: { x: number; y: number; width: number; height: number } | null, preview?: string) => void
  onCancel?: () => void
  onRetake?: () => void
  onClose?: () => void
}

type Point = { x: number; y: number }

export const ImageCropper: React.FC<ImageCropperProps> = ({
  open,
  src,
  hintText = '在中间区域拖动框选题目',
  quality = 0.9,
  isInline = false,
  showInfo = true,
  onConfirm,
  onRectChange,
  onCancel,
  onRetake,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgEl = useRef<HTMLImageElement | null>(null)
  const containerSize = useRef({ width: 0, height: 0 })
  const canvasClientRect = useRef<{ left: number; top: number } | null>(null)
  const activePointers = useRef(new Map<number, Point>())
  const rafMoveId = useRef<number | null>(null)
  const pendingMovePoint = useRef<Point | null>(null)

  // 状态管理
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [userScale, setUserScale] = useState(1)
  const [rotationDeg, setRotationDeg] = useState(0)
  const [translateX, setTranslateX] = useState(0)
  const [translateY, setTranslateY] = useState(0)
  const [drawInfo, setDrawInfo] = useState({ scale: 1, dpr: 1 })

  const cropStartPos = useRef({ x: 0, y: 0 })
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

  const ROTATION_THRESHOLD = 7

  // 工具函数
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  const getDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const getMidpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const getAngleDeg = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  const normalizeDeg = (deg: number) => {
    const v = deg % 360
    return v < 0 ? v + 360 : v
  }
  const snapToNearest90 = (deg: number) => Math.round(deg / 90) * 90

  const refreshCanvasMeasure = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    containerSize.current = { width: rect.width, height: rect.height }
    canvasClientRect.current = { left: rect.left, top: rect.top }
  }, [])

  const resizeAndRedraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgEl.current
    if (!canvas || !img) return

    const rect = canvas.getBoundingClientRect()
    containerSize.current = { width: rect.width, height: rect.height }
    canvasClientRect.current = { left: rect.left, top: rect.top }
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const rot = normalizeDeg(rotationDeg)
    const isRotated = rot === 90 || rot === 270
    const effectiveW = isRotated ? img.naturalHeight : img.naturalWidth
    const effectiveH = isRotated ? img.naturalWidth : img.naturalHeight

    const baseScale = Math.min(rect.width / effectiveW, rect.height / effectiveH)
    const scale = baseScale * userScale

    setDrawInfo({ scale, dpr })

    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rad = (rotationDeg * Math.PI) / 180

    ctx.save()
    ctx.translate(centerX + translateX, centerY + translateY)
    ctx.rotate(rad)
    ctx.scale(scale, scale)
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
    ctx.restore()
  }, [rotationDeg, userScale, translateX, translateY])

  useEffect(() => {
    if (!open || !src) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      imgEl.current = img
      setCropRect(null)
      setIsCropping(false)
      setIsDragging(false)
      setUserScale(1)
      setRotationDeg(0)
      setTranslateX(0)
      setTranslateY(0)
      await Promise.resolve()
      resizeAndRedraw()
    }
    img.src = src
  }, [open, src, resizeAndRedraw])

  useEffect(() => {
    const handleResize = () => resizeAndRedraw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [resizeAndRedraw])

  const getCanvasPoint = (clientX: number, clientY: number) => {
    if (!canvasClientRect.current) refreshCanvasMeasure()
    return {
      x: clientX - (canvasClientRect.current?.left || 0),
      y: clientY - (canvasClientRect.current?.top || 0),
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch { /* ignore */ }

    if (activePointers.current.size === 1) {
      lastSinglePointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
      gestureStart.current = null
      setIsDragging(false)
      
      refreshCanvasMeasure()
      const point = getCanvasPoint(e.clientX, e.clientY)
      setIsCropping(true)
      cropStartPos.current = point
      setCropRect(null)
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      gestureStart.current = {
        distance: getDistance(pts[0], pts[1]),
        angleDeg: getAngleDeg(pts[0], pts[1]),
        midpoint: getMidpoint(pts[0], pts[1]),
        startScale: userScale,
        startRotationDeg: rotationDeg,
        startTranslateX: translateX,
        startTranslateY: translateY,
      }
      lastSinglePointer.current = null
      setIsCropping(false)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return
    e.preventDefault()
    e.stopPropagation()
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 1 && lastSinglePointer.current?.id === e.pointerId) {
      if (!isCropping) return
      pendingMovePoint.current = getCanvasPoint(e.clientX, e.clientY)
      if (rafMoveId.current !== null) return

      rafMoveId.current = requestAnimationFrame(() => {
        rafMoveId.current = null
        const point = pendingMovePoint.current
        if (!point) return

        const { width: containerW, height: containerH } = containerSize.current
        const x = Math.max(0, Math.min(Math.min(cropStartPos.current.x, point.x), containerW))
        const y = Math.max(0, Math.min(Math.min(cropStartPos.current.y, point.y), containerH))
        const w = Math.max(0, Math.min(Math.abs(point.x - cropStartPos.current.x), containerW - x))
        const h = Math.max(0, Math.min(Math.abs(point.y - cropStartPos.current.y), containerH - y))

        setCropRect({ x, y, width: w, height: h })
        onRectChange?.({ x, y, width: w, height: h })
      })
    } else if (activePointers.current.size >= 2 && gestureStart.current) {
      const pts = Array.from(activePointers.current.values())
      const distance = getDistance(pts[0], pts[1])
      const angleDeg = getAngleDeg(pts[0], pts[1])
      const midpoint = getMidpoint(pts[0], pts[1])

      const scaleFactor = gestureStart.current.distance > 0 ? distance / gestureStart.current.distance : 1
      const newScale = clamp(gestureStart.current.startScale * scaleFactor, 0.5, 6)

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const scaleRatio = gestureStart.current.startScale > 0 ? newScale / gestureStart.current.startScale : 1
      const startRelX = gestureStart.current.midpoint.x - centerX - gestureStart.current.startTranslateX
      const startRelY = gestureStart.current.midpoint.y - centerY - gestureStart.current.startTranslateY

      setTranslateX(midpoint.x - centerX - startRelX * scaleRatio)
      setTranslateY(midpoint.y - centerY - startRelY * scaleRatio)

      const deltaAngle = angleDeg - gestureStart.current.angleDeg
      if (Math.abs(deltaAngle) > ROTATION_THRESHOLD) {
        setRotationDeg(gestureStart.current.startRotationDeg + deltaAngle)
      }
      setUserScale(newScale)
      resizeAndRedraw()
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch { /* ignore */ }

    if (activePointers.current.size === 1) {
      const remainingId = Array.from(activePointers.current.keys())[0]
      const pt = activePointers.current.get(remainingId)!
      lastSinglePointer.current = { id: remainingId, x: pt.x, y: pt.y }
      gestureStart.current = null
    } else if (activePointers.current.size < 1) {
      lastSinglePointer.current = null
      gestureStart.current = null
      setIsDragging(false)
      setIsCropping(false)
      
      const snapped = snapToNearest90(rotationDeg)
      if (snapped !== rotationDeg) {
        setRotationDeg(snapped)
        setTimeout(resizeAndRedraw, 0)
      }
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1 / 1.08 : 1.08
    setUserScale(prev => clamp(prev * factor, 0.5, 6))
    setTimeout(resizeAndRedraw, 0)
  }

  const exportCroppedImage = async (): Promise<string> => {
    const canvas = canvasRef.current
    if (!cropRect || !imgEl.current || !canvas) throw new Error('Missing requirements')

    const dpr = drawInfo.dpr
    const sx = Math.max(0, Math.round(cropRect.x * dpr))
    const sy = Math.max(0, Math.round(cropRect.y * dpr))
    const sw = Math.max(1, Math.round(cropRect.width * dpr))
    const sh = Math.max(1, Math.round(cropRect.height * dpr))

    const outCanvas = document.createElement('canvas')
    outCanvas.width = sw
    outCanvas.height = sh
    const ctx = outCanvas.getContext('2d')
    if (!ctx) throw new Error('Failed to create context')

    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
    return outCanvas.toDataURL('image/jpeg', quality)
  }

  const handleConfirm = async () => {
    if (!cropRect) return
    try {
      const dataUrl = await exportCroppedImage()
      onConfirm?.(dataUrl)
      onClose?.()
    } catch (e) {
      console.error('[ImageCropper] Export failed:', e)
    }
  }

  const handleRetake = () => {
    setCropRect(null)
    setIsCropping(false)
    setIsDragging(false)
    onRetake?.()
  }

  const handleCancel = () => {
    onCancel?.()
    onClose?.()
  }

  if (!open) return null

  const overlay = (
    <div className={`image-crop-overlay ${isInline ? 'is-inline' : ''}`} onClick={handleCancel}>
      <div className="image-crop-container" onClick={e => e.stopPropagation()}>
        <div className="crop-container">
          <canvas
            ref={canvasRef}
            className={`crop-canvas ${isDragging ? 'is-dragging' : ''} ${isCropping ? 'is-drawing' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
          />

          {!cropRect && (
            <div className="crop-mask crop-mask-full">
              <div className="crop-hint-box">
                <div className="crop-hint-rect" />
                <div className="crop-hint-text">{hintText}</div>
              </div>
            </div>
          )}

          {cropRect && (
            <>
              <div className="crop-mask crop-mask-top" style={{ top: 0, left: 0, width: '100%', height: cropRect.y }} />
              <div className="crop-mask crop-mask-bottom" style={{ top: cropRect.y + cropRect.height, left: 0, width: '100%', height: `calc(100% - ${cropRect.y + cropRect.height}px)` }} />
              <div className="crop-mask crop-mask-left" style={{ top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.height }} />
              <div className="crop-mask crop-mask-right" style={{ top: cropRect.y, left: cropRect.x + cropRect.width, width: `calc(100% - ${cropRect.x + cropRect.width}px)`, height: cropRect.height }} />
              
              <div
                className="crop-overlay"
                style={{ left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height }}
              >
                <div className="crop-corner crop-corner-nw" />
                <div className="crop-corner crop-corner-ne" />
                <div className="crop-corner crop-corner-sw" />
                <div className="crop-corner crop-corner-se" />
              </div>
            </>
          )}
        </div>

        <div className="capture-actions">
          <Button label="重截" size="md" variant="ghost" onClick={handleRetake} />
          <Button label="确认" size="md" variant="primary" disabled={!cropRect} onClick={handleConfirm} />
        </div>

        <button className="capture-close-btn goback-btn" onClick={handleCancel}>
          <img src={goBackIcon} alt="返回" className="goback-icon" />
        </button>
      </div>
    </div>
  )

  return isInline ? overlay : createPortal(overlay, document.body)
}

export default ImageCropper
