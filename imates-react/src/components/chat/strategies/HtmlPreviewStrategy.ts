import { ChatStrategy } from './ChatStrategy'
import type { SendMessageOptions, ForwardResult, ForwardOptions } from './types'

export class HtmlPreviewStrategy implements ChatStrategy {
  async initialize(options?: any): Promise<void> {
    console.log('[HtmlPreviewStrategy] 初始化', options)
  }

  async sendMessage(content: string, options?: SendMessageOptions): Promise<void> {
    console.log('[HtmlPreviewStrategy] 发送消息', content, options)
  }

  handleAIResponse(message: any): void {
    console.log('[HtmlPreviewStrategy] 处理HTML预览响应', message)
  }

  getSessionTitle(): string {
    return '网页预览'
  }

  async forwardMessages(options: ForwardOptions): Promise<ForwardResult> {
    console.log('[HtmlPreviewStrategy] 转发消息', options)
    return { success: false, error: '未实现' }
  }

  async loadHistory(sessionId: string): Promise<void> {
    console.log('[HtmlPreviewStrategy] 加载历史', sessionId)
  }

  cleanup(): void {
    console.log('[HtmlPreviewStrategy] 清理资源')
  }
}

export default HtmlPreviewStrategy
