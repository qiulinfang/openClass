/**
 * 教师通用答疑策略（使用场景独立Store）
 * 处理教师通用答疑对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, TeacherSessionInfo, InitializeOptions } from './types'
import { useTeacherChatStore } from '../../../stores/teacherChatStore'
import { useQuestionStore } from '../../../stores/questionStore'
import { getUserId } from '../../../services'

export class TeacherStrategy implements ChatStrategy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private teacherStore = useTeacherChatStore() as any
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
      subject: session.subject as 'BIOLOGY' | 'MATH'
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
    // 注意：options.imageData 被传递给 store.sendMessage
    try {
      // 将消息发送委托给store处理
      await this.teacherStore.sendMessage(content, options.imageData)
    } catch (error) {
      console.error('[TeacherGeneralStrategy] 发送消息失败:', error)

      // 添加错误消息
      const errorMessage: ChatBubble = {
        id: (Date.now() + 1).toString(),
        content: '消息发送失败，请重试',
        type: 'teacher',
        timestamp: '',
        sender: 'teacher',
        isError: true
      }
      await this.addMessage(errorMessage)

      throw error
    }
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async initialize(_options: InitializeOptions): Promise<void> {
    console.log('[TeacherStrategy] initialize 被调用')

    // 检查是否已经初始化过（避免重复初始化）
    if (this.teacherStore.currentSession) {
      console.log('[TeacherStrategy] 已经存在会话，跳过初始化:', this.teacherStore.currentSession.sessionId)
      return
    }

    try {
      // 从localStorage读取当前教师科目
      const userId = getUserId()
      const teacherSubject = localStorage.getItem(`${userId}_currentTeacherSubject`) || 'MATH'
      const subject = (teacherSubject === 'BIOLOGY' ? 'BIOLOGY' : 'MATH') as 'BIOLOGY' | 'MATH'

      // 生成会话ID
      const sessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 生成会话名称
      const subjectName = teacherSubject === 'BIOLOGY' ? '生物' : '数学'
      const sessionName = subjectName

      console.log('[TeacherStrategy] 创建新会话:', { sessionId, subject, sessionName })

      // 设置会话信息到store
      this.teacherStore.setSession({
        sessionId: sessionId,
        sessionName: sessionName,
        subject: subject,
        createTime: Date.now()
      })

      // 加载历史消息
      console.log('[TeacherStrategy] 开始加载历史消息')
      await this.loadTeacherChatHistory(sessionId)
      console.log('[TeacherStrategy] 初始化完成')

    } catch (error) {
      console.error('[TeacherGeneralStrategy] 初始化教师会话失败:', error)
      throw error
    }
  }

  /**
   * 加载老师聊天历史
   * 作用：从研伴-后端API加载老师对话的历史消息记录
   */
  private async loadTeacherChatHistory(sessionId: string): Promise<void> {
    try {
      // 调用store的方法来加载历史消息
      await this.teacherStore.loadTeacherChatHistoryFromServer(sessionId)
    } catch (error) {
      console.error('[TeacherGeneralStrategy] 从服务器加载教师聊天历史失败:', error)
      // 加载失败不抛出错误，避免影响初始化流程
    }
  }
  
  // 第14步：发送语音消息（不支持）
  async sendVoiceMessage(): Promise<{ success: boolean; message?: string }> {
    return { success: false, message: '教师对话不支持发送语音消息' }
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
    const messageIndex = messages.findIndex((msg: ChatBubble) => msg.id === messageId)
    
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
  

  // getSessionInfo 方法已删除，所有策略都不需要此方法
  
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
    const userId = getUserId()
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


