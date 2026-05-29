/**
 * 账号状态检查工具
 * 场景41：学生被禁言 - 账号状态检查
 * 场景42：学生关闭了通知权限 - 通知权限检测
 */

import { showMessage } from '@/utils'

/**
 * 账号状态接口
 */
export interface AccountStatus {
  isBanned: boolean
  banReason?: string
  canSendMessage: boolean
}

/**
 * 场景41：检查账号状态（是否被禁言）
 * 从用户信息中检查账号状态
 * 如果被禁言，显示提示
 * @param userInfo 用户信息
 * @returns 账号状态
 */
export const checkAccountStatus = async (userInfo: { id?: string; roles?: string[] } | null): Promise<AccountStatus> => {
  try {
    // 检查用户信息
    if (!userInfo || !userInfo.id) {
      return {
        isBanned: false,
        canSendMessage: true
      }
    }
    
    // 检查角色中是否包含禁言标记
    // 注意：这里假设后端会在roles中添加'banned'标记，实际实现需要根据后端API调整
    const roles = userInfo.roles || []
    const isBanned = roles.includes('banned') || roles.includes('muted')
    
    if (isBanned) {
      console.warn('[ACCOUNT_STATUS] ⚠️ 账号已被禁言')
      showMessage('您的账号已被禁言，无法发送消息', 'warning', 5000)
      
      return {
        isBanned: true,
        banReason: '账号已被管理员禁言',
        canSendMessage: false
      }
    }
    
    return {
      isBanned: false,
      canSendMessage: true
    }
  } catch (error) {
    console.error('[ACCOUNT_STATUS] ❌ 检查账号状态失败:', error)
    // 出错时默认允许发送消息
    return {
      isBanned: false,
      canSendMessage: true
    }
  }
}

/**
 * 场景42：检查通知权限状态
 * 检查浏览器通知权限
 * 如果未授权，提示用户开启
 * @returns 是否已授权通知权限
 */
export const checkNotificationPermission = async (): Promise<boolean> => {
  try {
    // 检查浏览器是否支持通知API
    if (!('Notification' in window)) {
      console.warn('[NOTIFICATION] ⚠️ 浏览器不支持通知API')
      return false
    }
    
    // 检查当前权限状态
    const permission = Notification.permission
    
    if (permission === 'granted') {
      return true
    }
    
    if (permission === 'denied') {
      console.warn('[NOTIFICATION] ⚠️ 通知权限已被拒绝')
      showMessage('通知权限已被关闭，应用在后台时将无法收到消息提醒。请在浏览器设置中开启通知权限。', 'warning', 5000)
      return false
    }
    
    // permission === 'default'，未请求过权限
    try {
      // 请求通知权限
      const result = await Notification.requestPermission()
      
      if (result === 'granted') {
        showMessage('通知权限已开启', 'success', 3000)
        return true
      } else {
        console.warn('[NOTIFICATION] ⚠️ 用户拒绝了通知权限')
        showMessage('通知权限未开启，应用在后台时将无法收到消息提醒', 'warning', 5000)
        return false
      }
    } catch (error) {
      console.error('[NOTIFICATION] ❌ 请求通知权限失败:', error)
      return false
    }
  } catch (error) {
    console.error('[NOTIFICATION] ❌ 检查通知权限失败:', error)
    return false
  }
}

/**
 * 发送系统通知（如果权限已授予）
 * @param title 通知标题
 * @param body 通知内容
 * @param icon 通知图标URL（可选）
 */
export const sendSystemNotification = (title: string, body: string, icon?: string): void => {
  try {
    if (!('Notification' in window)) {
      return
    }
    
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        tag: 'teacher-message', // 使用tag避免重复通知
        requireInteraction: false // 不要求用户交互
      })
      
      // 3秒后自动关闭通知
      setTimeout(() => {
        notification.close()
      }, 3000)
      
      // 点击通知时聚焦窗口
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }
  } catch (error) {
    console.error('[NOTIFICATION] ❌ 发送系统通知失败:', error)
  }
}

