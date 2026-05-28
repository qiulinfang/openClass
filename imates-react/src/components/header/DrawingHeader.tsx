import React from 'react'
import './DrawingHeader.css'

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
  return (
    <div className="drawing-header" style={{ backgroundColor }}>
      <div className="header-left">
        {left || (showBack && (
          <button className="goback-btn" onClick={onBack}>
            <img src="/icons/goback.svg" alt="返回" className="goback-icon" />
          </button>
        ))}
      </div>
      <div className="header-center">
        {/* TODO: 集成 Toolbar 组件 */}
        <span style={{ color: '#fff' }}>画板工具栏</span>
      </div>
      <div className="header-right">
        {right}
      </div>
    </div>
  )
}

export default DrawingHeader
