import React, { useState, useRef, useCallback } from 'react'
import './Fab.css'

export interface FabItem {
  label: string
  icon: string
}

export interface FabProps {
  items?: FabItem[]
  toggleOnly?: boolean
  draggable?: boolean
  dragMinY?: number
  dragMaxY?: number
  onSelect?: (item: FabItem) => void
  onToggle?: (open: boolean) => void
  children?: React.ReactNode
}

export const Fab: React.FC<FabProps> = ({
  items = [],
  toggleOnly = false,
  draggable = true,
  dragMinY = -300,
  dragMaxY = 300,
  onSelect,
  onToggle,
  children,
}) => {
  const [menuVisible, setMenuVisible] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [persistentOffsetY, setPersistentOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)

  const isSingleItem = items.length === 1

  const toggleMenu = useCallback(() => {
    const newVisible = !menuVisible
    setMenuVisible(newVisible)
    onToggle?.(newVisible)
  }, [menuVisible, onToggle])

  const handleItemClick = (item: FabItem) => {
    onSelect?.(item)
    setMenuVisible(false)
  }

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsPressed(true)
    if (draggable) {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      dragStartY.current = clientY
      setIsDragging(true)
    }
  }

  const handlePressEnd = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    setIsPressed(false)
    
    if (draggable && isDragging) {
      setIsDragging(false)
      setPersistentOffsetY(prev => {
        const newOffset = prev + dragOffsetY
        return Math.min(dragMaxY, Math.max(dragMinY, newOffset))
      })
      setDragOffsetY(0)
    }
  }, [draggable, isDragging, dragOffsetY, dragMinY, dragMaxY])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggable && isDragging) {
      const deltaY = e.clientY - dragStartY.current
      setDragOffsetY(deltaY)
    }
  }, [draggable, isDragging])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      setPersistentOffsetY(prev => {
        const newOffset = prev + dragOffsetY
        return Math.min(dragMaxY, Math.max(dragMinY, newOffset))
      })
      setDragOffsetY(0)
    }
  }, [isDragging, dragOffsetY, dragMinY, dragMaxY])

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div className="bubble-container" ref={containerRef}>
      {/* 气泡菜单 */}
      {menuVisible && (
        isSingleItem ? (
          <div 
            className="bubble-menu-single"
            onClick={() => handleItemClick(items[0])}
          >
            <img src={items[0].icon} className="single-icon" alt="" />
            <span className="single-label">{items[0].label}</span>
          </div>
        ) : (
          <div className="bubble-menu">
            {items.map((item, index) => (
              <div 
                key={index} 
                className="menu-item"
                onClick={() => handleItemClick(item)}
              >
                <img src={item.icon} className="icon-image" alt="" />
              </div>
            ))}
          </div>
        )
      )}

      {/* 触发器 */}
      <div
        className={`trigger-wrapper ${isPressed ? 'pressed' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{ transform: `translateY(${persistentOffsetY + dragOffsetY}px)` }}
        onClick={toggleMenu}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        {children}
      </div>
    </div>
  )
}

export default Fab
