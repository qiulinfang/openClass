<template>
  <div class="pdf-reader-container">
    <!-- 视口区域 -->
    <div 
      class="viewport" 
      ref="viewportRef"
      @wheel.prevent="handleWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <div class="canvas-container" :style="containerStyle" ref="containerRef">
        <div 
          v-for="(page, index) in pageList" 
          :key="index" 
          class="page-wrapper"
          :style="{ 
            width: page.viewWidth + 'px', 
            height: page.viewHeight + 'px', 
            left: page.x + 'px', 
            top: page.y + 'px' 
          }"
        >
          <!-- PDF 内容层 -->
          <canvas :ref="el => pdfRefs[index] = el as HTMLCanvasElement"></canvas>
          <!-- 涂鸦/形状层 -->
          <canvas :ref="el => inkRefs[index] = el as HTMLCanvasElement" class="ink-canvas"></canvas>
          
          <!-- 截图选区覆盖层 -->
          <div 
            v-if="currentMode === 'screenshot' && dragStartPage === index && currentDragRect"
            class="screenshot-overlay"
            :style="getRectStyle(currentDragRect)"
          ></div>
        </div>
      </div>

      <!-- 加载状态提示 -->
      <div v-if="loading || isRendering" class="loading-overlay">
        <div class="spinner"></div>
        <span>正在加载...</span>
      </div>
      <div v-else-if="!isVisible && pageCount > 0" class="waiting-overlay">
        <span>等待视图容器就绪...</span>
      </div>

      <!-- 橡皮擦光标提示 -->
      <div
        v-if="eraserCursor.visible"
        class="eraser-cursor"
        :style="{
          left: eraserCursor.x + 'px',
          top: eraserCursor.y + 'px',
          width: eraserCursor.size + 'px',
          height: eraserCursor.size + 'px'
        }"
      ></div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, toRaw, nextTick, watch, onUnmounted } from 'vue';
import * as mupdf from 'mupdf';
import { IndexedDBService } from '@/services/storage/indexeddb-service';
import { usePdfViewerStore } from '@/stores/pdfViewerStore';

// === 类型定义 ===
type ToolMode = 'pan' | 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'screenshot';

interface Point { x: number; y: number; }
interface Stroke {
  id: string;
  type: 'pen' | 'highlighter' | 'rectangle';
  pageIndex: number;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  minX?: number;
  minY?: number;
  maxX?: number;
  maxY?: number;
}

interface HistoryAction {
  type: 'add' | 'remove';
  strokes: Stroke[];
}

interface SavedData {
  docKey: string;
  strokes: Stroke[];
  viewState?: {
    scale: number;
    offsetX: number;
    offsetY: number;
  };
  updatedAt: number;
}

// === Props ===
const props = defineProps<{
  file: File | null;
}>();

const emit = defineEmits<{
  (e: 'screenshot-captured', blob: Blob): void;
}>();

// === 配置常量 ===
const RENDER_QUALITY = 3.0; 
const PAGE_GAP = 20;
const FRICTION = 0.96;

// MuPDF 渲染像素比（Canvas 实际像素 / CSS 像素），用于保证笔迹绘制与 PDF 底图对齐
const renderDprRef = ref(1);

// === 持久化服务 ===
const dbService = IndexedDBService.getInstance({
  dbName: 'pdf-ink-db',
  version: 1,
  stores: [{ name: 'annotations', keyPath: 'docKey' }]
});

// === 状态管理 ===
const pdfDoc = shallowRef<mupdf.Document | null>(null);
const fileName = ref('');
const pageCount = ref(0);
const pageList = ref<Array<{ viewWidth: number; viewHeight: number; x: number; y: number }>>([]);
const scale = ref(1.0);
const offset = ref({ x: 0, y: 0 });
const loading = ref(false);     
const isRendering = ref(false); 
const isVisible = ref(false);   
const hasRendered = ref(false); 
const contentSize = ref({ width: 0, height: 0 });

// 工具状态
const currentMode = ref<ToolMode>('pan');
const currentModeLabel = computed(() => {
  const map: Record<ToolMode, string> = {
    pan: '浏览', pen: '画笔', highlighter: '高亮', 
    eraser: '橡皮擦', rectangle: '矩形', screenshot: '截图'
  };
  return map[currentMode.value];
});

const pdfViewerStore = usePdfViewerStore();

const getToolConfigForMode = (mode: ToolMode) => {
  if (mode === 'pen') {
    return {
      color: pdfViewerStore.drawingConfig.penColor,
      width: pdfViewerStore.drawingConfig.penWidth,
      opacity: pdfViewerStore.drawingConfig.penOpacity ?? 1.0,
    };
  }
  if (mode === 'highlighter') {
    return {
      color: pdfViewerStore.drawingConfig.highlighterColor,
      width: pdfViewerStore.drawingConfig.highlighterWidth,
      opacity: pdfViewerStore.drawingConfig.highlighterOpacity ?? 0.4,
    };
  }
  return {
    color: '#FF0000',
    width: 2,
    opacity: 1.0,
  };
};

// 数据存储
const allStrokes = shallowRef<Stroke[]>([]);
const undoStack = ref<HistoryAction[]>([]);
const redoStack = ref<HistoryAction[]>([]);

// 交互临时状态
const dragStartPage = ref<number>(-1);
const currentDragPath = ref<Point[]>([]);
const currentDragRect = ref<{ x: number, y: number, w: number, h: number } | null>(null);
const isDrawingStarted = ref(false);
const DRAW_THRESHOLD = 3;

const eraserCursor = ref<{ visible: boolean; x: number; y: number; size: number }>({
  visible: false,
  x: 0,
  y: 0,
  size: pdfViewerStore.drawingConfig.eraserSize
});

// === 性能优化：空间索引 ===
const GRID_SIZE = 100; // 100px 分辨率的网格
// key: `${pageIndex}|${gridX}|${gridY}` -> Set<Stroke>
const spatialGrid = new Map<string, Set<Stroke>>();

const calculateBBox = (points: Point[], width: number) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const padding = width / 2 + 2;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
};

const addToSpatialIndex = (stroke: Stroke) => {
  if (stroke.minX == null || stroke.maxX == null || stroke.minY == null || stroke.maxY == null) return;
  const startX = Math.floor(stroke.minX / GRID_SIZE);
  const endX = Math.floor(stroke.maxX / GRID_SIZE);
  const startY = Math.floor(stroke.minY / GRID_SIZE);
  const endY = Math.floor(stroke.maxY / GRID_SIZE);
  for (let gx = startX; gx <= endX; gx++) {
    for (let gy = startY; gy <= endY; gy++) {
      const key = `${stroke.pageIndex}|${gx}|${gy}`;
      let cell = spatialGrid.get(key);
      if (!cell) {
        cell = new Set<Stroke>();
        spatialGrid.set(key, cell);
      }
      cell.add(stroke);
    }
  }
};

const removeFromSpatialIndex = (stroke: Stroke) => {
  if (stroke.minX == null || stroke.maxX == null || stroke.minY == null || stroke.maxY == null) return;
  const startX = Math.floor(stroke.minX / GRID_SIZE);
  const endX = Math.floor(stroke.maxX / GRID_SIZE);
  const startY = Math.floor(stroke.minY / GRID_SIZE);
  const endY = Math.floor(stroke.maxY / GRID_SIZE);
  for (let gx = startX; gx <= endX; gx++) {
    for (let gy = startY; gy <= endY; gy++) {
      const key = `${stroke.pageIndex}|${gx}|${gy}`;
      const cell = spatialGrid.get(key);
      if (cell) {
        cell.delete(stroke);
        if (cell.size === 0) spatialGrid.delete(key);
      }
    }
  }
};

const rebuildSpatialIndex = () => {
  spatialGrid.clear();
  allStrokes.value.forEach(s => {
    if (s.minX == null) {
      Object.assign(s, calculateBBox(s.points, s.width));
    }
    addToSpatialIndex(s);
  });
};

// 橡皮擦的视觉直径与命中检测阈值保持一致（半径 = eraserSize，乘以 scale 后再取直径）
const getEraserCursorSize = () => pdfViewerStore.drawingConfig.eraserSize * scale.value * 2;

watch(
  () => pdfViewerStore.drawingConfig.eraserSize,
  (val) => {
    console.log('[PdfPage][eraser] size changed from store ->', val);
    if (currentMode.value === 'eraser' && eraserCursor.value.visible) {
      eraserCursor.value = { ...eraserCursor.value, size: getEraserCursorSize() };
    }
  }
);

// 渲染控制
const viewportRef = ref<HTMLDivElement | null>(null);
const pdfRefs = ref<HTMLCanvasElement[]>([]);
const inkRefs = ref<HTMLCanvasElement[]>([]);
let resizeObserver: ResizeObserver | null = null;

// 写字模式下在非 PDF 区域拖动时，降级为平移
let isPanningInDrawMode = false;

// 手势控制
const activePointers = new Map<number, Point>();
let lastPointerPos = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let rafId: number | null = null;
let lastPinchDist = 0;
let lastPinchCenter = { x: 0, y: 0 };

const containerStyle = computed(() => ({
  width: `${contentSize.value.width}px`,
  height: `${contentSize.value.height}px`,
  transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`
}));

// === 持久化核心逻辑 ===

const getDocKey = (file: File) => `${file.name}|${file.size}`;

const loadDataFromDb = async (file: File) => {
  try {
    const key = getDocKey(file);
    const data = await dbService.get<SavedData>('annotations', key);
    if (data) {
      if (data.strokes) {
        data.strokes.forEach(s => {
          if (s.minX == null) {
            Object.assign(s, calculateBBox(s.points, s.width));
          }
        });
        allStrokes.value = data.strokes;
        rebuildSpatialIndex();
      }
      // 不再恢复视图状态（滚动、缩放），每次加载使用默认
      console.log('已恢复持久化笔迹:', data.strokes.length, '条笔迹');
    }
  } catch (e) {
    console.error('加载持久化数据失败:', e);
  }
};

const saveDataToDb = async () => {
  if (!props.file) return;
  try {
    const key = getDocKey(props.file);
    const data: SavedData = {
      docKey: key,
      strokes: toRaw(allStrokes.value),
      updatedAt: Date.now()
    };
    await dbService.put('annotations', data);
  } catch (e) {
    console.error('保存数据失败:', e);
  }
};

// === 核心流程 ===

const loadFile = async (file: File) => {
  loading.value = true;
  resetState();
  fileName.value = file.name;

  try {
    // 1. 先加载持久化数据（笔迹和视图状态）
    await loadDataFromDb(file);

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 使用 MuPDF 打开 PDF 文档（比 pdfjs 更适合 Android WebView / file:// 环境）
    const doc = mupdf.Document.openDocument(uint8Array, 'application/pdf');
    pdfDoc.value = doc;
    pageCount.value = doc.countPages();
    
    // 2. 预取尺寸
    await prefetchDimensionsAndLayout(doc);
    
    // 3. 尝试渲染
    tryRenderContent();
    
    // 4. 如果没有保存的视图状态，才居中；否则保持恢复的位置并进行边界修正
    if (offset.value.x === 0 && offset.value.y === 0 && scale.value === 1.0) {
      centerContent();
    } else {
      clampOffset(); // 确保恢复的位置合法
    }
    
  } catch (err) {
    console.error('[PdfPage] PDF Load Error:', err);
  } finally {
    loading.value = false;
  }
};

const prefetchDimensionsAndLayout = async (doc: mupdf.Document) => {
  const numPages = doc.countPages();

  let currentY = PAGE_GAP;
  let maxW = 0;
  const list: Array<{ viewWidth: number; viewHeight: number; x: number; y: number }> = [];

  // MuPDF 获取页面尺寸是同步的，这里仍用 async 包一层保持接口一致
  for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
    const page = doc.loadPage(pageIndex);
    try {
      const bounds = page.getBounds();
      const width = bounds[2] - bounds[0];
      const height = bounds[3] - bounds[1];
      if (width > maxW) maxW = width;
      list.push({
        viewWidth: width,
        viewHeight: height,
        x: 0,
        y: currentY,
      });
      currentY += height + PAGE_GAP;
    } finally {
      page.destroy?.();
    }
  }

  list.forEach(p => p.x = (maxW - p.viewWidth) / 2);

  pageList.value = list;
  contentSize.value = { width: maxW, height: currentY };
};

const tryRenderContent = async () => {
  if (isVisible.value && pageList.value.length > 0 && !hasRendered.value) {
    await renderPdfPages();
    hasRendered.value = true;
  }
};

const setupResizeObserver = () => {
  if (!viewportRef.value) return;
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      const isNowVisible = width > 0 && height > 0;
      
      if (isNowVisible !== isVisible.value) {
        isVisible.value = isNowVisible;
        if (isNowVisible) {
          tryRenderContent();
          if (hasRendered.value) clampOffset();
        }
      }
    }
  });
  resizeObserver.observe(viewportRef.value);
};

const renderPdfPages = async () => {
  const rawDoc = toRaw(pdfDoc.value);
  if (!rawDoc) return;
  
  isRendering.value = true;
  
  try {
    const baseDpr = window.devicePixelRatio || 1;
    // 提高清晰度：提高渲染像素密度（同时会增加内存/耗时）
    const renderDpr = Math.min(baseDpr * 2, 3);
    renderDprRef.value = renderDpr;

    const renderPromises = pageList.value.map(async (pageLayout, i) => {
      try {
        const canvas = pdfRefs.value[i];
        const inkCanvas = inkRefs.value[i];
        if (!canvas || !inkCanvas) return;

        // 页面尺寸来自预取布局（单位：CSS px）
        const cssW = pageLayout.viewWidth;
        const cssH = pageLayout.viewHeight;

        canvas.width = cssW * renderDpr;
        canvas.height = cssH * renderDpr;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        inkCanvas.width = canvas.width;
        inkCanvas.height = canvas.height;
        inkCanvas.style.width = canvas.style.width;
        inkCanvas.style.height = canvas.style.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const page = rawDoc.loadPage(i);
        try {
          const matrix: mupdf.Matrix = [renderDpr, 0, 0, renderDpr, 0, 0];
          const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
          try {
            const pixels = pixmap.getPixels();
            const width = pixmap.getWidth();
            const height = pixmap.getHeight();
            const rgbData = new Uint8Array(pixels);
            const rgbaData = new Uint8ClampedArray(width * height * 4);

            for (let j = 0; j < width * height; j++) {
              rgbaData[j * 4] = rgbData[j * 3];
              rgbaData[j * 4 + 1] = rgbData[j * 3 + 1];
              rgbaData[j * 4 + 2] = rgbData[j * 3 + 2];
              rgbaData[j * 4 + 3] = 255;
            }

            ctx.putImageData(new ImageData(rgbaData, width, height), 0, 0);
          } finally {
            pixmap.destroy();
          }
        } finally {
          page.destroy?.();
        }

        // 渲染 Ink 层（包含刚加载的笔迹）
        renderInkLayer(i);
      } catch (e) {
        console.error('[PdfPage] render page failed:', { pageIndex: i, error: e });
      }
    });

    await Promise.all(renderPromises);
  } finally {
    isRendering.value = false;
  }
};

const resetState = () => {
  if (pdfDoc.value) {
    try {
      pdfDoc.value.destroy();
    } catch {
    }
  }
  pdfDoc.value = null;
  pageList.value = [];
  allStrokes.value = [];
  spatialGrid.clear();
  undoStack.value = [];
  redoStack.value = [];
  offset.value = { x: 0, y: 0 };
  scale.value = 1.0;
  contentSize.value = { width: 0, height: 0 };
  hasRendered.value = false;
};

// === 绘图与渲染逻辑 ===

const renderInkLayer = (pageIndex: number) => {
  const canvas = inkRefs.value[pageIndex];
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const pageStrokes = allStrokes.value.filter(s => s.pageIndex === pageIndex);
  pageStrokes.forEach(stroke => drawStroke(ctx, stroke));

  if (dragStartPage.value === pageIndex && currentDragPath.value.length > 0) {
    if (currentMode.value === 'eraser') {
      // 橡皮模式不渲染临时路径，避免出现红色线条
      return;
    } else if (currentMode.value === 'pen' || currentMode.value === 'highlighter') {
      const tempStroke = createStrokeObject(pageIndex, currentDragPath.value, currentMode.value);
      drawStroke(ctx, tempStroke);
    } else if (currentMode.value === 'rectangle' && currentDragRect.value) {
      const { x, y, w, h } = currentDragRect.value;
      const rectStroke = createStrokeObject(pageIndex, [{ x, y }, { x: x + w, y: y + h }], 'rectangle');
      drawStroke(ctx, rectStroke);
    } else {
      const tempStroke = createStrokeObject(pageIndex, currentDragPath.value, currentMode.value);
      drawStroke(ctx, tempStroke);
    }
  }
};

const createStrokeObject = (pageIndex: number, points: Point[], mode: string): Stroke => {
  const isHighlighter = mode === 'highlighter';
  const isRect = mode === 'rectangle';
  const cfg = getToolConfigForMode(mode as ToolMode);
  const width = isHighlighter ? cfg.width : (isRect ? 3 : cfg.width);
  const stroke: Stroke = {
    id: Math.random().toString(36).slice(2),
    type: mode as any,
    pageIndex,
    points: [...points],
    color: isRect ? '#FF0000' : cfg.color,
    width,
    opacity: isRect ? 1.0 : (cfg.opacity ?? 1.0)
  };
  Object.assign(stroke, calculateBBox(stroke.points, stroke.width));
  return stroke;
};

const getInkContext = (pageIndex: number) => {
  const canvas = inkRefs.value[pageIndex];
  if (!canvas) return null;
  return canvas.getContext('2d');
};

let dbSaveTimer: any = null;
const scheduleSaveToDb = (delay = 300) => {
  if (dbSaveTimer) clearTimeout(dbSaveTimer);
  dbSaveTimer = setTimeout(() => {
    dbSaveTimer = null;
    saveDataToDb();
  }, delay);
};

const inkBackupCanvases = new Map<number, HTMLCanvasElement>();
const backupInkCanvas = (pageIndex: number) => {
  const src = inkRefs.value[pageIndex];
  if (!src) return;
  let backup = inkBackupCanvases.get(pageIndex);
  if (!backup) {
    backup = document.createElement('canvas');
    inkBackupCanvases.set(pageIndex, backup);
  }
  if (backup.width !== src.width) backup.width = src.width;
  if (backup.height !== src.height) backup.height = src.height;
  const bctx = backup.getContext('2d');
  if (!bctx) return;
  bctx.clearRect(0, 0, backup.width, backup.height);
  bctx.drawImage(src, 0, 0);
};

const restoreInkCanvasBackup = (pageIndex: number) => {
  const backup = inkBackupCanvases.get(pageIndex);
  const dst = inkRefs.value[pageIndex];
  if (!backup || !dst) return;
  const dctx = dst.getContext('2d');
  if (!dctx) return;
  dctx.clearRect(0, 0, dst.width, dst.height);
  dctx.drawImage(backup, 0, 0);
};

let highlighterRafId: number | null = null;
let highlighterPending: { pageIndex: number; points: Point[] } | null = null;

const scheduleHighlighterPreviewDraw = (pageIndex: number, points: Point[]) => {
  if (!points || points.length === 0) return;
  highlighterPending = { pageIndex, points };
  if (highlighterRafId != null) return;
  highlighterRafId = requestAnimationFrame(() => {
    highlighterRafId = null;
    const p = highlighterPending;
    highlighterPending = null;
    if (!p) return;
    // 先恢复底图，再仅绘制当前荧光笔笔迹（避免重绘整页导致卡顿）
    restoreInkCanvasBackup(p.pageIndex);
    const ctx = getInkContext(p.pageIndex);
    if (!ctx) return;
    const tempStroke = createStrokeObject(p.pageIndex, p.points, 'highlighter');
    drawStroke(ctx, tempStroke);
  });
};

// 增量绘制：参考 public/lsdjf.html，只绘制新增的那一小段，避免每次全量重绘
const drawIncrementalSegmentAt = (pageIndex: number, points: Point[], mode: ToolMode, i: number) => {
  if (mode !== 'pen' && mode !== 'highlighter') return;
  if (points.length < 2) return;
  if (i < 0 || i >= points.length - 1) return;
  const ctx = getInkContext(pageIndex);
  if (!ctx) return;

  const q = renderDprRef.value || 1;

  const cfg = getToolConfigForMode(mode);
  const p1 = points[i];
  const p2 = points[i + 1];

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = cfg.width * q;
  ctx.globalAlpha = cfg.opacity ?? 1.0;
  if (mode === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
  }

  // 这里直接用 *q 的像素坐标绘制，避免 ctx.scale() 带来的额外开销
  if (i === 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x * q, points[0].y * q);
    ctx.lineTo(p2.x * q, p2.y * q);
    ctx.stroke();
  } else {
    const p0 = points[i - 1];
    ctx.beginPath();
    const startX = ((p0.x + p1.x) / 2) * q;
    const startY = ((p0.y + p1.y) / 2) * q;
    const endX = ((p1.x + p2.x) / 2) * q;
    const endY = ((p1.y + p2.y) / 2) * q;
    const cpX = p1.x * q;
    const cpY = p1.y * q;
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.stroke();
  }

  ctx.restore();
};

let inkRafId: number | null = null;
let inkPending: { pageIndex: number; mode: ToolMode; points: Point[]; lastDrawnIndex: number } | null = null;

const scheduleInkIncrementalDraw = (pageIndex: number, points: Point[], mode: ToolMode) => {
  if (mode !== 'pen' && mode !== 'highlighter') return;
  if (points.length < 2) return;

  if (!inkPending || inkPending.pageIndex !== pageIndex || inkPending.mode !== mode) {
    inkPending = { pageIndex, mode, points, lastDrawnIndex: Math.max(0, points.length - 2) };
  } else {
    inkPending.points = points;
  }

  if (inkRafId != null) return;
  inkRafId = requestAnimationFrame(() => {
    inkRafId = null;
    if (!inkPending) return;
    const p = inkPending;
    const maxIdx = p.points.length - 2;
    let i = p.lastDrawnIndex;

    if (i > maxIdx) i = maxIdx;
    for (; i <= maxIdx; i++) {
      drawIncrementalSegmentAt(p.pageIndex, p.points, p.mode, i);
    }

    p.lastDrawnIndex = maxIdx + 1;
  });
};

const drawStartDot = (pageIndex: number, p: Point, mode: ToolMode) => {
  if (mode !== 'pen' && mode !== 'highlighter') return;
  const ctx = getInkContext(pageIndex);
  if (!ctx) return;
  const q = renderDprRef.value || 1;
  const cfg = getToolConfigForMode(mode);
  ctx.save();
  ctx.globalAlpha = cfg.opacity ?? 1.0;
  if (mode === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
  }
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(p.x * q, p.y * q, (cfg.width * q) / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  ctx.save();
  ctx.scale(renderDprRef.value || 1, renderDprRef.value || 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = stroke.opacity;
  
  if (stroke.type === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
  }

  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;

  if (stroke.type === 'rectangle') {
    const [start, end] = stroke.points;
    const w = end.x - start.x;
    const h = end.y - start.y;
    ctx.strokeRect(start.x, start.y, w, h);
  } else {
    const points = stroke.points;
    if (points.length === 1) {
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  }
  ctx.restore();
};

// === 交互逻辑核心 ===

const getPdfPoint = (clientX: number, clientY: number): { pageIndex: number; x: number; y: number } | null => {
  if (!viewportRef.value || pageList.value.length === 0) return null;
  const rect = viewportRef.value.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  
  const localX = (mx - offset.value.x) / scale.value;
  const localY = (my - offset.value.y) / scale.value;

  for (let i = 0; i < pageList.value.length; i++) {
    const p = pageList.value[i];
    const withinY = localY >= p.y && localY <= p.y + p.viewHeight;
    const withinX = localX >= p.x && localX <= p.x + p.viewWidth;
    if (withinY && withinX) {
      return {
        pageIndex: i,
        x: localX - p.x,
        y: localY - p.y
      };
    }
  }
  return null;
};

const handlePointerMoveForEraserCursor = (e: PointerEvent) => {
  if (!viewportRef.value || currentMode.value !== 'eraser') {
    eraserCursor.value.visible = false;
    return;
  }
  const rect = viewportRef.value.getBoundingClientRect();
  const size = getEraserCursorSize();
  eraserCursor.value = {
    visible: true,
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    size
  };
};

const onPointerDown = (e: PointerEvent) => {
  if (viewportRef.value) viewportRef.value.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stopInertia();

  if (activePointers.size === 1) {
    lastPointerPos = { x: e.clientX, y: e.clientY };
    const loc = getPdfPoint(e.clientX, e.clientY);

    handlePointerMoveForEraserCursor(e);

    // 非 pan 模式：优先在页面内绘制；若不在页面内，则允许平移
    if (currentMode.value !== 'pan' && !loc) {
      isPanningInDrawMode = true;
      return;
    }

    if (currentMode.value !== 'pan' && loc) {
      isPanningInDrawMode = false;
      dragStartPage.value = loc.pageIndex;
      currentDragPath.value = [{ x: loc.x, y: loc.y }];
      isDrawingStarted.value = false;
      
      if (currentMode.value === 'screenshot') {
        currentDragRect.value = { x: loc.x, y: loc.y, w: 0, h: 0 };
        isDrawingStarted.value = true;
      }
      if (currentMode.value !== 'pen' && currentMode.value !== 'highlighter') {
        renderInkLayer(loc.pageIndex);
      }
    } else {
      isPanningInDrawMode = false;
    }
  } else if (activePointers.size === 2) {
    finishDrawing(false); 
    const pts = Array.from(activePointers.values());
    lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    lastPinchCenter = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  }
};

const onPointerMove = (e: PointerEvent) => {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activePointers.size === 1) {
    if (currentMode.value === 'pan') {
      const dx = e.clientX - lastPointerPos.x;
      const dy = e.clientY - lastPointerPos.y;
      offset.value.x += dx;
      offset.value.y += dy;
      velocity = { x: dx, y: dy };
      lastPointerPos = { x: e.clientX, y: e.clientY };
      clampOffset();
    } else if (isPanningInDrawMode) {
      const dx = e.clientX - lastPointerPos.x;
      const dy = e.clientY - lastPointerPos.y;
      offset.value.x += dx;
      offset.value.y += dy;
      velocity = { x: dx, y: dy };
      lastPointerPos = { x: e.clientX, y: e.clientY };
      clampOffset();
    } else if (dragStartPage.value !== -1) {
      const loc = getPdfPoint(e.clientX, e.clientY);
      handlePointerMoveForEraserCursor(e);
      if (loc && loc.pageIndex === dragStartPage.value) {
        if (currentMode.value === 'screenshot') {
          const start = currentDragPath.value[0];
          currentDragRect.value = {
            x: Math.min(start.x, loc.x),
            y: Math.min(start.y, loc.y),
            w: Math.abs(loc.x - start.x),
            h: Math.abs(loc.y - start.y)
          };
        } else if (currentMode.value === 'eraser') {
          currentDragPath.value.push({ x: loc.x, y: loc.y });
          performEraserCheck(dragStartPage.value, loc.x, loc.y);
          renderInkLayer(dragStartPage.value);
        } else if (currentMode.value === 'pen') {
          const start = currentDragPath.value[0];
          const dist = Math.hypot(loc.x - start.x, loc.y - start.y);
          if (!isDrawingStarted.value && dist <= DRAW_THRESHOLD) return;
          if (!isDrawingStarted.value) {
            isDrawingStarted.value = true;
            backupInkCanvas(dragStartPage.value);
            drawStartDot(dragStartPage.value, start, currentMode.value);
          }
          currentDragPath.value.push({ x: loc.x, y: loc.y });
          scheduleInkIncrementalDraw(dragStartPage.value, currentDragPath.value, currentMode.value);
        } else if (currentMode.value === 'highlighter') {
          const start = currentDragPath.value[0];
          const dist = Math.hypot(loc.x - start.x, loc.y - start.y);
          if (!isDrawingStarted.value && dist <= DRAW_THRESHOLD) return;
          if (!isDrawingStarted.value) {
            isDrawingStarted.value = true;
            backupInkCanvas(dragStartPage.value);
            drawStartDot(dragStartPage.value, start, currentMode.value);
          }
          currentDragPath.value.push({ x: loc.x, y: loc.y });
          scheduleHighlighterPreviewDraw(dragStartPage.value, currentDragPath.value);
        } else {
          currentDragPath.value.push({ x: loc.x, y: loc.y });
          renderInkLayer(dragStartPage.value);
        }
      }
    }
  } else if (activePointers.size === 2) {
    handlePinch();
  }
};

const onPointerUp = (e: PointerEvent) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size === 0) {
    if (currentMode.value === 'pan' || isPanningInDrawMode) {
      startInertia();
      // 在平移结束后也保存视图状态
      scheduleSaveToDb(600);
      isPanningInDrawMode = false;
    } else {
      finishDrawing(true);
    }
  } else {
    const pt = activePointers.values().next().value;
    if (pt) lastPointerPos = { x: pt.x, y: pt.y };
  }
  if (activePointers.size === 0) {
    eraserCursor.value.visible = false;
  }
};

const finishDrawing = (save: boolean) => {
  if (dragStartPage.value === -1) return;

  const pageIdx = dragStartPage.value;
  const path = currentDragPath.value;
  const started = isDrawingStarted.value;
  let hasChanges = false;

  if (save && currentMode.value === 'screenshot' && currentDragRect.value) {
    takeScreenshot(pageIdx, currentDragRect.value);
  } else if (save) {
    if (isDrawingStarted.value && path.length > 1) {
      if (currentMode.value !== 'eraser') {
        let newStroke: Stroke;
        if (currentMode.value === 'rectangle') {
          const start = path[0];
          const end = path[path.length - 1];
          newStroke = createStrokeObject(pageIdx, [start, end], 'rectangle');
        } else {
          newStroke = createStrokeObject(pageIdx, path, currentMode.value);
        }
        allStrokes.value = [...allStrokes.value, newStroke];
        addToSpatialIndex(newStroke);
        pushHistory('add', [newStroke]);
        hasChanges = true;
      }
    } else if (!isDrawingStarted.value && path.length > 0 && currentMode.value !== 'eraser' && currentMode.value !== 'rectangle' && currentMode.value !== 'screenshot') {
      const dotStroke = createStrokeObject(pageIdx, [path[0]], currentMode.value);
      backupInkCanvas(pageIdx);
      drawStartDot(pageIdx, path[0], currentMode.value);
      allStrokes.value = [...allStrokes.value, dotStroke];
      addToSpatialIndex(dotStroke);
      pushHistory('add', [dotStroke]);
      hasChanges = true;
    }
  }

  if (pageIdx !== -1) {
    if (!save && started && (currentMode.value === 'pen' || currentMode.value === 'highlighter')) {
      restoreInkCanvasBackup(pageIdx);
    } else if (currentMode.value !== 'pen' && currentMode.value !== 'highlighter') {
      renderInkLayer(pageIdx);
    }
  }

  dragStartPage.value = -1;
  currentDragPath.value = [];
  currentDragRect.value = null;
  isDrawingStarted.value = false;
  
  // 保存到 DB
  if (hasChanges) scheduleSaveToDb(600);

  if (pageIdx !== -1 && currentMode.value === 'highlighter') {
    if (highlighterRafId != null) cancelAnimationFrame(highlighterRafId);
    highlighterRafId = null;
    highlighterPending = null;
    if (save) renderInkLayer(pageIdx);
  }
};

const distancePointToSegment = (px: number, py: number, ax: Point, bx: Point) => {
  const dx = bx.x - ax.x;
  const dy = bx.y - ax.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax.x, py - ax.y);
  let t = ((px - ax.x) * dx + (py - ax.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax.x + t * dx;
  const projY = ax.y + t * dy;
  return Math.hypot(px - projX, py - projY);
};

// 橡皮擦：使用空间网格 + 包围盒预判，减少全量遍历
const performEraserCheck = (pageIndex: number, x: number, y: number) => {
  const eraserSize = pdfViewerStore.drawingConfig.eraserSize;
  const searchRadius = eraserSize;

  const minGridX = Math.floor((x - searchRadius) / GRID_SIZE);
  const maxGridX = Math.floor((x + searchRadius) / GRID_SIZE);
  const minGridY = Math.floor((y - searchRadius) / GRID_SIZE);
  const maxGridY = Math.floor((y + searchRadius) / GRID_SIZE);

  const candidates = new Set<Stroke>();
  for (let gx = minGridX; gx <= maxGridX; gx++) {
    for (let gy = minGridY; gy <= maxGridY; gy++) {
      const key = `${pageIndex}|${gx}|${gy}`;
      const cell = spatialGrid.get(key);
      if (cell) cell.forEach(s => candidates.add(s));
    }
  }

  if (candidates.size === 0) return;

  const removed: Stroke[] = [];
  const idsToRemove = new Set<string>();
  const threshold = eraserSize;

  candidates.forEach(stroke => {
    if (stroke.pageIndex !== pageIndex) return;
    if (stroke.type === 'rectangle') return;

    // 包围盒快速拒绝
    if (
      x + threshold < (stroke.minX ?? 0) ||
      x - threshold > (stroke.maxX ?? 0) ||
      y + threshold < (stroke.minY ?? 0) ||
      y - threshold > (stroke.maxY ?? 0)
    ) {
      return;
    }

    const thr = Math.max(threshold, (stroke.width ?? 2) / 2 + 6);
    const thrSq = thr * thr;
    const pts = stroke.points;
    let hit = false;

    if (pts.length === 1) {
      hit = Math.hypot(pts[0].x - x, pts[0].y - y) < thr;
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const dist = distancePointToSegment(x, y, pts[i], pts[i + 1]);
        if (dist * dist < thrSq) {
          hit = true;
          break;
        }
      }
    }

    if (hit) {
      idsToRemove.add(stroke.id);
      removed.push(stroke);
    }
  });

  if (removed.length > 0) {
    removed.forEach(s => removeFromSpatialIndex(s));
    allStrokes.value = allStrokes.value.filter(s => !idsToRemove.has(s.id));
    pushHistory('remove', removed);
    scheduleSaveToDb(600);
  }
};

const takeScreenshot = (pageIndex: number, rect: { x: number, y: number, w: number, h: number }) => {
  if (rect.w < 5 || rect.h < 5) return;
  const pdfCanvas = pdfRefs.value[pageIndex];
  const inkCanvas = inkRefs.value[pageIndex];
  if (!pdfCanvas || !inkCanvas) return;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = rect.w * RENDER_QUALITY;
  tempCanvas.height = rect.h * RENDER_QUALITY;
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) return;

  const sx = rect.x * RENDER_QUALITY;
  const sy = rect.y * RENDER_QUALITY;
  const sw = rect.w * RENDER_QUALITY;
  const sh = rect.h * RENDER_QUALITY;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  ctx.drawImage(pdfCanvas, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height);
  ctx.drawImage(inkCanvas, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height);

  tempCanvas.toBlob(blob => {
    if (blob) emit('screenshot-captured', blob);
  }, 'image/jpeg', 0.95);
};

const pushHistory = (type: 'add' | 'remove', strokes: Stroke[]) => {
  undoStack.value.push({ type, strokes });
  redoStack.value = [];
};

const undo = () => {
  const action = undoStack.value.pop();
  if (!action) return;

  if (action.type === 'add') {
    const ids = new Set(action.strokes.map(s => s.id));
    action.strokes.forEach(s => removeFromSpatialIndex(s));
    allStrokes.value = allStrokes.value.filter(s => !ids.has(s.id));
  } else {
    action.strokes.forEach(s => addToSpatialIndex(s));
    allStrokes.value = [...allStrokes.value, ...action.strokes];
  }
  
  redoStack.value.push(action);
  const pages = new Set(action.strokes.map(s => s.pageIndex));
  pages.forEach(p => renderInkLayer(p));
  scheduleSaveToDb(400);
};

const redo = () => {
  const action = redoStack.value.pop();
  if (!action) return;

  if (action.type === 'add') {
    action.strokes.forEach(s => addToSpatialIndex(s));
    allStrokes.value = [...allStrokes.value, ...action.strokes];
  } else {
    const ids = new Set(action.strokes.map(s => s.id));
    action.strokes.forEach(s => removeFromSpatialIndex(s));
    allStrokes.value = allStrokes.value.filter(s => !ids.has(s.id));
  }

  undoStack.value.push(action);
  const pages = new Set(action.strokes.map(s => s.pageIndex));
  pages.forEach(p => renderInkLayer(p));
  scheduleSaveToDb(400);
};

// === 视口操作 ===

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    zoomAt(-e.deltaY, e.clientX, e.clientY);
  } else {
    offset.value.x -= e.deltaX;
    offset.value.y -= e.deltaY;
    clampOffset();
  }
  // 滚动/缩放停止后保存视图（这里做个简单的防抖保存）
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => scheduleSaveToDb(0), 1000);
};

let saveTimer: any = null;

const handlePinch = () => {
  const pts = Array.from(activePointers.values());
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  const centerX = (pts[0].x + pts[1].x) / 2;
  const centerY = (pts[0].y + pts[1].y) / 2;

  if (lastPinchDist > 0) {
    const ratio = dist / lastPinchDist;
    const newScale = Math.min(Math.max(scale.value * ratio, 0.1), 5.0);
    const actualRatio = newScale / scale.value;

    const dx = centerX - lastPinchCenter.x;
    const dy = centerY - lastPinchCenter.y;
    offset.value.x += dx;
    offset.value.y += dy;
    offset.value.x = centerX - (centerX - offset.value.x) * actualRatio;
    offset.value.y = centerY - (centerY - offset.value.y) * actualRatio;
    scale.value = newScale;
    clampOffset();
  }
  lastPinchDist = dist;
  lastPinchCenter = { x: centerX, y: centerY };
};

const zoomAt = (delta: number, clientX: number, clientY: number) => {
  const factor = Math.pow(1.1, delta / 100);
  const newScale = Math.min(Math.max(scale.value * factor, 0.1), 5.0);
  if (!viewportRef.value) return;
  const rect = viewportRef.value.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  const ratio = newScale / scale.value;
  offset.value.x = mouseX - (mouseX - offset.value.x) * ratio;
  offset.value.y = mouseY - (mouseY - offset.value.y) * ratio;
  scale.value = newScale;
  clampOffset();
};

const startInertia = () => {
  if (Math.abs(velocity.x) > 0.5 || Math.abs(velocity.y) > 0.5) {
    const step = () => {
      if (Math.abs(velocity.x) < 0.1 && Math.abs(velocity.y) < 0.1) {
        velocity = { x: 0, y: 0 };
        scheduleSaveToDb(600); // 惯性停止后保存
        return;
      }
      offset.value.x += velocity.x;
      offset.value.y += velocity.y;
      velocity.x *= FRICTION;
      velocity.y *= FRICTION;
      clampOffset();
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }
};

const stopInertia = () => {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  velocity = { x: 0, y: 0 };
};

const clampOffset = () => {
  if (!viewportRef.value || pageList.value.length === 0) return;
  const vpRect = viewportRef.value.getBoundingClientRect();
  const lastPage = pageList.value[pageList.value.length - 1];
  const contentH = (lastPage.y + lastPage.viewHeight + PAGE_GAP) * scale.value;
  const maxW = Math.max(...pageList.value.map(p => p.viewWidth));
  const contentW = maxW * scale.value;
  const padding = 100;

  let x = offset.value.x;
  let y = offset.value.y;

  if (contentW < vpRect.width) {
    if (x > vpRect.width - padding) x = vpRect.width - padding;
    if (x + contentW < padding) x = padding - contentW;
  } else {
    if (x > padding) x = padding;
    if (x + contentW < vpRect.width - padding) x = vpRect.width - padding - contentW;
  }

  if (y > padding) y = padding;
  if (y + contentH < vpRect.height - padding) y = vpRect.height - padding - contentH;

  offset.value = { x, y };
};

const centerContent = () => {
  if (!viewportRef.value || pageList.value.length === 0) return;
  const rect = viewportRef.value.getBoundingClientRect();
  if (rect.width === 0) return; 
  
  const maxW = Math.max(...pageList.value.map(p => p.viewWidth));
  offset.value = {
    x: (rect.width - maxW * scale.value) / 2,
    y: 20
  };
};

const resetView = () => {
  scale.value = 1.0;
  centerContent();
  scheduleSaveToDb(600);
};

const getRectStyle = (rect: { x: number, y: number, w: number, h: number }) => ({
  left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px'
});

watch(() => props.file, (f) => f && loadFile(f), { immediate: true });

onMounted(() => {
  setupResizeObserver();
});

onUnmounted(() => {
  stopInertia();
  if (resizeObserver) resizeObserver.disconnect();
  if (inkRafId != null) cancelAnimationFrame(inkRafId);
  inkRafId = null;
});

const toggleGestureMode = () => { currentMode.value = 'pan'; };
const toggleHighlightMode = () => { currentMode.value = 'highlighter'; };
const togglePenMode = () => { currentMode.value = 'pen'; };
const toggleEraserMode = () => { currentMode.value = 'eraser'; };
const toggleScreenshotMode = () => { currentMode.value = 'screenshot'; };
const toggleNoteMode = () => { currentMode.value = 'pen'; };
const undoLastStroke = () => undo();
const redoLastStroke = () => redo();

defineExpose({
  toggleGestureMode,
  toggleHighlightMode,
  togglePenMode,
  toggleEraserMode,
  toggleScreenshotMode,
  toggleNoteMode,
  undoLastStroke,
  redoLastStroke,
});
</script>

<style scoped>
.pdf-reader-container {
  display: flex; flex-direction: column; width: 100%; height: 100%;
  flex: 1;
  overflow: hidden; 
}

.viewport {
  flex: 1; 
  min-height: 1px;
  position: relative; overflow: hidden; touch-action: none; cursor: crosshair;
}
.viewport:active { cursor: grabbing; }

.canvas-container {
  position: absolute; transform-origin: 0 0;
  will-change: transform;
}

.page-wrapper {
  position: absolute; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  box-sizing: content-box;
}

canvas { display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.ink-canvas { z-index: 5; pointer-events: none; }

.screenshot-overlay {
  position: absolute; border: 2px dashed #1890ff; background: rgba(24, 144, 255, 0.2);
  z-index: 10; pointer-events: none;
}

.loading-overlay {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.7); color: white; padding: 16px 24px; border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.eraser-cursor {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.4);
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 30;
  transform: translate(-50%, -50%);
}

.waiting-overlay {
  position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
  color: #999; font-size: 12px; z-index: 90;
}

.spinner {
  width: 24px; height: 24px; border: 3px solid #fff; border-top-color: transparent;
  border-radius: 50%; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

</style>