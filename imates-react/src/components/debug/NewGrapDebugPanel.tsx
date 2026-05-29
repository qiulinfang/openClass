import React, { useState } from 'react'
import '@/components/debug/NewGrapDebugPanel.css'

export interface NewGrapDebugPanelProps {
  visible?: boolean
  onChange?: (params: any) => void
  onClose?: () => void
}

export const NewGrapDebugPanel: React.FC<NewGrapDebugPanelProps> = ({
  visible = false,
  onChange,
  onClose,
}) => {
  const [localParams, setLocalParams] = useState({
    orbitRadiusX: 100,
    orbitRadiusY: 60,
    orbitCenterXOffset: 50,
    orbitCenterYOffset: 0,
    focusAngle: 0,
    rotationSpeed: 0.02,
    moonRadiusBase: 20,
    moonRadiusFocusBase: 30,
    satelliteRadiusFocus: 10,
  })

  const emitChange = () => {
    onChange?.(localParams)
  }

  const updateParam = (key: string, value: number) => {
    setLocalParams(prev => ({ ...prev, [key]: value }))
    emitChange()
  }

  if (!visible) return null

  return (
    <div className="newgrap-debug-panel">
      <div className="header">
        <span>NewGrap 调试面板</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="content">
        <div className="section">
          <h4>轨道参数</h4>
          <label>
            <span className="param-name">轨道横向半径</span>
            <span className="param-desc">orbitRadiusX: 椭圆轨道的X轴半径</span>
            <input 
              type="number" 
              value={localParams.orbitRadiusX}
              onChange={(e) => updateParam('orbitRadiusX', Number(e.target.value))}
            />
          </label>
          <label>
            <span className="param-name">轨道纵向半径</span>
            <span className="param-desc">orbitRadiusY: 椭圆轨道的Y轴半径</span>
            <input 
              type="number" 
              value={localParams.orbitRadiusY}
              onChange={(e) => updateParam('orbitRadiusY', Number(e.target.value))}
            />
          </label>
          <label>
            <span className="param-name">轨道中心X偏移</span>
            <span className="param-desc">orbitCenterXOffset</span>
            <input 
              type="number" 
              value={localParams.orbitCenterXOffset}
              onChange={(e) => updateParam('orbitCenterXOffset', Number(e.target.value))}
            />
          </label>
          <label>
            <span className="param-name">轨道中心Y偏移</span>
            <span className="param-desc">orbitCenterYOffset</span>
            <input 
              type="number" 
              value={localParams.orbitCenterYOffset}
              onChange={(e) => updateParam('orbitCenterYOffset', Number(e.target.value))}
            />
          </label>
          <label>
            <span className="param-name">聚焦角度</span>
            <span className="param-desc">focusAngle</span>
            <input 
              type="number" 
              step="0.1"
              value={localParams.focusAngle}
              onChange={(e) => updateParam('focusAngle', Number(e.target.value))}
            />
          </label>
          <label>
            <span className="param-name">旋转速度</span>
            <span className="param-desc">rotationSpeed</span>
            <input 
              type="number" 
              step="0.01"
              value={localParams.rotationSpeed}
              onChange={(e) => updateParam('rotationSpeed', Number(e.target.value))}
            />
          </label>
        </div>

        <div className="section">
          <h4>月球参数</h4>
          <label>
            <span className="param-name">月球基础半径</span>
            <span className="param-desc">moonRadiusBase</span>
            <input 
              type="number" 
              value={localParams.moonRadiusBase}
              onChange={(e) => updateParam('moonRadiusBase', Number(e.target.value))}
            />
          </label>
          <label>
            <span className="param-name">月球聚焦半径</span>
            <span className="param-desc">moonRadiusFocusBase</span>
            <input 
              type="number" 
              value={localParams.moonRadiusFocusBase}
              onChange={(e) => updateParam('moonRadiusFocusBase', Number(e.target.value))}
            />
          </label>
        </div>
      </div>
    </div>
  )
}

export default NewGrapDebugPanel
