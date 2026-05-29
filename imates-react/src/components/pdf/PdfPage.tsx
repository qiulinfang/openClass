import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react'
import * as mupdf from 'mupdf'
import { IndexedDBService } from '@/services/storage/indexeddb-service'
import { resourceManager } from '@/services/storage/resource-storage'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import Loading from '@/components/base/Loading'
import '@/components/pdf/PdfPage.css'

// === 类型定义 ===
export type ToolMode = 'pan' | 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'screenshot' | 'select'

export interface Point {
  x: number
  y: number
}

export interface Stroke {
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

export interface HistoryAction {
  type: 'add' | 'remove' | 'update'
  strokes: Stroke[]
  before?: Stroke[]
  after?: Stroke[]
}

export interface SavedData {
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

export interface PdfPageProps {
  file: File | null
  layoutSuspended?: boolean
  onScreenshotCaptured?: (blob: Blob) => void
}

export interface PdfPageRef {
  toggleGestureMode: () => void
  toggleHighlightMode: () => void
  togglePenMode: () => void
  toggleEraserMode: () => void
  toggleScreenshotMode: () => void
  toggleNoteMode: () => void
  toggleSelectMode: () => void
  toggleReadingDirection: () => void
  goPrevPage: () => void
  goNextPage: () => void
  setSelectionMode: (mode: 'rectangle' | 'freeform') => void
  undoLastStroke: () => void
  redoLastStroke: () => void
  refreshLayout: () => void
}

const PAGE_GAP = 20
const GRID_SIZE = 100

const PdfPageRender: React.ForwardRefRenderFunction<PdfPageRef, PdfPageProps> = ({ file, layoutSuspended, onScreenshotCaptured }, ref) => {
  // === 状态管理 ===
  const pdfViewerStore = usePdfViewerStore()
  const [pdfDoc, setPdfDoc] = useState<mupdf.Document | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageList, setPageList] = useState<Array<{ pageIndex: number; viewWidth: number; viewHeight: number; x: number; y: number }>>([])
  const [scale, setScale] = useState(1.0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 })
  const [readingDirection, setReadingDirection] = useState<'vertical' | 'horizontal'>('vertical')
  const [isDirectionChanging, setIsDirectionChanging] = useState(false)
  const [horizontalPageIndex, setHorizontalPageIndex] = useState(0)
  const [isHorizontalScrolling, setIsHorizontalScrolling] = useState(false)
  
  // 工具状态
  const currentMode = (pdfViewerStore.selectedTool as ToolMode) || 'pan'

  // 数据存储
  const [allStrokes, setAllStrokes] = useState<Stroke[]>([])
  const undoStack = useRef<HistoryAction[]>([])
  const redoStack = useRef<HistoryAction[]>([])
  
  // 交互临时状态
  const dragStartPage = useRef<number>(-1)
  const currentDragPath = useRef<Point[]>([])
  const currentDragRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const screenshotDragRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const screenshotStartPoint = useRef<Point | null>(null)
  const isDrawingStarted = useRef(false)
  const selectionMode = useRef<'rectangle' | 'freeform'>('rectangle')
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set())
  const selectDragRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const selectFreeformPath = useRef<Point[] | null>(null)
  const selectAction = useRef<SelectActionData | null>(null)

  // 写字模式下在非 PDF 区域拖动时，降级为平移
  const isPanningInDrawMode = useRef(false)

  // ResizeObserver 相关
  const resizeObserver = useRef<ResizeObserver | null>(null)
  const lastObservedViewportWidth = useRef(0)
  const lastObservedViewportHeight = useRef(0)
  const pendingViewportResizeWhileSuspended = useRef(false)

  // RAF 预览优化状态
  const highlighterRafId = useRef<number | null>(null)
  const highlighterPending = useRef<{ pageIndex: number; points: Point[] } | null>(null)
  const penRafId = useRef<number | null>(null)
  const penPending = useRef<{ pageIndex: number; points: Point[] } | null>(null)
  const eraserRafId = useRef<number | null>(null)
  const eraserPending = useRef<{ pageIndex: number; x: number; y: number } | null>(null)

  // 画布备份逻辑
  const inkBackupCanvases = useRef<Map<number, HTMLCanvasElement>>(new Map())

  const eraserCursor = useRef<{ visible: boolean; x: number; y: number; size: number }>({
    visible: false,
    x: 0,
    y: 0,
    size: pdfViewerStore.drawingConfig.eraserSize,
  })

  // === Refs ===
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pdfRefs = useRef<HTMLCanvasElement[]>([])
  const inkRefs = useRef<HTMLCanvasElement[]>([])
  const renderDprRef = useRef(1)
  const spatialGrid = useRef(new Map<string, Set<Stroke>>())
  const renderGeneration = useRef(0)
  
  // 指针手势相关
  const activePointers = useRef(new Map<number, Point>())
  const lastPointerPos = useRef({ x: 0, y: 0 })
  const velocity = useRef({ x: 0, y: 0 })
  const lastPinchDist = useRef(0)
  const lastPinchCenter = useRef({ x: 0, y: 0 })
  const rafId = useRef<number | null>(null)
  
  // 定时器相关
  const horizontalScrollTimer = useRef<any>(null)
  const horizontalScrollEndTimer = useRef<any>(null)
  const horizontalScaleResetRaf = useRef<number | null>(null)
  const horizontalScaleResetStartAt = useRef(0)
  const horizontalScaleResetFrom = useRef(1)
  const lastViewportScrollLeft = useRef(0)
  const lastViewportScrollTop = useRef(0)
  const dbSaveTimer = useRef<any>(null)
  const saveTimer = useRef<any>(null)

  // === 核心逻辑 ===
  const dbService = useMemo(() => IndexedDBService.getInstance({
    dbName: 'pdf-ink-db',
    version: 1,
    stores: [{ name: 'annotations', keyPath: 'docKey' }],
  }), [])

  // === 工具函数 ===
  const getEraserCursorSize = useCallback(() => pdfViewerStore.drawingConfig.eraserSize * scale * 2, [pdfViewerStore.drawingConfig.eraserSize, scale])

  // 生成文档唯一标识键
  const getDocKey = useCallback((file: File) => `${file.name}|${file.size}`, [])

  // 计算点到线段的距离
  const distancePointToSegment = useCallback((px: number, py: number, ax: Point, bx: Point) => {
    const dx = bx.x - ax.x
    const dy = bx.y - ax.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(px - ax.x, py - ax.y)
    let t = ((px - ax.x) * dx + (py - ax.y) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    const projX = ax.x + t * dx
    const projY = ax.y + t * dy
    return Math.hypot(px - projX, py - projY)
  }, [])

  // 判断点是否在多边形内
  const isPointInPolygon = useCallback((x: number, y: number, polygon: Point[]) => {
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
  }, [])

  // 计算笔迹边界框
  const calculateBBox = useCallback((points: Point[], width: number) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const padding = width / 2 + 2
    for (const p of points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding }
  }, [])

  // === 空间索引辅助函数 ===
  const addToSpatialIndex = useCallback((stroke: Stroke) => {
    if (stroke.minX == null || stroke.maxX == null || stroke.minY == null || stroke.maxY == null) return
    const startX = Math.floor(stroke.minX / GRID_SIZE)
    const endX = Math.floor(stroke.maxX / GRID_SIZE)
    const startY = Math.floor(stroke.minY / GRID_SIZE)
    const endY = Math.floor(stroke.maxY / GRID_SIZE)
    for (let gx = startX; gx <= endX; gx++) {
      for (let gy = startY; gy <= endY; gy++) {
        const key = `${stroke.pageIndex}|${gx}|${gy}`
        let cell = spatialGrid.current.get(key)
        if (!cell) {
          cell = new Set<Stroke>()
          spatialGrid.current.set(key, cell)
        }
        cell.add(stroke)
      }
    }
  }, [])

  const removeFromSpatialIndex = useCallback((stroke: Stroke) => {
    if (stroke.minX == null || stroke.maxX == null || stroke.minY == null || stroke.maxY == null) return
    const startX = Math.floor(stroke.minX / GRID_SIZE)
    const endX = Math.floor(stroke.maxX / GRID_SIZE)
    const startY = Math.floor(stroke.minY / GRID_SIZE)
    const endY = Math.floor(stroke.maxY / GRID_SIZE)
    for (let gx = startX; gx <= endX; gx++) {
      for (let gy = startY; gy <= endY; gy++) {
        const key = `${stroke.pageIndex}|${gx}|${gy}`
        const cell = spatialGrid.current.get(key)
        if (cell) {
          cell.delete(stroke)
          if (cell.size === 0) spatialGrid.current.delete(key)
        }
      }
    }
  }, [])

  const rebuildSpatialIndex = useCallback((strokes: Stroke[]) => {
    spatialGrid.current.clear()
    strokes.forEach((s) => {
      if (s.minX == null) {
        Object.assign(s, calculateBBox(s.points, s.width))
      }
      addToSpatialIndex(s)
    })
  }, [addToSpatialIndex, calculateBBox])

  const loadDataFromDb = useCallback(async (file: File) => {
    try {
      const key = getDocKey(file)
      const data = await dbService.get<SavedData>('annotations', key)
      if (data && data.strokes) {
        data.strokes.forEach((s) => {
          if (s.minX == null) {
            Object.assign(s, calculateBBox(s.points, s.width))
          }
        })
        setAllStrokes(data.strokes)
        rebuildSpatialIndex(data.strokes)
      } else {
        setAllStrokes([])
        spatialGrid.current.clear()
      }
    } catch (e) {
      console.warn('加载标注失败', e)
    }
  }, [dbService, getDocKey, calculateBBox, rebuildSpatialIndex])

  // 清理并刻蚀MuPDF内置注释
  const clearAndBurnMupdfInkAnnotations = useCallback(async (doc: mupdf.Document) => {
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
  }, [pdfViewerStore])

  const loadFile = useCallback(async (file: File) => {
    console.log('[PdfPage] loadFile start:', file.name)
    setLoading(true)
    // resetState logic
    setPdfDoc(prevDoc => {
      if (prevDoc) {
        try {
          prevDoc.destroy()
        } catch {}
      }
      return null
    })
    setPageList([])
    setAllStrokes([])
    spatialGrid.current.clear()
    undoStack.current = []
    redoStack.current = []
    setOffset({ x: 0, y: 0 })
    setScale(1.0)
    setContentSize({ width: 0, height: 0 })
    setHasRendered(false)

    try {
      await loadDataFromDb(file)
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const doc = mupdf.Document.openDocument(uint8Array, 'application/pdf')
      setPdfDoc(doc)
      setPageCount(doc.countPages())

      await clearAndBurnMupdfInkAnnotations(doc)
      await prefetchDimensionsAndLayout(doc, readingDirection, horizontalPageIndex)
      
      // 简单居中逻辑，后续由 useEffect 处理渲染后的位置
      setHasRendered(false)
    } catch (err) {
      console.error('[PdfPage] PDF Load Error:', err)
    } finally {
      setLoading(false)
    }
  }, [loadDataFromDb, readingDirection, horizontalPageIndex, clearAndBurnMupdfInkAnnotations])

  // 获取指定页面选中的笔迹
  const getSelectedStrokesOnPage = useCallback((pageIndex: number) => {
    return allStrokes.filter((s) => s.pageIndex === pageIndex && selectedStrokeIds.has(s.id))
  }, [allStrokes, selectedStrokeIds])

  // 获取笔迹组的边界框
  const getGroupBBox = useCallback((strokes: Stroke[]) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    strokes.forEach((s) => {
      if (s.minX == null || s.maxX == null || s.minY == null || s.maxY == null) return
      minX = Math.min(minX, s.minX)
      minY = Math.min(minY, s.minY)
      maxX = Math.max(maxX, s.maxX)
      maxY = Math.max(maxY, s.maxY)
    })
    if (minX === Infinity) return null
    return { minX, minY, maxX, maxY }
  }, [])

  const getToolConfigForMode = useCallback((mode: ToolMode) => {
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
  }, [pdfViewerStore.drawingConfig])

  // 将客户端坐标转换为内容坐标
  const getContentPoint = useCallback((clientX: number, clientY: number): Point | null => {
    if (!viewportRef.current) return null
    const rect = viewportRef.current.getBoundingClientRect()
    const mx = clientX - rect.left
    const my = clientY - rect.top
    return {
      x: (mx - offset.x) / scale,
      y: (my - offset.y) / scale,
    }
  }, [offset, scale])

  // 获取画布绘制上下文
  const getInkContext = useCallback((pageIndex: number) => {
    const canvas = inkRefs.current[pageIndex]
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  // 将客户端坐标转换为PDF页面坐标
  const getPdfPoint = useCallback((clientX: number, clientY: number): { pageIndex: number; x: number; y: number } | null => {
    if (!viewportRef.current || pageList.length === 0) return null
    const rect = viewportRef.current.getBoundingClientRect()
    const mx = clientX - rect.left
    const my = clientY - rect.top

    const localX = (mx - offset.x) / scale
    const localY = (my - offset.y) / scale

    for (let i = 0; i < pageList.length; i++) {
      const p = pageList[i]
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
  }, [pageList, offset, scale])

  // 获取当前纵向页面索引
  const getCurrentVerticalPageIndex = useCallback((): number => {
    if (!viewportRef.current || pageList.length === 0) return 0
    const rect = viewportRef.current.getBoundingClientRect()
    const centerY = rect.height / 2
    const contentCenterY = (centerY - offset.y) / (scale || 1)
    for (const p of pageList) {
      if (contentCenterY >= p.y && contentCenterY < p.y + p.viewHeight) return p.pageIndex
    }
    return pageList[pageList.length - 1].pageIndex
  }, [pageList, offset, scale])

  // 判断类工具函数
  const isPointInSelectionBounds = useCallback((pageIndex: number, x: number, y: number) => {
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
  }, [getSelectedStrokesOnPage, getGroupBBox])

  const isPointInExistingSelection = useCallback((pageIndex: number, pos: Point): boolean => {
    return selectedStrokeIds.size > 0 && isPointInSelectionBounds(pageIndex, pos.x, pos.y)
  }, [selectedStrokeIds.size, isPointInSelectionBounds])

  const createSelectMoveAction = useCallback((pageIndex: number, pos: Point, strokes?: Stroke[]): SelectActionData => {
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
  }, [getSelectedStrokesOnPage])

  const createBoxSelectAction = useCallback((pageIndex: number, pos: Point): SelectActionData => ({
    type: 'box_select',
    pageIndex,
    lastPos: { x: pos.x, y: pos.y },
    startPos: { x: pos.x, y: pos.y },
    moved: false,
    beforeStrokes: [],
  }), [])

  const createFreeformSelectAction = useCallback((pageIndex: number, pos: Point): SelectActionData => ({
    type: 'freeform_select',
    pageIndex,
    lastPos: { x: pos.x, y: pos.y },
    startPos: { x: pos.x, y: pos.y },
    moved: false,
    beforeStrokes: [],
  }), [])


  // === 命中测试与选区辅助函数 ===
  const strokeHitTest = useCallback((pageIndex: number, x: number, y: number) => {
    const searchRadius = 40
    const minGridX = Math.floor((x - searchRadius) / GRID_SIZE)
    const maxGridX = Math.floor((x + searchRadius) / GRID_SIZE)
    const minGridY = Math.floor((y - searchRadius) / GRID_SIZE)
    const maxGridY = Math.floor((y + searchRadius) / GRID_SIZE)

    const candidates = new Set<Stroke>()
    for (let gx = minGridX; gx <= maxGridX; gx++) {
      for (let gy = minGridY; gy <= maxGridY; gy++) {
        const key = `${pageIndex}|${gx}|${gy}`
        const cell = spatialGrid.current.get(key)
        if (cell) cell.forEach((s) => candidates.add(s))
      }
    }

    let best: Stroke | null = null
    let bestDist = Infinity

    candidates.forEach((stroke) => {
      if (stroke.pageIndex !== pageIndex) return
      if (stroke.minX == null || stroke.maxX == null || stroke.minY == null || stroke.maxY == null) return

      const padding = Math.max(10, (stroke.width ?? 2) / 2 + 8)
      if (x < stroke.minX - padding || x > stroke.maxX + padding || y < stroke.minY - padding || y > stroke.maxY + padding) return

      if (stroke.type === 'rectangle') {
        const a = stroke.points[0], b = stroke.points[1]
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x)
        const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y)
        const dx = Math.min(Math.abs(x - minX), Math.abs(x - maxX))
        const dy = Math.min(Math.abs(y - minY), Math.abs(y - maxY))
        const inside = x >= minX - padding && x <= maxX + padding && y >= minY - padding && y <= maxY + padding
        const dist = inside ? Math.min(dx, dy) : Infinity
        if (dist < bestDist) { bestDist = dist; best = stroke; }
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
  }, [distancePointToSegment])

  const handleSelectHitTest = useCallback((pageIndex: number, pos: Point): SelectActionData | null => {
    const hit = strokeHitTest(pageIndex, pos.x, pos.y)
    if (hit) {
      if (!selectedStrokeIds.has(hit.id)) {
        setSelectedStrokeIds(new Set([hit.id]))
      }
      return createSelectMoveAction(pageIndex, pos)
    }
    return null
  }, [strokeHitTest, selectedStrokeIds, createSelectMoveAction])

  const hitTestFreeform = useCallback((pageIndex: number, path: Point[], strokes: Stroke[]) => {
    if (!path || path.length < 3) return new Set<string>()
    const next = new Set<string>()
    strokes.forEach((s) => {
      if (s.pageIndex !== pageIndex) return
      if (s.minX == null || s.maxX == null || s.minY == null || s.maxY == null) return
      const corners = [{ x: s.minX, y: s.minY }, { x: s.maxX, y: s.minY }, { x: s.maxX, y: s.maxY }, { x: s.minX, y: s.maxY }]
      if (corners.some((c) => isPointInPolygon(c.x, c.y, path))) next.add(s.id)
    })
    return next
  }, [isPointInPolygon])

  const performEraserCheck = useCallback((pageIndex: number, x: number, y: number, currentStrokes: Stroke[]) => {
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
        const cell = spatialGrid.current.get(key)
        if (cell) cell.forEach((s) => candidates.add(s))
      }
    }

    if (candidates.size === 0) return null

    const removedStrokes: Stroke[] = []
    const idsToRemove = new Set<string>()
    const threshold = eraserSize

    candidates.forEach((stroke) => {
      if (stroke.pageIndex !== pageIndex) return
      if (stroke.type === 'rectangle') return
      if (x + threshold < (stroke.minX ?? 0) || x - threshold > (stroke.maxX ?? 0) || y + threshold < (stroke.minY ?? 0) || y - threshold > (stroke.maxY ?? 0)) return

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
        removedStrokes.push(stroke)
      }
    })

    if (removedStrokes.length > 0) {
      removedStrokes.forEach((s) => removeFromSpatialIndex(s))
      const nextStrokes = currentStrokes.filter((s) => !idsToRemove.has(s.id))
      return { nextStrokes, removed: removedStrokes }
    }
    return null
  }, [pdfViewerStore.drawingConfig.eraserSize, removeFromSpatialIndex, distancePointToSegment])

  const saveDataToDb = useCallback(async (currentStrokes: Stroke[]) => {
    if (!file) return
    try {
      const key = getDocKey(file)
      const data: SavedData = {
        docKey: key,
        strokes: currentStrokes,
        updatedAt: Date.now(),
      }
      await dbService.put('annotations', data)
    } catch (e) {
      console.error('保存数据失败:', e)
    }
  }, [file, dbService, getDocKey])

  const scheduleSaveToDb = useCallback((currentStrokes: Stroke[]) => {
    if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current)
    dbSaveTimer.current = setTimeout(() => {
      saveDataToDb(currentStrokes)
    }, 600)
  }, [saveDataToDb])

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    ctx.save()
    ctx.scale(renderDprRef.current || 1, renderDprRef.current || 1)
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
  }, [])

  const createStrokeObject = useCallback((pageIndex: number, points: Point[], mode: string): Stroke => {
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
    const bbox = calculateBBox(stroke.points, stroke.width)
    stroke.minX = bbox.minX
    stroke.minY = bbox.minY
    stroke.maxX = bbox.maxX
    stroke.maxY = bbox.maxY
    return stroke
  }, [calculateBBox, getToolConfigForMode])

  const renderInkLayer = useCallback((pageIndex: number, currentAllStrokes: Stroke[]) => {
    const canvas = inkRefs.current[pageIndex]
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const pageStrokes = currentAllStrokes.filter((s) => s.pageIndex === pageIndex)
    pageStrokes.forEach((stroke) => drawStroke(ctx, stroke))

    if (dragStartPage.current === pageIndex && currentDragPath.current.length > 0) {
      if (currentMode === 'select') {
        // 选择模式不渲染临时预览
      } else if (currentMode === 'eraser') {
        // 橡皮模式不渲染临时路径
      } else if (currentMode === 'pen' || currentMode === 'highlighter') {
        const tempStroke = createStrokeObject(pageIndex, currentDragPath.current, currentMode)
        drawStroke(ctx, tempStroke)
      } else if (currentMode === 'rectangle' && currentDragRect.current) {
        const { x, y, w, h } = currentDragRect.current
        const rectStroke = createStrokeObject(
          pageIndex,
          [{ x, y }, { x: x + w, y: y + h }],
          'rectangle'
        )
        drawStroke(ctx, rectStroke)
      }
    }

    if (currentMode === 'select') {
      const q = renderDprRef.current || 1
      const selected = currentAllStrokes.filter((s) => s.pageIndex === pageIndex && selectedStrokeIds.has(s.id))
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

      if (dragStartPage.current === pageIndex && selectDragRect.current) {
        const r = selectDragRect.current
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

      if (dragStartPage.current === pageIndex && selectFreeformPath.current && selectFreeformPath.current.length >= 2) {
        const path = selectFreeformPath.current
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
  }, [currentMode, drawStroke, createStrokeObject, selectedStrokeIds, getGroupBBox])


  const prefetchDimensionsAndLayout = useCallback(async (doc: mupdf.Document, direction: 'vertical' | 'horizontal', currentHorizontalIdx: number) => {
    const numPages = doc.countPages()
    if (direction === 'horizontal') {
      const pageIndex = Math.min(Math.max(currentHorizontalIdx, 0), Math.max(0, numPages - 1))
      setHorizontalPageIndex(pageIndex)
      const page = doc.loadPage(pageIndex)
      try {
        const bounds = page.getBounds()
        const width = bounds[2] - bounds[0]
        const height = bounds[3] - bounds[1]
        setPageList([{ pageIndex, viewWidth: width, viewHeight: height, x: 0, y: 0 }])
        setContentSize({ width, height })
      } finally {
        page.destroy?.()
      }
      return
    }

    let currentY = PAGE_GAP
    let maxW = 0
    const list: Array<{ pageIndex: number; viewWidth: number; viewHeight: number; x: number; y: number }> = []

    for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
      const page = doc.loadPage(pageIndex)
      try {
        const bounds = page.getBounds()
        const width = bounds[2] - bounds[0]
        const height = bounds[3] - bounds[1]
        if (width > maxW) maxW = width
        list.push({ pageIndex, viewWidth: width, viewHeight: height, x: 0, y: currentY })
        currentY += height + PAGE_GAP
      } finally {
        page.destroy?.()
      }
    }

    list.forEach((p) => (p.x = (maxW - p.viewWidth) / 2))
    setPageList(list)
    setContentSize({ width: maxW, height: currentY })
  }, [])

  useEffect(() => {
    console.log('[PdfPage] useEffect [file, loadFile] triggered, file:', file?.name)
    if (file) {
      loadFile(file)
    }
    return () => {
      if (pdfDoc) {
        try {
          pdfDoc.destroy()
        } catch {}
      }
    }
  }, [file])

  const pushHistory = useCallback((action: HistoryAction) => {
    undoStack.current.push(action)
    redoStack.current = []
  }, [])

  const undo = useCallback(() => {
    const action = undoStack.current.pop()
    if (!action) return
    redoStack.current.push(action)

    let nextStrokes = [...allStrokes]
    if (action.type === 'add') {
      const ids = new Set(action.strokes.map(s => s.id))
      action.strokes.forEach(s => removeFromSpatialIndex(s))
      nextStrokes = nextStrokes.filter(s => !ids.has(s.id))
    } else if (action.type === 'remove') {
      action.strokes.forEach(s => addToSpatialIndex(s))
      nextStrokes = [...nextStrokes, ...action.strokes]
    } else if (action.type === 'update') {
      const afterIds = new Set((action.after || []).map(s => s.id))
      action.after?.forEach(s => removeFromSpatialIndex(s))
      nextStrokes = nextStrokes.filter(s => !afterIds.has(s.id))
      action.before?.forEach(s => addToSpatialIndex(s))
      nextStrokes = [...nextStrokes, ...(action.before || [])]
    }

    setAllStrokes(nextStrokes)
    const pages = new Set<number>()
    if (action.type === 'update') {
      action.before?.forEach(s => pages.add(s.pageIndex))
      action.after?.forEach(s => pages.add(s.pageIndex))
    } else {
      action.strokes.forEach(s => pages.add(s.pageIndex))
    }
    pages.forEach(p => renderInkLayer(p, nextStrokes))
    scheduleSaveToDb(nextStrokes)
  }, [allStrokes, renderInkLayer, scheduleSaveToDb, addToSpatialIndex, removeFromSpatialIndex])

  const redo = useCallback(() => {
    const action = redoStack.current.pop()
    if (!action) return
    undoStack.current.push(action)

    let nextStrokes = [...allStrokes]
    if (action.type === 'add') {
      action.strokes.forEach(s => addToSpatialIndex(s))
      nextStrokes = [...nextStrokes, ...action.strokes]
    } else if (action.type === 'remove') {
      const ids = new Set(action.strokes.map(s => s.id))
      action.strokes.forEach(s => removeFromSpatialIndex(s))
      nextStrokes = nextStrokes.filter(s => !ids.has(s.id))
    } else if (action.type === 'update') {
      const beforeIds = new Set((action.before || []).map(s => s.id))
      action.before?.forEach(s => removeFromSpatialIndex(s))
      nextStrokes = nextStrokes.filter(s => !beforeIds.has(s.id))
      action.after?.forEach(s => addToSpatialIndex(s))
      nextStrokes = [...nextStrokes, ...(action.after || [])]
    }

    setAllStrokes(nextStrokes)
    const pages = new Set<number>()
    if (action.type === 'update') {
      action.before?.forEach(s => pages.add(s.pageIndex))
      action.after?.forEach(s => pages.add(s.pageIndex))
    } else {
      action.strokes.forEach(s => pages.add(s.pageIndex))
    }
    pages.forEach(p => renderInkLayer(p, nextStrokes))
    scheduleSaveToDb(nextStrokes)
  }, [allStrokes, renderInkLayer, scheduleSaveToDb, addToSpatialIndex, removeFromSpatialIndex])

  const renderPdfPages = useCallback(async () => {
    console.log('[PdfPage] renderPdfPages start, pdfDoc exists:', !!pdfDoc, 'pageList len:', pageList.length)
    if (!pdfDoc) return
    const generation = ++renderGeneration.current
    setIsRendering(true)
    try {
      const baseDpr = window.devicePixelRatio || 1
      
      // 根据文件大小/页数决定是否降级渲染（避免 WebView 崩溃）
      const shouldUseLowRenderMode = (() => {
        const fileSizeMB = (file?.size || 0) / (1024 * 1024)
        return fileSizeMB > 3
      })()

      const renderDpr = shouldUseLowRenderMode ? 1 : Math.min(baseDpr * 2, 3)
      renderDprRef.current = renderDpr
      console.log('[PdfPage] renderDpr:', renderDpr, 'sizeMB:', (file?.size || 0) / 1024 / 1024, 'pages:', pageList.length, 'lowMode:', shouldUseLowRenderMode)

      const renderOnePage = async (pageIndex: number) => {
        const pageLayout = pageList.find((p) => p.pageIndex === pageIndex)
        if (!pageLayout) return
        try {
          if (generation !== renderGeneration.current || layoutSuspended) return
          const canvas = pdfRefs.current[pageIndex]
          const inkCanvas = inkRefs.current[pageIndex]
          if (!canvas || !inkCanvas) {
            console.warn(`[PdfPage] Canvas not found for page ${pageIndex}, pdfRefs keys:`, Object.keys(pdfRefs.current))
            return
          }

          const cssW = pageLayout.viewWidth
          const cssH = pageLayout.viewHeight
          canvas.width = cssW * renderDpr
          canvas.height = cssH * renderDpr
          canvas.style.width = `${cssW}px`
          canvas.style.height = `${cssH}px`
          inkCanvas.width = canvas.width
          inkCanvas.height = canvas.height
          inkCanvas.style.width = canvas.style.width
          inkCanvas.style.height = canvas.style.height

          const ctx = canvas.getContext('2d')
          if (!ctx) return
          const page = pdfDoc.loadPage(pageIndex)
          try {
            const matrix: mupdf.Matrix = [renderDpr, 0, 0, renderDpr, 0, 0]
            const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, true, true)
            try {
              if (generation !== renderGeneration.current || layoutSuspended) return
              const width = pixmap.getWidth()
              const height = pixmap.getHeight()
              const samples = pixmap.getPixels()
              const rgbaData = new Uint8ClampedArray(samples)
              ctx.putImageData(new ImageData(rgbaData, width, height), 0, 0)
            } finally {
              pixmap.destroy()
            }
          } finally {
            page.destroy?.()
          }
          renderInkLayer(pageIndex, allStrokes)
        } catch (e) {
          console.error('[PdfPage] render page failed:', { pageIndex, error: e })
        }
      }
      await Promise.all(pageList.map((p) => renderOnePage(p.pageIndex)))
    } finally {
      if (generation === renderGeneration.current) {
        setIsRendering(false)
        setHasRendered(true)
      }
    }
  }, [pdfDoc, pageList, layoutSuspended, renderInkLayer, allStrokes])

  useEffect(() => {
    console.log('[PdfPage] useEffect [pdfDoc, pageList, hasRendered] triggered:', { hasPdfDoc: !!pdfDoc, pageListLen: pageList.length, hasRendered, isRendering })
    if (pdfDoc && pageList.length > 0 && !hasRendered && !isRendering) {
      // 延迟确保 Canvas DOM 挂载
      const timer = setTimeout(() => {
        console.log('[PdfPage] Executing delayed renderPdfPages')
        renderPdfPages()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [pdfDoc, pageList, hasRendered, renderPdfPages, isRendering])

  const takeScreenshotAcrossPages = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    if (rect.w < 5 || rect.h < 5) return
    const q = renderDprRef.current || 1

    const out = document.createElement('canvas')
    out.width = Math.round(rect.w * q)
    out.height = Math.round(rect.h * q)
    const octx = out.getContext('2d')
    if (!octx) return
    octx.fillStyle = '#ffffff'
    octx.fillRect(0, 0, out.width, out.height)

    for (let i = 0; i < pageList.length; i++) {
      const page = pageList[i]
      const pdfCanvas = pdfRefs.current[page.pageIndex]
      const inkCanvas = inkRefs.current[page.pageIndex]
      if (!page || !pdfCanvas || !inkCanvas) continue

      // 页面在 content 坐标系中的位置
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
        if (blob && onScreenshotCaptured) onScreenshotCaptured(blob)
      },
      'image/jpeg',
      0.95
    )
  }, [pageList, onScreenshotCaptured])

  const stopInertia = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = null
    velocity.current = { x: 0, y: 0 }
  }, [])

  const applyPan = useCallback((dx: number, dy: number) => {
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    velocity.current = { x: dx, y: dy }
    // clampOffset() 后续由 useEffect 或直接在 setOffset 中处理
  }, [])

  const handlePointerMoveForEraserCursor = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!viewportRef.current || currentMode !== 'eraser') {
      eraserCursor.current.visible = false
      return
    }
    const rect = viewportRef.current.getBoundingClientRect()
    const size = getEraserCursorSize()
    eraserCursor.current = {
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      size,
    }
  }, [currentMode, getEraserCursorSize])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!viewportRef.current) return
    viewportRef.current.setPointerCapture(e.pointerId)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    stopInertia()

    if (activePointers.current.size === 1) {
      lastPointerPos.current = { x: e.clientX, y: e.clientY }
      const loc = getPdfPoint(e.clientX, e.clientY)

      handlePointerMoveForEraserCursor(e)

      if (currentMode !== 'pan' && !loc) {
        isPanningInDrawMode.current = true
        return
      }

      if (currentMode !== 'pan' && loc) {
        isPanningInDrawMode.current = false
        dragStartPage.current = loc.pageIndex
        currentDragPath.current = [{ x: loc.x, y: loc.y }]
        isDrawingStarted.current = false
        renderInkLayer(loc.pageIndex, allStrokes)
      } else {
        isPanningInDrawMode.current = false
      }
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      lastPinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      lastPinchCenter.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 1) {
      if (currentMode === 'pan' || isPanningInDrawMode.current) {
        const dx = e.clientX - lastPointerPos.current.x
        const dy = e.clientY - lastPointerPos.current.y
        applyPan(dx, dy)
        lastPointerPos.current = { x: e.clientX, y: e.clientY }
      } else if (dragStartPage.current !== -1) {
        const loc = getPdfPoint(e.clientX, e.clientY)
        handlePointerMoveForEraserCursor(e)
        if (loc && loc.pageIndex === dragStartPage.current) {
          currentDragPath.current.push({ x: loc.x, y: loc.y })
          renderInkLayer(loc.pageIndex, allStrokes)
        }
      }
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const centerX = (pts[0].x + pts[1].x) / 2
      const centerY = (pts[0].y + pts[1].y) / 2

      if (lastPinchDist.current > 0) {
        const ratio = dist / lastPinchDist.current
        const newScale = Math.min(Math.max(scale * ratio, 0.1), 5.0)
        const actualRatio = newScale / scale

        const dx = centerX - lastPinchCenter.current.x
        const dy = centerY - lastPinchCenter.current.y
        
        setScale(newScale)
        setOffset(prev => ({
          x: centerX - (centerX - (prev.x + dx)) * actualRatio,
          y: centerY - (centerY - (prev.y + dy)) * actualRatio,
        }))
      }
      lastPinchDist.current = dist
      lastPinchCenter.current = { x: centerX, y: centerY }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size === 0) {
      eraserCursor.current.visible = false
      if (dragStartPage.current !== -1) {
        const pageIdx = dragStartPage.current
        if (currentDragPath.current.length >= 1 && currentMode !== 'pan') {
          const newStroke = createStrokeObject(pageIdx, currentDragPath.current, currentMode)
          const nextStrokes = [...allStrokes, newStroke]
          setAllStrokes(nextStrokes)
          addToSpatialIndex(newStroke)
          scheduleSaveToDb(nextStrokes)
        }
        dragStartPage.current = -1
        currentDragPath.current = []
        isPanningInDrawMode.current = false
        renderInkLayer(pageIdx, allStrokes)
      }
    }
  }

  // === 导航与对外接口 ===
  const goToHorizontalPage = useCallback(async (pageIndex: number) => {
    if (!pdfDoc) return
    const next = Math.min(Math.max(pageIndex, 0), Math.max(0, pdfDoc.countPages() - 1))
    if (next === horizontalPageIndex) return
    
    setHorizontalPageIndex(next)

    // 切页时重置缩放/状态
    if (scale !== 1) setScale(1)
    setOffset({ x: 0, y: 0 })

    await prefetchDimensionsAndLayout(pdfDoc, 'horizontal', next)
    setHasRendered(false)

    // 单页切换后确保居中
    requestAnimationFrame(() => {
      centerContent()
    })
  }, [pdfDoc, horizontalPageIndex, scale, prefetchDimensionsAndLayout])

  const goPrevPage = useCallback(() => goToHorizontalPage(horizontalPageIndex - 1), [goToHorizontalPage, horizontalPageIndex])
  const goNextPage = useCallback(() => goToHorizontalPage(horizontalPageIndex + 1), [goToHorizontalPage, horizontalPageIndex])

  const toggleReadingDirection = useCallback(async () => {
    const fromDirection = readingDirection
    const targetPageIndex = fromDirection === 'horizontal' ? horizontalPageIndex : getCurrentVerticalPageIndex()

    setIsDirectionChanging(true)
    await new Promise(resolve => setTimeout(resolve, 300))

    const nextDirection = fromDirection === 'horizontal' ? 'vertical' : 'horizontal'
    setReadingDirection(nextDirection)
    if (scale !== 1) setScale(1)
    setOffset({ x: 0, y: 0 })

    if (pdfDoc) {
      await prefetchDimensionsAndLayout(pdfDoc, nextDirection, targetPageIndex)
      setHasRendered(false)
    }

    requestAnimationFrame(() => {
      setIsDirectionChanging(false)
    })

    requestAnimationFrame(() => {
      if (nextDirection === 'vertical') {
        if (!viewportRef.current || pageList.length === 0) return
        const rect = viewportRef.current.getBoundingClientRect()
        const maxW = Math.max(...pageList.map((p) => p.viewWidth))
        const targetPage = pageList.find((p) => p.pageIndex === targetPageIndex)
        setOffset({
          x: (rect.width - maxW * scale) / 2,
          y: targetPage ? 20 - targetPage.y * scale : 20,
        })
      } else {
        centerContent()
      }
    })
  }, [readingDirection, horizontalPageIndex, getCurrentVerticalPageIndex, pdfDoc, prefetchDimensionsAndLayout, scale, pageList])

  const centerContent = useCallback(() => {
    if (!viewportRef.current || pageList.length === 0) return
    const rect = viewportRef.current.getBoundingClientRect()
    if (rect.width === 0) return

    const maxW = Math.max(...pageList.map((p) => p.viewWidth))
    if (readingDirection === 'horizontal') {
      const p = pageList[0]
      const pageH = p?.viewHeight ?? 0
      setOffset({
        x: (rect.width - maxW * scale) / 2,
        y: (rect.height - pageH * scale) / 2,
      })
    } else {
      setOffset({
        x: (rect.width - maxW * scale) / 2,
        y: 20,
      })
    }
  }, [readingDirection, pageList, scale])

  useImperativeHandle(ref, () => ({
    toggleGestureMode: () => pdfViewerStore.setSelectedTool('pan'),
    toggleHighlightMode: () => pdfViewerStore.setSelectedTool('highlighter'),
    togglePenMode: () => pdfViewerStore.setSelectedTool('pen'),
    toggleEraserMode: () => pdfViewerStore.setSelectedTool('eraser'),
    toggleScreenshotMode: () => pdfViewerStore.setSelectedTool('screenshot'),
    toggleNoteMode: () => pdfViewerStore.setSelectedTool('pen'),
    toggleSelectMode: () => pdfViewerStore.setSelectedTool('select'),
    toggleReadingDirection,
    goPrevPage,
    goNextPage,
    setSelectionMode: (mode) => { selectionMode.current = mode },
    undoLastStroke: undo,
    redoLastStroke: redo,
    refreshLayout: () => setHasRendered(false),
  }))
  
  return (
    <div className="pdf-reader-container">
      <div
        className={`viewport ${readingDirection === 'horizontal' ? 'is-horizontal' : ''} ${
          readingDirection === 'horizontal' && (currentMode === 'pen' || currentMode === 'highlighter' || currentMode === 'eraser')
            ? 'is-drawing'
            : ''
        } ${isDirectionChanging ? 'direction-changing' : ''}`}
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className={`canvas-container ${readingDirection === 'horizontal' ? 'is-horizontal' : ''} ${
            layoutSuspended ? 'is-suspended' : ''
          }`}
          style={{
            width: `${contentSize.width}px`,
            height: `${contentSize.height}px`,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
          ref={containerRef}
        >
          {pageList.map((page) => (
            <div
              key={page.pageIndex}
              className={`page-wrapper ${readingDirection === 'horizontal' ? 'is-horizontal' : ''}`}
              data-page-index={page.pageIndex}
              style={{
                width: `${page.viewWidth}px`,
                height: `${page.viewHeight}px`,
                left: `${page.x}px`,
                top: `${page.y}px`,
              }}
            >
              <canvas
                ref={(el) => {
                  if (el) pdfRefs.current[page.pageIndex] = el
                }}
              />
              <canvas
                ref={(el) => {
                  if (el) inkRefs.current[page.pageIndex] = el
                }}
                className="ink-canvas"
              />
            </div>
          ))}

          {currentMode === 'screenshot' && screenshotDragRect.current && (
            <div
              className="screenshot-overlay"
              style={{
                left: screenshotDragRect.current.x,
                top: screenshotDragRect.current.y,
                width: screenshotDragRect.current.w,
                height: screenshotDragRect.current.h,
              }}
            />
          )}
        </div>

        {readingDirection === 'horizontal' && (
          <div className="horizontal-nav">
            <button
              className="nav-btn nav-left"
              disabled={horizontalPageIndex <= 0}
              onClick={(e) => {
                e.stopPropagation()
                goPrevPage()
              }}
            >
              <span className="material-icons">chevron_left</span>
            </button>
            <button
              className="nav-btn nav-right"
              disabled={horizontalPageIndex >= pageCount - 1}
              onClick={(e) => {
                e.stopPropagation()
                goNextPage()
              }}
            >
              <span className="material-icons">chevron_right</span>
            </button>
          </div>
        )}

        {(loading || isRendering) && (
          <div className="loading-overlay">
            <Loading text="正在加载..." size={48} theme="light" />
          </div>
        )}
      </div>
    </div>
  )
}

export const PdfPage = forwardRef(PdfPageRender)
export default PdfPage
