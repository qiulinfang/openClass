<template>
  <div class="interactive-canvas-view">
    <!-- 移动端切换标签 -->
    <div class="mobile-tabs">
      <button
        @click="activeTab = 'canvas'"
        :class="['tab-btn', activeTab === 'canvas' ? 'tab-btn-active' : 'tab-btn-inactive']"
      >
        画布
      </button>
      <button
        @click="activeTab = 'chat'"
        :class="['tab-btn', activeTab === 'chat' ? 'tab-btn-active' : 'tab-btn-inactive']"
      >
        对话
      </button>
    </div>

    <!-- 左侧画布区域 -->
    <main
      :class="['canvas-main', activeTab !== 'canvas' ? 'hidden-mobile show-desktop' : '']"
    >
      <header class="canvas-header">
        <h1 class="canvas-title">创意画布</h1>
        <span class="canvas-subtitle">支持拖拽与双击编辑</span>
      </header>

      <div
        ref="canvasRef"
        class="canvas-viewport touch-none"
        @dragover.prevent="handleDragOver"
        @drop.prevent="handleDrop"
      >
        <!-- 空状态提示 -->
        <div
          v-if="items.length === 0"
          class="empty-state"
        >
          <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p class="empty-text">从右侧划选内容拖拽至此处</p>
        </div>

        <!-- 画布元素 -->
        <div
          v-for="item in items"
          :key="item.id"
          :draggable="!item.isEditing"
          @dblclick="enableEdit(item)"
          @dragstart="handleDragStart($event, item)"
          @touchstart="handleTouchStart($event, item)"
          @touchmove="handleTouchMove($event, item)"
          :class="['canvas-item', item.isEditing ? 'canvas-item-editing' : 'canvas-item-normal']"
          :style="{ left: item.x + 'px', top: item.y + 'px' }"
        >
          <button
            v-if="!item.isEditing"
            @click="removeItem(item.id)"
            class="delete-btn"
          >
            ✕
          </button>

          <div
            class="canvas-item-content"
            :style="{ whiteSpace: item.type === 'text' ? 'pre-wrap' : 'normal' }"
            :contenteditable="item.isEditing"
            @blur="finishEdit(item, $event)"
            v-html="item.content"
          ></div>
        </div>
      </div>
    </main>

    <!-- 右侧对话区域 -->
    <aside
      :class="['chat-sidebar', activeTab !== 'chat' ? 'hidden-mobile show-desktop' : '']"
    >
      <header class="chat-header">
        <h2 class="chat-title">助手对话</h2>
      </header>

      <div class="chat-messages no-scrollbar">
        <div v-for="(msg, index) in messages" :key="index" class="message-wrapper animate-fade-in">
          <div
            class="chat-bubble markdown-content"
            v-html="renderMarkdown(msg)"
            draggable="true"
            @dragstart="handleChatDragStart($event, msg)"
            @click="handleMessageClick($event, index)"
          ></div>
        </div>
      </div>

      <div class="chat-input-area">
        <div class="input-wrapper">
          <input
            v-model="inputMessage"
            @keyup.enter="sendMessage"
            type="text"
            placeholder="发送消息或指令..."
            class="message-input"
          />
          <button
            @click="sendMessage"
            class="send-btn"
          >
            发送
          </button>
        </div>
        <div class="input-hint">双击画布内容即可实时修改</div>
      </div>
    </aside>

    <!-- HTML 预览悬浮面板 -->
    <div v-if="showHtmlModal" class="html-modal-overlay" @click="closeHtmlModal">
      <div class="html-modal-container" @click.stop>
        <!-- 面板头部工具栏 -->
        <div class="html-modal-header">
          <h3 class="html-modal-title">HTML 预览</h3>
          <div class="html-modal-actions">
            <button class="html-modal-btn fullscreen-btn" @click="goToFullScreenPreview">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
              全屏查看
            </button>
            <button class="html-modal-btn close-btn" @click="closeHtmlModal">✕</button>
          </div>
        </div>
        <!-- HTML 内容 iframe -->
        <div class="html-modal-content">
          <iframe
            v-if="modalHtmlBlobUrl"
            :src="modalHtmlBlobUrl"
            class="html-modal-iframe"
            frameborder="0"
            sandbox="allow-scripts allow-same-origin"
          ></iframe>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'
import mathjax3 from 'markdown-it-mathjax3'

// 类型定义
interface CanvasItem {
  id: number
  x: number
  y: number
  content: string
  type: 'html' | 'text'
  isEditing: boolean
}

// 路由
const router = useRouter()

// Markdown 引擎
const md = new MarkdownIt({ html: true }).use(mathjax3)

// 画布相关
const items = ref<CanvasItem[]>([])
const canvasRef = ref<HTMLElement | null>(null)

// HTML 预览弹窗相关
const showHtmlModal = ref(false)
const modalHtmlContent = ref('')
const modalHtmlBlobUrl = ref<string | null>(null)

// 移动端标签切换
const activeTab = ref<'canvas' | 'chat'>('chat')

// 触摸拖拽状态
const touchState = ref({
  startX: 0,
  startY: 0,
  initialX: 0,
  initialY: 0
})

// 聊天相关
const inputMessage = ref('')
const messages = ref<string[]>([
  '你好。你可以划选气泡中的文字或公式，直接将其拖入左侧画布进行排版。',
  '公式支持：$E=mc^2$ 或复杂公式：\n\n$$\\sum_{i=1}^{n} i^2 = \\frac{n(n+1)(2n+1)}{6}$$\n\n试试拖拽这段话，或者在画布上双击进行内容订正。',
  '图片展示：\n\n![示例图](https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80)'
])

// 渲染 Markdown
const renderMarkdown = (content: string): string => {
  return md.render(content)
}

// 拖拽处理
const handleDragOver = (e: DragEvent) => {
  e.dataTransfer!.dropEffect = 'copy'
}

const handleDragStart = (e: DragEvent, item: CanvasItem) => {
  if (item.isEditing) return
  e.dataTransfer!.setData('application/x-canvas-item', item.id.toString())
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  e.dataTransfer!.setData('offsetX', (e.clientX - rect.left).toString())
  e.dataTransfer!.setData('offsetY', (e.clientY - rect.top).toString())
  e.dataTransfer!.effectAllowed = 'move'
}

// 从聊天区域开始拖拽
const handleChatDragStart = (e: DragEvent, msg: string) => {
  const selection = window.getSelection()
  let selectedHtml = ''
  let selectedText = ''

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const container = document.createElement('div')
    container.appendChild(range.cloneContents())
    selectedHtml = container.innerHTML
    selectedText = selection.toString()
  }

  // 如果有选中的内容，使用选中的内容；否则使用整个消息
  if (selectedHtml && selectedText) {
    e.dataTransfer!.setData('text/html', selectedHtml)
    e.dataTransfer!.setData('text/plain', selectedText)
  } else {
    // 如果没有选中内容，渲染整个消息为 HTML
    const renderedHtml = renderMarkdown(msg)
    e.dataTransfer!.setData('text/html', renderedHtml)
    e.dataTransfer!.setData('text/plain', msg)
  }
  e.dataTransfer!.effectAllowed = 'copy'
}

const handleDrop = (e: DragEvent) => {
  if (!canvasRef.value) return

  const canvasRect = canvasRef.value.getBoundingClientRect()
  const dropX = e.clientX - canvasRect.left
  const dropY = e.clientY - canvasRect.top

  // 内部移动
  const internalItemId = e.dataTransfer!.getData('application/x-canvas-item')
  if (internalItemId) {
    const offsetX = parseFloat(e.dataTransfer!.getData('offsetX')) || 0
    const offsetY = parseFloat(e.dataTransfer!.getData('offsetY')) || 0
    const item = items.value.find((i) => i.id.toString() === internalItemId)
    if (item) {
      item.x = dropX - offsetX
      item.y = dropY - offsetY
    }
    return
  }

  // 外部拖入 - 优先使用 HTML 格式保留公式和图片
  let html = e.dataTransfer!.getData('text/html')
  const text = e.dataTransfer!.getData('text/plain')
  const url = e.dataTransfer!.getData('URL')

  let content = ''
  let type: 'html' | 'text' = 'html'

  if (html) {
    // 清理 HTML 但保留图片和公式相关标签
    content = html
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<!--[^>]*-->/gi, '')
      .replace(/style="[^"]*"/gi, '')
      .trim()

    // 如果没有实质性内容（只有空标签），回退到文本
    const textContent = content.replace(/<[^>]+>/g, '').trim()
    if (!textContent && !content.includes('<img') && !content.includes('<mjx')) {
      content = ''
    }
  }

  // 如果 HTML 为空或无效，尝试其他来源
  if (!content) {
    if (url && url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i)) {
      content = `<img src="${url}" style="max-width:100%;border-radius:0.5rem;" />`
    } else if (text) {
      // 检查文本是否是 Markdown 格式（包含图片语法）
      const imgMatch = text.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      if (imgMatch) {
        content = `<img src="${imgMatch[2]}" alt="${imgMatch[1]}" style="max-width:100%;border-radius:0.5rem;" />`
      } else {
        // 检查是否包含 LaTeX 公式
        if (text.includes('$')) {
          // 使用 markdown-it 渲染公式
          content = renderMarkdown(text)
        } else {
          content = text.replace(/\n/g, '<br>')
          type = 'text'
        }
      }
    }
  }

  if (content) {
    items.value.push({
      id: Date.now(),
      x: dropX,
      y: dropY,
      content,
      type,
      isEditing: false
    })
    activeTab.value = 'canvas'
  }
}

// 触摸拖拽支持
const handleTouchStart = (e: TouchEvent, item: CanvasItem) => {
  if (item.isEditing) return
  const touch = e.touches[0]
  touchState.value = {
    startX: touch.clientX,
    startY: touch.clientY,
    initialX: item.x,
    initialY: item.y
  }
}

const handleTouchMove = (e: TouchEvent, item: CanvasItem) => {
  if (item.isEditing) return
  const touch = e.touches[0]
  item.x = touchState.value.initialX + (touch.clientX - touchState.value.startX)
  item.y = touchState.value.initialY + (touch.clientY - touchState.value.startY)
  e.preventDefault()
}

// 删除画布项
const removeItem = (id: number) => {
  items.value = items.value.filter((i) => i.id !== id)
}

// 编辑功能
const enableEdit = (item: CanvasItem) => {
  item.isEditing = true
  nextTick(() => {
    const el = document.querySelector('.ring-2 .canvas-item-content') as HTMLElement
    if (el) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
}

const finishEdit = (item: CanvasItem, event: FocusEvent) => {
  item.content = (event.target as HTMLElement).innerHTML
  item.type = 'html'
  item.isEditing = false
}

// 处理聊天消息中的图片点击
const handleMessageClick = (event: MouseEvent, msgIndex: number) => {
  const target = event.target as HTMLElement

  // 检查点击的是否是图片
  if (target.tagName === 'IMG') {
    event.preventDefault()
    event.stopPropagation()

    // 获取完整的 HTML 消息内容
    const fullHtml = renderMarkdown(messages.value[msgIndex])

    // 创建增强的 HTML 页面（包含图片点击放大的完整页面）
    const enhancedHtml = createEnhancedHtml(fullHtml)

    modalHtmlContent.value = enhancedHtml

    // 创建 Blob URL
    if (modalHtmlBlobUrl.value) {
      URL.revokeObjectURL(modalHtmlBlobUrl.value)
    }
    const blob = new Blob([enhancedHtml], { type: 'text/html' })
    modalHtmlBlobUrl.value = URL.createObjectURL(blob)

    showHtmlModal.value = true
  }
}

// 创建增强的 HTML 页面（添加图片点击放大功能）
const createEnhancedHtml = (contentHtml: string): string => {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML Preview</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff;
      line-height: 1.6;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      cursor: zoom-in;
      transition: transform 0.2s;
    }
    img:hover {
      transform: scale(1.02);
    }
    /* 图片放大遮罩层 */
    .image-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 9999;
      justify-content: center;
      align-items: center;
      cursor: zoom-out;
    }
    .image-overlay.active {
      display: flex;
    }
    .image-overlay img {
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
      cursor: zoom-out;
    }
    .image-overlay .close-hint {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: #fff;
      font-size: 14px;
      opacity: 0.7;
    }
    /* MathJax 样式 */
    mjx-container {
      display: inline-block;
      margin: 0.2em 0;
    }
  </style>
</head>
<body>
  <div class="content">${contentHtml}</div>

  <!-- 图片放大遮罩层 -->
  <div class="image-overlay" id="imageOverlay">
    <img src="" alt="放大图片" id="overlayImage">
    <div class="close-hint">点击任意处关闭</div>
  </div>

  <script>
    // 图片点击放大功能
    document.querySelectorAll('img').forEach(img => {
      img.addEventListener('click', function(e) {
        if (this.parentElement.classList.contains('image-overlay')) return;
        const overlay = document.getElementById('imageOverlay');
        const overlayImg = document.getElementById('overlayImage');
        overlayImg.src = this.src;
        overlay.classList.add('active');
        e.stopPropagation();
      });
    });

    // 点击遮罩层关闭
    document.getElementById('imageOverlay').addEventListener('click', function() {
      this.classList.remove('active');
    });
  <\/script>
</body>
</html>`
}

// 关闭 HTML 预览弹窗
const closeHtmlModal = () => {
  showHtmlModal.value = false
  if (modalHtmlBlobUrl.value) {
    URL.revokeObjectURL(modalHtmlBlobUrl.value)
    modalHtmlBlobUrl.value = null
  }
}

// 跳转到全屏 HTML 预览页面
const goToFullScreenPreview = () => {
  // 将 HTML 内容存入 sessionStorage
  sessionStorage.setItem('htmlPreview_inlineContent', modalHtmlContent.value)

  // 关闭弹窗
  closeHtmlModal()

  // 跳转到 htmlPreview 页面
  router.push({ name: 'htmlPreview' })
}

// 发送消息
const sendMessage = () => {
  if (!inputMessage.value.trim()) return
  messages.value.push(inputMessage.value)
  inputMessage.value = ''
}
</script>

<style scoped>
/* ========== 布局容器 ========== */
.interactive-canvas-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: #f9fafb;
  color: #111827;
  overflow: hidden;
}

@media (min-width: 768px) {
  .interactive-canvas-view {
    flex-direction: row;
  }
}

/* ========== 移动端标签切换 ========== */
.mobile-tabs {
  display: flex;
  background-color: #fff;
  border-bottom: 1px solid #e5e7eb;
  z-index: 30;
}

@media (min-width: 768px) {
  .mobile-tabs {
    display: none;
  }
}

.tab-btn {
  flex: 1;
  padding: 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn-active {
  border-bottom-color: #2563eb;
  color: #2563eb;
}

.tab-btn-inactive {
  border-bottom-color: transparent;
  color: #6b7280;
}

.tab-btn:hover {
  color: #2563eb;
}

/* ========== 显示/隐藏控制 ========== */
.hidden-mobile {
  display: none;
}

@media (min-width: 768px) {
  .show-desktop {
    display: flex;
  }
}

/* ========== 左侧画布区域 ========== */
.canvas-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;
  transition: all 0.3s;
}

.canvas-header {
  background-color: #fff;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.canvas-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.canvas-subtitle {
  font-size: 0.75rem;
  color: #9ca3af;
  background-color: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.canvas-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: #f9fafb;
  background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
  background-size: 20px 20px;
  touch-action: none;
}

/* ========== 空状态 ========== */
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  pointer-events: none;
  padding: 0 2.5rem;
  text-align: center;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
  opacity: 0.2;
}

.empty-text {
  font-size: 0.875rem;
  margin: 0;
}

/* ========== 画布元素 ========== */
.canvas-item {
  position: absolute;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 1rem;
  border-radius: 0.5rem;
  max-width: 28rem;
  touch-action: none;
}

.canvas-item-normal {
  z-index: 10;
  cursor: move;
}

.canvas-item-normal:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  outline: 1px solid #93c5fd;
}

.canvas-item-editing {
  z-index: 50;
  cursor: text;
  outline: 2px solid #3b82f6;
}

.delete-btn {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  background-color: #ef4444;
  color: #fff;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  cursor: pointer;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  opacity: 0;
  transition: opacity 0.2s;
}

.canvas-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background-color: #dc2626;
}

.canvas-item-content {
  color: #1f2937;
  line-height: 1.625;
  outline: none;
}

.canvas-item:not(.canvas-item-editing) .canvas-item-content {
  pointer-events: none;
}

.canvas-item-content img {
  max-width: 100%;
  height: auto;
}

/* ========== 右侧对话区域 ========== */
.chat-sidebar {
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-left: 1px solid #e5e7eb;
  height: 100%;
  /* 左上角、左下角圆角 */
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
  /* 左侧阴影 */
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 20;
  transition: all 0.3s;
  user-select: text;
  -webkit-user-select: text;
  touch-action: auto;
}

@media (min-width: 768px) {
  .chat-sidebar {
    width: 420px;
  }
}

.chat-header {
  padding: 1.25rem;
  border-bottom: 1px solid #f3f4f6;
  background-color: #fff;
}

.chat-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  user-select: text;
  -webkit-user-select: text;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  user-select: text;
  -webkit-user-select: text;
  touch-action: auto;
}

.chat-bubble {
  background-color: #eff6ff;
  border: 1px solid #dbeafe;
  color: #1f2937;
  padding: 1rem;
  border-radius: 1rem;
  border-top-left-radius: 0.25rem;
  max-width: 95%;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  cursor: text;
  touch-action: auto;
}

.chat-bubble ::selection {
  background-color: #b9d8ff;
}

.chat-bubble * {
  user-select: text;
  -webkit-user-select: text;
}

.chat-input-area {
  padding: 1rem;
  background-color: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.input-wrapper {
  display: flex;
  gap: 0.5rem;
  background-color: #fff;
  padding: 0.25rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.input-wrapper:focus-within {
  outline: 2px solid #3b82f6;
}

.message-input {
  flex: 1;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  outline: none;
  font-size: 0.875rem;
}

.send-btn {
  background-color: #2563eb;
  color: #fff;
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.send-btn:hover {
  background-color: #1d4ed8;
}

.input-hint {
  margin-top: 0.5rem;
  font-size: 0.625rem;
  color: #9ca3af;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ========== Markdown 内容 ========== */
.markdown-content :deep(p) {
  margin-bottom: 0.75em;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(img) {
  max-width: 20rem;
  border-radius: 0.5rem;
  margin-top: 0.75rem;
  display: block;
}

.markdown-content :deep(mjx-container) {
  outline: none;
}

/* ========== 滚动条隐藏 ========== */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* ========== 动画 ========== */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

/* ========== HTML 预览悬浮面板 ========== */
.html-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.html-modal-container {
  background: #fff;
  border-radius: 0.75rem;
  width: 90%;
  max-width: 800px;
  height: 80vh;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.2s ease-out;
}

.html-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0.75rem 0.75rem 0 0;
}

.html-modal-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.html-modal-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.html-modal-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.fullscreen-btn {
  background: #2563eb;
  color: #fff;
}

.fullscreen-btn:hover {
  background: #1d4ed8;
}

.close-btn {
  background: transparent;
  color: #6b7280;
  font-size: 1.25rem;
  padding: 0.25rem 0.5rem;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #1f2937;
}

.html-modal-content {
  flex: 1;
  overflow: hidden;
  border-radius: 0 0 0.75rem 0.75rem;
}

.html-modal-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .html-modal-container {
    width: 95%;
    height: 85vh;
    max-height: none;
  }

  .html-modal-header {
    padding: 0.75rem 1rem;
  }

  .html-modal-title {
    font-size: 0.875rem;
  }

  .html-modal-btn {
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
  }
}
</style>
