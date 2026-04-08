
<template>
  <div class="learning-content-view">
    <!-- 根据文件类型动态加载不同的查看器 -->
    <PdfViewerView v-if="viewerType === 'pdf'" />
    <HtmlViewerView v-else-if="viewerType === 'html'" />
    <VideoViewerView v-else-if="viewerType === 'video'" />
    
    <!-- 不支持的文件类型 -->
    <div v-else class="unsupported-viewer">
      <div class="unsupported-content">
        <q-icon name="error_outline" size="80px" color="grey-5" />
        <div class="q-mt-md text-h6 text-grey-6">不支持的文件类型</div>
        <div class="q-mt-sm text-caption text-grey-5">
          当前文件类型（{{ fileExtension }}）暂不支持预览
        </div>
        <div class="q-mt-md text-body2 text-grey-6">
          文件名：{{ fileName }}
        </div>
        <q-btn
          color="primary"
          label="返回"
          @click="handleGoBack"
          class="q-mt-lg"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 定义组件名称，便于 keep-alive 缓存和 Vue DevTools 识别
defineOptions({
  name: 'learningContent'
})

import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PdfViewerView from './PdfViewerViewZGC.vue'
import HtmlViewerView from './HtmlViewerView.vue'
import VideoViewerView from './VideoViewerView.vue'

const route = useRoute()
const router = useRouter()

// 从路由参数获取文件信息
const fileName = computed(() => (route.query.fileName as string) || '')
const fileExtension = computed(() => {
  const ext = fileName.value.split('.').pop()?.toLowerCase() || ''
  return ext
})

// 根据文件扩展名确定查看器类型
const viewerType = computed(() => {
  const ext = fileExtension.value
  
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'html':
    case 'htm':
      return 'html'
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
    case 'flv':
    case 'webm':
      return 'video'
    default:
      return 'unsupported'
  }
})

// 返回上一页
const handleGoBack = () => {
  // 如果是从学习页面跳转过来的，返回时重新打开学习对话框
  if (route.query.fromLearning === 'true') {
    router.push({
      name: 'learning',
      query: {
        nodeId: route.query.learningNodeId as string,
        sectionName: route.query.textbookName as string,
        textbookId: route.query.id as string,
        level: route.query.learningLevel as string,
      },
    })
  } else {
    // 否则返回上一页
    router.back()
  }
}

onMounted(() => {
  // 页面加载时，确保路由参数正确传递
  // 由于子组件（PdfViewerView等）会从route.query读取参数，这里不需要额外处理
  console.log('LearningContentView mounted', {
    fileName: fileName.value,
    viewerType: viewerType.value,
    query: route.query,
  })
})
</script>

<style lang="scss" scoped>
.learning-content-view {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.unsupported-viewer {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
}

.unsupported-content {
  text-align: center;
  padding: 40px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 500px;
}
</style>
