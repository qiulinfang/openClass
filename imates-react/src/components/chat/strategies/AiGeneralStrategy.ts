import type { ChatBubble, AttachedScreenshot } from '@/types'
import { Sender } from '@/types/enums'
import { showMessage } from '@/utils'
import type { ChatStrategy, ForwardOptions, ForwardResult } from '@/components/chat/strategies/ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from '@/components/chat/strategies/types'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { apiService } from '@/services/http/api-service'
import { getSubject, getUserInfo } from '@/services/http/auth-service'

export class AiGeneralStrategy implements ChatStrategy {
  private chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return useAiGeneralChatStore.getState().inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    useAiGeneralChatStore.getState().setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    const store = useAiGeneralChatStore.getState()
    store.setInputAttachedScreenshots(store.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    useAiGeneralChatStore.getState().removeInputAttachedScreenshot(id)
  }

  clearInputAttachedScreenshots(): void {
    useAiGeneralChatStore.getState().clearInputAttachedScreenshots()
  }

  getInputScreenshotDrawingStates(): Record<string, unknown> {
    return useAiGeneralChatStore.getState().inputScreenshotDrawingStates
  }

  setInputScreenshotDrawingStates(states: Record<string, unknown>): void {
    useAiGeneralChatStore.getState().setInputScreenshotDrawingStates(states || {})
  }

  removeInputScreenshotDrawingState(id: string): void {
    if (!id) return
    const currentStates = useAiGeneralChatStore.getState().inputScreenshotDrawingStates || {}
    const next = { ...currentStates } as Record<string, unknown>
    if (id in next) {
      delete next[id]
      useAiGeneralChatStore.getState().setInputScreenshotDrawingStates(next)
    }
  }

  clearInputScreenshotDrawingStates(): void {
    useAiGeneralChatStore.getState().setInputScreenshotDrawingStates({})
  }
  
  getMessages(): ChatBubble[] {
    return useAiGeneralChatStore.getState().messages
  }
  
  async addMessage(message: ChatBubble): Promise<void> {
    const store = useAiGeneralChatStore.getState()
    store.messages.push(message)
    this.handleMessagesChanged(this.getMessages())
  }
  
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const skipUserMessage = !!options.imageData || !!(options.imageList && options.imageList.length > 0) || !!options.skipUserMessage
    const { getUserInfo, getSubject } = await import('@/services/http/auth-service')
    const userInfo = getUserInfo()
    const subject = getSubject()

    await useAiGeneralChatStore.getState().sendMessage(
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
    await useAiGeneralChatStore.getState().saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!useAiGeneralChatStore.getState().isChatLoading
  }
  
  canForwardMessage(): boolean {
    return true
  }
  
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null
  }
  
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      const session = await this.selectTeacherSession(options.onTeacherSelect)
      if (!session) return { success: false, error: '用户取消选择或会话创建失败' }
      
      const { successCount } = await this.forwardMessagesSeparately(messages, session.sessionId)
      
      if (successCount > 0) {
        const result: ForwardResult = { success: true, successCount, sessionId: session.sessionId }
        if (options.showDialog !== false && options.showForwardSuccessDialog) {
          const messageCount = result.successCount || 0
          const message = messageCount > 1
            ? `已成功转发 ${messageCount} 条消息给老师，是否前往老师对话查看？`
            : '消息已成功转发给老师，是否前往老师对话查看？'
          const dialogResult = await options.showForwardSuccessDialog(message, result.sessionId)
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

  private async selectTeacherSession(onTeacherSelect?: () => Promise<'biology' | 'math'>) {
    if (!onTeacherSelect) return null
    const selectedSubject = await onTeacherSelect()
    const subjectUpper = selectedSubject === 'biology' ? 'BIOLOGY' : 'MATH'
    const teacherStore = useTeacherChatStore.getState()
    const allSessions = teacherStore.loadAllSessions()
    const session = Object.values(allSessions).find(s => s.subject === subjectUpper)
    return session ? { sessionId: session.sessionId, sessionName: session.sessionName, subject: session.subject } : null
  }

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
  
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    return '发送消息...'
  }
  
  getCurrentSubject(): 'biology' | 'math' {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
  }

  async initialize(options: InitializeOptions): Promise<void> {
    if (!options.hasSelectedQuestion && useAiGeneralChatStore.getState().messages.length === 0) {
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

  shouldOptimisticSend(): boolean {
    return false
  }

  async sendVoiceMessage(_voiceInfo: any): Promise<{ success: boolean; message?: string }> {
    return { success: true }
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

  async updateEditedMessage(messageId: string, newContent: string, options?: SendMessageOptions): Promise<void> {
    const store = useAiGeneralChatStore.getState()
    const messages = store.messages
    const index = messages.findIndex(m => m.id === messageId)
    if (index === -1) return

    messages[index].content = newContent
    store.setMessages(messages.slice(0, index + 1))
    await store.saveChatHistory()

    const userInfo = getUserInfo()
    const subject = getSubject()
    await store.sendMessage(
      newContent,
      userInfo,
      subject,
      options?.selectedModel,
      true,
      options?.quotedMessage as any,
      options?.imageData,
      options?.imageList,
      options?.focus as any
    )
  }

  shouldShowForwardButton(): boolean {
    return true
  }

  setChatView(chatView: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  clearMessages(): void {
    useAiGeneralChatStore.getState().resetState()
  }

  getEnableWebSearch(): boolean {
    return useAiGeneralChatStore.getState().enableWebSearch
  }

  toggleWebSearch(): void {
    useAiGeneralChatStore.getState().toggleWebSearch()
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
}
