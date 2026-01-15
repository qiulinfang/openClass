/**
 * 教师聊天WebSocket服务
 * 处理教师聊天的实时通信
 */

import { getUserId } from '../http/auth-service'
import { getYanbanBaseUrl } from '@/config/env-config'

export interface TeacherWebSocketMessage {
  type: 'CHAT' | 'SYSTEM' | 'ERROR' | 'TEACHER_RESPONSE' | 'SESSION_UPDATE'
  content?: string
  sessionId?: string
  messageId?: string
  timestamp?: string
  from?: string
  to?: string
  msgType?: string
  data?: unknown
}

export class TeacherWebSocketService {
  private socket: WebSocket | null = null
  private listeners: Record<string, ((message: TeacherWebSocketMessage) => void)[]> = {}
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private reconnectTimer: number | null = null
  private sessionId: string | null = null

  constructor() {
    this.connect()
  }

  /**
   * 连接到WebSocket服务器
   */
  private connect(): void {
    try {
      const yanbanBaseUrl = getYanbanBaseUrl()
      // 将HTTPS URL转换为WebSocket URL
      const wsUrl = yanbanBaseUrl.replace('https://', 'wss://') + '/teacher/ws'

      console.log('[TeacherWebSocket] 连接到:', wsUrl)
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        console.log('[TeacherWebSocket] 连接成功')
        this.reconnectAttempts = 0
        this.onConnected()
      }

      this.socket.onmessage = (event) => {
        try {
          const message: TeacherWebSocketMessage = JSON.parse(event.data)
          console.log('[TeacherWebSocket] 收到消息:', message)
          this.handleMessage(message)
        } catch (error) {
          console.error('[TeacherWebSocket] 消息解析失败:', error, event.data)
        }
      }

      this.socket.onclose = (event) => {
        console.log('[TeacherWebSocket] 连接断开:', event.code, event.reason)
        this.onDisconnected()
        this.attemptReconnect()
      }

      this.socket.onerror = (error) => {
        console.error('[TeacherWebSocket] 连接错误:', error)
        this.onError(error)
      }

    } catch (error) {
      console.error('[TeacherWebSocket] 创建连接失败:', error)
    }
  }

  /**
   * 发送消息
   */
  sendMessage(message: TeacherWebSocketMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('[TeacherWebSocket] WebSocket未连接，无法发送消息')
      return
    }

    try {
      const messageToSend = {
        ...message,
        timestamp: new Date().toISOString(),
        from: getUserId() || 'unknown',
      }

      this.socket.send(JSON.stringify(messageToSend))
      console.log('[TeacherWebSocket] 发送消息:', messageToSend)
    } catch (error) {
      console.error('[TeacherWebSocket] 发送消息失败:', error)
    }
  }

  /**
   * 发送教师消息
   */
  sendTeacherMessage(sessionId: string, content: string, msgType: string = '0'): void {
    const message: TeacherWebSocketMessage = {
      type: 'CHAT',
      sessionId,
      content,
      msgType,
    }
    this.sendMessage(message)
  }

  /**
   * 设置当前会话ID
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId
    console.log('[TeacherWebSocket] 设置会话ID:', sessionId)
  }

  /**
   * 添加事件监听器
   */
  on(event: string, callback: (message: TeacherWebSocketMessage) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  /**
   * 移除事件监听器
   */
  off(event: string, callback?: (message: TeacherWebSocketMessage) => void): void {
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
  private emit(event: string, message: TeacherWebSocketMessage): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(message)
        } catch (error) {
          console.error('[TeacherWebSocket] 事件回调执行失败:', error)
        }
      })
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: TeacherWebSocketMessage): void {
    switch (message.type) {
      case 'TEACHER_RESPONSE':
        this.emit('teacher_response', message)
        break
      case 'SESSION_UPDATE':
        this.emit('session_update', message)
        break
      case 'SYSTEM':
        this.emit('system', message)
        break
      case 'ERROR':
        this.emit('error', message)
        break
      default:
        this.emit('message', message)
    }
  }

  /**
   * 连接成功处理
   */
  private onConnected(): void {
    this.emit('connected', { type: 'SYSTEM', content: '已连接' })
  }

  /**
   * 连接断开处理
   */
  private onDisconnected(): void {
    this.emit('disconnected', { type: 'SYSTEM', content: '连接断开' })
  }

  /**
   * 连接错误处理
   */
  private onError(error: Event): void {
    this.emit('error', { type: 'ERROR', content: '连接错误', data: error })
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[TeacherWebSocket] 达到最大重连次数，停止重连')
      return
    }

    this.reconnectAttempts++
    console.log(`[TeacherWebSocket] ${this.reconnectDelay}ms后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect()
    }, this.reconnectDelay)
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.listeners = {}
    console.log('[TeacherWebSocket] 已断开连接')
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  /**
   * 获取当前会话ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionId
  }
}

// 创建单例实例
let teacherWebSocketInstance: TeacherWebSocketService | null = null

export function getTeacherWebSocket(): TeacherWebSocketService {
  if (!teacherWebSocketInstance) {
    teacherWebSocketInstance = new TeacherWebSocketService()
  }
  return teacherWebSocketInstance
}

export function destroyTeacherWebSocket(): void {
  if (teacherWebSocketInstance) {
    teacherWebSocketInstance.disconnect()
    teacherWebSocketInstance = null
  }
}
