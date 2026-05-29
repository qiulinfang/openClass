import React, { useState } from 'react'
import type { ChatBubble } from '@/types'
import '@/components/messages/ChatRecordCard.css'

interface ChatRecordCardProps {
  messages: ChatBubble[]
  additionalMessage?: string
}

export const ChatRecordCard: React.FC<ChatRecordCardProps> = ({
  messages,
  additionalMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  const getMessagePreview = (message: ChatBubble): string => {
    if (message.messageType === 'voice') {
      return '[语音消息]'
    } else if (message.messageType === 'image') {
      return '[图片消息]'
    } else {
      // 文本消息，截取前50个字符
      const content = message.content || ''
      return content.length > 50 ? content.substring(0, 50) + '...' : content
    }
  }

  return (
    <div className="chat-record-card" onClick={toggleExpanded}>
      <div className="card-header">
        <div className="header-left">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#7a7cff">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
          <span className="header-title">聊天记录</span>
          <span className="message-count">{messages.length}条消息</span>
        </div>
        <div className="header-right">
          <svg 
            viewBox="0 0 24 24" 
            width="20" 
            height="20" 
            fill="#999"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="card-content">
          <div className="messages-preview">
            {messages.map((message, index) => (
              <div 
                key={message.id || index} 
                className={`preview-message ${message.sender === 'user' ? 'preview-user' : 'preview-ai'}`}
              >
                <div className="preview-avatar">
                  <div className="avatar-circle">
                    {message.sender === 'user' ? '我' : 'AI'}
                  </div>
                </div>
                <div className="preview-content">
                  <div className="preview-sender">
                    {message.sender === 'user' ? '我' : 'AI'}
                  </div>
                  <div className="preview-text">
                    {getMessagePreview(message)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {additionalMessage && (
        <div className="additional-message">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#999">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
          <span className="additional-text">{additionalMessage}</span>
        </div>
      )}
    </div>
  )
}

export default ChatRecordCard
