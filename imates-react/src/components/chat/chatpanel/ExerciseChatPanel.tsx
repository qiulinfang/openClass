import React from 'react'
import '@/components/chat/chatpanel/ExerciseChatPanel.css'

export interface ExerciseChatPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const ExerciseChatPanel: React.FC<ExerciseChatPanelProps> = ({
  visible = false,
  onClose,
}) => {
  if (!visible) return null

  return (
    <div className="exercise-chat-panel">
      <div className="panel-header">
        <h3>练习答疑</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="panel-content">
        <div className="placeholder">练习内容区域</div>
      </div>
    </div>
  )
}

export default ExerciseChatPanel
