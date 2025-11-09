/**
 * AI教材对话策略（使用场景独立Store）
 * 处理教材问答逻辑
 */

import type { ChatBubble } from '../../../types'
import type { ChatStrategy, ForwardResult, ForwardOptions } from './ChatStrategy'
import type { SendMessageOptions } from './types'
import { useAiTextbookChatStore } from '../../../stores/aiTextbookChatStore'
import { useKnowledgeGraphStore } from '../../../stores/KnowledgeGraphStore'
import {
  selectOrCreateTeacherSession,
  forwardMessageToTeacher,
  forwardMessagesSeparately,
  showForwardSuccessDialog,
} from './ForwardMessageHelper'
import { showMessage } from '../../../utils'

export class AiTextbookStrategy implements ChatStrategy {
  private aiTextbookStore = useAiTextbookChatStore()
  private knowledgeGraphStore = useKnowledgeGraphStore()
  
  // 第1步：获取消息列表
  getMessages(): ChatBubble[] {
    return this.aiTextbookStore.messages
  }
  
  // 第2步：添加消息
  async addMessage(message: ChatBubble): Promise<void> {
    this.aiTextbookStore.addMessage(message)
  }
  
  // 第3步：发送消息
  async sendMessage(content: string, options: SendMessageOptions = {}): Promise<void> {
    const hidePrefix = content.includes('我们开始吧')
    await this.aiTextbookStore.sendMessage(
      content,
      options.selectedModel,
      options.imageData,
      hidePrefix
    )
  }
  
  // 第4步：获取欢迎消息
  getWelcomeMessage(): string {
    return '你好！我可以帮你解答教材中的问题。请告诉我你的疑问，或者直接发送教材截图。'
  }
  
  // 第5步：检查是否需要选择题目
  requiresQuestion(): boolean {
    return false // AI教材对话不需要题目
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
    await this.aiTextbookStore.saveChatHistory(false)
  }
  
  // 第9步：检查是否支持转发消息
  canForwardMessage(): boolean {
    return true // AI教材对话支持转发
  }
  
  // 第10步：获取当前科目（用于转发）
  getCurrentSubjectForForward(): 'biology' | 'math' | null {
    // AI教材场景：使用知识图谱的 store 的科目状态字段
    try {
      const subject = this.knowledgeGraphStore.getCurrentSubjectLowercase()
      return subject || null
    } catch (error) {
      console.error('[AiTextbookStrategy] ❌ 获取知识图谱科目失败:', error)
      return null
    }
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
