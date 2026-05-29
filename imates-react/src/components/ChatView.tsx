import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatBubble, AttachedScreenshot } from '../types'
import type { ChatStrategy, ChatViewInterface } from './chat/strategies/ChatStrategy'
import { ChatStrategyFactory, type ChatType } from './chat/strategies/ChatStrategyFactory'
import { ChatMessageComponent } from './ChatMessage'
import { ChatInputComponent } from './ChatInput'
import { SimpleChatInputComponent } from './SimpleChatInput'
import './ChatView.css'

interface ChatViewProps {
  type: ChatType
  resourceId?: string
  inputMode?: 'full' | 'simple'
  size?: 'large' | 'small'
  question?: unknown
  attachedScreenshots?: AttachedScreenshot[]
  showFooterText?: boolean
  showToolbar?: boolean
  hideAskTeacherIcon?: boolean
  showActionButtons?: boolean
  enableLongPress?: boolean
  showReadStatus?: boolean
  showTime?: boolean
  hideHistory?: boolean
  onResponse?: () => void
  onSwitchToTeacher?: (data: {
    messages: ChatBubble[]
    currentQuestion: unknown
    additionalMessage?: string
  }) => void
  onFocus?: () => void
  onScrollToBottom?: () => void
  onScrollToMessage?: (messageId: string) => void
  onSendMessage?: (message: string) => void
  onScreenshotClick?: () => void
  onNewSessionClick?: () => void
}

export const ChatView: React.FC<ChatViewProps> = ({
  type,
  resourceId,
  inputMode = 'full',
  size = 'large',
  question,
  showFooterText = true,
  showToolbar = true,
  showActionButtons = true,
  enableLongPress = true,
  showReadStatus = false,
  showTime = false,
  hideHistory = false,
  onResponse,
  onSwitchToTeacher,
  onFocus,
  onScrollToBottom,
  onScrollToMessage,
  onSendMessage,
  onScreenshotClick,
  onNewSessionClick,
}) => {
  const [messages, setMessages] = useState<ChatBubble[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUserAtBottom, setIsUserAtBottom] = useState(true)
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [isKeyboardAnimating, setIsKeyboardAnimating] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [showSessionListPanel, setShowSessionListPanel] = useState(false)
  const [isEditingMessage, setIsEditingMessage] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [quotedMessage, setQuotedMessage] = useState<ChatBubble | null>(null)
  const [attachedScreenshots, setAttachedScreenshots] = useState<AttachedScreenshot[]>([])
  const [enableWebSearch, setEnableWebSearch] = useState(false)
  const [selectedModel, setSelectedModel] = useState('mate')

  const chatViewRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatStrategyRef = useRef<ChatStrategy | null>(null)
  const lastMessageCount = useRef(0)
  const lastSendTime = useRef(0)

  const scrollToBottom = useCallback(async (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' })
    setShowNewMessageIndicator(false)
    setIsUserAtBottom(true)
  }, [])

  const checkIfUserAtBottom = useCallback(() => {
    if (!chatViewRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatViewRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsUserAtBottom(atBottom)
    if (atBottom) {
      setShowNewMessageIndicator(false)
    }
  }, [])

  const handleScroll = useCallback(() => {
    checkIfUserAtBottom()
  }, [checkIfUserAtBottom])

  const sendMessage = useCallback(async (content?: string) => {
    const now = Date.now()
    if (now - lastSendTime.current < 1000) {
      return // 1秒内不能重复发送
    }
    lastSendTime.current = now

    const messageContent = content || inputMessage.trim()
    if (!messageContent && attachedScreenshots.length === 0) return

    setIsLoading(true)
    try {
      if (chatStrategyRef.current) {
        await chatStrategyRef.current.sendMessage(messageContent, {
          selectedModel,
          imageData: undefined,
          imageList: undefined,
          quotedMessage: quotedMessage ? {
            id: quotedMessage.id,
            content: quotedMessage.content,
            sender: quotedMessage.sender as 'user' | 'ai' | 'teacher'
          } : undefined
        })
      }
      setInputMessage('')
      setQuotedMessage(null)
      setAttachedScreenshots([])
      onResponse?.()
      setTimeout(() => scrollToBottom(), 100)
    } catch (error) {
      console.error('Send message error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [inputMessage, attachedScreenshots, selectedModel, quotedMessage, onResponse, scrollToBottom])

  const handleMessageClick = useCallback((message: ChatBubble) => {
    if (isSelectionMode) {
      toggleMessageSelection(message.id)
    }
  }, [isSelectionMode])

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessages(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }, [])

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true)
  }, [])

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedMessages(new Set())
  }, [])

  const handleEditMessage = useCallback((messageId: string, content: string) => {
    setIsEditingMessage(true)
    setEditingMessageId(messageId)
    setInputMessage(content)
  }, [])

  const cancelEditMessage = useCallback(() => {
    setIsEditingMessage(false)
    setEditingMessageId(null)
    setInputMessage('')
  }, [])

  const handleQuoteMessage = useCallback((message: ChatBubble) => {
    setQuotedMessage(message)
  }, [])

  const handleRemoveQuote = useCallback(() => {
    setQuotedMessage(null)
  }, [])

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (chatStrategyRef.current?.deleteMessage) {
      await chatStrategyRef.current.deleteMessage(messageId, { currentQuestion: question })
    }
  }, [question])

  const handleClearMessages = useCallback(() => {
    setMessages([])
    lastMessageCount.current = 0
    chatStrategyRef.current?.clearMessages?.()
  }, [])


  const toggleWebSearch = useCallback(() => {
    if (chatStrategyRef.current?.toggleWebSearch) {
      chatStrategyRef.current.toggleWebSearch()
    } else {
      setEnableWebSearch(prev => !prev)
    }
  }, [])

  const handleScreenshotClick = useCallback(() => {
    onScreenshotClick?.()
  }, [onScreenshotClick])

  const handleNewSessionClick = useCallback(() => {
    onNewSessionClick?.()
  }, [onNewSessionClick])

  const handleLoadMoreHistory = useCallback(async () => {
    if (chatStrategyRef.current?.loadMoreHistory) {
      await chatStrategyRef.current.loadMoreHistory()
    }
  }, [])

  const chatViewInterface: ChatViewInterface = {
    scrollToBottom,
    checkIfUserAtBottom,
    executeQuestionSwitch: () => { },
    getLastMessageCount: () => lastMessageCount.current,
    setLastMessageCount: (count: number) => { lastMessageCount.current = count },
    getIsUserAtBottom: () => isUserAtBottom,
    setIsUserAtBottom,
    getShowNewMessageIndicator: () => showNewMessageIndicator,
    setShowNewMessageIndicator,
    getIsKeyboardVisible: () => isKeyboardVisible,
    getIsKeyboardAnimating: () => isKeyboardAnimating,
    getDisplayedMessages: () => messages,
    emitResponse: () => onResponse?.(),
    getIsEditingMessage: () => isEditingMessage,
    setIsEditingMessage,
    getEditingQuestionId: () => editingMessageId || undefined,
    cancelEditMessage,
    clearInputContent: () => setInputMessage('')
  }

  useEffect(() => {
    chatStrategyRef.current = ChatStrategyFactory.create(type, {
      chatView: chatViewInterface
    })
  }, [type])

  useEffect(() => {
    if (chatStrategyRef.current) {
      const strategyMessages = chatStrategyRef.current.getMessages()
      if (strategyMessages.length !== lastMessageCount.current) {
        setMessages(strategyMessages)
        lastMessageCount.current = strategyMessages.length

        if (strategyMessages.length > lastMessageCount.current && !isUserAtBottom) {
          setShowNewMessageIndicator(true)
        }
      }
    }
  }, [isUserAtBottom, chatStrategyRef.current])

  // 轮询检测消息变化（处理流式更新）
  useEffect(() => {
    const interval = setInterval(() => {
      if (chatStrategyRef.current) {
        const strategyMessages = chatStrategyRef.current.getMessages()
        if (strategyMessages.length !== lastMessageCount.current) {
          setMessages(strategyMessages)
          lastMessageCount.current = strategyMessages.length
        } else if (strategyMessages.length > 0) {
          // 检查最后一条消息内容是否变化
          const lastMsg = strategyMessages[strategyMessages.length - 1]
          const currentLastMsg = messages[messages.length - 1]
          if (lastMsg && currentLastMsg && lastMsg.id === currentLastMsg.id && lastMsg.content !== currentLastMsg.content) {
            setMessages([...strategyMessages])
          }
        }
      }
    }, 200)
    return () => clearInterval(interval)
  }, [messages])

  const isAllSelected = messages.length > 0 && selectedMessages.size === messages.length

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedMessages(new Set())
    } else {
      setSelectedMessages(new Set(messages.map(m => m.id)))
    }
  }

  const forwardToTeacher = async () => {
    if (!chatStrategyRef.current || selectedMessages.size === 0) return

    const selectedMsgs = messages.filter(m => selectedMessages.has(m.id))
    const result = await chatStrategyRef.current.forwardMessages(selectedMsgs)

    if (result.success) {
      onSwitchToTeacher?.({
        messages: selectedMsgs,
        currentQuestion: question
      })
    }
    exitSelectionMode()
  }

  const placeholderText = chatStrategyRef.current?.getPlaceholderText(true) || '发送消息...'

  return (
    <div
      ref={chatViewRef}
      className={`chat-view ${size === 'small' ? 'chat-view-small' : ''} ${isKeyboardAnimating ? 'keyboard-animating' : ''}`}
      onScroll={handleScroll}
    >
      {showToolbar && messages.length > 0 && (
        <div className="chat-view-toolbar">
          <button onClick={handleClearMessages} title="清空消息">🗑️ 清空</button>
        </div>
      )}

      <div className="chat-messages-container">
        {messages.length === 0 && !isLoading && (type === 'ai-exercise' || type === 'ai-homework') && (
          <div className="empty-state">
            <p>暂无消息</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={message.id} className="message-item">
            <ChatMessageComponent
              message={message}
              type={type}
              isSelected={selectedMessages.has(message.id)}
              isSelectionMode={isSelectionMode}
              showActionButtons={showActionButtons}
              enableLongPress={enableLongPress}
              showReadStatus={showReadStatus}
              showTime={showTime}
              onToggleSelection={() => toggleMessageSelection(message.id)}
              onMessageClick={() => handleMessageClick(message)}
              onEnterMultiSelect={enterSelectionMode}
              onEditMessage={(content) => handleEditMessage(message.id, content)}
              onQuoteMessage={() => handleQuoteMessage(message)}
              onDeleteMessage={() => handleDeleteMessage(message.id)}
            />
          </div>
        ))}

        {isLoading && (
          <div className="loading-indicator">
            <div className="loading-spinner"></div>
            <span>AI 正在思考...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showNewMessageIndicator && (
        <button className="new-message-indicator" onClick={() => scrollToBottom()}>
          ↓
        </button>
      )}

      {isSelectionMode && (
        <div className="selection-toolbar">
          <div className="selection-left">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
            />
            <span>全选</span>
            <span className="selection-count">已选{selectedMessages.size}/{messages.length}</span>
          </div>
          <div className="selection-actions">
            <button onClick={exitSelectionMode}>取消</button>
            {chatStrategyRef.current?.shouldShowForwardButton() && (
              <button
                onClick={forwardToTeacher}
                disabled={selectedMessages.size === 0}
              >
                发送
              </button>
            )}
          </div>
        </div>
      )}

      {!isSelectionMode && (
        <div className="chat-input-area">
          {inputMode === 'full' ? (
            <ChatInputComponent
              value={inputMessage}
              onChange={setInputMessage}
              placeholder={placeholderText}
              isLoading={isLoading}
              enableWebSearch={enableWebSearch}
              selectedModel={selectedModel}
              type={type}
              canSend={!!inputMessage.trim() || attachedScreenshots.length > 0}
              isEditing={isEditingMessage}
              quotedMessage={quotedMessage}
              attachedScreenshots={attachedScreenshots}
              showToolbar={showToolbar}
              onSend={() => sendMessage()}
              onRemoveQuote={handleRemoveQuote}
              onRemoveScreenshot={(id) => setAttachedScreenshots(prev => prev.filter(s => s.id !== id))}
              onToggleWebSearch={toggleWebSearch}
              onUpdateSelectedModel={setSelectedModel}
              onCancelEdit={cancelEditMessage}
              onScreenshotClick={handleScreenshotClick}
              onNewSessionClick={handleNewSessionClick}
              onFocus={() => onFocus?.()}
            />
          ) : (
            <SimpleChatInputComponent
              value={inputMessage}
              onChange={setInputMessage}
              placeholder={placeholderText}
              isLoading={isLoading}
              onSend={() => sendMessage()}
              onFocus={() => onFocus?.()}
            />
          )}

          {showFooterText && (
            <div className="chat-footer-text">
              与学伴共学，敢质疑、会判断，思维不设限!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ChatView
