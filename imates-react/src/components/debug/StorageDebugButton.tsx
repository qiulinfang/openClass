import React from 'react'
import './StorageDebugButton.css'

export interface StorageDebugButtonProps {
  isPanelVisible?: boolean
  onToggle?: () => void
}

export const StorageDebugButton: React.FC<StorageDebugButtonProps> = ({
  isPanelVisible = false,
  onToggle,
}) => {
  const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

  if (!isDev) return null

  return (
    <button
      className="storage-debug-button"
      onClick={onToggle}
      title={isPanelVisible ? '关闭存储调试面板' : '打开存储调试面板'}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
        <path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z"/>
      </svg>
    </button>
  )
}

export default StorageDebugButton
