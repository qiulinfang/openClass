/**
 * 聊天策略接口
 * 定义不同对话类型需要实现的方法
 */

import type { ChatBubble } from '../../../types'
import type { SendMessageOptions } from './types'

/**
 * 转发结果
 */
export interface ForwardResult {
  success: boolean
  successCount?: number
  sessionId?: string
  error?: string
}

/**
 * 转发选项
 */
export interface ForwardOptions {
  /**
   * 是否显示跳转对话框（默认true）
   * AI题目对话页面通常不显示对话框，只显示简单提示
   */
  showDialog?: boolean
  /**
   * 转发成功后的回调
   */
  onSuccess?: (result: ForwardResult) => void | Promise<void>
  /**
   * 转发失败后的回调
   */
  onError?: (error: string) => void
}

export interface ChatStrategy {
  // 第1步：获取消息存储引用
  getMessages(): ChatBubble[]
  
  // 第2步：添加消息到存储
  addMessage(message: ChatBubble): Promise<void>
  
  // 第3步：发送消息的具体逻辑
  sendMessage(content: string, options?: SendMessageOptions): Promise<void>
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean
  
  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher'
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' | 'user'
  
  // 第8步：保存聊天历史
  saveChatHistory(): Promise<void>
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null
  
  // 第11步：转发单条消息
  forwardMessage(message: ChatBubble, options?: ForwardOptions): Promise<ForwardResult>
  
  // 第12步：转发多条消息
  forwardMessages(messages: ChatBubble[], options?: ForwardOptions): Promise<ForwardResult>
}

