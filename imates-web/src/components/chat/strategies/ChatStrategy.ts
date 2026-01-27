/**
 * 聊天策略接口
 * 定义不同对话类型需要实现的方法
 */

import type { ChatBubble } from '../../../types'
import type { SendMessageOptions } from './types'

/**
 * ChatView接口定义
 * 策略可以调用的ChatView方法
 */
export interface ChatViewInterface {
  // 滚动控制
  scrollToBottom(): Promise<void>
  checkIfUserAtBottom(): void

  // 题目切换
  executeQuestionSwitch(): void

  // 状态访问
  getLastMessageCount(): number
  setLastMessageCount(count: number): void
  getIsUserAtBottom(): boolean
  setIsUserAtBottom(isAtBottom: boolean): void
  getShowNewMessageIndicator(): boolean
  setShowNewMessageIndicator(show: boolean): void
  getIsKeyboardVisible(): boolean
  getIsKeyboardAnimating(): boolean

  // 消息操作
  getDisplayedMessages(): ChatBubble[]
  emitResponse(): void

  // 编辑相关
  getIsEditingMessage(): boolean
  setIsEditingMessage(editing: boolean): void
  getEditingQuestionId(): string | undefined
  cancelEditMessage(): void
  clearInputContent(): void
}

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
  /**
   * 可选：当前题目对象（题目场景转发需要）
   */
  currentQuestion?: unknown
  /**
   * 老师选择回调函数（当需要用户选择老师时调用）
   */
  onTeacherSelect?: () => Promise<'biology' | 'math'>
  /**
   * 显示转发成功对话框的回调函数
   */
  showForwardSuccessDialog?: (message: string, sessionId?: string) => Promise<{ goToTeacher: boolean; sessionId?: string }>
}

export interface ChatStrategy {
  // 获取消息存储引用
  getMessages(): ChatBubble[]
  
  // 添加消息到存储
  addMessage(message: ChatBubble): Promise<void>
  
  // 发送消息的具体逻辑
  sendMessage(content: string, options?: SendMessageOptions): Promise<void>
  
  // 获取欢迎消息
  getWelcomeMessage(): string
  
  // 检查是否需要选择题目
  requiresQuestion(): boolean
  
  // 获取消息类型
  getMessageType(): 'ai' | 'teacher'
  
  // 获取发送者类型
  getSenderType(): 'ai' | 'teacher' | 'user'
  
  // 保存聊天历史
  saveChatHistory(): Promise<void>
  
  // 检查是否支持转发消息
  canForwardMessage(): boolean
  
  // 获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null
  
  // 转发消息（支持单条或多条，通过数组传入）
  forwardMessages(messages: ChatBubble[], options?: ForwardOptions): Promise<ForwardResult>
  
  // 获取输入框占位符文本
  getPlaceholderText(hasSelectedQuestion: boolean): string
  
  // 获取当前科目
  getCurrentSubject(): 'biology' | 'math'
  
  // 初始化策略
  initialize(options: import('./types').InitializeOptions): Promise<void>

  // 检查是否应该乐观发送
  shouldOptimisticSend(): boolean
  
  // 发送语音消息
  sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }>
  
  // 检查发送图片后是否清空输入框
  shouldClearInputAfterImage(): boolean
  
  // 发送图片消息
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
  
  // 更新已编辑的消息
  updateEditedMessage(messageId: string, newContent: string, options?: SendMessageOptions): Promise<void>
  
  // 清理资源（可选，仅教师策略需要）
  cleanup?(): void
  
  // 检查是否显示转发按钮
  shouldShowForwardButton(): boolean
  
  // 重置会话（可选，仅部分策略需要）
  resetSession?(): void

  // 删除消息（可选）
  deleteMessage?(messageId: string, options?: { currentQuestion?: unknown }): Promise<void>

  // 获取会话卡片列表（可选，仅部分策略需要）
  getSessionCards?(): unknown[]

  // 为当前题目创建新会话（可选，仅部分策略需要）
  createNewSession?(options?: { currentQuestion?: unknown }): Promise<void>

  // 切换到指定会话（可选，仅部分策略需要）
  switchToSession?(sessionId: string): Promise<void>

  // 删除指定会话（可选，仅部分策略需要）
  deleteSession?(sessionId: string, options?: { currentQuestion?: unknown }): Promise<void>

  // 获取联网搜索状态（可选）
  getEnableWebSearch?(): boolean

  // 切换联网搜索状态（可选）
  toggleWebSearch?(): void

  // 重试消息（可选）
  retryMessage?(messageId: string, options?: { currentQuestion?: unknown }): Promise<void>

  // 检查是否支持分页加载历史消息
  supportsPaginatedHistory?(): boolean

  // 加载更多历史消息
  loadMoreHistory?(): Promise<void>

  // 检查是否有更多历史消息
  hasMoreHistory?(): boolean

  // 检查是否正在加载历史消息
  isLoadingHistory?(): boolean

  // 设置ChatView接口（用于策略主动调用ChatView方法）
  setChatView?(chatView: ChatViewInterface): void

  // 处理题目切换（由ChatView主动调用）
  onQuestionChanged?(newQuestion: unknown, oldQuestion: unknown): void
}

