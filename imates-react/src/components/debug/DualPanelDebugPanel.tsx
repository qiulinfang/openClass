import React from 'react'
import '@/components/debug/DualPanelDebugPanel.css'

export interface DualPanelDebugPanelProps {
  modelValue: number
  minOffset: number
  maxOffset: number
  onChange?: (value: number) => void
  onMinOffsetChange?: (value: number) => void
  onMaxOffsetChange?: (value: number) => void
}

export const DualPanelDebugPanel: React.FC<DualPanelDebugPanelProps> = ({
  modelValue,
  minOffset,
  maxOffset,
  onChange,
  onMinOffsetChange,
  onMaxOffsetChange,
}) => {
  const isDev = import.meta.env.DEV

  if (!isDev) return null

  return (
    <div className="debug-panel">
      <div className="debug-title">宽度调试面板</div>
      <div className="debug-row">
        <label>左侧宽度: {modelValue.toFixed(1)}%</label>
        <input
          type="range"
          value={modelValue}
          onChange={(e) => onChange?.(Number(e.target.value))}
          min={minOffset}
          max={maxOffset}
          step="0.5"
        />
      </div>
      <div className="debug-row">
        <label>最小左侧宽度 (minOffset): {minOffset}%</label>
        <input
          type="number"
          value={minOffset}
          onChange={(e) => onMinOffsetChange?.(Number(e.target.value))}
          min={10}
          max={50}
          step={1}
        />
      </div>
      <div className="debug-row">
        <label>最大左侧宽度 (maxOffset): {maxOffset}%</label>
        <input
          type="number"
          value={maxOffset}
          onChange={(e) => onMaxOffsetChange?.(Number(e.target.value))}
          min={50}
          max={90}
          step={1}
        />
      </div>
      <div className="debug-info">
        <div>右侧宽度: {(100 - modelValue).toFixed(1)}%</div>
        <div>右侧最小宽度: {(100 - maxOffset).toFixed(1)}%</div>
        <div>右侧最大宽度: {(100 - minOffset).toFixed(1)}%</div>
      </div>
    </div>
  )
}

export default DualPanelDebugPanel
