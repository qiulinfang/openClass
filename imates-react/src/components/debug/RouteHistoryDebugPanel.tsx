import React, { useState } from 'react'
import './RouteHistoryDebugPanel.css'

export interface RouteHistoryDebugPanelProps {
  visible?: boolean
  onClose?: () => void
}

export const RouteHistoryDebugPanel: React.FC<RouteHistoryDebugPanelProps> = ({
  visible = false,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'modules'>('current')

  const refreshData = () => {
    console.log('[RouteHistoryDebugPanel] 刷新数据')
  }

  const clearAllHistory = () => {
    console.log('[RouteHistoryDebugPanel] 清空历史')
  }

  if (!visible) return null

  return (
    <div className="route-history-debug-panel">
      <div className="panel-header">
        <span>🗺️ 路由历史调试面板</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-item ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          当前状态
        </button>
        <button
          className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          导航历史
        </button>
        <button
          className={`tab-item ${activeTab === 'modules' ? 'active' : ''}`}
          onClick={() => setActiveTab('modules')}
        >
          模块历史
        </button>
      </div>

      <div className="panel-actions">
        <button className="action-btn" onClick={refreshData}>刷新</button>
        <button className="action-btn danger" onClick={clearAllHistory}>清空所有历史</button>
      </div>

      <div className="panel-content">
        {activeTab === 'current' && (
          <div className="tab-content">
            <div className="info-section">
              <h4>📍 当前路由状态</h4>
              <div className="info-table">
                <div className="info-row">
                  <span className="label">当前路由</span>
                  <span className="value">N/A</span>
                </div>
                <div className="info-row">
                  <span className="label">路由名称</span>
                  <span className="value">N/A</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'history' && (
          <div className="tab-content">
            <div className="empty-state">暂无导航历史</div>
          </div>
        )}
        {activeTab === 'modules' && (
          <div className="tab-content">
            <div className="empty-state">暂无模块历史</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RouteHistoryDebugPanel
