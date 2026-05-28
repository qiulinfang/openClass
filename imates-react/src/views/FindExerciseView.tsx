import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FindExerciseQuestionList } from '../components/FindExerciseQuestionList'
import './FindExerciseView.css'

export const FindExerciseView: React.FC = () => {
  const navigate = useNavigate()
  const [isInitializing] = useState(false)
  const [isExiting] = useState(false)
  const [isStarting] = useState(false)
  const [selectedCount] = useState(0)
  const [selectableCount] = useState(0)

  const hasSelectableQuestions = selectableCount > 0
  const isAllSelected = selectedCount === selectableCount && selectableCount > 0
  const hasSelectedQuestions = selectedCount > 0

  const goBack = () => {
    navigate(-1)
  }

  const handleToggleSelectAll = () => {
    console.log('[FindExerciseView] 全选切换')
  }

  const handleStartExercise = () => {
    console.log('[FindExerciseView] 开始练习')
  }

  return (
    <div className="find-exercise-view">
      <div className="internal-toolbar">
        <button 
          className="toolbar-back-btn"
          onClick={goBack}
          disabled={isExiting}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        
        <div className="toolbar-title">
          <span>我的习题</span>
        </div>

        <div className="selection-info" style={{ visibility: hasSelectableQuestions ? 'visible' : 'hidden' }}>
          <span className="selection-count">
            已选{selectedCount}/{selectableCount}
          </span>
        </div>

        <div className="select-all-container" style={{ visibility: hasSelectableQuestions ? 'visible' : 'hidden' }}>
          <label className="select-all-checkbox">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
            />
            全选
          </label>
        </div>

        <button
          className={`start-practice-btn ${hasSelectedQuestions ? 'active' : ''}`}
          disabled={!hasSelectedQuestions}
          onClick={handleStartExercise}
        >
          {isStarting ? '加载中...' : '开始练习'}
        </button>
      </div>

      <div className="main-content">
        {isInitializing ? (
          <div className="initialization-loading">
            <div className="skeleton-grid">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="skeleton-card"></div>
              ))}
            </div>
          </div>
        ) : (
          <FindExerciseQuestionList
            similarQuestions={[]}
            isLoading={false}
            onQuestionClick={(q) => console.log('点击题目', q)}
            onToggleSelection={(bmNo) => console.log('切换选择', bmNo)}
          />
        )}
      </div>
    </div>
  )
}

export default FindExerciseView
