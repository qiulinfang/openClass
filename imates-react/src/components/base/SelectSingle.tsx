import React from 'react'
import '@/components/base/SelectSingle.css'

export interface SelectSingleProps {
  value: string
  options: string[]
  vertical?: boolean
  className?: string
  onChange?: (value: string) => void
}

export const SelectSingle: React.FC<SelectSingleProps> = ({
  value,
  options,
  vertical = false,
  className = '',
  onChange,
}) => {
  const handleSelect = (opt: string) => {
    if (opt === value) return
    onChange?.(opt)
  }

  return (
    <div className={`single-select ${vertical ? 'single-select--vertical' : ''} ${className}`}>
      {options.map((opt) => (
        <button
          key={opt}
          className={`single-select__option ${value === opt ? 'is-active' : ''}`}
          type="button"
          onClick={() => handleSelect(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export default SelectSingle
