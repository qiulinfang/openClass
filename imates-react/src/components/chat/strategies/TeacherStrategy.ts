import { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, ForwardResult, ForwardOptions } from './types'

export class TeacherStrategy implements ChatStrategy {
  async initialize(options?: any): Promise<void> {
    console.log('[TeacherStrategy] 初始化', options)
  }

  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    console.log('[TeacherStrategy] 发送消息', content, options)
  }

  handleAIResponse(message: any): void {
    console.log('[TeacherStrategy] 处理老师响应', message)
  }

  getSessionTitle(): string {
    return '老师答疑'
  }

  async forwardMessages(options: ForwardOptions): Promise<ForwardResult> {
    console.log('[TeacherStrategy] 转发消息', options)
    return { success: false, error: '未实现' }
  }

  async loadHistory(sessionId: string): Promise<void> {
    console.log('[TeacherStrategy] 加载历史', sessionId)
  }

  cleanup(): void {
    console.log('[TeacherStrategy] 清理资源')
  }
}

export default TeacherStrategy
