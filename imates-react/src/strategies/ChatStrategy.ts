/**
 * 聊天策略接口
 * 定义不同对话类型需要实现的方法
 */

import type { ChatBubble, AttachedScreenshot } from '../types'
import type { SendMessageOptions, InitializeOptions } from './types'
import type { ChatImageData } from '../stores/utils/chatStoreUtils'
import { Sender } from '../types/enums'

export interface ChatViewInterface {
  scrollToBottom(instant?: boolean): Promise<void>
  checkIfUserAtBottom(): void
  executeQuestionSwitch(): void
  getLastMessageCount(): number
  setLastMessageCount(count: number): void
  getIsUserAtBottom(): boolean
  setIsUserAtBottom(isAtBottom: boolean): void
  getShowNewMessageIndicator(): boolean
  setShowNewMessageIndicator(show: boolean): void
  getIsKeyboardVisible(): boolean
  getIsKeyboardAnimating(): boolean
  getDisplayedMessages(): ChatBubble[]
  emitResponse(): void
  getIsEditingMessage(): boolean
  setIsEditingMessage(editing: boolean): void
  getEditingQuestionId(): string | undefined
  cancelEditMessage(): void
  clearInputContent(): void
}

export interface ForwardResult {
  success: boolean
  successCount?: number
  sessionId?: string
  error?: string
}

export interface ForwardOptions {
  showDialog?: boolean
  onSuccess?: (result: ForwardResult) => void | Promise<void>
  onError?: (error: string) => void
  currentQuestion?: unknown
  onTeacherSelect?: () => Promise<'biology' | 'math'>
  showForwardSuccessDialog?: (message: string, sessionId?: string) => Promise<{ goToTeacher: boolean; sessionId?: string }>
}

export interface ChatStrategy {
  getMessages(): ChatBubble[]
  addMessage(message: ChatBubble): Promise<void>
  sendMessage(content: string, options?: SendMessageOptions): Promise<void>
  getWelcomeMessage(): string
  requiresQuestion(): boolean
  getMessageType(): Sender
  getSenderType(): Sender
  saveChatHistory(): Promise<void>
  disableHistorySave?: boolean
  isChatLoading?(): boolean
  canForwardMessage(): boolean
  getCurrentSubjectForForward(): 'biology' | 'math' | null
  forwardMessages(messages: ChatBubble[], options?: ForwardOptions): Promise<ForwardResult>
  getPlaceholderText(hasSelectedQuestion: boolean): string
  getCurrentSubject(): 'biology' | 'math'
  initialize(options: InitializeOptions): Promise<void>
  shouldOptimisticSend(): boolean
  sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }>
  shouldClearInputAfterImage(): boolean
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
  supportsImagePicker?(): boolean
  supportsScreenshotAttach?(): boolean
  getMaxAttachedImages?(): number
  buildImagePayloadFromAttachedScreenshots?: (shots: AttachedScreenshot[]) => {
    imageData?: ChatImageData
    imageList?: ChatImageData[]
  }
  shouldAnnotateAfterCrop?(): boolean
  getImagePostProcessMode?(): 'attach_to_input' | 'send_immediately'
  getScreenshotEntryKind?(): 'screen_snapshot' | 'pdf_page'
  getInputAttachedScreenshots?(): AttachedScreenshot[]
  setInputAttachedScreenshots?(shots: AttachedScreenshot[]): void
  appendInputAttachedScreenshots?(shots: AttachedScreenshot[]): void
  removeInputAttachedScreenshot?(id: string): void
  clearInputAttachedScreenshots?(): void
  getInputScreenshotDrawingStates?(): Record<string, unknown>
  setInputScreenshotDrawingStates?(states: Record<string, unknown>): void
  removeInputScreenshotDrawingState?(id: string): void
  clearInputScreenshotDrawingStates?(): void
  updateEditedMessage(messageId: string, newContent: string, options?: SendMessageOptions): Promise<void>
  cleanup?(): void
  shouldShowForwardButton(): boolean
  resetSession?(): void
  deleteMessage?(messageId: string, options?: { currentQuestion?: unknown }): Promise<void>
  getSessionCards?(): unknown[]
  createNewSession?(options?: { currentQuestion?: unknown }): Promise<void>
  switchToSession?(sessionId: string): Promise<void>
  deleteSession?(sessionId: string, options?: { currentQuestion?: unknown }): Promise<void>
  getEnableWebSearch?(): boolean
  toggleWebSearch?(): void
  retryMessage?(messageId: string, options?: { currentQuestion?: unknown }): Promise<void>
  supportsPaginatedHistory?(): boolean
  loadMoreHistory?(): Promise<void>
  hasMoreHistory?(): boolean
  isLoadingHistory?(): boolean
  setChatView?(chatView: ChatViewInterface): void
  onQuestionChanged?(newQuestion: unknown, oldQuestion: unknown): void
}
