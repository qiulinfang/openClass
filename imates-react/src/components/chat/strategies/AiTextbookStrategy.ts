import { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, ForwardResult, ForwardOptions } from './types'

export class AiTextbookStrategy implements ChatStrategy {
  async initialize(options?: any): Promise<void> {
    console.log('[AiTextbookStrategy] 初始化', options)
  }

  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    console.log('[AiTextbookStrategy] 发送消息', content, options)
  }

  handleAIResponse(message: any): void {
    console.log('[AiTextbookStrategy] 处理AI响应', message)
  }

  getSessionTitle(): string {
    return '教材问答'
  }

  async forwardMessages(options: ForwardOptions): Promise<ForwardResult> {
    console.log('[AiTextbookStrategy] 转发消息', options)
    return { success: false, error: '未实现' }
  }

  async loadHistory(sessionId: string): Promise<void> {
    console.log('[AiTextbookStrategy] 加载历史', sessionId)
  }

  cleanup(): void {
    console.log('[AiTextbookStrategy] 清理资源')
  }
}

export default AiTextbookStrategy
