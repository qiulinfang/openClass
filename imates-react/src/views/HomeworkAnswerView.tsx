import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './HomeworkAnswerView.css'

export const HomeworkAnswerView: React.FC = () => {
  const navigate = useNavigate()
  const [mode] = useState('answer')
  const [questionSearchQuery] = useState('')
  const [displayTitle] = useState('作业答案')
  const [currentQuestion] = useState<any>(null)

  const goBack = () => {
    navigate(-1)
  }

  const handleModeChange = (newMode: string) => {
    console.log('[HomeworkAnswerView] 模式变化', newMode)
  }

  const handleStartAnswer = (question: any) => {
    console.log('[HomeworkAnswerView] 开始答题', question)
  }

  const handleOpenMiniClass = () => {
    console.log('[HomeworkAnswerView] 打开小班课')
  }

  return (
    <div className="homework-answer-view">
      <div className="business-header">
        <button className="back-btn" onClick={goBack}>
          <img src="/icons/goback.svg" alt="返回" />
        </button>
        <span className="header-title">{displayTitle}</span>
      </div>

      <div className="answer-body">
        <div className="split-panel">
          <div className="left-panel panel-bg1">
            <div className="panel-content">
              <div className="panel-card">
                <div className="panel-card-body">
                  <div className="question-list-placeholder">
                    <span>题目列表</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="center-panel panel-bg2">
            <div className="panel-content">
              <div className="question-content">
                {currentQuestion ? (
                  <div className="question-detail">
                    <span>题目内容</span>
                  </div>
                ) : (
                  <div className="empty-question">
                    <span>请选择一道题目</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="right-panel panel-bg3">
            <div className="panel-content">
              <div className="answer-area">
                <span>作答区域</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomeworkAnswerView
