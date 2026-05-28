import React, { useState } from 'react'
import './FloatBubbleDebugPanel.css'

export interface FloatBubbleConfig {
  side?: 'left' | 'right'
  forceVisible?: boolean
  disableOutsideClose?: boolean
  width?: number
  height?: number
  gap?: number
  paddingX?: number
  paddingY?: number
  offsetX?: number
  offsetY?: number
  zIndex?: number
}

export interface FloatBubbleDebugPanelProps {
  visible?: boolean
  config?: FloatBubbleConfig
  onUpdate?: (config: FloatBubbleConfig) => void
  onClose?: () => void
}

export const FloatBubbleDebugPanel: React.FC<FloatBubbleDebugPanelProps> = ({
  visible = false,
  config = {},
  onUpdate,
  onClose,
}) => {
  const [local, setLocal] = useState<FloatBubbleConfig>(config)

  const handleChange = (key: keyof FloatBubbleConfig, value: any) => {
    const newConfig = { ...local, [key]: value }
    setLocal(newConfig)
    onUpdate?.(newConfig)
  }

  if (!visible) return null

  return (
    <div className="debug-panel" onClick={(e) => e.stopPropagation()}>
      <div className="debug-header">
        <span className="debug-title">FloatBubble Debug</span>
        <button className="debug-btn" type="button" onClick={onClose}>×</button>
      </div>

      <div className="debug-row">
        <label className="debug-label">side</label>
        <select 
          className="debug-input" 
          value={local.side || 'right'}
          onChange={(e) => handleChange('side', e.target.value)}
        >
          <option value="left">left</option>
          <option value="right">right</option>
        </select>
      </div>

      <div className="debug-row">
        <label className="debug-label">forceVisible</label>
        <input 
          className="debug-checkbox" 
          type="checkbox" 
          checked={local.forceVisible || false}
          onChange={(e) => handleChange('forceVisible', e.target.checked)}
        />
      </div>

      <div className="debug-row">
        <label className="debug-label">disableOutsideClose</label>
        <input 
          className="debug-checkbox" 
          type="checkbox" 
          checked={local.disableOutsideClose || false}
          onChange={(e) => handleChange('disableOutsideClose', e.target.checked)}
        />
      </div>

      <div className="debug-grid">
        <div className="debug-row">
          <label className="debug-label">width</label>
          <input 
            className="debug-input" 
            type="number" 
            min={80}
            step={1}
            value={local.width || 200}
            onChange={(e) => handleChange('width', Number(e.target.value))}
          />
        </div>
        <div className="debug-row">
          <label className="debug-label">height</label>
          <input 
            className="debug-input" 
            type="number" 
            min={80}
            step={1}
            value={local.height || 200}
            onChange={(e) => handleChange('height', Number(e.target.value))}
          />
        </div>
        <div className="debug-row">
          <label className="debug-label">gap</label>
          <input 
            className="debug-input" 
            type="number" 
            min={0}
            step={1}
            value={local.gap || 12}
            onChange={(e) => handleChange('gap', Number(e.target.value))}
          />
        </div>
        <div className="debug-row">
          <label className="debug-label">padX</label>
          <input 
            className="debug-input" 
            type="number" 
            min={0}
            step={1}
            value={local.paddingX || 16}
            onChange={(e) => handleChange('paddingX', Number(e.target.value))}
          />
        </div>
        <div className="debug-row">
          <label className="debug-label">padY</label>
          <input 
            className="debug-input" 
            type="number" 
            min={0}
            step={1}
            value={local.paddingY || 16}
            onChange={(e) => handleChange('paddingY', Number(e.target.value))}
          />
        </div>
        <div className="debug-row">
          <label className="debug-label">offsetX</label>
          <input 
            className="debug-input" 
            type="number" 
            step={1}
            value={local.offsetX || 0}
            onChange={(e) => handleChange('offsetX', Number(e.target.value))}
          />
        </div>
        <div className="debug-row">
          <label className="debug-label">offsetY</label>
          <input 
            className="debug-input" 
            type="number" 
            step={1}
            value={local.offsetY || 0}
            onChange={(e) => handleChange('offsetY', Number(e.target.value))}
          />
        </div>
        <div className="debug-row">
          <label className="debug-label">zIndex</label>
          <input 
            className="debug-input" 
            type="number" 
            step={1}
            value={local.zIndex || 9999}
            onChange={(e) => handleChange('zIndex', Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  )
}

export default FloatBubbleDebugPanel
