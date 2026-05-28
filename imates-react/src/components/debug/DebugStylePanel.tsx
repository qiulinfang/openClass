import React, { useState, useMemo } from 'react'
import './DebugStylePanel.css'

interface ConfigItem {
  label: string
  value: number | boolean
  min?: number
  max?: number
  unit?: string
}

export interface DebugStylePanelProps {
  modelValue: Record<string, any>
  config: Record<string, ConfigItem>
  title?: string
  onChange?: (value: Record<string, any>) => void
}

export const DebugStylePanel: React.FC<DebugStylePanelProps> = ({
  modelValue = {},
  config = {},
  title = 'Debug Style',
  onChange,
}) => {
  const [visible, setVisible] = useState(true)

  const isDev = useMemo(() => import.meta.env.DEV, [])

  const updateValue = (key: string, value: any) => {
    const newValue = { ...modelValue, [key]: value }
    onChange?.(newValue)
  }

  const handleInput = (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
    updateValue(key, event.target.valueAsNumber)
  }

  const handleChange = (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
    updateValue(key, event.target.checked)
  }

  const copyConfig = () => {
    const json = JSON.stringify(modelValue, null, 2)
    navigator.clipboard.writeText(json).then(() => {
      alert('配置已复制到剪贴板')
    })
  }

  if (!isDev) return null

  return (
    <div className="debug-panel-overlay">
      <div className="debug-title">
        <span>{title}</span>
        <button className="close-btn" onClick={() => setVisible(!visible)}>
          {visible ? '收起' : '展开'}
        </button>
      </div>
      {visible && (
        <>
          {Object.entries(config).map(([key, item]) => (
            <div key={key} className="debug-row">
              {typeof item.value === 'number' ? (
                <>
                  <span>{item.label}:</span>
                  <input
                    type="range"
                    min={item.min}
                    max={item.max}
                    value={modelValue[key] ?? item.value}
                    onChange={(e) => handleInput(key, e)}
                  />
                  <span>{modelValue[key]}{item.unit || ''}</span>
                </>
              ) : typeof item.value === 'boolean' ? (
                <>
                  <span>{item.label}:</span>
                  <input
                    type="checkbox"
                    checked={modelValue[key] ?? item.value}
                    onChange={(e) => handleChange(key, e)}
                  />
                </>
              ) : null}
            </div>
          ))}
          <div className="debug-actions">
            <button onClick={copyConfig}>复制当前配置 JSON</button>
          </div>
        </>
      )}
    </div>
  )
}

export default DebugStylePanel
