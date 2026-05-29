import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/base/Button'
import '@/components/base/Modal.css'

export interface ModalProps {
  open: boolean
  title?: string
  width?: number | string
  height?: number | string
  fullscreen?: boolean
  showFooter?: boolean
  showCloseButton?: boolean
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'danger' | 'ghost'
  confirmDisabled?: boolean
  processing?: boolean
  maskClosable?: boolean
  onConfirm?: () => void
  onCancel?: () => void
  onClose?: () => void
  children?: React.ReactNode
  footer?: React.ReactNode
  headerLeft?: React.ReactNode
  headerRight?: React.ReactNode
}

export const Modal: React.FC<ModalProps> = ({
  open,
  title = '',
  width = 500,
  height,
  fullscreen = false,
  showFooter = true,
  showCloseButton = true,
  confirmText = '确定',
  cancelText = '取消',
  confirmVariant = 'primary',
  confirmDisabled = false,
  processing = false,
  maskClosable = true,
  onConfirm,
  onCancel,
  onClose,
  children,
  footer,
  headerLeft,
  headerRight,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(fullscreen)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsFullscreen(fullscreen)
  }, [fullscreen])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleClose = () => {
    onClose?.()
    onCancel?.()
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && maskClosable) {
      handleClose()
    }
  }

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (!open) return null

  const modalStyle: React.CSSProperties = {
    width: isFullscreen ? '100%' : width,
    height: isFullscreen ? '100%' : height,
  }

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog-container" ref={modalRef} style={modalStyle}>
        <div className="draggable-dialog-card">
          {/* 标题栏 */}
          {!isFullscreen && (
            <div className="dialog-header-section draggable-header">
              {headerLeft && <div className="header-left">{headerLeft}</div>}
              <div className="text-h6">{title}</div>
              {headerRight && <div className="header-right">{headerRight}</div>}
              {showCloseButton && (
                <button className="close-btn" onClick={handleClose}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* 全屏模式顶部按钮 */}
          {isFullscreen && (
            <div className="fullscreen-top-buttons">
              <button className="switcher-btn" onClick={handleToggleFullscreen}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M4 8h4V4h12v12h-4v4H4V8zm12 0v6h2V6h-8v2h6z"/>
                </svg>
              </button>
              {showCloseButton && (
                <button className="close-btn" onClick={handleClose}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* 内容区域 */}
          <div className={`dialog-content-section ${isFullscreen ? 'dialog-content-rounded' : ''}`}>
            {children}
          </div>

          {/* 底部按钮 */}
          {showFooter && (
            <div className="dialog-footer-section">
              {footer || (
                <>
                  <Button
                    label={cancelText}
                    size="mdCompact"
                    variant="ghost"
                    onClick={handleClose}
                  />
                  <Button
                    label={confirmText}
                    size="mdCompact"
                    variant={confirmVariant}
                    disabled={confirmDisabled || processing}
                    onClick={onConfirm}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Modal
