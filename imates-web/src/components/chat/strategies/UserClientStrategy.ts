/**
 * 用户客户端聊天策略
 * 处理用户客服对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardResult, ForwardOptions } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useUserClientStore } from '../../../stores/userClientStore'
import { showMessage } from '../../../utils'

export class UserClientStrategy implements ChatStrategy {
  private store = useUserClientStore()

  // 第1步：获取消息存储引用
  getMessages(): ChatBubble[] {
    return this.store.messages
  }

  // 第2步：添加消息到存储
  async addMessage(message: ChatBubble): Promise<void> {
    this.store.messages.push(message)
  }

  // 第3步：发送消息的具体逻辑
  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    // 如果有多张图片，使用 sendImagesMessage 方法
    if (options?.imageList && options.imageList.length > 0) {
      await this.store.sendImagesMessage(
        options.imageList.map(img => ({
          filePath: img.filePath || '',
          width: img.width || 0,
          height: img.height || 0,
          fileSize: img.fileSize || 0,
          base64DataUrl: img.base64DataUrl,
        })),
        content
      )
    }
    // 如果有单张图片，使用 sendImageMessage 方法
    else if (options?.imageData) {
      await this.store.sendImageMessage({
        filePath: options.imageData.filePath || '',
        width: options.imageData.width || 0,
        height: options.imageData.height || 0,
        fileSize: options.imageData.fileSize || 0,
        base64DataUrl: options.imageData.base64DataUrl,
      }, content)
    }
    // 纯文本消息
    else {
      await this.store.sendMessage(content)
    }
  }

  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '欢迎使用在线客服，请描述您的问题'
  }

  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // 用户客户端不需要题目
  }

  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'ai' // 统一归类为ai类型
  }

  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' | 'user' {
    return 'ai' // 客服回复算作ai
  }

  // 第8步：保存聊天历史（用户客户端不需要持久化）
  async saveChatHistory(): Promise<void> {
    // 用户客户端消息不需要保存到服务器
    return Promise.resolve()
  }

  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return false // 用户客服对话不支持转发
  }

  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null // 不支持转发
  }

  // 第11步：转发单条消息
  async forwardMessage(_message: ChatBubble, _options?: ForwardOptions): Promise<ForwardResult> {
    showMessage('客服对话不支持转发消息', 'info')
    return {
      success: false,
      error: '客服对话不支持转发消息'
    }
  }

  // 第12步：转发多条消息
  async forwardMessages(_messages: ChatBubble[], _options?: ForwardOptions): Promise<ForwardResult> {
    showMessage('客服对话不支持转发消息', 'info')
    return {
      success: false,
      error: '客服对话不支持转发消息'
    }
  }

  // 第13步：获取输入框占位符文本
  getPlaceholderText(_hasSelectedQuestion: boolean): string {
    return '请输入您的问题...'
  }

  // 第14步：获取当前科目
  getCurrentSubject(): 'biology' | 'math' {
    return 'math' // 默认数学科目
  }

  // 第15步：初始化策略
  async initialize(_options: InitializeOptions): Promise<void> {
    // 注意：不再自动添加欢迎消息，由调用方根据历史消息加载情况决定
    // 这样可以避免与异步的loadChatHistory时序冲突
  }

  // 第16步：检查是否应该乐观发送
  shouldOptimisticSend(): boolean {
    return false // 用户客户端不使用乐观发送
  }

  // 第18步：发送语音消息（不支持）
  async sendVoiceMessage(_voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    return {
      success: false,
      message: '客服对话不支持语音消息'
    }
  }

  // 第19步：检查发送图片后是否清空输入框
  shouldClearInputAfterImage(): boolean {
    return false // 允许用户在发送图片后继续输入文字
  }

  // 第20步：发送图片消息
  async sendImageMessage(
    imageInfo: {
      filePath: string
      width: number
      height: number
      fileSize: number
      base64DataUrl?: string
    },
    textContent?: string,
    _options?: SendMessageOptions
  ): Promise<void> {
    await this.store.sendImageMessage(imageInfo, textContent)
  }

  // 第21步：更新已编辑的消息（不支持）
  async updateEditedMessage(_messageId: string, _newContent: string, _options?: SendMessageOptions): Promise<void> {
    showMessage('客服对话不支持编辑消息', 'info')
  }

  // 第23步：检查是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return false
  }

  // ==================== 不支持的方法 ====================

  // 第16步：获取会话信息（用户客户端不需要）
  getSessionInfo?(): import('../../../types').ChatMessageSession | null {
    return null
  }


  // 第24步：重置会话（不支持）
  resetSession?(): void {
    // 不支持重置会话
  }

  // 第25步：删除消息（不支持）
  async deleteMessage?(_messageId: string, _options?: { currentQuestion?: unknown }): Promise<void> {
    showMessage('客服对话不支持删除消息', 'info')
  }

  // 第26步：获取会话卡片列表（不支持）
  getSessionCards?(): unknown[] {
    return []
  }

  // 第27步：为当前题目创建新会话（不支持）
  async createNewSession?(_options?: { currentQuestion?: unknown }): Promise<void> {
    // 不支持创建新会话
  }

  // 第28步：切换到指定会话（不支持）
  async switchToSession?(_sessionId: string): Promise<void> {
    // 不支持切换会话
  }

  // 第29步：删除指定会话（不支持）
  async deleteSession?(_sessionId: string, _options?: { currentQuestion?: unknown }): Promise<void> {
    // 不支持删除会话
  }

  // 第30步：获取联网搜索状态（不支持）
  getEnableWebSearch?(): boolean {
    return false
  }

  // 第31步：切换联网搜索状态（不支持）
  toggleWebSearch?(): void {
    // 不支持联网搜索
  }

  // 第33步：检查是否支持分页加载历史消息
  supportsPaginatedHistory(): boolean {
    return true
  }

  // 第34步：加载更多历史消息
  async loadMoreHistory(): Promise<void> {
    console.log('[历史记录] 策略: 触发加载更多历史消息')
    await this.store.loadMoreHistory()
    console.log('[历史记录] 策略: 加载更多历史消息完成')
  }

  // 第35步：检查是否有更多历史消息
  hasMoreHistory(): boolean {
    return this.store.hasMoreHistory
  }

  // 第36步：检查是否正在加载历史消息
  isLoadingHistory(): boolean {
    return this.store.isLoadingHistory
  }
}
