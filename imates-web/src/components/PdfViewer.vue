<template>
  <div class="pdf-viewer-container">
    <q-virtual-scroll
      :items="pageLayouts"
      virtual-scroll-item-size="800"
      virtual-scroll-slice-size="5"
      virtual-scroll-slice-ratio-before="2"
      virtual-scroll-slice-ratio-after="2"
      class="virtual-scroll"
      v-slot="{ item }"
    >
      <PdfPage 
        :layout="item" 
        :key="item.pageNum" 
        class="pdf-page-item"
      />
    </q-virtual-scroll>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-state text-center q-pa-xl">
        <q-spinner-dots size="50px" color="primary" />
        <div class="q-mt-md">正在加载PDF...</div>
        <div v-if="renderProgress.current > 0" class="q-mt-sm">
          进度: {{ renderProgress.current }} / {{ renderProgress.total }}
        </div>
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
    
    <!-- 空状态 -->
    <div v-if="!isLoading && !error && pageLayouts.length === 0" class="empty-state">
      <div class="empty-content text-center q-pa-xl">
        <q-icon name="picture_as_pdf" size="80px" color="grey-5" />
        <div class="q-mt-md text-h6 text-grey-6">暂无PDF文档</div>
        <div class="q-mt-sm text-caption text-grey-5">
          请选择或加载PDF文件开始查看
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import PdfPage from '@/components/PdfPage.vue'

// 使用 Store
const store = usePdfViewerStore()

// 组件状态
const renderProgress = ref({
  current: 0,
  total: 0
})

// 计算属性
const pageLayouts = computed(() => store.pageLayouts)
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)

// 方法
const retry = () => {
  // 这里可以重新触发加载逻辑
  // 具体实现取决于如何获取文件
  console.log('重试加载PDF')
}
</script>

<style scoped>
.pdf-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.virtual-scroll {
  height: 100%;
  width: 100%;
}

.pdf-page-item {
  display: flex;
  justify-content: center;
  padding: 10px 0;
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
  .pdf-page-item {
    padding: 5px 0;
  }
  
  .loading-state,
  .error-state {
    margin: 16px;
    max-width: calc(100% - 32px);
  }
}
</style>
