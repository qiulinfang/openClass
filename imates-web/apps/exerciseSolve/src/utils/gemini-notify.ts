import { Notify } from 'quasar'

/**
 * Gemini风格的通知工具类
 * 提供统一的消息通知样式和停留时间配置
 */
export class GeminiNotify {
  /**
   * 显示成功消息
   * @param message 消息内容
   * @param timeout 停留时间（毫秒），默认2000ms
   */
  static success(message: string, timeout: number = 2000) {
    Notify.create({
      message,
      type: 'positive',
      position: 'top',
      timeout,
      classes: 'gemini-notify',
      actions: [{ icon: 'close', color: 'white', round: true, size: 'sm' }]
    })
  }

  /**
   * 显示错误消息
   * @param message 消息内容
   * @param timeout 停留时间（毫秒），默认2500ms
   */
  static error(message: string, timeout: number = 2500) {
    Notify.create({
      message,
      type: 'negative',
      position: 'top',
      timeout,
      classes: 'gemini-notify',
      actions: [{ icon: 'close', color: 'white', round: true, size: 'sm' }]
    })
  }

  /**
   * 显示警告消息
   * @param message 消息内容
   * @param timeout 停留时间（毫秒），默认3000ms
   */
  static warning(message: string, timeout: number = 3000) {
    Notify.create({
      message,
      type: 'warning',
      position: 'top',
      timeout,
      classes: 'gemini-notify',
      actions: [{ icon: 'close', color: 'white', round: true, size: 'sm' }]
    })
  }

  /**
   * 显示信息消息
   * @param message 消息内容
   * @param timeout 停留时间（毫秒），默认1500ms
   */
  static info(message: string, timeout: number = 1500) {
    Notify.create({
      message,
      type: 'info',
      position: 'top',
      timeout,
      classes: 'gemini-notify',
      actions: [{ icon: 'close', color: 'white', round: true, size: 'sm' }]
    })
  }

  /**
   * 显示自定义消息
   * @param message 消息内容
   * @param type 消息类型
   * @param timeout 停留时间（毫秒）
   */
  static show(
    message: string, 
    type: 'positive' | 'negative' | 'warning' | 'info' = 'info',
    timeout?: number
  ) {
    const defaultTimeouts = {
      positive: 2000,
      negative: 2500,
      warning: 3000,
      info: 1500
    }
    
    Notify.create({
      message,
      type,
      position: 'top',
      timeout: timeout || defaultTimeouts[type],
      classes: 'gemini-notify',
      actions: [{ icon: 'close', color: 'white', round: true, size: 'sm' }]
    })
  }
}

// 导出便捷方法
export const geminiNotify = GeminiNotify

// 默认导出
export default GeminiNotify
