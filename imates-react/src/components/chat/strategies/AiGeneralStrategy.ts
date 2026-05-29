import type { ChatBubble, AttachedScreenshot } from '@/types'
import { Sender } from '@/types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult } from '@/components/chat/strategies/ChatStrategy'
import type { SendMessageOptions } from '@/components/chat/strategies/types'
import type { InitializeOptions } from '@/components/chat/strategies/types'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'

export class AiGeneralStrategy implements ChatStrategy {
  private chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface

  private get store() {
    return useAiGeneralChatStore.getState()
  }

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
  
  getMessages(): ChatBubble[] {
    return this.store.messages
  }
  
  async addMessage(message: ChatBubble): Promise<void> {
    this.store.messages.push(message)
  }
  
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const skipUserMessage = !!options.imageData || !!(options.imageList && options.imageList.length > 0) || !!options.skipUserMessage
    const { getUserInfo, getSubject } = await import('@/services/http/auth-service')
    const userInfo = getUserInfo()
    const subject = getSubject()

    await this.store.sendMessage(
      content,
      userInfo,
      subject,
      options.selectedModel || 'mate',
      skipUserMessage,
      options.quotedMessage as any,
      options.imageData,
      options.imageList,
      options.focus as any,
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
    await this.store.saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!this.store.isChatLoading
  }
  
  canForwardMessage(): boolean {
    return true
  }
  
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null
  }
  
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    return { success: false, error: '未实现' }
  }
  
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    return '发送消息...'
  }
  
  getCurrentSubject(): 'biology' | 'math' {
    return 'biology'
  }
  
  async initialize(options: InitializeOptions): Promise<void> {
    // 初始化逻辑
  }

  shouldOptimisticSend(): boolean {
    return true
  }
  
  async sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    return { success: false, message: '未实现' }
  }
  
  shouldClearInputAfterImage(): boolean {
    return true
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
    // 未实现
  }

  supportsImagePicker(): boolean {
    return true
  }

  supportsScreenshotAttach(): boolean {
    return true
  }

  getMaxAttachedImages(): number {
    return 9
  }

  buildImagePayloadFromAttachedScreenshots(shots: AttachedScreenshot[]) {
    if (shots.length === 0) return {}
    if (shots.length === 1) {
      return {
        imageData: {
          filePath: '', // AttachedScreenshot 不包含 filePath，通常是从 dataUrl 转换或占位
          base64DataUrl: shots[0].dataUrl,
          width: shots[0].width,
          height: shots[0].height,
          fileSize: 0,
        }
      }
    }
    return {
      imageList: shots.map(shot => ({
        filePath: '',
        base64DataUrl: shot.dataUrl,
        width: shot.width,
        height: shot.height,
        fileSize: 0,
      }))
    }
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

  async updateEditedMessage(messageId: string, newContent: string, options?: SendMessageOptions): Promise<void> {
    // 未实现
  }

  shouldShowForwardButton(): boolean {
    return true
  }

  setChatView(chatView: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  clearMessages(): void {
    this.store.clearMessages()
  }
}
