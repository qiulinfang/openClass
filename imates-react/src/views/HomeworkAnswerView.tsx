import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import SplitPanel from '@/components/base/SplitPanel'
import BusinessHeader from '@/components/header/BusinessHeader'
import QuestionList from '@/components/question/QuestionList'
import DrawingBoard from '@/components/drawing/DrawingBoard'
import Button from '@/components/base/Button'
import CameraUploadDialog from '@/components/dialog/CameraUploadDialog'
import type { ExerciseItem, HomeworkUndoItem, HomeworkQuestionDetail } from '@/types'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import * as htmlToImage from 'html-to-image'
import { useUIStore } from '@/stores/uiStore'
import { getSubject } from '@/services/http/auth-service'
import { normalizeSubject } from '@/constants/subjects'
import { getHomeworkButtonText } from '@/constants/homework'
import Dialog from '@/components/base/Dialog'
import Tag from '@/components/base/Tag'
import HomeworkChatPanel from '@/components/chat/chatpanel/HomeworkChatPanel'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { addMistake, isMistake, deleteMistake } from '@/services/storage/mistake-storage'
import { parseQuestionStructure, mapBackendTypeToFrontend } from '@/utils/business/exercise-utils'

import ChoiceQuestion from '@/components/exercise/ChoiceQuestion'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion'
import BaseQuestion from '@/components/exercise/BaseQuestion'
import Radio from '@/components/base/Radio'

import '@/views/HomeworkAnswerView.css'
import textbookipIcon from '/icons/textbookip.png'
import xuebandayiUnselectIcon from '/icons/xuebandayi_unselect.svg'
import wodezuodaSelectIcon from '/icons/wodezuoda_select.svg'
import askXuebanIcon from '/icons/askXueban.svg'
import duileIcon from '/icons/duile.svg'
import cuoleIcon from '/icons/cuole.svg'

export const HomeworkAnswerView: React.FC = () => {
  const navigate = useNavigate()
  const { homeworkId } = useParams<{ homeworkId: string }>()
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const scene = query.get('scene')

  const homeworkStore = useHomeworkStore()
  const questions = useHomeworkStore(s => s.questions)
  const currentQuestionIndex = useHomeworkStore(s => s.currentQuestionIndex)
  const currentQuestion = useMemo(() => {
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      return questions[currentQuestionIndex]
    }
    return null
  }, [questions, currentQuestionIndex])
  const homeworkName = useHomeworkStore(s => s.homeworkName)
  const resubmitType = useHomeworkStore(s => s.resubmitType)
  const answerDataCache = useHomeworkStore(s => s.answerDataCache)
  const currentHomeworkInfo = useHomeworkStore(s => s.currentHomeworkInfo)
  const loadHomeworkSubmissionFromDB = useHomeworkStore(s => s.loadHomeworkSubmissionFromDB)
  const resetAnswerState = useHomeworkStore(s => s.resetAnswerState)

  const uiStore = useUIStore()
  const aiGeneralStore = useAiGeneralChatStore()

  // 模式: 'left' = 题目+作答, 'right' = 作答+AI
  const [mode, setMode] = useState<'left' | 'right'>('left')
  // 作业是否已提交（提交后显示答案和解析）
  const [isHomeworkSubmitted, setIsHomeworkSubmitted] = useState(false)
  
  const splitPanelRef = useRef<any>(null)
  const homeworkChatPanelRef = useRef<any>(null)
  const questionListRef = useRef<any>(null)
  const clearDialogRef = useRef<any>(null)
  const incompleteHomeworkDialogRef = useRef<any>(null)
  const xuebanLimitDialogRef = useRef<any>(null)
  const drawingBoardRef = useRef<any>(null)
  const questionRenderRef = useRef<HTMLDivElement>(null)
  const lastInitHomeworkIdRef = useRef<string | null>(null)

  const [questionSearchQuery, setQuestionSearchQuery] = useState('')
  const [currentAnswerQuestion, setCurrentAnswerQuestion] = useState<ExerciseItem | null>(null)
  const [questionBgImage, setQuestionBgImage] = useState<string>('')
  const [questionHtml, setQuestionHtml] = useState('')
  const [mistakeAddedStatus, setMistakeAddedStatus] = useState<'yes' | 'no'>('no')
  
  const [showCameraDialog, setShowCameraDialog] = useState(false)
  const [initialUploadPhotos, setInitialUploadPhotos] = useState<string[]>([])
  const [lastUploadPageIndices, setLastUploadPageIndices] = useState<number[]>([])
  const [showClearDialog, setShowClearDialog] = useState(false)
  
  const [incompleteDialogData, setIncompleteDialogData] = useState({
    totalQuestions: 0,
    submittedQuestions: 0,
    incompleteQuestionNumbers: [] as number[]
  })
  const incompleteHomeworkResolve = useRef<((value: boolean) => void) | null>(null)
  const questionBgCaptureSeq = useRef(0)
  const questionImageCache = useRef(new Map<string, string>())

  const { renderMessageContent } = useMessageRenderer()

  const homeworkButtonText = useMemo(() => {
    if (isHomeworkSubmitted) return '已提交'
    if (!currentHomeworkInfo) return '提交作业'

    const info = currentHomeworkInfo
    const deadlineMs = info.deadline ? new Date(info.deadline).getTime() : NaN
    const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= Date.now() : false
    const canLateSubmit = info.lateSubmit === '1'
    
    return getHomeworkButtonText(info.status, isExpired, canLateSubmit)
  }, [isHomeworkSubmitted, currentHomeworkInfo])

  const isHomeworkLocked = useMemo(() => {
    if (isHomeworkSubmitted) return true
    if (!currentHomeworkInfo) return false
    
    const info = currentHomeworkInfo
    const deadlineMs = info.deadline ? new Date(info.deadline).getTime() : NaN
    const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= Date.now() : false
    const canLateSubmit = info.lateSubmit === '1'
    const canResubmit = resubmitType === '1'
    
    if (info.status === '3' && !canResubmit && !canLateSubmit) {
      return true
    }

    if (isExpired && !canLateSubmit && !canResubmit) {
      return true
    }
    
    return false
  }, [isHomeworkSubmitted, currentHomeworkInfo, resubmitType])

  const title = useMemo(() => {
    return homeworkId ? `作业作答 - ${homeworkId}` : '作业作答'
  }, [homeworkId])

  const displayTitle = useMemo(() => {
    return (homeworkName && homeworkName.trim()) || title
  }, [homeworkName, title])

  const getQuestionKey = useCallback((question: ExerciseItem | null): string => {
    if (!question) return ''
    return (question.bmNo || question.id || '').toString()
  }, [])

  const getQuestionStatus = useCallback((question: ExerciseItem): 'unanswered' | 'answered' => {
    const questionKey = getQuestionKey(question)
    if (!questionKey) return 'unanswered'

    const cache = (answerDataCache as Record<string, any>)[questionKey]
    if (!cache) return 'unanswered'

    const hasBoardData = cache.boardData && Array.isArray(cache.boardData.objects) && cache.boardData.objects.length > 0
    const hasSelectedOption = Array.isArray(cache.chooseList) && cache.chooseList.length > 0
    const hasFillData = Array.isArray(cache.fillList) && cache.fillList.some((v: string) => v && v.trim() !== '')
    const hasJudgmentData = !!cache.judgmentValue

    if (hasBoardData || hasSelectedOption || hasFillData || hasJudgmentData) return 'answered'

    return 'unanswered'
  }, [getQuestionKey, answerDataCache])

  const getQuestionStatusText = useCallback((question: ExerciseItem): string => {
    const status = getQuestionStatus(question)
    return status === 'answered' ? '已作答' : '未作答'
  }, [getQuestionStatus])

  const getQuestionStatusType = useCallback((question: ExerciseItem): 'yellow' | 'green' => {
    const status = getQuestionStatus(question)
    return status === 'answered' ? 'green' : 'yellow'
  }, [getQuestionStatus])

  const isObjective = useCallback((question: ExerciseItem): boolean => {
    return ['single_choice', 'multiple_choice', 'true_false'].includes(question.type || '')
  }, [])

  const checkQuestionCorrect = useCallback((question: ExerciseItem): boolean => {
    if (!isHomeworkSubmitted) return true
    const answer = question.answer

    const questionKey = getQuestionKey(question)
    const cache = (answerDataCache as Record<string, any>)[questionKey]
    if (!cache) return false

    if (question.type === 'single_choice' || question.type === 'multiple_choice') {
      const userChoices = cache.chooseList
      if (!userChoices || userChoices.length === 0) return false

      let standardChoices: string[] = []
      if (Array.isArray(answer)) {
        standardChoices = answer
      } else if (typeof answer === 'string') {
        standardChoices = answer.split(',').map((s) => s.trim()).filter(Boolean)
      }

      if (userChoices.length !== standardChoices.length) return false
      return userChoices.every((c: string) => standardChoices.includes(c))
    }

    if (question.type === 'judgment' || question.type === 'true_false') {
      const userVal = cache.judgmentValue
      if (!userVal) return false
      
      const rawAnswer = question.structuredContent?.answer ?? question.answer
      
      let standardAnswer = ''
      if (typeof rawAnswer === 'boolean') {
        standardAnswer = rawAnswer ? 'true' : 'false'
      } else if (rawAnswer) {
        standardAnswer = String(rawAnswer).trim().toLowerCase()
      }

      if (userVal === '对' || userVal === '正确') {
        return ['true', '1', '对', '正确', '√', 't'].includes(standardAnswer) || (rawAnswer as any) === true
      }
      if (userVal === '错' || userVal === '错误') {
        return ['false', '0', '错', '错误', '×', 'f'].includes(standardAnswer) || (rawAnswer as any) === false
      }
    }

    return false
  }, [isHomeworkSubmitted, getQuestionKey, answerDataCache])

  const isCurrentQuestionCorrect = useMemo(() => {
    if (!currentAnswerQuestion) return true
    return checkQuestionCorrect(currentAnswerQuestion)
  }, [currentAnswerQuestion, checkQuestionCorrect])

  const goBack = useCallback(async () => {
    console.log('[HOMEWORK_BACK] 开始执行返回逻辑')
    if (!homeworkId) {
      navigate(-1)
      return
    }
    
    try {
      // 增加超时控制，防止 saveCurrentPage 永久挂起
      // await saveCurrentPage() 
      await homeworkStore.saveCurrentHomeworkSubmission(homeworkId, isHomeworkSubmitted)
    } catch (err) {
      console.error('[HOMEWORK_BACK] 返回过程中捕获到异常:', err)
    } finally {
      navigate('/app/my-homework')
    }
  }, [homeworkId, navigate, homeworkStore, isHomeworkSubmitted])

  const handleModeChange = (newMode: 'left' | 'right') => {
    setMode(newMode)
    if (newMode === 'right') {
      aiGeneralStore.loadSessions()
    }
  }

  const handleStartAnswer = useCallback(async (question: ExerciseItem) => {
    const questionKey = getQuestionKey(question)
    const oldQuestionKey = getQuestionKey(currentAnswerQuestion)
    
    if (oldQuestionKey === questionKey && questionKey !== '') {
      return
    }

    setCurrentAnswerQuestion(question)
    setQuestionBgImage('')
    
    const isChoice = question.type === 'single_choice' || question.type === 'multiple_choice'
    const raw = (!isChoice && question.questionContent)
      ? question.questionContent
      : (question.question || question.title || '').toString()
    setQuestionHtml(renderMessageContent(raw))

    if (questionKey && questionImageCache.current.has(questionKey)) {
      setQuestionBgImage(questionImageCache.current.get(questionKey) || '')
    }

    // 恢复笔迹等逻辑...
  }, [currentAnswerQuestion, getQuestionKey, renderMessageContent])

  const handleOpenMiniClass = useCallback((question: ExerciseItem) => {
    try {
      const bmNo = (question.bmNo || '').trim()
      if (!bmNo) {
        showMessage('题目编号缺失，无法打开微课', 'warning')
        return
      }

      const subjectPrefix = normalizeSubject((question.subject || getSubject() || 'SUBJECT_MATH').toString())
      const classUrl = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`

      if (!classUrl || classUrl.trim() === '') {
        showMessage('该题目暂无微课', 'warning')
        return
      }

      const questionTitle = question.title || question.question?.substring(0, 50) || ''
      uiStore.openMiniClassDialog(classUrl, questionTitle)
    } catch (error) {
      console.error('[HomeworkAnswerView] 打开微课失败:', error)
      showMessage('打开微课失败', 'error')
    }
  }, [uiStore])

  const handleClearRequest = () => {
    setShowClearDialog(true)
  }

  const setCurrentQuestionJudgment = useCallback((value: string) => {
    const questionKey = getQuestionKey(currentAnswerQuestion)
    if (!questionKey) return
    const cache = (answerDataCache as Record<string, any>)[questionKey] || {}
    const newCache = { ...answerDataCache, [questionKey]: { ...cache, judgmentValue: value } }
    // 使用 useHomeworkStore.setState 更新
    useHomeworkStore.setState({ answerDataCache: newCache })
  }, [currentAnswerQuestion, getQuestionKey, answerDataCache])

  const currentQuestionJudgment = useMemo(() => {
    const questionKey = getQuestionKey(currentAnswerQuestion)
    if (!questionKey) return ''
    return (answerDataCache as Record<string, any>)[questionKey]?.judgmentValue || ''
  }, [currentAnswerQuestion, getQuestionKey, answerDataCache])

  const setCurrentQuestionChooseList = useCallback((value: string[]) => {
    const questionKey = getQuestionKey(currentAnswerQuestion)
    if (!questionKey) return
    const cache = (answerDataCache as Record<string, any>)[questionKey] || {}
    const newCache = { ...answerDataCache, [questionKey]: { ...cache, chooseList: value } }
    useHomeworkStore.setState({ answerDataCache: newCache })
  }, [currentAnswerQuestion, getQuestionKey, answerDataCache])

  const currentQuestionChooseList = useMemo(() => {
    const questionKey = getQuestionKey(currentAnswerQuestion)
    if (!questionKey) return []
    return (answerDataCache as Record<string, any>)[questionKey]?.chooseList || []
  }, [currentAnswerQuestion, getQuestionKey, answerDataCache])

  const handleMistakeChange = async (val: string) => {
    if (!currentAnswerQuestion) return
    setMistakeAddedStatus(val as any)
    const questionKey = getQuestionKey(currentAnswerQuestion)
    if (val === 'yes') {
      await addMistake({
        bmNo: questionKey,
        questionData: currentAnswerQuestion,
        originalAnswer: (answerDataCache as Record<string, any>)[questionKey],
        homeworkId: homeworkId,
        homeworkName: homeworkName
      })
    } else {
      await deleteMistake(questionKey)
    }
  }

  const confirmClearCanvas = () => {
    drawingBoardRef.current?.clearAll()
    setShowClearDialog(false)
  }

  const cancelClearCanvas = () => {
    setShowClearDialog(false)
  }

  const handleToggle = async (question?: ExerciseItem) => {
    if (!isHomeworkSubmitted) {
      showMessage('需要提交作业后才能使用学伴答疑哦', 'warning')
      return
    }

    const targetQuestion = question || currentAnswerQuestion
    if (!targetQuestion?.questionReason) {
      showMessage('这道题模型还在学习过程中', 'info')
      return
    }

    if (question && (question as any).bmNo) {
      if (mode === 'left') {
        splitPanelRef.current?.toggle()
      }
    } else {
      splitPanelRef.current?.toggle()
    }

    if (question && (question as any).bmNo && homeworkChatPanelRef.current) {
      setTimeout(() => {
        homeworkChatPanelRef.current?.sendQuestion?.(question)
      }, 0)
    }
  }

  const doSubmit = async () => {
    try {
      if (!homeworkId) return
      await homeworkStore.saveCurrentHomeworkSubmission(homeworkId, true)
      setIsHomeworkSubmitted(true)
      showMessage('作业提交成功', 'success')
    } catch (error) {
      showMessage('作业提交失败', 'error')
    }
  }

  const [showIncompleteHomeworkDialog, setShowIncompleteHomeworkDialog] = useState(false)
  
  const handleBoardUpload = async () => {
    const unansweredCount = questions.filter(q => getQuestionStatus(q) === 'unanswered').length
    if (unansweredCount > 0) {
      const incompleteIndices = questions
        .map((q, i) => getQuestionStatus(q) === 'unanswered' ? i + 1 : -1)
        .filter(i => i !== -1)
      
      setIncompleteDialogData({
        totalQuestions: questions.length,
        submittedQuestions: questions.length - unansweredCount,
        incompleteQuestionNumbers: incompleteIndices
      })
      setShowIncompleteHomeworkDialog(true)
      return
    }
    await doSubmit()
  }

  const handleIncompleteHomeworkConfirm = async () => {
    setShowIncompleteHomeworkDialog(false)
    await doSubmit()
  }

  const handleIncompleteHomeworkCancel = () => {
    setShowIncompleteHomeworkDialog(false)
  }

  useEffect(() => {
    const checkMistakeStatus = async () => {
      if (currentAnswerQuestion) {
        const added = await isMistake(getQuestionKey(currentAnswerQuestion))
        setMistakeAddedStatus(added ? 'yes' : 'no')
      }
    }
    checkMistakeStatus()
  }, [currentAnswerQuestion, getQuestionKey])

  useEffect(() => {
    const init = async () => {
      if (!homeworkId) return
      
      // 避免重复初始化
      if (lastInitHomeworkIdRef.current === homeworkId && questions.length > 0) return
      lastInitHomeworkIdRef.current = homeworkId

      const dbData = await loadHomeworkSubmissionFromDB(homeworkId)
      if (dbData) {
        if (resubmitType === '1') {
          setIsHomeworkSubmitted(false)
        } else {
          setIsHomeworkSubmitted(dbData.isSubmitted)
        }
      }

      // 如果 store 中已有题目，则开始作答第一题
      if (questions.length > 0) {
        let targetIndex = currentQuestionIndex ?? 0
        if (targetIndex < 0 || targetIndex >= questions.length) {
          targetIndex = 0
        }
        
        const targetQuestion = questions[targetIndex]
        // 渲染题目 HTML
        const isChoice = targetQuestion.type === 'single_choice' || targetQuestion.type === 'multiple_choice'
        const raw = (!isChoice && targetQuestion.questionContent)
          ? targetQuestion.questionContent
          : (targetQuestion.question || targetQuestion.title || '').toString()
        
        setQuestionHtml(renderMessageContent(raw))
        setCurrentAnswerQuestion(targetQuestion)
      }
    }
    init()
  }, [homeworkId, questions.length, currentQuestionIndex, resubmitType, loadHomeworkSubmissionFromDB, renderMessageContent])

  useEffect(() => {
    return () => {
      resetAnswerState()
    }
  }, [resetAnswerState])

  return (
    <div className="homework-answer-view">
      <BusinessHeader
        title={displayTitle}
        onBack={goBack}
      />

      <div className="answer-body">
        <SplitPanel
          ref={splitPanelRef}
          initialMode={mode}
          leftConfig={[36, 30, 50]}
          centerConfig={[64, 50, 80]}
          rightConfig={[36, 36, 60]}
          transitionDuration={0.5}
          showSplitters={true}
          onModeChange={handleModeChange}
          left={({ isVisible }) => (
            <div className="panel-bg1">
              <div
                className={`panel-content ${isVisible ? 'panel-visible' : 'panel-hidden'}`}
                style={{ width: '100%', minWidth: '300px' }}
              >
                <div className="panel-card">
                  <div className="panel-card-body">
                      <QuestionList
                        ref={questionListRef}
                        type="homework"
                        searchQuery={questionSearchQuery}
                        {...{ 'update:searchQuery': setQuestionSearchQuery }}
                        questions={questions}
                        currentQuestion={currentQuestion}
                        showPhotoSearch={false}
                        showSendToAi={true}
                        showQuestionActions={false}
                        showMistakeBadge={false}
                        onQuestionSelected={handleStartAnswer}
                        onOpenMiniClass={handleOpenMiniClass}
                        renderQuestionNumberExtra={(question) => (
                          isHomeworkSubmitted && isObjective(question) ? (
                            <img
                              src={checkQuestionCorrect(question) ? duileIcon : cuoleIcon}
                              className="result-icon-mini"
                              alt="result"
                            />
                          ) : null
                        )}
                        renderQuestionStatus={(question) => (
                          !(isHomeworkSubmitted && isObjective(question)) ? (
                            <Tag
                              text={getQuestionStatusText(question)}
                              type={getQuestionStatusType(question)}
                              size="xs"
                            />
                          ) : null
                        )}
                        renderActionsAppend={(question) => (
                          isHomeworkSubmitted && getQuestionKey(question) === getQuestionKey(currentAnswerQuestion) ? (
                            <button
                              className="action-btn xueban-action-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggle(question)
                              }}
                            >
                              <img src={askXuebanIcon} alt="问问学伴" className="action-icon" />
                            </button>
                          ) : null
                        )}
                      />
                  </div>
                </div>
              </div>
            </div>
          )}
          center={() => (
            <div className="panel-bg2">
              <div className="panel-content" style={{ width: '100%', minWidth: '500px' }}>
                <div className="panel-card question-solve-card">
                  {currentAnswerQuestion ? (
                    <div className="question-render-container">
                      <div className="question-render-toolbar">
                        {!isHomeworkLocked && (
                          <div className="toolbar-right">
                            <Button
                              label={homeworkButtonText}
                              variant="primary"
                              size="mdCompact"
                              onClick={handleBoardUpload}
                            />
                          </div>
                        )}
                      </div>

                      <div className="question-render-area">
                        {['single_choice', 'multiple_choice', 'true_false'].includes(currentAnswerQuestion.type || '') ? (
                          <>
                            {currentAnswerQuestion.type === 'true_false' ? (
                              <JudgmentQuestion
                                question={currentAnswerQuestion}
                                value={currentQuestionJudgment}
                                onChange={setCurrentQuestionJudgment}
                                disabled={isHomeworkSubmitted}
                                showTitle
                              />
                            ) : (
                              <ChoiceQuestion
                                question={currentAnswerQuestion}
                                value={currentQuestionChooseList}
                                onChange={setCurrentQuestionChooseList}
                                disabled={isHomeworkSubmitted}
                                showTitle
                              />
                            )}
                          </>
                        ) : (
                          <div className="drawing-board-wrapper">
                            <DrawingBoard
                              ref={drawingBoardRef}
                              backgroundImage={questionBgImage}
                              onClear={handleClearRequest}
                            />
                          </div>
                        )}

                        {isHomeworkSubmitted && (
                          <div className="answer-analysis-wrapper">
                            <div className="divider" />
                            <div className="result-section">
                              <div className="result-item answer-item">
                                <div className="item-label">参考答案：</div>
                                <div
                                  className="item-content"
                                  dangerouslySetInnerHTML={{
                                    __html: renderMessageContent((currentAnswerQuestion.answer || '').replace(/\$\s+/g, '$').replace(/\s+\$/g, '$'))
                                  }}
                                />
                              </div>
                              <div className="result-item analysis-item">
                                <div className="item-label">解析：</div>
                                <div
                                  className="item-content"
                                  dangerouslySetInnerHTML={{
                                    __html: renderMessageContent((currentAnswerQuestion.explanation || '').replace(/\$\s+/g, '$').replace(/\s+\$/g, '$'))
                                  }}
                                />
                              </div>
                              {!isCurrentQuestionCorrect && (
                                <div className="result-item mistake-item">
                                  <span className="item-label">是否添加到错题本：</span>
                                  <div className="item-controls">
                                    <Radio 
                                      checked={mistakeAddedStatus === 'yes'}
                                      value="yes"
                                      label="是"
                                      onChange={handleMistakeChange} 
                                    />
                                    <Radio 
                                      checked={mistakeAddedStatus === 'no'}
                                      value="no"
                                      label="否"
                                      onChange={handleMistakeChange} 
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-render-area">
                      <div className="empty-tip">请选择题目开始作答</div>
                    </div>
                  )}
                </div>

                <div
                  className={`textbookip-float ${mode === 'left' ? 'float-right' : 'float-left'}`}
                  onClick={() => handleToggle()}
                >
                  <img src={textbookipIcon} alt="textbookip" className="textbookip-icon" />
                </div>
              </div>
            </div>
          )}
          right={({ isVisible }) => (
            <div className="panel-bg2">
              <div
                className={`panel-content ${isVisible ? 'panel-visible' : 'panel-hidden'}`}
                style={{ width: '100%', minWidth: '300px' }}
              >
                <div className="panel-card ai-chat-card">
                  <div className="panel-card-body">
                    <HomeworkChatPanel
                      ref={homeworkChatPanelRef}
                      visible={isVisible}
                      question={currentAnswerQuestion}
                      onClose={() => handleToggle()}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        />
      </div>

      <Dialog
        open={showClearDialog}
        title="清空确认"
        confirmButtonText="清空"
        cancelButtonText="取消"
        onConfirm={confirmClearCanvas}
        onCancel={cancelClearCanvas}
      >
        确定要清空画布吗？此操作不可撤销。
      </Dialog>

      <Dialog
        open={showIncompleteHomeworkDialog}
        title="作业提交确认"
        confirmButtonText="继续提交"
        cancelButtonText="取消提交"
        onConfirm={handleIncompleteHomeworkConfirm}
        onCancel={handleIncompleteHomeworkCancel}
      >
        <div className="incomplete-homework-content">
          第{incompleteDialogData.incompleteQuestionNumbers.join('、')}题未完成，确定要提交吗？
        </div>
      </Dialog>
    </div>
  )
}

export default HomeworkAnswerView
