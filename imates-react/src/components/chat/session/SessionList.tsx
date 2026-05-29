import React, { useState, useMemo, useCallback, useRef } from 'react'
import { SessionItem, SessionRecord } from '@/components/chat/session/SessionItem'
import Checkbox from '@/components/base/Checkbox'
import Button from '@/components/base/Button'
import Dialog from '@/components/base/Dialog'
import VirtualScroll from '@/components/base/VirtualScroll'
import '@/components/chat/session/SessionList.css'

export interface SessionListProps {
  records?: SessionRecord[]
  selectedRecordId?: string
  showHeader?: boolean
  title?: string
  onRecordClick?: (record: SessionRecord) => void
  onRecordRename?: (record: SessionRecord, newName: string) => void
  onRecordPin?: (record: SessionRecord) => void
  onRecordDelete?: (record: SessionRecord) => void
  onBatchDelete?: (recordIds: string[]) => void
}

export interface SessionListRef {
  scrollToTop: () => void
}

export const SessionList: React.FC<SessionListProps> = ({
  records = [],
  selectedRecordId,
  showHeader = true,
  title = '聊天记录',
  onRecordClick,
  onRecordRename,
  onRecordPin,
  onRecordDelete,
  onBatchDelete,
}) => {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<SessionRecord | null>(null)
  
  const scrollWrapperRef = useRef<any>(null)

  const getRecordId = (record: SessionRecord) => record.sessionId || record.id || ''
  const getRecordTimestamp = (record: SessionRecord) => record.timestamp || record.createTime || record.updateTime || Date.now()
  const getRecordName = (record: SessionRecord) => record.question || record.sessionName || record.name || ''

  const filteredRecords = useMemo(() => {
    let filtered = records
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase().trim()
      filtered = records.filter(r => {
        if (r.pinned) return true
        const name = getRecordName(r).toLowerCase()
        const answer = (r.answer || '').toLowerCase()
        return name.includes(keyword) || answer.includes(keyword)
      })
    }
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return getRecordTimestamp(b) - getRecordTimestamp(a)
    })
  }, [records, searchKeyword])

  const pinnedRecords = useMemo(() => filteredRecords.filter(r => r.pinned), [filteredRecords])
  
  const formatDateForGrouping = (ts: number) => {
    const date = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return '今天'
    if (date.toDateString() === yesterday.toDateString()) return '昨天'
    if (date.getFullYear() === today.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }

  const groupedRecords = useMemo(() => {
    const groups: Record<string, SessionRecord[]> = {}
    filteredRecords.filter(r => !r.pinned).forEach(r => {
      const dateStr = formatDateForGrouping(getRecordTimestamp(r))
      if (!groups[dateStr]) groups[dateStr] = []
      groups[dateStr].push(r)
    })
    return groups
  }, [filteredRecords])

  const toggleRecordSelection = (id: string) => {
    setSelectedRecords(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isAllSelected = filteredRecords.length > 0 && selectedRecords.size === filteredRecords.length

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRecords(new Set())
    } else {
      setSelectedRecords(new Set(filteredRecords.map(getRecordId)))
    }
  }

  const handleItemClick = (record: SessionRecord) => {
    if (isSelectionMode) {
      toggleRecordSelection(getRecordId(record))
    } else {
      onRecordClick?.(record)
    }
  }

  const handleDelete = (record: SessionRecord) => {
    setPendingDeleteRecord(record)
    setShowDeleteConfirm(true)
  }

  const executeDelete = () => {
    if (pendingDeleteRecord) {
      onRecordDelete?.(pendingDeleteRecord)
      setPendingDeleteRecord(null)
    }
    setShowDeleteConfirm(false)
  }

  const executeBatchDelete = () => {
    onBatchDelete?.(Array.from(selectedRecords))
    setSelectedRecords(new Set())
    setIsSelectionMode(false)
    setShowBatchDeleteConfirm(false)
  }

  return (
    <div className="session-list">
      {showHeader && !isSelectionMode && (
        <>
          <div className="session-header">
            <div className="header-left">
              <span className="header-title">{title}</span>
            </div>
          </div>
          <div className="search-bar">
            <input 
              className="search-input"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="搜索会话..."
            />
          </div>
        </>
      )}

      <VirtualScroll ref={scrollWrapperRef} className="scroll-wrapper">
        <div className="scroll-content">
          <div className="session-items">
            {pinnedRecords.length > 0 && (
              <div className="date-group-wrapper">
                <div className="date-group-header">置顶</div>
                {pinnedRecords.map(r => (
                  <SessionItem
                    key={getRecordId(r)}
                    record={r}
                    selectedRecordId={selectedRecordId}
                    isSelectionMode={isSelectionMode}
                    selectedRecordIds={selectedRecords}
                    onClick={() => handleItemClick(r)}
                    onCheckboxChange={() => toggleRecordSelection(getRecordId(r))}
                    onPin={() => onRecordPin?.(r)}
                    onDelete={() => handleDelete(r)}
                    onEnterSelectionMode={() => {
                      setIsSelectionMode(true)
                      setSelectedRecords(new Set([getRecordId(r)]))
                    }}
                  />
                ))}
              </div>
            )}
            {Object.entries(groupedRecords).map(([date, group]) => (
              <div key={date} className="date-group-wrapper">
                <div className="date-group-header">{date}</div>
                {group.map(r => (
                  <SessionItem
                    key={getRecordId(r)}
                    record={r}
                    selectedRecordId={selectedRecordId}
                    isSelectionMode={isSelectionMode}
                    selectedRecordIds={selectedRecords}
                    onClick={() => handleItemClick(r)}
                    onCheckboxChange={() => toggleRecordSelection(getRecordId(r))}
                    onPin={() => onRecordPin?.(r)}
                    onDelete={() => handleDelete(r)}
                    onEnterSelectionMode={() => {
                      setIsSelectionMode(true)
                      setSelectedRecords(new Set([getRecordId(r)]))
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </VirtualScroll>

      {isSelectionMode && (
        <div className="selection-toolbar">
          <div className="selection-left" onClick={toggleSelectAll}>
            <Checkbox
              checked={isAllSelected}
              indeterminate={selectedRecords.size > 0 && !isAllSelected}
              onChange={toggleSelectAll}
            />
            <span className="select-all-text">全选</span>
            <span className="selection-count">已选{selectedRecords.size}/{filteredRecords.length}</span>
          </div>
          <div className="selection-actions">
            <Button label="取消" variant="ghost" onClick={() => setIsSelectionMode(false)} />
            <Button 
              label="删除" 
              variant="primary" 
              disabled={selectedRecords.size === 0} 
              onClick={() => setShowBatchDeleteConfirm(true)} 
            />
          </div>
        </div>
      )}

      <Dialog
        open={showDeleteConfirm}
        title="确认删除"
        confirmButtonText="删除"
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      >
        确定要删除 "{pendingDeleteRecord ? getRecordName(pendingDeleteRecord) : ''}" 吗？删除后无法恢复。
      </Dialog>

      <Dialog
        open={showBatchDeleteConfirm}
        title="确认批量删除"
        confirmButtonText="删除"
        onConfirm={executeBatchDelete}
        onCancel={() => setShowBatchDeleteConfirm(false)}
      >
        确定要删除选中的 {selectedRecords.size} 个会话吗？删除后无法恢复。
      </Dialog>
    </div>
  )
}

export default SessionList
