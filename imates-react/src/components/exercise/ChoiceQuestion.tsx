import React, { useMemo, useCallback } from 'react'
import { BaseQuestion, type ExerciseItem } from '@/components/exercise/BaseQuestion'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import '@/components/exercise/ChoiceQuestion.css'

export interface ChoiceQuestionProps {
  question: ExerciseItem
  value?: string[]
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  disabled?: boolean
  onChange?: (value: string[]) => void
}

export const ChoiceQuestion: React.FC<ChoiceQuestionProps> = ({
  question,
  value = [],
  showTitle = false,
  showId = true,
  showAnalysis = false,
  disabled = false,
  onChange,
}) => {
  const { renderMessageContent } = useMessageRenderer()

  const options = useMemo(() => {
    return (question.structuredContent as any)?.options || []
  }, [question])

  const isSelected = useCallback((label: string) => value.includes(label), [value])

  const isCorrect = useCallback((label: string) => {
    const answer = question.answer
    if (Array.isArray(answer)) {
      return answer.includes(label)
    }
    // 某些情况下后端可能返回 "C,D" 格式
    if (typeof answer === 'string' && answer.includes(',')) {
      return answer.split(',').map((s: string) => s.trim()).includes(label)
    }
    return answer === label
  }, [question.answer])

  const handleSelect = (label: string) => {
    if (disabled) return
    
    let newSelected = [...value]
    const index = newSelected.indexOf(label)
    
    if (index > -1) {
      newSelected.splice(index, 1)
    } else {
      // 判断是否为多选题
      const isMultiple =
        question.type === 'multiple_choice' ||
        (question.structuredContent as any)?.type === 'multiple_choice'

      if (isMultiple) {
        newSelected.push(label)
        newSelected.sort() // 排序以保持一致性
      } else {
        newSelected = [label]
      }
    }
    
    onChange?.(newSelected)
  }

  return (
    <BaseQuestion 
      question={question} 
      showTitle={showTitle} 
      showId={showId} 
      showAnalysis={showAnalysis}
    >
      <div className="choice-options">
        {options.map((opt: any) => (
          <div 
            key={opt.label}
            className={`option-item ${isSelected(opt.label) ? 'selected' : ''} ${
              disabled && isSelected(opt.label) 
                ? (isCorrect(opt.label) ? 'correct' : 'wrong') 
                : ''
            }`}
            onClick={() => handleSelect(opt.label)}
          >
            <div className="option-label">{opt.label}</div>
            <div className="option-text" dangerouslySetInnerHTML={{ __html: renderMessageContent(opt.text || '') }} />
            {disabled && isSelected(opt.label) && (
              <div className="option-status-icon">
                {isCorrect(opt.label) ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#22c55e">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#ef4444">
                    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                  </svg>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </BaseQuestion>
  )
}

export default ChoiceQuestion
