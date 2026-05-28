import React, { useState, useMemo } from 'react'
import { BaseQuestion, type ExerciseItem } from './BaseQuestion'
import './FillBlankQuestion.css'

export interface FillBlankQuestionProps {
  question: ExerciseItem
  modelValue?: string[]
  showTitle?: boolean
  showId?: boolean
  disabled?: boolean
  onChange?: (value: string[]) => void
}

export const FillBlankQuestion: React.FC<FillBlankQuestionProps> = ({
  question,
  modelValue = [],
  showTitle = false,
  showId = true,
  disabled = false,
  onChange,
}) => {
  const [answers, setAnswers] = useState<string[]>(modelValue)

  const parsedParts = useMemo(() => {
    const stem = question.structuredContent?.stem || question.question || ''
    const parts: Array<{ type: 'text' | 'blank'; content?: string; blankIndex?: number }> = []
    const blankCount = (stem.match(/_____/g) || []).length
    
    let lastIndex = 0
    let blankIndex = 0
    const regex = /_____+/g
    let match
    
    while ((match = regex.exec(stem)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: stem.slice(lastIndex, match.index) })
      }
      parts.push({ type: 'blank', blankIndex: blankIndex++ })
      lastIndex = match.index + match[0].length
    }
    
    if (lastIndex < stem.length) {
      parts.push({ type: 'text', content: stem.slice(lastIndex) })
    }
    
    return parts
  }, [question])

  const getBlankWidth = (index: number) => {
    const baseWidth = 100
    const answerLength = answers[index]?.length || 3
    return `${Math.max(baseWidth, answerLength * 20)}px`
  }

  const handleInput = (index: number, value: string) => {
    const newAnswers = [...answers]
    newAnswers[index] = value
    setAnswers(newAnswers)
    onChange?.(newAnswers)
  }

  return (
    <BaseQuestion 
      question={question} 
      showTitle={showTitle} 
      showId={showId}
    >
      <div className="fill-blank-question">
        <div className="question-stem-content">
          {parsedParts.map((part, index) => (
            part.type === 'text' ? (
              <span key={`text-${index}`} className="text-part" dangerouslySetInnerHTML={{ __html: part.content || '' }} />
            ) : (
              <input
                key={`blank-${part.blankIndex}`}
                type="text"
                className={`blank-input ${disabled ? 'is-disabled' : ''}`}
                style={{ width: getBlankWidth(part.blankIndex!) }}
                placeholder="填入"
                disabled={disabled}
                value={answers[part.blankIndex!] || ''}
                onChange={(e) => handleInput(part.blankIndex!, e.target.value)}
              />
            )
          ))}
        </div>
      </div>
    </BaseQuestion>
  )
}

export default FillBlankQuestion
