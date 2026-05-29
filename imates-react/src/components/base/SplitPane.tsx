import React, { useState, useRef, useCallback, useEffect } from 'react'
import '@/components/base/SplitPane.css'

export interface SplitPaneProps {
  value?: boolean
  defaultOffset?: number
  minOffset?: number
  maxOffset?: number
  onChange?: (value: boolean) => void
  left?: React.ReactNode
  right?: React.ReactNode
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  value = true,
  defaultOffset = 65,
  minOffset = 30,
  maxOffset = 65,
  onChange,
  left,
  right,
}) => {
  const [isRightVisible, setIsRightVisible] = useState(value)
  const [offset, setOffset] = useState(defaultOffset)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsRightVisible(value)
  }, [value])

  const leftPaneStyle: React.CSSProperties = {
    width: isRightVisible ? `${offset}%` : '100%',
    transition: isDragging ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  }

  const rightPaneStyle: React.CSSProperties = {
    width: isRightVisible ? `${100 - offset}%` : '0%',
    transition: isDragging ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: isRightVisible ? 1 : 0,
    pointerEvents: isRightVisible ? 'auto' : 'none',
  }

  const startDragging = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (clientX: number, containerWidth: number) => {
      const newOffset = (clientX / containerWidth) * 100
      const clampedOffset = Math.min(Math.max(newOffset, minOffset), maxOffset)
      setOffset(clampedOffset)
    }

    const onMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        handleMove(e.clientX - rect.left, rect.width)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const container = containerRef.current
      if (container && e.touches[0]) {
        const rect = container.getBoundingClientRect()
        handleMove(e.touches[0].clientX - rect.left, rect.width)
      }
    }

    const onEnd = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onEnd)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [isDragging, minOffset, maxOffset])

  return (
    <div className="app-container">
      <main className="main-wrapper">
        <div className="split-pane-root">
          <div ref={containerRef} className="split-pane-container">
            <div className={`pane-left ${isDragging ? 'dragging' : ''}`} style={leftPaneStyle}>
              {left || <div className="placeholder-text">左侧区域插槽内容</div>}
            </div>

            <div className={`pane-right ${!isRightVisible ? 'is-hidden' : ''}`} style={rightPaneStyle}>
              <div className="pane-content-wrapper">
                {right || <div className="placeholder-text">右侧区域插槽内容</div>}
              </div>

              <div
                className="resizer"
                onMouseDown={startDragging}
                onTouchStart={startDragging}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="splitter-handle">
                  <circle cx="8" cy="12" r="2"/>
                  <circle cx="16" cy="12" r="2"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default SplitPane
