import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react'
import seekbarIcon from '/icons/seekbar.svg'
import '@/components/base/SplitPanel.css'

export interface SplitPanelProps {
  mode?: 'left' | 'right'
  initialMode?: 'left' | 'right'
  /** 左侧面板配置: [默认%, 最小%, 最大%] */
  leftConfig?: [number, number, number]
  /** 中间面板配置: [默认%, 最小%, 最大%] */
  centerConfig?: [number, number, number]
  /** 右侧面板配置: [默认%, 最小%, 最大%] */
  rightConfig?: [number, number, number]
  showSplitters?: boolean
  splitterClass?: string
  transitionDuration?: number
  transitionEasing?: string
  disabled?: boolean
  onModeChange?: (mode: 'left' | 'right') => void
  onToggle?: (mode: 'left' | 'right') => void
  onResize?: (width: number) => void
  left?: (props: { width: number; percent: number; isVisible: boolean }) => React.ReactNode
  center?: (props: { width: number; percent: number }) => React.ReactNode
  right?: (props: { width: number; percent: number; isVisible: boolean }) => React.ReactNode
}

export const SplitPanel = forwardRef<any, SplitPanelProps>((props, ref) => {
  const {
    mode: controlledMode,
    initialMode = 'left',
    leftConfig = [30, 30, 50],
    centerConfig = [70, 65, 70],
    rightConfig = [40, 35, 50],
    showSplitters = true,
    splitterClass = '',
    transitionDuration = 0.5,
    transitionEasing = 'cubic-bezier(0.3, 0.9, 0.4, 1.05)',
    disabled = false,
    onModeChange,
    onToggle,
    onResize,
    left,
    center,
    right,
  } = props

  const [internalMode, setInternalMode] = useState<'left' | 'right'>(initialMode)
  const mode = controlledMode !== undefined ? controlledMode : internalMode

  const [containerWidth, setContainerWidth] = useState(0)
  const [p1, setP1] = useState(leftConfig[0])
  const [p2, setP2] = useState(centerConfig[0])
  const [p3, setP3] = useState(rightConfig[0])
  const [isLocked, setIsLocked] = useState(false)

  // 用于触发重绘的拖拽状态
  const [dragState, setDragState] = useState({
    isDragging: false,
    splitterIndex: null as number | null,
  })

  // 核心拖拽数据，使用 ref 避免闭包陷阱
  const dragInfo = useRef({
    isDragging: false,
    splitterIndex: null as number | null,
    startX: 0,
    startP1: 0,
    startP2: 0,
    containerWidth: 0,
  })

  const workspaceRef = useRef<HTMLDivElement>(null)
  const dragFrameId = useRef<number | null>(null)
  const activePointerId = useRef<number | null>(null)
  const activeDragElement = useRef<Element | null>(null)

  const w1Px = (p1 / 100) * containerWidth
  const w2Px = (p2 / 100) * containerWidth
  const w3Px = (p3 / 100) * containerWidth

  const offsetX = mode === 'left' ? 0 : -w1Px

  useEffect(() => {
    if (!workspaceRef.current) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width
      if (Math.abs(width - containerWidth) > 0.1) {
        setContainerWidth(width)
        onResize?.(width)
      }
    })
    observer.observe(workspaceRef.current)
    return () => observer.disconnect()
  }, [containerWidth, onResize])

  const handleToggle = useCallback(() => {
    if (isLocked || disabled) return

    setIsLocked(true)
    setTimeout(() => {
      setIsLocked(false)
    }, transitionDuration * 1000)

    const nextMode = mode === 'left' ? 'right' : 'left'
    if (nextMode === 'right') {
      const targetRight = rightConfig[0]
      setP3(targetRight)
      setP2(100 - targetRight)
    } else {
      const targetLeft = leftConfig[0]
      setP1(targetLeft)
      setP2(100 - targetLeft)
    }

    if (controlledMode === undefined) setInternalMode(nextMode)
    onToggle?.(nextMode)
    onModeChange?.(nextMode)
  }, [isLocked, disabled, mode, rightConfig, leftConfig, controlledMode, onToggle, onModeChange, transitionDuration])

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragInfo.current.isDragging) return
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return

    const clientX = e.clientX
    if (dragFrameId.current !== null) cancelAnimationFrame(dragFrameId.current)

    dragFrameId.current = requestAnimationFrame(() => {
      dragFrameId.current = null
      const { isDragging, splitterIndex, startX, startP1, startP2, containerWidth: cw } = dragInfo.current
      if (!isDragging || !cw) return

      const deltaX = clientX - startX
      const deltaP = (deltaX / cw) * 100

      if (splitterIndex === 1) {
        const leftMax = Math.min(leftConfig[2], 100 - centerConfig[1])
        const newP1 = Math.max(leftConfig[1], Math.min(startP1 + deltaP, leftMax))
        setP1(newP1)
        const newP2 = 100 - newP1
        setP2(newP2)
        setP3(100 - newP2)
      } else if (splitterIndex === 2) {
        const centerMax = Math.min(centerConfig[2], 100 - rightConfig[1])
        const newP2 = Math.max(centerConfig[1], Math.min(startP2 + deltaP, centerMax))
        setP2(newP2)
        const newP3 = 100 - newP2
        setP3(newP3)
        setP1(newP3)
      }
    })
  }, [leftConfig, centerConfig, rightConfig])

  const onPointerUp = useCallback((e?: PointerEvent) => {
    if (dragFrameId.current !== null) {
      cancelAnimationFrame(dragFrameId.current)
      dragFrameId.current = null
    }

    if (e && activeDragElement.current && activePointerId.current !== null) {
      try {
        activeDragElement.current.releasePointerCapture(activePointerId.current)
      } catch {}
    }

    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)

    activePointerId.current = null
    activeDragElement.current = null
    dragInfo.current.isDragging = false
    setDragState({ isDragging: false, splitterIndex: null })
  }, [onPointerMove])

  const startDrag = (e: React.PointerEvent, index: number) => {
    if (isLocked || !showSplitters || disabled) return
    
    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget as Element
    target.setPointerCapture(e.pointerId)
    activePointerId.current = e.pointerId
    activeDragElement.current = target

    dragInfo.current = {
      isDragging: true,
      splitterIndex: index,
      startX: e.clientX,
      startP1: p1,
      startP2: p2,
      containerWidth: containerWidth,
    }

    setDragState({ isDragging: true, splitterIndex: index })

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  // 组件卸载时清理监听器
  useEffect(() => {
    const move = onPointerMove
    const up = onPointerUp
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (dragFrameId.current !== null) cancelAnimationFrame(dragFrameId.current)
    }
  }, [onPointerMove, onPointerUp])

  useImperativeHandle(ref, () => ({
    toggle: handleToggle,
    setMode: (newMode: 'left' | 'right') => {
      if (newMode === mode) return
      handleToggle()
    },
    getMode: () => mode,
    getWidths: () => ({
      left: w1Px,
      center: w2Px,
      right: w3Px
    })
  }))

  const transitionStyle: React.CSSProperties = {
    transform: `translateX(${offsetX}px)`,
    transition: dragState.isDragging ? 'none' : `transform ${transitionDuration}s ${transitionEasing}`,
    pointerEvents: isLocked ? 'none' : 'auto',
  }

  return (
    <div className="split-panel-container">
      <div ref={workspaceRef} className="split-panel-workspace">
        {containerWidth > 0 && (
          <div className="split-panel-track" style={transitionStyle}>
            <div
              style={{ width: w1Px }}
              className={`split-panel-col col-1 ${dragState.isDragging ? 'no-transition' : ''}`}
            >
              <div className="split-panel-col-body">
                {left?.({ width: w1Px, percent: p1, isVisible: mode === 'left' })}
              </div>
            </div>

            <div
              className={`split-panel-splitter ${mode === 'right' || !showSplitters ? 'splitter-hidden' : ''} ${dragState.isDragging ? 'no-transition' : ''} ${splitterClass}`}
              style={{ left: w1Px }}
              onPointerDown={(e) => startDrag(e, 1)}
            >
              <img src={seekbarIcon} alt="拖动" className="splitter-handle" />
            </div>

            <div
              style={{ width: w2Px }}
              className={`split-panel-col col-2 ${dragState.isDragging ? 'no-transition' : ''}`}
            >
              <div className="split-panel-col-body">
                {center?.({ width: w2Px, percent: p2 })}
              </div>
            </div>

            <div
              className={`split-panel-splitter ${mode === 'left' || !showSplitters ? 'splitter-hidden' : ''} ${dragState.isDragging ? 'no-transition' : ''} ${splitterClass}`}
              style={{ left: w1Px + w2Px }}
              onPointerDown={(e) => startDrag(e, 2)}
            >
              <img src={seekbarIcon} alt="拖动" className="splitter-handle" />
            </div>

            <div
              style={{ width: w3Px }}
              className={`split-panel-col col-3 ${dragState.isDragging ? 'no-transition' : ''}`}
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
})

export default SplitPanel
