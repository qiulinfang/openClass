import React, { useState, useRef, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Select.css'

export interface SelectProps {
  options: Array<{ label: string; value: string | number }>
  value?: string | number | null
  showArrow?: boolean
  placeholder?: string
  variant?: 'default' | 'outline'
  onChange?: (value: string | number) => void
  renderLabel?: (label: string) => React.ReactNode
  className?: string
}

export const Select: React.FC<SelectProps> = ({
  options = [],
  value,
  showArrow = true,
  placeholder = '请选择',
  variant = 'default',
  onChange,
  renderLabel,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const currentLabel = useMemo(() => {
    const found = options.find((o) => o.value === value)
    if (found) return found.label
    return placeholder ?? '请选择'
  }, [options, value, placeholder])

  const dropdownStyle = useMemo(() => {
    if (!rootRef.current || !isOpen) return {}
    const rect = rootRef.current.getBoundingClientRect()
    const dropdownHeight = 320 // 与 CSS 中的 max-height 保持一致
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    // 如果下方空间不足且上方空间更大，则向上展开
    const shouldShowAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

    return {
      position: 'fixed' as const,
      top: shouldShowAbove ? 'auto' : `${rect.bottom + 8}px`,
      bottom: shouldShowAbove ? `${window.innerHeight - rect.top + 8}px` : 'auto',
      left: `${rect.left}px`,
      minWidth: `${rect.width}px`,
      zIndex: 9999,
    }
  }, [isOpen])

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const handleSelect = (val: string | number) => {
    onChange?.(val)
    setIsOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className={`common-select ${className}`} ref={rootRef}>
      <button
        className={`select-trigger ${variant === 'outline' ? 'select-trigger--outline' : ''}`}
        type="button"
        onClick={toggleDropdown}
      >
        <span className="select-label">
          {renderLabel ? renderLabel(currentLabel) : currentLabel}
        </span>
        {showArrow && (
          <span className={`select-icon-wrapper ${isOpen ? 'select-icon--open' : ''}`}>
            <img src="/icons/arrow.svg" alt="arrow" className="select-icon" />
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <div className="select-dropdown" style={dropdownStyle} onClick={(e) => e.stopPropagation()}>
          <ul className="select-options">
            {options.map((o) => (
              <li
                key={o.value}
                className={`select-option ${o.value === value ? 'select-option--active' : ''}`}
                onClick={() => handleSelect(o.value)}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}

export default Select
