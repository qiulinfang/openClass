import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import '@/components/base/Slider.css'

export interface SliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  showLabelAlways?: boolean
  showLabel?: boolean
  onChange?: (value: number) => void
  onUpdate?: (value: number) => void
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  showLabelAlways = true,
  showLabel = false,
  onChange,
  onUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const percent = useMemo(() => {
    const range = max - min
    if (range === 0) return 0
    const p = ((value - min) / range) * 100
    return Math.min(100, Math.max(0, p))
  }, [value, min, max])

  const displayValue = useMemo(() => {
    if (step >= 1) {
      return Math.round(value)
    }
    const precision = step.toString().split('.')[1]?.length || 0
    return Number(value.toFixed(precision))
  }, [value, step])

  const calculateValue = useCallback((clientX: number) => {
    if (!containerRef.current) return min

    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width
    const left = rect.left

    let ratio = (clientX - left) / width
    ratio = Math.min(1, Math.max(0, ratio))

    const rawValue = min + ratio * (max - min)
    const steps = Math.round((rawValue - min) / step)
    let steppedValue = min + steps * step

    const precision = step.toString().split('.')[1]?.length || 0
    if (precision > 0) {
      steppedValue = parseFloat(steppedValue.toFixed(precision))
    }

    return Math.min(max, Math.max(min, steppedValue))
  }, [min, max, step])

  const updateValue = useCallback((clientX: number) => {
    const newValue = calculateValue(clientX)
    onUpdate?.(newValue)
  }, [calculateValue, onUpdate])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    updateValue(e.clientX)

    const onMouseMove = (moveEvent: MouseEvent) => {
      updateValue(moveEvent.clientX)
    }

    const onMouseUp = () => {
      setDragging(false)
      onChange?.(value)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragging(true)
    updateValue(e.touches[0].clientX)

    const onTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault()
      updateValue(moveEvent.touches[0].clientX)
    }

    const onTouchEnd = () => {
      setDragging(false)
      onChange?.(value)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }

    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', () => {})
      window.removeEventListener('mouseup', () => {})
      window.removeEventListener('touchmove', () => {})
      window.removeEventListener('touchend', () => {})
    }
  }, [])

  return (
    <div
      className="purple-slider-container"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="slider-track-bg"></div>
      <div className="slider-track-fill" style={{ width: `${percent}%` }}></div>
      <div className="slider-thumb" style={{ left: `${percent}%` }}>
        {showLabel && (dragging || showLabelAlways) && (
          <div className="slider-label">{displayValue}</div>
        )}
      </div>
    </div>
  )
}

export default Slider
