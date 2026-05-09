import { defineStore } from 'pinia'
import { ref, onBeforeUnmount } from 'vue'
import { androidBridge } from '@/services/business/android-bridge'
import type { BridgeClassroomStatus } from '@/types/bridge'

export const useClassroomStore = defineStore('classroom', () => {
  // ==================== 状态定义 ====================
  
  /** 是否在课堂中 */
  const isInClass = ref(false)
  
  /** 是否正在投屏 */
  const isProjecting = ref(false)
  
  /** 距离最后一次心跳成功的秒数 */
  const lastHeartbeatInterval = ref(-1)
  
  /** 连接健康状态：'healthy' | 'warning' | 'offline' */
  const connectionHealth = ref<'healthy' | 'warning' | 'offline'>('healthy')

  /** 轮询定时器 */
  let pollTimer: number | null = null

  // ==================== Actions ====================

  /** 
   * 更新状态 
   */
  const updateStatus = (status: BridgeClassroomStatus | null) => {
    if (!status) {
      isInClass.value = false
      isProjecting.value = false
      lastHeartbeatInterval.value = -1
      connectionHealth.value = 'offline'
      return
    }

    isInClass.value = status.isInClass
    isProjecting.value = status.status === 'streaming'
    lastHeartbeatInterval.value = status.secondsSinceLastHeartbeat ?? -1

    // 逻辑判定：
    // 如果 isInClass 为 true，但心跳间隔过长，则标记为 warning 或 offline
    if (isInClass.value) {
      if (lastHeartbeatInterval.value > 15) {
        connectionHealth.value = 'offline'
      } else if (lastHeartbeatInterval.value > 5) {
        connectionHealth.value = 'warning'
      } else {
        connectionHealth.value = 'healthy'
      }
    } else {
      connectionHealth.value = 'healthy'
    }
  }

  /**
   * 启动状态轮询
   */
  const startPolling = () => {
    if (pollTimer) return
    
    // 立即执行一次
    const currentStatus = androidBridge.getClassroomStatus()
    updateStatus(currentStatus)

    // 每 3 秒轮询一次原生状态
    pollTimer = window.setInterval(() => {
      const status = androidBridge.getClassroomStatus()
      updateStatus(status)
    }, 3000)
    
    console.log('[ClassroomStore] Started status polling')
  }

  /**
   * 停止状态轮询
   */
  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
      console.log('[ClassroomStore] Stopped status polling')
    }
  }

  /**
   * 初始化
   */
  const init = () => {
    startPolling()
    
    // 监听原生主动推送的事件作为补充
    androidBridge.onClassroomJoined((status) => {
      updateStatus(status)
    })
    
    androidBridge.onClassroomExited(() => {
      isInClass.value = false
      isProjecting.value = false
      connectionHealth.value = 'healthy'
    })
    
    androidBridge.onClassroomStatusChanged((status) => {
      updateStatus(status)
    })
  }

  return {
    isInClass,
    isProjecting,
    lastHeartbeatInterval,
    connectionHealth,
    init,
    startPolling,
    stopPolling,
    updateStatus
  }
})
