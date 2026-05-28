import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { ChatBubble } from '../types'
import type { ChatType } from '../strategies/ChatStrategyFactory'
import { VoiceMessage } from './messages/VoiceMessage'
import { ImageMessage } from './messages/ImageMessage'
import { MultiImageMessage } from './messages/MultiImageMessage'
import { ChatRecordCard } from './messages/ChatRecordCard'
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

const AI_AVATAR_MAP: Record<string, string> = {
  'ai-general': '/icons/avatar.svg',
  'ai-exercise': '/icons/avatar.svg',
  'ai-homework': '/icons/avatar.svg',
  'ai-textbook': '/icons/avatar.svg',
  'teacher': '/icons/avatar.svg',
  'user-client': '/icons/avatar.svg',
}

const formatTime = (timestamp: string | number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  
  if (isYesterday) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + 
         date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const formatTimeSeparator = (timestamp: string | number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  
  if (isYesterday) {
    return '昨天'
  }
  
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

export const ChatMessageComponent: React.FC<ChatMessageComponentProps> = ({
  message,
  type,
  isSelected,
  isSelectionMode,
  showActionButtons,
  enableLongPress,
  showReadStatus,
  showTime,
  onToggleSelection,
  onMessageClick,
  onEnterMultiSelect,
  onEditMessage,
  onQuoteMessage,
  onDeleteMessage,
}) => {
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [actionMenuPosition, setActionMenuPosition] = useState({ x: 0, y: 0 })
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)

  const isUser = message.sender === 'user'
  const isTeacher = message.sender === 'teacher'
  const isTimeSeparator = message.messageType === 'time_separator'

  const handleClick = useCallback(() => {
    if (isSelectionMode) {
      onToggleSelection()
    } else {
      onMessageClick()
    }
  }, [isSelectionMode, onToggleSelection, onMessageClick])

  const handleLongPress = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    
    setActionMenuPosition({ x: clientX, y: clientY })
    setShowActionMenu(true)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableLongPress) return
    
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    
    longPressTimer.current = setTimeout(() => {
      handleLongPress(e)
    }, 500)
  }, [enableLongPress, handleLongPress])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return
    
    const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.current.x)
    const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y)
    
    if (deltaX > 10 || deltaY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    touchStartPos.current = null
  }, [])

  const buildActions = () => {
    const actions = []
    
    if (!isUser && !isTimeSeparator) {
      actions.push({ label: '复制', icon: 'copy', handler: () => navigator.clipboard.writeText(message.content) })
    }
    
    if (!isTimeSeparator) {
      actions.push({ label: '引用', icon: 'quote', handler: onQuoteMessage })
    }
    
    if (isUser && !isTimeSeparator) {
      actions.push({ label: '编辑', icon: 'edit', handler: () => onEditMessage(message.content) })
    }
    
    actions.push({ label: '删除', icon: 'delete', handler: onDeleteMessage })
    
    return actions
  }

  const handleActionClick = (handler: () => void) => {
    handler()
    setShowActionMenu(false)
  }

  if (isTimeSeparator) {
    return (
      <div className="time-separator">
        <span className="time-separator-text">{formatTimeSeparator(message.timestamp)}</span>
      </div>
    )
  }

  return (
    <div 
      className={`message-item ${isUser ? 'message-user' : 'message-ai'} ${isSelected ? 'selected' : ''} ${isSelectionMode ? 'message-selectable' : ''}`}
      data-message-id={message.id}
      data-message-sender={message.sender}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        handleLongPress(e)
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isSelectionMode && (
        <div className="message-checkbox" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => onToggleSelection()}
          />
        </div>
      )}

      {!isUser && !isTimeSeparator && (
        <div className="ai-message">
          <div className="ai-avatar">
            <img 
              src={AI_AVATAR_MAP[type] || AI_AVATAR_MAP['ai-general']} 
              alt="AI头像" 
              className="avatar-img" 
            />
          </div>
          <div className="ai-content">
            <div className="ai-message-content">
              {renderMessageContent(message, false)}
            </div>
            
            {showActionButtons && !isUser && (
              <div className="message-actions">
                <button className="action-button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(message.content) }} title="复制">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                </button>
                <button className="action-button" onClick={(e) => { e.stopPropagation(); onQuoteMessage() }} title="引用">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isUser && !isTimeSeparator && (
        <div className="user-message">
          <div className="user-content">
            {showReadStatus && (
              <div className="read-status">
                <span className="read-status-text">{message.isRead ? '已读' : '未读'}</span>
              </div>
            )}
            <div className="user-bubble">
              {renderMessageContent(message, true)}
            </div>
            
            {showActionButtons && isUser && (
              <div className="message-actions user-actions">
                <button className="action-button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(message.content) }} title="复制">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                </button>
                <button className="action-button" onClick={(e) => { e.stopPropagation(); onEditMessage(message.content) }} title="编辑">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </button>
                <button className="action-button" onClick={(e) => { e.stopPropagation(); onDeleteMessage() }} title="删除">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showTime && message.timestamp && !isTimeSeparator && (
        <div className="message-time">
          {formatTime(message.timestamp)}
        </div>
      )}

      {showActionMenu && (
        <div 
          className="action-menu-overlay"
          onClick={() => setShowActionMenu(false)}
        >
          <div 
            className="action-menu"
            style={{ left: actionMenuPosition.x, top: actionMenuPosition.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {buildActions().map((action, index) => (
              <button 
                key={index} 
                className="action-menu-item"
                onClick={() => handleActionClick(action.handler)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function renderMessageContent(message: ChatBubble, isUser: boolean): React.ReactNode {
  // 语音消息
  if (message.messageType === 'voice' && message.voiceData) {
    return (
      <VoiceMessage 
        filePath={message.voiceData.filePath}
        duration={message.voiceData.duration / 1000}
        isUser={isUser}
      />
    )
  }

  // 多图消息
  if ((message.messageType === 'multi_image' || 
      (!message.messageType && message.imageList && message.imageList.length > 1)) &&
      message.imageList && message.imageList.length > 0) {
    return (
      <MultiImageMessage 
        images={message.imageList}
        textContent={message.content}
        isUser={isUser}
      />
    )
  }

  // 单图消息
  if (message.messageType === 'image' && message.imageData?.base64DataUrl) {
    return (
      <ImageMessage 
        base64DataUrl={message.imageData.base64DataUrl}
        width={message.imageData.width}
        height={message.imageData.height}
        fileSize={message.imageData.fileSize}
        isUser={isUser}
        showInfo={false}
      />
    )
  }

  // 聊天记录卡片
  if (message.messageType === 'chat_record' && message.chatRecordData) {
    return (
      <ChatRecordCard 
        messages={message.chatRecordData.messages}
        additionalMessage={message.chatRecordData.additionalMessage}
      />
    )
  }

  // HTML 消息
  if (message.messageType === 'html' && message.rawHtml) {
    return (
      <div 
        className="html-message"
        dangerouslySetInnerHTML={{ __html: message.rawHtml }}
      />
    )
  }

  // 错误消息
  if (message.isError) {
    return (
      <div className="error-message-wrapper">
        <div className="error-message">
          <span>{message.content || '发送失败'}</span>
          {message.retryCount !== undefined && message.retryCount > 0 && (
            <span className="retry-count">{message.retryCount}/3</span>
          )}
        </div>
      </div>
    )
  }

  // 文本消息
  return (
    <div className="message-text">
      {message.isStreaming && !message.content && (
        <span className="streaming-cursor"></span>
      )}
      {message.content}
      {message.isStreaming && <span className="streaming-cursor"></span>}
    </div>
  )
}

export default ChatMessageComponent
