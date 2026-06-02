import { httpClient } from './http-client'
import { getUserId } from './auth-service'
import { getWebSocketService } from '../websocket/webSocketService'
import { getApiPaths } from '@/config/env-config'

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
   * 获取历史会话列表
   */
  public async getTeacherChatHistory(
    sessionId: string,
    pageNum: number,
    pageSize: number,
  ): Promise<TeacherHistoryMessage[]> {
    try {
      // 使用研伴后端的API路径
      console.log('[TeacherChatApi] 发送API请求到 /api/question/historyList')
      const requestBody: TeacherHistoryRequest = {
        sessionId,
      }

      // 添加分页参数（如果提供）
      if (pageNum !== undefined && pageSize !== undefined) {
        requestBody.page = pageNum
        requestBody.pageSize = pageSize
      }

      const response = await httpClient.post(getApiPaths().yanban.teacher.historyList, requestBody)
      console.log('[TeacherChatApi] API响应:', response)

      // 处理可能的多种数据结构：直接数组、或者对象中的各种字段
      // senderType: 后端可能返回 ai/user/teacher 等，用于判断消息方向
      let messageArray: Array<{
        id: string
        messageId: string
        msgContent: string
        msgType: string
        createTime: string
        msgSendId: string
        account?: string
        senderType?: string
      }> = []
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
        return messageArray.map((msg): TeacherHistoryMessage => {
          const normalizedSenderType = (msg.senderType || '').toLowerCase()
          const isSelf = normalizedSenderType
            ? normalizedSenderType === 'user'
            : msg.account === currentUserId

          return {
            messageId: msg.messageId,
            content: msg.msgContent,
            type: convertMessageType(msg.msgType),
            timestamp: parseCreateTime(msg.createTime),
            isSelf,
          }
        })
      }

      return []
    } catch (error) {
      console.error('[TeacherChatApi] 获取老师聊天历史失败:', error)
      return []
    }
  }

}

// 导出类型
export type { TeacherHistoryMessage }
