import { httpClient } from '../http/http-client'
import { generateUniqueId } from '@/stores/utils/chatStoreUtils'
import { AndroidBridge } from '../business/android-bridge'
import type {
  AiChatMessageRequest,
  BackendHistoryMessage,
  ManageConversationMemoryRequest,
  SSEPayload,
} from '@/types'
import { getCurrentEnvConfig } from '@/config/env-config'

export class AiChatApi {
  private readonly androidBridge: AndroidBridge

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
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    try {
      const url = message.dstUrl!

      return await this.pollChatMessage(message, url, onComplete, onStream, '', generateUniqueId('ai'), onHistoryUpdate)
    } catch (error) {
      const errorResult = {
        success: false,
        messageId: '',
        reply: '发送消息失败: ' + (error as Error).message,
        timestamp: Date.now(),
      }

      if (onComplete) {
        onComplete(errorResult)
      }

      return errorResult
    }
  }

  private async pollChatMessage(
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ): Promise<any> {
    try {
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
    onComplete?: (response: any) => void,
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

    const rawMessage =
      response.data && response.data.message != null ? response.data.message : response.message ?? ''
    const trimmedChunk = String(rawMessage).trim()
    const raw = String(rawMessage)

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
    onComplete?: (response: any) => void
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
    if (message.dstUrl === getCurrentEnvConfig().apiPaths.previewPictureQA && !raw.includes('data:') && accumulatedContent.length > 0) {
      return this.handlePollingEnd(messageId, accumulatedContent, response.data.sessionId, message.sessionId, onComplete, onStream)
    }

    // 非流式（单帧）结束：普通 chat / chatMath 接口返回完整文本但未包含 SSE 标记
    if (
      (message.dstUrl === getCurrentEnvConfig().apiPaths.chat || message.dstUrl === getCurrentEnvConfig().apiPaths.chatMath) &&
      !raw.includes('data:') &&
      trimmedChunk
    ) {
      const chunk = this.stripTrailingEnd(trimmedChunk)
      const newAccumulated = accumulatedContent + chunk
      return this.handlePollingEnd(messageId, newAccumulated, response.data.sessionId, message.sessionId, onComplete, onStream)
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
        onHistoryUpdate(parsed.latestHistory, parsed.agentStatus)
      } catch (e) {
        console.warn('[AiChatApi] SSE onHistoryUpdate 回调失败:', { error: e })
      }
    }

    if (parsed.agentStatus === 'drawing' && !parsed.textChunk && (!parsed.latestHistory || parsed.latestHistory.length === 0)) {
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
      const newAccumulated = accumulatedContent + (parsed.textChunk || '')
      return this.handlePollingEnd(messageId, newAccumulated, response.data.sessionId, message.sessionId, onComplete, onStream)
    }

    if (parsed.textChunk && parsed.textChunk.trim() !== '') {
      const chunkRaw = parsed.textChunk.trim()
      const chunk = this.stripTrailingEnd(chunkRaw)
      // 过滤单独的 "end" 文本，避免渲染到气泡
      if (chunk.toLowerCase() === 'end') {
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
    const effectiveChunk = String(rawMessage)

    if (/^[\r\n]+$/.test(effectiveChunk)) {
      return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
    }

    if (effectiveChunk.trim() !== '') {
      const chunk = this.stripTrailingEnd(effectiveChunk)
      if (!chunk) {
        return this.handleEmptyContent(message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
      }
      return this.handleNewContent(chunk, message, url, onComplete, onStream, accumulatedContent, messageId, onHistoryUpdate)
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
    const normalized = text.trim()
    if (/^end$/i.test(normalized)) return ''
    // 匹配末尾的 end（前面允许中文/英文内容），仅截掉末尾标记
    return normalized.replace(/\s*end$/i, '').trim()
  }

  private handlePollingEnd(
    messageId: string,
    accumulatedContent: string,
    responseSessionId: string,
    messageSessionId: string,
    onComplete?: (response: any) => void,
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
      onComplete(finalResult)
    }

    return finalResult
  }

  private async handleNewContent(
    chunk: string,
    message: AiChatMessageRequest,
    url: string,
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ) {
    const newAccumulatedContent = accumulatedContent + chunk
    if (onStream) {
      try {
        onStream(chunk, false)
        console.log('[AiChatApi] onStream', { messageId, chunk })
      } catch (e) {
        console.error('[AiChatApi] onStream error', { messageId, error: e })
      }
    }

    const continueMessage = { ...message, reason: 'continue' }

    if (message.dstUrl === '/permission/previewPictureQA') {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

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
    onComplete?: (response: any) => void,
    onStream?: (chunk: string, isComplete: boolean) => void,
    accumulatedContent: string = '',
    messageId: string = generateUniqueId('ai'),
    onHistoryUpdate?: (history: BackendHistoryMessage[], agentStatus?: string) => void,
  ) {
    const continueMessage = { ...message, reason: 'continue' }

    if (message.dstUrl === '/permission/previewPictureQA') {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return await this.pollChatMessage(
      continueMessage,
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
    onComplete?: (response: any) => void,
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
    onComplete?: (response: any) => void,
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
      onComplete(errorResult)
    }

    return errorResult
  }

  public async sendVoiceMessageToTeacher(
    voicePath: string,
    duration: string,
    sessionId: string,
    subject: string,
  ): Promise<boolean> {
    const startTime = performance.now()

    try {
      if (typeof window === 'undefined') {
        console.error('[AiChatApi] ❌ sendVoiceMessageToTeacher: window未定义')
        return false
      }

      if (!window.AndroidBridge) {
        console.error('[AiChatApi] ❌ sendVoiceMessageToTeacher: AndroidBridge未定义')
        return false
      }

      if (!window.AndroidBridge.sendVoiceMessageToTeacher) {
        console.error('[AiChatApi] ❌ sendVoiceMessageToTeacher: 方法不存在')
        return false
      }

      const result = this.androidBridge.sendVoiceMessageToTeacher(voicePath, duration, sessionId, subject)

      const elapsedTime = performance.now() - startTime

      if (!result) {
        console.error('[AiChatApi] ❌ sendVoiceMessageToTeacher: 发送失败')
      }

      return result
    } catch (error) {
      const elapsedTime = performance.now() - startTime
      console.error('[AiChatApi] ❌ sendVoiceMessageToTeacher: 异常 -', error, ', 耗时=' + elapsedTime.toFixed(2) + 'ms')
      return false
    }
  }

  public async forwardAiChatToTeacher(selectedMessagesData: string, teacherSessionId: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.AndroidBridge?.forwardAiChatToTeacher) {
        const result = this.androidBridge.forwardAiChatToTeacher(selectedMessagesData, teacherSessionId)
        console.log('[AiChatApi] 🔍 forwardAiChatToTeacher 原生返回:', result)
        return result
      }

      console.error('[AiChatApi] ❌ AndroidBridge 不可用或 forwardAiChatToTeacher 方法不存在')
      console.error('[AiChatApi] ❌ window 类型:', typeof window)
      console.error('[AiChatApi] ❌ window.AndroidBridge 存在:', typeof window !== 'undefined' && !!window.AndroidBridge)
      console.error(
        '[AiChatApi] ❌ forwardAiChatToTeacher 方法存在:',
        typeof window !== 'undefined' && !!window.AndroidBridge?.forwardAiChatToTeacher,
      )
      return false
    } catch (error) {
      console.error('[AiChatApi] ❌ forwardAiChatToTeacher 异常:', error)
      console.error('[AiChatApi] ❌ 错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息')
      return false
    }
  }

  public async getTeacherChatHistory(sessionId: string): Promise<any[]> {
    try {
      if (typeof window !== 'undefined' && window.AndroidBridge?.getTeacherChatHistory) {
        const result = this.androidBridge.getTeacherChatHistory(sessionId)
        return result
      }

      return []
    } catch (error) {
      return []
    }
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
