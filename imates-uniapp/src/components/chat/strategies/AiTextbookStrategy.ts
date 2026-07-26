/**
 * AI 教材对话策略 (imates-uniapp)
 */

import type { AttachedScreenshot, ChatBubble } from '@/types/chat'
import { Sender } from '@/types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult, ChatViewInterface } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useAiTextbookChatStore } from '@/store/aiTextbookChatStore'

export class AiTextbookStrategy implements ChatStrategy {
  private aiTextbookStore = useAiTextbookChatStore()
  private chatView?: ChatViewInterface

  setChatView(chatView: ChatViewInterface) {
    this.chatView = chatView
  }

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return this.aiTextbookStore.attachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.aiTextbookStore.attachedScreenshots = Array.isArray(shots) ? shots : []
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    this.aiTextbookStore.attachedScreenshots = this.aiTextbookStore.attachedScreenshots.concat(shots)
  }

  removeInputAttachedScreenshot(id: string): void {
    this.aiTextbookStore.attachedScreenshots = this.aiTextbookStore.attachedScreenshots.filter((s) => s.id !== id)
  }

  clearInputAttachedScreenshots(): void {
    this.aiTextbookStore.attachedScreenshots = []
  }

  getMessages(): ChatBubble[] {
    return this.aiTextbookStore.messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    this.aiTextbookStore.messages.push(message)
  }

  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    await this.aiTextbookStore.sendMessage(
      content,
      options.currentQuestionId,
      options.selectedModel || 'mate',
      options.imageData,
      options.imageList,
    )
  }

  getWelcomeMessage(): string {
    return '你可以随时对教材页面截图或框选重点向我提问！'
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
    await this.aiTextbookStore.saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!this.aiTextbookStore.isChatLoading
  }

  canForwardMessage(): boolean {
    return true
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return 'math'
  }

  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    uni.showToast({ title: `转发 ${messages.length} 条教材对话`, icon: 'none' })
    return { success: true, successCount: messages.length }
  }

  getPlaceholderText(): string {
    return '输入对教材的疑问或附带截图...'
  }

  getCurrentSubject(): 'biology' | 'math' {
    return 'math'
  }

  async initialize(options: InitializeOptions): Promise<void> {
    if (options.resourceId || options.sessionId) {
      await this.aiTextbookStore.loadChatHistory(options.sessionId || options.resourceId!)
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
    await this.aiTextbookStore.deleteMessage(messageId)
  }

  getEnableWebSearch(): boolean {
    return this.aiTextbookStore.enableWebSearch
  }

  toggleWebSearch(): void {
    this.aiTextbookStore.enableWebSearch = !this.aiTextbookStore.enableWebSearch
  }
}
