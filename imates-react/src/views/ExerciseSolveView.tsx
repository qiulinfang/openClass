import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQuestionStore } from '@/stores/questionStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { useUIStore } from '@/stores/uiStore'
import { useDraftStore } from '@/stores/draftStore'
import { getUserInfo, getUserId, getSubject } from '@/services/http/auth-service'
import { SUBJECT_OPTIONS, normalizeSubject } from '@/constants/subjects'
import { showMessage } from '@/utils'
import Toolbar from '@/components/base/Toolbar'
import Button from '@/components/base/Button'
import Select from '@/components/base/Select'
import Fab from '@/components/base/Fab'
import SplitPane from '@/components/base/SplitPane'
import ChatView from '@/components/ChatView'
import QuestionList from '@/components/question/QuestionList'
import AnswerView from '@/components/exercise/AnswerView'
import SimilarQuestionList from '@/components/exercise/SimilarQuestionList'
import DrawingBoard from '@/components/drawing/DrawingBoard'
import Dialog from '@/components/base/Dialog'
import '@/views/ExerciseSolveView.css'

// 图标资源
import xuebanaskIcon from '/icons/xuebanask.svg'
import teacheraskIcon from '/icons/teacherask.svg'
import seeAnswerIcon from '/icons/seeAnswer.svg'
import onetothreeIcon from '/icons/onetothree.svg'
import myanswerIcon from '/icons/myanswer.svg'
import goBackIcon from '/icons/goback.svg'
import textbookipIcon from '/icons/textbookip.png'
import xuebandayiSelectIcon from '/icons/xuebandayi_select.svg'
import wodezuodaUnselectIcon from '/icons/wodezuoda_unselect.svg'
import questionSearchIcon from '/icons/questionSearch.svg'

// 路由参数中场景类型
type SceneType = 'homework' | 'favorites' | 'exercise'

export const ExerciseSolveView: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Stores
  const questionStore = useQuestionStore()
  const homeworkStore = useHomeworkStore()
  const aiExerciseStore = useAiExerciseChatStore()
  const teacherChatStore = useTeacherChatStore()
  const uiStore = useUIStore()
  const draftStore = useDraftStore()

  // 状态变量
  const [currentFunction, setCurrentFunction] = useState<'chatAi' | 'teacherChat' | 'viewAnswer' | 'similarQuestion' | 'myDraft' | ''>('chatAi')
  const [splitterModel, setSplitterModel] = useState(30)
  const [showExploreOverlay, setShowExploreOverlay] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('')
  const [draftBackgroundImage, setDraftBackgroundImage] = useState('')

  // 引用
  const aiChatViewRef = useRef<any>(null)
  const draftBoardRef = useRef<any>(null)
  const clearDraftDialogRef = useRef<any>(null)

  // 草稿自动保存
  const draftAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentDraftQuestionId = useRef<string | null>(null)
  const DRAFT_AUTO_SAVE_DELAY_MS = 800

  // 计算属性
  const isFromHomework = useMemo(() => {
    const scene = searchParams.get('scene')
    return scene === 'homework'
  }, [searchParams])

  const currentQuestion = useMemo(() => {
    return isFromHomework ? homeworkStore.getCurrentQuestion() : questionStore.getCurrentQuestion()
  }, [isFromHomework, homeworkStore, questionStore])

  const hasSelectedQuestion = useMemo(() => !!currentQuestion, [currentQuestion])

  // 按钮可用性
  const canUseChatAi = hasSelectedQuestion
  const canUseTeacherChat = useMemo(() => {
    if (isFromHomework) return false
    return hasSelectedQuestion
  }, [isFromHomework, hasSelectedQuestion])
  const canUseViewAnswer = useMemo(() => hasSelectedQuestion && aiExerciseStore.canViewAnswer, [hasSelectedQuestion, aiExerciseStore.canViewAnswer])
  const canUseSimilarQuestion = useMemo(() => hasSelectedQuestion && aiExerciseStore.canViewAnswer, [hasSelectedQuestion, aiExerciseStore.canViewAnswer])
  const canUseDraft = useMemo(() => hasSelectedQuestion && !isFromHomework, [hasSelectedQuestion, isFromHomework])

  // 导航项配置
  const navItems = useMemo(() => [
    { key: 'chatAi', label: '学伴答疑', icon: xuebanaskIcon, disabled: !canUseChatAi },
    { key: 'teacherChat', label: '老师答疑', icon: teacheraskIcon, disabled: !canUseTeacherChat },
    { key: 'viewAnswer', label: '查看答案', icon: seeAnswerIcon, disabled: isFromHomework || !canUseViewAnswer },
    { key: 'similarQuestion', label: '举一反三', icon: onetothreeIcon, disabled: isFromHomework || !canUseSimilarQuestion },
    { key: 'myDraft', label: '我的作答', icon: myanswerIcon, disabled: isFromHomework || !canUseDraft }
  ], [canUseChatAi, canUseTeacherChat, canUseViewAnswer, canUseSimilarQuestion, canUseDraft, isFromHomework])

  const floatMenuItems = useMemo(() => {
    if (isFromHomework) {
      return [
        { label: '学伴答疑', icon: xuebandayiSelectIcon },
        { label: '我的作答', icon: wodezuodaUnselectIcon },
      ]
    }
    return [
      { label: '拍照搜题', icon: questionSearchIcon },
    ]
  }, [isFromHomework])

  // 方法
  const goBack = () => navigate(-1)

  const switchFunction = useCallback(async (next: typeof currentFunction) => {
    if (currentFunction === 'myDraft' && next !== 'myDraft') {
      await flushDraftAutoSave(currentDraftQuestionId.current)
      currentDraftQuestionId.current = null
    }
    setCurrentFunction(next)
    if (next === 'myDraft') {
      await loadCurrentDraft()
    }
  }, [currentFunction])

  const loadCurrentDraft = async () => {
    const q = currentQuestion
    if (!q?.id) return
    currentDraftQuestionId.current = q.id
    try {
      const data = await draftStore.getDraft(q.id)
      if (data && draftBoardRef.current) {
        draftBoardRef.current.loadData(data)
      }
    } catch (e) {
      console.error('加载草稿失败:', e)
    }
  }

  const handleDraftSave = async (data: { objects: any[]; history: any[][]; historyIndex: number }) => {
    const currentQ = currentQuestion
    if (currentQ && currentQ.id) {
      if (currentDraftQuestionId.current && currentDraftQuestionId.current !== currentQ.id) {
        return
      }
      await draftStore.saveDraft(currentQ.id, data)
    }
  }

  const saveDraftNow = useCallback(async (questionId?: string | null) => {
    const qid = questionId || currentDraftQuestionId.current || currentQuestion?.id
    if (!qid || !draftBoardRef.current) return
    if (currentQuestion?.id && qid !== currentQuestion.id) return
    
    const board = draftBoardRef.current
    if (typeof board.saveData !== 'function') return
    const data = board.saveData()
    if (!data) return
    
    await draftStore.saveDraft(qid, data)
  }, [currentQuestion, draftStore])

  const flushDraftAutoSave = useCallback(async (questionId?: string | null) => {
    if (draftAutoSaveTimer.current) {
      clearTimeout(draftAutoSaveTimer.current)
      draftAutoSaveTimer.current = null
    }
    await saveDraftNow(questionId)
  }, [saveDraftNow])

  const getTeacherSessionBySubject = useCallback(() => {
    const userId = getUserId() || 'default'
    const subject = (currentQuestion?.subject || 'math').toLowerCase()
    return `teacher_${userId}_${subject}`
  }, [currentQuestion])

  const onSubjectFilterChange = useCallback(async (val: string | number) => {
    const subject = val.toString()
    setSelectedSubjectFilter(subject)
    switchFunction('chatAi')
    
    if (!isFromHomework) {
      teacherChatStore.clearMessages()
      try {
        if (subject === 'all' || subject === '') {
          await questionStore.fetchAllSubjectsQuestions(true)
        } else {
          await questionStore.fetchQuestions(subject as any, true)
        }
      } catch (error) {
        console.error('Failed to load questions:', error)
      }
    }
  }, [isFromHomework, switchFunction, teacherChatStore, questionStore])

  const handleRefresh = useCallback(async () => {
    try {
      if (selectedSubjectFilter === 'all' || selectedSubjectFilter === '') {
        await questionStore.fetchAllSubjectsQuestions(false)
      } else {
        await questionStore.fetchQuestions(selectedSubjectFilter as any, false)
      }
    } catch (error) {
      console.error('Failed to refresh questions:', error)
    }
  }, [selectedSubjectFilter, questionStore])

  const handleFloatMenuSelect = useCallback(async (item: any) => {
    if (item.label === '学伴答疑') {
      await switchFunction('chatAi')
    } else if (item.label === '拍照搜题') {
      const subject = currentQuestion?.subject || selectedSubjectFilter || 'math'
      navigate(`/photo-search?subject=${normalizeSubject(subject)}`)
    } else if (item.label === '我的作答' && isFromHomework) {
      goBack()
    }
  }, [currentQuestion, selectedSubjectFilter, switchFunction, navigate, isFromHomework])

  const handleQuestionSelected = useCallback(async (question: any) => {
    const store = isFromHomework ? homeworkStore : questionStore
    const idx = store.questions.findIndex(q => q.id === question.id)
    if (idx !== -1) await store.selectQuestion(idx)

    if (currentFunction === 'myDraft') {
      await flushDraftAutoSave(currentDraftQuestionId.current)
      await loadCurrentDraft()
      return
    }

    if (!currentFunction || !['chatAi', 'teacherChat'].includes(currentFunction)) {
      await switchFunction('chatAi')
    }

    const questionId = question.bmNo || question.id
    if (currentFunction === 'chatAi') {
      await aiExerciseStore.loadChatHistory(questionId)
      if (aiExerciseStore.sessions.length === 0) {
        await aiExerciseStore.createNewSession(questionId)
      }
    }

    if (!isFromHomework) {
      const teacherSessionId = getTeacherSessionBySubject()
      const currentSessionId = teacherChatStore.currentSession?.sessionId
      if (currentSessionId !== teacherSessionId) {
        if (currentSessionId) {
          await teacherChatStore.cleanupMessageReceiver()
          teacherChatStore.clearMessages()
        }
        await teacherChatStore.activateTeacherSession(teacherSessionId)
      }
    }
  }, [isFromHomework, homeworkStore, questionStore, currentFunction, switchFunction, aiExerciseStore, teacherChatStore, getTeacherSessionBySubject])

  const handleOpenMiniClass = useCallback((question: any) => {
    const bmNo = (question.bmNo || '').trim()
    if (!bmNo) {
      showMessage('题目编号缺失，无法打开微课', 'warning')
      return
    }
    const subjectPrefix = question.subject || 'math'
    const classUrl = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`
    const questionTitle = question.title || question.question?.substring(0, 50) || ''
    uiStore.openMiniClassDialog(classUrl, questionTitle)
  }, [uiStore])

  const handlePasteToDraft = useCallback(async (payload: any) => {
    if (!payload?.dataUrl) return
    await switchFunction('myDraft')
    setTimeout(() => {
      if (draftBoardRef.current?.insertImageFromDataUrl) {
        draftBoardRef.current.insertImageFromDataUrl(payload.dataUrl)
      } else {
        setDraftBackgroundImage(payload.dataUrl)
      }
    }, 100)
  }, [switchFunction])

  const handleDraftClearClick = () => {
    setShowClearDraftDialog(true)
  }

  const confirmClearDraft = async () => {
    const q = currentQuestion
    if (q?.id) {
      await draftStore.deleteDraft(q.id)
    }
    draftBoardRef.current?.clearAll()
    setShowClearDraftDialog(false)
  }

  // 增加 Dialog 控制状态
  const [showClearDraftDialog, setShowClearDraftDialog] = useState(false)

  // 初始化
  useEffect(() => {
    const init = async () => {
      const tabParam = searchParams.get('tab')
      if (tabParam && ['chatAi', 'teacherChat', 'viewAnswer', 'similarQuestion', 'myDraft'].includes(tabParam)) {
        setCurrentFunction(tabParam as any)
      }

      let subjectName = normalizeSubject(searchParams.get('subject') || getSubject())
      setSelectedSubjectFilter(subjectName)

      try {
        if (!isFromHomework) {
          if (subjectName as any === 'all') {
            await questionStore.fetchAllSubjectsQuestions(true)
          } else {
            await questionStore.fetchQuestions(subjectName as any, true)
          }
        }
      } catch (error) {
        console.error('Failed to load questions:', error)
      }
    }
    init()
  }, [])

  // 监听题目选择变化
  useEffect(() => {
    if (currentQuestion) {
      const questionId = currentQuestion.bmNo || currentQuestion.id
      if (currentFunction === 'chatAi') {
        aiExerciseStore.loadChatHistory(questionId)
      }
    }
  }, [currentQuestion?.id])

  return (
    <div className="exercise-solve-container">
      <Toolbar
        navItems={navItems}
        value={currentFunction}
        onChange={(val) => switchFunction(val as any)}
        left={
          <div className="back-btn" onClick={goBack}>
            <img src={goBackIcon} alt="返回" className="back-icon" />
          </div>
        }
        right={
          !isFromHomework && (
            <Select
              options={SUBJECT_OPTIONS}
              value={selectedSubjectFilter}
              onChange={onSubjectFilterChange}
              className="subject-filter-select"
            />
          )
        }
      />

      <div className="main-content">
        <div className="textbookip-float-wrapper">
          <Fab items={floatMenuItems} onSelect={handleFloatMenuSelect}>
            <img src={textbookipIcon} alt="textbookip" />
          </Fab>
        </div>

        {showExploreOverlay && (
          <div className="explore-overlay" onClick={() => setShowExploreOverlay(false)}>
            <img src="/icons/ipword.svg" alt="ipWord" className="explore-icon ipWord" />
          </div>
        )}

        <SplitPane
          value={true}
          defaultOffset={30}
          left={
            <div className="question-panel">
              <QuestionList
                type={isFromHomework ? 'homework' : 'exercise'}
                questions={isFromHomework ? homeworkStore.questions : questionStore.questions}
                currentQuestion={currentQuestion}
                loading={isFromHomework ? false : questionStore.isLoading}
                selectedSubjectFilter={selectedSubjectFilter}
                searchQuery={searchQuery}
                onQuestionSelected={handleQuestionSelected}
                onRefresh={handleRefresh}
                onOpenMiniClass={handleOpenMiniClass}
                onPasteToDraft={handlePasteToDraft}
              />
            </div>
          }
          right={
            <div className="function-panel">
              {currentFunction === 'chatAi' && (
                <ChatView
                  ref={aiChatViewRef}
                  type="ai-exercise"
                  question={currentQuestion}
                  onPasteToDraft={handlePasteToDraft}
                />
              )}
              {currentFunction === 'teacherChat' && (
                <ChatView
                  type="teacher"
                  question={currentQuestion}
                />
              )}
              {currentFunction === 'viewAnswer' && <AnswerView />}
              {currentFunction === 'similarQuestion' && (
                <SimilarQuestionList onQuestionAdded={handleRefresh} />
              )}
              {currentFunction === 'myDraft' && (
                <div className="draft-board-container">
                  <DrawingBoard
                    ref={draftBoardRef}
                    backgroundImage={draftBackgroundImage}
                    onSave={handleDraftSave}
                    onClear={handleDraftClearClick}
                  />
                </div>
              )}
            </div>
          }
        />
      </div>

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
    </div>
  )
}

export default ExerciseSolveView
