import React, { useState, useEffect } from 'react'
import '@/components/pdf/PdfGestureDebugPanel.css'

export interface PdfGestureDebugPanelProps {
  minScale?: number
  maxScale?: number
  zoomThreshold?: number
  panThreshold?: number
  friction?: number
  onMinScaleChange?: (value: number) => void
  onMaxScaleChange?: (value: number) => void
  onZoomThresholdChange?: (value: number) => void
  onPanThresholdChange?: (value: number) => void
  onFrictionChange?: (value: number) => void
}

export const PdfGestureDebugPanel: React.FC<PdfGestureDebugPanelProps> = ({
  minScale = 0.5,
  maxScale = 3,
  zoomThreshold = 0.01,
  panThreshold = 10,
  friction = 0.001,
  onMinScaleChange,
  onMaxScaleChange,
  onZoomThresholdChange,
  onPanThresholdChange,
  onFrictionChange,
}) => {
  const [localMinScale, setLocalMinScale] = useState(minScale)
  const [localMaxScale, setLocalMaxScale] = useState(maxScale)
  const [localZoomThreshold, setLocalZoomThreshold] = useState(zoomThreshold)
  const [localPanThreshold, setLocalPanThreshold] = useState(panThreshold)
  const [localFriction, setLocalFriction] = useState(friction)

  useEffect(() => { setLocalMinScale(minScale) }, [minScale])
  useEffect(() => { setLocalMaxScale(maxScale) }, [maxScale])
  useEffect(() => { setLocalZoomThreshold(zoomThreshold) }, [zoomThreshold])
  useEffect(() => { setLocalPanThreshold(panThreshold) }, [panThreshold])
  useEffect(() => { setLocalFriction(friction) }, [friction])

  return (
    <div className="pdf-gesture-debug-panel">
      <div className="panel-header">
        <div className="title">PDF 手势调试</div>
      </div>
      <div className="panel-body">
        <div className="field">
          <label>最小缩放倍数</label>
          <input 
            type="number" 
            step="0.05" 
            value={localMinScale}
            onChange={(e) => {
              const val = Number(e.target.value)
              setLocalMinScale(val)
              onMinScaleChange?.(val)
            }}
          />
          <p className="hint">数值越小，页面可以缩得越小（看到更大范围）；数值越大，最小缩小比例越受限制。</p>
        </div>
        <div className="field">
          <label>最大缩放倍数</label>
          <input 
            type="number" 
            step="0.1" 
            value={localMaxScale}
            onChange={(e) => {
              const val = Number(e.target.value)
              setLocalMaxScale(val)
              onMaxScaleChange?.(val)
            }}
          />
          <p className="hint">数值越大，可以放得越大（细节更清晰）；数值越小，最大放大倍数越受限制。</p>
        </div>
        <div className="field">
          <label>缩放判定阈值 (比例变化)</label>
          <input 
            type="number" 
            step="0.01" 
            value={localZoomThreshold}
            onChange={(e) => {
              const val = Number(e.target.value)
              setLocalZoomThreshold(val)
              onZoomThresholdChange?.(val)
            }}
          />
          <p className="hint">数值越大，捏合动作需要更明显才会触发缩放（不易误触）；数值越小，轻微捏合就会开始缩放。</p>
        </div>
        <div className="field">
          <label>拖动判定阈值 (像素)</label>
          <input 
            type="number" 
            step="1" 
            value={localPanThreshold}
            onChange={(e) => {
              const val = Number(e.target.value)
              setLocalPanThreshold(val)
              onPanThresholdChange?.(val)
            }}
          />
          <p className="hint">数值越大，需要滑动更长距离才识别为拖动；数值越小，轻微滑动就会开始滚动。</p>
        </div>
        <div className="field">
          <label>惯性摩擦 (越大越快停)</label>
          <input 
            type="number" 
            step="0.0005" 
            value={localFriction}
            onChange={(e) => {
              const val = Number(e.target.value)
              setLocalFriction(val)
              onFrictionChange?.(val)
            }}
          />
          <p className="hint">数值越大，惯性滑动更快停下；数值越小，惯性更长、更"顺滑"。</p>
        </div>
      </div>
    </div>
  )
}

export default PdfGestureDebugPanel
