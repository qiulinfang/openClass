import type { ChatBubble, AttachedScreenshot, HtmlPreviewFocus } from '@/types'
import { Sender } from '@/types/enums'
import { showMessage } from '@/utils'
import type { ChatStrategy, ForwardOptions, ForwardResult } from '@/components/chat/strategies/ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from '@/components/chat/strategies/types'
import { useHtmlPreviewChatStore } from '@/stores/htmlPreviewChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { apiService } from '@/services/http/api-service'
import { getUserInfo, getSubject } from '@/services/http/auth-service'

export class HtmlPreviewStrategy implements ChatStrategy {
  private chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface
  disableHistorySave = true

  setChatView(chatView: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  getMessages(): ChatBubble[] {
    return useHtmlPreviewChatStore.getState().messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    const store = useHtmlPreviewChatStore.getState()
    store.setMessages([...store.messages, message])
    this.handleMessagesChanged(this.getMessages())
  }

  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    let focus: HtmlPreviewFocus | undefined = undefined
    if (typeof (window as any).__htmlPreview_getFocus === 'function') {
      try {
        focus = await (window as any).__htmlPreview_getFocus()
      } catch (e) {
        console.warn('[HtmlPreviewStrategy] 获取 focus 失败:', e)
      }
    }

    await useHtmlPreviewChatStore.getState().sendMessage(
      content,
      getUserInfo(),
      {
        selectedModel: options.selectedModel || 'mate',
        skipUserMessage: options.skipUserMessage,
        quotedMessage: options.quotedMessage as any,
        imageData: options.imageData,
        imageList: options.imageList,
        focus: focus || options.focus
      }
    )
  }

  async saveChatHistory(): Promise<void> {
    return
  }

  getWelcomeMessage(): string {
    return '你好！可以拖动 GeoGebra 图形到此处向我提问，我会帮你分析图形、解答问题。'
  }

  async initialize(options: InitializeOptions): Promise<void> {
    const store = useHtmlPreviewChatStore.getState()
    store.setMessages([])

    const welcomeMessage: ChatBubble = {
      id: 'welcome_' + Date.now(),
      content: this.getWelcomeMessage(),
      type: Sender.AI,
      timestamp: new Date().toISOString(),
      sender: Sender.AI,
    }
    await this.addMessage(welcomeMessage)
  }

  getCurrentSubject(): 'biology' | 'math' {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
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

  canForwardMessage(): boolean {
    return true
  }

  shouldOptimisticSend(): boolean {
    return false
  }

  async sendVoiceMessage(_voiceInfo: any): Promise<{ success: boolean; message?: string }> {
    return { success: true }
  }

  async sendImageMessage(imageInfo: any, textContent?: string, options?: SendMessageOptions): Promise<void> {
    const imageMessage: ChatBubble = {
      id: Date.now().toString(),
      content: '',
      type: Sender.USER,
      timestamp: new Date().toISOString(),
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

    await this.sendMessage(textContent || '', {
      ...options,
      imageData: imageMessage.imageData,
      skipUserMessage: true,
    })
  }

  shouldClearInputAfterImage(): boolean {
    return true
  }

  async updateEditedMessage(messageId: string, newContent: string, options?: { selectedModel?: string }): Promise<void> {
    let focus: HtmlPreviewFocus | undefined = undefined
    if (typeof (window as any).__htmlPreview_getFocus === 'function') {
      try {
        focus = await (window as any).__htmlPreview_getFocus()
      } catch (e) {
        console.warn('[HtmlPreviewStrategy] 获取 focus 失败:', e)
      }
    }

    await useHtmlPreviewChatStore.getState().editMessage(messageId, newContent, getUserInfo(), {
      selectedModel: options?.selectedModel,
      focus,
    })
  }

  shouldShowForwardButton(): boolean {
    return true
  }

  async deleteMessage(messageId: string): Promise<void> {
    await useHtmlPreviewChatStore.getState().deleteMessage(messageId)
  }

  async deleteSession(_sessionId: string): Promise<void> {
    useHtmlPreviewChatStore.getState().setMessages([])
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
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
          const displayMsg = messageCount > 1
              ? `已成功转发 ${messageCount} 条消息给老师，是否前往老师对话查看？`
              : '消息已成功转发给老师，是否前往老师对话查看？'

          const dialogResult = await options.showForwardSuccessDialog(displayMsg, session.sessionId)
          if (dialogResult?.goToTeacher && result.sessionId && options.onSuccess) {
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
    if (targetSession) teacherStore.setSession(targetSession)

    for (const message of messages) {
      try {
        const converted = this.convertMessageForForwarding(message)
        if (message.messageType === 'image' && message.imageData?.base64DataUrl) {
          const imageUrl = await apiService.uploadImageAndGetUrl(message.imageData.base64DataUrl)
          await teacherStore.sendMessage(converted.content, { 
            filePath: imageUrl, width: message.imageData.width, height: message.imageData.height, fileSize: message.imageData.fileSize 
          }, message.sender)
        } else {
          await teacherStore.sendMessage(converted.content, undefined, message.sender)
        }
        successCount++
      } catch (e) { console.error(e) }
    }
    return { successCount }
  }

  private convertMessageForForwarding(msg: ChatBubble) {
    let content = msg.content || ''
    if (msg.type === Sender.USER) content = '[学生]\n' + content
    else if (msg.type === Sender.AI) content = '[学伴]\n' + content
    return { id: msg.id, content, sender: msg.sender }
  }

  getPlaceholderText(_hasSelectedQuestion: boolean): string {
    return '请输入问题...'
  }

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return useHtmlPreviewChatStore.getState().inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    useHtmlPreviewChatStore.getState().setInputAttachedScreenshots(shots)
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    const store = useHtmlPreviewChatStore.getState()
    store.setInputAttachedScreenshots(store.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    const store = useHtmlPreviewChatStore.getState()
    store.setInputAttachedScreenshots(store.inputAttachedScreenshots.filter(s => s.id !== id))
  }

  clearInputAttachedScreenshots(): void {
    useHtmlPreviewChatStore.getState().setInputAttachedScreenshots([])
  }

  buildImagePayloadFromAttachedScreenshots(shots: AttachedScreenshot[]) {
    if (shots.length === 0) return {}
    return {
      imageList: shots.map(s => ({
        base64DataUrl: s.dataUrl,
        width: s.width,
        height: s.height,
        fileSize: 0,
        filePath: ''
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

  getMaxAttachedImages(): number {
    return 3
  }

  getEnableWebSearch(): boolean {
    return useHtmlPreviewChatStore.getState().enableWebSearch
  }

  toggleWebSearch(): void {
    useHtmlPreviewChatStore.getState().toggleWebSearch()
  }

  private handleMessagesChanged(newMessages: ChatBubble[]): void {
    if (!this.chatView || !newMessages || newMessages.length === 0) return
    this.chatView.checkIfUserAtBottom()
    if (this.chatView.getIsUserAtBottom()) {
      this.chatView.scrollToBottom()
      this.chatView.setShowNewMessageIndicator(false)
    } else {
      this.chatView.setShowNewMessageIndicator(true)
    }
  }

  clearMessages(): void {
    useHtmlPreviewChatStore.getState().setMessages([])
  }
}
