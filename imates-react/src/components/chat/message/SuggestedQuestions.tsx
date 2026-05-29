import React from 'react'
import '@/components/chat/message/SuggestedQuestions.css'

export interface SuggestedQuestionsProps {
  questions?: string[]
  onQuestionClick?: (question: string) => void
}

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({
  questions = [],
  onQuestionClick,
}) => {
  if (questions.length === 0) return null

  return (
    <div className="suggested-questions">
      <div className="suggested-title">推荐问题</div>
      <div className="questions-list">
        {questions.map((q, index) => (
          <button
            key={index}
            className="question-item"
            onClick={() => onQuestionClick?.(q)}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SuggestedQuestions
