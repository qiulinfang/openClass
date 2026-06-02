import { ref } from 'vue'

// MainChatPanel 显示状态
const isMainChatPanelVisible = ref(false)

// 控制 MainChatPanel 的显示/隐藏
export const useMainChatPanel = () => {
  const showMainChatPanel = () => {
    isMainChatPanelVisible.value = true
  }

  const hideMainChatPanel = () => {
    isMainChatPanelVisible.value = false
  }

  const toggleMainChatPanel = () => {
    isMainChatPanelVisible.value = !isMainChatPanelVisible.value
  }

  return {
    isMainChatPanelVisible,
    showMainChatPanel,
    hideMainChatPanel,
    toggleMainChatPanel
  }
}
