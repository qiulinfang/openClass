import React, { useState } from 'react'
import { Dialog } from '@/components/base/Dialog'
import '@/components/debug/PerfectFreehandConfigDialog.css'

export interface PerfectFreehandConfigDialogProps {
  open?: boolean
  config?: {
    size?: number
    thinning?: number
    smoothing?: number
    streamline?: number
    easing?: string
    start?: { taper?: number; cap?: boolean }
    end?: { taper?: number; cap?: boolean }
  }
  onConfirm?: () => void
  onCancel?: () => void
  onChange?: (config: any) => void
}

export const PerfectFreehandConfigDialog: React.FC<PerfectFreehandConfigDialogProps> = ({
  open = false,
  config = {},
  onConfirm,
  onCancel,
  onChange,
}) => {
  const [preset, setPreset] = useState('custom')
  const [size, setSize] = useState(config.size || 8)
  const [thinning, setThinning] = useState(config.thinning || 0.5)
  const [smoothing, setSmoothing] = useState(config.smoothing || 0.5)
  const [streamline, setStreamline] = useState(config.streamline || 0.5)

  const presetOptions = [
    { label: '自定义', value: 'custom' },
    { label: '钢笔', value: 'pen' },
    { label: '马克笔', value: 'marker' },
    { label: '铅笔', value: 'pencil' },
  ]

  const handlePresetChange = (value: string) => {
    setPreset(value)
    const presets: Record<string, any> = {
      pen: { size: 6, thinning: 0.7, smoothing: 0.5, streamline: 0.5 },
      marker: { size: 16, thinning: 0.3, smoothing: 0.3, streamline: 0.7 },
      pencil: { size: 4, thinning: 0.5, smoothing: 0.3, streamline: 0.4 },
    }
    if (presets[value]) {
      const p = presets[value]
      setSize(p.size)
      setThinning(p.thinning)
      setSmoothing(p.smoothing)
      setStreamline(p.streamline)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} title="笔迹参数" onClose={onCancel}>
      <div className="pf-config-panel">
        <div className="pf-config-row">
          <div className="pf-config-label">
            风格
            <span className="pf-config-help" title="预设是一组参数组合">?</span>
          </div>
          <select 
            className="pf-select" 
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {presetOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="pf-config-desc">提示：选择预设会覆盖当前参数</div>
        </div>

        <div className="pf-config-row">
          <div className="pf-config-label">
            Size
            <span className="pf-config-help" title="笔迹粗细基准">?</span>
          </div>
          <input 
            type="range" 
            min={1} 
            max={40} 
            step={1}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span className="pf-value">{size}</span>
          <div className="pf-config-desc">建议：细字 2-6；常规 6-12；粗笔 12-20</div>
        </div>

        <div className="pf-config-row">
          <div className="pf-config-label">
            Thinning
            <span className="pf-config-help" title="速度/压力对线宽变化的强度">?</span>
          </div>
          <input 
            type="range" 
            min={0} 
            max={1} 
            step={0.05}
            value={thinning}
            onChange={(e) => setThinning(Number(e.target.value))}
          />
          <span className="pf-value">{thinning.toFixed(2)}</span>
          <div className="pf-config-desc">建议：想更像签字笔可调高（0.6-0.9）</div>
        </div>

        <div className="pf-config-row">
          <div className="pf-config-label">
            Smoothing
            <span className="pf-config-help" title="线条平滑程度">?</span>
          </div>
          <input 
            type="range" 
            min={0} 
            max={1} 
            step={0.05}
            value={smoothing}
            onChange={(e) => setSmoothing(Number(e.target.value))}
          />
          <span className="pf-value">{smoothing.toFixed(2)}</span>
        </div>

        <div className="pf-config-row">
          <div className="pf-config-label">
            Streamline
            <span className="pf-config-help" title="线条流畅度">?</span>
          </div>
          <input 
            type="range" 
            min={0} 
            max={1} 
            step={0.05}
            value={streamline}
            onChange={(e) => setStreamline(Number(e.target.value))}
          />
          <span className="pf-value">{streamline.toFixed(2)}</span>
        </div>

        <div className="dialog-actions">
          <button className="btn-cancel" onClick={onCancel}>取消</button>
          <button className="btn-confirm" onClick={onConfirm}>关闭</button>
        </div>
      </div>
    </Dialog>
  )
}

export default PerfectFreehandConfigDialog
