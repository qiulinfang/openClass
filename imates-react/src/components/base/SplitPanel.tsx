import React, { useState, useRef, useCallback, useEffect } from 'react'
import './SplitPanel.css'

export interface SplitPanelProps {
  initialMode?: 'left' | 'right'
  leftConfig?: [number, number, number]
  centerConfig?: [number, number, number]
  rightConfig?: [number, number, number]
  showSplitters?: boolean
  transitionDuration?: number
  transitionEasing?: string
  left?: (props: { width: number; percent: number; isVisible: boolean }) => React.ReactNode
  center?: (props: { width: number; percent: number }) => React.ReactNode
  right?: (props: { width: number; percent: number; isVisible: boolean }) => React.ReactNode
}

export const SplitPanel: React.FC<SplitPanelProps> = ({
  initialMode = 'left',
  leftConfig = [30, 20, 50],
  centerConfig = [40, 20, 60],
  rightConfig = [30, 20, 50],
  showSplitters = true,
  transitionDuration = 0.3,
  transitionEasing = 'cubic-bezier(0.4, 0, 0.2, 1)',
  left,
  center,
  right,
}) => {
  const [mode, setMode] = useState(initialMode)
  const [containerWidth, setContainerWidth] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  const workspaceRef = useRef<HTMLDivElement>(null)
  const dragTarget = useRef<number | null>(null)

  const p1 = leftConfig[0]
  const p2 = centerConfig[0]
  const p3 = rightConfig[0]

  const w1Px = Math.floor((containerWidth * p1) / 100)
  const w2Px = Math.floor((containerWidth * p2) / 100)
  const w3Px = Math.floor((containerWidth * p3) / 100)

  useEffect(() => {
    const updateWidth = () => {
      if (workspaceRef.current) {
        setContainerWidth(workspaceRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  useEffect(() => {
    if (mode === 'left') {
      setOffsetX(0)
    } else {
      setOffsetX(-w1Px - w2Px)
    }
  }, [mode, w1Px, w2Px])

  const handleDrag1 = useCallback(() => {
    setMode('left')
  }, [])

  const handleDrag2 = useCallback(() => {
    setMode('right')
  }, [])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
    setIsLocked(false)
    dragTarget.current = null
  }, [])

  const transitionStyle: React.CSSProperties = {
    transform: `translateX(${offsetX}px)`,
    transition: `transform ${transitionDuration}s ${transitionEasing}`,
    pointerEvents: isLocked ? 'none' : 'auto',
  }

  return (
    <div className="split-panel-container">
      <div ref={workspaceRef} className="split-panel-workspace" onPointerUp={handlePointerUp}>
        {containerWidth > 0 && (
          <div className="split-panel-track" style={transitionStyle}>
            <div
              style={{ width: w1Px }}
              className={`split-panel-col col-1 ${isDragging ? 'no-transition' : ''}`}
            >
              <div className="split-panel-col-body">
                {left?.({ width: w1Px, percent: p1, isVisible: mode === 'left' })}
              </div>
            </div>

            <div
              className={`split-panel-splitter ${mode === 'right' || !showSplitters ? 'splitter-hidden' : ''} ${isDragging ? 'no-transition' : ''}`}
              style={{ left: w1Px }}
              onPointerDown={handleDrag1}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="8" cy="12" r="2"/>
                <circle cx="16" cy="12" r="2"/>
              </svg>
            </div>

            <div
              style={{ width: w2Px }}
              className={`split-panel-col col-2 ${isDragging ? 'no-transition' : ''}`}
            >
              <div className="split-panel-col-body">
                {center?.({ width: w2Px, percent: p2 })}
              </div>
            </div>

            <div
              className={`split-panel-splitter ${mode === 'left' || !showSplitters ? 'splitter-hidden' : ''} ${isDragging ? 'no-transition' : ''}`}
              style={{ left: w1Px + w2Px }}
              onPointerDown={handleDrag2}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="8" cy="12" r="2"/>
                <circle cx="16" cy="12" r="2"/>
              </svg>
            </div>

            <div
              style={{ width: w3Px }}
              className={`split-panel-col col-3 ${isDragging ? 'no-transition' : ''}`}
            >
              <div className="split-panel-col-body">
                {right?.({ width: w3Px, percent: p3, isVisible: mode === 'right' })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SplitPanel
