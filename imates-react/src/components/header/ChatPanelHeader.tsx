import React from 'react'
import '@/components/header/ChatPanelHeader.css'

export interface TabOption {
  label: string
  value: string
}

export interface ChatPanelHeaderProps {
  modelValue: string
  tabs: TabOption[]
  showCloseButton?: boolean
  onChange?: (value: string) => void
  onClose?: () => void
}

export const ChatPanelHeader: React.FC<ChatPanelHeaderProps> = ({
  modelValue,
  tabs = [],
  showCloseButton = false,
  onChange,
  onClose,
}) => {
  return (
    <div className="chat-panel-header">
      <div className="chat-tabs">
        <div className="tab-list">
          {tabs.map((tab) => (
            <div
              key={tab.value}
              className={`tab-item ${modelValue === tab.value ? 'tab-active' : ''}`}
              onClick={() => onChange?.(tab.value)}
            >
              <span>{tab.label}</span>
            </div>
          ))}
        </div>
      </div>
      {showCloseButton && (
        <button className="close-button" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default ChatPanelHeader
