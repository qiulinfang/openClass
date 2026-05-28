import React, { useRef, useState, useEffect } from 'react'
import { Toolbar } from './Toolbar'
import './DrawingBoard.css'

export interface DrawingBoardProps {
  toolbarPosition?: 'top' | 'left'
  showZoomControl?: boolean
  backgroundColor?: string
  onUndo?: () => void
  onRedo?: () => void
  onClear?: () => void
  onToolChange?: (tool: string) => void
}

export const DrawingBoard: React.FC<DrawingBoardProps> = ({
  toolbarPosition = 'top',
  showZoomControl = true,
  backgroundColor = '#ffffff',
  onUndo,
  onRedo,
  onClear,
  onToolChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentTool, setCurrentTool] = useState('pen')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [backgroundColor])

  const handleToolChange = (tool: string) => {
    setCurrentTool(tool)
    onToolChange?.(tool)
  }

  const undo = () => {
    setCanUndo(false)
    onUndo?.()
  }

  const redo = () => {
    setCanRedo(false)
    onRedo?.()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
    onClear?.()
  }

  return (
    <div className={`canvas-demo-container ${toolbarPosition === 'left' ? 'toolbar-left' : ''}`}>
      <div className={`toolbar-wrapper ${toolbarPosition === 'left' ? 'toolbar-wrapper-left' : ''}`}>
        <Toolbar
          variant="browser"
          orientation={toolbarPosition === 'left' ? 'vertical' : 'horizontal'}
          backgroundColor="#0A0020"
          selectedTool={currentTool}
          toolStates={{ undo: canUndo, redo: canRedo }}
          onToolChange={handleToolChange}
          onUndo={undo}
          onRedo={redo}
          onClear={clearCanvas}
        />
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="canvas-container"
          width={800}
          height={600}
        />

        {showZoomControl && (
          <div className="zoom-control-panel">
            <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(3, zoom + 0.1))}>+</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DrawingBoard
