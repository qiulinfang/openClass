import React from 'react'
import '@/components/chat/chatpanel/DraftNoteChatPanel.css'

export interface DraftNoteChatPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const DraftNoteChatPanel: React.FC<DraftNoteChatPanelProps> = ({
  visible = false,
  onClose,
}) => {
  if (!visible) return null

  return (
    <div className="draft-note-chat-panel">
      <div className="panel-header">
        <h3>草稿笔记</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="panel-content">
        <div className="placeholder">草稿内容区域</div>
      </div>
    </div>
  )
}

export default DraftNoteChatPanel
