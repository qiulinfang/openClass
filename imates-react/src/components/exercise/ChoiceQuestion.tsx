import React, { useState, useMemo } from 'react'
import { BaseQuestion, type ExerciseItem } from '@/components/exercise/BaseQuestion'
import '@/components/exercise/ChoiceQuestion.css'

export interface ChoiceQuestionProps {
  question: ExerciseItem
  modelValue?: string[]
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  disabled?: boolean
  onChange?: (value: string[]) => void
}

export const ChoiceQuestion: React.FC<ChoiceQuestionProps> = ({
  question,
  modelValue = [],
  showTitle = false,
  showId = true,
  showAnalysis = false,
  disabled = false,
  onChange,
}) => {
  const [selected, setSelected] = useState<string[]>(modelValue)

  const options = useMemo(() => {
    return (question.structuredContent as any)?.options || []
  }, [question])

  const isSelected = (label: string) => selected.includes(label)

  const isCorrect = (label: string) => {
    return question.answer?.includes(label)
  }

  const handleSelect = (label: string) => {
    if (disabled) return
    
    const isMultiple = question.type === 'multiple_choice'
    let newSelected: string[]
    
    if (isMultiple) {
      newSelected = selected.includes(label)
        ? selected.filter(s => s !== label)
        : [...selected, label]
    } else {
      newSelected = [label]
    }
    
    setSelected(newSelected)
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
            <div className="option-text" dangerouslySetInnerHTML={{ __html: opt.text || '' }} />
            {disabled && isSelected(opt.label) && (
              <div className="option-status-icon">
                {isCorrect(opt.label) ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#4caf50">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#f44336">
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
