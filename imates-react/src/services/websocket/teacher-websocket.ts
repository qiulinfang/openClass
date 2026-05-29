/**
 * 教师聊天WebSocket服务
 * 处理教师聊天的实时通信
 */

import { getUserId } from '@/services/http/auth-service'
import { getYanbanBaseUrl, getApiPaths } from '@/config/env-config'

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
  public connect(overrideUserId?: string): void {
    try {
      const apiPaths = getApiPaths()
      const wsPath = apiPaths.yanban.teacher.wsPath
      const userId = overrideUserId || getUserId() || 'unknown'

      let wsUrl = ''
      // 如果是在本地开发环境（localhost/127.0.0.1），连接到当前前端服务的 host
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
        wsUrl = `${protocol}${window.location.host}${wsPath}?userId=${userId}`
      } else {
        const yanbanBaseUrl = getYanbanBaseUrl()
        wsUrl = yanbanBaseUrl
          .replace('https://', 'wss://')
          .replace('http://', 'ws://') + wsPath + `?userId=${userId}`
      }

      console.log(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] WebSocket URL: ${wsUrl}`)
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        console.log(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 连接建立成功 ✅`)
        this.reconnectAttempts = 0
        this.onConnected()
      }

      this.socket.onmessage = (event) => {
        try {
          const message: TeacherWebSocketMessage = JSON.parse(event.data)
          console.log(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 收到消息 📥 类型: ${message.type}`, message)
          this.handleMessage(message)
        } catch (error) {
          console.error(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 消息解析失败 ❌ 内容:`, event.data, '错误:', error)
        }
      }

      this.socket.onclose = (event) => {
        console.warn(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 连接已断开 🔌 代码: ${event.code}, 原因: ${event.reason || '无'}`)
        this.onDisconnected()
        this.attemptReconnect()
      }

      this.socket.onerror = (error) => {
        console.error(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 发生错误 🛑`, error)
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
      console.error(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 发送失败 ❌ WebSocket 当前未处于连接状态 (readyState: ${this.socket?.readyState})`)
      return
    }

    try {
      const messageToSend = {
        ...message,
        timestamp: new Date().toISOString(),
        from: getUserId() || 'unknown',
      }

      console.log(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 发送消息 📤 类型: ${message.type}`, messageToSend)
      this.socket.send(JSON.stringify(messageToSend))
    } catch (error) {
      console.error(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 发送消息异常 ❌`, error)
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
      console.error(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 达到最大重连次数 (${this.maxReconnectAttempts})，放弃重连 🏳️`)
      return
    }

    this.reconnectAttempts++
    console.log(`[TeacherWebSocket][${new Date().toLocaleTimeString()}] 准备进行第 ${this.reconnectAttempts} 次重连... 将在 ${this.reconnectDelay}ms 后执行`)

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
