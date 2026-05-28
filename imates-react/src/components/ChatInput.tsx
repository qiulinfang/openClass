import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { ChatBubble, AttachedScreenshot } from '../types'
import type { ChatType } from '../strategies/ChatStrategyFactory'
import { MathFormulaEditor } from './MathFormulaEditor'
import { VoiceInput } from './VoiceInput'
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
  { value: 'mate', label: '同桌', icon: '/icons/Deskmate.svg' },
  { value: 'mentor', label: '学长', icon: '/icons/Representative.svg' },
  { value: 'researcher', label: '大师', icon: '/icons/Guru.svg' },
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
  // 插槽
  headerAll,
  headerPrefix,
  headerSuffix,
  headerRight,
  children,
}) => {
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const showImageUpload = IMAGE_TYPES.includes(type)

  const getCurrentModel = () => MODEL_OPTIONS.find(m => m.value === selectedModel) || MODEL_OPTIONS[0]

  const handleModelSelect = (model: string) => {
    onUpdateSelectedModel(model)
    setShowModelMenu(false)
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
            filePath: '',
            width: 0,
            height: 0,
            fileSize: file.size,
            base64DataUrl: base64,
          }
          // 这里需要通过 props 传递添加截图的方法
          console.log('图片已选择:', newScreenshot)
        }
        reader.readAsDataURL(file)
      }
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setShowImagePicker(false)
  }, [])

  // 处理粘贴事件（粘贴图片）
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
            filePath: '',
            width: 0,
            height: 0,
            fileSize: file.size,
            base64DataUrl: base64,
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

  return (
    <div className="modern-chat-container">
      {/* 顶部工具栏 - 支持 headerAll 插槽 */}
      {showToolbar && (
        headerAll ? (
          <div className="chat-input-header-flex">{headerAll}</div>
        ) : (
          <div className="chat-input-header-flex">
            <div className="chat-input-header-left">
              <div className="chat-top-toolbar">
                {/* 插槽：工具条前置内容 */}
                {headerPrefix}

                {/* 图片上传按钮 */}
                {showImageUpload && (
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={() => setShowImagePicker(true)}
                    title="添加图片"
                  >
                    <img src="/icons/Album.svg" alt="添加图片" className="toolbar-icon" />
                  </button>
                )}

                {/* 公式编辑器按钮 */}
                <button type="button" className="toolbar-btn" title="公式">
                  <img src="/icons/InsertText.svg" alt="公式" className="toolbar-icon" />
                </button>

                {/* 问老师按钮 */}
                {!hideAskTeacherIcon && (
                  <button type="button" className="toolbar-btn" title="问老师">
                    <img src="/icons/askTeacher.svg" alt="问老师" className="toolbar-icon" />
                  </button>
                )}

                {/* 插槽：工具条后置内容 */}
                {headerSuffix}
              </div>
            </div>

            <div className="chat-input-header-right">
              {/* 插槽：右侧额外区域 */}
              {headerRight}
              {/* 新建会话按钮 */}
              <button type="button" className="toolbar-btn" onClick={onNewSessionClick} title="新建会话">
                <img src="/icons/addsession.svg" alt="新建会话" className="toolbar-icon" />
              </button>
            </div>
          </div>
        )
      )}

      {/* 插槽：主内容区域 */}
      {children}

      {/* 主输入区域 */}
      <div className="chat-input-wrapper">
        {/* 引用消息区域 */}
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

        {/* 截图缩略图 */}
        {attachedScreenshots.length > 0 && (
          <div className="screenshot-thumb-bar">
            {attachedScreenshots.map(screenshot => (
              <div key={screenshot.id} className="screenshot-thumb-inner">
                <img src={screenshot.base64DataUrl} alt="截图" className="screenshot-thumb-img" />
                <button 
                  type="button" 
                  className="screenshot-thumb-close"
                  onClick={() => onRemoveScreenshot(screenshot.id)}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="white">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入区域 */}
        <div className="unified-input-area">
          {/* 模式选择器 */}
          <div className="mode-selector-wrapper">
            <button 
              type="button"
              className="action-mode-btn"
              onClick={() => setShowModelMenu(!showModelMenu)}
            >
              <img 
                src={getCurrentModel().icon} 
                alt={getCurrentModel().label}
                style={{ width: 18, height: 18 }}
              />
              <span>{getCurrentModel().label}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>

            {showModelMenu && (
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

          {/* 公式编辑器（支持粘贴图片） */}
          <div 
            className="formula-editor-wrapper"
            onPaste={(e) => handlePaste(e)}
          >
            <MathFormulaEditor
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              onFocus={onFocus}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </div>

          {/* 右侧操作按钮 */}
          <div className="input-right-actions">
            {/* 语音输入 */}
            <VoiceInput
              onResult={(text) => onChange(value + text)}
              onStart={() => console.log('语音识别开始')}
              onEnd={() => console.log('语音识别结束')}
            />

            {/* 联网搜索 */}
            {type === 'ai-general' && (
              <button
                type="button"
                className={`input-action-btn ${enableWebSearch ? 'active' : ''}`}
                onClick={onToggleWebSearch}
                title="联网搜索"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
              </button>
            )}

            {/* 发送按钮 */}
            <button
              type="button"
              className="send-button"
              onClick={onSend}
              disabled={!canSend || isLoading}
            >
              {isLoading ? (
                <svg viewBox="0 0 24 24" width="18" height="18" className="loading-spinner">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 编辑提示 */}
        {isEditing && (
          <div className="editing-hint">
            <span>编辑中</span>
            <button type="button" onClick={onCancelEdit}>取消</button>
          </div>
        )}
      </div>

      {/* 图片选择器弹窗 */}
      {showImagePicker && (
        <div className="image-picker-overlay" onClick={() => setShowImagePicker(false)}>
          <div className="image-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="image-picker-header">
              <span>选择图片</span>
              <button onClick={() => setShowImagePicker(false)}>×</button>
            </div>
            <div className="image-picker-options">
              <button onClick={() => fileInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                <span>从相册选择</span>
              </button>
              <button onClick={onScreenshotClick}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l1.83-2h4.24l1.83 2H20v12zM12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"/>
                </svg>
                <span>拍照</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 隐藏的文件输入 */}
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
