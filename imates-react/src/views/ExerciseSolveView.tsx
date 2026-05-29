import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQuestionStore } from '../stores/questionStore'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useTeacherChatStore } from '../stores/teacherChatStore'
import { useHomeworkStore } from '../stores/homeworkStore'
import { useUIStore } from '../stores/uiStore'
import { useDraftStore } from '../stores/draftStore'
import { getUserInfo, getUserId, getSubject } from '../services'
import { SUBJECT_OPTIONS, SUPPORTED_SUBJECTS, normalizeSubject } from '../constants/subjects'
import { showMessage } from '../utils'
import Toolbar from '../components/base/Toolbar'
import Button from '../components/base/Button'
import Select from '../components/base/Select'
import Fab from '../components/base/Fab'
import SplitPane from '../components/base/SplitPane'
import ChatView from '../components/ChatView'
import QuestionList from '../components/question/QuestionList'
import './ExerciseSolveView.css'

// 路由参数中场景类型
type SceneType = 'homework' | 'favorites' | 'exercise'

export const ExerciseSolveView: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Stores
  const questionStore = useQuestionStore()
  const aiExerciseStore = useAiExerciseChatStore()
  const teacherChatStore = useTeacherChatStore()
  const homeworkStore = useHomeworkStore()
  const uiStore = useUIStore()
  const draftStore = useDraftStore()
  
  // 状态变量
  const [currentFunction, setCurrentFunction] = useState<'chatAi' | 'teacherChat' | 'viewAnswer' | 'similarQuestion' | 'myDraft' | ''>('chatAi')
  const [splitterModel, setSplitterModel] = useState(30)
  const [showExploreOverlay, setShowExploreOverlay] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('')
  
  // 草稿自动保存相关
  const draftAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const DRAFT_AUTO_SAVE_DELAY_MS = 800
  const currentDraftQuestionId = useRef<string | null>(null)
  
  // 组件引用
  const questionListRef = useRef<any>(null)
  const aiChatViewRef = useRef<any>(null)
  const draftBoardRef = useRef<any>(null)
  
  // 计算属性
  const isFromHomework = useMemo(() => {
    const scene = searchParams.get('scene') as SceneType
    return scene === 'homework' || location.pathname.includes('homework')
  }, [searchParams, location.pathname])

  const currentQuestion = useMemo(() => {
    return isFromHomework ? homeworkStore.currentQuestion : questionStore.currentQuestion
  }, [isFromHomework, homeworkStore.currentQuestion, questionStore.currentQuestion])

  const hasSelectedQuestion = useMemo(() => !!currentQuestion, [currentQuestion])

  // 按钮可用性
  const canUseChatAi = hasSelectedQuestion
  const canUseTeacherChat = useMemo(() => !isFromHomework && hasSelectedQuestion, [isFromHomework, hasSelectedQuestion])
  const canUseViewAnswer = useMemo(() => hasSelectedQuestion && (aiExerciseStore as any).canViewAnswer, [hasSelectedQuestion, (aiExerciseStore as any).canViewAnswer])
  const canUseSimilarQuestion = useMemo(() => hasSelectedQuestion && (aiExerciseStore as any).canViewAnswer, [hasSelectedQuestion, (aiExerciseStore as any).canViewAnswer])
  const canUseDraft = hasSelectedQuestion

  // 导航项配置
  const navItems = useMemo(() => [
    {
      key: 'chatAi',
      label: '学伴答疑',
      icon: '/icons/xuebanask.svg',
      disabled: !canUseChatAi
    },
    {
      key: 'teacherChat',
      label: '老师答疑',
      icon: '/icons/teacherask.svg',
      disabled: !canUseTeacherChat
    },
    {
      key: 'viewAnswer',
      label: '查看答案',
      icon: '/icons/seeAnswer.svg',
      disabled: isFromHomework || !canUseViewAnswer
    },
    {
      key: 'similarQuestion',
      label: '举一反三',
      icon: '/icons/onetothree.svg',
      disabled: isFromHomework || !canUseSimilarQuestion
    },
    {
      key: 'myDraft',
      label: '我的作答',
      icon: '/icons/myanswer.svg',
      disabled: isFromHomework || !canUseDraft
    }
  ], [canUseChatAi, canUseTeacherChat, canUseViewAnswer, canUseSimilarQuestion, canUseDraft, isFromHomework])

  const floatMenuItems = useMemo(() => {
    if (isFromHomework) {
      return [
        { label: '学伴答疑', icon: '/icons/xuebandayi_select.svg' },
        { label: '我的作答', icon: '/icons/wodezuoda_unselect.svg' },
      ]
    }
    return [
      { label: '拍照搜题', icon: '/icons/questionSearch.svg' },
    ]
  }, [isFromHomework])

  // 方法
  const goBack = () => {
    navigate(-1)
  }

  const switchFunction = useCallback(async (next: typeof currentFunction) => {
    if (currentFunction === 'myDraft' && next !== 'myDraft') {
      await flushDraftAutoSave(currentDraftQuestionId.current)
      currentDraftQuestionId.current = null
    }
    setCurrentFunction(next)
  }, [currentFunction])

  const saveDraftNow = useCallback(async (questionId?: string | null) => {
    const qid = questionId || currentDraftQuestionId.current || currentQuestion?.id
    if (!qid || !draftBoardRef.current) return
    
    // 验证当前题目ID，避免保存错误
    if (currentQuestion?.id && qid !== currentQuestion.id) return
    
    const board = draftBoardRef.current
    if (typeof board.saveData !== 'function') return
    
    const data = board.saveData()
    if (!data) return
    
    await draftStore.saveDraft(qid, {
      objects: Array.isArray(data.objects) ? data.objects : [],
      history: Array.isArray(data.history) ? data.history : [],
      historyIndex: typeof data.historyIndex === 'number' ? data.historyIndex : -1
    })
  }, [currentQuestion, draftStore])

  const flushDraftAutoSave = useCallback(async (questionId?: string | null) => {
    if (draftAutoSaveTimer.current) {
      clearTimeout(draftAutoSaveTimer.current)
      draftAutoSaveTimer.current = null
    }
    await saveDraftNow(questionId)
  }, [saveDraftNow])

  const onSubjectFilterChange = useCallback((val: string | number) => {
    const subject = val.toString()
    setSelectedSubjectFilter(subject)
    switchFunction('chatAi')
    
    if (!isFromHomework) {
      teacherChatStore.clearMessages()
    }
  }, [isFromHomework, switchFunction, teacherChatStore])

  const handleFloatMenuSelect = useCallback(async (item: any) => {
    if (item.label === '学伴答疑') {
      await switchFunction('chatAi')
    } else if (item.label === '拍照搜题') {
      const subject = currentQuestion?.subject || selectedSubjectFilter || 'math'
      navigate(`/photo-search?subject=${subject}`)
    } else if (item.label === '我的作答') {
      if (isFromHomework) {
        goBack()
      }
    }
  }, [currentQuestion, selectedSubjectFilter, isFromHomework, switchFunction, navigate])

  const handleExploreOverlayClick = () => {
    setShowExploreOverlay(false)
  }

  const handleQuestionSelected = useCallback(async (question: any) => {
    if (!isFromHomework) {
      const idx = questionStore.questions.findIndex(q => q.id === question.id)
      if (idx !== -1) await questionStore.selectQuestion(idx)
    } else {
      const idx = homeworkStore.questions.findIndex(q => q.id === question.id)
      if (idx !== -1) homeworkStore.setCurrentQuestionIndex(idx)
    }

    if (!currentFunction || !['chatAi', 'teacherChat'].includes(currentFunction)) {
      await switchFunction('chatAi')
    }

    const questionId = question.bmNo || question.id
    if (currentFunction === 'chatAi') {
      aiExerciseStore.loadChatHistory(questionId)
    }
  }, [isFromHomework, questionStore, homeworkStore, currentFunction, switchFunction, aiExerciseStore])

  const handleSendSuggestion = (message: string) => {
    if (aiChatViewRef.current?.sendMessage) {
      aiChatViewRef.current.sendMessage(message)
    }
  }

  // 初始化逻辑
  useEffect(() => {
    const init = async () => {
      const tabParam = searchParams.get('tab')
      if (tabParam && ['chatAi', 'teacherChat', 'viewAnswer', 'similarQuestion'].includes(tabParam)) {
        setCurrentFunction(tabParam as any)
      }

      let subjectName = 'math'
      if (!isFromHomework) {
        const routeSubject = searchParams.get('subject')
        subjectName = normalizeSubject(routeSubject || getSubject())
        setSelectedSubjectFilter(subjectName)
      }

      try {
        if (!isFromHomework) {
          if (!subjectName || subjectName === 'all') {
            await questionStore.fetchAllSubjectsQuestions(true)
          } else {
            await questionStore.fetchQuestions(subjectName, true)
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
      {/* 顶部工具栏 */}
      <Toolbar
        navItems={navItems}
        value={currentFunction}
        onChange={(val) => switchFunction(val as any)}
        left={
          <div className="back-btn" onClick={goBack}>
            <img src="/icons/goback.svg" alt="返回" className="back-icon" />
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
        {/* IP 悬浮功能 */}
        <div className="textbookip-float-wrapper">
          <Fab
            items={floatMenuItems}
            onSelect={handleFloatMenuSelect}
          >
            <img src="/icons/textbookip.svg" alt="textbookip" />
          </Fab>
        </div>

        {/* 探索遮罩 */}
        {showExploreOverlay && (
          <div className="explore-overlay" onClick={handleExploreOverlayClick}>
            <img src="/icons/ipword.svg" alt="ipWord" className="explore-icon ipWord" />
          </div>
        )}

        {/* 分屏组件 */}
        <SplitPane
          value={true}
          defaultOffset={30}
          left={
            <div className="question-panel">
              <QuestionList
                type={isFromHomework ? 'homework' : 'exercise'}
                questions={isFromHomework ? homeworkStore.questions : questionStore.questions}
                currentQuestion={currentQuestion}
                selectedSubjectFilter={selectedSubjectFilter}
                searchQuery={searchQuery}
                onQuestionSelected={handleQuestionSelected}
              />
            </div>
          }
          right={
            <div className="function-panel">
              {currentFunction === 'chatAi' && (
                <ChatView
                  ref={aiChatViewRef}
                  type={isFromHomework ? 'ai-homework' : 'ai-exercise'}
                  question={currentQuestion}
                />
              )}
              {currentFunction === 'teacherChat' && (
                <ChatView
                  type="teacher"
                  question={currentQuestion}
                />
              )}
              {currentFunction === 'viewAnswer' && (
                <div className="placeholder-content">查看答案区域 - 需对接 AnswerView</div>
              )}
              {currentFunction === 'similarQuestion' && (
                <div className="placeholder-content">举一反三区域 - 需对接 SimilarQuestionList</div>
              )}
              {currentFunction === 'myDraft' && (
                <div className="placeholder-content">我的作答区域 - 需对接 DrawingBoard</div>
              )}
            </div>
          }
        />
      </div>
    </div>
  )
}

export default ExerciseSolveView
