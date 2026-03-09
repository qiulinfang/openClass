<template>
  <!-- 视频内容区域 -->
  <div class="video-viewer-container">
    <q-btn flat round dense @click="handleGoBack" class="goback-btn">
      <img :src="goBackIcon" alt="返回" class="goback-icon" />
    </q-btn>

    <div class="video-content-wrapper full-height">
      <!-- 视频播放器 -->
      <video
        v-if="!error && videoUrl"
        ref="videoPlayer"
        :src="videoUrl"
        class="video-player"
        controls
        preload="metadata"
        @loadstart="handleVideoLoadStart"
        @loadedmetadata="handleVideoLoadedMetadata"
        @canplay="handleVideoCanPlay"
        @waiting="handleVideoWaiting"
        @stalled="handleVideoStalled"
        @loadeddata="handleVideoLoaded"
        @error="handleVideoError"
      >
        您的浏览器不支持视频播放
      </video>
      
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-state text-center q-pa-xl">
          <q-spinner-dots size="50px" color="primary" />
          <div class="q-mt-md">正在加载视频...</div>
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
      <div v-if="!isLoading && !error && !videoUrl" class="empty-state">
        <div class="empty-content text-center q-pa-xl">
          <q-icon name="play_circle" size="80px" color="grey-5" />
          <div class="q-mt-md text-h6 text-grey-6">暂无视频文件</div>
          <div class="q-mt-sm text-caption text-grey-5">请选择或加载视频文件开始播放</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resourceManager } from '@/services/storage/resource-storage'
import type { UserTextbookInfo, LocalFileInfo } from '@/types'

// 使用路由
const route = useRoute()
const router = useRouter()

import goBackIcon from '/icons/goback.svg'

// 组件状态
const isLoading = ref(false)
const error = ref<string | null>(null)
const videoUrl = ref<string | null>(null)
const fileName = ref('')
const videoPlayer = ref<HTMLVideoElement | null>(null)

// 处理返回
const handleGoBack = () => {
  router.back()
}

// 视频加载事件
const handleVideoLoadStart = () => {
  isLoading.value = true
  error.value = null
  console.log('[VideoViewer] video loadstart', {
    hasVideoUrl: Boolean(videoUrl.value),
    videoUrl: videoUrl.value,
  })
}

const handleVideoLoadedMetadata = (e: Event) => {
  const el = e.target as HTMLVideoElement | null
  console.log('[VideoViewer] video loadedmetadata', {
    readyState: el?.readyState,
    duration: el?.duration,
    videoWidth: el?.videoWidth,
    videoHeight: el?.videoHeight,
  })
}

const handleVideoCanPlay = (e: Event) => {
  const el = e.target as HTMLVideoElement | null
  console.log('[VideoViewer] video canplay', {
    readyState: el?.readyState,
    currentTime: el?.currentTime,
  })
}

const handleVideoWaiting = (e: Event) => {
  const el = e.target as HTMLVideoElement | null
  console.warn('[VideoViewer] video waiting', {
    readyState: el?.readyState,
    currentTime: el?.currentTime,
    networkState: el?.networkState,
  })
}

const handleVideoStalled = (e: Event) => {
  const el = e.target as HTMLVideoElement | null
  console.warn('[VideoViewer] video stalled', {
    readyState: el?.readyState,
    currentTime: el?.currentTime,
    networkState: el?.networkState,
  })
}

const handleVideoLoaded = (e: Event) => {
  isLoading.value = false
  const el = e.target as HTMLVideoElement | null
  console.log('[VideoViewer] video loadeddata', {
    readyState: el?.readyState,
    currentTime: el?.currentTime,
  })
}

const handleVideoError = (e: Event) => {
  isLoading.value = false
  error.value = '视频加载失败，可能文件已损坏'
  const el = e.target as HTMLVideoElement | null
  console.error('[VideoViewer] video error', {
    event: e,
    error: (el as any)?.error,
    readyState: el?.readyState,
    networkState: el?.networkState,
    currentSrc: el?.currentSrc,
  })
}

// 从路由参数加载文件
const loadFileFromRoute = async () => {
  try {
    // 从路由 query 参数获取文件信息
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    console.log('[VideoViewer] loadFileFromRoute route query', {
      resourceId,
      id,
      fullQuery: route.query,
    })
    if (!resourceId || !id) {
      throw new Error('缺少必要的路由参数: resourceId 和 id')
    }

    // 1. 根据 id 从 IndexedDB 获取教材信息
    const textbook = (await resourceManager.indexedDB.get('textbooks', id)) as UserTextbookInfo
    console.log('[VideoViewer] IndexedDB get textbooks', {
      id,
      found: Boolean(textbook),
      textbookId: (textbook as any)?.textbookId,
      textbookName: (textbook as any)?.textbookName,
      localFilesCount: Array.isArray((textbook as any)?.localFiles)
        ? (textbook as any)?.localFiles?.length
        : undefined,
    })
    if (!textbook) {
      throw new Error(`教材 ${id} 不存在`)
    }
    // 2. 在教材的 localFiles 中查找对应的文件元数据
    let fileData: Uint8Array | null = null

    if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
      const localFile = textbook.localFiles.find((file: LocalFileInfo) => file.id === resourceId)
      console.log('[VideoViewer] find localFile in textbook.localFiles', {
        resourceId,
        found: Boolean(localFile),
        fileName: localFile?.fileName,
        fileId: localFile?.id,
      })
      if (localFile) {
        fileName.value = localFile.fileName || 'unknown.mp4'
        // 从textbook_files表按需读取文件数据
        fileData = await resourceManager.getFileData(id, resourceId)
        console.log('[VideoViewer] resourceManager.getFileData result', {
          hasFileData: Boolean(fileData),
          byteLength: fileData?.byteLength,
          id,
          resourceId,
        })
        if (fileData) {
        }
      }
    }

    // 3. 如果没有找到本地文件，提示用户先下载
    if (!fileData) {
      throw new Error('文件未下载到本地，请先在资源管理页面下载该文件')
    }

    // 4. 将 Uint8Array 转换为 Blob URL
    const blob = new Blob([fileData.buffer as ArrayBuffer], { type: 'video/mp4' })
    console.log('[VideoViewer] create Blob', {
      blobType: blob.type,
      blobSize: blob.size,
      byteLength: fileData.byteLength,
      fileName: fileName.value,
    })
    const url = URL.createObjectURL(blob)
    console.log('[VideoViewer] createObjectURL', {
      url,
    })
    return url
  } catch (err) {
    console.error('[VideoViewer] 从路由加载文件失败:', err)
    throw err
  }
}

// 重试加载
const retry = async () => {
  isLoading.value = true
  error.value = null
  console.log('[VideoViewer] retry')
  
  // 清理旧的URL
  if (videoUrl.value) {
    console.log('[VideoViewer] revokeObjectURL before retry', {
      videoUrl: videoUrl.value,
    })
    URL.revokeObjectURL(videoUrl.value)
    videoUrl.value = null
  }
  
  try {
    const url = await loadFileFromRoute()
    videoUrl.value = url
    console.log('[VideoViewer] retry success set videoUrl', {
      videoUrl: url,
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载视频文件失败'
    console.error('[VideoViewer] retry failed', err)
  } finally {
    isLoading.value = false
  }
}

// 生命周期
onMounted(async () => {
  isLoading.value = true
  console.log('[VideoViewer] mounted start')
  
  try {
    const url = await loadFileFromRoute()
    videoUrl.value = url
    console.log('[VideoViewer] mounted set videoUrl', {
      videoUrl: url,
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载视频文件失败'
    console.error('[VideoViewer] mounted load failed', err)
  } finally {
    isLoading.value = false
    console.log('[VideoViewer] mounted end', {
      isLoading: isLoading.value,
      hasError: Boolean(error.value),
      hasVideoUrl: Boolean(videoUrl.value),
    })
  }
})

// 清理资源
onBeforeUnmount(() => {
  if (videoUrl.value) {
    console.log('[VideoViewer] before unmount revokeObjectURL', {
      videoUrl: videoUrl.value,
    })
    URL.revokeObjectURL(videoUrl.value)
  }
})
</script>

<style scoped>
.video-viewer-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100vh;
  width: 100%;
}

/* 返回按钮样式 */
.goback-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2000;
  padding: 8px;
}

.goback-icon {
  width: 24px;
  height: 24px;
  display: block;
}

.full-height {
  height: 100%;
  width: 100%;
}

.video-content-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.video-player {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
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
