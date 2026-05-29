import { useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'

/**
 * 控制 MainChatPanel 的显示/隐藏
 */
export const useMainChatPanel = () => {
  const isVisible = useUIStore((state) => state.isMainChatPanelVisible)
  const setVisible = useUIStore((state) => state.setMainChatPanelVisible)

  const showMainChatPanel = useCallback(() => {
    setVisible(true)
  }, [setVisible])

  const hideMainChatPanel = useCallback(() => {
    setVisible(false)
  }, [setVisible])

  const toggleMainChatPanel = useCallback(() => {
    setVisible(!isVisible)
  }, [isVisible, setVisible])

  return {
    isMainChatPanelVisible: isVisible,
    showMainChatPanel,
    hideMainChatPanel,
    toggleMainChatPanel
  }
}
