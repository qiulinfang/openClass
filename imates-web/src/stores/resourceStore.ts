/**
 * 资源管理 Store
 * 用于管理教材资源的状态和通知
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useResourceStore = defineStore('resource', () => {
  // 资源更新检查状态
  const lastUpdateCheckTime = ref<number | null>(null)
  const lastUpdateTime = ref<number | null>(null)
  
  // 通知状态（用于触发通知检查）
  const notificationTrigger = ref(0)
  
  /**
   * 标记更新检查完成
   * 当检查更新完成后调用此方法
   */
  const markUpdateCheckCompleted = () => {
    lastUpdateCheckTime.value = Date.now()
    // 触发通知检查
    notificationTrigger.value++
  }
  
  /**
   * 标记教材更新完成
   * 当教材下载/更新完成后调用此方法
   */
  const markTextbookUpdated = () => {
    lastUpdateTime.value = Date.now()
    // 触发通知检查
    notificationTrigger.value++
  }
  
  /**
   * 手动触发通知检查
   * 用于窗口焦点等场景
   */
  const triggerNotificationCheck = () => {
    notificationTrigger.value++
  }
  
  return {
    lastUpdateCheckTime,
    lastUpdateTime,
    notificationTrigger,
    markUpdateCheckCompleted,
    markTextbookUpdated,
    triggerNotificationCheck
  }
})

