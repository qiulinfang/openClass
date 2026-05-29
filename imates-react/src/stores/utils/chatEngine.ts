import type { BackendHistoryMessage, ChatBubble } from '../../types'
import { alignTailMessageIdsFromHistory, buildHistorySignature } from './historySyncUtils'

export interface ChatEngineOptions {
  getMessages: () => ChatBubble[]
  lastHistorySignature: string
  setMessages: (messages: ChatBubble[]) => void
  setLastHistorySignature: (signature: string) => void
  onAfterHistorySync?: () => void | Promise<void>
}

export interface SendChatCallbacks {
  onComplete: (finalResponse: any) => void | Promise<void>
  onStream: (chunk: string, isComplete: boolean) => void
  onHistoryUpdate: (history: BackendHistoryMessage[], agentStatus?: string) => void
}

/**
 * ChatEngine 逻辑封装（Zustand 版本）
 * 提供处理 SSE 回调的通用逻辑
 */
export const createChatEngine = (options: ChatEngineOptions) => {
  const { 
    getMessages, 
    lastHistorySignature, 
    setMessages, 
    setLastHistorySignature,
    onAfterHistorySync 
  } = options

  const applyHistoryUpdate = async (history: BackendHistoryMessage[]) => {
    if (!history || history.length === 0) return
    const signature = buildHistorySignature(history)
    if (signature && signature === lastHistorySignature) return
    
    setLastHistorySignature(signature)

    const updatedMessages = [...getMessages()]
    alignTailMessageIdsFromHistory(updatedMessages, history)
    setMessages(updatedMessages)

    if (onAfterHistorySync) {
      await onAfterHistorySync()
    }
  }

  const createSendChatCallbacks = (
    tempReplyId: string,
    tempReply: ChatBubble,
  ): SendChatCallbacks => {
    let accumulatedContent = ''

    const onComplete = async (finalResponse: any) => {
      const currentMessages = getMessages()
      const index = currentMessages.findIndex((m) => m.id === tempReplyId)
      if (index >= 0) {
        const old = currentMessages[index]
        const finalContent = finalResponse?.reply || accumulatedContent
        const displayContent = finalContent || '回复失败'

        // 检测内容类型并自动设置 messageType
        let messageType = old.messageType || 'text'
        let imageData = old.imageData

        if (displayContent.includes('kelvin-cosin.cloud') && displayContent.includes('.html')) {
          messageType = 'html'
        } else if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(displayContent.trim())) {
          messageType = 'image'
          imageData = {
            base64DataUrl: displayContent.trim(),
            width: 0,
            height: 0,
            fileSize: 0,
            filePath: '',
          }
        }

        const nextMessage: ChatBubble = {
          ...tempReply,
          messageType,
          imageData,
          content: displayContent,
          isStreaming: false,
          messageId: finalResponse?.messageId,
          selectedModel: old.selectedModel || tempReply.selectedModel,
          originalDstUrl: old.originalDstUrl,
        }

        const updated = [...currentMessages]
        updated[index] = nextMessage
        setMessages(updated)
      }
    }

    const onStream = (chunk: string, isComplete: boolean) => {
      const currentMessages = getMessages()
      const index = currentMessages.findIndex((m) => m.id === tempReplyId)
      if (index < 0) return

      if (isComplete) {
        const updated = [...currentMessages]
        updated[index] = {
          ...updated[index],
          isStreaming: false,
        }
        setMessages(updated)
        return
      }

      accumulatedContent += chunk

      let messageType = currentMessages[index].messageType
      let imageData = currentMessages[index].imageData

      if (accumulatedContent.includes('kelvin-cosin.cloud') && accumulatedContent.includes('.html')) {
        messageType = 'html'
      } else if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i.test(accumulatedContent.trim())) {
        messageType = 'image'
        imageData = {
          base64DataUrl: accumulatedContent.trim(),
          width: 0,
          height: 0,
          fileSize: 0,
          filePath: '',
        }
      }

      const updated = [...currentMessages]
      updated[index] = {
        ...updated[index],
        content: accumulatedContent,
        isStreaming: true,
        messageType,
        imageData,
      }
      setMessages(updated)
    }

    const onHistoryUpdate = (history: BackendHistoryMessage[]) => {
      applyHistoryUpdate(history).catch(() => {})
    }

    return { onComplete, onStream, onHistoryUpdate }
  }

  return {
    createSendChatCallbacks,
    applyHistoryUpdate
  }
}
