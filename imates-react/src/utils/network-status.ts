/**
 * 网络状态管理工具
 * 用于检测网络连接状态变化，并提供网络恢复提示
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { showMessage } from '@/utils/index'

/**
 * 网络状态
 */
export interface NetworkStatus {
  isOnline: boolean
  wasOffline: boolean // 之前是否离线
  lastOnlineTime: number | null // 最后在线时间
}

// 全局网络状态
const networkStatus = ref<NetworkStatus>({
  isOnline: navigator.onLine,
  wasOffline: false,
  lastOnlineTime: navigator.onLine ? Date.now() : null
})

// 监听器列表
const listeners: Array<(status: NetworkStatus) => void> = []

/**
 * 初始化网络状态监听
 */
export function initNetworkStatusListener() {
  // 监听在线事件
  const handleOnline = () => {
    const wasOffline = !networkStatus.value.isOnline
    networkStatus.value = {
      isOnline: true,
      wasOffline,
      lastOnlineTime: Date.now()
    }
    
    // 如果之前离线，显示恢复提示
    if (wasOffline) {
      showMessage('网络已恢复，正在同步消息...', 'success', 3000)
    }
    
    // 通知所有监听器
    listeners.forEach(listener => listener(networkStatus.value))
  }
  
  // 监听离线事件
  const handleOffline = () => {
    networkStatus.value = {
      ...networkStatus.value,
      isOnline: false
    }
    
    showMessage('网络连接已断开', 'warning', 3000)
    
    // 通知所有监听器
    listeners.forEach(listener => listener(networkStatus.value))
  }
  
  // 添加事件监听
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  // 返回清理函数
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

/**
 * 获取当前网络状态
 */
export function getNetworkStatus(): NetworkStatus {
  return { ...networkStatus.value }
}

/**
 * 检查是否在线
 */
export function isOnline(): boolean {
  return networkStatus.value.isOnline
}

/**
 * 添加网络状态变化监听器
 * @param listener 监听器函数
 * @returns 清理函数
 */
export function onNetworkStatusChange(listener: (status: NetworkStatus) => void): () => void {
  listeners.push(listener)
  
  // 立即调用一次，传递当前状态
  listener(networkStatus.value)
  
  // 返回清理函数
  return () => {
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }
}

/**
 * Vue组合式函数：使用网络状态
 */
export function useNetworkStatus() {
  const status = ref(getNetworkStatus())
  
  let cleanup: (() => void) | null = null
  
  onMounted(() => {
    cleanup = onNetworkStatusChange((newStatus) => {
      status.value = newStatus
    })
  })
  
  onUnmounted(() => {
    if (cleanup) {
      cleanup()
    }
  })
  
  return {
    status: status.value,
    isOnline: computed(() => status.value.isOnline),
    wasOffline: computed(() => status.value.wasOffline)
  }
}

