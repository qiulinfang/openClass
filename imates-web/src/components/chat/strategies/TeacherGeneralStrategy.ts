/**
 * 教师通用答疑策略（使用场景独立Store）
 * 处理教师通用答疑对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, TeacherSessionInfo, InitializeOptions } from './types'
import { useTeacherGeneralChatStore } from '../../../stores/teacherGeneralChatStore'
import { useQuestionStore } from '../../../stores/questionStore'
import { apiService } from '../../../services/http/api-service'
import { getCurrentUserIdOrDefault } from '../../../services'
import { SessionType } from '../../../types'
import type { ChatMessageSession } from '../../../types'

export class TeacherGeneralStrategy implements ChatStrategy {
  private teacherStore = useTeacherGeneralChatStore()
  private questionStore = useQuestionStore()
  
  constructor() {
    // 策略直接从 store 读取 session 信息，不再通过构造函数参数传递
  }
  
  /**
   * 获取当前会话信息（从 store 读取）
   */
  private getCurrentSession(): TeacherSessionInfo {
    const session = this.teacherStore.currentSession
    if (!session) {
      throw new Error('Teacher session not initialized. Please set session in store first.')
    }
    return {
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      subject: session.subject as 'biology' | 'math'
    }
  }
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.teacherStore.messages
  }
  
  // 第2步：添加消息
  async addMessage(message: ChatBubble): Promise<void> {
    this.teacherStore.addMessage(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 注意：教师答疑不强制要求选择题目
    // 如果需要题目相关功能，可以在具体场景中检查
    
    // 调用Store发送消息
    // 如果有 imageData，sendMessage 会自动跳过创建用户消息（因为上游已手动插入）
    await this.teacherStore.sendMessage(
      content,
      options.imageData
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    const session = this.getCurrentSession()
    return `你好！我是你的${session.subject}老师。有什么问题可以问我。`
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // 教师答疑可以在没有题目的情况下进行通用问答
  }
  
  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'teacher'
  }
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' {
    return 'teacher'
  }
  
  // 第8步：保存聊天历史
  async saveChatHistory(): Promise<void> {
    await this.teacherStore.saveChatHistory()
  }
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return false // 老师对话不支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    return null // 老师对话不支持转发
  }
  
  // 第11步：转发单条消息
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async forwardMessage(_message: ChatBubble, _options?: import('./ChatStrategy').ForwardOptions): Promise<import('./ChatStrategy').ForwardResult> {
    return {
      success: false,
      error: '老师对话不支持转发消息',
    }
  }
  
  // 第12步：转发多条消息
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async forwardMessages(_messages: ChatBubble[], _options?: import('./ChatStrategy').ForwardOptions): Promise<import('./ChatStrategy').ForwardResult> {
    return {
      success: false,
      error: '老师对话不支持转发消息',
    }
  }
  
  // 第13步：初始化消息
  async initialize(options: InitializeOptions): Promise<void> {
    try {
      // 步骤1：初始化老师消息监听器（使用 Store 统一方法）
      await this.teacherStore.initMessageReceiver()
      
      // 步骤2：如果有当前题目，基于AI会话创建老师会话
      if (options.currentQuestionId) {
        // 2.1 生成AI会话ID（基于题目ID和时间戳，确保唯一性）
        const aiSessionId = `ai_session_${options.currentQuestionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // 2.2 生成会话名称，清理LaTeX内容避免JSON解析问题
        const rawTitle = options.currentQuestionTitle || '题目'
        
        // 移除LaTeX数学公式，只保留纯文本
        const cleanTitle = rawTitle
          .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
          .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
          .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
          .replace(/\s+/g, ' ') // 合并多个空格
          .trim()
        
        const aiSessionName = (cleanTitle || '数学题目').substring(0, 30) + '...'
        
        // 2.3 创建老师会话（使用 Store 统一方法）
        const subject = (options.currentSubject || 'math') as 'biology' | 'math'
        const createdSession = this.teacherStore.createTeacherSession(
          aiSessionId,
          aiSessionName,
          subject
        )
        
        if (createdSession) {
          // 设置到store（会话信息已由 createTeacherSession 设置）
          // 这里确保 store 中的 session 是最新的
          this.teacherStore.setSession({
            sessionId: createdSession.sessionId,
            sessionName: createdSession.sessionName,
            subject: subject,
            createTime: createdSession.createTime
          })
          
          // 2.4 先从本地存储加载聊天记录（如果有）
          await this.teacherStore.loadChatHistory(createdSession.sessionId)
          
          // 2.5 然后从API加载聊天记录（同步远程消息）
          await this.loadTeacherChatHistory(createdSession.sessionId)
        }
      } else {
        // 步骤3：如果没有题目，需要区分"加载已有会话"和"创建新会话"
        // 3.1 判断是否是已存在的会话
        // sessionId格式：
        // - 临时ID（新建）: teacher-chat-{timestamp}
        // - 真实ID（已存在）: teacher-{hex}-{timestamp}
        const isExistingSession = options.sessionId && 
                                  options.sessionId.startsWith('teacher-') && 
                                  !options.sessionId.startsWith('teacher-chat-')
        
        if (isExistingSession && options.sessionId) {
          // 场景A：加载已有会话（使用统一存储格式）
          const existingSession = this.teacherStore.getSession(options.sessionId)
          
          if (existingSession) {
            // 设置到store
            this.teacherStore.setSession(existingSession)
            
            // 先从本地存储加载聊天记录（如果有）
            await this.teacherStore.loadChatHistory(existingSession.sessionId)
            
            // 然后从API加载聊天记录（同步远程消息）
            await this.loadTeacherChatHistory(existingSession.sessionId)
            
            return
          }
        }
        
        // 场景B：创建新会话（仅当是临时ID或未找到已有会话时）
        // 3.2 从localStorage读取当前教师科目
        const userId = getCurrentUserIdOrDefault()
        const teacherSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
        const subject = (teacherSubject === 'BIOLOGY' ? 'biology' : 'math') as 'biology' | 'math'
        
        // 3.3 生成会话ID
        const aiSessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // 3.4 生成会话名称
        const subjectName = teacherSubject === 'BIOLOGY' ? '生物' : '数学'
        const aiSessionName = subjectName
        
        // 3.5 创建老师会话（使用 Store 统一方法）
        const createdSession = this.teacherStore.createTeacherSession(
          aiSessionId,
          aiSessionName,
          subject
        )
        
        if (createdSession) {
          // 设置到store（会话信息已由 createTeacherSession 设置）
          // 这里确保 store 中的 session 是最新的
          this.teacherStore.setSession({
            sessionId: createdSession.sessionId,
            sessionName: createdSession.sessionName,
            subject: subject,
            createTime: createdSession.createTime
          })
          
          // 先从本地存储加载聊天记录（如果有）
          await this.teacherStore.loadChatHistory(createdSession.sessionId)
          
          // 然后从API加载聊天记录（同步远程消息）
          await this.loadTeacherChatHistory(createdSession.sessionId)
        }
      }
    } catch (error) {
      console.error('[TeacherGeneralStrategy] 初始化教师会话失败:', error)
      throw error
    }
  }
  
  /**
   * 加载老师聊天历史
   * 作用：从API加载老师对话的历史消息记录（现在主要用于同步远程消息到本地存储）
   */
  private async loadTeacherChatHistory(sessionId: string): Promise<void> {
    try {
      const history = await apiService.getTeacherChatHistory(sessionId)
      if (history && history.length > 0) {
        // 获取当前已存在的消息ID集合，避免覆盖已正确设置的消息
        const existingMessageIds = new Set(this.teacherStore.messages.map((msg: ChatBubble) => msg.id))
        
        const historyMessages: ChatBubble[] = history.map((msg) => {
          // 第1步：解析消息类型
          // API返回的type字段：0=TEXT, 1=IMAGE, 2=VOICE, 3=DATE
          let messageType: 'text' | 'voice' | 'image' | 'chat_record' = 'text'
          if (msg.type !== undefined) {
            if (msg.type === 1) {
              messageType = 'image'
            } else if (msg.type === 2) {
              messageType = 'voice'
            }
          }
          
          // 第2步：构建基础消息对象
          const baseMessage: ChatBubble = {
            id: msg.messageId,
            content: msg.content || '',
            type: msg.isSelf ? 'user' : 'teacher',
            timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : '',
            sender: msg.isSelf ? 'user' : 'teacher',
            messageType: messageType,
          }
          
          // 第3步：根据消息类型解析附加数据
          if (messageType === 'voice' && msg.content) {
            // 语音消息格式：duration + "," + filePath
            const parts = msg.content.split(',')
            if (parts.length >= 2) {
              const duration = parseInt(parts[0], 10) || 0
              const filePath = parts.slice(1).join(',') // 处理filePath中可能包含逗号的情况
              baseMessage.voiceData = {
                filePath: filePath,
                duration: duration, // duration是毫秒
                fileSize: 0, // 历史消息可能没有文件大小信息
              }
              baseMessage.content = '' // 语音消息不显示文字内容
            }
          } else if (messageType === 'image' && msg.content) {
            // 图片消息：content字段是filePath
            baseMessage.imageData = {
              filePath: msg.content,
              width: 0, // 历史消息可能没有尺寸信息
              height: 0,
              fileSize: 0,
            }
            baseMessage.content = '' // 图片消息不显示文字内容
          }
          
          return baseMessage
        })
        
        // 只添加不存在的消息，避免覆盖已正确设置的消息
        const newMessages = historyMessages.filter((msg) => !existingMessageIds.has(msg.id))
        if (newMessages.length > 0) {
          for (const message of newMessages) {
            await this.addMessage(message)
          }
        }
      }
    } catch (error) {
      console.error('[TeacherGeneralStrategy] 加载老师聊天历史失败:', error)
      // 加载失败不抛出错误，避免影响初始化流程
    }
  }
  
  // 第14步：发送语音消息
  async sendVoiceMessage(voiceInfo: {
    filePath: string
    duration: number
    fileSize: number
  }): Promise<{ success: boolean; message?: string }> {
    // 发送语音消息给老师 - 使用API服务
    const session = this.getCurrentSession()
    const success = await apiService.sendVoiceMessageToTeacher(
      voiceInfo.filePath,
      voiceInfo.duration.toString(),
      session.sessionId,
      session.subject
    )
    return { success }
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _textContent?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: SendMessageOptions
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
    
    // 需要确保imageInfo有filePath和base64DataUrl
    if (!imageInfo.filePath || !imageInfo.base64DataUrl) {
      throw new Error('图片数据不完整，请重试')
    }
    
    // 发送图片消息给老师
    await this.sendMessage('', {
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: { selectedModel?: string }
  ): Promise<void> {
    const messages = this.teacherStore.messages
    const messageIndex = messages.findIndex((msg) => msg.id === messageId)
    
    if (messageIndex === -1) {
      throw new Error('消息不存在')
    }
    
    // 更新消息内容
    messages[messageIndex].content = newContent
    
    // 删除该消息之后的所有消息
    const messagesToKeep = messages.slice(0, messageIndex + 1)
    this.teacherStore.messages.length = 0
    this.teacherStore.messages.push(...messagesToKeep)
    
    // 保存聊天记录
    await this.saveChatHistory()
    
    // 教师场景不支持编辑后重新发送，只更新消息内容
    // 如果需要重新发送，可以在这里调用 sendMessage
  }
  
  // 第17步：获取占位符文本
  getPlaceholderText(hasSelectedQuestion: boolean): string {
    if (!hasSelectedQuestion) {
      return '可以先聊聊，或选择题目后开始讨论'
    }
    return '向老师提问...'
  }
  
  // 删除消息：直接委托给 Store
  async deleteMessage(messageId: string): Promise<void> {
    await this.teacherStore.deleteMessage(messageId)
  }

  // 第18步：获取会话信息（教师策略需要）
  getSessionInfo(): ChatMessageSession | null {
    const session = this.teacherStore.currentSession
    if (!session) {
      return null
    }
    
    return {
      sessionId: session.sessionId,
      sessionName: session.sessionName,
      catalogId: 'CATEGORY_TEACHER_QA',
      sessionType: session.subject === 'biology' 
        ? SessionType.USER_TALK_TEACHER_BIOLOGY 
        : SessionType.USER_TALK_TEACHER_MATH,
      createTime: Date.now(),
      updateTime: Date.now(),
      msgCount: 0,
    }
  }
  
  // 第19步：是否显示转发按钮
  shouldShowForwardButton(): boolean {
    return false // 教师通用对话不支持转发
  }
  
  // 第20步：发送图片消息后是否清空输入框
  shouldClearInputAfterImage(): boolean {
    return false // 教师场景不清空输入框
  }
  
  // 第21步：是否使用乐观发送
  shouldOptimisticSend(): boolean {
    return true // 教师场景使用乐观发送
  }
  
  // 第22步：清理资源
  cleanup(): void {
    // 清理 Android 原生监听器
    if (typeof window !== 'undefined' && window.AndroidBridge?.cleanupTeacherMessageListener) {
      try {
        window.AndroidBridge.cleanupTeacherMessageListener()
      } catch {
        // 清理失败，忽略错误
      }
    }
    // 注意：不再清理 window.onTeacherMessageReceived，由 teacherGeneralChatStore 统一管理
  }
  
  // 第23步：获取当前科目
  getCurrentSubject(): 'biology' | 'math' {
    // 从localStorage读取当前教师科目
    const userId = getCurrentUserIdOrDefault()
    const teacherSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
    return teacherSubject === 'BIOLOGY' ? 'biology' : 'math'
  }

  // 获取联网搜索状态（教师策略不支持联网搜索）
  getEnableWebSearch(): boolean {
    return this.teacherStore.enableWebSearch
  }

  // 切换联网搜索状态
  toggleWebSearch(): void {
    this.teacherStore.toggleWebSearch()
  }
}


