import React from 'react'
import './HomeworkChatPanel.css'

export interface HomeworkChatPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const HomeworkChatPanel: React.FC<HomeworkChatPanelProps> = ({
  visible = false,
  onClose,
}) => {
  if (!visible) return null

  return (
    <div className="homework-chat-panel">
      <div className="panel-header">
        <h3>作业答疑</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="panel-content">
        <div className="placeholder">作业内容区域</div>
      </div>
    </div>
  )
}

export default HomeworkChatPanel
