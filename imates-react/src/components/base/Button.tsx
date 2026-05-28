import React from 'react'
import './Button.css'

export interface ButtonProps {
  label?: string
  loading?: boolean
  disabled?: boolean
  size?: 'xs' | 'sm' | 'mdCompact' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'expired'
  icon?: string
  type?: 'button' | 'submit' | 'reset'
  onClick?: (evt: React.MouseEvent) => void
  children?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  label,
  loading = false,
  disabled = false,
  size = 'md',
  variant = 'primary',
  icon,
  type = 'button',
  onClick,
  children,
}) => {
  const handleClick = (evt: React.MouseEvent) => {
    if (loading || disabled) return
    onClick?.(evt)
  }

  const sizeClass = `common-action-btn--${size}`
  const variantClass = `common-action-btn--${variant}`

  // 只有图标，没有 label
  if (icon && !label && !children) {
    return (
      <div
        className={`icon-button ${sizeClass} ${disabled ? 'icon-button--disabled' : ''}`}
        onClick={handleClick}
      >
        <img src={icon} alt="" className="icon-image" />
      </div>
    )
  }

  // 图标 + 文字
  if (icon && (label || children)) {
    return (
      <button
        type={type}
        className={`common-action-btn icon-text-btn ${sizeClass} ${variantClass} ${disabled ? 'icon-text-btn--disabled' : ''}`}
        disabled={disabled || loading}
        onClick={handleClick}
      >
        <img src={icon} alt={label || ''} className="btn-icon" />
        {loading ? <span className="spinner"></span> : <span className="label">{children || label}</span>}
      </button>
    )
  }

  // 普通按钮
  return (
    <button
      type={type}
      className={`common-action-btn ${sizeClass} ${variantClass}`}
      disabled={disabled || loading}
      onClick={handleClick}
    >
      {loading && <span className="spinner"></span>}
      <span className="label">{children || label}</span>
    </button>
  )
}

export default Button
