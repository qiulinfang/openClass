import React from 'react'
import './MultiImageMessage.css'

export interface MultiImageMessageProps {
  images?: Array<{ url: string; width: number; height: number }>
  isUser?: boolean
  onImageClick?: (index: number) => void
}

export const MultiImageMessage: React.FC<MultiImageMessageProps> = ({
  images = [],
  isUser = false,
  onImageClick,
}) => {
  const getGridClass = (count: number): string => {
    if (count === 1) return 'grid-1'
    if (count === 2) return 'grid-2'
    if (count === 3) return 'grid-3'
    if (count === 4) return 'grid-4'
    return 'grid-many'
  }

  return (
    <div className={`multi-image-message ${isUser ? 'multi-image-user' : ''}`}>
      <div className={`image-grid ${getGridClass(images.length)}`}>
        {images.map((img, index) => (
          <div
            key={index}
            className="grid-item"
            onClick={() => onImageClick?.(index)}
          >
            <img src={img.url} alt={`图片 ${index + 1}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default MultiImageMessage
