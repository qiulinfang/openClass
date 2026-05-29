import type { ChatBubble } from '../../types'

export interface ChatRetryOptions {
  maxRetries?: number
}

export interface RetryContext {
  getMessages: () => ChatBubble[]
  setMessages: (messages: ChatBubble[]) => void
  deleteMessage: (messageId: string) => Promise<void>
}

export interface RetryInfo {
  index: number
  message: ChatBubble
  retryCount: number
  originalContent: string
  quotedMessage?: ChatBubble['quotedMessage']
}

export const createChatRetry = (options: ChatRetryOptions = {}) => {
  const maxRetries = options.maxRetries ?? 3

  const prepareRetryInfo = (getMessages: () => ChatBubble[], messageId: string): RetryInfo => {
    const messages = getMessages()
    const index = messages.findIndex((m) => m.id === messageId)
    if (index < 0) {
      throw new Error('消息不存在')
    }

    const message = messages[index]
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

    const messages = ctx.getMessages()
    const index = messages.findIndex((m) => m.id === messageId)
    if (index < 0) {
      throw new Error('消息不存在')
    }

    const message = messages[index]
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
