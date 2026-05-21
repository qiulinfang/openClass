/**
 * AI通用对话策略（使用场景独立Store）
 * 处理通用AI对话逻辑
 */

import type { ChatBubble } from '../../../types'
import { showMessage } from '../../../utils'
import { Sender } from '../../../types/enums'
import type { ChatStrategy, ForwardOptions, ForwardResult } from './ChatStrategy'
import type { SendMessageOptions } from './types'
import type { AttachedScreenshot } from '../../../types'
import type { InitializeOptions } from './types'
import { useAiGeneralChatStore } from '../../../stores/aiGeneralChatStore'
import { getUserInfo, getSubject } from '../../../services'
import { useTeacherChatStore } from '../../../stores/teacherChatStore'
import { apiService } from '../../../services/http/api-service'
import { generateUniqueId } from '../../../stores/utils/chatStoreUtils'
import TeacherSelectionDialog from '../../dialog/TeacherSelectionDialog.vue'

export class AiGeneralStrategy implements ChatStrategy {
  private aiGeneralStore = useAiGeneralChatStore()
  private chatView?: import('./ChatStrategy').ChatViewInterface

  getInputAttachedScreenshots(): AttachedScreenshot[] {
    return this.aiGeneralStore.inputAttachedScreenshots
  }

  setInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    this.aiGeneralStore.setInputAttachedScreenshots(Array.isArray(shots) ? shots : [])
  }

  appendInputAttachedScreenshots(shots: AttachedScreenshot[]): void {
    if (!shots || shots.length === 0) return
    this.aiGeneralStore.setInputAttachedScreenshots(this.aiGeneralStore.inputAttachedScreenshots.concat(shots))
  }

  removeInputAttachedScreenshot(id: string): void {
    this.aiGeneralStore.removeInputAttachedScreenshot(id)
  }

  clearInputAttachedScreenshots(): void {
    this.aiGeneralStore.clearInputAttachedScreenshots()
  }

  getInputScreenshotDrawingStates(): Record<string, unknown> {
    return this.aiGeneralStore.inputScreenshotDrawingStates
  }

  setInputScreenshotDrawingStates(states: Record<string, unknown>): void {
    this.aiGeneralStore.setInputScreenshotDrawingStates(states || {})
  }

  removeInputScreenshotDrawingState(id: string): void {
    if (!id) return
    const next = { ...(this.aiGeneralStore.inputScreenshotDrawingStates || {}) } as Record<string, unknown>
    if (id in next) {
      delete next[id]
      this.aiGeneralStore.setInputScreenshotDrawingStates(next)
    }
  }

  clearInputScreenshotDrawingStates(): void {
    this.aiGeneralStore.setInputScreenshotDrawingStates({})
  }
  
  // 获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiGeneralStore.messages
  }
  
  // 添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiGeneralStore.messages.push(message)
    // 通知ChatView处理消息变化
    this.handleMessagesChanged(this.getMessages())
  }
  
  // 发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 当 options.imageData 存在时，说明上游已插入了图片用户消息
    // 为避免再次插入空文本用户消息，传递 skipUserMessage 标记给 Store
    const skipUserMessage = !!options.imageData || !!(options.imageList && options.imageList.length > 0) || !!options.skipUserMessage

    await this.aiGeneralStore.sendMessage(
      content,
      getUserInfo(),
      getSubject(),
      options.selectedModel || 'mate',
      skipUserMessage,
      options.quotedMessage as any,
      options.imageData,
      options.imageList,
      options.focus,
    )
  }
  
  // 获取欢迎消息
  getWelcomeMessage(): string {
    return '你好！我是你的学习伙伴。有什么问题我可以帮你解答吗？'
  }
  
  // 检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // AI通用对话不需要题目
  }
  
  // 获取消息类型
  getMessageType(): Sender {
    return Sender.AI
  }
  
  // 获取发送者类型
  getSenderType(): Sender {
    return Sender.AI
  }
  
  // 保存聊天历史
  async saveChatHistory(): Promise<void> {
    await this.aiGeneralStore.saveChatHistory()
  }

  isChatLoading(): boolean {
    return !!this.aiGeneralStore.isChatLoading
  }
  
  // 检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI通用对话支持转发
  }
  
  // 获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    // AI通用场景：返回 null，需要用户手动选择老师
    return null
  }
  
  
  // 转发多条消息
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 选择老师会话
      const session = await this.selectTeacherSession(options.onTeacherSelect)

      if (!session) {
        return {
          success: false,
          error: '用户取消选择或会话创建失败',
        }
      }
      
      // 逐条转发消息到通用会话
      const { successCount } = await this.forwardMessagesSeparately(
        messages,
        session.sessionId
      )
      
      if (successCount > 0) {
        const result: ForwardResult = {
          success: true,
          successCount,
          sessionId: session.sessionId,
        }
        
        // 显示成功提示或对话框
        if (options.showDialog !== false) {
          this.showForwardSuccessDialog(result, options, async () => {
            if (options.onSuccess) {
              await options.onSuccess(result)
            }
          })
        } else {
          showMessage(`转发成功，已转发 ${successCount} 条消息`, 'success')
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
  
  // 初始化消息
  async initialize(options: InitializeOptions): Promise<void> {
    // AI通用对话不需要特殊初始化，只需要添加欢迎消息
    if (!options.hasSelectedQuestion && this.aiGeneralStore.messages.length === 0) {
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

  // 检查是否应该乐观发送
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendVoiceMessage(_voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    // AI通用场景：暂时模拟成功
    return { success: true }
  }
  
  // 发送图片消息
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
    })
  }
  
  // 更新编辑的消息
  async updateEditedMessage(
    messageId: string,
    newContent: string,
    options?: { selectedModel?: string }
  ): Promise<void> {
    const messages = this.aiGeneralStore.messages
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)
    
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }
    
    // 更新消息内容
    messages[messageIndex].content = newContent
    
    // 删除该消息之后的所有消息
    const messagesToKeep = messages.slice(0, messageIndex + 1)
    this.aiGeneralStore.messages.length = 0
    this.aiGeneralStore.messages.push(...messagesToKeep)
    
    // 保存聊天记录
    await this.saveChatHistory()
    
    // 发送编辑后的消息给AI：跳过重新创建用户消息，只保留就地更新后的气泡
    await this.sendMessage(newContent, {
      selectedModel: options?.selectedModel,
      skipUserMessage: true,
    })
  }
  
  // 获取占位符文本
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    if (!hasSelectedQuestion) {
      return '可以先聊聊，或选择题目后开始讨论'
    }
    return '向学伴提问...'
  }
  
  // getSessionInfo 方法已删除，所有策略都不需要此方法
  
  // 是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return true // AI通用对话支持转发
  }
  
  // 检查发送图片后是否清空输入框
  shouldClearInputAfterImage(): boolean {
    return true // AI场景需要清空输入框
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
  
  // 是否使用乐观发送
  shouldOptimisticSend(): boolean {
    return false // AI场景不使用乐观发送
  }
  
  // 清理资源
  // cleanup 不实现，因为AI策略不需要特殊清理
  
  // 获取当前科目
  getCurrentSubject(): 'biology' | 'math' {
    return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
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
   * 选择老师会话（从写死会话中选择）
   */
  private async selectTeacherSession(onTeacherSelect?: () => Promise<'biology' | 'math'>): Promise<{ sessionId: string; sessionName: string; subject: string } | null> {
    if (!onTeacherSelect) {
      console.error('[AiGeneralStrategy] 未提供老师选择回调函数')
      return null
    }

    try {
      // 1. 用户手动选择科目
      const selectedSubject = await onTeacherSelect()

      // 2. 转换科目格式（小写 -> 大写）
      const subjectUpper = selectedSubject === 'biology' ? 'BIOLOGY' : 'MATH'

      // 3. 从写死会话中选择对应的会话
      const teacherStore = useTeacherChatStore()
      const allSessions = teacherStore.loadAllSessions()

      // 找到对应的写死会话
      const session = Object.values(allSessions).find(s => s.subject === subjectUpper)
      if (!session) {
        console.error('[AiGeneralStrategy] 未找到对应科目的写死会话:', selectedSubject)
        return null
      }

      return {
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        subject: session.subject
      }
    } catch (error) {
      console.error('[AiGeneralStrategy] 老师选择失败:', error)
      return null
    }
  }

  /**
   * 转发消息到老师
   */
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
      console.log('[AiGeneralStrategy] WebSocket未连接，批量转发前先建立连接...')
      const connected = await teacherStore.connectWebSocket()
      if (!connected) {
        console.error('[AiGeneralStrategy] WebSocket连接失败，无法进行批量转发')
        return { successCount: 0, totalCount: messages.length }
      }

      // 连接成功后加载聊天历史（分页加载）
      console.log('[AiGeneralStrategy] 加载教师会话历史记录...')
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
                filePath: imageUrl // 使用上传获得的URL
              })

              teacherStore.addMessage(imageMessage)
              console.log(`[发送] 图片URL: ${imageUrl}`)

              // 发送URL而不是base64数据
              await teacherStore.sendMessage(imageMessage.content, {
                filePath: imageUrl, // 发送URL
                width: imageInfo.width,
                height: imageInfo.height,
                fileSize: imageInfo.fileSize,
                base64DataUrl: undefined // 不发送base64数据
              })

              successCount++
              console.log(`[AiGeneralStrategy] ✅ 转发图片消息成功 (${successCount})`)

              // 图片间延迟，避免发送过快
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
        } else if (message.messageType === 'image' && message.imageData) {
          // 单图消息：先上传获得URL再转发
          const convertedMessage = this.convertMessageForForwarding(message)
          const forwardContent = convertedMessage.content
          console.log(`[转发] 单图消息: ${forwardContent}`)

          // 先上传图片获得URL
          if (!message.imageData.base64DataUrl) {
            console.warn('[AiGeneralStrategy] 单图消息缺少base64DataUrl，跳过转发')
            continue
          }
          const imageUrl = await apiService.uploadImageAndGetUrl(message.imageData.base64DataUrl)

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
              base64DataUrl: undefined // 清空base64数据
            }
          }

          teacherStore.addMessage(forwardMessage)
          console.log(`[发送] 图片URL: ${imageUrl}`)
          await teacherStore.sendMessage(forwardContent, {
            filePath: imageUrl, // 发送URL
            width: message.imageData.width,
            height: message.imageData.height,
            fileSize: message.imageData.fileSize,
            base64DataUrl: undefined // 不发送base64数据
          }, message.sender)
          successCount++

          console.log(`[AiGeneralStrategy] ✅ 转发单图消息成功 (${successCount})`)
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

          console.log(`[AiGeneralStrategy] ✅ 转发文本消息成功 (${successCount})`)
        }
      } catch (error) {
        console.error(`[AiGeneralStrategy] ❌ 转发消息失败:`, error)
      }

      // 消息间延迟
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    console.log(`[AiGeneralStrategy] ✅ 批量转发完成: ${successCount}/${messages.length} 条消息`)
    return { successCount, totalCount: messages.length }
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
        base64DataUrl: imageInfo.base64DataUrl
      }
    }
  }

  /**
   * 显示转发成功对话框
   */
  private async showForwardSuccessDialog(
    result: ForwardResult,
    options: ForwardOptions,
    onNavigateToTeacher?: (sessionId: string) => void | Promise<void>
  ) {
    if (!options.showDialog || !options.showForwardSuccessDialog) {
      return
    }

    const message = result.successCount && result.successCount > 1
      ? `已成功转发 ${result.successCount} 条消息给老师，是否前往老师对话查看？`
      : '消息已成功转发给老师，是否前往老师对话查看？'

    try {
      const dialogResult = await options.showForwardSuccessDialog(message, result.sessionId)
      if (dialogResult.goToTeacher && result.sessionId && onNavigateToTeacher) {
        onNavigateToTeacher(result.sessionId)
      }
      if (options.onSuccess) {
        options.onSuccess(result)
      }
    } catch (error) {
      console.error('[AiGeneralStrategy] 显示转发成功对话框失败:', error)
      // 如果对话框显示失败，仍执行成功回调
      if (options.onSuccess) {
        options.onSuccess(result)
      }
    }
  }

  // 获取联网搜索状态
  getEnableWebSearch(): boolean {
    return this.aiGeneralStore.enableWebSearch
  }

  // 切换联网搜索状态
  toggleWebSearch(): void {
    this.aiGeneralStore.toggleWebSearch()
  }

  // 设置ChatView接口
  setChatView(chatView: import('./ChatStrategy').ChatViewInterface): void {
    this.chatView = chatView
  }

  /**
   * 处理消息变化
   * 替代原有的watch监听器，由策略主动调用
   */
  private handleMessagesChanged(newMessages: ChatBubble[]): void {
    if (!this.chatView || !newMessages || newMessages.length === 0) return

    // 检测是否有新消息（消息数量增加）
    const hasNewMessage = newMessages.length > this.chatView.getLastMessageCount()
    this.chatView.setLastMessageCount(newMessages.length)

    // 检查用户是否在底部（允许50px的误差）
    this.chatView.checkIfUserAtBottom()

    // 如果是键盘显示状态，立即滚动；否则根据用户位置决定
    if (this.chatView.getIsKeyboardVisible() || this.chatView.getIsKeyboardAnimating()) {
      // 键盘显示时立即滚动，确保用户体验
      this.chatView.scrollToBottom()
      this.chatView.setShowNewMessageIndicator(false)
    } else {
      // 如果用户不在底部且有新消息，显示提示按钮
      if (hasNewMessage && !this.chatView.getIsUserAtBottom()) {
        this.chatView.setShowNewMessageIndicator(true)
      } else if (this.chatView.getIsUserAtBottom()) {
        // 用户在底部，自动滚动并隐藏提示按钮
        this.chatView.scrollToBottom()
        this.chatView.setShowNewMessageIndicator(false)
      }
    }
  }

  // 处理题目切换（由ChatView主动调用）
  onQuestionChanged(newQuestion: unknown, oldQuestion: unknown): void {
    // AI通用对话策略不需要特殊的题目切换处理
    console.log('AI通用策略题目切换:', newQuestion, oldQuestion)
  }
}