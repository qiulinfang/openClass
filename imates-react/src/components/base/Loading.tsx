import React from 'react'
import './Loading.css'

export interface LoadingProps {
  text?: string
  size?: number
  theme?: 'dark' | 'light'
  horizontal?: boolean
}

export const Loading: React.FC<LoadingProps> = ({
  text,
  size = 48,
  theme = 'dark',
  horizontal = false,
}) => {
  return (
    <div className={`base-loading is-${theme} ${horizontal ? 'is-horizontal' : ''}`} role="status" aria-live="polite">
      <span className="spinner" style={{ width: `${size}px`, height: `${size}px` }}></span>
      {text && <div className="text">{text}</div>}
    </div>
  )
}

export default Loading
