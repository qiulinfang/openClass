/**
 * PDF状态管理适配器 - 框架无关接口
 * 定义状态管理接口，支持不同的状态管理库实现
 */

import type { PdfState, PdfLoadResult, AnnotationData, DrawingConfig, ToolType } from '../types/pdf-types'

/**
 * PDF状态管理适配器接口
 * 可以在Vue中使用Pinia实现，在React中使用Redux/Zustand实现
 */
export interface IPdfStateAdapter {
  // 状态获取
  getState(): PdfState
  getPdfDoc(): import('pdfjs-dist').PDFDocumentProxy | null
  getPageLayouts(): import('../types/pdf-types').PageLayout[]
  getAnnotations(pageNum: number): AnnotationData[]
  getDrawingConfig(): DrawingConfig
  getSelectedTool(): ToolType

  // 状态更新
  setPdfLoaded(result: PdfLoadResult): void
  setPageLayouts(layouts: import('../types/pdf-types').PageLayout[]): void
  setAnnotations(pageNum: number, annotations: AnnotationData[]): void
  setDrawingConfig(config: Partial<DrawingConfig>): void
  setSelectedTool(tool: ToolType): void
  setScale(scale: number): void
  setCurrentPage(page: number): void
  setLoading(loading: boolean): void
  setError(error: string | null): void

  // 订阅状态变化
  subscribe(callback: (state: PdfState) => void): () => void
}

/**
 * 状态管理适配器工厂函数
 * 根据框架类型返回对应的适配器实现
 */
export function createPdfStateAdapter(framework: 'vue' | 'react'): IPdfStateAdapter {
  // 这里返回对应框架的适配器实现
  // Vue实现使用Pinia
  // React实现使用Redux/Zustand
  throw new Error('需要实现对应框架的适配器')
}

