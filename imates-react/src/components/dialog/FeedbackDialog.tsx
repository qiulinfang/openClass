import React from 'react'
import { Dialog } from '../base/Dialog'
import './FeedbackDialog.css'

export interface FeedbackDialogProps {
  open?: boolean
  onClose?: () => void
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  open = false,
  onClose,
}) => {
  if (!open) return null

  return (
    <Dialog open={open} title="在线客服" onClose={onClose}>
      <div className="user-client-content">
        <div className="chat-view-container">
          <div className="placeholder-content">
            <span>在线客服聊天界面</span>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default FeedbackDialog
