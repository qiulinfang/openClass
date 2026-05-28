import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ExerciseSolveView.css'

export const ExerciseSolveView: React.FC = () => {
  const navigate = useNavigate()
  const [toolbarFunction] = useState('solve')
  const [selectedSubjectFilter] = useState('')
  const [searchQuery] = useState('')
  const [splitterModel] = useState(30)
  const [showExploreOverlay] = useState(false)
  const [isFromHomework] = useState(false)

  const navItems = [
    { label: '答题', value: 'solve' },
    { label: '解析', value: 'analysis' },
    { label: '收藏', value: 'favorite' },
  ]

  const SUBJECT_OPTIONS = [
    { label: '全部学科', value: '' },
    { label: '数学', value: 'math' },
    { label: '语文', value: 'chinese' },
  ]

  const floatMenuItems = [
    { label: '教材', value: 'textbook' },
    { label: '搜题', value: 'search' },
  ]

  const goBack = () => {
    navigate(-1)
  }

  const onSubjectFilterChange = () => {
    console.log('[ExerciseSolveView] 学科筛选变化')
  }

  const handleFloatMenuSelect = (item: any) => {
    console.log('[ExerciseSolveView] 浮动菜单选择', item)
  }

  const handleExploreOverlayClick = () => {
    console.log('[ExerciseSolveView] 点击探索遮罩')
  }

  const handleStartAiGuidance = () => {
    console.log('[ExerciseSolveView] 开始AI引导')
  }

  const handleQuestionSelected = (question: any) => {
    console.log('[ExerciseSolveView] 选择题目', question)
  }

  const handleOpenMiniClass = () => {
    console.log('[ExerciseSolveView] 打开小班课')
  }

  const handlePasteToDraft = () => {
    console.log('[ExerciseSolveView] 粘贴到草稿')
  }

  const handleQuestionDeleted = () => {
    console.log('[ExerciseSolveView] 题目删除')
  }

  return (
    <div className="exercise-solve-container">
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="back-btn" onClick={goBack}>
            <img src="/icons/goback.svg" alt="返回" className="back-icon" />
          </div>
          <div className="nav-items">
            {navItems.map((item) => (
              <div
                key={item.value}
                className={`nav-item ${toolbarFunction === item.value ? 'active' : ''}`}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
        <div className="toolbar-right">
          {!isFromHomework && (
            <select
              className="subject-filter-select"
              value={selectedSubjectFilter}
              onChange={onSubjectFilterChange}
            >
              {SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="main-content">
        <div className="textbookip-float">
          <img src="/icons/textbookip.svg" alt="textbookip" />
        </div>

        {showExploreOverlay && (
          <div className="explore-overlay" onClick={handleExploreOverlayClick}>
            <img src="/icons/ipword.svg" alt="ipWord" className="explore-icon" />
          </div>
        )}

        <div className="splitter-container">
          <div className="question-panel">
            <div className="question-list-placeholder">
              <span>题目列表</span>
            </div>
          </div>

          <div className="content-panel">
            <div className="content-placeholder">
              <span>答题区域</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExerciseSolveView
