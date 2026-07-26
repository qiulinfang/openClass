import type { Ref } from 'vue'
import type { ChatBubble } from '@/types/chat'

export interface UseChatRetryOptions {
  maxRetries?: number
}

export interface RetryContext {
  messages: Ref<ChatBubble[]>
  deleteMessage: (messageId: string) => Promise<void>
}

export interface RetryInfo {
  index: number
  message: ChatBubble
  retryCount: number
  originalContent: string
  quotedMessage?: ChatBubble['quotedMessage']
}

export function useChatRetry(options: UseChatRetryOptions = {}) {
  const maxRetries = options.maxRetries ?? 3

  const prepareRetryInfo = (messages: Ref<ChatBubble[]>, messageId: string): RetryInfo => {
    const index = messages.value.findIndex((m) => m.id === messageId)
    if (index < 0) {
      throw new Error('消息不存在')
    }

    const message = messages.value[index]
    if (!message.canRetry || !message.originalMessage) {
      throw new Error('该消息不支持重发')
    }

    const retryCount = message.retryCount || 0
    if (retryCount >= maxRetries) {
      throw new Error('已达到最大重试次数')
    }

    return {
      index,
      message,
      retryCount,
      originalContent: message.originalMessage,
      quotedMessage: message.quotedMessage,
    }
  }

  const retryByDeleteAndResend = async (params: {
    ctx: RetryContext
    messageId: string
    resend: (payload: {
      originalContent: string
      quotedMessage?: ChatBubble['quotedMessage']
      selectedModel?: string
    }) => Promise<void>
    selectedModel?: string
  }): Promise<void> => {
    const { ctx, messageId, resend, selectedModel } = params

    const index = ctx.messages.value.findIndex((m) => m.id === messageId)
    if (index < 0) {
      throw new Error('消息不存在')
    }

    const message = ctx.messages.value[index]
    if (!message.canRetry || !message.originalMessage) {
      throw new Error('该消息不支持重发')
    }

    const retryCount = message.retryCount || 0
    if (retryCount >= maxRetries) {
      throw new Error('已达到最大重试次数')
    }

    const originalContent = message.originalMessage
    const originalQuotedMessage = message.quotedMessage

    try {
      await ctx.deleteMessage(messageId)
    } catch {
      // ignore delete error
    }

    await resend({
      originalContent,
      quotedMessage: originalQuotedMessage,
      selectedModel,
    })
  }

  return {
    retryByDeleteAndResend,
    prepareRetryInfo,
    maxRetries,
  }
}
