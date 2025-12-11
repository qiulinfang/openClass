<template>
  <!-- HTML内容区域 -->
  <div class="html-viewer-container">
    <!-- 简单的返回按钮 -->
    <div class="toolbar">
      <q-btn
        flat
        round
        dense
        icon="arrow_back"
        @click="handleGoBack"
        class="back-button"
      />
    </div>
    
    <!-- HTML内容区域 -->
    <div class="html-content-wrapper">
      <!-- iframe 显示 HTML -->
      <iframe
        v-if="!isLoading && !error && htmlContent"
        :src="htmlContentUrl"
        class="html-iframe"
        frameborder="0"
        allowfullscreen
      />
      
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-state text-center q-pa-xl">
          <q-spinner-dots size="50px" color="primary" />
          <div class="q-mt-md">正在加载HTML...</div>
          <div class="q-mt-sm text-caption">请稍候</div>
        </div>
      </div>
      
      <!-- 错误状态 -->
      <div v-if="error" class="error-overlay">
        <div class="error-state text-center q-pa-xl">
          <q-icon name="error" size="50px" color="negative" />
          <div class="q-mt-md">{{ error }}</div>
          <div class="q-mt-sm text-caption">请检查文件是否损坏或网络连接是否正常</div>
          <q-btn color="primary" @click="retry" class="q-mt-md">重试</q-btn>
        </div>
      </div>
      
      <!-- 空状态 -->
      <div v-if="!isLoading && !error && !htmlContent" class="empty-state">
        <div class="empty-content text-center q-pa-xl">
          <q-icon name="description" size="80px" color="grey-5" />
          <div class="q-mt-md text-h6 text-grey-6">暂无HTML文档</div>
          <div class="q-mt-sm text-caption text-grey-5">请选择或加载HTML文件开始查看</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resourceManager } from '@/services/storage/resource-storage'
import type { UserTextbookInfo, LocalFileInfo } from '@/types'

// 使用路由
const route = useRoute()
const router = useRouter()

// 组件状态
const isLoading = ref(false)
const error = ref<string | null>(null)
const htmlContent = ref<string | null>(null)

// HTML内容URL（使用Blob URL）
const htmlBlobUrl = ref<string | null>(null)

// 监听 htmlContent 变化，清理旧的 Blob URL
watch(htmlContent, (newContent, oldContent) => {
  if (oldContent && htmlBlobUrl.value) {
    URL.revokeObjectURL(htmlBlobUrl.value)
    htmlBlobUrl.value = null
  }
  
  if (newContent) {
    const blob = new Blob([newContent], { type: 'text/html' })
    htmlBlobUrl.value = URL.createObjectURL(blob)
  }
}, { immediate: true })

const htmlContentUrl = computed(() => {
  return htmlBlobUrl.value || ''
})

// 处理返回
const handleGoBack = () => {
  router.back()
}

// 从路由参数加载文件
const loadFileFromRoute = async () => {
  try {
    // 从路由 query 参数获取文件信息
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    if (!resourceId || !id) {
      throw new Error('缺少必要的路由参数: resourceId 和 id')
    }

    // 1. 根据 id 从 IndexedDB 获取教材信息
    const textbook = (await resourceManager.indexedDB.get('textbooks', id)) as UserTextbookInfo
    if (!textbook) {
      throw new Error(`教材 ${id} 不存在`)
    }
    // 2. 在教材的 localFiles 中查找对应的文件元数据
    let fileData: Uint8Array | null = null

    if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
      const localFile = textbook.localFiles.find((file: LocalFileInfo) => file.id === resourceId)
      if (localFile) {
        // 从textbook_files表按需读取文件数据
        fileData = await resourceManager.getFileData(id, resourceId)
      }
    }

    // 3. 如果没有找到本地文件，提示用户先下载
    if (!fileData) {
      throw new Error('文件未下载到本地，请先在资源管理页面下载该文件')
    }

    // 4. 将 Uint8Array 转换为字符串（HTML内容）
    const decoder = new TextDecoder('utf-8')
    const htmlText = decoder.decode(fileData)
    return htmlText
  } catch (err) {
    console.error('[HtmlViewer] 从路由加载文件失败:', err)
    throw err
  }
}

// 重试加载
const retry = async () => {
  isLoading.value = true
  error.value = null
  htmlContent.value = null
  
  try {
    const htmlText = await loadFileFromRoute()
    htmlContent.value = htmlText
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载HTML文件失败'
  } finally {
    isLoading.value = false
  }
}

// 生命周期
onMounted(async () => {
  isLoading.value = true
  
  try {
    const htmlText = await loadFileFromRoute()
    htmlContent.value = htmlText
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载HTML文件失败'
  } finally {
    isLoading.value = false
  }
})

// 清理资源
onBeforeUnmount(() => {
  if (htmlBlobUrl.value) {
    URL.revokeObjectURL(htmlBlobUrl.value)
  }
})
</script>

<style scoped>
.html-viewer-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100vh;
  width: 100%;
}

.toolbar {
  flex-shrink: 0;
  padding: 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.back-button {
  color: #666;
}

.html-content-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.html-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-state,
.error-state {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}

.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 300px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .loading-state,
  .error-state {
    margin: 16px;
    max-width: calc(100% - 32px);
  }
}
</style>
