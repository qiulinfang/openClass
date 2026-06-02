/**
 * 资源管理 Store
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useResourceStore = defineStore('resource', () => {
  // 资源更新检查状态
  const lastUpdateCheckTime = ref<number | null>(null)
  const lastUpdateTime = ref<number | null>(null)

  const hasResourceNotification = ref(false)

  const setHasResourceNotification = (value: boolean) => {
    hasResourceNotification.value = value
  }
  
  /**
   * 标记更新检查完成
   */
  const markUpdateCheckCompleted = () => {
    lastUpdateCheckTime.value = Date.now()
  }
  
  /**
   * 标记教材更新完成
   */
  const markTextbookUpdated = () => {
    lastUpdateTime.value = Date.now()
  }
  
  return {
    lastUpdateCheckTime,
    lastUpdateTime,
    hasResourceNotification,
    setHasResourceNotification,
    markUpdateCheckCompleted,
    markTextbookUpdated,
  }
})
