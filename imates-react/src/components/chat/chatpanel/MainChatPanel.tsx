import React, { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './MainChatPanel.css'

export interface MainChatPanelProps {
  visible?: boolean
  screenshotFlowVisible?: boolean
  onClose?: () => void
  onToggleMode?: () => void
}

export const MainChatPanel: React.FC<MainChatPanelProps> = ({
  visible = false,
  screenshotFlowVisible = false,
  onClose,
  onToggleMode,
}) => {
  const [panelWidth, setPanelWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const [activeTab, setActiveTab] = useState('ai-chat')
  const [activeCategory, setActiveCategory] = useState('ai')

  const startX = useRef(0)
  const startWidth = useRef(0)

  const tabOptions = [
    { value: 'ai-chat', label: 'AI问答' },
    { value: 'homework', label: '作业' },
    { value: 'exercise', label: '练习' },
    { value: 'textbook', label: '教材' },
    { value: 'draft', label: '草稿' },
  ]

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startX.current = e.clientX
    startWidth.current = panelWidth
  }, [panelWidth])

  const handleResize = useCallback((e: React.PointerEvent) => {
    if (!isResizing) return
    const delta = e.clientX - startX.current
    const newWidth = Math.max(320, Math.min(800, startWidth.current + delta))
    setPanelWidth(newWidth)
  }, [isResizing])

  const stopResize = useCallback(() => {
    setIsResizing(false)
  }, [])

  if (!visible) return null

  return createPortal(
    <div 
      className="main-chat-overlay" 
      onClick={onClose}
      onPointerMove={handleResize}
      onPointerUp={stopResize}
      onPointerCancel={stopResize}
    >
      <div
        className={`main-chat-panel ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ width: `${panelWidth}px` }}
      >
        <div 
          className={`resize-handle ${isResizing ? 'resizing' : ''}`}
          onPointerDown={startResize}
        />

        <div className="chat-panel-header">
          <div className="chat-tabs">
            <div className="tab-list">
              {tabOptions.map((tab) => (
                <div
                  key={tab.value}
                  className={`tab-item ${activeTab === tab.value ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <span>
                    {tab.value === 'ai-chat'
                      ? activeCategory === 'teacher'
                        ? '老师答疑'
                        : 'AI问答'
                      : tab.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button type="button" className="toggle-mode-button" onClick={onToggleMode}>
            <img src="/icons/switcher.svg" alt="switch mode" className="toggle-mode-icon" />
          </button>

          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className="chat-panel-content">
          {/* TODO: 根据 activeTab 渲染对应内容 */}
          <div className="panel-placeholder">
            {tabOptions.find(t => t.value === activeTab)?.label} 内容区域
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default MainChatPanel
