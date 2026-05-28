import React from 'react'
import './HtmlChatPanel.css'

export interface HtmlChatPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const HtmlChatPanel: React.FC<HtmlChatPanelProps> = ({
  visible = false,
  onClose,
}) => {
  if (!visible) return null

  return (
    <div className="html-chat-panel">
      <div className="panel-header">
        <h3>网页预览</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="panel-content">
        <div className="placeholder">HTML 内容区域</div>
      </div>
    </div>
  )
}

export default HtmlChatPanel
