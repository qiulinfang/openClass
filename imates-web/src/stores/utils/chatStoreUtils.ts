/**
 * Chat Store 通用工具函数
 * 
 * 职责：提供所有聊天场景Store的通用逻辑
 * - 消息创建
 * - 重试逻辑
 * - 错误处理
 */

import type { ChatBubble } from '../../types'

/**
 * 简化的图片数据接口（用于聊天）
 */
export interface ChatImageData {
  filePath: string
  base64DataUrl?: string
}

/**
 * 创建用户消息
 */
export function createUserMessage(
  content: string,
  imageData?: ChatImageData,
  hidePrefix: boolean = false
): ChatBubble {
  // 第1步：处理内容显示
  let displayContent = content
  if (hidePrefix && content.startsWith('我们开始吧，')) {
    displayContent = content.replace('我们开始吧，', '')
  }
  
  // 第2步：判断是否为图片消息（放宽条件：只要有 filePath 即视为图片）
  const isImageMessage = !!(imageData && imageData.filePath)
  
  // 第3步：如果有图片数据，转换为标准ImageData格式
  let standardImageData: { filePath: string; width: number; height: number; fileSize: number } | undefined = undefined
  if (isImageMessage && imageData) {
    standardImageData = {
      filePath: imageData.filePath,
      width: 0,  // 简化处理，宽高设为0
      height: 0,
      fileSize: 0
    }
  }
  
  return {
    id: Date.now().toString(),
    content: displayContent,
    type: 'user',
    timestamp: new Date().toISOString(),
    sender: 'user',
    imageData: standardImageData
  }
}

/**
 * 创建临时AI回复消息
 */
export function createTempAiReplyMessage(): { message: ChatBubble; id: string } {
  const tempReplyId = (Date.now() + 1).toString()
  const tempReplyMessage: ChatBubble = {
    id: tempReplyId,
    content: '',
    type: 'ai',
    timestamp: new Date().toISOString(),
    sender: 'ai',
    isStreaming: true
  }
  
  return { message: tempReplyMessage, id: tempReplyId }
}

/**
 * 创建临时教师回复消息
 */
export function createTempTeacherReplyMessage(): { message: ChatBubble; id: string } {
  const tempReplyId = (Date.now() + 1).toString()
  const tempReplyMessage: ChatBubble = {
    id: tempReplyId,
    content: '',
    type: 'teacher',
    timestamp: new Date().toISOString(),
    sender: 'teacher',
    isStreaming: true
  }
  
  return { message: tempReplyMessage, id: tempReplyId }
}

/**
 * 更新消息为成功状态
 */
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
    isError: false
  }
}

/**
 * 更新消息为错误状态
 */
export function updateMessageError(
  message: ChatBubble,
  errorContent: string,
  originalMessage?: string,
  imageData?: ChatImageData
): ChatBubble {
  // 转换imageData为标准格式
  let standardImageData: { filePath: string; width: number; height: number; fileSize: number } | undefined = undefined
  if (imageData) {
    standardImageData = {
      filePath: imageData.filePath,
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

/**
 * 更新消息为重试中状态
 */
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
    retryCount
  }
}

/**
 * 检查重试条件
 * @returns 是否可以重试
 */
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

/**
 * 判断响应是否真正成功
 */
export function isResponseSuccess(response: { success?: boolean; reply?: string }): boolean {
  return !!response.success && !!response.reply && response.reply !== '请求失败，请重试。'
}

/**
 * 构建重试失败消息内容
 */
export function buildRetryFailureMessage(retryCount: number, maxRetries: number): string {
  return `重试失败 (${retryCount}/${maxRetries})，请稍后重试。`
}

/**
 * 在消息列表中查找消息索引
 */
export function findMessageIndex(messages: ChatBubble[], messageId: string): number {
  return messages.findIndex(m => m.id === messageId)
}

/**
 * 验证消息是否存在
 */
export function validateMessageExists(index: number): void {
  if (index < 0) {
    throw new Error('消息不存在')
  }
}

/**
 * 生成唯一ID
 */
export function generateUniqueId(prefix: string = ''): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`
}

/**
 * 截断文本用于会话名称
 */
export function truncateText(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + '...'
}

