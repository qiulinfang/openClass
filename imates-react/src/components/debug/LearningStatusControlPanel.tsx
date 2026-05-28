import React, { useState } from 'react'
import './LearningStatusControlPanel.css'

export interface LearningStatusControlPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const LearningStatusControlPanel: React.FC<LearningStatusControlPanelProps> = ({
  visible = false,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(visible)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['lastNode', 'progress', 'bookmarks'])
  )

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
    console.log('[LearningStatusControlPanel] 清除上次学习')
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
          {/* 上次学习节点 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('lastNode')}>
              <span>上次学习节点</span>
              <span className="arrow">{expandedSections.has('lastNode') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('lastNode') && (
              <div className="expansion-content">
                <div className="empty-state">
                  <span>暂无上次学习节点</span>
                </div>
              </div>
            )}
          </div>

          {/* 学习进度 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('progress')}>
              <span>学习进度</span>
              <span className="arrow">{expandedSections.has('progress') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('progress') && (
              <div className="expansion-content">
                <div className="empty-state">
                  <span>暂无学习进度</span>
                </div>
              </div>
            )}
          </div>

          {/* 书签 */}
          <div className="expansion-item">
            <div className="expansion-header" onClick={() => toggleSection('bookmarks')}>
              <span>书签</span>
              <span className="arrow">{expandedSections.has('bookmarks') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('bookmarks') && (
              <div className="expansion-content">
                <div className="empty-state">
                  <span>暂无书签</span>
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
