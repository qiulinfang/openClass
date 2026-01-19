/**
 * 通用WebSocket服务
 * 支持多种聊天类型的WebSocket连接管理
 */

import { ref, readonly } from 'vue'
import { getUserId } from '../http/auth-service'
import { getYanbanBaseUrl } from '@/config/env-config'

export interface WebSocketMessage {
  type: string
  content?: string
  sessionId?: string
  messageId?: string
  timestamp?: string
  from?: string
  to?: string
  msgType?: string
  data?: unknown
  [key: string]: unknown
}

export type WebSocketEventType =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'message'
  | 'new_question'     // 新问题通知（适配研伴后端）
  | 'teacher_response' // 教师回复（预留，后端暂不支持）
  | 'session_update'   // 会话更新（预留，后端暂不支持）
  | 'system'
  | 'user_join'
  | 'user_leave'
  | 'agent_join'
  | 'read_status'
  | 'message_ack'      // 消息发送确认
  | 'message_error'    // 消息发送错误

export interface WebSocketConfig {
  url: string
  reconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
}

export class WebSocketService {
  private socket: WebSocket | null = null
  private listeners: Record<WebSocketEventType, ((message?: WebSocketMessage) => void)[]> = {} as Record<WebSocketEventType, ((message?: WebSocketMessage) => void)[]>
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private config: WebSocketConfig
  private sessionId: string | null = null
  private userId: string | null = null

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectAttempts: 5,
      reconnectDelay: 3000,
      heartbeatInterval: 30000,
      ...config
    }
    this.maxReconnectAttempts = this.config.reconnectAttempts!
    this.reconnectDelay = this.config.reconnectDelay!
    this.userId = getUserId()
  }

  /**
   * 连接到WebSocket服务器
   */
  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] 已经连接')
        resolve(true)
        return
      }

      try {
        console.log('[WebSocket] 正在连接到:', this.config.url)
        this.socket = new WebSocket(this.config.url)

        this.socket.onopen = () => {
          console.log('[WebSocket] 连接成功')
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.emit('connected')
          resolve(true)
        }

        this.socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            console.log('[WebSocket] 收到消息:', message)
            this.handleMessage(message)
          } catch (error) {
            console.error('[WebSocket] 消息解析失败:', error, event.data)
          }
        }

        this.socket.onclose = (event) => {
          console.log('[WebSocket] 连接断开:', event.code, event.reason)
          this.stopHeartbeat()
          this.emit('disconnected')
          if (!event.wasClean) {
            this.attemptReconnect()
          }
          resolve(false)
        }

        this.socket.onerror = (error) => {
          console.error('[WebSocket] 连接错误:', error)
          this.emit('error')
          resolve(false)
        }

      } catch (error) {
        console.error('[WebSocket] 创建连接失败:', error)
        resolve(false)
      }
    })
  }

  /**
   * 发送消息
   */
  sendMessage(message: WebSocketMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] 未连接，无法发送消息')
      return
    }

    try {
      const messageToSend = {
        ...message,
        timestamp: new Date().toISOString(),
        from: message.from || this.userId || 'unknown',
        sessionId: message.sessionId || this.sessionId,
      }

      this.socket.send(JSON.stringify(messageToSend))
      console.log('[WebSocket] 发送消息:', messageToSend)
    } catch (error) {
      console.error('[WebSocket] 发送消息失败:', error)
    }
  }

  /**
   * 发送教师消息
   */
  sendTeacherMessage(sessionId: string, content: string, msgType: string = '0'): void {
    const message: WebSocketMessage = {
      type: 'CHAT',
      sessionId,
      content,
      msgType,
    }
    this.sendMessage(message)
  }

  /**
   * 发送客服消息
   */
  sendClientMessage(content: string, msgType: string = 'text'): void {
    const message: WebSocketMessage = {
      type: 'CHAT',
      content,
      msgType,
      from: this.userId || 'unknown',
      to: 'Agent_007', // 客服ID
    }
    this.sendMessage(message)
  }

  /**
   * 设置当前会话ID
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId
    console.log('[WebSocket] 设置会话ID:', sessionId)

    // 如果是教师类型且已经连接，需要重新连接以更新URL参数
    if (this.config.url?.includes('/ws?') && this.socket?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] 检测到会话ID变更，需要重新连接以更新URL参数')
      this.reconnectWithNewSessionId(sessionId)
    }
  }

  /**
   * 使用新的sessionId重新连接
   */
  private reconnectWithNewSessionId(sessionId: string): void {
    if (!this.config.url) return

    // 更新URL中的sessionId参数
    const url = new URL(this.config.url.replace('wss://', 'https://'))
    url.searchParams.set('sessionId', sessionId)
    this.config.url = url.toString().replace('https://', 'wss://')

    console.log('[WebSocket] 更新连接URL为:', this.config.url)

    // 断开现有连接并重新连接
    if (this.socket) {
      this.socket.close(1000, 'Reconnecting with new sessionId')
    }

    // 重新连接
    this.connect()
  }

  /**
   * 添加事件监听器
   */
  on(event: WebSocketEventType, callback: (message?: WebSocketMessage) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  /**
   * 移除事件监听器
   */
  off(event: WebSocketEventType, callback?: (message?: WebSocketMessage) => void): void {
    if (!this.listeners[event]) return

    if (callback) {
      const index = this.listeners[event].indexOf(callback)
      if (index > -1) {
        this.listeners[event].splice(index, 1)
      }
    } else {
      delete this.listeners[event]
    }
  }

  /**
   * 触发事件
   */
  private emit(event: WebSocketEventType, message?: WebSocketMessage): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(message)
        } catch (error) {
          console.error('[WebSocket] 事件回调执行失败:', error)
        }
      })
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WebSocketMessage): void {
    // 根据消息类型触发相应事件（适配研伴后端）
    switch (message.type) {
      case 'TYPE_NEW_QUESTION':
        // 研伴后端新问题通知
        this.emit('new_question', message)
        break
      case 'TEACHER_RESPONSE':
        // 教师回复（研伴后端暂不支持）
        this.emit('teacher_response', message)
        break
      case 'SESSION_UPDATE':
        // 会话更新（研伴后端暂不支持）
        this.emit('session_update', message)
        break
      case 'SYSTEM':
        this.emit('system', message)
        break
      case 'AGENT_JOIN':
        this.emit('agent_join', message)
        break
      case 'READ_STATUS':
        this.emit('read_status', message)
        break
      case 'USER_JOIN':
        this.emit('user_join', message)
        break
      case 'USER_LEAVE':
        this.emit('user_leave', message)
        break
      case 'ACK':
        // 消息发送确认
        this.emit('message_ack', message)
        break
      case 'ERROR':
        // 消息发送错误
        this.emit('message_error', message)
        break
      default:
        this.emit('message', message)
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval) {
      this.heartbeatTimer = window.setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.sendMessage({ type: 'PING' })
        }
      }, this.config.heartbeatInterval)
    }
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] 达到最大重连次数，停止重连')
      return
    }

    this.reconnectAttempts++
    console.log(`[WebSocket] ${this.reconnectDelay}ms后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect()
    }, this.reconnectDelay)
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.listeners = {} as Record<WebSocketEventType, ((message?: WebSocketMessage) => void)[]>
    console.log('[WebSocket] 已断开连接')
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  /**
   * 获取详细连接状态信息
   */
  getConnectionStatus(): {
    isConnected: boolean
    readyState: number
    readyStateText: string
    url: string
    userId: string | null
    sessionId: string | null
  } {
    const readyState = this.socket?.readyState ?? WebSocket.CLOSED
    let readyStateText = ''
    switch (readyState) {
      case WebSocket.CONNECTING:
        readyStateText = '连接中'
        break
      case WebSocket.OPEN:
        readyStateText = '已连接'
        break
      case WebSocket.CLOSING:
        readyStateText = '关闭中'
        break
      case WebSocket.CLOSED:
        readyStateText = '已关闭'
        break
    }

    return {
      isConnected: this.isConnected(),
      readyState,
      readyStateText,
      url: this.config.url,
      userId: this.userId,
      sessionId: this.sessionId
    }
  }

  /**
   * 在控制台打印详细连接状态
   */
  logConnectionStatus(): void {
    const status = this.getConnectionStatus()
    console.log('[WebSocket] 连接状态详情:', {
      '连接状态': status.readyStateText,
      'WebSocket URL': status.url,
      '用户ID': status.userId,
      '会话ID': status.sessionId,
      '技术状态': `readyState=${status.readyState}`
    })
  }

  /**
   * 获取当前会话ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionId
  }

}

// 服务实例管理
const webSocketInstances = new Map<string, WebSocketService>()

/**
 * 获取WebSocket服务实例
 */
export function getWebSocketService(type: 'teacher' | 'client' | string): WebSocketService {
  if (webSocketInstances.has(type)) {
    return webSocketInstances.get(type)!
  }

  let config: WebSocketConfig

  if (type === 'teacher') {
    // 教师聊天WebSocket配置（适配研伴后端）
    // 研伴后端WebSocket端点为 /ws，支持双向消息传输
    // 初始连接时使用临时sessionId，实际使用时通过setSessionId()设置
    const yanbanBaseUrl = getYanbanBaseUrl()
    const userId = getUserId()
    // 动态生成临时sessionId，避免硬编码
    const tempSessionId = `temp-teacher-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const wsUrl = yanbanBaseUrl.replace('https://', 'wss://') + `/ws?userId=${userId}&sessionId=${tempSessionId}&clientType=web`
    config = {
      url: wsUrl,
      reconnectAttempts: 5,
      reconnectDelay: 3000,
      heartbeatInterval: 30000
    }
  } else if (type === 'client') {
    // 客服聊天WebSocket配置
    // 注意：客户端WebSocket需要通过userClientStore来管理，因为包含复杂的认证逻辑
    throw new Error('客户端WebSocket请直接使用useUserClientStore()，不支持通过通用服务访问')
  } else {
    // 自定义配置
    const yanbanBaseUrl = getYanbanBaseUrl()
    const wsUrl = yanbanBaseUrl.replace('https://', 'wss://') + `/${type}/ws`
    config = {
      url: wsUrl,
      reconnectAttempts: 5,
      reconnectDelay: 3000,
      heartbeatInterval: 30000
    }
  }

  const service = new WebSocketService(config)
  webSocketInstances.set(type, service)
  return service
}

/**
 * 销毁WebSocket服务实例
 */
export function destroyWebSocketService(type: string): void {
  const service = webSocketInstances.get(type)
  if (service) {
    service.disconnect()
    webSocketInstances.delete(type)
  }
}

/**
 * 销毁所有WebSocket服务实例
 */
export function destroyAllWebSocketServices(): void {
  webSocketInstances.forEach((service) => {
    service.disconnect()
  })
  webSocketInstances.clear()
}

/**
 * 检查WebSocket连接状态的全局函数
 * 在浏览器控制台中调用: checkWebSocketStatus()
 */
export function checkWebSocketStatus(): void {
  console.log('=== WebSocket 连接状态检查 ===')

  // 检查教师聊天WebSocket
  const teacherWs = webSocketInstances.get('teacher')
  if (teacherWs) {
    console.log('📚 教师聊天WebSocket:')
    teacherWs.logConnectionStatus()
  } else {
    console.log('📚 教师聊天WebSocket: 未初始化')
  }

  // 检查客服聊天WebSocket
  const clientWs = webSocketInstances.get('client')
  if (clientWs) {
    console.log('💬 客服聊天WebSocket:')
    clientWs.logConnectionStatus()
  } else {
    console.log('💬 客服聊天WebSocket: 未初始化')
  }

  // 检查其他WebSocket实例
  if (webSocketInstances.size > 0) {
    console.log('📋 所有WebSocket实例:')
    webSocketInstances.forEach((ws, type) => {
      console.log(`  ${type}:`, ws.getConnectionStatus().readyStateText)
    })
  }

  console.log('===============================')
}

// 将全局函数挂载到window对象，方便在控制台调用
if (typeof window !== 'undefined') {
  ;(window as { checkWebSocketStatus?: typeof checkWebSocketStatus }).checkWebSocketStatus = checkWebSocketStatus
}

/**
 * 创建WebSocket连接状态监控组件
 * 可以嵌入到Vue组件中使用
 */
export function useWebSocketStatusMonitor() {
  const status = ref<{
    teacher: { isConnected: boolean; readyStateText: string; url: string } | null
    client: { isConnected: boolean; readyStateText: string; url: string } | null
  }>({
    teacher: null,
    client: null
  })

  const updateStatus = () => {
    const teacherWs = webSocketInstances.get('teacher')
    const clientWs = webSocketInstances.get('client')

    status.value = {
      teacher: teacherWs ? {
        isConnected: teacherWs.isConnected(),
        readyStateText: teacherWs.getConnectionStatus().readyStateText,
        url: teacherWs.getConnectionStatus().url
      } : null,
      client: clientWs ? {
        isConnected: clientWs.isConnected(),
        readyStateText: clientWs.getConnectionStatus().readyStateText,
        url: clientWs.getConnectionStatus().url
      } : null
    }
  }

  // 定期更新状态
  const startMonitoring = () => {
    updateStatus()
    const interval = setInterval(updateStatus, 2000) // 每2秒更新一次
    return () => clearInterval(interval) // 返回停止函数
  }

  return {
    status: readonly(status),
    updateStatus,
    startMonitoring
  }
}
