/**
 * React版本的PDF状态管理适配器实现
 * 使用Zustand或Redux实现IPdfStateAdapter接口
 * 
 * 注意：这是一个示例实现，实际使用时需要根据选择的状态管理库进行调整
 */

import type { IPdfStateAdapter } from '../PdfStateAdapter'
import type { PdfState, PdfLoadResult, AnnotationData, DrawingConfig, ToolType, PageLayout } from '../../types/pdf-types'
import * as pdfjsLib from 'pdfjs-dist'

/**
 * React版本的PDF状态管理适配器
 * 使用Zustand实现（示例）
 * 
 * 如果使用Redux，需要调整为Redux的实现方式
 */
export class PdfStateAdapterReact implements IPdfStateAdapter {
  private state: PdfState
  
  // 订阅者列表
  private subscribers: Set<(state: PdfState) => void> = new Set()

  constructor() {
    // 初始化状态
    this.state = {
      pdfDoc: null,
      originalPdfBytes: null,
      pageLayouts: [],
      allAnnotations: {},
      isDocLoaded: false,
      currentPage: 1,
      totalPages: 0,
      scale: 1.0,
      isLoading: false,
      error: null,
      selectedTool: 'none',
      drawingConfig: {
        highlighterColor: '#FFFF00',
        highlighterWidth: 5,
        highlighterOpacity: 50,
        penColor: '#ff0000',
        penWidth: 1.0,
        eraserMode: 'stroke',
        eraserSize: 15,
        screenshotShape: 'rectangle',
        screenshotStrokeColor: '#ff0000',
        screenshotFillColor: 'rgba(255, 0, 0, 0.1)',
        screenshotStrokeWidth: 2,
      },
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.state))
  }

  getState(): PdfState {
    return { ...this.state }
  }

  getPdfDoc(): pdfjsLib.PDFDocumentProxy | null {
    return this.state.pdfDoc
  }

  getPageLayouts(): PageLayout[] {
    return [...this.state.pageLayouts]
  }

  getAnnotations(pageNum: number): AnnotationData[] {
    return this.state.allAnnotations[pageNum] || []
  }

  getDrawingConfig(): DrawingConfig {
    return { ...this.state.drawingConfig }
  }

  getSelectedTool(): ToolType {
    return this.state.selectedTool
  }

  setPdfLoaded(result: PdfLoadResult): void {
    this.state = {
      ...this.state,
      pdfDoc: result.pdfDoc,
      originalPdfBytes: result.originalPdfBytes,
      pageLayouts: result.pageLayouts,
      totalPages: result.totalPages,
      isDocLoaded: true,
      isLoading: false,
      error: null,
    }
    this.notifySubscribers()
  }

  setPageLayouts(layouts: PageLayout[]): void {
    this.state = {
      ...this.state,
      pageLayouts: [...layouts],
    }
    this.notifySubscribers()
  }

  setAnnotations(pageNum: number, annotations: AnnotationData[]): void {
    this.state = {
      ...this.state,
      allAnnotations: {
        ...this.state.allAnnotations,
        [pageNum]: [...annotations],
      },
    }
    this.notifySubscribers()
  }

  setDrawingConfig(config: Partial<DrawingConfig>): void {
    this.state = {
      ...this.state,
      drawingConfig: {
        ...this.state.drawingConfig,
        ...config,
      },
    }
    this.notifySubscribers()
  }

  setSelectedTool(tool: ToolType): void {
    this.state = {
      ...this.state,
      selectedTool: tool,
    }
    this.notifySubscribers()
  }

  setScale(scale: number): void {
    this.state = {
      ...this.state,
      scale,
    }
    this.notifySubscribers()
  }

  setCurrentPage(page: number): void {
    this.state = {
      ...this.state,
      currentPage: page,
    }
    this.notifySubscribers()
  }

  setLoading(loading: boolean): void {
    this.state = {
      ...this.state,
      isLoading: loading,
    }
    this.notifySubscribers()
  }

  setError(error: string | null): void {
    this.state = {
      ...this.state,
      error,
    }
    this.notifySubscribers()
  }

  subscribe(callback: (state: PdfState) => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }
}

/**
 * 使用Zustand的示例实现
 * 
 * 如果选择使用Zustand，可以这样实现：
 */
/*
import { create } from 'zustand'
import type { PdfState, PdfLoadResult, AnnotationData, DrawingConfig, ToolType, PageLayout } from '../../types/pdf-types'
import * as pdfjsLib from 'pdfjs-dist'

interface PdfStore extends PdfState {
  // Actions
  setPdfLoaded: (result: PdfLoadResult) => void
  setPageLayouts: (layouts: PageLayout[]) => void
  setAnnotations: (pageNum: number, annotations: AnnotationData[]) => void
  setDrawingConfig: (config: Partial<DrawingConfig>) => void
  setSelectedTool: (tool: ToolType) => void
  setScale: (scale: number) => void
  setCurrentPage: (page: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const usePdfStore = create<PdfStore>((set) => ({
  // Initial state
  pdfDoc: null,
  originalPdfBytes: null,
  pageLayouts: [],
  allAnnotations: {},
  isDocLoaded: false,
  currentPage: 1,
  totalPages: 0,
  scale: 1.0,
  isLoading: false,
  error: null,
  selectedTool: 'none',
  drawingConfig: {
    highlighterColor: '#FFFF00',
    highlighterWidth: 5,
    highlighterOpacity: 50,
    penColor: '#ff0000',
    penWidth: 1.0,
    eraserMode: 'stroke',
    eraserSize: 15,
    screenshotShape: 'rectangle',
    screenshotStrokeColor: '#ff0000',
    screenshotFillColor: 'rgba(255, 0, 0, 0.1)',
    screenshotStrokeWidth: 2,
  },
  
  // Actions
  setPdfLoaded: (result) => set({
    pdfDoc: result.pdfDoc,
    originalPdfBytes: result.originalPdfBytes,
    pageLayouts: result.pageLayouts,
    totalPages: result.totalPages,
    isDocLoaded: true,
    isLoading: false,
    error: null,
  }),
  setPageLayouts: (layouts) => set({ pageLayouts: layouts }),
  setAnnotations: (pageNum, annotations) => set((state) => ({
    allAnnotations: {
      ...state.allAnnotations,
      [pageNum]: annotations,
    },
  })),
  setDrawingConfig: (config) => set((state) => ({
    drawingConfig: { ...state.drawingConfig, ...config },
  })),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setScale: (scale) => set({ scale }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}))

// 使用Zustand的适配器实现
export class PdfStateAdapterReactZustand implements IPdfStateAdapter {
  getState(): PdfState {
    return usePdfStore.getState()
  }
  
  // ... 其他方法实现类似
}
*/

