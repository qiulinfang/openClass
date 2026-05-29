import { useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'

/**
 * 全局存储调试面板 Hook
 * 提供统一的存储调试面板 API，确保全局只有一个 StorageDebugPanel 实例
 */
export function useStorageDebugPanel() {
  const isPanelVisible = useUIStore((state) => state.isStorageDebugPanelVisible)
  const setVisible = useUIStore((state) => state.setStorageDebugPanelVisible)

  // 显示调试面板
  const show = useCallback(() => {
    setVisible(true)
  }, [setVisible])

  // 隐藏调试面板
  const hide = useCallback(() => {
    setVisible(false)
  }, [setVisible])

  // 切换调试面板显示状态
  const toggle = useCallback(() => {
    setVisible(!isPanelVisible)
  }, [isPanelVisible, setVisible])

  return {
    isPanelVisible,
    show,
    hide,
    toggle
  }
}
