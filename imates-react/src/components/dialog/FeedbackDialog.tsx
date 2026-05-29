import React, { useEffect } from 'react'
import { Modal } from '@/components/base/Modal'
import ChatView from '@/components/ChatView'
import { useUserClientChatStore } from '@/stores/userClientChatStore'
import { showMessage } from '@/utils'
import '@/components/dialog/FeedbackDialog.css'

export interface FeedbackDialogProps {
  open?: boolean
  onClose?: () => void
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  open = false,
  onClose,
}) => {
  const store = useUserClientChatStore()

  useEffect(() => {
    store.setDialogOpen(open)

    if (open) {
      const initializeClient = async () => {
        try {
          if (!store.isConnected) {
            console.log('[用户端] WebSocket未连接，开始自动连接...')
            const connectResult = await store.connect()
            if (!connectResult) {
              showMessage('连接客服失败，请稍后重试', 'error')
              return
            }
            console.log('[用户端] WebSocket连接成功')
          }

          await store.loadChatHistory()
          store.markAllAIMessagesAsRead()
          store.sendReadStatusToAgent()
        } catch (error) {
          console.error('[用户端] 初始化失败', error)
          const errorMessage = error instanceof Error ? error.message : '未知错误'
          showMessage('初始化失败: ' + errorMessage, 'error')
        }
      }

      initializeClient()
    }
  }, [open, store])

  return (
    <Modal
      open={open}
      title="在线客服"
      initialWidth={900}
      initialHeight={750}
      minWidth={700}
      minHeight={600}
      titleAlign="center"
      headerBackgroundColor="#f8f9fa"
      className="user-client-dialog"
      onClose={onClose}
    >
      <div className="user-client-content">
        <div className="chat-view-container">
          <ChatView
            type="user-client"
            compressedHeight={305}
            inputMode="full"
            showFooterText={false}
            showToolbar={false}
            showActionButtons={false}
            enableLongPress={false}
            showReadStatus={true}
            showTime={true}
          />
        </div>
      </div>
    </Modal>
  )
}

export default FeedbackDialog
