import React, { useState, useRef, useCallback } from 'react'
import '@/components/base/Fab.css'

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

  const closeMenu = useCallback(() => {
    setMenuVisible(false)
    onToggle?.(false)
  }, [onToggle])

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (toggleOnly) {
      onToggle?.(!menuVisible)
      return
    }
    const newVisible = !menuVisible
    setMenuVisible(newVisible)
    onToggle?.(newVisible)
  }, [menuVisible, onToggle, toggleOnly])

  const handleItemClick = (item: FabItem) => {
    onSelect?.(item)
    closeMenu()
  }

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsPressed(true)
    if (draggable) {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      dragStartY.current = clientY
      setIsDragging(true)
    }
  }

  const handlePressEnd = useCallback(() => {
    setIsPressed(false)
    if (draggable && isDragging) {
      setIsDragging(false)
      // 如果拖动距离很小（小于5px），视为点击，不保存位置
      if (Math.abs(dragOffsetY) < 5) {
        setDragOffsetY(0)
        return
      }
      setPersistentOffsetY(prev => prev + dragOffsetY)
      setDragOffsetY(0)
    }
  }, [draggable, isDragging, dragOffsetY])

  const handleDrag = useCallback((clientY: number) => {
    if (!isDragging || !draggable) return
    const deltaY = clientY - dragStartY.current
    const totalOffset = persistentOffsetY + deltaY
    const clampedOffset = Math.max(dragMinY, Math.min(dragMaxY, totalOffset))
    setDragOffsetY(clampedOffset - persistentOffsetY)
  }, [isDragging, draggable, persistentOffsetY, dragMinY, dragMaxY])

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDrag(e.clientY)
    const handleTouchMove = (e: TouchEvent) => handleDrag(e.touches[0].clientY)
    const handleGlobalUp = () => handlePressEnd()

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('mouseup', handleGlobalUp)
      window.addEventListener('touchend', handleGlobalUp)
    }
    
    window.addEventListener('click', handleClickOutside)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mouseup', handleGlobalUp)
      window.removeEventListener('touchend', handleGlobalUp)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [isDragging, handleDrag, handlePressEnd, closeMenu])

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
        onTouchCancel={handlePressEnd}
      >
        {children}
      </div>
    </div>
  )
}

export default Fab
