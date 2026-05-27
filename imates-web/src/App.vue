<template>
  <q-app>
    <router-view />
    <!-- 全局单例图片选择器 -->
    <ImagePicker />
    <!-- 全局存储调试面板 -->
    <StorageDebugPanel />
    <!-- 全局存储调试按钮 -->
    <StorageDebugButton />
  </q-app>
</template>


<script setup lang="ts">
import ImagePicker from './components/chat/Input/ImagePicker.vue'
import StorageDebugPanel from './components/debug/StorageDebugPanel.vue'
import StorageDebugButton from './components/debug/StorageDebugButton.vue'

// 设置Android日志接收器
if (typeof window !== 'undefined') {
  // 确保onAndroidLog回调已设置（如果android-bridge还未初始化）
  if (!window.onAndroidLog) {
    window.onAndroidLog = (level: string, tag: string, message: string) => {
      const logMessage = `[${tag}] ${message}`
      switch (level.toUpperCase()) {
        case 'DEBUG':
          break
        case 'INFO':
          break
        case 'WARN':
          console.warn(`⚠️ [Android ${level}]`, logMessage)
          break
        case 'ERROR':
          console.error(`❌ [Android ${level}]`, logMessage)
          break
        default:
          break
      }
    }
  }
}
</script>
