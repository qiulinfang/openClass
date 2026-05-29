import { create } from 'zustand'

interface DrawingConfig {
  penColor: string
  penWidth: number
  penOpacity: number
  highlighterColor: string
  highlighterWidth: number
  highlighterOpacity: number
  eraserSize: number
  screenshotShape: string
}

interface PdfViewerState {
  scale: number
  pageGap: number
  hideNotes: boolean
  selectedTool: string
  chatPanelVisible: boolean
  drawingConfig: DrawingConfig
  currentFileId: string | null
  currentResourceId: string | null
  
  // Actions
  setScale: (newScale: number) => void
  setPageGap: (gap: number) => void
  toggleHideNotes: () => void
  setHideNotes: (value: boolean) => void
  setCurrentFileInfo: (fileId: string, resourceId: string) => void
  setSelectedTool: (tool: string | null) => void
  openChatPanel: () => void
  closeChatPanel: () => void
  updateDrawingConfig: (config: Partial<DrawingConfig>) => void
}

export const usePdfViewerStore = create<PdfViewerState>((set) => ({
  scale: 1.0,
  pageGap: 16,
  hideNotes: false,
  selectedTool: '',
  chatPanelVisible: false,
  drawingConfig: {
    penColor: '#212529',
    penWidth: 2.5,
    penOpacity: 1,
    highlighterColor: '#FFFF00',
    highlighterWidth: 8,
    highlighterOpacity: 0.4,
    eraserSize: 6,
    screenshotShape: 'rectangle',
  },
  currentFileId: null,
  currentResourceId: null,

  setScale: (newScale) => set({ scale: Math.max(0.25, Math.min(4.0, newScale)) }),
  setPageGap: (gap) => set({ pageGap: Math.max(0, gap) }),
  toggleHideNotes: () => set((state) => ({ hideNotes: !state.hideNotes })),
  setHideNotes: (value) => set({ hideNotes: value }),
  setCurrentFileInfo: (fileId, resourceId) => set({ currentFileId: fileId, currentResourceId: resourceId }),
  setSelectedTool: (tool) => set({ selectedTool: tool ?? '' }),
  openChatPanel: () => set({ chatPanelVisible: true }),
  closeChatPanel: () => set({ chatPanelVisible: false }),
  updateDrawingConfig: (config) => set((state) => ({ 
    drawingConfig: { ...state.drawingConfig, ...config } 
  })),
}))
