/**
 * HtmlPreview 聊天策略
 * 用于 HtmlPreviewView 中的聊天面板
 * 特点：不加载历史、不保存历史
 */

import { Sender } from '../../../types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult } from './ChatStrategy'
import type { InitializeOptions, SendMessageOptions } from './types'
import type { ChatBubble, AttachedScreenshot, HtmlPreviewFocus } from '@/types'
import { useHtmlPreviewChatStore } from '@/stores/htmlPreviewChatStore'
import { getUserInfo, getSubject } from '@/services'

export class HtmlPreviewStrategy implements ChatStrategy {
  private htmlPreviewStore = useHtmlPreviewChatStore()
  private chatView?: import('./ChatStrategy').ChatViewInterface
  disableHistorySave = true

  setChatView(chatView: import('./ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  getMessages(): ChatBubble[] {
    return this.htmlPreviewStore.messages
  }

  async addMessage(message: ChatBubble): Promise<void> {
    this.htmlPreviewStore.messages.push(message)
    this.handleMessagesChanged(this.getMessages())
  }

  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    console.log('[HtmlPreviewStrategy] sendMessage 被调用:', { content, options })
    // 获取实时上下文 (GeoGebra 状态等) —— 策略层负责获取 UI 相关的实时上下文
    let focus: HtmlPreviewFocus | undefined = undefined
    if (typeof (window as any).__htmlPreview_getFocus === 'function') {
      try {
        focus = await (window as any).__htmlPreview_getFocus()
        console.log('[HtmlPreviewStrategy] 获取到实时 focus:', focus)
      } catch (e) {
        console.warn('[HtmlPreviewStrategy] 获取 focus 失败:', e)
      }
    }

    // 调用下沉后的核心发送逻辑
    console.log('[HtmlPreviewStrategy] 调用 store.sendMessage')
    await this.htmlPreviewStore.sendMessage(
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
    // HTML 预览不保存历史
    return
  }

  getWelcomeMessage(): string {
    return '你好！可以拖动 GeoGebra 图形到此处向我提问，我会帮你分析图形、解答问题。'
  }

  async initialize(options: InitializeOptions): Promise<void> {
    console.log('[HtmlPreviewStrategy] initialize 被调用, options:', options)
    console.log('[HtmlPreviewStrategy] initialize 时 store.sessionId =', this.htmlPreviewStore.sessionId)

    // 不加载历史：清空当前消息列表
    this.htmlPreviewStore.messages = []

    // 添加欢迎消息
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

  async sendVoiceMessage(_voiceInfo: { filePath: string; duration: number; fileSize: number }): Promise<{ success: boolean; message?: string }> {
    return { success: true }
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
    // 创建图片消息
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

    // 发送图片消息给AI
    if (!imageInfo.base64DataUrl) {
      throw new Error('图片数据不完整，请重试')
    }

    await this.sendMessage(textContent || '', {
      selectedModel: options?.selectedModel,
      imageData: {
        filePath: imageInfo.filePath,
        width: imageInfo.width,
        height: imageInfo.height,
        fileSize: imageInfo.fileSize,
        base64DataUrl: imageInfo.base64DataUrl,
      },
      skipUserMessage: true, // 因为前面手动加了 imageMessage，这里让 store 跳过默认文本消息创建
    })
  }

  shouldClearInputAfterImage(): boolean {
    return true
  }

  async updateEditedMessage(
    messageId: string,
    newContent: string,
    options?: { selectedModel?: string }
  ): Promise<void> {
    // 获取实时上下文 (GeoGebra 状态等)
    let focus: HtmlPreviewFocus | undefined = undefined
    if (typeof (window as any).__htmlPreview_getFocus === 'function') {
      try {
        focus = await (window as any).__htmlPreview_getFocus()
      } catch (e) {
        console.warn('[HtmlPreviewStrategy] 获取 focus 失败:', e)
      }
    }

    // 完全委托给 Store 处理消息数组变更和重新发送
    await this.htmlPreviewStore.editMessage(messageId, newContent, getUserInfo(), {
      selectedModel: options?.selectedModel,
      focus,
    })
  }

  shouldShowForwardButton(): boolean {
    return true
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.htmlPreviewStore.deleteMessage(messageId)
  }

  async retryMessage(messageId: string): Promise<void> {
    await this.htmlPreviewStore.retryMessage(
      messageId,
      getUserInfo(),
      'mate'
    )
  }

  async deleteSession(_sessionId: string, _options?: { currentQuestion?: unknown }): Promise<void> {
    this.htmlPreviewStore.messages = []
  }

  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
  }

  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 1. 用户手动选择科目
      const session = await this.selectTeacherSession(options.onTeacherSelect)
      if (!session) {
        return {
          success: false,
          error: '用户取消选择或会话创建失败',
        }
      }

      // 2. 逐条转发消息到通用会话
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

  /**
   * 逐条转发消息
   */
  async forwardMessagesSeparately(
    messages: ChatBubble[],
    sessionId: string
  ): Promise<{ successCount: number; totalCount: number }> {
    const teacherStore = (await import('../../../stores/teacherChatStore')).useTeacherChatStore()
    const { apiService } = await import('../../../services/http/api-service')
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
      console.log('[HtmlPreviewStrategy] WebSocket未连接，批量转发前先建立连接...')
      const connected = await teacherStore.connectWebSocket()
      if (!connected) {
        console.error('[HtmlPreviewStrategy] WebSocket连接失败，无法进行批量转发')
        return { successCount: 0, totalCount: messages.length }
      }

      // 连接成功后加载聊天历史
      console.log('[HtmlPreviewStrategy] 加载教师会话历史记录...')
      await teacherStore.activateTeacherSession(sessionId, { connect: false, loadHistory: true })
    }

    for (const message of messages) {
      try {
        if (message.messageType === 'multi_image' && message.imageList?.length) {
          // 多图消息：每张图片转为独立消息
          for (const imageInfo of message.imageList) {
            if (imageInfo.base64DataUrl) {
              const imageUrl = await apiService.uploadImageAndGetUrl(imageInfo.base64DataUrl)
              const imageMessage = this.createImageForwardMessage(message, { ...imageInfo, filePath: imageUrl })
              teacherStore.addMessage(imageMessage)
              await teacherStore.sendMessage(imageMessage.content, {
                filePath: imageUrl,
                width: imageInfo.width,
                height: imageInfo.height,
                fileSize: imageInfo.fileSize,
              })
              successCount++
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          }
        } else if (message.messageType === 'image' && message.imageData) {
          const convertedMessage = this.convertMessageForForwarding(message)
          const imageUrl = await apiService.uploadImageAndGetUrl(message.imageData.base64DataUrl || '')
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const forwardMessage: ChatBubble = {
            id: messageId,
            messageId,
            content: convertedMessage.content,
            type: message.sender,
            timestamp: new Date().toISOString(),
            sender: message.sender,
            messageType: 'image',
            imageData: { ...message.imageData, filePath: imageUrl, base64DataUrl: undefined },
          }
          teacherStore.addMessage(forwardMessage)
          await teacherStore.sendMessage(convertedMessage.content, {
            filePath: imageUrl,
            width: message.imageData.width,
            height: message.imageData.height,
            fileSize: message.imageData.fileSize,
          }, message.sender)
          successCount++
        } else {
          const convertedMessage = this.convertMessageForForwarding(message)
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const forwardMessage: ChatBubble = {
            id: messageId,
            messageId,
            content: convertedMessage.content,
            type: message.sender,
            timestamp: new Date().toISOString(),
            sender: message.sender,
            messageType: 'text',
          }
          teacherStore.addMessage(forwardMessage)
          await teacherStore.sendMessage(convertedMessage.content, undefined, message.sender)
          successCount++
        }
      } catch (error) {
        console.error('[HtmlPreviewStrategy] 转发消息失败:', error)
      }
      if (messages.indexOf(message) < messages.length - 1) await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return { successCount, totalCount: messages.length }
  }

  /**
   * 选择老师会话
   */
  private async selectTeacherSession(onTeacherSelect?: () => Promise<'biology' | 'math'>): Promise<{ sessionId: string; sessionName: string; subject: string } | null> {
    if (!onTeacherSelect) {
      console.error('[HtmlPreviewStrategy] 未提供老师选择回调函数')
      return null
    }

    try {
      const selectedSubject = await onTeacherSelect()
      const subjectUpper = selectedSubject === 'biology' ? 'BIOLOGY' : 'MATH'
      const teacherStore = (await import('../../../stores/teacherChatStore')).useTeacherChatStore()
      const allSessions = teacherStore.loadAllSessions()
      const session = Object.values(allSessions).find(s => s.subject === subjectUpper)
      if (!session) return null
      return { sessionId: session.sessionId, sessionName: session.sessionName, subject: session.subject }
    } catch (error) {
      return null
    }
  }

  /**
   * 转换消息格式用于转发
   */
  private convertMessageForForwarding(msg: ChatBubble) {
    const dataType = msg.messageType || 'text'
    let messageContent = msg.content || ''
    if (msg.type === Sender.USER) {
      messageContent = '[学生]\n' + messageContent
    } else if (msg.type === Sender.AI) {
      messageContent = '[学伴]\n' + messageContent
    }
    return { id: msg.id, type: dataType.toUpperCase(), sender: msg.sender, content: messageContent, timestamp: '' }
  }

  /**
   * 创建图片转发消息
   */
  private createImageForwardMessage(originalMessage: ChatBubble, imageInfo: any): ChatBubble {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    let forwardContent: string
    if (originalMessage.type === Sender.AI) forwardContent = '[学伴]\n[图片消息]'
    else if (originalMessage.type === Sender.USER) forwardContent = '[学生]\n[图片消息]'
    else forwardContent = '[图片消息]'

    return {
      id: messageId,
      messageId,
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

  getPlaceholderText(_hasSelectedQuestion: boolean): string {
    return '请输入问题...'
  }

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return this.htmlPreviewStore.inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.htmlPreviewStore.setInputAttachedScreenshots(shots)
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.htmlPreviewStore.setInputAttachedScreenshots(this.htmlPreviewStore.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    // Store 内部已实现过滤逻辑
    this.htmlPreviewStore.setInputAttachedScreenshots(this.htmlPreviewStore.inputAttachedScreenshots.filter(s => s.id !== id))
  }

  getEnableWebSearch(): boolean {
    return this.htmlPreviewStore.enableWebSearch
  }

  toggleWebSearch(): void {
    this.htmlPreviewStore.toggleWebSearch()
  }

  private handleMessagesChanged(messages: ChatBubble[]): void {
    if (!this.chatView || !messages || messages.length === 0) return

    // 检测是否有新消息
    const hasNewMessage = messages.length > this.chatView.getLastMessageCount()
    this.chatView.setLastMessageCount(messages.length)

    // 检查用户是否在底部
    this.chatView.checkIfUserAtBottom()

    if (this.chatView.getIsUserAtBottom()) {
      this.chatView.scrollToBottom()
      this.chatView.setShowNewMessageIndicator(false)
    } else if (hasNewMessage) {
      this.chatView.setShowNewMessageIndicator(true)
    }
  }
}
