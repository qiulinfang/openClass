import React, { useState } from 'react'
import { SessionList } from './SessionList'
import type { SessionRecord } from './SessionItem'
import './SessionTree.css'

export interface SessionTreeProps {
  groups?: Array<{
    title: string
    records: SessionRecord[]
  }>
  selectedId?: string
  checkedIds?: string[]
  isSelectionMode?: boolean
  onItemClick?: (record: SessionRecord) => void
  onCheckboxChange?: (id: string, checked: boolean) => void
  onContextMenu?: (e: React.MouseEvent, record: SessionRecord) => void
}

export const SessionTree: React.FC<SessionTreeProps> = ({
  groups = [],
  selectedId,
  checkedIds = [],
  isSelectionMode = false,
  onItemClick,
  onCheckboxChange,
  onContextMenu,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(groups.map(g => g.title)))

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  return (
    <div className="session-tree">
      {groups.map((group) => (
        <div key={group.title} className="session-group">
          <div className="group-header" onClick={() => toggleGroup(group.title)}>
            <svg
              className={`group-arrow ${expandedGroups.has(group.title) ? 'expanded' : ''}`}
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="currentColor"
            >
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
            <span className="group-title">{group.title}</span>
            <span className="group-count">{group.records.length}</span>
          </div>
          {expandedGroups.has(group.title) && (
            <div className="group-content">
              <SessionList
                records={group.records}
                selectedId={selectedId}
                checkedIds={checkedIds}
                isSelectionMode={isSelectionMode}
                onItemClick={onItemClick}
                onCheckboxChange={onCheckboxChange}
                onContextMenu={onContextMenu}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default SessionTree
