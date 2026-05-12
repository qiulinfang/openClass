import type { ChatBubble, ExerciseItem } from '../../../types'
import { showMessage } from '../../../utils'
import type { ChatStrategy, ForwardOptions, ForwardResult } from './ChatStrategy'
import type { SendMessageOptions } from './types'
import type { AttachedScreenshot } from '../../../types'
import type { InitializeOptions } from './types'
import { toRaw } from 'vue' // 导入 Vue 工具
import { useAiHomeworkChatStore } from '../../../stores/aiHomeworkChatStore'
import { getUserInfo, getSubject } from '../../../services'
import { useTeacherChatStore } from '../../../stores/teacherChatStore'
import { apiService } from '../../../services/http/api-service'
import { generateUniqueId } from '../../../stores/utils/chatStoreUtils'
import { Sender } from '../../../types/enums'

export class AiHomeworkStrategy implements ChatStrategy {
  private aiHomeworkStore = useAiHomeworkChatStore()
  private chatView?: import('./ChatStrategy').ChatViewInterface

  // ... (保持现有代码，但确保使用了正确的导入)
  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return this.aiHomeworkStore.inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.aiHomeworkStore.setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    this.aiHomeworkStore.setInputAttachedScreenshots(this.aiHomeworkStore.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    this.aiHomeworkStore.removeInputAttachedScreenshot(id)
  }

  clearInputAttachedScreenshots(): void {
    this.aiHomeworkStore.clearInputAttachedScreenshots()
  }

  getInputScreenshotDrawingStates(): Record<string, unknown> {
    return this.aiHomeworkStore.inputScreenshotDrawingStates
  }

  setInputScreenshotDrawingStates(states: Record<string, unknown>): void {
    this.aiHomeworkStore.setInputScreenshotDrawingStates(states || {})
  }

  removeInputScreenshotDrawingState(id: string): void {
    if (!id) return
    const next = { ...(this.aiHomeworkStore.inputScreenshotDrawingStates || {}) } as Record<string, unknown>
    if (id in next) {
      delete next[id]
      this.aiHomeworkStore.setInputScreenshotDrawingStates(next)
    }
  }

  clearInputScreenshotDrawingStates(): void {
    this.aiHomeworkStore.setInputScreenshotDrawingStates({})
  }
  
  getMessages(): ChatBubble[] {
    return this.aiHomeworkStore.messages
  }
  
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiHomeworkStore.messages.push(message)
    this.handleMessagesChanged(this.getMessages())
  }
  
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const skipUserMessage = !!options.imageData || !!(options.imageList && options.imageList.length > 0) || !!options.skipUserMessage

    // 转换 quotedMessage 的 sender 类型
    const formattedQuotedMessage = options.quotedMessage 
      ? {
          ...options.quotedMessage,
          sender: options.quotedMessage.sender as unknown as Sender
        }
      : undefined

    await this.aiHomeworkStore.sendMessage(
      content,
      getUserInfo(),
      getSubject(),
      (options.currentQuestion as any) || null,
      options.selectedModel || 'mate',
      skipUserMessage,
      formattedQuotedMessage as any,
      options.imageData,
      options.imageList,
      options.focus,
    )
  }
  
  getWelcomeMessage(): string {
    return '你好！我是你的学习伙伴。针对这道作业题，有什么我可以帮你的吗？'
  }
  
  requiresQuestion(): boolean {
    return true // 作业对话必须有关联题目
  }
  
  getMessageType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  getSenderType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  async saveChatHistory(): Promise<void> {
    await this.aiHomeworkStore.saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!this.aiHomeworkStore.isChatLoading
  }
  
  canForwardMessage(): boolean {
    return true
  }
  
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null
  }
  
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    showMessage('作业页转发功能开发中', 'info')
    return { success: false }
  }
  
  async initialize(options: InitializeOptions): Promise<void> {
    if (options.currentQuestionId) {
      await this.aiHomeworkStore.setQuestionContext(options.currentQuestionId)
    }
  }

  async sendVoiceMessage(_voiceInfo: any): Promise<{ success: boolean; message?: string }> {
    return { success: true }
  }
  
  async sendImageMessage(imageInfo: any, textContent?: string, options?: SendMessageOptions): Promise<void> {
    await this.sendMessage(textContent || '', {
      ...options,
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrl: imageInfo.base64DataUrl,
      }
    })
  }
  
  async updateEditedMessage(messageId: string, newContent: string, options?: { selectedModel?: string }): Promise<void> {
    const messages = this.aiHomeworkStore.messages
    const index = messages.findIndex(m => m.id === messageId)
    if (index === -1) return
    messages[index].content = newContent
    this.aiHomeworkStore.messages = messages.slice(0, index + 1)
    await this.saveChatHistory()
    await this.sendMessage(newContent, { selectedModel: options?.selectedModel, skipUserMessage: true })
  }
  
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    return hasSelectedQuestion ? '向学伴提问这道题...' : '请选择题目后提问'
  }
  
  shouldShowForwardButton(): boolean {
    return true
  }
  
  shouldClearInputAfterImage(): boolean {
    return true
  }

  supportsImagePicker(): boolean {
    return true
  }

  supportsScreenshotAttach(): boolean {
    return true
  }

  getMaxAttachedImages(): number {
    return 3
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
    const list = (shots || []).filter((s) => !!s?.dataUrl).slice(0, 3)
    if (list.length === 0) return {}
    if (list.length === 1) return { imageData: { filePath: '', base64DataUrl: list[0].dataUrl } }
    return {
      imageList: list.map((s) => ({ filePath: '', width: s.width || 0, height: s.height || 0, fileSize: 0, base64DataUrl: s.dataUrl, isLargeImage: false }))
    }
  }
  
  shouldOptimisticSend(): boolean {
    return false
  }

  getCurrentSubject(): 'biology' | 'math' {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
  }

  private handleMessagesChanged(newMessages: ChatBubble[]): void {
    if (!this.chatView || !newMessages || newMessages.length === 0) return
    this.chatView.checkIfUserAtBottom()
    this.chatView.scrollToBottom()
  }

  setChatView(chatView: import('./ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  onQuestionChanged(newQuestion: any): void {
    if (newQuestion?.bmNo) {
      this.aiHomeworkStore.setQuestionContext(newQuestion.bmNo)
    }
  }
}
