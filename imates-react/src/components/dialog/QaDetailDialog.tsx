import React from 'react'
import { Dialog } from '@/components/base/Dialog'
import '@/components/dialog/QaDetailDialog.css'

export interface QaDetailDialogProps {
  open?: boolean
  question?: string
  answer?: string
  onClose?: () => void
}

export const QaDetailDialog: React.FC<QaDetailDialogProps> = ({
  open = false,
  question = '',
  answer = '',
  onClose,
}) => {
  if (!open) return null

  return (
    <Dialog open={open} title="问答详情" onClose={onClose}>
      <div className="qa-detail-content">
        <div className="qa-section question-section">
          <div className="section-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#1976d2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
            </svg>
            <span>问题</span>
          </div>
          <div className="section-content">{question}</div>
        </div>

        {answer ? (
          <div className="qa-section answer-section">
            <div className="section-title">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#4caf50">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>答案</span>
            </div>
            <div className="section-content">{answer}</div>
          </div>
        ) : (
          <div className="qa-empty-state">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="#999">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <div className="empty-text">暂无答案内容</div>
          </div>
        )}
      </div>
    </Dialog>
  )
}

export default QaDetailDialog
