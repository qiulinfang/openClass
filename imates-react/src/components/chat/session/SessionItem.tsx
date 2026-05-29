import React, { useMemo } from 'react'
import { Checkbox } from '@/components/base/Checkbox'
import '@/components/chat/session/SessionItem.css'

export interface SessionRecord {
  id: string
  name?: string
  thumbnailImage?: string
  answer?: string
  pinned?: boolean
  collect?: boolean
  updateTime?: number
}

export interface SessionItemProps {
  record: SessionRecord
  isSelected?: boolean
  isChecked?: boolean
  isSelectionMode?: boolean
  onClick?: () => void
  onCheckboxChange?: (checked: boolean) => void
  onContextMenu?: () => void
}

export const SessionItem: React.FC<SessionItemProps> = ({
  record,
  isSelected = false,
  isChecked = false,
  isSelectionMode = false,
  onClick,
  onCheckboxChange,
  onContextMenu,
}) => {
  const recordName = useMemo(() => record.name || '未命名会话', [record.name])

  const truncatedAnswer = useMemo(() => {
    if (!record.answer) return ''
    return record.answer.length > 50 ? record.answer.substring(0, 50) + '...' : record.answer
  }, [record.answer])

  const handleThumbnailClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      className={`session-item ${isSelected ? 'is-selected' : ''} ${isChecked ? 'is-checked' : ''} ${isSelectionMode ? 'is-selectable' : ''} ${record.pinned ? 'is-pinned' : ''}`}
    >
      {isSelectionMode && (
        <div className="session-checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isChecked}
            size="sm"
            onChange={onCheckboxChange}
          />
        </div>
      )}

      <div className="session-content" onClick={onClick} onContextMenu={onContextMenu}>
        {record.thumbnailImage && (
          <div
            className={`session-thumbnail ${isSelected ? 'thumbnail-is-selected' : ''}`}
            onClick={handleThumbnailClick}
          >
            <img src={record.thumbnailImage} alt="缩略图" className="thumbnail-image" />
            <div className="thumbnail-overlay">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </div>
          </div>
        )}

        <div className="session-header">
          <div className="session-title-row">
            <div className="session-title">{recordName}</div>
          </div>
          {record.answer && <div className="session-subtitle">{truncatedAnswer}</div>}
        </div>
      </div>

      <div className="session-status-icons">
        {record.pinned && (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#6e55ff">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
          </svg>
        )}
        {record.collect && (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#ff9800">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        )}
      </div>
    </div>
  )
}

export default SessionItem
