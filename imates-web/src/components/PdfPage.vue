<template>
  <div 
    class="pdf-page pdf-page-item" 
    :style="pageStyle"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @wheel="handleWheel"
  >
    <!-- PDF 渲染层 -->
    <canvas 
      ref="pdfCanvas" 
      class="pdf-layer"
      :style="pdfCanvasStyle"
    ></canvas>
    
    <!-- DrawingBoard 标注层 -->
    <div 
      v-if="!store.hideNotes"
      ref="drawingBoardWrapper"
      class="drawing-board-wrapper"
      :style="drawingBoardStyle"
    >
      <canvas 
        ref="drawingCanvas"
        class="drawing-canvas"
      ></canvas>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="page-loading">
      <q-spinner-dots size="30px" color="primary" />
    </div>
    
    <!-- 错误状态 -->
    <div v-if="error" class="page-error">
      <div class="error-icon">⚠️</div>
      <div class="error-text">第 {{ layout.pageNum }} 页加载失败</div>
      <q-btn 
        size="sm" 
        color="primary" 
        @click="retryLoad"
      >
        重试
      </q-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, toRaw, inject } from 'vue'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { IndexedDBService } from '@/services/indexeddb-service'
import { drawSmoothPath, type HandwritingStyle } from '@/utils/drawing/path-smoothing'

// 窗口大小响应式状态
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)

// Props 定义
interface Props {
  layout: {
    pageNum: number
    top: number
    height: number
    width: number
  }
}

const props = defineProps<Props>()

// 定义事件emit
const emit = defineEmits<{
  'screenshot-captured': [blob: Blob]
}>()

// 使用 Store
const store = usePdfViewerStore()

// 获取父组件提供的注册函数
const registerPageComponent = inject<
  (
    pageNum: number,
    component: { undo: () => boolean; redo: () => boolean; canUndo: () => boolean; canRedo: () => boolean },
  ) => void
>('registerPageComponent')

const unregisterPageComponent = inject<(pageNum: number) => void>('unregisterPageComponent')

// 获取父组件提供的更新触发器
const triggerToolStatesUpdate = inject<() => void>('triggerToolStatesUpdate')

// 组件状态
const pdfCanvas = ref<HTMLCanvasElement>()
const drawingCanvas = ref<HTMLCanvasElement>()
const drawingBoardWrapper = ref<HTMLDivElement>()
let ctx: CanvasRenderingContext2D | null = null
const isLoading = ref(false)
const error = ref<string | null>(null)
// 保存当前的渲染任务，用于取消
const currentRenderTask = ref<import('pdfjs-dist').RenderTask | null>(null)
// 渲染防抖定时器
let renderDebounceTimer: ReturnType<typeof setTimeout> | null = null

// DrawingBoard 绘制对象类型
interface DrawObject {
  type: 'path' | 'rectangle' | 'circle' | 'line' | 'triangle' | 'text'
  color: string
  lineWidth: number
  points?: { x: number; y: number }[]
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  text?: string
  fontSize?: number
  opacity?: number
  handwritingStyle?: 'brush' | 'writing' | 'spray' | 'oil-paint' | 'crayon' | 'marker' | 'pencil' | 'watercolor' | 'standard' | 'smooth' | 'natural' | 'fast' // 画笔样式（包含旧类型以向后兼容）
  rawPoints?: { x: number; y: number }[] // 原始点（可选，用于平滑处理）
}

// 绘制对象列表
const objects = ref<DrawObject[]>([])

// 历史记录管理
const history = ref<DrawObject[][]>([]) // 历史记录数组，存储每个状态的深拷贝
const historyIndex = ref(-1) // 当前历史记录索引，-1表示没有历史记录
const maxHistorySize = 50 // 最大历史记录数量限制

// 保存当前状态到历史记录
const saveState = () => {
  // 如果当前不在历史记录末尾，删除后面的记录
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  // 保存当前状态（深拷贝）
  const currentState = JSON.parse(JSON.stringify(objects.value))
  history.value.push(currentState)
  historyIndex.value = history.value.length - 1

  // 限制历史记录数量
  if (history.value.length > maxHistorySize) {
    history.value.shift()
    historyIndex.value--
  }
  
  // 调试日志：检查历史记录状态
  console.log(`[PdfPage ${props.layout.pageNum}] saveState: historyIndex=${historyIndex.value}, history.length=${history.value.length}, canUndo=${canUndo.value}`)
  
  // 通知父组件更新工具状态（触发 toolStates computed 重新计算）
  if (triggerToolStatesUpdate) {
    triggerToolStatesUpdate()
  }
}

// 撤销函数
const undo = (): boolean => {
  if (historyIndex.value <= 0) {
    return false // 无法撤销
  }

  historyIndex.value--
  objects.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  render()
  
  // 保存到Store
  const normalizedObjects = objects.value.map(obj => normalizeCoordinates(obj, store.scale))
  const serializedObjects = IndexedDBService.deepSerialize(normalizedObjects) as object[]
  store.updateAnnotations(props.layout.pageNum, serializedObjects)
  
  return true
}

// 重做函数
const redo = (): boolean => {
  if (historyIndex.value >= history.value.length - 1) {
    return false // 无法重做
  }

  historyIndex.value++
  objects.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  render()
  
  // 保存到Store
  const normalizedObjects = objects.value.map(obj => normalizeCoordinates(obj, store.scale))
  const serializedObjects = IndexedDBService.deepSerialize(normalizedObjects) as object[]
  store.updateAnnotations(props.layout.pageNum, serializedObjects)
  
  return true
}

// 检查是否可以撤销
const canUndo = computed(() => historyIndex.value > 0)

// 检查是否可以重做
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// 当前绘制状态
const isDrawing = ref(false)
const currentPath = ref<{ x: number; y: number }[]>([])
const startPoint = ref<{ x: number; y: number } | null>(null)
const tempObject = ref<DrawObject | null>(null)

// 截图状态
const screenshotState = ref({
  isDrawing: false,
  startPoint: null as { x: number; y: number } | null,
  currentShape: null as DrawObject | null,
  polygonPoints: [] as { x: number; y: number }[]
})

// 选择工具状态
const selectedObjects = ref<Set<number>>(new Set())
const selectionBox = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const selectionPath = ref<{ x: number; y: number }[]>([]) // 自由框选路径
const isDraggingObjects = ref(false)
const dragStartPoint = ref<{ x: number; y: number } | null>(null)
const objectsOriginalPositions = ref<Map<number, DrawObject>>(new Map())

// 双指滑动状态
const touchState = ref({
  isTwoFinger: false,
  startY: 0,
  lastY: 0,
  // 缩放相关
  isZooming: false,
  initialDistance: 0,
  initialScale: 1.0,
  startTouches: [] as Touch[]
})

// 计算属性
const pageStyle = computed(() => {
  // 检查是否需要横向滚动（当PDF宽度超过视口时）
  const needsHorizontalScroll = props.layout.width > windowWidth.value * 0.9 // 留10%边距
  
  return {
    position: 'relative' as const,
    width: `${props.layout.width}px`,
    height: `${props.layout.height}px`,
    margin: '0 auto 20px',
    backgroundColor: '#f5f5f5',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    borderRadius: '4px',
    // 当需要横向滚动时，移除overflow: hidden，允许内容溢出
    overflow: needsHorizontalScroll ? 'visible' : 'hidden',
    // 确保最小宽度，防止被压缩
    minWidth: `${props.layout.width}px`,
    maxWidth: `${props.layout.width}px`,
    flexShrink: 0 as const
  }
})

// PDF Canvas 样式
const pdfCanvasStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none' as const
}))

// DrawingBoard 容器样式
const drawingBoardStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  userSelect: 'none' as const,
  width: '100%',
  height: '100%',
  pointerEvents: 'auto' as const,
  zIndex: 2
}))

// 初始化 PDF 页面
const initPdfPage = async () => {
  if (!store.pdfDoc || !pdfCanvas.value) {
    return
  }
  
  try {
    // 取消之前的渲染任务
    if (currentRenderTask.value) {
      try {
        currentRenderTask.value.cancel()
      } catch {
        // 忽略取消错误
      }
      currentRenderTask.value = null
    }
    
    isLoading.value = true
    error.value = null
    
    // 使用PdfCoreService渲染页面（传入store中的pdfDoc）
    // 注意：这里需要确保pdfCoreService能够使用store中的pdfDoc
    // 如果pdfCoreService需要自己的实例，可以从store获取
    const rawPdfDoc = toRaw(store.pdfDoc)
    const page = await rawPdfDoc.getPage(props.layout.pageNum)
    const rawPage = toRaw(page)
    
    // 获取设备像素比（高DPI支持）
    const dpr = window.devicePixelRatio || 1
    
    // 使用原始scale获取viewport（用于PDF内容渲染）
    const viewport = rawPage.getViewport({ scale: store.scale })
    
    const canvas = pdfCanvas.value
    const context = canvas.getContext('2d')
    if (!context) return
    
    // 设置Canvas实际分辨率（高DPI）
    canvas.width = viewport.width * dpr
    canvas.height = viewport.height * dpr
    
    // 设置Canvas显示尺寸（CSS像素）
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    
    // 缩放上下文以适应高DPI
    context.scale(dpr, dpr)
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }
    
    // 开始渲染并保存任务引用
    const renderTask = rawPage.render(renderContext)
    currentRenderTask.value = renderTask
    
    // 等待渲染完成
    await renderTask.promise
    
    // 渲染完成后清除任务引用
    currentRenderTask.value = null
    
  } catch (err) {
    // 如果是取消错误，忽略（PDF.js的取消错误可能是RenderingCancelledException或包含cancelled的消息）
    if (err instanceof Error) {
      const errorMessage = err.message.toLowerCase()
      if (errorMessage.includes('cancelled') || 
          errorMessage.includes('renderingcancelled') ||
          err.name === 'RenderingCancelledException') {
        return
      }
    }
    // 忽略取消相关的其他错误
    if (err && typeof err === 'object' && 'name' in err && err.name === 'RenderingCancelledException') {
      return
    }
    console.error(`第 ${props.layout.pageNum} 页 PDF 渲染失败:`, err)
    error.value = err instanceof Error ? err.message : '渲染失败'
  } finally {
    isLoading.value = false
    currentRenderTask.value = null
  }
}

// 获取PDF页面的原始尺寸（scale=1时的viewport尺寸）
let baseViewportWidth = 0
let baseViewportHeight = 0

// 初始化 DrawingBoard Canvas
const initDrawingCanvas = async () => {
  if (!drawingCanvas.value || !pdfCanvas.value || !store.pdfDoc) {
    return
  }
  
  try {
    await nextTick()
    
    // 获取PDF页面原始尺寸（用于坐标标准化）
    if (baseViewportWidth === 0 || baseViewportHeight === 0) {
      const rawPdfDoc = toRaw(store.pdfDoc)
      const page = await rawPdfDoc.getPage(props.layout.pageNum)
      const rawPage = toRaw(page)
      const baseViewport = rawPage.getViewport({ scale: 1.0 })
      baseViewportWidth = baseViewport.width
      baseViewportHeight = baseViewport.height
    }
    
    // 获取设备像素比
    const dpr = window.devicePixelRatio || 1
    // 获取当前scale下的viewport尺寸
    const rawPdfDoc = toRaw(store.pdfDoc)
    const page = await rawPdfDoc.getPage(props.layout.pageNum)
    const rawPage = toRaw(page)
    const currentViewport = rawPage.getViewport({ scale: store.scale })
    
    // 设置Canvas实际分辨率（高DPI支持）
    const canvasWidth = currentViewport.width * dpr
    const canvasHeight = currentViewport.height * dpr
    
    // 设置Canvas尺寸
    drawingCanvas.value.width = canvasWidth
    drawingCanvas.value.height = canvasHeight
    drawingCanvas.value.style.width = `${currentViewport.width}px`
    drawingCanvas.value.style.height = `${currentViewport.height}px`
    
    // 获取上下文并重置变换矩阵，然后设置缩放以适应高DPI
    ctx = drawingCanvas.value.getContext('2d')
    if (!ctx) {
      throw new Error('无法获取Canvas上下文')
    }
    // 重置变换矩阵（确保之前的状态被清除）
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    
    // 清理临时对象（缩放时取消正在进行的绘制）
    tempObject.value = null
    isDrawing.value = false
    
    // 加载现有笔记（会在加载时进行坐标转换）
    await loadAnnotations()
    
    // 初始渲染
    render()
    
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页 DrawingBoard Canvas 初始化失败:`, err)
    error.value = err instanceof Error ? err.message : '初始化失败'
  }
}

// 将坐标从标准坐标（scale=1）转换为当前scale的坐标
const scaleCoordinates = (obj: DrawObject, scale: number): DrawObject => {
  const scaled = { ...obj }
  
  if (obj.type === 'path' && obj.points) {
    scaled.points = obj.points.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }))
  } else if (obj.type === 'rectangle' || obj.type === 'triangle') {
    if (obj.x !== undefined) scaled.x = obj.x * scale
    if (obj.y !== undefined) scaled.y = obj.y * scale
    if (obj.width !== undefined) scaled.width = obj.width * scale
    if (obj.height !== undefined) scaled.height = obj.height * scale
  } else if (obj.type === 'circle') {
    if (obj.x !== undefined) scaled.x = obj.x * scale
    if (obj.y !== undefined) scaled.y = obj.y * scale
    if (obj.radius !== undefined) scaled.radius = obj.radius * scale
  } else if (obj.type === 'line') {
    if (obj.x1 !== undefined) scaled.x1 = obj.x1 * scale
    if (obj.y1 !== undefined) scaled.y1 = obj.y1 * scale
    if (obj.x2 !== undefined) scaled.x2 = obj.x2 * scale
    if (obj.y2 !== undefined) scaled.y2 = obj.y2 * scale
  } else if (obj.type === 'text') {
    if (obj.x !== undefined) scaled.x = obj.x * scale
    if (obj.y !== undefined) scaled.y = obj.y * scale
    if (obj.fontSize !== undefined) scaled.fontSize = obj.fontSize * scale
  }
  
  // 线宽也需要缩放
  if (obj.lineWidth !== undefined) {
    scaled.lineWidth = obj.lineWidth * scale
  }
  
  return scaled
}

// 将坐标从当前scale转换为标准坐标（scale=1）
const normalizeCoordinates = (obj: DrawObject, scale: number): DrawObject => {
  const normalized = { ...obj }
  
  if (obj.type === 'path' && obj.points) {
    normalized.points = obj.points.map(p => ({
      x: p.x / scale,
      y: p.y / scale
    }))
  } else if (obj.type === 'rectangle' || obj.type === 'triangle') {
    if (obj.x !== undefined) normalized.x = obj.x / scale
    if (obj.y !== undefined) normalized.y = obj.y / scale
    if (obj.width !== undefined) normalized.width = obj.width / scale
    if (obj.height !== undefined) normalized.height = obj.height / scale
  } else if (obj.type === 'circle') {
    if (obj.x !== undefined) normalized.x = obj.x / scale
    if (obj.y !== undefined) normalized.y = obj.y / scale
    if (obj.radius !== undefined) normalized.radius = obj.radius / scale
  } else if (obj.type === 'line') {
    if (obj.x1 !== undefined) normalized.x1 = obj.x1 / scale
    if (obj.y1 !== undefined) normalized.y1 = obj.y1 / scale
    if (obj.x2 !== undefined) normalized.x2 = obj.x2 / scale
    if (obj.y2 !== undefined) normalized.y2 = obj.y2 / scale
  } else if (obj.type === 'text') {
    if (obj.x !== undefined) normalized.x = obj.x / scale
    if (obj.y !== undefined) normalized.y = obj.y / scale
    if (obj.fontSize !== undefined) normalized.fontSize = obj.fontSize / scale
  }
  
  // 线宽也需要归一化
  if (obj.lineWidth !== undefined) {
    normalized.lineWidth = obj.lineWidth / scale
  }
  
  return normalized
}

// 加载笔记
const loadAnnotations = async () => {
  try {
    // 从store获取注释
    const pageAnnotations = store.allAnnotations[props.layout.pageNum] || []
    
    if (pageAnnotations.length > 0) {
      // 将store中的对象转换为DrawObject格式，并应用当前scale
      objects.value = pageAnnotations.map((obj: unknown) => {
        // 如果已经是DrawObject格式，直接使用
        const drawObj = obj as Partial<DrawObject>
        if (drawObj.type && drawObj.color !== undefined) {
          // 笔记坐标是标准化的（基于scale=1），需要转换为当前scale
          return scaleCoordinates(obj as DrawObject, store.scale)
        }
        // 否则尝试转换（兼容Fabric格式）
        const converted = convertToDrawObject(obj as Record<string, unknown>)
        // 假设旧数据也是基于scale=1的，转换为当前scale
        return scaleCoordinates(converted, store.scale)
      })
    } else {
      objects.value = []
    }
    
    // 初始化历史记录
    // 只保存当前状态作为初始状态，不创建空状态
    // 这样用户撤销时不会直接清空所有笔记，而是需要逐步撤销每个操作
    if (objects.value.length > 0) {
      // 如果有初始数据，只保存当前状态
      history.value = [JSON.parse(JSON.stringify(objects.value))]
      historyIndex.value = 0  // 指向当前状态（唯一的历史记录）
    } else {
      // 如果没有数据，保存空状态
      history.value = [[]]
      historyIndex.value = 0
    }
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页加载笔记失败:`, err)
    objects.value = []
    // 初始化历史记录（错误情况）
    history.value = [[]]
    historyIndex.value = 0
  }
}

// 转换Fabric对象为DrawObject（兼容性处理）
const convertToDrawObject = (fabricObj: Record<string, unknown>): DrawObject => {
  // 这里可以根据实际Fabric对象格式进行转换
  // 暂时返回一个默认的path对象
  const path = fabricObj.path as unknown[] | undefined
  return {
    type: 'path',
    color: (fabricObj.stroke as string) || '#000000',
    lineWidth: (fabricObj.strokeWidth as number) || 3,
    points: path ? path.map((p: unknown) => {
      const point = p as unknown[]
      return { x: point[1] as number, y: point[2] as number }
    }) : []
  }
}

// 渲染画布
const render = () => {
  if (!ctx || !drawingCanvas.value) return
  
  // 获取当前scale下的viewport尺寸（用于逻辑坐标）
  const dpr = window.devicePixelRatio || 1
  // 获取当前viewport的逻辑尺寸（CSS像素）
  const logicalWidth = drawingCanvas.value.width / dpr
  const logicalHeight = drawingCanvas.value.height / dpr
  
  // 清空画布（使用逻辑坐标，因为ctx已经设置了scale(dpr, dpr)）
  ctx.clearRect(0, 0, logicalWidth, logicalHeight)
  
  // 绘制所有对象
  objects.value.forEach((obj) => {
    drawObject(obj)
  })
  
  // 绘制临时对象（正在绘制中）
  if (tempObject.value) {
    drawObject(tempObject.value)
  }
  
  // 绘制截图选区（如果有）
  if (screenshotState.value.currentShape && screenshotState.value.isDrawing) {
    const shape = screenshotState.value.currentShape
    const config = store.drawingConfig
    
    ctx.save()
    ctx.strokeStyle = config.screenshotStrokeColor || '#ff0000'
    ctx.fillStyle = config.screenshotFillColor || 'rgba(255, 0, 0, 0.1)'
    ctx.lineWidth = 2
    
    if (shape.type === 'rectangle' && shape.x !== undefined && shape.y !== undefined && shape.width !== undefined && shape.height !== undefined) {
      // 绘制矩形选区
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
    } else if (shape.type === 'path' && shape.points && shape.points.length > 0) {
      // 绘制自由形状选区
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y)
      }
      ctx.closePath()
      // 使用 even-odd 规则填充，保持与其他路径填充一致
      ctx.fill('evenodd')
      ctx.stroke()
    }
    
    ctx.restore()
  }
  
  // 绘制选中的对象（高亮显示）
  if (selectedObjects.value.size > 0 && ctx) {
    ctx.save()
    ctx.strokeStyle = '#2196F3'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    
    selectedObjects.value.forEach((index) => {
      const obj = objects.value[index]
      const bounds = getObjectBounds(obj)
      if (bounds && ctx) {
        // 绘制选中框
        ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10)
      }
    })
    
    ctx.restore()
  }
  
  // 绘制选框（如果有）
  if (selectionBox.value && ctx) {
    ctx.save()
    ctx.strokeStyle = '#2196F3'
    ctx.fillStyle = 'rgba(33, 150, 243, 0.1)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    
    ctx.fillRect(selectionBox.value.x, selectionBox.value.y, selectionBox.value.width, selectionBox.value.height)
    ctx.strokeRect(selectionBox.value.x, selectionBox.value.y, selectionBox.value.width, selectionBox.value.height)
    
    ctx.restore()
  }
  
  // 绘制自由框选路径（如果有）
  if (selectionPath.value && selectionPath.value.length > 0 && ctx) {
    ctx.save()
    ctx.strokeStyle = '#2196F3'
    ctx.fillStyle = 'rgba(33, 150, 243, 0.1)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    ctx.moveTo(selectionPath.value[0].x, selectionPath.value[0].y)
    for (let i = 1; i < selectionPath.value.length; i++) {
      ctx.lineTo(selectionPath.value[i].x, selectionPath.value[i].y)
    }
    // 如果路径未闭合，连接起点和终点
    if (selectionPath.value.length > 2) {
      ctx.closePath()
    }
    
    // 使用 even-odd 规则填充，与 isPointInPolygon（射线法）保持一致
    ctx.fill('evenodd')
    ctx.stroke()
    
    ctx.restore()
  }
}

// 绘制单个对象
const drawObject = (obj: DrawObject) => {
  if (!ctx) return
  
  ctx.save()
  ctx.strokeStyle = obj.color
  ctx.fillStyle = obj.color
  ctx.lineWidth = obj.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  if (obj.opacity !== undefined) {
    ctx.globalAlpha = obj.opacity
  }
  
  switch (obj.type) {
    case 'path':
      if (obj.points && obj.points.length > 1) {
        // 使用平滑路径绘制（如果指定了样式）
        if (obj.handwritingStyle) {
          // 映射旧样式到新样式
          const mapOldStyleToNew = (style: string): HandwritingStyle => {
            const styleMap: Record<string, HandwritingStyle> = {
              'standard': 'writing',
              'smooth': 'writing',
              'natural': 'crayon',
              'fast': 'pencil',
              'brush': 'brush',
              'writing': 'writing',
              'spray': 'spray',
              'oil-paint': 'oil-paint',
              'crayon': 'crayon',
              'marker': 'marker',
              'pencil': 'pencil',
              'watercolor': 'watercolor'
            }
            return styleMap[style] || 'writing'
          }
          const mappedStyle = mapOldStyleToNew(obj.handwritingStyle)
          drawSmoothPath(ctx, obj.points, mappedStyle, obj.lineWidth, obj.color)
        } else {
          // 兼容旧数据：使用直线连接
          ctx.beginPath()
          ctx.moveTo(obj.points[0].x, obj.points[0].y)
          for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y)
          }
          ctx.stroke()
        }
      }
      break
    case 'rectangle':
      if (obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height)
      }
      break
    case 'circle':
      if (obj.x !== undefined && obj.y !== undefined && obj.radius !== undefined) {
        ctx.beginPath()
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
      break
    case 'line':
      if (obj.x1 !== undefined && obj.y1 !== undefined && obj.x2 !== undefined && obj.y2 !== undefined) {
        ctx.beginPath()
        ctx.moveTo(obj.x1, obj.y1)
        ctx.lineTo(obj.x2, obj.y2)
        ctx.stroke()
      }
      break
    case 'triangle':
      if (obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
        ctx.beginPath()
        ctx.moveTo(obj.x + obj.width / 2, obj.y)
        ctx.lineTo(obj.x, obj.y + obj.height)
        ctx.lineTo(obj.x + obj.width, obj.y + obj.height)
        ctx.closePath()
        ctx.stroke()
      }
      break
    case 'text':
      if (obj.text && obj.x !== undefined && obj.y !== undefined) {
        ctx.font = `${obj.fontSize || 16}px Arial`
        ctx.fillText(obj.text, obj.x, obj.y)
      }
      break
  }
  
  ctx.restore()
}

// 获取鼠标在canvas上的坐标（逻辑坐标，已考虑ctx.scale）
const getCanvasCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
  if (!drawingCanvas.value) return null
  
  const rect = drawingCanvas.value.getBoundingClientRect()
  let clientX, clientY
  
  if (e instanceof MouseEvent) {
    clientX = e.clientX
    clientY = e.clientY
  } else if (e instanceof TouchEvent && e.touches.length > 0) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else {
    return null
  }
  
  // 由于ctx已经设置了scale(dpr, dpr)，drawingCanvas的CSS尺寸等于逻辑尺寸
  // 所以直接使用相对于rect的坐标即可
  // rect.width = viewport.width (CSS尺寸)
  // drawingCanvas.value.width = viewport.width * dpr (实际像素)
  // 绘制时使用的坐标是逻辑坐标（viewport.width范围内的坐标）
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

// 获取对象的边界框
const getObjectBounds = (obj: DrawObject): { x: number; y: number; width: number; height: number } | null => {
  // 获取线宽（默认为0，表示不考虑线宽）
  const lineWidth = obj.lineWidth || 0
  const halfLineWidth = lineWidth / 2
  
  if (obj.type === 'path' && obj.points && obj.points.length > 0) {
    const xs = obj.points.map(p => p.x)
    const ys = obj.points.map(p => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    return {
      x: minX - halfLineWidth,
      y: minY - halfLineWidth,
      width: (maxX - minX) + lineWidth,
      height: (maxY - minY) + lineWidth
    }
  } else if (obj.type === 'rectangle' && obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
    return {
      x: obj.x - halfLineWidth,
      y: obj.y - halfLineWidth,
      width: obj.width + lineWidth,
      height: obj.height + lineWidth
    }
  } else if (obj.type === 'circle' && obj.x !== undefined && obj.y !== undefined && obj.radius !== undefined) {
    return {
      x: obj.x - obj.radius - halfLineWidth,
      y: obj.y - obj.radius - halfLineWidth,
      width: (obj.radius * 2) + lineWidth,
      height: (obj.radius * 2) + lineWidth
    }
  } else if (obj.type === 'line' && obj.x1 !== undefined && obj.y1 !== undefined && obj.x2 !== undefined && obj.y2 !== undefined) {
    const minX = Math.min(obj.x1, obj.x2)
    const maxX = Math.max(obj.x1, obj.x2)
    const minY = Math.min(obj.y1, obj.y2)
    const maxY = Math.max(obj.y1, obj.y2)
    return {
      x: minX - halfLineWidth,
      y: minY - halfLineWidth,
      width: (maxX - minX) + lineWidth,
      height: (maxY - minY) + lineWidth
    }
  } else if (obj.type === 'triangle' && obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
    return {
      x: obj.x - halfLineWidth,
      y: obj.y - halfLineWidth,
      width: obj.width + lineWidth,
      height: obj.height + lineWidth
    }
  } else if (obj.type === 'text' && obj.x !== undefined && obj.y !== undefined) {
    // 文本对象使用估算的尺寸
    const fontSize = obj.fontSize || 16
    return {
      x: obj.x,
      y: obj.y - fontSize,
      width: (obj.text?.length || 0) * fontSize * 0.6,
      height: fontSize
    }
  }
  return null
}

// 检查点是否在对象内
const isPointInObject = (x: number, y: number, obj: DrawObject): boolean => {
  const bounds = getObjectBounds(obj)
  if (!bounds) return false

  // 扩大边界以便于选择
  const padding = 10
  return (
    x >= bounds.x - padding &&
    x <= bounds.x + bounds.width + padding &&
    y >= bounds.y - padding &&
    y <= bounds.y + bounds.height + padding
  )
}

// 查找鼠标位置的对象
const findObjectAtPoint = (x: number, y: number): number | null => {
  // 从后往前查找（最上层优先）
  for (let i = objects.value.length - 1; i >= 0; i--) {
    if (isPointInObject(x, y, objects.value[i])) {
      return i
    }
  }
  return null
}

// 检查矩形是否与对象相交
const isRectIntersectObject = (
  rect: { x: number; y: number; width: number; height: number },
  obj: DrawObject,
): boolean => {
  const bounds = getObjectBounds(obj)
  if (!bounds) return false

  // 两个矩形相交的判定
  return !(
    rect.x > bounds.x + bounds.width ||
    rect.x + rect.width < bounds.x ||
    rect.y > bounds.y + bounds.height ||
    rect.y + rect.height < bounds.y
  )
}

// 查找与矩形相交的所有对象
const findObjectsInRect = (rect: {
  x: number
  y: number
  width: number
  height: number
}): number[] => {
  const result: number[] = []
  objects.value.forEach((obj, index) => {
    if (isRectIntersectObject(rect, obj)) {
      result.push(index)
    }
  })
  return result
}

// 判断点是否在多边形内（使用射线法）
const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean => {
  if (polygon.length < 3) return false
  
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// 判断对象是否与多边形相交或在其内部
const isPolygonIntersectObject = (polygon: { x: number; y: number }[], obj: DrawObject): boolean => {
  const bounds = getObjectBounds(obj)
  if (!bounds) return false
  
  // 检查对象的边界框是否与多边形相交
  // 简化：检查边界框的四个角点是否至少有一个在多边形内或边界上
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, // 中心点
  ]
  
  // 如果至少有一个角点或多边形的至少一个顶点在对象边界内，则认为相交
  for (const corner of corners) {
    if (isPointInPolygon(corner, polygon)) {
      return true
    }
  }
  
  // 检查多边形顶点是否在对象内
  for (const point of polygon) {
    if (isPointInObject(point.x, point.y, obj)) {
      return true
    }
  }
  
  // 对于路径对象，检查路径点是否在多边形内
  if (obj.type === 'path' && obj.points) {
    for (const point of obj.points) {
      if (isPointInPolygon(point, polygon)) {
        return true
      }
    }
  }
  
  return false
}

// 查找与多边形相交的所有对象
const findObjectsInPolygon = (polygon: { x: number; y: number }[]): number[] => {
  const result: number[] = []
  objects.value.forEach((obj, index) => {
    if (isPolygonIntersectObject(polygon, obj)) {
      result.push(index)
    }
  })
  return result
}

// 克隆对象位置（用于拖拽）
const cloneObjectPosition = (obj: DrawObject): DrawObject => {
  return JSON.parse(JSON.stringify(obj))
}

// 移动对象（用于拖拽）
const moveObject = (obj: DrawObject, original: DrawObject, dx: number, dy: number) => {
  if (obj.type === 'path' && original.type === 'path' && obj.points && original.points) {
    obj.points = original.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
  } else if (obj.type === 'rectangle' && original.type === 'rectangle') {
    if (obj.x !== undefined && original.x !== undefined) obj.x = original.x + dx
    if (obj.y !== undefined && original.y !== undefined) obj.y = original.y + dy
  } else if (obj.type === 'circle' && original.type === 'circle') {
    if (obj.x !== undefined && original.x !== undefined) obj.x = original.x + dx
    if (obj.y !== undefined && original.y !== undefined) obj.y = original.y + dy
  } else if (obj.type === 'line' && original.type === 'line') {
    if (obj.x1 !== undefined && original.x1 !== undefined) obj.x1 = original.x1 + dx
    if (obj.y1 !== undefined && original.y1 !== undefined) obj.y1 = original.y1 + dy
    if (obj.x2 !== undefined && original.x2 !== undefined) obj.x2 = original.x2 + dx
    if (obj.y2 !== undefined && original.y2 !== undefined) obj.y2 = original.y2 + dy
  } else if (obj.type === 'triangle' && original.type === 'triangle') {
    if (obj.x !== undefined && original.x !== undefined) obj.x = original.x + dx
    if (obj.y !== undefined && original.y !== undefined) obj.y = original.y + dy
  } else if (obj.type === 'text' && original.type === 'text') {
    if (obj.x !== undefined && original.x !== undefined) obj.x = original.x + dx
    if (obj.y !== undefined && original.y !== undefined) obj.y = original.y + dy
  }
}

// 橡皮擦处理
const handleEraser = (coords: { x: number; y: number }) => {
  const eraserSize = store.drawingConfig.eraserSize || 15
  const eraserRadius = eraserSize / 2

  // 查找需要删除的对象
  const toDelete: number[] = []

  objects.value.forEach((obj, index) => {
    const bounds = getObjectBounds(obj)
    if (!bounds) return

    // 计算橡皮擦圆心到对象边界框最近点的距离
    const closestX = Math.max(bounds.x, Math.min(coords.x, bounds.x + bounds.width))
    const closestY = Math.max(bounds.y, Math.min(coords.y, bounds.y + bounds.height))

    const distance = Math.sqrt(Math.pow(coords.x - closestX, 2) + Math.pow(coords.y - closestY, 2))

    // 如果距离小于橡皮擦半径，标记删除
    if (distance < eraserRadius) {
      toDelete.push(index)
    }
  })

  // 删除对象
  if (toDelete.length > 0) {
    objects.value = objects.value.filter((_, index) => !toDelete.includes(index))
    // 保存历史记录
    saveState()
    // 保存状态到Store
    saveAnnotations()
    render()
  }
}

// 鼠标事件处理（用于绘制）
const handleDrawingMouseDown = (e: MouseEvent) => {
  if (!drawingCanvas.value) return
  
  const coords = getCanvasCoords(e)
  if (!coords) return
  
  const tool = store.selectedTool
  
  if (tool === 'select') {
    // 选择工具
    isDrawing.value = true
    startPoint.value = coords
    
    // 检查是否点击在已选中的图形上
    let clickedOnSelected = false
    for (const index of selectedObjects.value) {
      if (isPointInObject(coords.x, coords.y, objects.value[index])) {
        clickedOnSelected = true
        break
      }
    }

    if (clickedOnSelected && selectedObjects.value.size > 0) {
      // 点击在已选中的图形上，开始拖拽
      isDraggingObjects.value = true
      dragStartPoint.value = { ...coords }

      // 保存所有选中对象的原始位置
      objectsOriginalPositions.value.clear()
      selectedObjects.value.forEach((index) => {
        const obj = objects.value[index]
        objectsOriginalPositions.value.set(index, cloneObjectPosition(obj))
      })

      if (drawingCanvas.value) {
        drawingCanvas.value.style.cursor = 'grabbing'
      }
    } else {
      // 点击在空白处或未选中的图形上，开始框选
      const clickedIndex = findObjectAtPoint(coords.x, coords.y)
      if (clickedIndex !== null) {
        // 点击在某个对象上，选中该对象
        selectedObjects.value.clear()
        selectedObjects.value.add(clickedIndex)
      } else {
        // 点击在空白处，根据选择模式开始框选
        const selectMode = store.drawingConfig.selectMode || 'rectangle'
        selectedObjects.value.clear()
        
        if (selectMode === 'freeform') {
          // 自由框选：初始化路径
          selectionPath.value = [coords]
          selectionBox.value = null
        } else {
          // 矩形选择：初始化选框
          selectionBox.value = {
            x: coords.x,
            y: coords.y,
            width: 0,
            height: 0,
          }
          selectionPath.value = []
        }
      }
    }
    render()
  } else if (tool === 'pen' || tool === 'highlighter') {
    // 绘制路径
    startPoint.value = coords
    isDrawing.value = true
    currentPath.value = [coords]
  } else if (tool === 'eraser') {
    // 橡皮擦
    handleEraser(coords)
  } else if (tool === 'screenshot') {
    // 截图
    const shapeType = store.drawingConfig.screenshotShape || 'rectangle'
    screenshotState.value.isDrawing = true
    screenshotState.value.startPoint = coords
    
    console.log('[截图工具] 开始截图', {
      shapeType,
      startPoint: coords,
      pageNum: props.layout.pageNum
    })
    
    if (shapeType === 'rectangle') {
      // 矩形截图
      screenshotState.value.currentShape = {
        type: 'rectangle' as const,
        color: store.drawingConfig.screenshotStrokeColor || '#ff0000',
        lineWidth: 2,
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0
      }
      console.log('[截图工具] 初始化矩形选区', {
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0
      })
    } else if (shapeType === 'polygon') {
      // 自由形状截图
      screenshotState.value.polygonPoints = [coords]
      screenshotState.value.currentShape = {
        type: 'path' as const,
        color: store.drawingConfig.screenshotStrokeColor || '#ff0000',
        lineWidth: 2,
        points: [coords]
      }
      console.log('[截图工具] 初始化自由形状选区', {
        pointsCount: 1,
        firstPoint: coords
      })
    }
    render()
  }
}

const handleDrawingMouseMove = (e: MouseEvent) => {
  const coords = getCanvasCoords(e)
  if (!coords) return
  
  const tool = store.selectedTool
  
  if (tool === 'select') {
    if (!isDrawing.value || !startPoint.value) return
    
    if (isDraggingObjects.value && dragStartPoint.value) {
      // 拖拽选中的对象
      const dx = coords.x - dragStartPoint.value.x
      const dy = coords.y - dragStartPoint.value.y

      // 移动所有选中对象
      selectedObjects.value.forEach((index) => {
        const obj = objects.value[index]
        const original = objectsOriginalPositions.value.get(index)
        if (original) {
          moveObject(obj, original, dx, dy)
        }
      })

      render()
    } else if (selectionBox.value && startPoint.value) {
      // 矩形选择：绘制选框
      selectionBox.value = {
        x: Math.min(startPoint.value.x, coords.x),
        y: Math.min(startPoint.value.y, coords.y),
        width: Math.abs(coords.x - startPoint.value.x),
        height: Math.abs(coords.y - startPoint.value.y),
      }
      render()
    } else if (selectionPath.value.length > 0) {
      // 自由框选：添加点到路径
      selectionPath.value.push(coords)
      render()
    }
  } else if (tool === 'pen' || tool === 'highlighter') {
    if (!isDrawing.value || !startPoint.value) return
    currentPath.value.push(coords)
    const config = store.drawingConfig
    
    // 获取画笔样式（仅画笔工具支持，荧光笔使用默认样式）
    // 将旧样式映射到新样式以保持向后兼容
    const mapOldStyleToNew = (style: string): HandwritingStyle => {
      const styleMap: Record<string, HandwritingStyle> = {
        'standard': 'writing',
        'smooth': 'writing',
        'natural': 'crayon',
        'fast': 'pencil',
        'brush': 'brush',
        'writing': 'writing',
        'spray': 'spray',
        'oil-paint': 'oil-paint',
        'crayon': 'crayon',
        'marker': 'marker',
        'pencil': 'pencil',
        'watercolor': 'watercolor'
      }
      return styleMap[style] || 'writing'
    }
    const handwritingStyle: HandwritingStyle = tool === 'pen' 
      ? mapOldStyleToNew(config.penHandwritingStyle || 'writing')
      : 'writing'
    
    tempObject.value = {
      type: 'path',
      color: tool === 'pen' ? config.penColor : config.highlighterColor,
      lineWidth: tool === 'pen' ? config.penWidth : config.highlighterWidth,
      points: [...currentPath.value],
      rawPoints: [...currentPath.value], // 保存原始点
      handwritingStyle: handwritingStyle,
      opacity: tool === 'highlighter' ? config.highlighterOpacity / 100 : undefined
    }
    render()
  } else if (tool === 'eraser') {
    // 橡皮擦拖动擦除
    handleEraser(coords)
  } else if (tool === 'screenshot' && screenshotState.value.isDrawing) {
    const shapeType = store.drawingConfig.screenshotShape || 'rectangle'
    const startPoint = screenshotState.value.startPoint
    
    if (shapeType === 'rectangle' && startPoint && screenshotState.value.currentShape) {
      // 更新矩形尺寸
      const width = coords.x - startPoint.x
      const height = coords.y - startPoint.y
      
      const rectShape: DrawObject = {
        type: 'rectangle' as const,
        color: store.drawingConfig.screenshotStrokeColor || '#ff0000',
        lineWidth: 2,
        x: width > 0 ? startPoint.x : coords.x,
        y: height > 0 ? startPoint.y : coords.y,
        width: Math.abs(width),
        height: Math.abs(height)
      }
      
      screenshotState.value.currentShape = rectShape
      
      console.log('[截图工具] 更新矩形选区', {
        x: rectShape.x,
        y: rectShape.y,
        width: rectShape.width,
        height: rectShape.height,
        currentPoint: coords
      })
      
      render()
    } else if (shapeType === 'polygon' && screenshotState.value.currentShape) {
      // 添加点到自由形状
      screenshotState.value.polygonPoints.push(coords)
      screenshotState.value.currentShape = {
        type: 'path' as const,
        color: store.drawingConfig.screenshotStrokeColor || '#ff0000',
        lineWidth: 2,
        points: [...screenshotState.value.polygonPoints]
      }
      
      console.log('[截图工具] 更新自由形状选区', {
        pointsCount: screenshotState.value.polygonPoints.length,
        currentPoint: coords
      })
      
      render()
    }
  }
}

const handleDrawingMouseUp = () => {
  const tool = store.selectedTool
  
  if (tool === 'select') {
    // 选择工具处理
    if (isDraggingObjects.value) {
      // 拖拽结束，保存状态
      saveAnnotations()
      isDraggingObjects.value = false
      dragStartPoint.value = null
      objectsOriginalPositions.value.clear()
    } else if (
      selectionBox.value &&
      selectionBox.value.width > 10 &&
      selectionBox.value.height > 10
    ) {
      // 矩形框选结束，选中与选框相交的所有对象
      const selectedIndices = findObjectsInRect(selectionBox.value)
      selectedObjects.value = new Set(selectedIndices)
    } else if (selectionPath.value.length > 3) {
      // 自由框选结束，选中与多边形相交的所有对象
      const selectedIndices = findObjectsInPolygon(selectionPath.value)
      selectedObjects.value = new Set(selectedIndices)
    } else if (selectionBox.value && selectionBox.value.width <= 10 && selectionBox.value.height <= 10) {
      // 点击空白处，清空选择（仅在确实没有移动时）
      // 如果移动距离很小，可能是触摸抖动，不执行任何操作
      if (startPoint.value && selectionBox.value) {
        const dx = Math.abs(selectionBox.value.x - (startPoint.value.x || 0))
        const dy = Math.abs(selectionBox.value.y - (startPoint.value.y || 0))
        if (dx < 3 && dy < 3) {
          // 几乎没有移动，清空选择
          selectedObjects.value.clear()
        }
      }
    }

    // 重置选择工具的状态
    selectionBox.value = null
    selectionPath.value = []
    isDrawing.value = false
    startPoint.value = null

    // 恢复光标
    if (drawingCanvas.value) {
      drawingCanvas.value.style.cursor = 'crosshair'
    }
    
    render()
  } else if (tool === 'pen' || tool === 'highlighter') {
    if (!isDrawing.value || !tempObject.value) {
      isDrawing.value = false
      currentPath.value = []
      startPoint.value = null
      tempObject.value = null
      return
    }
    
    // 添加临时对象到列表
    objects.value.push(tempObject.value)
    tempObject.value = null
    
    // 保存历史记录
    saveState()
    
    // 保存状态到Store
    saveAnnotations()
    
    isDrawing.value = false
    currentPath.value = []
    startPoint.value = null
  } else if (tool === 'screenshot' && screenshotState.value.isDrawing && screenshotState.value.currentShape) {
    // 捕获截图
    console.log('[截图工具] 结束截图，开始捕获', {
      shapeType: screenshotState.value.currentShape.type,
      shape: screenshotState.value.currentShape
    })
    captureScreenshot()
  }
}

// 捕获截图
const captureScreenshot = async () => {
  if (!pdfCanvas.value || !drawingCanvas.value || !screenshotState.value.currentShape) {
    console.warn('[截图工具] 捕获失败：缺少必要的canvas或形状', {
      hasPdfCanvas: !!pdfCanvas.value,
      hasDrawingCanvas: !!drawingCanvas.value,
      hasShape: !!screenshotState.value.currentShape
    })
    return
  }
  
  try {
    const shape = screenshotState.value.currentShape
    let bounds = getObjectBounds(shape)
    
    console.log('[截图工具] 计算选区边界', {
      shapeType: shape.type,
      bounds: bounds,
      lineWidth: shape.lineWidth
    })
    
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      console.warn('[截图工具] 捕获失败：选区无效', {
        bounds: bounds
      })
      resetScreenshotState()
      return
    }
    
    // 确保边界不超出 canvas 范围
    const canvasWidth = pdfCanvas.value.width
    const canvasHeight = pdfCanvas.value.height
    
    // 调整边界，确保在 canvas 范围内
    const sourceX = Math.max(0, Math.round(bounds.x))
    const sourceY = Math.max(0, Math.round(bounds.y))
    const sourceWidth = Math.min(bounds.width, canvasWidth - sourceX)
    const sourceHeight = Math.min(bounds.height, canvasHeight - sourceY)
    
    // 如果调整后的尺寸无效，则使用原始边界（drawImage 会自动处理超出部分）
    const finalWidth = sourceWidth > 0 ? sourceWidth : bounds.width
    const finalHeight = sourceHeight > 0 ? sourceHeight : bounds.height
    
    console.log('[截图工具] 边界调整', {
      originalBounds: bounds,
      adjustedBounds: { x: sourceX, y: sourceY, width: finalWidth, height: finalHeight },
      canvasSize: { width: canvasWidth, height: canvasHeight }
    })
    
    // 创建临时canvas合并PDF和绘制内容
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = Math.max(1, Math.round(finalWidth))
    tempCanvas.height = Math.max(1, Math.round(finalHeight))
    const tempCtx = tempCanvas.getContext('2d')
    
    if (!tempCtx) {
      throw new Error('无法获取临时Canvas上下文')
    }
    
    console.log('[截图工具] 创建临时Canvas', {
      width: tempCanvas.width,
      height: tempCanvas.height,
      sourceBounds: { x: sourceX, y: sourceY, width: finalWidth, height: finalHeight }
    })
    
    // 绘制PDF内容（使用调整后的边界）
    tempCtx.drawImage(
      pdfCanvas.value,
      sourceX,
      sourceY,
      finalWidth,
      finalHeight,
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    )
    
    console.log('[截图工具] 已绘制PDF内容到临时Canvas')
    
    // 绘制绘制层内容（临时隐藏截图选区）
    // 使用调整后的边界坐标进行偏移
    const objectsCount = objects.value.length
    objects.value.forEach(obj => {
      drawObjectToContext(tempCtx, obj, {
        x: -sourceX,
        y: -sourceY
      })
    })
    
    console.log('[截图工具] 已绘制绘制层内容到临时Canvas', {
      objectsCount: objectsCount
    })
    
    // 转换为Blob并触发回调
    tempCanvas.toBlob((blob) => {
      if (blob) {
        console.log('[截图工具] 截图捕获成功', {
          blobSize: blob.size,
          blobType: blob.type,
          width: tempCanvas.width,
          height: tempCanvas.height
        })
        emit('screenshot-captured', blob)
      } else {
        console.error('[截图工具] 截图转换为Blob失败')
      }
      resetScreenshotState()
      render()
    }, 'image/jpeg', 0.9)
  } catch (error) {
    console.error('[截图工具] 截图捕获失败:', error)
    resetScreenshotState()
    render()
  }
}

// 绘制对象到指定的上下文（支持偏移）
const drawObjectToContext = (targetCtx: CanvasRenderingContext2D, obj: DrawObject, offset: { x: number; y: number } = { x: 0, y: 0 }) => {
  targetCtx.save()
  targetCtx.strokeStyle = obj.color
  targetCtx.fillStyle = obj.color
  targetCtx.lineWidth = obj.lineWidth
  targetCtx.lineCap = 'round'
  targetCtx.lineJoin = 'round'
  
  if (obj.opacity !== undefined) {
    targetCtx.globalAlpha = obj.opacity
  }
  
  switch (obj.type) {
    case 'path':
      if (obj.points && obj.points.length > 1) {
        targetCtx.beginPath()
        targetCtx.moveTo(obj.points[0].x + offset.x, obj.points[0].y + offset.y)
        for (let i = 1; i < obj.points.length; i++) {
          targetCtx.lineTo(obj.points[i].x + offset.x, obj.points[i].y + offset.y)
        }
        targetCtx.stroke()
      }
      break
    case 'rectangle':
      if (obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
        targetCtx.strokeRect(obj.x + offset.x, obj.y + offset.y, obj.width, obj.height)
      }
      break
    case 'circle':
      if (obj.x !== undefined && obj.y !== undefined && obj.radius !== undefined) {
        targetCtx.beginPath()
        targetCtx.arc(obj.x + offset.x, obj.y + offset.y, obj.radius, 0, Math.PI * 2)
        targetCtx.stroke()
      }
      break
    case 'line':
      if (obj.x1 !== undefined && obj.y1 !== undefined && obj.x2 !== undefined && obj.y2 !== undefined) {
        targetCtx.beginPath()
        targetCtx.moveTo(obj.x1 + offset.x, obj.y1 + offset.y)
        targetCtx.lineTo(obj.x2 + offset.x, obj.y2 + offset.y)
        targetCtx.stroke()
      }
      break
    case 'triangle':
      if (obj.x !== undefined && obj.y !== undefined && obj.width !== undefined && obj.height !== undefined) {
        targetCtx.beginPath()
        targetCtx.moveTo(obj.x + obj.width / 2 + offset.x, obj.y + offset.y)
        targetCtx.lineTo(obj.x + offset.x, obj.y + obj.height + offset.y)
        targetCtx.lineTo(obj.x + obj.width + offset.x, obj.y + obj.height + offset.y)
        targetCtx.closePath()
        targetCtx.stroke()
      }
      break
    case 'text':
      if (obj.text && obj.x !== undefined && obj.y !== undefined) {
        targetCtx.font = `${obj.fontSize || 16}px Arial`
        targetCtx.fillText(obj.text, obj.x + offset.x, obj.y + offset.y)
      }
      break
  }
  
  targetCtx.restore()
}

// 重置截图状态
const resetScreenshotState = () => {
  console.log('[截图工具] 重置截图状态')
  screenshotState.value = {
    isDrawing: false,
    startPoint: null,
    currentShape: null,
    polygonPoints: []
  }
}

// 保存状态到历史记录


// 保存注释到Store
const saveAnnotations = () => {
  // 将坐标标准化为scale=1后再保存
  const normalizedObjects = objects.value.map(obj => normalizeCoordinates(obj, store.scale))
  const serializedObjects = IndexedDBService.deepSerialize(normalizedObjects) as object[]
  store.updateAnnotations(props.layout.pageNum, serializedObjects)
  
  // 更新最近修改的页面
  store.setLastModifiedPage(props.layout.pageNum)
}

// 重试加载
const retryLoad = async () => {
  await initPdfPage()
  if (!error.value) {
    await initDrawingCanvas()
  }
}

// 计算双指中心点的Y坐标
const getTwoFingerCenterY = (touches: TouchList): number => {
  if (touches.length !== 2) return 0
  const touch1 = touches[0]
  const touch2 = touches[1]
  return (touch1.clientY + touch2.clientY) / 2
}

// 计算两点之间的距离
const getDistance = (touch1: Touch, touch2: Touch): number => {
  const dx = touch2.clientX - touch1.clientX
  const dy = touch2.clientY - touch1.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

// 获取滚动容器
const getScrollContainer = (): HTMLElement | null => {
  let parent = pdfCanvas.value?.parentElement
  
  while (parent) {
    if (parent.classList.contains('q-virtual-scroll')) {
      const scrollContent = parent.querySelector('.q-virtual-scroll__content')
      if (scrollContent?.parentElement) {
        return scrollContent.parentElement as HTMLElement
      }
      return parent
    }
    
    const overflowY = window.getComputedStyle(parent).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    
    parent = parent.parentElement
  }
  
  return document.documentElement
}

// 以指定点为原点进行缩放
// point: { x: number, y: number } - 鼠标/触摸点在屏幕上的坐标（clientX, clientY）
// oldScale: 缩放前的scale值
// newScale: 缩放后的scale值
const zoomAtPoint = async (point: { x: number, y: number }, oldScale: number, newScale: number) => {
  const scrollContainer = getScrollContainer()
  if (!scrollContainer) {
    // 如果找不到滚动容器，直接设置scale
    store.setScale(newScale)
    return
  }

  // 1. 计算缩放点在文档中的绝对位置（相对于文档顶部）
  const containerRect = scrollContainer.getBoundingClientRect()
  // 缩放点相对于滚动容器的位置
  const pointRelativeToContainer = {
    x: point.x - containerRect.left,
    y: point.y - containerRect.top
  }
  // 缩放点在文档中的绝对位置（考虑滚动位置）
  const pointInDocument = {
    y: scrollContainer.scrollTop + pointRelativeToContainer.y
  }

  // 2. 计算缩放点在当前页面布局中的位置
  // 找到包含该点的页面
  let targetPageIndex = -1
  let pointInPageY = 0
  let oldLayoutHeight = 0
  
  for (let i = 0; i < store.pageLayouts.length; i++) {
    const layout = store.pageLayouts[i]
    if (pointInDocument.y >= layout.top && pointInDocument.y < layout.top + layout.height) {
      targetPageIndex = i
      pointInPageY = pointInDocument.y - layout.top
      oldLayoutHeight = layout.height
      break
    }
  }

  // 如果找不到页面，使用当前页面
  if (targetPageIndex === -1) {
    targetPageIndex = store.currentPage - 1
    if (targetPageIndex >= 0 && targetPageIndex < store.pageLayouts.length) {
      const layout = store.pageLayouts[targetPageIndex]
      pointInPageY = pointInDocument.y - layout.top
      oldLayoutHeight = layout.height
    }
  }

  // 3. 执行缩放（这会触发布局重新计算）
  store.setScale(newScale)

  // 4. 等待布局重新计算完成
  // 布局更新是异步的（在PdfViewerView中通过watch触发），需要等待
  await nextTick()
  
  // 等待布局更新完成（轮询检查布局是否已更新）
  const maxWaitTime = 300
  const startTime = Date.now()
  const scaleRatio = newScale / oldScale
  const expectedNewHeight = oldLayoutHeight * scaleRatio
  
  while (Date.now() - startTime < maxWaitTime) {
    // 检查目标页面的布局是否已更新（通过检查高度是否按比例变化）
    if (targetPageIndex >= 0 && targetPageIndex < store.pageLayouts.length) {
      const newLayout = store.pageLayouts[targetPageIndex]
      // 如果页面高度已按比例更新，说明布局已更新
      if (Math.abs(newLayout.height - expectedNewHeight) < 1) {
        // 再等待一次nextTick和requestAnimationFrame确保DOM已更新
        await nextTick()
        await new Promise(resolve => requestAnimationFrame(resolve))
        break
      }
    }
    await new Promise(resolve => setTimeout(resolve, 16)) // 约60fps的检查频率
  }

  // 5. 计算缩放点在文档中的新位置
  // 缩放点在新布局中的位置 = pointInPageY * scaleRatio（已在上面定义）
  const newPointInPageY = pointInPageY * scaleRatio

  // 找到新布局中对应的页面
  if (targetPageIndex >= 0 && targetPageIndex < store.pageLayouts.length) {
    const newLayout = store.pageLayouts[targetPageIndex]
    const newPointInDocument = newLayout.top + newPointInPageY

    // 6. 调整滚动位置，使缩放点保持在视口中的相同位置
    const newScrollTop = newPointInDocument - pointRelativeToContainer.y
    scrollContainer.scrollTop = Math.max(0, newScrollTop)
  }
}

// 触摸开始事件处理
const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length === 2) {
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    const distance = getDistance(touch1, touch2)
    const centerY = getTwoFingerCenterY(event.touches)
    
    // 记录初始状态
    touchState.value.initialDistance = distance
    touchState.value.initialScale = store.scale
    touchState.value.startTouches = [touch1, touch2]
    touchState.value.startY = centerY
    touchState.value.lastY = centerY
    
    // 初始状态不确定是缩放还是滑动，需要在move中判断
    touchState.value.isTwoFinger = true
    touchState.value.isZooming = false
    
    // 停止绘制
    isDrawing.value = false
    currentPath.value = []
    startPoint.value = null
    tempObject.value = null
  } else {
    touchState.value.isTwoFinger = false
    touchState.value.isZooming = false
    touchState.value.initialDistance = 0
    
    // 单指触摸，开始操作（绘制、橡皮擦或截图）
    if (event.touches.length === 1) {
      const touch = event.touches[0]
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true
      })
      handleDrawingMouseDown(mouseEvent)
    }
  }
}

// 触摸移动事件处理
const handleTouchMove = (event: TouchEvent) => {
  if (event.touches.length === 2 && touchState.value.isTwoFinger) {
    // 双指手势：缩放或滑动
  event.preventDefault()
  
  const touch1 = event.touches[0]
  const touch2 = event.touches[1]
  const currentDistance = getDistance(touch1, touch2)
  const initialDistance = touchState.value.initialDistance
  const currentY = getTwoFingerCenterY(event.touches)
  const deltaY = Math.abs(currentY - touchState.value.startY)
  const distanceChange = Math.abs(currentDistance - initialDistance)
  
  // 判断是缩放还是滑动：如果距离变化比垂直移动大，则认为是缩放
  const isDistanceChange = distanceChange > 15 // 距离变化阈值
  
  if (!touchState.value.isZooming && isDistanceChange && distanceChange > deltaY * 0.5) {
    // 确定为缩放手势
    touchState.value.isZooming = true
  }
  
  if (touchState.value.isZooming) {
    // 执行缩放
    if (initialDistance > 0) {
      // 计算缩放比例
      const scaleRatio = currentDistance / initialDistance
      const oldScale = touchState.value.initialScale
      const newScale = oldScale * scaleRatio
      
      // 限制缩放范围
      const clampedScale = Math.max(0.5, Math.min(3.0, newScale))
      
      // 计算双指中心点
      const centerX = (touch1.clientX + touch2.clientX) / 2
      const centerY = (touch1.clientY + touch2.clientY) / 2
      
      // 以双指中心为原点进行缩放
      zoomAtPoint({ x: centerX, y: centerY }, oldScale, clampedScale)
    }
  } else if (!isDistanceChange || deltaY > distanceChange) {
    // 执行滑动
    const scrollContainer = getScrollContainer()
    if (scrollContainer) {
      scrollContainer.scrollTop -= (currentY - touchState.value.lastY)
    }
    touchState.value.lastY = currentY
    }
  } else if (event.touches.length === 1 && !touchState.value.isTwoFinger) {
    // 单指操作：绘制、选择、橡皮擦或截图
    const tool = store.selectedTool
    
    if (tool === 'select') {
      // 选择工具：拖拽或框选
      if (isDrawing.value || isDraggingObjects.value || selectionBox.value) {
        event.preventDefault() // 防止页面滚动
        const touch = event.touches[0]
        const mouseEvent = new MouseEvent('mousemove', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true,
          cancelable: true
        })
        handleDrawingMouseMove(mouseEvent)
      }
    } else if (tool === 'pen' || tool === 'highlighter') {
      if (isDrawing.value) {
        event.preventDefault() // 防止页面滚动
        const touch = event.touches[0]
        const mouseEvent = new MouseEvent('mousemove', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true,
          cancelable: true
        })
        handleDrawingMouseMove(mouseEvent)
      }
    } else if (tool === 'eraser') {
      event.preventDefault() // 防止页面滚动
      const touch = event.touches[0]
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true
      })
      handleDrawingMouseMove(mouseEvent)
    } else if (tool === 'screenshot' && screenshotState.value.isDrawing) {
      event.preventDefault() // 防止页面滚动
      const touch = event.touches[0]
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true
      })
      handleDrawingMouseMove(mouseEvent)
    }
  }
}

// 触摸结束事件处理
const handleTouchEnd = (event: TouchEvent) => {
  if (event.touches.length < 2) {
    // 重置缩放状态
    if (touchState.value.isZooming) {
      touchState.value.isZooming = false
      touchState.value.initialDistance = 0
      touchState.value.initialScale = 1.0
      touchState.value.startTouches = []
    }
    
    // 重置滑动状态
    if (touchState.value.isTwoFinger) {
      touchState.value.isTwoFinger = false
    }
    
    // 结束操作（选择、绘制或截图）
    const tool = store.selectedTool
    if (tool === 'select') {
      // 选择工具结束：完成拖拽或框选
      if (isDrawing.value || isDraggingObjects.value || selectionBox.value) {
        handleDrawingMouseUp()
      }
    } else if (tool === 'pen' || tool === 'highlighter') {
      if (isDrawing.value) {
        handleDrawingMouseUp()
      }
    } else if (tool === 'screenshot') {
      if (screenshotState.value.isDrawing) {
        handleDrawingMouseUp()
      }
    }
  }
}

// 鼠标滚轮事件处理
const handleWheel = (event: WheelEvent) => {
  // 如果按住Ctrl键，则进行缩放
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    
    // 计算缩放增量（向上滚动放大，向下滚动缩小）
    const zoomStep = 0.03
    const delta = event.deltaY > 0 ? -zoomStep : zoomStep
    const oldScale = store.scale
    const newScale = oldScale + delta
    
    // 限制缩放范围
    const clampedScale = Math.max(0.5, Math.min(3.0, newScale))
    
    // 以鼠标位置为原点进行缩放
    zoomAtPoint({ x: event.clientX, y: event.clientY }, oldScale, clampedScale)
  } else {
    // 否则正常滚动
    const scrollContainer = getScrollContainer()
    if (!scrollContainer) return
    
    scrollContainer.scrollTop += event.deltaY
  }
}


// 窗口大小变化处理
const handleResize = () => {
  windowWidth.value = window.innerWidth
}

// 添加/移除事件监听器的辅助函数
const setupCanvasEventListeners = () => {
  if (drawingCanvas.value) {
    drawingCanvas.value.addEventListener('mousedown', handleDrawingMouseDown)
    drawingCanvas.value.addEventListener('mousemove', handleDrawingMouseMove)
    drawingCanvas.value.addEventListener('mouseup', handleDrawingMouseUp)
    drawingCanvas.value.addEventListener('mouseleave', handleDrawingMouseUp)
  }
}

const removeCanvasEventListeners = () => {
  if (drawingCanvas.value) {
    drawingCanvas.value.removeEventListener('mousedown', handleDrawingMouseDown)
    drawingCanvas.value.removeEventListener('mousemove', handleDrawingMouseMove)
    drawingCanvas.value.removeEventListener('mouseup', handleDrawingMouseUp)
    drawingCanvas.value.removeEventListener('mouseleave', handleDrawingMouseUp)
  }
}

// 监听 hideNotes 状态变化，当显示笔记时重新初始化 canvas
watch(
  () => store.hideNotes,
  async (isHidden, wasHidden) => {
    // 当从隐藏变为显示时（hideNotes: true -> false）
    if (wasHidden && !isHidden) {
      // 等待 DOM 更新（可能需要多次 nextTick 确保 ref 已更新）
      await nextTick()
      await nextTick()
      // 重新初始化 canvas 并加载笔记
      if (drawingCanvas.value && !error.value && store.pdfDoc) {
        await initDrawingCanvas()
        // 重新绑定事件监听器
        setupCanvasEventListeners()
      }
    }
    // 当从显示变为隐藏时（hideNotes: false -> true），移除事件监听器
    // 注意：DOM 会被 v-if 移除，但为了安全起见我们也要清理事件监听器
    if (!wasHidden && isHidden) {
      removeCanvasEventListeners()
    }
  }
)

// 生命周期
onMounted(async () => {
  await nextTick()
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
  windowWidth.value = window.innerWidth
  
  // 初始化 PDF 页面
  await initPdfPage()
  
  // 初始化 DrawingBoard Canvas
  if (!error.value && !store.hideNotes) {
    await initDrawingCanvas()
    
    // 添加鼠标事件监听
    setupCanvasEventListeners()
  }
  
  // 注册到父组件（用于撤销/重做）
  if (registerPageComponent) {
    registerPageComponent(props.layout.pageNum, {
      undo,
      redo,
      canUndo: () => canUndo.value,
      canRedo: () => canRedo.value,
    })
  }
})

onUnmounted(async () => {
  // 注销组件
  if (unregisterPageComponent) {
    unregisterPageComponent(props.layout.pageNum)
  }
  
  // 移除窗口大小监听
  window.removeEventListener('resize', handleResize)
  
  // 移除鼠标事件监听
  removeCanvasEventListeners()
  
  // 清除防抖定时器
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
    renderDebounceTimer = null
  }
  
  // 取消正在进行的渲染任务
  if (currentRenderTask.value) {
    try {
      currentRenderTask.value.cancel()
    } catch {
      // 忽略取消错误
    }
    currentRenderTask.value = null
  }
  
  // 保存最终状态到内存
  saveAnnotations()
  
  // 立即保存到 IndexedDB（不使用防抖）
  await store.flushSave()
})

// 监听笔记数据变化
watch(
  () => store.allAnnotations[props.layout.pageNum],
  (newAnnotations, oldAnnotations) => {
    // 只有当笔记确实发生变化时才重新加载
    if (newAnnotations !== oldAnnotations) {
      nextTick(() => {
        loadAnnotations().then(() => {
          render()
        })
      })
    }
  },
  { deep: true }
)

// 防抖渲染函数
const debouncedRender = () => {
  // 清除之前的定时器
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }
  
  // 设置新的定时器
  renderDebounceTimer = setTimeout(async () => {
    // 重新渲染 PDF
    await initPdfPage()
    
    // 重新初始化 DrawingBoard Canvas
    await initDrawingCanvas()
    
    renderDebounceTimer = null
  }, 150) // 150ms防抖延迟
}

// 监听缩放变化
watch(() => store.scale, () => {
  debouncedRender()
})

// 监听工具切换，更新光标样式
watch(() => store.selectedTool, (newTool) => {
  if (drawingCanvas.value) {
    if (newTool === 'select') {
      drawingCanvas.value.style.cursor = 'crosshair'
    } else {
      drawingCanvas.value.style.cursor = 'default'
    }
  }
})

// 暴露方法给父组件
defineExpose({
  pageNum: () => props.layout.pageNum,
  undo,
  redo,
  canUndo,
  canRedo,
})
</script>

<style scoped>
.pdf-page {
  position: relative;
}

.pdf-layer {
  z-index: 1;
}

.drawing-board-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
}

.drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}

.page-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
}

.page-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  padding: 16px;
  border-radius: 8px;
  z-index: 10;
}

.error-icon {
  font-size: 24px;
}

.error-text {
  font-size: 14px;
  color: #d32f2f;
  text-align: center;
}
</style>
