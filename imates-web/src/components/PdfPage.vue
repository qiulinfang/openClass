<template>
  <div class="pdf-page-layout">
    <div
      ref="containerRef"
      class="pdf-page"
      :style="pdfPageStyle"
      @wheel="handleWheel"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchEnd"
      @scroll="handleScroll"
    >
      <!-- 调试用的手势参数调整面板 -->
      <PdfGestureDebugPanel
        v-if="showDebugPanel"
        :min-scale="minScale"
        :max-scale="maxScale"
        :zoom-threshold="zoomThreshold"
        :pan-threshold="panThreshold"
        :friction="friction"
        @update:minScale="(v) => (minScale = v)"
        @update:maxScale="(v) => (maxScale = v)"
        @update:zoomThreshold="(v) => (zoomThreshold = v)"
        @update:panThreshold="(v) => (panThreshold = v)"
        @update:friction="(v) => (friction = v)"
      />
      
      <!-- PDF 渲染层：外层负责布局与滚动区域，内层负责缩放 -->
      <div ref="viewerContainer" :style="viewerOuterStyle">
        <div
          class="viewer-inner"
          :class="{ 'block-touch': isDrawingOrScreenshotMode }"
          :style="viewerInnerStyle"
        >
          <!-- PDF 页面循环 -->
          <div
            v-for="(layout, index) in pageLayouts"
            :key="index"
            class="page"
            :class="{ 'page-highlighting': currentMode === 'highlighter' }"
            :style="getPageStyle(layout)"
            @click="handlePageClick($event, index, layout)"
            @pointerdown.passive="handleHighlightPointerDown($event, index, layout)"
            @pointermove.passive="handleHighlightPointerMove($event, index, layout)"
            @pointerup.passive="handleHighlightPointerUp($event, index, layout)"
            @pointercancel.passive="handleHighlightPointerUp($event, index, layout)"
          >
            <!-- 内联新增输入 -->
            <PdfNoteAnchor
              v-if="editingInlineNote && editingInlineNote.pageIndex === index"
              mode="create"
              :x="editingInlineNote.x"
              :y="editingInlineNote.y"
              :page-layout="layout"
              :inline-active="true"
              :model-value="inlineNoteText"
              @update:model-value="(val) => (inlineNoteText = val)"
              @confirm="handleInlineCreateConfirm"
              @cancel="handleInlineCreateCancel"
            />

            <!-- 已保存笔记的标记 -->
            <PdfNoteAnchor
              v-for="note in pageNotesByIndex[index] || []"
              :key="note.id"
              mode="display"
              :x="note.x"
              :y="note.y"
              :page-layout="layout"
              :text="note.text"
              :active="activeNoteId === note.id"
              @marker-click="onNoteMarkerClick(note)"
              @delete="deleteNote(note)"
            />
            
            <!-- [图层 1] 底层：PDF 原文渲染 (MuPDF) - 仅在加载或保存时重绘 -->
            <canvas :ref="(el) => setPageCanvasRef(el, index)" class="page-canvas"></canvas>
            
            <!-- [图层 2] 墨水层：JS 笔迹渲染 (DrawingBoard 逻辑) - 响应速度快，不依赖 MuPDF -->
            <canvas 
              :ref="(el) => setInkCanvasRef(el, index)" 
              class="ink-canvas"
              :style="{ width: `${layout.width}px`, height: `${layout.height}px` }"
            ></canvas>

            <!-- [图层 3] 绘制层：当前正在画的这一笔 (实时预览) -->
            <canvas
              v-if="['highlighter', 'pen', 'eraser-draw'].includes(currentMode)"
              :ref="(el) => setDrawingCanvasRef(el, index)"
              class="drawing-canvas"
              :style="{
                width: `${layout.width}px`,
                height: `${layout.height}px`,
              }"
            ></canvas>

            <!-- 截图裁剪框可视化：矩形模式 -->
            <div
              v-if="isScreenshotMode && screenshotRect?.pageIndex === index && screenshotShape === 'rectangle'"
              class="screenshot-rect"
              :style="getScreenshotRectStyle(screenshotRect, layout)"
            ></div>

            <!-- 截图裁剪框可视化：自由形状模式 -->
            <svg
              v-if="isScreenshotMode && screenshotRect?.pageIndex === index && screenshotShape === 'polygon' && screenshotRect.points?.length > 1"
              class="screenshot-polygon"
              :style="{ position: 'absolute', left: '0px', top: '0px', width: layout.width + 'px', height: layout.height + 'px' }"
            >
              <polyline
                :points="screenshotRect.points.map((p) => `${p.x},${p.y}`).join(' ')"
                fill="rgba(0, 0, 0, 0.08)"
                stroke="#00aaff"
                stroke-width="1"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="page-loading">
        <q-spinner-dots size="30px" color="primary" />
      </div>

      <!-- 错误状态 -->
      <div v-if="error" class="page-error">
        <div class="error-icon">⚠️</div>
        <div class="error-text">PDF 加载失败</div>
        <q-btn size="sm" color="primary" @click="props.file && loadPdf(props.file)"> 重试 </q-btn>
      </div>
    </div>

    <!-- 右侧笔记列表面板 -->
    <div class="note-panel-wrapper" v-if="isNotePanelOpen && notes.length > 0">
      <PdfNoteListPanel
        :notes="notes"
        :selectedNoteId="activeNoteId"
        @select="scrollToNote"
        @delete="deleteNote"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  defineExpose,
  type ComponentPublicInstance,
  type CSSProperties,
} from 'vue'
import { useRoute } from 'vue-router'
import { resourceManager } from '../services/storage/resource-storage'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import * as mupdf from 'mupdf'
import PdfGestureDebugPanel from './PdfGestureDebugPanel.vue'
import PdfNoteListPanel from './PdfNoteListPanel.vue'
import PdfNoteAnchor from './PdfNoteAnchor.vue'
import { IndexedDBService, type IndexedDBConfig } from '@/services/storage/indexeddb-service'

// ==================== 接口定义 ====================
const emit = defineEmits<{
  (e: 'screenshot-captured', blob: Blob): void
}>()

interface Props {
  file: File | null
}
const props = defineProps<Props>()
const store = usePdfViewerStore()
const route = useRoute()

// 笔画点结构
interface HighlightStrokePoint {
  x: number // PDF 页面坐标
  y: number
}

// 存储在内存中的笔画对象 (复用 DrawingBoard 思想)
interface StoredStroke {
  id: string
  points: HighlightStrokePoint[]
  mode: 'highlighter' | 'pen'
  color: string // CSS 颜色字符串
  size: number
  opacity: number
}

// ==================== DOM 引用 ====================
const viewerContainer = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const pageCanvasRefs = ref<HTMLCanvasElement[]>([])   // MuPDF 底图 Canvas
const inkCanvasRefs = ref<HTMLCanvasElement[]>([])    // 墨水层 Canvas
const drawingCanvasRefs = ref<(HTMLCanvasElement | null)[]>([]) // 实时预览 Canvas

const setDrawingCanvasRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el instanceof HTMLCanvasElement) drawingCanvasRefs.value[index] = el
}
const setPageCanvasRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el instanceof HTMLCanvasElement) pageCanvasRefs.value[index] = el
}
const setInkCanvasRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el instanceof HTMLCanvasElement) inkCanvasRefs.value[index] = el
}

// ==================== 状态管理 ====================
// PDF 基础状态
const isLoading = ref(false)
const error = ref<string | null>(null)
const pdfDoc = ref<mupdf.Document | null>(null)
const totalPages = ref(0)
const pageLayouts = ref<Array<{ width: number; height: number }>>([])
const totalHeight = ref(0)
const maxWidth = ref(0)
const pageBoundsCache = ref<Map<number, [number, number, number, number]>>(new Map())

// 视口状态
const toolbarHeight = ref(0)
const containerWidth = ref(0)
const currentPageIndex = ref(0)

// 交互模式
type PdfInteractionMode = 'hand' | 'note' | 'highlighter' | 'pen' | 'eraser-draw'
const currentMode = ref<PdfInteractionMode>('hand')

// 笔迹数据核心：Map<PageIndex, StrokeList>
const pageStrokes = reactive(new Map<number, StoredStroke[]>())

// 撤销/重做栈
interface HistoryAction {
  action: 'add' | 'remove'
  pageIndex: number
  strokes: StoredStroke[]
}
const undoStack = ref<HistoryAction[]>([])
const redoStack = ref<HistoryAction[]>([])

// 笔记 (NoteAnchor) 状态
interface PageNote {
  id: string
  pageIndex: number
  x: number
  y: number
  text: string
  createdAt?: number
}
const notes = ref<PageNote[]>([])
const activeNoteId = ref<string | null>(null)
const isNotePanelOpen = ref(false)
const selectedNoteId = ref<string | null>(null)
const editingInlineNote = ref<PageNote | null>(null)
const inlineNoteText = ref('')

// 当前正在绘制的笔画 (Preview)
interface CurrentStroke {
  pageIndex: number
  points: HighlightStrokePoint[]
  mode: 'highlight' | 'pen' | 'eraser'
}
const currentStroke = ref<CurrentStroke | null>(null)
const MIN_PEN_POINT_DIST2 = 0.8 * 0.8

// 手势参数
const minScale = ref(0.25)
const maxScale = ref(3.0)
const zoomThreshold = ref(0.25)
const panThreshold = ref(14)
const friction = ref(0.001)
const inertiaThreshold = ref(0.05)
const showDebugPanel = ref(false)

// 手势控制变量
let lastTouchDistance = 0
let pinchStartScale = 1
let pinchStartContentOffsetY = 0
let pinchStartContentOffsetX = 0
let pinchStartMouseY = 0
let pinchStartMouseX = 0
let pinchLastCenterY = 0
let isPinching = false
let lastPanX = 0
let lastPanY = 0
let lastPanTime = 0
let panVelocityX = 0
let panVelocity = 0
let inertiaFrameId: number | null = null
let gestureMode: 'none' | 'zoom' | 'pan' = 'none'
const isZooming = ref(false)
const isPointerToolSuspended = ref(false)
let lastToolMode: PdfInteractionMode | null = null

// 截图状态
type ScreenshotShape = 'rectangle' | 'polygon'
interface ScreenshotRect {
  pageIndex: number
  x1: number
  y1: number
  x2: number
  y2: number
  points?: { x: number; y: number }[]
}
const screenshotRect = ref<ScreenshotRect | null>(null)
const isDraggingScreenshot = ref(false)
const isScreenshotMode = ref(false)

const screenshotShape = computed<ScreenshotShape>(() => {
  return (store.drawingConfig as any).screenshotShape === 'polygon' ? 'polygon' : 'rectangle'
})

const isDrawingOrScreenshotMode = computed(
  () => isScreenshotMode.value || ['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)
)

const pageNotesByIndex = computed(() => {
  const groups: Record<number, PageNote[]> = {}
  for (const note of notes.value) {
    if (!groups[note.pageIndex]) groups[note.pageIndex] = []
    groups[note.pageIndex].push(note)
  }
  return groups
})

// ==================== 样式计算 ====================
const viewerOuterStyle = computed(() => ({
  position: 'relative' as const,
  width: `${maxWidth.value * store.scale}px`,
  minHeight: `${totalHeight.value * store.scale}px`,
}))

const viewerInnerStyle = computed(() => ({
  width: `${maxWidth.value}px`,
  minHeight: `${totalHeight.value}px`,
  position: 'relative' as const,
  transform: `scale(${store.scale})`,
  transformOrigin: 'top left',
}))

const pdfPageStyle = computed(() => ({
  height: `${window.innerHeight - toolbarHeight.value}px`,
}))

const getPageStyle = (layout: { width: number; height: number }) => ({
  position: 'relative' as const,
  width: `${layout.width}px`,
  height: `${layout.height}px`,
  margin: `0 0 ${store.pageGap}px`,
})

const getScreenshotRectStyle = (
  rect: ScreenshotRect,
  layout: { width: number; height: number }
): CSSProperties => {
  let x1 = Math.min(rect.x1, rect.x2)
  let y1 = Math.min(rect.y1, rect.y2)
  let x2 = Math.max(rect.x1, rect.x2)
  let y2 = Math.max(rect.y1, rect.y2)

  if (rect.points && rect.points.length > 0) {
    for (const p of rect.points) {
      if (p.x < x1) x1 = p.x
      if (p.y < y1) y1 = p.y
      if (p.x > x2) x2 = p.x
      if (p.y > y2) y2 = p.y
    }
  }
  return {
    position: 'absolute',
    left: `${x1}px`,
    top: `${y1}px`,
    width: `${x2 - x1}px`,
    height: `${y2 - y1}px`,
    boxSizing: 'border-box',
  }
}

// ==================== 核心优化：高分辨率渲染支持 ====================

// 动态调整 Canvas 分辨率以匹配当前缩放 (解决模糊问题)
const updateCanvasResolution = (canvas: HTMLCanvasElement, layout: { width: number; height: number }) => {
  const dpr = window.devicePixelRatio || 1
  const scale = store.scale || 1
  
  // 目标物理分辨率
  const targetWidth = Math.round(layout.width * scale * dpr)
  const targetHeight = Math.round(layout.height * scale * dpr)
  
  // 如果当前 Canvas 分辨率不匹配（容差 1px），则调整
  if (Math.abs(canvas.width - targetWidth) > 1 || Math.abs(canvas.height - targetHeight) > 1) {
    canvas.width = targetWidth
    canvas.height = targetHeight
    return true // 发生了重置
  }
  return false
}

// 获取绘图上下文并自动应用缩放变换
const getScaledContext = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  
  const dpr = window.devicePixelRatio || 1
  const scale = store.scale || 1
  
  // 重置变换矩阵，确保 scale 不会无限叠加
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // 应用缩放：将逻辑坐标 (0..layoutWidth) 映射到 物理坐标 (0..layoutWidth * scale * dpr)
  ctx.scale(scale * dpr, scale * dpr)
  
  return ctx
}

// ==================== 墨水层渲染逻辑 ====================

// 获取某页的笔迹列表，不存在则初始化
const getPageStrokeList = (pageIndex: number) => {
  if (!pageStrokes.has(pageIndex)) {
    pageStrokes.set(pageIndex, [])
  }
  return pageStrokes.get(pageIndex)!
}

// 渲染墨水层 (JS 绘制，极快)
const renderInkLayer = (pageIndex: number) => {
  const canvas = inkCanvasRefs.value[pageIndex]
  const layout = pageLayouts.value[pageIndex]
  if (!canvas || !layout) return

  // 1. 确保 Canvas 分辨率足够
  updateCanvasResolution(canvas, layout)

  const ctx = getScaledContext(canvas)
  if (!ctx) return

  // 清空画布 (使用逻辑坐标或物理坐标清空均可，这里用物理坐标更稳妥)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()

  const strokes = getPageStrokeList(pageIndex)
  if (strokes.length === 0) return

  // 遍历绘制所有保存的笔迹
  strokes.forEach(stroke => {
    // 坐标转换: PDF -> 页面逻辑坐标 (0..layout.width)
    // pdfPointToScreenOnPage 返回的是相对 layout.width 的坐标
    const screenPoints = stroke.points
      .map(p => pdfPointToScreenOnPage(p, pageIndex, layout))
      .filter((p): p is {x: number, y: number} => !!p)
    
    if (screenPoints.length < 2) return

    ctx.beginPath()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.size
    ctx.globalAlpha = stroke.opacity
    
    // 平滑绘制
    if (screenPoints.length < 3) {
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y)
      ctx.lineTo(screenPoints[1].x, screenPoints[1].y)
    } else {
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y)
      let i = 1
      for (; i < screenPoints.length - 1; i++) {
        const p0 = screenPoints[i-1]
        const p1 = screenPoints[i]
        const mid = { x: (p0.x + p1.x)/2, y: (p0.y + p1.y)/2 }
        ctx.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y)
      }
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y)
    }
    ctx.stroke()
  })
}

// 监听缩放变化，防抖重绘墨水层 (解决缩放后模糊问题)
let zoomDebounceTimer: number | null = null
watch(() => store.scale, () => {
  if (zoomDebounceTimer) clearTimeout(zoomDebounceTimer)
  zoomDebounceTimer = window.setTimeout(() => {
    // 缩放结束后，重新渲染所有可见页面的墨水层以匹配新分辨率
    pageLayouts.value.forEach((_, index) => {
      // 简单优化：只渲染已加载 canvas 的页面
      if (inkCanvasRefs.value[index]) {
        renderInkLayer(index)
      }
    })
  }, 300) // 300ms 防抖
})

// ==================== 交互事件处理 ====================

// Pointer Down: 开始绘图或截图
const handleHighlightPointerDown = async (event: PointerEvent, pageIndex: number, layout: any) => {
  if (isPointerToolSuspended.value || isZooming.value) return

  // 截图逻辑
  if (isScreenshotMode.value) {
    if (isPinching) return
    if ((event as any).isPrimary === false) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const pageEl = viewerContainer.value?.querySelectorAll<HTMLElement>('.page')[pageIndex]
    if (!pageEl) return

    const rect = pageEl.getBoundingClientRect()
    const scale = store.scale || 1
    const x = (event.clientX - rect.left) / scale
    const y = (event.clientY - rect.top) / scale

    if (screenshotShape.value === 'polygon') {
      screenshotRect.value = { pageIndex, x1: x, y1: y, x2: x, y2: y, points: [{ x, y }] }
    } else {
      screenshotRect.value = { pageIndex, x1: x, y1: y, x2: x, y2: y }
    }
    isDraggingScreenshot.value = true
    return
  }

  // 绘图工具逻辑
  if (!['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (!pdfDoc.value) return

  // 关键优化：在开始绘制前，立即调整 Drawing Canvas 的分辨率，确保书写清晰
  const drawCanvas = drawingCanvasRefs.value[pageIndex]
  if (drawCanvas) {
    updateCanvasResolution(drawCanvas, layout)
    // 必须清空一下，防止分辨率变化导致残留（虽然通常是空的）
    const ctx = getScaledContext(drawCanvas)
    if (ctx) {
       ctx.save()
       ctx.setTransform(1, 0, 0, 1, 0, 0)
       ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height)
       ctx.restore()
    }
  }

  const point = screenPointToPdfPoint(event.clientX, event.clientY, pageIndex, layout)
  if (!point) return

  const mode = currentMode.value === 'highlighter' ? 'highlight' : currentMode.value === 'pen' ? 'pen' : 'eraser'
  currentStroke.value = { pageIndex, points: [point], mode: mode as any }
}

// Pointer Move: 移动预览
const handleHighlightPointerMove = (event: PointerEvent, pageIndex: number, layout: any) => {
  if (isPointerToolSuspended.value || isZooming.value) return

  // 截图拖动
  if (isScreenshotMode.value && isDraggingScreenshot.value && screenshotRect.value) {
    const pageEl = viewerContainer.value?.querySelectorAll<HTMLElement>('.page')[pageIndex]
    if (!pageEl) return
    const rect = pageEl.getBoundingClientRect()
    const scale = store.scale || 1
    const x = (event.clientX - rect.left) / scale
    const y = (event.clientY - rect.top) / scale

    screenshotRect.value.x2 = x
    screenshotRect.value.y2 = y
    
    if (screenshotShape.value === 'polygon' && screenshotRect.value.points) {
      const pts = screenshotRect.value.points
      const last = pts[pts.length - 1]
      if ((x-last.x)**2 + (y-last.y)**2 > 1) pts.push({ x, y })
    }
    return
  }

  // 绘图移动
  if (!currentStroke.value || currentStroke.value.pageIndex !== pageIndex) return

  const point = screenPointToPdfPoint(event.clientX, event.clientY, pageIndex, layout)
  if (!point) return

  const stroke = currentStroke.value
  const lastPoint = stroke.points[stroke.points.length - 1]

  if (stroke.mode === 'pen') {
    const dx = point.x - lastPoint.x
    const dy = point.y - lastPoint.y
    if (dx * dx + dy * dy >= MIN_PEN_POINT_DIST2) stroke.points.push(point)
  } else {
    stroke.points.push(point)
  }

  if (stroke.mode === 'eraser') {
    drawEraserHitPreview(pageIndex, layout, stroke.points)
  } else {
    drawStrokePreview(pageIndex, layout)
  }
}

// Pointer Up: 结束并保存到 JS 内存
const handleHighlightPointerUp = async (event: PointerEvent, pageIndex: number, layout: any) => {
  if (isPointerToolSuspended.value || isZooming.value) {
    currentStroke.value = null; clearDrawingCanvas(pageIndex); return
  }

  // 截图结束
  if (isScreenshotMode.value && isDraggingScreenshot.value && screenshotRect.value) {
    isDraggingScreenshot.value = false
    captureScreenshot(pageIndex)
    return
  }

  if (!currentStroke.value || currentStroke.value.pageIndex !== pageIndex) {
    currentStroke.value = null; clearDrawingCanvas(pageIndex); return
  }

  const strokeData = currentStroke.value
  currentStroke.value = null
  clearDrawingCanvas(pageIndex)

  // 橡皮擦操作
  if (strokeData.mode === 'eraser') {
    handleEraserAction(pageIndex, strokeData.points, layout)
    return
  }

  // 笔画操作
  if (strokeData.points.length < 2) return

  let color = '#ff0000', size = 1, opacity = 1
  if (strokeData.mode === 'highlight') {
    color = store.drawingConfig.highlighterColor || '#FFFF00'
    size = store.drawingConfig.highlighterWidth || 12
    opacity = 0.5
  } else {
    color = store.drawingConfig.penColor || '#ff0000'
    size = store.drawingConfig.penWidth || 1
    opacity = 1.0
  }

  // 1. 创建对象
  const sourcePoints = strokeData.mode === 'pen' ? smoothStrokePoints(strokeData.points) : strokeData.points
  const newStroke: StoredStroke = {
    id: `stroke-${Date.now()}-${Math.random()}`,
    points: sourcePoints,
    mode: strokeData.mode as 'highlighter' | 'pen',
    color, size, opacity
  }

  // 2. 存入内存
  const list = getPageStrokeList(pageIndex)
  list.push(newStroke)

  // 3. 更新墨水层 (不调用 MuPDF，速度快)
  renderInkLayer(pageIndex)

  // 4. 记录历史
  undoStack.value.push({ action: 'add', pageIndex, strokes: [newStroke] })
  redoStack.value = []
}

// ==================== 橡皮擦逻辑 (JS 碰撞检测) ====================
const handleEraserAction = (pageIndex: number, eraserPoints: HighlightStrokePoint[], layout: any) => {
  const list = getPageStrokeList(pageIndex)
  if (list.length === 0) return

  // 动态阈值，根据缩放和页面高度计算
  const threshold = (layout.height / store.scale) * 0.015
  const threshold2 = threshold * threshold

  const survivingStrokes: StoredStroke[] = []
  const removedStrokes: StoredStroke[] = []

  list.forEach(stroke => {
    let hit = false
    // 简化碰撞检测：橡皮路径点与笔画点距离判断
    // 实际项目中可加入包围盒预判以优化性能
    for (const ep of eraserPoints) {
      if (hit) break
      for (const sp of stroke.points) {
        const dx = ep.x - sp.x
        const dy = ep.y - sp.y
        if (dx * dx + dy * dy < threshold2) {
          hit = true
          break
        }
      }
    }

    if (hit) removedStrokes.push(stroke)
    else survivingStrokes.push(stroke)
  })

  if (removedStrokes.length > 0) {
    pageStrokes.set(pageIndex, survivingStrokes)
    renderInkLayer(pageIndex)
    undoStack.value.push({ action: 'remove', pageIndex, strokes: removedStrokes })
    redoStack.value = []
  }
}

// ==================== 撤销 / 重做 ====================
const undoLastStroke = async () => {
  const lastAction = undoStack.value.pop()
  if (!lastAction) return

  const list = getPageStrokeList(lastAction.pageIndex)
  
  if (lastAction.action === 'add') {
    // 撤销添加：移除
    const idsToRemove = new Set(lastAction.strokes.map(s => s.id))
    const newList = list.filter(s => !idsToRemove.has(s.id))
    pageStrokes.set(lastAction.pageIndex, newList)
  } else {
    // 撤销删除：放回
    list.push(...lastAction.strokes)
  }

  renderInkLayer(lastAction.pageIndex)
  redoStack.value.push(lastAction)
}

const redoLastStroke = async () => {
  const action = redoStack.value.pop()
  if (!action) return

  const list = getPageStrokeList(action.pageIndex)

  if (action.action === 'add') {
    list.push(...action.strokes)
  } else {
    const idsToRemove = new Set(action.strokes.map(s => s.id))
    const newList = list.filter(s => !idsToRemove.has(s.id))
    pageStrokes.set(action.pageIndex, newList)
  }

  renderInkLayer(action.pageIndex)
  undoStack.value.push(action)
}

// ==================== 保存 (烧录墨水层到 PDF) ====================
const saveCurrentPdfToStorage = async () => {
  if (!pdfDoc.value) return
  const pdf = pdfDoc.value.asPDF()
  if (!pdf) return

  let hasChanges = false

  for (const [pageIndex, strokes] of pageStrokes.entries()) {
    if (strokes.length === 0) continue
    
    const page = pdf.loadPage(pageIndex) as mupdf.PDFPage
    
    // 将内存中的笔画写入 MuPDF
    strokes.forEach(stroke => {
      const annot = page.createAnnotation('Ink')
      const inkList = [stroke.points.map(p => [p.x, p.y] as mupdf.Point)]
      ;(annot as any).setInkList?.(inkList)
      
      const r = parseInt(stroke.color.slice(1,3), 16) / 255
      const g = parseInt(stroke.color.slice(3,5), 16) / 255
      const b = parseInt(stroke.color.slice(5,7), 16) / 255
      
      ;(annot as any).setColor?.([r,g,b])
      ;(annot as any).setBorderWidth?.(stroke.size)
      ;(annot as any).setOpacity?.(stroke.opacity)
      hasChanges = true
    })
    
    page.update()
    
    // 清空内存笔画，避免重复显示
    pageStrokes.set(pageIndex, [])
    renderInkLayer(pageIndex) // 清空墨水层
    await renderPage(pageIndex) // 重绘底图 (现在底图包含了刚写入的笔迹)
  }

  if (hasChanges) {
    try {
      // 增量保存
      const buffer = pdf.saveToBuffer('incremental')
      const uint8 = buffer.asUint8Array()
      const data = new Uint8Array(uint8)
      
      const resourceId = route.query.resourceId as string
      if (resourceId) {
        await resourceManager.updateFileData(resourceId, data)
        console.log('PDF Saved successfully')
      }
    } catch (e) {
      console.error('Save failed, falling back to full save', e)
    }
  }
}

// ==================== 辅助功能：截图 ====================
const captureScreenshot = (pageIndex: number) => {
  const rectInfo = screenshotRect.value
  screenshotRect.value = null
  if (!rectInfo) return

  let x1Css = Math.min(rectInfo.x1, rectInfo.x2)
  let y1Css = Math.min(rectInfo.y1, rectInfo.y2)
  let x2Css = Math.max(rectInfo.x1, rectInfo.x2)
  let y2Css = Math.max(rectInfo.y1, rectInfo.y2)

  if (rectInfo.points && rectInfo.points.length > 0) {
    for (const p of rectInfo.points) {
      if (p.x < x1Css) x1Css = p.x
      if (p.y < y1Css) y1Css = p.y
      if (p.x > x2Css) x2Css = p.x
      if (p.y > y2Css) y2Css = p.y
    }
  }

  const widthCss = x2Css - x1Css
  const heightCss = y2Css - y1Css
  if (widthCss <= 5 || heightCss <= 5) return

  const pageCanvas = pageCanvasRefs.value[pageIndex]
  if (!pageCanvas) return

  const clientWidth = pageCanvas.clientWidth || widthCss
  const clientHeight = pageCanvas.clientHeight || heightCss
  const dprX = pageCanvas.width / clientWidth
  const dprY = pageCanvas.height / clientHeight
  
  const sx = x1Css * dprX
  const sy = y1Css * dprY
  const sWidth = widthCss * dprX
  const sHeight = heightCss * dprY
  
  const offscreen = document.createElement('canvas')
  offscreen.width = sWidth
  offscreen.height = sHeight
  const ctx = offscreen.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, sWidth, sHeight)

  if (screenshotShape.value === 'polygon' && rectInfo.points && rectInfo.points.length > 2) {
    ctx.save()
    ctx.beginPath()
    for (let i = 0; i < rectInfo.points.length; i++) {
      const p = rectInfo.points[i]
      const px = (p.x - x1Css) * dprX
      const py = (p.y - y1Css) * dprY
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(pageCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight)
    ctx.restore()
  } else {
    ctx.drawImage(pageCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight)
  }

  offscreen.toBlob((blob) => {
    if (blob) emit('screenshot-captured', blob)
  }, 'image/jpeg', 0.9)
}

// ==================== 辅助功能：坐标转换 ====================
const screenPointToNormalized = (cx: number, cy: number, pIndex: number, layout: any) => {
  if (!viewerContainer.value) return null
  const pageEl = viewerContainer.value.querySelectorAll<HTMLElement>('.page')[pIndex]
  if (!pageEl) return null
  const rect = pageEl.getBoundingClientRect()
  const scale = store.scale || 1
  const nx = (cx - rect.left) / scale / layout.width
  const ny = (cy - rect.top) / scale / layout.height
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null
  return { x: nx, y: ny }
}

const normalizedToPdfPoint = (norm: { x: number; y: number }, pIndex: number) => {
  if (!pdfDoc.value) return null
  let bounds = pageBoundsCache.value.get(pIndex)
  if (!bounds) {
    const pdf = pdfDoc.value.asPDF()
    if (!pdf) return null
    const page = pdf.loadPage(pIndex)
    bounds = page.getBounds() as [number, number, number, number]
    page.destroy()
    pageBoundsCache.value.set(pIndex, bounds)
  }
  return { x: bounds[0] + norm.x * (bounds[2] - bounds[0]), y: bounds[1] + norm.y * (bounds[3] - bounds[1]) }
}

const screenPointToPdfPoint = (cx: number, cy: number, pIndex: number, layout: any) => {
  const norm = screenPointToNormalized(cx, cy, pIndex, layout)
  if (!norm) return null
  return normalizedToPdfPoint(norm, pIndex)
}

const pdfPointToScreenOnPage = (pdfP: { x: number; y: number }, pIndex: number, layout: any) => {
  let bounds = pageBoundsCache.value.get(pIndex)
  if (!bounds) return { x: 0, y: 0 }
  const nx = (pdfP.x - bounds[0]) / (bounds[2] - bounds[0])
  const ny = (pdfP.y - bounds[1]) / (bounds[3] - bounds[1])
  return { x: nx * layout.width, y: ny * layout.height }
}

// ==================== 辅助功能：平滑与绘图 ====================
const smoothStrokePoints = (points: HighlightStrokePoint[]) => {
  if (points.length <= 2) return points
  const subdivided: HighlightStrokePoint[] = []
  for (let i = 0; i < points.length - 1; i++) {
    subdivided.push(points[i])
    subdivided.push({ x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 })
  }
  subdivided.push(points[points.length - 1])
  if (subdivided.length <= 2) return subdivided
  
  const smoothed: HighlightStrokePoint[] = [subdivided[0]]
  for (let i = 1; i < subdivided.length - 1; i++) {
    smoothed.push({
      x: (subdivided[i - 1].x + subdivided[i].x + subdivided[i + 1].x) / 3,
      y: (subdivided[i - 1].y + subdivided[i].y + subdivided[i + 1].y) / 3,
    })
  }
  smoothed.push(subdivided[subdivided.length - 1])
  return smoothed
}

const clearDrawingCanvas = (i: number) => {
  const c = drawingCanvasRefs.value[i]
  if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
}

const drawStrokePreview = (pageIndex: number, layout: any) => {
  const stroke = currentStroke.value
  if (!stroke) return
  const canvas = drawingCanvasRefs.value[pageIndex]
  if (!canvas) return
  
  // 确保分辨率适配
  updateCanvasResolution(canvas, layout)
  const ctx = getScaledContext(canvas)
  if (!ctx) return
  
  // 清空（物理坐标）
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()

  if (stroke.points.length < 2) return

  const screenPoints = stroke.points.map(p => pdfPointToScreenOnPage(p, pageIndex, layout))
  
  let color = '#ff0000', width = 1
  if (stroke.mode === 'highlight') {
    const hex = store.drawingConfig.highlighterColor || '#FFFF00'
    const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16)
    color = `rgba(${r}, ${g}, ${b}, 0.5)`
    width = store.drawingConfig.highlighterWidth || 12
  } else {
    color = store.drawingConfig.penColor || '#ff0000'
    width = store.drawingConfig.penWidth || 1
  }

  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y)
  let i = 1
  for (; i < screenPoints.length - 1; i++) {
    const p0 = screenPoints[i-1], p1 = screenPoints[i]
    ctx.quadraticCurveTo(p0.x, p0.y, (p0.x+p1.x)/2, (p0.y+p1.y)/2)
  }
  ctx.lineTo(screenPoints[i].x, screenPoints[i].y)
  ctx.stroke()
}

const drawEraserHitPreview = (pageIndex: number, layout: any, eraserPoints: HighlightStrokePoint[]) => {
  const canvas = drawingCanvasRefs.value[pageIndex]
  if (!canvas) return
  
  updateCanvasResolution(canvas, layout)
  const ctx = getScaledContext(canvas)
  if (!ctx) return
  
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
  
  // 绘制橡皮轨迹
  const screenPoints = eraserPoints.map(p => pdfPointToScreenOnPage(p, pageIndex, layout))
  if (screenPoints.length < 2) return

  ctx.strokeStyle = 'rgba(0, 0, 255, 0.1)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y)
  for (let i = 1; i < screenPoints.length; i++) ctx.lineTo(screenPoints[i].x, screenPoints[i].y)
  ctx.stroke()
}

// ==================== 基础渲染逻辑 (MuPDF) ====================
const renderPage = async (pageIndex: number) => {
  if (!pdfDoc.value) return
  const layout = pageLayouts.value[pageIndex]
  const canvas = pageCanvasRefs.value[pageIndex]
  if (!layout || !canvas) return

  const doc = pdfDoc.value
  const page = doc.loadPage(pageIndex)
  const renderScale = 1.0
  const dpr = window.devicePixelRatio || 1
  const renderDpr = dpr * 1.2
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const bounds = page.getBounds()
  const rw = (bounds[2] - bounds[0]) * renderScale
  const rh = (bounds[3] - bounds[1]) * renderScale
  
  canvas.width = rw * renderDpr
  canvas.height = rh * renderDpr
  canvas.style.width = `${rw}px`
  canvas.style.height = `${rh}px`

  const matrix: mupdf.Matrix = [renderScale * renderDpr, 0, 0, renderScale * renderDpr, 0, 0]
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
  const pixels = pixmap.getPixels()
  const w = pixmap.getWidth(), h = pixmap.getHeight()
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = pixels[i * 3]
    rgba[i * 4 + 1] = pixels[i * 3 + 1]
    rgba[i * 4 + 2] = pixels[i * 3 + 2]
    rgba[i * 4 + 3] = 255
  }
  ctx.putImageData(new ImageData(rgba, w, h), 0, 0)
  pixmap.destroy()
  page.destroy()
}

const render = async () => {
  if (!pdfDoc.value) return
  const doc = pdfDoc.value
  const num = doc.countPages()
  totalPages.value = num
  const layouts: any[] = []
  let top = 0
  
  for (let i = 0; i < num; i++) {
    const p = doc.loadPage(i)
    const b = p.getBounds()
    const w = b[2] - b[0], h = b[3] - b[1]
    layouts.push({ width: w, height: h })
    top += h + store.pageGap
    p.destroy()
  }
  pageLayouts.value = layouts
  totalHeight.value = top - store.pageGap
  maxWidth.value = Math.max(...layouts.map(l => l.width))
  
  await nextTick()
  for (let i = 0; i < num; i++) {
    await renderPage(i)
  }
}

const loadPdf = async (file: File) => {
  isLoading.value = true
  try {
    if (pdfDoc.value) {
      pdfDoc.value.destroy()
      pdfDoc.value = null
    }
    const buf = await file.arrayBuffer()
    pdfDoc.value = mupdf.Document.openDocument(new Uint8Array(buf), 'application/pdf')
    await render()
    await loadNotesFromDb()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  }
  isLoading.value = false
}

// ==================== 笔记与通用交互 ====================
const handlePageClick = (e: MouseEvent, pageIndex: number, layout: any) => {
  if (['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)) return
  if (currentMode.value !== 'note') return
  if (!editingInlineNote.value && activeNoteId.value) {
    activeNoteId.value = null
    return
  }
  if (editingInlineNote.value) {
    handleInlineCreateConfirm(inlineNoteText.value)
    return
  }
  const norm = screenPointToNormalized(e.clientX, e.clientY, pageIndex, layout)
  if (!norm) return
  const tempId = `temp-${Date.now()}`
  editingInlineNote.value = { id: tempId, pageIndex, x: norm.x, y: norm.y, text: '' }
  inlineNoteText.value = ''
  activeNoteId.value = tempId
}

const handleInlineCreateConfirm = (text: string) => {
  if (!editingInlineNote.value) return
  const t = text.trim()
  if (t) {
    const note = { ...editingInlineNote.value, id: `${Date.now()}`, text: t, createdAt: Date.now() }
    notes.value.push(note)
    saveNotesToDb()
  }
  editingInlineNote.value = null
  inlineNoteText.value = ''
  activeNoteId.value = null
}

const handleInlineCreateCancel = () => {
  editingInlineNote.value = null
  inlineNoteText.value = ''
  activeNoteId.value = null
}

const onNoteMarkerClick = (n: PageNote) => {
  activeNoteId.value = n.id
  selectedNoteId.value = n.id
  isNotePanelOpen.value = true
}

const deleteNote = (n: PageNote) => {
  notes.value = notes.value.filter(item => item.id !== n.id)
  if (activeNoteId.value === n.id) activeNoteId.value = null
  saveNotesToDb()
}

const scrollToNote = (n: PageNote) => {
  if (!containerRef.value) return
  let offset = 0
  for (let i = 0; i < n.pageIndex; i++) offset += pageLayouts.value[i].height + store.pageGap
  offset += n.y * pageLayouts.value[n.pageIndex].height
  const target = offset * store.scale - (containerRef.value.clientHeight / 2)
  containerRef.value.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  activeNoteId.value = n.id
}

// IndexedDB
const notesDbService = IndexedDBService.getInstance({ dbName: 'pdf-notes-db', version: 1, stores: [{ name: 'docs', keyPath: 'docKey' }] })
const getDocKey = () => props.file ? `${props.file.name}|${props.file.size}` : 'unknown'
const loadNotesFromDb = async () => {
  try {
    const res = await notesDbService.get<{ notes: PageNote[] }>('docs', getDocKey())
    if (res?.notes) notes.value = res.notes
  } catch (e) {}
}
const saveNotesToDb = async () => {
  try { await notesDbService.put('docs', { docKey: getDocKey(), notes: notes.value }) } catch (e) {}
}

// ==================== 触摸与滚动逻辑 ====================
const getTouchDistance = (t1: Touch, t2: Touch) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

const handleTouchStart = (e: TouchEvent) => {
  if (isScreenshotMode.value && e.touches.length >= 2) {
    isDraggingScreenshot.value = false
    screenshotRect.value = null
  }
  if (e.touches.length === 2) {
    if (!isPointerToolSuspended.value) {
      lastToolMode = currentMode.value
      isPointerToolSuspended.value = true
      currentMode.value = 'hand'
    }
    isZooming.value = true
    e.preventDefault()
    
    const [t1, t2] = [e.touches[0], e.touches[1]]
    lastTouchDistance = getTouchDistance(t1, t2)
    pinchStartScale = store.scale
    const cx = (t1.clientX + t2.clientX) / 2
    const cy = (t1.clientY + t2.clientY) / 2
    pinchLastCenterY = cy
    lastPanX = cx
    lastPanY = cy
    lastPanTime = performance.now()
    isPinching = true
    
    const rect = containerRef.value!.getBoundingClientRect()
    pinchStartMouseX = cx - rect.left
    pinchStartMouseY = cy - rect.top
    pinchStartContentOffsetX = (containerRef.value!.scrollLeft + pinchStartMouseX) / pinchStartScale
    pinchStartContentOffsetY = (containerRef.value!.scrollTop + pinchStartMouseY) / pinchStartScale
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 2 && isPinching) {
    e.preventDefault()
    const [t1, t2] = [e.touches[0], e.touches[1]]
    const dist = getTouchDistance(t1, t2)
    const cx = (t1.clientX + t2.clientX) / 2
    const cy = (t1.clientY + t2.clientY) / 2
    const dx = cx - lastPanX
    const dy = cy - lastPanY
    
    // Pan
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      containerRef.value!.scrollLeft -= dx
      containerRef.value!.scrollTop -= dy
      const dt = performance.now() - lastPanTime
      if (dt > 0) {
        panVelocityX = -dx / dt
        panVelocity = -dy / dt
      }
      lastPanX = cx
      lastPanY = cy
      lastPanTime = performance.now()
    }

    // Zoom
    const scaleFactor = dist / lastTouchDistance
    if (Math.abs(scaleFactor - 1) > zoomThreshold.value) {
      const newScale = Math.max(minScale.value, Math.min(maxScale.value, pinchStartScale * scaleFactor))
      store.setScale(newScale)
      nextTick(() => {
        containerRef.value!.scrollLeft = pinchStartContentOffsetX * newScale - pinchStartMouseX
        containerRef.value!.scrollTop = pinchStartContentOffsetY * newScale - pinchStartMouseY
      })
    }
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  if (e.touches.length < 2) {
    if (isPointerToolSuspended.value) {
      isPointerToolSuspended.value = false
      if (lastToolMode) currentMode.value = lastToolMode
    }
    isZooming.value = false
    isPinching = false
    
    // Inertia
    if (Math.abs(panVelocity) > inertiaThreshold.value || Math.abs(panVelocityX) > inertiaThreshold.value) {
      const step = () => {
        const dt = 16
        containerRef.value!.scrollLeft += panVelocityX * dt
        containerRef.value!.scrollTop += panVelocity * dt
        panVelocityX *= Math.exp(-friction.value * dt)
        panVelocity *= Math.exp(-friction.value * dt)
        if (Math.abs(panVelocity) > inertiaThreshold.value || Math.abs(panVelocityX) > inertiaThreshold.value) {
          inertiaFrameId = requestAnimationFrame(step)
        }
      }
      inertiaFrameId = requestAnimationFrame(step)
    }
  }
}

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const oldScale = store.scale
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.max(minScale.value, Math.min(maxScale.value, oldScale + delta))
    if (newScale === oldScale) return

    const rect = containerRef.value!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const offX = (containerRef.value!.scrollLeft + mx) / oldScale
    const offY = (containerRef.value!.scrollTop + my) / oldScale
    
    store.setScale(newScale)
    nextTick(() => {
      containerRef.value!.scrollLeft = offX * newScale - mx
      containerRef.value!.scrollTop = offY * newScale - my
    })
  }
}

const handleScroll = () => {
  if (!containerRef.value) return
  const y = containerRef.value.scrollTop / (store.scale || 1)
  let sum = 0
  for (let i = 0; i < pageLayouts.value.length; i++) {
    const h = pageLayouts.value[i].height
    if (y >= sum && y < sum + h) {
      currentPageIndex.value = i
      break
    }
    sum += h + store.pageGap
  }
}

// 尺寸监听
const calculateToolbarHeight = () => {
  const el = document.querySelector('.unified-toolbar-container.variant-browser')
  toolbarHeight.value = el ? el.getBoundingClientRect().height : 48
}
onMounted(async () => {
  calculateToolbarHeight()
  if (containerRef.value) containerWidth.value = containerRef.value.clientWidth
  window.addEventListener('resize', () => {
    calculateToolbarHeight()
    if (containerRef.value) containerWidth.value = containerRef.value.clientWidth
  })
  if (props.file) await loadPdf(props.file)
})
onBeforeUnmount(() => {
  pageCanvasRefs.value = []
  if (pdfDoc.value) pdfDoc.value.destroy()
})

defineExpose({
  toggleDebugPanel: () => { isScreenshotMode.value = false; showDebugPanel.value = !showDebugPanel.value },
  toggleNoteMode: () => { isScreenshotMode.value = false; isNotePanelOpen.value = true; currentMode.value = 'note' },
  toggleHighlightMode: () => { isScreenshotMode.value = false; isNotePanelOpen.value = false; currentMode.value = 'highlighter' },
  togglePenMode: () => { isScreenshotMode.value = false; isNotePanelOpen.value = false; currentMode.value = 'pen' },
  toggleEraserMode: () => { isScreenshotMode.value = false; isNotePanelOpen.value = false; currentMode.value = 'eraser-draw' },
  toggleGestureMode: () => { isScreenshotMode.value = false; isNotePanelOpen.value = false; currentMode.value = 'hand' },
  toggleScreenshotMode: () => { isScreenshotMode.value = true; isDraggingScreenshot.value = false; screenshotRect.value = null; isNotePanelOpen.value = false; currentMode.value = 'hand' },
  undoLastStroke,
  redoLastStroke,
  saveCurrentPdfToStorage,
})
</script>

<style scoped>
.pdf-page-layout { display: flex; width: 100%; height: 100%; }
.pdf-page {flex: 1; overflow: auto; background-color: #0a0020; touch-action: auto; position: relative; }
.viewer-inner { touch-action: auto; position: relative; }
.viewer-inner.block-touch { touch-action: none; }
.note-panel-wrapper { flex-shrink: 0; }

.page { position: relative; display: block; background-color: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.page-canvas { display: block; }
.ink-canvas { position: absolute; top: 0; left: 0; pointer-events: none; z-index: 5; }
.drawing-canvas { position: absolute; top: 0; left: 0; pointer-events: none; z-index: 10; }

.screenshot-rect { border: 2px dashed #42a5f5; background-color: rgba(66, 165, 245, 0.15); pointer-events: none; z-index: 20; }
.page-loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.page-error { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 16px; color: #fff; z-index: 1000; }
.error-icon { font-size: 48px; }
.error-text { font-size: 16px; }

/* 笔记相关样式 */
.note-input-card { border-radius: 0px 12px 12px 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); background-color: #ffffff; padding: 0 5px; min-width: 160px; }
.note-input-card .q-field { flex: 1; }
.note-display-content { display: flex; align-items: flex-start; gap: 4px; width: 100%; }
.note-display-text { flex: 1; font-size: 12px; line-height: 1.4; color: #111827; padding: 6px 4px; white-space: pre-wrap; }
.note-display-actions { display: flex; align-items: center; gap: 2px; }
</style>