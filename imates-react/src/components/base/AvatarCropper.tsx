import React, { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import '@/components/base/AvatarCropper.css'

export interface AvatarCropperProps {
  open: boolean
  src: string
  outputSize?: number
  quality?: number
  onConfirm?: (croppedDataUrl: string) => void
  onCancel?: () => void
  onClose?: () => void
}

export const AvatarCropper: React.FC<AvatarCropperProps> = ({
  open,
  src,
  outputSize = 256,
  quality = 0.92,
  onConfirm,
  onCancel,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgEl = useRef<HTMLImageElement | null>(null)
  const [isReady, setIsReady] = useState(false)

  const [canvasW, setCanvasW] = useState(0)
  const [canvasH, setCanvasH] = useState(0)

  const [baseScale, setBaseScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)

  const isPanningImage = useRef(false)
  const panLastPos = useRef({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{
    startDist: number
    startZoom: number
    startCenter: { x: number; y: number }
    startOffset: { x: number; y: number }
  } | null>(null)

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isReady) return
    if (e.button !== undefined && e.button !== 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const { x, y } = getCanvasPoint(e.clientX, e.clientY)
    pointers.current.set(e.pointerId, { x, y })

    // 多指：进入 pinch 缩放/平移
    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values())
      pinch.current = {
        startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        startZoom: zoom,
        startCenter: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        startOffset: { x: offsetX, y: offsetY },
      }
      isPanningImage.current = false
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {}
      return
    }

    // 单指：拖动图片
    isPanningImage.current = true
    panLastPos.current = { x, y }
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {}
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isReady) return

    const { x, y } = getCanvasPoint(e.clientX, e.clientY)
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x, y })
    }

    // pinch 缩放/平移
    if (pinch.current && pointers.current.size >= 2) {
      const pts = Array.from(pointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      const ratio = pinch.current.startDist ? dist / pinch.current.startDist : 1
      setZoom(Math.min(Math.max(pinch.current.startZoom * ratio, 1), 6))

      // 用两指中心点的位移来平移图片
      setOffsetX(pinch.current.startOffset.x + (center.x - pinch.current.startCenter.x))
      setOffsetY(pinch.current.startOffset.y + (center.y - pinch.current.startCenter.y))
      return
    }

    if (isPanningImage.current) {
      const dx = x - panLastPos.current.x
      const dy = y - panLastPos.current.y
      panLastPos.current = { x, y }
      setOffsetX(prev => prev + dx)
      setOffsetY(prev => prev + dy)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.delete(e.pointerId)
    }
    if (pointers.current.size < 2) {
      pinch.current = null
    }
    isPanningImage.current = false
  }

  const onWheel = (e: React.WheelEvent) => {
    if (!isReady) return
    const delta = e.deltaY
    const factor = delta > 0 ? 1 / 1.08 : 1.08
    setZoom(prev => Math.min(Math.max(prev * factor, 1), 6))
  }

  const getCircleRadius = useCallback(() => {
    const size = Math.max(160, Math.floor(Math.min(canvasW, canvasH) * 0.62))
    return size / 2
  }, [canvasW, canvasH])

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const ensureCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))

    setCanvasW(w)
    setCanvasH(h)

    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)

    const ctx = getCtx()
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  }, [getCtx])

  const computeBaseScale = useCallback(() => {
    const img = imgEl.current
    if (!img) return

    const diameter = getCircleRadius() * 2
    const s = Math.max(diameter / img.width, diameter / img.height)
    setBaseScale(s || 1)
  }, [getCircleRadius])

  const clampOffsets = useCallback(() => {
    const img = imgEl.current
    if (!img) return

    const scale = baseScale * zoom
    const halfW = (img.width * scale) / 2
    const halfH = (img.height * scale) / 2

    const cx = canvasW / 2
    const cy = canvasH / 2

    const r = getCircleRadius()
    const limitRect = {
      left: cx - r,
      top: cy - r,
      right: cx + r,
      bottom: cy + r,
    }

    const minCenterX = limitRect.right - halfW
    const maxCenterX = limitRect.left + halfW
    const minCenterY = limitRect.bottom - halfH
    const maxCenterY = limitRect.top + halfH

    const centerX = cx + offsetX
    const centerY = cy + offsetY

    const clampedCenterX = Math.min(Math.max(centerX, minCenterX), maxCenterX)
    const clampedCenterY = Math.min(Math.max(centerY, minCenterY), maxCenterY)

    setOffsetX(clampedCenterX - cx)
    setOffsetY(clampedCenterY - cy)
  }, [baseScale, zoom, canvasW, canvasH, offsetX, offsetY, getCircleRadius])

  const render = useCallback(() => {
    const ctx = getCtx()
    const img = imgEl.current
    if (!ctx || !img || !canvasW || !canvasH) return

    ctx.clearRect(0, 0, canvasW, canvasH)

    const cx = canvasW / 2
    const cy = canvasH / 2

    const scale = baseScale * zoom
    const drawW = img.width * scale
    const drawH = img.height * scale

    // 绘制图片
    ctx.drawImage(img, cx + offsetX - drawW / 2, cy + offsetY - drawH / 2, drawW, drawH)

    // 固定圆形遮罩（透视区域显示图片）
    const r = getCircleRadius()
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, canvasW, canvasH)
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip('evenodd')
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, 0, canvasW, canvasH)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }, [getCtx, canvasW, canvasH, baseScale, zoom, offsetX, offsetY, getCircleRadius])

  useEffect(() => {
    if (!open || !src) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgEl.current = img
      setIsReady(true)
      ensureCanvasSize()
    }
    img.src = src
  }, [open, src, ensureCanvasSize])

  useEffect(() => {
    if (isReady) {
      computeBaseScale()
    }
  }, [isReady, computeBaseScale])

  useEffect(() => {
    if (isReady) {
      clampOffsets()
    }
  }, [isReady, clampOffsets])

  useEffect(() => {
    if (isReady) {
      render()
    }
  }, [isReady, render, baseScale, zoom, offsetX, offsetY, canvasW, canvasH])

  const reset = () => {
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
  }

  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const r = getCircleRadius()
    const cx = canvasW / 2
    const cy = canvasH / 2

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = outputSize
    outputCanvas.height = outputSize
    const ctx = outputCanvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
    ctx.clip()

    const scale = baseScale * zoom
    const img = imgEl.current
    if (!img) return

    const sourceX = (cx + offsetX - r) / scale
    const sourceY = (cy + offsetY - r) / scale
    const sourceSize = (r * 2) / scale

    ctx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, outputSize, outputSize
    )

    const dataUrl = outputCanvas.toDataURL('image/jpeg', quality)
    onConfirm?.(dataUrl)
  }

  const handleCancel = () => {
    onCancel?.()
    onClose?.()
  }

  if (!open) return null

  return createPortal(
    <div className="avatar-crop-overlay" onClick={handleCancel}>
      <div className="avatar-crop-container" onClick={(e) => e.stopPropagation()}>
        <canvas
          ref={canvasRef}
          className="crop-canvas"
          style={{ width: '100%', height: '100%' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />

        <div className="crop-actions">
          <button type="button" className="crop-action-btn" onClick={reset} disabled={!isReady}>
            重置
          </button>
          <button
            type="button"
            className="crop-action-btn primary"
            disabled={!isReady}
            onClick={handleConfirm}
          >
            使用
          </button>
        </div>

        <button className="crop-close-btn" onClick={handleCancel}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M20 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
        </button>
      </div>
    </div>,
    document.body
  )
}

export default AvatarCropper
