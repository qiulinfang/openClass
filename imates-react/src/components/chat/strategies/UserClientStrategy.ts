import type { ChatBubble, AttachedScreenshot } from '@/types'
import { Sender } from '@/types/enums'
import { showMessage } from '@/utils'
import type { ChatStrategy, ForwardOptions, ForwardResult } from '@/components/chat/strategies/ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from '@/components/chat/strategies/types'
import { useUserClientChatStore } from '@/stores/userClientChatStore'

export class UserClientStrategy implements ChatStrategy {
  private chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return useUserClientChatStore.getState().inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    useUserClientChatStore.getState().setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    const store = useUserClientChatStore.getState()
    store.setInputAttachedScreenshots(store.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    useUserClientChatStore.getState().removeInputAttachedScreenshot(id)
  }

  clearInputAttachedScreenshots(): void {
    useUserClientChatStore.getState().clearInputAttachedScreenshots()
  }

  getInputScreenshotDrawingStates(): Record<string, unknown> {
    return useUserClientChatStore.getState().inputScreenshotDrawingStates
  }

  setInputScreenshotDrawingStates(states: Record<string, unknown>): void {
    useUserClientChatStore.getState().setInputScreenshotDrawingStates(states || {})
  }

  removeInputScreenshotDrawingState(id: string): void {
    if (!id) return
    const store = useUserClientChatStore.getState()
    const next = { ...(store.inputScreenshotDrawingStates || {}) } as Record<string, unknown>
    if (id in next) {
      delete next[id]
      store.setInputScreenshotDrawingStates(next)
    }
  }

  clearInputScreenshotDrawingStates(): void {
    useUserClientChatStore.getState().setInputScreenshotDrawingStates({})
  }

  getMessages(): ChatBubble[] {
    return useUserClientChatStore.getState().messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    const store = useUserClientChatStore.getState()
    store.messages.push(message)
    this.handleMessagesChanged(this.getMessages())
  }

  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    const store = useUserClientChatStore.getState()
    if (options?.imageList && options.imageList.length > 0) {
      await store.sendImagesMessage(
        options.imageList.map(img => ({
          filePath: img.filePath || '',
          width: img.width || 0,
          height: img.height || 0,
          fileSize: img.fileSize || 0,
          base64DataUrl: img.base64DataUrl,
        })),
        content
      )
    } else if (options?.imageData) {
      await store.sendImagesMessage([{
        filePath: options.imageData.filePath || '',
        width: options.imageData.width || 0,
        height: options.imageData.height || 0,
        fileSize: options.imageData.fileSize || 0,
        base64DataUrl: options.imageData.base64DataUrl,
      }], content)
    } else {
      await store.sendMessage(content)
    }
  }

  getWelcomeMessage(): string {
    return '欢迎使用在线客服，请描述您的问题'
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
    return Promise.resolve()
  }

  isChatLoading(): boolean {
    return false
  }

  canForwardMessage(): boolean {
    return false
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null
  }

  async forwardMessages(messages: ChatBubble[], options?: ForwardOptions): Promise<ForwardResult> {
    showMessage('客服对话不支持转发消息', 'info')
    return { success: false, error: '客服对话不支持转发消息' }
  }

  getPlaceholderText(_hasSelectedQuestion: boolean): string {
    return '请输入您的问题...'
  }

  getCurrentSubject(): 'biology' | 'math' {
    return 'math'
  }

  async initialize(_options: InitializeOptions): Promise<void> {
    // 初始化逻辑
  }

  shouldOptimisticSend(): boolean {
    return false
  }

  async sendVoiceMessage(_voiceInfo: { filePath: string; duration: number; fileSize: number }): Promise<{ success: boolean; message?: string }> {
    return { success: false, message: '客服对话不支持语音消息' }
  }

  shouldClearInputAfterImage(): boolean {
    return false
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

  async sendImageMessage(imageInfo: any, textContent?: string, _options?: SendMessageOptions): Promise<void> {
    await useUserClientChatStore.getState().sendImagesMessage([{
      filePath: imageInfo.filePath || '',
      width: imageInfo.width || 0,
      height: imageInfo.height || 0,
      fileSize: imageInfo.fileSize || 0,
      base64DataUrl: imageInfo.base64DataUrl,
    }], textContent)
  }

  async updateEditedMessage(_messageId: string, _newContent: string, _options?: SendMessageOptions): Promise<void> {
    showMessage('客服对话不支持编辑消息', 'info')
  }

  shouldShowForwardButton(): boolean {
    return false
  }

  supportsPaginatedHistory(): boolean {
    return true
  }

  async loadMoreHistory(): Promise<void> {
    await useUserClientChatStore.getState().loadMoreHistory()
  }

  hasMoreHistory(): boolean {
    return useUserClientChatStore.getState().hasMoreHistory
  }

  isLoadingHistory(): boolean {
    return useUserClientChatStore.getState().isLoadingHistory
  }

  setChatView(chatView: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  private handleMessagesChanged(newMessages: ChatBubble[]): void {
    if (!this.chatView || !newMessages || newMessages.length === 0) return
    const hasNewMessage = newMessages.length > this.chatView.getLastMessageCount()
    this.chatView.setLastMessageCount(newMessages.length)
    this.chatView.checkIfUserAtBottom()

    if (this.chatView.getIsKeyboardVisible() || this.chatView.getIsKeyboardAnimating()) {
      this.chatView.scrollToBottom()
      this.chatView.setShowNewMessageIndicator(false)
    } else {
      if (hasNewMessage && !this.chatView.getIsUserAtBottom()) {
        this.chatView.setShowNewMessageIndicator(true)
      } else if (this.chatView.getIsUserAtBottom()) {
        this.chatView.scrollToBottom()
        this.chatView.setShowNewMessageIndicator(false)
      }
    }
  }

  onQuestionChanged(newQuestion: unknown, oldQuestion: unknown): void {}

  clearMessages(): void {
    useUserClientChatStore.getState().resetState()
  }
}
