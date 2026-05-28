import React, { useState } from 'react'
import './QuestionDebugPanel.css'

export interface QuestionDebugPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const QuestionDebugPanel: React.FC<QuestionDebugPanelProps> = ({
  visible = false,
  onClose,
}) => {
  const [questions] = useState<any[]>([])
  const [currentQuestionIndex] = useState(-1)

  const storageSize = '0 KB'
  const subjectStatistics = '暂无数据'

  const refreshData = () => {
    console.log('[QuestionDebugPanel] 刷新数据')
  }

  const clearLocalData = () => {
    console.log('[QuestionDebugPanel] 清空本地数据')
  }

  const exportData = () => {
    console.log('[QuestionDebugPanel] 导出数据')
  }

  const importData = () => {
    console.log('[QuestionDebugPanel] 导入数据')
  }

  if (!visible) return null

  return (
    <div className="question-debug-panel">
      <div className="panel-header">
        <span>🔧 调试面板 - 题目管理</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-stats">
        <div className="stats-banner">
          <div className="stats-icon">📊</div>
          <div className="stats-content">
            <div className="stats-title">存储统计</div>
            <div className="stats-subtitle">
              题目总数: {questions.length} | 
              当前选中: {currentQuestionIndex >= 0 ? `#${currentQuestionIndex + 1}` : '无'} | 
              存储大小: {storageSize}
            </div>
            <div className="stats-subtitle">
              科目分布: {subjectStatistics}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-actions">
        <button className="action-btn" onClick={refreshData}>刷新</button>
        <button className="action-btn danger" onClick={clearLocalData}>清空本地数据</button>
        <button className="action-btn secondary" onClick={exportData}>导出数据</button>
        <button className="action-btn success" onClick={importData}>导入数据</button>
      </div>

      <div className="panel-content">
        <div className="empty-state">暂无题目数据</div>
      </div>
    </div>
  )
}

export default QuestionDebugPanel
