import React, { useState } from 'react'
import '@/components/debug/DragDebugPanel.css'

export interface DragState {
  isDragging: boolean
  dragStartY: number
  dragOffsetY: number
  persistentOffsetY: number
}

export interface DragDebugPanelProps {
  visible?: boolean
  dragState?: DragState
  onChange?: (params: { minY: number; maxY: number; enableLimit: boolean }) => void
  onClose?: () => void
}

export const DragDebugPanel: React.FC<DragDebugPanelProps> = ({
  visible = false,
  dragState = { isDragging: false, dragStartY: 0, dragOffsetY: 0, persistentOffsetY: 0 },
  onChange,
  onClose,
}) => {
  const [local, setLocal] = useState({
    minY: -200,
    maxY: 200,
    enableLimit: true,
  })

  const commit = () => {
    onChange?.(local)
  }

  const resetPosition = () => {
    console.log('[DragDebugPanel] 重置位置')
  }

  const recordPosition = () => {
    console.log('[DragDebugPanel] 记录位置')
  }

  if (!visible) return null

  return (
    <div className="drag-debug-panel" onClick={(e) => e.stopPropagation()}>
      <div className="debug-header">
        <span className="debug-title">拖动调试面板</span>
        <button className="debug-btn" type="button" onClick={onClose}>×</button>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">拖动状态</div>
        <div className="debug-grid">
          <div className="debug-row">
            <label className="debug-label">拖动中</label>
            <span className={`debug-value ${dragState.isDragging ? 'active' : ''}`}>
              {dragState.isDragging ? '是' : '否'}
            </span>
          </div>
          <div className="debug-row">
            <label className="debug-label">起始Y</label>
            <span className="debug-value">{dragState.dragStartY}px</span>
          </div>
          <div className="debug-row">
            <label className="debug-label">当前偏移</label>
            <span className="debug-value">{dragState.dragOffsetY}px</span>
          </div>
          <div className="debug-row">
            <label className="debug-label">持久偏移</label>
            <span className="debug-value">{dragState.persistentOffsetY}px</span>
          </div>
          <div className="debug-row">
            <label className="debug-label">总偏移</label>
            <span className="debug-value">{dragState.persistentOffsetY + dragState.dragOffsetY}px</span>
          </div>
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">拖动范围限制</div>
        <div className="debug-grid">
          <div className="debug-row">
            <label className="debug-label">最小Y</label>
            <input 
              className="debug-input" 
              type="number" 
              step="10" 
              value={local.minY}
              onChange={(e) => { setLocal({ ...local, minY: Number(e.target.value) }); commit(); }}
            />
          </div>
          <div className="debug-row">
            <label className="debug-label">最大Y</label>
            <input 
              className="debug-input" 
              type="number" 
              step="10" 
              value={local.maxY}
              onChange={(e) => { setLocal({ ...local, maxY: Number(e.target.value) }); commit(); }}
            />
          </div>
        </div>
        <div className="debug-row" style={{ marginTop: 8 }}>
          <label className="debug-label">启用限制</label>
          <input 
            className="debug-checkbox" 
            type="checkbox" 
            checked={local.enableLimit}
            onChange={(e) => { setLocal({ ...local, enableLimit: e.target.checked }); commit(); }}
          />
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">操作</div>
        <div className="debug-actions">
          <button className="debug-action-btn" type="button" onClick={resetPosition}>重置位置</button>
          <button className="debug-action-btn" type="button" onClick={recordPosition}>记录当前位置</button>
        </div>
      </div>
    </div>
  )
}

export default DragDebugPanel
