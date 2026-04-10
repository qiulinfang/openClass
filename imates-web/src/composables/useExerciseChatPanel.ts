import { ref } from 'vue'

// ExerciseChatPanel 显示状态
const isExerciseChatPanelVisible = ref(false)

// 控制 ExerciseChatPanel 的显示/隐藏
export const useExerciseChatPanel = () => {
  const showExerciseChatPanel = () => {
    isExerciseChatPanelVisible.value = true
  }

  const hideExerciseChatPanel = () => {
    isExerciseChatPanelVisible.value = false
  }

  const toggleExerciseChatPanel = () => {
    isExerciseChatPanelVisible.value = !isExerciseChatPanelVisible.value
  }

  return {
    isExerciseChatPanelVisible,
    showExerciseChatPanel,
    hideExerciseChatPanel,
    toggleExerciseChatPanel
  }
}
