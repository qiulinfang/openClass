/**
 * 策略相关的类型定义
 */

export interface SendMessageOptions {
  selectedModel?: string
  imageData?: any
  imageList?: any[]
  skipUserMessage?: boolean
  focus?: any
  question?: unknown
  currentQuestion?: unknown
  currentQuestionId?: string
  quotedMessage?: {
    id: string
    content: string
    sender: 'user' | 'ai' | 'teacher'
  }
  displayContent?: string
}

export interface TeacherSessionInfo {
  sessionId: string
  sessionName: string
  subject: string
}

export interface InitializeOptions {
  currentSubject?: 'biology' | 'math'
  currentQuestionId?: string
  currentQuestionTitle?: string
  sessionId?: string
  resourceId?: string
  hasSelectedQuestion?: boolean
  question?: unknown
}

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
  getDisplayedMessages(): any[]
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
  targetSessionId?: string
  messageIds?: string[]
  includeImages?: boolean
}
