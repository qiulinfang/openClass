/**
 * Fabric.js Canvas服务类 - 框架无关
 * 提供Fabric.js相关的所有操作，不依赖Vue或React
 */

import { Canvas, PencilBrush, Rect, Polygon, FabricObject } from 'fabric'
import type { DrawingConfig, AnnotationData } from '../types/pdf-types'

/**
 * Fabric Canvas服务类
 * 管理Fabric.js实例和所有标注操作
 */
export class FabricCanvasService {
  private fabricCanvas: Canvas | null = null
  private config: DrawingConfig
  private screenshotState: {
    isDrawing: boolean
    startPoint: { x: number; y: number } | null
    currentRect: Rect | null
    polygonPoints: { x: number; y: number }[]
    currentPolygon: Polygon | null
  } = {
    isDrawing: false,
    startPoint: null,
    currentRect: null,
    polygonPoints: [],
    currentPolygon: null,
  }

  constructor(config: DrawingConfig) {
    this.config = config
  }

  /**
   * 初始化Fabric Canvas
   */
  async initialize(
    canvasElement: HTMLCanvasElement,
    width: number,
    height: number
  ): Promise<void> {
    this.fabricCanvas = new Canvas(canvasElement, {
      width,
      height,
      selection: false,
      isDrawingMode: false,
    })

    // 设置默认画笔
    this.updateBrush()
  }

  /**
   * 更新画笔配置
   */
  updateBrush(config?: Partial<DrawingConfig>): void {
    if (!this.fabricCanvas) return

    if (config) {
      this.config = { ...this.config, ...config }
    }

    // 根据当前工具类型更新画笔
    // 这里需要外部传入当前工具类型，暂时使用默认配置
  }

  /**
   * 设置工具模式
   */
  setToolMode(tool: 'pen' | 'highlighter' | 'eraser' | 'screenshot' | 'none'): void {
    if (!this.fabricCanvas) return

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
    brush.color = this.config.highlighterColor
    brush.width = this.config.highlighterWidth
    brush.opacity = this.config.highlighterOpacity / 100
    this.fabricCanvas.freeDrawingBrush = brush
    this.fabricCanvas.isDrawingMode = true
  }

  /**
   * 设置橡皮擦模式
   */
  private setEraserMode(): void {
    if (!this.fabricCanvas) return

    if (this.config.eraserMode === 'stroke') {
      // 整笔擦除模式
      this.fabricCanvas.isDrawingMode = false
      // 监听鼠标事件，实现整笔擦除
      this.setupEraserEvents()
    } else {
      // 区域擦除模式
      this.fabricCanvas.isDrawingMode = false
      // 实现区域擦除逻辑
    }
  }

  /**
   * 设置截图模式
   */
  private setScreenshotMode(): void {
    if (!this.fabricCanvas) return

    this.fabricCanvas.isDrawingMode = false
    this.setupScreenshotEvents()
  }

  /**
   * 设置无工具模式
   */
  private setNoneMode(): void {
    if (!this.fabricCanvas) return

    this.fabricCanvas.isDrawingMode = false
    this.fabricCanvas.selection = false
  }

  /**
   * 加载注释数据
   */
  loadAnnotations(annotations: AnnotationData[]): void {
    if (!this.fabricCanvas) return

    // 清空现有对象
    this.fabricCanvas.clear()

    // 加载注释对象
    annotations.forEach((annotation) => {
      FabricObject.fromObject(annotation.content as any, (obj) => {
        this.fabricCanvas?.add(obj)
      })
    })
  }

  /**
   * 获取所有注释数据
   */
  getAnnotations(): AnnotationData[] {
    if (!this.fabricCanvas) return []

    return this.fabricCanvas.getObjects().map((obj, index) => ({
      id: `annotation-${index}`,
      type: obj.type || 'unknown',
      content: obj.toObject(),
      pageNum: 0, // 需要外部传入
    }))
  }

  /**
   * 清除所有注释
   */
  clearAnnotations(): void {
    if (!this.fabricCanvas) return
    this.fabricCanvas.clear()
  }

  /**
   * 获取截图
   */
  async captureScreenshot(
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // 创建临时canvas
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = width
        tempCanvas.height = height
        const ctx = tempCanvas.getContext('2d')

        if (!ctx) {
          reject(new Error('无法获取Canvas上下文'))
          return
        }

        // 绘制截图区域
        ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height)

        // 转换为Blob
        tempCanvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('截图转换失败'))
            }
          },
          'image/jpeg',
          0.4
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 设置橡皮擦事件监听
   */
  private setupEraserEvents(): void {
    // 实现橡皮擦事件逻辑
    // 这部分逻辑比较复杂，需要根据具体需求实现
  }

  /**
   * 设置截图事件监听
   */
  private setupScreenshotEvents(): void {
    // 实现截图事件逻辑
    // 这部分逻辑比较复杂，需要根据具体需求实现
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DrawingConfig>): void {
    this.config = { ...this.config, ...config }
    this.updateBrush()
  }

  /**
   * 获取Fabric Canvas实例
   */
  getFabricCanvas(): Canvas | null {
    return this.fabricCanvas
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.fabricCanvas) {
      this.fabricCanvas.dispose()
      this.fabricCanvas = null
    }
  }
}

