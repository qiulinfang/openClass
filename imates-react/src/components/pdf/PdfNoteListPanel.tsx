import React from 'react'
import '@/components/pdf/PdfNoteListPanel.css'

export interface PageNote {
  id: string
  pageIndex: number
  x: number
  y: number
  text: string
  createdAt?: string | number
}

export interface PdfNoteListPanelProps {
  notes?: PageNote[]
  selectedNoteId?: string | null
  onSelect?: (note: PageNote) => void
  onDelete?: (note: PageNote) => void
}

export const PdfNoteListPanel: React.FC<PdfNoteListPanelProps> = ({
  notes = [],
  selectedNoteId = null,
  onSelect,
  onDelete,
}) => {
  const getAuthorName = () => {
    try {
      const raw = localStorage.getItem('userInfo')
      if (!raw) return ''
      const parsed = JSON.parse(raw)
      return parsed?.name || ''
    } catch {
      return ''
    }
  }

  const getAvatarLetter = () => {
    const name = getAuthorName()
    if (name && name.trim()) {
      return name.trim().charAt(0)
    }
    return '记'
  }

  const formatNoteTime = (note: PageNote) => {
    const ts = typeof note.createdAt === 'string' ? Number(note.createdAt) : note.createdAt
    if (!ts) return ''
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ''
    const month = d.getMonth() + 1
    const day = d.getDate()
    const hh = d.getHours().toString().padStart(2, '0')
    const mm = d.getMinutes().toString().padStart(2, '0')
    return `${month}月${day}日 ${hh}:${mm}`
  }

  const authorName = getAuthorName()
  const avatarLetter = getAvatarLetter()

  return (
    <div className="note-panel-container">
      <div className="note-panel-scroll-wrapper">
        <div className="note-panel-scroll-content">
          {notes.length === 0 ? (
            <div className="empty-state">暂无笔记</div>
          ) : (
            <div className="note-list">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`note-item ${note.id === selectedNoteId ? 'note-item--active' : ''}`}
                  onClick={() => onSelect?.(note)}
                >
                  <div className="note-avatar">
                    {avatarLetter}
                  </div>
                  <div className="note-info">
                    <div className="note-item-meta">
                      <span className="note-item-author">{authorName}</span>
                      <span className="note-item-separator"> - </span>
                      <span className="note-item-time">{formatNoteTime(note)}</span>
                    </div>
                    <div className="note-item-content">
                      {note.text}
                    </div>
                  </div>
                  <button 
                    className="more-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete?.(note)
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>delete_outline</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PdfNoteListPanel
