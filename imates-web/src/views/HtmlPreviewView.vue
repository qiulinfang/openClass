<template>
  <div class="html-preview-view">
    <DualPanel ref="dualPanelRef" v-model="isRightPanelOpen">
      <!-- 左侧内容：HTML 预览 + 工具栏 -->
      <template #left>
        <div class="html-preview-container">
          <!-- 顶部工具栏 -->
          <div class="toolbar">
            <q-btn flat round dense @click="handleGoBack" class="goback-btn">
              <img :src="goBackIcon" alt="返回" class="goback-icon" />
            </q-btn>
            <div class="toolbar-spacer"></div>
            <q-btn v-if="isDev" flat dense class="toolbar-action-btn" label="打印原始" @click="printOriginalHtml" />
            <q-btn v-if="isDev" flat dense class="toolbar-action-btn" label="打印实时" @click="printLiveHtml" />
          </div>
            <div class="html-content-wrapper">
            <!-- iframe 显示 HTML -->
            <iframe v-if="!error && htmlContentUrl" ref="iframeRef" :src="htmlContentUrl"
              class="html-iframe" frameborder="0" allowfullscreen
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer"
              loading="lazy" />

            <HistoryDebugPanel v-if="false" ref="historyDebugRef" :extra-info="`htmlUrl: ${htmlUrl || '-'}`" />

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

          <!-- 悬浮按钮：右侧面板关闭时显示，点击打开 -->
          <button v-if="!isRightPanelOpen" type="button" class="fab-chat"
            :style="{ backgroundImage: `url(${ipNewIcon})` }" @click="isRightPanelOpen = true" title="打开对话"></button>
        </div>
      </template>

      <!-- 右侧内容：聊天面板 -->
      <template #right>
        <div class="right-panel-container no-close-btn">
          <div class="chat-panel-wrapper">
            <!-- PDF/教材场景：使用 HtmlPdfChatPanel -->
            <HtmlPdfChatPanel v-if="chatViewType === 'ai-textbook'" ref="htmlPdfChatPanelRef"
              :show-close-button="true"
              @close="handleCloseChatPanel" @screenshot-click="handleScreenshotClick"
              @open-html-preview="handleOpenHtmlPreviewFromPanel" />
            <!-- 题目练习场景：使用 ExerciseChatPanelNew -->
            <ExerciseChatPanelNew v-else-if="chatViewType === 'ai-exercise'" ref="exerciseChatPanelRef"
              :show-close-button="true"
              @close="handleCloseChatPanel" @screenshot-click="handleScreenshotClick"
              @open-html-preview="handleOpenHtmlPreviewFromPanel" />
            <!-- 通用 AI 场景：使用内嵌式 HtmlMainChatPanel -->
            <HtmlMainChatPanel v-else ref="htmlMainChatPanelRef"
              :show-close-button="true"
              @close="handleCloseChatPanel"
              @open-html-preview="handleOpenHtmlPreviewFromPanel" />
          </div>
        </div>
      </template>
    </DualPanel>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch, type ComponentPublicInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMainChatPanel } from '@/composables/useMainChatPanel'
import { useExerciseChatPanel } from '@/composables/useExerciseChatPanel'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import goBackIcon from '/icons/goback.svg'
import ipNewIcon from '/icons/ip_new.webp'
import { apiService } from '@/services'
import { enhanceResponsiveHtml } from '@/composables/useHtmlMessageRawMap'
import { getApiPaths } from '@/config/env-config'
import DualPanel from '@/components/base/DualPanel.vue'
import HtmlPdfChatPanel from '@/components/chat/chatpanel/HtmlPdfChatPanel.vue'
import HtmlMainChatPanel from '@/components/chat/chatpanel/HtmlMainChatPanel.vue'
import ExerciseChatPanelNew from '@/components/chat/chatpanel/ExerciseChatPanelNew.vue'
import HistoryDebugPanel from '@/components/debug/HistoryDebugPanel.vue'

// 使用路由
const route = useRoute()
const router = useRouter()

// 使用 Store
const pdfViewerStore = usePdfViewerStore()

// 使用 MainChatPanel 控制
const { showMainChatPanel } = useMainChatPanel()

// 使用 ExerciseChatPanel 控制
const { showExerciseChatPanel } = useExerciseChatPanel()

// HtmlPdfChatPanel 引用
const htmlPdfChatPanelRef = ref<ComponentPublicInstance | null>(null)
// HtmlMainChatPanel 引用
const htmlMainChatPanelRef = ref<ComponentPublicInstance | null>(null)
// ExerciseChatPanelNew 引用
const exerciseChatPanelRef = ref<ComponentPublicInstance | null>(null)

// 计算聊天视图类型：from=pdf 使用 ai-textbook，from=exercise 使用 ai-exercise，否则 ai-general
const chatViewType = computed(() => {
  const from = route.query.from as string
  if (from === 'pdf') return 'ai-textbook'
  if (from === 'exercise') return 'ai-exercise'
  return 'ai-general'
})

// DualPanel 引用（新组件无配置 props）
const dualPanelRef = ref<ComponentPublicInstance | null>(null)

// 右侧面板显示状态
const isRightPanelOpen = ref(false)

// 组件状态
const isLoading = ref(true)
const error = ref<string | null>(null)

const lastPanelPreviewOpen = ref<{ url: string; ts: number } | null>(null)
const historyDebugRef = ref<{ addEvent: (type: string, detail: string) => void } | null>(null)

const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

// 从路由参数获取 HTML URL
const htmlUrl = ref<string>('')

const iframeRef = ref<HTMLIFrameElement | null>(null)
const originalHtml = ref<string>('')

const ggbListenerState = ref<{ update: any; currentState: any; diff: any } | null>(null)
const ggbEventLog = ref<Array<{ type: string; ts: number; data: any }>>([])

// HTML内容URL
const htmlContentUrl = ref<string>('')

// HTML内容URL（如果是 Blob 模式，使用此变量并监听）
const htmlBlobUrl = ref<string | null>(null)

watch(
  htmlBlobUrl,
  (next, prev) => {
    if (prev) URL.revokeObjectURL(prev)
    // 只有在非直接 URL 模式下才更新 htmlContentUrl
    if (next) {
      htmlContentUrl.value = next
    }
  },
  { immediate: true },
)

// 处理截图点击（开启/关闭截图工具）
const handleScreenshotClick = () => {
  // 在 HTML 预览页，截图工具切换到 PDF 页面使用
  const from = route.query.from
  if (from === 'pdf') {
    historyDebugRef.value?.addEvent('push:pdfViewer', `from=${String(route.query.from || '')} url=${String(route.query.url || '')}`)
    // 返回 PDF 页面并开启截图工具
    router.push({
      name: 'pdfViewer',
      query: {
        ...route.query,
        screenshot: 'true'
      }
    })
  }
}

// 处理关闭聊天面板 - 隐藏右侧面板
const handleCloseChatPanel = () => {
  isRightPanelOpen.value = false
}

// 处理来自 ChatPanel 的 HTML 预览点击 - 直接刷新 iframe，不操作路由
const handleOpenHtmlPreviewFromPanel = async (payload: { url: string; html?: string }) => {
  console.log('[HtmlPreviewView] handleOpenHtmlPreviewFromPanel 触发:', { 
    url: payload.url, 
    hasHtml: !!payload.html,
    htmlLength: payload.html?.length || 0 
  })
  const { url, html } = payload
  if (!url) return
  const now = Date.now()
  const lastOpen = lastPanelPreviewOpen.value
  if (lastOpen && lastOpen.url === url && now - lastOpen.ts < 800) {
    historyDebugRef.value?.addEvent('dedupe:open-html-preview', url)
    console.log('[HtmlPreviewView] 忽略重复 open-html-preview:', url)
    return
  }
  lastPanelPreviewOpen.value = { url, ts: now }
  historyDebugRef.value?.addEvent('open-html-preview', url)
  htmlUrl.value = url
  if (route.query.url !== url) {
    historyDebugRef.value?.addEvent('replace:htmlPreview', `from=${route.fullPath} -> ${url}`)
    router.replace({
      name: 'htmlPreview',
      query: {
        ...route.query,
        url,
      }
    })
  }

  if (html) {
    // 【核心优化】：如果已经有增强后的 HTML，直接复用
    console.log('[HtmlPreviewView] 复用本地缓存 HTML 内容，跳过 Fetch')
    originalHtml.value = html
    ggbListenerState.value = null
    ggbEventLog.value = []
    const blob = new Blob([html], { type: 'text/html' })
    htmlBlobUrl.value = URL.createObjectURL(blob)
  } else {
    // 只有在没有 HTML 内容时才去 Fetch
    await fetchHtmlSourceAndRender()
  }
}

// 处理返回
const handleGoBack = () => {
  historyDebugRef.value?.addEvent('back', `from=${route.fullPath}`)
  const returnTo = route.query.returnTo as string | undefined
  const reopenPanel = route.query.reopenPanel as string | undefined
  if (returnTo && returnTo !== route.fullPath) {
    if (reopenPanel === 'pdf') {
      pdfViewerStore.openChatPanel()
    } else if (reopenPanel === 'main') {
      showMainChatPanel()
    } else if (reopenPanel === 'exercise') {
      showExerciseChatPanel()
    }
    historyDebugRef.value?.addEvent('returnTo', returnTo)
    router.replace(returnTo)
    return
  }
  router.back()
}

// 加载 HTML 内容
const loadHtmlContent = () => {
  const urlFromQuery = route.query.url as string
  console.log('[HtmlPreviewView] loadHtmlContent 启动:', { 
    queryUrl: urlFromQuery,
    currentHtmlUrl: htmlUrl.value,
    hasOriginalHtml: !!originalHtml.value
  })
  try {
    isLoading.value = true
    error.value = null

    // 检查是否有直接从 sessionStorage 传入的 HTML 内容
    const inlineHtml = sessionStorage.getItem('htmlPreview_inlineContent')
    const url = route.query.url as string

    if (inlineHtml) {
      console.log('[HtmlPreviewView] 发现 sessionStorage 缓存内容，执行秒开渲染')
      originalHtml.value = inlineHtml
      const blob = new Blob([inlineHtml], { type: 'text/html' })
      htmlBlobUrl.value = URL.createObjectURL(blob)
      isLoading.value = false
      if (url) htmlUrl.value = url
      // 清除 sessionStorage 中的内容，防止刷新时重复
      sessionStorage.removeItem('htmlPreview_inlineContent')
      return
    }

    // 从路由 query 参数获取 URL
    if (!url) {
      throw new Error('缺少 URL 参数')
    }

    // 验证 URL 格式 (允许本地域名、微软预览服务、生产环境域名及本地开发环境)
    const isAllowedUrl = url.startsWith('https://kelvin-cosin.cloud/') || 
                        url.startsWith('https://view.officeapps.live.com/') ||
                        url.startsWith('https://www.imates.com.cn/') ||
                        url.startsWith('blob:') ||
                        (import.meta.env.DEV && (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')))
    
    if (!isAllowedUrl) {
      // 【优化】：如果已经有缓存的内容（秒开场景），允许继续渲染
      if (originalHtml.value && htmlUrl.value === url) {
        console.log('[HtmlPreviewView] 允许未匹配白名单但已有缓存内容的 URL:', url)
      } else {
        console.warn('[HtmlPreviewView] 无效的 HTML URL:', url)
        throw new Error('无效的 HTML URL')
      }
    }

    htmlUrl.value = url

    // 如果是微软预览 URL，直接将其设置为 iframe 的 src
    if (url.startsWith('https://view.officeapps.live.com/')) {
      htmlContentUrl.value = url
      isLoading.value = false
      return
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载HTML失败'
  } finally {
    isLoading.value = false
  }
}

const fetchHtmlSourceAndRender = async () => {
  if (!htmlUrl.value) return

  // 【核心优化】：如果已经有 HTML 内容（秒开场景），跳过 Fetch
  if (originalHtml.value) {
    console.log('[HtmlPreviewView] 已经存在 HTML 内容，跳过 Fetch')
    return
  }

  // 如果是微软预览 URL，跳过源码抓取，因为它直接在 iframe 加载
  if (htmlUrl.value.startsWith('https://view.officeapps.live.com/')) {
    return
  }
  try {
    const htmlData = await apiService.fetchHtmlSource(htmlUrl.value)
    console.log('[HtmlPreviewView] fetchHtmlSource 响应:', { 
      success: !!htmlData,
      title: htmlData?.title,
      htmlLength: (htmlData?.html || htmlData?.raw_html)?.length || 0 
    })
    // 直接使用后端已经增强过的 html
    const enhanced = htmlData?.html || htmlData?.raw_html
    if (!enhanced) throw new Error('获取 HTML 源码失败')

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

type HtmlPreviewFocus = {
  type: 'html'
  value: string
  change: Array<{ type: string; ts: number; data: any }>
  screenshot: string | null
}

const collectLiveFocus = async (): Promise<HtmlPreviewFocus | null> => {
  const iframe = iframeRef.value
  if (!iframe) {
    console.warn('[HtmlPreview] iframe not ready')
    return null
  }

  try {
    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    const html = doc?.documentElement?.outerHTML
    if (!html) {
      console.warn('[HtmlPreview] live html is empty or inaccessible')
      return null
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

    return {
      type: 'html',
      value: htmlUrl.value,
      change: ggbEventLog.value,
      screenshot,
    }
  } catch (e) {
    console.warn('[HtmlPreview] 无法读取 iframe 实时 HTML（可能跨域或 sandbox 限制）:', e)
    return null
  }
}

const printLiveHtml = async () => {
  const focus = await collectLiveFocus()
  console.log('[HtmlPreview][live][focus]', focus)
}

// 重试加载
const retry = () => {
  error.value = null
  originalHtml.value = '' // 清空内容以强制重新 Fetch
  loadHtmlContent()
  fetchHtmlSourceAndRender()
}

// 监听右侧面板显示状态，当面板打开时重新加载 iframe
watch(
  isRightPanelOpen,
  (isOpen, wasOpen) => {
    if (isOpen && !wasOpen) {
      console.log('[HtmlPreviewView] 右侧面板打开，重新加载 iframe')
      // 通过重置 src 强制 iframe 重新加载
      const currentSrc = htmlContentUrl.value
      htmlContentUrl.value = ''
      requestAnimationFrame(() => {
        htmlContentUrl.value = currentSrc
      })
    }
  }
)

// 监听路由 URL 参数变化，实现无跳转更新
watch(
  () => route.query.url,
  (newUrl, oldUrl) => {
    if (newUrl && newUrl !== oldUrl) {
      console.log('[HtmlPreviewView] URL 变化，重新加载:', newUrl)
      loadHtmlContent()
      fetchHtmlSourceAndRender()
    }
  }
)

// 生命周期
onMounted(() => {
  console.log('[HtmlPreviewView] onMounted 挂载, query:', route.query)
  loadHtmlContent()
  fetchHtmlSourceAndRender()
  window.addEventListener('message', onBridgeMessage)

    ; (window as any).__htmlPreview_getFocus = collectLiveFocus
})

onBeforeUnmount(() => {
  if (htmlBlobUrl.value) URL.revokeObjectURL(htmlBlobUrl.value)
  window.removeEventListener('message', onBridgeMessage)

  if ((window as any).__htmlPreview_getFocus) {
    delete (window as any).__htmlPreview_getFocus
  }
})
</script>

<style scoped>
.html-preview-view {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

/* 左侧容器 */
.html-preview-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

/* 工具栏 */
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

.toolbar-spacer {
  flex: 1;
}

.toolbar-action-btn {
  color: #ffffff;
  margin-left: 8px;
}

/* 悬浮对话按钮 */
.fab-chat {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 130px;
  height: 130px;
  border: none;
  outline: none;
  cursor: pointer;
  background-color: transparent;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  z-index: 100;
}

.fab-chat:hover {
  transform: scale(1.1);
}

/* 右侧面板容器 - 背景渐变 */
.right-panel-container {
  height: 100%;
  background: linear-gradient(to bottom, #0a0020 0%, #ffffff 30%);
}

/* 右侧面板包装器 - 参考 ExerciseSolveViewNew.vue 样式 */
.chat-panel-wrapper {
  height: 100%;
  position: relative;
  border-top-left-radius: 20px;
  border-bottom-left-radius: 20px;
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.chat-panel-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, #0a0020 0%, #ffffff 30%);
  z-index: -1;
}

.html-content-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  position: relative;
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
