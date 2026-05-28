import React, { useState } from 'react'
import './ChatSessionDebugPanel.css'

export interface ChatSessionDebugPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const ChatSessionDebugPanel: React.FC<ChatSessionDebugPanelProps> = ({
  visible = false,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'teacher' | 'storage'>('ai')
  const [totalSessionsCount] = useState(0)
  const [totalMessages] = useState(0)
  const [storageSize] = useState('0 KB')

  const refreshData = () => {
    console.log('[ChatSessionDebugPanel] 刷新数据')
  }

  const clearAllSessions = () => {
    console.log('[ChatSessionDebugPanel] 清空所有会话')
  }

  if (!visible) return null

  return (
    <div className="chat-session-debug-panel">
      <div className="panel-header">
        <span>🔧 调试面板 - 会话管理</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-item ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          学伴对话
        </button>
        <button
          className={`tab-item ${activeTab === 'teacher' ? 'active' : ''}`}
          onClick={() => setActiveTab('teacher')}
        >
          老师对话
        </button>
        <button
          className={`tab-item ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          存储调试
        </button>
      </div>

      <div className="panel-stats">
        <div className="stats-banner">
          <div className="stats-icon">📊</div>
          <div className="stats-content">
            <div className="stats-title">存储统计</div>
            <div className="stats-subtitle">
              总会话数: {totalSessionsCount} | 
              总消息数: {totalMessages} | 
              存储大小: {storageSize}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-actions">
        <button className="action-btn" onClick={refreshData}>刷新</button>
        {activeTab === 'teacher' && (
          <button className="action-btn success">创建虚拟老师对话</button>
        )}
        <button className="action-btn danger" onClick={clearAllSessions}>清空所有会话</button>
      </div>

      <div className="panel-content">
        {activeTab === 'ai' && <div className="empty-state">暂无学伴对话</div>}
        {activeTab === 'teacher' && <div className="empty-state">暂无老师对话</div>}
        {activeTab === 'storage' && <div className="empty-state">暂无存储数据</div>}
      </div>
    </div>
  )
}

export default ChatSessionDebugPanel
