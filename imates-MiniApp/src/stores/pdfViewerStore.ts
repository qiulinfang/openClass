/**
 * PDF 查看器状态管理 Store
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePdfViewerStore = defineStore('pdfViewer', () => {
  const scale = ref(1.0)
  const pageGap = ref(16)
  const hideNotes = ref(false)
  const selectedTool = ref<string>('')
  const chatPanelVisible = ref(false)

  const drawingConfig = ref({
    penColor: '#212529',
    penWidth: 2.5,
    penOpacity: 1,
    highlighterColor: '#FFFF00',
    highlighterWidth: 8,
    highlighterOpacity: 0.4,
    eraserSize: 6,
    screenshotShape: 'rectangle',
  })
  
  const currentFileId = ref<string | null>(null)
  const currentResourceId = ref<string | null>(null)
  
  const setScale = (newScale: number) => {
    scale.value = Math.max(0.25, Math.min(4.0, newScale))
  }
  
  const setPageGap = (gap: number) => {
    pageGap.value = Math.max(0, gap)
  }
  
  const toggleHideNotes = () => {
    hideNotes.value = !hideNotes.value
  }
  
  const setHideNotes = (value: boolean) => {
    hideNotes.value = value
  }
  
  const setCurrentFileInfo = (fileId: string, resourceId: string) => {
    currentFileId.value = fileId
    currentResourceId.value = resourceId
  }
  
  const setSelectedTool = (tool: string | null) => {
    selectedTool.value = tool ?? ''
  }

  const openChatPanel = () => {
    chatPanelVisible.value = true
  }

  const closeChatPanel = () => {
    chatPanelVisible.value = false
  }

  const updateDrawingConfig = (config: Partial<typeof drawingConfig.value>) => {
    drawingConfig.value = { ...drawingConfig.value, ...config }
  }
  
  return {
    scale,
    pageGap,
    hideNotes,
    selectedTool,
    chatPanelVisible,
    drawingConfig,
    currentFileId,
    currentResourceId,
    setScale,
    setPageGap,
    toggleHideNotes,
    setHideNotes,
    setCurrentFileInfo,
    setSelectedTool,
    updateDrawingConfig,
    openChatPanel,
    closeChatPanel,
  }
})
