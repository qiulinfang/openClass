/**
 * 增强版Fabric.js Canvas服务类 - 框架无关
 * 包含完整的截图、橡皮擦等功能
 */

import { Canvas, PencilBrush, Rect, Polygon, FabricObject } from 'fabric'
import type { DrawingConfig, AnnotationData } from '../types/pdf-types'

/**
 * 事件回调接口
 */
export interface FabricCanvasEvents {
  onAnnotationChanged?: (annotations: AnnotationData[]) => void
  onScreenshotCaptured?: (blob: Blob) => void
  onObjectModified?: () => void
  onObjectAdded?: () => void
  onObjectRemoved?: () => void
}

/**
 * 增强版Fabric Canvas服务类
 */
export class FabricCanvasServiceEnhanced {
  private fabricCanvas: Canvas | null = null
  private config: DrawingConfig
  private events: FabricCanvasEvents = {}
  private pdfCanvas: HTMLCanvasElement | null = null
  private pageNum: number = 0
  
  private screenshotState = {
    isDrawing: false,
    startPoint: null as { x: number; y: number } | null,
    currentRect: null as Rect | null,
    polygonPoints: [] as { x: number; y: number }[],
    currentPolygon: null as Polygon | null,
  }
  
  private isErasing = false
  private eraserCleanup: (() => void)[] = []
  private screenshotCleanup: (() => void)[] = []

  constructor(config: DrawingConfig) {
    this.config = config
  }

  /**
   * 初始化Fabric Canvas
   */
  async initialize(
    canvasElement: HTMLCanvasElement,
    pdfCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    pageNum: number,
    events?: FabricCanvasEvents
  ): Promise<void> {
    this.fabricCanvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
      absolutePositioned: true,
      enablePointerEvents: true,
    })

    this.pdfCanvas = pdfCanvas
    this.pageNum = pageNum
    
    if (events) {
      this.events = events
    }

    // 设置默认工具模式
    this.setToolMode('none')
    
    // 设置事件监听
    this.setupFabricEvents()
  }

  /**
   * 设置工具模式
   */
  setToolMode(tool: 'pen' | 'highlighter' | 'eraser' | 'screenshot' | 'none'): void {
    if (!this.fabricCanvas) return

    // 清理之前的事件监听
    this.cleanupEventListeners()

    // 重置所有模式
    this.fabricCanvas.isDrawingMode = false
    this.fabricCanvas.selection = true

    switch (tool) {
      case 'pen':
        this.setPenMode()
        break
      case 'highlighter':
        this.setHighlighterMode()
        break
      case 'eraser':
        this.setEraserMode()
        break
      case 'screenshot':
        this.setScreenshotMode()
        break
      case 'none':
        this.setNoneMode()
        break
    }

    this.fabricCanvas.renderAll()
  }

  /**
   * 设置签字笔模式
   */
  private setPenMode(): void {
    if (!this.fabricCanvas) return

    const brush = new PencilBrush(this.fabricCanvas)
    brush.color = this.config.penColor
    brush.width = this.config.penWidth
    this.fabricCanvas.freeDrawingBrush = brush
    this.fabricCanvas.isDrawingMode = true
  }

  /**
   * 设置荧光笔模式
   */
  private setHighlighterMode(): void {
    if (!this.fabricCanvas) return

    const brush = new PencilBrush(this.fabricCanvas)
    brush.color = this.hexToRgba(this.config.highlighterColor, this.config.highlighterOpacity / 100)
    brush.width = this.config.highlighterWidth
    this.fabricCanvas.freeDrawingBrush = brush
    this.fabricCanvas.isDrawingMode = true
  }

  /**
   * 设置橡皮擦模式
   */
  private setEraserMode(): void {
    if (!this.fabricCanvas) return

    this.fabricCanvas.isDrawingMode = false
    this.fabricCanvas.selection = false
    this.setupEraserEvents()
  }

  /**
   * 设置截图模式
   */
  private setScreenshotMode(): void {
    if (!this.fabricCanvas) return

    this.fabricCanvas.isDrawingMode = false
    this.fabricCanvas.selection = false
    this.setupScreenshotEvents()
  }

  /**
   * 设置无工具模式
   */
  private setNoneMode(): void {
    if (!this.fabricCanvas) return

    this.fabricCanvas.isDrawingMode = false
    this.fabricCanvas.selection = true
  }

  /**
   * 设置Fabric事件监听
   */
  private setupFabricEvents(): void {
    if (!this.fabricCanvas) return

    const saveAnnotations = () => {
      const annotations = this.getAnnotations()
      this.events.onAnnotationChanged?.(annotations)
    }

    this.fabricCanvas.on('object:modified', () => {
      saveAnnotations()
      this.events.onObjectModified?.()
    })

    this.fabricCanvas.on('object:added', () => {
      saveAnnotations()
      this.events.onObjectAdded?.()
    })

    this.fabricCanvas.on('object:removed', () => {
      saveAnnotations()
      this.events.onObjectRemoved?.()
    })

    this.fabricCanvas.on('path:created', () => {
      saveAnnotations()
    })
  }

  /**
   * 设置橡皮擦事件监听
   */
  private setupEraserEvents(): void {
    if (!this.fabricCanvas) return

    const handleMouseDown = (event: any) => {
      this.isErasing = true
      const pointer = this.fabricCanvas?.getPointer(event.e)
      if (pointer) {
        this.checkAndDeleteObjects(pointer)
      }
    }

    const handleMouseMove = (event: any) => {
      if (this.isErasing) {
        const pointer = this.fabricCanvas?.getPointer(event.e)
        if (pointer) {
          this.checkAndDeleteObjects(pointer)
        }
      }
    }

    const handleMouseUp = () => {
      this.isErasing = false
    }

    this.fabricCanvas.on('mouse:down', handleMouseDown)
    this.fabricCanvas.on('mouse:move', handleMouseMove)
    this.fabricCanvas.on('mouse:up', handleMouseUp)

    this.eraserCleanup = [
      () => this.fabricCanvas?.off('mouse:down', handleMouseDown),
      () => this.fabricCanvas?.off('mouse:move', handleMouseMove),
      () => this.fabricCanvas?.off('mouse:up', handleMouseUp),
    ]
  }

  /**
   * 设置截图事件监听
   */
  private setupScreenshotEvents(): void {
    if (!this.fabricCanvas) return

    const handleMouseDown = (event: any) => {
      const pointer = this.fabricCanvas?.getPointer(event.e)
      if (!pointer) return

      const shapeType = this.config.screenshotShape

      if (shapeType === 'rectangle') {
        this.screenshotState.isDrawing = true
        this.screenshotState.startPoint = { x: pointer.x, y: pointer.y }

        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: this.config.screenshotFillColor,
          stroke: this.config.screenshotStrokeColor,
          strokeWidth: this.config.screenshotStrokeWidth,
          selectable: false,
          evented: false,
        })

        this.fabricCanvas?.add(rect as unknown as FabricObject)
        this.screenshotState.currentRect = rect
      } else if (shapeType === 'polygon') {
        this.screenshotState.polygonPoints.push({ x: pointer.x, y: pointer.y })
        this.updatePolygonPreview()
      }
    }

    const handleMouseMove = (event: any) => {
      const shapeType = this.config.screenshotShape

      if (shapeType === 'rectangle' && this.screenshotState.isDrawing && this.screenshotState.currentRect) {
        const pointer = this.fabricCanvas?.getPointer(event.e)
        const startPoint = this.screenshotState.startPoint

        if (pointer && startPoint) {
          const width = pointer.x - startPoint.x
          const height = pointer.y - startPoint.y

          this.screenshotState.currentRect.set({
            left: width > 0 ? startPoint.x : pointer.x,
            top: height > 0 ? startPoint.y : pointer.y,
            width: Math.abs(width),
            height: Math.abs(height),
          })

          this.fabricCanvas?.renderAll()
        }
      }
    }

    const handleMouseUp = () => {
      const shapeType = this.config.screenshotShape

      if (shapeType === 'rectangle' && this.screenshotState.isDrawing) {
        this.screenshotState.isDrawing = false

        if (this.screenshotState.currentRect) {
          this.captureScreenshotArea(this.screenshotState.currentRect as unknown as FabricObject)
        }
      }
    }

    const handleMouseDblClick = () => {
      if (this.config.screenshotShape === 'polygon' && this.screenshotState.currentPolygon) {
        this.captureScreenshotArea(this.screenshotState.currentPolygon as unknown as FabricObject)
        this.resetScreenshotState()
      }
    }

    this.fabricCanvas.on('mouse:down', handleMouseDown)
    this.fabricCanvas.on('mouse:move', handleMouseMove)
    this.fabricCanvas.on('mouse:up', handleMouseUp)
    this.fabricCanvas.on('mouse:dblclick', handleMouseDblClick)

    this.screenshotCleanup = [
      () => this.fabricCanvas?.off('mouse:down', handleMouseDown),
      () => this.fabricCanvas?.off('mouse:move', handleMouseMove),
      () => this.fabricCanvas?.off('mouse:up', handleMouseUp),
      () => this.fabricCanvas?.off('mouse:dblclick', handleMouseDblClick),
    ]
  }

  /**
   * 清理事件监听
   */
  private cleanupEventListeners(): void {
    this.eraserCleanup.forEach((cleanup) => cleanup())
    this.screenshotCleanup.forEach((cleanup) => cleanup())
    this.eraserCleanup = []
    this.screenshotCleanup = []
  }

  /**
   * 检查并删除与橡皮擦相交的对象
   */
  private checkAndDeleteObjects(pointer: { x: number; y: number }): void {
    if (!this.fabricCanvas) return

    const eraserSize = this.config.eraserSize
    const objects = this.fabricCanvas.getObjects()

    objects.forEach((obj) => {
      if (obj.type === 'path') {
        const bounds = obj.getBoundingRect()
        const eraserRadius = eraserSize / 2

        const closestX = Math.max(bounds.left, Math.min(pointer.x, bounds.left + bounds.width))
        const closestY = Math.max(bounds.top, Math.min(pointer.y, bounds.top + bounds.height))

        const distanceX = pointer.x - closestX
        const distanceY = pointer.y - closestY
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)

        if (distance < eraserRadius) {
          this.fabricCanvas?.remove(obj)
        }
      }
    })

    this.fabricCanvas.renderAll()
  }

  /**
   * 更新多边形预览
   */
  private updatePolygonPreview(): void {
    if (!this.fabricCanvas) return

    const points = this.screenshotState.polygonPoints

    if (points.length < 2) return

    if (this.screenshotState.currentPolygon) {
      this.fabricCanvas.remove(this.screenshotState.currentPolygon as unknown as FabricObject)
    }

    const polygon = new Polygon(points.map((p) => ({ x: p.x, y: p.y })), {
      fill: this.config.screenshotFillColor,
      stroke: this.config.screenshotStrokeColor,
      strokeWidth: this.config.screenshotStrokeWidth,
      selectable: false,
      evented: false,
    })

    this.fabricCanvas.add(polygon as unknown as FabricObject)
    this.screenshotState.currentPolygon = polygon
    this.fabricCanvas.renderAll()
  }

  /**
   * 捕获截图区域
   */
  private async captureScreenshotArea(shape: FabricObject): Promise<void> {
    if (!this.pdfCanvas || !this.fabricCanvas) return

    try {
      shape.setCoords()
      const boundingRect = shape.getBoundingRect()

      const validWidth = Math.max(1, Math.round(boundingRect.width))
      const validHeight = Math.max(1, Math.round(boundingRect.height))

      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = validWidth
      tempCanvas.height = validHeight
      const tempCtx = tempCanvas.getContext('2d')

      if (!tempCtx) {
        throw new Error('无法创建临时Canvas上下文')
      }

      // 绘制PDF层
      tempCtx.drawImage(
        this.pdfCanvas,
        Math.round(boundingRect.left),
        Math.round(boundingRect.top),
        validWidth,
        validHeight,
        0,
        0,
        validWidth,
        validHeight
      )

      // 绘制Fabric层（临时隐藏选区形状）
      const shapeVisible = shape.visible
      shape.set({ visible: false })
      this.fabricCanvas.renderAll()

      const fabricElement = this.fabricCanvas.getElement()
      if (fabricElement) {
        tempCtx.drawImage(
          fabricElement,
          Math.round(boundingRect.left),
          Math.round(boundingRect.top),
          validWidth,
          validHeight,
          0,
          0,
          validWidth,
          validHeight
        )
      }

      // 恢复选区形状可见性
      shape.set({ visible: shapeVisible })
      this.fabricCanvas.renderAll()

      // 转换为Blob
      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            this.events.onScreenshotCaptured?.(blob)
            this.fabricCanvas?.remove(shape)
            this.fabricCanvas?.renderAll()
            this.resetScreenshotState()
          }
        },
        'image/jpeg',
        0.4
      )
    } catch (error) {
      console.error('截图捕获失败:', error)
    }
  }

  /**
   * 重置截图状态
   */
  private resetScreenshotState(): void {
    this.screenshotState.isDrawing = false
    this.screenshotState.startPoint = null
    this.screenshotState.currentRect = null
    this.screenshotState.polygonPoints = []
    this.screenshotState.currentPolygon = null
  }

  /**
   * 加载注释
   */
  loadAnnotations(annotations: AnnotationData[]): void {
    if (!this.fabricCanvas) return

    this.fabricCanvas.clear()

    annotations.forEach((annotation) => {
      FabricObject.fromObject(annotation.content as any, (obj) => {
        this.fabricCanvas?.add(obj)
      })
    })

    this.fabricCanvas.renderAll()
  }

  /**
   * 获取所有注释
   */
  getAnnotations(): AnnotationData[] {
    if (!this.fabricCanvas) return []

    return this.fabricCanvas.getObjects().map((obj, index) => ({
      id: `annotation-${this.pageNum}-${index}`,
      type: obj.type || 'unknown',
      content: obj.toObject(),
      pageNum: this.pageNum,
    }))
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DrawingConfig>): void {
    this.config = { ...this.config, ...config }
    // 重新设置工具模式以应用新配置
    // 这里需要知道当前工具，暂时简化处理
  }

  /**
   * 获取Fabric Canvas实例
   */
  getFabricCanvas(): Canvas | null {
    return this.fabricCanvas
  }

  /**
   * 十六进制转RGBA
   */
  private hexToRgba(hex: string, alpha: number): string {
    hex = hex.replace('#', '')
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    }
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.cleanupEventListeners()

    if (this.fabricCanvas) {
      this.fabricCanvas.dispose()
      this.fabricCanvas = null
    }

    this.pdfCanvas = null
    this.resetScreenshotState()
  }
}

