<template>
  <div class="streaming-message">
    <div class="message-content">
      <!-- 骨架屏 -->
      <div
        v-if="props.isStreaming && (props.messageType === 'html' || !props.content)"
        class="skeleton-card"
        :style="{ backgroundImage: `url(${generateImgGif})` }"
      ></div>

      <!-- 流式文本 -->
      <div
        v-else-if="props.isStreaming"
        class="streaming-content"
        :ref="(el) => setStreamingContentRef(el)"
      >
        <span v-html="displayedContent"></span>
      </div>
      <!-- HTML 卡片 -->
      <div
        v-else-if="props.messageType === 'html'"
        class="html-message-container"
      >
        <div v-for="seg in htmlSegments" :key="seg.key" class="html-segment-wrapper">
          <!-- 文本 -->
          <div v-if="seg.type === 'text'" class="html-text-segment">
            <span v-html="seg.rendered"></span>
          </div>
          <!-- 网页 -->
          <div
            v-else
            class="html-card"
            role="button"
            tabindex="0"
            @click.stop="openHtmlDialog(seg.url)"
          >
            <div class="html-card-content" :ref="setIframeContainerRef">
              <iframe
                v-if="seg.rawHtml"
                :key="seg.url"
                :srcdoc="seg.rawHtml"
                class="html-card-iframe"
                :style="iframeStyle"
                frameborder="0"
                allowfullscreen
              ></iframe>
            </div>

            <div class="html-card-footer">
              <div class="html-card-actions">
                <Button
                  :icon="fullScreenIcon"
                  label="全屏"
                  size="sm"
                  @click.stop="openHtmlDialog(seg.url)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 普通文本 -->
      <div v-else class="typewriter-content" :ref="(el) => setTypewriterContentRef(el)">
        <span v-html="displayedContent"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { streamingManager } from '../../config/streaming'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import { MathJaxUtils } from '../../utils/math/mathjax'
import { useMainChatPanel } from '../../composables/useMainChatPanel'
import Button from '../base/Button.vue'
import fullScreenIcon from '/icons/fullScreen.svg'
import generateImgGif from '/icons/generateImg.webp'

// 定义Props
interface Props{
  content: string
  isStreaming?: boolean
  messageType?: 'text' | 'html'
  rawHtmlMap?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  rawHtmlMap: () => ({}),
})

// 添加ref引用
const streamingContentRef = ref<HTMLElement>()
const typewriterContentRef = ref<HTMLElement>()
const iframeContainer = ref<HTMLElement | null>(null)
let iframeResizeObserver: ResizeObserver | null = null

const iframeDesignWidth = 900
const iframeDesignHeight = 800
const iframeScale = ref(1)

const updateIframeScale = () => {
  const el = iframeContainer.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  const scale = Math.min(w / iframeDesignWidth, h / iframeDesignHeight)
  iframeScale.value = Number.isFinite(scale) && scale > 0 ? scale : 1
}

const setupIframeResizeObserver = () => {
  if (!iframeContainer.value) return

  iframeResizeObserver?.disconnect()
  iframeResizeObserver = new ResizeObserver(() => {
    updateIframeScale()
  })
  iframeResizeObserver.observe(iframeContainer.value)

  updateIframeScale()
}

const setIframeContainerRef = (el: any) => {
  const dom = el?.$el instanceof HTMLElement ? el.$el : el
  if (!(dom instanceof HTMLElement)) return
  iframeContainer.value = dom

  // 新消息场景下，容器可能在 mounted 之后才出现：这里立即绑定 observer 并计算一次
  setupIframeResizeObserver()
}

const iframeStyle = computed(() => {
  return {
    width: `${iframeDesignWidth}px`,
    height: `${iframeDesignHeight}px`,
    transform: `translate(-50%, -50%) scale(${iframeScale.value})`,
  } as Record<string, string>
})

const router = useRouter()

// 使用 MainChatPanel 控制
const { hideMainChatPanel} = useMainChatPanel()

// 使用公共的 markdown 渲染器
const { renderMessageContent } = useMessageRenderer()

const openHtmlDialog = (urlArg?: string) => {
  // 关闭 MainChatPanel
  hideMainChatPanel()
  
  if (urlArg) {
    router.push({
      name: 'htmlPreview',
      query: {
        url: urlArg
      }
    })
  }
}

// 计算显示的内容（用于打字机效果，流式与非流式统一使用 displayedLength 控制）
const displayedContent = computed(() => {
  const content = props.content
  
  // 对于 HTML 消息，过滤掉 HTML URL，只显示文字描述
  if (props.messageType === 'html') {
    // 使用正则表达式移除 HTML URL 行
    const filteredContent = content.replace(/https:\/\/kelvin-cosin\.cloud\/[a-f0-9-]+\.html.*?(\n|$)/gi, '')
    return renderMessageContent(filteredContent.trim())
  }
  
  return renderMessageContent(content)
})

const htmlSegments = computed(() => {
  if (props.messageType !== 'html') return [] as { key: string; type: 'text' | 'link'; rendered?: string; url?: string; rawHtml?: string }[]

  const content = props.content
  const regex = /(https:\/\/kelvin-cosin\.cloud\/[a-f0-9-]+\.html)/gi
  const segments: { key: string; type: 'text' | 'link'; rendered?: string; url?: string; rawHtml?: string }[] = []

  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const url = match[1]
    const start = match.index

    if (start > lastIndex) {
      const textPart = content.slice(lastIndex, start)
      if (textPart) {
        segments.push({
          key: `t-${lastIndex}-${start}`,
          type: 'text',
          rendered: renderMessageContent(textPart),
        })
      }
    }

    segments.push({
      key: `l-${start}-${regex.lastIndex}`,
      type: 'link',
      url,
      rawHtml: props.rawHtmlMap?.[url] || '',
    })

    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    const textPart = content.slice(lastIndex)
    if (textPart) {
      segments.push({
        key: `t-${lastIndex}-end`,
        type: 'text',
        rendered: renderMessageContent(textPart),
      })
    }
  }
  return segments
})

// 处理 Markdown 渲染出的图片
const processMarkdownImages = (container: HTMLElement) => {
  // 查找容器内所有的图片元素
  const allImages = container.querySelectorAll('img')
  
  allImages.forEach((img) => {
    // 检查图片是否在 MathJax 公式容器内，如果是则跳过
    const mathContainer = img.closest('.mjx-chtml, .mjx-math, [data-mjx-texclass]')
    if (mathContainer) {
      return
    }
    
    // 检查图片是否已经被处理过
    if (img.classList.contains('markdown-image')) {
      return
    }
    
    // 添加标记类名和样式类名
    img.classList.add('markdown-image')
  })
}

// MathJax渲染处理
const setStreamingContentRef = (el: any) => {
  if (el && el instanceof HTMLElement) {
    streamingContentRef.value = el
    // 对于流式内容，使用懒加载模式
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
      // 处理图片
      processMarkdownImages(el)
    })
  }
}

const setTypewriterContentRef = (el: any) => {
  if (el && el instanceof HTMLElement) {
    typewriterContentRef.value = el
    // 对于打字机内容，使用懒加载模式
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
      // 处理图片
      processMarkdownImages(el)
    })
  }
}

const refreshMathAndImages = () => {
  nextTick(() => {
    if (streamingContentRef.value) {
      MathJaxUtils.renderMath(streamingContentRef.value, true)
      processMarkdownImages(streamingContentRef.value)
    }
    if (typewriterContentRef.value) {
      MathJaxUtils.renderMath(typewriterContentRef.value, true)
      processMarkdownImages(typewriterContentRef.value)
    }
  })
}

let mathJaxRenderTimeout: ReturnType<typeof setTimeout> | null = null

const scheduleMathAndImageRefresh = () => {
  // 防抖处理，避免频繁渲染MathJax和处理图片
  if (mathJaxRenderTimeout) {
    clearTimeout(mathJaxRenderTimeout)
  }
  mathJaxRenderTimeout = setTimeout(() => {
    refreshMathAndImages()
  }, 300) // 300ms防抖
}

// 监听内容变化：只要内容长度增加，就对新增部分做打字机效果
watch(
  () => props.content,
  () => {
    scheduleMathAndImageRefresh()
  },
  { immediate: true },
)

// rawHtmlMap / messageType 变化时（新消息补齐 rawHtmlMap、或从 text 切到 html），确保重新计算缩放
watch(
  () => [props.messageType, props.rawHtmlMap],
  () => {
    nextTick(() => {
      setupIframeResizeObserver()
    })
  },
  { deep: true },
)

onMounted(() => {
  setupIframeResizeObserver()
  refreshMathAndImages()
})

onUnmounted(() => {
  if (mathJaxRenderTimeout) {
    clearTimeout(mathJaxRenderTimeout)
  }

  iframeResizeObserver?.disconnect()
  iframeResizeObserver = null
})
</script>

<style scoped>
.streaming-message {
  display: flex;
  align-items: flex-end;
  gap: 2px;
}

.message-content {
  flex: 1;
  word-wrap: break-word;
  white-space: normal;
}

/* 绘图中骨架屏样式：使用 GIF 图片 + 圆角 */
.skeleton-card {
  /* 使用固定尺寸，避免受父级 shrink-to-fit 影响变成 0 宽 */
  width: 260px;
  min-height: 160px;
  border-radius: 18px;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  position: relative;
  overflow: hidden;
}

/* HTML 段落包装器样式 */
.html-segment-wrapper {
  position: relative;
  margin-bottom: 8px;
  width: 100%;
}

.html-segment-wrapper:last-child {
  margin-bottom: 0;
}

.html-text-segment {
  margin-bottom: 4px;
}

.html-card {
  width: 100%;
  max-width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  background: #f4f6ff;
  border: 1px solid #7A7CFF;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
}

.html-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  gap: 12px;
  flex-shrink: 0;
}

.html-card-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.html-card-title {
  font-size: 14px;
  color: #333;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.html-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.html-card-content {
  background: white;
  margin: 0 16px 8px;
  padding: 0;
  border-radius: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.html-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 8px 16px 12px;
  gap: 8px;
  flex-shrink: 0;
}

.html-card-iframe {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  border: none;
}

/* 链接预览样式 */
.link-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preview-image {
  width: 100%;
  height: 120px;
  overflow: hidden;
  border-radius: 8px 8px 0 0;
}

.preview-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-content {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.preview-description {
  font-size: 12px;
  color: #666;
  margin: 0 0 8px 0;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  flex: 1;
}

.preview-site {
  font-size: 11px;
  color: #8b5cf6;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 加载状态样式 */
.preview-loading {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
}

.loading-skeleton {
  width: 100%;
  height: 120px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 12px;
}

.loading-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line.short {
  width: 60%;
}

.skeleton-line:last-child {
  width: 40%;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.html-message-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.html-description {
  flex: 1;
  word-wrap: break-word;
  white-space: normal;
}


.typing-cursor {
  display: inline;
  color: #1976d2;
  font-weight: bold;
  animation: blink 1s infinite;
  font-size: 0.9em;
  line-height: 1;
  vertical-align: baseline;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}
</style>