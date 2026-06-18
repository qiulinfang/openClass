<template>
  <Transition name="fade">
    <div v-show="visible" class="scratchpad-container" :style="containerStyle">
      <!-- 四个角的 resize 把手 -->
      <div
        class="resize-handle top-left"
        @mousedown.stop="startResize('top-left', $event)"
        @touchstart.stop="startResizeTouch('top-left', $event)"
      ></div>
      <div
        class="resize-handle top-right"
        @mousedown.stop="startResize('top-right', $event)"
        @touchstart.stop="startResizeTouch('top-right', $event)"
      ></div>
      <div
        class="resize-handle bottom-left"
        @mousedown.stop="startResize('bottom-left', $event)"
        @touchstart.stop="startResizeTouch('bottom-left', $event)"
      ></div>
      <div
        class="resize-handle bottom-right"
        @mousedown.stop="startResize('bottom-right', $event)"
        @touchstart.stop="startResizeTouch('bottom-right', $event)"
      ></div>

      <!-- 顶部控制栏 (拖动该区域可以拖拽草稿本位置) -->
      <div class="scratchpad-header" @mousedown="startDrag" @touchstart="startDragTouch">
        <!-- 左：清空当前页 -->
        <button
          class="action-btn header-clear-btn"
          @click.stop="clearCanvas"
          @mousedown.stop
          @touchstart.stop
          title="清空当前页"
        >
          清空
        </button>

        <!-- 中：分页导航 -->
        <div class="page-nav" @mousedown.stop @touchstart.stop>
          <button
            class="nav-btn"
            @click.stop="prevPage"
            :disabled="currentPage === 0"
            title="上一页"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
          <span class="page-indicator">{{ currentPage + 1 }} / {{ pages.length }}</span>
          <button
            class="nav-btn"
            @click.stop="nextPage"
            :disabled="currentPage === pages.length - 1"
            title="下一页"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
          <button class="nav-btn add-page-btn" @click.stop="addPage" title="新增页面">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        </div>

        <!-- 右：关闭 -->
        <button
          class="close-btn"
          @click.stop="close"
          @mousedown.stop
          @touchstart.stop
          title="关闭草稿本"
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>

      <!-- 绘图区域 -->
      <div class="canvas-viewport" ref="viewportRef">
        <canvas
          ref="canvasRef"
          class="scratchpad-canvas"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart="startDrawingTouch"
          @touchmove="drawTouch"
          @touchend="stopDrawing"
        ></canvas>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch, nextTick } from 'vue'

interface Point {
  x: number
  y: number
}

interface StrokePath {
  points: Point[]
}

const props = withDefaults(
  defineProps<{
    visible: boolean
    questionKey?: string
  }>(),
  {
    visible: false,
    questionKey: '',
  },
)

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save-draft', key: string, data: any): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)
const isDrawing = ref(false)
const ctx = ref<CanvasRenderingContext2D | null>(null)

// 分页数据：每页独立存储一组笔画路径
const pages = ref<StrokePath[][]>([[]])
const currentPage = ref(0)
let currentPath: Point[] = []
// 增量绘制：记录上一个落点，每次只画新线段
let lastPoint: Point | null = null

// 容器尺寸与位置
const opacityVal = ref(0.9)
const width = ref(970)
const height = ref(610)
const posX = ref(0)
const posY = ref(0)
const isInitializedPos = ref(false)

const containerStyle = computed(() => ({
  width: `${width.value}px`,
  height: `${height.value}px`,
  transform: `translate(${posX.value}px, ${posY.value}px)`,
  background: `rgba(145, 143, 161, ${opacityVal.value})`,
}))

// 初始化居中位置，同时按屏幕比例设定初始尺寸
const initPosition = () => {
  if (isInitializedPos.value) return
  width.value = Math.min(Math.round(window.innerWidth * 0.88), 1200)
  height.value = Math.min(Math.round(window.innerHeight * 0.82), 800)
  posX.value = (window.innerWidth - width.value) / 2
  posY.value = (window.innerHeight - height.value) / 2
  isInitializedPos.value = true
}

// 重绘当前页路径
const redrawCanvas = () => {
  const canvas = canvasRef.value
  const context = ctx.value
  if (!canvas || !context) return

  const dpr = window.devicePixelRatio || 1
  context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)

  const strokes = pages.value[currentPage.value] || []
  strokes.forEach((path) => {
    if (path.points.length === 0) return
    context.beginPath()
    context.moveTo(path.points[0].x, path.points[0].y)
    for (let i = 1; i < path.points.length; i++) {
      context.lineTo(path.points[i].x, path.points[i].y)
    }
    context.stroke()
  })

  // 注意：落笔过程使用增量绘制，redrawCanvas 无需重绘当前笔迹
}

// 初始化 Canvas 尺寸与 DPI 适配
const initCanvas = () => {
  const canvas = canvasRef.value
  const viewport = viewportRef.value
  if (!canvas || !viewport) return

  const rect = viewport.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  ctx.value = canvas.getContext('2d')
  if (ctx.value) {
    ctx.value.scale(dpr, dpr)
    ctx.value.strokeStyle = '#ffffff'
    ctx.value.lineWidth = 3.5
    ctx.value.lineCap = 'round'
    ctx.value.lineJoin = 'round'
    ctx.value.shadowBlur = 1
    ctx.value.shadowColor = 'rgba(255, 255, 255, 0.5)'
  }

  redrawCanvas()
}

const handleResizeWindowOrContainer = () => {
  initCanvas()
}

// 保存并通知父组件当前题目的草稿数据（分页格式）
const saveAndEmitDraft = () => {
  if (!props.questionKey) return
  const draftData = {
    pages: pages.value,
    currentPage: currentPage.value,
  }
  emit('save-draft', props.questionKey, JSON.stringify(draftData))
}

// 恢复外部传入的草稿数据
const restoreDraft = (serializedData: string | null) => {
  if (!serializedData) {
    pages.value = [[]]
    currentPage.value = 0
    redrawCanvas()
    return
  }

  try {
    const parsed = JSON.parse(serializedData)
    if (parsed && Array.isArray(parsed.pages)) {
      // 新分页格式
      pages.value = parsed.pages.length > 0 ? parsed.pages : [[]]
      currentPage.value = Math.min(parsed.currentPage || 0, pages.value.length - 1)
    } else if (parsed && Array.isArray(parsed.strokePaths)) {
      // 兼容旧的单页无限画布格式
      pages.value = [parsed.strokePaths]
      currentPage.value = 0
    } else {
      pages.value = [[]]
      currentPage.value = 0
    }
  } catch {
    pages.value = [[]]
    currentPage.value = 0
  }

  redrawCanvas()
}

// 监听可见性
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick()
      initPosition()
      initCanvas()
      window.addEventListener('resize', handleResizeWindowOrContainer)
      emit('save-draft', props.questionKey, 'request-restore')
    } else {
      saveAndEmitDraft()
      window.removeEventListener('resize', handleResizeWindowOrContainer)
    }
  },
)

// 监听题目切换
watch(
  () => props.questionKey,
  async (newKey, oldKey) => {
    if (props.visible) {
      if (oldKey) saveAndEmitDraft()
      await nextTick()
      restoreDraft(null)
      emit('save-draft', newKey, 'request-restore')
    }
  },
)

defineExpose({
  loadDraftData: (serializedData: string | null) => {
    restoreDraft(serializedData)
  },
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResizeWindowOrContainer)
})

// 关闭草稿本
const close = () => {
  saveAndEmitDraft()
  emit('update:visible', false)
}

// 清空当前页
const clearCanvas = () => {
  pages.value[currentPage.value] = []
  currentPath = []
  redrawCanvas()
  saveAndEmitDraft()
}

/* ================= 分页操作 ================= */

const prevPage = () => {
  if (currentPage.value > 0) {
    currentPath = []
    currentPage.value--
    redrawCanvas()
  }
}

const nextPage = () => {
  if (currentPage.value < pages.value.length - 1) {
    currentPath = []
    currentPage.value++
    redrawCanvas()
  }
}

const addPage = () => {
  pages.value.push([])
  currentPath = []
  currentPage.value = pages.value.length - 1
  redrawCanvas()
  saveAndEmitDraft()
}

/* ================= 拖拽位移逻辑 ================= */

let isDraggingContainer = false
let startMouseX = 0
let startMouseY = 0
let startPosX = 0
let startPosY = 0

const startDrag = (e: MouseEvent) => {
  isDraggingContainer = true
  startMouseX = e.clientX
  startMouseY = e.clientY
  startPosX = posX.value
  startPosY = posY.value
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const startDragTouch = (e: TouchEvent) => {
  if (e.touches.length !== 1) return
  isDraggingContainer = true
  startMouseX = e.touches[0].clientX
  startMouseY = e.touches[0].clientY
  startPosX = posX.value
  startPosY = posY.value
  document.addEventListener('touchmove', onDragTouch)
  document.addEventListener('touchend', stopDrag)
}

const onDrag = (e: MouseEvent) => {
  if (!isDraggingContainer) return
  posX.value = startPosX + (e.clientX - startMouseX)
  posY.value = startPosY + (e.clientY - startMouseY)
}

const onDragTouch = (e: TouchEvent) => {
  if (!isDraggingContainer || e.touches.length !== 1) return
  posX.value = startPosX + (e.touches[0].clientX - startMouseX)
  posY.value = startPosY + (e.touches[0].clientY - startMouseY)
}

const stopDrag = () => {
  isDraggingContainer = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDragTouch)
  document.removeEventListener('touchend', stopDrag)
}

/* ================= 四周把手缩放逻辑 ================= */

let resizeDir = ''
let startWidth = 0
let startHeight = 0

const startResize = (dir: string, e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  resizeDir = dir
  startMouseX = e.clientX
  startMouseY = e.clientY
  startWidth = width.value
  startHeight = height.value
  startPosX = posX.value
  startPosY = posY.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

const startResizeTouch = (dir: string, e: TouchEvent) => {
  e.stopPropagation()
  if (e.touches.length !== 1) return
  resizeDir = dir
  startMouseX = e.touches[0].clientX
  startMouseY = e.touches[0].clientY
  startWidth = width.value
  startHeight = height.value
  startPosX = posX.value
  startPosY = posY.value
  document.addEventListener('touchmove', onResizeTouch)
  document.addEventListener('touchend', stopResize)
}

const onResize = (e: MouseEvent) => performResize(e.clientX, e.clientY)
const onResizeTouch = (e: TouchEvent) => {
  if (e.touches.length !== 1) return
  performResize(e.touches[0].clientX, e.touches[0].clientY)
}

const performResize = (clientX: number, clientY: number) => {
  const dx = clientX - startMouseX
  const dy = clientY - startMouseY
  const minW = 400
  const minH = 300

  if (resizeDir.includes('right')) width.value = Math.max(minW, startWidth + dx)
  if (resizeDir.includes('bottom')) height.value = Math.max(minH, startHeight + dy)
  if (resizeDir.includes('left')) {
    const newWidth = startWidth - dx
    if (newWidth >= minW) {
      width.value = newWidth
      posX.value = startPosX + dx
    }
  }
  if (resizeDir.includes('top')) {
    const newHeight = startHeight - dy
    if (newHeight >= minH) {
      height.value = newHeight
      posY.value = startPosY + dy
    }
  }
}

const stopResize = () => {
  resizeDir = ''
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', onResizeTouch)
  document.removeEventListener('touchend', stopResize)
  nextTick(() => handleResizeWindowOrContainer())
}

/* ================= 绘图核心逻辑 ================= */

const getCoordinates = (e: MouseEvent | Touch) => {
  const viewport = viewportRef.value
  if (!viewport) return { x: 0, y: 0 }
  const rect = viewport.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  }
}

/* -------- 增量绘制：O(1)/帧，笔画再多也不卡 -------- */

// 开始落笔：仅记录起点，不触发全量重绘
const startDrawing = (e: MouseEvent) => {
  if (e.button !== 0) return
  const { x, y } = getCoordinates(e)
  isDrawing.value = true
  currentPath = [{ x, y }]
  lastPoint = { x, y }
  const context = ctx.value
  if (context) {
    context.beginPath()
    context.moveTo(x, y)
  }
}

// 移笔：只画从上一点到当前点的一段线，O(1)
const draw = (e: MouseEvent) => {
  if (!isDrawing.value || !ctx.value || !lastPoint) return
  const { x, y } = getCoordinates(e)
  currentPath.push({ x, y })
  ctx.value.lineTo(x, y)
  ctx.value.stroke()
  // 重置路径起点，保持后续 lineTo 连续
  ctx.value.beginPath()
  ctx.value.moveTo(x, y)
  lastPoint = { x, y }
}

// 抬笔：保存笔画路径，canvas 上的线已增量绘制好，无需重绘
const stopDrawing = () => {
  if (!isDrawing.value) return
  isDrawing.value = false
  lastPoint = null
  if (currentPath.length > 0) {
    if (!pages.value[currentPage.value]) {
      pages.value[currentPage.value] = []
    }
    pages.value[currentPage.value].push({ points: currentPath })
    currentPath = []
  }
  // 笔画已在 canvas 上，不需要调用 redrawCanvas
  saveAndEmitDraft()
}

// 移动端 Touch 事件（增量同理）
const startDrawingTouch = (e: TouchEvent) => {
  if (e.touches.length === 1) {
    e.preventDefault()
    const { x, y } = getCoordinates(e.touches[0])
    isDrawing.value = true
    currentPath = [{ x, y }]
    lastPoint = { x, y }
    const context = ctx.value
    if (context) {
      context.beginPath()
      context.moveTo(x, y)
    }
  }
  // 多指不拦截，允许页面滚动
}

const drawTouch = (e: TouchEvent) => {
  if (!isDrawing.value || !ctx.value || e.touches.length !== 1 || !lastPoint) return
  e.preventDefault()
  const { x, y } = getCoordinates(e.touches[0])
  currentPath.push({ x, y })
  ctx.value.lineTo(x, y)
  ctx.value.stroke()
  ctx.value.beginPath()
  ctx.value.moveTo(x, y)
  lastPoint = { x, y }
}
</script>

<style scoped lang="scss">
.scratchpad-container {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2000;
  pointer-events: auto;
  border-radius: 14px;
  box-shadow:
    0 15px 45px rgba(0, 0, 0, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 4px;
  cursor: default;
  box-sizing: border-box;
}

/* 顶部控制栏 */
.scratchpad-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  z-index: 30;
  padding: 0 16px;
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}

/* 分页导航 */
.page-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.page-indicator {
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
  min-width: 44px;
  text-align: center;
  letter-spacing: 0.5px;
}

.nav-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  transition: all 0.18s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
    color: #ffffff;
  }

  &:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }
}

.add-page-btn {
  margin-left: 2px;
  color: rgba(255, 255, 255, 0.7);
  border-left: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 0 8px 8px 0;
  padding-left: 6px;
  width: 30px;

  &:hover:not(:disabled) {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.18);
  }
}

.header-clear-btn {
  background: rgba(255, 255, 255, 0.18) !important;
  border-radius: 12px !important;
  padding: 4px 10px !important;
  font-size: 11px !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
    transform: scale(1.1);
  }
}

/* 画布的可视窗口 */
.canvas-viewport {
  flex: 1;
  width: 100%;
  overflow: hidden;
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 24px;
}

/* 画布填充可视窗口 */
.scratchpad-canvas {
  cursor: crosshair;
  /* pan-x pan-y 允许非绘制状态下的页面滚动，绘制时由 JS 手动 preventDefault */
  touch-action: pan-x pan-y;
  z-index: 5;
  background: transparent;
  display: block;
  width: 100%;
  height: 100%;
}

.action-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: #ffffff;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

/* 四角缩放把手：加大点击区域至 44px (iOS 标准触摸目标大小)，贴近边角展示 */
.resize-handle {
  position: absolute;
  width: 30px;
  height: 30px;
  border-color: rgba(255, 255, 255, 0.85);
  border-style: solid;
  border-width: 0;
  z-index: 20;
}

.top-left {
  top: 2px;
  left: 2px;
  border-top-width: 3px;
  border-left-width: 3px;
  border-top-left-radius: 14px;
  cursor: nwse-resize;
}

.top-right {
  top: 2px;
  right: 2px;
  border-top-width: 3px;
  border-right-width: 3px;
  border-top-right-radius: 14px;
  cursor: nesw-resize;
}

.bottom-left {
  bottom: 2px;
  left: 2px;
  border-bottom-width: 3px;
  border-left-width: 3px;
  border-bottom-left-radius: 14px;
  cursor: nesw-resize;
}

.bottom-right {
  bottom: 2px;
  right: 2px;
  border-bottom-width: 3px;
  border-right-width: 3px;
  border-bottom-right-radius: 14px;
  cursor: nwse-resize;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
