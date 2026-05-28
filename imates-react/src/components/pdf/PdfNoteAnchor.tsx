import React, { useState } from 'react'
import './PdfNoteAnchor.css'

export interface PdfNoteAnchorProps {
  mode?: 'marker' | 'create' | 'display'
  modelValue?: string
  position?: { x: number; y: number }
  userInitial?: string
  active?: boolean
  onChange?: (value: string) => void
  onMarkerClick?: () => void
}

export const PdfNoteAnchor: React.FC<PdfNoteAnchorProps> = ({
  mode = 'marker',
  modelValue = '',
  position = { x: 0, y: 0 },
  userInitial = 'U',
  active = false,
  onChange,
  onMarkerClick,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const markerStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
  }

  const tooltipStyle = {
    left: `${position.x + 20}px`,
    top: `${position.y}px`,
  }

  const handleMarkerClick = () => {
    if (mode === 'create') {
      setIsOpen(!isOpen)
    }
    onMarkerClick?.()
  }

  const handleConfirm = () => {
    setIsOpen(false)
  }

  const handleCancel = () => {
    setIsOpen(false)
  }

  return (
    <div>
      <div
        className="note-marker"
        style={markerStyle}
        onClick={handleMarkerClick}
      >
        <img src="/icons/note.svg" alt="note" className="note-marker-icon" />
        <span className="note-marker-initial">{userInitial}</span>
      </div>

      {mode === 'create' && isOpen && (
        <div className="note-tooltip" style={tooltipStyle} onClick={(e) => e.stopPropagation()}>
          <div className="note-input-card">
            <textarea
              value={modelValue}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="输入笔记"
              className="note-textarea"
              autoFocus
            />
            <div className="note-input-actions">
              <button className="action-btn confirm" onClick={handleConfirm}>✓</button>
              <button className="action-btn cancel" onClick={handleCancel}>✕</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'display' && active && (
        <div className="note-tooltip" style={tooltipStyle} onClick={(e) => e.stopPropagation()}>
          <div className="note-display-card">
            <div className="note-content">{modelValue}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfNoteAnchor
