import React, { useMemo, useCallback, useEffect, useState } from 'react'
import { BaseQuestion, type ExerciseItem } from '@/components/exercise/BaseQuestion'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import '@/components/exercise/FillBlankQuestion.css'

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
  const { renderMessageContent } = useMessageRenderer()
  const [internalAnswers, setInternalAnswers] = useState<string[]>(modelValue)

  useEffect(() => {
    setInternalAnswers(modelValue)
  }, [modelValue])

  const parsedParts = useMemo(() => {
    const isChoice = question.type === 'single_choice' || question.type === 'multiple_choice'
    const stem = (!isChoice && question.questionContent)
      ? question.questionContent
      : (question.structuredContent?.stem || question.title || '')
      
    const regex = /\[blank_\d+\]/g
    const parts: Array<{ type: 'text' | 'blank', content?: string, blankIndex: number }> = []
    
    let lastIndex = 0
    let blankCount = 0
    let match

    while ((match = regex.exec(stem)) !== null) {
      // 添加文本部分
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: stem.substring(lastIndex, match.index),
          blankIndex: -1
        })
      }
      // 添加填空部分
      parts.push({
        type: 'blank',
        blankIndex: blankCount++
      })
      lastIndex = regex.lastIndex
    }

    // 添加剩余文本
    if (lastIndex < stem.length) {
      parts.push({
        type: 'text',
        content: stem.substring(lastIndex),
        blankIndex: -1
      })
    }

    return parts
  }, [question])

  const getBlankWidth = useCallback((index: number) => {
    const content = internalAnswers[index] || ''
    // 计算内容的实际宽度。汉字约 18px，字母/数字约 10px
    let width = 0
    for (let i = 0; i < content.length; i++) {
      width += content.charCodeAt(i) > 127 ? 18 : 10
    }
    const minWidth = 80
    return `${Math.max(minWidth, width + 30)}px`
  }, [internalAnswers])

  const handleInput = (index: number, value: string) => {
    const newAnswers = [...internalAnswers]
    newAnswers[index] = value
    setInternalAnswers(newAnswers)
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
              <span 
                key={`text-${index}`} 
                className="text-part" 
                dangerouslySetInnerHTML={{ __html: renderMessageContent(part.content || '') }} 
              />
            ) : (
              <input
                key={`blank-${part.blankIndex}`}
                type="text"
                className={`blank-input ${disabled ? 'is-disabled' : ''}`}
                style={{ width: getBlankWidth(part.blankIndex) }}
                placeholder="填入"
                disabled={disabled}
                value={internalAnswers[part.blankIndex] || ''}
                onChange={(e) => handleInput(part.blankIndex, e.target.value)}
              />
            )
          ))}
        </div>
      </div>
    </BaseQuestion>
  )
}

export default FillBlankQuestion
