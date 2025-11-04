/**
 * Vue版本的PDF状态管理适配器实现
 * 使用Pinia实现IPdfStateAdapter接口
 */

import { storeToRefs } from 'pinia'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import type { IPdfStateAdapter } from '../PdfStateAdapter'
import type { PdfState, PdfLoadResult, AnnotationData, DrawingConfig, ToolType, PageLayout } from '../../types/pdf-types'
import * as pdfjsLib from 'pdfjs-dist'

/**
 * Vue版本的PDF状态管理适配器
 */
export class PdfStateAdapterVue implements IPdfStateAdapter {
  private store = usePdfViewerStore()

  getState(): PdfState {
    const {
      pdfDoc,
      originalPdfBytes,
      pageLayouts,
      allAnnotations,
      isDocLoaded,
      currentPage,
      totalPages,
      scale,
      isLoading,
      error,
      selectedTool,
      drawingConfig,
    } = storeToRefs(this.store)

    return {
      pdfDoc: pdfDoc.value,
      originalPdfBytes: originalPdfBytes.value,
      pageLayouts: pageLayouts.value,
      allAnnotations: allAnnotations.value as Record<number, AnnotationData[]>,
      isDocLoaded: isDocLoaded.value,
      currentPage: currentPage.value,
      totalPages: totalPages.value,
      scale: scale.value,
      isLoading: isLoading.value,
      error: error.value,
      selectedTool: selectedTool.value as ToolType,
      drawingConfig: drawingConfig.value,
    }
  }

  getPdfDoc(): pdfjsLib.PDFDocumentProxy | null {
    return this.store.pdfDoc
  }

  getPageLayouts(): PageLayout[] {
    return this.store.pageLayouts
  }

  getAnnotations(pageNum: number): AnnotationData[] {
    const annotations = this.store.allAnnotations[pageNum]
    return annotations || []
  }

  getDrawingConfig(): DrawingConfig {
    return this.store.drawingConfig
  }

  getSelectedTool(): ToolType {
    return this.store.selectedTool as ToolType
  }

  setPdfLoaded(result: PdfLoadResult): void {
    // 这里需要调用store的方法来更新状态
    // 由于store的具体实现可能需要调整，这里只是示例
    this.store.pdfDoc = result.pdfDoc
    this.store.originalPdfBytes = result.originalPdfBytes
    this.store.pageLayouts = result.pageLayouts
    this.store.totalPages = result.totalPages
    this.store.isDocLoaded = true
  }

  setPageLayouts(layouts: PageLayout[]): void {
    this.store.pageLayouts = layouts
  }

  setAnnotations(pageNum: number, annotations: AnnotationData[]): void {
    // 将AnnotationData转换为store期望的格式
    const objects = annotations.map(a => a.content) as object[]
    this.store.updateAnnotations(pageNum, objects)
  }

  setDrawingConfig(config: Partial<DrawingConfig>): void {
    this.store.updateDrawingConfig(config)
  }

  setSelectedTool(tool: ToolType): void {
    this.store.setSelectedTool(tool)
  }

  setScale(scale: number): void {
    this.store.setScale(scale)
  }

  setCurrentPage(page: number): void {
    this.store.currentPage = page
  }

  setLoading(loading: boolean): void {
    this.store.isLoading = loading
  }

  setError(error: string | null): void {
    this.store.error = error
  }

  subscribe(callback: (state: PdfState) => void): () => void {
    // 使用Pinia的$subscribe方法监听store变化
    const unsubscribe = this.store.$subscribe((mutation, state) => {
      // 当store状态变化时，调用回调函数
      callback(this.getState())
    })

    // 返回取消订阅的函数
    return () => {
      unsubscribe()
    }
  }
}

