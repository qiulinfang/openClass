/**
 * PDF核心服务类 - 框架无关
 * 包含所有PDF相关的业务逻辑，不依赖Vue或React
 */

import * as pdfjsLib from 'pdfjs-dist'
import { Canvas, PencilBrush, Rect, Polygon, FabricObject } from 'fabric'
import type { DrawingConfig, PageLayout, PdfRenderOptions } from '../types/pdf-types'

// 动态导入PDF.js worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * PDF核心服务类
 * 提供PDF加载、渲染、布局计算等核心功能
 */
export class PdfCoreService {
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null
  private originalPdfBytes: ArrayBuffer | null = null
  private scale: number = 1.0
  private readonly PAGE_GAP: number = 20

  /**
   * 加载PDF文档
   */
  async loadPdf(file: File): Promise<{
    pdfDoc: pdfjsLib.PDFDocumentProxy
    totalPages: number
    originalPdfBytes: ArrayBuffer
  }> {
    try {
      // 读取文件为 ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      this.originalPdfBytes = arrayBuffer

      // 加载 PDF.js 文档
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: '/cmaps/',
        cMapPacked: true,
      })

      this.pdfDoc = await loadingTask.promise

      return {
        pdfDoc: this.pdfDoc,
        totalPages: this.pdfDoc.numPages,
        originalPdfBytes: arrayBuffer,
      }
    } catch (error) {
      console.error('PDF 加载失败:', error)
      throw error
    }
  }

  /**
   * 计算所有页面的布局信息
   */
  async calculatePageLayouts(scale: number = 1.0): Promise<PageLayout[]> {
    if (!this.pdfDoc) {
      throw new Error('PDF文档未加载')
    }

    this.scale = scale

    const layouts: PageLayout[] = []
    let accumulatedTop = 0

    for (let i = 1; i <= this.pdfDoc.numPages; i++) {
      const page = await this.pdfDoc.getPage(i)
      const viewport = page.getViewport({ scale: this.scale })

      layouts.push({
        pageNum: i,
        top: accumulatedTop,
        height: viewport.height,
        width: viewport.width,
      })

      accumulatedTop += viewport.height + this.PAGE_GAP
    }

    return layouts
  }

  /**
   * 渲染PDF页面到Canvas
   */
  async renderPage(
    pageNum: number,
    canvas: HTMLCanvasElement,
    scale: number = 1.0
  ): Promise<void> {
    if (!this.pdfDoc) {
      throw new Error('PDF文档未加载')
    }

    const page = await this.pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    // 设置 Canvas 尺寸
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('无法获取Canvas上下文')
    }

    canvas.width = viewport.width
    canvas.height = viewport.height

    // 渲染 PDF 页面
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }

    await page.render(renderContext).promise
  }

  /**
   * 获取PDF文档实例
   */
  getPdfDoc(): pdfjsLib.PDFDocumentProxy | null {
    return this.pdfDoc
  }

  /**
   * 获取原始PDF字节数据
   */
  getOriginalPdfBytes(): ArrayBuffer | null {
    return this.originalPdfBytes
  }

  /**
   * 设置缩放比例
   */
  setScale(scale: number): void {
    this.scale = scale
  }

  /**
   * 获取缩放比例
   */
  getScale(): number {
    return this.scale
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.pdfDoc) {
      this.pdfDoc.destroy()
      this.pdfDoc = null
    }
    this.originalPdfBytes = null
  }
}

