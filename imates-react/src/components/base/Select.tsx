import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import './Select.css'

export interface SelectProps {
  options: Array<{ label: string; value: string | number }>
  value?: string | number | null
  showArrow?: boolean
  placeholder?: string
  variant?: 'default' | 'outline'
  onChange?: (value: string | number) => void
}

export const Select: React.FC<SelectProps> = ({
  options = [],
  value,
  showArrow = true,
  placeholder = '请选择',
  variant = 'default',
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [rootRef, setRootRef] = useState<HTMLElement | null>(null)

  const currentLabel = useMemo(() => {
    const found = options.find((o) => o.value === value)
    if (found) return found.label
    return placeholder ?? '请选择'
  }, [options, value, placeholder])


  const dropdownStyle = useMemo(() => {
    if (!rootRef || !isOpen) return {}
    const rect = rootRef.getBoundingClientRect()
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
  }, [rootRef, isOpen])

  const toggleDropdown = () => {
    setIsOpen(prev => !prev) // 使用函数式更新，确保拿到的是最新状态
  }

  const handleSelect = (val: string | number) => {
    onChange?.(val)
    setIsOpen(false)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef && !rootRef.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, rootRef])

  return (
    <div className="common-select" ref={setRootRef}>
      <button
        className={`select-trigger ${variant === 'outline' ? 'select-trigger--outline' : ''}`}
        type="button"
        onClick={toggleDropdown}
      >
        <span className="select-label">
          {currentLabel}
        </span>
        {showArrow && (
          <span className={`select-icon-wrapper ${isOpen ? 'select-icon--open' : ''}`}>
            <img src="/icons/arrow.svg" alt="arrow" className="select-icon" />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="select-dropdown" style={dropdownStyle}>
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
        </div>
      )}
    </div>
  )
}
