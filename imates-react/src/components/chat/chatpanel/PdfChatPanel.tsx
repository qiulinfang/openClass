import React from 'react'
import './PdfChatPanel.css'

export interface PdfChatPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const PdfChatPanel: React.FC<PdfChatPanelProps> = ({
  visible = false,
  onClose,
}) => {
  if (!visible) return null

  return (
    <div className="pdf-chat-panel">
      <div className="panel-header">
        <h3>PDF 答疑</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="panel-content">
        <div className="placeholder">PDF 内容区域</div>
      </div>
    </div>
  )
}

export default PdfChatPanel
