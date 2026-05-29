import { useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'

/**
 * 控制 ExerciseChatPanel 的显示/隐藏
 */
export const useExerciseChatPanel = () => {
  const isVisible = useUIStore((state) => state.isExerciseChatPanelVisible)
  const setVisible = useUIStore((state) => state.setExerciseChatPanelVisible)

  const showExerciseChatPanel = useCallback(() => {
    setVisible(true)
  }, [setVisible])

  const hideExerciseChatPanel = useCallback(() => {
    setVisible(false)
  }, [setVisible])

  const toggleExerciseChatPanel = useCallback(() => {
    setVisible(!isVisible)
  }, [isVisible, setVisible])

  return {
    isExerciseChatPanelVisible: isVisible,
    showExerciseChatPanel,
    hideExerciseChatPanel,
    toggleExerciseChatPanel
  }
}
