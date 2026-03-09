<template>
  <div class="html-preview-container">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <button class="back-button" @click="handleGoBack">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        返回
      </button>
      <div class="toolbar-title">HTML 预览</div>
      <div class="toolbar-spacer"></div>
    </div>
    <!-- HTML 内容区域 -->
    <div class="html-content-wrapper">
      <!-- iframe 显示 HTML -->
      <iframe
        v-if="!isLoading && !error && htmlUrl"
        :src="htmlUrl"
        class="html-iframe"
        frameborder="0"
        allowfullscreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerpolicy="no-referrer"
        loading="lazy"
      />
      
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-state">
          <div class="spinner"></div>
          <div class="loading-text">正在加载HTML...</div>
        </div>
      </div>
      
      <!-- 错误状态 -->
      <div v-if="error" class="error-overlay">
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <div class="error-text">{{ error }}</div>
          <button class="retry-button" @click="retry">重试</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMainChatPanel } from '@/composables/useMainChatPanel'

// 使用路由
const route = useRoute()
const router = useRouter()

// 使用 MainChatPanel 控制
const { showMainChatPanel } = useMainChatPanel()

// 组件状态
const isLoading = ref(true)
const error = ref<string | null>(null)

// 从路由参数获取 HTML URL
const htmlUrl = ref<string>('')

// 处理返回
const handleGoBack = () => {
  // 路由返回
  router.back()
  // 打开 MainChatPanel
  showMainChatPanel()
}

// 加载 HTML 内容
const loadHtmlContent = () => {
  try {
    isLoading.value = true
    error.value = null
    
    // 从路由 query 参数获取 URL
    const url = route.query.url as string
    if (!url) {
      throw new Error('缺少 URL 参数')
    }
    
    // 验证 URL 格式
    if (!url.startsWith('https://kelvin-cosin.cloud/')) {
      throw new Error('无效的 HTML URL')
    }
    
    htmlUrl.value = url
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载HTML失败'
  } finally {
    isLoading.value = false
  }
}

// 重试加载
const retry = () => {
  loadHtmlContent()
}

// 生命周期
onMounted(() => {
  loadHtmlContent()
})
</script>

<style scoped>
.html-preview-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100vh;
  width: 100%;
  background: #f8f9fa;
}

.toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-button:hover {
  background: #f5f5f5;
  border-color: #b0b0b0;
}

.toolbar-title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.toolbar-spacer {
  width: 80px; /* 与返回按钮宽度保持一致 */
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
  background: #fff;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-state,
.error-state {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 32px;
  text-align: center;
  max-width: 400px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #666;
  font-size: 14px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-text {
  color: #333;
  font-size: 16px;
  margin-bottom: 20px;
  line-height: 1.5;
}

.retry-button {
  padding: 10px 20px;
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-button:hover {
  background: #1565c0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar {
    padding: 8px 12px;
  }
  
  .back-button {
    padding: 6px 10px;
    font-size: 13px;
  }
  
  .toolbar-title {
    font-size: 15px;
  }
  
  .loading-state,
  .error-state {
    margin: 16px;
    padding: 24px;
    max-width: calc(100% - 32px);
  }
}

@media (max-width: 480px) {
  .toolbar {
    padding: 6px 8px;
  }
  
  .back-button {
    padding: 4px 8px;
    font-size: 12px;
  }
  
  .toolbar-title {
    font-size: 14px;
  }
  
  .toolbar-spacer {
    width: 60px;
  }
}
</style>
