import type { ChatBubble, ExerciseItem } from '../../../types'
import { showMessage } from '../../../utils'
import { Sender } from '../../../types/enums'
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
      options.displayContent,
    )
  }
  
  getWelcomeMessage(): string {
    return '你好！我是你的学习伙伴。针对这道作业题，有什么我可以帮你的吗？'
  }
  
  requiresQuestion(): boolean {
    return true // 作业对话必须有关联题目
  }
  
  getMessageType(): Sender {
    return Sender.AI
  }
  
  getSenderType(): Sender {
    return Sender.AI
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
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
  }
  
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 1. 自动确定科目
      const subject = this.getCurrentSubjectForForward()
      if (!subject) {
        return {
          success: false,
          error: '无法确定当前作业科目，请重试',
        }
      }

      // 2. 从写死会话中选择对应的会话
      const teacherStore = useTeacherChatStore()
      const allSessions = teacherStore.loadAllSessions()
      const subjectUpper = subject === 'math' ? 'MATH' : 'BIOLOGY'
      const session = Object.values(allSessions).find((s) => s.subject === subjectUpper)

      if (!session) {
        return {
          success: false,
          error: `未找到${subject === 'math' ? '数学' : '生物'}科目的教师会话`,
        }
      }

      // 3. 逐条转发消息到通用会话
      const { successCount } = await this.forwardMessagesSeparately(messages, session.sessionId)

      if (successCount > 0) {
        const result: ForwardResult = {
          success: true,
          successCount,
          sessionId: session.sessionId,
        }

        // 显示成功提示或对话框
        if (options.showDialog !== false && options.showForwardSuccessDialog) {
          const msg =
            successCount > 1
              ? `已成功转发 ${successCount} 条消息给老师，是否前往老师对话查看？`
              : '消息已成功转发给老师，是否前往老师对话查看？'

          const dialogResult = await options.showForwardSuccessDialog(msg, session.sessionId)
          if (dialogResult?.goToTeacher && options.onSuccess) {
            await options.onSuccess(result)
          }
        } else {
          if (options.onSuccess) {
            await options.onSuccess(result)
          }
        }

        return result
      } else {
        const error = '转发失败，请重试'
        if (options.onError) {
          options.onError(error)
        }
        return {
          success: false,
          error,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (options.onError) {
        options.onError(errorMessage)
      }
      return {
        success: false,
        error: errorMessage,
      }
    }
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

  // ========== 转发消息相关私有方法 ==========

  /**
   * 转换消息格式用于转发
   */
  private convertMessageForForwarding(msg: ChatBubble) {
    // 获取数据类型，默认为text
    const dataType = msg.messageType || 'text'
    const messageType = dataType.toUpperCase() // text -> TEXT, voice -> VOICE, image -> IMAGE
    let messageContent = msg.content || ''

    // 根据角色类型添加前缀，但保留完整格式
    if (msg.type === Sender.USER) {
      messageContent = '[学生]\n' + messageContent
    } else if (msg.type === Sender.AI) {
      messageContent = '[学伴]\n' + messageContent
    }

    // 直接返回原内容，不清理任何格式，保留完整的 Markdown 和 LaTeX
    const result = {
      id: msg.id,
      type: messageType,
      sender: msg.sender,
      content: messageContent,
      timestamp: '',
    }

    return result
  }

  /**
   * 创建图片转发消息
   */
  private createImageForwardMessage(originalMessage: ChatBubble, imageInfo: any): ChatBubble {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 根据原消息类型生成转发内容
    let forwardContent: string
    if (originalMessage.type === Sender.AI) {
      forwardContent = '[学伴]\n[图片消息]'
    } else if (originalMessage.type === Sender.USER) {
      forwardContent = '[学生]\n[图片消息]'
    } else {
      forwardContent = '[图片消息]'
    }

    return {
      id: messageId,
      messageId: messageId,
      content: forwardContent,
      type: originalMessage.sender,
      timestamp: new Date().toISOString(),
      sender: originalMessage.sender,
      messageType: 'image',
      imageData: {
        filePath: imageInfo.filePath || '',
        width: imageInfo.width || 0,
        height: imageInfo.height || 0,
        fileSize: imageInfo.fileSize || 0,
        base64DataUrl: imageInfo.base64DataUrl,
      },
    }
  }

  /**
   * 逐条转发消息
   */
  private async forwardMessagesSeparately(
    messages: ChatBubble[],
    sessionId: string
  ): Promise<{ successCount: number; totalCount: number }> {
    const teacherStore = useTeacherChatStore()
    let successCount = 0

    // 确保当前会话设置正确
    const allSessions = teacherStore.loadAllSessions()
    const targetSession = allSessions[sessionId]
    if (targetSession) {
      teacherStore.setSession(targetSession)
    }

    // 检查WebSocket连接状态，如果未连接则主动建立连接
    const { getWebSocketService } = await import('../../../services/websocket/webSocketService')
    const webSocket = getWebSocketService('teacher')
    if (!webSocket.isConnected()) {
      console.log('[AiHomeworkStrategy] WebSocket未连接，批量转发前先建立连接...')
      const connected = await teacherStore.connectWebSocket()
      if (!connected) {
        console.error('[AiHomeworkStrategy] WebSocket连接失败，无法进行批量转发')
        return { successCount: 0, totalCount: messages.length }
      }

      // 连接成功后加载聊天历史（分页加载）
      console.log('[AiHomeworkStrategy] 加载教师会话历史记录...')
      await teacherStore.activateTeacherSession(sessionId, { connect: false, loadHistory: true })
    }

    for (const message of messages) {
      try {
        if (message.messageType === 'multi_image' && message.imageList?.length) {
          console.log(`[转发] 多图消息: ${message.imageList.length}张图片`)
          // 多图消息：每张图片转为独立消息
          for (const imageInfo of message.imageList) {
            if (imageInfo.base64DataUrl) {
              // 先上传图片获得URL
              const imageUrl = await apiService.uploadImageAndGetUrl(imageInfo.base64DataUrl)

              const imageMessage = this.createImageForwardMessage(message, {
                ...imageInfo,
                filePath: imageUrl, // 使用上传获得的URL
              })

              teacherStore.addMessage(imageMessage)
              console.log(`[发送] 图片URL: ${imageUrl}`)

              // 发送URL而不是base64数据
              await teacherStore.sendMessage(imageMessage.content, {
                filePath: imageUrl, // 发送URL
                width: imageInfo.width,
                height: imageInfo.height,
                fileSize: imageInfo.fileSize,
                base64DataUrl: undefined, // 不发送base64数据
              })

              successCount++
              console.log(`[AiHomeworkStrategy] ✅ 转发图片消息成功 (${successCount})`)

              // 图片间延迟，避免发送过快
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          }
        } else if (message.messageType === 'image' && message.imageData) {
          // 单图消息：先上传获得URL再转发
          const convertedMessage = this.convertMessageForForwarding(message)
          const forwardContent = convertedMessage.content
          console.log(`[转发] 单图消息: ${forwardContent}`)

          // 先上传图片获得URL
          const imageUrl = await apiService.uploadImageAndGetUrl(message.imageData.base64DataUrl || '')

          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const forwardMessage: ChatBubble = {
            id: messageId,
            messageId: messageId,
            content: forwardContent,
            type: message.sender,
            timestamp: new Date().toISOString(),
            sender: message.sender,
            messageType: 'image',
            imageData: {
              ...message.imageData,
              filePath: imageUrl, // 使用上传获得的URL
              base64DataUrl: undefined, // 清空base64数据
            },
          }

          teacherStore.addMessage(forwardMessage)
          console.log(`[发送] 图片URL: ${imageUrl}`)
          await teacherStore.sendMessage(
            forwardContent,
            {
              filePath: imageUrl, // 发送URL
              width: message.imageData.width,
              height: message.imageData.height,
              fileSize: message.imageData.fileSize,
              base64DataUrl: undefined, // 不发送base64数据
            },
            message.sender
          )
          successCount++

          console.log(`[AiHomeworkStrategy] ✅ 转发单图消息成功 (${successCount})`)
        } else {
          // 文本消息：正常转发
          const convertedMessage = this.convertMessageForForwarding(message)
          const forwardContent = convertedMessage.content
          console.log(`[转发] 文本消息: ${forwardContent}`)

          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const forwardMessage: ChatBubble = {
            id: messageId,
            messageId: messageId,
            content: forwardContent,
            type: message.sender,
            timestamp: new Date().toISOString(),
            sender: message.sender,
            messageType: 'text',
          }

          teacherStore.addMessage(forwardMessage)
          console.log(`[发送] 文本消息: ${forwardContent}`)
          await teacherStore.sendMessage(forwardContent, undefined, message.sender)
          successCount++

          console.log(`[AiHomeworkStrategy] ✅ 转发文本消息成功 (${successCount})`)
        }
      } catch (error) {
        console.error(`[AiHomeworkStrategy] ❌ 转发消息失败:`, error)
      }

      // 消息间延迟
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }

    console.log(`[AiHomeworkStrategy] ✅ 批量转发完成: ${successCount}/${messages.length} 条消息`)
    return { successCount, totalCount: messages.length }
  }
}
