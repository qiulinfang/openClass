import React from 'react'
import type { ChatBubble, AttachedScreenshot } from '../types'
import type { ChatType } from '../strategies/ChatStrategyFactory'
import './ChatInput.css'

interface ChatInputComponentProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  isLoading: boolean
  enableWebSearch: boolean
  selectedModel: string
  type: ChatType
  canSend: boolean
  isEditing: boolean
  quotedMessage: ChatBubble | null
  attachedScreenshots: AttachedScreenshot[]
  showToolbar: boolean
  onSend: () => void
  onRemoveQuote: () => void
  onRemoveScreenshot: (id: string) => void
  onToggleWebSearch: () => void
  onUpdateSelectedModel: (model: string) => void
  onCancelEdit: () => void
  onScreenshotClick: () => void
  onNewSessionClick: () => void
  onFocus: () => void
}

export const ChatInputComponent: React.FC<ChatInputComponentProps> = ({
  value,
  onChange,
  placeholder,
  isLoading,
  enableWebSearch,
  type,
  canSend,
  isEditing,
  quotedMessage,
  attachedScreenshots,
  showToolbar,
  onSend,
  onRemoveQuote,
  onRemoveScreenshot,
  onToggleWebSearch,
  onScreenshotClick,
  onNewSessionClick,
  onFocus,
  onCancelEdit,
}) => {
  return (
    <div className="chat-input-container">
      {showToolbar && (
        <div className="chat-input-toolbar">
          <button onClick={onScreenshotClick} title="截图">📷</button>
          {type === 'ai-general' && (
            <button 
              onClick={onToggleWebSearch}
              className={enableWebSearch ? 'active' : ''}
              title="联网搜索"
            >
              🔍
            </button>
          )}
          <button onClick={onNewSessionClick} title="新建会话">➕</button>
        </div>
      )}

      {quotedMessage && (
        <div className="quoted-message">
          <span>回复: {quotedMessage.content.substring(0, 50)}...</span>
          <button onClick={onRemoveQuote}>×</button>
        </div>
      )}

      {attachedScreenshots.length > 0 && (
        <div className="attached-screenshots">
          {attachedScreenshots.map(screenshot => (
            <div key={screenshot.id} className="screenshot-preview">
              <img src={screenshot.base64DataUrl} alt="screenshot" />
              <button onClick={() => onRemoveScreenshot(screenshot.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={onFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) onSend()
            }
          }}
          disabled={isLoading}
        />
        <button 
          onClick={onSend} 
          disabled={!canSend || isLoading}
          className="send-button"
        >
          {isLoading ? '...' : '发送'}
        </button>
      </div>

      {isEditing && (
        <div className="editing-hint">
          <span>编辑中</span>
          <button onClick={onCancelEdit}>取消</button>
        </div>
      )}
    </div>
  )
}
