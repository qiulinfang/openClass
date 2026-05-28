import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ExerciseSolveViewNew.css'

export const ExerciseSolveViewNew: React.FC = () => {
  const navigate = useNavigate()
  const [selectedSubjectFilter] = useState('')
  const [mode] = useState('solve')

  const SUBJECT_OPTIONS = [
    { label: '全部学科', value: '' },
    { label: '数学', value: 'math' },
    { label: '语文', value: 'chinese' },
  ]

  const goBack = () => {
    navigate(-1)
  }

  const onSubjectFilterChange = () => {
    console.log('[ExerciseSolveViewNew] 学科筛选变化')
  }

  const handleDraftClearClick = () => {
    console.log('[ExerciseSolveViewNew] 清空草稿')
  }

  const handleAskAiClick = () => {
    console.log('[ExerciseSolveViewNew] 询问AI')
  }

  return (
    <div className="exercise-solve-container">
      <header className="exercise-solve-header">
        <div className="header-left">
          <div className="left-header-back" onClick={goBack}>
            <img src="/icons/goback.svg" alt="返回" className="back-icon" />
          </div>
        </div>

        <div className="header-center">
          <div className="center-header-actions">
            <div className="toolbar-placeholder">
              <span>工具栏</span>
            </div>
          </div>
        </div>

        <div className="header-right">
          <select
            className="subject-filter-select"
            value={selectedSubjectFilter}
            onChange={onSubjectFilterChange}
          >
            {SUBJECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="exercise-body">
        <div className="split-panel">
          <div className="left-panel">
            <div className="question-list">
              <span>题目列表</span>
            </div>
          </div>

          <div className="center-panel">
            <div className="question-content">
              <span>题目内容</span>
            </div>
          </div>

          <div className="right-panel">
            <div className="answer-area">
              <span>作答区域</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExerciseSolveViewNew
