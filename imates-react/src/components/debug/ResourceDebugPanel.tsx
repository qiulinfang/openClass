import React, { useState } from 'react'
import '@/components/debug/ResourceDebugPanel.css'

export interface ResourceDebugPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const ResourceDebugPanel: React.FC<ResourceDebugPanelProps> = ({
  visible = false,
  onClose,
}) => {
  const [textbooks] = useState<any[]>([])
  const [downloadedCount] = useState(0)
  const [downloadingCount] = useState(0)
  const [storageSize] = useState('0 KB')

  const refreshData = () => {
    console.log('[ResourceDebugPanel] 刷新数据')
  }

  const exportTextbooksData = () => {
    console.log('[ResourceDebugPanel] 导出教材数据')
  }

  const clearAllResources = () => {
    console.log('[ResourceDebugPanel] 清空所有资源')
  }

  if (!visible) return null

  return (
    <div className="resource-debug-panel">
      <div className="panel-header">
        <span>🔧 资源调试面板</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-stats">
        <div className="stats-banner">
          <div className="stats-icon">📊</div>
          <div className="stats-content">
            <div className="stats-title">资源统计</div>
            <div className="stats-subtitle">
              教材总数: {textbooks.length} | 
              已下载: {downloadedCount} | 
              下载中: {downloadingCount} |
              存储大小: {storageSize}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-actions">
        <button className="action-btn" onClick={refreshData}>刷新数据</button>
        <button className="action-btn" onClick={exportTextbooksData}>导出教材数据</button>
        <button className="action-btn danger" onClick={clearAllResources}>清空所有资源</button>
      </div>

      <div className="panel-content">
        <div className="empty-state">暂无资源数据</div>
      </div>
    </div>
  )
}

export default ResourceDebugPanel
