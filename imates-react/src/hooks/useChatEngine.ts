import { useState, useCallback, useMemo } from 'react'
import type { BackendHistoryMessage, ChatBubble } from '@/types'
import { alignTailMessageIdsFromHistory, buildHistorySignature } from '@/stores/utils/historySyncUtils'

export interface UseChatEngineOptions {
  onAfterHistorySync?: () => void | Promise<void>
  initialMessages?: ChatBubble[]
  initialLastHistorySignature?: string
}

export interface SendChatCoreCallbacks {
  onComplete?: (finalResponse: any) => void | Promise<void>
  onStream?: (chunk: string, isComplete: boolean) => void
  onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
}

export function useChatEngine(options: UseChatEngineOptions = {}) {
  const [messages, setMessages] = useState<ChatBubble[]>(options.initialMessages || [])
  const [lastHistorySignature, setLastHistorySignature] = useState<string>(options.initialLastHistorySignature || '')

  const applyHistoryUpdate = useCallback(async (history: BackendHistoryMessage[]) => {
    if (!history || history.length === 0) return
    const signature = buildHistorySignature(history)
    if (signature && signature === lastHistorySignature) return
    setLastHistorySignature(signature)

    setMessages((prev) => {
      const next = [...prev]
      alignTailMessageIdsFromHistory(next, history)
      return next
    })

    if (options.onAfterHistorySync) {
      await options.onAfterHistorySync()
    }
  }, [lastHistorySignature, options])

  /**
   * 构建一组可直接传给 apiService.sendChatMessage 的回调
   * @param tempReplyId 前端临时气泡 id（用于 findIndex 定位）
   * @param tempReply  临时气泡初始对象（用于兜底覆盖）
   */
  const createSendChatCallbacks = useCallback((
    tempReplyId: string,
    tempReply: ChatBubble,
  ): SendChatCoreCallbacks => {
    let accumulatedContent = ''

    const onComplete = async (finalResponse: any) => {
      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === tempReplyId)
        if (index < 0) return prev

        const old = prev[index]
        const finalContent = finalResponse?.reply || accumulatedContent
        const displayContent = finalContent || '回复失败'

        // 检测内容类型并自动设置 messageType
        let messageType = old.messageType
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

        const next = [...prev]
        next[index] = nextMessage
        return next
      })
    }

    const onStream = (chunk: string, isComplete: boolean) => {
      if (isComplete) {
        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === tempReplyId)
          if (index < 0) return prev
          const next = [...prev]
          next[index] = {
            ...next[index],
            isStreaming: false,
          }
          return next
        })
        return
      }

      accumulatedContent += chunk

      setMessages((prev) => {
        const index = prev.findIndex((m) => m.id === tempReplyId)
        if (index < 0) return prev

        let messageType = prev[index].messageType
        let imageData = prev[index].imageData

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

        const next = [...prev]
        next[index] = {
          ...next[index],
          content: accumulatedContent,
          isStreaming: true,
          messageType,
          imageData,
        }
        return next
      })
    }

    const onHistoryUpdate = (history: BackendHistoryMessage[], agentStatus?: string) => {
      // 只处理历史消息同步，messageType 设置由 onComplete 统一处理
      applyHistoryUpdate(history).catch(() => {
        // ignore
      })
    }

    return { onComplete, onStream, onHistoryUpdate }
  }, [applyHistoryUpdate])

  return {
    messages,
    setMessages,
    lastHistorySignature,
    setLastHistorySignature,
    applyHistoryUpdate,
    createSendChatCallbacks,
  }
}
