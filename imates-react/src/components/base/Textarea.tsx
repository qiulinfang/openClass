import React, { useRef, useEffect, useCallback } from 'react'
import './Textarea.css'

export interface TextareaProps {
  value: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  maxlength?: number
  minHeight?: number
  maxHeight?: number
  showActionButton?: boolean
  actionButtonClass?: string
  actionButtonDisabled?: boolean
  actionButtonLoading?: boolean
  onChange?: (value: string) => void
  onFocus?: (e: React.FocusEvent) => void
  onBlur?: (e: React.FocusEvent) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  onActionClick?: (e: React.MouseEvent) => void
}

export const Textarea: React.FC<TextareaProps> = ({
  value,
  placeholder = '',
  disabled = false,
  readonly = false,
  maxlength,
  minHeight = 44,
  maxHeight = 120,
  showActionButton = false,
  actionButtonClass = '',
  actionButtonDisabled = false,
  actionButtonLoading = false,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  onActionClick,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [minHeight, maxHeight])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value)
    adjustHeight()
  }

  return (
    <div className="auto-height-textarea-container">
      <textarea
        ref={textareaRef}
        className="auto-height-textarea"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        maxLength={maxlength}
        onChange={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />

      {showActionButton && (
        <button
          type="button"
          className={`auto-action-btn ${actionButtonClass}`}
          disabled={actionButtonDisabled || actionButtonLoading}
          onClick={onActionClick}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default Textarea
