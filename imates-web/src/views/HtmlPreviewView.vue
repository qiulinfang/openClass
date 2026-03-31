<template>
  <div class="html-preview-container">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <q-btn flat round dense @click="handleGoBack" class="goback-btn">
        <img :src="goBackIcon" alt="返回" class="goback-icon" />
      </q-btn>
      <div class="toolbar-spacer"></div>
      <q-btn
        flat
        dense
        class="toolbar-action-btn"
        label="打印原始"
        @click="printOriginalHtml"
      />
      <q-btn
        flat
        dense
        class="toolbar-action-btn"
        label="打印实时"
        @click="printLiveHtml"
      />
    </div>
    <!-- HTML 内容区域 -->
    <div class="html-content-wrapper">
      <!-- iframe 显示 HTML -->
      <iframe
        v-if="!isLoading && !error && htmlContentUrl"
        ref="iframeRef"
        :src="htmlContentUrl"
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
import { ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMainChatPanel } from '@/composables/useMainChatPanel'
import goBackIcon from '/icons/goback.svg'
import { apiService } from '@/services'
import { enhanceResponsiveHtml } from '@/composables/useHtmlMessageRawMap'
import { getApiPaths, ADDRESS_CATALOG } from '@/config/env-config'

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

const iframeRef = ref<HTMLIFrameElement | null>(null)
const originalHtml = ref<string>('')

const ggbListenerState = ref<{ update: any; currentState: any; diff: any } | null>(null)
const ggbEventLog = ref<Array<{ type: string; ts: number; data: any }>>([])

// HTML内容URL（使用Blob URL）
const htmlBlobUrl = ref<string | null>(null)

const htmlContentUrl = ref<string>('')

watch(
  htmlBlobUrl,
  (next, prev) => {
    if (prev) URL.revokeObjectURL(prev)
    htmlContentUrl.value = next || ''
  },
  { immediate: true },
)

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

const fetchHtmlSourceAndRender = async () => {
  if (!htmlUrl.value) return
  try {
    const htmlData = await apiService.fetchHtmlSource(htmlUrl.value)
    const raw = htmlData?.html || htmlData?.raw_html
    if (!raw) throw new Error('获取 HTML 源码失败')

    const enhanced = enhanceResponsiveHtml(raw)
    originalHtml.value = enhanced
    ggbListenerState.value = null
    ggbEventLog.value = []
    const blob = new Blob([enhanced], { type: 'text/html' })
    htmlBlobUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    console.warn('[HtmlPreview] fetchHtmlSource failed:', e)
    error.value = e instanceof Error ? e.message : '获取HTML源码失败'
  }
}

const onBridgeMessage = (event: MessageEvent) => {
  const data = (event as MessageEvent).data as any
  if (!data || data.source !== 'GGB_LISTENER_BRIDGE') return
  ggbListenerState.value = {
    update: data.update,
    currentState: data.currentState,
    diff: data.diff,
  }

  const diff = data.diff as any
  if (diff && typeof diff === 'object') {
    const types = ['add', 'remove', 'update']
    for (const t of types) {
      const arr = diff[t]
      if (!Array.isArray(arr) || arr.length === 0) continue
      for (const ev of arr) {
        if (!ev || typeof ev !== 'object') continue
        if (typeof ev.type === 'string' && typeof ev.ts === 'number') {
          ggbEventLog.value.push({ type: ev.type, ts: ev.ts, data: ev.data })
        } else {
          ggbEventLog.value.push({ type: t, ts: Date.now(), data: ev })
        }
      }
    }

    const MAX_LOG = 5000
    if (ggbEventLog.value.length > MAX_LOG) {
      ggbEventLog.value.splice(0, ggbEventLog.value.length - MAX_LOG)
    }
  }
}

const printOriginalHtml = () => {
  if (!originalHtml.value) {
    console.warn('[HtmlPreview] originalHtml is empty')
    return
  }
  console.log('[HtmlPreview][original]', {
    type: 'html',
    value: htmlUrl.value,
    html: originalHtml.value,
  })
}

const printLiveHtml = async () => {
  const iframe = iframeRef.value
  if (!iframe) {
    console.warn('[HtmlPreview] iframe not ready')
    return
  }

  try {
    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    const html = doc?.documentElement?.outerHTML
    if (!html) {
      console.warn('[HtmlPreview] live html is empty or inaccessible')
      return
    }

    const canvasSnapshots = (() => {
      try {
        const canvases = Array.from(doc?.querySelectorAll('canvas') || []) as HTMLCanvasElement[]
        return canvases.map((c, idx) => {
          try {
            const dataUrl = c.toDataURL('image/png')
            return { index: idx, width: c.width, height: c.height, dataUrl, error: null }
          } catch (e) {
            return {
              index: idx,
              width: c.width,
              height: c.height,
              dataUrl: null,
              error: e instanceof Error ? e.message : String(e),
            }
          }
        })
      } catch (e) {
        return [{ index: -1, width: 0, height: 0, dataUrl: null, error: e instanceof Error ? e.message : String(e) }]
      }
    })()

    const screenshotDataUrl = canvasSnapshots?.find((s) => typeof s?.dataUrl === 'string')?.dataUrl || null
    const screenshot = screenshotDataUrl
      ? await (async () => {
          try {
            const path = await apiService.uploadImageToYanban(screenshotDataUrl)
            // 根据环境拼接完整可访问 URL
            const apiPaths = getApiPaths()
            const isTest = apiPaths.yanban.teacher.uploadImg.includes('/yb-test/')
            const baseUrl = isTest ? 'https://43.138.16.5:50013' : 'https://www.imates.com.cn'
            return path.startsWith('http') ? path : `${baseUrl}${path}`
          } catch (e) {
            console.warn('[HtmlPreview][live] screenshot upload failed:', e)
            return null
          }
        })()
      : null

    console.log('[HtmlPreview][live][focus]', {
      type: 'html',
      value: htmlUrl.value,
      change: ggbEventLog.value,
      screenshot,
    })
  } catch (e) {
    console.warn('[HtmlPreview] 无法读取 iframe 实时 HTML（可能跨域或 sandbox 限制）:', e)
  }
}

// 重试加载
const retry = () => {
  loadHtmlContent()
  fetchHtmlSourceAndRender()
}

// 生命周期
onMounted(() => {
  loadHtmlContent()
  fetchHtmlSourceAndRender()
  window.addEventListener('message', onBridgeMessage)
})

onBeforeUnmount(() => {
  if (htmlBlobUrl.value) URL.revokeObjectURL(htmlBlobUrl.value)
  window.removeEventListener('message', onBridgeMessage)
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
  justify-content: space-between;
  padding: 8px 16px;
  background: #0A0020;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.goback-icon {
  width: 24px;
  height: 24px;
  display: block;
}

.toolbar-title {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.toolbar-spacer {
  width: 80px; /* 与返回按钮宽度保持一致 */
}

.toolbar-action-btn {
  color: #ffffff;
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
