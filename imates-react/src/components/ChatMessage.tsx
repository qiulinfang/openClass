import React from 'react'
import type { ChatBubble } from '../types'
import type { ChatType } from '../strategies/ChatStrategyFactory'
import './ChatMessage.css'

interface ChatMessageComponentProps {
  message: ChatBubble
  type: ChatType
  isSelected: boolean
  isSelectionMode: boolean
  showActionButtons: boolean
  enableLongPress: boolean
  showReadStatus: boolean
  showTime: boolean
  onToggleSelection: () => void
  onMessageClick: () => void
  onEnterMultiSelect: () => void
  onEditMessage: (content: string) => void
  onQuoteMessage: () => void
  onDeleteMessage: () => void
}

export const ChatMessageComponent: React.FC<ChatMessageComponentProps> = ({
  message,
  isSelected,
  isSelectionMode,
  showTime,
  onToggleSelection,
  onMessageClick,
}) => {
  const isUser = message.sender === 'user'
  
  const handleClick = () => {
    if (isSelectionMode) {
      onToggleSelection()
    } else {
      onMessageClick()
    }
  }

  return (
    <div 
      className={`chat-message ${isUser ? 'user' : 'ai'} ${isSelected ? 'selected' : ''} ${isSelectionMode ? 'selection-mode' : ''}`}
      onClick={handleClick}
    >
      {isSelectionMode && (
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => {}}
          className="message-checkbox"
        />
      )}
      <div className="message-content">
        {message.isStreaming && !message.content && (
          <span className="streaming-cursor"></span>
        )}
        {message.content}
        {message.isStreaming && <span className="streaming-cursor"></span>}
      </div>
      {showTime && message.timestamp && (
        <div className="message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      )}
      {message.isError && (
        <div className="message-error">发送失败</div>
      )}
    </div>
  )
}
