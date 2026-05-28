import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './Popover.css'

export interface PopoverProps {
  visible?: boolean
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
  offset?: number
  showArrow?: boolean
  trigger?: 'click' | 'manual'
  zIndex?: number
  width?: number | string
  minWidth?: number | string
  maxWidth?: number | string
  maxHeight?: number | string
  onVisibleChange?: (visible: boolean) => void
  children?: React.ReactNode
  content?: React.ReactNode
}

export const Popover: React.FC<PopoverProps> = ({
  visible: controlledVisible,
  placement = 'bottom',
  offset = 8,
  showArrow = true,
  trigger = 'click',
  zIndex = 100050,
  width,
  minWidth,
  maxWidth,
  maxHeight,
  onVisibleChange,
  children,
  content,
}) => {
  const [internalVisible, setInternalVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const isControlled = controlledVisible !== undefined
  const isVisible = isControlled ? controlledVisible : internalVisible

  const setVisible = useCallback((value: boolean) => {
    if (!isControlled) {
      setInternalVisible(value)
    }
    onVisibleChange?.(value)
  }, [isControlled, onVisibleChange])

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current
    const popupEl = popupRef.current
    if (!triggerEl || !popupEl) return

    const triggerRect = triggerEl.getBoundingClientRect()
    const popupRect = popupEl.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let finalPlacement = placement
    if (placement === 'auto') {
      const spaceTop = triggerRect.top
      const spaceBottom = viewportHeight - triggerRect.bottom
      finalPlacement = spaceTop > spaceBottom ? 'top' : 'bottom'
    }

    let top = 0
    let left = 0

    switch (finalPlacement) {
      case 'top':
        top = triggerRect.top - popupRect.height - offset
        left = triggerRect.left + (triggerRect.width - popupRect.width) / 2
        if (left < 10) left = 10
        if (left + popupRect.width > viewportWidth - 10) {
          left = viewportWidth - popupRect.width - 10
        }
        break
      case 'bottom':
        top = triggerRect.bottom + offset
        left = triggerRect.left + (triggerRect.width - popupRect.width) / 2
        if (left < 10) left = 10
        if (left + popupRect.width > viewportWidth - 10) {
          left = viewportWidth - popupRect.width - 10
        }
        break
      case 'left':
        top = triggerRect.top + (triggerRect.height - popupRect.height) / 2
        left = triggerRect.left - popupRect.width - offset
        break
      case 'right':
        top = triggerRect.top + (triggerRect.height - popupRect.height) / 2
        left = triggerRect.right + offset
        break
    }

    setPosition({ top, left })
  }, [placement, offset])

  useEffect(() => {
    if (isVisible) {
      setTimeout(updatePosition, 0)
      const timeout = setTimeout(updatePosition, 100)
      
      const handleClickOutside = (e: MouseEvent) => {
        if (
          triggerRef.current?.contains(e.target as Node) ||
          popupRef.current?.contains(e.target as Node)
        ) {
          return
        }
        setVisible(false)
      }

      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
        clearTimeout(timeout)
      }
    }
  }, [isVisible, updatePosition, setVisible])

  const handleTriggerClick = () => {
    if (trigger !== 'click') return
    setVisible(!isVisible)
  }

  const normalizeSize = (value: number | string | undefined) => {
    if (value === undefined || value === null) return undefined
    return typeof value === 'number' ? `${value}px` : value
  }

  const popupStyle: React.CSSProperties = {
    top: `${position.top}px`,
    left: `${position.left}px`,
    zIndex,
    width: normalizeSize(width),
    minWidth: normalizeSize(minWidth),
    maxWidth: normalizeSize(maxWidth) || '280px',
    maxHeight: normalizeSize(maxHeight),
  }

  return (
    <div className="bubble-popup-wrapper">
      <div
        ref={triggerRef}
        className="bubble-popup-trigger"
        onClick={handleTriggerClick}
      >
        {children}
      </div>

      {isVisible && createPortal(
        <div
          ref={popupRef}
          className={`bubble-popup bubble-popup--${placement}`}
          style={popupStyle}
        >
          <div className="bubble-popup__content">
            {content}
          </div>
          {showArrow && (
            <div className={`bubble-popup__arrow bubble-popup__arrow--${placement}`} />
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export default Popover
