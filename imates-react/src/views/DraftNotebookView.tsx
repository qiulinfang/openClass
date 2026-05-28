import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DrawingBoard } from '../components/drawing/DrawingBoard'
import './DraftNotebookView.css'

export const DraftNotebookView: React.FC = () => {
  const navigate = useNavigate()
  const [splitterModel] = useState(50)
  const [chatPanelVisible] = useState(true)

  const handleBack = () => {
    navigate(-1)
  }

  const handleClearRequest = () => {
    console.log('[DraftNotebookView] 清空画板')
  }

  return (
    <div className="draft-notebook-page">
      <div className="content-layout">
        <div className="splitter-container">
          <div className="drawing-board-container">
            <div className="board-wrapper">
              <DrawingBoard
                showZoomControl
                onUndo={() => console.log('undo')}
                onRedo={() => console.log('redo')}
                onClear={handleClearRequest}
              />
            </div>
          </div>

          {chatPanelVisible && (
            <div className="chat-panel-container">
              <div className="chat-placeholder">
                <span>对话面板</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DraftNotebookView
