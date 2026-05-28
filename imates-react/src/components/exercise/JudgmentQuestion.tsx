import React, { useState } from 'react'
import { BaseQuestion, type ExerciseItem } from './BaseQuestion'
import './JudgmentQuestion.css'

export interface JudgmentQuestionProps {
  question: ExerciseItem
  modelValue?: string
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  disabled?: boolean
  onChange?: (value: string) => void
}

export const JudgmentQuestion: React.FC<JudgmentQuestionProps> = ({
  question,
  modelValue = '',
  showTitle = false,
  showId = true,
  showAnalysis = false,
  disabled = false,
  onChange,
}) => {
  const [selected, setSelected] = useState<string>(modelValue)

  const correctLabel = 'T'
  const wrongLabel = 'F'
  const correctDisplay = '正确'
  const wrongDisplay = '错误'

  const isCorrect = (label: string) => {
    return question.answer === label
  }

  const handleSelect = (label: string) => {
    if (disabled) return
    setSelected(label)
    onChange?.(label)
  }

  return (
    <BaseQuestion 
      question={question} 
      showTitle={showTitle} 
      showId={showId} 
      showAnalysis={showAnalysis}
    >
      <div className="judgment-actions">
        <div 
          className={`judgment-item correct ${selected === correctLabel ? 'active' : ''} ${
            disabled && selected === correctLabel 
              ? (isCorrect(correctLabel) ? 'is-correct' : 'is-wrong') 
              : ''
          }`}
          onClick={() => handleSelect(correctLabel)}
        >
          <span className="label">{correctDisplay}</span>
          {disabled && selected === correctLabel && (
            <div className="status-icon">
              {isCorrect(correctLabel) ? (
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
        <div 
          className={`judgment-item wrong ${selected === wrongLabel ? 'active' : ''} ${
            disabled && selected === wrongLabel 
              ? (isCorrect(wrongLabel) ? 'is-correct' : 'is-wrong') 
              : ''
          }`}
          onClick={() => handleSelect(wrongLabel)}
        >
          <span className="label">{wrongDisplay}</span>
          {disabled && selected === wrongLabel && (
            <div className="status-icon">
              {isCorrect(wrongLabel) ? (
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
      </div>
    </BaseQuestion>
  )
}

export default JudgmentQuestion
