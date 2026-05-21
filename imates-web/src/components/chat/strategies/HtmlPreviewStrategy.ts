/**
 * HtmlPreview 聊天策略
 * 用于 HtmlPreviewView 中的聊天面板
 * 特点：不加载历史、不保存历史
 */

import type { ChatStrategy, ForwardOptions, ForwardResult } from './ChatStrategy'
import { Sender } from '@/types/enums'
import type { InitializeOptions, SendMessageOptions } from './types'
import type { ChatBubble, AttachedScreenshot, HtmlPreviewFocus } from '@/types'
import { useHtmlPreviewChatStore } from '@/stores/htmlPreviewChatStore'
import { getUserInfo, getSubject } from '@/services'

export class HtmlPreviewStrategy implements ChatStrategy {
  private htmlPreviewStore = useHtmlPreviewChatStore()
  private chatView?: import('./ChatStrategy').ChatViewInterface
  disableHistorySave = true

  setChatView(chatView: import('./ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  getMessages(): ChatBubble[] {
    return this.htmlPreviewStore.messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    this.htmlPreviewStore.messages.push(message)
    this.handleMessagesChanged(this.getMessages())
  }

  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    console.log('[HtmlPreviewStrategy] sendMessage 被调用:', { content, options })
    // 获取实时上下文 (GeoGebra 状态等) —— 策略层负责获取 UI 相关的实时上下文
    let focus: HtmlPreviewFocus | undefined = undefined
    if (typeof (window as any).__htmlPreview_getFocus === 'function') {
      try {
        focus = await (window as any).__htmlPreview_getFocus()
        console.log('[HtmlPreviewStrategy] 获取到实时 focus:', focus)
      } catch (e) {
        console.warn('[HtmlPreviewStrategy] 获取 focus 失败:', e)
      }
    }

    // 调用下沉后的核心发送逻辑
    console.log('[HtmlPreviewStrategy] 调用 store.sendMessage')
    await this.htmlPreviewStore.sendMessage(
      content,
      getUserInfo(),
      {
        selectedModel: options.selectedModel,
        skipUserMessage: options.skipUserMessage,
        quotedMessage: options.quotedMessage,
        imageData: options.imageData,
        imageList: options.imageList,
        focus: focus || options.focus,
      }
    )
  }

  async saveChatHistory(): Promise<void> {
    // HTML 预览不保存历史
    return
  }

  getWelcomeMessage(): string {
    return '你好！可以拖动 GeoGebra 图形到此处向我提问，我会帮你分析图形、解答问题。'
  }

  async initialize(options: InitializeOptions): Promise<void> {
    console.log('[HtmlPreviewStrategy] initialize 被调用, options:', options)
    console.log('[HtmlPreviewStrategy] initialize 时 store.sessionId =', this.htmlPreviewStore.sessionId)

    // 不加载历史：清空当前消息列表
    this.htmlPreviewStore.messages = []

    // 添加欢迎消息
    const welcomeMessage: ChatBubble = {
      id: 'welcome_' + Date.now(),
      content: this.getWelcomeMessage(),
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      sender: Sender.AI,
    }
    await this.addMessage(welcomeMessage)
  }

  getCurrentSubject(): 'biology' | 'math' {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
  }

  requiresQuestion(): boolean {
    return false
  }

  getMessageType(): 'ai' | 'teacher' {
    return 'ai'
  }

  getSenderType(): 'ai' | 'teacher' | 'user' {
    return 'ai'
  }

  canForwardMessage(): boolean {
    return true
  }

  shouldOptimisticSend(): boolean {
    return false
  }

  async sendVoiceMessage(_voiceInfo: { filePath: string; duration: number; fileSize: number }): Promise<{ success: boolean; message?: string }> {
    return { success: true }
  }

  async sendImageMessage(
    imageInfo: {
      filePath: string
      width: number
      height: number
      fileSize: number
      base64DataUrl?: string
    },
    textContent?: string,
    options?: SendMessageOptions
  ): Promise<void> {
    // 创建图片消息
    const imageMessage: ChatBubble = {
      id: Date.now().toString(),
      content: '',
      type: Sender.USER,
      timestamp: new Date().toISOString(),
      sender: Sender.USER,
      messageType: 'image',
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrl: imageInfo.base64DataUrl,
      },
    }

    await this.addMessage(imageMessage)

    // 发送图片消息给AI
    if (!imageInfo.base64DataUrl) {
      throw new Error('图片数据不完整，请重试')
    }

    await this.sendMessage(textContent || '', {
      selectedModel: options?.selectedModel,
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrl: imageInfo.base64DataUrl,
      },
      skipUserMessage: true, // 因为前面手动加了 imageMessage，这里让 store 跳过默认文本消息创建
    })
  }

  shouldClearInputAfterImage(): boolean {
    return true
  }

  async updateEditedMessage(
    messageId: string,
    newContent: string,
    options?: { selectedModel?: string }
  ): Promise<void> {
    // 获取实时上下文 (GeoGebra 状态等)
    let focus: HtmlPreviewFocus | undefined = undefined
    if (typeof (window as any).__htmlPreview_getFocus === 'function') {
      try {
        focus = await (window as any).__htmlPreview_getFocus()
      } catch (e) {
        console.warn('[HtmlPreviewStrategy] 获取 focus 失败:', e)
      }
    }

    // 完全委托给 Store 处理消息数组变更和重新发送
    await this.htmlPreviewStore.editMessage(messageId, newContent, getUserInfo(), {
      selectedModel: options?.selectedModel,
      focus,
    })
  }

  shouldShowForwardButton(): boolean {
    return true
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.htmlPreviewStore.deleteMessage(messageId)
  }

  async retryMessage(messageId: string): Promise<void> {
    await this.htmlPreviewStore.retryMessage(
      messageId,
      getUserInfo(),
      'mate'
    )
  }

  async deleteSession(_sessionId: string, _options?: { currentQuestion?: unknown }): Promise<void> {
    this.htmlPreviewStore.messages = []
  }

  async forwardMessages(messages: ChatBubble[], options?: ForwardOptions): Promise<ForwardResult> {
    // 转发逻辑待定，通常转发到主聊天或教师
    return { success: false }
  }

  async forwardMessagesSeparately(_messages: ChatBubble[], _options?: ForwardOptions): Promise<ForwardResult> {
    return { success: false }
  }

  resetSession(): void {
    this.htmlPreviewStore.messages = []
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null
  }

  getPlaceholderText(_hasSelectedQuestion: boolean): string {
    return '请输入问题...'
  }

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return this.htmlPreviewStore.inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.htmlPreviewStore.setInputAttachedScreenshots(shots)
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.htmlPreviewStore.setInputAttachedScreenshots(this.htmlPreviewStore.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    // Store 内部已实现过滤逻辑
    this.htmlPreviewStore.setInputAttachedScreenshots(this.htmlPreviewStore.inputAttachedScreenshots.filter(s => s.id !== id))
  }

  getEnableWebSearch(): boolean {
    return this.htmlPreviewStore.enableWebSearch
  }

  toggleWebSearch(): void {
    this.htmlPreviewStore.toggleWebSearch()
  }

  private handleMessagesChanged(messages: ChatBubble[]): void {
    if (!this.chatView || !messages || messages.length === 0) return

    // 检测是否有新消息
    const hasNewMessage = messages.length > this.chatView.getLastMessageCount()
    this.chatView.setLastMessageCount(messages.length)

    // 检查用户是否在底部
    this.chatView.checkIfUserAtBottom()

    if (this.chatView.getIsUserAtBottom()) {
      this.chatView.scrollToBottom()
      this.chatView.setShowNewMessageIndicator(false)
    } else if (hasNewMessage) {
      this.chatView.setShowNewMessageIndicator(true)
    }
  }
}
