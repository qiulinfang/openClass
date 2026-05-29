import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react'
import '@/components/base/SearchInput.css'

export interface SearchInputProps {
  value?: string
  placeholder?: string
  readonly?: boolean
  disabled?: boolean
  active?: boolean
  onChange?: (value: string) => void
  onFocus?: (e: React.FocusEvent) => void
  onBlur?: (e: React.FocusEvent) => void
  onEnter?: (e: React.KeyboardEvent) => void
  prepend?: React.ReactNode
  append?: React.ReactNode
}

export interface SearchInputRef {
  focus: () => void
  blur: () => void
}

export const SearchInput = forwardRef<SearchInputRef, SearchInputProps>(({
  value = '',
  placeholder = '',
  readonly = false,
  disabled = false,
  active = false,
  onChange,
  onFocus,
  onBlur,
  onEnter,
  prepend,
  append,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }))

  const handleFocus = (e: React.FocusEvent) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEnter?.(e)
    }
  }

  return (
    <div className={`search-input-wrapper ${active || isFocused ? 'is-active' : ''}`}>
      {prepend && <div className="input-prepend">{prepend}</div>}
      <input
        ref={inputRef}
        className="search-input"
        value={value}
        placeholder={placeholder}
        readOnly={readonly}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {append && <div className="input-append">{append}</div>}
    </div>
  )
})

SearchInput.displayName = 'SearchInput'

export default SearchInput
