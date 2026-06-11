import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useMistakeStore } from '@/stores/mistakeStore'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import { ChoiceQuestion } from '@/components/exercise/ChoiceQuestion'
import { JudgmentQuestion } from '@/components/exercise/JudgmentQuestion'
import { FillBlankQuestion } from '@/components/exercise/FillBlankQuestion'
import DrawingBoard from '@/components/drawing/DrawingBoard'
import Dialog from '@/components/base/Dialog'
import Button from '@/components/base/Button'
import Select from '@/components/base/Select'
import { parseQuestionStructure, mapBackendTypeToFrontend } from '@/utils/business/exercise-utils'
import { KNOWLEDGE_GRAPH_SUBJECT_OPTIONS } from '@/constants/subjects'
import '@/views/MistakeBookView.css'

export const MistakeBookView: React.FC = () => {
  const mistakeStore = useMistakeStore()
  const { renderMessageContent } = useMessageRenderer()
  
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const subjectOptions = useMemo(() => [
    { label: '全部学科', value: '全部学科' },
    ...KNOWLEDGE_GRAPH_SUBJECT_OPTIONS.map(opt => ({
      label: opt.label,
      value: opt.label
    }))
  ], [])

  const sourceOptions = [
    { label: '全部来源', value: '全部来源' },
    { label: '随堂练习', value: '随堂练习' },
    { label: '课后作业', value: '课后作业' }
  ]

  useEffect(() => {
    mistakeStore.fetchMistakes()
    return () => {
      mistakeStore.clearState()
    }
  }, [])

  const filteredMistakes = mistakeStore.getFilteredMistakes()
  const currentMistake = mistakeStore.getCurrentMistake()

  const currentQuestionData = useMemo(() => {
    const data = currentMistake?.questionData
    if (!data) return null
    
    if (!data.structuredContent && data.questionStructureData) {
      const structured = parseQuestionStructure(data.questionStructureData)
      if (structured) {
        return {
          ...data,
          structuredContent: structured,
          type: data.type || mapBackendTypeToFrontend(structured.type || 'essay')
        }
      }
    }
    return data
  }, [currentMistake])

  const latestRecord = useMemo(() => currentMistake?.practiceHistory?.[0] || null, [currentMistake])
  const latestAnswer = useMemo(() => latestRecord?.originalAnswer as any, [latestRecord])
  
  const currentQuestionChooseList = useMemo(() => latestAnswer?.chooseList || [], [latestAnswer])
  const currentQuestionJudgment = useMemo(() => latestAnswer?.judgmentValue || '', [latestAnswer])
  const currentQuestionFillList = useMemo(() => latestAnswer?.fillList || [], [latestAnswer])

  useEffect(() => {
    setShowAnalysis(false)
    if (currentMistake) {
      console.log('[MistakeBook] 当前错题数据:', currentMistake)
    }
  }, [currentMistake])

  const handleQuestionSelected = (index: number) => {
    mistakeStore.selectMistake(index)
  }

  const addToExerciseList = async () => {
    if (!currentMistake) return
    try {
      const subject = currentMistake.questionData.subject || 'math'
      const response = await apiService.addQuestionToList(currentMistake.questionData, subject)
      if (response.success) {
        showMessage('已成功加入习题列表，快去练习吧', 'success')
      } else {
        showMessage('此题暂不支持加入习题集', 'error')
      }
    } catch (error) {
      showMessage('此题暂不支持加入习题集', 'error')
    }
  }

  const confirmDelete = () => {
    if (!currentMistake) return
    const index = filteredMistakes.findIndex(m => m.bmNo === currentMistake.bmNo)
    if (index !== -1) {
      setPendingDeleteIndex(index)
      setIsDeleteDialogOpen(true)
    }
  }

  const doDelete = async () => {
    if (pendingDeleteIndex !== null) {
      await mistakeStore.deleteMistake(pendingDeleteIndex)
    }
    setIsDeleteDialogOpen(false)
    setPendingDeleteIndex(null)
  }

  const isChoiceQuestion = ['single_choice', 'multiple_choice'].includes(currentQuestionData?.type || '')
  const isJudgmentQuestion = ['true_false', 'judgment'].includes(currentQuestionData?.type || '')
  const isFillBlankQuestion = ['fill_in_blank', 'fill'].includes(currentQuestionData?.type || '')

  return (
    <div className="mistake-book-view">
      <div className="main-layout">
        <div className="layout-column left">
          <div className="column-header">
            <img src="/icons/mistakeLogo.svg" alt="错题本" className="mistake-logo" />
          </div>
          <div className="column-main left-sidebar-card">
            <div className="mistake-question-list scroll-container">
              {filteredMistakes.length === 0 ? (
                <div className="empty-list">
                  <span>{mistakeStore.isLoading ? '加载中...' : '暂无错题'}</span>
                </div>
              ) : (
                filteredMistakes.map((item, index) => (
                  <div
                    key={item.bmNo}
                    className={`question-item ${mistakeStore.currentMistakeBmNo === item.bmNo ? 'active' : ''}`}
                    onClick={() => handleQuestionSelected(index)}
                  >
                    <div className="question-preview-content">
                      <span className="question-index">{(index + 1).toString().padStart(2, '0')}</span>
                      <span className="question-text-preview" dangerouslySetInnerHTML={{ __html: renderMessageContent(item.questionData.question || item.questionData.title || '').slice(0, 100) }}></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="layout-divider"></div>

        <div className="layout-column right">
          <div className="column-header">
            <div className="filter-tabs">
              <div className="filter-tab">
                <Select
                  value={mistakeStore.filters.subject}
                  options={subjectOptions}
                  variant="outline"
                  onChange={(val) => mistakeStore.setFilters({ subject: String(val) })}
                />
              </div>
              <div className="filter-tab">
                <Select
                  value={mistakeStore.filters.source}
                  options={sourceOptions}
                  variant="outline"
                  onChange={(val) => mistakeStore.setFilters({ source: String(val) })}
                />
              </div>
            </div>
          </div>
          <div className="column-main right-content-card">
            {currentQuestionData ? (
              <>
                <div className="question-section">
                  <div className="question-body scroll-container">
                    {(isChoiceQuestion || isJudgmentQuestion) ? (
                      <div className="structured-question-container">
                        {isChoiceQuestion && (
                          <ChoiceQuestion
                            question={currentQuestionData}
                            modelValue={currentQuestionChooseList}
                            disabled
                            showTitle
                            showId={false}
                          />
                        )}
                        {isJudgmentQuestion && (
                          <JudgmentQuestion
                            question={currentQuestionData}
                            modelValue={currentQuestionJudgment}
                            disabled
                            showTitle
                            showId={false}
                          />
                        )}
                        <div className="mistake-source-info">
                          {latestRecord?.homeworkId ? (
                            <span className="source-tag">来源于{latestRecord.homeworkName || '作业'}</span>
                          ) : (
                            <span className="source-tag">来源于独立练习</span>
                          )}
                        </div>
                      </div>
                    ) : isFillBlankQuestion ? (
                      <div className="structured-question-container">
                        <FillBlankQuestion
                          question={currentQuestionData}
                          modelValue={currentQuestionFillList}
                          disabled
                          showTitle
                          showId={false}
                        />
                        <div className="mistake-source-info">
                          {latestRecord?.homeworkId ? (
                            <span className="source-tag">来源于{latestRecord.homeworkName || '作业'}</span>
                          ) : (
                            <span className="source-tag">来源于独立练习</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="generic-question-content">
                        {latestAnswer?.imageData ? (
                          <div className="mistake-board-wrapper">
                            <img src={latestAnswer.imageData} alt="作答过程" style={{ width: '100%', height: 'auto' }} />
                          </div>
                        ) : (
                          <div 
                            className="question-text markdown-content" 
                            dangerouslySetInnerHTML={{ 
                              __html: renderMessageContent(currentQuestionData.questionContent || currentQuestionData.title || currentQuestionData.question) 
                            }} 
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="section-divider"></div>

                <div className={`answer-section ${showAnalysis ? 'is-expanded' : ''}`}>
                  <div className="answer-header-row">
                    <div className="interaction-tabs">
                      <div 
                        className={`tab-item ${showAnalysis ? 'active' : ''}`}
                        onClick={() => setShowAnalysis(!showAnalysis)}
                      >
                        查看答案
                        {showAnalysis && <div className="tab-indicator"></div>}
                      </div>
                    </div>

                    <div className="header-actions">
                      <Button
                        variant="ghost"
                        className="btn-remove"
                        label="移除"
                        onClick={confirmDelete}
                      />
                      <Button
                        variant="primary"
                        className="btn-add"
                        label="添加到习题"
                        onClick={addToExerciseList}
                      />
                    </div>
                  </div>

                  {showAnalysis && (
                    <div className="answer-display scroll-container">
                      <div className="explanation-content markdown-content">
                        {currentMistake?.questionData?.answer && (
                          <div className="standard-answer-section">
                            <div className="section-title">标准答案</div>
                            <div 
                              className="answer-text" 
                              dangerouslySetInnerHTML={{ 
                                __html: renderMessageContent((currentMistake.questionData.answer || '').replace(/\$\s+/g, '$').replace(/\s+\$/g, '$')) 
                              }} 
                            />
                          </div>
                        )}
                        {currentMistake?.questionData?.explanation && (
                          <div className="explanation-text-section">
                            <div className="section-title">题目解析</div>
                            <div 
                              className="answer-text" 
                              dangerouslySetInnerHTML={{ 
                                __html: renderMessageContent(currentMistake.questionData.explanation) 
                              }} 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <img src="/images/empty-state.png" alt="请选择错题" className="empty-icon" />
                <span>请选择一道错题查看详情</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={isDeleteDialogOpen}
        title="删除确认"
        confirmButtonText="删除"
        cancelButtonText="取消"
        onConfirm={doDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      >
        确定要从错题本中移除这道题吗？
      </Dialog>
    </div>
  )
}

export default MistakeBookView
