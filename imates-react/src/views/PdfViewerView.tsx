import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { PdfPage, PdfPageRef } from '@/components/pdf/PdfPage'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useUIStore } from '@/stores/uiStore'
import { resourceManager } from '@/services/storage/resource-storage'
import DrawingHeader from '@/components/header/DrawingHeader'
import PdfChatPanel from '@/components/chat/chatpanel/PdfChatPanel'
import MiniClass from '@/components/display/MiniClass'
import SplitPane from '@/components/base/SplitPane'
import { showMessage } from '@/utils'
import '@/views/PdfViewerView.css'

// 垂直/水平阅读图标
import shangxiaSelectIcon from '/icons/shangxia_select.svg'
import shangxiaIcon from '/icons/shangxia.svg'
import zuoyouSelectIcon from '/icons/zuoyou_select.svg'
import zuoyouIcon from '/icons/zuoyou.svg'

export const PdfViewerView: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const pdfRef = useRef<PdfPageRef>(null)
  const chatPanelRef = useRef<any>(null)

  // Stores
  const pdfViewerStore = usePdfViewerStore()
  const aiTextbookStore = useAiTextbookChatStore()
  const aiGeneralStore = useAiGeneralChatStore()
  const uiStore = useUIStore()

  // 状态变量
  const [file, setFile] = useState<File | null>(null)
  const [splitterModel, setSplitterModel] = useState(60)
  const [isSplitterResizing, setIsSplitterResizing] = useState(false)
  const [isHorizontalReading, setIsHorizontalReading] = useState(false)

  // 调试模式
  const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

  // 工具栏工具集合
  const pdfToolbarTools = {
    left: ['undo', 'redo'],
    middle: ['hand', 'select', 'draw', 'highlighter', 'eraser-draw', 'screenshot'],
  }

  // 工具状态
  const toolStates = useMemo(() => ({
    hand: true,
    select: true,
    highlighter: true,
    draw: true,
    'eraser-draw': true,
    note: true,
    undo: true,
    redo: true,
  }), [])

  // 工具配置
  const toolbarToolConfig = useMemo(() => ({
    color:
      pdfViewerStore.selectedTool === 'draw'
        ? pdfViewerStore.drawingConfig.penColor
        : pdfViewerStore.selectedTool === 'highlighter'
        ? pdfViewerStore.drawingConfig.highlighterColor
        : pdfViewerStore.drawingConfig.penColor,
    size:
      pdfViewerStore.selectedTool === 'draw'
        ? pdfViewerStore.drawingConfig.penWidth
        : pdfViewerStore.selectedTool === 'highlighter'
        ? pdfViewerStore.drawingConfig.highlighterWidth
        : pdfViewerStore.selectedTool === 'eraser-draw'
        ? pdfViewerStore.drawingConfig.eraserSize
        : undefined,
    opacity:
      pdfViewerStore.selectedTool === 'draw'
        ? pdfViewerStore.drawingConfig.penOpacity
        : pdfViewerStore.selectedTool === 'highlighter'
        ? pdfViewerStore.drawingConfig.highlighterOpacity
        : undefined,
  }), [pdfViewerStore.selectedTool, pdfViewerStore.drawingConfig])

  // 微课按钮显示逻辑
  const REQUIRED_CHAPTER_INFO = {
    grade: '初一',
    subject: '数学',
    textbook: '探究型公开课',
    chapter_title: '最短路径的基本原理',
  } as const

  const shouldShowMiniClassFab = useMemo(() => {
    const info = aiTextbookStore.chapterInfo
    if (!info) return false
    return (
      info.grade === REQUIRED_CHAPTER_INFO.grade &&
      info.subject === REQUIRED_CHAPTER_INFO.subject &&
      info.textbook === REQUIRED_CHAPTER_INFO.textbook &&
      info.chapter_title === REQUIRED_CHAPTER_INFO.chapter_title
    )
  }, [aiTextbookStore.chapterInfo])

  // 生命周期：初始化
  useEffect(() => {
    const init = async () => {
      try {
        window.addEventListener('pointerup', handleGlobalPointerUp)
        window.addEventListener('pointercancel', handleGlobalPointerUp)

        // 加载 aiGeneral 会话列表
        await aiGeneralStore.loadSessions()

        // 从路由加载文件
        const loadedFile = await loadFileFromRoute()
        if (loadedFile) {
          await loadPdfWithService(loadedFile)
        }

        // 加载当前资源的聊天历史
        const currentResourceId = searchParams.get('resourceId') || aiTextbookStore.resourceId || ''
        if (currentResourceId) {
          aiTextbookStore.setResourceId(currentResourceId)
          await aiTextbookStore.loadChatHistory(currentResourceId)
        }
      } catch (err) {
        console.error('PdfViewerView 初始化失败:', err)
      }
    }

    init()

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      window.removeEventListener('pointercancel', handleGlobalPointerUp)
      document.body.classList.remove('pdf-splitter-resizing')
      // 退出 PDF 页面时清空当前工具
      pdfViewerStore.setSelectedTool('')
      pdfViewerStore.closeChatPanel()
    }
  }, [])

  // 处理全局指针抬起（停止 splitter 调整）
  const handleGlobalPointerUp = () => {
    setIsSplitterResizing(false)
    document.body.classList.remove('pdf-splitter-resizing')
    requestAnimationFrame(() => {
      pdfRef.current?.refreshLayout?.()
    })
  }

  // 从路由加载文件
  const loadFileFromRoute = async () => {
    try {
      const resourceId = searchParams.get('resourceId')
      const id = searchParams.get('id')
      if (!resourceId || !id) return null

      // 获取教材信息
      const textbook = await resourceManager.indexedDB.get('textbooks', id) as any
      if (!textbook) throw new Error(`教材 ${id} 不存在`)

      let fileData: Uint8Array | null = null
      let fileName = 'unknown.pdf'

      if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
        const localFile = textbook.localFiles.find((f: any) => f.id === resourceId)
        if (localFile) {
          fileName = localFile.fileName || fileName
          fileData = await resourceManager.getFileData(id, resourceId)
        }
      }

      if (!fileData) throw new Error('文件未下载到本地')

      // 使用 Blob 构造函数并处理 Uint8Array，确保类型兼容
      const blob = new Blob([fileData], { type: 'application/pdf' })
      return new File([blob], fileName, { type: 'application/pdf' })
    } catch (err) {
      console.error('loadFileFromRoute failed:', err)
      return null
    }
  }

  // 加载 PDF 并配置 store
  const loadPdfWithService = async (file: File) => {
    const resourceId = searchParams.get('resourceId')
    const id = searchParams.get('id')
    if (resourceId && id) {
      pdfViewerStore.setCurrentFileInfo(id, resourceId)
      aiTextbookStore.setResourceId(resourceId)
    }

    const currentSectionName = searchParams.get('sectionName') || searchParams.get('textbookName') || null
    aiTextbookStore.setSectionName(currentSectionName)

    const chapterInfo = {
      grade: searchParams.get('chapterGrade') || '',
      subject: searchParams.get('chapterSubject') || '',
      textbook: searchParams.get('chapterTextbook') || '',
      chapter_title: searchParams.get('chapterTitle') || '',
    }
    aiTextbookStore.setChapterInfo(
      chapterInfo.grade || chapterInfo.subject || chapterInfo.textbook || chapterInfo.chapter_title
        ? chapterInfo
        : null
    )

    setFile(file)
  }

  const handleGoBack = () => {
    const fromLearning = searchParams.get('fromLearning') === 'true'
    if (fromLearning) {
      navigate({
        pathname: '/knowledge-graph',
        search: new URLSearchParams({
          openLearning: 'true',
          learningNodeId: searchParams.get('learningNodeId') || '',
          learningSectionName: searchParams.get('sectionName') || searchParams.get('textbookName') || '',
          learningLevel: searchParams.get('learningLevel') || '',
          textbookId: searchParams.get('id') || '',
          learningChapterGrade: searchParams.get('chapterGrade') || '',
          learningChapterSubject: searchParams.get('chapterSubject') || '',
          learningChapterTextbook: searchParams.get('chapterTextbook') || '',
          learningChapterTitle: searchParams.get('chapterTitle') || '',
        }).toString()
      })
    } else {
      navigate(-1)
    }
  }

  const handleToolChange = (tool: string) => {
    if (!pdfRef.current) return
    const normalizedTool = tool === 'draw' ? 'draw' : tool
    const currentSelected = pdfViewerStore.selectedTool

    if (currentSelected === normalizedTool && normalizedTool !== 'hand') {
      pdfViewerStore.setSelectedTool('hand')
      pdfRef.current.toggleGestureMode()
      return
    }

    pdfViewerStore.setSelectedTool(normalizedTool as any)
    switch (normalizedTool) {
      case 'hand':
        pdfRef.current.toggleGestureMode()
        break
      case 'select':
        pdfRef.current.toggleSelectMode()
        break
      case 'highlighter':
        pdfRef.current.toggleHighlightMode()
        break
      case 'draw':
        pdfRef.current.togglePenMode()
        break
      case 'eraser-draw':
        pdfRef.current.toggleEraserMode()
        break
      case 'screenshot':
        pdfRef.current.toggleScreenshotMode()
        break
    }
  }

  const handleConfigChange = (config: any) => {
    const tool = pdfViewerStore.selectedTool
    if (tool === 'select' && config.selectMode) {
      pdfRef.current?.setSelectionMode(config.selectMode)
    } else if (tool === 'draw') {
      if (config.color) pdfViewerStore.updateDrawingConfig({ penColor: config.color })
      if (config.size !== undefined) pdfViewerStore.updateDrawingConfig({ penWidth: config.size })
      if (config.opacity !== undefined) pdfViewerStore.updateDrawingConfig({ penOpacity: config.opacity })
    } else if (tool === 'highlighter') {
      if (config.color) pdfViewerStore.updateDrawingConfig({ highlighterColor: config.color })
      if (config.size !== undefined) pdfViewerStore.updateDrawingConfig({ highlighterWidth: config.size })
      if (config.opacity !== undefined) pdfViewerStore.updateDrawingConfig({ highlighterOpacity: config.opacity })
    } else if (tool === 'eraser-draw') {
      if (config.size !== undefined) pdfViewerStore.updateDrawingConfig({ eraserSize: config.size })
    }
  }

  const handleUndo = () => pdfRef.current?.undoLastStroke()
  const handleRedo = () => pdfRef.current?.redoLastStroke()

  const setVerticalReading = () => {
    if (!isHorizontalReading) return
    setIsHorizontalReading(false)
    pdfRef.current?.toggleReadingDirection()
  }

  const setHorizontalReading = () => {
    if (isHorizontalReading) return
    setIsHorizontalReading(true)
    pdfRef.current?.toggleReadingDirection()
  }

  const handleScreenshotCaptured = async (blob: Blob) => {
    try {
      const MAX_SCREENSHOTS = 3
      const currentCount = aiTextbookStore.inputAttachedScreenshots?.length ?? 0
      if (currentCount >= MAX_SCREENSHOTS) {
        showMessage(`最多只能添加 ${MAX_SCREENSHOTS} 张截图`, 'warning')
        handleToolChange('hand')
        return
      }

      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const shotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      aiTextbookStore.appendInputAttachedScreenshots([{
        id: shotId,
        dataUrl: base64DataUrl,
        originalDataUrl: base64DataUrl,
        width: 0,
        height: 0,
      }])

      chatPanelRef.current?.openTextbookScreenshotEditor?.({ shotId, lastCapturedShotId: shotId })
      handleToolChange('hand')
    } catch (error) {
      console.error('处理截图失败:', error)
    }
  }

  const handleScreenshotClickInPanel = (enable: boolean) => {
    if (enable) {
      if (pdfViewerStore.selectedTool !== 'screenshot') handleToolChange('screenshot')
    } else {
      if (pdfViewerStore.selectedTool === 'screenshot') handleToolChange('hand')
    }
  }

  const handleCloseChatPanel = () => {
    if (pdfViewerStore.selectedTool === 'screenshot') handleToolChange('hand')
    pdfViewerStore.closeChatPanel()
  }

  const handleSplitterPointerDown = (e: React.PointerEvent) => {
    if (!pdfViewerStore.chatPanelVisible) return
    const target = e.target as HTMLElement
    if (!target?.closest('.q-splitter__separator') && !target?.closest('.split-pane-divider')) return
    setIsSplitterResizing(true)
    document.body.classList.add('pdf-splitter-resizing')
  }

  return (
    <div className="content-layout">
      <SplitPane
        value={pdfViewerStore.chatPanelVisible}
        defaultOffset={60}
        left={
          <div className="pdf-viewer-container">
            <DrawingHeader
              tools={pdfToolbarTools}
              selectedTool={pdfViewerStore.selectedTool}
              toolStates={toolStates}
              toolConfig={toolbarToolConfig}
              onToolChange={handleToolChange}
              onConfigChange={handleConfigChange}
              onBack={handleGoBack}
              onUndo={handleUndo}
              onRedo={handleRedo}
              right={
                <div className="direction-toggle-wrapper">
                  <button className={`direction-btn ${!isHorizontalReading ? 'active' : ''}`} onClick={setVerticalReading}>
                    <img src={!isHorizontalReading ? shangxiaSelectIcon : shangxiaIcon} alt="纵向" />
                  </button>
                  <button className={`direction-btn ${isHorizontalReading ? 'active' : ''}`} onClick={setHorizontalReading}>
                    <img src={isHorizontalReading ? zuoyouSelectIcon : zuoyouIcon} alt="横向" />
                  </button>
                  {isDev && (
                    <button className="debug-btn" onClick={() => pdfRef.current?.toggleNoteMode()}>
                      <span className="material-icons">bug_report</span>
                    </button>
                  )}
                </div>
              }
            />
            <div className="pdf-content">
              <PdfPage
                ref={pdfRef}
                file={file}
                layoutSuspended={isSplitterResizing}
                onScreenshotCaptured={handleScreenshotCaptured}
              />
            </div>

            {shouldShowMiniClassFab && (
              <div 
                className="mini-class-fab"
                onClick={() => uiStore.openMiniClassDialog('https://www.imates.com.cn:9099/wk/math/steiner-lab-tablet.html', '微课')}
              >
                <span className="material-icons">ondemand_video</span>
              </div>
            )}
            
            <MiniClass 
              open={uiStore.showMiniClassDialog} 
              classUrl={uiStore.miniClassUrl} 
              questionTitle={uiStore.miniClassQuestionTitle}
              onClose={() => uiStore.closeMiniClassDialog()}
            />
          </div>
        }
        right={
          <PdfChatPanel
            ref={chatPanelRef}
            visible={pdfViewerStore.chatPanelVisible}
            onClose={handleCloseChatPanel}
            onScreenshotClick={handleScreenshotClickInPanel}
          />
        }
      />
    </div>
  )
}

export default PdfViewerView
