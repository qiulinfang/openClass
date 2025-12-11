<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import ImagePicker from './components/chat/ImagePicker.vue'
import StorageDebugPanel from './components/debug/StorageDebugPanel.vue'
import StorageDebugButton from './components/debug/StorageDebugButton.vue'
import { apiService } from './services/business/api-service'
import { resourceManager } from './services/storage/resource-storage'
// 注释掉缩略图相关导入以提升性能
// import { thumbnailQueue } from './utils/thumbnail/thumbnail-queue'

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

// 全局资源自动更新检查定时器
let resourceUpdateTimer: ReturnType<typeof setInterval> | null = null

// 全局资源自动更新检查函数
// 第1步：调用API服务检查需要更新的教材
// 第2步：获取本地所有教材信息
// 第3步：重置所有教材的更新状态
// 第4步：标记需要更新的教材
const checkResourceUpdates = async () => {
  try {
    // 第1步：调用API服务检查需要更新的教材
    const updatedTextbooks = await apiService.checkForUpdates()

    // 第2步：获取本地所有教材信息
    const localTextbooks = await resourceManager.getUserLocalTextbooks()

    // 第3步：重置所有教材的更新状态
    const resetPromises = localTextbooks.map(async (textbook) => {
      textbook.hasUpdatesAvailable = false
      await resourceManager.updateTextbookInfo(textbook, {
        hasUpdatesAvailable: false,
      })
    })
    await Promise.all(resetPromises)

    // 第4步：标记需要更新的教材
    if (updatedTextbooks.length > 0) {
      const updatePromises = updatedTextbooks.map(async (updatedTextbook) => {
        const localTextbook = localTextbooks.find(
          (textbook) => textbook.textbookId === updatedTextbook.textbookId,
        )

        if (localTextbook) {
          localTextbook.hasUpdatesAvailable = true
          await resourceManager.updateTextbookInfo(localTextbook, {
            hasUpdatesAvailable: true,
          })
        }
      })

      await Promise.all(updatePromises)
    }
  } catch {
    // 静默处理错误，避免影响应用正常运行
  }
}

onMounted(() => {
  // 注释掉缩略图恢复逻辑以提升性能
  /*
  // 第1步：延迟恢复缩略图任务，避免阻塞应用启动
  setTimeout(() => {
    // 第2步：恢复被打断的缩略图生成任务
    thumbnailQueue.recoverPendingTasks()
  }, 2000) // 等待2秒，让应用完全启动
  */

  // 启动全局资源自动更新检查（每1小时检查一次）
  // 第1步：设置定时器，每1小时检查一次
  resourceUpdateTimer = setInterval(() => {
    checkResourceUpdates()
  }, 60 * 60 * 1000) // 1小时 = 60 * 60 * 1000 毫秒

  // 第2步：立即执行一次检查
  checkResourceUpdates()
})

onBeforeUnmount(() => {
  // 清理资源自动更新定时器
  if (resourceUpdateTimer) {
    clearInterval(resourceUpdateTimer)
    resourceUpdateTimer = null
  }

  // 页面卸载时不需要特殊处理
  // 未完成的任务会在IndexedDB中保持fileData但没有thumbnail
  // 下次启动时会自动恢复
})
</script>

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
