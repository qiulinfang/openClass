/**
 * PDF 查看器状态管理 Store
 * 用于管理 PDF 查看器的全局状态，如缩放比例、页面间距等
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePdfViewerStore = defineStore('pdfViewer', () => {
  // 缩放比例（默认 1.0，范围：0.25 - 4.0）
  const scale = ref(1.0)
  
  // 页面间距（像素）
  const pageGap = ref(16)
  
  // 隐藏笔记状态
  const hideNotes = ref(false)
  
  // 选中的工具
  const selectedTool = ref<string>('')

  // PDF 右侧聊天面板是否可见
  const chatPanelVisible = ref(false)

  // 绘图配置（与 UnifiedToolbar 工具配置联动）
  const drawingConfig = ref({
    // 签字笔
    penColor: '#212529',
    penWidth: 2.5,
    penOpacity: 1,
    // 荧光笔
    highlighterColor: '#FFFF00',
    highlighterWidth: 8,
    highlighterOpacity: 0.4,
    // 橡皮擦
    eraserSize: 6,
    // 截图形状（矩形 / 多边形）
    screenshotShape: 'rectangle',
  })
  
  // 当前文件ID
  const currentFileId = ref<string | null>(null)
  
  // 当前资源ID
  const currentResourceId = ref<string | null>(null)
  
  // 设置缩放比例
  const setScale = (newScale: number) => {
    // 限制缩放范围
    scale.value = Math.max(0.25, Math.min(4.0, newScale))
  }
  
  // 设置页面间距
  const setPageGap = (gap: number) => {
    pageGap.value = Math.max(0, gap)
  }
  
  // 切换隐藏笔记状态
  const toggleHideNotes = () => {
    hideNotes.value = !hideNotes.value
  }
  
  // 设置隐藏笔记状态
  const setHideNotes = (value: boolean) => {
    hideNotes.value = value
  }
  
  // 设置当前文件信息
  // 第1步：保存文件ID和资源ID
  const setCurrentFileInfo = (fileId: string, resourceId: string) => {
    currentFileId.value = fileId
    currentResourceId.value = resourceId
  }
  
  // 设置选中的工具
  const setSelectedTool = (tool: string) => {
    selectedTool.value = tool
  }

  // 打开聊天面板
  const openChatPanel = () => {
    chatPanelVisible.value = true
  }

  // 关闭聊天面板
  const closeChatPanel = () => {
    chatPanelVisible.value = false
  }

  // 更新绘图配置（部分字段更新）
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

