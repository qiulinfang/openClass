import { androidBridge } from '../services/android-bridge'

/**
 * 消息提示工具类
 * 使用 Android 原生通知系统
 */
export class MessageUtils {
  /**
   * 显示成功消息 - 使用Android原生通知
   * @param message 消息内容
   */
  static success(message: string) {
    androidBridge.showNotification(message, 'success')
  }

  /**
   * 显示错误消息 - 使用Android原生通知
   * @param message 消息内容
   */
  static error(message: string) {
    androidBridge.showNotification(message, 'error')
  }

  /**
   * 显示警告消息 - 使用Android原生通知
   * @param message 消息内容
   */
  static warning(message: string) {
    androidBridge.showNotification(message, 'warning')
  }

  /**
   * 显示信息消息 - 使用Android原生通知
   * @param message 消息内容
   */
  static info(message: string) {
    androidBridge.showNotification(message, 'info')
  }

  /**
   * 显示自定义消息 - 使用Android原生通知
   * @param message 消息内容
   * @param type 消息类型
   */
  static show(message: string, type: 'positive' | 'negative' | 'warning' | 'info' | 'success' | 'error' = 'positive') {
    // 映射类型到Android通知类型
    const notificationType = type === 'positive' ? 'success' : 
                           type === 'negative' ? 'error' : 
                           type === 'success' ? 'success' :
                           type === 'error' ? 'error' : type
    androidBridge.showNotification(message, notificationType)
  }
}

/**
 * 简化的消息提示函数
 * 兼容原有的showMessage函数调用方式，现在使用 Android 原生通知
 * @param message 消息内容
 * @param type 消息类型（保持兼容性）
 */
export const showMessage = (
  message: string, 
  type: 'positive' | 'negative' | 'warning' | 'info' | 'success' | 'error' = 'positive'
) => {
  MessageUtils.show(message, type)
}

// 导出便捷方法
export const message = MessageUtils

// 默认导出
export default MessageUtils