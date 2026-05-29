import React from 'react'
import Toolbar from '@/components/drawing/Toolbar'
import '@/components/header/DrawingHeader.css'

export interface DrawingHeaderProps {
  tools?: any
  selectedTool?: string
  toolStates?: Record<string, boolean>
  toolConfig?: any
  backgroundColor?: string
  showBack?: boolean
  allowPopup?: boolean
  onToolChange?: (tool: string) => void
  onConfigChange?: (config: any) => void
  onUndo?: () => void
  onRedo?: () => void
  onClear?: () => void
  onBack?: () => void
  onSearch?: () => void
  onHelp?: () => void
  left?: React.ReactNode
  right?: React.ReactNode
}

export const DrawingHeader: React.FC<DrawingHeaderProps> = ({
  tools = {},
  selectedTool = '',
  toolStates = {},
  toolConfig = {},
  backgroundColor = '#0A0020',
  showBack = true,
  allowPopup = true,
  onToolChange,
  onConfigChange,
  onUndo,
  onRedo,
  onClear,
  onBack,
  onSearch,
  onHelp,
  left,
  right,
}) => {
  const leftContent = left || (showBack && (
    <button className="goback-btn" onClick={onBack}>
      <img src="/icons/goback.svg" alt="返回" className="goback-icon" />
    </button>
  ))

  return (
    <Toolbar
      variant="browser"
      selectedTool={selectedTool}
      toolStates={toolStates}
      toolConfig={toolConfig}
      backgroundColor={backgroundColor}
      onToolChange={onToolChange}
      onConfigChange={onConfigChange}
      onUndo={onUndo}
      onRedo={onRedo}
      onClear={onClear}
      left={leftContent}
      right={right}
    />
  )
}

export default DrawingHeader
