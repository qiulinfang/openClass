import React, { useState, useRef, useMemo } from 'react'
import './ScreenshotDebugPanel.css'

export interface DebugImageData {
  source?: string
  format?: string
  width?: number
  height?: number
  dataLength?: number
  prefix?: string
  timestamp?: number
  dataUrl?: string
}

export interface ScreenshotDebugPanelProps {
  visible?: boolean
  debugImageData?: DebugImageData
  onClose?: () => void
}

export const ScreenshotDebugPanel: React.FC<ScreenshotDebugPanelProps> = ({
  visible = false,
  debugImageData,
  onClose,
}) => {
  const [canvasHoverInfo, setCanvasHoverInfo] = useState<{ x: number; y: number; color: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const isDev = import.meta.env.DEV

  const aspectRatio = useMemo(() => {
    if (!debugImageData?.width || !debugImageData?.height) return 'N/A'
    return (debugImageData.width / debugImageData.height).toFixed(2)
  }, [debugImageData])

  const totalPixels = useMemo(() => {
    if (!debugImageData?.width || !debugImageData?.height) return 0
    return debugImageData.width * debugImageData.height
  }, [debugImageData])

  const handleCanvasClick = () => {
    console.log('[ScreenshotDebugPanel] Canvas 点击')
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.floor(e.clientX - rect.left)
    const y = Math.floor(e.clientY - rect.top)
    setCanvasHoverInfo({ x, y, color: 'rgb(0,0,0)' })
  }

  const handleCanvasMouseLeave = () => {
    setCanvasHoverInfo(null)
  }

  if (!isDev || !visible || !debugImageData) return null

  return (
    <div className="screenshot-debug-panel" onClick={(e) => e.stopPropagation()}>
      <div className="debug-header">
        <span>🔍 截图调试信息</span>
        <button className="debug-close" onClick={onClose}>×</button>
      </div>
      
      <div className="debug-content">
        <div className="debug-section">
          <div className="debug-item">
            <strong>来源:</strong> {debugImageData.source}
          </div>
          <div className="debug-item">
            <strong>格式:</strong> {debugImageData.format}
          </div>
          <div className="debug-item">
            <strong>尺寸:</strong> {debugImageData.width} × {debugImageData.height}
          </div>
          <div className="debug-item">
            <strong>数据长度:</strong> {debugImageData.dataLength?.toLocaleString()} 字节
          </div>
          <div className="debug-item">
            <strong>前缀:</strong> <code>{debugImageData.prefix}</code>
          </div>
          {debugImageData.timestamp && (
            <div className="debug-item">
              <strong>时间戳:</strong> {new Date(debugImageData.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>

        <div className="debug-section">
          <div className="debug-section-title">📷 图像预览</div>
          <div className="canvas-container">
            <canvas 
              ref={canvasRef}
              className="screenshot-canvas"
              width={debugImageData.width}
              height={debugImageData.height}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
            />
            {canvasHoverInfo && (
              <div className="canvas-hover-info">
                <div className="hover-position">坐标: ({canvasHoverInfo.x}, {canvasHoverInfo.y})</div>
                <div className="hover-color">颜色: {canvasHoverInfo.color}</div>
              </div>
            )}
          </div>
        </div>

        <div className="debug-section">
          <div className="debug-section-title">📊 图像分析</div>
          <div className="analysis-grid">
            <div className="analysis-item">
              <div className="analysis-label">宽高比</div>
              <div className="analysis-value">{aspectRatio}</div>
            </div>
            <div className="analysis-item">
              <div className="analysis-label">总像素</div>
              <div className="analysis-value">{totalPixels.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScreenshotDebugPanel
