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
  
  // 第13步：获取输入框占位符文本
  getPlaceholderText(hasSelectedQuestion: boolean): string
  
  // 第14步：获取当前科目
  getCurrentSubject(): 'biology' | 'math'
  
  // 第15步：初始化策略
  initialize(options: import('./types').InitializeOptions): Promise<void>
  
  // 第16步：获取会话信息（可选，仅教师策略需要）
  getSessionInfo?(): import('../../../types').ChatMessageSession | null
  
  // 第17步：检查是否应该乐观发送
  shouldOptimisticSend(): boolean
  
  // 第18步：发送语音消息
  sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }>
  
  // 第19步：检查发送图片后是否清空输入框
  shouldClearInputAfterImage(): boolean
  
  // 第20步：发送图片消息
  sendImageMessage(
    imageInfo: {
      filePath: string
      width: number
      height: number
      fileSize: number
      base64DataUrl?: string
    },
    textContent?: string,
    options?: SendMessageOptions
  ): Promise<void>
  
  // 第21步：更新已编辑的消息
  updateEditedMessage(messageId: string, newContent: string, options?: SendMessageOptions): Promise<void>
  
  // 第22步：清理资源（可选，仅教师策略需要）
  cleanup?(): void
  
  // 第23步：检查是否显示转发按钮
  shouldShowForwardButton(): boolean
  
  // 第24步：重置会话（可选，仅部分策略需要）
  resetSession?(): void

  // 第25步：删除消息（可选）
  deleteMessage?(messageId: string, options?: { currentQuestion?: unknown }): Promise<void>

  // 第26步：获取会话卡片列表（可选，仅部分策略需要）
  getSessionCards?(): unknown[]

  // 第27步：为当前题目创建新会话（可选，仅部分策略需要）
  createNewSession?(options?: { currentQuestion?: unknown }): Promise<void>

  // 第28步：切换到指定会话（可选，仅部分策略需要）
  switchToSession?(sessionId: string): Promise<void>

  // 第29步：删除指定会话（可选，仅部分策略需要）
  deleteSession?(sessionId: string, options?: { currentQuestion?: unknown }): Promise<void>

  // 第30步：获取联网搜索状态（可选）
  getEnableWebSearch?(): boolean

  // 第31步：切换联网搜索状态（可选）
  toggleWebSearch?(): void
}

