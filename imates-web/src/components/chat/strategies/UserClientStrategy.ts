/**
 * 用户客户端聊天策略
 * 处理用户客服对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardOptions, ForwardResult } from './ChatStrategy'
import type { InitializeOptions, SendMessageOptions } from './types'
import type { AttachedScreenshot } from '../../../types'
import { useUserClientStore } from '../../../stores/userClientStore'
import { showMessage } from '../../../utils'

export class UserClientStrategy implements ChatStrategy {
  private store = useUserClientStore()
  private chatView?: import('./ChatStrategy').ChatViewInterface

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return this.store.inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.store.setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    this.store.setInputAttachedScreenshots(this.store.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    this.store.removeInputAttachedScreenshot(id)
  }

  clearInputAttachedScreenshots(): void {
    this.store.clearInputAttachedScreenshots()
  }

  getInputScreenshotDrawingStates(): Record<string, unknown> {
    return this.store.inputScreenshotDrawingStates
  }

  setInputScreenshotDrawingStates(states: Record<string, unknown>): void {
    this.store.setInputScreenshotDrawingStates(states || {})
  }

  removeInputScreenshotDrawingState(id: string): void {
    if (!id) return
    const next = { ...(this.store.inputScreenshotDrawingStates || {}) } as Record<string, unknown>
    if (id in next) {
      delete next[id]
      this.store.setInputScreenshotDrawingStates(next)
    }
  }

  clearInputScreenshotDrawingStates(): void {
    this.store.setInputScreenshotDrawingStates({})
  }

  // 获取消息存储引用
  getMessages(): ChatBubble[] {
    return this.store.messages
  }

  // 添加消息到存储
  async addMessage(message: ChatBubble): Promise<void> {
    this.store.messages.push(message)
    // 通知ChatView处理消息变化
    this.handleMessagesChanged(this.getMessages())
  }

  // 发送消息的具体逻辑
  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    // 如果有图片（单张或多张），统一使用 sendImagesMessage 方法
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
    // 如果有单张图片，也使用 sendImagesMessage 方法
    else if (options?.imageData) {
      await this.store.sendImagesMessage([{
        filePath: options.imageData.filePath || '',
        width: options.imageData.width || 0,
        height: options.imageData.height || 0,
        fileSize: options.imageData.fileSize || 0,
        base64DataUrl: options.imageData.base64DataUrl,
      }], content)
    }
    // 纯文本消息
    else {
      await this.store.sendMessage(content)
    }
  }

  // 获取欢迎消息
  getWelcomeMessage(): string {
    return '欢迎使用在线客服，请描述您的问题'
  }

  // 检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // 用户客户端不需要题目
  }

  // 获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'ai' // 统一归类为ai类型
  }

  // 获取发送者类型
  getSenderType(): 'ai' | 'teacher' | 'user' {
    return 'ai' // 客服回复算作ai
  }

  // 保存聊天历史（用户客户端不需要持久化）
  async saveChatHistory(): Promise<void> {
    // 用户客户端消息不需要保存到服务器
    return Promise.resolve()
  }

  isChatLoading(): boolean {
    return false
  }

  // 检查是否支持转发消息
  canForwardMessage(): boolean {
    return false // 用户客服对话不支持转发
  }

  // 获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null // 不支持转发
  }


  // 转发多条消息
  async forwardMessages(messages: ChatBubble[], options?: ForwardOptions): Promise<ForwardResult> {
    showMessage('客服对话不支持转发消息', 'info')
    return {
      success: false,
      error: '客服对话不支持转发消息'
    }
  }

  // 获取输入框占位符文本
  getPlaceholderText(_hasSelectedQuestion: boolean): string {
    return '请输入您的问题...'
  }

  // 获取当前科目
  getCurrentSubject(): 'biology' | 'math' {
    return 'math' // 默认数学科目
  }

  // 初始化策略
  async initialize(_options: InitializeOptions): Promise<void> {
    // 注意：不再自动添加欢迎消息，由调用方根据历史消息加载情况决定
    // 这样可以避免与异步的loadChatHistory时序冲突
  }

  // 检查是否应该乐观发送
  shouldOptimisticSend(): boolean {
    return false // 用户客户端不使用乐观发送
  }

  // 发送语音消息（不支持）
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

  // 检查发送图片后是否清空输入框
  shouldClearInputAfterImage(): boolean {
    return false // 允许用户在发送图片后继续输入文字
  }

  supportsImagePicker(): boolean {
    return true
  }

  supportsScreenshotAttach(): boolean {
    return true
  }

  getMaxAttachedImages(): number {
    return 5
  }

  shouldAnnotateAfterCrop(): boolean {
    return true
  }

  getImagePostProcessMode(): 'attach_to_input' | 'send_immediately' {
    return 'attach_to_input'
  }

  getScreenshotEntryKind(): 'screen_snapshot' | 'pdf_page' {
    return 'screen_snapshot'
  }

  buildImagePayloadFromAttachedScreenshots(shots: AttachedScreenshot[]) {
    const maxImages = this.getMaxAttachedImages()
    const list = (shots || []).filter((s) => !!s?.dataUrl).slice(0, maxImages)
    if (list.length === 0) return {}

    if (list.length === 1) {
      return {
        imageData: {
          filePath: '',
          base64DataUrl: list[0].dataUrl,
        },
      }
    }

    return {
      imageList: list.map((s) => ({
        filePath: '',
        width: s.width || 0,
        height: s.height || 0,
        fileSize: 0,
        base64DataUrl: s.dataUrl,
        isLargeImage: false,
      })),
    }
  }

  // 发送图片消息（兼容接口，实际调用sendImagesMessage）
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
    // 将单张图片包装成数组，调用sendImagesMessage
    await this.store.sendImagesMessage([{
      filePath: imageInfo.filePath || '',
      width: imageInfo.width || 0,
      height: imageInfo.height || 0,
      fileSize: imageInfo.fileSize || 0,
      base64DataUrl: imageInfo.base64DataUrl,
    }], textContent)
  }


  // 更新已编辑的消息（不支持）
  async updateEditedMessage(_messageId: string, _newContent: string, _options?: SendMessageOptions): Promise<void> {
    showMessage('客服对话不支持编辑消息', 'info')
  }

  // 检查是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return false
  }

  // ==================== 不支持的方法 ====================

  // getSessionInfo 方法已删除，所有策略都不需要此方法


  // 重置会话（不支持）
  resetSession?(): void {
    // 不支持重置会话
  }

  // 删除消息（不支持）
  async deleteMessage?(_messageId: string, _options?: { currentQuestion?: unknown }): Promise<void> {
    showMessage('客服对话不支持删除消息', 'info')
  }

  // 获取会话卡片列表（不支持）
  getSessionCards?(): unknown[] {
    return []
  }

  // 为当前题目创建新会话（不支持）
  async createNewSession?(_options?: { currentQuestion?: unknown }): Promise<void> {
    // 不支持创建新会话
  }

  // 切换到指定会话（不支持）
  async switchToSession?(_sessionId: string): Promise<void> {
    // 不支持切换会话
  }

  // 删除指定会话（不支持）
  async deleteSession?(_sessionId: string, _options?: { currentQuestion?: unknown }): Promise<void> {
    // 不支持删除会话
  }

  // 获取联网搜索状态（不支持）
  getEnableWebSearch?(): boolean {
    return false
  }

  // 切换联网搜索状态（不支持）
  toggleWebSearch?(): void {
    // 不支持联网搜索
  }

  // 检查是否支持分页加载历史消息
  supportsPaginatedHistory(): boolean {
    return true
  }

  // 加载更多历史消息
  async loadMoreHistory(): Promise<void> {
    console.log('[历史记录] 策略: 触发加载更多历史消息')
    await this.store.loadMoreHistory()
    console.log('[历史记录] 策略: 加载更多历史消息完成')
  }

  // 检查是否有更多历史消息
  hasMoreHistory(): boolean {
    return this.store.hasMoreHistory
  }

  // 检查是否正在加载历史消息
  isLoadingHistory(): boolean {
    return this.store.isLoadingHistory
  }

  // 设置ChatView接口
  setChatView(chatView: import('./ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  /**
   * 处理消息变化
   * 替代原有的watch监听器，由策略主动调用
   */
  private handleMessagesChanged(newMessages: ChatBubble[]): void {
    if (!this.chatView || !newMessages || newMessages.length === 0) return

    // 检测是否有新消息（消息数量增加）
    const hasNewMessage = newMessages.length > this.chatView.getLastMessageCount()
    this.chatView.setLastMessageCount(newMessages.length)

    // 检查用户是否在底部（允许50px的误差）
    this.chatView.checkIfUserAtBottom()

    // 如果是键盘显示状态，立即滚动；否则根据用户位置决定
    if (this.chatView.getIsKeyboardVisible() || this.chatView.getIsKeyboardAnimating()) {
      // 键盘显示时立即滚动，确保用户体验
      this.chatView.scrollToBottom()
      this.chatView.setShowNewMessageIndicator(false)
    } else {
      // 如果用户不在底部且有新消息，显示提示按钮
      if (hasNewMessage && !this.chatView.getIsUserAtBottom()) {
        this.chatView.setShowNewMessageIndicator(true)
      } else if (this.chatView.getIsUserAtBottom()) {
        // 用户在底部，自动滚动并隐藏提示按钮
        this.chatView.scrollToBottom()
        this.chatView.setShowNewMessageIndicator(false)
      }
    }
  }

  // 处理题目切换（由ChatView主动调用）
  onQuestionChanged(newQuestion: unknown, oldQuestion: unknown): void {
    // 用户客户端策略不需要特殊的题目切换处理
    console.log('用户客户端策略题目切换:', newQuestion, oldQuestion)
  }
}
