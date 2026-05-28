import { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, ForwardResult, ForwardOptions } from './types'

export class UserClientStrategy implements ChatStrategy {
  async initialize(options?: any): Promise<void> {
    console.log('[UserClientStrategy] 初始化', options)
  }

  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    console.log('[UserClientStrategy] 发送消息', content, options)
  }

  handleAIResponse(message: any): void {
    console.log('[UserClientStrategy] 处理响应', message)
  }

  getSessionTitle(): string {
    return '用户客户端'
  }

  async forwardMessages(options: ForwardOptions): Promise<ForwardResult> {
    console.log('[UserClientStrategy] 转发消息', options)
    return { success: false, error: '未实现' }
  }

  async loadHistory(sessionId: string): Promise<void> {
    console.log('[UserClientStrategy] 加载历史', sessionId)
  }

  cleanup(): void {
    console.log('[UserClientStrategy] 清理资源')
  }
}

export default UserClientStrategy
