import type { ChatBubble, AttachedScreenshot } from '@/types'
import { Sender } from '@/types/enums'
import { showMessage } from '@/utils'
import type { ChatStrategy, ForwardOptions, ForwardResult } from '@/components/chat/strategies/ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from '@/components/chat/strategies/types'
import { useAiHomeworkChatStore } from '@/stores/aiHomeworkChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { apiService } from '@/services/http/api-service'
import { getUserInfo, getSubject } from '@/services/http/auth-service'
import { normalizeSubject } from '@/constants/subjects'

export class AiHomeworkStrategy implements ChatStrategy {
  private chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return useAiHomeworkChatStore.getState().inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    useAiHomeworkChatStore.getState().setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    const store = useAiHomeworkChatStore.getState()
    store.setInputAttachedScreenshots(store.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    useAiHomeworkChatStore.getState().removeInputAttachedScreenshot(id)
  }

  clearInputAttachedScreenshots(): void {
    useAiHomeworkChatStore.getState().clearInputAttachedScreenshots()
  }

  getInputScreenshotDrawingStates(): Record<string, unknown> {
    return useAiHomeworkChatStore.getState().inputScreenshotDrawingStates
  }

  setInputScreenshotDrawingStates(states: Record<string, unknown>): void {
    useAiHomeworkChatStore.getState().setInputScreenshotDrawingStates(states || {})
  }

  removeInputScreenshotDrawingState(id: string): void {
    if (!id) return
    const store = useAiHomeworkChatStore.getState()
    const next = { ...(store.inputScreenshotDrawingStates || {}) } as Record<string, unknown>
    if (id in next) {
      delete next[id]
      store.setInputScreenshotDrawingStates(next)
    }
  }

  clearInputScreenshotDrawingStates(): void {
    useAiHomeworkChatStore.getState().setInputScreenshotDrawingStates({})
  }
  
  getMessages(): ChatBubble[] {
    return useAiHomeworkChatStore.getState().messages
  }
  
  async addMessage(message: ChatBubble): Promise<void> {
    const store = useAiHomeworkChatStore.getState()
    store.messages.push(message)
    this.handleMessagesChanged(this.getMessages())
  }
  
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const skipUserMessage = !!options.imageData || !!(options.imageList && options.imageList.length > 0) || !!options.skipUserMessage
    const formattedQuotedMessage = options.quotedMessage 
      ? {
          ...options.quotedMessage,
          sender: options.quotedMessage.sender as unknown as Sender
        }
      : undefined

    await useAiHomeworkChatStore.getState().sendMessage(
      content,
      getUserInfo(),
      getSubject() as 'MATH' | 'BIOLOGY',
      (options.currentQuestion as any) || null,
      options.selectedModel || 'mate',
      skipUserMessage,
      formattedQuotedMessage as any,
      options.imageData,
      options.imageList,
      options.focus as any,
      options.displayContent,
    )
  }
  
  getWelcomeMessage(): string {
    return '你好！我是你的学习伙伴。针对这道作业题，有什么我可以帮你的吗？'
  }
  
  requiresQuestion(): boolean {
    return true
  }
  
  getMessageType(): Sender {
    return Sender.AI
  }
  
  getSenderType(): Sender {
    return Sender.AI
  }
  
  async saveChatHistory(): Promise<void> {
    await useAiHomeworkChatStore.getState().saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!useAiHomeworkChatStore.getState().isChatLoading
  }
  
  canForwardMessage(): boolean {
    return true
  }
  
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
  }
  
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      const subject = this.getCurrentSubjectForForward()
      if (!subject) return { success: false, error: '无法确定当前作业科目，请重试' }

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
    if (options.currentQuestionId) {
      await useAiHomeworkChatStore.getState().setQuestionContext(options.currentQuestionId)
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
    const store = useAiHomeworkChatStore.getState()
    const messages = store.messages
    const index = messages.findIndex(m => m.id === messageId)
    if (index === -1) return
    messages[index].content = newContent
    store.setMessages(messages.slice(0, index + 1))
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

  setChatView(chatView: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  onQuestionChanged(newQuestion: any): void {
    if (newQuestion?.bmNo) {
      useAiHomeworkChatStore.getState().setQuestionContext(newQuestion.bmNo)
    }
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

  clearMessages(): void {
    useAiHomeworkChatStore.getState().resetState()
  }
}
