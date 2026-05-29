import React, { forwardRef } from 'react'
import type { ExerciseItem } from '../../types'
import './QuestionList.css'

interface QuestionListProps {
  type: 'homework' | 'exercise'
  showPhotoSearch?: boolean
  showSendToAi?: boolean
  showQuestionActions?: boolean
  searchQuery?: string
  selectedSubjectFilter?: string
  onStartAiGuidance?: () => void
  onQuestionSelected?: (question: ExerciseItem) => void
  onOpenMiniClass?: (question: ExerciseItem) => void
  onPasteToDraft?: (payload: { dataUrl: string }) => void
  onQuestionDeleted?: (payload: { questionId: string; withDraft: boolean }) => void
  questions: ExerciseItem[]
  currentQuestion?: ExerciseItem | null
}

export const QuestionList = forwardRef<any, QuestionListProps>(({
  type,
  searchQuery,
  selectedSubjectFilter,
  onQuestionSelected,
  questions = [],
  currentQuestion
}, ref) => {
  const filteredQuestions = questions.filter(q => {
    if (selectedSubjectFilter && q.subject !== selectedSubjectFilter) return false
    if (searchQuery && !q.question?.includes(searchQuery)) return false
    return true
  })

  return (
    <div className="question-list" ref={ref}>
      <div className="list-header">
        <span>{type === 'homework' ? '作业题目' : '习题题目'}</span>
        <span className="count">({filteredQuestions.length})</span>
      </div>
      <div className="questions-container">
        {filteredQuestions.map((q, idx) => (
          <div
            key={q.id || q.bmNo}
            className={`question-item ${currentQuestion?.id === q.id ? 'active' : ''}`}
            onClick={() => onQuestionSelected?.(q)}
          >
            <div className="question-info">
              <span className="index">{idx + 1}.</span>
              <span className="subject-tag">{q.subject}</span>
            </div>
            <div className="question-preview">
              {q.question || q.title || '题目内容'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

QuestionList.displayName = 'QuestionList'

export default QuestionList
