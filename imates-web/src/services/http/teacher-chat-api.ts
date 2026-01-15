import { httpClient } from '../http/http-client'
import { getUserId } from './auth-service'
import { getWebSocketService } from '../websocket/webSocketService'

/**
 * 教师聊天历史消息格式
 */
interface TeacherHistoryMessage {
  messageId: string
  content: string
  type: string
  timestamp: number
  isSelf: boolean
}

/**
 * 教师聊天API服务
 * 专门处理与教师聊天相关的API调用
 */
export class TeacherChatApi {
  /**
   * 发送消息到教师
   */
  public async sendMessage(
    sessionId: string,
    msgType: string,
    msgContent: string
  ): Promise<boolean> {
    try {
      // 研伴后端不支持WebSocket发送消息，使用HTTP API
      const response = await httpClient.post('/api/api/question/replyMessage', {
        sessionId: sessionId,
        msgType: msgType,
        msgContent: msgContent
      })

      console.log('[TeacherChatApi] 通过HTTP API发送消息成功:', { sessionId, msgType, msgContent })
      return response.success
    } catch (error) {
      console.error('[TeacherChatApi] 发送消息失败:', error)
      return false
    }
  }

  /**
   * 获取教师聊天历史
   */
  public async getTeacherChatHistory(sessionId: string): Promise<TeacherHistoryMessage[]> {
    console.log('[TeacherChatApi] getTeacherChatHistory 被调用，sessionId:', sessionId, '调用栈:', new Error().stack?.split('\n').slice(2, 5).join('\n'))
    try {
      // 使用相对路径，通过getRouteBaseMap()配置的路由映射自动转发
      // 注意：后端API路径为 /api/api/question/...，需要双重api前缀
      console.log('[TeacherChatApi] 发送API请求到 /api/api/question/historyList')
      const response = await httpClient.post('/api/api/question/historyList', {
        sessionId: sessionId
      })
      console.log('[TeacherChatApi] API响应:', response)

      if (response.success && response.data && Array.isArray(response.data)) {
        // 获取当前用户ID，用于判断消息是否是自己发送的
        const currentUserId = getUserId()

        // 设置WebSocket会话ID，用于接收实时消息
        const webSocket = getWebSocketService('teacher')
        webSocket.setSessionId(sessionId)

        // 转换数据格式以匹配现有代码的期望
        return response.data.map((msg: { id: string; msgContent: string; msgType: string; createTime: string; msgSendId: string }): TeacherHistoryMessage => ({
          messageId: msg.id,
          content: msg.msgContent,
          type: msg.msgType,
          timestamp: new Date(msg.createTime).getTime(),
          isSelf: msg.msgSendId === currentUserId // 如果发送者ID等于当前用户ID，则是自己发送的消息
        }))
      }

      return []
    } catch (error) {
      console.error('[TeacherChatApi] 获取老师聊天历史失败:', error)
      return []
    }
  }

  /**
   * 接受消息（模拟实现）
   * 模拟从教师端接收消息，用于测试和开发环境
   */
  public async receiveMessage(): Promise<TeacherHistoryMessage | null> {
    try {
      // 模拟实现：返回一个模拟的教师回复消息
      const mockMessages = [
        { content: '好的，我明白了。请问还有什么问题吗？', type: '0' },
        { content: '这个概念需要多加练习，你可以尝试做几道相关题目。', type: '0' },
        { content: '很好，你的思路是对的。继续保持这种学习方法。', type: '0' },
        { content: '这个问题需要结合前面的知识点来理解。', type: '0' },
        { content: '你可以参考课本上的例题，加深理解。', type: '0' }
      ]

      // 随机选择一条消息
      const randomMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)]

      // 模拟教师消息
      const teacherMessage: TeacherHistoryMessage = {
        messageId: `teacher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: randomMessage.content,
        type: randomMessage.type,
        timestamp: Date.now(),
        isSelf: false // 教师消息，isSelf为false
      }

      console.log('[TeacherChatApi] 模拟接收教师消息:', teacherMessage)
      return teacherMessage
    } catch (error) {
      console.error('[TeacherChatApi] 模拟接收消息失败:', error)
      return null
    }
  }
}
