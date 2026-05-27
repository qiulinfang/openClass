import type { ChatBubble } from '../../types'
import { Sender } from '../../types/enums'

export interface ChatImageData {
  filePath: string
  base64DataUrl?: string
  width?: number
  height?: number
  fileSize?: number
  isLargeImage?: boolean
}

export interface ChatQuotedMessage {
  id: string
  content: string
  sender: Sender
}

export function createUserMessage(
  content: string,
  imageData?: ChatImageData,
  hidePrefix: boolean = false,
  sessionId?: string,
  quotedMessage?: ChatQuotedMessage,
): ChatBubble {
  let displayContent = content
  if (hidePrefix && content.startsWith('我们开始吧，')) {
    displayContent = content.replace('我们开始吧，', '')
  }
  
  const isImageMessage = !!(imageData && imageData.base64DataUrl)
  
  let standardImageData: { filePath: string; width: number; height: number; fileSize: number; base64DataUrl?: string } | undefined = undefined
  if (isImageMessage && imageData) {
    standardImageData = {
      filePath: imageData.filePath || '',
      width: imageData.width || 0,
      height: imageData.height || 0,
      fileSize: imageData.fileSize || 0,
      base64DataUrl: imageData.base64DataUrl
    }
  }
  
  return {
    id: Date.now().toString(),
    content: displayContent,
    type: Sender.USER,
    timestamp: new Date().toISOString(),
    sender: Sender.USER,
    messageType: isImageMessage ? 'image' : 'text',
    imageData: standardImageData,
    sessionId,
    quotedMessage,
  }
}

export function createTempAiReplyMessage(
  selectedModel?: string,
  sessionId?: string,
): { message: ChatBubble; id: string } {
  const tempReplyId = generateUniqueId('temp_ai')
  const tempReplyMessage: ChatBubble = {
    id: tempReplyId,
    content: '',
    type: Sender.AI,
    timestamp: new Date().toISOString(),
    sender: Sender.AI,
    isStreaming: false,
    selectedModel: selectedModel || 'mate',
    sessionId,
  }
  
  return { message: tempReplyMessage, id: tempReplyId }
}

export function createTempTeacherReplyMessage(): { message: ChatBubble; id: string } {
  const tempReplyId = generateUniqueId('temp_teacher')
  const tempReplyMessage: ChatBubble = {
    id: tempReplyId,
    content: '',
    type: Sender.TEACHER,
    timestamp: new Date().toISOString(),
    sender: Sender.TEACHER,
    isStreaming: false,
  }
  
  return { message: tempReplyMessage, id: tempReplyId }
}

export function updateMessageSuccess(
  message: ChatBubble,
  content: string,
  messageId?: string
): ChatBubble {
  return {
    ...message,
    content,
    isStreaming: false,
    messageId,
    isError: false,
    selectedModel: message.selectedModel
  }
}

export function updateMessageError(
  message: ChatBubble,
  errorContent: string,
  originalMessage?: string,
  imageData?: ChatImageData
): ChatBubble {
  let standardImageData: { filePath: string; width: number; height: number; fileSize: number } | undefined = undefined
  if (imageData && imageData.base64DataUrl) {
    standardImageData = {
      filePath: imageData.base64DataUrl,
      width: 0,
      height: 0,
      fileSize: 0
    }
  }
  
  return {
    ...message,
    content: errorContent,
    isStreaming: false,
    isError: true,
    canRetry: true,
    originalMessage,
    imageData: standardImageData
  }
}

export function updateMessageRetrying(
  message: ChatBubble,
  retryCount: number
): ChatBubble {
  return {
    ...message,
    content: '',
    isStreaming: true,
    isError: false,
    canRetry: false,
    retryCount,
    selectedModel: message.selectedModel
  }
}

export function checkRetryCondition(
  message: ChatBubble,
  maxRetries: number = 3
): { canRetry: boolean; error?: string } {
  if (!message.canRetry || !message.originalMessage) {
    return { canRetry: false, error: '该消息不支持重发' }
  }
  
  const retryCount = message.retryCount || 0
  if (retryCount >= maxRetries) {
    return { canRetry: false, error: '已达到最大重试次数' }
  }
  
  return { canRetry: true }
}

export function isResponseSuccess(response: { success?: boolean; reply?: string }): boolean {
  return !!response.success && !!response.reply && response.reply !== '请求失败，请重试。'
}

export function buildRetryFailureMessage(retryCount: number, maxRetries: number): string {
  return `重试失败 (${retryCount}/${maxRetries})，请稍后重试。`
}

export function findMessageIndex(messages: ChatBubble[], messageId: string): number {
  return messages.findIndex(m => m.id === messageId)
}

export function validateMessageExists(index: number): void {
  if (index < 0) {
    throw new Error('消息不存在')
  }
}

export function generateUniqueId(prefix: string = ''): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`
}

export function truncateText(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + '...'
}
