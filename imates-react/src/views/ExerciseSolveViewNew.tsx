import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuestionStore } from '../stores/questionStore'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useDraftStore } from '../stores/draftStore'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { MathJaxUtils } from '../utils/math/mathjax'
import SplitPanel from '../components/base/SplitPanel'
import QuestionList from '../components/question/QuestionList'
import DrawingBoard from '../components/drawing/DrawingBoard'
import ExerciseChatPanelNew from '../components/chat/chatpanel/ExerciseChatPanelNew'
import Dialog from '../components/base/Dialog'
import Toolbar from '../components/drawing/Toolbar'
import Select from '../components/base/Select'
import Fab from '../components/base/Fab'
import ImageProcessorDialog from '../components/dialog/ImageProcessorDialog'
import { SUBJECT_OPTIONS } from '../constants/subjects'
import type { AttachedScreenshot } from '../types'
import './ExerciseSolveViewNew.css'

// 图标资源 (根据项目实际路径调整)
import goBackIcon from '/icons/goback.svg'
import textbookipIcon from '/icons/textbookip.png'
import collapseToggleIcon from '/icons/collapse-toggle-icon.svg'

export const ExerciseSolveViewNew: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Stores
  const questionStore = useQuestionStore()
  const aiExerciseChatStore = useAiExerciseChatStore()
  const draftStore = useDraftStore()
  
  // Markdown + 公式渲染工具
  const { renderMessageContent } = useMessageRenderer()
  
  // 状态变量
  const [mode, setMode] = useState<'left' | 'right'>('left')
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('')
  const [questionHtml, setQuestionHtml] = useState<string>('')
  const [isQuestionImageCollapsed, setIsQuestionImageCollapsed] = useState(true)
  const [isBoardCapturing, setIsBoardCapturing] = useState(false)
  const [showClearDraftDialog, setShowClearDraftDialog] = useState(false)
  
  // 截图弹窗相关
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false)
  const [currentEditingShotId, setCurrentEditingShotId] = useState('')
  
  // 当前正在处理的草稿题目标识
  const currentDraftQuestionId = useRef<string | null>(null)
  const draftAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const DRAFT_AUTO_SAVE_DELAY_MS = 800
  
  // Refs
  const splitPanelRef = useRef<any>(null)
  const questionListRef = useRef<any>(null)
  const draftBoardRef = useRef<any>(null)
  const exerciseChatPanelRef = useRef<any>(null)
  
  // 获取当前题目
  const currentQuestion = questionStore.getCurrentQuestion()
  
  // --- 逻辑方法 ---
  
  const goBack = () => {
    navigate(-1)
  }
  
  const toggleQuestionImage = () => {
    setIsQuestionImageCollapsed(!isQuestionImageCollapsed)
  }
  
  const handleModeChange = (newMode: 'left' | 'right') => {
    setMode(newMode)
    if (newMode === 'right') {
      // 切换到 AI 模式时，自动切换到 AI 问答 Tab
      exerciseChatPanelRef.current?.switchToAiChat?.()
    }
  }

  // 处理 HTML 预览点击
  const handleOpenHtmlPreview = useCallback((payload: { url: string; html?: string; sessionId?: string | null }) => {
    const { url, html, sessionId } = payload
    if (!url) return
    
    if (html) {
      sessionStorage.setItem('htmlPreview_inlineContent', html)
    }
    
    navigate({
      pathname: '/html-preview',
      search: `?url=${encodeURIComponent(url)}&sessionId=${sessionId || ''}&from=exercise&returnTo=${encodeURIComponent(location.pathname + location.search)}&reopenPanel=exercise`
    })
  }, [navigate, location])
  
  const buildDraftKey = useCallback((questionBmNo?: string | null, sessionId?: string | null) => {
    if (!questionBmNo) return null
    return `${questionBmNo}::${sessionId || 'default'}`
  }, [])
  
  const getCurrentDraftKey = useCallback(() => {
    const questionBmNo = (currentQuestion?.bmNo || currentQuestion?.id || '').toString()
    if (!questionBmNo) return null
    
    // 确保当前 store 中的 session 确实属于这一题
    const currentSession = aiExerciseChatStore.sessions.find(s => s.id === aiExerciseChatStore.currentSessionId)
    const isSessionMatch = currentSession?.questionBmNo === questionBmNo
    
    const sessionId = isSessionMatch ? aiExerciseChatStore.currentSessionId : 'default'
    return buildDraftKey(questionBmNo, sessionId)
  }, [currentQuestion, aiExerciseChatStore.sessions, aiExerciseChatStore.currentSessionId, buildDraftKey])
  
  // 获取画板数据
  const getDraftDataFromBoard = useCallback(() => {
    const board = draftBoardRef.current
    if (!board || typeof board.saveData !== 'function') return null
    
    const data = board.saveData()
    if (!data) return null
    
    return {
      objects: Array.isArray(data.objects) ? data.objects : [],
      history: Array.isArray(data.history) ? data.history : [],
      historyIndex: typeof data.historyIndex === 'number' ? data.historyIndex : -1,
    }
  }, [])
  
  // 立即保存草稿
  const saveDraftNow = useCallback(async (draftKey?: string | null) => {
    const targetDraftKey = draftKey || currentDraftQuestionId.current || getCurrentDraftKey()
    if (!targetDraftKey) return
    
    const questionBmNo = (currentQuestion?.bmNo || currentQuestion?.id || '').toString()
    if (questionBmNo && !targetDraftKey.startsWith(`${questionBmNo}::`) && targetDraftKey !== questionBmNo) {
      return
    }
    
    const data = getDraftDataFromBoard()
    if (!data) return
    
    await draftStore.saveDraft(targetDraftKey, data)
  }, [currentQuestion, getCurrentDraftKey, getDraftDataFromBoard, draftStore])
  
  // 刷新自动保存
  const flushDraftAutoSave = useCallback(async (draftKey?: string | null) => {
    if (draftAutoSaveTimer.current) {
      clearTimeout(draftAutoSaveTimer.current)
      draftAutoSaveTimer.current = null
    }
    await saveDraftNow(draftKey)
  }, [saveDraftNow])
  
  // 加载当前题目的草稿
  const loadCurrentDraft = useCallback(async (draftKey?: string | null) => {
    const targetDraftKey = draftKey || getCurrentDraftKey()
    if (!currentQuestion || !targetDraftKey) return
    
    // 清空画板
    if (draftBoardRef.current && typeof draftBoardRef.current.clearAll === 'function') {
      draftBoardRef.current.clearAll()
    }
    
    try {
      const draft = await draftStore.getDraft(targetDraftKey)
      if (draft && draftBoardRef.current) {
        const board = draftBoardRef.current
        if (typeof board.loadData === 'function') {
          board.loadData({
            objects: draft.objects,
            history: draft.history,
            historyIndex: draft.historyIndex,
          })
        }
      }
      currentDraftQuestionId.current = targetDraftKey
    } catch (error) {
      console.error('[草稿链路] 草稿加载失败:', error)
    }
  }, [currentQuestion, getCurrentDraftKey, draftStore])
  
  // 处理题目选择
  const handleQuestionSelected = useCallback(async (question: any, index: number) => {
    // 保存当前草稿
    if (currentDraftQuestionId.current) {
      await flushDraftAutoSave(currentDraftQuestionId.current)
    }
    
    // 选择题目
    await questionStore.selectQuestion(index)
    
    // 立即清空画板
    if (draftBoardRef.current && typeof draftBoardRef.current.clearAll === 'function') {
      draftBoardRef.current.clearAll()
    }
    
    const questionBmNo = (question?.bmNo || question?.id || '').toString()
    if (questionBmNo) {
      await aiExerciseChatStore.loadChatHistory(questionBmNo)
    }
    
    // 渲染题目 HTML
    const raw = (question?.question || question?.title || '').toString()
    const rendered = renderMessageContent(raw)
    setQuestionHtml(rendered)
    
    // 加载草稿
    await loadCurrentDraft()
    
    // 渲染数学公式
    setTimeout(async () => {
      const contentEl = document.querySelector('.question-html-content')
      if (contentEl) {
        await MathJaxUtils.renderMathAndWait(contentEl as HTMLElement)
      }
    }, 0)
  }, [questionStore, aiExerciseChatStore, renderMessageContent, loadCurrentDraft, flushDraftAutoSave])
  
  const handleStartAiGuidance = () => {
    if (mode === 'left') {
      setMode('right')
    }
  }

  const handleOpenMiniClass = (question: any) => {
    // 根据项目需求实现打开微课逻辑，目前先占位
    console.log('Open mini class for:', question)
  }

  const handlePasteToDraft = async (payload: { dataUrl: string }) => {
    if (!payload?.dataUrl) return
    const board = draftBoardRef.current
    if (board && typeof board.insertImageFromDataUrl === 'function') {
      await board.insertImageFromDataUrl(payload.dataUrl)
    }
  }

  const handleQuestionDeleted = (payload: { questionId: string; withDraft: boolean }) => {
    if (payload.withDraft) {
      const targetQuestion = questionStore.questions.find(
        (q: any) => (q?.id || '').toString() === payload.questionId
      )
      const questionBmNo = (
        targetQuestion?.bmNo ||
        targetQuestion?.id ||
        payload.questionId ||
        ''
      ).toString()

      const relatedDraftKeys = Array.from(draftStore.drafts.keys()).filter(
        (key: string) =>
          key === payload.questionId ||
          key.startsWith(`${payload.questionId}::`) ||
          key === questionBmNo ||
          key.startsWith(`${questionBmNo}::`)
      )
      if (relatedDraftKeys.length > 0) {
        draftStore.deleteDrafts(relatedDraftKeys)
      }
    }
  }

  const handleDraftClearClick = () => {
    setShowClearDraftDialog(true)
  }
  
  const confirmClearDraft = async () => {
    const currentDraftKey = getCurrentDraftKey()
    if (currentDraftKey) {
      await draftStore.deleteDraft(currentDraftKey)
    }
    
    if (draftBoardRef.current && typeof draftBoardRef.current.clearAll === 'function') {
      draftBoardRef.current.clearAll()
    }
    setShowClearDraftDialog(false)
  }
  
  const handleAskAiClick = async () => {
    setIsBoardCapturing(true)
    if (draftBoardRef.current) {
      draftBoardRef.current.handleToolbarToolChange?.('askAi')
    }
    
    if (mode === 'left') {
      setMode('right')
    }
  }

  // --- 截图处理 ---
  const handleScreenshotConfirm = (screenshots: AttachedScreenshot[], states: Record<string, any>) => {
    aiExerciseChatStore.setInputAttachedScreenshots(screenshots)
    aiExerciseChatStore.setInputScreenshotDrawingStates(states)
    setShowScreenshotDialog(false)
  }

  const handleScreenshotAddMore = (screenshots: AttachedScreenshot[], states: Record<string, any>) => {
    aiExerciseChatStore.setInputAttachedScreenshots(screenshots)
    aiExerciseChatStore.setInputScreenshotDrawingStates(states)
    setShowScreenshotDialog(false)
    handleAskAiClick()
  }

  const handleScreenshotRemove = (id: string) => {
    aiExerciseChatStore.removeInputAttachedScreenshot(id)
  }

  // --- 生命周期 ---
  
  useEffect(() => {
    // 初始加载
    if (currentQuestion) {
      const raw = (currentQuestion.question || currentQuestion.title || '').toString()
      setQuestionHtml(renderMessageContent(raw))
      loadCurrentDraft()
    }
    
    const handleBeforeUnload = () => {
      if (currentDraftQuestionId.current) {
        saveDraftNow(currentDraftQuestionId.current)
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (currentDraftQuestionId.current) {
        saveDraftNow(currentDraftQuestionId.current)
      }
      questionStore.clearCurrentQuestion()
      aiExerciseChatStore.resetState()
    }
  }, [])
  
  // 监听会话变化
  useEffect(() => {
    if (currentQuestion && aiExerciseChatStore.currentSessionId) {
      loadCurrentDraft()
    }
  }, [aiExerciseChatStore.currentSessionId])
  
  return (
    <div className="exercise-solve-container">
      {/* 顶部导航栏 */}
      <header className="exercise-solve-header">
        <div className="header-left">
          <div className="left-header-back" onClick={goBack}>
            <img src={goBackIcon} alt="返回" className="back-icon" />
          </div>
        </div>

        <div className="header-center">
          <div className="center-header-actions">
            <Toolbar
              variant="browser"
              orientation="horizontal"
              selectedTool={draftBoardRef.current?.toolbarSelectedTool}
              toolStates={{ 
                undo: draftBoardRef.current?.canUndo, 
                redo: draftBoardRef.current?.canRedo 
              }}
              onToolChange={(tool) => draftBoardRef.current?.handleToolbarToolChange(tool)}
              onConfigChange={(cfg) => draftBoardRef.current?.handleToolbarConfigChange(cfg)}
              onUndo={() => draftBoardRef.current?.undo()}
              onRedo={() => draftBoardRef.current?.redo()}
              onClear={handleDraftClearClick}
            />
          </div>
        </div>

        <div className="header-right">
          <Select
            options={SUBJECT_OPTIONS}
            value={selectedSubjectFilter}
            onChange={(val) => setSelectedSubjectFilter(val.toString())}
            className="subject-filter-select"
          />
        </div>
      </header>

      {/* 核心工作区 */}
      <div className="exercise-body">
        <SplitPanel
          mode={mode}
          onModeChange={handleModeChange}
          leftConfig={[36, 30, 50]}
          centerConfig={[64, 50, 80]}
          rightConfig={[36, 36, 60]}
          showSplitters={true}
          disabled={isBoardCapturing}
          left={({ isVisible }) => (
            <div className="panel-bg1">
              <div className={`panel-content ${!isVisible ? 'panel-hidden' : 'panel-visible'}`} style={{ width: '100%', minWidth: '300px' }}>
                <div className="panel-card problem-card">
                  <div className="panel-card-body">
                    <QuestionList
                      ref={questionListRef}
                      type="exercise"
                      questions={questionStore.questions}
                      currentQuestion={currentQuestion}
                      showPhotoSearch={true}
                      selectedSubjectFilter={selectedSubjectFilter}
                      onQuestionSelected={(q: any) => handleQuestionSelected(q, questionStore.questions.indexOf(q))}
                      onQuestionDeleted={handleQuestionDeleted}
                      onStartAiGuidance={handleStartAiGuidance}
                      onOpenMiniClass={handleOpenMiniClass}
                      onPasteToDraft={handlePasteToDraft}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          center={() => (
            <div className="panel-content" style={{ width: '100%', minWidth: '500px' }}>
              <div className={`panel-card draft-card ${mode === 'left' ? 'draft-mode-left' : 'draft-mode-right'}`}>
                {/* 题目区域 */}
                <div className={`question-image-section ${isQuestionImageCollapsed ? 'collapsed' : ''}`}>
                  <div className="question-image-content">
                    {questionHtml ? (
                      <div 
                        className="question-html-content markdown-content"
                        dangerouslySetInnerHTML={{ __html: questionHtml }}
                      />
                    ) : (
                      <div className="question-image-placeholder">请选择题目以查看内容</div>
                    )}
                  </div>
                </div>
                <div className="collapse-toggle-btn" onClick={toggleQuestionImage}>
                  <img src={collapseToggleIcon} alt="toggle" className="collapse-toggle-svg" />
                </div>
                {/* 草稿本区域 */}
                <div className="panel-card-body draft-body">
                  <DrawingBoard
                    ref={draftBoardRef}
                    onClear={handleDraftClearClick}
                  />
                </div>
              </div>
              {/* IP 悬浮功能 */}
              <div className={`textbookip-float ${mode === 'left' ? 'float-right' : 'float-left'}`}>
                <Fab
                  onToggle={(isOpen) => setMode(isOpen ? 'right' : 'left')}
                >
                  <img src={textbookipIcon} alt="textbookip" />
                </Fab>
              </div>
            </div>
          )}
          right={({ isVisible }) => (
            <div className="panel-bg2">
              <div className={`panel-content ${!isVisible ? 'panel-hidden' : 'panel-visible'}`} style={{ width: '100%', minWidth: '300px' }}>
                <div className="panel-card ai-chat-card">
                  <div className="panel-card-body">
                    <ExerciseChatPanelNew
                      ref={exerciseChatPanelRef}
                      question={currentQuestion}
                      visible={isVisible}
                      onClose={() => setMode('left')}
                      isExploring={isBoardCapturing}
                      isCapturing={isBoardCapturing}
                      onOpenHtmlPreview={handleOpenHtmlPreview}
                      onScreenshotClick={(active) => {
                        if (active) handleAskAiClick()
                        else setIsBoardCapturing(false)
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        />
      </div>

      {/* 清空草稿确认对话框 */}
      <Dialog
        open={showClearDraftDialog}
        title="清除确认"
        confirmButtonText="清除"
        cancelButtonText="取消"
        onConfirm={confirmClearDraft}
        onCancel={() => setShowClearDraftDialog(false)}
      >
        确定要清空当前题目的草稿吗？此操作不可撤销。
      </Dialog>

      {/* 截图编辑对话框 */}
      <ImageProcessorDialog
        open={showScreenshotDialog}
        initialShotId={currentEditingShotId}
        existingScreenshots={aiExerciseChatStore.inputAttachedScreenshots}
        drawingStatesFromParent={aiExerciseChatStore.inputScreenshotDrawingStates}
        mode="multiple"
        onConfirm={handleScreenshotConfirm}
        onAddMore={handleScreenshotAddMore}
        onCancel={() => setShowScreenshotDialog(false)}
        onRemoveScreenshot={handleScreenshotRemove}
      />
    </div>
  )
}

export default ExerciseSolveViewNew
