import React, { useState } from 'react'
import { ChoiceQuestion } from '../components/exercise/ChoiceQuestion'
import { JudgmentQuestion } from '../components/exercise/JudgmentQuestion'
import './MistakeBookView.css'

export interface MistakeQuestion {
  id: string
  type?: string
  question?: string
  answer?: string
  explanation?: string
  structuredContent?: any
}

export const MistakeBookView: React.FC = () => {
  const [filters, setFilters] = useState({
    subject: '',
    source: '',
  })
  const [mistakeList] = useState<MistakeQuestion[]>([])
  const [currentQuestion] = useState<MistakeQuestion | null>(null)

  const subjectOptions = [
    { label: '全部学科', value: '' },
    { label: '数学', value: 'math' },
    { label: '语文', value: 'chinese' },
    { label: '英语', value: 'english' },
  ]

  const sourceOptions = [
    { label: '全部来源', value: '' },
    { label: '作业', value: 'homework' },
    { label: '独立练习', value: 'practice' },
  ]

  const handleQuestionSelected = (question: MistakeQuestion) => {
    console.log('[MistakeBookView] 选择题目', question)
  }

  const isChoiceQuestion = ['single_choice', 'multiple_choice'].includes(currentQuestion?.type || '')
  const isJudgmentQuestion = ['true_false', 'judgment'].includes(currentQuestion?.type || '')

  return (
    <div className="mistake-book-view">
      <div className="main-layout">
        <div className="layout-column left">
          <div className="column-header">
            <img src="/icons/mistake-book.svg" alt="错题本" className="mistake-logo" />
          </div>
          <div className="column-main left-sidebar-card">
            <div className="mistake-question-list">
              {mistakeList.length === 0 ? (
                <div className="empty-list">
                  <span>暂无错题</span>
                </div>
              ) : (
                mistakeList.map((item) => (
                  <div
                    key={item.id}
                    className="question-item"
                    onClick={() => handleQuestionSelected(item)}
                  >
                    <span className="question-preview">{item.question?.slice(0, 50)}...</span>
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
              <select
                className="filter-tab"
                value={filters.subject}
                onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
              >
                {subjectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                className="filter-tab"
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              >
                {sourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="column-main right-content-card">
            {currentQuestion ? (
              <div className="question-section">
                <div className="question-body">
                  {isChoiceQuestion && (
                    <ChoiceQuestion
                      question={currentQuestion}
                      modelValue={[]}
                      disabled
                      showTitle
                      showId={false}
                    />
                  )}
                  {isJudgmentQuestion && (
                    <JudgmentQuestion
                      question={currentQuestion}
                      modelValue=""
                      disabled
                      showTitle
                      showId={false}
                    />
                  )}
                  {!isChoiceQuestion && !isJudgmentQuestion && (
                    <div className="question-content">
                      {currentQuestion.question}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-content">
                <span>请选择一道错题查看详情</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MistakeBookView
