import type { ChatBubble, AttachedScreenshot } from '@/types'
import { Sender } from '@/types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult } from '@/components/chat/strategies/ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from '@/components/chat/strategies/types'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useQuestionStore } from '@/stores/questionStore'
import { getUserInfo, getSubject, getUserId } from '@/services/http/auth-service'
import { apiService } from '@/services/http/api-service'
import { normalizeSubject } from '@/constants/subjects'
import { generateUniqueId } from '@/stores/utils/chatStoreUtils'
import { showMessage } from '@/utils'

export class AiExerciseStrategy implements ChatStrategy {
  private chatView?: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface

  private get store() {
    return useAiExerciseChatStore.getState()
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
    useAiExerciseChatStore.getState().addMessage(message)
    const currentQuestion = useQuestionStore.getState().getCurrentQuestion()
    if (currentQuestion?.bmNo) {
      await useAiExerciseChatStore.getState().saveChatHistory(currentQuestion.bmNo)
    }
    this.handleMessagesChanged(this.getMessages())
  }

  shouldShowForwardButton(): boolean {
    return true
  }
  
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const currentQuestion = options.currentQuestion as unknown | undefined
    if (!currentQuestion) {
      throw new Error('请先选择题目')
    }

    const hidePrefix = content.includes('我们开始吧')

    try {
      const q = currentQuestion as any
      const s = normalizeSubject((q?.subject ?? '').toString().trim())
      const requestSubject = s === 'math' ? 'MATH' : s === 'biology' ? 'BIOLOGY' : null
      if (!requestSubject) {
        throw new Error('无法确定题目学科')
      }

      await this.store.sendMessage(
        content,
        currentQuestion as any,
        getUserInfo(),
        requestSubject,
        options.selectedModel || 'mate',
        options.imageData,
        hidePrefix,
        options.skipUserMessage,
        options.quotedMessage as any,
        options.imageList,
        options.focus as any,
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '参数验证失败'
      if (errorMessage.includes('缺失题目场景必填字段')) {
        const errorReply: ChatBubble = {
          id: generateUniqueId('error_ai'),
          content: `抱歉，当前题目信息不完整，无法进行对话。错误详情：${errorMessage}`,
          type: Sender.AI,
          timestamp: new Date().toISOString(),
          sender: Sender.AI,
          isStreaming: false,
          selectedModel: options.selectedModel || 'mate'
        }
        this.addMessage(errorReply)
        return
      }
      throw error
    }
  }
  
  getWelcomeMessage(): string {
    return '你好！让我来帮你解答这道题目。'
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
  
  async saveChatHistory(questionBmNo?: string): Promise<void> {
    const bmNo = questionBmNo || useQuestionStore.getState().getCurrentQuestion()?.bmNo
    if (bmNo) {
      await useAiExerciseChatStore.getState().saveChatHistory(bmNo)
    }
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
    const currentQuestion = useQuestionStore.getState().getCurrentQuestion()
    if (!currentQuestion) return { success: false, error: '请先选择题目' }

    const teacherSessionId = (options as any).sessionId || `teacher_${getUserId()}_${normalizeSubject(currentQuestion.subject || 'math')}`
    
    try {
      const result = await this.forwardMessagesSeparately(messages, teacherSessionId)
      return { success: true, successCount: result.successCount }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '转发失败' }
    }
  }
  
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    return hasSelectedQuestion ? '发送消息...' : '请先选择一道题目'
  }
  
  getCurrentSubject(): 'biology' | 'math' {
    return 'biology'
  }
  
  async initialize(options: InitializeOptions): Promise<void> {
    if (options.currentQuestionId) {
      await this.store.loadChatHistory(options.currentQuestionId)
    }
  }

  shouldOptimisticSend(): boolean {
    return true
  }
  
  async sendVoiceMessage(voiceInfo: { filePath: string; duration: number; fileSize: number }): Promise<{ success: boolean; message?: string }> {
    return { success: false, message: '未实现' }
  }
  
  shouldClearInputAfterImage(): boolean {
    return true
  }
  
  async sendImageMessage(imageInfo: { filePath: string; width: number; height: number; fileSize: number; base64DataUrl?: string }, textContent?: string, options?: SendMessageOptions): Promise<void> {
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

  supportsImagePicker(): boolean { return true }
  supportsScreenshotAttach(): boolean { return true }
  getMaxAttachedImages(): number { return 9 }
  buildImagePayloadFromAttachedScreenshots(shots: AttachedScreenshot[]) {
    if (shots.length === 0) return {}
    if (shots.length === 1) {
      return { 
        imageData: { 
          filePath: '', 
          base64DataUrl: shots[0].dataUrl, 
          width: shots[0].width, 
          height: shots[0].height, 
          fileSize: 0 
        } 
      }
    }
    return { 
      imageList: shots.map(shot => ({ 
        filePath: '', 
        base64DataUrl: shot.dataUrl, 
        width: shot.width, 
        height: shot.height, 
        fileSize: 0 
      })) 
    }
  }
  shouldAnnotateAfterCrop(): boolean { return true }
  getImagePostProcessMode(): 'attach_to_input' | 'send_immediately' { return 'attach_to_input' }
  getScreenshotEntryKind(): 'screen_snapshot' | 'pdf_page' { return 'screen_snapshot' }

  async updateEditedMessage(messageId: string, newContent: string, options?: SendMessageOptions): Promise<void> {
    const messages = this.store.messages
    const index = messages.findIndex(m => m.id === messageId)
    if (index === -1) return
    messages[index].content = newContent
    this.store.setMessages(messages.slice(0, index + 1))
    await this.saveChatHistory()
    await this.sendMessage(newContent, { ...options, skipUserMessage: true })
  }

  getSessionCards(): unknown[] {
    return (this.store as any).getSessionCards?.() || []
  }

  async createNewSession(options?: { currentQuestion?: unknown }): Promise<void> {
    const q = (options?.currentQuestion ?? null) as { bmNo?: string } | null
    const bmNo = q?.bmNo
    if (!bmNo) throw new Error('请先选择题目')
    await this.store.createNewSession(bmNo)
  }

  async switchToSession(sessionId: string): Promise<void> {
    await this.store.switchToSession(sessionId)
  }

  async deleteSession(sessionId: string, options?: { currentQuestion?: unknown }): Promise<void> {
    const q = (options?.currentQuestion ?? null) as { bmNo?: string } | null
    const bmNo = q?.bmNo || ''
    await this.store.deleteSession(sessionId, bmNo)
  }

  getEnableWebSearch(): boolean {
    return (this.store as any).enableWebSearch
  }

  toggleWebSearch(): void {
    (this.store as any).toggleWebSearch?.()
  }

  setChatView(chatView: import('@/components/chat/strategies/ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  clearMessages(): void {
    this.store.clearMessages()
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

  onQuestionChanged(newQuestion: unknown, oldQuestion: unknown): void {
    if (!this.chatView) return
    if ((newQuestion as any)?.bmNo !== (oldQuestion as any)?.bmNo) {
      if (this.chatView.getIsEditingMessage()) {
        if (this.chatView.getEditingQuestionId() && newQuestion && (newQuestion as any).bmNo === this.chatView.getEditingQuestionId()) {
          this.chatView.executeQuestionSwitch()
          return
        }
        this.chatView.cancelEditMessage()
        this.chatView.clearInputContent()
        this.chatView.executeQuestionSwitch()
      } else {
        this.chatView.executeQuestionSwitch()
      }
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
      } catch (e) { console.error(e) }
      
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
}
