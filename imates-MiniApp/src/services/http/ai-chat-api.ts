import { httpClient } from './http-client'
import { generateUniqueId } from '@/stores/utils/chatStoreUtils'
import { AndroidBridge } from '../business/android-bridge'
import type {
  AiChatMessageRequest,
  BackendHistoryMessage,
  ManageConversationMemoryRequest,
  SSEPayload,
} from '@/types'
import { getApiPaths } from '@/config/env-config'

export class AiChatApi {
  private readonly androidBridge: AndroidBridge
  private readonly pollIntervalMs = 500

  constructor() {
    this.androidBridge = AndroidBridge.getInstance()
  }

  public async sendChatRequest(url: string, requestBody: any) {
    const timeout = requestBody.reason === 'continue' ? 60000 : 60000

    return await httpClient.post<{
      success: boolean
      message: string
      sessionId: string
    }>(url, requestBody, {
      retries: 0,
      timeout: timeout,
    })
  }

  public async sendChatMessage(
    message: AiChatMessageRequest,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    try {
      const url = message.dstUrl!
      const result = await this.pollChatMessage(
        message,
        url,
        onComplete,
        onStream,
        '',
        generateUniqueId('ai'),
        onHistoryUpdate,
      )
      return result
    } catch (error) {
      const errorResult = {
        success: false,
        messageId: '',
        reply: '发送消息失败: ' + (error as Error).message,
        timestamp: Date.now(),
      }

      if (onComplete) {
        console.log('[AiChatApi] sendChatMessage: triggering error onComplete', { 
          messageId: '', 
          error: errorResult.reply 
        })
        await Promise.resolve(onComplete(errorResult))
      }

      return errorResult
    }
  }

  private async pollChatMessage(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    try {
      if (message.reason === 'continue') {
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs))
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
        onHistoryUpdate,
      )
    } catch (error) {
      console.error('[AiChatApi] 轮询异常:', {
        messageId,
        url,
        reason: message.reason,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      return this.handleChatError(error, messageId, accumulatedContent, onComplete, onStream)
    }
  }

  private async handleChatResponse(
    response: any,
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    if (!response || !response.success || !response.data) {
      console.warn('[AiChatApi] 响应失败:', {
        messageId,
        success: response?.success,
        hasData: !!response?.data,
        accumulatedContentLength: accumulatedContent.length,
      })
      return this.createErrorResult(messageId, accumulatedContent || '请求失败，请重试。', onComplete, onStream)
    }

    const rawMessage = response.data && response.data.message != null ? response.data.message : response.message ?? ''
    const raw = String(rawMessage)
    // trimmedChunk 仅用于控制判断（如 end/成功），正文应尽量保留原始换行/空格
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
      url,
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
      onHistoryUpdate,
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
      onHistoryUpdate,
    })
  }

  private handleNonSseResponse(params: {
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
      url,
    } = params

    // 兼容：部分后端在轮询模式下会先返回一个无意义的 "成功" 占位帧。
    if (trimmedChunk === '成功' && !raw.includes('data:')) {
      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    // 非流式（单帧）结束：教材截图接口
    if (message.dstUrl === getApiPaths().xueban.ai.previewPictureQA && !raw.includes('data:')) {
      // 尝试提取拼接的 JSON 消息（例如：{...}{...}）
      const normalizedChunk = this.extractMessageFromConcatenatedJson(raw) ?? raw

      // 特殊处理：如果原始消息就是 "end"，直接结束轮询
      if (normalizedChunk.trim() === 'end') {
        return this.handlePollingEnd(messageId, accumulatedContent, response.data.sessionId, message.sessionId, onComplete, onStream)
      }

      const chunk = this.stripTrailingEnd(normalizedChunk)

      // 如果有新内容,累积并继续轮询
      if (chunk && chunk.trim()) {
        return this.handleNewContent(chunk, message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate, true)
      }

      // 兼容：previewPictureQA 可能会返回空帧（message 为空）。
      // 空帧不代表结束，应继续轮询等待后续内容或 end。
      return this.handleEmptyContent(
        message,
        url,
        onComplete,
        onStream,
        accumulatedContent,
        messageId,
        onHistoryUpdate,
      )
    }

    if (trimmedChunk === 'end') {
      return this.handlePollingEnd(messageId, accumulatedContent, response.data.sessionId, message.sessionId, onComplete, onStream)
    }

    return null
  }

  private handleSseResponse(params: {
    parsed: ReturnType<AiChatApi['parseSseText']>
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
        console.log('[AiChatApi] SSE onHistoryUpdate', { messageId, historyCount: parsed.latestHistory.length, agentStatus: parsed.agentStatus })
        onHistoryUpdate(parsed.latestHistory, parsed.agentStatus)
      } catch (e) {
        console.warn('[AiChatApi] SSE onHistoryUpdate 回调失败:', { error: e })
      }
    }

    if (
      parsed.agentStatus === 'drawing' &&
      !parsed.textChunk &&
      (!parsed.latestHistory || parsed.latestHistory.length === 0)
    ) {
      if (onStream) {
        try {
          onStream('', false)
        } catch (e) {
          console.warn('[AiChatApi] drawing 控制帧 onStream 回调失败:', { error: e })
        }
      }

      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    if (parsed.ended) {
      const newAccumulated = this.mergeContent(accumulatedContent, parsed.textChunk || '')
      return this.handlePollingEnd(messageId, newAccumulated, response.data.sessionId, message.sessionId, onComplete, onStream)
    }

    if (parsed.textChunk && parsed.textChunk !== '') {
      const chunk = this.stripTrailingEnd(parsed.textChunk)
      // 过滤单独的 "end" 文本，避免渲染到气泡
      if (chunk.trim().toLowerCase() === 'end') {
        return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
      }
      return this.handleNewContent(chunk, message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
  }

  private handleNonDataResponse(params: {
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

    // 兼容：部分后端会在同一帧文本末尾直接拼接 end（非 SSE）
    // 这种情况下应直接结束轮询，而不是继续发送 continue。
    if (!effectiveChunk.includes('data:') && /\s*end\s*$/i.test(effectiveChunk)) {
      const chunk = this.stripTrailingEnd(effectiveChunk)
      const newAccumulated = this.mergeContent(accumulatedContent, chunk)
      return this.handlePollingEnd(
        messageId,
        newAccumulated,
        '',
        message.sessionId,
        onComplete,
        onStream,
      )
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

  private parseSseText(raw: string): {
    hasData: boolean
    ended: boolean
    textChunk: string
    latestHistory?: BackendHistoryMessage[]
    agentStatus?: string
  } {
    const input = String(raw || '')
    const normalized = input.replace(/\r\n/g, '\n')
    const lines = normalized
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const dataParts = normalized.includes('data:')
      ? normalized
          .split('data:')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
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

      if (!withoutTrailingEnd) return

      if (withoutTrailingEnd === 'end') {
        ended = true
        return
      }

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
      } catch (e) {
        console.warn('[AiChatApi] SSE payload 解析失败:', { payloadStr: withoutTrailingEnd, error: e })
      }
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

        if (!line.startsWith('data:')) {
          continue
        }

        hasData = true
        const jsonStr = line.slice('data:'.length).trim()
        if (!jsonStr) continue

        if (jsonStr === 'end') {
          ended = true
          continue
        }

        handlePayloadString(jsonStr)
      }
    }

    return {
      hasData,
      ended,
      textChunk,
      latestHistory,
      agentStatus,
    }
  }

  /**
   * 去掉尾部的 end 标记（后端可能在文本末尾附带 end）
   */
  private stripTrailingEnd(text: string): string {
    const input = String(text ?? '')
    const trimmed = input.trim()
    // 整帧只有 end（可能前后带空白）
    if (/^end$/i.test(trimmed)) return ''
    // 仅移除“末尾的 end 标记 + 其后的空白”，其它内容（含换行）保留
    return input.replace(/end\s*$/i, '')
  }

  /**
   * 兼容：部分后端会把多个 JSON 对象直接拼接返回（例如：{...}{...}）
   * 这种情况下我们需要按大括号配对切分并提取每个对象的 message 字段。
   *
   * 返回 null 表示“不像拼接 JSON”或无法解析，让上层走原逻辑。
   */
  private extractMessageFromConcatenatedJson(text: string): string | null {
    const input = String(text || '').trim()
    if (!input) return null
    if (!input.startsWith('{')) return null
    if (!input.includes('"message"')) return null

    const objects: any[] = []
    let depth = 0
    let start = -1
    let inString = false
    let escaping = false

    for (let i = 0; i < input.length; i++) {
      const ch = input[i]

      if (inString) {
        if (escaping) {
          escaping = false
          continue
        }
        if (ch === '\\') {
          escaping = true
          continue
        }
        if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === '{') {
        if (depth === 0) start = i
        depth++
        continue
      }

      if (ch === '}') {
        if (depth > 0) depth--
        if (depth === 0 && start >= 0) {
          const part = input.slice(start, i + 1)
          try {
            objects.push(JSON.parse(part))
          } catch {
            return null
          }
          start = -1
        }
      }
    }

    if (objects.length <= 1) {
      return null
    }

    const messages = objects
      .map((o) => (o && typeof o.message === 'string' ? o.message : ''))
      .map((m) => String(m))
      .filter((m) => m.length > 0)

    if (messages.length === 0) return null
    return messages.join('\n')
  }

  private async handlePollingEnd(
    messageId: string,
    accumulatedContent: string,
    responseSessionId: string,
    messageSessionId: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
  ) {
    if (onStream) {
      onStream('', true)
    }

    const finalResult = {
      success: true,
      messageId,
      reply: accumulatedContent,
      sessionId: responseSessionId || messageSessionId,
      timestamp: Date.now(),
    }

    if (onComplete) {
      console.log('[AiChatApi] handlePollingEnd: triggering onComplete', { 
        messageId, 
        replyLength: accumulatedContent.length,
        reply: accumulatedContent
      })
      await Promise.resolve(onComplete(finalResult))
    }

    return finalResult
  }

  /**
   * 合并新旧内容，处理后端可能返回全量文本或增量文本的情况
   */
  private mergeContent(accumulated: string, newChunk: string): string {
    if (!newChunk) return accumulated
    if (!accumulated) return newChunk

    // 优化逻辑：通过寻找特征对齐来处理后端的全量包 Bug
    // 如果新帧中包含了已有的全部内容，我们找到它并截取其后的真正新增部分
    const matchIndex = newChunk.indexOf(accumulated)

    if (matchIndex !== -1 && accumulated.length > 5) {
      const realNewPart = newChunk.slice(matchIndex + accumulated.length)
      
      console.log('[AiChatApi111] 检测到快照对齐，提取新增部分:', {
        matchIndex,
        oldLength: accumulated.length,
        realNewPartLength: realNewPart.length,
        realNewPartPreview: realNewPart.slice(0, 20)
      })
      
      return accumulated + realNewPart
    }

    console.log('[AiChatApi111] 增量叠加成功', {
      newChunkLength: newChunk.length,
      newChunkPreview: newChunk.slice(0, 20)
    })

    return accumulated + newChunk
  }

  private async handleNewContent(
    chunk: string,
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
    forceAppendNewline: boolean = false,
  ) {
    const outgoingChunk = forceAppendNewline && chunk && !chunk.endsWith('\n') ? `${chunk}\n` : chunk
    
    const oldLength = accumulatedContent.length
    const newAccumulatedContent = this.mergeContent(accumulatedContent, outgoingChunk)
    
    if (onStream) {
      try {
        // 仅向流式回调发送真正新增的部分
        const addedContent = newAccumulatedContent.slice(oldLength)
        if (addedContent) {
          onStream(addedContent, false)
          console.log('[AiChatApi] onStream', { messageId, chunk: addedContent })
        }
      } catch (e) {
        console.error('[AiChatApi] onStream error', { messageId, error: e })
      }
    }

    const continueMessage = { ...message, reason: 'continue' }

    return await this.pollChatMessage(
      continueMessage,
      url,
      onComplete,
      onStream,
      newAccumulatedContent,
      messageId,
      onHistoryUpdate,
    )
  }

  private async handleEmptyContent(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ) {
    return this.pollChatMessage(
      { ...message, reason: 'continue' },
      url,
      onComplete,
      onStream,
      accumulatedContent,
      messageId,
      onHistoryUpdate,
    )
  }

  private handleChatError(
    error: any,
    messageId: string,
    accumulatedContent: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
  ) {
    console.error('[AiChatApi] 处理聊天错误:', {
      messageId,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      accumulatedContentLength: accumulatedContent.length,
    })

    const errorMessage = accumulatedContent || '网络错误: ' + (error as Error).message
    return this.createErrorResult(messageId, errorMessage, onComplete, onStream)
  }

  private createErrorResult(
    messageId: string,
    errorMessage: string,
    onComplete?: (response: any) => void | Promise<void>,
    onStream?: (chunk: string, isComplete: boolean) => void,
  ) {
    const errorResult = {
      success: false,
      messageId,
      reply: errorMessage,
      timestamp: Date.now(),
    }

    if (onStream) {
      onStream('', true)
    }

    if (onComplete) {
      console.log('[AiChatApi] createErrorResult: triggering onComplete', { 
        messageId, 
        error: errorMessage 
      })
      // 注意：此处不 await，保持 createErrorResult 为同步方法；竞态主要发生在成功结束 handlePollingEnd。
      Promise.resolve(onComplete(errorResult)).catch(() => {
        // ignore
      })
    }

    return errorResult
  }


  public async manageConversationMemory(payload: ManageConversationMemoryRequest): Promise<any> {
    const response = await httpClient.post<any>('/history_manage', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })
    return response
  }

}
