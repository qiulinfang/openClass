/**
 * 教师答疑策略（使用场景独立Store）
 * 处理教师答疑对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, TeacherSessionInfo } from './types'
import { useTeacherGeneralChatStore } from '../../../stores/teacherGeneralChatStore'
import { useQuestionStore } from '../../../stores/questionStore'

export class TeacherStrategy implements ChatStrategy {
  private teacherStore = useTeacherGeneralChatStore()
  private questionStore = useQuestionStore()
  
  // 教师会话信息
  private session: TeacherSessionInfo
  
  constructor(teacherSession: TeacherSessionInfo) {
    this.session = teacherSession
    
    // 设置教师Store的会话信息
    this.teacherStore.setSession({
      sessionId: teacherSession.sessionId,
      sessionName: teacherSession.sessionName,
      subject: teacherSession.subject,
      createTime: Date.now()
    })
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
    return `你好！我是你的${this.session.subject}老师。有什么问题可以问我。`
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
}
