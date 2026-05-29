import React, { useState, useRef, useCallback } from 'react'
import type { ChatBubble, AttachedScreenshot } from '@/types'
import type { ChatType } from '@/components/chat/strategies/ChatStrategyFactory'
import { MathFormulaEditor } from '@/components/MathFormulaEditor'
import { VoiceInput } from '@/components/VoiceInput'
import waitingIcon from '/icons/waiting.svg'
import sendIcon from '/icons/send.svg'
import DeskmateIcon from '/icons/Deskmate.svg'
import RepresentativeIcon from '/icons/Representative.svg'
import GuruIcon from '/icons/Guru.svg'
import onlineSearchIcon from '/icons/onlineSearch.svg'
import onlineSearchIconSelected from '/icons/onlineSearch_select.svg'
import askTeacherIcon from '/icons/askTeacher.svg'
import picturIcon from '/icons/shangchuantupian.svg'
import addSessionIcon from '/icons/addsession.png'

import '@/components/ChatInput.css'

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
  hideAskTeacherIcon?: boolean
  // 插槽支持
  headerAll?: React.ReactNode
  headerPrefix?: React.ReactNode
  headerSuffix?: React.ReactNode
  headerRight?: React.ReactNode
  children?: React.ReactNode
}

interface ModelOption {
  value: string
  label: string
  icon: string
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: 'mate', label: '同桌', icon: DeskmateIcon },
  { value: 'mentor', label: '学长', icon: RepresentativeIcon },
  { value: 'researcher', label: '大师', icon: GuruIcon },
]

const IMAGE_TYPES = ['ai-general', 'ai-exercise', 'ai-homework', 'ai-textbook', 'user-client', 'teacher', 'html-preview']

export const ChatInputComponent: React.FC<ChatInputComponentProps> = ({
  value,
  onChange,
  placeholder,
  isLoading,
  enableWebSearch,
  selectedModel,
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
  onUpdateSelectedModel,
  onCancelEdit,
  onScreenshotClick,
  onNewSessionClick,
  onFocus,
  hideAskTeacherIcon = false,
  headerAll,
  headerPrefix,
  headerSuffix,
  headerRight,
  children,
}) => {
  const [showModeSelectorMenu, setShowModeSelectorMenu] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const mathEditorRef = useRef<any>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showImageUpload = IMAGE_TYPES.includes(type)

  const getCurrentModel = () => MODEL_OPTIONS.find(m => m.value === selectedModel) || MODEL_OPTIONS[0]

  const handleModelSelect = (model: string) => {
    onUpdateSelectedModel(model)
    setShowModeSelectorMenu(false)
  }

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const base64 = event.target?.result as string
          const newScreenshot: AttachedScreenshot = {
            id: Date.now().toString() + Math.random(),
            width: 0,
            height: 0,
            dataUrl: base64,
          }
          console.log('图片已选择:', newScreenshot)
          // TODO: Implement adding screenshot
        }
        reader.readAsDataURL(file)
      }
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setShowImagePicker(false)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        const reader = new FileReader()
        reader.onload = (event) => {
          const base64 = event.target?.result as string
          const newScreenshot: AttachedScreenshot = {
            id: Date.now().toString() + Math.random(),
            width: 0,
            height: 0,
            dataUrl: base64,
          }
          console.log('粘贴图片:', newScreenshot)
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  const truncateQuoteContent = (content: string, maxLength = 100): string => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  const handleScreenshotThumbClick = (shot: AttachedScreenshot) => {
    if (!shot?.id) return
    console.log('编辑截图:', shot.id)
  }

  const handleSendButtonHitAreaClick = () => {
    if (!canSend || isLoading) return
    onSend()
  }

  return (
    <div className="modern-chat-container">
      {showToolbar && (
        headerAll ? (
          <div className="chat-input-header-flex">{headerAll}</div>
        ) : (
          <div className="chat-input-header-flex">
            <div className="chat-input-header-left">
              <div className="chat-top-toolbar">
                {headerPrefix}
                {showImageUpload && (
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setShowImagePicker(true)}
                  >
                    <img src={picturIcon} alt="添加图片" className="toolbar-icon" />
                  </button>
                )}
                {headerSuffix}
              </div>
            </div>
            <div className="chat-input-header-right">
              {headerRight}
              <button type="button" className="toolbar-btn" onClick={onNewSessionClick}>
                <img src={addSessionIcon} alt="新建会话" className="toolbar-icon" />
              </button>
            </div>
          </div>
        )
      )}

      <div className="chat-input-wrapper" ref={inputAreaRef}>
        {quotedMessage && (
          <div className="quote-bar">
            <div className="quote-content">
              <div className="quote-text">
                <span className="quote-message">
                  {truncateQuoteContent(quotedMessage.content)}
                </span>
              </div>
            </div>
            <button type="button" className="quote-close" onClick={onRemoveQuote}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        )}

        {attachedScreenshots.length > 0 && (
          <div className="screenshot-thumb-bar">
            {attachedScreenshots.map(shot => (
              <div key={shot.id} className="screenshot-thumb-inner">
                <img 
                  src={shot.dataUrl} 
                  alt="截图" 
                  className="screenshot-thumb-img" 
                  onClick={() => handleScreenshotThumbClick(shot)}
                />
                <button 
                  type="button" 
                  className="screenshot-thumb-close"
                  onClick={() => onRemoveScreenshot(shot.id)}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="white">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="unified-input-area">
          <MathFormulaEditor
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
        </div>

        <div className="control-bar">
          <div className="left-controls">
            {isEditing ? (
              <div className="edit-indicator">
                <span className="edit-text">编辑消息</span>
                <button onClick={onCancelEdit} className="cancel-edit-btn" type="button">×</button>
              </div>
            ) : (
              <>
                <div className="mode-selector-wrapper">
                  <button 
                    type="button"
                    className="action-mode-btn"
                    onClick={() => setShowModeSelectorMenu(!showModeSelectorMenu)}
                  >
                    <img 
                      src={getCurrentModel().icon} 
                      alt={getCurrentModel().label}
                      style={{ width: 18, height: 18 }}
                    />
                    <span>{getCurrentModel().label}</span>
                  </button>
                  {showModeSelectorMenu && (
                    <div className="mode-menu">
                      {MODEL_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={`mode-menu-item ${selectedModel === option.value ? 'active' : ''}`}
                          onClick={() => handleModelSelect(option.value)}
                        >
                          <img src={option.icon} alt={option.label} style={{ width: 18, height: 18 }} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className={`input-action-btn ${enableWebSearch ? 'active' : ''}`}
                  onClick={onToggleWebSearch}
                >
                  <img src={enableWebSearch ? onlineSearchIconSelected : onlineSearchIcon} alt="联网搜索" className="toolbar-icon" />
                </button>

                {!hideAskTeacherIcon && (
                  <button type="button" className="toolbar-btn" onClick={onScreenshotClick}>
                    <img src={askTeacherIcon} alt="问老师" className="toolbar-icon" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="right-controls">
            <div className="send-button-hit-area" onClick={handleSendButtonHitAreaClick}>
              <button
                type="button"
                disabled={!canSend || isLoading}
                className={`send-button ${canSend ? 'send-button--enabled' : 'send-button--disabled'}`}
              >
                {isLoading ? (
                  <img src={waitingIcon} alt="等待中" className="send-loading-icon" />
                ) : (
                  <img src={sendIcon} alt="发送" className="send-icon" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {showImagePicker && (
        <div className="image-picker-overlay" onClick={() => setShowImagePicker(false)}>
          <div className="image-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="image-picker-header">
              <span>选择图片</span>
              <button onClick={() => setShowImagePicker(false)}>×</button>
            </div>
            <div className="image-picker-options">
              <button onClick={() => fileInputRef.current?.click()}>
                <span>从相册选择</span>
              </button>
              <button onClick={onScreenshotClick}>
                <span>拍照</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
    </div>
  )
}

export default ChatInputComponent
