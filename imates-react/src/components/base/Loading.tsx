import React from 'react'
import '@/components/base/Loading.css'

export interface LoadingProps {
  text?: string
  size?: number
  theme?: 'dark' | 'light'
  horizontal?: boolean
  className?: string
}

export const Loading: React.FC<LoadingProps> = ({
  text,
  size = 48,
  theme = 'dark',
  horizontal = false,
  className = '',
}) => {
  return (
    <div className={`base-loading is-${theme} ${horizontal ? 'is-horizontal' : ''} ${className}`} role="status" aria-live="polite">
      <span className="spinner" style={{ width: `${size}px`, height: `${size}px` }}></span>
      {text && <div className="text">{text}</div>}
    </div>
  )
}

export default Loading
