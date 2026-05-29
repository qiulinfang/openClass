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

export const PdfPage = forwardRef<PdfPageRef, PdfPageProps>(({ file, layoutSuspended, onScreenshotCaptured }, ref) => {
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
  
  // 工具状态
  const currentMode = pdfViewerStore.selectedTool as ToolMode || 'pan'

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
  const selectAction = useRef<{
    type: 'move' | 'box_select' | 'freeform_select'
    pageIndex: number
    lastPos: Point
    startPos: Point
    moved: boolean
    beforeStrokes: Stroke[]
  } | null>(null)

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
  
  // 定时器相关
  const horizontalScrollTimer = useRef<any>(null)
  const horizontalScrollEndTimer = useRef<any>(null)
  const dbSaveTimer = useRef<any>(null)
  const saveTimer = useRef<any>(null)

  // === 核心逻辑 ===
  const getDocKey = (file: File) => `${file.name}|${file.size}`

  const dbService = useMemo(() => IndexedDBService.getInstance({
    dbName: 'pdf-ink-db',
    version: 1,
    stores: [{ name: 'annotations', keyPath: 'docKey' }],
  }), [])

  // === 工具函数 ===
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

  // === 基础辅助函数 ===
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
  }, [file, dbService])

  const scheduleSaveToDb = useCallback((currentStrokes: Stroke[]) => {
    if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current)
    dbSaveTimer.current = setTimeout(() => {
      saveDataToDb(currentStrokes)
    }, 600)
  }, [saveDataToDb])

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
    const pages = new Set(action.strokes.map(s => s.pageIndex))
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
    const pages = new Set(action.strokes.map(s => s.pageIndex))
    pages.forEach(p => renderInkLayer(p, nextStrokes))
    scheduleSaveToDb(nextStrokes)
  }, [allStrokes, renderInkLayer, scheduleSaveToDb, addToSpatialIndex, removeFromSpatialIndex])

  // === 外部接口 ===
  useImperativeHandle(ref, () => ({
    toggleGestureMode: () => pdfViewerStore.setSelectedTool('pan'),
    toggleHighlightMode: () => pdfViewerStore.setSelectedTool('highlighter'),
    togglePenMode: () => pdfViewerStore.setSelectedTool('pen'),
    toggleEraserMode: () => pdfViewerStore.setSelectedTool('eraser'),
    toggleScreenshotMode: () => pdfViewerStore.setSelectedTool('screenshot'),
    toggleNoteMode: () => pdfViewerStore.setSelectedTool('pen'), // 暂时对应 pen
    toggleSelectMode: () => pdfViewerStore.setSelectedTool('select'),
    toggleReadingDirection: () => setReadingDirection(prev => prev === 'vertical' ? 'horizontal' : 'vertical'),
    goPrevPage: () => setHorizontalPageIndex(prev => Math.max(0, prev - 1)),
    goNextPage: () => setHorizontalPageIndex(prev => Math.min(pageCount - 1, prev + 1)),
    setSelectionMode: (mode: 'rectangle' | 'freeform') => { selectionMode.current = mode },
    undoLastStroke: () => undo(),
    redoLastStroke: () => redo(),
    refreshLayout: () => { /* 实现 refreshLayout */ },
  }), [pdfViewerStore, pageCount, undo, redo])

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
        console.log('已恢复持久化笔迹:', data.strokes.length, '条笔迹')
      }
    } catch (e) {
      console.error('加载持久化数据失败:', e)
    }
  }, [dbService, calculateBBox, rebuildSpatialIndex])

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

  const loadFile = useCallback(async (file: File) => {
    setLoading(true)
    setHasRendered(false)
    try {
      await loadDataFromDb(file)
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const doc = mupdf.Document.openDocument(uint8Array, 'application/pdf')
      setPdfDoc(doc)
      setPageCount(doc.countPages())
      await prefetchDimensionsAndLayout(doc, readingDirection, horizontalPageIndex)
    } catch (err) {
      console.error('[PdfPage] PDF Load Error:', err)
    } finally {
      setLoading(false)
    }
  }, [loadDataFromDb, prefetchDimensionsAndLayout, readingDirection, horizontalPageIndex])

  useEffect(() => {
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
    Object.assign(stroke, calculateBBox(stroke.points, stroke.width))
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
      const selectedOnPage = currentAllStrokes.filter((s) => s.pageIndex === pageIndex && selectedStrokeIds.has(s.id))
      // 绘制选中框逻辑...
    }
  }, [currentMode, drawStroke, createStrokeObject, selectedStrokeIds])

  const renderPdfPages = useCallback(async () => {
    if (!pdfDoc) return
    const generation = ++renderGeneration.current
    setIsRendering(true)
    try {
      const baseDpr = window.devicePixelRatio || 1
      const renderDpr = Math.min(baseDpr * 2, 3)
      renderDprRef.current = renderDpr

      const renderOnePage = async (pageIndex: number) => {
        const pageLayout = pageList.find((p) => p.pageIndex === pageIndex)
        if (!pageLayout) return
        try {
          if (generation !== renderGeneration.current || layoutSuspended) return
          const canvas = pdfRefs.current[pageIndex]
          const inkCanvas = inkRefs.current[pageIndex]
          if (!canvas || !inkCanvas) return

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
    if (pdfDoc && pageList.length > 0 && !hasRendered) {
      renderPdfPages()
    }
  }, [pdfDoc, pageList, hasRendered, renderPdfPages])

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

  const onPointerDown = (e: React.PointerEvent) => {
    if (!viewportRef.current) return
    viewportRef.current.setPointerCapture(e.pointerId)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 1) {
      lastPointerPos.current = { x: e.clientX, y: e.clientY }
      const loc = getPdfPoint(e.clientX, e.clientY)

      if (currentMode !== 'pan' && loc) {
        dragStartPage.current = loc.pageIndex
        currentDragPath.current = [{ x: loc.x, y: loc.y }]
        isDrawingStarted.current = false
        renderInkLayer(loc.pageIndex, allStrokes)
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
      if (currentMode === 'pan') {
        const dx = e.clientX - lastPointerPos.current.x
        const dy = e.clientY - lastPointerPos.current.y
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
        lastPointerPos.current = { x: e.clientX, y: e.clientY }
      } else if (dragStartPage.current !== -1) {
        const loc = getPdfPoint(e.clientX, e.clientY)
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
      if (dragStartPage.current !== -1) {
        const pageIdx = dragStartPage.current
        if (currentDragPath.current.length > 1 && currentMode !== 'pan') {
          const newStroke = createStrokeObject(pageIdx, currentDragPath.current, currentMode)
          const nextStrokes = [...allStrokes, newStroke]
          setAllStrokes(nextStrokes)
          addToSpatialIndex(newStroke)
          // 保存到 DB...
        }
        dragStartPage.current = -1
        currentDragPath.current = []
        renderInkLayer(pageIdx, allStrokes)
      }
    }
  }

  // (后续继续补充剩下的逻辑和渲染层...)
  
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
                setHorizontalPageIndex(prev => Math.max(0, prev - 1))
              }}
            >
              <span className="material-icons">chevron_left</span>
            </button>
            <button
              className="nav-btn nav-right"
              disabled={horizontalPageIndex >= pageCount - 1}
              onClick={(e) => {
                e.stopPropagation()
                setHorizontalPageIndex(prev => Math.min(pageCount - 1, prev + 1))
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
})

export default PdfPage
