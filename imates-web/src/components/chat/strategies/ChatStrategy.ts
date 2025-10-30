/**
 * 聊天策略接口
 * 定义不同对话类型需要实现的方法
 */

import type { ChatBubble } from '../../../types'
import type { SendMessageOptions } from './types'

export interface ChatStrategy {
  // 第1步：获取消息存储引用
  getMessages(): ChatBubble[]
  
  // 第2步：添加消息到存储
  addMessage(message: ChatBubble): Promise<void>
  
  // 第3步：发送消息的具体逻辑
  sendMessage(content: string, options?: SendMessageOptions): Promise<void>
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean
  
  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher'
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' | 'user'
  
  // 第8步：保存聊天历史
  saveChatHistory(): Promise<void>
}

