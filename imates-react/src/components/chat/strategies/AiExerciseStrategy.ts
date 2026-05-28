import { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, ForwardResult, ForwardOptions } from './types'

export class AiExerciseStrategy implements ChatStrategy {
  async initialize(options?: any): Promise<void> {
    console.log('[AiExerciseStrategy] 初始化', options)
  }

  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    console.log('[AiExerciseStrategy] 发送消息', content, options)
  }

  handleAIResponse(message: any): void {
    console.log('[AiExerciseStrategy] 处理AI响应', message)
  }

  getSessionTitle(): string {
    return '练习答疑'
  }

  async forwardMessages(options: ForwardOptions): Promise<ForwardResult> {
    console.log('[AiExerciseStrategy] 转发消息', options)
    return { success: false, error: '未实现' }
  }

  async loadHistory(sessionId: string): Promise<void> {
    console.log('[AiExerciseStrategy] 加载历史', sessionId)
  }

  cleanup(): void {
    console.log('[AiExerciseStrategy] 清理资源')
  }
}

export default AiExerciseStrategy
