import React from 'react'
import './SimpleChatInput.css'

interface SimpleChatInputComponentProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  isLoading: boolean
  onSend: () => void
  onFocus: () => void
}

export const SimpleChatInputComponent: React.FC<SimpleChatInputComponentProps> = ({
  value,
  onChange,
  placeholder,
  isLoading,
  onSend,
  onFocus,
}) => {
  return (
    <div className="simple-chat-input">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            onSend()
          }
        }}
        disabled={isLoading}
      />
      <button onClick={onSend} disabled={!value.trim() || isLoading}>
        →
      </button>
    </div>
  )
}
