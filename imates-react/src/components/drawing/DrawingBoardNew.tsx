import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react'
import { ToolbarNew, ToolConfigState } from './ToolbarNew'
import Dialog from '@/components/base/Dialog'
import Select from '@/components/base/Select'
import { ZOOM_PRESET_OPTIONS } from '@/constants/options'
import { useImagePicker } from '@/hooks/useImagePicker'
import { getStroke } from 'perfect-freehand'
import SignaturePad from 'signature_pad'
import '@/components/drawing/DrawingBoardNew.css'

export interface DrawingBoardNewProps {
  // 背景图片的URL或base64数据
  backgroundImage?: string
  // 背景图片的位置：居中或左上角
  backgroundPosition?: 'center' | 'topLeft'
  // 是否自适应背景图片大小
  fitBackground?: boolean
  // 是否填充容器
  fillContainer?: boolean
  // 画布布局模式：填满容器 or 高画布（容器高*1.5）
  layoutMode?: 'fill' | 'doubleHeight'
  // 初始缩放比例
  initialZoom?: number
  // 是否显示网格
  showGrid?: boolean
  // 工具栏配置：可以是工具数组或左右中分布的对象
  tools?: string[] | { left?: string[]; middle?: string[]; right?: string[] }
  // 强制设置画笔颜色
  forcePenColor?: string
  // 是否启用AI询问功能
  enableAskAi?: boolean
  // 是否允许弹窗
  allowPopup?: boolean
  // 是否显示工具栏
  showToolbar?: boolean
  // 工具栏位置：顶部或左侧
  toolbarPosition?: 'top' | 'left'
  // 是否显示缩放控制
  showZoomControls?: boolean
  // 是否禁用画板
  disabled?: boolean
  // 画布宽度（可选）
  width?: number
  // 画布高度（可选）
  height?: number
  // 清空画板回调
  onClear?: () => void
  // 撤销操作回调
  onUndo?: () => void
  // 重做操作回调
  onRedo?: () => void
  // 保存画板数据回调
  onSave?: (data: { objects: any[]; history: any[]; historyIndex: number }) => void
  // 工具切换回调
  onToolChange?: (tool: string) => void
  // AI选择图片回调
  onAskAiImageSelected?: (imageInfo: {
    filePath: string
    width: number
    height: number
    fileSize: number
    base64DataUrl?: string
  }) => void
  // 状态改变回调 (用于通知外部组件如 Toolbar 更新)
  onStateChange?: () => void
  // 内容变化事件
  onContentChange?: () => void
  // 当前选中的工具 (受控)
  selectedTool?: string
  // 工具配置 (受控)
  toolConfig?: any
  // 子组件
  children?: React.ReactNode
}

interface Point {
  x: number
  y: number
}

const DrawingBoardNew = forwardRef<any, DrawingBoardNewProps>((props, ref) => {
  const {
    backgroundImage = '',
    backgroundPosition = 'center',
    fitBackground = true,
    fillContainer = false,
    layoutMode,
    initialZoom = 1,
    showGrid = false,
    tools,
    forcePenColor,
    enableAskAi = false,
    allowPopup = true,
    showToolbar = true,
    toolbarPosition = 'top',
    showZoomControls = true,
    disabled = false,
    width: propsWidth,
    height: propsHeight,
    onClear,
    onUndo,
    onRedo,
    onSave,
    onToolChange,
    onAskAiImageSelected,
    onStateChange,
    onContentChange,
    selectedTool: controlledTool,
    toolConfig: controlledConfig,
    children,
  } = props

  // ==================== DPR 适配 ====================
  const dpr = Math.max(1, window.devicePixelRatio || 1)

  const resizeCanvasBackingStore = (canvas: HTMLCanvasElement, cssW: number, cssH: number) => {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
  }

  const prepareCtxForLogicalDrawing = (c: CanvasRenderingContext2D) => {
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Refs
  const historyCanvasRef = useRef<HTMLCanvasElement>(null)
  const liveCanvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  
  // States
  const [currentMode, setCurrentMode] = useState(controlledTool || 'draw')
  const [currentColor, setCurrentColor] = useState(controlledConfig?.color || '#212529')
  const [currentSize, setCurrentSize] = useState(controlledConfig?.size || 3)
  const [currentOpacity, setCurrentOpacity] = useState(controlledConfig?.opacity || 1)
  const [selectMode, setSelectMode] = useState(controlledConfig?.selectMode || 'rectangle')
  const [handwritingStyle, setHandwritingStyle] = useState<'normal' | 'signature'>(controlledConfig?.handwritingStyle || 'normal')
  const [canvasWidth, setCanvasWidth] = useState(propsWidth || 1000)
  const [canvasHeight, setCanvasHeight] = useState(propsHeight || 1000)
  const [zoomLevel, setZoomLevel] = useState(initialZoom)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  
  const [objects, setObjects] = useState<any[]>([])
  const [history, setHistory] = useState<any[][]>([[]])
  const [historyIndex, setHistoryIndex] = useState(0)
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([])
  const [strokeHasFlushedChunks, setStrokeHasFlushedChunks] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [tempObject, setTempObject] = useState<any | null>(null)
  const [hoveredObject, setHoveredObject] = useState<number | null>(null)
  const [selectedObjects, setSelectedObjects] = useState<Set<number>>(new Set())
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  
  const [isPanning, setIsPanning] = useState(false)
  const [panStartPoint, setPanStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [panStartOffset, setPanStartOffset] = useState({ x: 0, y: 0 })

  const [bgDrawParams, setBgDrawParams] = useState<{ scale: number; offsetX: number; offsetY: number } | null>(null)
  const [backgroundLoaded, setBackgroundLoaded] = useState(false)

  // Internal values
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const signaturePad = useRef<SignaturePad | null>(null)
  const historyDirty = useRef(true)
  const bgLoadVersion = useRef(0)
  const backgroundImg = useRef<HTMLImageElement | null>(null)
  const cachedCanvasRect = useRef<DOMRect | null>(null)
  const cachedScaleX = useRef(1)
  const cachedScaleY = useRef(1)
  const rafRenderId = useRef<number | null>(null)
  const renderScheduled = useRef(false)
  const activePointers = useRef(new Map())
  const activeAction = useRef<any>(null)
  const imageCache = useRef(new Map<string, HTMLImageElement>())
  const backgroundOrigin = useRef({ x: 0, y: 0 })
  const backgroundScale = useRef(1)
  const groupBounds = useRef<any>(null)
  const selectionRect = useRef<any>(null)
  const activeHandle = useRef<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Perfect Freehand 配置
  const DEFAULT_PF_CONFIG = {
    size: 3,
    thinning: 0.15,
    smoothing: 0.65,
    streamline: 0.7,
    taper: 0,
    startTaper: 0,
    endTaper: 0,
    startCap: true,
    endCap: true,
    simulatePressure: false,
    easingName: 'linear',
  }
  const [pfConfig, setPfConfig] = useState({ ...DEFAULT_PF_CONFIG })
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [inputState, setInputState] = useState({
    visible: false,
    x: 0,
    y: 0,
    worldX: 0,
    worldY: 0,
    text: '',
    color: '#000000',
    fontSize: 16,
    height: 'auto',
  })
  
  const [eraserCursor, setEraserCursor] = useState({
    visible: false,
    x: 0,
    y: 0,
    size: 0,
  })
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

  // Ask AI state
  const [askAiDragRect, setAskAiDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [askAiStartPoint, setAskAiStartPoint] = useState<Point | null>(null)
  const [askAiDragPath, setAskAiDragPath] = useState<Point[] | null>(null)

  // Tool states config
  const [toolStates, setToolStates] = useState<Record<string, any>>({
    draw: { color: '#212529', size: 1.5, opacity: 1 },
    highlighter: { color: '#ffc107', size: 12, opacity: 0.4 },
    rectangle: { color: '#212529', size: 3, opacity: 1 },
    circle: { color: '#212529', size: 3, opacity: 1 },
    line: { color: '#212529', size: 3, opacity: 1 },
    triangle: { color: '#212529', size: 3, opacity: 1 },
    coordinate: { color: '#212529', size: 2, opacity: 1 },
    text: { color: '#212529', size: 16, opacity: 1 },
    'eraser-stroke': { color: '#ffffff', size: 15, opacity: 1 },
  })

  // Sync with controlled props
  useEffect(() => {
    if (controlledTool && controlledTool !== currentMode) {
      setCurrentMode(controlledTool)
    }
  }, [controlledTool, currentMode])

  useEffect(() => {
    if (controlledConfig) {
      if (controlledConfig.color !== undefined && controlledConfig.color !== currentColor) setCurrentColor(controlledConfig.color)
      if (controlledConfig.size !== undefined && controlledConfig.size !== currentSize) setCurrentSize(controlledConfig.size)
      if (controlledConfig.opacity !== undefined && controlledConfig.opacity !== currentOpacity) setCurrentOpacity(controlledConfig.opacity)
      if (controlledConfig.selectMode !== undefined && controlledConfig.selectMode !== selectMode) setSelectMode(controlledConfig.selectMode)
    }
  }, [controlledConfig, currentColor, currentSize, currentOpacity, selectMode])

  useEffect(() => {
    if (forcePenColor) {
      setCurrentColor(forcePenColor)
      setToolStates(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(key => {
          if (next[key]) next[key].color = forcePenColor
        })
        return next
      })
    }
  }, [forcePenColor])

  // Helper to notify state change
  const notifyChange = useCallback(() => {
    onStateChange?.()
  }, [onStateChange])

  // Wrap state setters to notify
  const setModeAndNotify = (mode: string) => {
    setCurrentMode(mode)
    notifyChange()
  }

  const setHistoryStepAndNotify = (step: number | ((prev: number) => number)) => {
    setHistoryStep(step)
    notifyChange()
  }

  const setHistoryDataAndNotify = (data: string[] | ((prev: string[]) => string[])) => {
    setHistoryData(data)
    notifyChange()
  }

  // Constants
  const MIN_ZOOM = 0.01
  const MAX_ZOOM = 10.0
  const MAX_HISTORY = 40
  const AUTO_SAVE_DELAY_MS = 800

  // Helpers
  const screenToWorld = useCallback((sx: number, sy: number) => {
    if (!liveCanvasRef.current) return { x: 0, y: 0 }
    const rect = liveCanvasRef.current.getBoundingClientRect()
    const localX = sx - rect.left
    const localY = sy - rect.top
    const x = (localX - camera.x) / camera.zoom
    const y = (localY - camera.y) / camera.zoom
    return { x, y }
  }, [camera])

  const worldToScreen = useCallback((wx: number, wy: number) => {
    if (!liveCanvasRef.current) return { x: 0, y: 0 }
    const sx = wx * camera.zoom + camera.x
    const sy = wy * camera.zoom + camera.y
    return { x: sx, y: sy }
  }, [camera])

  const getCachedImage = (dataUrl: string) => {
    if (!dataUrl) return null
    const cached = imageCache.current.get(dataUrl)
    if (cached) return cached
    const img = new Image()
    img.src = dataUrl
    img.onload = () => requestRenderAll()
    imageCache.current.set(dataUrl, img)
    return img
  }

  // Rendering logic
  const drawStrokeToContext = (targetCtx: CanvasRenderingContext2D, obj: any) => {
    if (!obj) return
    if (!obj.type || obj.type === 'stroke') {
      if (!obj.points || obj.points.length === 0) return
      targetCtx.beginPath()
      targetCtx.lineWidth = obj.size
      targetCtx.lineCap = 'round'
      targetCtx.lineJoin = 'round'
      targetCtx.strokeStyle = obj.mode === 'eraser' ? '#f9fafb' : obj.color
      targetCtx.globalAlpha = obj.opacity ?? 1

      if (obj.points.length < 2) {
        targetCtx.moveTo(obj.points[0].x, obj.points[0].y)
        targetCtx.lineTo(obj.points[0].x, obj.points[0].y)
      } else {
        targetCtx.moveTo(obj.points[0].x, obj.points[0].y)
        for (let i = 1; i < obj.points.length - 1; i++) {
          const p1 = obj.points[i]
          const p2 = obj.points[i + 1]
          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2
          targetCtx.quadraticCurveTo(p1.x, p1.y, midX, midY)
        }
        const last = obj.points[obj.points.length - 1]
        targetCtx.lineTo(last.x, last.y)
      }
      targetCtx.stroke()
      targetCtx.globalAlpha = 1
    } else if (obj.type === 'text') {
      targetCtx.font = `${obj.size * 5}px sans-serif`
      targetCtx.fillStyle = obj.color
      targetCtx.textBaseline = 'top'
      const lines = (obj.text || '').split('\n')
      const lineHeight = obj.size * 5 * 1.2
      lines.forEach((line: string, i: number) => {
        targetCtx.fillText(line, obj.x, obj.y + i * lineHeight)
      })
    } else if (obj.type === 'rectangle') {
      targetCtx.strokeStyle = obj.color
      targetCtx.lineWidth = obj.size
      targetCtx.globalAlpha = obj.opacity ?? 1
      targetCtx.strokeRect(obj.x, obj.y, obj.width, obj.height)
      targetCtx.globalAlpha = 1
    } else if (obj.type === 'circle') {
      targetCtx.strokeStyle = obj.color
      targetCtx.lineWidth = obj.size
      targetCtx.globalAlpha = obj.opacity ?? 1
      targetCtx.beginPath()
      targetCtx.arc(
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
        Math.abs(obj.width / 2),
        0,
        Math.PI * 2
      )
      targetCtx.stroke()
      targetCtx.globalAlpha = 1
    } else if (obj.type === 'triangle') {
      targetCtx.strokeStyle = obj.color
      targetCtx.lineWidth = obj.size
      targetCtx.globalAlpha = obj.opacity ?? 1
      targetCtx.beginPath()
      targetCtx.moveTo(obj.x + obj.width / 2, obj.y)
      targetCtx.lineTo(obj.x + obj.width, obj.y + obj.height)
      targetCtx.lineTo(obj.x, obj.y + obj.height)
      targetCtx.closePath()
      targetCtx.stroke()
      targetCtx.globalAlpha = 1
    } else if (obj.type === 'line') {
      targetCtx.strokeStyle = obj.color
      targetCtx.lineWidth = obj.size
      targetCtx.lineCap = 'round'
      targetCtx.globalAlpha = obj.opacity ?? 1
      targetCtx.beginPath()
      targetCtx.moveTo(obj.x, obj.y)
      targetCtx.lineTo(obj.x + obj.width, obj.y + obj.height)
      targetCtx.stroke()
      targetCtx.globalAlpha = 1
    } else if (obj.type === 'coordinate') {
      targetCtx.strokeStyle = obj.color
      targetCtx.lineWidth = obj.size
      targetCtx.lineCap = 'round'
      targetCtx.lineJoin = 'round'
      targetCtx.globalAlpha = obj.opacity ?? 1

      const arrowSize = Math.max(10, obj.size * 5)
      const tickSize = Math.max(5, obj.size * 3)
      const tickInterval = Math.max(20, obj.size * 10)

      const centerX = obj.x + obj.width / 2
      const centerY = obj.y + obj.height / 2

      targetCtx.beginPath()
      targetCtx.lineWidth = Math.max(1, obj.size * 0.5)

      // X轴刻度
      for (let x = centerX + tickInterval; x < obj.x + obj.width - arrowSize; x += tickInterval) {
        targetCtx.moveTo(x, centerY - tickSize / 2)
        targetCtx.lineTo(x, centerY + tickSize / 2)
      }
      for (let x = centerX - tickInterval; x > obj.x + arrowSize; x -= tickInterval) {
        targetCtx.moveTo(x, centerY - tickSize / 2)
        targetCtx.lineTo(x, centerY + tickSize / 2)
      }
      // Y轴刻度
      for (let y = centerY + tickInterval; y < obj.y + obj.height - arrowSize; y += tickInterval) {
        targetCtx.moveTo(centerX - tickSize / 2, y)
        targetCtx.lineTo(centerX + tickSize / 2, y)
      }
      for (let y = centerY - tickInterval; y > obj.y + arrowSize; y -= tickInterval) {
        targetCtx.moveTo(centerX - tickSize / 2, y)
        targetCtx.lineTo(centerX + tickSize / 2, y)
      }
      targetCtx.stroke()

      targetCtx.lineWidth = obj.size
      targetCtx.beginPath()
      targetCtx.moveTo(obj.x, centerY)
      targetCtx.lineTo(obj.x + obj.width, centerY)
      targetCtx.moveTo(centerX, obj.y)
      targetCtx.lineTo(centerX, obj.y + obj.height)
      targetCtx.stroke()

      const drawArrow = (x: number, y: number, angle: number) => {
        targetCtx.save()
        targetCtx.translate(x, y)
        targetCtx.rotate(angle)
        targetCtx.beginPath()
        targetCtx.moveTo(0, 0)
        targetCtx.lineTo(-arrowSize, -arrowSize / 2)
        targetCtx.lineTo(-arrowSize, arrowSize / 2)
        targetCtx.closePath()
        targetCtx.fillStyle = obj.color
        targetCtx.fill()
        targetCtx.restore()
      }

      drawArrow(obj.x + obj.width, centerY, 0)
      drawArrow(centerX, obj.y, -Math.PI / 2)

      const originRadius = Math.max(3, obj.size * 1.5)
      targetCtx.beginPath()
      targetCtx.arc(centerX, centerY, originRadius, 0, Math.PI * 2)
      targetCtx.fillStyle = obj.color
      targetCtx.fill()

      const fontSize = Math.max(12, obj.size * 6)
      targetCtx.font = `${fontSize}px "Times New Roman", Georgia, serif`
      targetCtx.fillStyle = obj.color
      targetCtx.textAlign = 'center'
      targetCtx.textBaseline = 'middle'

      targetCtx.fillText('x', obj.x + obj.width - arrowSize / 2, centerY + arrowSize)
      targetCtx.fillText('y', centerX + arrowSize, obj.y + arrowSize / 2)
      targetCtx.fillText('O', centerX - arrowSize / 2, centerY + arrowSize)

      targetCtx.globalAlpha = 1
    } else if (obj.type === 'image') {
      const dataUrl = obj.dataUrl
      if (!dataUrl) return
      const img = getCachedImage(dataUrl)
      if (!img || !img.complete) return
      const x = typeof obj.x === 'number' ? obj.x : 0
      const y = typeof obj.y === 'number' ? obj.y : 0
      const w = typeof obj.width === 'number' ? obj.width : img.naturalWidth
      const h = typeof obj.height === 'number' ? obj.height : img.naturalHeight
      targetCtx.globalAlpha = typeof obj.opacity === 'number' ? obj.opacity : 1
      targetCtx.drawImage(img, x, y, w, h)
      targetCtx.globalAlpha = 1
    }
  }

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const zoom = camera.zoom
    const step = 20 * zoom
    let gridSize = 20
    if (step < 5) return
    if (step < 10) gridSize = 100
    if (step < 2) gridSize = 500

    const offsetX = camera.x % (gridSize * zoom)
    const offsetY = camera.y % (gridSize * zoom)

    ctx.beginPath()
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1

    for (let x = offsetX; x < width; x += gridSize * zoom) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    for (let y = offsetY; y < height; y += gridSize * zoom) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()
  }

  const renderHistory = useCallback(() => {
    if (!historyCanvasRef.current) return
    const canvas = historyCanvasRef.current
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.width
    const height = canvas.height

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Grid drawing
    if (showGrid) {
      drawGrid(ctx, width, height)
    }

    ctx.setTransform(
      dpr * camera.zoom,
      0,
      0,
      dpr * camera.zoom,
      camera.x * dpr,
      camera.y * dpr
    )
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // Background Image
    if (backgroundImg.current && backgroundLoaded.current) {
       if (backgroundContain) {
         ctx.drawImage(
           backgroundImg.current, 
           backgroundOrigin.current.x, 
           backgroundOrigin.current.y,
           backgroundImg.current.naturalWidth * backgroundScale.current,
           backgroundImg.current.naturalHeight * backgroundScale.current
         )
       } else {
         ctx.drawImage(
           backgroundImg.current, 
           backgroundOrigin.current.x, 
           backgroundOrigin.current.y
         )
       }
    }

    // Strokes (Images first)
    strokes.forEach(s => {
      if (s.type === 'image') drawStrokeToContext(ctx, s)
    })
    // Then other strokes
    strokes.forEach(s => {
      if (s.type !== 'image') drawStrokeToContext(ctx, s)
    })
  }, [camera, strokes, backgroundContain, showGrid])

  const renderLive = useCallback(() => {
    if (!liveCanvasRef.current) return
    const canvas = liveCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.width
    const height = canvas.height

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)

    ctx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, camera.x * dpr, camera.y * dpr)

    if (activeAction.current) {
      if (activeAction.current.type === 'draw' && activeAction.current.stroke) {
        drawStrokeToContext(ctx, activeAction.current.stroke)
      } else if (activeAction.current.type === 'shape') {
        const start = activeAction.current.startPos
        const curr = activeAction.current.currentPos || start
        
        let x, y, w, h
        if (activeAction.current.shapeType === 'line') {
          drawStrokeToContext(ctx, {
            type: 'line',
            x: start.x,
            y: start.y,
            width: curr.x - start.x,
            height: curr.y - start.y,
            color: currentColor,
            size: currentSize,
            opacity: currentOpacity
          })
        } else {
          x = Math.min(start.x, curr.x)
          y = Math.min(start.y, curr.y)
          w = Math.abs(curr.x - start.x)
          h = Math.abs(curr.y - start.y)
          drawStrokeToContext(ctx, {
            type: activeAction.current.shapeType,
            x, y, width: w, height: h,
            color: currentColor,
            size: currentSize,
            opacity: currentOpacity
          })
        }
      } else if (activeAction.current.type === 'box_select' && selectionRect.current) {
         ctx.save()
         ctx.strokeStyle = '#3b82f6'
         ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
         ctx.lineWidth = 1 / camera.zoom
         ctx.strokeRect(selectionRect.current.x, selectionRect.current.y, selectionRect.current.w, selectionRect.current.h)
         ctx.fillRect(selectionRect.current.x, selectionRect.current.y, selectionRect.current.w, selectionRect.current.h)
         ctx.restore()
      }
    }

    // Transform controls if selected
    if (selectedIndices.size > 0 && currentMode === 'select' && groupBounds.current) {
       const b = groupBounds.current
       const zoom = camera.zoom
       const padding = 5 / zoom
       const handleSize = 8 / zoom
       const minX = b.minX - padding
       const minY = b.minY - padding
       const w = b.width + padding * 2
       const h = b.height + padding * 2
       
       ctx.save()
       ctx.strokeStyle = '#3b82f6'
       ctx.lineWidth = 1 / zoom
       ctx.setLineDash([4 / zoom, 4 / zoom])
       ctx.strokeRect(minX, minY, w, h)
       ctx.restore()

       const handles = [
         { x: minX, y: minY }, { x: minX + w/2, y: minY }, { x: minX + w, y: minY },
         { x: minX + w, y: minY + h/2 }, { x: minX + w, y: minY + h }, { x: minX + w/2, y: minY + h },
         { x: minX, y: minY + h }, { x: minX, y: minY + h/2 }
       ]
       ctx.fillStyle = '#ffffff'
       ctx.strokeStyle = '#3b82f6'
       ctx.lineWidth = 1 / zoom
       handles.forEach(hd => {
         ctx.fillRect(hd.x - handleSize/2, hd.y - handleSize/2, handleSize, handleSize)
         ctx.strokeRect(hd.x - handleSize/2, hd.y - handleSize/2, handleSize, handleSize)
       })
    }
  }, [camera, currentColor, currentSize, currentOpacity, currentMode, selectedIndices])

  const requestRenderAll = useCallback(() => {
    renderHistory()
    renderLive()
  }, [renderHistory, renderLive])

  useEffect(() => {
    requestRenderAll()
  }, [requestRenderAll])

  // Lifecycle
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !liveCanvasRef.current || !historyCanvasRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const scale = enableBuffer ? 1.2 : 1.0
      const width = rect.width * scale
      const height = rect.height * scale

      ;[liveCanvasRef.current, historyCanvasRef.current].forEach(cvs => {
        cvs.width = width * dpr
        cvs.height = height * dpr
        cvs.style.width = `${width}px`
        cvs.style.height = `${height}px`
      })
      requestRenderAll()
    }

    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [enableBuffer, requestRenderAll])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (inputState.visible) return
    if (currentMode === 'askAi') return

    if (liveCanvasRef.current) {
      liveCanvasRef.current.setPointerCapture(e.pointerId)
    }
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      activeAction.current = {
        type: 'gesture',
        startDist: getDistance(pts[0], pts[1]),
        startZoom: camera.zoom,
        startCenter: getCenter(pts[0], pts[1]),
        startCamera: { ...camera },
      }
      return
    }

    if (activePointers.current.size > 2) return

    if (isSpacePressed || currentMode === 'hand' || disabled) {
      activeAction.current = { type: 'pan', lastPos: { x: e.clientX, y: e.clientY } }
      return
    }

    if (disabled) return

    const worldPos = screenToWorld(e.clientX, e.clientY)

    if (currentMode === 'text') {
      startTextInput(worldPos.x, worldPos.y)
      return
    }

    if (currentMode === 'select') {
      const handle = getHandleAtPosition(worldPos.x, worldPos.y)
      if (handle) {
        activeHandle.current = handle
        activeAction.current = {
          type: 'resize',
          handle: handle,
          startPos: worldPos,
          startBounds: { ...groupBounds.current },
          snapshotStrokes: Array.from(selectedIndices).map((i) =>
            JSON.parse(JSON.stringify(strokes[i]))
          ),
        }
        return
      }

      if (selectedIndices.size > 0 && groupBounds.current && isPointInSelectionBounds(worldPos.x, worldPos.y)) {
        activeAction.current = { type: 'move', lastPos: worldPos }
        return
      }

      const hitIndex = hitTest(worldPos.x, worldPos.y)
      if (hitIndex !== -1) {
        setSelectedIndices(prev => {
           if (prev.has(hitIndex)) return prev
           const next = new Set<number>()
           next.add(hitIndex)
           return next
        })
        activeAction.current = { type: 'move', lastPos: worldPos }
        requestRenderAll()
      } else {
        setSelectedIndices(new Set())
        if (selectMode === 'freeform') {
          activeAction.current = { type: 'freeform_select', path: [worldPos] }
        } else {
          activeAction.current = { type: 'box_select', startPos: worldPos }
          selectionRect.current = { x: worldPos.x, y: worldPos.y, w: 0, h: 0 }
        }
        renderLive()
      }
    } else if (currentMode === 'eraser-stroke') {
      const hitIndex = hitTest(worldPos.x, worldPos.y, currentSize / 2)
      if (hitIndex !== -1 && strokes[hitIndex]?.type !== 'image') {
        setStrokes(prev => {
           const next = [...prev]
           next.splice(hitIndex, 1)
           return next
        })
        saveState()
      }
      activeAction.current = { type: 'erase' }
    } else if (['rectangle', 'circle', 'triangle', 'line', 'coordinate'].includes(currentMode)) {
      setSelectedIndices(new Set())
      groupBounds.current = null
      activeAction.current = {
        type: 'shape',
        shapeType: currentMode,
        startPos: worldPos,
        currentPos: worldPos,
      }
      renderLive()
    } else {
      setSelectedIndices(new Set())
      groupBounds.current = null
      const newStroke = {
        type: 'stroke',
        points: [{ x: worldPos.x, y: worldPos.y }],
        color: currentColor,
        size: currentSize,
        opacity: currentOpacity,
        mode: currentMode,
        bounds: { minX: worldPos.x, maxX: worldPos.x, minY: worldPos.y, maxY: worldPos.y },
      }
      activeAction.current = { type: 'draw', stroke: newStroke }
      renderLive()
    }
  }

  const handlePointerMove = (e: PointerEvent) => {
    const wp = screenToWorld(e.clientX, e.clientY)
    setHoverPos(wp)

    if (currentMode === 'eraser-stroke') {
      const sketchpadWrapper = containerRef.current?.parentElement
      if (sketchpadWrapper) {
        const rect = sketchpadWrapper.getBoundingClientRect()
        setEraserCursor({
          x: e.clientX - rect.left - (currentSize * camera.zoom) / 2,
          y: e.clientY - rect.top - (currentSize * camera.zoom) / 2,
          size: currentSize * camera.zoom,
          visible: true,
        })
      }
    } else {
      setEraserCursor(prev => ({ ...prev, visible: false }))
    }

    if (!activePointers.current.has(e.pointerId)) {
      if (!activeAction.current && currentMode === 'select') {
        const handle = getHandleAtPosition(wp.x, wp.y)
        if (handle) {
          // cursor style is handled by cursorClass computed value
        } else if (selectedIndices.size > 0 && groupBounds.current && isPointInSelectionBounds(wp.x, wp.y)) {
          if (liveCanvasRef.current) liveCanvasRef.current.style.cursor = 'move'
        } else {
          if (liveCanvasRef.current) liveCanvasRef.current.style.cursor = 'default'
        }
      }
      return
    }

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (!activeAction.current) return

    if (activeAction.current.type === 'gesture') {
      if (activePointers.current.size < 2) return
      const pts = Array.from(activePointers.current.values())
      const dist = getDistance(pts[0], pts[1])
      if (!activeAction.current.startDist || dist === 0) return
      
      const center = getCenter(pts[0], pts[1])
      const scaleFactor = dist / activeAction.current.startDist
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, activeAction.current.startZoom * scaleFactor))
      const rect = liveCanvasRef.current!.getBoundingClientRect()
      const startCenterRel = {
        x: activeAction.current.startCenter.x - rect.left,
        y: activeAction.current.startCenter.y - rect.top,
      }
      const wx = (startCenterRel.x - activeAction.current.startCamera.x) / activeAction.current.startZoom
      const wy = (startCenterRel.y - activeAction.current.startCamera.y) / activeAction.current.startZoom
      const newCenterRel = { x: center.x - rect.left, y: center.y - rect.top }
      setCamera({
        zoom: newZoom,
        x: newCenterRel.x - wx * newZoom,
        y: newCenterRel.y - wy * newZoom
      })
      requestRenderAll()
    } else if (activeAction.current.type === 'pan') {
      const dx = e.clientX - activeAction.current.lastPos.x
      const dy = e.clientY - activeAction.current.lastPos.y
      setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
      activeAction.current.lastPos = { x: e.clientX, y: e.clientY }
      requestRenderAll()
    } else if (activeAction.current.type === 'draw') {
      const stroke = activeAction.current.stroke
      const p = screenToWorld(e.clientX, e.clientY)
      stroke.points.push(p)
      stroke.bounds.minX = Math.min(stroke.bounds.minX, p.x)
      stroke.bounds.maxX = Math.max(stroke.bounds.maxX, p.x)
      stroke.bounds.minY = Math.min(stroke.bounds.minY, p.y)
      stroke.bounds.maxY = Math.max(stroke.bounds.maxY, p.y)
      renderLive()
    } else if (activeAction.current.type === 'move') {
      const dx = wp.x - activeAction.current.lastPos.x
      const dy = wp.y - activeAction.current.lastPos.y
      setStrokes(prev => {
        const next = [...prev]
        selectedIndices.forEach(idx => {
          const obj = { ...next[idx] }
          if (obj.type === 'text' || ['rectangle', 'circle', 'triangle', 'line', 'coordinate', 'image'].includes(obj.type)) {
            obj.x += dx
            obj.y += dy
            obj.bounds = { ...obj.bounds, minX: obj.bounds.minX + dx, maxX: obj.bounds.maxX + dx, minY: obj.bounds.minY + dy, maxY: obj.bounds.maxY + dy }
          } else {
            obj.points = obj.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy }))
            obj.bounds = { ...obj.bounds, minX: obj.bounds.minX + dx, maxX: obj.bounds.maxX + dx, minY: obj.bounds.minY + dy, maxY: obj.bounds.maxY + dy }
          }
          next[idx] = obj
        })
        return next
      })
      groupBounds.current = getGroupBounds(selectedIndices)
      activeAction.current.lastPos = wp
      requestRenderAll()
    } else if (activeAction.current.type === 'box_select') {
      const sx = activeAction.current.startPos.x
      const sy = activeAction.current.startPos.y
      selectionRect.current = {
        x: Math.min(sx, wp.x),
        y: Math.min(sy, wp.y),
        w: Math.abs(wp.x - sx),
        h: Math.abs(wp.y - sy),
      }
      renderLive()
    } else if (activeAction.current.type === 'freeform_select') {
      activeAction.current.path.push(wp)
      renderLive()
    } else if (activeAction.current.type === 'shape') {
      activeAction.current.currentPos = wp
      renderLive()
    } else if (activeAction.current.type === 'resize') {
      handleResize(wp)
    } else if (activeAction.current.type === 'erase') {
      const hitIndex = hitTest(wp.x, wp.y, currentSize / 2)
      if (hitIndex !== -1 && strokes[hitIndex]?.type !== 'image') {
        setStrokes(prev => {
          const next = [...prev]
          next.splice(hitIndex, 1)
          return next
        })
        requestRenderAll()
      }
    }
  }

  const endAction = (e: PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size === 0 && activeAction.current) {
      if (activeAction.current.type === 'box_select') {
        const indices = hitTestRect(selectionRect.current)
        setSelectedIndices(new Set(indices))
        selectionRect.current = null
      } else if (activeAction.current.type === 'freeform_select') {
        const indices = hitTestFreeform(activeAction.current.path)
        setSelectedIndices(new Set(indices))
      } else if (activeAction.current.type === 'draw') {
        setStrokes(prev => [...prev, activeAction.current.stroke])
        saveState()
      } else if (activeAction.current.type === 'shape') {
        const wp = activeAction.current.currentPos || activeAction.current.startPos
        const start = activeAction.current.startPos
        let x, y, width, height
        if (activeAction.current.shapeType === 'line') {
          x = start.x
          y = start.y
          width = wp.x - x
          height = wp.y - y
        } else {
          x = Math.min(start.x, wp.x)
          y = Math.min(start.y, wp.y)
          width = Math.abs(wp.x - start.x)
          height = Math.abs(wp.y - start.y)
        }
        if (Math.abs(width) > 2 || Math.abs(height) > 2) {
          const shape = {
            type: activeAction.current.shapeType,
            x, y, width, height,
            color: currentColor,
            size: currentSize,
            opacity: currentOpacity,
            bounds: {
              minX: Math.min(x, x + width),
              maxX: Math.max(x, x + width),
              minY: Math.min(y, y + height),
              maxY: Math.max(y, y + height),
            },
          }
          setStrokes(prev => [...prev, shape])
          saveState()
        }
      }
      activeAction.current = null
      activeHandle.current = null
      requestRenderAll()
    }
  }

  const ensureBoundsForStroke = (obj: any) => {
    if (!obj) return
    if (obj.bounds) return

    if ((!obj.type || obj.type === 'stroke') && Array.isArray(obj.points) && obj.points.length) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      obj.points.forEach((p: any) => {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      })
      if (minX !== Infinity) obj.bounds = { minX, minY, maxX, maxY }
      return
    }
    if (typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.width === 'number' && typeof obj.height === 'number') {
      const minX = Math.min(obj.x, obj.x + obj.width)
      const maxX = Math.max(obj.x, obj.x + obj.width)
      const minY = Math.min(obj.y, obj.y + obj.height)
      const maxY = Math.max(obj.y, obj.y + obj.height)
      obj.bounds = { minX, minY, maxX, maxY }
      return
    }
    if (obj.type === 'image' && typeof obj.x === 'number' && typeof obj.y === 'number') {
      const w = typeof obj.width === 'number' ? obj.width : 0
      const h = typeof obj.height === 'number' ? obj.height : 0
      obj.bounds = { minX: obj.x, minY: obj.y, maxX: obj.x + w, maxY: obj.y + h }
      return
    }
    if (obj.type === 'text' && typeof obj.x === 'number' && typeof obj.y === 'number') {
      const fontSize = typeof obj.fontSize === 'number' ? obj.fontSize : 16
      const text = (obj.text || '').toString()
      const approxWidth = Math.max(1, text.length) * fontSize * 0.6
      obj.bounds = { minX: obj.x, minY: obj.y - fontSize, maxX: obj.x + approxWidth, maxY: obj.y }
    }
  }

  const getDistance = (p1: any, p2: any) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
  const getCenter = (p1: any, p2: any) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 })

  const getGroupBounds = (indices: Set<number>) => {
    if (!indices || indices.size === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    indices.forEach((idx) => {
      const s = strokes[idx]
      if (s && s.bounds) {
        minX = Math.min(minX, s.bounds.minX)
        minY = Math.min(minY, s.bounds.minY)
        maxX = Math.max(maxX, s.bounds.maxX)
        maxY = Math.max(maxY, s.bounds.maxY)
      }
    })
    if (minX === Infinity) return null
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
  }

  const getHandleAtPosition = (wx: number, wy: number) => {
    if (!groupBounds.current || selectedIndices.size === 0) return null
    const zoom = camera.zoom
    const padding = 5 / zoom
    const handleSize = 8 / zoom
    const hitRadius = Math.max(10 / zoom, handleSize)

    const minX = groupBounds.current.minX - padding
    const minY = groupBounds.current.minY - padding
    const width = groupBounds.current.width + padding * 2
    const height = groupBounds.current.height + padding * 2
    const maxX = minX + width
    const maxY = minY + height
    const midX = minX + width / 2
    const midY = minY + height / 2

    const handles = [
      { x: minX, y: minY, type: 'nw' },
      { x: midX, y: minY, type: 'n' },
      { x: maxX, y: minY, type: 'ne' },
      { x: maxX, y: midY, type: 'e' },
      { x: maxX, y: maxY, type: 'se' },
      { x: midX, y: maxY, type: 's' },
      { x: minX, y: maxY, type: 'sw' },
      { x: minX, y: midY, type: 'w' },
    ]

    for (const h of handles) {
      if (Math.abs(wx - h.x) <= hitRadius && Math.abs(wy - h.y) <= hitRadius) return h.type
    }
    return null
  }

  const isPointInPolygon = (x: number, y: number, polygon: Point[]) => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  const distToSegment = (wx: number, wy: number, p1: Point, p2: Point) => {
    const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
    if (l2 === 0) return Math.sqrt((wx - p1.x) ** 2 + (wy - p1.y) ** 2)
    let t = ((wx - p1.x) * (p2.x - p1.x) + (wy - p1.y) * (p2.y - p1.y)) / l2
    t = Math.max(0, Math.min(1, t))
    return Math.sqrt((wx - (p1.x + t * (p2.x - p1.x))) ** 2 + (wy - (p1.y + t * (p2.y - p1.y))) ** 2)
  }

  const handleResize = (currPos: Point) => {
    if (!activeAction.current || activeAction.current.type !== 'resize') return
    const { startBounds, handle, snapshotStrokes } = activeAction.current
    const indices = Array.from(selectedIndices)
    const newBounds = { ...startBounds }
    const dx = currPos.x - activeAction.current.startPos.x
    const dy = currPos.y - activeAction.current.startPos.y

    if (handle.includes('e')) newBounds.width += dx
    if (handle.includes('s')) newBounds.height += dy
    if (handle.includes('w')) {
      newBounds.minX += dx
      newBounds.width -= dx
    }
    if (handle.includes('n')) {
      newBounds.minY += dy
      newBounds.height -= dy
    }

    if (newBounds.width < 10) {
      newBounds.width = 10
      if (handle.includes('w')) newBounds.minX = startBounds.maxX - 10
    }
    if (newBounds.height < 10) {
      newBounds.height = 10
      if (handle.includes('n')) newBounds.minY = startBounds.maxY - 10
    }
    newBounds.maxX = newBounds.minX + newBounds.width
    newBounds.maxY = newBounds.minY + newBounds.height

    const scaleX = newBounds.width / startBounds.width
    const scaleY = newBounds.height / startBounds.height

    setStrokes(prev => {
      const next = [...prev]
      indices.forEach((idx, i) => {
        const original = snapshotStrokes[i]
        const target = { ...next[idx] }

        if (target.type === 'text') {
          const relX = (original.x - startBounds.minX) / startBounds.width
          const relY = (original.y - startBounds.minY) / startBounds.height
          target.x = newBounds.minX + relX * newBounds.width
          target.y = newBounds.minY + relY * newBounds.height
          target.size = original.size * Math.min(Math.abs(scaleX), Math.abs(scaleY))
          target.bounds = { ...target.bounds, minX: target.x, minY: target.y }
        } else if (['rectangle', 'circle', 'triangle', 'line', 'coordinate'].includes(target.type)) {
          const relX = (original.x - startBounds.minX) / startBounds.width
          const relY = (original.y - startBounds.minY) / startBounds.height
          target.x = newBounds.minX + relX * newBounds.width
          target.y = newBounds.minY + relY * newBounds.height
          target.width = original.width * scaleX
          target.height = original.height * scaleY
          target.size = original.size * Math.min(Math.abs(scaleX), Math.abs(scaleY))
          target.bounds = {
            minX: Math.min(target.x, target.x + target.width),
            maxX: Math.max(target.x, target.x + target.width),
            minY: Math.min(target.y, target.y + target.height),
            maxY: Math.max(target.y, target.y + target.height),
          }
        } else if (target.type === 'image') {
          const relX = (original.x - startBounds.minX) / startBounds.width
          const relY = (original.y - startBounds.minY) / startBounds.height
          target.x = newBounds.minX + relX * newBounds.width
          target.y = newBounds.minY + relY * newBounds.height
          target.width = original.width * scaleX
          target.height = original.height * scaleY
          target.bounds = {
            minX: Math.min(target.x, target.x + target.width),
            maxX: Math.max(target.x, target.x + target.width),
            minY: Math.min(target.y, target.y + target.height),
            maxY: Math.max(target.y, target.y + target.height),
          }
        } else {
          target.points = original.points.map((p: any) => {
            const relX = (p.x - startBounds.minX) / startBounds.width
            const relY = (p.y - startBounds.minY) / startBounds.height
            return {
              x: newBounds.minX + relX * newBounds.width,
              y: newBounds.minY + relY * newBounds.height,
            }
          })
          target.size = (original.size * (Math.abs(scaleX) + Math.abs(scaleY))) / 2
          let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity
          target.points.forEach((p: any) => {
            if (p.x < bMinX) bMinX = p.x
            if (p.x > bMaxX) bMaxX = p.x
            if (p.y < bMinY) bMinY = p.y
            if (p.y > bMaxY) bMaxY = p.y
          })
          target.bounds = { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY }
        }
        next[idx] = target
      })
      return next
    })
    groupBounds.current = getGroupBounds(new Set(indices))
    requestRenderAll()
  }

  const isPointInSelectionBounds = (x: number, y: number) => {
    if (!groupBounds.current) return false
    const b = groupBounds.current
    const padding = 5 / camera.zoom
    return x >= b.minX - padding && x <= b.maxX + padding && y >= b.minY - padding && y <= b.maxY + padding
  }

  const hitTest = (wx: number, wy: number, extraRadius = 0) => {
    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i]
      if (!s.bounds) continue
      const padding = 10 / camera.zoom + extraRadius
      if (wx >= s.bounds.minX - padding && wx <= s.bounds.maxX + padding && wy >= s.bounds.minY - padding && wy <= s.bounds.maxY + padding) {
        return i
      }
    }
    return -1
  }

  const hitTestRect = (rect: any) => {
    const indices: number[] = []
    if (!rect) return indices
    const minX = Math.min(rect.x, rect.x + rect.w), maxX = Math.max(rect.x, rect.x + rect.w)
    const minY = Math.min(rect.y, rect.y + rect.h), maxY = Math.max(rect.y, rect.y + rect.h)
    strokes.forEach((s, i) => {
      ensureBoundsForStroke(s)
      if (s.bounds && s.bounds.minX >= minX && s.bounds.maxX <= maxX && s.bounds.minY >= minY && s.bounds.maxY <= maxY) {
        indices.push(i)
      }
    })
    return indices
  }

  const hitTestFreeform = (path: Point[]) => {
    if (!path || path.length < 3) return []

    const indices: number[] = []
    strokes.forEach((s, i) => {
      ensureBoundsForStroke(s)
      if (!s.bounds) return
      const { minX, minY, maxX, maxY } = s.bounds
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      const testPoints = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
        { x: centerX, y: centerY },
        { x: centerX, y: minY },
        { x: maxX, y: centerY },
        { x: centerX, y: maxY },
        { x: minX, y: centerY },
      ]

      if (testPoints.some((point) => isPointInPolygon(point.x, point.y, path))) {
        indices.push(i)
      }
    })

    return indices
  }

  const selectedImageIndex = useMemo(() => {
    if (selectedIndices.size !== 1) return null
    const idx = Array.from(selectedIndices)[0]
    const obj = strokes[idx]
    if (!obj || obj.type !== 'image') return null
    return idx
  }, [selectedIndices, strokes])

  const selectedImageDeleteButtonStyle = useMemo(() => {
    const idx = selectedImageIndex
    if (idx === null) return {}
    const obj = strokes[idx]
    const bounds = obj?.bounds
    if (!bounds || typeof bounds.maxX !== 'number' || typeof bounds.minY !== 'number') return {}
    const pos = worldToScreen(bounds.maxX, bounds.minY)
    return {
      left: `${pos.x}px`,
      top: `${pos.y}px`,
    }
  }, [selectedImageIndex, strokes, worldToScreen])

  const handleDeleteSelectedImage = () => {
    const idx = selectedImageIndex
    if (idx === null) return
    setStrokes(prev => {
      const next = [...prev]
      next.splice(idx, 1)
      return next
    })
    setSelectedIndices(new Set())
    groupBounds.current = null
    saveState()
    requestRenderAll()
  }

  const zoomToPoint = (clientX: number, clientY: number, newZoom: number) => {
    const oldZoom = camera.zoom
    const rect = liveCanvasRef.current!.getBoundingClientRect()
    const mouseX = clientX - rect.left
    const mouseY = clientY - rect.top
    const wx = (mouseX - camera.x) / oldZoom
    const wy = (mouseY - camera.y) / oldZoom
    setCamera({
      x: mouseX - wx * newZoom,
      y: mouseY - wy * newZoom,
      zoom: newZoom
    })
    requestRenderAll()
  }

  const fitToContent = () => {
    if (strokes.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 })
      return
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    strokes.forEach(s => {
      if (s.bounds) {
        minX = Math.min(minX, s.bounds.minX)
        minY = Math.min(minY, s.bounds.minY)
        maxX = Math.max(maxX, s.bounds.maxX)
        maxY = Math.max(maxY, s.bounds.maxY)
      }
    })
    if (minX === Infinity) return

    const rect = containerRef.current!.getBoundingClientRect()
    const contentW = maxX - minX
    const contentH = maxY - minY
    const padding = 40
    const zoom = Math.min((rect.width - padding) / contentW, (rect.height - padding) / contentH, 1)
    
    setCamera({
      zoom,
      x: (rect.width - contentW * zoom) / 2 - minX * zoom,
      y: (rect.height - contentH * zoom) / 2 - minY * zoom
    })
    requestRenderAll()
  }

  const getViewCenterWorld = () => {
    const rect = liveCanvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  const fileToDataUrl = (file: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const loadImageElement = (dataUrl: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = (err) => reject(err)
      img.src = dataUrl
    })
  }

  const insertImageFromFile = async (file: Blob, pos?: { x: number; y: number }) => {
    const dataUrl = await fileToDataUrl(file)
    const img = await loadImageElement(dataUrl)
    imageCache.current.set(dataUrl, img)

    const maxDisplayWidth = 420
    const scale = img.naturalWidth > maxDisplayWidth ? maxDisplayWidth / img.naturalWidth : 1
    const w = Math.max(1, img.naturalWidth * scale)
    const h = Math.max(1, img.naturalHeight * scale)

    const p = pos || getViewCenterWorld()
    const x = p.x - w / 2
    const y = p.y - h / 2

    const obj: any = {
      type: 'image',
      x,
      y,
      width: w,
      height: h,
      dataUrl,
      opacity: 1,
      bounds: { minX: x, minY: y, maxX: x + w, maxY: y + h },
    }

    setStrokes(prev => [...prev, obj])
    setSelectedIndices(new Set([strokes.length]))
    groupBounds.current = obj.bounds
    setCurrentMode('select')
    saveState()
    requestRenderAll()
  }

  const insertImageFromDataUrl = async (dataUrl: string, pos?: { x: number; y: number }) => {
    if (!dataUrl) return

    let img = imageCache.current.get(dataUrl)
    if (!img) {
      img = await loadImageElement(dataUrl)
      imageCache.current.set(dataUrl, img)
    }

    const maxDisplayWidth = 420
    const scale = img.naturalWidth > maxDisplayWidth ? maxDisplayWidth / img.naturalWidth : 1
    const w = Math.max(1, img.naturalWidth * scale)
    const h = Math.max(1, img.naturalHeight * scale)

    const p = pos || getViewCenterWorld()
    const x = p.x - w / 2
    const y = p.y - h / 2

    const obj: any = {
      type: 'image',
      x,
      y,
      width: w,
      height: h,
      dataUrl,
      opacity: 1,
      bounds: { minX: x, minY: y, maxX: x + w, maxY: y + h },
    }

    setStrokes(prev => [...prev, obj])
    setSelectedIndices(new Set([strokes.length]))
    groupBounds.current = obj.bounds
    setCurrentMode('select')
    saveState()
    requestRenderAll()
  }

  const exportStrokesOnly = () => {
    if (!strokes || strokes.length === 0) return ''

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let hasValidStroke = false

    strokes.forEach((s) => {
      if (s.type === 'image' || s.mode === 'eraser') return
      ensureBoundsForStroke(s)
      if (s.bounds) {
        minX = Math.min(minX, s.bounds.minX)
        minY = Math.min(minY, s.bounds.minY)
        maxX = Math.max(maxX, s.bounds.maxX)
        maxY = Math.max(maxY, s.bounds.maxY)
        hasValidStroke = true
      }
    })

    if (!hasValidStroke) return ''

    const padding = 10
    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return ''

    tempCtx.fillStyle = '#ffffff'
    tempCtx.fillRect(0, 0, width, height)

    tempCtx.save()
    tempCtx.translate(-minX + padding, -minY + padding)
    tempCtx.lineCap = 'round'
    tempCtx.lineJoin = 'round'

    strokes.forEach((s) => {
      if (s.type !== 'image') {
        drawStrokeToContext(tempCtx, s)
      }
    })
    tempCtx.restore()

    return tempCanvas.toDataURL('image/png')
  }

  const exportToPng = () => {
    const strokesOnly = exportStrokesOnly()
    if (strokesOnly) return strokesOnly

    if (!liveCanvasRef.current) return ''
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = liveCanvasRef.current.width
    tempCanvas.height = liveCanvasRef.current.height
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return ''
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    if (historyCanvasRef.current) ctx.drawImage(historyCanvasRef.current, 0, 0)
    ctx.drawImage(liveCanvasRef.current, 0, 0)
    return tempCanvas.toDataURL('image/png')
  }

  const exportToJpg = (quality = 0.9) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    if (backgroundImg.current && backgroundLoaded.current) {
      const w = backgroundContain
        ? backgroundImg.current.naturalWidth * backgroundScale.current
        : backgroundImg.current.naturalWidth || backgroundImg.current.width
      const h = backgroundContain
        ? backgroundImg.current.naturalHeight * backgroundScale.current
        : backgroundImg.current.naturalHeight || backgroundImg.current.height

      minX = Math.min(minX, backgroundOrigin.current.x)
      minY = Math.min(minY, backgroundOrigin.current.y)
      maxX = Math.max(maxX, backgroundOrigin.current.x + w)
      maxY = Math.max(maxY, backgroundOrigin.current.y + h)
    }
    strokes.forEach((s) => {
      if (s.mode === 'eraser') return
      ensureBoundsForStroke(s)
      if (s.bounds) {
        minX = Math.min(minX, s.bounds.minX)
        minY = Math.min(minY, s.bounds.minY)
        maxX = Math.max(maxX, s.bounds.maxX)
        maxY = Math.max(maxY, s.bounds.maxY)
      }
    })
    if (minX === Infinity) {
      if (!liveCanvasRef.current) return ''
      const rect = liveCanvasRef.current.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width)),
        height = Math.max(1, Math.round(rect.height))
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      const cx = c.getContext('2d')
      if (!cx) return ''
      cx.fillStyle = '#ffffff'
      cx.fillRect(0, 0, width, height)
      return c.toDataURL('image/jpeg', quality)
    }
    const padding = 40
    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return ''
    tempCtx.fillStyle = '#ffffff'
    tempCtx.fillRect(0, 0, width, height)
    tempCtx.save()
    tempCtx.translate(-minX + padding, -minY + padding)
    tempCtx.lineCap = 'round'
    tempCtx.lineJoin = 'round'
    if (backgroundImg.current && backgroundLoaded.current) {
      if (backgroundContain) {
        tempCtx.drawImage(
          backgroundImg.current,
          backgroundOrigin.current.x,
          backgroundOrigin.current.y,
          backgroundImg.current.naturalWidth * backgroundScale.current,
          backgroundImg.current.naturalHeight * backgroundScale.current
        )
      } else {
        tempCtx.drawImage(backgroundImg.current, backgroundOrigin.current.x, backgroundOrigin.current.y)
      }
    }
    strokes.forEach((s) => drawStrokeToContext(tempCtx, s))
    tempCtx.restore()
    return tempCanvas.toDataURL('image/jpeg', quality)
  }

  const getThumbnail = (width = 300, height = 200) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    strokes.forEach((s) => {
      if (s.mode === 'eraser') return
      if (s.bounds) {
        minX = Math.min(minX, s.bounds.minX)
        minY = Math.min(minY, s.bounds.minY)
        maxX = Math.max(maxX, s.bounds.maxX)
        maxY = Math.max(maxY, s.bounds.maxY)
      }
    })
    if (minX === Infinity) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return ''
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      return canvas.toDataURL('image/png')
    }
    const padding = 20
    const contentWidth = maxX - minX + padding * 2
    const contentHeight = maxY - minY + padding * 2
    const scale = Math.min(width / contentWidth, height / contentHeight)
    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = width
    thumbCanvas.height = height
    const thumbCtx = thumbCanvas.getContext('2d')
    if (!thumbCtx) return ''
    thumbCtx.fillStyle = '#ffffff'
    thumbCtx.fillRect(0, 0, width, height)
    thumbCtx.save()
    thumbCtx.translate(padding, padding)
    thumbCtx.scale(scale, scale)
    thumbCtx.translate(-minX, -minY)
    strokes.forEach((s) => drawStrokeToContext(thumbCtx, s))
    thumbCtx.restore()
    return thumbCanvas.toDataURL('image/png')
  }

  const saveState = () => {
    const snapshot = JSON.stringify(strokes)
    setHistoryDataAndNotify(prev => {
       const next = [...prev.slice(0, historyStep + 1), snapshot]
       if (next.length > MAX_HISTORY) next.shift()
       return next
    })
    setHistoryStepAndNotify(prev => Math.min(prev + 1, MAX_HISTORY - 1))
    
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      onSave?.({ objects: strokes, history: historyData, historyIndex: historyStep })
    }, AUTO_SAVE_DELAY_MS)
  }

  const startTextInput = (worldX: number, worldY: number) => {
    const screenPos = worldToScreen(worldX, worldY)
    setInputState({
      visible: true,
      x: screenPos.x,
      y: screenPos.y,
      worldX,
      worldY,
      text: '',
      color: currentColor,
      fontSize: currentSize * 5 * camera.zoom,
      height: 'auto'
    })
    setTimeout(() => textInputRef.current?.focus(), 0)
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const zoomIntensity = 0.1
    const delta = -Math.sign(e.deltaY)
    const scale = Math.exp(delta * zoomIntensity)
    const oldZoom = camera.zoom
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * scale))
    const rect = liveCanvasRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const wx = (mouseX - camera.x) / oldZoom
    const wy = (mouseY - camera.y) / oldZoom
    setCamera({
      x: mouseX - wx * newZoom,
      y: mouseY - wy * newZoom,
      zoom: newZoom
    })
    requestRenderAll()
  }, [camera, requestRenderAll, MIN_ZOOM, MAX_ZOOM])

  const handleAskAiPointerDown = (e: React.PointerEvent) => {
    if (currentMode !== 'askAi') return
    const wp = screenToWorld(e.clientX, e.clientY)
    setAskAiStartPoint(wp)
    if (selectMode === 'freeform') {
      setAskAiDragPath([wp])
    } else {
      setAskAiDragRect({ x: wp.x, y: wp.y, w: 0, h: 0 })
    }
  }

  const handleAskAiPointerMove = (e: React.PointerEvent) => {
    if (currentMode !== 'askAi' || !askAiStartPoint) return
    const wp = screenToWorld(e.clientX, e.clientY)
    if (selectMode === 'freeform') {
      setAskAiDragPath(prev => prev ? [...prev, wp] : [wp])
    } else {
      setAskAiDragRect({
        x: Math.min(askAiStartPoint.x, wp.x),
        y: Math.min(askAiStartPoint.y, wp.y),
        w: Math.abs(wp.x - askAiStartPoint.x),
        h: Math.abs(wp.y - askAiStartPoint.y)
      })
    }
  }

  const resetAskAiSelection = () => {
    setAskAiStartPoint(null)
    setAskAiDragRect(null)
    setAskAiDragPath(null)
  }

  const takeAskAiScreenshotFreeform = (path: Point[]) => {
    if (!historyCanvasRef.current || !liveCanvasRef.current || !path.length) {
      resetAskAiSelection()
      return
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    path.forEach((p) => {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    })

    const w = maxX - minX
    const h = maxY - minY
    if (w < 5 || h < 5) {
      resetAskAiSelection()
      return
    }

    const dpr = window.devicePixelRatio || 1
    const zoom = camera.zoom
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = Math.round(w * zoom * dpr)
    tempCanvas.height = Math.round(h * zoom * dpr)
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) {
      resetAskAiSelection()
      return
    }

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

    ctx.save()
    ctx.beginPath()
    path.forEach((p, idx) => {
      const lx = (p.x - minX) * zoom * dpr
      const ly = (p.y - minY) * zoom * dpr
      if (idx === 0) ctx.moveTo(lx, ly)
      else ctx.lineTo(lx, ly)
    })
    ctx.closePath()
    ctx.clip()

    const sx = (minX * zoom + camera.x) * dpr
    const sy = (minY * zoom + camera.y) * dpr
    const sw = w * zoom * dpr
    const sh = h * zoom * dpr
    ctx.drawImage(historyCanvasRef.current, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height)
    ctx.drawImage(liveCanvasRef.current, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height)
    ctx.restore()

    const dataUrl = tempCanvas.toDataURL('image/png')

    onAskAiImageSelected?.({
      filePath: '',
      width: Math.round(w * zoom),
      height: Math.round(h * zoom),
      fileSize: 0,
      base64DataUrl: dataUrl,
    })

    resetAskAiSelection()
  }

  const takeAskAiScreenshot = (rect: { x: number; y: number; w: number; h: number }) => {
    if (!historyCanvasRef.current || !liveCanvasRef.current) {
      resetAskAiSelection()
      return
    }

    const dpr = window.devicePixelRatio || 1
    const zoom = camera.zoom
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = Math.round(rect.w * zoom * dpr)
    tempCanvas.height = Math.round(rect.h * zoom * dpr)
    const ctx = tempCanvas.getContext('2d')

    if (!ctx) {
      resetAskAiSelection()
      return
    }

    const sx = (rect.x * zoom + camera.x) * dpr
    const sy = (rect.y * zoom + camera.y) * dpr
    const sw = rect.w * zoom * dpr
    const sh = rect.h * zoom * dpr

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

    ctx.drawImage(historyCanvasRef.current, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height)
    ctx.drawImage(liveCanvasRef.current, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height)

    const dataUrl = tempCanvas.toDataURL('image/png')

    onAskAiImageSelected?.({
      filePath: '',
      width: Math.round(rect.w * zoom),
      height: Math.round(rect.h * zoom),
      fileSize: 0,
      base64DataUrl: dataUrl,
    })

    resetAskAiSelection()
  }

  const handleAskAiPointerUp = () => {
    if (currentMode !== 'askAi') return
    if (selectMode === 'freeform') {
      if (askAiDragPath && askAiDragPath.length >= 3) {
        takeAskAiScreenshotFreeform(askAiDragPath)
        return
      }
      resetAskAiSelection()
      return
    }

    if (askAiDragRect && askAiDragRect.w >= 5 && askAiDragRect.h >= 5) {
      takeAskAiScreenshot(askAiDragRect)
    } else {
      resetAskAiSelection()
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (inputState.visible) return
    if (e.code === 'Space') {
      setIsSpacePressed(true)
      if (e.target instanceof HTMLBodyElement) e.preventDefault()
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    if (e.code === 'Delete' || e.code === 'Backspace') {
      if (selectedIndices.size > 0) {
        setStrokes(prev => {
          const next = [...prev]
          const sortedIndices = Array.from(selectedIndices).sort((a, b) => b - a)
          sortedIndices.forEach(idx => next.splice(idx, 1))
          return next
        })
        setSelectedIndices(new Set())
        groupBounds.current = null
        saveState()
        requestRenderAll()
      }
    }
  }

  const handleKeyup = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      setIsSpacePressed(false)
    }
  }

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items || !items.length) return
    for (const item of Array.from(items)) {
      if (item.type && item.type.startsWith('image/')) {
        const blob = item.getAsFile()
        if (!blob) continue
        const wp = hoverPos || getViewCenterWorld()
        await insertImageFromFile(blob, wp)
        break
      }
    }
  }

  const handleDragOver = (e: DragEvent) => {
    if (!e.dataTransfer) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = async (e: DragEvent) => {
    if (!e.dataTransfer) return
    e.preventDefault()
    const file = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith('image/'))
    if (!file) return
    const wp = screenToWorld(e.clientX, e.clientY)
    await insertImageFromFile(file, wp)
  }

  useEffect(() => {
    const canvas = liveCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', endAction)
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup', handleKeyup)
    window.addEventListener('paste', handlePaste)
    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('drop', handleDrop)

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', endAction)
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('keyup', handleKeyup)
      window.removeEventListener('paste', handlePaste)
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('drop', handleDrop)
    }
  }, [handleWheel, handlePointerMove, endAction, handleKeydown, handleKeyup, handlePaste, handleDragOver, handleDrop])

  
  const undo = useCallback(() => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1
      setHistoryStepAndNotify(prevStep)
      const data = JSON.parse(historyData[prevStep])
      setStrokes(data)
      setSelectedIndices(new Set())
      groupBounds.current = null
      requestRenderAll()
    }
  }, [historyStep, historyData, requestRenderAll])

  const redo = useCallback(() => {
    if (historyStep < historyData.length - 1) {
      const nextStep = historyStep + 1
      setHistoryStepAndNotify(nextStep)
      const data = JSON.parse(historyData[nextStep])
      setStrokes(data)
      setSelectedIndices(new Set())
      groupBounds.current = null
      requestRenderAll()
    }
  }, [historyStep, historyData, requestRenderAll])

  const handleToolbarToolChange = (tool: string) => {
    if (tool === 'clear') {
      setShowClearConfirm(true)
      return
    }
    if (tool === 'undo') {
       undo()
       onUndo?.()
       return
    }
    if (tool === 'redo') {
       redo()
       onRedo?.()
       return
    }
    setModeAndNotify(tool)
    onToolChange?.(tool)
  }

  const handleToolbarConfigChange = (config: ToolConfigState) => {
    if (config.color) {
      setCurrentColor(config.color as string)
    }
    if (config.size) {
      setCurrentSize(config.size as number)
    }
    if (config.opacity) {
      setCurrentOpacity(config.opacity as number)
    }
    if (config.selectMode) {
      setSelectMode(config.selectMode as string)
    }
    notifyChange()
  }

  useImperativeHandle(ref, () => ({
    saveData: () => ({
      objects: strokes,
      history: historyData,
      historyIndex: historyStep
    }),
    loadData: (data: any) => {
      if (data?.objects) setStrokes(data.objects)
      if (data?.history) setHistoryData(data.history)
      if (typeof data?.historyIndex === 'number') setHistoryStep(data.historyIndex)
      requestRenderAll()
      notifyChange()
    },
    clearAll: () => {
      setStrokes([])
      setSelectedIndices(new Set())
      setHistoryDataAndNotify([JSON.stringify([])])
      setHistoryStepAndNotify(0)
      requestRenderAll()
    },
    undo,
    redo,
    exportToPng,
    exportToJpg,
    getThumbnail,
    exportStrokesOnly,
    getDataUrl: () => exportToPng(),
    handleToolbarToolChange,
    handleToolbarConfigChange,
    toolbarSelectedTool: currentMode,
    toolbarToolConfig: { color: currentColor, size: currentSize, opacity: currentOpacity, selectMode },
    canUndo: historyStep > 0,
    canRedo: historyStep < historyData.length - 1
  }))

  const cursorClass = useMemo(() => {
    if (isSpacePressed || (activeAction.current && activeAction.current.type === 'pan'))
      return 'cursor-grabbing'
    if (isSpacePressed || currentMode === 'hand') return 'cursor-grab'
    if (currentMode === 'eraser-stroke') return 'cursor-none'
    if (activeHandle.current) {
      if (activeHandle.current === 'nw' || activeHandle.current === 'se') return 'nwse-resize'
      if (activeHandle.current === 'ne' || activeHandle.current === 'sw') return 'nesw-resize'
      if (activeHandle.current === 'n' || activeHandle.current === 's') return 'ns-resize'
      if (activeHandle.current === 'w' || activeHandle.current === 'e') return 'ew-resize'
    }
    if (currentMode === 'select') return 'cursor-default'
    if (currentMode === 'text') return 'cursor-text'
    return 'cursor-crosshair'
  }, [isSpacePressed, currentMode])

  return (
    <div className="sketchpad-wrapper">
      {showToolbar && (
        <div className={`toolbar ${toolbarPosition === 'bottom' ? 'toolbar--bottom' : ''}`}>
          <div className="toolbar-slot toolbar-slot--left">
            {/* Slot for left toolbar content if needed */}
          </div>
          <div className="toolbar-center">
            <ToolbarNew
              tools={tools || ['undo', 'redo', 'clear', 'hand', 'select', 'draw', 'highlighter', 'eraser-stroke', 'insertImage', 'shape', 'coordinate']}
              selectedTool={currentMode}
              toolConfig={{ color: currentColor, size: currentSize, opacity: currentOpacity, selectMode }}
              onToolChange={handleToolbarToolChange}
              onConfigChange={handleToolbarConfigChange}
              onUndo={onUndo}
              onRedo={onRedo}
              onClear={() => setShowClearConfirm(true)}
              onInsertImage={async () => {
                 const img = await pickImage()
                 if (img?.base64DataUrl) {
                    await insertImageFromDataUrl(img.base64DataUrl)
                 }
              }}
            />
          </div>
          <div className="toolbar-slot toolbar-slot--right">
            {/* Slot for right toolbar content if needed */}
          </div>
        </div>
      )}

      <Dialog
        open={showClearConfirm}
        title="确认清空"
        onConfirm={() => {
          setStrokes([])
          setShowClearConfirm(false)
          onClear?.()
        }}
        onCancel={() => setShowClearConfirm(false)}
      >
        确定要清空画板上的所有内容吗？此操作不可撤销。
      </Dialog>

      <div
        ref={containerRef}
        className="canvas-container"
        style={{ touchAction: 'none' }}
        onPointerDown={handleAskAiPointerDown}
        onPointerMove={handleAskAiPointerMove}
        onPointerUp={handleAskAiPointerUp}
        onPointerCancel={handleAskAiPointerUp}
        onPointerLeave={handleAskAiPointerUp}
      >
        <canvas ref={historyCanvasRef} className="canvas-layer canvas-history" />
        <canvas
          ref={liveCanvasRef}
          className={`canvas-layer canvas-live ${cursorClass}`}
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerLeave={() => setHoverPos(null)}
          onPointerEnter={() => renderLive()}
        />
        
        {currentMode === 'askAi' && askAiDragRect && (
          <div 
            className="ask-ai-screenshot-overlay" 
            style={{
              left: askAiDragRect.x * camera.zoom + camera.x,
              top: askAiDragRect.y * camera.zoom + camera.y,
              width: askAiDragRect.w * camera.zoom,
              height: askAiDragRect.h * camera.zoom
            }}
          />
        )}

        {currentMode === 'askAi' && selectMode === 'freeform' && askAiDragPath && askAiDragPath.length > 0 && (
          <svg className="ask-ai-freeform-overlay" xmlns="http://www.w3.org/2000/svg">
            <path
              d={`M ${askAiDragPath[0].x * camera.zoom + camera.x} ${askAiDragPath[0].y * camera.zoom + camera.y} ` + 
                 askAiDragPath.slice(1).map(p => `L ${p.x * camera.zoom + camera.x} ${p.y * camera.zoom + camera.y}`).join(' ')}
              fill="rgba(110, 85, 255, 0.12)"
              stroke="#6e55ff"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}

        {inputState.visible && (
          <textarea
            ref={textInputRef}
            className="text-input"
            value={inputState.text}
            onChange={(e) => {
               setInputState(prev => ({ ...prev, text: e.target.value }))
               e.target.style.height = 'auto'
               e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={() => {
              if (inputState.text.trim()) {
                const newText = {
                  type: 'text',
                  x: inputState.worldX,
                  y: inputState.worldY,
                  text: inputState.text,
                  color: inputState.color,
                  size: currentSize,
                  bounds: {
                    minX: inputState.worldX,
                    maxX: inputState.worldX + inputState.text.length * inputState.fontSize * 0.6,
                    minY: inputState.worldY,
                    maxY: inputState.worldY + inputState.fontSize,
                  }
                }
                setStrokes(prev => [...prev, newText])
                saveState()
              }
              setInputState(prev => ({ ...prev, visible: false }))
            }}
            style={{
              left: inputState.x,
              top: inputState.y,
              fontSize: inputState.fontSize,
              color: inputState.color,
              height: inputState.height,
            }}
          />
        )}

        {selectedImageIndex !== null && (
          <button
            className="image-delete-btn"
            type="button"
            style={selectedImageDeleteButtonStyle}
            onPointerDown={e => e.stopPropagation()}
            onClick={handleDeleteSelectedImage}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {currentMode === 'eraser-stroke' && eraserCursor.visible && (
        <div
          className="eraser-cursor"
          style={{
            left: eraserCursor.x,
            top: eraserCursor.y,
            width: eraserCursor.size,
            height: eraserCursor.size,
          }}
        />
      )}

      {showZoomControls && (
        <div className="zoom-control-panel">
          <button className="zoom-btn zoom-out" onClick={() => setCamera(prev => ({ ...prev, zoom: Math.max(MIN_ZOOM, prev.zoom - 0.1) }))} disabled={camera.zoom <= MIN_ZOOM}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
             </svg>
          </button>
          <Select
            className="zoom-select"
            options={ZOOM_PRESET_OPTIONS}
            value={camera.zoom}
            onChange={(v) => {
               if (typeof v === 'number') {
                  const rect = liveCanvasRef.current?.getBoundingClientRect()
                  if (rect) {
                     zoomToPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, v)
                  } else {
                     setCamera(prev => ({ ...prev, zoom: v }))
                  }
               }
            }}
            renderLabel={() => `${Math.round(camera.zoom * 100)}%`}
          />
          <button className="zoom-btn zoom-in" onClick={() => setCamera(prev => ({ ...prev, zoom: Math.min(MAX_ZOOM, prev.zoom + 0.1) }))} disabled={camera.zoom >= MAX_ZOOM}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
             </svg>
          </button>
          <button className="zoom-btn zoom-fit" onClick={fitToContent} title="适应内容">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="8 3 3 3 3 8"></polyline>
              <polyline points="16 3 21 3 21 8"></polyline>
              <polyline points="8 21 3 21 3 16"></polyline>
              <polyline points="16 21 21 21 21 16"></polyline>
            </svg>
          </button>
        </div>
      )}

      {isDev && (
        <div className="debug-panel">
          <label><input type="checkbox" checked={showDebugPanel} onChange={e => setShowDebugPanel(e.target.checked)} /> 调试面板</label>
          {showDebugPanel && (
            <div>
               <div>X: {camera.x.toFixed(2)}</div>
               <div>Y: {camera.y.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  )
})

DrawingBoardNew.displayName = 'DrawingBoardNew'

export default DrawingBoardNew
