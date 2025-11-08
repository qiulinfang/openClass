<template>
  <q-btn
    v-if="isDev"
    fab
    icon="storage"
    color="primary"
    class="storage-debug-button"
    @click="togglePanel"
    :title="isPanelVisible ? '关闭存储调试面板' : '打开存储调试面板'"
  >
    <q-tooltip>
      {{ isPanelVisible ? '关闭存储调试面板' : '打开存储调试面板' }}
    </q-tooltip>
  </q-btn>
</template>

<script setup lang="ts">
import { useStorageDebugPanel } from '@/composables/useStorageDebugPanel'

// 检查是否是开发环境
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

// 使用全局存储调试面板 composable
const { isPanelVisible, toggle } = useStorageDebugPanel()

// 切换面板显示状态
const togglePanel = () => {
  toggle()
}
</script>

<style lang="scss" scoped>
.storage-debug-button {
  position: fixed;
  bottom: 100px;
  right: 20px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  
  &:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
}
</style>

