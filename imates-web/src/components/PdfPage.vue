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
          <!-- PDF 页面 -->
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
            <!-- 内联新增输入（仅针对正在编辑的新笔记，尚未保存） -->
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

            <!-- 已保存笔记的标记 + 提示卡片：完全交给 PdfNoteAnchor 的 display 模式渲染 -->
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
            <!-- PDF 渲染层：外层负责布局与滚动区域，内层负责缩放 -->
            <canvas :ref="(el) => setPageCanvasRef(el, index)" class="page-canvas"></canvas>
            <!-- 绘制层：用于实时预览手写轨迹（使用页面逻辑尺寸，缩放统一由外层 transform 处理） -->
            <canvas
              v-if="
                ['highlighter', 'pen', 'eraser-draw'].includes(currentMode) &&
                currentStroke?.pageIndex === index
              "
              :ref="(el) => setDrawingCanvasRef(el, index)"
              class="drawing-canvas"
              :width="layout.width"
              :height="layout.height"
              :style="{
                width: `${layout.width}px`,
                height: `${layout.height}px`,
              }"
            ></canvas>
            <!-- 截图裁剪框可视化：矩形模式 -->
            <div
              v-if="
                isScreenshotMode &&
                screenshotRect &&
                screenshotRect.pageIndex === index &&
                screenshotShape === 'rectangle'
              "
              class="screenshot-rect"
              :style="getScreenshotRectStyle(screenshotRect, layout)"
            ></div>

            <!-- 截图裁剪框可视化：自由形状模式，使用 SVG 折线实时预览轨迹 -->
            <svg
              v-if="
                isScreenshotMode &&
                screenshotRect &&
                screenshotRect.pageIndex === index &&
                screenshotShape === 'polygon' &&
                screenshotRect.points &&
                screenshotRect.points.length > 1
              "
              class="screenshot-polygon"
              :style="{
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: layout.width + 'px',
                height: layout.height + 'px',
              }"
            >
              <polyline
                :points="screenshotRect.points
                  .map((p) => `${p.x},${p.y}`)
                  .join(' ')"
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

    <!-- 右侧笔记列表面板：显示/隐藏由父组件通过 v-if 控制 -->
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
  computed,
  watch,
  nextTick,
  onMounted,
  onUpdated,
  onBeforeUnmount,
  defineExpose,
  type ComponentPublicInstance,
  type CSSProperties,
} from 'vue'
import { useRoute } from 'vue-router'
import { resourceManager } from '../services/resource-storage'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import * as mupdf from 'mupdf'
import PdfGestureDebugPanel from './PdfGestureDebugPanel.vue'
import PdfNoteListPanel from './PdfNoteListPanel.vue'
import PdfNoteAnchor from './PdfNoteAnchor.vue'
import { IndexedDBService, type IndexedDBConfig } from '@/services/indexeddb-service'

// ==================== 对外接口（emits / props / store） ====================
const emit = defineEmits<{
  (e: 'screenshot-captured', blob: Blob): void
}>()

interface Props {
  file: File | null
}
const props = defineProps<Props>() // 组件入参（PDF 文件）
const store = usePdfViewerStore() // 全局 PDF 查看器状态
const route = useRoute()

// ==================== DOM 引用 ====================
const viewerContainer = ref<HTMLDivElement | null>(null) // 包裹 PDF 页的容器
const containerRef = ref<HTMLDivElement | null>(null) // 外层滚动容器
const pageCanvasRefs = ref<HTMLCanvasElement[]>([]) // 每页主渲染 Canvas 列表
const drawingCanvasRefs = ref<(HTMLCanvasElement | null)[]>([]) // 实时绘制 Canvas 列表
const editingNoteRef = ref<PageNote | null>(null) // 正在编辑的笔记引用

// 设置手写高亮临时 Canvas 引用
const setDrawingCanvasRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el && el instanceof HTMLCanvasElement) {
    drawingCanvasRefs.value[index] = el
  }
}

// 设置 PDF 页面 Canvas 引用
const setPageCanvasRef = (el: Element | ComponentPublicInstance | null, index: number) => {
  if (el && el instanceof HTMLCanvasElement) {
    pageCanvasRefs.value[index] = el
  }
}

// ==================== PDF 文档状态 ====================
const isLoading = ref(false) // PDF 是否正在加载
const error = ref<string | null>(null) // 加载错误信息
const pdfDoc = ref<mupdf.Document | null>(null) // MuPDF 文档对象
const totalPages = ref(0) // PDF 总页数
const pageLayouts = ref<Array<{ width: number; height: number }>>([]) // 每页尺寸布局
const totalHeight = ref(0) // 全部页面总高度
const maxWidth = ref(0) // 所有页面中最大宽度

// ==================== 布局与视口 ====================
const toolbarHeight = ref(0) // 工具栏高度
const containerWidth = ref(0) // 容器宽度（用于自适应）
const currentPageIndex = ref(0) // 当前滚动到的页码

// ==================== 手势与缩放参数 ====================
const minScale = ref(0.25) // 最小缩放倍数
const maxScale = ref(3.0) // 最大缩放倍数
const zoomThreshold = ref(0.25) // 捏合缩放判定阈值（建议 0.04 ~ 0.1）
const panThreshold = ref(14) // 平移手势判定阈值（越小越容易触发滚动）
const friction = ref(0.001) // 惯性摩擦系数
const inertiaThreshold = ref(0.05) // 惯性停止速度阈值

// 捏合缩放状态
let lastTouchDistance = 0 // 上次双指距离
let pinchStartScale = 1 // 捏合开始时的缩放比例
let pinchStartContentOffsetY = 0 // 捏合开始时的内容 Y 偏移
let pinchStartContentOffsetX = 0 // 捏合开始时的内容 X 偏移
let pinchStartMouseY = 0 // 捏合开始时的鼠标 Y 位置
let pinchStartMouseX = 0 // 捏合开始时的鼠标 X 位置
let pinchLastCenterY = 0 // 上次捏合中心点 Y
let isPinching = false // 是否正在捏合

// 平移与惯性状态
let lastPanX = 0 // 上次平移 X 位置
let lastPanY = 0 // 上次平移 Y 位置
let lastPanTime = 0 // 上次平移时间戳
let panVelocityX = 0 // X 方向惯性速度
let panVelocity = 0 // Y 方向惯性速度
let inertiaFrameId: number | null = null // 惯性动画帧 ID

// 缩放进行中标记：用于阻止高亮/画笔/橡皮在缩放手势期间误触发
const isZooming = ref(false)

// 手势模式
let gestureMode: 'none' | 'zoom' | 'pan' = 'none' // 当前手势模式

// ==================== 截图模式（框选 + 裁剪） ====================
type ScreenshotShape = 'rectangle' | 'polygon'

interface ScreenshotRect {
  pageIndex: number
  x1: number
  y1: number
  x2: number
  y2: number
  // 自由形状时记录整条路径点（页面逻辑坐标，未乘 scale）
  points?: { x: number; y: number }[]
}
const screenshotRect = ref<ScreenshotRect | null>(null) // 截图框选区域
const isDraggingScreenshot = ref(false) // 是否正在拖动截图框
const isScreenshotMode = ref(false) // 截图模式：独立于 currentMode，用于 PDF 区域截图

const screenshotShape = computed<ScreenshotShape>(() => {
  const shape = (store.drawingConfig as any).screenshotShape
  return shape === 'polygon' ? 'polygon' : 'rectangle'
})

// ==================== 笔记功能（UI + IndexedDB 持久化） ====================
// 页眉笔记
interface PageNote {
  id: string
  pageIndex: number
  x: number // 相对该页宽度的比例 [0,1]
  y: number // 相对该页高度的比例 [0,1]
  text: string
}
type PdfInteractionMode = 'hand' | 'note' | 'highlighter' | 'pen' | 'eraser-draw' // 统一交互模式状态：与 UnifiedToolbar 工具枚举对齐
const currentMode = ref<PdfInteractionMode>('hand') // 当前交互模式
const notes = ref<PageNote[]>([]) // PDF 中的所有笔记
const activeNoteId = ref<string | null>(null) // 当前激活的笔记 ID
const isNotePanelOpen = ref(false) // 右侧笔记面板显示状态
const selectedNoteId = ref<string | null>(null) // 右侧列表中当前选中的笔记 ID

// 内联新增笔记状态
const editingInlineNote = ref<PageNote | null>(null)
const inlineNoteText = ref('')

interface HighlightStrokePoint {
  x: number // PDF 页面坐标系中的 x
  y: number // PDF 页面坐标系中的 y
}
type StrokeMode = 'highlight' | 'pen' | 'eraser'
interface HighlightStroke {
  pageIndex: number
  points: HighlightStrokePoint[]
  mode: StrokeMode
}
const currentStroke = ref<HighlightStroke | null>(null) // 当前绘制中的笔迹（高亮或画笔）
const MIN_PEN_POINT_DIST2 = 0.8 * 0.8 // 可根据实际调，单位是 PDF 坐标系距离
// 缓存每一页的 PDF bounds，避免在坐标转换时重复 loadPage
const pageBoundsCache = ref<Map<number, [number, number, number, number]>>(new Map())
const showDebugPanel = ref(false) // 是否展示调试面板
const pendingNotePosition = ref<{
  pageIndex: number
  x: number
  y: number
} | null>(null) // 待创建笔记的位置

// 多指手势期间临时切换工具状态
let lastToolMode: PdfInteractionMode | null = null // 记录进入多指手势前的工具
const isPointerToolSuspended = ref(false) // 多指/缩放期间暂停绘图工具

const pageNotesByIndex = computed(() => {
  const groups: Record<number, PageNote[]> = {}
  for (const note of notes.value) {
    if (!groups[note.pageIndex]) {
      groups[note.pageIndex] = []
    }
    groups[note.pageIndex].push(note)
  }
  return groups
})

// 绘制/截图模式：在 viewer-inner 上阻止原生滚动，让外部区域仍然可以滚动
const isDrawingOrScreenshotMode = computed(
  () =>
    isScreenshotMode.value ||
    ['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)
)

// ==================== 样式计算 ====================
// 外层：负责滚动区域与整体水平居中（按缩放后宽度计算）
const viewerOuterStyle = computed(() => {
  const scale = store.scale
  const visualWidth = maxWidth.value * scale
  const visualHeight = totalHeight.value * scale

  // 外层：负责滚动区域与整体水平居中（按缩放后宽度计算）
  return {
    position: 'relative' as const,
    width: `${visualWidth}px`,
    minHeight: `${visualHeight}px`,
  }
})

// 内层：只负责视觉缩放
const viewerInnerStyle = computed(() => ({
  width: `${maxWidth.value}px`,
  minHeight: `${totalHeight.value}px`,
  position: 'relative' as const,
  transform: `scale(${store.scale})`,
  transformOrigin: 'top left',
}))

// PDF 页面样式
const pdfPageStyle = computed(() => ({
  height: `${window.innerHeight - toolbarHeight.value}px`,
}))

// 获取页面样式
const getPageStyle = (layout: { width: number; height: number }) => ({
  position: 'relative' as const,
  width: `${layout.width}px`,
  height: `${layout.height}px`,
  margin: `0 0 ${store.pageGap}px`,
})

// 获取笔记样式
const getNoteStyle = (
  note: PageNote,
  layout: { width: number; height: number }
): CSSProperties => ({
  position: 'absolute',
  left: `${note.x * layout.width}px`,
  top: `${note.y * layout.height}px`,
})

// 获取笔记提示样式
const getNoteTooltipStyle = (
  note: PageNote,
  layout: { width: number; height: number }
): CSSProperties => ({
  position: 'absolute',
  left: `${note.x * layout.width}px`,
  top: `${note.y * layout.height - 8}px`,
})

// 截图裁剪框样式
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

  const width = x2 - x1
  const height = y2 - y1
  return {
    position: 'absolute',
    left: `${x1}px`,
    top: `${y1}px`,
    width: `${width}px`,
    height: `${height}px`,
    boxSizing: 'border-box',
  }
}

// 将当前 PDF 文档（包含所有批注）保存回 IndexedDB 中的教材文件条目
const saveCurrentPdfToStorage = async () => {
  if (!pdfDoc.value) return

  const pdf = pdfDoc.value.asPDF()
  if (!pdf) return

  try {
    console.log('[PdfPage] saveCurrentPdfToStorage')
    // 使用 MuPDF 提供的增量保存，将当前文档导出为缓冲区
    let buffer: any
    try {
      buffer = pdf.saveToBuffer('incremental')
    } catch (e) {
      console.warn('[saveCurrentPdfToStorage] incremental 保存失败，回退到 full 保存', e)
      buffer = pdf.saveToBuffer() // 或 'full'
    }
    const uint8 = buffer.asUint8Array() as Uint8Array

    // 复制到新的 Uint8Array，避免 SharedArrayBuffer 类型问题
    const data = new Uint8Array(uint8.length)
    data.set(uint8)

    // 从路由参数中获取当前文件的 resourceId
    const resourceId = route.query.resourceId as string | undefined
    if (!resourceId) {
      console.warn('saveCurrentPdfToStorage: 缺少 resourceId，无法保存 PDF')
      return
    }

    // 仅更新 textbook_files 表中的二进制数据
    await resourceManager.updateFileData(resourceId, data)
    console.log('[PdfPage] saveCurrentPdfToStorage')
  } catch (e) {
    console.error('保存 PDF 到 IndexedDB 失败', e)
  }
}
// ==================== 坐标转换工具函数 ====================

interface NormalizedPoint {
  x: number // 相对该页宽度的比例 [0,1]
  y: number // 相对该页高度的比例 [0,1]
}

interface PdfPoint {
  x: number
  y: number
}

// Screen -> Normalized（页内归一化坐标 [0,1]）
const screenPointToNormalized = (
  clientX: number,
  clientY: number,
  pageIndex: number,
  layout: { width: number; height: number }
): NormalizedPoint | null => {
  if (!viewerContainer.value) return null

  const pageElements = viewerContainer.value.querySelectorAll<HTMLElement>('.page')
  const pageEl = pageElements[pageIndex]
  if (!pageEl) return null

  const rect = pageEl.getBoundingClientRect()

  // 视觉坐标（已经包含 CSS scale 的缩放效果）
  const localXVisual = clientX - rect.left
  const localYVisual = clientY - rect.top

  const scale = store.scale || 1

  // 折算回未缩放页面坐标
  const localX = localXVisual / scale
  const localY = localYVisual / scale

  // 归一化到 [0,1]
  const nx = localX / layout.width
  const ny = localY / layout.height

  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null

  return { x: nx, y: ny }
}

// Normalized -> PDF（MuPDF 页面坐标）
const normalizedToPdfPoint = (norm: NormalizedPoint, pageIndex: number): PdfPoint | null => {
  if (!pdfDoc.value) return null

  const cached = pageBoundsCache.value.get(pageIndex)
  let bounds: [number, number, number, number]

  if (cached) {
    bounds = cached
  } else {
    const pdf = pdfDoc.value.asPDF()
    if (!pdf) return null
    console.log(`[PdfPage] getBounds page ${pageIndex}`)
    const page = pdf.loadPage(pageIndex) as mupdf.PDFPage
    bounds = page.getBounds() as [number, number, number, number]
    page.destroy()
    console.log(`[PdfPage] getBounds page ${pageIndex}`)
    pageBoundsCache.value.set(pageIndex, bounds)
  }
  const pageWidth = bounds[2] - bounds[0]
  const pageHeight = bounds[3] - bounds[1]

  const pdfX = bounds[0] + norm.x * pageWidth
  const pdfY = bounds[1] + norm.y * pageHeight

  return { x: pdfX, y: pdfY }
}

// Screen -> PDF（方便现有逻辑复用）
const screenPointToPdfPoint = (
  clientX: number,
  clientY: number,
  pageIndex: number,
  layout: { width: number; height: number }
): HighlightStrokePoint | null => {
  const norm = screenPointToNormalized(clientX, clientY, pageIndex, layout)
  if (!norm) return null

  const pdfPoint = normalizedToPdfPoint(norm, pageIndex)
  if (!pdfPoint) return null

  return { x: pdfPoint.x, y: pdfPoint.y }
}

// PDF -> Screen（用于高亮预览时将 PDF 点映射到当前屏幕上的 Canvas 坐标）
const pdfPointToScreenOnPage = (
  pdfPoint: PdfPoint,
  pageIndex: number,
  layout: { width: number; height: number }
): { x: number; y: number } | null => {
  if (!pdfDoc.value) return null

  const cached = pageBoundsCache.value.get(pageIndex)
  let bounds: [number, number, number, number]

  if (cached) {
    bounds = cached
  } else {
    const pdf = pdfDoc.value.asPDF()
    if (!pdf) return null
    console.log(`[PdfPage] getBounds page ${pageIndex}`)
    const page = pdf.loadPage(pageIndex) as mupdf.PDFPage
    bounds = page.getBounds() as [number, number, number, number]
    page.destroy()
    console.log(`[PdfPage] getBounds page ${pageIndex}`)
    pageBoundsCache.value.set(pageIndex, bounds)
  }
  const pageWidth = bounds[2] - bounds[0]
  const pageHeight = bounds[3] - bounds[1]

  const nx = (pdfPoint.x - bounds[0]) / pageWidth
  const ny = (pdfPoint.y - bounds[1]) / pageHeight

  // 这里返回的是页面逻辑坐标（未乘全局缩放），实际缩放由外层 transform: scale 统一处理，
  // 确保预览层和主渲染在任何缩放倍数下保持对齐
  return {
    x: nx * layout.width,
    y: ny * layout.height,
  }
}

// 点击笔记锚点：设置当前激活/选中笔记，并打开右侧列表（不滚动 PDF 主视图）
const onNoteMarkerClick = (note: PageNote) => {
  activeNoteId.value = note.id
  selectedNoteId.value = note.id
  isNotePanelOpen.value = true
}

// 点击页面添加笔记
const handlePageClick = (
  event: MouseEvent,
  pageIndex: number,
  layout: { width: number; height: number }
) => {
  // 非绘图模式 + 处于笔记模式才处理点击
  if (['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)) return
  if (currentMode.value !== 'note') return

  // 优先处理已展开的 display 模式气泡：有激活的笔记但当前没有内联新增时，先关闭 display
  if (!editingInlineNote.value && activeNoteId.value) {
    activeNoteId.value = null
    return
  }

  // 如果当前已有一个内联新增气泡
  if (editingInlineNote.value) {
    const text = inlineNoteText.value.trim()
    if (text) {
      // 有内容：先保存并关闭
      handleInlineCreateConfirm(text)
      return
    } else {
      // 无内容：直接取消
      handleInlineCreateCancel()
      return
    }
  }

  // 复用通用坐标转换：Screen -> Normalized
  const norm = screenPointToNormalized(event.clientX, event.clientY, pageIndex, layout)
  if (!norm) return

  // 生成一个临时笔记用于内联输入，不立即加入 notes
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const tempNote: PageNote = {
    id: tempId,
    pageIndex,
    x: norm.x,
    y: norm.y,
    text: '',
  }

  editingInlineNote.value = tempNote
  inlineNoteText.value = ''
  activeNoteId.value = tempId
}

// 内联新增笔记确认：将临时位置转为正式笔记（仅负责写入数据与关闭输入）
const handleInlineCreateConfirm = (textFromChild: string) => {
  if (!editingInlineNote.value) return

  const text = textFromChild.trim()
  if (!text) {
    // 空内容：仅关闭输入
    editingInlineNote.value = null
    inlineNoteText.value = ''
    activeNoteId.value = null
    return
  }

  const { pageIndex, x, y } = editingInlineNote.value
  const now = Date.now()
  const id = `${now}-${Math.random().toString(36).slice(2)}`

  // 只写入内存/持久化数据，display 展示仍由模板区基于 notes/pageNotesByIndex 统一渲染
  notes.value.push({
    id,
    pageIndex,
    x,
    y,
    text,
    createdAt: now,
    // 预留作者信息字段，后续需要时可以写入
    // authorId: userInfo.id,
    // authorName: userInfo.name,
  } as any)

  editingInlineNote.value = null
  inlineNoteText.value = ''
  activeNoteId.value = null
  void saveNotesToDb()
}

// 内联新增笔记取消：仅关闭输入，不产生笔记
const handleInlineCreateCancel = () => {
  editingInlineNote.value = null
  inlineNoteText.value = ''
  activeNoteId.value = null
}

// 开始一条新的笔画（高亮或画笔）
const handleHighlightPointerDown = async (
  event: PointerEvent,
  pageIndex: number,
  layout: { width: number; height: number }
) => {
  // 多指/缩放期间暂停所有绘图工具
  if (isPointerToolSuspended.value) {
    return
  }
  // 缩放进行中，不允许开始新的笔迹
  if (isZooming.value) {
    return
  }
  // 截图模式：优先处理为框选起点
  if (isScreenshotMode.value) {
    // 如果当前正在缩放（双指捏合或 isZooming），不允许进入截图
    if (isZooming.value || isPinching) {
      return
    }

    // 捏合/双指等多指操作时不进入截图
    if ((event as any).isPrimary === false) {
      return
    }

    // 非鼠标左键不进入截图
    if (event.pointerType === 'mouse' && event.button !== 0) return

    // 获取页面元素
    if (!viewerContainer.value) return
    const pageElements = viewerContainer.value.querySelectorAll<HTMLElement>('.page')
    const pageEl = pageElements[pageIndex]
    if (!pageEl) return

    // 获取页面逻辑坐标
    const rect = pageEl.getBoundingClientRect()
    const scale = store.scale || 1
    const xVisual = event.clientX - rect.left
    const yVisual = event.clientY - rect.top
    const x = xVisual / scale
    const y = yVisual / scale

    if (screenshotShape.value === 'polygon') {
      screenshotRect.value = {
        pageIndex,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
        points: [{ x, y }],
      }
    } else {
      screenshotRect.value = {
        pageIndex,
        x1: x,
        y1: y,
        x2: x,
        y2: y,
      }
    }
    isDraggingScreenshot.value = true

    // 阻止后续手写逻辑
    return
  }
  // 仅在高亮/画笔/橡皮擦模式下处理 Pointer 事件，其他模式（包括手势）直接放行
  if (!['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)) {
    return
  }
  if (!pdfDoc.value) return

  // 仅处理主按键或触摸/笔
  if (event.pointerType === 'mouse' && event.button !== 0) return

  const point = screenPointToPdfPoint(event.clientX, event.clientY, pageIndex, layout)
  if (!point) return

  const mode: StrokeMode =
    currentMode.value === 'highlighter'
      ? 'highlight'
      : currentMode.value === 'pen'
      ? 'pen'
      : currentMode.value === 'eraser-draw'
      ? 'eraser'
      : 'highlight'

  currentStroke.value = {
    pageIndex,
    points: [point],
    mode,
  }
}

let lastHighlightPreviewTime = 0
const HIGHLIGHT_PREVIEW_INTERVAL = 16 // ms，约 60fps

// 手写高亮 / 画笔 / 橡皮擦：移动过程中追加点
const handleHighlightPointerMove = (
  event: PointerEvent,
  pageIndex: number,
  layout: { width: number; height: number }
) => {
  // 多指/缩放期间暂停所有绘图工具
  if (isPointerToolSuspended.value) {
    return
  }
  // 缩放进行中，不处理笔迹移动
  if (isZooming.value) {
    return
  }
  // 截图模式：拖动更新矩形
  if (
    isScreenshotMode.value &&
    isDraggingScreenshot.value &&
    screenshotRect.value &&
    screenshotRect.value.pageIndex === pageIndex
  ) {
    if (!viewerContainer.value) return
    const pageElements = viewerContainer.value.querySelectorAll<HTMLElement>('.page')
    const pageEl = pageElements[pageIndex]
    if (!pageEl) return

    const rect = pageEl.getBoundingClientRect()
    const scale = store.scale || 1
    const xVisual = event.clientX - rect.left
    const yVisual = event.clientY - rect.top

    const x = xVisual / scale
    const y = yVisual / scale

    screenshotRect.value.x2 = x
    screenshotRect.value.y2 = y

    if (screenshotShape.value === 'polygon') {
      if (!screenshotRect.value.points) {
        screenshotRect.value.points = []
      }
      const pts = screenshotRect.value.points
      const last = pts[pts.length - 1]
      const dx = x - last.x
      const dy = y - last.y
      if (dx * dx + dy * dy > 1) {
        pts.push({ x, y })
      }
    }

    // TODO：如果你希望在页面上画一个半透明矩形，可以在这里用 overlay canvas 或绝对定位 div 来渲染
    return
  }

  // 高亮模式、画笔模式或橡皮擦模式下才处理移动
  if (!['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)) return
  if (!currentStroke.value) return
  if (currentStroke.value.pageIndex !== pageIndex) {
    return
  }

  const point = screenPointToPdfPoint(event.clientX, event.clientY, pageIndex, layout)
  if (!point) return

  const stroke = currentStroke.value
  const lastPoint = stroke.points[stroke.points.length - 1]

  // pen 模式使用“距离阈值”控制采样密度，避免快速书写时点过稀导致折线/缺口
  if (stroke.mode === 'pen') {
    const dx = point.x - lastPoint.x
    const dy = point.y - lastPoint.y
    const dist2 = dx * dx + dy * dy
    if (dist2 >= MIN_PEN_POINT_DIST2) {
      stroke.points.push(point)
    }
  } else {
    // 高亮 / 橡皮擦仍然每次都追加点
    stroke.points.push(point)
  }

  // 预览节流：仅对高亮/橡皮擦模式应用，pen 模式不过滤 pointermove，保证轨迹顺滑
  if (stroke.mode !== 'pen') {
    const now = performance.now()
    if (now - lastHighlightPreviewTime < HIGHLIGHT_PREVIEW_INTERVAL) {
      return
    }
    lastHighlightPreviewTime = now
  }

  if (stroke.mode === 'eraser') {
    // 橡皮擦模式：实时绘制橡皮轨迹 + 命中提示
    void drawEraserHitPreview(pageIndex, layout, stroke.points)
  } else {
    // 高亮 / 画笔模式：原有实时预览
    drawStrokePreview(pageIndex, layout)
  }
}

// 手写高亮 / 画笔：结束笔画并创建 MuPDF Ink 注释
const handleHighlightPointerUp = async (
  event: PointerEvent,
  pageIndex: number,
  layout: { width: number; height: number }
) => {
  // 多指/缩放期间暂停所有绘图工具
  if (isPointerToolSuspended.value) {
    currentStroke.value = null
    clearDrawingCanvas(pageIndex)
    return
  }
  // 缩放进行中，直接丢弃当前笔迹
  if (isZooming.value) {
    currentStroke.value = null
    clearDrawingCanvas(pageIndex)
    return
  }
  // 截图模式：结束拖拽，裁剪截图
  if (
    isScreenshotMode.value &&
    isDraggingScreenshot.value &&
    screenshotRect.value &&
    screenshotRect.value.pageIndex === pageIndex
  ) {
    isDraggingScreenshot.value = false

    const rectInfo = screenshotRect.value
    screenshotRect.value = null

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
    if (widthCss <= 5 || heightCss <= 5) {
      return
    }
    const pageCanvas = pageCanvasRefs.value[pageIndex]
    if (!pageCanvas) return

    // 1. 先算出 canvas 像素 / 未缩放 CSS 的 DPR
    const clientWidth = pageCanvas.clientWidth || widthCss
    const clientHeight = pageCanvas.clientHeight || heightCss
    const dprX = pageCanvas.width / clientWidth
    const dprY = pageCanvas.height / clientHeight
    // 2. 引入当前缩放倍数
    const scale = store.scale || 1

    // 3. CSS 坐标先除以 scale（还原到未缩放 CSS 坐标），再乘 DPR 变成像素坐标
    const sx = x1Css * dprX
    const sy = y1Css * dprY
    const sWidth = widthCss * dprX
    const sHeight = heightCss * dprY
    const offscreen = document.createElement('canvas')
    offscreen.width = sWidth
    offscreen.height = sHeight

    const ctx = offscreen.getContext('2d')
    const pageCtx = pageCanvas.getContext('2d')
    if (!ctx || !pageCtx) return

    // 先填充白色背景，避免选区外区域呈现为黑色/透明
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, sWidth, sHeight)
    ctx.restore()

    if (screenshotShape.value === 'polygon' && rectInfo.points && rectInfo.points.length > 2) {
      ctx.save()
      ctx.beginPath()
      for (let i = 0; i < rectInfo.points.length; i++) {
        const p = rectInfo.points[i]
        const px = (p.x - x1Css) * dprX
        const py = (p.y - y1Css) * dprY
        if (i === 0) {
          ctx.moveTo(px, py)
        } else {
          ctx.lineTo(px, py)
        }
      }
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(pageCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight)
      ctx.restore()
    } else {
      // 矩形模式下，直接在白底上绘制截图区域
      ctx.drawImage(pageCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight)
    }

    offscreen.toBlob(
      (blob) => {
        if (blob) {
          emit('screenshot-captured', blob)
        }
      },
      'image/jpeg',
      0.9
    )
    return
  }
  // 非高亮/画笔/橡皮模式下，直接清空
  if (!['highlighter', 'pen', 'eraser-draw'].includes(currentMode.value)) {
    currentStroke.value = null
    clearDrawingCanvas(pageIndex)
    return
  }

  // 非当前页或 PDF 文档未加载，直接清空
  if (!currentStroke.value || currentStroke.value.pageIndex !== pageIndex || !pdfDoc.value) {
    currentStroke.value = null
    clearDrawingCanvas(pageIndex)
    return
  }

  // 补一个收尾点
  const endPoint = screenPointToPdfPoint(event.clientX, event.clientY, pageIndex, layout)
  if (endPoint) {
    currentStroke.value.points.push(endPoint)
  }

  // 清空当前笔画
  const stroke = currentStroke.value
  currentStroke.value = null

  // 清除临时绘制层
  clearDrawingCanvas(pageIndex)

  if (!stroke || stroke.points.length < 2) {
    return
  }

  // 橡皮擦模式：根据橡皮路径删除当前页附近的 Ink 注释
  if (stroke.mode === 'eraser') {
    try {
      await eraseInkByEraserPath(pageIndex, stroke.points)
    } catch (e) {
      console.error('橡皮擦删除 Ink 注释失败', e)
    }
    return
  }

  try {
    // PDF 文档未加载，直接清空
    const pdf = pdfDoc.value.asPDF()
    if (!pdf) return

    // 使用 MuPDF 操作历史，将“一笔”作为一个可撤销操作
    pdf.beginOperation?.('stroke')
    pdf.beginImplicitOperation?.()
    try {
      // 加载当前页
      const page = pdf.loadPage(pageIndex) as mupdf.PDFPage
      const annot = page.createAnnotation('Ink')

      // 对 pen 模式的轨迹做一次简单平滑，高亮模式保持原始点列
      const sourcePoints =
        stroke.mode === 'pen' ? smoothStrokePoints(stroke.points) : stroke.points

      // 将高亮/画笔路径转换为 MuPDF 的 InkList 格式
      const inkList = [sourcePoints.map((p: HighlightStrokePoint) => [p.x, p.y] as mupdf.Point)]
      ;(annot as any).setInkList?.(inkList)

      // 颜色和线宽从 pdfViewerStore.drawingConfig 读取，来源于 UnifiedToolbar
      let color: [number, number, number]
      let width: number

      if (stroke.mode === 'highlight') {
        // 荧光笔：使用 highlighterColor / highlighterWidth
        const hex = store.drawingConfig.highlighterColor || '#FFFF00'
        const size = store.drawingConfig.highlighterWidth || 5
        const r = parseInt(hex.slice(1, 3), 16) / 255
        const g = parseInt(hex.slice(3, 5), 16) / 255
        const b = parseInt(hex.slice(5, 7), 16) / 255
        color = [r, g, b]
        width = size
        ;(annot as any).setOpacity?.(0.5)
      } else {
        // 画笔：使用 penColor / penWidth
        const hex = store.drawingConfig.penColor || '#ff0000'
        const size = store.drawingConfig.penWidth || 1
        const r = parseInt(hex.slice(1, 3), 16) / 255
        const g = parseInt(hex.slice(3, 5), 16) / 255
        const b = parseInt(hex.slice(5, 7), 16) / 255
        color = [r, g, b]
        width = size
        ;(annot as any).setOpacity?.(1.0)
      }

      ;(annot as any).setColor?.(color)
      ;(annot as any).setBorderWidth?.(width)

      // 更新页面
      page.update()
    } finally {
      // 结束操作
      pdf.endOperation?.()
    }
    // 仅重渲当前页，避免整份 PDF 频繁重渲导致卡顿
    await renderPage(pageIndex)
    // 笔迹创建完成后自动持久化到 IndexedDB
    void saveCurrentPdfToStorage()
  } catch (e) {
    console.error('创建高亮/画笔注释失败', e)
  }
}

// 计算两点距离的平方（避免频繁开方）
const dist2 = (a: HighlightStrokePoint, b: HighlightStrokePoint) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

// 橡皮路径与 Ink 点是否命中：任意 Ink 点距橡皮路径某点小于阈值则认为命中
const strokeHitsEraser = (
  eraserPoints: HighlightStrokePoint[],
  inkPoints: HighlightStrokePoint[],
  threshold: number
) => {
  if (eraserPoints.length === 0 || inkPoints.length === 0) return false
  const threshold2 = threshold * threshold

  for (const ep of eraserPoints) {
    for (const ip of inkPoints) {
      if (dist2(ep, ip) <= threshold2) {
        return true
      }
    }
  }
  return false
}

// ========== 笔迹平滑工具（仅对 pen 模式做简单平滑） ==========

// 使用简单的细分 + 移动平均来让轨迹更圆滑
const smoothStrokePoints = (points: HighlightStrokePoint[]): HighlightStrokePoint[] => {
  if (points.length <= 2) {
    return points
  }

  const subdivided: HighlightStrokePoint[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    subdivided.push(p0)

    // 在每对相邻点之间插入一个中点，增加采样密度
    const mid: HighlightStrokePoint = {
      x: (p0.x + p1.x) / 2,
      y: (p0.y + p1.y) / 2,
    }
    subdivided.push(mid)
  }
  // 末尾最后一个点补上
  subdivided.push(points[points.length - 1])

  if (subdivided.length <= 2) {
    return subdivided
  }

  // 三点移动平均平滑：保留首尾点，中间点用 [prev, current, next] 的平均
  const smoothed: HighlightStrokePoint[] = []
  smoothed.push(subdivided[0])

  for (let i = 1; i < subdivided.length - 1; i++) {
    const pPrev = subdivided[i - 1]
    const p = subdivided[i]
    const pNext = subdivided[i + 1]

    const avg: HighlightStrokePoint = {
      x: (pPrev.x + p.x + pNext.x) / 3,
      y: (pPrev.y + p.y + pNext.y) / 3,
    }
    smoothed.push(avg)
  }

  smoothed.push(subdivided[subdivided.length - 1])

  return smoothed
}

// 获取橡皮擦命中参数
const getEraserHitParams = (page: mupdf.PDFPage, eraserPoints: HighlightStrokePoint[]) => {
  const bounds = page.getBounds()
  const pageHeight = bounds[3] - bounds[1]
  // 橡皮“粗细”统一在这里控制
  const threshold = pageHeight * 0.02

  // 现在暂时不做插值，直接用原始路径
  const denseEraserPoints = eraserPoints

  return { threshold, denseEraserPoints, pageHeight }
}

// 擦除 Ink 注释
const eraseInkByEraserPath = async (pageIndex: number, eraserPoints: HighlightStrokePoint[]) => {
  if (!pdfDoc.value) return
  const pdf = pdfDoc.value.asPDF()
  if (!pdf) return

  const page = pdf.loadPage(pageIndex) as mupdf.PDFPage
  try {
    const annots = page.getAnnotations() as any[]
    if (!annots || annots.length === 0) return

    const { threshold, denseEraserPoints } = getEraserHitParams(page, eraserPoints)
    const ERASED_OPACITY = 0.15

    const hitAnnots: any[] = []
    let changed = false

    for (const annot of annots) {
      const type = annot.getType?.()
      if (type !== 'Ink') continue

      // 取 Ink 的点列表
      const inkList = (annot as any).getInkList?.() as mupdf.Point[][] | undefined
      if (!inkList || inkList.length === 0) continue

      // 简化：Ink 通常只有一条路径，直接取 inkList[0]
      const inkPointsArray = inkList[0]
      const inkPoints: HighlightStrokePoint[] = inkPointsArray.map(([x, y]) => ({ x, y }))

      if (strokeHitsEraser(denseEraserPoints, inkPoints, threshold)) {
        // 先立刻变淡，给用户反馈
        ;(annot as any).setOpacity?.(ERASED_OPACITY)
        hitAnnots.push(annot)
        changed = true
      }
    }

    if (changed) {
      // 先让变淡的效果渲染出来
      page.update()
      await renderPage(pageIndex)

      // 然后真正删除本次扫到的这些 Ink
      for (const annot of hitAnnots) {
        page.deleteAnnotation(annot)
      }
      if (hitAnnots.length > 0) {
        page.update()
        await renderPage(pageIndex)
      }
      void saveCurrentPdfToStorage()
    }
  } finally {
    page.destroy?.()
  }
}

// 实时绘制预览
const drawStrokePreview = (pageIndex: number, layout: { width: number; height: number }) => {
  const stroke = currentStroke.value
  if (!stroke) {
    return
  }

  const canvas = drawingCanvasRefs.value[pageIndex]
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 清除之前的绘制
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (stroke.points.length < 2) return

  // 将当前笔画的 PDF 坐标点转换为屏幕坐标点
  const screenPoints = stroke.points
    .map((p) => pdfPointToScreenOnPage({ x: p.x, y: p.y }, pageIndex, layout))
    .filter((p): p is { x: number; y: number } => !!p)

  if (screenPoints.length < 2) return

  // 预览颜色和线宽从 pdfViewerStore.drawingConfig 读取，和最终写入 PDF 的配置保持一致
  let previewColor: string
  let previewWidth: number

  if (stroke.mode === 'highlight') {
    // 高亮
    const hex = store.drawingConfig.highlighterColor || '#FFFF00'
    const size = store.drawingConfig.highlighterWidth || 5
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    previewColor = `rgba(${r}, ${g}, ${b}, 0.5)` // 半透明高亮
    previewWidth = size
  } else {
    // 普通笔迹
    const hex = store.drawingConfig.penColor || '#ff0000'
    const size = store.drawingConfig.penWidth || 1
    previewColor = hex
    previewWidth = size
  }

  // 设置画笔样式（预览层尽量与 PDF 笔迹粗细接近）
  ctx.strokeStyle = previewColor
  ctx.lineWidth = Math.max(previewWidth, 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalCompositeOperation = 'source-over'

  // 绘制平滑路径
  ctx.beginPath()

  // 移动到起点
  const first = screenPoints[0]
  ctx.moveTo(first.x, first.y)

  // 记录上一个点
  let prevX = first.x
  let prevY = first.y

  // 二次贝塞尔曲线平滑连接
  for (let i = 1; i < screenPoints.length; i++) {
    // 取当前点
    const point = screenPoints[i]
    const x = point.x
    const y = point.y

    // 使用二次贝塞尔曲线平滑连接
    const midX = (prevX + x) / 2
    const midY = (prevY + y) / 2
    ctx.quadraticCurveTo(prevX, prevY, midX, midY)

    // 更新上一个点
    prevX = x
    prevY = y
  }

  // 连接到最后一个点
  ctx.lineTo(prevX, prevY)
  ctx.stroke()
}

// 在预览层绘制橡皮轨迹和被橡皮命中的 Ink 路径（仅视觉反馈，不改 PDF）
const drawEraserHitPreview = async (
  pageIndex: number,
  layout: { width: number; height: number },
  eraserPoints: HighlightStrokePoint[]
) => {
  if (!pdfDoc.value) return

  const canvas = drawingCanvasRefs.value[pageIndex]
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 每次重画橡皮预览：清掉之前内容
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 1. 先画橡皮轨迹（蓝色线）
  if (eraserPoints.length >= 2) {
    const eraserScreenPoints = eraserPoints
      .map((p) => pdfPointToScreenOnPage({ x: p.x, y: p.y }, pageIndex, layout))
      .filter((p): p is { x: number; y: number } => !!p)

    if (eraserScreenPoints.length >= 2) {
      ctx.save()
      ctx.strokeStyle = 'rgba(999, 999, 999, 0.1)' // 蓝色橡皮轨迹
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = 'source-over'

      ctx.beginPath()
      const first = eraserScreenPoints[0]
      ctx.moveTo(first.x, first.y)
      let prevX = first.x
      let prevY = first.y

      for (let i = 1; i < eraserScreenPoints.length; i++) {
        const { x, y } = eraserScreenPoints[i]
        const midX = (prevX + x) / 2
        const midY = (prevY + y) / 2
        ctx.quadraticCurveTo(prevX, prevY, midX, midY)
        prevX = x
        prevY = y
      }

      ctx.lineTo(prevX, prevY)
      ctx.stroke()
      ctx.restore()
    }
  }

  // 2. 再画被橡皮命中的 Ink 预览（浅色覆盖）
  const pdf = pdfDoc.value.asPDF()
  if (!pdf) return

  const page = pdf.loadPage(pageIndex) as mupdf.PDFPage
  try {
    const annots = page.getAnnotations() as any[]
    if (!annots || annots.length === 0) return

    const { threshold, denseEraserPoints } = getEraserHitParams(page, eraserPoints)

    for (const annot of annots) {
      const type = annot.getType?.()
      if (type !== 'Ink') continue

      const inkList = (annot as any).getInkList?.() as mupdf.Point[][] | undefined
      if (!inkList || inkList.length === 0) continue

      const inkPointsArray = inkList[0]
      const inkPoints: HighlightStrokePoint[] = inkPointsArray.map(([x, y]) => ({ x, y }))

      if (!strokeHitsEraser(denseEraserPoints, inkPoints, threshold)) continue

      const screenPoints = inkPoints
        .map((p) => pdfPointToScreenOnPage({ x: p.x, y: p.y }, pageIndex, layout))
        .filter((p): p is { x: number; y: number } => !!p)

      if (screenPoints.length < 2) continue

      ctx.save()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)' // 被擦到的线，用浅色提示
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalCompositeOperation = 'source-over'

      ctx.beginPath()
      const first = screenPoints[0]
      ctx.moveTo(first.x, first.y)
      let prevX = first.x
      let prevY = first.y

      for (let i = 1; i < screenPoints.length; i++) {
        const { x, y } = screenPoints[i]
        const midX = (prevX + x) / 2
        const midY = (prevY + y) / 2
        ctx.quadraticCurveTo(prevX, prevY, midX, midY)
        prevX = x
        prevY = y
      }

      ctx.lineTo(prevX, prevY)
      ctx.stroke()
      ctx.restore()
    }
  } finally {
    page.destroy?.()
  }
}

// 清除绘制层
const clearDrawingCanvas = (pageIndex: number) => {
  const canvas = drawingCanvasRefs.value[pageIndex]
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

const deleteNote = (note: PageNote) => {
  notes.value = notes.value.filter((n) => n.id !== note.id)
  if (activeNoteId.value === note.id) {
    activeNoteId.value = null
  }
  void saveNotesToDb()
}


// 滚动事件处理
const handleScroll = () => {
  if (!containerRef.value || pageLayouts.value.length === 0) return

  const scrollTop = containerRef.value.scrollTop
  const scale = store.scale || 1
  const contentOffsetY = scrollTop / scale

  const pageGap = store.pageGap
  let accumulated = 0
  let index = 0

  for (let i = 0; i < pageLayouts.value.length; i++) {
    const layout = pageLayouts.value[i]
    const pageTop = accumulated
    const pageBottom = accumulated + layout.height
    if (contentOffsetY >= pageTop && contentOffsetY < pageBottom) {
      index = i
      break
    }
    accumulated += layout.height + pageGap
  }

  currentPageIndex.value = index
}

// 滚动到笔记位置
const scrollToNote = (note: PageNote) => {
  if (!containerRef.value || pageLayouts.value.length === 0) return

  const pageIndex = note.pageIndex
  if (pageIndex < 0 || pageIndex >= pageLayouts.value.length) return

  const pageGap = store.pageGap
  let offsetY = 0
  for (let i = 0; i < pageIndex; i++) {
    offsetY += pageLayouts.value[i].height + pageGap
  }

  const layout = pageLayouts.value[pageIndex]
  offsetY += note.y * layout.height

  const scale = store.scale || 1
  const rawScrollTop = offsetY * scale

  const container = containerRef.value
  const containerHeight = container.clientHeight || window.innerHeight - toolbarHeight.value

  // 期望让笔记大致在屏幕中间
  let targetScrollTop = rawScrollTop - containerHeight / 2

  // 边界处理，防止滚动超出
  const maxScrollTop = container.scrollHeight - containerHeight
  if (targetScrollTop < 0) targetScrollTop = 0
  if (targetScrollTop > maxScrollTop) targetScrollTop = maxScrollTop

  // 带过渡效果的滚动（300ms 可根据需要调整长短）
  container.scrollTo({
    top: targetScrollTop,
    behavior: 'smooth',
  })
  activeNoteId.value = note.id
}

// IndexedDB 持久化（使用通用 IndexedDBService）
interface NotesDocRecord {
  docKey: string
  notes: PageNote[]
}

const notesDbConfig: IndexedDBConfig = {
  dbName: 'pdf-notes-db',
  version: 1,
  stores: [
    {
      name: 'docs',
      keyPath: 'docKey',
    },
  ],
}

// IndexedDB 服务实例
const notesDbService = IndexedDBService.getInstance(notesDbConfig)

// 获取文档键
const getDocKey = () => {
  if (!props.file) return 'no-file'
  return `${props.file.name}|${props.file.size}`
}

// 从 IndexedDB 加载笔记
const loadNotesFromDb = async () => {
  if (!props.file) return

  try {
    const result = await notesDbService.get<NotesDocRecord>('docs', getDocKey())
    // 加载笔记
    if (result && Array.isArray(result.notes)) {
      notes.value = result.notes.filter((n: any): n is PageNote => {
        return (
          !!n &&
          typeof n.id === 'string' &&
          typeof n.pageIndex === 'number' &&
          typeof n.x === 'number' &&
          typeof n.y === 'number' &&
          typeof n.text === 'string'
        )
      })
    }
  } catch (e) {
    console.error('加载笔记失败', e)
  }
}

// 保存笔记到 IndexedDB
const saveNotesToDb = async () => {
  if (!props.file) return

  try {
    const record: NotesDocRecord = {
      docKey: getDocKey(), // 文档键
      notes: notes.value, // 保存笔记
    }
    await notesDbService.put<NotesDocRecord>('docs', record)
  } catch (e) {
    console.error('保存笔记失败', e)
  }
}

// 撤销最近一次笔画（包含高亮与画笔）
const undoLastStroke = async () => {
  if (!pdfDoc.value) return

  try {
    const pdf = pdfDoc.value.asPDF()
    if (!pdf || !pdf.canUndo?.()) return

    pdf.undo?.()

    // 撤销后重新渲染所有页面，或至少受影响的页面
    await render()

    // 撤销完成后自动持久化 PDF
    void saveCurrentPdfToStorage()
  } catch (e) {
    console.error('撤销最近一次笔画失败', e)
  }
}

// 生命周期相关状态
let isUnmounting = false
let renderAbortController: AbortController | null = null
let toolbarResizeObserver: ResizeObserver | null = null

// 渲染单页到对应的 Canvas（用于增量更新，例如手写高亮完成后只重渲当前页）
const renderPage = async (pageIndex: number) => {
  if (!pdfDoc.value || isUnmounting) return
  const doc = pdfDoc.value

  // 保证页面布局和 canvas 已经就位
  const layout = pageLayouts.value[pageIndex]
  const canvas = pageCanvasRefs.value[pageIndex]
  if (!layout || !canvas) return

  const renderScale = 1.0
  const baseDpr = window.devicePixelRatio || 1
  const renderDpr = baseDpr * 2
  const matrix: mupdf.Matrix = [renderScale * renderDpr, 0, 0, renderScale * renderDpr, 0, 0]

  const page = doc.loadPage(pageIndex)
  try {
    const bounds = page.getBounds()
    const renderWidth = (bounds[2] - bounds[0]) * renderScale
    const renderHeight = (bounds[3] - bounds[1]) * renderScale

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = renderWidth * renderDpr
    canvas.height = renderHeight * renderDpr
    canvas.style.width = `${renderWidth}px`
    canvas.style.height = `${renderHeight}px`

    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
    try {
      const pixels = pixmap.getPixels()
      const width = pixmap.getWidth()
      const height = pixmap.getHeight()
      const rgbData = new Uint8Array(pixels)
      const rgbaData = new Uint8ClampedArray(width * height * 4)

      for (let i = 0; i < width * height; i++) {
        rgbaData[i * 4] = rgbData[i * 3]
        rgbaData[i * 4 + 1] = rgbData[i * 3 + 1]
        rgbaData[i * 4 + 2] = rgbData[i * 3 + 2]
        rgbaData[i * 4 + 3] = 255
      }

      ctx.putImageData(new ImageData(rgbaData, width, height), 0, 0)
    } finally {
      pixmap.destroy()
    }
  } finally {
    page.destroy?.()
  }
}

// 加载 PDF 文件
const loadPdf = async (file: File) => {
  try {
    error.value = null

    // 如果之前有PDF文档，先销毁它
    if (pdfDoc.value) {
      pdfDoc.value.destroy()
      pdfDoc.value = null
    }

    // 读取文件为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // 使用MuPDF打开PDF文档
    const doc = mupdf.Document.openDocument(uint8Array, 'application/pdf')

    // 获取总页数
    const pageCount = doc.countPages()
    // 保存PDF文档对象和总页数
    pdfDoc.value = doc
    totalPages.value = pageCount
    // 加载成功后，自动渲染
    await render()
    // 渲染完成后，从本地 IndexedDB 加载对应文件的笔记
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'PDF 加载失败'
    console.error('PDF加载失败:', err)
  }
}

// 渲染 PDF 到 Canvas
const render = async () => {
  if (!pdfDoc.value || isUnmounting) return

  // 取消之前的渲染任务
  if (renderAbortController) {
    renderAbortController.abort()
  }
  renderAbortController = new AbortController()
  const signal = renderAbortController.signal

  try {
    error.value = null
    const doc = pdfDoc.value
    const numPages = doc.countPages()
    // 使用固定缩放比例 1.0 进行渲染，实际缩放通过 CSS transform 实现
    const renderScale = 1.0
    const pageGap = store.pageGap

    if (signal.aborted) return
    // 第一阶段：计算所有页面的布局尺寸
    const layouts: Array<{ width: number; height: number }> = []
    let top = 0
    for (let i = 0; i < numPages; i++) {
      if (signal.aborted) return

      const page = doc.loadPage(i)
      const bounds = page.getBounds()
      const width = (bounds[2] - bounds[0]) * renderScale
      const height = (bounds[3] - bounds[1]) * renderScale

      layouts.push({ width, height })
      top += height + pageGap
      page.destroy() // MuPDF 资源需要手动释放
    }

    if (signal.aborted) return

    pageLayouts.value = layouts
    totalHeight.value = top - pageGap
    maxWidth.value = layouts.length > 0 ? Math.max(...layouts.map((l) => l.width)) : 0
    await nextTick() // 等待 DOM 更新，确保 Canvas 元素已创建
    if (signal.aborted) return

    // 使用设备像素比，可以在清晰度和性能之间取得平衡
    const baseDpr = window.devicePixelRatio || 1
    // 使用 2 倍设备像素比，可以在清晰度和性能之间取得平衡
    const renderDpr = baseDpr * 1.2
    // 在 matrix 中应用渲染 DPR，使 pixmap 尺寸与 Canvas 实际像素匹配
    const matrix: mupdf.Matrix = [renderScale * renderDpr, 0, 0, renderScale * renderDpr, 0, 0] // 变换矩阵（包含渲染 DPR 缩放）

    // 第二阶段：按批次渲染页面到 Canvas，避免一次性阻塞主线程
    const batchSize = 2
    for (let start = 0; start < layouts.length; start += batchSize) {
      if (signal.aborted) return

      const end = Math.min(start + batchSize, layouts.length)

      await Promise.all(
        layouts.slice(start, end).map(async (layout, offset) => {
          const index = start + offset
          // 为每个页面创建独立的渲染任务
          if (signal.aborted) return
          // Canvas 元素
          const canvas = pageCanvasRefs.value[index]
          if (!canvas) return
          // MuPDF 页面对象
          const page = doc.loadPage(index)
          try {
            // 中断渲染
            if (signal.aborted) return
            // 获取页面尺寸
            const bounds = page.getBounds()
            const renderWidth = (bounds[2] - bounds[0]) * renderScale
            const renderHeight = (bounds[3] - bounds[1]) * renderScale
            // Canvas 上下文
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            // 设置 Canvas 尺寸（考虑渲染像素比，初始渲染使用更高的像素密度）
            canvas.width = renderWidth * renderDpr
            canvas.height = renderHeight * renderDpr
            canvas.style.width = `${renderWidth}px`
            canvas.style.height = `${renderHeight}px`
            // 渲染 PDF 页面为像素图（RGB 格式，抗锯齿）
            const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
            try {
              // 中断渲染
              if (signal.aborted) return
              // RGB 转 RGBA（MuPDF 返回 RGB，Canvas 需要 RGBA）
              const pixels = pixmap.getPixels()
              const width = pixmap.getWidth() // 应该是 renderWidth * renderDpr
              const height = pixmap.getHeight() // 应该是 renderHeight * renderDpr
              const rgbData = new Uint8Array(pixels)
              const rgbaData = new Uint8ClampedArray(width * height * 4)
              // RGB 转 RGBA
              for (let i = 0; i < width * height; i++) {
                rgbaData[i * 4] = rgbData[i * 3]
                rgbaData[i * 4 + 1] = rgbData[i * 3 + 1]
                rgbaData[i * 4 + 2] = rgbData[i * 3 + 2]
                rgbaData[i * 4 + 3] = 255
              }
              // 绘制到 Canvas
              if (!signal.aborted) {
                // pixmap 尺寸已匹配 Canvas 实际像素，直接绘制
                ctx.putImageData(new ImageData(rgbaData, width, height), 0, 0)
              }
            } finally {
              // 释放 pixmap 资源
              pixmap.destroy()
            }
          } finally {
            // 释放 MuPDF 页面资源
            page.destroy()
          }
        })
      )

      // 每批渲染完后让出一次主线程，避免长时间卡死
      await nextTick()
    }
  } catch (err) {
    // 取消操作不显示错误
    if (signal.aborted || isUnmounting) {
      return
    }
    console.error('PDF 渲染失败:', err)
    error.value = err instanceof Error ? err.message : 'PDF 渲染失败'
  }
}


// 计算工具栏高度
const calculateToolbarHeight = () => {
  const toolbar = document.querySelector('.unified-toolbar-container.variant-browser')
  if (toolbar) {
    toolbarHeight.value = toolbar.getBoundingClientRect().height
  } else {
    // 如果找不到工具栏，使用默认值（通常浏览器式工具栏高度约为 48-56px）
    toolbarHeight.value = 48
  }
}

// 监听窗口大小变化
const handleResize = () => {
  calculateToolbarHeight()
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
  }
}

// 鼠标滚轮缩放处理
const handleWheel = (event: WheelEvent) => {
  // 检查是否按下了 Ctrl 或 Cmd 键（Mac）
  const isZoomKeyPressed = event.ctrlKey || event.metaKey

  if (isZoomKeyPressed) {
    // 阻止默认的浏览器缩放行为
    event.preventDefault()

    if (!containerRef.value || !viewerContainer.value) return

    // 获取当前缩放比例
    const oldScale = store.scale

    // 计算缩放增量（滚轮向下缩小，向上放大）
    const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.max(minScale.value, Math.min(maxScale.value, oldScale + zoomDelta))

    // 如果缩放比例没有变化（达到边界），直接返回
    if (newScale === oldScale) return

    // 获取容器的位置信息
    const containerRect = containerRef.value.getBoundingClientRect()

    // 计算鼠标相对于滚动容器视口的位置
    const mouseX = event.clientX - containerRect.left
    const mouseY = event.clientY - containerRect.top

    // 获取当前滚动位置
    const scrollTop = containerRef.value.scrollTop
    const scrollLeft = containerRef.value.scrollLeft

    // 计算鼠标指向的内容在缩放前的绝对位置（相对于 viewerContainer 的左上角）
    const contentOffsetY = (scrollTop + mouseY) / oldScale
    const contentOffsetX = (scrollLeft + mouseX) / oldScale

    // 应用新的缩放比例
    store.setScale(newScale)

    // 计算缩放后应该滚动到的位置，使同一内容点保持在鼠标位置
    // 使用 nextTick 确保 DOM 已更新（transform 已应用）
    nextTick(() => {
      if (!containerRef.value) return

      // 计算新的滚动位置
      // 缩放后，同一内容点的位置 = contentOffset * newScale
      // 要使该内容点保持在鼠标位置，需要：scroll + mouse = contentOffset * newScale
      const newScrollTop = contentOffsetY * newScale - mouseY
      const newScrollLeft = contentOffsetX * newScale - mouseX

      // 更新滚动位置，确保不为负数
      containerRef.value.scrollTop = Math.max(0, newScrollTop)
      containerRef.value.scrollLeft = Math.max(0, newScrollLeft)
    })
  }
}

// 计算两点之间距离
const getTouchDistance = (touch1: Touch, touch2: Touch) => {
  const dx = touch2.clientX - touch1.clientX
  const dy = touch2.clientY - touch1.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

// 触摸开始（双指）
const handleTouchStart = (event: TouchEvent) => {
  if (!containerRef.value || !viewerContainer.value) return

  // 截图拖拽过程中一旦检测到多指，立即取消当前截图框
  if (isScreenshotMode.value && event.touches.length >= 2) {
    if (isDraggingScreenshot.value && screenshotRect.value) {
      isDraggingScreenshot.value = false
      screenshotRect.value = null
    }
  }

  if (event.touches.length === 2) {
    // 多指开始：临时切换为 hand 模式并暂停绘图工具
    if (!isPointerToolSuspended.value) {
      lastToolMode = currentMode.value
      isPointerToolSuspended.value = true
      if (currentMode.value !== 'hand') {
        currentMode.value = 'hand'
      }
    }
    isZooming.value = true
    event.preventDefault()

    const [touch1, touch2] = [event.touches[0], event.touches[1]]
    lastTouchDistance = getTouchDistance(touch1, touch2)
    pinchStartScale = store.scale

    const centerXAbs = (touch1.clientX + touch2.clientX) / 2
    const centerYAbs = (touch1.clientY + touch2.clientY) / 2
    pinchLastCenterY = centerYAbs
    lastPanX = centerXAbs
    lastPanY = centerYAbs
    lastPanTime = performance.now()
    panVelocityX = 0
    panVelocity = 0
    isPinching = true
    gestureMode = 'none'

    if (inertiaFrameId !== null) {
      cancelAnimationFrame(inertiaFrameId)
      inertiaFrameId = null
    }

    const containerRect = containerRef.value.getBoundingClientRect()
    const centerX = (touch1.clientX + touch2.clientX) / 2 - containerRect.left
    const centerY = (touch1.clientY + touch2.clientY) / 2 - containerRect.top
    const scrollTop = containerRef.value.scrollTop
    const scrollLeft = containerRef.value.scrollLeft

    pinchStartMouseX = centerX
    pinchStartMouseY = centerY
    pinchStartContentOffsetY = (scrollTop + centerY) / pinchStartScale
    pinchStartContentOffsetX = (scrollLeft + centerX) / pinchStartScale
  }
}

// 触摸移动（双指捏合缩放）
const handleTouchMove = (event: TouchEvent) => {
  if (!containerRef.value || !viewerContainer.value) return

  if (event.touches.length === 2 && lastTouchDistance > 0 && isPinching) {
    event.preventDefault()

    const [touch1, touch2] = [event.touches[0], event.touches[1]]
    const currentDistance = getTouchDistance(touch1, touch2)
    if (currentDistance <= 0) return

    const centerXAbs = (touch1.clientX + touch2.clientX) / 2
    const centerYAbs = (touch1.clientY + touch2.clientY) / 2
    const now = performance.now()
    const dx = centerXAbs - lastPanX
    const dy = centerYAbs - lastPanY

    const scaleFactor = currentDistance / lastTouchDistance
    const distanceChange = Math.abs(scaleFactor - 1)

    // 双指滚动：始终根据位移拖动内容（只用 very small 阈值过滤掉抖动）
    const verySmallMove = 0.5
    if (Math.abs(dx) > verySmallMove || Math.abs(dy) > verySmallMove) {
      const container = containerRef.value
      const maxScrollY = container.scrollHeight - container.clientHeight
      const maxScrollX = container.scrollWidth - container.clientWidth

      const nextScrollTop = Math.min(Math.max(0, container.scrollTop - dy), maxScrollY)
      const nextScrollLeft = Math.min(Math.max(0, container.scrollLeft - dx), maxScrollX)

      container.scrollTop = nextScrollTop
      container.scrollLeft = nextScrollLeft

      const dt = now - lastPanTime
      if (dt > 0) {
        panVelocityX = -dx / dt
        panVelocity = -dy / dt
      }
      lastPanX = centerXAbs
      lastPanY = centerYAbs
      lastPanTime = now
    }
    // 缩放：不再依赖固定模式，只要距离变化超过阈值就进行缩放
    const isZoomCandidate = distanceChange > zoomThreshold.value
    if (isZoomCandidate) {
      const newScale = Math.max(
        minScale.value,
        Math.min(maxScale.value, pinchStartScale * scaleFactor)
      )

      if (newScale === store.scale) return

      store.setScale(newScale)

      nextTick(() => {
        if (!containerRef.value) return

        const newScrollTop = pinchStartContentOffsetY * newScale - pinchStartMouseY
        const newScrollLeft = pinchStartContentOffsetX * newScale - pinchStartMouseX
        containerRef.value.scrollTop = Math.max(0, newScrollTop)
        containerRef.value.scrollLeft = Math.max(0, newScrollLeft)
      })
    }
  }
}

// 触摸结束
const handleTouchEnd = (event: TouchEvent) => {
  if (event.touches.length < 2) {
    // 多指结束：恢复之前的工具模式并恢复绘图工具
    if (isPointerToolSuspended.value) {
      isPointerToolSuspended.value = false
      if (lastToolMode && lastToolMode !== 'hand') {
        currentMode.value = lastToolMode
      }
      lastToolMode = null
    }
    // 所有缩放手势结束时重置 isZooming
    isZooming.value = false
    lastTouchDistance = 0
    isPinching = false

    if (!containerRef.value) return

    const threshold = inertiaThreshold.value
    if (Math.abs(panVelocity) <= threshold && Math.abs(panVelocityX) <= threshold) {
      panVelocity = 0
      panVelocityX = 0
      return
    }

    const container = containerRef.value
    const maxScrollY = container.scrollHeight - container.clientHeight
    const maxScrollX = container.scrollWidth - container.clientWidth
    const frictionValue = friction.value
    let lastTime = performance.now()

    const step = () => {
      if (!containerRef.value) {
        inertiaFrameId = null
        return
      }

      const now = performance.now()
      const dt = now - lastTime
      lastTime = now

      const deltaX = panVelocityX * dt
      const deltaY = panVelocity * dt

      let nextScrollLeft = container.scrollLeft + deltaX
      let nextScrollTop = container.scrollTop + deltaY

      if (nextScrollLeft < 0) {
        nextScrollLeft = 0
        panVelocityX = 0
      } else if (nextScrollLeft > maxScrollX) {
        nextScrollLeft = maxScrollX
        panVelocityX = 0
      }

      if (nextScrollTop < 0) {
        nextScrollTop = 0
        panVelocity = 0
      } else if (nextScrollTop > maxScrollY) {
        nextScrollTop = maxScrollY
        panVelocity = 0
      }

      container.scrollLeft = nextScrollLeft
      container.scrollTop = nextScrollTop

      // 指数衰减：每一帧按比例衰减速度，使惯性更接近原生滚动手感
      // frictionValue 越大，衰减越快，惯性越短
      const damping = Math.exp(-frictionValue * dt)
      panVelocityX *= damping
      panVelocity *= damping

      if (Math.abs(panVelocity) <= threshold && Math.abs(panVelocityX) <= threshold) {
        panVelocityX = 0
        panVelocity = 0
        inertiaFrameId = null
        return
      }

      inertiaFrameId = requestAnimationFrame(step)
    }

    inertiaFrameId = requestAnimationFrame(step)
  }
}

// 生命周期钩子函数
onMounted(async () => {
  console.time('[PdfPage] onMounted')
  // 设置加载状态
  isLoading.value = true
  console.time('111')
  // 设置卸载状态
  isUnmounting = false
  console.timeEnd('111')
  // 等待 DOM 更新
  await nextTick()
  console.time('222')
  // 计算工具栏高度
  calculateToolbarHeight()
  console.timeEnd('222')
  // 获取容器宽度
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
  }
  console.time('333')
  // 使用 ResizeObserver 监听工具栏高度变化
  const toolbar = document.querySelector('.unified-toolbar-container.variant-browser')
  if (toolbar) {
    toolbarResizeObserver = new ResizeObserver(() => {
      // 重新计算工具栏高度
      calculateToolbarHeight()
    })
    toolbarResizeObserver.observe(toolbar)
  }
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
  console.timeEnd('333')
  // 组件挂载后，如果已有文件，立即加载
  if (props.file) {
    console.time('444')
    // 加载 PDF 文档
    await loadPdf(props.file)
    console.timeEnd('444')
    // 加载 notes
    console.time('555')
    await loadNotesFromDb()
    console.timeEnd('555')
  }
  isLoading.value = false
  console.timeEnd('[PdfPage] onMounted')
})

onBeforeUnmount(() => {
  isUnmounting = true

  // 移除 ResizeObserver
  if (toolbarResizeObserver) {
    toolbarResizeObserver.disconnect()
    toolbarResizeObserver = null
  }

  // 移除窗口大小变化监听
  window.removeEventListener('resize', handleResize)

  // 取消正在进行的渲染任务
  if (renderAbortController) {
    renderAbortController.abort()
    renderAbortController = null
  }

  // 清理 canvas 引用
  pageCanvasRefs.value = []

  // 清理布局数据
  pageLayouts.value = []
  totalHeight.value = 0
  maxWidth.value = 0

  // 销毁 PDF 文档
  if (pdfDoc.value) {
    pdfDoc.value.destroy()
    pdfDoc.value = null
  }

  // 重置状态
  error.value = null
  totalPages.value = 0
})

// 进入截图模式
const enterScreenshotMode = () => {
  isScreenshotMode.value = true
  isDraggingScreenshot.value = false
  screenshotRect.value = null
}

// 退出截图模式
const exitScreenshotMode = () => {
  isScreenshotMode.value = false
  isDraggingScreenshot.value = false
  screenshotRect.value = null
}

// 打开笔记面板
const openNotePanel = () => {
  isNotePanelOpen.value = true
}

// 关闭笔记面板
const closeNotePanel = () => {
  isNotePanelOpen.value = false
}

// 暴露给父组件的方法，用于从工具栏控制调试面板和交互模式
defineExpose({
  // 调试面板：切换显示/隐藏
  toggleDebugPanel: () => {
    exitScreenshotMode()
    showDebugPanel.value = !showDebugPanel.value
  },
  // 笔记模式：再次点击切回手势
  toggleNoteMode: () => {
    exitScreenshotMode()
    openNotePanel()
    currentMode.value = 'note'
  },
  // 高亮模式：再次点击切回手势
  toggleHighlightMode: () => {
    exitScreenshotMode()
    closeNotePanel()
    currentMode.value = 'highlighter'
  },
  // 画笔模式：再次点击切回手势
  togglePenMode: () => {
    exitScreenshotMode()
    closeNotePanel()
    currentMode.value = 'pen'
  },
  // 橡皮擦模式：再次点击切回手势
  toggleEraserMode: () => {
    exitScreenshotMode()
    closeNotePanel()
    currentMode.value = 'eraser-draw'
  },
  // 手势模式：强制切回手势
  toggleGestureMode: () => {
    exitScreenshotMode()
    closeNotePanel()
    currentMode.value = 'hand'
  },
  // 截图模式：切换到手势模式
  toggleScreenshotMode: () => {
    enterScreenshotMode()
    closeNotePanel()
    currentMode.value = 'hand' // 防止高亮/画笔拦截 pointer 事件
  },
  undoLastStroke,
  saveCurrentPdfToStorage,
})
</script>

<style scoped>
.pdf-page-layout {
  display: flex;
  width: 100%;
  height: 100%;
}

.pdf-page {
  display: flex;
  justify-content: center; /* 水平居中 viewerContainer */
  align-items: flex-start; /* 顶部对齐 */
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: #0a0020;
  touch-action: auto;
}
.viewer-inner {
  touch-action: auto; /* 默认内容区域也能单指滚动 */
}

.viewer-inner.block-touch {
  touch-action: none; /* 笔/橡皮/截图时，在内容上禁用原生滚动 */
}

.note-panel-wrapper {
  flex-shrink: 0;
}

.debug-toggle {
  position: fixed;
  right: 8px;
  bottom: 50%;
  z-index: 2100;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
}

.debug-toggle:hover {
  background: rgba(0, 0, 0, 0.8);
}

.note-toggle {
  position: fixed;
  right: 8px;
  bottom: 40%;
  z-index: 2100;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
}

.note-toggle.active {
  background: #ff9800;
}

.note-marker {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ff9800;
  color: #fff;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.note-marker-icon {
  width: 24px;
  height: 24px;
  display: block;
}

.note-marker-initial {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff; /* 根据气泡颜色调整 */
  pointer-events: none;
}

.note-tooltip {
  z-index: 200;
}

/* 展示用笔记卡片 */
.note-input-card {
  border-radius: 0px 12px 12px 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  background-color: #ffffff;
  padding: 0 5px;
  min-width: 160px;
}

.note-input-card .q-field {
  flex: 1;
}

/* 展示状态的容器 */
.note-display-content {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
}

.note-display-text {
  flex: 1;
  font-size: 12px;
  line-height: 1.4;
  color: #111827;
  padding: 6px 4px;
  white-space: pre-wrap;
}

.note-display-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.page {
  position: relative;
  display: block;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.page-canvas {
  display: block;
}

.drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 10;
}

.screenshot-rect {
  border: 2px dashed #42a5f5; /* 蓝色虚线边框 */
  background-color: rgba(66, 165, 245, 0.15); /* 半透明蓝色填充 */
  pointer-events: none; /* 不阻挡鼠标事件 */
  z-index: 20;
}

.page-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.page-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #fff;
  z-index: 1000;
}

.error-icon {
  font-size: 48px;
}

.error-text {
  font-size: 16px;
}
</style>

