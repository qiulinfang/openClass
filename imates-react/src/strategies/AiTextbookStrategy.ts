import type { ChatBubble, AttachedScreenshot } from '../types'
import { Sender } from '../types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useAiTextbookChatStore } from '../stores/aiTextbookChatStore'

export class AiTextbookStrategy implements ChatStrategy {
  private chatView?: import('./ChatStrategy').ChatViewInterface

  private get store() {
    return useAiTextbookChatStore.getState()
  }

  getInputAttachedScreenshots(): AttachedScreenshot[] { return this.store.attachedScreenshots }
  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void { this.store.setAttachedScreenshots(shots) }
  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void { if (shots?.length) this.store.setAttachedScreenshots(this.store.attachedScreenshots.concat(shots)) }
  removeInputAttachedScreenshot(id: string): void { this.store.setAttachedScreenshots(this.store.attachedScreenshots.filter(s => s.id !== id)) }
  clearInputAttachedScreenshots(): void { this.store.setAttachedScreenshots([]) }
  getInputScreenshotDrawingStates(): Record<string, unknown> { return {} }
  setInputScreenshotDrawingStates(states: Record<string, unknown>): void {}
  removeInputScreenshotDrawingState(id: string): void {}
  clearInputScreenshotDrawingStates(): void {}

  getMessages(): ChatBubble[] { return this.store.messages }
  async addMessage(message: ChatBubble): Promise<void> { this.store.addMessage(message) }
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> { await this.store.sendMessage(content) }
  getWelcomeMessage(): string { return '你好！让我来帮你学习教材内容。' }
  requiresQuestion(): boolean { return true }
  getMessageType(): Sender { return Sender.AI }
  getSenderType(): Sender { return Sender.AI }
  async saveChatHistory(): Promise<void> { await this.store.saveChatHistory() }
  isChatLoading(): boolean { return !!this.store.isChatLoading }
  canForwardMessage(): boolean { return false }
  getCurrentSubjectForForward(): 'biology' | 'math' | null { return null }
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> { return { success: false, error: '教材对话不支持转发' } }
  getPlaceholderText(hasSelectedQuestion: boolean): string { return hasSelectedQuestion ? '发送消息...' : '请先选择教材' }
  getCurrentSubject(): 'biology' | 'math' { return 'biology' }
  async initialize(options: InitializeOptions): Promise<void> {}
  shouldOptimisticSend(): boolean { return true }
  async sendVoiceMessage(voiceInfo: { filePath: string; duration: number; fileSize: number }): Promise<{ success: boolean; message?: string }> { return { success: false } }
  shouldClearInputAfterImage(): boolean { return true }
  async sendImageMessage(imageInfo: { filePath: string; width: number; height: number; fileSize: number; base64DataUrl?: string }, textContent?: string, options?: SendMessageOptions): Promise<void> {}
  supportsImagePicker(): boolean { return true }
  supportsScreenshotAttach(): boolean { return true }
  getMaxAttachedImages(): number { return 9 }
  buildImagePayloadFromAttachedScreenshots(shots: AttachedScreenshot[]) { return {} }
  shouldAnnotateAfterCrop(): boolean { return false }
  getImagePostProcessMode(): 'attach_to_input' | 'send_immediately' { return 'send_immediately' }
  getScreenshotEntryKind(): 'screen_snapshot' | 'pdf_page' { return 'pdf_page' }
  async updateEditedMessage(messageId: string, newContent: string, options?: SendMessageOptions): Promise<void> {}
  shouldShowForwardButton(): boolean { return false }
  setChatView(chatView: import('./ChatStrategy').ChatViewInterface): void { this.chatView = chatView }
  clearMessages(): void { this.store.clearMessages() }
}
