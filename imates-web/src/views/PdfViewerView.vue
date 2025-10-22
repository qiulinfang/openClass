<template>
  <q-layout view="lHh Lpr lFf">
    <!-- 工具栏 -->
    <Toolbar />
    
    <!-- 主内容区域 -->
    <q-page-container>
      <div class="pdf-viewer-container">
        <!-- PDF查看器 -->
        <PdfViewer v-if="!isLoading && !error" />
        
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-overlay">
          <div class="loading-state text-center q-pa-xl">
            <q-spinner-dots size="50px" color="primary" />
            <div class="q-mt-md">正在加载PDF...</div>
            <div class="q-mt-sm text-caption">
              支持文本选择、注释工具和自动保存
            </div>
          </div>
        </div>
        
        <!-- 错误状态 -->
        <div v-if="error" class="error-overlay">
          <div class="error-state text-center q-pa-xl">
            <q-icon name="error" size="50px" color="negative" />
            <div class="q-mt-md">{{ error }}</div>
            <div class="q-mt-sm text-caption">
              请检查文件是否损坏或网络连接是否正常
            </div>
            <q-btn color="primary" @click="retry" class="q-mt-md">重试</q-btn>
          </div>
        </div>
      </div>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { resourceManager } from '@/services/resource-manager'
import type { UserTextbookInfo, LocalFileInfo } from '@/types'
import Toolbar from '@/components/Toolbar.vue'
import PdfViewer from '@/components/PdfViewer.vue'

// 使用 Store 和路由
const store = usePdfViewerStore()
const route = useRoute()

// 计算属性
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)

// 从路由参数加载文件
const loadFileFromRoute = async () => {
  try {
    // 从路由 query 参数获取文件信息（LearningView 传递的是 query 参数）
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    console.log('从路由加载文件:', { resourceId, id })

    if (!resourceId || !id) {
      throw new Error('缺少必要的路由参数: resourceId 和 id')
    }
    
    console.log('从路由加载文件:', { resourceId, id })
    
    // 1. 根据 id 从 IndexedDB 获取教材信息（使用主键查询）
    const textbook = await resourceManager.indexedDB.get('textbooks', id) as UserTextbookInfo
    if (!textbook) {
      throw new Error(`教材 ${id} 不存在`)
    }
    
    console.log('找到教材:', textbook)
    
    // 2. 在教材的 localFiles 中查找对应的文件
    let fileData: Uint8Array | null = null
    let fileName = 'unknown.pdf'
    
    if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
      const localFile = textbook.localFiles.find((file: LocalFileInfo) => file.id === resourceId)
      if (localFile && localFile.fileData) {
        fileData = localFile.fileData
        fileName = localFile.fileName || fileName
        console.log('找到本地文件:', { fileName, fileSize: fileData.length })
      }
    }
    
    // 3. 如果没有找到本地文件，尝试从服务器下载
    if (!fileData) {
      console.log('本地文件不存在，尝试从服务器下载...')
      const downloadUrl = await resourceManager.getResourceDownloadUrl(resourceId)
      if (downloadUrl) {
        // 这里可以实现下载逻辑，暂时抛出错误提示用户
        throw new Error('文件未下载到本地，请先在资源管理页面下载该文件')
      } else {
        throw new Error('无法获取文件下载链接')
      }
    }
    
    // 4. 将 Uint8Array 转换为 File 对象
    const file = new File([fileData.buffer as ArrayBuffer], fileName, { type: 'application/pdf' })
    
    // 5. 设置当前文件信息到Store
    store.setCurrentFileInfo(id, resourceId)
    
    console.log('文件加载成功:', { fileName, size: file.size })
    return file
    
  } catch (err) {
    console.error('从路由加载文件失败:', err)
    throw err
  }
}

// 重试加载
const retry = async () => {
  try {
    const file = await loadFileFromRoute()
    await store.loadPdf(file)
  } catch (err) {
    console.error('重试加载失败:', err)
  }
}

// 生命周期
onMounted(async () => {
  try {
    const file = await loadFileFromRoute()
    await store.loadPdf(file)
  } catch (err) {
    console.error('PDF 加载失败:', err)
  }
})
</script>

<style scoped>
.pdf-viewer-container {
  width: 100%;
  height: calc(100vh - 120px); /* 减去工具栏高度 */
  position: relative;
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

/* 响应式设计 */
@media (max-width: 768px) {
  .pdf-viewer-container {
    height: calc(100vh - 100px);
  }
  
  .loading-state,
  .error-state {
    margin: 16px;
    max-width: calc(100% - 32px);
  }
}
</style>