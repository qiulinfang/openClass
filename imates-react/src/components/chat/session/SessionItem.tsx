import React, { useMemo, useState } from 'react'
import { Checkbox } from '@/components/base/Checkbox'
import Popover from '@/components/base/Popover'
import ImageViewer from '@/components/display/ImageViewer'
import pinIcon from '/icons/zhiding.svg'
import pinOutlinedIcon from '/icons/quxiaozhiding.svg'
import deleteIcon from '/icons/delete.svg'
import '@/components/chat/session/SessionItem.css'

export interface SessionRecord {
  id: string
  sessionId?: string
  name?: string
  sessionName?: string
  question?: string
  thumbnailImage?: string
  answer?: string
  pinned?: boolean
  favorited?: boolean
  collect?: boolean
  updateTime?: number
  timestamp?: number
  createTime?: number
}

export interface SessionItemProps {
  record: SessionRecord
  selectedRecordId?: string
  isSelectionMode: boolean
  selectedRecordIds?: Set<string> | string[]
  onClick?: () => void
  onCheckboxChange?: (checked: boolean) => void
  onContextMenu?: () => void
  onPin?: () => void
  onDelete?: () => void
  onEnterSelectionMode?: () => void
}

export const SessionItem: React.FC<SessionItemProps> = ({
  record,
  selectedRecordId,
  isSelectionMode = false,
  selectedRecordIds = new Set(),
  onClick,
  onCheckboxChange,
  onContextMenu,
  onPin,
  onDelete,
  onEnterSelectionMode,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [imageViewerVisible, setImageViewerVisible] = useState(false)
  const [currentImageUrl, setCurrentImageUrl] = useState('')

  const recordId = useMemo(() => record.sessionId || record.id || '', [record])
  const recordName = useMemo(() => record.question || record.sessionName || record.name || '未命名会话', [record])
  const isSelected = useMemo(() => selectedRecordId === recordId, [selectedRecordId, recordId])

  const isChecked = useMemo(() => {
    if (selectedRecordIds instanceof Set) {
      return selectedRecordIds.has(recordId)
    }
    if (Array.isArray(selectedRecordIds)) {
      return selectedRecordIds.includes(recordId)
    }
    return false
  }, [selectedRecordIds, recordId])

  const truncatedAnswer = useMemo(() => {
    if (!record.answer) return ''
    return record.answer.length > 100 ? record.answer.substring(0, 100) + '...' : record.answer
  }, [record.answer])

  const handleThumbnailClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (record.thumbnailImage) {
      setCurrentImageUrl(record.thumbnailImage)
      setImageViewerVisible(true)
    }
  }

  const closeMenuAndExecute = (action?: () => void) => {
    setShowMoreMenu(false)
    action?.()
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

      <div 
        className="session-content" 
        onClick={onClick} 
        onContextMenu={(e) => {
          e.preventDefault()
          onContextMenu?.()
        }}
      >
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
          <img src={pinIcon} alt="已置顶" className="status-icon pin-icon" />
        )}
      </div>

      <div className="session-actions">
        <Popover
          visible={showMoreMenu}
          onVisibleChange={setShowMoreMenu}
          placement="bottom"
          offset={8}
          showArrow={false}
          content={
            <div className="session-more-menu-card">
              <div className="more-menu-item-row" onClick={() => closeMenuAndExecute(onPin)}>
                <img src={record.pinned ? pinOutlinedIcon : pinIcon} alt="置顶" width="18" height="18" />
                <div>{record.pinned ? '取消置顶' : '置顶'}</div>
              </div>

              <div className="more-menu-item-row" onClick={() => closeMenuAndExecute(onEnterSelectionMode)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M22 7h-9v2h9V7zm0 4h-9v2h9v-2zM4 13h4.58L10 14.42l1.41-1.41L13 14.42l-1.42 1.41L13 17.25l-1.41 1.41L10 17.25l-1.42 1.41L7 17.25l1.41-1.41L7 14.42 5.58 13 4 14.42 5.42 15.84 4 17.25 5.42 18.66 4 20.08 5.42 21.5 7 20.08l1.42 1.42 1.58-1.58 1.58 1.58L13 20.08l-1.42-1.42L13 17.25 11.58 15.84 13 14.42 11.58 13zM10 11.17l-1.58 1.58L7 11.17 8.42 9.75 7 8.34 8.42 6.92 10 8.34l1.58-1.42 1.42 1.42-1.58 1.42 1.58 1.41-1.42 1.41L10 11.17z"/>
                </svg>
                <div>多选</div>
              </div>

              <div className="session-more-menu-divider"></div>

              <div className="session-more-menu-delete-wrapper">
                <div className="more-menu-item-row" onClick={() => closeMenuAndExecute(onDelete)}>
                  <img src={deleteIcon} alt="删除" width="18" height="18" />
                  <div className="text-delete">删除</div>
                </div>
              </div>
            </div>
          }
        >
          <button className="more-btn">⋮</button>
        </Popover>
      </div>

      <ImageViewer 
        open={imageViewerVisible} 
        onClose={() => setImageViewerVisible(false)} 
        imageUrl={currentImageUrl} 
        alt="会话图片" 
      />
    </div>
  )
}

export default SessionItem
