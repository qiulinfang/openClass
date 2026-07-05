<template>
  <div class="pdf-reader-container">
    <!-- 视口区域 -->
    <div
      class="viewport"
      :class="{
        'is-horizontal': readingDirection === 'horizontal',
        'is-drawing': readingDirection === 'horizontal' && (currentMode === 'pen' || currentMode === 'highlighter' || currentMode === 'eraser'),
        'direction-changing': isDirectionChanging
      }"
      ref="viewportRef"
      @wheel="handleWheel"
      @scroll="handleViewportScroll"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <div
        class="canvas-container"
        :class="{ 'is-horizontal': readingDirection === 'horizontal', 'is-suspended': layoutSuspended }"
        :style="containerStyle"
        ref="containerRef"
      >
        <div
          v-for="page in pageList"
          :key="page.pageIndex"
          class="page-wrapper"
          :class="{ 'is-horizontal': readingDirection === 'horizontal' }"
          :data-page-index="page.pageIndex"
          :style="{ width: page.viewWidth + 'px', height: page.viewHeight + 'px', left: page.x + 'px', top: page.y + 'px' }"
        >
          <!-- 永久挂载 Canvas，杜绝 DOM 频繁增删与渲染微任务滞后导致的白屏频闪 -->
          <!-- PDF 内容层 -->
          <canvas :ref="(el) => setPdfCanvasRef(el, page.pageIndex)"></canvas>
          <!-- 涂鸦/形状层 -->
          <canvas :ref="(el) => setInkCanvasRef(el, page.pageIndex)" class="ink-canvas"></canvas>
        </div>

        <div
          v-if="currentMode === 'screenshot' && screenshotDragRect"
          class="screenshot-overlay"
          :style="getRectStyle(screenshotDragRect)"
        ></div>
      </div>

      <!-- 加载状态提示 -->
      <div v-if="loading || isRendering" class="loading-overlay">
        <Loading :text="loadingProgressText" :size="48" theme="light" />
      </div>

      <div v-if="readingDirection === 'horizontal'" class="horizontal-nav">
        <q-btn
          class="nav-btn nav-left"
          round
          dense
          flat
          icon="chevron_left"
          :disable="isHorizontalFirstPage"
          @click.stop="goPrevPage"
        />
        <q-btn
          class="nav-btn nav-right"
          round
          dense
          flat
          icon="chevron_right"
          :disable="isHorizontalLastPage"
          @click.stop="goNextPage"
        />
      </div>

      <!-- 橡皮擦光标提示 -->
      <div
        v-if="eraserCursor.visible"
        class="eraser-cursor"
        :style="{
          left: eraserCursor.x + 'px',
          top: eraserCursor.y + 'px',
          width: eraserCursor.size + 'px',
          height: eraserCursor.size + 'px',
        }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  shallowRef,
  computed,
  onMounted,
  toRaw,
  nextTick,
  watch,
  onUnmounted,
  defineAsyncComponent,
  type ComponentPublicInstance,
} from 'vue'
import * as mupdf from 'mupdf'
import { IndexedDBService } from '@/services/storage/indexeddb-service'
import { resourceManager } from '@/services/storage/resource-storage'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import Loading from '@/components/base/Loading.vue'

// === 类型定义 ===
type ToolMode = 'pan' | 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'screenshot' | 'select'

interface Point {
  x: number
  y: number
}
interface Stroke {
  id: string
  type: 'pen' | 'highlighter' | 'rectangle'
  pageIndex: number
  points: Point[]
  color: string
  width: number
  opacity: number
  minX?: number
  minY?: number
  maxX?: number
  maxY?: number
}

interface HistoryAction {
  type: 'add' | 'remove' | 'update'
  strokes: Stroke[]
  before?: Stroke[]
  after?: Stroke[]
}

interface SavedData {
  docKey: string
  strokes: Stroke[]
  viewState?: {
    scale: number
    offsetX: number
    offsetY: number
  }
  updatedAt: number
}

// 选区操作类型定义
type SelectActionType = 'move' | 'box_select' | 'freeform_select'

interface SelectActionData {
  type: SelectActionType
  pageIndex: number
  lastPos: Point
  startPos: Point
  moved: boolean
  beforeStrokes: Stroke[]
}

// === Props ===
const props = defineProps<{
  file: File | null
  layoutSuspended?: boolean
}>()

// === Emit ===
const emit = defineEmits<{
  (e: 'screenshot-captured', blob: Blob): void
}>()

// === 配置常量 ===
const PAGE_GAP = 20

// MuPDF 渲染像素比（Canvas 实际像素 / CSS 像素），用于保证笔迹绘制与 PDF 底图对齐
const renderDprRef = ref(1)

// === 持久化服务 ===
const dbService = IndexedDBService.getInstance({
  dbName: 'pdf-ink-db',
  version: 2,
  stores: [
    { name: 'annotations', keyPath: 'docKey' },
    { name: 'page_annotations', keyPath: 'pageKey' },
  ],
})

// === LRU 缓存类实现 ===
class SimpleLRUCache<K, V> {
  private cache = new Map<K, V>()
  private max: number

  constructor(max = 12) {
    this.max = max
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key)
    if (item !== undefined) {
      this.cache.delete(key)
      this.cache.set(key, item)
    }
    return item
  }

  set(key: K, val: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.max) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, val)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear() {
    this.cache.clear()
  }
}

interface PageCacheData {
  rgbaData: Uint8ClampedArray
  width: number
  height: number
}

interface PageAnnotationsData {
  pageKey: string
  docKey: string
  pageIndex: number
  strokes: Stroke[]
  updatedAt: number
}

// 缓存最近 18 页的高清像素数据，防范反复重画
const pagePixelCache = new SimpleLRUCache<number, PageCacheData>(18)

// 判断某页是否需要进入渲染窗口 (可视区及其缓冲范围)
const shouldRenderPage = (pageIndex: number): boolean => {
  if (readingDirection.value === 'horizontal') {
    return Math.abs(pageIndex - horizontalPageIndex.value) <= 2
  } else {
    return Math.abs(pageIndex - pdfViewerStore.currentPage) <= 4
  }
}

// === 状态管理 ===
const pdfDoc = shallowRef<mupdf.Document | null>(null)
const fileName = ref('')
const pageCount = ref(0)
const pageList = ref<Array<{ pageIndex: number; viewWidth: number; viewHeight: number; x: number; y: number }>>([])
const scale = ref(1.0)
const offset = ref({ x: 0, y: 0 })
const loading = ref(false)
const isRendering = ref(false)
const isVisible = ref(false)
const hasRendered = ref(false)
const contentSize = ref({ width: 0, height: 0 })
let lastObservedViewportWidth = 0
let lastObservedViewportHeight = 0

const readingDirection = computed({
  get: () => pdfViewerStore.readingDirection,
  set: (val) => { pdfViewerStore.readingDirection = val }
})
const isDirectionChanging = ref(false)

// 工具状态
const currentMode = ref<ToolMode>('pan')
const pdfViewerStore = usePdfViewerStore()

// 数据存储
const allStrokes = shallowRef<Stroke[]>([])
const undoStack = ref<HistoryAction[]>([])
const redoStack = ref<HistoryAction[]>([])

// 交互临时状态
const dragStartPage = ref<number>(-1)
const currentDragPath = ref<Point[]>([])
const currentDragRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const screenshotDragRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const screenshotStartPoint = ref<Point | null>(null)
const isDrawingStarted = ref(false)

const selectionMode = ref<'rectangle' | 'freeform'>('rectangle')
const selectedStrokeIds = shallowRef(new Set<string>())
const selectDragRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const selectFreeformPath = ref<Point[] | null>(null)
let selectAction: null | {
  type: 'move' | 'box_select' | 'freeform_select'
  pageIndex: number
  lastPos: Point
  startPos: Point
  moved: boolean
  beforeStrokes: Stroke[]
} = null

const eraserCursor = ref<{ visible: boolean; x: number; y: number; size: number }>({
  visible: false,
  x: 0,
  y: 0,
  size: pdfViewerStore.drawingConfig.eraserSize,
})

// === 性能优化：空间索引 ===
const GRID_SIZE = 100 // 100px 分辨率的网格
// key: `${pageIndex}|${gridX}|${gridY}` -> Set<Stroke>
const spatialGrid = new Map<string, Set<Stroke>>()

// 渲染控制
const viewportRef = ref<HTMLDivElement | null>(null)
const pdfRefs = ref<HTMLCanvasElement[]>([])
const inkRefs = ref<HTMLCanvasElement[]>([])
let resizeObserver: ResizeObserver | null = null
const containerRef = ref<HTMLDivElement | null>(null)

// 用户交互状态（拖动/缩放/滚轮滚动）
const isInteracting = ref(false)
let interactionTimer: any = null

const clearInteractionTimeout = () => {
  if (interactionTimer) clearTimeout(interactionTimer)
  interactionTimer = setTimeout(() => {
    interactionTimer = null
    isInteracting.value = false
  }, 150)
}

let pendingViewportResizeWhileSuspended = false
let renderGeneration = 0

// 写字模式下在非 PDF 区域拖动时，降级为平移
let isPanningInDrawMode = false

// 手势控制
const activePointers = new Map<number, Point>()
let lastPointerPos = { x: 0, y: 0 }
let velocity = { x: 0, y: 0 }
let rafId: number | null = null
let lastPinchDist = 0
let lastPinchCenter = { x: 0, y: 0 }

const horizontalPageIndex = ref(0)
let horizontalScrollTimer: any = null
let horizontalScrollEndTimer: any = null
let horizontalScaleResetRaf: number | null = null
let horizontalScaleResetStartAt = 0
let horizontalScaleResetFrom = 1
let lastViewportScrollLeft = 0
let lastViewportScrollTop = 0

const isHorizontalScrolling = ref(false)

// 计算属性
const containerStyle = computed(() => {
  const base = {
    width: `${contentSize.value.width}px`,
    height: `${contentSize.value.height}px`,
  }
  return {
    ...base,
    transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`,
  }
})
const loadingProgressText = computed(() => '正在加载...')
const isHorizontalFirstPage = computed(() => readingDirection.value === 'horizontal' && horizontalPageIndex.value <= 0)
const isHorizontalLastPage = computed(
  () => readingDirection.value === 'horizontal' && horizontalPageIndex.value >= Math.max(0, pageCount.value - 1)
)

watch(
  () => pdfViewerStore.drawingConfig.eraserSize,
  (val) => {
    console.log('[PdfPage][eraser] size changed from store ->', val)
    if (currentMode.value === 'eraser' && eraserCursor.value.visible) {
      eraserCursor.value = { ...eraserCursor.value, size: getEraserCursorSize() }
    }
  }
)

watch(
  () => props.layoutSuspended,
  (suspended, previous) => {
    if (suspended) {
      renderGeneration += 1
      return
    }
    if (previous && pendingViewportResizeWhileSuspended) {
      pendingViewportResizeWhileSuspended = false
      requestAnimationFrame(() => {
        refreshLayoutAfterViewportResize()
      })
    }
  }
)

// 页面滚动/翻页联动监听，同步更新当前可见页码给 Store
watch(
  [() => offset.value.y, () => scale.value, () => readingDirection.value, () => horizontalPageIndex.value],
  () => {
    if (pageList.value.length === 0) return
    if (readingDirection.value === 'vertical') {
      const idx = getCurrentVerticalPageIndex()
      pdfViewerStore.setCurrentPage(idx)
    } else {
      pdfViewerStore.setCurrentPage(horizontalPageIndex.value)
    }
  },
  { immediate: true, deep: true }
)

// 监听当前激活页码变化，动态分配/回收视口内外 Canvas 的物理像素尺寸与渲染内容
watch(
  [() => pdfViewerStore.currentPage, () => horizontalPageIndex.value],
  () => {
    if (pageList.value.length === 0) return
    
    for (let i = 0; i < pageCount.value; i++) {
      const inViewport = shouldRenderPage(i)
      const pdfCanvas = pdfRefs.value[i]
      const inkCanvas = inkRefs.value[i]
      
      if (inViewport) {
        // 如果进入视口缓冲区且当前尚未分配像素（尺寸为 0）
        if (pdfCanvas && pdfCanvas.width === 0) {
          // 如果用户正在交互（滑动/缩放中），且该页面没有内存快照，则延迟渲染，防止卡顿
          const hasCache = pagePixelCache.has(i)
          if (isInteracting.value && !hasCache) {
            continue
          }
          
          renderPageCanvas(i)
          ensurePageStrokesLoaded(i).then(() => {
            renderInkLayer(i)
          })
        }
      } else {
        // 如果移出视口缓冲区，立刻将尺寸设为 0，彻底释放 GPU 显存，保持 DOM 节点留空
        if (pdfCanvas && pdfCanvas.width > 0) {
          pdfCanvas.width = 0
          pdfCanvas.height = 0
        }
        if (inkCanvas && inkCanvas.width > 0) {
          inkCanvas.width = 0
          inkCanvas.height = 0
        }
      }
    }
  }
)

// 当用户停止滑动/缩放（交互结束）时，自动补画可视区内跳过的高清图像
watch(isInteracting, (interacting) => {
  if (!interacting) {
    requestAnimationFrame(() => {
      if (pageList.value.length === 0) return
      for (let i = 0; i < pageCount.value; i++) {
        if (shouldRenderPage(i)) {
          const pdfCanvas = pdfRefs.value[i]
          if (pdfCanvas && pdfCanvas.width === 0) {
            renderPageCanvas(i)
            ensurePageStrokesLoaded(i).then(() => {
              renderInkLayer(i)
            })
          }
        }
      }
    })
  }
})

onMounted(() => {
  if (props.file) {
    loadFile(props.file)
  }
  setupResizeObserver()
})

onUnmounted(() => {
  stopInertia()
  if (resizeObserver) resizeObserver.disconnect()
})

const loadedPages = ref<Record<number, boolean>>({})

const ensurePageStrokesLoaded = async (pageIndex: number) => {
  if (loadedPages.value[pageIndex]) return
  if (!props.file) return
  
  const key = getDocKey(props.file)
  const pageKey = `${key}|${pageIndex}`
  
  try {
    const data = await dbService.get<PageAnnotationsData>('page_annotations', pageKey)
    if (data && data.strokes) {
      const currentIds = new Set(allStrokes.value.map(s => s.id))
      const newStrokes = data.strokes.filter(s => !currentIds.has(s.id))
      
      newStrokes.forEach((s) => {
        if (s.minX == null) {
          Object.assign(s, calculateBBox(s.points, s.width))
        }
        addToSpatialIndex(s)
      })
      allStrokes.value = [...allStrokes.value, ...newStrokes]
    }
  } catch (err) {
    console.error(`[PdfPage] 加载第 ${pageIndex} 页笔迹失败:`, err)
  } finally {
    loadedPages.value[pageIndex] = true
  }
}

const setPdfCanvasRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el) {
    pdfRefs.value[index] = el as HTMLCanvasElement
    if (shouldRenderPage(index)) {
      // 1. 同步瞬间触发 PDF 页面像素渲染（如果缓存命中则为 0ms 瞬间呈画，杜绝异步微任务导致的空白帧与频闪）
      renderPageCanvas(index)
      // 2. 异步载入笔迹数据库，并在之后单独重绘涂鸦层
      ensurePageStrokesLoaded(index).then(() => {
        renderInkLayer(index)
      })
    } else {
      // 视口外初始化为 0 尺寸，节约 GPU 显存
      const canvas = el as HTMLCanvasElement
      canvas.width = 0
      canvas.height = 0
    }
  } else {
    delete pdfRefs.value[index]
    delete pageRenderedGeneration.value[index]
  }
}

const setInkCanvasRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el) {
    inkRefs.value[index] = el as HTMLCanvasElement
    if (shouldRenderPage(index)) {
      renderInkLayer(index)
    } else {
      // 视口外初始化为 0 尺寸，节约 GPU 显存
      const canvas = el as HTMLCanvasElement
      canvas.width = 0
      canvas.height = 0
    }
  } else {
    delete inkRefs.value[index]
  }
}

// 页面导航处理
const goToHorizontalPage = async (pageIndex: number) => {
  const rawDoc = toRaw(pdfDoc.value)
  if (!rawDoc) return
  const next = Math.min(Math.max(pageIndex, 0), Math.max(0, rawDoc.countPages() - 1))
  if (next === horizontalPageIndex.value) return
  horizontalPageIndex.value = next

  // 切页时重置缩放/状态
  if (scale.value !== 1) scale.value = 1
  offset.value = { x: 0, y: 0 }

  await prefetchDimensionsAndLayout(rawDoc)
  hasRendered.value = false
  await nextTick()
  await tryRenderContent()

  // 单页切换后确保居中（并做边界修正）
  requestAnimationFrame(() => {
    centerContent()
    clampOffset()
  })
}

// 处理上一页按钮点击
const goPrevPage = () => goToHorizontalPage(horizontalPageIndex.value - 1)
// 处理下一页按钮点击
const goNextPage = () => goToHorizontalPage(horizontalPageIndex.value + 1)

// 跳转到指定页面 (大纲/滑块专用)
const jumpToPage = async (pageIndex: number) => {
  if (pageIndex < 0 || pageIndex >= pageCount.value) return

  if (readingDirection.value === 'horizontal') {
    goToHorizontalPage(pageIndex)
  } else {
    if (!viewportRef.value || pageList.value.length === 0) return
    const rect = viewportRef.value.getBoundingClientRect()
    const maxW = Math.max(...pageList.value.map((p) => p.viewWidth))
    const targetPage = pageList.value.find((p) => p.pageIndex === pageIndex)
    if (targetPage) {
      // 保持当前缩放，并定位 Y 到目标页的顶部 (留20px内边距)
      offset.value = {
        x: (rect.width - maxW * scale.value) / 2,
        y: 20 - targetPage.y * scale.value,
      }
      clampOffset()
    }
  }
}



// === 绘图与渲染逻辑 ===



let highlighterRafId: number | null = null
let highlighterPending: { pageIndex: number; points: Point[] } | null = null

let penRafId: number | null = null
let penPending: { pageIndex: number; points: Point[] } | null = null

let eraserRafId: number | null = null
let eraserPending: { pageIndex: number; x: number; y: number } | null = null






const drawStartDot = (pageIndex: number, p: Point, mode: ToolMode) => {
  if (mode !== 'pen' && mode !== 'highlighter') return
  const ctx = getInkContext(pageIndex)
  if (!ctx) return
  const q = renderDprRef.value || 1
  const cfg = getToolConfigForMode(mode)
  ctx.save()
  ctx.globalAlpha = cfg.opacity ?? 1.0
  if (mode === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply'
  }
  ctx.fillStyle = cfg.color
  ctx.beginPath()
  ctx.arc(p.x * q, p.y * q, (cfg.width * q) / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  ctx.save()
  ctx.scale(renderDprRef.value || 1, renderDprRef.value || 1)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = stroke.opacity

  if (stroke.type === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply'
  }

  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width

  if (stroke.type === 'rectangle') {
    const [start, end] = stroke.points
    const w = end.x - start.x
    const h = end.y - start.y
    ctx.strokeRect(start.x, start.y, w, h)
  } else {
    const points = stroke.points
    if (points.length === 1) {
      ctx.fillStyle = stroke.color
      ctx.beginPath()
      ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i]
        const p1 = points[i + 1]
        const midX = (p0.x + p1.x) / 2
        const midY = (p0.y + p1.y) / 2
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY)
      }
      const last = points[points.length - 1]
      ctx.lineTo(last.x, last.y)
      ctx.stroke()
    }
  }
  ctx.restore()
}

// 获取类工具函数
// 获取橡皮擦光标大小
const getEraserCursorSize = () => pdfViewerStore.drawingConfig.eraserSize * scale.value * 2

// 生成文档唯一标识键
const getDocKey = (file: File) => `${file.name}|${file.size}`

// 获取指定页面选中的笔迹
const getSelectedStrokesOnPage = (pageIndex: number) => {
  const ids = selectedStrokeIds.value
  return allStrokes.value.filter((s) => s.pageIndex === pageIndex && ids.has(s.id))
}

// 获取笔迹组的边界框
const getGroupBBox = (strokes: Stroke[]) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  strokes.forEach((s) => {
    if (s.minX == null || s.maxX == null || s.minY == null || s.maxY == null) return
    minX = Math.min(minX, s.minX)
    minY = Math.min(minY, s.minY)
    maxX = Math.max(maxX, s.maxX)
    maxY = Math.max(maxY, s.maxY)
  })
  if (minX === Infinity) return null
  return { minX, minY, maxX, maxY }
}

// 根据模式获取工具配置
const getToolConfigForMode = (mode: ToolMode) => {
  if (mode === 'pen') {
    return {
      color: pdfViewerStore.drawingConfig.penColor,
      width: pdfViewerStore.drawingConfig.penWidth,
      opacity: pdfViewerStore.drawingConfig.penOpacity ?? 1.0,
    }
  }
  if (mode === 'highlighter') {
    return {
      color: pdfViewerStore.drawingConfig.highlighterColor,
      width: pdfViewerStore.drawingConfig.highlighterWidth,
      opacity: pdfViewerStore.drawingConfig.highlighterOpacity ?? 0.4,
    }
  }
  return {
    color: '#FF0000',
    width: 2,
    opacity: 1.0,
  }
}

// 将客户端坐标转换为内容坐标
const getContentPoint = (clientX: number, clientY: number): Point | null => {
  if (!viewportRef.value) return null
  const rect = viewportRef.value.getBoundingClientRect()
  const mx = clientX - rect.left
  const my = clientY - rect.top
  return {
    x: (mx - offset.value.x) / scale.value,
    y: (my - offset.value.y) / scale.value,
  }
}

// 获取画布绘制上下文
const getInkContext = (pageIndex: number) => {
  const canvas = inkRefs.value[pageIndex]
  if (!canvas) return null
  return canvas.getContext('2d')
}

// 将客户端坐标转换为PDF页面坐标
const getPdfPoint = (
  clientX: number,
  clientY: number
): { pageIndex: number; x: number; y: number } | null => {
  if (!viewportRef.value || pageList.value.length === 0) return null
  const rect = viewportRef.value.getBoundingClientRect()
  const mx = clientX - rect.left
  const my = clientY - rect.top

  const localX = (mx - offset.value.x) / scale.value
  const localY = (my - offset.value.y) / scale.value

  for (let i = 0; i < pageList.value.length; i++) {
    const p = pageList.value[i]
    const withinY = localY >= p.y && localY <= p.y + p.viewHeight
    const withinX = localX >= p.x && localX <= p.x + p.viewWidth
    if (withinY && withinX) {
      return {
        pageIndex: p.pageIndex,
        x: localX - p.x,
        y: localY - p.y,
      }
    }
  }
  return null
}

// 获取矩形样式对象
const getRectStyle = (rect: { x: number; y: number; w: number; h: number }) => ({
  left: rect.x + 'px',
  top: rect.y + 'px',
  width: rect.w + 'px',
  height: rect.h + 'px',
})

// 获取当前纵向页面索引
const getCurrentVerticalPageIndex = (): number => {
  if (!viewportRef.value || pageList.value.length === 0) return 0
  const rect = viewportRef.value.getBoundingClientRect()
  const centerY = rect.height / 2
  const contentCenterY = (centerY - offset.value.y) / (scale.value || 1)
  for (const p of pageList.value) {
    if (contentCenterY >= p.y && contentCenterY < p.y + p.viewHeight) return p.pageIndex
  }
  return pageList.value[pageList.value.length - 1].pageIndex
}

// 判断类工具函数
// 判断点是否在选中区域边界内
const isPointInSelectionBounds = (pageIndex: number, x: number, y: number) => {
  const selected = getSelectedStrokesOnPage(pageIndex)
  const bbox = getGroupBBox(selected)
  if (!bbox) return false
  const padding = 8
  return (
    x >= bbox.minX - padding &&
    x <= bbox.maxX + padding &&
    y >= bbox.minY - padding &&
    y <= bbox.maxY + padding
  )
}

// 判断点是否在多边形内
const isPointInPolygon = (x: number, y: number, polygon: Point[]) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// 选区操作：检查点是否在已有选区范围内
const isPointInExistingSelection = (pageIndex: number, pos: Point): boolean => {
  return selectedStrokeIds.value.size > 0 && isPointInSelectionBounds(pageIndex, pos.x, pos.y)
}

// 计算类工具函数
// 计算笔迹边界框
const calculateBBox = (points: Point[], width: number) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  const padding = width / 2 + 2
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding }
}

// 计算点到线段的距离
const distancePointToSegment = (px: number, py: number, ax: Point, bx: Point) => {
  const dx = bx.x - ax.x
  const dy = bx.y - ax.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax.x, py - ax.y)
  let t = ((px - ax.x) * dx + (py - ax.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = ax.x + t * dx
  const projY = ax.y + t * dy
  return Math.hypot(px - projX, py - projY)
}

// 创建类工具函数
const createStrokeObject = (pageIndex: number, points: Point[], mode: string): Stroke => {
  const isHighlighter = mode === 'highlighter'
  const isRect = mode === 'rectangle'
  const cfg = getToolConfigForMode(mode as ToolMode)
  const width = isHighlighter ? cfg.width : isRect ? 3 : cfg.width
  const stroke: Stroke = {
    id: Math.random().toString(36).slice(2),
    type: mode as any,
    pageIndex,
    points: [...points],
    color: isRect ? '#FF0000' : cfg.color,
    width,
    opacity: isRect ? 1.0 : cfg.opacity ?? 1.0,
  }
  Object.assign(stroke, calculateBBox(stroke.points, stroke.width))
  return stroke
}

// 选区操作：创建设置移动操作
const createSelectMoveAction = (
  pageIndex: number,
  pos: Point,
  strokes?: Stroke[]
): SelectActionData => {
  const selected = strokes ?? getSelectedStrokesOnPage(pageIndex)
  const before = selected.map((s) => JSON.parse(JSON.stringify(s)) as Stroke)
  return {
    type: 'move',
    pageIndex,
    lastPos: { x: pos.x, y: pos.y },
    startPos: { x: pos.x, y: pos.y },
    moved: false,
    beforeStrokes: before,
  }
}

// 命中测试类工具函数
// 笔迹命中测试
const strokeHitTest = (pageIndex: number, x: number, y: number) => {
  const searchRadius = 40
  const minGridX = Math.floor((x - searchRadius) / GRID_SIZE)
  const maxGridX = Math.floor((x + searchRadius) / GRID_SIZE)
  const minGridY = Math.floor((y - searchRadius) / GRID_SIZE)
  const maxGridY = Math.floor((y + searchRadius) / GRID_SIZE)

  const candidates = new Set<Stroke>()
  for (let gx = minGridX; gx <= maxGridX; gx++) {
    for (let gy = minGridY; gy <= maxGridY; gy++) {
      const key = `${pageIndex}|${gx}|${gy}`
      const cell = spatialGrid.get(key)
      if (cell) cell.forEach((s) => candidates.add(s))
    }
  }

  let best: Stroke | null = null
  let bestDist = Infinity

  candidates.forEach((stroke) => {
    if (stroke.pageIndex !== pageIndex) return
    if (stroke.minX == null || stroke.maxX == null || stroke.minY == null || stroke.maxY == null)
      return

    const padding = Math.max(10, (stroke.width ?? 2) / 2 + 8)
    if (
      x < stroke.minX - padding ||
      x > stroke.maxX + padding ||
      y < stroke.minY - padding ||
      y > stroke.maxY + padding
    ) {
      return
    }

    if (stroke.type === 'rectangle') {
      const a = stroke.points[0]
      const b = stroke.points[1]
      const minX = Math.min(a.x, b.x)
      const maxX = Math.max(a.x, b.x)
      const minY = Math.min(a.y, b.y)
      const maxY = Math.max(a.y, b.y)
      const dx = Math.min(Math.abs(x - minX), Math.abs(x - maxX))
      const dy = Math.min(Math.abs(y - minY), Math.abs(y - maxY))
      const inside =
        x >= minX - padding && x <= maxX + padding && y >= minY - padding && y <= maxY + padding
      const dist = inside ? Math.min(dx, dy) : Infinity
      if (dist < bestDist) {
        bestDist = dist
        best = stroke
      }
      return
    }

    const pts = stroke.points
    const thr = Math.max(10, (stroke.width ?? 2) / 2 + 8)
    let minDist = Infinity
    if (pts.length === 1) {
      minDist = Math.hypot(pts[0].x - x, pts[0].y - y)
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const dist = distancePointToSegment(x, y, pts[i], pts[i + 1])
        if (dist < minDist) minDist = dist
      }
    }
    if (minDist <= thr && minDist < bestDist) {
      bestDist = minDist
      best = stroke
    }
  })

  return best
}

// 自由选择模式下的笔迹命中测试
const hitTestFreeform = (pageIndex: number, path: Point[]) => {
  if (!path || path.length < 3) return new Set<string>()

  const next = new Set<string>()
  allStrokes.value.forEach((s) => {
    if (s.pageIndex !== pageIndex) return
    if (s.minX == null || s.maxX == null || s.minY == null || s.maxY == null) return

    const corners: Point[] = [
      { x: s.minX, y: s.minY },
      { x: s.maxX, y: s.minY },
      { x: s.maxX, y: s.maxY },
      { x: s.minX, y: s.maxY },
    ]
    const isInside = corners.some((c) => isPointInPolygon(c.x, c.y, path))
    if (isInside) next.add(s.id)
  })

  return next
}



/*
  事件处理方法
*/
// 处理鼠标滚轮事件
const handleWheel = (e: WheelEvent) => {
  isInteracting.value = true
  clearInteractionTimeout()

  if (e.ctrlKey || e.metaKey) {
    if (readingDirection.value === 'horizontal' && isHorizontalScrolling.value && scale.value !== 1) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    zoomAt(-e.deltaY, e.clientX, e.clientY)
  } else {
    if (readingDirection.value === 'horizontal') {
      return
    }
    offset.value.x -= e.deltaX
    offset.value.y -= e.deltaY
    clampOffset()
  }
  // 滚动/缩放停止后保存视图（这里做个简单的防抖保存）
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => scheduleSaveToDb(0), 1000)
}

// 处理视口滚动事件（纵向模式翻页）
const handleViewportScroll = () => {
  // 横向已改为单页模式，不再依赖原生 scroll 进行切页
  if (readingDirection.value === 'horizontal') return
  if (!viewportRef.value) return

  const currentLeft = viewportRef.value.scrollLeft
  const currentTop = viewportRef.value.scrollTop
  const dx = Math.abs(currentLeft - lastViewportScrollLeft)
  const dy = Math.abs(currentTop - lastViewportScrollTop)
  lastViewportScrollLeft = currentLeft
  lastViewportScrollTop = currentTop

  // 横向模式允许上下滚动（scrollTop 变化），但不应该触发“切页滚动”逻辑与缩放恢复
  if (dx < 1 && dy >= 1) {
    return
  }

  isHorizontalScrolling.value = true
  if (horizontalScrollEndTimer) clearTimeout(horizontalScrollEndTimer)
  horizontalScrollEndTimer = setTimeout(() => {
    horizontalScrollEndTimer = null
    isHorizontalScrolling.value = false
  }, 160)

  // 滚动过程中平滑把缩放恢复到 1（更丝滑，而不是滚动结束后瞬间跳变）
  if (scale.value !== 1 && horizontalScaleResetRaf == null) {
    horizontalScaleResetStartAt = performance.now()
    horizontalScaleResetFrom = scale.value
    const duration = 180
    const step = (now: number) => {
      const t = Math.min(1, (now - horizontalScaleResetStartAt) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      scale.value = horizontalScaleResetFrom + (1 - horizontalScaleResetFrom) * eased
      if (t < 1) {
        horizontalScaleResetRaf = requestAnimationFrame(step)
      } else {
        scale.value = 1
        horizontalScaleResetRaf = null
      }
    }
    horizontalScaleResetRaf = requestAnimationFrame(step)
  }

  if (horizontalScrollTimer) clearTimeout(horizontalScrollTimer)
  horizontalScrollTimer = setTimeout(() => {
    horizontalScrollTimer = null
    if (!viewportRef.value) return
    const w = viewportRef.value.clientWidth || 1
    const idx = Math.round(viewportRef.value.scrollLeft / w)
    if (idx !== horizontalPageIndex.value) {
      horizontalPageIndex.value = idx
      // 兜底：滚动结束后确保 scale 完全恢复
      if (scale.value !== 1) scale.value = 1
    }
  }, 120)
}

// ==================== 指针按下事件 ====================
// 处理指针按下事件（开始绘制/拖动）
const onPointerDown = (e: PointerEvent) => {
  isInteracting.value = true

  const shouldLockScrollForDrawInHorizontal =
    readingDirection.value === 'horizontal' &&
    (currentMode.value === 'pen' || currentMode.value === 'highlighter' || currentMode.value === 'eraser')

  if (viewportRef.value && (readingDirection.value !== 'horizontal' || shouldLockScrollForDrawInHorizontal)) {
    viewportRef.value.setPointerCapture(e.pointerId)
  }
  if (shouldLockScrollForDrawInHorizontal) {
    e.preventDefault()
  }
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  stopInertia()

  if (activePointers.size === 1) {
    lastPointerPos = { x: e.clientX, y: e.clientY }
    const loc = getPdfPoint(e.clientX, e.clientY)

    handlePointerMoveForEraserCursor(e)

    // 截图模式：不依赖 loc 命中页面（横向单页布局下 getPdfPoint 可能返回 null）
    if (currentMode.value === 'screenshot') {
      const p = getContentPoint(e.clientX, e.clientY)
      if (p) {
        screenshotStartPoint.value = p
        screenshotDragRect.value = { x: p.x, y: p.y, w: 0, h: 0 }
        isDrawingStarted.value = true
        // 复用现有的 finishDrawing 流程：确保 dragStartPage 非 -1
        if (dragStartPage.value === -1) {
          dragStartPage.value = readingDirection.value === 'horizontal' ? horizontalPageIndex.value : 0
        }
      }
      return
    }

    // 非 pan 模式：优先在页面内交互；若不在页面内，则允许平移
    if (currentMode.value !== 'pan' && !loc) {
      isPanningInDrawMode = true
      return
    }

    if (currentMode.value !== 'pan' && loc) {
      isPanningInDrawMode = false
      dragStartPage.value = loc.pageIndex
      currentDragPath.value = [{ x: loc.x, y: loc.y }]
      isDrawingStarted.value = false

      // 选择模式处理
      if (currentMode.value === 'select') {
        // 1) 已有选区：允许在蓝色虚线框内部直接拖动
        if (isPointInExistingSelection(loc.pageIndex, loc)) {
          selectAction = createSelectMoveAction(loc.pageIndex, loc)
          renderInkLayer(loc.pageIndex)
          return
        }

        // 2) 命中笔迹：进入拖动（或重选）
        const hitAction = handleSelectHitTest(loc.pageIndex, loc)
        if (hitAction) {
          selectAction = hitAction
          renderInkLayer(loc.pageIndex)
        } else {
          // 3) 未命中：进入选区模式
          initSelectionMode(loc.pageIndex, loc)
        }
        return
      }

      // 其他模式：仅在非 pen/highlighter 时立即渲染
      if (currentMode.value !== 'pen' && currentMode.value !== 'highlighter') {
        renderInkLayer(loc.pageIndex)
      }
    } else {
      isPanningInDrawMode = false
    }
  } else if (activePointers.size === 2) {
    finishDrawing(false)
    const pts = Array.from(activePointers.values())
    lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    lastPinchCenter = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
  }
}

// ==================== 指针移动事件 ====================
// 处理指针移动事件（绘制/拖动/橡皮擦）
const onPointerMove = (e: PointerEvent) => {
  if (!activePointers.has(e.pointerId)) return
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  // 截图模式：开始后持续更新矩形（不依赖 dragStartPage 命中）
  if (currentMode.value === 'screenshot' && screenshotStartPoint.value) {
    handleScreenshotDrag(e.clientX, e.clientY)
    return
  }

  if (
    readingDirection.value === 'horizontal' &&
    activePointers.size === 1 &&
    (currentMode.value === 'pen' || currentMode.value === 'highlighter' || currentMode.value === 'eraser')
  ) {
    e.preventDefault()
  }

  if (activePointers.size === 1) {
    // 平移模式处理
    if (currentMode.value === 'pan' || isPanningInDrawMode) {
      const dx = e.clientX - lastPointerPos.x
      const dy = e.clientY - lastPointerPos.y
      applyPan(dx, dy)
      lastPointerPos = { x: e.clientX, y: e.clientY }
    } else if (dragStartPage.value !== -1) {
      const loc = getPdfPoint(e.clientX, e.clientY)
      handlePointerMoveForEraserCursor(e)

      // 截图模式
      if (currentMode.value === 'screenshot') {
        handleScreenshotDrag(e.clientX, e.clientY)
        return
      }

      // 选区模式
      if (loc && loc.pageIndex === dragStartPage.value && currentMode.value === 'select') {
        if (selectAction && selectAction.pageIndex === loc.pageIndex) {
          switch (selectAction.type) {
            case 'move':
              moveSelectedStrokes(loc.pageIndex, selectAction.lastPos, loc)
              break
            case 'box_select':
              const sx = selectAction.startPos.x
              const sy = selectAction.startPos.y
              selectDragRect.value = {
                x: Math.min(sx, loc.x),
                y: Math.min(sy, loc.y),
                w: Math.abs(loc.x - sx),
                h: Math.abs(loc.y - sy),
              }
              renderInkLayer(loc.pageIndex)
              break
            case 'freeform_select':
              const path = selectFreeformPath.value ?? []
              const last = path.length ? path[path.length - 1] : selectAction.startPos
              const dist = Math.hypot(loc.x - last.x, loc.y - last.y)
              if (dist >= 2) {
                selectFreeformPath.value = [...path, { x: loc.x, y: loc.y }]
                renderInkLayer(loc.pageIndex)
              }
              break
          }
        }
        return
      }

      // 绘制/擦除模式
      if (loc && loc.pageIndex === dragStartPage.value) {
        const pageIdx = dragStartPage.value
        const pos = { x: loc.x, y: loc.y }

        switch (currentMode.value) {
          case 'eraser':
            appendDragPath(pos)
            scheduleEraserCheck(pageIdx, loc.x, loc.y)
            break
          case 'pen':
            initStrokeDrawing(pageIdx, 'pen')
            appendDragPath(pos)
            schedulePenPreviewDraw(pageIdx, currentDragPath.value)
            break
          case 'highlighter':
            initStrokeDrawing(pageIdx, 'highlighter')
            appendDragPath(pos)
            scheduleHighlighterPreviewDraw(pageIdx, currentDragPath.value)
            break
          default:
            appendDragPath(pos)
            renderInkLayer(pageIdx)
            break
        }
      }
    }
  } else if (activePointers.size === 2) {
    handlePinch()
  }
}

// ==================== 指针松开事件 ====================
// 处理指针松开事件（完成绘制）
const onPointerUp = (e: PointerEvent) => {
  activePointers.delete(e.pointerId)

  if (activePointers.size === 0) {
    isInteracting.value = false
    // 最后一个指针松开：需要在这里提交绘制/选区结果，否则只会停留在预览层，数据不会进入 allStrokes
    if (currentMode.value === 'select') {
      const pageIdx = dragStartPage.value
      if (pageIdx !== -1 && selectAction) {
        switch (selectAction.type) {
          case 'box_select':
            finalizeBoxSelection(pageIdx)
            break
          case 'freeform_select':
            finalizeFreeformSelection(pageIdx)
            break
          case 'move':
            commitSelectionMove(pageIdx)
            break
        }
        cleanupSelectionState(pageIdx)
      }
    } else {
      finishDrawing(true)
    }

    lastPinchDist = 0
    lastPinchCenter = { x: 0, y: 0 }
    selectAction = null
    stopInertia()
    scheduleSaveToDb(600)
    isPanningInDrawMode = false
  }

  // 还有其他指针时，更新最后位置
  if (activePointers.size > 0) {
    const pt = activePointers.values().next().value
    if (pt) lastPointerPos = { x: pt.x, y: pt.y }
  }

  // 隐藏橡皮擦光标
  if (activePointers.size === 0) {
    eraserCursor.value.visible = false
  }
}

const undo = () => {
  const action = undoStack.value.pop()
  if (!action) return

  if (action.type === 'add') {
    const ids = new Set(action.strokes.map((s) => s.id))
    action.strokes.forEach((s) => removeFromSpatialIndex(s))
    allStrokes.value = allStrokes.value.filter((s) => !ids.has(s.id))
  } else if (action.type === 'remove') {
    action.strokes.forEach((s) => addToSpatialIndex(s))
    allStrokes.value = [...allStrokes.value, ...action.strokes]
  } else {
    const before = action.before ?? []
    const after = action.after ?? []
    const afterIds = new Set(after.map((s) => s.id))
    after.forEach((s) => removeFromSpatialIndex(s))
    const kept = allStrokes.value.filter((s) => !afterIds.has(s.id))
    before.forEach((s) => addToSpatialIndex(s))
    allStrokes.value = [...kept, ...before]
  }

  redoStack.value.push(action)
  const pages = new Set(
    action.type === 'update'
      ? [
          ...(action.before ?? []).map((s) => s.pageIndex),
          ...(action.after ?? []).map((s) => s.pageIndex),
        ]
      : action.strokes.map((s) => s.pageIndex)
  )
  pages.forEach((p) => {
    renderInkLayer(p)
    scheduleSaveToDb(p, 400)
  })
}

const redo = () => {
  const action = redoStack.value.pop()
  if (!action) return

  if (action.type === 'add') {
    action.strokes.forEach((s) => addToSpatialIndex(s))
    allStrokes.value = [...allStrokes.value, ...action.strokes]
  } else if (action.type === 'remove') {
    const ids = new Set(action.strokes.map((s) => s.id))
    action.strokes.forEach((s) => removeFromSpatialIndex(s))
    allStrokes.value = allStrokes.value.filter((s) => !ids.has(s.id))
  } else {
    const before = action.before ?? []
    const after = action.after ?? []
    const beforeIds = new Set(before.map((s) => s.id))
    before.forEach((s) => removeFromSpatialIndex(s))
    const kept = allStrokes.value.filter((s) => !beforeIds.has(s.id))
    after.forEach((s) => addToSpatialIndex(s))
    allStrokes.value = [...kept, ...after]
  }

  undoStack.value.push(action)
  const pages = new Set(
    action.type === 'update'
      ? [
          ...(action.before ?? []).map((s) => s.pageIndex),
          ...(action.after ?? []).map((s) => s.pageIndex),
        ]
      : action.strokes.map((s) => s.pageIndex)
  )
  pages.forEach((p) => {
    renderInkLayer(p)
    scheduleSaveToDb(p, 400)
  })
}

// 从 MuPDF 读取并结构化解析大纲目录
const loadOutlineData = (doc: mupdf.Document) => {
  try {
    const rawOutline = doc.loadOutline()
    if (!rawOutline) {
      pdfViewerStore.setPdfOutline([])
      return
    }

    const processItems = (items: any[]): any[] => {
      return items.map((item) => {
        let pageNum = item.page
        if ((pageNum === undefined || pageNum === null) && item.uri) {
          try {
            pageNum = doc.resolveLink(item.uri)
          } catch (e) {
            // 解析 uri 跳转页码失败
          }
        }
        return {
          title: item.title || '未命名章节',
          page: typeof pageNum === 'number' && pageNum >= 0 ? pageNum : null,
          uri: item.uri,
          open: !!item.open,
          children: item.down ? processItems(item.down) : []
        }
      })
    }

    const processed = processItems(rawOutline)
    pdfViewerStore.setPdfOutline(processed)
  } catch (err) {
    console.error('[PdfPage] 解析 PDF 大纲发生异常:', err)
    pdfViewerStore.setPdfOutline([])
  }
}

// 文件加载与持久化处理
const migrateOldAnnotations = async (file: File) => {
  try {
    const docKey = getDocKey(file)
    const oldData = await dbService.get<SavedData>('annotations', docKey)
    if (oldData && oldData.strokes && oldData.strokes.length > 0) {
      console.log(`[PdfPage] 发现老版本笔迹数据，开始迁移...`)
      
      const pageGroups: Record<number, Stroke[]> = {}
      oldData.strokes.forEach((stroke) => {
        const pageIdx = stroke.pageIndex
        if (!pageGroups[pageIdx]) {
          pageGroups[pageIdx] = []
        }
        pageGroups[pageIdx].push(stroke)
      })
      
      for (const [pageIdxStr, strokes] of Object.entries(pageGroups)) {
        const pageIdx = parseInt(pageIdxStr, 10)
        const pageKey = `${docKey}|${pageIdx}`
        const pageData: PageAnnotationsData = {
          pageKey,
          docKey,
          pageIndex: pageIdx,
          strokes,
          updatedAt: Date.now()
        }
        await dbService.put('page_annotations', pageData)
      }
      
      await dbService.delete('annotations', docKey)
      console.log(`[PdfPage] 笔迹数据迁移完成！共迁移了 ${oldData.strokes.length} 条笔迹。`)
    }
  } catch (err) {
    console.error('[PdfPage] 迁移老版本笔迹数据失败:', err)
  }
}

const loadFile = async (file: File) => {
  loading.value = true
  resetState()
  fileName.value = file.name

  try {
    // 1. 迁移老版本笔迹数据（带 3 秒超时保护）
    const dbTimeout = new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error('IndexedDB migration timeout')), 3000)
    )
    try {
      await Promise.race([migrateOldAnnotations(file), dbTimeout])
    } catch (dbErr) {
      console.error('[PdfPage] 笔迹数据迁移出错或超时:', dbErr)
    }

    // 2. 读取文件 arrayBuffer
    const fileReadTimeout = new Promise<Uint8Array>((_, reject) =>
      setTimeout(() => reject(new Error('File read timeout')), 5000)
    )
    let uint8Array: Uint8Array
    try {
      const arrayBufferPromise = (async () => {
        const buf = await file.arrayBuffer()
        return new Uint8Array(buf)
      })()
      uint8Array = await Promise.race([arrayBufferPromise, fileReadTimeout])
    } catch (readErr) {
      console.error('[PdfPage] 读取二进制流失败:', readErr)
      throw readErr
    }

    // 3. 使用 MuPDF 打开 PDF 文档
    let doc: mupdf.Document
    try {
      doc = mupdf.Document.openDocument(uint8Array, 'application/pdf')
      pdfDoc.value = doc
      pageCount.value = doc.countPages()
      pdfViewerStore.setTotalPages(pageCount.value)
      
      // 检测首页宽高比以决定默认方向 (横屏 PPT 默认横向模式，普通竖屏书籍默认纵向模式)
      if (pageCount.value > 0) {
        const firstPage = doc.loadPage(0)
        try {
          const bounds = firstPage.getBounds()
          const width = bounds[2] - bounds[0]
          const height = bounds[3] - bounds[1]
          if (width / height > 1.2) {
            readingDirection.value = 'horizontal'
          } else {
            readingDirection.value = 'vertical'
          }
        } finally {
          firstPage.destroy?.()
        }
      }
      
      loadOutlineData(doc)
    } catch (mupdfErr) {
      console.error('[PdfPage] WASM MuPDF 初始化失败:', mupdfErr)
      throw mupdfErr
    }

    // 4. 清理内嵌注释
    const burnTimeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('clearAndBurnMupdfInkAnnotations timeout')), 5000)
    )
    try {
      await Promise.race([clearAndBurnMupdfInkAnnotations(doc), burnTimeout])
    } catch (burnErr) {
      console.error('[PdfPage] 刻蚀/清除内嵌 Ink 注释超时或出错:', burnErr)
    }

    // 5. 预取尺寸
    await prefetchDimensionsAndLayout(doc)

    // 6. 准备开始生成 Canvas 渲染
    tryRenderContent()

    // 7. 居中
    if (offset.value.x === 0 && offset.value.y === 0 && scale.value === 1.0) {
      centerContent()
    } else {
      clampOffset()
    }
  } catch (err) {
    console.error('[PdfPage] PDF 核心加载流程发生严重错误:', err)
  } finally {
    loading.value = false
  }
}

const savePageDataToDb = async (pageIndex: number) => {
  if (!props.file) return
  try {
    const docKey = getDocKey(props.file)
    const pageKey = `${docKey}|${pageIndex}`
    const pageStrokes = allStrokes.value.filter((s) => s.pageIndex === pageIndex)
    
    if (pageStrokes.length === 0) {
      await dbService.delete('page_annotations', pageKey)
    } else {
      const data: PageAnnotationsData = {
        pageKey,
        docKey,
        pageIndex,
        strokes: toRaw(pageStrokes),
        updatedAt: Date.now(),
      }
      await dbService.put('page_annotations', data)
    }
  } catch (e) {
    console.error(`[PdfPage] 保存第 ${pageIndex} 页数据失败:`, e)
  }
}

const pendingSavePages = new Set<number>()
let dbSaveTimer: any = null

const scheduleSaveToDb = (pageIndexOrDelay: number, optionalDelay?: number) => {
  let pageIdx = dragStartPage.value !== -1 ? dragStartPage.value : 0
  let delay = 300
  
  if (optionalDelay !== undefined) {
    pageIdx = pageIndexOrDelay
    delay = optionalDelay
  } else {
    delay = pageIndexOrDelay
  }
  
  if (pageIdx !== -1) {
    pendingSavePages.add(pageIdx)
  }
  
  if (dbSaveTimer) clearTimeout(dbSaveTimer)
  dbSaveTimer = setTimeout(async () => {
    dbSaveTimer = null
    const pagesToSave = Array.from(pendingSavePages)
    pendingSavePages.clear()
    for (const idx of pagesToSave) {
      await savePageDataToDb(idx)
    }
  }, delay)
}
// 追踪页面单次渲染状态与重绘标识，杜绝重复渲染
const isRenderingPage = ref<Record<number, boolean>>({})
const pageRenderedGeneration = ref<Record<number, number>>({})

// 调度渲染触发器
const triggerPageRender = async (pageIndex: number) => {
  if (isRenderingPage.value[pageIndex]) return
  if (pageRenderedGeneration.value[pageIndex] === renderGeneration) return

  isRenderingPage.value[pageIndex] = true
  try {
    await renderPageCanvas(pageIndex)
  } finally {
    isRenderingPage.value[pageIndex] = false
  }
}

// 单页 Canvas 高清图块渲染渲染例程
const renderPageCanvas = (pageIndex: number) => {
  const canvas = pdfRefs.value[pageIndex]
  const inkCanvas = inkRefs.value[pageIndex]
  if (!canvas || !inkCanvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 1. 检查 LRU 缓存，命中则瞬间复制像素，不跑 WASM
  const cached = pagePixelCache.get(pageIndex)
  if (cached) {
    canvas.width = cached.width
    canvas.height = cached.height
    inkCanvas.width = cached.width
    inkCanvas.height = cached.height
    ctx.putImageData(new ImageData(cached.rgbaData, cached.width, cached.height), 0, 0)
    
    // 渲染 Ink 层批注
    renderInkLayer(pageIndex)
    
    pageRenderedGeneration.value[pageIndex] = renderGeneration
    return
  }

  // 2. 缓存未命中时，调度 WebAssembly 异步载入并栅格化
  const rawDoc = toRaw(pdfDoc.value)
  if (!rawDoc) return

  const pageLayout = pageList.value.find((p) => p.pageIndex === pageIndex)
  if (!pageLayout) return

  const cssW = pageLayout.viewWidth
  const cssH = pageLayout.viewHeight
  const baseDpr = window.devicePixelRatio || 1
  const fileSizeMB = (props.file?.size || 0) / (1024 * 1024)
  const avgPageSizeMB = pageCount.value > 0 ? (fileSizeMB / pageCount.value) : fileSizeMB

  const getRenderDprForPage = (w: number, h: number) => {
    const isLandscape = w / h > 1.2
    
    // 如果单页平均大小超过 0.5MB，说明单页渲染复杂度高，进行适度降级以保障性能，但至少保持 1.8x DPR 保证清晰度
    if (avgPageSizeMB > 0.5) {
      return isLandscape ? 1.4 : 1.8
    }
    
    // 正常大小教材在横屏/PPT比例下：最小 1.5x 超采样，最高限制在 2.0x
    if (isLandscape) {
      return Math.max(1.5, Math.min(baseDpr, 2.0))
    }
    // 竖版 A4 标准尺寸：最小 1.8x 超采样，允许达到设备物理高清分辨率（最高限制到 2.8x，保证极致高清）
    return Math.max(1.8, Math.min(baseDpr, 2.8))
  }

  const renderDpr = getRenderDprForPage(cssW, cssH)
  renderDprRef.value = renderDpr // 同步 DPR

  const pixelW = Math.round(cssW * renderDpr)
  const pixelH = Math.round(cssH * renderDpr)

  canvas.width = pixelW
  canvas.height = pixelH
  inkCanvas.width = pixelW
  inkCanvas.height = pixelH

  const page = rawDoc.loadPage(pageIndex)
  try {
    const matrix: mupdf.Matrix = [renderDpr, 0, 0, renderDpr, 0, 0]
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, true, true)
    try {
      const pixmapW = pixmap.getWidth()
      const pixmapH = pixmap.getHeight()
      const samples = pixmap.getPixels()
      const rgbaData = new Uint8ClampedArray(samples)

      ctx.putImageData(new ImageData(rgbaData, pixmapW, pixmapH), 0, 0)

      // 存储入 LRU 缓存池
      pagePixelCache.set(pageIndex, {
        rgbaData,
        width: pixmapW,
        height: pixmapH
      })
    } finally {
      pixmap.destroy()
    }
  } catch (err) {
    console.error(`[PdfPage] WASM 解析渲染页码 ${pageIndex} 异常:`, err)
  } finally {
    page.destroy?.()
  }

  // 渲染 Ink 批注层
  renderInkLayer(pageIndex)

  pageRenderedGeneration.value[pageIndex] = renderGeneration
}

// 渲染总流程控制逻辑
const renderPdfPages = async () => {
  const rawDoc = toRaw(pdfDoc.value)
  if (!rawDoc) return

  const generation = ++renderGeneration
  isRendering.value = true

  // 缩放或视口尺寸变更，清除旧缓存
  pagePixelCache.clear()
  pageRenderedGeneration.value = {}

  // 过滤出当前正挂载可视区之内的页码
  const visiblePages = pageList.value.filter((p) => shouldRenderPage(p.pageIndex))

  try {
    // 异步排队解析可视页面，确保平滑
    for (const p of visiblePages) {
      if (generation !== renderGeneration) break
      await triggerPageRender(p.pageIndex)
    }
  } finally {
    isRendering.value = false
  }
}


// 重置组件所有状态到初始值
const resetState = () => {
  if (pdfDoc.value) {
    try {
      pdfDoc.value.destroy()
    } catch {}
  }
  pdfDoc.value = null
  pageList.value = []
  allStrokes.value = []
  spatialGrid.clear()
  undoStack.value = []
  redoStack.value = []
  offset.value = { x: 0, y: 0 }
  scale.value = 1.0
  contentSize.value = { width: 0, height: 0 }
  hasRendered.value = false
  pdfViewerStore.setTotalPages(0)
  pdfViewerStore.setPdfOutline([])
  pdfViewerStore.setCurrentPage(0)
  loadedPages.value = {}
}

// PDF渲染处理

const prefetchDimensionsAndLayout = async (doc: mupdf.Document) => {
  const numPages = doc.countPages()

  if (readingDirection.value === 'horizontal') {
    const pageIndex = Math.min(Math.max(horizontalPageIndex.value, 0), Math.max(0, numPages - 1))
    horizontalPageIndex.value = pageIndex
    const page = doc.loadPage(pageIndex)
    try {
      const bounds = page.getBounds()
      const width = bounds[2] - bounds[0]
      const height = bounds[3] - bounds[1]
      pageList.value = [
        {
          pageIndex,
          viewWidth: width,
          viewHeight: height,
          x: 0,
          y: 0,
        },
      ]
      contentSize.value = { width, height }
    } finally {
      page.destroy?.()
    }
    return
  }

  let currentY = PAGE_GAP
  let maxW = 0
  const list: Array<{ pageIndex: number; viewWidth: number; viewHeight: number; x: number; y: number }> = []

  // MuPDF 获取页面尺寸是同步的，这里仍用 async 包一层保持接口一致
  for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
    const page = doc.loadPage(pageIndex)
    try {
      const bounds = page.getBounds()
      const width = bounds[2] - bounds[0]
      const height = bounds[3] - bounds[1]
      if (width > maxW) maxW = width
      list.push({
        pageIndex,
        viewWidth: width,
        viewHeight: height,
        x: 0,
        y: currentY,
      })
      currentY += height + PAGE_GAP
    } finally {
      page.destroy?.()
    }
  }

  list.forEach((p) => (p.x = (maxW - p.viewWidth) / 2))

  pageList.value = list
  contentSize.value = { width: maxW, height: currentY }
}

const tryRenderContent = async () => {
  if (isVisible.value && pageList.value.length > 0 && !hasRendered.value) {
    await renderPdfPages()
    if (!props.layoutSuspended) {
      hasRendered.value = true
    }
  }
}





const renderInkLayer = (pageIndex: number) => {
  const canvas = inkRefs.value[pageIndex]
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const pageStrokes = allStrokes.value.filter((s) => s.pageIndex === pageIndex)
  pageStrokes.forEach((stroke) => drawStroke(ctx, stroke))

  if (dragStartPage.value === pageIndex && currentDragPath.value.length > 0) {
    if (currentMode.value === 'select') {
      // 选择模式：不渲染临时 stroke 预览（否则会按默认红色绘制一个起点圆点）
    } else if (currentMode.value === 'eraser') {
      // 橡皮模式不渲染临时路径，避免出现红色线条
      return
    } else if (currentMode.value === 'pen' || currentMode.value === 'highlighter') {
      const tempStroke = createStrokeObject(pageIndex, currentDragPath.value, currentMode.value)
      drawStroke(ctx, tempStroke)
    } else if (currentMode.value === 'rectangle' && currentDragRect.value) {
      const { x, y, w, h } = currentDragRect.value
      const rectStroke = createStrokeObject(
        pageIndex,
        [
          { x, y },
          { x: x + w, y: y + h },
        ],
        'rectangle'
      )
      drawStroke(ctx, rectStroke)
    } else {
      const tempStroke = createStrokeObject(pageIndex, currentDragPath.value, currentMode.value)
      drawStroke(ctx, tempStroke)
    }
  }

  if (currentMode.value === 'select') {
    const q = renderDprRef.value || 1
    const selected = getSelectedStrokesOnPage(pageIndex)
    const bbox = getGroupBBox(selected)
    if (bbox) {
      ctx.save()
      ctx.scale(q, q)
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1
      ctx.setLineDash([6, 4])
      ctx.strokeRect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY)
      ctx.restore()
    }

    if (dragStartPage.value === pageIndex && selectDragRect.value) {
      const r = selectDragRect.value
      ctx.save()
      ctx.scale(q, q)
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.strokeRect(r.x, r.y, r.w, r.h)
      ctx.fillStyle = 'rgba(59, 130, 246, 0.10)'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.restore()
    }

    if (
      dragStartPage.value === pageIndex &&
      selectFreeformPath.value &&
      selectFreeformPath.value.length >= 2
    ) {
      const path = selectFreeformPath.value
      ctx.save()
      ctx.scale(q, q)
      ctx.strokeStyle = '#3b82f6'
      ctx.fillStyle = 'rgba(59, 130, 246, 0.10)'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(path[0].x, path[0].y)
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }
}


const refreshLayoutAfterViewportResize = () => {
  if (!isVisible.value) return
  
  const center = getNormalizedCenter()
  renderGeneration += 1
  
  if (center) {
    restoreNormalizedCenter(center)
  } else {
    centerContent()
  }

  hasRendered.value = false
  requestAnimationFrame(() => {
    tryRenderContent()
    if (hasRendered.value) {
      if (center) {
        restoreNormalizedCenter(center)
      } else {
        centerContent()
      }
      clampOffset()
    }
  })
}

const setupResizeObserver = () => {
  if (!viewportRef.value) return
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      const isNowVisible = width > 0 && height > 0

      const sizeChanged =
        Math.abs(width - lastObservedViewportWidth) > 1 || Math.abs(height - lastObservedViewportHeight) > 1
      
      const oldWidth = lastObservedViewportWidth
      const oldHeight = lastObservedViewportHeight

      if (isNowVisible !== isVisible.value) {
        isVisible.value = isNowVisible
        lastObservedViewportWidth = width
        lastObservedViewportHeight = height
        if (isNowVisible) {
          tryRenderContent()
          if (hasRendered.value) clampOffset()
        }
        continue
      }

      if (isNowVisible && sizeChanged) {
        if (props.layoutSuspended) {
          pendingViewportResizeWhileSuspended = true
          const oldW = lastObservedViewportWidth
          const oldH = lastObservedViewportHeight
          lastObservedViewportWidth = width
          lastObservedViewportHeight = height

          // 挂起期间只执行轻量的位移对齐计算（通过 CSS 变换），不触发昂贵的 WASM 页面像素重绘
          const center = getNormalizedCenter(oldW, oldH)
          if (center) {
            restoreNormalizedCenter(center)
            clampOffset()
          } else {
            centerContent()
          }
          continue
        }

        const center = getNormalizedCenter(oldWidth, oldHeight)
        
        lastObservedViewportWidth = width
        lastObservedViewportHeight = height

        // 立即恢复焦点位置（同步执行，利用 CSS 变换实现平滑移动）
        if (center) {
          restoreNormalizedCenter(center)
          clampOffset()
        } else {
          centerContent()
        }

        // 异步执行高质量重绘
        hasRendered.value = false
        requestAnimationFrame(() => {
          tryRenderContent()
          if (hasRendered.value) {
            // 重绘完成后再次微调，确保位置绝对精准
            if (center) {
              restoreNormalizedCenter(center)
            } else {
              centerContent()
            }
            clampOffset()
          }
        })
      }
    }
  })
  resizeObserver.observe(viewportRef.value)
}

// 绘制与交互处理
// 绘制操作：初始化笔/高光笔绘制
const initStrokeDrawing = (pageIndex: number, mode: 'pen' | 'highlighter'): void => {
  const start = currentDragPath.value[0]
  if (!isDrawingStarted.value) {
    isDrawingStarted.value = true
    backupInkCanvas(pageIndex)
    drawStartDot(pageIndex, start, mode)
  }
}

// 绘制操作：更新拖动路径
const appendDragPath = (pos: Point): void => {
  currentDragPath.value.push({ x: pos.x, y: pos.y })
}

const schedulePenPreviewDraw = (pageIndex: number, points: Point[]) => {
  if (!points || points.length === 0) return
  penPending = { pageIndex, points }
  if (penRafId != null) return
  penRafId = requestAnimationFrame(() => {
    penRafId = null
    const p = penPending
    penPending = null
    if (!p) return
    restoreInkCanvasBackup(p.pageIndex)
    const ctx = getInkContext(p.pageIndex)
    if (!ctx) return
    const tempStroke = createStrokeObject(p.pageIndex, p.points, 'pen')
    drawStroke(ctx, tempStroke)
  })
}
const scheduleHighlighterPreviewDraw = (pageIndex: number, points: Point[]) => {
  if (!points || points.length === 0) return
  highlighterPending = { pageIndex, points }
  if (highlighterRafId != null) return
  highlighterRafId = requestAnimationFrame(() => {
    highlighterRafId = null
    const p = highlighterPending
    highlighterPending = null
    if (!p) return
    // 先恢复底图，再仅绘制当前荧光笔笔迹（避免重绘整页导致卡顿）
    restoreInkCanvasBackup(p.pageIndex)
    const ctx = getInkContext(p.pageIndex)
    if (!ctx) return
    const tempStroke = createStrokeObject(p.pageIndex, p.points, 'highlighter')
    drawStroke(ctx, tempStroke)
  })
}


const inkBackupCanvases = new Map<number, HTMLCanvasElement>()
const backupInkCanvas = (pageIndex: number) => {
  const src = inkRefs.value[pageIndex]
  if (!src) return
  let backup = inkBackupCanvases.get(pageIndex)
  if (!backup) {
    backup = document.createElement('canvas')
    inkBackupCanvases.set(pageIndex, backup)
  }
  if (backup.width !== src.width) backup.width = src.width
  if (backup.height !== src.height) backup.height = src.height
  const bctx = backup.getContext('2d')
  if (!bctx) return
  bctx.clearRect(0, 0, backup.width, backup.height)
  bctx.drawImage(src, 0, 0)
}


const restoreInkCanvasBackup = (pageIndex: number) => {
  const backup = inkBackupCanvases.get(pageIndex)
  const dst = inkRefs.value[pageIndex]
  if (!backup || !dst) return
  const dctx = dst.getContext('2d')
  if (!dctx) return
  dctx.clearRect(0, 0, dst.width, dst.height)
  dctx.drawImage(backup, 0, 0)
}

// 橡皮擦处理
const scheduleEraserCheck = (pageIndex: number, x: number, y: number) => {
  eraserPending = { pageIndex, x, y }
  if (eraserRafId != null) return
  eraserRafId = requestAnimationFrame(() => {
    eraserRafId = null
    const p = eraserPending
    eraserPending = null
    if (!p) return
    const changed = performEraserCheck(p.pageIndex, p.x, p.y)
    if (changed) renderInkLayer(p.pageIndex)
  })
}

// 橡皮擦：使用空间网格 + 包围盒预判，减少全量遍历
const performEraserCheck = (pageIndex: number, x: number, y: number) => {
  const eraserSize = pdfViewerStore.drawingConfig.eraserSize
  const searchRadius = eraserSize

  const minGridX = Math.floor((x - searchRadius) / GRID_SIZE)
  const maxGridX = Math.floor((x + searchRadius) / GRID_SIZE)
  const minGridY = Math.floor((y - searchRadius) / GRID_SIZE)
  const maxGridY = Math.floor((y + searchRadius) / GRID_SIZE)

  const candidates = new Set<Stroke>()
  for (let gx = minGridX; gx <= maxGridX; gx++) {
    for (let gy = minGridY; gy <= maxGridY; gy++) {
      const key = `${pageIndex}|${gx}|${gy}`
      const cell = spatialGrid.get(key)
      if (cell) cell.forEach((s) => candidates.add(s))
    }
  }

  if (candidates.size === 0) return false

  const removed: Stroke[] = []
  const idsToRemove = new Set<string>()
  const threshold = eraserSize

  candidates.forEach((stroke) => {
    if (stroke.pageIndex !== pageIndex) return
    if (stroke.type === 'rectangle') return

    // 包围盒快速拒绝
    if (
      x + threshold < (stroke.minX ?? 0) ||
      x - threshold > (stroke.maxX ?? 0) ||
      y + threshold < (stroke.minY ?? 0) ||
      y - threshold > (stroke.maxY ?? 0)
    ) {
      return
    }

    const thr = Math.max(threshold, (stroke.width ?? 2) / 2 + 6)
    const thrSq = thr * thr
    const pts = stroke.points
    let hit = false

    if (pts.length === 1) {
      hit = Math.hypot(pts[0].x - x, pts[0].y - y) < thr
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const dist = distancePointToSegment(x, y, pts[i], pts[i + 1])
        if (dist * dist < thrSq) {
          hit = true
          break
        }
      }
    }

    if (hit) {
      idsToRemove.add(stroke.id)
      removed.push(stroke)
    }
  })

  if (removed.length > 0) {
    removed.forEach((s) => removeFromSpatialIndex(s))
    allStrokes.value = allStrokes.value.filter((s) => !idsToRemove.has(s.id))
    pushHistory('remove', removed)
    scheduleSaveToDb(pageIndex, 600)
    return true
  }

  return false
}

// 选区操作处理

// 选区操作：处理框选/自由选区初始化
const initSelectionMode = (pageIndex: number, pos: Point) => {
  selectedStrokeIds.value = new Set()
  if (selectionMode.value === 'freeform') {
    selectFreeformPath.value = [{ x: pos.x, y: pos.y }]
    selectDragRect.value = null
    selectAction = createFreeformSelectAction(pageIndex, pos)
  } else {
    selectDragRect.value = { x: pos.x, y: pos.y, w: 0, h: 0 }
    selectFreeformPath.value = null
    selectAction = createBoxSelectAction(pageIndex, pos)
  }
  renderInkLayer(pageIndex)
}

// 选区移动：更新选中笔迹位置
const moveSelectedStrokes = (pageIndex: number, lastPos: Point, newPos: Point): void => {
  const movedDx = newPos.x - lastPos.x
  const movedDy = newPos.y - lastPos.y

  if (Math.abs(newPos.x - selectAction!.startPos.x) > 0.1 || Math.abs(newPos.y - selectAction!.startPos.y) > 0.1) {
    selectAction!.moved = true
  }

  const ids = selectedStrokeIds.value
  allStrokes.value.forEach((s) => {
    if (s.pageIndex !== pageIndex || !ids.has(s.id)) return
    s.points = s.points.map((p) => ({ x: p.x + movedDx, y: p.y + movedDy }))
    Object.assign(s, calculateBBox(s.points, s.width))
  })

  selectAction!.lastPos = { x: newPos.x, y: newPos.y }
  renderInkLayer(pageIndex)
}

// 选区完成：处理框选完成
const finalizeBoxSelection = (pageIdx: number): void => {
  const r = selectDragRect.value
  if (!r || r.w <= 2 || r.h <= 2) {
    selectedStrokeIds.value = new Set()
    return
  }

  const minX = r.x, minY = r.y, maxX = r.x + r.w, maxY = r.y + r.h
  const next = new Set<string>()

  allStrokes.value.forEach((s) => {
    if (s.pageIndex !== pageIdx) return
    if (s.minX == null || s.maxX == null || s.minY == null || s.maxY == null) return
    if (s.minX >= minX && s.maxX <= maxX && s.minY >= minY && s.maxY <= maxY) {
      next.add(s.id)
    }
  })

  selectedStrokeIds.value = next
}

// 选区完成：处理自由选区完成
const finalizeFreeformSelection = (pageIdx: number): void => {
  const path = selectFreeformPath.value
  selectedStrokeIds.value = path && path.length >= 3 ? hitTestFreeform(pageIdx, path) : new Set()
}

// 选区移动：提交移动结果到历史记录
const commitSelectionMove = (pageIdx: number): void => {
  if (!selectAction?.moved) return

  const ids = selectedStrokeIds.value
  const after = allStrokes.value
    .filter((s) => s.pageIndex === pageIdx && ids.has(s.id))
    .map((s) => JSON.parse(JSON.stringify(s)) as Stroke)

  selectAction.beforeStrokes.forEach((s) => removeFromSpatialIndex(s))
  after.forEach((s) => addToSpatialIndex(s))
  pushUpdateHistory(selectAction.beforeStrokes, after)
  scheduleSaveToDb(pageIdx, 600)
}

// 选区完成：清理选区状态
const cleanupSelectionState = (pageIdx: number): void => {
  selectAction = null
  selectDragRect.value = null
  selectFreeformPath.value = null
  finishDrawing(false)
  if (pageIdx !== -1) renderInkLayer(pageIdx)
}


// 清理并刻蚀MuPDF内置注释
const clearAndBurnMupdfInkAnnotations = async (doc: mupdf.Document) => {
  const pdf = doc.asPDF()
  if (!pdf) return

  let removedCount = 0
  for (let pageIndex = 0; pageIndex < doc.countPages(); pageIndex++) {
    const page = pdf.loadPage(pageIndex) as any
    try {
      const annots = page.getAnnotations?.() as any[] | undefined
      if (!annots || annots.length === 0) continue

      let changed = false
      for (const annot of annots) {
        const type = annot?.getType?.()
        if (type !== 'Ink') continue
        page.deleteAnnotation?.(annot)
        changed = true
        removedCount++
      }

      if (changed) {
        page.update?.()
      }
    } finally {
      page.destroy?.()
    }
  }

  if (removedCount <= 0) return

  const resourceIdRaw: any = (pdfViewerStore as any).currentResourceId
  const resourceId = typeof resourceIdRaw === 'string' ? resourceIdRaw : resourceIdRaw?.value
  if (!resourceId) {
    console.warn('[PdfPage] 已清除 Ink 注释，但缺少 resourceId，无法刻蚀保存')
    return
  }

  try {
    let buffer: any
    try {
      buffer = pdf.saveToBuffer('incremental')
    } catch (e) {
      console.warn('[PdfPage] incremental 保存失败，回退 full 保存', e)
      buffer = pdf.saveToBuffer()
    }
    const uint8 = buffer.asUint8Array() as Uint8Array
    const data = new Uint8Array(uint8.length)
    data.set(uint8)
    await resourceManager.updateFileData(resourceId, data)
    console.log('[PdfPage] Ink 注释已清除并刻蚀保存:', removedCount)
  } catch (e) {
    console.error('[PdfPage] 刻蚀保存 PDF 失败', e)
  }
}


// 处理橡皮擦光标移动
const handlePointerMoveForEraserCursor = (e: PointerEvent) => {
  if (!viewportRef.value || currentMode.value !== 'eraser') {
    eraserCursor.value.visible = false
    return
  }
  const rect = viewportRef.value.getBoundingClientRect()
  const size = getEraserCursorSize()
  eraserCursor.value = {
    visible: true,
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    size,
  }
}

// 选区操作：检测并处理选区命中
const handleSelectHitTest = (pageIndex: number, pos: Point): SelectActionData | null => {
  const hit = strokeHitTest(pageIndex, pos.x, pos.y) as Stroke | null
  if (hit) {
    if (!selectedStrokeIds.value.has(hit.id)) {
      selectedStrokeIds.value = new Set<string>([hit.id])
    }
    return createSelectMoveAction(pageIndex, pos)
  }
  return null
}

// ==================== 指针事件处理辅助函数 ====================

// 选区操作：创建框选操作
const createBoxSelectAction = (pageIndex: number, pos: Point): SelectActionData => ({
  type: 'box_select',
  pageIndex,
  lastPos: { x: pos.x, y: pos.y },
  startPos: { x: pos.x, y: pos.y },
  moved: false,
  beforeStrokes: [],
})

// 选区操作：创建自由选区操作
const createFreeformSelectAction = (pageIndex: number, pos: Point): SelectActionData => ({
  type: 'freeform_select',
  pageIndex,
  lastPos: { x: pos.x, y: pos.y },
  startPos: { x: pos.x, y: pos.y },
  moved: false,
  beforeStrokes: [],
})

// 截图处理
// 截图操作：处理截图拖动
const handleScreenshotDrag = (clientX: number, clientY: number): void => {
  const p = getContentPoint(clientX, clientY)
  const start = screenshotStartPoint.value
  if (!p || !start) return

  screenshotDragRect.value = {
    x: Math.min(start.x, p.x),
    y: Math.min(start.y, p.y),
    w: Math.abs(p.x - start.x),
    h: Math.abs(p.y - start.y),
  }
}



const takeScreenshotAcrossPages = (rect: { x: number; y: number; w: number; h: number }) => {
  if (rect.w < 5 || rect.h < 5) return
  const q = renderDprRef.value || 1

  const out = document.createElement('canvas')
  out.width = Math.round(rect.w * q)
  out.height = Math.round(rect.h * q)
  const octx = out.getContext('2d')
  if (!octx) return
  octx.fillStyle = '#ffffff'
  octx.fillRect(0, 0, out.width, out.height)

  for (let i = 0; i < pageList.value.length; i++) {
    const page = pageList.value[i]
    const pdfCanvas = pdfRefs.value[page.pageIndex]
    const inkCanvas = inkRefs.value[page.pageIndex]
    if (!page || !pdfCanvas || !inkCanvas) continue

    // 页面在内容坐标系中的位置
    const pageRect = { x: page.x, y: page.y, w: page.viewWidth, h: page.viewHeight }
    const ix1 = Math.max(rect.x, pageRect.x)
    const iy1 = Math.max(rect.y, pageRect.y)
    const ix2 = Math.min(rect.x + rect.w, pageRect.x + pageRect.w)
    const iy2 = Math.min(rect.y + rect.h, pageRect.y + pageRect.h)
    const iw = ix2 - ix1
    const ih = iy2 - iy1
    if (iw <= 0 || ih <= 0) continue

    const localX = ix1 - pageRect.x
    const localY = iy1 - pageRect.y

    const sx = Math.round(localX * q)
    const sy = Math.round(localY * q)
    const sw = Math.round(iw * q)
    const sh = Math.round(ih * q)

    const dx = Math.round((ix1 - rect.x) * q)
    const dy = Math.round((iy1 - rect.y) * q)

    octx.drawImage(pdfCanvas, sx, sy, sw, sh, dx, dy, sw, sh)
    octx.drawImage(inkCanvas, sx, sy, sw, sh, dx, dy, sw, sh)
  }

  out.toBlob(
    (blob) => {
      if (blob) emit('screenshot-captured', blob)
    },
    'image/jpeg',
    0.95
  )
}



// 绘制完成：保存新笔迹
const saveNewStroke = (pageIdx: number): boolean => {
  const path = currentDragPath.value
  if (!isDrawingStarted.value || path.length <= 1) return false
  if (currentMode.value === 'eraser') return false

  let newStroke: Stroke
  if (currentMode.value === 'rectangle') {
    newStroke = createStrokeObject(pageIdx, [path[0], path[path.length - 1]], 'rectangle')
  } else {
    newStroke = createStrokeObject(pageIdx, path, currentMode.value)
  }

  allStrokes.value = [...allStrokes.value, newStroke]
  addToSpatialIndex(newStroke)
  pushHistory('add', [newStroke])
  return true
}

// 绘制完成：保存点笔迹（点击但未拖动）
const saveDotStroke = (pageIdx: number): boolean => {
  const path = currentDragPath.value
  if (
    isDrawingStarted.value ||
    path.length === 0 ||
    currentMode.value === 'eraser' ||
    currentMode.value === 'rectangle' ||
    currentMode.value === 'screenshot'
  ) {
    return false
  }

  const dotStroke = createStrokeObject(pageIdx, [path[0]], currentMode.value)
  backupInkCanvas(pageIdx)
  drawStartDot(pageIdx, path[0], currentMode.value)
  allStrokes.value = [...allStrokes.value, dotStroke]
  addToSpatialIndex(dotStroke)
  pushHistory('add', [dotStroke])
  return true
}

// 绘制完成：清理绘制状态
const cleanupDrawingState = (): void => {
  dragStartPage.value = -1
  currentDragPath.value = []
  currentDragRect.value = null
  screenshotDragRect.value = null
  screenshotStartPoint.value = null
  isDrawingStarted.value = false
}

// 绘制完成：清理动画帧
const cancelDrawingAnimationFrames = (pageIdx: number): void => {
  if (pageIdx === -1) return

  if (currentMode.value === 'pen' && penRafId != null) {
    cancelAnimationFrame(penRafId)
    penRafId = null
    penPending = null
  }

  if (currentMode.value === 'highlighter' && highlighterRafId != null) {
    cancelAnimationFrame(highlighterRafId)
    highlighterRafId = null
    highlighterPending = null
  }

  if (currentMode.value === 'eraser' && eraserRafId != null) {
    cancelAnimationFrame(eraserRafId)
    eraserRafId = null
    eraserPending = null
  }
}

// 平移操作：执行平移
const applyPan = (dx: number, dy: number): void => {
  offset.value.x += dx
  offset.value.y += dy
  velocity = { x: dx, y: dy }
  clampOffset()
}

// ==================== 完成绘制处理 ====================
const finishDrawing = (save: boolean) => {
  if (dragStartPage.value === -1) return

  const pageIdx = dragStartPage.value
  const started = isDrawingStarted.value

  // 保存绘制结果
  if (save) {
    if (currentMode.value === 'screenshot' && currentDragRect.value) {
      // screenshot 已改为 content 坐标处理
    } else {
      // 保存拖动绘制的笔迹
      if (saveNewStroke(pageIdx)) {
        // 已保存
      } else {
        // 保存点击形成的点笔迹
        saveDotStroke(pageIdx)
      }
    }
  }

  // 恢复或渲染画布
  if (pageIdx !== -1) {
    if (!save && started && (currentMode.value === 'pen' || currentMode.value === 'highlighter')) {
      restoreInkCanvasBackup(pageIdx)
    } else if (currentMode.value !== 'pen' && currentMode.value !== 'highlighter') {
      renderInkLayer(pageIdx)
    }
  }

  // 执行截图
  if (currentMode.value === 'screenshot' && screenshotDragRect.value) {
    takeScreenshotAcrossPages(screenshotDragRect.value)
  }

  // 清理状态
  cleanupDrawingState()
  cancelDrawingAnimationFrames(pageIdx)

  // 高光笔需要额外渲染
  if (save && pageIdx !== -1 && currentMode.value === 'highlighter') {
    renderInkLayer(pageIdx)
  }

  // 保存到 DB
  if (save && currentMode.value !== 'screenshot') {
    scheduleSaveToDb(pageIdx, 600)
  }
}

// 将操作历史入栈
const pushHistory = (type: 'add' | 'remove', strokes: Stroke[]) => {
  undoStack.value.push({ type, strokes })
  redoStack.value = []
}

// 将更新前后状态入栈
const pushUpdateHistory = (before: Stroke[], after: Stroke[]) => {
  undoStack.value.push({ type: 'update', strokes: [], before, after })
  redoStack.value = []
}


let saveTimer: any = null

// 根据当前两指触控计算并应用缩放与平移的处理逻辑
const handlePinch = () => {
  if (readingDirection.value === 'horizontal' && isHorizontalScrolling.value && scale.value !== 1) {
    return
  }
  const pts = Array.from(activePointers.values())
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  const centerX = (pts[0].x + pts[1].x) / 2
  const centerY = (pts[0].y + pts[1].y) / 2

  if (lastPinchDist > 0) {
    const ratio = dist / lastPinchDist
    const newScale = Math.min(Math.max(scale.value * ratio, 0.1), 5.0)
    const actualRatio = newScale / scale.value

    const dx = centerX - lastPinchCenter.x
    const dy = centerY - lastPinchCenter.y
    offset.value.x += dx
    offset.value.y += dy
    offset.value.x = centerX - (centerX - offset.value.x) * actualRatio
    offset.value.y = centerY - (centerY - offset.value.y) * actualRatio
    scale.value = newScale
    clampOffset()
  }
  lastPinchDist = dist
  lastPinchCenter = { x: centerX, y: centerY }
}

// 按鼠标位置与缩放比重新设定视图的缩放与偏移
const zoomAt = (delta: number, clientX: number, clientY: number) => {
  const factor = Math.pow(1.1, delta / 100)
  const newScale = Math.min(Math.max(scale.value * factor, 0.1), 5.0)
  if (!viewportRef.value) return
  const rect = viewportRef.value.getBoundingClientRect()
  const mouseX = clientX - rect.left
  const mouseY = clientY - rect.top

  const ratio = newScale / scale.value
  offset.value.x = mouseX - (mouseX - offset.value.x) * ratio
  offset.value.y = mouseY - (mouseY - offset.value.y) * ratio
  scale.value = newScale
  clampOffset()
}

// 在绘制交互时停止惯性运动的函数
const stopInertia = () => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  velocity = { x: 0, y: 0 }
}

//  空间索引处理
// 将笔画加入空间网格以便快速定位
const addToSpatialIndex = (stroke: Stroke) => {
  if (stroke.minX == null || stroke.maxX == null || stroke.minY == null || stroke.maxY == null)
    return
  const startX = Math.floor(stroke.minX / GRID_SIZE)
  const endX = Math.floor(stroke.maxX / GRID_SIZE)
  const startY = Math.floor(stroke.minY / GRID_SIZE)
  const endY = Math.floor(stroke.maxY / GRID_SIZE)
  for (let gx = startX; gx <= endX; gx++) {
    for (let gy = startY; gy <= endY; gy++) {
      const key = `${stroke.pageIndex}|${gx}|${gy}`
      let cell = spatialGrid.get(key)
      if (!cell) {
        cell = new Set<Stroke>()
        spatialGrid.set(key, cell)
      }
      cell.add(stroke)
    }
  }
}

// 从空间网格中移除给定笔迹
const removeFromSpatialIndex = (stroke: Stroke) => {
  if (stroke.minX == null || stroke.maxX == null || stroke.minY == null || stroke.maxY == null)
    return
  const startX = Math.floor(stroke.minX / GRID_SIZE)
  const endX = Math.floor(stroke.maxX / GRID_SIZE)
  const startY = Math.floor(stroke.minY / GRID_SIZE)
  const endY = Math.floor(stroke.maxY / GRID_SIZE)
  for (let gx = startX; gx <= endX; gx++) {
    for (let gy = startY; gy <= endY; gy++) {
      const key = `${stroke.pageIndex}|${gx}|${gy}`
      const cell = spatialGrid.get(key)
      if (cell) {
        cell.delete(stroke)
        if (cell.size === 0) spatialGrid.delete(key)
      }
    }
  }
}

// 重新构建笔迹的空间网格索引
const rebuildSpatialIndex = () => {
  spatialGrid.clear()
  allStrokes.value.forEach((s) => {
    if (s.minX == null) {
      Object.assign(s, calculateBBox(s.points, s.width))
    }
    addToSpatialIndex(s)
  })
}

// 计算并设置内容居中偏移
const centerContent = () => {
  if (!viewportRef.value || pageList.value.length === 0) return
  const rect = viewportRef.value.getBoundingClientRect()
  if (rect.width === 0) return

  const maxW = Math.max(...pageList.value.map((p) => p.viewWidth))
  if (readingDirection.value === 'horizontal') {
    const p = pageList.value[0]
    const pageH = p?.viewHeight ?? 0
    offset.value = {
      x: (rect.width - maxW * scale.value) / 2,
      y: (rect.height - pageH * scale.value) / 2,
    }
  } else {
    offset.value = {
      x: (rect.width - maxW * scale.value) / 2,
      y: 20,
    }
  }
}

/**
 * 获取视口中心点在 PDF 内容空间中的归一化坐标 (0-1)
 * @param oldWidth 可选的旧视口宽度，用于在尺寸变化后恢复变化前的中心
 * @param oldHeight 可选的旧视口高度
 */
const getNormalizedCenter = (oldWidth?: number, oldHeight?: number) => {
  if (!viewportRef.value || pageList.value.length === 0 || contentSize.value.width === 0 || contentSize.value.height === 0) return null
  
  // 如果提供了旧尺寸，则使用旧尺寸计算中心；否则使用当前实时尺寸
  const width = oldWidth ?? viewportRef.value.clientWidth
  const height = oldHeight ?? viewportRef.value.clientHeight
  
  if (width === 0 || height === 0) return null

  const centerX = width / 2
  const centerY = height / 2
  
  // 视口中心对应的 PDF 内容坐标
  const contentX = (centerX - offset.value.x) / scale.value
  const contentY = (centerY - offset.value.y) / scale.value
  
  return {
    x: contentX / contentSize.value.width,
    y: contentY / contentSize.value.height
  }
}

/**
 * 根据归一化坐标恢复视口中心焦点
 */
const restoreNormalizedCenter = (normalized: { x: number, y: number } | null) => {
  if (!normalized || !viewportRef.value || pageList.value.length === 0 || contentSize.value.width === 0 || contentSize.value.height === 0) return
  const rect = viewportRef.value.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  
  // 目标 PDF 内容坐标
  const targetContentX = normalized.x * contentSize.value.width
  const targetContentY = normalized.y * contentSize.value.height
  
  // 计算新的 offset 使目标点处于视口中心
  offset.value = {
    x: centerX - targetContentX * scale.value,
    y: centerY - targetContentY * scale.value
  }
}

// 将视图偏移量限制在可视区域内的实现函数
const clampOffset = () => {
  if (!viewportRef.value || pageList.value.length === 0) return
  const vpRect = viewportRef.value.getBoundingClientRect()
  const lastPage = pageList.value[pageList.value.length - 1]
  const contentH =
    (lastPage.y + lastPage.viewHeight + (readingDirection.value === 'horizontal' ? 0 : PAGE_GAP)) * scale.value
  const maxW = Math.max(...pageList.value.map((p) => p.viewWidth))
  const contentW = maxW * scale.value
  const padding = 100

  let x = offset.value.x
  let y = offset.value.y

  if (contentW < vpRect.width) {
    if (x > vpRect.width - padding) x = vpRect.width - padding
    if (x + contentW < padding) x = padding - contentW
  } else {
    if (x > padding) x = padding
    if (x + contentW < vpRect.width - padding) x = vpRect.width - padding - contentW
  }

  if (contentH < vpRect.height) {
    if (y > vpRect.height - padding) y = vpRect.height - padding
    if (y + contentH < padding) y = padding - contentH
  } else {
    if (y > padding) y = padding
    if (y + contentH < vpRect.height - padding) y = vpRect.height - padding - contentH
  }

  offset.value = { x, y }
}

// 切换横向/纵向阅读模式并重置视图状态（带淡入淡出过渡）
const toggleReadingDirection = async () => {
  const fromDirection = readingDirection.value
  const targetPageIndex = fromDirection === 'horizontal' ? horizontalPageIndex.value : getCurrentVerticalPageIndex()

  // 第一步：淡出（300ms）
  isDirectionChanging.value = true
  await new Promise(resolve => setTimeout(resolve, 300))

  readingDirection.value = fromDirection === 'horizontal' ? 'vertical' : 'horizontal'
  if (scale.value !== 1) scale.value = 1
  offset.value = { x: 0, y: 0 }
  if (readingDirection.value === 'horizontal') {
    horizontalPageIndex.value = targetPageIndex
    lastViewportScrollLeft = 0
    lastViewportScrollTop = 0
    if (horizontalScrollTimer) {
      clearTimeout(horizontalScrollTimer)
      horizontalScrollTimer = null
    }
    if (horizontalScrollEndTimer) {
      clearTimeout(horizontalScrollEndTimer)
      horizontalScrollEndTimer = null
    }
    if (horizontalScaleResetRaf != null) {
      cancelAnimationFrame(horizontalScaleResetRaf)
      horizontalScaleResetRaf = null
    }
    isHorizontalScrolling.value = false
  }
  const rawDoc = toRaw(pdfDoc.value)
  if (!rawDoc) return
  await prefetchDimensionsAndLayout(rawDoc)
  hasRendered.value = false
  await nextTick()
  tryRenderContent()

  // 第二步：淡入
  requestAnimationFrame(() => {
    isDirectionChanging.value = false
  })
  requestAnimationFrame(() => {
    if (readingDirection.value === 'vertical') {
      if (!viewportRef.value || pageList.value.length === 0) return
      const rect = viewportRef.value.getBoundingClientRect()
      const maxW = Math.max(...pageList.value.map((p) => p.viewWidth))
      const targetPage = pageList.value.find((p) => p.pageIndex === targetPageIndex)
      offset.value = {
        x: (rect.width - maxW * scale.value) / 2,
        y: targetPage ? 20 - targetPage.y * scale.value : 20,
      }
      clampOffset()
    } else {
      centerContent()
      clampOffset()
    }
  })
}

const setSelectionMode = (mode: 'rectangle' | 'freeform') => {
  selectionMode.value = mode
}
const undoLastStroke = () => undo()
const redoLastStroke = () => redo()
const toggleGestureMode = () => {
  currentMode.value = 'pan'
}
const toggleHighlightMode = () => {
  currentMode.value = 'highlighter'
}
const togglePenMode = () => {
  currentMode.value = 'pen'
}
const toggleEraserMode = () => {
  currentMode.value = 'eraser'
}
const toggleScreenshotMode = () => {
  currentMode.value = 'screenshot'
}
const toggleNoteMode = () => {
  currentMode.value = 'pen'
}
const toggleSelectMode = () => {
  currentMode.value = 'select'
}
const refreshLayout = () => {
  pendingViewportResizeWhileSuspended = false
  refreshLayoutAfterViewportResize()
}
defineExpose({
  toggleGestureMode,
  toggleHighlightMode,
  togglePenMode,
  toggleEraserMode,
  toggleScreenshotMode,
  toggleNoteMode,
  toggleSelectMode,
  toggleReadingDirection,
  goPrevPage,
  goNextPage,
  jumpToPage,
  setSelectionMode,
  undoLastStroke,
  redoLastStroke,
  refreshLayout,
})
</script>

<style scoped>
.pdf-reader-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  flex: 1;
  overflow: hidden;
}

.viewport {
  flex: 1;
  min-height: 1px;
  position: relative;
  overflow: hidden;
  touch-action: none;
  cursor: crosshair;
}

.viewport.is-horizontal {
  overflow: hidden;
  touch-action: none;
}

.viewport.is-horizontal.is-drawing {
  touch-action: none;
}
.viewport:active {
  cursor: grabbing;
}

/* 阅读方向切换时的过渡效果 */
.viewport {
  transition: opacity 0.3s ease;
}

.viewport.direction-changing {
  opacity: 0;
}

.canvas-container {
  position: absolute;
  transform-origin: 0 0;
  will-change: transform;
  transition: opacity 0.3s ease;
}

/* 在分隔条调整或布局挂起时，使用平滑过渡以优化视觉体验 */
.canvas-container.is-suspended {
  transition: transform 0.1s linear, opacity 0.3s ease;
}

.canvas-container.is-horizontal {
  position: absolute;
}

.canvas-container.is-horizontal .page-wrapper {
  position: absolute;
  overflow: hidden;
}

.page-wrapper.is-horizontal {
  background: #fff;
  box-shadow: none;
}

.canvas-container.is-horizontal .page-wrapper canvas {
  position: absolute;
  top: 0;
  left: 0;
  transform: none;
  transform-origin: 0 0;
}

.canvas-container.is-horizontal .page-wrapper canvas:not(.ink-canvas) {
  z-index: 1;
}

.canvas-container.is-horizontal .page-wrapper .ink-canvas {
  z-index: 2;
}

.page-wrapper {
  position: absolute;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  box-sizing: content-box;
}

canvas {
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.ink-canvas {
  z-index: var(--z-pdf-ink-canvas);
  pointer-events: none;
}

.screenshot-overlay {
  position: absolute;
  border: 2px dashed #1890ff;
  background: rgba(24, 144, 255, 0.2);
  z-index: var(--z-pdf-selection-overlay);
  pointer-events: none;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 16px 24px;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  z-index: var(--z-pdf-loading-overlay);
}

.horizontal-nav {
  position: absolute;
  left: 0;
  top: 50%;
  width: 100%;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: var(--z-pdf-loading-overlay);
}

.horizontal-nav .nav-btn {
  position: absolute;
  pointer-events: auto;
  width: 44px;
  height: 44px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
}

.horizontal-nav .nav-left {
  left: 12px;
}

.horizontal-nav .nav-right {
  right: 12px;
}

.eraser-cursor {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.4);
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  pointer-events: none;
  box-sizing: border-box;
  z-index: var(--z-pdf-eraser-cursor);
  transform: translate(-50%, -50%);
}
</style>