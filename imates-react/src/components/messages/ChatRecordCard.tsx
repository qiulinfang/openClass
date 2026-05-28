import React from 'react'
import type { ChatBubble } from '../../types'
import './ChatRecordCard.css'

interface ChatRecordCardProps {
  messages: ChatBubble[]
  additionalMessage?: string
}

export const ChatRecordCard: React.FC<ChatRecordCardProps> = ({
  messages,
  additionalMessage,
}) => {
  const formatTime = (timestamp: string | number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessage = (message: ChatBubble, index: number) => {
    const isUser = message.sender === 'user'
    
    return (
      <div 
        key={message.id || index} 
        className={`record-message ${isUser ? 'user' : 'ai'}`}
      >
        <div className="record-message-avatar">
          {isUser ? '我' : 'AI'}
        </div>
        <div className="record-message-content">
          <div className="record-message-text">
            {message.content || '[图片]'}
          </div>
          <div className="record-message-time">
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-record-card">
      <div className="chat-record-header">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <span>聊天记录</span>
      </div>
      <div className="chat-record-messages">
        {messages.slice(0, 5).map((msg, idx) => renderMessage(msg, idx))}
        {messages.length > 5 && (
          <div className="chat-record-more">
            还有 {messages.length - 5} 条消息
          </div>
        )}
      </div>
      {additionalMessage && (
        <div className="chat-record-additional">
          {additionalMessage}
        </div>
      )}
    </div>
  )
}

export default ChatRecordCard
