/**
 * AI题目对话策略（使用场景独立Store）
 * 处理基于题目的AI对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardResult, ForwardOptions } from './ChatStrategy'
import type { SendMessageOptions, InitializeOptions } from './types'
import { useAiExerciseChatStore } from '../../../stores/aiExerciseChatStore'
import { useTeacherChatStore } from '../../../stores/teacherChatStore'
import { useQuestionStore } from '../../../stores/questionStore'
import { getUserInfo, getUserId, getSubject } from '../../../services'
import { apiService } from '../../../services/http/api-service'
import { showMessage } from '../../../utils'
import { generateUniqueId } from '../../../stores/utils/chatStoreUtils'
import { normalizeSubject } from '@/constants/subjects'
import { Sender } from '@/types/enums'
import type { ChatQuotedMessage } from '@/stores/utils/chatStoreUtils'

export class AiExerciseStrategy implements ChatStrategy {
  private aiExerciseStore = useAiExerciseChatStore()
  private chatView?: import('./ChatStrategy').ChatViewInterface
  
  // 获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiExerciseStore.messages
  }
  
  // 添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiExerciseStore.messages.push(message)
    // 通知ChatView处理消息变化
    this.handleMessagesChanged(this.getMessages())
  }
  
  // 发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 优先使用 options.currentQuestion（由 ChatView 通过 props.overrideQuestion 传入）
    const currentQuestion = options.currentQuestion as unknown | undefined

    // 如果没有传入题目，则提示用户先选择题目
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

      const quotedForStore: ChatQuotedMessage | undefined = options.quotedMessage
        ? {
            id: options.quotedMessage.id,
            content: options.quotedMessage.content,
            sender:
              options.quotedMessage.sender === 'user'
                ? Sender.USER
                : options.quotedMessage.sender === 'teacher'
                  ? Sender.TEACHER
                  : Sender.AI,
          }
        : undefined

      // 调用Store的sendMessage方法，传递所有必需参数
      await this.aiExerciseStore.sendMessage(
        content,
        currentQuestion as any,
        getUserInfo(),
        requestSubject,
        options.selectedModel || 'mate',
        options.imageData,
        hidePrefix,
        options.skipUserMessage,
        quotedForStore,
        options.imageList,
        options.focus,
      )
    } catch (error) {
      // 如果是验证错误，将错误信息作为AI回复返回
      const errorMessage = error instanceof Error ? error.message : '参数验证失败'

      // 检查是否是题目场景的验证错误
      if (errorMessage.includes('缺失题目场景必填字段')) {
        // 创建错误消息作为AI回复
        const errorReply: ChatBubble = {
          id: generateUniqueId('error_ai'),
          content: `抱歉，当前题目信息不完整，无法进行对话。错误详情：${errorMessage}`,
          type: Sender.AI,
          timestamp: new Date().toISOString(),
          sender: Sender.AI,
          isStreaming: false,
          selectedModel: options.selectedModel || 'mate'
        }

        // 添加到消息列表
        this.aiExerciseStore.messages.push(errorReply)

        // 不重新抛出错误，直接返回
        return
      }

      // 其他错误重新抛出
      throw error
    }
  }
  
  // 获取欢迎消息
  getWelcomeMessage(): string {
    return '请先选择一道题目，然后我们可以开始讨论。你可以从题目列表中选择一道感兴趣的题目。'
  }
  
  // 检查是否需要选择题目
  requiresQuestion(): boolean {
    return true
  }
  
  // 获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 获取发送者类型
  getSenderType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 保存聊天历史（AI题目场景统一使用 bmNo 作为存储键）
  async saveChatHistory(questionBmNo?: string): Promise<void> {
    if (questionBmNo) {
      await this.aiExerciseStore.saveChatHistory(questionBmNo)
    }
  }

  // 删除消息：通过题目 bmNo 定位会话，由 ChatView 传入 currentQuestion
  async deleteMessage(messageId: string, options?: { currentQuestion?: unknown }): Promise<void> {
    const q = (options?.currentQuestion ?? null) as { bmNo?: string } | null
    const bmNo = q?.bmNo
    await this.aiExerciseStore.deleteMessage(messageId, bmNo)
  }
  
  // 检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI题目对话支持转发
  }
  
  // 获取当前科目（用于转发）
  // 策略接口中定义为无参数方法，这里提供一个占位实现，始终返回 null
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null
  }

  // 私有辅助方法：根据传入的题目对象判断科目
  private getSubjectFromQuestion(question: unknown): 'biology' | 'math' | null {
    try {
      const q = question as { subject?: string } | null | undefined
      if (q?.subject) {
        const subjectLower = q.subject.toLowerCase()
        if (subjectLower === 'biology' || subjectLower === '生物') {
          return 'biology'
        } else if (subjectLower === 'math' || subjectLower === '数学') {
          return 'math'
        }
      }
      return null
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ 获取题目科目失败:', error)
      return null
    }
  }
  

  // 转发多条消息
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 获取题目信息
      const question = options.currentQuestion as { id?: string; bmNo?: string; subject?: string; question?: string; title?: string } | undefined
      if (!question?.id) {
        return {
          success: false,
          error: '请先选择题目',
        }
      }

      // 确定科目
      const subject = this.getSubjectFromQuestion(question)
      if (!subject) {
        return {
          success: false,
          error: '无法确定题目科目',
        }
      }

      // 从写死会话中选择对应的会话
      const teacherStore = useTeacherChatStore()
      const allSessions = teacherStore.loadAllSessions()
      const subjectUpper = subject === 'math' ? 'MATH' : 'BIOLOGY'
      const session = Object.values(allSessions).find(s => s.subject === subjectUpper)

      if (!session) {
        return {
          success: false,
          error: `未找到${subject === 'math' ? '数学' : '生物'}科目的教师会话`,
        }
      }

      // 转发消息
      const result = await this.forwardMessagesSeparately(messages, session.sessionId)

      if (result.successCount > 0) {
        const forwardResult: ForwardResult = {
          success: true,
          successCount: result.successCount,
          sessionId: session.sessionId,
        }

        // 显示成功提示或对话框
        if (options.showDialog !== false && options.showForwardSuccessDialog) {
          const msg =
            result.successCount > 1
              ? `已成功转发 ${result.successCount} 条消息给老师，是否前往老师对话查看？`
              : '消息已成功转发给老师，是否前往老师对话查看？'

          const dialogResult = await options.showForwardSuccessDialog(msg, session.sessionId)
          if (dialogResult?.goToTeacher && options.onSuccess) {
            await options.onSuccess(forwardResult)
          }
        } else {
          if (options.onSuccess) {
            await options.onSuccess(forwardResult)
          }
        }

        return forwardResult
      }

      const errorMsg = `转发失败 (${result.successCount}/${result.totalCount})`
      if (options.onError) {
        options.onError(errorMsg)
      }
      return {
        success: false,
        error: errorMsg,
      }
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ 转发消息失败:', error)
      const errorMsg = '转发失败，请重试'
      if (options.onError) {
        options.onError(errorMsg)
      }
      return {
        success: false,
        error: errorMsg,
      }
    }
  }
  
  // 初始化消息
  async initialize(options: InitializeOptions): Promise<void> {
    // 如果有题目，加载该题目的聊天历史（此处 currentQuestionId 约定为 bmNo）
    if (options.hasSelectedQuestion && options.currentQuestionId) {
      const questionBmNo = options.currentQuestionId
      if (questionBmNo) {
        // 初始化ai聊天历史
        await this.aiExerciseStore.loadChatHistory(questionBmNo)
        // 初始化老师消息会话
        await this.initializeTeacherSession(questionBmNo)
      }
    } else {
      // 如果没有题目且消息为空，添加欢迎消息
      if (this.aiExerciseStore.messages.length === 0) {
        const welcomeMessage: ChatBubble = {
          id: 'welcome_' + Date.now(),
          content: this.getWelcomeMessage(),
          type: Sender.AI,
          timestamp: '',
          sender: Sender.AI,
        }
        await this.addMessage(welcomeMessage)
      }
    }
  }

  // 检查是否应该乐观发送
  async sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    // AI题目场景：暂时模拟成功
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
    options?: { selectedModel?: string; currentQuestionId?: string; currentQuestion?: unknown }
  ): Promise<void> {
    const messages = this.aiExerciseStore.messages
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)
    
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }
    
    // 更新消息内容
    messages[messageIndex].content = newContent
    
    // 不保留原来的旧消息，只保留之前的上下文
    const messagesToKeep = messages.slice(0, messageIndex)
    this.aiExerciseStore.messages.length = 0
    this.aiExerciseStore.messages.push(...messagesToKeep)
    
    // 保存聊天记录（此处 currentQuestionId 约定为 bmNo）
    await this.saveChatHistory(options?.currentQuestionId)
    
    // 发送编辑后的消息给AI
    await this.sendMessage(newContent, { 
      selectedModel: options?.selectedModel,
      currentQuestion: options?.currentQuestion,
    })
  }
  
  // 获取占位符文本
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    if (!hasSelectedQuestion) {
      return '可以先聊聊，或选择题目后开始讨论'
    }
    return '输入你的问题'
  }
  
  // getSessionInfo 方法已删除，所有策略都不需要此方法

  // 初始化老师消息会话（为转发功能做准备）
  private async initializeTeacherSession(questionBmNo?: string): Promise<void> {
    try {
      const teacherStore = useTeacherChatStore()

      // 根据题目确定教师会话ID
      let sessionId: string = ''

      if (questionBmNo) {
        // 尝试从题目中获取科目信息，然后找到对应的教师会话
        const questionStore = useQuestionStore()
        const currentQuestion = questionStore.questions.find(q => q.bmNo === questionBmNo)
        if (currentQuestion?.subject) {
          // 使用 teacherChatStore 的写死会话列表来获取会话ID
          const teacherStore = useTeacherChatStore()
          const allSessions = teacherStore.loadAllSessions()

          // subject 字段直接是小写的科目名称，如 "math", "biology"
          const subject = currentQuestion.subject.toUpperCase()

          // 根据科目从会话列表中找到对应的会话ID
          for (const [sessionIdKey, session] of Object.entries(allSessions)) {
            if (session.subject === subject) {
              sessionId = sessionIdKey
              break
            }
          }
        }
      }

      // 如果没有找到对应的会话，使用默认的数学老师会话
      if (!sessionId) {
        const userId = getUserId() || 'default'
        sessionId = `teacher_${userId}_math`
      }

      // 检查当前是否已经连接到相同的会话
      const currentSessionId = teacherStore.currentSession?.sessionId
      if (currentSessionId === sessionId) {
        console.log('[AiExerciseStrategy] 当前已连接到相同教师会话，复用连接:', sessionId)
        return
      }

      // 单连接多会话架构：会话切换时不操作WebSocket连接（连接由路由守卫管理）
      if (currentSessionId && currentSessionId !== sessionId) {
        console.log('[AiExerciseStrategy] 切换教师会话，清除旧记录（连接保持）:', currentSessionId)
        try {
          teacherStore.clearMessages()
          console.log('[AiExerciseStrategy] 旧教师记录已清除（连接保持）')
        } catch (error) {
          console.error('[AiExerciseStrategy] 清除旧教师记录失败:', error)
        }
      }

      // 从写死会话列表中获取会话信息
      const allSessions = teacherStore.loadAllSessions()
      const sessionInfo = allSessions[sessionId]

      if (!sessionInfo) {
        console.error('[AiExerciseStrategy] 未找到教师会话信息:', sessionId)
        return
      }

      console.log('[AiExerciseStrategy] 初始化教师会话:', { sessionId, subject: sessionInfo.subject, sessionName: sessionInfo.sessionName, questionBmNo })

      // 设置会话信息到teacherStore
      teacherStore.setSession({
        sessionId: sessionId,
        sessionName: sessionInfo.sessionName,
        subject: sessionInfo.subject as 'BIOLOGY' | 'MATH',
        createTime: Date.now()
      })

      const activated = await teacherStore.activateTeacherSession(sessionId)
      if (activated) {
        console.log('[AiExerciseStrategy] 教师聊天历史加载完成')
      } else {
        console.error('[AiExerciseStrategy] 激活教师会话失败:', sessionId)
      }

    } catch (error) {
      console.error('[AiExerciseStrategy] 初始化教师会话失败:', error)
      // 不抛出错误，避免影响AI消息的正常初始化
    }
  }

  // 是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return true // AI题目对话支持转发
  }
  
  // 发送图片消息后是否清空输入框
  shouldClearInputAfterImage(): boolean {
    return true // AI场景需要清空输入框
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
    if (msg.type === 'user') {
      messageContent = '[学生]\n' + messageContent
    } else if (msg.type === 'ai') {
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
      console.log('[AiExerciseStrategy] WebSocket未连接，批量转发前先建立连接...')
      const connected = await teacherStore.connectWebSocket()
      if (!connected) {
        console.error('[AiExerciseStrategy] WebSocket连接失败，无法进行批量转发')
        return { successCount: 0, totalCount: messages.length }
      }

      // 连接成功后加载聊天历史（分页加载）
      console.log('[AiExerciseStrategy] 加载教师会话历史记录...')
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
              console.log(`[AiExerciseStrategy] ✅ 转发图片消息成功 (${successCount})`)

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
          const base64DataUrl = message.imageData.base64DataUrl
          if (!base64DataUrl) {
            throw new Error('图片数据不完整，无法转发')
          }

          const imageUrl = await apiService.uploadImageAndGetUrl(base64DataUrl)

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

          console.log(`[AiExerciseStrategy] ✅ 转发单图消息成功 (${successCount})`)
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

          console.log(`[AiExerciseStrategy] ✅ 转发文本消息成功 (${successCount})`)
        }
      } catch (error) {
        console.error(`[AiExerciseStrategy] ❌ 转发消息失败:`, error)
      }

      // 消息间延迟
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    console.log(`[AiExerciseStrategy] ✅ 批量转发完成: ${successCount}/${messages.length} 条消息`)

    return { successCount, totalCount: messages.length }
  }

  // ========== 会话管理方法（ChatStrategy 可选接口） ==========


  /**
   * 创建图片转发消息
   */
  private createImageForwardMessage(originalMessage: ChatBubble, imageInfo: any): ChatBubble {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 根据原消息类型生成转发内容
    let forwardContent: string
    if (originalMessage.type === 'ai') {
      forwardContent = '[学伴]\n[图片消息]'
    } else if (originalMessage.type === 'user') {
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

  // 获取会话卡片列表
  getSessionCards(): unknown[] {
    if (typeof this.aiExerciseStore.getSessionCards === 'function') {
      return this.aiExerciseStore.getSessionCards()
    }
    return []
  }

  // 为当前题目创建新会话
  async createNewSession(options?: { currentQuestion?: unknown }): Promise<void> {
    const q = (options?.currentQuestion ?? null) as { bmNo?: string } | null
    const bmNo = q?.bmNo
    if (!bmNo) {
      throw new Error('请先选择题目')
    }
    await this.aiExerciseStore.createNewSession(bmNo)
  }

  // 切换到指定会话
  async switchToSession(sessionId: string): Promise<void> {
    await this.aiExerciseStore.switchToSession(sessionId)
  }

  // 删除指定会话
  async deleteSession(sessionId: string, options?: { currentQuestion?: unknown }): Promise<void> {
    const q = (options?.currentQuestion ?? null) as { bmNo?: string } | null
    const bmNo = q?.bmNo || ''
    await this.aiExerciseStore.deleteSession(sessionId, bmNo)
  }

  // 获取联网搜索状态
  getEnableWebSearch(): boolean {
    return this.aiExerciseStore.enableWebSearch
  }

  // 切换联网搜索状态
  toggleWebSearch(): void {
    this.aiExerciseStore.toggleWebSearch()
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
    if (!this.chatView) return

    console.log('题目切换处理函数', newQuestion, oldQuestion)
    if ((newQuestion as any)?.bmNo !== (oldQuestion as any)?.bmNo) {
      // 检查是否正在编辑消息
      if (this.chatView.getIsEditingMessage()) {
        // 检查是否切换回正在编辑的题目
        if (
          this.chatView.getEditingQuestionId() &&
          newQuestion &&
          (newQuestion as any).bmNo === this.chatView.getEditingQuestionId()
        ) {
          // 直接执行切换，不显示确认对话框
          this.chatView.executeQuestionSwitch()
          return
        }

        // 简化处理：直接退出编辑模式并执行切换
        this.chatView.cancelEditMessage()
        this.chatView.clearInputContent()
        this.chatView.executeQuestionSwitch()
      } else {
        // 如果没有编辑状态，直接执行切换
        this.chatView.executeQuestionSwitch()
      }
    }
  }
}
