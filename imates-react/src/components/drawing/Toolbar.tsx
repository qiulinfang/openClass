import React, { useState } from 'react'
import '@/components/drawing/Toolbar.css'

export interface Tool {
  value: string
  label: string
  icon?: string
}

export interface ToolbarProps {
  variant?: 'browser' | 'fullscreen'
  orientation?: 'horizontal' | 'vertical'
  backgroundColor?: string
  selectedTool?: string
  toolStates?: Record<string, boolean>
  toolConfig?: any
  onToolChange?: (tool: string) => void
  onConfigChange?: (config: any) => void
  onUndo?: () => void
  onRedo?: () => void
  onClear?: () => void
  left?: React.ReactNode
  right?: React.ReactNode
}

export const Toolbar: React.FC<ToolbarProps> = ({
  variant = 'browser',
  orientation = 'horizontal',
  backgroundColor = '#0A0020',
  selectedTool = '',
  toolStates = {},
  toolConfig = {},
  onToolChange,
  onConfigChange,
  onUndo,
  onRedo,
  onClear,
  left,
  right,
}) => {
  const [activeTool, setActiveTool] = useState(selectedTool)

  const leftTools: Tool[] = [
    { value: 'pen', label: '画笔' },
    { value: 'highlighter', label: '荧光笔' },
    { value: 'eraser', label: '橡皮擦' },
  ]

  const middleTools: Tool[] = [
    { value: 'undo', label: '撤销' },
    { value: 'redo', label: '重做' },
    { value: 'clear', label: '清空' },
  ]

  const handleToolClick = (tool: string) => {
    setActiveTool(tool)
    onToolChange?.(tool)
  }

  return (
    <div className={`unified-toolbar-container variant-${variant} orientation-${orientation}`}>
      <div className="unified-toolbar">
        <div className="toolbar-slot toolbar-slot-left">
          {left}
        </div>

        <div 
          className="toolbar-content"
          style={backgroundColor ? { backgroundColor } : {}}
        >
          <div className="left-section">
            {leftTools.map((tool) => (
              <button
                key={tool.value}
                className={`action-btn ${activeTool === tool.value ? 'active' : ''}`}
                onClick={() => handleToolClick(tool.value)}
                disabled={toolStates[tool.value] === false}
              >
                <span className="tool-icon">{getToolIcon(tool.value)}</span>
                <span className="tool-label">{tool.label}</span>
              </button>
            ))}
          </div>

          <div className="center-section">
            <button className="action-btn" onClick={onUndo} disabled={!toolStates.undo}>
              ↩
            </button>
            <button className="action-btn" onClick={onRedo} disabled={!toolStates.redo}>
              ↪
            </button>
            <button className="action-btn" onClick={onClear}>
              🗑
            </button>
          </div>
        </div>

        <div className="toolbar-slot toolbar-slot-right">
          {right}
        </div>
      </div>
    </div>
  )
}

function getToolIcon(tool: string): string {
  const icons: Record<string, string> = {
    pen: '✏️',
    highlighter: '🖍',
    eraser: '🧹',
  }
  return icons[tool] || '•'
}

export default Toolbar
