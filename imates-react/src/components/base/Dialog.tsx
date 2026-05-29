import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/base/Button'
import '@/components/base/Dialog.css'

export interface DialogProps {
  open: boolean
  title?: string
  confirmButtonText?: string
  cancelButtonText?: string
  onConfirm?: () => void
  onCancel?: () => void
  onClose?: () => void
  children?: React.ReactNode
}

export const Dialog = forwardRef<any, DialogProps>((props, ref) => {
  const {
    open,
    title = '操作确认',
    confirmButtonText = '确认执行',
    cancelButtonText = '取消',
    onConfirm,
    onCancel,
    onClose,
    children,
  } = props

  const dialogRef = useRef<HTMLDialogElement>(null)

  useImperativeHandle(ref, () => ({
    openDialog: () => {
      dialogRef.current?.showModal()
    },
    closeDialog: () => {
      dialogRef.current?.close()
    }
  }))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  const handleClose = () => {
    onClose?.()
    onCancel?.()
  }

  const handleConfirm = () => {
    onConfirm?.()
    onClose?.()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      handleClose()
    }
  }

  if (!open) return null

  return (
    <dialog 
      ref={dialogRef} 
      className="dialog"
      onClick={handleBackdropClick}
    >
      <div className="dialog-inner-content">
        <div className="dialog-header">
          <span className="dialog-title">{title}</span>
          <button onClick={handleClose} className="dialog-close-top" aria-label="关闭">
            <svg className="icon-close" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="dialog-content-text">{children}</p>

        <div className="dialog-actions">
          <Button
            label={cancelButtonText}
            size="mdCompact"
            variant="ghost"
            onClick={handleClose}
          />
          <Button
            label={confirmButtonText}
            size="mdCompact"
            variant="primary"
            onClick={handleConfirm}
          />
        </div>
      </div>
    </dialog>
  )
})

export default Dialog
