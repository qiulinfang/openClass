/**
 * PDF页面服务类 - 框架无关
 * 管理单个PDF页面的渲染和交互逻辑
 */

import { PdfCoreService } from './PdfCoreService'
import { FabricCanvasService } from './FabricCanvasService'
import type { PageLayout, DrawingConfig, AnnotationData, PdfEventCallbacks } from '../types/pdf-types'

/**
 * PDF页面服务类
 * 管理单个页面的PDF渲染和Fabric标注
 */
export class PdfPageService {
  private pdfCoreService: PdfCoreService
  private fabricCanvasService: FabricCanvasService | null = null
  private pageLayout: PageLayout
  private pdfCanvas: HTMLCanvasElement | null = null
  private fabricCanvas: HTMLCanvasElement | null = null
  private annotations: AnnotationData[] = []
  private callbacks: PdfEventCallbacks = {}
  private isInitialized: boolean = false

  constructor(
    pdfCoreService: PdfCoreService,
    pageLayout: PageLayout,
    initialConfig: DrawingConfig
  ) {
    this.pdfCoreService = pdfCoreService
    this.pageLayout = pageLayout
    this.fabricCanvasService = new FabricCanvasService(initialConfig)
  }

  /**
   * 初始化页面
   */
  async initialize(
    pdfCanvas: HTMLCanvasElement,
    fabricCanvas: HTMLCanvasElement,
    callbacks?: PdfEventCallbacks
  ): Promise<void> {
    this.pdfCanvas = pdfCanvas
    this.fabricCanvas = fabricCanvas

    if (callbacks) {
      this.callbacks = callbacks
    }

    // 初始化Fabric Canvas
    if (this.fabricCanvasService && this.fabricCanvas) {
      await this.fabricCanvasService.initialize(
        this.fabricCanvas,
        this.pageLayout.width,
        this.pageLayout.height
      )
    }

    // 渲染PDF页面
    if (this.pdfCanvas) {
      await this.renderPdfPage()
    }

    // 加载注释
    this.loadAnnotations(this.annotations)

    this.isInitialized = true
  }

  /**
   * 渲染PDF页面
   */
  async renderPdfPage(): Promise<void> {
    if (!this.pdfCanvas) {
      throw new Error('PDF Canvas未初始化')
    }

    const scale = this.pdfCoreService.getScale()
    await this.pdfCoreService.renderPage(this.pageLayout.pageNum, this.pdfCanvas, scale)

    this.callbacks.onPageRendered?.(this.pageLayout.pageNum)
  }

  /**
   * 加载注释
   */
  loadAnnotations(annotations: AnnotationData[]): void {
    this.annotations = annotations

    if (this.fabricCanvasService) {
      this.fabricCanvasService.loadAnnotations(annotations)
    }

    this.callbacks.onAnnotationChanged?.(this.pageLayout.pageNum, annotations)
  }

  /**
   * 获取注释
   */
  getAnnotations(): AnnotationData[] {
    if (this.fabricCanvasService) {
      return this.fabricCanvasService.getAnnotations().map((annotation) => ({
        ...annotation,
        pageNum: this.pageLayout.pageNum,
      }))
    }
    return this.annotations
  }

  /**
   * 更新工具模式
   */
  updateToolMode(tool: 'pen' | 'highlighter' | 'eraser' | 'screenshot' | 'none'): void {
    if (this.fabricCanvasService) {
      this.fabricCanvasService.setToolMode(tool)
    }
  }

  /**
   * 更新绘制配置
   */
  updateDrawingConfig(config: Partial<DrawingConfig>): void {
    if (this.fabricCanvasService) {
      this.fabricCanvasService.updateConfig(config)
    }
  }

  /**
   * 清除注释
   */
  clearAnnotations(): void {
    if (this.fabricCanvasService) {
      this.fabricCanvasService.clearAnnotations()
    }
    this.annotations = []
    this.callbacks.onAnnotationChanged?.(this.pageLayout.pageNum, [])
  }

  /**
   * 捕获截图
   */
  async captureScreenshot(
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<Blob> {
    if (!this.pdfCanvas) {
      throw new Error('PDF Canvas未初始化')
    }

    if (this.fabricCanvasService) {
      const fabricCanvas = this.fabricCanvasService.getFabricCanvas()
      if (fabricCanvas) {
        // 如果有Fabric Canvas，需要合并两个canvas
        // 这里简化处理，只截取PDF canvas
      }
    }

    // 创建临时canvas合并PDF和Fabric内容
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const ctx = tempCanvas.getContext('2d')

    if (!ctx) {
      throw new Error('无法获取Canvas上下文')
    }

    // 绘制PDF内容
    ctx.drawImage(this.pdfCanvas, x, y, width, height, 0, 0, width, height)

    // 如果有Fabric Canvas，也需要绘制
    if (this.fabricCanvas) {
      ctx.drawImage(this.fabricCanvas, x, y, width, height, 0, 0, width, height)
    }

    // 转换为Blob
    return new Promise((resolve, reject) => {
      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            this.callbacks.onScreenshotCaptured?.(blob)
            resolve(blob)
          } else {
            reject(new Error('截图转换失败'))
          }
        },
        'image/jpeg',
        0.4
      )
    })
  }

  /**
   * 更新页面布局
   */
  updatePageLayout(layout: PageLayout): void {
    this.pageLayout = layout

    // 重新初始化Fabric Canvas
    if (this.fabricCanvasService && this.fabricCanvas) {
      this.fabricCanvasService.initialize(
        this.fabricCanvas,
        layout.width,
        layout.height
      )
    }
  }

  /**
   * 获取页面布局
   */
  getPageLayout(): PageLayout {
    return this.pageLayout
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.fabricCanvasService) {
      this.fabricCanvasService.dispose()
      this.fabricCanvasService = null
    }

    this.pdfCanvas = null
    this.fabricCanvas = null
    this.annotations = []
    this.isInitialized = false
  }
}

