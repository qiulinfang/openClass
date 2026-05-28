import React, { useState } from 'react'
import { KnowledgeGraph } from '../components/knowledge-graph/KnowledgeGraph'
import './KnowledgeGraphView.css'

export interface ChapterNode {
  id: string
  name: string
  level?: number
  children?: ChapterNode[]
}

export const KnowledgeGraphView: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedTextbook, setSelectedTextbook] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNodeSearch] = useState(true)
  const [chapterList] = useState<ChapterNode[]>([])
  const [currentChapter, setCurrentChapter] = useState<ChapterNode | null>(null)

  const subjectOptions = [
    { label: '请选择学科', value: '' },
    { label: '数学', value: 'math' },
    { label: '语文', value: 'chinese' },
    { label: '英语', value: 'english' },
  ]

  const textbookOptions = [
    { label: '请选择教材', value: '' },
  ]

  const onSubjectChange = () => {
    console.log('[KnowledgeGraphView] 学科变化')
  }

  const onTextbookChange = () => {
    console.log('[KnowledgeGraphView] 教材变化')
  }

  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  const handleChapterClick = (chapter: ChapterNode) => {
    setCurrentChapter(chapter)
  }

  return (
    <div className="knowledge-graph-content">
      <div className="chapter-sidebar">
        <div className="subject-header">
          <img src="/icons/book.svg" className="subject-icon" />
          <select
            className="subject-select"
            value={selectedSubject}
            onChange={(e) => { setSelectedSubject(e.target.value); onSubjectChange() }}
          >
            {subjectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {textbookOptions.length > 0 && (
          <div className="textbook-info">
            <select
              className="textbook-select"
              value={selectedTextbook}
              onChange={(e) => { setSelectedTextbook(e.target.value); onTextbookChange() }}
            >
              {textbookOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {showNodeSearch && (
          <div className="chapter-search">
            <input
              type="text"
              className="search-input"
              placeholder="搜索节点..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-btn" onClick={clearSearch}>×</button>
            )}
          </div>
        )}

        <div className="chapter-list">
          {chapterList.length === 0 ? (
            <div className="empty-chapters">
              <span>暂无章节</span>
            </div>
          ) : (
            chapterList.map((chapter) => (
              <div
                key={chapter.id}
                className={`chapter-item ${currentChapter?.id === chapter.id ? 'active' : ''}`}
                onClick={() => handleChapterClick(chapter)}
              >
                <span className="chapter-name">{chapter.name}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="graph-area">
        <KnowledgeGraph chapterDetails={currentChapter || { id: '', name: '知识点' }} />
      </div>
    </div>
  )
}

export default KnowledgeGraphView
