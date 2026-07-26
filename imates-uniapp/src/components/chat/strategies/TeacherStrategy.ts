/**
 * 教师IM对话策略 (imates-uniapp)
 */

import type { ChatBubble } from '@/types/chat'
import { Sender } from '@/types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'

export class TeacherStrategy implements ChatStrategy {
  private messages: ChatBubble[] = []

  getMessages(): ChatBubble[] {
    return this.messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    this.messages.push(message)
  }

  async sendMessage(content: string, _options: SendMessageOptions = {}): Promise<void> {
    const userMsg: ChatBubble = {
      id: Date.now().toString(),
      content,
      type: Sender.USER,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sender: Sender.USER,
      messageType: 'text',
    }
    this.messages.push(userMsg)
  }

  getWelcomeMessage(): string {
    return '你好！我是你的助教老师，请问有什么可以帮你？'
  }

  requiresQuestion(): boolean {
    return false
  }

  getMessageType(): Sender {
    return Sender.TEACHER
  }

  getSenderType(): Sender {
    return Sender.TEACHER
  }

  async saveChatHistory(): Promise<void> {}

  canForwardMessage(): boolean {
    return false
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return 'math'
  }

  async forwardMessages(_messages: ChatBubble[], _options: ForwardOptions = {}): Promise<ForwardResult> {
    return { success: false, error: '教师模式暂不支持转发' }
  }

  getPlaceholderText(): string {
    return '与老师交流...'
  }

  getCurrentSubject(): 'biology' | 'math' {
    return 'math'
  }

  async initialize(_options: InitializeOptions): Promise<void> {}

  shouldOptimisticSend(): boolean {
    return true
  }

  async sendVoiceMessage(_voiceInfo: { filePath: string; duration: number; fileSize: number }): Promise<{ success: boolean; message?: string }> {
    return { success: true }
  }

  shouldClearInputAfterImage(): boolean {
    return true
  }

  async sendImageMessage(
    _imageInfo: { filePath: string; width: number; height: number; fileSize: number; base64DataUrl?: string },
    _textContent?: string,
    _options?: SendMessageOptions
  ): Promise<void> {}

  shouldShowForwardButton(): boolean {
    return false
  }
}
