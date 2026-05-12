import { ref } from 'vue'
import type { Ref } from 'vue'
import type { BackendHistoryMessage, ChatBubble } from '@/types'
import { alignTailMessageIdsFromHistory, buildHistorySignature } from '@/stores/utils/historySyncUtils'

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
   * 构建一组可直接传给 apiService.sendChatMessage 的回调
   * @param tempReplyId 前端临时气泡 id（用于 findIndex 定位）
   * @param tempReply  临时气泡初始对象（用于兜底覆盖）
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

        // 检测 HTML 内容并自动设置 messageType
        let messageType = old.messageType
        if (displayContent.includes('kelvin-cosin.cloud') && displayContent.includes('.html')) {
          messageType = 'html'
        }

        const nextMessage: ChatBubble = {
          ...tempReply,
          messageType,
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
      messages.value[index] = {
        ...messages.value[index],
        content: accumulatedContent,
        isStreaming: true,
      }
    }

    const onHistoryUpdate = (history: BackendHistoryMessage[], agentStatus?: string) => {
      // 只处理历史消息同步，messageType 设置由 onComplete 统一处理
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
