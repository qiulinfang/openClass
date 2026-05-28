import React, { useState, useMemo } from 'react'
import './ImageMessage.css'

export interface ImageMessageProps {
  base64DataUrl?: string
  width?: number
  height?: number
  fileSize?: number
  isUser?: boolean
  maxWidth?: number
  maxHeight?: number
  showInfo?: boolean
}

export const ImageMessage: React.FC<ImageMessageProps> = ({
  base64DataUrl = '',
  width = 0,
  height = 0,
  fileSize = 0,
  isUser = false,
  maxWidth = 200,
  maxHeight = 200,
  showInfo = false,
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const imageUrl = useMemo(() => base64DataUrl, [base64DataUrl])
  const altText = useMemo(() => `图片消息 ${width}×${height}`, [width, height])

  const imageStyle = useMemo(() => {
    let scale = 1
    if (width > maxWidth || height > maxHeight) {
      scale = Math.min(maxWidth / width, maxHeight / height)
    }
    return {
      width: `${width * scale}px`,
      height: `${height * scale}px`,
    }
  }, [width, height, maxWidth, maxHeight])

  const handleImageLoad = () => {
    setIsLoading(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setLoadError(true)
  }

  const handleImageClick = () => {
    if (!isLoading && !loadError) {
      setShowPreview(true)
    }
  }

  const retryLoad = () => {
    setIsLoading(true)
    setLoadError(false)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={`image-message ${isUser ? 'image-message-user' : ''}`}>
      <div className="image-container" onClick={handleImageClick}>
        {isLoading && (
          <div className="image-loading">
            <div className="loading-spinner"></div>
            <span className="loading-text">加载中...</span>
          </div>
        )}
        {!isLoading && !loadError && (
          <img
            src={imageUrl}
            alt={altText}
            className="message-image"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={imageStyle}
          />
        )}
        {loadError && (
          <div className="image-error">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="#999">
              <path d="M21 5v6.59l-3-3.01-4 4.01-4-4-4 4-3-3.01V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2zm-3 6.42l3 3.01V19c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-6.58l3 2.99 4-4 4 4 4-3.99z"/>
            </svg>
            <span className="error-text">图片加载失败</span>
            <button className="retry-btn" onClick={retryLoad}>重试</button>
          </div>
        )}
        {showInfo && !isLoading && !loadError && (
          <div className="image-info">
            <div className="image-size">{formatFileSize(fileSize)}</div>
            <div className="image-dimensions">{width} × {height}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ImageMessage