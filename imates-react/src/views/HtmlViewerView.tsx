import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './HtmlViewerView.css'

export const HtmlViewerView: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [htmlContent, setHtmlContent] = useState<string | null>(null)

  const htmlContentUrl = searchParams.get('url') || ''

  useEffect(() => {
    if (htmlContentUrl) {
      setIsLoading(false)
      setHtmlContent(htmlContentUrl)
    } else {
      setIsLoading(false)
    }
  }, [htmlContentUrl])

  const handleGoBack = () => {
    navigate(-1)
  }

  const retry = () => {
    setIsLoading(true)
    setError(null)
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  return (
    <div className="html-viewer-container">
      <div className="toolbar">
        <button className="back-button" onClick={handleGoBack}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
      </div>

      <div className="html-content-wrapper">
        {!isLoading && !error && htmlContent && (
          <iframe
            src={htmlContent}
            className="html-iframe"
            frameBorder="0"
            allowFullScreen
          />
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <div>正在加载HTML...</div>
              <div className="loading-hint">请稍候</div>
            </div>
          </div>
        )}

        {error && (
          <div className="error-overlay">
            <div className="error-state">
              <svg viewBox="0 0 24 24" width="50" height="50" fill="#f44336">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div>{error}</div>
              <div className="error-hint">请检查文件是否损坏或网络连接是否正常</div>
              <button className="retry-btn" onClick={retry}>重试</button>
            </div>
          </div>
        )}

        {!isLoading && !error && !htmlContent && (
          <div className="empty-state">
            <div className="empty-content">
              <svg viewBox="0 0 24 24" width="80" height="80" fill="#ccc">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              <div className="empty-title">暂无HTML文档</div>
              <div className="empty-hint">请选择或加载HTML文件开始查看</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HtmlViewerView
