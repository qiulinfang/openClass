import React from 'react'
import './Loading.css'

export interface LoadingProps {
  text?: string
  size?: number
  theme?: 'dark' | 'light'
}

export const Loading: React.FC<LoadingProps> = ({
  text,
  size = 48,
  theme = 'dark',
}) => {
  return (
    <div className={`base-loading is-${theme}`} role="status" aria-live="polite">
      <span className="spinner" style={{ width: `${size}px`, height: `${size}px` }}></span>
      {text && <div className="text">{text}</div>}
    </div>
  )
}

export default Loading
