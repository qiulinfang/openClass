import React from 'react'
import '@/components/pdf/PdfNoteListPanel.css'

export interface PageNote {
  id: string
  text: string
  author?: string
  createdAt?: string
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
  const getAvatarLetter = (note: PageNote) => {
    return (note.author || 'U')[0].toUpperCase()
  }

  const getAuthorName = (note: PageNote) => {
    return note.author || '用户'
  }

  const formatNoteTime = (note: PageNote) => {
    if (!note.createdAt) return ''
    const date = new Date(note.createdAt)
    return date.toLocaleDateString()
  }

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
                    {getAvatarLetter(note)}
                  </div>
                  <div className="note-info">
                    <div className="note-item-meta">
                      <span className="note-item-author">{getAuthorName(note)}</span>
                      <span className="note-item-separator"> - </span>
                      <span className="note-item-time">{formatNoteTime(note)}</span>
                    </div>
                    <div className="note-item-content">
                      {note.text}
                    </div>
                  </div>
                  <button 
                    className="more-btn"
                    onClick={(e) => { e.stopPropagation(); onDelete?.(note) }}
                  >
                    ⋮
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
