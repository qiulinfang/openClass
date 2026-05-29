import React, { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '@/views/VideoViewerView.css'

export const VideoViewerView: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const videoUrl = searchParams.get('url') || ''

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleVideoLoadStart = () => {
    setIsLoading(true)
  }

  const handleVideoLoadedMetadata = () => {
    setIsLoading(false)
  }

  const handleVideoCanPlay = () => {
    setIsLoading(false)
  }

  const handleVideoWaiting = () => {
    setIsLoading(true)
  }

  const handleVideoError = () => {
    setIsLoading(false)
    setError('视频加载失败')
  }

  const retry = () => {
    setIsLoading(true)
    setError(null)
    if (videoRef.current) {
      videoRef.current.load()
    }
  }

  return (
    <div className="video-viewer-container">
      <button className="goback-btn" onClick={handleGoBack}>
        <img src="/icons/goback.svg" alt="返回" className="goback-icon" />
      </button>

      <div className="video-content-wrapper">
        {!error && videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="video-player"
            controls
            preload="metadata"
            onLoadStart={handleVideoLoadStart}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onCanPlay={handleVideoCanPlay}
            onWaiting={handleVideoWaiting}
            onError={handleVideoError}
          >
            您的浏览器不支持视频播放
          </video>
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-state">
              <div className="spinner"></div>
              <span>正在加载...</span>
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

        {!isLoading && !error && !videoUrl && (
          <div className="empty-state">
            <div className="empty-content">
              <svg viewBox="0 0 24 24" width="80" height="80" fill="#ccc">
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM10 12l5 3V9z"/>
              </svg>
              <div className="empty-title">暂无视频文件</div>
              <div className="empty-hint">请选择或加载视频文件开始播放</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoViewerView
