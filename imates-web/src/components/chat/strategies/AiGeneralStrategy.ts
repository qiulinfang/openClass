/**
 * AI通用对话策略（使用场景独立Store）
 * 处理通用AI对话逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardResult, ForwardOptions } from './ChatStrategy'
import type { SendMessageOptions } from './types'
import { useAiGeneralChatStore } from '../../../stores/aiGeneralChatStore'
import { useUserStore } from '../../../stores/userStore'
import {
  selectOrCreateTeacherSession,
  forwardMessageToTeacher,
  forwardMessagesSeparately,
  showForwardSuccessDialog,
} from './ForwardMessageHelper'
import { showMessage } from '../../../utils'

export class AiGeneralStrategy implements ChatStrategy {
  private aiGeneralStore = useAiGeneralChatStore()
  private userStore = useUserStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiGeneralStore.messages
  }
  
  // 第2步：添加消息（直接操作messages）
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiGeneralStore.messages.push(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    // 当 options.imageData 存在时，说明上游已插入了图片用户消息
    // 为避免再次插入空文本用户消息，传递 skipUserMessage 标记给 Store
    const skipUserMessage = !!options.imageData || !!options.skipUserMessage

    await this.aiGeneralStore.sendMessage(
      content,
      this.userStore.userInfo,
      this.userStore.subject as 'MATH' | 'BIOLOGY',
      options.selectedModel || 'mate',
      skipUserMessage
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '你好！我是你的AI助手。有什么问题我可以帮你解答吗？'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // AI通用对话不需要题目
  }
  
  // 第6步：获取消息类型
  getMessageType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第7步：获取发送者类型
  getSenderType(): 'ai' | 'teacher' {
    return 'ai'
  }
  
  // 第8步：保存聊天历史
  async saveChatHistory(): Promise<void> {
    await this.aiGeneralStore.saveChatHistory()
  }
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI通用对话支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    // AI通用场景：返回 null，需要用户手动选择老师
    return null
  }
  
  // 第11步：转发单条消息
  async forwardMessage(message: ChatBubble, options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 选择或创建老师会话
      const session = await selectOrCreateTeacherSession(
        this.getCurrentSubjectForForward()
      )
      
      if (!session) {
        return {
          success: false,
          error: '用户取消选择或会话创建失败',
        }
      }
      
      // 转发消息到通用会话
      const success = await forwardMessageToTeacher([message], session.sessionId, 'general')
      
      if (success) {
        const result: ForwardResult = {
          success: true,
          successCount: 1,
          sessionId: session.sessionId,
        }
        
        // 显示成功提示或对话框
        if (options.showDialog !== false) {
          showForwardSuccessDialog(result, options, async () => {
            if (options.onSuccess) {
              await options.onSuccess(result)
            }
          })
        } else {
          showMessage('转发成功', 'success')
          if (options.onSuccess) {
            await options.onSuccess(result)
          }
        }
        
        return result
      } else {
        const error = '转发失败'
        if (options.onError) {
          options.onError(error)
        }
        return {
          success: false,
          error,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (options.onError) {
        options.onError(errorMessage)
      }
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
  
  // 第12步：转发多条消息
  async forwardMessages(messages: ChatBubble[], options: ForwardOptions = {}): Promise<ForwardResult> {
    try {
      // 选择或创建老师会话
      const session = await selectOrCreateTeacherSession(
        this.getCurrentSubjectForForward()
      )
      
      if (!session) {
        return {
          success: false,
          error: '用户取消选择或会话创建失败',
        }
      }
      
      // 逐条转发消息到通用会话
      const { successCount } = await forwardMessagesSeparately(
        messages,
        session.sessionId,
        'general'
      )
      
      if (successCount > 0) {
        const result: ForwardResult = {
          success: true,
          successCount,
          sessionId: session.sessionId,
        }
        
        // 显示成功提示或对话框
        if (options.showDialog !== false) {
          showForwardSuccessDialog(result, options, async () => {
            if (options.onSuccess) {
              await options.onSuccess(result)
            }
          })
        } else {
          showMessage(`转发成功，已转发 ${successCount} 条消息`, 'success')
          if (options.onSuccess) {
            await options.onSuccess(result)
          }
        }
        
        return result
      } else {
        const error = '转发失败，请重试'
        if (options.onError) {
          options.onError(error)
        }
        return {
          success: false,
          error,
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (options.onError) {
        options.onError(errorMessage)
      }
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}
