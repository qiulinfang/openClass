/**
 * React版本的PDF状态管理适配器 - 使用Zustand实现
 */

import { create } from 'zustand'
import type { IPdfStateAdapter } from '../PdfStateAdapter'
import type { PdfState, PdfLoadResult, AnnotationData, DrawingConfig, ToolType, PageLayout } from '../../types/pdf-types'
import * as pdfjsLib from 'pdfjs-dist'

/**
 * Zustand Store接口
 */
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
  reset: () => void
}

/**
 * 创建Zustand Store
 */
const defaultState: PdfState = {
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

export const usePdfStore = create<PdfStore>((set, get) => ({
  ...defaultState,

  setPdfLoaded: (result) =>
    set({
      pdfDoc: result.pdfDoc,
      originalPdfBytes: result.originalPdfBytes,
      pageLayouts: result.pageLayouts,
      totalPages: result.totalPages,
      isDocLoaded: true,
      isLoading: false,
      error: null,
    }),

  setPageLayouts: (layouts) => set({ pageLayouts: layouts }),

  setAnnotations: (pageNum, annotations) =>
    set((state) => ({
      allAnnotations: {
        ...state.allAnnotations,
        [pageNum]: annotations,
      },
    })),

  setDrawingConfig: (config) =>
    set((state) => ({
      drawingConfig: { ...state.drawingConfig, ...config },
    })),

  setSelectedTool: (tool) => set({ selectedTool: tool }),

  setScale: (scale) => set({ scale }),

  setCurrentPage: (page) => set({ currentPage: page }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(defaultState),
}))

/**
 * React版本的PDF状态管理适配器 - Zustand实现
 */
export class PdfStateAdapterReactZustand implements IPdfStateAdapter {
  private store = usePdfStore

  getState(): PdfState {
    return this.store.getState()
  }

  getPdfDoc(): pdfjsLib.PDFDocumentProxy | null {
    return this.store.getState().pdfDoc
  }

  getPageLayouts(): PageLayout[] {
    return [...this.store.getState().pageLayouts]
  }

  getAnnotations(pageNum: number): AnnotationData[] {
    const annotations = this.store.getState().allAnnotations[pageNum]
    return annotations || []
  }

  getDrawingConfig(): DrawingConfig {
    return { ...this.store.getState().drawingConfig }
  }

  getSelectedTool(): ToolType {
    return this.store.getState().selectedTool
  }

  setPdfLoaded(result: PdfLoadResult): void {
    this.store.getState().setPdfLoaded(result)
  }

  setPageLayouts(layouts: PageLayout[]): void {
    this.store.getState().setPageLayouts(layouts)
  }

  setAnnotations(pageNum: number, annotations: AnnotationData[]): void {
    this.store.getState().setAnnotations(pageNum, annotations)
  }

  setDrawingConfig(config: Partial<DrawingConfig>): void {
    this.store.getState().setDrawingConfig(config)
  }

  setSelectedTool(tool: ToolType): void {
    this.store.getState().setSelectedTool(tool)
  }

  setScale(scale: number): void {
    this.store.getState().setScale(scale)
  }

  setCurrentPage(page: number): void {
    this.store.getState().setCurrentPage(page)
  }

  setLoading(loading: boolean): void {
    this.store.getState().setLoading(loading)
  }

  setError(error: string | null): void {
    this.store.getState().setError(error)
  }

  subscribe(callback: (state: PdfState) => void): () => void {
    // Zustand的subscribe方法
    return usePdfStore.subscribe((state) => {
      callback(state as PdfState)
    })
  }
}

