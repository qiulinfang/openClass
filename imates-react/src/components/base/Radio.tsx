import React from 'react'
import './Radio.css'

export interface RadioProps {
  checked: boolean
  value?: any
  label?: string
  disabled?: boolean
  color?: string
  onChange?: (value: any) => void
  children?: React.ReactNode
}

export const Radio: React.FC<RadioProps> = ({
  checked,
  value,
  label,
  disabled = false,
  color = '#614dff',
  onChange,
  children,
}) => {
  const handleClick = () => {
    if (disabled || checked) return
    onChange?.(value)
  }

  return (
    <div
      className={`base-radio ${checked ? 'is-checked' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={handleClick}
    >
      <div className="base-radio__input">
        <span className="base-radio__inner" style={checked ? { borderColor: '#cdccff', backgroundColor: '#fff' } : {}}>
          {checked && <span className="base-radio__dot" style={{ backgroundColor: color }} />}
        </span>
      </div>
      <span className="base-radio__label">
        {children || label}
      </span>
    </div>
  )
}

export default Radio
