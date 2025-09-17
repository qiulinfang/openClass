/**
 * 公式事件管理器 - 负责管理所有公式相关的事件
 */

export type EventHandler = (data?: unknown) => void

export class FormulaEventManager {
  private static instance: FormulaEventManager | null = null
  private listeners = new Map<string, EventHandler[]>()

  // 单例模式
  static getInstance(): FormulaEventManager {
    if (!FormulaEventManager.instance) {
      FormulaEventManager.instance = new FormulaEventManager()
    }
    return FormulaEventManager.instance
  }

  // 注册事件监听器
  on(event: string, handler: EventHandler): void {
    console.log('🎧 [FORMULA-EVENT] 注册事件监听器', { event })
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(handler)
  }

  // 移除事件监听器
  off(event: string, handler: EventHandler): void {
    console.log('🎧 [FORMULA-EVENT] 移除事件监听器', { event })
    
    const handlers = this.listeners.get(event) || []
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  // 触发事件
  emit(event: string, data?: unknown): void {
    console.log('🎧 [FORMULA-EVENT] 触发事件', { event, data })
    
    const handlers = this.listeners.get(event) || []
    handlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error('❌ [FORMULA-EVENT] 事件处理器执行失败', { event, error })
      }
    })
  }

  // 一次性事件监听器
  once(event: string, handler: EventHandler): void {
    console.log('🎧 [FORMULA-EVENT] 注册一次性事件监听器', { event })
    
    const onceHandler = (data?: unknown) => {
      handler(data)
      this.off(event, onceHandler)
    }
    
    this.on(event, onceHandler)
  }

  // 移除所有事件监听器
  removeAllListeners(event?: string): void {
    if (event) {
      console.log('🎧 [FORMULA-EVENT] 移除指定事件的所有监听器', { event })
      this.listeners.delete(event)
    } else {
      console.log('🎧 [FORMULA-EVENT] 移除所有事件监听器')
      this.listeners.clear()
    }
  }

  // 获取事件监听器数量
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0
  }

  // 获取所有事件名称
  getEventNames(): string[] {
    return Array.from(this.listeners.keys())
  }
}

// 预定义的事件常量
export const FORMULA_EVENTS = {
  // 公式生命周期事件
  CREATED: 'formula-created',
  ACTIVATED: 'formula-activated',
  DEACTIVATED: 'formula-deactivated',
  CONTENT_CHANGED: 'formula-content-changed',
  DELETED: 'formula-deleted',
  
  // 虚拟键盘事件
  KEYBOARD_SHOW: 'virtual-keyboard-show',
  KEYBOARD_HIDE: 'virtual-keyboard-hide',
  KEYBOARD_TOGGLE: 'virtual-keyboard-toggle',
  
  // 用户交互事件
  FOCUS: 'formula-focus',
  BLUR: 'formula-blur',
  ENTER: 'formula-enter',
  ESCAPE: 'formula-escape',
  
  // 错误事件
  ERROR: 'formula-error',
  INITIALIZATION_FAILED: 'formula-initialization-failed',
  MATHLIVE_LOAD_FAILED: 'mathlive-load-failed',
  NODE_CREATION_FAILED: 'node-creation-failed',
  KEYBOARD_SHOW_FAILED: 'keyboard-show-failed',
  FOCUS_FAILED: 'focus-failed',
  CONTENT_SAVE_FAILED: 'content-save-failed'
} as const

// 事件类型定义
export type FormulaEventType = typeof FORMULA_EVENTS[keyof typeof FORMULA_EVENTS]

// 事件数据接口
export interface FormulaEventData {
  nodeId?: string
  content?: string
  position?: number
  error?: Error
  mathField?: unknown
  container?: HTMLElement
  [key: string]: unknown
}
