import React from 'react'
import '@/components/base/SelectMulti.css'

export interface SelectMultiProps {
  value: string[]
  options: string[]
  vertical?: boolean
  className?: string
  onChange?: (value: string[]) => void
}

export const SelectMulti: React.FC<SelectMultiProps> = ({
  value = [],
  options,
  vertical = false,
  className = '',
  onChange,
}) => {
  const handleSelect = (opt: string) => {
    const set = new Set(value)
    if (set.has(opt)) {
      set.delete(opt)
    } else {
      set.add(opt)
    }
    onChange?.(Array.from(set))
  }

  return (
    <div className={`multi-select ${vertical ? 'multi-select--vertical' : ''} ${className}`}>
      {options.map((opt) => (
        <button
          key={opt}
          className={`multi-select__option ${value.includes(opt) ? 'is-active' : ''}`}
          type="button"
          onClick={() => handleSelect(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export default SelectMulti
