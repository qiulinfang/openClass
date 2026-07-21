<template>
  <div class="ggb-viewer-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <q-btn
        flat
        round
        dense
        color="white"
        icon="arrow_back"
        @click="handleGoBack"
        class="back-button"
      />
      <div class="title-text">{{ fileName || 'GeoGebra 查看器' }}</div>
    </div>

    <!-- 内容区域 -->
    <div class="ggb-content-wrapper">
      <!-- GeoGebra 容器 -->
      <div id="ggb-applet-container" class="ggb-applet-container"></div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-state text-center q-pa-xl">
          <q-spinner-dots size="50px" color="primary" />
          <div class="q-mt-md">正在载入 GeoGebra 引擎...</div>
          <div class="q-mt-sm text-caption">请稍候</div>
        </div>
      </div>

      <!-- 错误状态 -->
      <div v-if="error" class="error-overlay">
        <div class="error-state text-center q-pa-xl">
          <q-icon name="error" size="50px" color="negative" />
          <div class="q-mt-md">{{ error }}</div>
          <div class="q-mt-sm text-caption">请检查 GeoGebra 脚本加载是否正常</div>
          <q-btn color="primary" @click="loadGgb" class="q-mt-md">重试</q-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resourceManager } from '@/services/storage/resource-storage'
import type { UserTextbookInfo } from '@/types'

// 声明全局变量类型
declare global {
  interface Window {
    GGBApplet: any
  }
}

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const error = ref<string | null>(null)
const fileName = ref<string>((route.query.fileName as string) || '导函数与原函数')

const handleGoBack = () => {
  // 检查是否从学习页面跳转（通过检查路由参数中是否有 fromLearning）
  const fromLearning = route.query.fromLearning === 'true'

  if (fromLearning) {
    // 从学习页面跳转来的，返回到知识图谱页面，并传递学习对话框所需的信息
    router.push({
      name: 'knowledgeGraph',
      query: {
        // 传递学习对话框所需的信息，用于自动打开对话框
        openLearning: 'true',
        learningNodeId: route.query.learningNodeId as string,
        learningSectionName: (route.query.sectionName as string) || (route.query.textbookName as string),
        learningLevel: route.query.learningLevel as string,
        textbookId: route.query.id as string,
        // 添加章节信息传递，确保返回后微课按钮能正常显示
        learningChapterGrade: route.query.chapterGrade as string,
        learningChapterSubject: route.query.chapterSubject as string,
        learningChapterTextbook: route.query.chapterTextbook as string,
        learningChapterTitle: route.query.chapterTitle as string,
      },
    })
  } else {
    // 其他情况，使用默认的返回行为
    router.back()
  }
}

// 动态加载本地 GeoGebra deploy 脚本
const loadGgbScript = () => {
  return new Promise<void>((resolve, reject) => {
    if (window.GGBApplet) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = './deployggb.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = (err) => reject(err)
    document.body.appendChild(script)
  })
}

// 将 Uint8Array 转为 Base64 String
const uint8ToBase64 = (uint8: Uint8Array): string => {
  let binary = ''
  const len = uint8.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i])
  }
  return window.btoa(binary)
}

// 加载文件与初始化 GeoGebra
const loadGgb = async () => {
  isLoading.value = true
  error.value = null

  try {
    // 1. 动态加载 deployggb 脚本
    await loadGgbScript()

    // 2. 尝试从路由加载本地文件数据
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    let ggbBase64: string | undefined = undefined

    if (resourceId && id) {
      const textbook = (await resourceManager.indexedDB.get('textbooks', id)) as UserTextbookInfo
      if (textbook && textbook.localFiles) {
        const fileData = await resourceManager.getFileData(id, resourceId)
        if (fileData) {
          ggbBase64 = uint8ToBase64(fileData)
        }
      }
    }

    // 3. 构建参数并注入 GeoGebra
    const params: any = {
      id: 'ggbApplet',
      width: 1200,
      height: 750,
      enableResize: true,
      allowUpscale: true,
      showToolBar: true,
      showMenuBar: true,
      showAlgebraInput: true,
      showResetIcon: true,
      enableLabelDrags: false,
      enableShiftDragZoom: true,
      enableRightClick: false,
      appName: 'classic',
      useBrowserForJS: false,
      scaleContainerClass: 'ggb-applet-container',
    }

    if (ggbBase64) {
      params.ggbBase64 = ggbBase64
    } else {
      // 默认测试加载服务根目录下的 004_导函数与原函数.ggb
      params.filename = '/004_导函数与原函数.ggb'
    }

    const applet = new window.GGBApplet(params, '5.0', 'ggb-applet-container')
    applet.inject('ggb-applet-container')
  } catch (err) {
    console.error('加载 GeoGebra 失败:', err)
    error.value = 'GeoGebra 引擎加载失败，请检查网络后重试。'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadGgb()
})
</script>

<style scoped>
.ggb-viewer-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #0a0020;
}

.toolbar {
  height: 50px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background-color: #0a0020;
}

.back-button {
  margin-right: 16px;
}

.title-text {
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
}

.ggb-content-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  padding: 16px;
}

.ggb-applet-container {
  width: 1200px;
  height: 750px;
  max-width: 100%;
  max-height: 100%;
  background-color: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  overflow: hidden;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}
</style>
