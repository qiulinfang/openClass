import React from 'react'
import { SessionItem, SessionRecord } from './SessionItem'
import './SessionList.css'

export interface SessionListProps {
  records: SessionRecord[]
  selectedId?: string
  checkedIds?: string[]
  isSelectionMode?: boolean
  onItemClick?: (record: SessionRecord) => void
  onCheckboxChange?: (id: string, checked: boolean) => void
  onContextMenu?: (e: React.MouseEvent, record: SessionRecord) => void
}

export const SessionList: React.FC<SessionListProps> = ({
  records = [],
  selectedId,
  checkedIds = [],
  isSelectionMode = false,
  onItemClick,
  onCheckboxChange,
  onContextMenu,
}) => {
  return (
    <div className="session-list">
      {records.length === 0 ? (
        <div className="empty-state">暂无会话记录</div>
      ) : (
        records.map((record) => (
          <SessionItem
            key={record.id}
            record={record}
            isSelected={record.id === selectedId}
            isChecked={checkedIds.includes(record.id)}
            isSelectionMode={isSelectionMode}
            onClick={() => onItemClick?.(record)}
            onCheckboxChange={(checked) => onCheckboxChange?.(record.id, checked)}
            onContextMenu={() => onContextMenu?.(null as any, record)}
          />
        ))
      )}
    </div>
  )
}

export default SessionList
