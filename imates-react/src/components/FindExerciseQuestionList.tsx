import React, { useState } from 'react'
import '@/components/FindExerciseQuestionList.css'

export interface ExerciseQuestion {
  bmNo: string
  question?: string
  answer?: string
  atUserList?: boolean
  [key: string]: any
}

export interface FindExerciseQuestionListProps {
  similarQuestions?: ExerciseQuestion[]
  isLoading?: boolean
  canLoadMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  onQuestionClick?: (question: ExerciseQuestion) => void
  onToggleSelection?: (bmNo: string) => void
}

export const FindExerciseQuestionList: React.FC<FindExerciseQuestionListProps> = ({
  similarQuestions = [],
  isLoading = false,
  canLoadMore = false,
  onLoadMore,
  onRefresh,
  onQuestionClick,
  onToggleSelection,
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  const isSelected = (bmNo: string) => selectedItems.has(bmNo)

  const handleToggleSelection = (bmNo: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(bmNo)) {
      newSelected.delete(bmNo)
    } else {
      newSelected.add(bmNo)
    }
    setSelectedItems(newSelected)
    onToggleSelection?.(bmNo)
  }

  const handleQuestionClick = (question: ExerciseQuestion) => {
    onQuestionClick?.(question)
  }

  const handleLoadMore = () => {
    onLoadMore?.()
  }

  const handleRefresh = () => {
    onRefresh?.()
  }

  const renderSkeleton = () => (
    <div className="native-loading-container">
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-header"></div>
            <div className="skeleton-content"></div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderEmptyState = () => (
    <div className="empty-state-container">
      <div className="empty-state-content">
        <div className="empty-icon-wrapper">
          <svg viewBox="0 0 24 24" width="96" height="96" fill="#ddd">
            <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
          </svg>
        </div>
        <div className="empty-title">未找到相似题目</div>
        <div className="empty-description">
          根据当前知识点暂未找到相关题目，<br />
          请尝试调整知识点范围或刷新页面
        </div>
        <button className="empty-action-btn" onClick={handleRefresh}>
          刷新页面
        </button>
      </div>
    </div>
  )

  const renderQuestionList = () => (
    <div className="questions-container">
      {similarQuestions.map((question, index) => (
        <div
          key={question.bmNo}
          className={`question-item ${isSelected(question.bmNo) ? 'question-selected' : ''} ${question.atUserList ? 'question-in-user-list' : ''}`}
          onClick={() => handleQuestionClick(question)}
        >
          <div className="question-block">
            <div className="question-header">
              <div className="question-number">题目{index + 1}</div>
              <div className="question-checkbox">
                <input
                  type="checkbox"
                  checked={isSelected(question.bmNo)}
                  onChange={() => handleToggleSelection(question.bmNo)}
                  disabled={question.atUserList}
                />
              </div>
            </div>
            <div className="question-content">
              {question.question || '题目内容'}
            </div>
            {question.atUserList && (
              <div className="question-tag">已添加</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="find-exercise-question-list">
      <div className="scroll-wrapper" onScroll={(e) => {
        const target = e.target as HTMLElement
        if (canLoadMore && !isLoading && target.scrollHeight - target.scrollTop - target.clientHeight < 200) {
          handleLoadMore()
        }
      }}>
        <div className="scroll-content">
          {isLoading && similarQuestions.length === 0 && renderSkeleton()}
          {similarQuestions.length === 0 && !isLoading && renderEmptyState()}
          {similarQuestions.length > 0 && renderQuestionList()}
        </div>
      </div>
    </div>
  )
}

export default FindExerciseQuestionList
