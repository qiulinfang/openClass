/**
 * AI 题目对话策略 (imates-uniapp)
 */

import type { AttachedScreenshot, ChatBubble } from '@/types/chat'
import { Sender } from '@/types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult, ChatViewInterface } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useAiExerciseChatStore } from '@/store/aiExerciseChatStore'

export class AiExerciseStrategy implements ChatStrategy {
  private aiExerciseStore = useAiExerciseChatStore()
  private chatView?: ChatViewInterface

  setChatView(chatView: ChatViewInterface) {
    this.chatView = chatView
  }

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return this.aiExerciseStore.inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.aiExerciseStore.setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    this.aiExerciseStore.setInputAttachedScreenshots(this.aiExerciseStore.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    this.aiExerciseStore.removeInputAttachedScreenshot(id)
  }

  clearInputAttachedScreenshots(): void {
    this.aiExerciseStore.clearInputAttachedScreenshots()
  }

  getMessages(): ChatBubble[] {
    return this.aiExerciseStore.messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    this.aiExerciseStore.messages.push(message)
  }

  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const currentQuestion = options.currentQuestion || options.question
    if (!currentQuestion) {
      throw new Error('请先选择题目')
    }

    const skipUserMessage = !!options.imageData || !!(options.imageList && options.imageList.length > 0) || !!options.skipUserMessage

    await this.aiExerciseStore.sendMessage(
      content,
      currentQuestion,
      null,
      'MATH',
      options.selectedModel || 'mate',
      skipUserMessage,
      options.quotedMessage as any,
      options.imageData,
      options.imageList,
    )
  }

  getWelcomeMessage(): string {
    return '请先在上方选择或拍摄一道题目，我来帮你分析解题思路！'
  }

  requiresQuestion(): boolean {
    return true
  }

  getMessageType(): Sender {
    return Sender.AI
  }

  getSenderType(): Sender {
    return Sender.AI
  }

  async saveChatHistory(): Promise<void> {
    await this.aiExerciseStore.saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!this.aiExerciseStore.isChatLoading
  }

  canForwardMessage(): boolean {
    return true
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return 'math'
  }

  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    uni.showToast({ title: `转发 ${messages.length} 条题目对话`, icon: 'none' })
    return { success: true, successCount: messages.length }
  }

  getPlaceholderText(hasSelectedQuestion: boolean): string {
    return hasSelectedQuestion ? '针对本题继续提问...' : '请先选择一道题目'
  }

  getCurrentSubject(): 'biology' | 'math' {
    return 'math'
  }

  async initialize(options: InitializeOptions): Promise<void> {
    if (options.currentQuestionId) {
      await this.aiExerciseStore.loadChatHistory(options.currentQuestionId)
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
    await this.aiExerciseStore.deleteMessage(messageId)
  }

  getEnableWebSearch(): boolean {
    return this.aiExerciseStore.enableWebSearch
  }

  toggleWebSearch(): void {
    this.aiExerciseStore.enableWebSearch = !this.aiExerciseStore.enableWebSearch
  }

  async retryMessage(messageId: string, options?: { currentQuestion?: unknown }): Promise<void> {
    const msg = this.aiExerciseStore.messages.find((m) => m.id === messageId)
    if (msg && msg.originalMessage && options?.currentQuestion) {
      await this.aiExerciseStore.deleteMessage(messageId)
      await this.sendMessage(msg.originalMessage, options)
    }
  }
}
