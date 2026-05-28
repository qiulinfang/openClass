import React from 'react'
import './ScreenshotThumb.css'

export interface ScreenshotThumbProps {
  imageUrl: string
  active?: boolean
  showDelete?: boolean
  onClick?: () => void
  onRemove?: () => void
}

export const ScreenshotThumb: React.FC<ScreenshotThumbProps> = ({
  imageUrl,
  active = false,
  showDelete = false,
  onClick,
  onRemove,
}) => {
  return (
    <div
      className={`screenshot-thumb ${active ? 'screenshot-thumb--active' : ''}`}
      onClick={onClick}
    >
      <img src={imageUrl} alt="截图预览" className="screenshot-thumb-img" />
      {showDelete && (
        <button
          type="button"
          className="screenshot-thumb-close"
          onClick={(e) => { e.stopPropagation(); onRemove?.() }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default ScreenshotThumb
