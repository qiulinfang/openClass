import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/base/Button'
import '@/components/base/Modal.css'

export interface ModalProps {
  open: boolean
  title?: string
  type?: 'delete'
  deleteContent?: string
  processing?: boolean
  processingText?: string
  initialWidth?: number
  initialHeight?: number
  width?: number | string
  height?: number | string
  minWidth?: number
  minHeight?: number
  autoSize?: boolean
  titleAlign?: 'left' | 'center'
  headerBackgroundColor?: string
  titleFontSize?: string | number
  fullscreen?: boolean
  closeOnOverlayClick?: boolean
  showFooter?: boolean
  confirmText?: string
  cancelText?: string
  confirmDisabled?: boolean
  confirmVariant?: 'primary' | 'danger' | 'ghost'
  showResizeHandle?: boolean
  zIndex?: number
  onConfirm?: () => void
  onCancel?: () => void
  onClose?: () => void
  onSplitterChange?: (value: number) => void
  onToggleFullscreen?: () => void
  children?: React.ReactNode
  footer?: React.ReactNode
  headerLeft?: React.ReactNode
  headerRight?: React.ReactNode
  headerTitleLeft?: React.ReactNode
  leftPanel?: React.ReactNode
  className?: string
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title = '',
  type,
  deleteContent = '确定要删除这条消息吗？删除后无法恢复。',
  processing = false,
  processingText = '删除中...',
  initialWidth = 800,
  initialHeight = 600,
  width,
  height,
  minWidth = 400,
  minHeight = 300,
  autoSize = false,
  titleAlign = 'center',
  headerBackgroundColor = '#fafafb',
  titleFontSize = 16,
  fullscreen = false,
  closeOnOverlayClick = true,
  showFooter = false,
  confirmText = '确定',
  cancelText = '取消',
  confirmDisabled = false,
  confirmVariant = 'primary',
  showResizeHandle = true,
  zIndex = 9000,
  onConfirm,
  onCancel,
  onClose,
  onSplitterChange,
  onToggleFullscreen,
  children,
  footer,
  headerLeft,
  headerRight,
  headerTitleLeft,
  leftPanel,
  className = '',
}) => {
  const [isFullscreen, setIsFullscreen] = useState(fullscreen)
  const [dialogPosition, setDialogPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const [dialogSize, setDialogSize] = useState({ 
    width: width !== undefined ? width : initialWidth, 
    height: height !== undefined ? height : initialHeight 
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const modalRef = useRef<HTMLDivElement>(null)

  const presetConfig = useMemo(() => {
    if (type === 'delete') {
      return {
        title: '删除确认',
        showFooter: true,
        confirmVariant: 'danger' as const,
        confirmText: '删除',
        cancelText: '取消',
        initialWidth: 360,
        initialHeight: 190,
        minWidth: 300,
        minHeight: 160,
        content: deleteContent,
      }
    }
    return null
  }, [type, deleteContent])

  const finalConfig = useMemo(() => {
    if (!presetConfig) {
      return {
        title: title || '',
        showFooter,
        confirmVariant,
        confirmText,
        cancelText,
        initialWidth,
        initialHeight,
        minWidth,
        minHeight,
      }
    }
    return {
      title: title || presetConfig.title,
      showFooter: presetConfig.showFooter,
      confirmVariant: presetConfig.confirmVariant,
      confirmText: confirmText,
      cancelText: cancelText,
      initialWidth: presetConfig.initialWidth,
      initialHeight: presetConfig.initialHeight,
      minWidth: presetConfig.minWidth,
      minHeight: presetConfig.minHeight,
    }
  }, [presetConfig, title, showFooter, confirmVariant, confirmText, cancelText, initialWidth, initialHeight, minWidth, minHeight])

  useEffect(() => {
    setIsFullscreen(fullscreen)
  }, [fullscreen])

  useEffect(() => {
    if (open) {
      setDialogSize({ width: finalConfig.initialWidth, height: finalConfig.initialHeight })
      setDialogPosition({ x: 0, y: 0 })
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open, finalConfig.initialWidth, finalConfig.initialHeight])

  const handleClose = () => {
    onClose?.()
    onCancel?.()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      handleClose()
    }
  }

  const handleToggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen()
    } else {
      setIsFullscreen(!isFullscreen)
    }
  }

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (isFullscreen) return
    setIsDragging(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragOffset.current = {
      x: clientX - dialogPosition.x,
      y: clientY - dialogPosition.y,
    }
  }

  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
    if (isFullscreen) return
    setIsResizing(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    resizeStart.current = {
      x: clientX,
      y: clientY,
      width: Number(dialogSize.width),
      height: Number(dialogSize.height),
    }
  }

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      if (isDragging) {
        setDialogPosition({
          x: clientX - dragOffset.current.x,
          y: clientY - dragOffset.current.y,
        })
      } else if (isResizing) {
        const deltaX = clientX - resizeStart.current.x
        const deltaY = clientY - resizeStart.current.y
        const newWidth = Math.max(finalConfig.minWidth, resizeStart.current.width + deltaX)
        const newHeight = Math.max(finalConfig.minHeight, resizeStart.current.height + deltaY)
        setDialogSize({
          width: Math.min(newWidth, window.innerWidth * 0.9),
          height: Math.min(newHeight, window.innerHeight * 0.9),
        })
      }
    }

    const handleUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('touchmove', handleMove)
      window.addEventListener('mouseup', handleUp)
      window.addEventListener('touchend', handleUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchend', handleUp)
    }
  }, [isDragging, isResizing, finalConfig.minWidth, finalConfig.minHeight])

  if (!open) return null

  const dialogStyle: React.CSSProperties = isFullscreen ? {
    transform: 'translate(0px, 0px)',
    width: '100vw',
    height: '100vh',
    transition: 'none',
  } : autoSize ? {
    transform: `translate(${dialogPosition.x}px, ${dialogPosition.y}px)`,
    width: 'auto',
    height: 'auto',
    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
  } : {
    transform: `translate(${dialogPosition.x}px, ${dialogPosition.y}px)`,
    width: `${dialogSize.width}px`,
    height: `${dialogSize.height}px`,
    transition: isDragging || isResizing ? 'none' : 'transform 0.1s ease-out',
  }

  const titleAlignClass = titleAlign === 'left' ? 'title-align-left' : 'title-align-center'
  const displayedConfirmLabel = processing ? (processingText || '删除中...') : finalConfig.confirmText

  return (
    <div className={`dialog-overlay ${className}`} style={{ zIndex }} onClick={handleOverlayClick}>
      <div className={`dialog-container ${isFullscreen ? 'fullscreen' : ''}`} style={dialogStyle} ref={modalRef}>
        <div className="draggable-dialog-card">
          {/* Header */}
          {!isFullscreen ? (
            <div 
              className="dialog-header-section draggable-header" 
              style={{ background: headerBackgroundColor }}
              onMouseDown={startDrag}
              onTouchStart={startDrag}
            >
              {headerLeft && <div className="header-left" onMouseDown={e => e.stopPropagation()}>{headerLeft}</div>}
              <div className={`text-h6 ${titleAlignClass} ${headerTitleLeft || headerRight ? 'has-slots' : ''}`} style={{ fontSize: titleFontSize }}>
                {finalConfig.title}
              </div>
              {headerTitleLeft && <div className="header-title-left" onMouseDown={e => e.stopPropagation()}>{headerTitleLeft}</div>}
              {headerRight && <div className="header-right" onMouseDown={e => e.stopPropagation()}>{headerRight}</div>}
              <button className="close-btn" onClick={handleClose} onMouseDown={e => e.stopPropagation()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ) : (
            <div className="fullscreen-top-buttons">
              <button className="switcher-btn" onClick={handleToggleFullscreen}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M4 8h4V4h12v12h-4v4H4V8zm12 0v6h2V6h-8v2h6z"/>
                </svg>
              </button>
              <button className="close-btn" onClick={handleClose}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}

          {/* Content Wrapper (with optional left panel split) */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {leftPanel && (
              <div className="left-panel">
                {leftPanel}
              </div>
            )}
            <div className={`dialog-content-section ${isFullscreen ? 'dialog-content-rounded' : ''}`}>
              {type === 'delete' ? (
                children || <div className="delete-confirm-content">{deleteContent}</div>
              ) : children}
            </div>
          </div>

          {/* Footer */}
          {finalConfig.showFooter && (
            <div className="dialog-footer-section">
              {footer || (
                <>
                  <Button
                    label={finalConfig.cancelText}
                    size="mdCompact"
                    variant="ghost"
                    onClick={handleClose}
                  />
                  <Button
                    label={displayedConfirmLabel}
                    size="mdCompact"
                    variant={finalConfig.confirmVariant as any}
                    disabled={confirmDisabled || processing}
                    onClick={onConfirm}
                  />
                </>
              )}
            </div>
          )}

          {/* Resize handle */}
          {showResizeHandle && type !== 'delete' && !isFullscreen && (
            <div className="resize-handle" onMouseDown={startResize} onTouchStart={startResize}></div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Modal
