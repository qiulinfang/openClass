import React, { useState } from 'react'
import '@/components/debug/LayoutDebugger.css'

export interface LayoutDebuggerProps {
  modelValue: Record<string, number>
  onChange?: (value: Record<string, number>) => void
}

export const LayoutDebugger: React.FC<LayoutDebuggerProps> = ({
  modelValue = {},
  onChange,
}) => {
  const [visible, setVisible] = useState(false)

  const getUnit = (key: string) => {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes('size') || lowerKey.includes('padding') || 
        lowerKey.includes('margin') || lowerKey.includes('height') || 
        lowerKey.includes('top') || lowerKey.includes('left')) {
      return 'px'
    }
    return ''
  }

  const getMin = (key: string) => {
    if (key.includes('top') || key.includes('left')) return -50
    return 0
  }

  const getMax = (key: string) => {
    if (key.includes('Width') || key.includes('Height')) return 300
    if (key.includes('Size')) return 100
    return 50
  }

  const getStep = () => 1

  const updateValue = (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value)
    onChange?.({ ...modelValue, [key]: newValue })
  }

  const copyConfig = () => {
    const json = JSON.stringify(modelValue, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      alert('配置已复制到剪贴板')
    })
  }

  if (!visible) {
    return (
      <button className="open-debugger-btn" onClick={() => setVisible(true)}>
        打开调试
      </button>
    )
  }

  return (
    <div className="layout-debugger">
      <div className="debugger-header">
        <span>布局调试面板</span>
        <button onClick={() => setVisible(false)} className="close-btn">×</button>
      </div>
      <div className="debugger-content">
        {Object.entries(modelValue).map(([key, value]) => (
          <div key={key} className="debug-item">
            <label>{key}: {value}{getUnit(key)}</label>
            <input
              type="range"
              min={getMin(key)}
              max={getMax(key)}
              step={getStep()}
              value={value}
              onChange={(e) => updateValue(key, e)}
            />
          </div>
        ))}
      </div>
      <div className="debugger-footer">
        <button onClick={copyConfig} className="copy-btn">复制配置 JSON</button>
      </div>
    </div>
  )
}

export default LayoutDebugger
