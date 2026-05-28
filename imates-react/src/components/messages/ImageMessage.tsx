import React, { useState } from 'react'
import './ImageMessage.css'

interface ImageMessageProps {
  base64DataUrl?: string
  width?: number
  height?: number
  fileSize?: number
  isUser?: boolean
  showInfo?: boolean
}

export const ImageMessage: React.FC<ImageMessageProps> = ({
  base64DataUrl,
  width = 0,
  height = 0,
  fileSize,
  isUser = false,
  showInfo = true,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleClick = () => {
    setIsPreviewOpen(true)
  }

  const handleClose = () => {
    setIsPreviewOpen(false)
  }

  const getImageStyle = (): React.CSSProperties => {
    const maxWidth = 200
    const maxHeight = 200
    
    if (width > 0 && height > 0) {
      if (width > height) {
        return { width: Math.min(width, maxWidth), height: 'auto' }
      } else {
        return { width: 'auto', height: Math.min(height, maxHeight) }
      }
    }
    
    return { maxWidth, maxHeight }
  }

  if (!base64DataUrl || hasError) {
    return (
      <div className="image-message error">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="#999">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
        <span>图片加载失败</span>
      </div>
    )
  }

  return (
    <>
      <div 
        className={`image-message ${isUser ? 'user' : 'ai'}`}
        onClick={handleClick}
      >
        {!isLoaded && (
          <div className="image-loading">
            <div className="image-loading-spinner" />
          </div>
        )}
        <img
          src={base64DataUrl}
          alt="图片"
          style={{ ...getImageStyle(), display: isLoaded ? 'block' : 'none' }}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
        {showInfo && fileSize && fileSize > 0 && (
          <div className="image-info">
            {formatFileSize(fileSize)}
          </div>
        )}
      </div>

      {isPreviewOpen && (
        <div className="image-preview-overlay" onClick={handleClose}>
          <div className="image-preview-content">
            <img src={base64DataUrl} alt="预览" />
          </div>
          <button className="image-preview-close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      )}
    </>
  )
}

export default ImageMessage
