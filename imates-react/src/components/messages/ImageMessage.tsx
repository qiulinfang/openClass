import React, { useState, useEffect } from 'react'
import '@/components/messages/ImageMessage.css'

interface ImageMessageProps {
  base64DataUrl?: string
  url?: string
  filePath?: string
  width?: number
  height?: number
  fileSize?: number
  isUser?: boolean
  showInfo?: boolean
  maxWidth?: number
  maxHeight?: number
}

export const ImageMessage: React.FC<ImageMessageProps> = ({
  base64DataUrl,
  url,
  filePath,
  width = 0,
  height = 0,
  fileSize = 0,
  isUser = false,
  showInfo = false,
  maxWidth = 200,
  maxHeight = 200,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const imgSrc = base64DataUrl || url || filePath

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleClick = () => {
    if (!isLoading && !hasError) {
      setIsPreviewOpen(true)
    }
  }

  const handleClose = () => {
    setIsPreviewOpen(false)
  }

  const retryLoad = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLoading(true)
    setHasError(false)
    // 强制重新加载图片
    const img = new Image()
    img.onload = () => {
      setIsLoading(false)
      setHasError(false)
    }
    img.onerror = () => {
      setIsLoading(false)
      setHasError(true)
    }
    img.src = imgSrc + (imgSrc?.includes('?') ? '&' : '?') + 't=' + Date.now()
  }

  const getImageStyle = (): React.CSSProperties => {
    if (!width || !height) {
      return {
        maxWidth: `${maxWidth}px`,
        maxHeight: `${maxHeight}px`,
      }
    }

    // 计算缩放比例，保持宽高比
    const widthRatio = maxWidth / width
    const heightRatio = maxHeight / height
    const scale = Math.min(widthRatio, heightRatio, 1)

    return {
      width: `${width * scale}px`,
      height: `${height * scale}px`,
    }
  }

  useEffect(() => {
    if (imgSrc) {
      const img = new Image()
      img.onload = () => {
        setIsLoading(false)
        setHasError(false)
      }
      img.onerror = () => {
        setIsLoading(false)
        setHasError(true)
      }
      img.src = imgSrc
    }
  }, [imgSrc])

  if (hasError) {
    return (
      <div className={`image-message error ${isUser ? 'user' : 'ai'}`}>
        <svg viewBox="0 0 24 24" width="32" height="32" fill="#999">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
        <span className="error-text">图片加载失败</span>
        <button className="retry-btn" onClick={retryLoad}>重试</button>
      </div>
    )
  }

  return (
    <>
      <div 
        className={`image-message ${isUser ? 'user' : 'ai'}`}
        onClick={handleClick}
      >
        <div className="image-container">
          {isLoading && (
            <div className="image-loading">
              <div className="image-loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="loading-text">加载中...</span>
            </div>
          )}
          <img
            src={imgSrc}
            alt={`图片消息 ${width}×${height}`}
            style={{ ...getImageStyle(), display: isLoading ? 'none' : 'block' }}
          />
          {showInfo && !isLoading && !hasError && (
            <div className="image-info">
              <div className="image-size">{formatFileSize(fileSize)}</div>
              <div className="image-dimensions">{width} × {height}</div>
            </div>
          )}
        </div>
      </div>

      {isPreviewOpen && (
        <div className="image-preview-overlay" onClick={handleClose}>
          <div className="image-preview-content">
            <img src={imgSrc} alt="预览" />
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
