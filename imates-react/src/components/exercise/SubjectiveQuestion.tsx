import React, { useRef, useEffect, useCallback } from 'react'
import { BaseQuestion, type ExerciseItem } from './BaseQuestion'
import DrawingBoardNew from '@/components/drawing/DrawingBoardNew'
import './SubjectiveQuestion.css'

export interface SubjectiveQuestionProps {
  question: ExerciseItem
  value?: any // Expected to be an object containing boardData
  showTitle?: boolean
  showId?: boolean
  disabled?: boolean
  enableAskAi?: boolean
  onChange?: (value: any) => void
}

export const SubjectiveQuestion: React.FC<SubjectiveQuestionProps> = ({
  question,
  value = {},
  showTitle = false,
  showId = true,
  disabled = false,
  enableAskAi = false,
  onChange,
}) => {
  const drawingBoardRef = useRef<any>(null)

  // Initialize data
  useEffect(() => {
    if (value?.boardData && drawingBoardRef.current) {
      if (drawingBoardRef.current.loadData) {
        drawingBoardRef.current.loadData(value.boardData)
      }
    }
  }, [value?.boardData])

  const handleBoardSave = useCallback((boardData: any) => {
    const newValue = {
      ...value,
      boardData,
      type: 'board',
      timestamp: Date.now()
    }
    onChange?.(newValue)
  }, [value, onChange])

  return (
    <div className="subjective-question">
      <BaseQuestion 
        question={question} 
        showTitle={showTitle} 
        showId={showId}
      >
        <div className="answer-area q-mt-md">
          {showTitle && <div className="answer-label q-mb-sm text-weight-bold">作答区：</div>}
          <div className="drawing-board-wrapper">
            <DrawingBoardNew
              ref={drawingBoardRef}
              showGrid={false}
              enableAskAi={enableAskAi}
              showToolbar={!disabled}
              disabled={disabled}
              showZoomControls={false}
              backgroundPosition="topLeft"
              initialZoom={70}
              onSave={handleBoardSave}
            />
          </div>
        </div>
      </BaseQuestion>
    </div>
  )
}

export default SubjectiveQuestion
