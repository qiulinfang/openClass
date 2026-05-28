import { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, ChatViewInterface, ForwardResult, ForwardOptions } from './types'

export class AiGeneralStrategy implements ChatStrategy {
  protected chatView?: ChatViewInterface

  async initialize(options?: any): Promise<void> {
    console.log('[AiGeneralStrategy] 初始化', options)
  }

  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    console.log('[AiGeneralStrategy] 发送消息', content, options)
  }

  handleAIResponse(message: any): void {
    console.log('[AiGeneralStrategy] 处理AI响应', message)
  }

  getSessionTitle(): string {
    return 'AI 对话'
  }

  async forwardMessages(options: ForwardOptions): Promise<ForwardResult> {
    console.log('[AiGeneralStrategy] 转发消息', options)
    return { success: false, error: '未实现' }
  }

  async loadHistory(sessionId: string): Promise<void> {
    console.log('[AiGeneralStrategy] 加载历史', sessionId)
  }

  cleanup(): void {
    console.log('[AiGeneralStrategy] 清理资源')
  }

  setChatView(chatView: ChatViewInterface) {
    this.chatView = chatView
  }
}

export default AiGeneralStrategy
