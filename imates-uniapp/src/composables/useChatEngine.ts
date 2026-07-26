import { ref } from 'vue'
import type { Ref } from 'vue'
import type { BackendHistoryMessage, ChatBubble } from '@/types/chat'
import { alignTailMessageIdsFromHistory, buildHistorySignature } from '@/store/utils/historySyncUtils'

export interface UseChatEngineOptions {
  onAfterHistorySync?: () => void | Promise<void>
  messagesRef?: Ref<ChatBubble[]>
  lastHistorySignatureRef?: Ref<string>
}

export interface SendChatCoreCallbacks {
  onComplete?: (finalResponse: any) => void | Promise<void>
  onStream?: (chunk: string, isComplete: boolean) => void
  onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
}

export function useChatEngine(options: UseChatEngineOptions = {}) {
  const messages = options.messagesRef || ref<ChatBubble[]>([])
  const lastHistorySignature = options.lastHistorySignatureRef || ref<string>('')

  const applyHistoryUpdate = async (history: BackendHistoryMessage[]) => {
    if (!history || history.length === 0) return
    const signature = buildHistorySignature(history)
    if (signature && signature === lastHistorySignature.value) return
    lastHistorySignature.value = signature

    alignTailMessageIdsFromHistory(messages.value, history)

    if (options.onAfterHistorySync) {
      await options.onAfterHistorySync()
    }
  }

  /**
   * 构建一组可直接传给 AiChatApi.sendChatMessage 的回调
   */
  const createSendChatCallbacks = (
    tempReplyId: string,
    tempReply: ChatBubble,
  ): SendChatCoreCallbacks => {
    let accumulatedContent = ''

    const onComplete = async (finalResponse: any) => {
      const index = messages.value.findIndex((m) => m.id === tempReplyId)
      if (index >= 0) {
        const old = messages.value[index]
        const finalContent = finalResponse?.reply || accumulatedContent
        const displayContent = finalContent || '回复失败'

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

        messages.value[index] = nextMessage
      }
    }

    const onStream = (chunk: string, isComplete: boolean) => {
      const index = messages.value.findIndex((m) => m.id === tempReplyId)
      if (index < 0) return

      if (isComplete) {
        messages.value[index] = {
          ...messages.value[index],
          isStreaming: false,
        }
        return
      }

      accumulatedContent += chunk

      let messageType = messages.value[index].messageType
      let imageData = messages.value[index].imageData

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

      messages.value[index] = {
        ...messages.value[index],
        content: accumulatedContent,
        isStreaming: true,
        messageType,
        imageData,
      }
    }

    const onHistoryUpdate = (history: BackendHistoryMessage[], _agentStatus?: string) => {
      if (Array.isArray(history) && history.length > 0 && messages.value.length > 0) {
        const lastIndex = messages.value.length - 1
        ;(messages.value[lastIndex] as any).history_messages = history
      }
      applyHistoryUpdate(history).catch(() => {
        // ignore
      })
    }

    return { onComplete, onStream, onHistoryUpdate }
  }

  return {
    messages,
    lastHistorySignature,
    applyHistoryUpdate,
    createSendChatCallbacks,
  }
}
