import { httpClient, ApiResponse } from './httpClient'
import { getAiChatUrl, getAiExerciseUrl } from './apiConfig'

export interface AiChatMessageRequest {
  sessionId: string
  newValue: string
  coversation: string
  question: string
  answer: string
  name: string
  reason: string
  bmNo: string
  isWebSearch: string
  role: string
  subject: string
  dstUrl: string
  explanation: string
  imageList?: { base64DataUrl: string }[]
  focus?: any
}

export interface ChatResponse {
  success: boolean
  messageId: string
  reply: string
  sessionId: string
  timestamp: number
}

export class AiChatApi {
  private pollIntervalMs = 500

  async sendChatMessage(
    message: AiChatMessageRequest,
    onComplete?: (response: ChatResponse) => void,
    onStream?: (chunk: string, isComplete: boolean) => void
  ): Promise<ChatResponse> {
    try {
      const url = message.dstUrl
      const result = await this.pollChatMessage(
        message,
        url,
        onComplete,
        onStream,
        '',
        this.generateId()
      )
      return result
    } catch (error) {
      const errorResult: ChatResponse = {
        success: false,
        messageId: '',
        reply: '发送消息失败: ' + (error as Error).message,
        timestamp: Date.now(),
        sessionId: message.sessionId,
      }

      if (onComplete) {
        onComplete(errorResult)
      }

      return errorResult
    }
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  private async pollChatMessage(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: ChatResponse) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = ''
  ): Promise<ChatResponse> {
    try {
      if (message.reason === 'continue') {
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs))
      }
      
      const response = await httpClient.post<any>(url, message)

      return this.handleResponse(
        response,
        message,
        url,
        onComplete,
        onStream,
        accumulatedContent,
        messageId
      )
    } catch (error) {
      console.error('[AiChatApi] 轮询异常:', error)
      return this.handleError(error, messageId, accumulatedContent, onComplete, onStream)
    }
  }

  private parseSseContent(raw: string): { content: string; isEnd: boolean } {
    const result = { content: '', isEnd: false }
    
    // 检查是否包含独立的 "end" 标记
    if (raw.includes('end') && !raw.includes('"end"')) {
      // 提取 end 之前的内容
      const endIndex = raw.indexOf('end')
      const beforeEnd = raw.substring(0, endIndex)
      raw = beforeEnd
      result.isEnd = true
    }
    
    // 分割多个 data: 块
    const matches = raw.matchAll(/data:\s*(\{[^}]*\})/g)
    
    for (const match of matches) {
      try {
        const json = JSON.parse(match[1])
        if (json.content) {
          result.content += json.content
        }
        // 检查 agent_status
        if (json.agent_status === 'done' || json.agent_status === 'idle') {
          result.isEnd = true
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
    
    // 也检查原始文本是否包含结束状态
    if (raw.includes('"agent_status":"done"') || raw.includes('"agent_status":"idle"')) {
      result.isEnd = true
    }
    
    return result
  }

  private async handleResponse(
    response: ApiResponse,
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: ChatResponse) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = ''
  ): Promise<ChatResponse> {
    console.log('[AiChatApi] handleResponse:', { 
      success: response?.success, 
      hasData: !!response?.data,
      rawMessage: response?.data?.message?.substring(0, 100),
      accumulatedLength: accumulatedContent.length 
    })

    if (!response || !response.success || !response.data) {
      console.log('[AiChatApi] 响应失败或无数据')
      return this.createErrorResult(messageId, accumulatedContent || '请求失败，请重试。', onComplete, onStream)
    }

    const rawMessage = response.data?.message ?? response.message ?? ''
    
    // 解析 SSE 内容
    const parsed = this.parseSseContent(rawMessage)
    console.log('[AiChatApi] parsed:', parsed)

    // 有内容时先处理内容
    if (parsed.content) {
      const newContent = accumulatedContent + parsed.content
      
      // 如果是结束，先回调再结束
      if (parsed.isEnd) {
        console.log('[AiChatApi] 收到结束标记，准备结束')
        if (onStream) {
          onStream(parsed.content, false)
        }
        return this.handleEnd(messageId, newContent, response.data?.sessionId, message.sessionId, onComplete, onStream)
      }
      
      console.log('[AiChatApi] 有新内容，继续轮询，累积:', newContent.length)
      
      if (onStream) {
        onStream(parsed.content, false)
      }

      return this.pollChatMessage(
        { ...message, reason: 'continue' },
        url,
        onComplete,
        onStream,
        newContent,
        messageId
      )
    }

    console.log('[AiChatApi] 无新内容，继续轮询')
    return this.pollChatMessage(
      { ...message, reason: 'continue' },
      url,
      onComplete,
      onStream,
      accumulatedContent,
      messageId
    )
  }

  private async handleEnd(
    messageId: string,
    accumulatedContent: string,
    responseSessionId: string,
    messageSessionId: string,
    onComplete?: (response: ChatResponse) => void,
    onStream?: (chunk: string, isComplete: boolean) => void
  ): Promise<ChatResponse> {
    console.log('[AiChatApi] handleEnd, content:', accumulatedContent.substring(0, 100))
    
    if (onStream) {
      onStream('', true)
    }

    const finalResult: ChatResponse = {
      success: true,
      messageId,
      reply: accumulatedContent,
      sessionId: responseSessionId || messageSessionId,
      timestamp: Date.now(),
    }

    console.log('[AiChatApi] 调用 onComplete:', finalResult)

    if (onComplete) {
      onComplete(finalResult)
    }

    return finalResult
  }

  private handleError(
    error: any,
    messageId: string,
    accumulatedContent: string,
    onComplete?: (response: ChatResponse) => void,
    onStream?: (chunk: string, isComplete: boolean) => void
  ): ChatResponse {
    const errorMessage = accumulatedContent || '网络错误: ' + (error as Error).message
    return this.createErrorResult(messageId, errorMessage, onComplete, onStream)
  }

  private createErrorResult(
    messageId: string,
    errorMessage: string,
    onComplete?: (response: ChatResponse) => void,
    onStream?: (chunk: string, isComplete: boolean) => void
  ): ChatResponse {
    const errorResult: ChatResponse = {
      success: false,
      messageId,
      reply: errorMessage,
      timestamp: Date.now(),
      sessionId: '',
    }

    if (onStream) {
      onStream('', true)
    }

    if (onComplete) {
      onComplete(errorResult)
    }

    return errorResult
  }
}

export const aiChatApi = new AiChatApi()

export const sendChatMessage = async (
  content: string,
  sessionId?: string,
  role: string = 'mate',
  useScreenshot: boolean = false,
  onStream?: (chunk: string, isComplete: boolean) => void,
  onComplete?: (response: ChatResponse) => void
): Promise<ChatResponse> => {
  const userId = 'user_' + Date.now()
  const finalSessionId = sessionId || `${userId}-general-session-${Date.now()}`
  
  const request: AiChatMessageRequest = {
    sessionId: finalSessionId,
    newValue: sessionId ? '0' : '1',
    coversation: content,
    question: '',
    answer: '',
    name: userId,
    reason: sessionId ? 'continue' : 'start',
    bmNo: finalSessionId,
    isWebSearch: '0',
    role,
    subject: '',
    dstUrl: getAiChatUrl(useScreenshot),
    explanation: '',
  }

  return aiChatApi.sendChatMessage(request, onComplete, onStream)
}

export const sendExerciseChatMessage = async (
  content: string,
  question: string,
  sessionId?: string,
  subject: 'MATH' | 'BIOLOGY' = 'BIOLOGY',
  onStream?: (chunk: string, isComplete: boolean) => void,
  onComplete?: (response: ChatResponse) => void
): Promise<ChatResponse> => {
  const userId = 'user_' + Date.now()
  const finalSessionId = sessionId || `${userId}-exercise-${Date.now()}`
  
  const request: AiChatMessageRequest = {
    sessionId: finalSessionId,
    newValue: sessionId ? '0' : '1',
    coversation: content,
    question,
    answer: '',
    name: userId,
    reason: sessionId ? 'continue' : 'start',
    bmNo: finalSessionId,
    isWebSearch: '0',
    role: 'mate',
    subject: subject.toLowerCase(),
    dstUrl: getAiExerciseUrl(subject),
    explanation: '',
  }

  return aiChatApi.sendChatMessage(request, onComplete, onStream)
}
