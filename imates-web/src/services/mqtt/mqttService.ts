/**
 * 通用 MQTT over WebSocket 服务
 * 提供 MQTT 连接管理、主题订阅与消息分发底层能力
 */

import mqtt, { type MqttClient, type IClientOptions } from 'mqtt'
import { ref, readonly } from 'vue'
import { getMqttWsUrl } from '@/config/env-config'
import { getUserId } from '../http/auth-service'

export interface MqttMessage {
  topic: string
  payload: string
  parsedPayload?: any
  qos: number
  retain: boolean
}

export type MqttConnectionStatus = 'connected' | 'reconnecting' | 'offline' | 'disconnected'

export interface MqttServiceConfig {
  url?: string
  options?: IClientOptions
}

export class MqttService {
  private client: MqttClient | null = null
  private status = ref<MqttConnectionStatus>('disconnected')
  private error = ref<Error | null>(null)
  
  // 主题订阅监听器映射：topic -> callbacks[]
  private listeners: Map<string, ((message: MqttMessage) => void)[]> = new Map()
  
  // 通用事件监听器：connect, close, error, reconnect等
  private eventListeners: Record<string, (() => void)[]> = {
    connect: [],
    close: [],
    reconnect: [],
    offline: [],
    error: []
  }

  constructor(config: MqttServiceConfig = {}) {
    const defaultUrl = getMqttWsUrl()
    const userId = getUserId() || 'guest_' + Math.random().toString(36).substring(2, 10)
    
    const defaultOptions: IClientOptions = {
      clientId: `imates_web_${userId}_${Date.now()}`,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 3000,
      keepalive: 60,
      ...config.options
    }

    this.connect(config.url || defaultUrl, defaultOptions)
  }

  /**
   * 建立连接
   */
  private connect(url: string, options: IClientOptions): void {
    if (this.client) {
      this.client.end()
    }

    console.log('[MQTT] Connecting to:', url, 'with client ID:', options.clientId)
    this.status.value = 'reconnecting'

    try {
      this.client = mqtt.connect(url, options)

      this.client.on('connect', () => {
        console.log('[MQTT] Connected successfully')
        this.status.value = 'connected'
        this.error.value = null
        this.triggerEvent('connect')
        // 自动重订阅之前已注册的主题
        this.resubscribeAll()
      })

      this.client.on('reconnect', () => {
        console.log('[MQTT] Reconnecting...')
        this.status.value = 'reconnecting'
        this.triggerEvent('reconnect')
      })

      this.client.on('close', () => {
        console.log('[MQTT] Connection closed')
        this.status.value = 'disconnected'
        this.triggerEvent('close')
      })

      this.client.on('offline', () => {
        console.log('[MQTT] Client went offline')
        this.status.value = 'offline'
        this.triggerEvent('offline')
      })

      this.client.on('error', (err) => {
        console.error('[MQTT] Connection error:', err)
        this.error.value = err
        this.triggerEvent('error')
      })

      this.client.on('message', (topic, payload, packet) => {
        const payloadStr = payload.toString()
        console.log(`[MQTT] Received message on [${topic}]:`, payloadStr)
        
        let parsedPayload = null
        try {
          parsedPayload = JSON.parse(payloadStr)
        } catch (e) {
          // payload is not a valid JSON string, keep it as null
        }

        const message: MqttMessage = {
          topic,
          payload: payloadStr,
          parsedPayload,
          qos: packet.qos,
          retain: packet.retain
        }

        this.distributeMessage(topic, message)
      })

    } catch (err: any) {
      console.error('[MQTT] Connect exception:', err)
      this.status.value = 'offline'
      this.error.value = err
    }
  }

  /**
   * 订阅主题
   */
  subscribe(topic: string, callback: (message: MqttMessage) => void): void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, [])
      
      // 如果客户端已连接，直接向 Broker 发送订阅请求
      if (this.client && this.client.connected) {
        this.client.subscribe(topic, (err) => {
          if (err) {
            console.error(`[MQTT] Subscribe to topic [${topic}] failed:`, err)
          } else {
            console.log(`[MQTT] Subscribed to topic [${topic}]`)
          }
        })
      }
    }

    this.listeners.get(topic)!.push(callback)
  }

  /**
   * 取消订阅主题
   */
  unsubscribe(topic: string, callback: (message: MqttMessage) => void): void {
    const callbacks = this.listeners.get(topic)
    if (!callbacks) return

    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }

    // 如果该主题没有任何监听器了，通知 Broker 取消订阅
    if (callbacks.length === 0) {
      this.listeners.delete(topic)
      if (this.client && this.client.connected) {
        this.client.unsubscribe(topic, (err) => {
          if (err) {
            console.error(`[MQTT] Unsubscribe from topic [${topic}] failed:`, err)
          } else {
            console.log(`[MQTT] Unsubscribed from topic [${topic}]`)
          }
        })
      }
    }
  }

  /**
   * 发布消息
   */
  publish(topic: string, message: string | object, qos: 0 | 1 | 2 = 1): void {
    if (!this.client || !this.client.connected) {
      console.error('[MQTT] Cannot publish, client is not connected')
      return
    }

    const payload = typeof message === 'object' ? JSON.stringify(message) : message
    this.client.publish(topic, payload, { qos }, (err) => {
      if (err) {
        console.error(`[MQTT] Publish to [${topic}] failed:`, err)
      } else {
        console.log(`[MQTT] Published to [${topic}]`)
      }
    })
  }

  /**
   * 关闭连接
   */
  disconnect(): void {
    if (this.client) {
      this.client.end()
      this.client = null
    }
    this.listeners.clear()
    this.status.value = 'disconnected'
  }

  /**
   * 重连时自动订阅之前所有的 topics
   */
  private resubscribeAll(): void {
    if (!this.client || !this.client.connected) return

    for (const topic of this.listeners.keys()) {
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`[MQTT] Resubscribe to [${topic}] failed:`, err)
        } else {
          console.log(`[MQTT] Resubscribed to [${topic}]`)
        }
      })
    }
  }

  /**
   * 分发消息给监听对应主题的所有回调
   */
  private distributeMessage(receivedTopic: string, message: MqttMessage): void {
    // 匹配包含通配符的主题 (如: 'device/+/status' 或 'device/#')
    for (const [subscribedTopic, callbacks] of this.listeners.entries()) {
      if (this.matchTopic(subscribedTopic, receivedTopic)) {
        callbacks.forEach(cb => {
          try {
            cb(message)
          } catch (e) {
            console.error('[MQTT] Listener callback execution failed:', e)
          }
        })
      }
    }
  }

  /**
   * 判断订阅的主题是否匹配接收到的主题 (支持 MQTT 通配符 + 和 #)
   */
  private matchTopic(subscribed: string, received: string): boolean {
    if (subscribed === received) return true
    
    const subParts = subscribed.split('/')
    const recParts = received.split('/')
    
    for (let i = 0; i < subParts.length; i++) {
      if (subParts[i] === '#') {
        return true
      }
      if (subParts[i] !== '+' && subParts[i] !== recParts[i]) {
        return false
      }
    }
    
    return subParts.length === recParts.length
  }

  /**
   * 注册客户端事件监听器
   */
  on(event: 'connect' | 'close' | 'reconnect' | 'offline' | 'error', callback: () => void): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback)
    }
  }

  /**
   * 触发客户端事件
   */
  private triggerEvent(event: string): void {
    const callbacks = this.eventListeners[event]
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb()
        } catch (e) {
          console.error(`[MQTT] Event listener for ${event} failed:`, e)
        }
      })
    }
  }

  // 获取响应式状态
  getConnectionStatus() {
    return readonly(this.status)
  }

  getError() {
    return readonly(this.error)
  }
}

// 单例模式管理服务实例
let globalMqttInstance: MqttService | null = null

export function getMqttService(config?: MqttServiceConfig): MqttService {
  if (!globalMqttInstance) {
    globalMqttInstance = new MqttService(config)
  }
  return globalMqttInstance
}

export function destroyMqttService(): void {
  if (globalMqttInstance) {
    globalMqttInstance.disconnect()
    globalMqttInstance = null
  }
}
