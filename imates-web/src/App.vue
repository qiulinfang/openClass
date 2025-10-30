<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import ImagePicker from './components/chat/ImagePicker.vue'
// 注释掉缩略图相关导入以提升性能
// import { thumbnailQueue } from './utils/thumbnail-queue'

onMounted(() => {
  // 注释掉缩略图恢复逻辑以提升性能
  /*
  // 第1步：延迟恢复缩略图任务，避免阻塞应用启动
  setTimeout(() => {
    // 第2步：恢复被打断的缩略图生成任务
    thumbnailQueue.recoverPendingTasks()
  }, 2000) // 等待2秒，让应用完全启动
  */
})

onBeforeUnmount(() => {
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
  </q-app>
</template>
