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
 * - filePath: 用于发送给Android端（文件路径）
 * - base64DataUrl: 用于前端渲染显示（base64数据）
 */
export interface ChatImageData {
  filePath: string
  base64DataUrl?: string  // 可选，用于UI显示
  width?: number
  height?: number
  fileSize?: number
  isLargeImage?: boolean  // 标记是否为大图片
}

/**
 * UI 层使用的引用消息类型（与 ChatBubble.quotedMessage 对应）
 * 注意：与后端用的 QuotedMessageInfo 区分开，后者 sender 使用 human/ai
 */
export interface ChatQuotedMessage {
  id: string
  content: string
  sender: 'user' | 'ai' | 'teacher'
}

/**
 * 创建用户消息
 */
export function createUserMessage(
  content: string,
  imageData?: ChatImageData,
  hidePrefix: boolean = false,
  sessionId?: string,
  quotedMessage?: ChatQuotedMessage,
): ChatBubble {
  // 处理内容显示
  let displayContent = content
  if (hidePrefix && content.startsWith('我们开始吧，')) {
    displayContent = content.replace('我们开始吧，', '')
  }
  
  // 判断是否为图片消息（只要有 base64DataUrl 即视为图片）
  const isImageMessage = !!(imageData && imageData.base64DataUrl)
  
  // 如果有图片数据，转换为标准ImageData格式
  // ChatBubble.imageData 现在直接使用 base64DataUrl 字段用于UI显示
  let standardImageData: { filePath: string; width: number; height: number; fileSize: number; base64DataUrl?: string } | undefined = undefined
  if (isImageMessage && imageData) {
    standardImageData = {
      filePath: imageData.filePath || '',  // 保留原始 filePath，用于发送给后端等用途
      width: imageData.width || 0,  // 使用实际的宽高信息
      height: imageData.height || 0,
      fileSize: imageData.fileSize || 0,
      base64DataUrl: imageData.base64DataUrl  // 使用 base64DataUrl 字段用于UI显示
    }
  }
  
  return {
    id: Date.now().toString(),
    content: displayContent,
    type: 'user',
    timestamp: new Date().toISOString(),
    sender: 'user',
    messageType: isImageMessage ? 'image' : 'text',  // 设置消息类型，以便ChatMessage组件正确识别
    imageData: standardImageData,
    sessionId,
    quotedMessage, // 引用消息信息
  }
}

/**
 * 创建临时AI回复消息
 */
export function createTempAiReplyMessage(
  selectedModel?: string,
  sessionId?: string,
): { message: ChatBubble; id: string } {
  const tempReplyId = generateUniqueId('temp_ai')
  const tempReplyMessage: ChatBubble = {
    id: tempReplyId,
    content: '',
    type: 'ai',
    timestamp: new Date().toISOString(),
    sender: 'ai',
    // 初始不处于流式状态，避免在还未收到任何服务端帧时就展示骨架屏
    isStreaming: false,
    selectedModel: selectedModel || 'mate', // 保存当前模式
    sessionId,
  }
  
  return { message: tempReplyMessage, id: tempReplyId }
}

/**
 * 创建临时教师回复消息
 */
export function createTempTeacherReplyMessage(): { message: ChatBubble; id: string } {
  const tempReplyId = generateUniqueId('temp_teacher')
  const tempReplyMessage: ChatBubble = {
    id: tempReplyId,
    content: '',
    type: 'teacher',
    timestamp: new Date().toISOString(),
    sender: 'teacher',
    // 同样初始为非流式状态
    isStreaming: false,
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
    isError: false,
    selectedModel: message.selectedModel // 保留模式信息
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
  if (imageData && imageData.base64DataUrl) {
    standardImageData = {
      filePath: imageData.base64DataUrl,  // 使用 base64DataUrl 作为显示路径
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
    retryCount,
    selectedModel: message.selectedModel // 保留模式信息
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

