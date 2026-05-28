import React, { useCallback } from 'react'
import './Checkbox.css'

export interface CheckboxProps {
  checked: boolean
  indeterminate?: boolean
  size?: 'sm' | 'md'
  onChange?: (checked: boolean) => void
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  indeterminate = false,
  size = 'md',
  onChange,
}) => {
  const toggle = useCallback(() => {
    onChange?.(!checked)
  }, [checked, onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <div
      className={`base-checkbox ${checked ? 'is-checked' : ''} ${indeterminate ? 'is-indeterminate' : ''}`}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={handleKeyDown}
    >
      <span className="base-checkbox__bg">
        {checked && (
          <svg className="base-checkbox__check" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {!checked && indeterminate && <span className="base-checkbox__indet" aria-hidden="true"></span>}
      </span>
    </div>
  )
}

export default Checkbox
