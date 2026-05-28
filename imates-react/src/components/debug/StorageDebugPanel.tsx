import React, { useState } from 'react'
import './StorageDebugPanel.css'

export interface StorageDebugPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const StorageDebugPanel: React.FC<StorageDebugPanelProps> = ({
  visible = false,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'localStorage' | 'indexeddb'>('localStorage')

  const isDev = import.meta.env.DEV

  const refreshData = () => {
    console.log('[StorageDebugPanel] 刷新数据')
  }

  const exportData = () => {
    console.log('[StorageDebugPanel] 导出数据')
  }

  const clearCurrentStorage = () => {
    console.log('[StorageDebugPanel] 清空当前存储')
  }

  if (!isDev || !visible) return null

  return (
    <div className="storage-debug-panel">
      <div className="panel-header">
        <span>🔧 存储调试面板</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-item ${activeTab === 'localStorage' ? 'active' : ''}`}
          onClick={() => setActiveTab('localStorage')}
        >
          localStorage
        </button>
        <button
          className={`tab-item ${activeTab === 'indexeddb' ? 'active' : ''}`}
          onClick={() => setActiveTab('indexeddb')}
        >
          IndexedDB
        </button>
      </div>

      <div className="panel-actions">
        <button className="action-btn" onClick={refreshData}>刷新</button>
        <button className="action-btn" onClick={exportData}>导出数据</button>
        <button className="action-btn danger" onClick={clearCurrentStorage}>清空当前存储</button>
      </div>

      <div className="panel-content">
        {activeTab === 'localStorage' && (
          <div className="tab-content">
            <div className="empty-state">暂无 localStorage 数据</div>
          </div>
        )}
        {activeTab === 'indexeddb' && (
          <div className="tab-content">
            <div className="empty-state">暂无 IndexedDB 数据</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StorageDebugPanel
