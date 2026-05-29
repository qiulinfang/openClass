import React, { useMemo } from 'react'
import '@/components/exercise/BaseQuestion.css'

export interface ExerciseItem {
  type?: string
  bmNo?: string
  questionContent?: string
  structuredContent?: { stem?: string }
  question?: string
  title?: string
  answer?: string
  explanation?: string
}

export interface BaseQuestionProps {
  question: ExerciseItem
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  children?: React.ReactNode
}

export const BaseQuestion: React.FC<BaseQuestionProps> = ({
  question,
  showTitle = false,
  showId = true,
  showAnalysis = false,
  children,
}) => {
  const typeLabel = useMemo(() => {
    const map: Record<string, string> = {
      single_choice: '单选题',
      multiple_choice: '多选题',
      fill: '填空题',
      judgment: '判断题',
      essay: '问答题'
    }
    return question.type ? map[question.type] || '' : ''
  }, [question.type])

  const stemRaw = useMemo(() => {
    const isChoice = question.type === 'single_choice' || question.type === 'multiple_choice'
    if (!isChoice && question.questionContent) {
      return question.questionContent
    }
    return question.structuredContent?.stem || question.question || question.title || ''
  }, [question])

  return (
    <div className="base-question">
      {showTitle && (
        <div className="question-header">
          {typeLabel && <span className="question-type-tag">{typeLabel}</span>}
          {question.bmNo && showId && <span className="question-bm-no">{question.bmNo}</span>}
        </div>
      )}
    
      <div className="question-stem">
        <div dangerouslySetInnerHTML={{ __html: stemRaw }} />
      </div>

      <div className="question-content">
        {children}
      </div>

      {showAnalysis && (question.answer || question.explanation) && (
        <div className="question-footer">
          {question.answer && (
            <div className="analysis-section">
              <div className="section-title">参考答案</div>
              <div className="section-content answer" dangerouslySetInnerHTML={{ __html: question.answer }} />
            </div>
          )}
          {question.explanation && (
            <div className="analysis-section">
              <div className="section-title">题目解析</div>
              <div className="section-content" dangerouslySetInnerHTML={{ __html: question.explanation }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BaseQuestion
