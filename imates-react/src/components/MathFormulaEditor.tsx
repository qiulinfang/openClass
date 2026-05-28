import React, { useState, useRef, useCallback, useEffect } from 'react'
import './MathFormulaEditor.css'

interface MathFormulaEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  maxHeight?: string
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export const MathFormulaEditor: React.FC<MathFormulaEditorProps> = ({
  value,
  onChange,
  placeholder = '请输入要问的问题',
  disabled = false,
  maxHeight = '200px',
  onFocus,
  onBlur,
  onKeyDown,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, parseInt(maxHeight) || 200)
    textarea.style.height = `${newHeight}px`
  }, [maxHeight])

  useEffect(() => {
    adjustTextareaHeight()
  }, [value, adjustTextareaHeight])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const handleFocus = () => {
    setIsFocused(true)
    onFocus?.()
  }

  const handleBlur = () => {
    setIsFocused(false)
    onBlur?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
    }
    onKeyDown?.(e)
  }

  const insertFormula = (formula: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.substring(0, start) + formula + value.substring(end)
    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + formula.length, start + formula.length)
    }, 0)
  }

  const getMarkdownContent = useCallback(() => {
    return value
  }, [value])

  const clearContent = useCallback(() => {
    onChange('')
  }, [onChange])

  return (
    <div className={`math-formula-editor ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}>
      <textarea
        ref={textareaRef}
        className="formula-textarea"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
    </div>
  )
}

export default MathFormulaEditor
