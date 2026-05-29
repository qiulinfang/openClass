import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuestionStore } from '@/stores/questionStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useDraftStore } from '@/stores/draftStore'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import SplitPanel from '@/components/base/SplitPanel'
import QuestionList from '@/components/question/QuestionList'
import DrawingBoardNew from '@/components/drawing/DrawingBoardNew'
import ExerciseChatPanelNew from '@/components/chat/chatpanel/ExerciseChatPanelNew'
import Dialog from '@/components/base/Dialog'
import ToolbarNew, { ToolConfigState } from '@/components/drawing/ToolbarNew'
import Select from '@/components/base/Select'
import Fab from '@/components/base/Fab'
import ImageProcessorDialog from '@/components/dialog/ImageProcessorDialog'
import { SUBJECT_OPTIONS } from '@/constants/subjects'
import type { AttachedScreenshot, ExerciseItem } from '@/types'
import '@/views/ExerciseSolveViewNew.css'

// 图标资源 (根据项目实际路径调整)
import goBackIcon from '/icons/goback.svg'
import textbookipIcon from '/icons/textbookip.png'
import collapseToggleIcon from '/icons/collapse-toggle-icon.svg'

// 接口定义
interface ToolConfig extends ToolConfigState {
  color: string
  size: number
  opacity: number
  selectMode?: string
}

interface DraftData {
  objects: any[]
  history: any[]
  historyIndex: number
}

interface SplitPanelHandle {
  // 根据需要添加 SplitPanel 暴露的方法
}

interface QuestionListHandle {
  scrollToCurrentQuestion: (targetIndex?: number) => void
  handlePullDownRefresh: () => Promise<void>
  selectQuestion: (question: ExerciseItem, index: number) => Promise<void>
  scrollToQuestionAndSelect: (targetIndex: number) => Promise<void>
  refreshQuestions: () => Promise<void>
  getSelectedQuestion: () => ExerciseItem | null
}

interface DrawingBoardHandle {
  saveData: () => DraftData
  loadData: (data: DraftData) => void
  clearAll: () => void
  undo: () => void
  redo: () => void
  handleToolbarToolChange: (tool: string) => void
  handleToolbarConfigChange: (config: Partial<ToolConfig>) => void
  canUndo: boolean
  canRedo: boolean
  insertImageFromDataUrl?: (dataUrl: string) => Promise<void>
}

interface ExerciseChatPanelHandle {
  switchToAiChat: () => void
  switchToSessionRecord: () => void
  getActiveTab: () => string
  getChatViewRef: () => any
  scrollToSession: (sessionId: string) => void
}

export const ExerciseSolveViewNew: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Stores
  const questions = useQuestionStore(state => state.questions)
  const currentQuestion = useQuestionStore(state => {
    const { questions, currentQuestionIndex } = state
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      return questions[currentQuestionIndex]
    }
    return null
  })
  const fetchQuestions = useQuestionStore(state => state.fetchQuestions)
  const fetchAllSubjectsQuestions = useQuestionStore(state => state.fetchAllSubjectsQuestions)
  const selectQuestion = useQuestionStore(state => state.selectQuestion)
  const clearCurrentQuestion = useQuestionStore(state => state.clearCurrentQuestion)
  const isLoadingQuestions = useQuestionStore(state => state.isLoading)

  const sessions = useAiExerciseChatStore(state => state.sessions)
  const currentSessionId = useAiExerciseChatStore(state => state.currentSessionId)
  const loadChatHistory = useAiExerciseChatStore(state => state.loadChatHistory)
  const createNewSession = useAiExerciseChatStore(state => state.createNewSession)
  const resetChatState = useAiExerciseChatStore(state => state.resetState)
  const inputAttachedScreenshots = useAiExerciseChatStore(state => state.inputAttachedScreenshots)
  const inputScreenshotDrawingStates = useAiExerciseChatStore(state => state.inputScreenshotDrawingStates)
  const setInputAttachedScreenshots = useAiExerciseChatStore(state => state.setInputAttachedScreenshots)
  const appendInputAttachedScreenshots = useAiExerciseChatStore(state => state.appendInputAttachedScreenshots)
  const setInputScreenshotDrawingStates = useAiExerciseChatStore(state => state.setInputScreenshotDrawingStates)
  const removeInputAttachedScreenshot = useAiExerciseChatStore(state => state.removeInputAttachedScreenshot)

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
  
  // 画板工具状态 (提升到此处以保持 Header Toolbar 与画板同步)
  const [activeTool, setActiveTool] = useState('draw')
  const [activeToolConfig, setActiveToolConfig] = useState<ToolConfig>({
    color: '#212529',
    size: 2,
    opacity: 1,
    selectMode: 'rectangle'
  })
  
  // 用于强制触发 Header Toolbar 重绘 (当 ref 内部状态改变时)
  const [boardStateVersion, setBoardStateVersion] = useState(0)
  const refreshBoardUI = useCallback(() => {
    setBoardStateVersion(v => v + 1)
  }, [])
  
  // 截图弹窗相关
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false)
  const [currentEditingShotId, setCurrentEditingShotId] = useState('')
  
  // 当前正在处理的草稿题目标识
  const currentDraftQuestionId = useRef<string | null>(null)
  const draftAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const DRAFT_AUTO_SAVE_DELAY_MS = 800
  
  // 用于追踪上一个会话 ID，以便在切换时保存草稿
  const previousSessionIdRef = useRef<string | null>(currentSessionId)
  
  // Refs
  const splitPanelRef = useRef<SplitPanelHandle>(null)
  const questionListRef = useRef<QuestionListHandle>(null)
  const draftBoardRef = useRef<DrawingBoardHandle>(null)
  const exerciseChatPanelRef = useRef<ExerciseChatPanelHandle>(null)
  
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
    const currentSession = sessions.find(s => s.id === currentSessionId)
    const isSessionMatch = currentSession?.questionBmNo === questionBmNo
    
    const sessionId = isSessionMatch ? currentSessionId : 'default'
    return buildDraftKey(questionBmNo, sessionId)
  }, [currentQuestion, sessions, currentSessionId, buildDraftKey])
  
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
  
  // 调度自动保存
  const scheduleDraftAutoSave = useCallback(() => {
    if (draftAutoSaveTimer.current) {
      clearTimeout(draftAutoSaveTimer.current)
      draftAutoSaveTimer.current = null
    }

    draftAutoSaveTimer.current = setTimeout(() => {
      draftAutoSaveTimer.current = null
      saveDraftNow()
    }, DRAFT_AUTO_SAVE_DELAY_MS)
  }, [saveDraftNow])
  
  // 处理画板保存事件
  const handleDraftSave = useCallback(async (data: DraftData) => {
    const currentDraftKey = getCurrentDraftKey()
    if (currentQuestion && currentDraftKey) {
      // 验证当前草稿键与当前上下文是否一致
      if (currentDraftQuestionId.current && currentDraftQuestionId.current !== currentDraftKey) {
        return
      }

      await draftStore.saveDraft(currentDraftKey, {
        objects: data.objects,
        history: data.history,
        historyIndex: data.historyIndex,
      })
    }
  }, [currentQuestion, getCurrentDraftKey, draftStore])
  
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
  const handleQuestionSelected = useCallback(async (question: ExerciseItem | null, index: number) => {
    if (!question) return

    // 先保存当前题目的草稿（如果有）
    if (currentDraftQuestionId.current) {
      await flushDraftAutoSave(currentDraftQuestionId.current)
    }
    
    // 立即清空画板
    if (draftBoardRef.current && typeof draftBoardRef.current.clearAll === 'function') {
      draftBoardRef.current.clearAll()
    }
    
    // 选择题目
    await selectQuestion(index)
    
    const questionBmNo = (question?.bmNo || question?.id || '').toString()
    if (questionBmNo) {
      console.log(`[ExerciseSolveViewNew] handleQuestionSelected: 更新 AI 上下文, questionBmNo=${questionBmNo}`)
      await loadChatHistory(questionBmNo)
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
  }, [selectQuestion, loadChatHistory, renderMessageContent, loadCurrentDraft, flushDraftAutoSave])
  
  const handleSessionDraftChange = useCallback(async (
    nextSessionId?: string | null,
    previousSessionId?: string | null
  ) => {
    if (!currentQuestion?.id) return

    const questionBmNo = (currentQuestion.bmNo || currentQuestion.id || '').toString()
    const previousDraftKey = buildDraftKey(questionBmNo, previousSessionId)
    const nextDraftKey = buildDraftKey(questionBmNo, nextSessionId)

    if (previousDraftKey && previousDraftKey === currentDraftQuestionId.current) {
      await flushDraftAutoSave(previousDraftKey)
    }

    // 特殊处理：如果是从默认会话（null）切换到第一个正式会话，且该会话没有草稿，则继承默认会话的草稿
    if ((previousSessionId === null || previousSessionId === undefined) && nextSessionId && nextDraftKey) {
      const nextDraft = await draftStore.getDraft(nextDraftKey)
      if (!nextDraft) {
        const defaultDraftKey = buildDraftKey(questionBmNo, null) as string
        const defaultDraft = await draftStore.getDraft(defaultDraftKey)
        if (defaultDraft && defaultDraft.objects.length > 0) {
          console.log('[草稿链路] 新会话继承默认草稿:', nextDraftKey)
          await draftStore.saveDraft(nextDraftKey, {
            objects: defaultDraft.objects,
            history: defaultDraft.history,
            historyIndex: defaultDraft.historyIndex,
          })
        }
      }
    }

    await loadCurrentDraft(nextDraftKey)
  }, [currentQuestion, buildDraftKey, flushDraftAutoSave, draftStore, loadCurrentDraft])

  const handleAddSessionCard = useCallback(async () => {
    const previousSessionId = currentSessionId
    const chatView = exerciseChatPanelRef.current?.getChatViewRef?.()
    if (chatView?.addSessionCard) {
      await chatView.addSessionCard()
      await handleSessionDraftChange(currentSessionId, previousSessionId)
    } else {
      // 如果 ChatView 没有暴露 addSessionCard，则尝试直接通过 store 创建
      const questionBmNo = (currentQuestion?.bmNo || currentQuestion?.id || '').toString()
      if (questionBmNo) {
        await createNewSession(questionBmNo)
        await handleSessionDraftChange(currentSessionId, previousSessionId)
      }
    }
  }, [currentSessionId, handleSessionDraftChange, currentQuestion, createNewSession])

  const onBoardImageSelected = useCallback(async (imageInfo: {
    base64DataUrl?: string
    width: number
    height: number
    fileSize: number
  }) => {
    setIsBoardCapturing(false)
    // 切换回画笔模式
    draftBoardRef.current?.handleToolbarToolChange?.('draw')

    if (!imageInfo.base64DataUrl) return

    // 仿照 PDF 流程：将截图存入 store 并打开编辑弹窗
    const shotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const shot = {
      id: shotId,
      dataUrl: imageInfo.base64DataUrl,
      originalDataUrl: imageInfo.base64DataUrl,
      width: imageInfo.width || 0,
      height: imageInfo.height || 0,
    }

    // 1. 先同步数据到 Store
    appendInputAttachedScreenshots([shot])
    setInputScreenshotDrawingStates({
      ...inputScreenshotDrawingStates,
      [shotId]: { objects: [], history: [], historyIndex: -1 },
    })

    // 2. 关键：等待 DOM 和响应式数据同步
    await new Promise(resolve => setTimeout(resolve, 0))

    // 3. 再打开弹窗，确保 props 已经拿到最新数据
    setCurrentEditingShotId(shotId)
    setShowScreenshotDialog(true)
  }, [appendInputAttachedScreenshots, inputScreenshotDrawingStates, setInputScreenshotDrawingStates])

  const handleSendSuggestion = (message: string) => {
    const chatViewRef = exerciseChatPanelRef.current?.getChatViewRef?.()
    if (chatViewRef?.sendMessage) {
      // 设置输入内容并发送
      chatViewRef.inputMessage = message
      chatViewRef.sendMessage()
    }
  }

  const handleStartAiGuidance = () => {
    if (mode === 'left') {
      setMode('right')
    }
  }

  const handleOpenMiniClass = (question: ExerciseItem) => {
    // 根据项目需求实现打开微课逻辑，目前先占位
    console.log('Open mini class for:', question)
  }

  const handleOpenTeacherDialog = () => {
    // 打开老师对话框
  }

  const handleSwitchToTeacher = () => {
    // 切换到老师聊天
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
      const targetQuestion = questions.find(
        (q: ExerciseItem) => (q?.id || '').toString() === payload.questionId
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
    setInputAttachedScreenshots(screenshots)
    setInputScreenshotDrawingStates(states)
    setShowScreenshotDialog(false)
  }

  const handleScreenshotAddMore = (screenshots: AttachedScreenshot[], states: Record<string, any>) => {
    setInputAttachedScreenshots(screenshots)
    setInputScreenshotDrawingStates(states)
    setShowScreenshotDialog(false)
    handleAskAiClick()
  }

  const handleScreenshotRemove = (id: string) => {
    removeInputAttachedScreenshot(id)
  }

  const handleRefresh = useCallback(async () => {
    try {
      if (selectedSubjectFilter === '') {
        await fetchAllSubjectsQuestions(false)
      } else {
        await fetchQuestions(selectedSubjectFilter, false)
      }
    } catch (error) {
      console.error('[ExerciseSolveViewNew] 刷新题目失败:', error)
    }
  }, [selectedSubjectFilter, fetchAllSubjectsQuestions, fetchQuestions])

  // 监听学科过滤变化，主动加载题目
  useEffect(() => {
    const load = async () => {
      try {
        if (selectedSubjectFilter === '') {
          await fetchAllSubjectsQuestions(true)
        } else {
          await fetchQuestions(selectedSubjectFilter, true)
        }
      } catch (error) {
        console.error('[ExerciseSolveViewNew] 加载题目失败:', error)
      }
    }
    load()
  }, [selectedSubjectFilter, fetchAllSubjectsQuestions, fetchQuestions])

  // --- 生命周期 ---
  
  // 1. 处理挂载和卸载的全局性逻辑
  useEffect(() => {
    // 初始加载：如果已经有选中的题目，执行同步渲染
    if (currentQuestion) {
      console.log('[ExerciseSolveViewNew] 组件挂载，检测到已有选中题目，执行渲染')
      handleQuestionSelected(currentQuestion, questions.indexOf(currentQuestion))
    }
    
    const handleBeforeUnload = () => {
      if (currentDraftQuestionId.current) {
        saveDraftNow(currentDraftQuestionId.current)
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      console.log('[ExerciseSolveViewNew] 组件卸载，执行清理')
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (currentDraftQuestionId.current) {
        saveDraftNow(currentDraftQuestionId.current)
      }
      // 只有在组件真正卸载时才清理全局状态
      clearCurrentQuestion()
      resetChatState()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 关键：依赖项为空，确保 cleanup 只在卸载时执行
  
  // 监听会话变化
  useEffect(() => {
    if (currentQuestion && currentSessionId !== previousSessionIdRef.current) {
      handleSessionDraftChange(currentSessionId, previousSessionIdRef.current)
      previousSessionIdRef.current = currentSessionId
    }
  }, [currentSessionId, currentQuestion, handleSessionDraftChange])
  
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
            <ToolbarNew
              tools={{
                middle: ['undo', 'redo', 'clear', 'hand', 'select', 'draw', 'highlighter', 'eraser-stroke', 'insertImage', 'shape', 'coordinate', 'askAi']
              }}
              variant="browser"
              orientation="horizontal"
              selectedTool={activeTool}
              toolConfig={activeToolConfig}
              toolStates={{ 
                undo: !!draftBoardRef.current?.canUndo, 
                redo: !!draftBoardRef.current?.canRedo 
              }}
              onToolChange={(tool) => {
                setActiveTool(tool)
                draftBoardRef.current?.handleToolbarToolChange(tool)
              }}
              onConfigChange={(cfg: ToolConfigState) => {
                setActiveToolConfig({
                  ...activeToolConfig,
                  ...cfg
                } as ToolConfig)
                draftBoardRef.current?.handleToolbarConfigChange(cfg)
              }}
              onUndo={() => draftBoardRef.current?.undo()}
              onRedo={() => draftBoardRef.current?.redo()}
              onClear={handleDraftClearClick}
              onAskAi={handleAskAiClick}
            />
          </div>
        </div>

        <div className="header-right">
          <Select
            options={SUBJECT_OPTIONS}
            value={selectedSubjectFilter}
            onChange={(val) => {
              setSelectedSubjectFilter(val.toString())
              console.log('[ExerciseSolveViewNew] 学科过滤条件改变:', val)
            }}
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
          splitterClass={mode === 'left' ? 'handle-blue' : 'handle-indigo'}
          disabled={isBoardCapturing}
          left={({ isVisible }: { isVisible?: boolean }) => (
            <div className="panel-bg1">
              <div className={`panel-content ${!isVisible ? 'panel-hidden' : 'panel-visible'}`} style={{ width: '100%', minWidth: '300px' }}>
                <div className="panel-card problem-card">
                  <div className="panel-card-body">
                    <QuestionList
                      ref={questionListRef}
                      type="exercise"
                      questions={questions}
                      currentQuestion={currentQuestion}
                      loading={isLoadingQuestions}
                      showPhotoSearch={true}
                      showSendToAi={true}
                      showQuestionActions={true}
                      selectedSubjectFilter={selectedSubjectFilter}
                      onQuestionSelected={(q: ExerciseItem) => handleQuestionSelected(q, questions.indexOf(q))}
                      onQuestionDeleted={handleQuestionDeleted}
                      onStartAiGuidance={handleStartAiGuidance}
                      onOpenMiniClass={handleOpenMiniClass}
                      onPasteToDraft={handlePasteToDraft}
                      onRefresh={handleRefresh}
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
                  <DrawingBoardNew
                    ref={draftBoardRef}
                    showToolbar={false}
                    selectedTool={activeTool}
                    toolConfig={activeToolConfig}
                    onStateChange={refreshBoardUI}
                    onSave={handleDraftSave}
                    onClear={handleDraftClearClick}
                    onAskAiImageSelected={onBoardImageSelected}
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
          right={({ isVisible }: { isVisible?: boolean }) => (
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
                      onSendMessage={handleSendSuggestion}
                      onAddSession={handleAddSessionCard}
                      onScrollToBottom={() => {}}
                      onOpenTeacherDialog={handleOpenTeacherDialog}
                      onSwitchToTeacher={handleSwitchToTeacher}
                      onPasteToDraft={handlePasteToDraft}
                      onRequestScreenshot={() => handleAskAiClick()}
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
        existingScreenshots={inputAttachedScreenshots}
        drawingStatesFromParent={inputScreenshotDrawingStates}
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
