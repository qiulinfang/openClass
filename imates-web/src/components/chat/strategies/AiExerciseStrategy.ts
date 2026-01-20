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

export class AiExerciseStrategy implements ChatStrategy {
  private aiExerciseStore = useAiExerciseChatStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiExerciseStore.messages
  }
  
  // 第2步：添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiExerciseStore.messages.push(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 优先使用 options.currentQuestion（由 ChatView 通过 props.overrideQuestion 传入）
    const currentQuestion = options.currentQuestion as unknown | undefined

    // 如果没有传入题目，则提示用户先选择题目
    if (!currentQuestion) {
      throw new Error('请先选择题目')
    }

    const hidePrefix = content.includes('我们开始吧')

    try {
      // 调用Store的sendMessage方法，传递所有必需参数
      await this.aiExerciseStore.sendMessage(
        content,
        currentQuestion as any,
        getUserInfo(),
        getSubject(),
        options.selectedModel || 'mate',
        options.imageData,
        hidePrefix,
        options.skipUserMessage,
        options.quotedMessage,
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
          type: 'ai',
          timestamp: new Date().toISOString(),
          sender: 'ai',
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
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '请先选择一道题目，然后我们可以开始讨论。你可以从题目列表中选择一道感兴趣的题目。'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return true
  }
  
  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第8步：保存聊天历史（AI题目场景统一使用 bmNo 作为存储键）
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
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI题目对话支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
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
  
  // 第11步：转发单条消息
  async forwardMessage(message: ChatBubble, options: ForwardOptions = {}): Promise<ForwardResult> {
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
      const success = await this.forwardMessageToTeacher([message], session.sessionId)
      return {
        success,
        error: success ? undefined : '转发失败',
      }
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ 转发消息失败:', error)
      return {
        success: false,
        error: '转发失败，请重试',
      }
    }
  }

  // 第12步：转发多条消息
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
      return {
        success: result.successCount > 0,
        error: result.successCount > 0 ? undefined : `转发失败 (${result.successCount}/${result.totalCount})`,
      }
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ 转发消息失败:', error)
      return {
        success: false,
        error: '转发失败，请重试',
      }
    }
  }
  
  // 第13步：初始化消息
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
          type: this.getMessageType(),
          timestamp: '',
          sender: this.getSenderType(),
        }
        await this.addMessage(welcomeMessage)
      }
    }
  }

  // 第16步：检查是否应该乐观发送
  async sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    // AI题目场景：暂时模拟成功
    return { success: true }
  }
  
  // 第15步：发送图片消息
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
      type: 'user',
      timestamp: '',
      sender: 'user',
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
  
  // 第16步：更新编辑的消息
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
  
  // 第17步：获取占位符文本
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

      // 如果连接到不同的会话，先断开旧连接
      if (currentSessionId && currentSessionId !== sessionId) {
        console.log('[AiExerciseStrategy] 切换教师会话，断开旧连接:', currentSessionId)
        try {
          await teacherStore.cleanupMessageReceiver()
          teacherStore.clearMessages()
          console.log('[AiExerciseStrategy] 旧教师连接已断开并清除记录')
        } catch (error) {
          console.error('[AiExerciseStrategy] 断开旧教师连接失败:', error)
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

      // 建立WebSocket连接
      const connected = await teacherStore.connectToTeacherSession(sessionId)
      if (connected) {
        // 连接成功后加载聊天历史
        try {
          await teacherStore.loadChatHistory(sessionId)
          console.log('[AiExerciseStrategy] 教师聊天历史加载完成')
        } catch (error) {
          console.error('[AiExerciseStrategy] 加载教师聊天历史失败:', error)
        }
      } else {
        console.error('[AiExerciseStrategy] 建立教师WebSocket连接失败:', sessionId)
      }

    } catch (error) {
      console.error('[AiExerciseStrategy] 初始化教师会话失败:', error)
      // 不抛出错误，避免影响AI消息的正常初始化
    }
  }

  // 第19步：是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return true // AI题目对话支持转发
  }
  
  // 第20步：发送图片消息后是否清空输入框
  shouldClearInputAfterImage(): boolean {
    return true // AI场景需要清空输入框
  }
  
  // 第21步：是否使用乐观发送
  shouldOptimisticSend(): boolean {
    return false // AI场景不使用乐观发送
  }
  
  // 第22步：清理资源
  // cleanup 不实现，因为AI策略不需要特殊清理
  
  // 第23步：获取当前科目
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

    // 根据角色类型添加前缀
    if (msg.type === 'user') {
      messageContent = '[学生] ' + messageContent
    } else if (msg.type === 'ai') {
      messageContent = '[AI助手] ' + messageContent
    }

    const cleanedContent = messageContent
      ? messageContent
          .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
          .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
          .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
          .replace(/\s+/g, ' ') // 合并多个空格
          .trim()
      : ''
    
    const result = {
      id: msg.id,
      type: messageType,
      content: cleanedContent,
      timestamp: '',
    }
    
    return result
  }


  /**
   * 转发消息到老师
   */
  private async forwardMessageToTeacher(
    messages: ChatBubble[],
    sessionId: string
  ): Promise<boolean> {
    // 第1步：转换消息格式
    const cleanedMessages = messages.map(msg => this.convertMessageForForwarding(msg))

    // 第2步：序列化消息数据
    let selectedMessagesData: string
    try {
      selectedMessagesData = JSON.stringify(cleanedMessages)
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ 序列化失败:', error)
      return false
    }
    
    // 第3步：直接通过WebSocket发送转发消息
    try {
      const teacherStore = useTeacherChatStore()

      // 确保当前会话设置正确
      const allSessions = teacherStore.loadAllSessions()
      const targetSession = allSessions[sessionId]
      if (targetSession) {
        teacherStore.setSession(targetSession)
      }

      // 预先添加转发消息到store（模拟正常发送流程）
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const forwardContent = `[AI聊天转发]\n${selectedMessagesData}`

      const forwardMessage: ChatBubble = {
        id: messageId,
        messageId: messageId,
        content: forwardContent,
        type: 'user',
        timestamp: new Date().toISOString(),
        sender: 'user',
        messageType: 'text',
      }

      teacherStore.addMessage(forwardMessage)

      // 检查WebSocket连接状态，如果未连接则主动建立连接
      const { getWebSocketService } = await import('../../../services/websocket/webSocketService')
      const webSocket = getWebSocketService('teacher')
      if (!webSocket.isConnected()) {
        console.log('[AiExerciseStrategy] WebSocket未连接，转发前先建立连接...')
        const connected = await teacherStore.connectWebSocket()
        if (!connected) {
          throw new Error('WebSocket连接失败')
        }
      }

      // 通过WebSocket发送转发消息
      const success = await teacherStore.sendMessage(forwardContent)
      console.log('转发消息成功', success)
      if (success) {
        // 第4步：保存转发消息到本地存储
        const convertedMessages = messages.map((msg) => {
          // 确定消息类型
          let messageType: 'text' | 'voice' | 'image' = (msg.messageType || 'text') as 'text' | 'voice' | 'image'
          if (!messageType || (messageType !== 'text' && messageType !== 'voice' && messageType !== 'image')) {
            // 如果没有 messageType 或类型不正确，根据数据判断
            if (msg.imageData?.filePath || msg.imageData?.base64DataUrl) {
              messageType = 'image'
            } else if (msg.voiceData?.filePath) {
              messageType = 'voice'
            } else {
              messageType = 'text'
            }
          }
          
          // 生成唯一的转发消息ID，允许同一条消息多次转发
          // 提取原始ID（如果已经是转发消息，提取原始ID）
          const originalId = msg.id.startsWith('forwarded_') 
            ? msg.id.replace(/^forwarded_/, '').split('_')[0] // 提取第一个下划线前的原始ID
            : msg.id
          const uniqueId = generateUniqueId(`forwarded_${originalId}`)
          
          return {
            ...msg,
            id: uniqueId,
            sender: 'user' as const,
            type: 'user' as const,
            messageType: messageType
          }
        })
        
        // 使用teacherStore存储转发消息
        const teacherStore = useTeacherChatStore()
        // 确保 currentSession 指向正确的会话
        const allSessions = teacherStore.loadAllSessions()
        const targetSession = allSessions[sessionId]
        if (targetSession) {
          teacherStore.setSession(targetSession)
        }
        // 直接添加到老师消息存储并持久化
        convertedMessages.forEach(msg => teacherStore.addMessage(msg))
        console.log('保存聊天历史完成', teacherStore.messages.length)
        // 立即保存，避免防抖问题导致消息丢失
        await teacherStore.loadChatHistory(sessionId)
      }
      
      return success
    } catch (error) {
      console.error('[AiExerciseStrategy] ❌ forwardMessageToTeacher 异常:', error)
      return false
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
      console.log('[AiExerciseStrategy] WebSocket未连接，批量转发前先建立连接...')
      const connected = await teacherStore.connectWebSocket()
      if (!connected) {
        console.error('[AiExerciseStrategy] WebSocket连接失败，无法进行批量转发')
        return { successCount: 0, totalCount: messages.length }
      }
    }

    for (const message of messages) {
      const selectedMessagesData = JSON.stringify([this.convertMessageForForwarding(message)])

      try {
        // 预先添加转发消息到store
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const forwardContent = `[AI聊天转发]\n${selectedMessagesData}`

        const forwardMessage: ChatBubble = {
          id: messageId,
          messageId: messageId,
          content: forwardContent,
          type: 'user',
          timestamp: new Date().toISOString(),
          sender: 'user',
          messageType: 'text',
        }

        teacherStore.addMessage(forwardMessage)

        // 通过WebSocket发送转发消息
        await teacherStore.sendMessage(forwardContent)

        successCount++
      } catch (error) {
        console.error(`[AiExerciseStrategy] ❌ 单条转发消息失败:`, error)
      }

      // 每条消息之间延迟50ms，避免发送过快
      if (messages.indexOf(message) < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    console.log(`[AiExerciseStrategy] ✅ 批量转发完成: ${successCount}/${messages.length} 条消息`)

    return { successCount, totalCount: messages.length }
  }

  // ========== 会话管理方法（ChatStrategy 可选接口） ==========

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
}
