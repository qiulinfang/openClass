import React, { useState } from 'react'
import './PhotoSearchDebugPanel.css'

export interface PhotoSearchDebugPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const PhotoSearchDebugPanel: React.FC<PhotoSearchDebugPanelProps> = ({
  visible = false,
  onClose,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['env', 'view', 'camera', 'search'])
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

  if (!visible) return null

  return (
    <div className="photo-search-debug-panel">
      <div className="debug-card">
        <div className="card-header">
          <span>🔧 调试面板</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="card-content">
          {/* 环境信息 */}
          <div className="expansion-item">
            <div 
              className="expansion-header" 
              onClick={() => toggleSection('env')}
            >
              <span>环境信息</span>
              <span className="arrow">{expandedSections.has('env') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('env') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">运行环境:</span>
                  <span className="badge success">Web</span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">Android Bridge:</span>
                  <span className="badge">不可用</span>
                </div>
              </div>
            )}
          </div>

          {/* 视图状态 */}
          <div className="expansion-item">
            <div 
              className="expansion-header" 
              onClick={() => toggleSection('view')}
            >
              <span>视图状态</span>
              <span className="arrow">{expandedSections.has('view') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('view') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">相机预览:</span>
                  <span className="badge">隐藏</span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">相册面板:</span>
                  <span className="badge">显示</span>
                </div>
              </div>
            )}
          </div>

          {/* 相机状态 */}
          <div className="expansion-item">
            <div 
              className="expansion-header" 
              onClick={() => toggleSection('camera')}
            >
              <span>相机状态</span>
              <span className="arrow">{expandedSections.has('camera') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('camera') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">相机ID:</span>
                  <span>0</span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">分辨率:</span>
                  <span>1920x1080</span>
                </div>
              </div>
            )}
          </div>

          {/* 搜索状态 */}
          <div className="expansion-item">
            <div 
              className="expansion-header" 
              onClick={() => toggleSection('search')}
            >
              <span>搜索状态</span>
              <span className="arrow">{expandedSections.has('search') ? '▼' : '▶'}</span>
            </div>
            {expandedSections.has('search') && (
              <div className="expansion-content">
                <div className="debug-item">
                  <span className="debug-label">搜索中:</span>
                  <span className="badge">否</span>
                </div>
                <div className="debug-item">
                  <span className="debug-label">结果数量:</span>
                  <span>0</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhotoSearchDebugPanel
