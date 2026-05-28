import React from 'react'
import './ExerciseChatPanelNew.css'

export interface ExerciseChatPanelNewProps {
  visible?: boolean
  onClose?: () => void
}

export const ExerciseChatPanelNew: React.FC<ExerciseChatPanelNewProps> = ({
  visible = false,
  onClose,
}) => {
  if (!visible) return null

  return (
    <div className="exercise-chat-panel-new">
      <div className="panel-header">
        <h3>练习答疑 (新版)</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="panel-content">
        <div className="placeholder">练习内容区域 (新版)</div>
      </div>
    </div>
  )
}

export default ExerciseChatPanelNew
