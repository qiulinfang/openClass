import React, { useMemo, useCallback, useRef, useEffect } from 'react'
import { BaseQuestion, type ExerciseItem } from '@/components/exercise/BaseQuestion'
import ChoiceQuestion from './ChoiceQuestion'
import FillBlankQuestion from './FillBlankQuestion'
import JudgmentQuestion from './JudgmentQuestion'
import DrawingBoardNew from '@/components/drawing/DrawingBoardNew'
import { useMessageRenderer } from '@/hooks/useMessageRenderer'
import './CompositeQuestion.css'

export interface CompositeQuestionProps {
  question: ExerciseItem
  value?: Record<string, any>
  showTitle?: boolean
  disabled?: boolean
  onChange?: (value: Record<string, any>) => void
}

export const CompositeQuestion: React.FC<CompositeQuestionProps> = ({
  question,
  value = {},
  showTitle = true,
  disabled = false,
  onChange,
}) => {
  const { renderMessageContent } = useMessageRenderer()
  const drawingBoardRefs = useRef<Record<string, any>>({})

  const subQuestions = useMemo(() => {
    return (question as any).subQuestions || []
  }, [question])

  const handleUpdate = useCallback((id: string, subValue: any) => {
    const newValue = { ...value, [id]: subValue }
    onChange?.(newValue)
  }, [value, onChange])

  const handleBoardSave = useCallback((id: string, boardData: any) => {
    const currentVal = value[id] || {}
    handleUpdate(id, {
      ...currentVal,
      boardData: boardData,
      type: 'board'
    })
  }, [value, handleUpdate])

  const setDrawingBoardRef = (el: any, id: string) => {
    if (el) {
      drawingBoardRefs.current[id] = el
      // 延迟加载初始数据，确保组件已就绪
      const initialData = value[id]?.boardData
      if (initialData) {
        // DrawingBoardNew should have a method to load data or be controlled
        // Since the Vue version uses el.loadData, we mimic this or use a prop if available
        // In React, it's better if it's a prop, but if it's a ref-based imperative API:
        setTimeout(() => {
          if (el.loadData) {
            el.loadData(initialData)
          }
        }, 100)
      }
    }
  }

  // 包装普通子题为组件需要的格式 (保持与 TestExerciseView 逻辑一致)
  const wrapQuestion = (sub: any) => {
    if (!sub) return sub
    
    const rawOptions = sub.options || sub.structuredContent?.options || []
    const wrappedOptions = rawOptions.map((opt: any) => ({
      label: opt.id || opt.label, 
      text: opt.content || opt.text 
    }))
    
    return {
      ...sub,
      questionContent: sub.stem || sub.questionContent || sub.structuredContent?.stem || '',
      structuredContent: {
        stem: sub.stem || sub.questionContent || sub.structuredContent?.stem || '',
        options: wrappedOptions
      }
    }
  }

  const renderSubQuestion = (sub: any, sIdx: number) => {
    const subId = sub.id || String(sIdx)
    
    if (sub.type === 'composite') {
      return (
        <CompositeQuestion 
          key={subId}
          question={sub}
          value={value}
          onChange={onChange}
          showTitle={true}
          disabled={disabled}
        />
      )
    }

    if (sub.type === 'essay') {
      return (
        <div key={subId} className="essay-question-container">
          <BaseQuestion
            question={wrapQuestion(sub)}
            showTitle={true}
          />
          <div className="drawing-board-wrapper q-mt-md">
            <DrawingBoardNew
              ref={(el: any) => setDrawingBoardRef(el, subId)}
              showGrid={false}
              enableAskAi={false}
              showToolbar={!disabled}
              disabled={disabled}
              showZoomControls={false}
              backgroundPosition="topLeft"
              initialZoom={70}
              onSave={(data: any) => handleBoardSave(subId, data)}
            />
          </div>
        </div>
      )
    }

    // 普通子题渲染
    switch (sub.type) {
      case 'single_choice':
      case 'multiple_choice':
        return (
          <ChoiceQuestion
            key={subId}
            question={wrapQuestion(sub)}
            value={value[subId] || []}
            onChange={(val) => handleUpdate(subId, val)}
            showTitle={true}
            disabled={disabled}
          />
        )
      case 'fill_in_blank':
        return (
          <FillBlankQuestion
            key={subId}
            question={wrapQuestion(sub)}
            modelValue={value[subId] || []}
            onChange={(val) => handleUpdate(subId, val)}
            showTitle={true}
            disabled={disabled}
          />
        )
      case 'true_false':
      case 'judgment':
        return (
          <JudgmentQuestion
            key={subId}
            question={wrapQuestion(sub)}
            value={value[subId] || ''}
            onChange={(val) => handleUpdate(subId, val)}
            showTitle={true}
            disabled={disabled}
          />
        )
      default:
        return (
          <BaseQuestion
            key={subId}
            question={wrapQuestion(sub)}
            showTitle={true}
          />
        )
    }
  }

  return (
    <div className="composite-question">
      {/* 主材料展示 */}
      <div className="material-section q-mb-md">
        {showTitle && <div className="text-subtitle1 text-weight-bold">【主题干/材料】</div>}
        <div 
          className="q-mt-sm markdown-content" 
          dangerouslySetInnerHTML={{ __html: renderMessageContent((question as any).material || '') }} 
        />
      </div>

      {/* 子题列表 */}
      <div className="sub-questions-list">
        {subQuestions.map((sub: any, sIdx: number) => (
          <div 
            key={sub.id || sIdx} 
            className="sub-question-item q-ml-md q-mt-lg"
          >
            <div className="text-weight-bold text-primary q-mb-sm">子题 ({sIdx + 1}):</div>
            {renderSubQuestion(sub, sIdx)}
          </div>
        ))}
      </div>
    </div>
  )
}

export default CompositeQuestion
