import React, { useState, useRef, useEffect, useMemo } from 'react'
import { AI_ROLE_OPTIONS } from '@/constants/options'
import Popover from '@/components/base/Popover'
import DeskmateIcon from '/icons/Deskmate.svg'
import RepresentativeIcon from '/icons/Representative.svg'
import GuruIcon from '/icons/Guru.svg'
import '@/components/SimpleChatInput.css'

interface SimpleChatInputComponentProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  isLoading: boolean
  selectedModel?: string
  onSend: (message: string) => void
  onFocus: () => void
  onBlur?: () => void
  onUpdateSelectedModel?: (model: string) => void
  // 插槽支持
  topSlot?: React.ReactNode
  headerPrefixSlot?: React.ReactNode
}

export const SimpleChatInputComponent: React.FC<SimpleChatInputComponentProps> = ({
  value,
  onChange,
  placeholder,
  isLoading,
  selectedModel = 'mate',
  onSend,
  onFocus,
  onBlur,
  onUpdateSelectedModel,
  topSlot,
  headerPrefixSlot,
}) => {
  const [showModeSelectorMenu, setShowModeSelectorMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const getModelDisplayName = (model: string) => {
    const option = AI_ROLE_OPTIONS.find((opt) => opt.value === model)
    return option ? option.label : '同桌'
  }

  const getModelIcon = (model: string) => {
    const iconMap: Record<string, string> = {
      mate: DeskmateIcon,
      mentor: RepresentativeIcon,
      researcher: GuruIcon,
    }
    return iconMap[model] || DeskmateIcon
  }

  const handleSend = () => {
    const message = value.trim()
    if (!message || isLoading) return

    inputRef.current?.blur()

    setTimeout(() => {
      onSend(message)
      onChange('')
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div>
      {topSlot && <div className="simple-chat-top-slot">{topSlot}</div>}
      
      <div className="input-row">
        {headerPrefixSlot && <div className="input-prefix">{headerPrefixSlot}</div>}
        
        <div className="simple-chat-input-wrapper">
          <Popover
            visible={showModeSelectorMenu}
            onVisibleChange={setShowModeSelectorMenu}
            placement="top"
            offset={8}
            showArrow={false}
            content={
              <div className="mode-menu">
                {AI_ROLE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`mode-menu-item ${selectedModel === option.value ? 'active' : ''}`}
                    onClick={() => {
                      onUpdateSelectedModel?.(option.value)
                      setShowModeSelectorMenu(false)
                    }}
                  >
                    <img src={getModelIcon(option.value)} alt={option.label} style={{ width: 18, height: 18 }} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            }
          >
            <button 
              className="action-mode-btn" 
              type="button"
            >
              <img 
                src={getModelIcon(selectedModel)} 
                alt={getModelDisplayName(selectedModel)}
                style={{ width: 18, height: 18 }} 
              />
              <span>{getModelDisplayName(selectedModel)}</span>
            </button>
          </Popover>

          <div className="input-area">
            <input
              ref={inputRef}
              className="simple-chat-input"
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </div>

          <div className="right-actions">
            <button 
              type="button" 
              className="simple-send-btn" 
              disabled={!value.trim() || isLoading}
              onClick={handleSend}
            >
              {isLoading ? (
                <div className="send-loading-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleChatInputComponent
