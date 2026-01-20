import { httpClient } from '../http/http-client'
import { getUserId } from './auth-service'
import { getWebSocketService } from '../websocket/webSocketService'

/**
 * 解析后端返回的日期时间格式
 * 格式: "MM-DD HH:mm" -> 转换为完整的时间戳
 */
const parseCreateTime = (createTime: string): number => {
  try {
    // 格式: "01-19 12:24"
    const match = createTime.match(/^(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/)
    if (!match) {
      console.warn('[TeacherChatApi] ⚠️ 无法解析 createTime 格式:', createTime)
      return Date.now()
    }

    const [, month, day, hour, minute] = match
    const currentYear = new Date().getFullYear()

    // 构造完整的日期时间字符串
    const dateString = `${currentYear}-${month}-${day} ${hour}:${minute}:00`
    const timestamp = new Date(dateString).getTime()

    if (isNaN(timestamp)) {
      console.warn('[TeacherChatApi] ⚠️ 构造的日期无效:', { createTime, dateString })
      return Date.now()
    }

    return timestamp
  } catch (error) {
    console.warn('[TeacherChatApi] ⚠️ 解析 createTime 失败:', { createTime, error })
    return Date.now()
  }
}

/**
 * 消息类型枚举
 */
type MessageType = 'text' | 'image' | 'voice'

/**
 * 转换后端消息类型为前端消息类型
 * 后端: "0"=文本, "1"=图片, "2"=语音
 * 前端: "text" | "image" | "voice"
 */
const convertMessageType = (msgType: string): MessageType => {
  switch (msgType) {
    case '1':
      return 'image'
    case '2':
      return 'voice'
    default:
      return 'text'
  }
}

/**
 * 教师聊天历史请求体
 */
interface TeacherHistoryRequest {
  sessionId: string
  page?: number
  pageSize?: number
}

/**
 * 教师聊天历史消息格式
 */
interface TeacherHistoryMessage {
  messageId: string
  content: string
  type: MessageType // 使用转换后的消息类型
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
      const response = await httpClient.post('/api/question/replyMessage', {
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
   * 获取教师聊天历史（支持分页）
   */
  public async getTeacherChatHistory(sessionId: string, page?: number, pageSize?: number): Promise<TeacherHistoryMessage[]> {
    console.log('[TeacherChatApi] getTeacherChatHistory 被调用，sessionId:', sessionId, '调用栈:', new Error().stack?.split('\n').slice(2, 5).join('\n'))
    try {
      // 使用研伴后端的API路径
      console.log('[TeacherChatApi] 发送API请求到 /api/question/historyList')
      const requestBody: TeacherHistoryRequest = {
        sessionId: sessionId
      }

      // 添加分页参数（如果提供）
      if (page !== undefined && pageSize !== undefined) {
        requestBody.page = page
        requestBody.pageSize = pageSize
      }

      const response = await httpClient.post('/api/question/historyList', requestBody)
      console.log('[TeacherChatApi] API响应:', response)

      // 处理可能的多种数据结构：直接数组、或者对象中的各种字段
      let messageArray: Array<{ id: string; messageId: string; msgContent: string; msgType: string; createTime: string; msgSendId: string }> = []
      if (response.success && response.data) {
        const dataObj = response.data as { data?: unknown }
        if (dataObj.data && Array.isArray(dataObj.data)) {
          messageArray = dataObj.data as typeof messageArray
        }
      }

      if (messageArray.length > 0) {
        // 获取当前用户ID，用于判断消息是否是自己发送的
        const currentUserId = getUserId()

        // 设置WebSocket会话ID，用于接收实时消息
        const webSocket = getWebSocketService('teacher')
        webSocket.setSessionId(sessionId)

        // 转换数据格式以匹配现有代码的期望
        return messageArray.map((msg: { id: string; messageId: string; msgContent: string; msgType: string; createTime: string; msgSendId: string; account?: string }): TeacherHistoryMessage => ({
          messageId: msg.messageId, // 使用前端生成的消息ID
          content: msg.msgContent,
          type: convertMessageType(msg.msgType), // 转换消息类型
          timestamp: parseCreateTime(msg.createTime), // 解析后端日期格式
          isSelf: msg.account === currentUserId // 如果发送者ID等于当前用户ID，则是自己发送的消息
        }))
      }

      return []
    } catch (error) {
      console.error('[TeacherChatApi] 获取老师聊天历史失败:', error)
      return []
    }
  }

}
