import type { ChatBubble, AttachedScreenshot } from '@/types'
import { Sender } from '@/types/enums'
import { showMessage } from '@/utils'
import type { ChatStrategy, ForwardOptions, ForwardResult } from '@/components/chat/strategies/ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from '@/components/chat/strategies/types'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useKnowledgeGraphStore } from '@/stores/KnowledgeGraphStore'
import { apiService } from '@/services/http/api-service'

export class AiTextbookStrategy implements ChatStrategy {
  private chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return useAiTextbookChatStore.getState().inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    useAiTextbookChatStore.getState().setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    const store = useAiTextbookChatStore.getState()
    store.setInputAttachedScreenshots(store.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    if (!id) return
    const store = useAiTextbookChatStore.getState()
    store.removeInputAttachedScreenshot(id)
    store.removeInputScreenshotDrawingState(id)
  }

  clearInputAttachedScreenshots(): void {
    const store = useAiTextbookChatStore.getState()
    store.clearInputAttachedScreenshots()
    store.clearInputScreenshotDrawingStates()
  }

  getInputScreenshotDrawingStates(): Record<string, unknown> {
    return useAiTextbookChatStore.getState().inputScreenshotDrawingStates as any
  }

  setInputScreenshotDrawingStates(states: Record<string, unknown>): void {
    useAiTextbookChatStore.getState().setInputScreenshotDrawingStates(states as any)
  }

  removeInputScreenshotDrawingState(id: string): void {
    if (!id) return
    useAiTextbookChatStore.getState().removeInputScreenshotDrawingState(id)
  }

  clearInputScreenshotDrawingStates(): void {
    useAiTextbookChatStore.getState().clearInputScreenshotDrawingStates()
  }
  
  getMessages(): ChatBubble[] {
    return useAiTextbookChatStore.getState().messages
  }
  
  async addMessage(message: ChatBubble): Promise<void> {
    const store = useAiTextbookChatStore.getState()
    store.addMessage(message)
    this.handleMessagesChanged(this.getMessages())
  }
  
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const hidePrefix = content.includes('我们开始吧')
    await useAiTextbookChatStore.getState().sendMessage(
      content,
      options.selectedModel,
      options.imageData,
      hidePrefix,
      options.skipUserMessage,
      options.quotedMessage as any,
      options.imageList,
      options.focus as any,
    )
  }
  
  getWelcomeMessage(): string {
    return '你好！我可以帮你解答教材中的问题。请告诉我你的疑问，或者使用探索区域工具发送教材截图。'
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
    await useAiTextbookChatStore.getState().saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!useAiTextbookChatStore.getState().isChatLoading
  }
  
  canForwardMessage(): boolean {
    return true
  }
  
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    try {
      const subject = useKnowledgeGraphStore.getState().getCurrentSubjectLowercase()
      return subject || null
    } catch (error) {
      console.error('[AiTextbookStrategy] ❌ 获取知识图谱科目失败:', error)
      return null
    }
  }
  
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      const subject = this.getCurrentSubjectForForward()
      if (!subject) return { success: false, error: '无法确定当前教材科目，请重试' }

      const teacherStore = useTeacherChatStore.getState()
      const allSessions = teacherStore.loadAllSessions()
      const subjectUpper = subject === 'math' ? 'MATH' : 'BIOLOGY'
      const session = Object.values(allSessions).find((s) => s.subject === subjectUpper)

      if (!session) return { success: false, error: `未找到${subject === 'math' ? '数学' : '生物'}科目的教师会话` }

      const { successCount } = await this.forwardMessagesSeparately(messages, session.sessionId)

      if (successCount > 0) {
        const result: ForwardResult = { success: true, successCount, sessionId: session.sessionId }
        if (options.showDialog !== false && options.showForwardSuccessDialog) {
          const messageCount = result.successCount || 0
          const displayMsg = messageCount > 1
              ? `已成功转发 ${messageCount} 条消息给老师，是否前往老师对话查看？`
              : '消息已成功转发给老师，是否前往老师对话查看？'

          const dialogResult = await options.showForwardSuccessDialog(displayMsg, session.sessionId)
          if (dialogResult?.goToTeacher && options.onSuccess) {
            await options.onSuccess(result)
          }
        } else if (options.onSuccess) {
          await options.onSuccess(result)
        }
        return result
      }
      return { success: false, error: '转发失败，请重试' }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
  
  async initialize(options: InitializeOptions): Promise<void> {
    const store = useAiTextbookChatStore.getState()
    if (options.resourceId) {
      await store.loadChatHistory(options.resourceId)
    }
    
    if (!options.hasSelectedQuestion && store.messages.length === 0) {
      const welcomeMessage: ChatBubble = {
        id: 'welcome_' + Date.now(),
        content: this.getWelcomeMessage(),
        type: this.getMessageType(),
        timestamp: '',
        sender: this.getSenderType(),
      }
      await this.addMessage(welcomeMessage)
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
    const store = useAiTextbookChatStore.getState()
    const messages = store.messages
    const index = messages.findIndex(m => m.id === messageId)
    if (index === -1) return
    messages[index].content = newContent
    store.setMessages(messages.slice(0, index + 1))
    await this.saveChatHistory()
    await this.sendMessage(newContent, { selectedModel: options?.selectedModel, skipUserMessage: true })
  }
  
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    return hasSelectedQuestion ? '向AI教材助手提问...' : '可以先聊聊，或选择题目后开始讨论'
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

  shouldAnnotateAfterCrop(): boolean {
    return true
  }

  getImagePostProcessMode(): 'attach_to_input' | 'send_immediately' {
    return 'attach_to_input'
  }

  supportsScreenshotAttach(): boolean {
    return true
  }

  getMaxAttachedImages(): number {
    return 3
  }

  getScreenshotEntryKind(): 'screen_snapshot' | 'pdf_page' {
    return 'pdf_page'
  }

  buildImagePayloadFromAttachedScreenshots(shots: AttachedScreenshot[]) {
    const maxImages = this.getMaxAttachedImages()
    const list = (shots || []).filter((s) => !!s?.dataUrl).slice(0, maxImages)
    if (list.length === 0) return {}

    const imageList = list.map((s) => ({
      filePath: '',
      width: s.width || 0,
      height: s.height || 0,
      fileSize: Math.round(s.dataUrl.length * 0.75),
      base64DataUrl: s.dataUrl,
      isLargeImage: false,
    }))

    if (list.length === 1) {
      return {
        imageData: {
          filePath: '',
          base64DataUrl: list[0].dataUrl,
          width: list[0].width || 0,
          height: list[0].height || 0,
          fileSize: Math.round(list[0].dataUrl.length * 0.75),
        },
        imageList,
      }
    }

    return {
      imageList,
    }
  }
  
  shouldOptimisticSend(): boolean {
    return false
  }
  
  getCurrentSubject(): 'biology' | 'math' {
    const subject = useKnowledgeGraphStore.getState().getCurrentSubject()
    return subject === 'BIOLOGY' || subject === '生物' ? 'biology' : 'math'
  }

  getEnableWebSearch(): boolean {
    return useAiTextbookChatStore.getState().enableWebSearch
  }

  toggleWebSearch(): void {
    useAiTextbookChatStore.getState().toggleWebSearch()
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

  setChatView(chatView: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  onQuestionChanged(newQuestion: unknown, oldQuestion: unknown): void {}

  private async forwardMessagesSeparately(messages: ChatBubble[], sessionId: string) {
    const teacherStore = useTeacherChatStore.getState()
    let successCount = 0

    const allSessions = teacherStore.loadAllSessions()
    const targetSession = allSessions[sessionId]
    if (targetSession) {
      teacherStore.setSession(targetSession)
    }

    for (const message of messages) {
      try {
        if (message.messageType === 'multi_image' && message.imageList?.length) {
          for (const imageInfo of message.imageList) {
            if (imageInfo.base64DataUrl) {
              const imageUrl = await apiService.uploadImageAndGetUrl(imageInfo.base64DataUrl)
              const converted = this.convertMessageForForwarding(message)
              await teacherStore.sendMessage(converted.content, { 
                filePath: imageUrl, width: imageInfo.width, height: imageInfo.height, fileSize: imageInfo.fileSize 
              }, message.sender)
              successCount++
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
        } else if (message.messageType === 'image' && message.imageData?.base64DataUrl) {
          const imageUrl = await apiService.uploadImageAndGetUrl(message.imageData.base64DataUrl)
          const converted = this.convertMessageForForwarding(message)
          await teacherStore.sendMessage(converted.content, { 
            filePath: imageUrl, width: message.imageData.width, height: message.imageData.height, fileSize: message.imageData.fileSize 
          }, message.sender)
          successCount++
        } else {
          const converted = this.convertMessageForForwarding(message)
          await teacherStore.sendMessage(converted.content, undefined, message.sender)
          successCount++
        }
      } catch (e) { 
        console.error(e) 
      }
      
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    return { successCount }
  }

  private convertMessageForForwarding(msg: ChatBubble) {
    let content = msg.content || ''
    if (msg.type === Sender.USER) content = '[学生]\n' + content
    else if (msg.type === Sender.AI) content = '[学伴]\n' + content
    return { id: msg.id, content, sender: msg.sender }
  }

  clearMessages(): void {
    useAiTextbookChatStore.getState().resetState()
  }
}
