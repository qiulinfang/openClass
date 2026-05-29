import React, { useState, useEffect } from 'react'
import type { ChapterNode } from '@/types'
import { getScopedStorageKey } from '../../services'
import './LearningStatusControlPanel.css'

export interface LearningStatusControlPanelProps {
  isOpen?: boolean
  onClose?: () => void
  chapterStructure?: ChapterNode[]
  onRefresh?: () => void
}

export const LearningStatusControlPanel: React.FC<LearningStatusControlPanelProps> = ({
  isOpen = false,
  onClose,
  chapterStructure = [],
  onRefresh,
}) => {
  const [isVisible, setIsVisible] = useState(isOpen)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['lastNode', 'progress', 'bookmarks'])
  )

  const [lastLearnedId, setLastLearnedId] = useState<string | null>(null)
  const [learnedIds, setLearnedIds] = useState<string[]>([])

  useEffect(() => {
    setIsVisible(isOpen)
  }, [isOpen])

  useEffect(() => {
    if (isVisible) {
      const lastKey = getScopedStorageKey('LAST_LEARNED_NODE_ID')
      setLastLearnedId(localStorage.getItem(lastKey))
      
      const learnedKey = getScopedStorageKey('LEARNED_NODES')
      const saved = localStorage.getItem(learnedKey)
      if (saved) {
        try {
          setLearnedIds(JSON.parse(saved))
        } catch (e) {
          setLearnedIds([])
        }
      }
    }
  }, [isVisible])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const clearLastLearned = () => {
    const key = getScopedStorageKey('LAST_LEARNED_NODE_ID')
    localStorage.removeItem(key)
    setLastLearnedId(null)
    onRefresh?.()
  }

  const clearLearned = () => {
    const key = getScopedStorageKey('LEARNED_NODES')
    localStorage.removeItem(key)
    setLearnedIds([])
    onRefresh?.()
  }

  const setNodeLearned = (nodeId: string) => {
    const key = getScopedStorageKey('LEARNED_NODES')
    const next = Array.from(new Set([...learnedIds, nodeId]))
    localStorage.setItem(key, JSON.stringify(next))
    setLearnedIds(next)
    onRefresh?.()
  }

  if (!isVisible) {
    return (
      <button 
        className="toggle-button collapsed" 
        onClick={() => setIsVisible(true)}
      >
        ▶
      </button>
    )
  }

  return (
    <div className="learning-status-panel-wrapper expanded">
      <button 
        className="toggle-button expanded" 
        onClick={() => setIsVisible(false)}
      >
        ◀
      </button>

      <div className="learning-status-panel-card">
        <div className="panel-header">
          <div className="header-top">
            <div className="header-title">📚 学习状态控制面板</div>
            <button className="close-btn" onClick={() => { setIsVisible(false); onClose?.() }}>×</button>
          </div>
        </div>

        <div className="panel-content">
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('lastNode')}>
              <span>上次学习节点</span>
              <span className="arrow">{expandedSections.has('lastNode') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('lastNode') && (
              <div className="expansion-content">
                {lastLearnedId ? (
                  <div className="node-item">
                    <span className="node-id">ID: {lastLearnedId}</span>
                    <button className="debug-btn delete" onClick={clearLastLearned}>清除</button>
                  </div>
                ) : (
                  <div className="empty-state">暂无上次学习节点</div>
                )}
              </div>
            )}
          </div>

          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('progress')}>
              <span>已学习节点 ({learnedIds.length})</span>
              <span className="arrow">{expandedSections.has('progress') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('progress') && (
              <div className="expansion-content">
                <button className="debug-btn delete full-width" onClick={clearLearned}>清除所有已学习</button>
                <div className="node-list">
                  {learnedIds.map(id => (
                    <div key={id} className="node-item">
                      <span className="node-id">{id}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('allNodes')}>
              <span>设置节点为已学</span>
              <span className="arrow">{expandedSections.has('allNodes') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('allNodes') && (
              <div className="expansion-content">
                <div className="node-list scrollable">
                  {chapterStructure.map(chapter => (
                    <div key={chapter.id} className="chapter-group">
                      <div className="chapter-title">{chapter.name}</div>
                      {chapter.children?.map(sec => (
                        <div key={sec.id} className="section-item">
                          <span className="section-name">{sec.name}</span>
                          <button 
                            className="debug-btn" 
                            disabled={learnedIds.includes(sec.id)}
                            onClick={() => setNodeLearned(sec.id)}
                          >
                            {learnedIds.includes(sec.id) ? '已学' : '设为已学'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LearningStatusControlPanel
