import { request } from '@/utils/request'
import { getApiPaths } from '@/config/env-config'
import type { BackendHistoryMessage, SSEPayload } from '@/types/chat'

export interface AiChatMessageRequest {
  query?: string
  sessionId?: string
  dstUrl?: string
  reason?: string
  [key: string]: any
}

export interface ManageConversationMemoryRequest {
  action: string
  thread_id?: string
  agent_name?: string
  [key: string]: any
}

export interface AiChatMessageResponse {
  success: boolean
  messageId: string
  reply: string
  timestamp: number
  sessionId?: string
  agentStatus?: string
  historyMessages?: BackendHistoryMessage[]
}

const generateUniqueId = (prefix = 'ai') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

/**
 * 对应 imates-web 的 AiChatApi 服务（1:1 全量方法移植，共 18 个全量方法）
 */
export class AiChatApi {
  private static readonly pollIntervalMs = 500

  /** 1. 发送 HTTP 底层请求 */
  static async sendChatRequest(url: string, requestBody: any): Promise<any> {
    return await request({
      url,
      method: 'POST',
      data: requestBody
    })
  }

  /** 2. 发送 AI 消息主入口 */
  static async sendChatMessage(
    message: AiChatMessageRequest,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
  ): Promise<any> {
    try {
      const url = message.dstUrl || getApiPaths().xueban.ai.chat
      const result = await this.pollChatMessage(
        message,
        url,
        onComplete,
        onStream,
        '',
        generateUniqueId('ai'),
        onHistoryUpdate
      )
      return result
    } catch (error: any) {
      const errorResult = {
        success: false,
        messageId: '',
        reply: '发送消息失败: ' + (error instanceof Error ? error.message : String(error)),
        timestamp: Date.now()
      }

      if (onComplete) {
        Promise.resolve(onComplete(errorResult)).catch(() => {})
      }

      return errorResult
    }
  }

  /** 3. 递归轮询打字机调度器 */
  private static async pollChatMessage(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
  ): Promise<any> {
    try {
      if (message.reason === 'continue') {
        await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs))
      }

      const response = await this.sendChatRequest(url, message)

      return await this.handleChatResponse(
        response,
        message,
        url,
        onComplete,
        onStream,
        accumulatedContent,
        messageId,
        onHistoryUpdate
      )
    } catch (error) {
      return this.handleChatError(error, messageId, accumulatedContent, onComplete, onStream)
    }
  }

  /** 4. 响应统一分发机制 */
  private static async handleChatResponse(
    response: any,
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
  ): Promise<any> {
    if (!response || (response.success === false && !response.data)) {
      return this.createErrorResult(messageId, accumulatedContent || '请求失败，请重试。', onComplete, onStream)
    }

    const rawMessage = response.data && response.data.message != null ? response.data.message : response.message ?? ''
    const raw = String(rawMessage)
    const trimmedChunk = raw.trim()

    const nonSseResult = this.handleNonSseResponse({
      raw,
      trimmedChunk,
      message,
      response,
      accumulatedContent,
      messageId,
      onComplete,
      onStream,
      onHistoryUpdate,
      url
    })
    if (nonSseResult) return nonSseResult

    const parsed = this.parseSseText(raw)
    const sseResult = this.handleSseResponse({
      parsed,
      message,
      url,
      response,
      accumulatedContent,
      messageId,
      onComplete,
      onStream,
      onHistoryUpdate
    })
    if (sseResult) return sseResult

    return this.handleNonDataResponse({
      rawMessage,
      message,
      url,
      accumulatedContent,
      messageId,
      onComplete,
      onStream,
      onHistoryUpdate
    })
  }

  /** 5. 处理非 SSE（如占位符、单帧/截图 QA）响应 */
  private static handleNonSseResponse(params: {
    raw: string
    trimmedChunk: string
    message: AiChatMessageRequest
    response: any
    accumulatedContent: string
    messageId: string
    onComplete?: (response: any) => void | Promise<void>
    onStream?: (chunk: string, isComplete: boolean) => void
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
    url: string
  }): any | null {
    const {
      raw,
      trimmedChunk,
      message,
      response,
      accumulatedContent,
      messageId,
      onComplete,
      onStream,
      onHistoryUpdate,
      url
    } = params

    if (trimmedChunk === '成功' && !raw.includes('data:')) {
      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    if (message.dstUrl === getApiPaths().xueban.ai.previewPictureQA && !raw.includes('data:')) {
      const normalizedChunk = this.extractMessageFromConcatenatedJson(raw) ?? raw
      if (normalizedChunk.trim() === 'end') {
        return this.handlePollingEnd(messageId, accumulatedContent, response?.data?.sessionId, message.sessionId || '', onComplete, onStream)
      }
      const chunk = this.stripTrailingEnd(normalizedChunk)
      if (chunk && chunk.trim()) {
        return this.handleNewContent(chunk, message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate, true)
      }
      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    if (trimmedChunk === 'end') {
      return this.handlePollingEnd(messageId, accumulatedContent, response?.data?.sessionId, message.sessionId || '', onComplete, onStream)
    }

    return null
  }

  /** 6. 处理 SSE 格式响应数据 */
  private static handleSseResponse(params: {
    parsed: ReturnType<typeof AiChatApi['parseSseText']>
    message: AiChatMessageRequest
    url: string
    response: any
    accumulatedContent: string
    messageId: string
    onComplete?: (response: any) => void
    onStream?: (chunk: string, isComplete: boolean) => void
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
  }): any | null {
    const { parsed, message, url, response, accumulatedContent, messageId, onComplete, onStream, onHistoryUpdate } = params

    if (!parsed.hasData) return null

    if (onHistoryUpdate && parsed.latestHistory && parsed.latestHistory.length > 0) {
      try {
        onHistoryUpdate(parsed.latestHistory, parsed.agentStatus)
      } catch (e) {}
    }

    if (parsed.agentStatus === 'drawing' && !parsed.textChunk && (!parsed.latestHistory || parsed.latestHistory.length === 0)) {
      if (onStream) {
        try { onStream('', false) } catch (e) {}
      }
      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    if (parsed.ended) {
      const newAccumulated = this.mergeContent(accumulatedContent, parsed.textChunk || '')
      return this.handlePollingEnd(messageId, newAccumulated, response?.data?.sessionId, message.sessionId || '', onComplete, onStream)
    }

    if (parsed.textChunk && parsed.textChunk !== '') {
      const chunk = this.stripTrailingEnd(parsed.textChunk)
      if (chunk.trim().toLowerCase() === 'end') {
        return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
      }
      return this.handleNewContent(chunk, message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
  }

  /** 7. 处理非 data: 格式的标准响应 */
  private static handleNonDataResponse(params: {
    rawMessage: string
    message: AiChatMessageRequest
    url: string
    accumulatedContent: string
    messageId: string
    onComplete?: (response: any) => void
    onStream?: (chunk: string, isComplete: boolean) => void
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
  }): any {
    const { rawMessage, message, url, accumulatedContent, messageId, onComplete, onStream, onHistoryUpdate } = params
    const rawChunk = String(rawMessage)
    const effectiveChunk = this.extractMessageFromConcatenatedJson(rawChunk) ?? rawChunk

    if (/^[\r\n]+$/.test(effectiveChunk)) {
      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    if (!effectiveChunk.includes('data:') && /\s*end\s*$/i.test(effectiveChunk)) {
      const chunk = this.stripTrailingEnd(effectiveChunk)
      const newAccumulated = this.mergeContent(accumulatedContent, chunk)
      return this.handlePollingEnd(messageId, newAccumulated, '', message.sessionId || '', onComplete, onStream)
    }

    if (effectiveChunk.trim() !== '') {
      const chunk = this.stripTrailingEnd(effectiveChunk)
      if (!chunk) {
        return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
      }
      return this.handleNewContent(chunk, message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate, true)
    }

    return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
  }

  /** 8. 核心 SSE 文本数据帧解析器 */
  private static parseSseText(raw: string): {
    hasData: boolean
    ended: boolean
    textChunk: string
    latestHistory?: BackendHistoryMessage[]
    agentStatus?: string
  } {
    const input = String(raw || '')
    const normalized = input.replace(/\r\n/g, '\n')
    const lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    const dataParts = normalized.includes('data:')
      ? normalized.split('data:').map(s => s.trim()).filter(s => s.length > 0)
      : []

    let hasData = false
    let ended = false
    let textChunk = ''
    let latestHistory: BackendHistoryMessage[] | undefined
    let agentStatus: string | undefined

    if (lines.length === 1 && lines[0] === 'end') {
      return { hasData: false, ended: true, textChunk: '' }
    }

    const handlePayloadString = (payloadStr: string) => {
      const trimmed = payloadStr.trim()
      if (!trimmed) return

      const withoutTrailingEnd = trimmed.endsWith('end') ? trimmed.slice(0, -'end'.length).trim() : trimmed
      if (trimmed !== withoutTrailingEnd) {
        ended = true
      }

      if (!withoutTrailingEnd || withoutTrailingEnd === 'end') return

      try {
        const payload = JSON.parse(withoutTrailingEnd) as SSEPayload
        if (typeof payload.agent_status === 'string' && payload.agent_status.length > 0) {
          agentStatus = payload.agent_status
        }
        if (typeof payload.content === 'string' && payload.content.length > 0) {
          textChunk += payload.content
        }
        if (Array.isArray(payload.history_messages) && payload.history_messages.length > 0) {
          latestHistory = payload.history_messages as BackendHistoryMessage[]
        }
      } catch (e) {}
    }

    if (dataParts.length > 0) {
      hasData = true
      for (const part of dataParts) {
        if (part === 'end') {
          ended = true
          continue
        }
        handlePayloadString(part)
      }
    } else {
      for (const line of lines) {
        if (line === 'end') {
          ended = true
          continue
        }
        if (!line.startsWith('data:')) continue
        hasData = true
        const jsonStr = line.slice('data:'.length).trim()
        if (!jsonStr || jsonStr === 'end') {
          if (jsonStr === 'end') ended = true
          continue
        }
        handlePayloadString(jsonStr)
      }
    }

    return { hasData, ended, textChunk, latestHistory, agentStatus }
  }

  /** 9. 去除尾部 end 标记 */
  private static stripTrailingEnd(text: string): string {
    const input = String(text ?? '')
    const trimmed = input.trim()
    if (/^end$/i.test(trimmed)) return ''
    return input.replace(/end\s*$/i, '')
  }

  /** 10. 提取连续拼接的 JSON 对象文本（例如 {...}{...}） */
  private static extractMessageFromConcatenatedJson(text: string): string | null {
    const input = String(text || '').trim()
    if (!input || !input.startsWith('{') || !input.includes('"message"')) return null

    const objects: any[] = []
    let depth = 0
    let start = -1
    let inString = false
    let escaping = false

    for (let i = 0; i < input.length; i++) {
      const ch = input[i]
      if (inString) {
        if (escaping) { escaping = false; continue }
        if (ch === '\\') { escaping = true; continue }
        if (ch === '"') inString = false
        continue
      }
      if (ch === '"') { inString = true; continue }
      if (ch === '{') {
        if (depth === 0) start = i
        depth++
        continue
      }
      if (ch === '}') {
        if (depth > 0) depth--
        if (depth === 0 && start >= 0) {
          const part = input.slice(start, i + 1)
          try { objects.push(JSON.parse(part)) } catch { return null }
          start = -1
        }
      }
    }

    if (objects.length <= 1) return null
    const messages = objects
      .map(o => (o && typeof o.message === 'string' ? o.message : ''))
      .filter(m => m.length > 0)

    return messages.length === 0 ? null : messages.join('\n')
  }

  /** 11. 处理轮询结束回调 */
  private static async handlePollingEnd(
    messageId: string,
    accumulatedContent: string,
    responseSessionId: string,
    messageSessionId: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void
  ) {
    if (onStream) onStream('', true)

    const finalResult = {
      success: true,
      messageId,
      reply: accumulatedContent,
      sessionId: responseSessionId || messageSessionId,
      timestamp: Date.now()
    }

    if (onComplete) {
      await Promise.resolve(onComplete(finalResult)).catch(() => {})
    }

    return finalResult
  }

  /** 12. 合并全量/增量内容包 */
  private static mergeContent(accumulated: string, newChunk: string): string {
    if (!newChunk) return accumulated
    if (!accumulated) return newChunk

    const matchIndex = newChunk.indexOf(accumulated)
    if (matchIndex !== -1 && accumulated.length > 5) {
      const realNewPart = newChunk.slice(matchIndex + accumulated.length)
      return accumulated + realNewPart
    }

    return accumulated + newChunk
  }

  /** 13. 处理新接收内容 */
  private static async handleNewContent(
    chunk: string,
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
    forceAppendNewline: boolean = false
  ) {
    const outgoingChunk = forceAppendNewline && chunk && !chunk.endsWith('\n') ? `${chunk}\n` : chunk
    const oldLength = accumulatedContent.length
    const newAccumulatedContent = this.mergeContent(accumulatedContent, outgoingChunk)

    if (onStream) {
      try {
        const addedContent = newAccumulatedContent.slice(oldLength)
        if (addedContent) {
          onStream(addedContent, false)
        }
      } catch (e) {}
    }

    const continueMessage = { ...message, reason: 'continue' }
    return await this.pollChatMessage(
      continueMessage,
      url,
      onComplete,
      onStream,
      newAccumulatedContent,
      messageId,
      onHistoryUpdate
    )
  }

  /** 14. 处理空帧并发起继续轮询 */
  private static async handleEmptyContent(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void
  ) {
    return this.pollChatMessage(
      { ...message, reason: 'continue' },
      url,
      onComplete,
      onStream,
      accumulatedContent,
      messageId,
      onHistoryUpdate
    )
  }

  /** 15. 捕获轮询异常 */
  private static handleChatError(
    error: any,
    messageId: string,
    accumulatedContent: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void
  ) {
    const errorMessage = accumulatedContent || '网络错误: ' + (error instanceof Error ? error.message : String(error))
    return this.createErrorResult(messageId, errorMessage, onComplete, onStream)
  }

  /** 16. 构建错误结果结构 */
  private static createErrorResult(
    messageId: string,
    errorMessage: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void
  ) {
    const errorResult = {
      success: false,
      messageId,
      reply: errorMessage,
      timestamp: Date.now()
    }

    if (onStream) onStream('', true)

    if (onComplete) {
      Promise.resolve(onComplete(errorResult)).catch(() => {})
    }

    return errorResult
  }

  /** 17. 管理会话对话记忆 (对齐 /history_manage 接口) */
  static async manageConversationMemory(payload: ManageConversationMemoryRequest): Promise<any> {
    return await request({
      url: '/history_manage',
      method: 'POST',
      data: payload
    })
  }

  /** 18. 查询短期记忆 (对齐 /get_shor_term_memory 接口) */
  static async getShortTermMemory(threadId: string, agentName: string = 'chatbot'): Promise<any> {
    return await request({
      url: `/get_shor_term_memory?thread_id=${encodeURIComponent(threadId)}&agent_name=${encodeURIComponent(agentName)}`,
      method: 'GET'
    })
  }
}
