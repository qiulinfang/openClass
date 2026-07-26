/**
 * AI通用对话策略 (imates-uniapp)
 */

import type { AttachedScreenshot, ChatBubble } from '@/types/chat'
import { Sender } from '@/types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult, ChatViewInterface } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useAiGeneralChatStore } from '@/store/aiGeneralChatStore'

export class AiGeneralStrategy implements ChatStrategy {
  private aiGeneralStore = useAiGeneralChatStore()
  private chatView?: ChatViewInterface

  setChatView(chatView: ChatViewInterface) {
    this.chatView = chatView
  }

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return this.aiGeneralStore.inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.aiGeneralStore.setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    this.aiGeneralStore.setInputAttachedScreenshots(this.aiGeneralStore.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    this.aiGeneralStore.removeInputAttachedScreenshot(id)
  }

  clearInputAttachedScreenshots(): void {
    this.aiGeneralStore.clearInputAttachedScreenshots()
  }

  getMessages(): ChatBubble[] {
    return this.aiGeneralStore.messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    this.aiGeneralStore.messages.push(message)
  }

  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const skipUserMessage = !!options.imageData || !!(options.imageList && options.imageList.length > 0) || !!options.skipUserMessage

    await this.aiGeneralStore.sendMessage(
      content,
      null,
      '',
      options.selectedModel || 'mate',
      skipUserMessage,
      options.quotedMessage as any,
      options.imageData,
      options.imageList,
    )
  }

  getWelcomeMessage(): string {
    return '你好！我是你的学习伙伴。有什么问题我可以帮你解答吗？'
  }

  requiresQuestion(): boolean {
    return false
  }

  getMessageType(): Sender {
    return Sender.AI
  }

  getSenderType(): Sender {
    return Sender.AI
  }

  async saveChatHistory(): Promise<void> {
    await this.aiGeneralStore.saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!this.aiGeneralStore.isChatLoading
  }

  canForwardMessage(): boolean {
    return true
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null
  }

  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    uni.showToast({ title: `已选 ${messages.length} 条消息`, icon: 'none' })
    return { success: true, successCount: messages.length }
  }

  getPlaceholderText(): string {
    return '问学伴点什么...'
  }

  getCurrentSubject(): 'biology' | 'math' {
    return 'math'
  }

  async initialize(options: InitializeOptions): Promise<void> {
    await this.aiGeneralStore.loadSessions()
    if (!options.hasSelectedQuestion && this.aiGeneralStore.messages.length === 0) {
      const welcomeMessage: ChatBubble = {
        id: 'welcome_' + Date.now(),
        content: this.getWelcomeMessage(),
        type: Sender.AI,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: Sender.AI,
        messageType: 'text',
      }
      await this.addMessage(welcomeMessage)
    }
  }

  shouldOptimisticSend(): boolean {
    return true
  }

  async sendVoiceMessage(voiceInfo: { filePath: string; duration: number; fileSize: number }): Promise<{ success: boolean; message?: string }> {
    return { success: true }
  }

  shouldClearInputAfterImage(): boolean {
    return true
  }

  async sendImageMessage(
    imageInfo: { filePath: string; width: number; height: number; fileSize: number; base64DataUrl?: string },
    textContent?: string,
    options?: SendMessageOptions
  ): Promise<void> {
    await this.sendMessage(textContent || '', {
      ...options,
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrl: imageInfo.base64DataUrl,
      },
    })
  }

  shouldShowForwardButton(): boolean {
    return true
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.aiGeneralStore.deleteMessage(messageId)
  }

  getSessionCards(): unknown[] {
    return this.aiGeneralStore.sessions
  }

  async createNewSession(): Promise<void> {
    await this.aiGeneralStore.createSession()
  }

  async switchToSession(sessionId: string): Promise<void> {
    await this.aiGeneralStore.switchSession(sessionId)
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.aiGeneralStore.deleteSession(sessionId)
  }

  getEnableWebSearch(): boolean {
    return this.aiGeneralStore.enableWebSearch
  }

  toggleWebSearch(): void {
    this.aiGeneralStore.enableWebSearch = !this.aiGeneralStore.enableWebSearch
  }

  async retryMessage(messageId: string): Promise<void> {
    await this.aiGeneralStore.retryMessage(messageId)
  }
}
