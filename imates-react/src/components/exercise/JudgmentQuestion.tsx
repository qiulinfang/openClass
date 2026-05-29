import React, { useMemo } from 'react'
import { BaseQuestion, type ExerciseItem } from '@/components/exercise/BaseQuestion'
import '@/components/exercise/JudgmentQuestion.css'

export interface JudgmentQuestionProps {
  question: ExerciseItem
  value?: string
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  disabled?: boolean
  onChange?: (value: string) => void
}

export const JudgmentQuestion: React.FC<JudgmentQuestionProps> = ({
  question,
  value = '',
  showTitle = false,
  showId = true,
  showAnalysis = false,
  disabled = false,
  onChange,
}) => {
  // 动态获取显示文本和内部标识
  const correctDisplay = useMemo(() => {
    const options = question.structuredContent?.options
    return (options && options.length > 0) ? options[0].text : '正确'
  }, [question.structuredContent?.options])

  const wrongDisplay = useMemo(() => {
    const options = question.structuredContent?.options
    return (options && options.length > 1) ? options[1].text : '错误'
  }, [question.structuredContent?.options])

  const correctLabel = useMemo(() => {
    const options = question.structuredContent?.options
    return (options && options.length > 0) ? options[0].text : '对'
  }, [question.structuredContent?.options])

  const wrongLabel = useMemo(() => {
    const options = question.structuredContent?.options
    return (options && options.length > 1) ? options[1].text : '错'
  }, [question.structuredContent?.options])

  const isCorrect = (val: string) => {
    const structured = question.structuredContent
    const rawAnswer = structured?.answer ?? question.answer
    
    // 转换答案为字符串进行比较
    let standardAnswer = ''
    if (typeof rawAnswer === 'boolean') {
      standardAnswer = rawAnswer ? correctLabel : wrongLabel
    } else if (rawAnswer) {
      standardAnswer = String(rawAnswer).trim()
    }

    // 兼容 ID 和 文本
    const options = structured?.options
    if (options && options.length > 0) {
      if (val === options[0].text) {
        return standardAnswer === options[0].text || standardAnswer === options[0].label || standardAnswer === 'true' || (rawAnswer as any) === true
      }
      if (options.length > 1 && val === options[1].text) {
        return standardAnswer === options[1].text || standardAnswer === options[1].label || standardAnswer === 'false' || (rawAnswer as any) === false
      }
    }

    // 默认逻辑
    if (val === '对') return ['对', '√', '正确', 'true', 'T'].includes(standardAnswer) || (rawAnswer as any) === true
    if (val === '错') return ['错', '×', '错误', 'false', 'F'].includes(standardAnswer) || (rawAnswer as any) === false
    
    return val === standardAnswer
  }

  const handleSelect = (label: string) => {
    if (disabled) return
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
          className={`judgment-item correct ${value === correctLabel ? 'active' : ''} ${
            disabled && value === correctLabel 
              ? (isCorrect(correctLabel) ? 'is-correct' : 'is-wrong') 
              : ''
          }`}
          onClick={() => handleSelect(correctLabel)}
        >
          <span className="label">{correctDisplay}</span>
          {disabled && value === correctLabel && (
            <div className="status-icon">
              {isCorrect(correctLabel) ? (
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
        <div 
          className={`judgment-item wrong ${value === wrongLabel ? 'active' : ''} ${
            disabled && value === wrongLabel 
              ? (isCorrect(wrongLabel) ? 'is-correct' : 'is-wrong') 
              : ''
          }`}
          onClick={() => handleSelect(wrongLabel)}
        >
          <span className="label">{wrongDisplay}</span>
          {disabled && value === wrongLabel && (
            <div className="status-icon">
              {isCorrect(wrongLabel) ? (
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
      </div>
    </BaseQuestion>
  )
}

export default JudgmentQuestion
