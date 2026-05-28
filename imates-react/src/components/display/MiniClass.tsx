import React, { useState } from 'react'
import { Dialog } from '../base/Dialog'
import './MiniClass.css'

export interface MiniClassProps {
  open?: boolean
  classUrl?: string
  questionTitle?: string
  onClose?: () => void
}

export const MiniClass: React.FC<MiniClassProps> = ({
  open = false,
  classUrl = '',
  questionTitle = '',
  onClose,
}) => {
  const [is404] = useState(false)
  const [loading, setLoading] = useState(true)

  const handleIframeLoad = () => {
    setLoading(false)
  }

  const handleIframeError = () => {
    setLoading(false)
  }

  if (!open) return null

  return (
    <Dialog open={open} title="微课" onClose={onClose}>
      <div className="mini-class-container">
        {is404 ? (
          <div className="empty-container">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="#999">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM10 12l5 3V9z"/>
            </svg>
            <div className="empty-title">该题目暂无微课内容</div>
            <div className="empty-desc">微课资源可能尚未上传或已被移除</div>
          </div>
        ) : classUrl ? (
          <div className="video-container">
            <iframe
              src={classUrl}
              className="iframe-player"
              frameBorder="0"
              scrolling="auto"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
            {loading && (
              <div className="loading-overlay">
                <div className="loading-spinner"></div>
                <span>正在加载微课...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-container">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="#999">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM10 12l5 3V9z"/>
            </svg>
            <div className="empty-title">暂无微课内容</div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

export default MiniClass
