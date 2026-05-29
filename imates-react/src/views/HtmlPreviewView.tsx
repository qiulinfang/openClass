import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '@/views/HtmlPreviewView.css'

export const HtmlPreviewView: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true)
  const [isLoading] = useState(false)
  const [error] = useState<string | null>(null)

  const htmlContentUrl = searchParams.get('url') || ''

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleCloseChatPanel = () => {
    setIsRightPanelOpen(false)
  }

  return (
    <div className="html-preview-view">
      <div className="dual-panel">
        <div className="left-panel">
          <div className="html-preview-container">
            <div className="toolbar">
              <button className="goback-btn" onClick={handleGoBack}>
                <img src="/icons/goback.svg" alt="返回" className="goback-icon" />
              </button>
              <div className="toolbar-spacer"></div>
              <button className="toolbar-action-btn">打印原始</button>
              <button className="toolbar-action-btn">打印实时</button>
            </div>

            <div className="html-content-wrapper">
              {!error && htmlContentUrl && (
                <iframe
                  src={htmlContentUrl}
                  className="html-iframe"
                  frameBorder="0"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              )}

              {isLoading && (
                <div className="loading-overlay">
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <div className="loading-text">正在加载HTML...</div>
                  </div>
                </div>
              )}

              {error && (
                <div className="error-overlay">
                  <div className="error-state">
                    <div className="error-icon">⚠️</div>
                    <div className="error-text">{error}</div>
                    <button className="retry-button">重试</button>
                  </div>
                </div>
              )}
            </div>

            {!isRightPanelOpen && (
              <button className="fab-chat" onClick={() => setIsRightPanelOpen(true)}>
                💬
              </button>
            )}
          </div>
        </div>

        {isRightPanelOpen && (
          <div className="right-panel">
            <div className="chat-panel-wrapper">
              <div className="chat-placeholder">
                <span>对话面板</span>
                <button className="close-btn" onClick={handleCloseChatPanel}>×</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HtmlPreviewView
