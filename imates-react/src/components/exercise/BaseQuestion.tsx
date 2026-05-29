import React, { useMemo, useEffect, useRef } from 'react'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import '@/components/exercise/BaseQuestion.css'

export interface ExerciseItem {
  id?: string
  type?: string
  bmNo?: string
  questionContent?: string
  structuredContent?: { 
    stem?: string
    answer?: any
    explanation?: string
    options?: any[]
  }
  question?: string
  title?: string
  answer?: any
  explanation?: string
}

export interface BaseQuestionProps {
  question: ExerciseItem
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  extra?: React.ReactNode
  children?: React.ReactNode
}

export const BaseQuestion: React.FC<BaseQuestionProps> = ({
  question,
  showTitle = false,
  showId = true,
  showAnalysis = false,
  extra,
  children,
}) => {
  const { renderMessageContent } = useMessageRenderer()
  const stemRef = useRef<HTMLDivElement>(null)

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

  const formattedStem = useMemo(() => renderMessageContent(stemRaw), [stemRaw, renderMessageContent])
  const formattedAnswer = useMemo(() => renderMessageContent(question.answer || ''), [question.answer, renderMessageContent])
  const formattedExplanation = useMemo(() => renderMessageContent(question.explanation || ''), [question.explanation, renderMessageContent])

  useEffect(() => {
    if (stemRef.current) {
      MathJaxUtils.renderMath(stemRef.current, true).catch(err => {
        console.warn('[BaseQuestion] MathJax 渲染失败:', err)
      })
    }
  }, [formattedStem, formattedAnswer, formattedExplanation])

  return (
    <div className="base-question">
      {showTitle && (
        <div className="question-header">
          {typeLabel && <span className="question-type-tag">{typeLabel}</span>}
          {question.bmNo && showId && <span className="question-bm-no">{question.bmNo}</span>}
          {extra}
        </div>
      )}
    
      <div className="question-stem" ref={stemRef}>
        <div dangerouslySetInnerHTML={{ __html: formattedStem }} />
      </div>

      <div className="question-content">
        {children}
      </div>

      {showAnalysis && (question.answer || question.explanation) && (
        <div className="question-footer">
          {question.answer && (
            <div className="analysis-section">
              <div className="section-title">参考答案</div>
              <div className="section-content answer" dangerouslySetInnerHTML={{ __html: formattedAnswer }} />
            </div>
          )}
          {question.explanation && (
            <div className="analysis-section">
              <div className="section-title">题目解析</div>
              <div className="section-content" dangerouslySetInnerHTML={{ __html: formattedExplanation }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BaseQuestion
