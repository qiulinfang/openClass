import type { ChatBubble, AttachedScreenshot } from '@/types'
import { Sender } from '@/types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult } from '@/components/chat/strategies/ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from '@/components/chat/strategies/types'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { getUserId } from '@/services/http/auth-service'
import { showMessage } from '@/utils'

export class TeacherStrategy implements ChatStrategy {
  private chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface

  getMessages(): ChatBubble[] {
    return useTeacherChatStore.getState().messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    const store = useTeacherChatStore.getState()
    store.addMessage(message)
    this.handleMessagesChanged(this.getMessages())
  }

  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    try {
      await useTeacherChatStore.getState().sendMessage(content, options.imageData)
    } catch (error) {
      console.error('[TeacherStrategy] 发送消息失败:', error)
      const errorMessage: ChatBubble = {
        id: (Date.now() + 1).toString(),
        content: '消息发送失败，请重试',
        type: Sender.TEACHER,
        timestamp: '',
        sender: Sender.TEACHER,
        isError: true
      }
      await this.addMessage(errorMessage)
      throw error
    }
  }

  getWelcomeMessage(): string {
    const session = useTeacherChatStore.getState().currentSession
    const subject = session?.subject === 'BIOLOGY' ? '生物' : '数学'
    return `你好！我是你的${subject}老师。有什么问题可以问我。`
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

  async saveChatHistory(): Promise<void> {
    await useTeacherChatStore.getState().saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!useTeacherChatStore.getState().isChatLoading
  }

  canForwardMessage(): boolean {
    return false
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null
  }

  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    return { success: false, error: '老师对话不支持转发消息' }
  }

  getPlaceholderText(hasSelectedQuestion: boolean): string {
    return '向老师提问...'
  }

  getCurrentSubject(): 'biology' | 'math' {
    const userId = getUserId()
    const teacherSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
    return teacherSubject === 'BIOLOGY' ? 'biology' : 'math'
  }

  async initialize(options: InitializeOptions): Promise<void> {
    const store = useTeacherChatStore.getState()
    if (store.currentSession) return

    try {
      const userId = getUserId()
      const teacherSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
      const subject = (teacherSubject === 'BIOLOGY' ? 'BIOLOGY' : 'MATH') as 'BIOLOGY' | 'MATH'
      const sessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const subjectName = teacherSubject === 'BIOLOGY' ? '生物' : '数学'

      store.setSession({
        sessionId,
        sessionName: subjectName,
        subject,
        createTime: Date.now()
      })

      await store.loadTeacherChatHistoryFromServer(sessionId)
    } catch (error) {
      console.error('[TeacherStrategy] 初始化教师会话失败:', error)
      throw error
    }
  }

  shouldOptimisticSend(): boolean {
    return true
  }

  async sendVoiceMessage(_voiceInfo: any): Promise<{ success: boolean; message?: string }> {
    return { success: false, message: '教师对话不支持发送语音消息' }
  }

  shouldClearInputAfterImage(): boolean {
    return false
  }

  async sendImageMessage(imageInfo: any, textContent?: string, options?: SendMessageOptions): Promise<void> {
    const imageMessage: ChatBubble = {
      id: Date.now().toString(),
      content: '',
      type: Sender.USER,
      timestamp: '',
      sender: Sender.USER,
      messageType: 'image',
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrl: imageInfo.base64DataUrl,
      },
    }
    
    await this.addMessage(imageMessage)
    
    if (!imageInfo.filePath || !imageInfo.base64DataUrl) {
      throw new Error('图片数据不完整，请重试')
    }
    
    await this.sendMessage('', {
      imageData: imageMessage.imageData,
    })
  }

  supportsImagePicker(): boolean {
    return true
  }

  supportsScreenshotAttach(): boolean {
    return false
  }

  getMaxAttachedImages(): number {
    return 9
  }

  buildImagePayloadFromAttachedScreenshots(shots: AttachedScreenshot[]) {
    return {}
  }

  shouldAnnotateAfterCrop(): boolean {
    return false
  }

  getImagePostProcessMode(): 'attach_to_input' | 'send_immediately' {
    return 'attach_to_input'
  }

  getScreenshotEntryKind(): 'screen_snapshot' | 'pdf_page' {
    return 'screen_snapshot'
  }

  async updateEditedMessage(messageId: string, newContent: string, options?: SendMessageOptions): Promise<void> {
    const store = useTeacherChatStore.getState()
    const messages = store.messages
    const index = messages.findIndex((msg: ChatBubble) => msg.id === messageId)
    if (index === -1) return
    
    messages[index].content = newContent
    const messagesToKeep = messages.slice(0, index + 1)
    store.setMessages(messagesToKeep)
    await this.saveChatHistory()
  }

  shouldShowForwardButton(): boolean {
    return false
  }

  cleanup(): void {
    if (typeof window !== 'undefined' && (window as any).AndroidBridge?.cleanupTeacherMessageListener) {
      try {
        (window as any).AndroidBridge.cleanupTeacherMessageListener()
      } catch {}
    }
  }

  setChatView(chatView: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  private handleMessagesChanged(newMessages: ChatBubble[]): void {
    if (!this.chatView || !newMessages || newMessages.length === 0) return
    this.chatView.checkIfUserAtBottom()
    
    if (this.chatView.getIsKeyboardVisible() || this.chatView.getIsKeyboardAnimating()) {
      this.chatView.scrollToBottom()
      this.chatView.setShowNewMessageIndicator(false)
    } else {
      if (newMessages.length > this.chatView.getLastMessageCount() && !this.chatView.getIsUserAtBottom()) {
        this.chatView.setShowNewMessageIndicator(true)
      } else if (this.chatView.getIsUserAtBottom()) {
        this.chatView.scrollToBottom()
        this.chatView.setShowNewMessageIndicator(false)
      }
    }
  }

  onQuestionChanged(newQuestion: unknown, oldQuestion: unknown): void {
    if (!this.chatView) return
    if ((newQuestion as any)?.bmNo !== (oldQuestion as any)?.bmNo) {
      if (this.chatView.getIsEditingMessage()) {
        this.chatView.cancelEditMessage()
        this.chatView.clearInputContent()
      }
      this.chatView.executeQuestionSwitch()
    }
  }

  clearMessages(): void {
    useTeacherChatStore.getState().clearMessages()
  }
}
