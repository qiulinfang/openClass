/**
 * PDF相关类型定义 - 框架无关
 * 所有类型定义都不依赖Vue或React
 */

import * as pdfjsLib from 'pdfjs-dist'

// 页面布局类型
export interface PageLayout {
  pageNum: number
  top: number
  height: number
  width: number
}

// 绘制配置类型
export interface DrawingConfig {
  highlighterColor: string
  highlighterWidth: number
  highlighterOpacity: number
  penColor: string
  penWidth: number
  eraserMode: string
  eraserSize: number
  screenshotShape: string
  screenshotStrokeColor: string
  screenshotFillColor: string
  screenshotStrokeWidth: number
}

// 注释数据类型
export interface AnnotationData {
  id: string
  type: string
  content: object
  pageNum: number
}

// PDF渲染选项
export interface PdfRenderOptions {
  scale?: number
  pageNum: number
  canvas: HTMLCanvasElement
}

// PDF加载结果
export interface PdfLoadResult {
  pdfDoc: pdfjsLib.PDFDocumentProxy
  totalPages: number
  originalPdfBytes: ArrayBuffer
  pageLayouts: PageLayout[]
}

// 工具类型
export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'screenshot' | 'none'

// 工具选项
export interface ToolOption {
  label: string
  value: string
  icon: string
}

// 颜色选项
export interface ColorOption {
  label: string
  value: string
  color: string
}

// PDF状态
export interface PdfState {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null
  originalPdfBytes: ArrayBuffer | null
  pageLayouts: PageLayout[]
  allAnnotations: Record<number, AnnotationData[]>
  isDocLoaded: boolean
  currentPage: number
  totalPages: number
  scale: number
  isLoading: boolean
  error: string | null
  selectedTool: ToolType
  drawingConfig: DrawingConfig
}

// 事件回调类型
export interface PdfEventCallbacks {
  onPdfLoaded?: (result: PdfLoadResult) => void
  onPageRendered?: (pageNum: number) => void
  onAnnotationChanged?: (pageNum: number, annotations: AnnotationData[]) => void
  onScreenshotCaptured?: (blob: Blob) => void
  onError?: (error: Error) => void
}

