import React, { useState } from 'react'
import { Dialog } from '@/components/base/Dialog'
import '@/components/chat/ForwardModeDialog.css'

export interface ForwardModeDialogProps {
  open?: boolean
  messageCount?: number
  onConfirm?: (mode: 'merge' | 'separate') => void
  onCancel?: () => void
}

export const ForwardModeDialog: React.FC<ForwardModeDialogProps> = ({
  open = false,
  messageCount = 0,
  onConfirm,
  onCancel,
}) => {
  const [selectedMode, setSelectedMode] = useState<'merge' | 'separate'>('merge')

  const handleConfirm = () => {
    onConfirm?.(selectedMode)
  }

  return (
    <Dialog open={open} title="选择转发方式" onClose={onCancel}>
      <div className="forward-mode-dialog">
        <div className="dialog-header">
          <div className="header-content">
            <div className="dialog-subtitle">
              已选择 {messageCount} 条消息
            </div>
          </div>
        </div>

        <div className="options-section">
          <div className="options-container">
            <div 
              className={`option-card ${selectedMode === 'merge' ? 'option-selected' : ''}`}
              onClick={() => setSelectedMode('merge')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedMode('merge')}
            >
              <div className="option-content">
                <div className="option-text">
                  <div className="option-title">合并转发</div>
                </div>
                <div className="option-check">
                  {selectedMode === 'merge' && (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#6e55ff">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>

            <div 
              className={`option-card ${selectedMode === 'separate' ? 'option-selected' : ''}`}
              onClick={() => setSelectedMode('separate')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedMode('separate')}
            >
              <div className="option-content">
                <div className="option-text">
                  <div className="option-title">逐条转发</div>
                </div>
                <div className="option-check">
                  {selectedMode === 'separate' && (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="#6e55ff">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dialog-actions">
          <button className="btn-cancel" onClick={onCancel}>取消</button>
          <button className="btn-confirm" onClick={handleConfirm}>确定</button>
        </div>
      </div>
    </Dialog>
  )
}

export default ForwardModeDialog
