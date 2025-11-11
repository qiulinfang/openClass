import { ref } from 'vue'

// 全局单例状态
const isPanelVisible = ref(false)

/**
 * 全局存储调试面板 Composable
 * 提供统一的存储调试面板 API，确保全局只有一个 StorageDebugPanel 实例
 */
export function useStorageDebugPanel() {
  // 第1步：显示调试面板
  const show = () => {
    isPanelVisible.value = true
  }

  // 第2步：隐藏调试面板
  const hide = () => {
    isPanelVisible.value = false
  }

  // 第3步：切换调试面板显示状态
  const toggle = () => {
    isPanelVisible.value = !isPanelVisible.value
  }

  return {
    isPanelVisible,
    show,
    hide,
    toggle
  }
}





























