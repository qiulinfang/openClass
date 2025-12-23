<template>
  <div class="pdf-reader-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="tool-group left">
        <div class="file-info" v-if="fileName">
          <strong>{{ fileName }}</strong>
          <span class="page-badge">{{ pageCount }}页</span>
        </div>
        <div class="no-file" v-else>未加载文件</div>
      </div>

      <div class="tool-group center">
        <button 
          v-for="t in tools" 
          :key="t.mode"
          :class="{ active: currentMode === t.mode }"
          @click="setMode(t.mode)"
          :title="t.label"
        >
          {{ t.icon }}
        </button>
        <div class="divider"></div>
        <button @click="undo" :disabled="undoStack.length === 0" title="撤销">↩</button>
        <button @click="redo" :disabled="redoStack.length === 0" title="重做">↪</button>
      </div>

      <div class="tool-group right">
        <button @click="resetView">重置视图</button>
      </div>
    </div>

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
        <!-- 优化：容器尺寸直接绑定数据，在渲染前撑开高度 -->
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
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
        <span>正在解析 PDF 结构...</span>
      </div>
      <div v-else-if="!isVisible && pageCount > 0" class="waiting-overlay">
        <span>等待视图容器就绪...</span>
      </div>
      <div v-else-if="isRendering" class="loading-overlay">
        <div class="spinner"></div>
        <span>正在渲染页面...</span>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <span>缩放: {{ (scale * 100).toFixed(0) }}%</span>
      <span>模式: {{ currentModeLabel }}</span>
      <span>尺寸: {{ contentSize.width.toFixed(0) }}x{{ contentSize.height.toFixed(0) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, toRaw, nextTick, watch, onUnmounted } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
// 确保使用 ?url 形式引入 worker 以兼容 Vite
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker?url';

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
}

interface HistoryAction {
  type: 'add' | 'remove';
  strokes: Stroke[];
}

// === Props ===
const props = defineProps<{
  file: File | null;
}>();

const emit = defineEmits<{
  (e: 'screenshot-captured', blob: Blob): void;
}>();

// === 配置常量 ===
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;
const RENDER_QUALITY = 3.0; 
const PAGE_GAP = 20;
const FRICTION = 0.92;

// === 状态管理 ===
const pdfDoc = shallowRef<pdfjsLib.PDFDocumentProxy | null>(null);
const fileName = ref('');
const pageCount = ref(0);
// 核心 Store：存储所有页面的布局信息
const pageList = ref<Array<{ viewWidth: number; viewHeight: number; x: number; y: number }>>([]);
const scale = ref(1.0);
const offset = ref({ x: 0, y: 0 });
const loading = ref(false);     // 解析 PDF 结构中
const isRendering = ref(false); // Canvas 渲染中
const isVisible = ref(false);   // 容器是否可见（Splitter 兼容）
const hasRendered = ref(false); // 是否已完成初次渲染
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

// 数据存储
const allStrokes = ref<Stroke[]>([]);
const undoStack = ref<HistoryAction[]>([]);
const redoStack = ref<HistoryAction[]>([]);

// 交互临时状态
const dragStartPage = ref<number>(-1);
const currentDragPath = ref<Point[]>([]);
const currentDragRect = ref<{ x: number, y: number, w: number, h: number } | null>(null);

// DOM 引用
const viewportRef = ref<HTMLDivElement | null>(null);
const pdfRefs = ref<HTMLCanvasElement[]>([]);
const inkRefs = ref<HTMLCanvasElement[]>([]);
let resizeObserver: ResizeObserver | null = null;

// 手势控制
const activePointers = new Map<number, Point>();
let lastPointerPos = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let rafId: number | null = null;
let lastPinchDist = 0;
let lastPinchCenter = { x: 0, y: 0 };

// 工具定义
const tools: { mode: ToolMode; label: string; icon: string }[] = [
  { mode: 'pan', label: '抓手', icon: '✋' },
  { mode: 'pen', label: '画笔', icon: '✏️' },
  { mode: 'highlighter', label: '高亮', icon: '🖍️' },
  { mode: 'rectangle', label: '矩形', icon: '⬜' },
  { mode: 'eraser', label: '橡皮擦', icon: '🧹' },
  { mode: 'screenshot', label: '截图', icon: '📷' },
];

const containerStyle = computed(() => ({
  width: `${contentSize.value.width}px`,
  height: `${contentSize.value.height}px`,
  transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`
}));

// === 核心逻辑优化：加载与渲染分离 ===

const loadFile = async (file: File) => {
  loading.value = true;
  resetState();
  fileName.value = file.name;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
    pdfDoc.value = doc;
    pageCount.value = doc.numPages;
    
    // 1. 预取尺寸：立即计算所有页面的布局，撑开容器
    await prefetchDimensionsAndLayout(doc);
    
    // 2. 尝试渲染：只有当容器可见时才开始渲染
    tryRenderContent();
    
    centerContent();
  } catch (err) {
    console.error('PDF Load Error:', err);
  } finally {
    loading.value = false;
  }
};

const prefetchDimensionsAndLayout = async (doc: pdfjsLib.PDFDocumentProxy) => {
  const promises = [];
  // 并行获取所有页面的视口信息（不渲染，只计算）
  for (let i = 1; i <= doc.numPages; i++) {
    promises.push(doc.getPage(i).then(page => {
      const vp = page.getViewport({ scale: 1.0 });
      return { width: vp.width, height: vp.height, pageIndex: i };
    }));
  }

  const sizes = await Promise.all(promises);
  // 确保按页码排序
  sizes.sort((a, b) => a.pageIndex - b.pageIndex);

  let currentY = PAGE_GAP;
  let maxW = 0;
  const list = [];

  for (const size of sizes) {
    if (size.width > maxW) maxW = size.width;
    list.push({
      viewWidth: size.width,
      viewHeight: size.height,
      x: 0, // 稍后计算
      y: currentY
    });
    currentY += size.height + PAGE_GAP;
  }

  // 计算 X 轴居中
  list.forEach(p => p.x = (maxW - p.viewWidth) / 2);

  // 立即更新 Store，触发 DOM 布局更新
  pageList.value = list;
  contentSize.value = { width: maxW, height: currentY };
};

// 尝试渲染内容 (带可见性检查)
const tryRenderContent = async () => {
  // 条件：容器可见 + 有数据 + 尚未渲染
  if (isVisible.value && pageList.value.length > 0 && !hasRendered.value && !loading.value) {
    await renderPdfPages();
    hasRendered.value = true;
  }
};

// 使用 ResizeObserver 监听容器尺寸
const setupResizeObserver = () => {
  if (!viewportRef.value) return;

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      // Splitter 动画期间可能出现 width/height 为 0 的情况
      const isNowVisible = width > 0 && height > 0;
      
      if (isNowVisible !== isVisible.value) {
        isVisible.value = isNowVisible;
        if (isNowVisible) {
          // 容器变为可见，触发渲染
          tryRenderContent();
          // 如果已经渲染过，重新计算边界限制以适应新窗口
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
    // 这里可以进一步优化为只渲染视口内的页面（虚拟列表），目前保持全量渲染
    // 由于 DOM 已经根据 pageList 存在，pdfRefs 应该已经挂载
    const renderPromises = pageList.value.map(async (pageLayout, i) => {
      const page = await rawDoc.getPage(i + 1);
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = pdfRefs.value[i];
      const inkCanvas = inkRefs.value[i];

      if (canvas && inkCanvas) {
        // 设置物理像素
        canvas.width = viewport.width * RENDER_QUALITY;
        canvas.height = viewport.height * RENDER_QUALITY;
        // 强制 CSS 尺寸，虽然父级 wrapper 已设置，但 canvas 自身也需要
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        inkCanvas.width = canvas.width;
        inkCanvas.height = canvas.height;
        inkCanvas.style.width = canvas.style.width;
        inkCanvas.style.height = canvas.style.height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport,
            transform: [RENDER_QUALITY, 0, 0, RENDER_QUALITY, 0, 0]
          }).promise;
        }
      }
    });

    await Promise.all(renderPromises);
  } finally {
    isRendering.value = false;
  }
};

const resetState = () => {
  pdfDoc.value = null;
  pageList.value = [];
  allStrokes.value = [];
  undoStack.value = [];
  redoStack.value = [];
  offset.value = { x: 0, y: 0 };
  scale.value = 1.0;
  contentSize.value = { width: 0, height: 0 };
  hasRendered.value = false;
};

// === 绘图与渲染逻辑 (保持原有逻辑) ===

const renderInkLayer = (pageIndex: number) => {
  const canvas = inkRefs.value[pageIndex];
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const pageStrokes = allStrokes.value.filter(s => s.pageIndex === pageIndex);
  pageStrokes.forEach(stroke => drawStroke(ctx, stroke));

  if (dragStartPage.value === pageIndex && currentDragPath.value.length > 0) {
    if (currentMode.value === 'pen' || currentMode.value === 'highlighter') {
      const tempStroke = createStrokeObject(pageIndex, currentDragPath.value, currentMode.value);
      drawStroke(ctx, tempStroke);
    } else if (currentMode.value === 'rectangle') {
      const start = currentDragPath.value[0];
      const end = currentDragPath.value[currentDragPath.value.length - 1];
      const rectStroke = createStrokeObject(pageIndex, [start, end], 'rectangle');
      drawStroke(ctx, rectStroke);
    } else if (currentMode.value === 'eraser') {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 1;
      const path = currentDragPath.value;
      if (path.length > 0) {
        ctx.moveTo(path[0].x * RENDER_QUALITY, path[0].y * RENDER_QUALITY);
        for(const p of path) ctx.lineTo(p.x * RENDER_QUALITY, p.y * RENDER_QUALITY);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
};

const createStrokeObject = (pageIndex: number, points: Point[], mode: string): Stroke => {
  const isHighlighter = mode === 'highlighter';
  const isRect = mode === 'rectangle';
  return {
    id: Math.random().toString(36).slice(2),
    type: mode as any,
    pageIndex,
    points: [...points],
    color: isHighlighter ? '#FFFF00' : '#FF0000',
    width: isHighlighter ? 20 : (isRect ? 3 : 2),
    opacity: isHighlighter ? 0.4 : 1.0
  };
};

const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
  ctx.save();
  ctx.scale(RENDER_QUALITY, RENDER_QUALITY);
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
    if (points.length < 2) {
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

// === 交互逻辑核心 (保持原有逻辑) ===

const getPdfPoint = (clientX: number, clientY: number): { pageIndex: number; x: number; y: number } | null => {
  if (!viewportRef.value || pageList.value.length === 0) return null;
  const rect = viewportRef.value.getBoundingClientRect();
  const mx = clientX - rect.left;
  const my = clientY - rect.top;
  
  const localX = (mx - offset.value.x) / scale.value;
  const localY = (my - offset.value.y) / scale.value;

  for (let i = 0; i < pageList.value.length; i++) {
    const p = pageList.value[i];
    if (localY >= p.y && localY <= p.y + p.viewHeight) {
      return {
        pageIndex: i,
        x: localX - p.x,
        y: localY - p.y
      };
    }
  }
  return null;
};

const onPointerDown = (e: PointerEvent) => {
  if (viewportRef.value) viewportRef.value.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  stopInertia();

  if (activePointers.size === 1) {
    lastPointerPos = { x: e.clientX, y: e.clientY };
    const loc = getPdfPoint(e.clientX, e.clientY);
    
    if (currentMode.value !== 'pan' && loc) {
      dragStartPage.value = loc.pageIndex;
      currentDragPath.value = [{ x: loc.x, y: loc.y }];
      
      if (currentMode.value === 'screenshot') {
        currentDragRect.value = { x: loc.x, y: loc.y, w: 0, h: 0 };
      }
      renderInkLayer(loc.pageIndex);
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
    } else if (dragStartPage.value !== -1) {
      const loc = getPdfPoint(e.clientX, e.clientY);
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
    if (currentMode.value === 'pan') {
      startInertia();
    } else {
      finishDrawing(true);
    }
  } else {
    const pt = activePointers.values().next().value;
    if (pt) lastPointerPos = { x: pt.x, y: pt.y };
  }
};

const finishDrawing = (save: boolean) => {
  if (dragStartPage.value === -1) return;

  const pageIdx = dragStartPage.value;
  const path = currentDragPath.value;

  if (save && path.length > 1) {
    if (currentMode.value === 'screenshot' && currentDragRect.value) {
      takeScreenshot(pageIdx, currentDragRect.value);
    } else if (currentMode.value !== 'eraser') {
      let newStroke: Stroke;
      if (currentMode.value === 'rectangle') {
        const start = path[0];
        const end = path[path.length - 1];
        newStroke = createStrokeObject(pageIdx, [start, end], 'rectangle');
      } else {
        newStroke = createStrokeObject(pageIdx, path, currentMode.value);
      }
      allStrokes.value.push(newStroke);
      pushHistory('add', [newStroke]);
    }
  }

  dragStartPage.value = -1;
  currentDragPath.value = [];
  currentDragRect.value = null;
  
  if (pageIdx !== -1) renderInkLayer(pageIdx);
};

// === 功能实现 (橡皮擦/截图/历史) ===

const performEraserCheck = (pageIndex: number, x: number, y: number) => {
  const threshold = 10;
  const removed: Stroke[] = [];
  
  allStrokes.value = allStrokes.value.filter(stroke => {
    if (stroke.pageIndex !== pageIndex) return true;
    let hit = false;
    if (stroke.type === 'rectangle') {
      return true; // 暂不支持擦除矩形
    } else {
      for (const p of stroke.points) {
        if (Math.hypot(p.x - x, p.y - y) < threshold) {
          hit = true;
          break;
        }
      }
    }
    if (hit) removed.push(stroke);
    return !hit;
  });

  if (removed.length > 0) {
    pushHistory('remove', removed);
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
    allStrokes.value = allStrokes.value.filter(s => !ids.has(s.id));
  } else {
    allStrokes.value.push(...action.strokes);
  }
  
  redoStack.value.push(action);
  const pages = new Set(action.strokes.map(s => s.pageIndex));
  pages.forEach(p => renderInkLayer(p));
};

const redo = () => {
  const action = redoStack.value.pop();
  if (!action) return;

  if (action.type === 'add') {
    allStrokes.value.push(...action.strokes);
  } else {
    const ids = new Set(action.strokes.map(s => s.id));
    allStrokes.value = allStrokes.value.filter(s => !ids.has(s.id));
  }

  undoStack.value.push(action);
  const pages = new Set(action.strokes.map(s => s.pageIndex));
  pages.forEach(p => renderInkLayer(p));
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
};

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
  // 简单的边界弹性限制
  const padding = 200;
  if (offset.value.y > padding) offset.value.y = padding;
  if (offset.value.y + contentH < vpRect.height - padding) offset.value.y = vpRect.height - padding - contentH;
};

// 辅助方法
const setMode = (mode: ToolMode) => currentMode.value = mode;
const centerContent = () => {
  if (!viewportRef.value || pageList.value.length === 0) return;
  const rect = viewportRef.value.getBoundingClientRect();
  // Splitter 兼容：如果当前 width 为 0，不居中，等待 Observer 回调
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
});
</script>

<style scoped>
.pdf-reader-container {
  display: flex; flex-direction: column; width: 100%; height: 100%;
  flex: 1;
  background: #eef0f4; user-select: none; font-family: sans-serif;
  overflow: hidden; /* 防止溢出 */
}

.toolbar {
  height: 52px; background: #fff; border-bottom: 1px solid #ddd;
  display: flex; align-items: center; justify-content: space-between; padding: 0 16px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05); z-index: 20;
}
.tool-group { display: flex; align-items: center; gap: 8px; }
.file-info { display: flex; flex-direction: column; font-size: 12px; line-height: 1.2; }
.page-badge { color: #666; background: #f0f0f0; padding: 0 4px; border-radius: 4px; display: inline-block; }
.divider { width: 1px; height: 24px; background: #eee; margin: 0 4px; }

button {
  width: 36px; height: 36px; border: none; background: transparent;
  border-radius: 6px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
button:hover:not(:disabled) { background: #f5f5f5; }
button.active { background: #e6f7ff; color: #1890ff; }
button:disabled { opacity: 0.3; cursor: not-allowed; }

.viewport {
  flex: 1; 
  /* 关键修复：防止高度塌缩 */
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
  /* 确保在 Canvas 渲染前有颜色 */
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
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  z-index: 100;
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

.status-bar {
  height: 28px; background: #fff; border-top: 1px solid #ddd;
  display: flex; justify-content: space-between; align-items: center; padding: 0 12px;
  font-size: 12px; color: #666;
}
</style>