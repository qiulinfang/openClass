import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Toolbar } from '@/components/drawing/Toolbar'
import '@/components/drawing/DrawingBoard.css'

export interface DrawingBoardProps {
  toolbarPosition?: 'top' | 'left'
  showZoomControl?: boolean
  backgroundColor?: string
  backgroundImage?: string
  onUndo?: () => void
  onRedo?: () => void
  onSave?: (data: {
    objects: any[]
    history: any[][]
    historyIndex: number
  }) => void
  onClear?: () => void
  onToolChange?: (tool: string) => void
  onAskAiImageSelected?: (imageInfo: {
    base64DataUrl?: string
    width: number
    height: number
    fileSize: number
  }) => void
  children?: React.ReactNode
}

export const DrawingBoard = forwardRef<any, DrawingBoardProps>(({
  toolbarPosition = 'top',
  showZoomControl = true,
  backgroundColor = '#ffffff',
  backgroundImage,
  onUndo,
  onRedo,
  onSave,
  onClear,
  onToolChange,
  onAskAiImageSelected,
  children,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentTool, setCurrentTool] = useState('pen')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [zoom, setZoom] = useState(1)

  // 暴露给外部的方法
  useImperativeHandle(ref, () => ({
    clearAll: () => {
      // 外部调用时执行静默清空，不触发 onClear 回调
      silentClearCanvas()
    },
    saveData: () => {
      // 简单实现，实际应保存所有笔迹对象
      return {
        objects: [],
        history: [],
        historyIndex: -1
      }
    },
    loadData: (data: any) => {
      console.log('Loading board data:', data)
    },
    handleToolbarToolChange: (tool: string) => {
      handleToolChange(tool)
    },
    handleToolbarConfigChange: (config: any) => {
      console.log('Config change:', config)
    },
    undo: () => undo(),
    redo: () => redo(),
    canUndo,
    canRedo,
    toolbarSelectedTool: currentTool
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    const img = backgroundImage ? new Image() : null
    
    const draw = () => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // 绘制背景色
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // 绘制背景图 (contain 模式)
      if (img && img.complete) {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
        const x = (canvas.width - img.width * scale) / 2
        const y = (canvas.height - img.height * scale) / 2
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
      }
    }

    if (img) {
      img.src = backgroundImage!
      img.onload = draw
    } else {
      draw()
    }
  }, [backgroundColor, backgroundImage])

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

  const silentClearCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = backgroundColor
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }

  const clearCanvas = () => {
    silentClearCanvas()
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
        
        {children}

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
})

DrawingBoard.displayName = 'DrawingBoard'

export default DrawingBoard
