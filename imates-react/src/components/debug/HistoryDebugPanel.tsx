import React, { useState, useEffect } from 'react'
import './HistoryDebugPanel.css'

export interface HistoryDebugPanelProps {
  visible?: boolean
  extraInfo?: string
}

export const HistoryDebugPanel: React.FC<HistoryDebugPanelProps> = ({
  visible = false,
  extraInfo,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'events' | 'stack'>('events')
  const [browserHistoryLength, setBrowserHistoryLength] = useState(0)
  const [historyEvents, setHistoryEvents] = useState<Array<{ id: number; type: string; ts: string; detail: string }>>([])
  const [pathStack, setPathStack] = useState<string[]>([])

  useEffect(() => {
    setBrowserHistoryLength(window.history.length)
  }, [visible])

  const refresh = () => {
    setBrowserHistoryLength(window.history.length)
  }

  const clear = () => {
    setHistoryEvents([])
    setPathStack([])
  }

  if (!visible) return null

  return (
    <div className="history-debug-panel">
      <div className="history-debug-header">
        <span>History Debug</span>
        <button type="button" className="history-debug-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起' : '展开'}
        </button>
      </div>
      <div className="history-debug-summary">
        <div>history.length: {browserHistoryLength}</div>
        {extraInfo && <div>{extraInfo}</div>}
      </div>
      {expanded && (
        <>
          <div className="history-debug-tabs">
            <button
              type="button"
              className={`history-debug-tab ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              事件日志
            </button>
            <button
              type="button"
              className={`history-debug-tab ${activeTab === 'stack' ? 'active' : ''}`}
              onClick={() => setActiveTab('stack')}
            >
              路径栈
            </button>
          </div>
          <div className="history-debug-actions">
            <button type="button" className="history-debug-btn" onClick={refresh}>刷新</button>
            <button type="button" className="history-debug-btn" onClick={clear}>清空</button>
          </div>
          {activeTab === 'events' && (
            <div className="history-debug-list">
              {historyEvents.length === 0 ? (
                <div className="history-debug-empty">暂无事件记录</div>
              ) : (
                historyEvents.map((item) => (
                  <div key={item.id} className="history-debug-item">
                    <div className="history-debug-item-head">
                      <span>{item.type}</span>
                      <span>{item.ts}</span>
                    </div>
                    <div className="history-debug-item-body">{item.detail}</div>
                  </div>
                ))
              )}
            </div>
          )}
          {activeTab === 'stack' && (
            <div className="history-debug-list">
              {pathStack.length === 0 ? (
                <div className="history-debug-empty">暂无路径记录</div>
              ) : (
                pathStack.map((path, index) => (
                  <div key={index} className="history-debug-item">
                    <div className="history-debug-item-head">
                      <span>#{index + 1}</span>
                    </div>
                    <div className="history-debug-item-body">{path}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default HistoryDebugPanel
