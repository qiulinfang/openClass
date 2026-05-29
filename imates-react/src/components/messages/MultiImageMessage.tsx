import React, { useState } from 'react'
import '@/components/messages/MultiImageMessage.css'

interface ImageItem {
  filePath?: string
  width: number
  height: number
  fileSize?: number
  base64DataUrl?: string
  url?: string
  isLargeImage?: boolean
}

interface MultiImageMessageProps {
  images: ImageItem[]
  textContent?: string
  isUser?: boolean
}

export const MultiImageMessage: React.FC<MultiImageMessageProps> = ({
  images,
  textContent,
  isUser = false,
}) => {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const getGridClass = (count: number): string => {
    if (count === 1) return 'grid-1'
    if (count === 2) return 'grid-2'
    if (count === 3) return 'grid-3'
    if (count === 4) return 'grid-4'
    return 'grid-many'
  }

  const handleClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setPreviewIndex(index)
  }

  const handleClosePreview = () => {
    setPreviewIndex(null)
  }

  const handlePrev = () => {
    if (previewIndex !== null && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1)
    }
  }

  const handleNext = () => {
    if (previewIndex !== null && previewIndex < images.length - 1) {
      setPreviewIndex(previewIndex + 1)
    }
  }

  const renderImage = (image: ImageItem, index: number) => {
    return (
      <div 
        key={index} 
        className="multi-image-item"
        onClick={(e) => handleClick(index, e)}
      >
        <img 
          src={image.base64DataUrl || image.url || image.filePath} 
          alt="图片" 
          className="multi-image-img"
          onError={(e) => console.error('图片加载失败:', index, image.base64DataUrl || image.url || image.filePath, e)}
        />
      </div>
    )
  }

  return (
    <>
      <div className={`multi-image-message ${isUser ? 'user' : 'ai'}`}>
        <div className={`multi-image-grid ${getGridClass(images.length)}`}>
          {images.slice(0, 9).map((image, index) => renderImage(image, index))}
        </div>
        {textContent && (
          <div className="multi-image-text">{textContent}</div>
        )}
      </div>

      {previewIndex !== null && (
        <div className="multi-image-preview" onClick={handleClosePreview}>
          <div className="multi-image-preview-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={images[previewIndex].base64DataUrl || images[previewIndex].filePath} 
              alt={`预览 ${previewIndex + 1}`} 
            />
          </div>
          <button className="preview-close" onClick={handleClosePreview}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          {images.length > 1 && (
            <>
              <button 
                className="preview-nav prev" 
                onClick={handlePrev}
                disabled={previewIndex === 0}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>
              <button 
                className="preview-nav next" 
                onClick={handleNext}
                disabled={previewIndex === images.length - 1}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </button>
              <div className="preview-counter">
                {previewIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default MultiImageMessage
