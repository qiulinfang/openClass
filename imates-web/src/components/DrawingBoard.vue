<template>
  <div class="canvas-demo-container" :class="{ 'toolbar-left': props.toolbarPosition === 'left' }">
    <!-- 统一工具栏（根据 toolbarPosition 浮动在顶部或左侧） -->
    <div class="toolbar-wrapper" :class="{ 'toolbar-wrapper-left': props.toolbarPosition === 'left' }">
      <UnifiedToolbar
        :tools="props.drawingBoardTools"
        :selected-tool="currentTool"
        :tool-config="toolConfig"
        :tool-states="{ undo: canUndo, redo: canRedo }"
        :orientation="props.toolbarPosition === 'left' ? 'vertical' : 'horizontal'"
        @tool-change="handleToolChange"
        @config-change="handleConfigChange"
        @undo="undo"
        @redo="redo"
        @clear="clearCanvas"
      >
        <!-- 透传左侧插槽 -->
        <template #left-actions>
          <slot name="toolbar-left" />
        </template>
        <!-- 透传右侧插槽 -->
        <template #right-actions>
          <slot name="toolbar-right" />
        </template>
      </UnifiedToolbar>
    </div>

    <!-- 画布容器（占满整个对话框） -->
    <div
      class="canvas-wrapper"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <canvas ref="historyCanvasRef" class="canvas-container canvas-history" :style="canvasStyle"></canvas>
      <canvas ref="liveCanvasRef" class="canvas-container canvas-live" :style="canvasStyle"></canvas>
      <!-- Signature Pad 画布（覆盖在主画布上，仅在signature模式下显示） -->
      <canvas 
        ref="signaturePadRef" 
        class="signature-pad-canvas" 
        :style="{ 
          ...canvasStyle, 
          display: toolConfig.handwritingStyle === 'signature' && currentTool === 'draw' ? 'block' : 'none',
          pointerEvents: toolConfig.handwritingStyle === 'signature' && currentTool === 'draw' ? 'auto' : 'none'
        }"
      ></canvas>

      <!-- 浮动缩放控制面板 -->
      <div
        v-if="props.showZoomControl"
        class="zoom-control-panel"
        @mousedown.stop
        @mouseup.stop
        @touchstart.stop
        @touchmove.stop
        @touchend.stop
      >
        <q-btn
          flat
          round
          dense
          icon="zoom_out"
          :disable="zoomLevel <= 0.1"
          @click="zoomOut"
          class="zoom-btn"
        >
          <q-tooltip>缩小</q-tooltip>
        </q-btn>

        <div class="zoom-display">{{ Math.round(zoomLevel * 100) }}%</div>

        <q-btn
          flat
          round
          dense
          icon="zoom_in"
          :disable="zoomLevel >= 3"
          @click="zoomIn"
          class="zoom-btn"
        >
          <q-tooltip>放大</q-tooltip>
        </q-btn>

      </div>

    </div>

    <!-- 底部插槽（用于白板页控制等） -->
    <div class="toolbar-bottom-wrapper">
      <slot name="toolbar-bottom" />
      
      <q-btn
        v-if="enableDebugTools"
        flat
        round
        dense
        icon="tune"
        class="pf-config-btn"
        @click.stop="pfConfigDialogVisible = true"
      />
    </div>

    <!-- 清空画布确认对话框 -->
    <Dialog
      ref="clearDialogRef"
      title="清空确认"
      :confirmButtonText="'清空'"
      :cancelButtonText="'取消'"
      @confirm="handleConfirmClear"
    >
      确定要清空当前草稿内容？
    </Dialog>

    <PerfectFreehandConfigDialog
      v-model="pfConfigDialogVisible"
      :pf-config="pfConfig"
      @update:pfConfig="updatePfConfig"
      @reset="resetPfConfig"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import UnifiedToolbar from './UnifiedToolbar.vue'
import Dialog from './base/Dialog.vue'
import PerfectFreehandConfigDialog from './debug/PerfectFreehandConfigDialog.vue'
import SignaturePad from 'signature_pad'
import type { ExerciseItem } from '@/types'
import { getStroke } from 'perfect-freehand'

const enableDebugTools = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

// Props 定义
interface Props {
  backgroundImage?: string // 背景图片（base64 或 URL）
  fitBackground?: boolean  // 是否让画布适应背景图片尺寸
  fillContainer?: boolean  // 兼容旧用法：当 layoutMode 未设置且为 true 时等价于 layoutMode = 'fill'
  layoutMode?: 'fill' | 'doubleHeight' // 画布布局模式：填满容器 or 高画布（容器高*2）
  showZoomControl?: boolean // 是否显示缩放控制面板
  drawingBoardTools?: string[] // 工具栏工具列表
  forcePenColor?: string // 强制画笔颜色（例如截图编辑场景只用红色）
  currentQuestion?: ExerciseItem | null // 当前作答题目
  width?: number // 可选：外部指定画布宽度（优先级最高）
  height?: number // 可选：外部指定画布高度（优先级最高）
  initialZoom?: number // 可选：初始缩放倍数，默认 1
  toolbarPosition?: 'top' | 'left' // 工具栏位置：顶部水平 or 左侧垂直，默认 top
}

const props = withDefaults(defineProps<Props>(), {
  backgroundImage: '',
  fitBackground: true,
  fillContainer: false,
  layoutMode: undefined,
  showZoomControl: true,
  drawingBoardTools: () => [
    'undo',
    'redo',
    'clear',
    'hand',
    'draw',
    'eraser-draw',
    'shape',  // 形状工具（包含矩形、圆、三角形、直线）
  ],
  currentQuestion: null,
  width: undefined,
  height: undefined,
  toolbarPosition: 'top',
})

// 新增：定义对外事件
const emit = defineEmits<{
  // 内容变化事件（用于父组件更新缩略图）
  'content-change': []
}>()

// 背景图片对象
const backgroundImg = ref<HTMLImageElement | null>(null)
const backgroundLoaded = ref(false)

// 布局模式（fill / doubleHeight）下的背景绘制参数
const bgDrawParams = ref<{ scale: number; offsetX: number; offsetY: number } | null>(null)

// 绘图对象类型定义
interface DrawObject {
  type: 'path' | 'rectangle' | 'circle' | 'line' | 'triangle' | 'text'
  color: string
  lineWidth: number
  points?: { x: number; y: number }[]
  pfTaperStart?: boolean
  pfTaperEnd?: boolean
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
  handwritingStyle?: 'signature' | 'normal' // 画笔样式：Signature Pad风格或普通风格
  rawPoints?: { x: number; y: number }[] // 原始点（可选，用于平滑处理）
}

// 对象位置信息类型
interface ObjectPosition {
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
}

// Canvas 引用
const historyCanvasRef = ref<HTMLCanvasElement>()
const liveCanvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let liveCtx: CanvasRenderingContext2D | null = null

// history 层是否需要重绘（objects/background 变化时置为 true）
let historyDirty = true

// ==================== DPR 适配 ====================
const dpr = Math.max(1, window.devicePixelRatio || 1)

const resizeCanvasBackingStore = (canvas: HTMLCanvasElement, cssW: number, cssH: number) => {
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
}

const prepareCtxForLogicalDrawing = (c: CanvasRenderingContext2D) => {
  // 先重置矩阵，再按 DPR 缩放：后续绘制使用逻辑坐标（CSS px）
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
}

// 画布尺寸（如果外部通过 props.width / props.height 指定，则优先使用）
const canvasWidth = ref<number>(props.width ?? 1000)
const canvasHeight = ref<number>(props.height ?? 1000)

// 当前工具
const currentTool = ref('select')

// 工具配置
const toolConfig = ref<{ color?: string; size?: number; handwritingStyle?: 'signature' | 'normal' }>({
  color: '#000000',
  size: 3,
  handwritingStyle: 'normal',
})

const pfConfigDialogVisible = ref(false)

const DEFAULT_PF_CONFIG = {
  size: 3,
  // 默认改为“普通马克笔”：线宽更稳定、无笔锋
  // 更新：默认风格改为“圆珠笔”（线宽稳定 + 轻微顺滑），仍然不需要笔锋
  thinning: 0.15,
  smoothing: 0.65,
  streamline: 0.7,
  taper: 0,
  startTaper: 0,
  endTaper: 0,
  startCap: true,
  endCap: true,
  simulatePressure: false,
  easingName: 'linear',
}

const pfConfig = ref({ ...DEFAULT_PF_CONFIG })

const resetPfConfig = () => {
  pfConfig.value = { ...DEFAULT_PF_CONFIG }
}

const updatePfConfig = (v: typeof pfConfig.value) => {
  pfConfig.value = v
}

// 初始化时如果有强制颜色，覆盖一次
if (props.forcePenColor) {
  toolConfig.value.color = props.forcePenColor
}

// Signature Pad 实例
const signaturePadRef = ref<HTMLCanvasElement>()
let signaturePad: SignaturePad | null = null

// 绘制Signature Pad风格的路径（使用平滑贝塞尔曲线）
const drawSignaturePath = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  lineWidth: number,
  color: string
) => {
  if (points.length < 2) return
  
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  if (points.length === 2) {
    // 只有两个点，直接连线
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[1].x, points[1].y)
    ctx.stroke()
  } else {
    // 使用二次贝塞尔曲线平滑
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]
      
      // 计算控制点（使用中点）
      const cpX = curr.x + (next.x - prev.x) * 0.3
      const cpY = curr.y + (next.y - prev.y) * 0.3
      
      ctx.quadraticCurveTo(cpX, cpY, curr.x, curr.y)
    }
    
    // 连接到最后一个点
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
    ctx.stroke()
  }
  
  ctx.restore()
}

const drawNormalSmoothPath = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
) => {
  if (points.length < 2) return

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y)
    ctx.stroke()
    return
  }

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const next = points[i + 1]
    const midX = (p.x + next.x) / 2
    const midY = (p.y + next.y) / 2
    ctx.quadraticCurveTo(p.x, p.y, midX, midY)
  }

  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

const drawNormalVariableWidthPath = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  baseWidth: number,
) => {
  if (points.length < 2) return

  const chaikin = (pts: { x: number; y: number }[], iterations: number) => {
    if (pts.length < 3 || iterations <= 0) return pts
    let cur = pts
    for (let it = 0; it < iterations; it++) {
      const next: { x: number; y: number }[] = [cur[0]]
      for (let i = 0; i < cur.length - 1; i++) {
        const p0 = cur[i]
        const p1 = cur[i + 1]
        next.push({
          x: p0.x * 0.75 + p1.x * 0.25,
          y: p0.y * 0.75 + p1.y * 0.25,
        })
        next.push({
          x: p0.x * 0.25 + p1.x * 0.75,
          y: p0.y * 0.25 + p1.y * 0.75,
        })
      }
      next.push(cur[cur.length - 1])
      cur = next
      if (cur.length > 600) break
    }
    return cur
  }

  const smoothIterations = points.length > 8 ? 1 : 0
  const drawPoints = smoothIterations ? chaikin(points, smoothIterations) : points

  // 速度（相邻点距离）越大线越细；越小越粗。纯函数、确定性。
  const minW = Math.max(0.6, baseWidth * 0.55)
  const maxW = Math.max(minW, baseWidth * 1.25)

  const widthFromDist = (dist: number) => {
    const t = clamp(dist / 10, 0, 1)
    return maxW - (maxW - minW) * t
  }

  // 用“分段 stroke”实现可变线宽：视觉上更像笔锋，成本也可控。
  for (let i = 1; i < drawPoints.length; i++) {
    const p0 = drawPoints[i - 1]
    const p1 = drawPoints[i]
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const w = widthFromDist(dist)

    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.stroke()
  }
}

const drawNormalFilledStroke = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  baseWidth: number,
  mode: 'live' | 'final' = 'live',
  taperStart = true,
  taperEnd = true,
) => {
  if (points.length === 0) return

  // perfect-freehand 期望 points = [x, y, pressure?]，pressure 可选
  const pfPoints: Array<[number, number, number?]> = points.map((p) => [p.x, p.y])

  const cfg = pfConfig.value
  // 关键：为了避免“分段固化”时段与段之间出现缝隙，live/final 必须使用一致的 PF 参数。
  // size 使用倍率：pfConfig.size 相对于默认 size 的比例，乘到 baseWidth 上。
  const sizeScale = DEFAULT_PF_CONFIG.size > 0 ? cfg.size / DEFAULT_PF_CONFIG.size : 1
  const size = Math.max(1, baseWidth * sizeScale)
  const thinning = cfg.thinning
  const smoothing = cfg.smoothing
  const streamline = cfg.streamline
  const taper = cfg.taper

  const easing =
    cfg.easingName === 'easeInOut'
      ? (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
      : cfg.easingName === 'easeOut'
        ? (t: number) => 1 - Math.pow(1 - t, 2)
        : cfg.easingName === 'easeIn'
          ? (t: number) => t * t
          : (t: number) => t

  const startTaper = taperStart ? taper : 0
  const endTaper = taperEnd ? taper : 0
  const startCap = cfg.startCap && startTaper > 0
  const endCap = cfg.endCap && endTaper > 0

  const startTaper2 = taperStart ? Math.max(0, cfg.startTaper) : 0
  const endTaper2 = taperEnd ? Math.max(0, cfg.endTaper) : 0
  const startCap2 = cfg.startCap && (startTaper2 > 0 || startCap)
  const endCap2 = cfg.endCap && (endTaper2 > 0 || endCap)

  // 单点（点击/极短移动）也要有可见笔迹：用圆点兜底
  // 这样不会依赖 addDrawPointIfFarEnough 的距离阈值。
  if (pfPoints.length === 1) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(pfPoints[0][0], pfPoints[0][1], size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  const stroke = getStroke(pfPoints, {
    size,
    thinning,
    smoothing,
    streamline,
    easing,
    simulatePressure: cfg.simulatePressure,
    start: { taper: startTaper2, cap: startCap2 },
    end: { taper: endTaper2, cap: endCap2 },
  })

  if (!stroke || stroke.length === 0) return

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(stroke[0][0], stroke[0][1])
  for (let i = 1; i < stroke.length; i++) {
    ctx.lineTo(stroke[i][0], stroke[i][1])
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const distPointToSegment = (
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) => {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y

  const ab2 = abx * abx + aby * aby
  if (ab2 === 0) {
    return Math.sqrt(apx * apx + apy * apy)
  }
  const t = clamp((apx * abx + apy * aby) / ab2, 0, 1)
  const cx = a.x + abx * t
  const cy = a.y + aby * t
  const dx = p.x - cx
  const dy = p.y - cy
  return Math.sqrt(dx * dx + dy * dy)
}

const isPointNearPath = (
  p: { x: number; y: number },
  points: { x: number; y: number }[],
  tolerance: number,
) => {
  if (!points || points.length < 2) return false
  for (let i = 1; i < points.length; i++) {
    const d = distPointToSegment(p, points[i - 1], points[i])
    if (d <= tolerance) return true
  }
  return false
}

// ==================== 绘制对象管理 ====================
// 绘制对象列表
const objects = ref<DrawObject[]>([])

// 历史记录
const history = ref<DrawObject[][]>([[]])
const historyIndex = ref(0)

// 计算是否可以撤销/重做
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// 当前绘制状态
const isDrawing = ref(false)
const currentPath = ref<{ x: number; y: number }[]>([])
const strokeHasFlushedChunks = ref(false)
const startPoint = ref<{ x: number; y: number } | null>(null)
const tempObject = ref<DrawObject | null>(null)

// 橡皮擦悬停对象
const hoveredObject = ref<number | null>(null)

// 对象选择相关
const selectedObjects = ref<Set<number>>(new Set())
const selectionBox = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const isDraggingObjects = ref(false)
const dragStartPoint = ref<{ x: number; y: number } | null>(null)
const objectsOriginalPositions = ref<Map<number, ObjectPosition>>(new Map())

// 缩放状态（支持通过 props.initialZoom 设置初始缩放倍数）
const zoomLevel = ref(props.initialZoom ?? 1)

// 画布偏移（手型工具拖动）
const canvasOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStartPoint = ref<{ x: number; y: number } | null>(null)
const panStartOffset = ref({ x: 0, y: 0 })

// 双指触摸状态
const initialTouchDistance = ref(0)
const initialTouchScale = ref(1)
const initialTouchCenterX = ref(0)
const initialTouchCenterY = ref(0)
const initialTouchTranslateX = ref(0)
const initialTouchTranslateY = ref(0)
const isTwoFingerGesture = ref(false)
const pendingSingleTouch = ref(false)
const pendingTouchX = ref(0)
const pendingTouchY = ref(0)
const gestureStartDistance = ref(0)
const gestureStartCenterX = ref(0)
const gestureStartCenterY = ref(0)
let singleTouchTimer: number | null = null

// ==================== 普通画笔采样与平滑参数 ====================

// 普通 draw 模式下，相邻采样点的最小距离平方（画布坐标系）
// 注意：这里的点坐标已经是 world 坐标（逻辑坐标），不是 backing store 像素。
// 采样策略：
// - 慢速更密（更顺滑）
// - 快速更稀（更省性能）
// - 距离过大时插点，避免断线
const MIN_DRAW_POINT_DIST = 0.6
// 降低高速场景的“稀疏采样”强度，避免快速画圆出现锯齿
const MAX_DRAW_POINT_DIST = 1.4
// 距离过大时更积极插点，避免弧线段过长
const MAX_DRAW_SEGMENT_LEN = 4

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// 实时绘制时单笔过长会导致每帧轮廓重算越来越慢（掉帧->丢点->锯齿加剧）。
// 这里做“分段固化”：超过阈值就把前段追加到 objects，currentPath 只保留尾部继续。
const LIVE_STROKE_CHUNK_POINTS = 220
const LIVE_STROKE_CHUNK_OVERLAP_POINTS = 8

// 在现有路径上追加一个点：仅当与上一个点距离足够远时才追加
const addDrawPointIfFarEnough = (
  path: { x: number; y: number }[],
  point: { x: number; y: number },
) => {
  if (path.length === 0) {
    path.push(point)
    return
  }
  const last = path[path.length - 1]
  const dx = point.x - last.x
  const dy = point.y - last.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // 自适应阈值：速度越快（dist 越大）采样越稀
  const t = clamp(dist / 18, 0, 1)
  const minDist = MIN_DRAW_POINT_DIST + (MAX_DRAW_POINT_DIST - MIN_DRAW_POINT_DIST) * t

  // 距离很大：插点补线，避免断线
  if (dist > MAX_DRAW_SEGMENT_LEN) {
    const steps = Math.ceil(dist / MAX_DRAW_SEGMENT_LEN)
    for (let i = 1; i <= steps; i++) {
      const k = i / steps
      const p = {
        x: last.x + dx * k,
        y: last.y + dy * k,
      }
      path.push(p)
    }
    return
  }

  if (dist >= minDist) {
    path.push(point)
  }
}

// 对路径点做简单的细分 + 三点移动平均平滑，仅用于普通画笔落笔后的最终形状
const smoothDrawPoints = (points: { x: number; y: number }[]): { x: number; y: number }[] => {
  if (points.length <= 2) return points

  const subdivided: { x: number; y: number }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    subdivided.push(p0)
    // 在相邻点之间插入中点，增加采样密度
    subdivided.push({
      x: (p0.x + p1.x) / 2,
      y: (p0.y + p1.y) / 2,
    })
  }
  subdivided.push(points[points.length - 1])

  if (subdivided.length <= 2) return subdivided

  const smoothed: { x: number; y: number }[] = []
  smoothed.push(subdivided[0])
  for (let i = 1; i < subdivided.length - 1; i++) {
    const pPrev = subdivided[i - 1]
    const p = subdivided[i]
    const pNext = subdivided[i + 1]
    smoothed.push({
      x: (pPrev.x + p.x + pNext.x) / 3,
      y: (pPrev.y + p.y + pNext.y) / 3,
    })
  }
  smoothed.push(subdivided[subdivided.length - 1])

  return smoothed
}

// 画布样式（居中 + translate + scale）
const canvasStyle = computed(() => {
  return {
    width: `${canvasWidth.value}px`,
    height: `${canvasHeight.value}px`,
    // 仅做居中，缩放/平移由 viewport（ctx transform）完成，避免 CSS scale 导致位图放大变糊
    transform: `translate(-50%, -50%)`,
  }
})

// ==================== viewport（世界坐标 -> 屏幕坐标） ====================
// 约定：screen = canvasOffset + world * zoomLevel
const screenToWorld = (p: { x: number; y: number }) => {
  return {
    x: (p.x - canvasOffset.value.x) / zoomLevel.value,
    y: (p.y - canvasOffset.value.y) / zoomLevel.value,
  }
}

const applyViewportTransform = (c: CanvasRenderingContext2D) => {
  c.translate(canvasOffset.value.x, canvasOffset.value.y)
  c.scale(zoomLevel.value, zoomLevel.value)
}

// ==================== 渲染节流（rAF 合帧） ====================
let rafRenderId: number | null = null
let renderScheduled = false

const scheduleRender = () => {
  if (renderScheduled) return
  renderScheduled = true
  rafRenderId = window.requestAnimationFrame(() => {
    renderScheduled = false
    rafRenderId = null
    render()
  })
}

// ==================== 坐标换算缓存（避免 move 频繁读布局） ====================
let cachedCanvasRect: DOMRect | null = null
let cachedScaleX = 1
let cachedScaleY = 1

const updateCanvasRectCache = () => {
  const el = liveCanvasRef.value || historyCanvasRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  cachedCanvasRect = rect
  // 这里要返回“逻辑坐标（CSS px）”，而不是 backing store 像素坐标
  cachedScaleX = canvasWidth.value / rect.width
  cachedScaleY = canvasHeight.value / rect.height
}

// 初始化画布
const initCanvas = async () => {
  // 等待DOM更新
  await nextTick()

  // 获取canvas元素和上下文
  if (!historyCanvasRef.value || !liveCanvasRef.value) return

  ctx = historyCanvasRef.value.getContext('2d')
  if (!ctx) return

  liveCtx = liveCanvasRef.value.getContext('2d')
  if (!liveCtx) return

  // 设置画布尺寸
  resizeCanvasBackingStore(historyCanvasRef.value, canvasWidth.value, canvasHeight.value)
  resizeCanvasBackingStore(liveCanvasRef.value, canvasWidth.value, canvasHeight.value)

  // 初始化 Signature Pad（用于交互式绘制）
  if (signaturePadRef.value) {
    resizeCanvasBackingStore(signaturePadRef.value, canvasWidth.value, canvasHeight.value)
    signaturePad = new SignaturePad(signaturePadRef.value, {
      backgroundColor: 'rgba(255, 255, 255, 0)',
      penColor: toolConfig.value.color || '#000000',
      throttle: 0, // 不限制绘制频率
      minWidth: (toolConfig.value.size || 3) * 0.5,
      maxWidth: (toolConfig.value.size || 3) * 1.5,
    })
    
    // 注意：Signature Pad会自动处理绘制，我们只需要在鼠标抬起时保存数据
  }

  // 保存初始状态
  saveState()

  // 加载背景图片（如果有）
  if (props.backgroundImage) {
    loadBackgroundImage(props.backgroundImage)
  } else {
    // 渲染画布
    historyDirty = true
    render()
  }
}

// 背景图片加载版本号（防止旧的异步加载结果覆盖当前状态）
let bgLoadVersion = 0

// 加载背景图片
const loadBackgroundImage = (imageUrl: string): Promise<void> => {
  // 每次调用都递增版本号，用于区分新旧加载
  const currentVersion = ++bgLoadVersion

  if (!imageUrl) {
    // 清空背景：只要是最新调用，直接重置状态并渲染
    backgroundImg.value = null
    backgroundLoaded.value = false
    bgDrawParams.value = null
    historyDirty = true
    render()
    return Promise.resolve()
  }

  const img = new Image()
  return new Promise<void>((resolve) => {
    img.onload = () => {
      // 仅当本次加载版本仍然是最新时才生效，避免旧请求覆盖当前背景
      if (currentVersion !== bgLoadVersion) {
        console.log('[DrawingBoard] 背景图片加载完成(过期，丢弃):', imageUrl.slice(0, 48))
        return resolve()
      }

      console.log('[DrawingBoard] 背景图片加载完成:', {
        srcSample: imageUrl.slice(0, 48),
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      })
      backgroundImg.value = img
      backgroundLoaded.value = true

    // 根据 layoutMode / fillContainer 选择布局模式
    const useDoubleHeight = props.layoutMode === 'doubleHeight'
    const useFill = props.layoutMode === 'fill' || (!props.layoutMode && props.fillContainer)

    // 优先级 1：doubleHeight 模式（宽度=容器宽，高度=容器高*2）
    if (useDoubleHeight) {
      const wrapper = historyCanvasRef.value?.parentElement
      if (wrapper) {
        const containerW = wrapper.clientWidth
        const baseH = wrapper.clientHeight
        const targetH = baseH * 1.5

        console.log('[DrawingBoard] layoutMode=doubleHeight 容器尺寸:', {
          containerW,
          baseH,
          targetH,
        })

        // 画布尺寸
        canvasWidth.value = containerW
        canvasHeight.value = targetH
        if (historyCanvasRef.value) {
          resizeCanvasBackingStore(historyCanvasRef.value, containerW, targetH)
        }
        if (liveCanvasRef.value) {
          resizeCanvasBackingStore(liveCanvasRef.value, containerW, targetH)
        }
        if (signaturePadRef.value) {
          resizeCanvasBackingStore(signaturePadRef.value, containerW, targetH)
        }

        // 背景图按 contain 缩放，并在四周留出统一 padding，避免紧贴画布边缘
        const padding = 24
        const availableW = Math.max(containerW - padding * 2, 0)
        const availableH = Math.max(targetH - padding * 2, 0)
        const scale = Math.min(availableW / img.width, availableH / img.height)
        const drawW = img.width * scale
        const drawH = img.height * scale
        const offsetX = padding + (availableW - drawW) / 2
        // 水平方向居中，垂直方向贴紧上方 padding，不再居中
        const offsetY = padding
        bgDrawParams.value = { scale, offsetX, offsetY }
      } else {
        bgDrawParams.value = null
      }

    // 优先级 2：fill 模式：Canvas 根据外部尺寸或父容器尺寸填充，图片按 contain 方式绘制
    } else if (useFill) {
      // 优先使用外部传入的 width/height；否则回退到父容器尺寸
      let containerW = props.width ?? 0
      let containerH = props.height ?? 0

      if (!containerW || !containerH) {
        const wrapper = historyCanvasRef.value?.parentElement
        if (wrapper) {
          containerW = wrapper.clientWidth
          containerH = wrapper.clientHeight
        }
      }

      if (containerW && containerH) {
        console.log('[DrawingBoard] fillContainer 容器尺寸:', {
          containerW,
          containerH,
        })

        // 设置 Canvas 尺寸为容器/指定尺寸
        canvasWidth.value = containerW
        canvasHeight.value = containerH
        if (historyCanvasRef.value) {
          resizeCanvasBackingStore(historyCanvasRef.value, containerW, containerH)
        }
        if (liveCanvasRef.value) {
          resizeCanvasBackingStore(liveCanvasRef.value, containerW, containerH)
        }
        if (signaturePadRef.value) {
          resizeCanvasBackingStore(signaturePadRef.value, containerW, containerH)
        }

        // 计算缩放与偏移：等比 contain，紧贴 Canvas 上边缘（offsetY = 0），水平居中
        const scale = Math.min(containerW / img.width, containerH / img.height)
        const drawW = img.width * scale
        const drawH = img.height * scale
        const offsetX = (containerW - drawW) / 2
        const offsetY = 0
        bgDrawParams.value = { scale, offsetX, offsetY }
      } else {
        // 无法得到容器尺寸时，退回到图片尺寸
        canvasWidth.value = img.width
        canvasHeight.value = img.height
        if (historyCanvasRef.value) {
          historyCanvasRef.value.width = img.width
          historyCanvasRef.value.height = img.height
        }
        if (liveCanvasRef.value) {
          liveCanvasRef.value.width = img.width
          liveCanvasRef.value.height = img.height
        }
        if (signaturePadRef.value) {
          signaturePadRef.value.width = img.width
          signaturePadRef.value.height = img.height
        }
        bgDrawParams.value = null
      }
    } else if (props.fitBackground) {
      // fitBackground 模式：Canvas 尺寸 = 图片尺寸
      canvasWidth.value = img.width
      canvasHeight.value = img.height
      if (historyCanvasRef.value) {
        resizeCanvasBackingStore(historyCanvasRef.value, img.width, img.height)
      }
      if (liveCanvasRef.value) {
        resizeCanvasBackingStore(liveCanvasRef.value, img.width, img.height)
      }
      if (signaturePadRef.value) {
        resizeCanvasBackingStore(signaturePadRef.value, img.width, img.height)
      }
      bgDrawParams.value = null
    } else {
      bgDrawParams.value = null
    }

      historyDirty = true
      render()
      resolve()
    }
    img.onerror = () => {
      if (currentVersion !== bgLoadVersion) {
        console.warn('[DrawingBoard] 背景图片加载失败(过期，丢弃):', imageUrl.substring(0, 50))
        return resolve()
      }
      console.error('[DrawingBoard] 背景图片加载失败:', imageUrl.substring(0, 50))
      backgroundImg.value = null
      backgroundLoaded.value = false
      bgDrawParams.value = null
      historyDirty = true
      render()
      resolve()
    }
    img.src = imageUrl
  })
}

// 监听背景图片变化（由父组件通过 props 传入）
watch(
  () => props.backgroundImage,
  (newUrl) => {
    console.log('[DrawingBoard] props.backgroundImage change', {
      length: newUrl ? newUrl.length : 0,
      isEmpty: !newUrl,
    })
    if (newUrl) {
      console.log('[DrawingBoard] 收到新的背景图，长度 =', newUrl.length)
    } else {
      console.log('[DrawingBoard] 背景图被清空')
    }
    loadBackgroundImage(newUrl || '')
  },
)

// 渲染画布
const render = () => {
  if (!ctx || !historyCanvasRef.value || !liveCtx || !liveCanvasRef.value) return

  if (historyDirty) {
    // history 层：背景 + 已完成对象（较少重绘）
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, historyCanvasRef.value.width, historyCanvasRef.value.height)
    prepareCtxForLogicalDrawing(ctx)
    applyViewportTransform(ctx)

    if (backgroundImg.value && backgroundLoaded.value) {
      const img = backgroundImg.value
      const canvas = historyCanvasRef.value
      if (bgDrawParams.value) {
        const { scale, offsetX, offsetY } = bgDrawParams.value
        const drawW = img.width * scale
        const drawH = img.height * scale
        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawW, drawH)
      } else if (props.fitBackground) {
        ctx.drawImage(img, 0, 0)
      } else {
        const canvasW = canvas.width
        const canvasH = canvas.height
        const scale = Math.min(canvasW / img.width, canvasH / img.height)
        const drawW = img.width * scale
        const drawH = img.height * scale
        const offsetX = (canvasW - drawW) / 2
        const offsetY = (canvasH - drawH) / 2
        ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawW, drawH)
      }
    }

    objects.value.forEach((obj) => {
      if (!ctx) return
      ctx.save()
      if (obj.opacity !== undefined) {
        ctx.globalAlpha = obj.opacity
      }
      drawObject(ctx, obj)
      ctx.restore()
    })

    historyDirty = false
  }

  // live 层：临时对象/选框/高亮/hover（每帧重绘）
  liveCtx.setTransform(1, 0, 0, 1, 0, 0)
  liveCtx.clearRect(0, 0, liveCanvasRef.value.width, liveCanvasRef.value.height)
  prepareCtxForLogicalDrawing(liveCtx)
  applyViewportTransform(liveCtx)

  // 橡皮擦悬停对象半透明提示
  if (currentTool.value === 'eraser-draw' && hoveredObject.value !== null) {
    const obj = objects.value[hoveredObject.value]
    if (obj) {
      liveCtx.save()
      liveCtx.globalAlpha = 0.5
      drawObject(liveCtx, obj)
      liveCtx.restore()
    }
  }

  // 选中对象高亮
  if (selectedObjects.value.size > 0) {
    selectedObjects.value.forEach((index) => {
      const obj = objects.value[index]
      if (!obj) return
      drawObjectHighlight(obj)
    })
  }

  // 临时对象
  if (tempObject.value) {
    liveCtx.save()
    const obj = tempObject.value
    if (obj.type === 'path' && obj.points && obj.points.length > 0 && obj.handwritingStyle !== 'signature') {
      const taperStart = obj.pfTaperStart !== false
      const taperEnd = obj.pfTaperEnd !== false
      liveCtx.fillStyle = obj.color
      drawNormalFilledStroke(liveCtx, obj.points, obj.lineWidth, 'live', taperStart, taperEnd)
    } else {
      drawObject(liveCtx, obj)
    }
    liveCtx.restore()
  }

  // 选框
  if (selectionBox.value) {
    drawSelectionBox(selectionBox.value)
  }
}

// 绘制单个对象
const drawObject = (targetCtx: CanvasRenderingContext2D, obj: DrawObject) => {
  targetCtx.strokeStyle = obj.color
  targetCtx.fillStyle = obj.color
  targetCtx.lineWidth = obj.lineWidth
  targetCtx.lineCap = 'round'
  targetCtx.lineJoin = 'round'

  switch (obj.type) {
    case 'path':
      // 绘制路径
      if (obj.points && obj.points.length > 0) {
        if (obj.handwritingStyle === 'signature') {
          // Signature Pad 风格：使用平滑的贝塞尔曲线绘制（模拟Signature Pad效果）
          drawSignaturePath(targetCtx, obj.points, obj.lineWidth, obj.color)
        } else {
          // 普通笔：轮廓填充（减少折痕，笔锋更自然）
          const taperStart = obj.pfTaperStart !== false
          const taperEnd = obj.pfTaperEnd !== false
          drawNormalFilledStroke(targetCtx, obj.points, obj.lineWidth, 'final', taperStart, taperEnd)
        }
      }
      break

    case 'rectangle':
      // 绘制矩形
      if (
        obj.x !== undefined &&
        obj.y !== undefined &&
        obj.width !== undefined &&
        obj.height !== undefined
      ) {
        targetCtx.strokeRect(obj.x, obj.y, obj.width, obj.height)
      }
      break

    case 'circle':
      // 绘制圆形
      if (obj.x !== undefined && obj.y !== undefined && obj.radius !== undefined) {
        targetCtx.beginPath()
        targetCtx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2)
        targetCtx.stroke()
      }
      break

    case 'line':
      // 绘制直线
      if (
        obj.x1 !== undefined &&
        obj.y1 !== undefined &&
        obj.x2 !== undefined &&
        obj.y2 !== undefined
      ) {
        targetCtx.beginPath()
        targetCtx.moveTo(obj.x1, obj.y1)
        targetCtx.lineTo(obj.x2, obj.y2)
        targetCtx.stroke()
      }
      break

    case 'triangle':
      // 绘制三角形
      if (
        obj.x !== undefined &&
        obj.y !== undefined &&
        obj.width !== undefined &&
        obj.height !== undefined
      ) {
        targetCtx.beginPath()
        targetCtx.moveTo(obj.x + obj.width / 2, obj.y)
        targetCtx.lineTo(obj.x, obj.y + obj.height)
        targetCtx.lineTo(obj.x + obj.width, obj.y + obj.height)
        targetCtx.closePath()
        targetCtx.stroke()
      }
      break

    case 'text':
      // 绘制文本
      if (obj.text && obj.x !== undefined && obj.y !== undefined) {
        targetCtx.font = `${obj.fontSize || 16}px Arial`
        targetCtx.fillText(obj.text, obj.x, obj.y)
      }
      break
  }
}

// 绘制选框（虚线矩形）
const drawSelectionBox = (box: { x: number; y: number; width: number; height: number }) => {
  if (!liveCtx) return

  liveCtx.save()
  liveCtx.setLineDash([5, 5])
  liveCtx.strokeStyle = '#0080FF'
  liveCtx.lineWidth = 2
  liveCtx.strokeRect(box.x, box.y, box.width, box.height)
  liveCtx.restore()
}

// 绘制对象高亮边框
const drawObjectHighlight = (obj: DrawObject) => {
  if (!liveCtx) return

  const bounds = getObjectBounds(obj)
  if (!bounds) return

  liveCtx.save()
  liveCtx.strokeStyle = '#0080FF'
  liveCtx.lineWidth = 3
  liveCtx.setLineDash([5, 5])

  // 绘制高亮矩形（稍微放大）
  const padding = 5
  liveCtx.strokeRect(
    bounds.x - padding,
    bounds.y - padding,
    bounds.width + padding * 2,
    bounds.height + padding * 2,
  )

  liveCtx.restore()
}

// 获取对象边界
const getObjectBounds = (
  obj: DrawObject,
): { x: number; y: number; width: number; height: number } | null => {
  switch (obj.type) {
    case 'path':
      if (!obj.points || obj.points.length === 0) return null
      const xs = obj.points.map((p) => p.x)
      const ys = obj.points.map((p) => p.y)
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      }

    case 'rectangle':
      if (
        obj.x === undefined ||
        obj.y === undefined ||
        obj.width === undefined ||
        obj.height === undefined
      )
        return null
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }

    case 'circle':
      if (obj.x === undefined || obj.y === undefined || obj.radius === undefined) return null
      return {
        x: obj.x - obj.radius,
        y: obj.y - obj.radius,
        width: obj.radius * 2,
        height: obj.radius * 2,
      }

    case 'line':
      if (
        obj.x1 === undefined ||
        obj.y1 === undefined ||
        obj.x2 === undefined ||
        obj.y2 === undefined
      )
        return null
      return {
        x: Math.min(obj.x1, obj.x2),
        y: Math.min(obj.y1, obj.y2),
        width: Math.abs(obj.x2 - obj.x1),
        height: Math.abs(obj.y2 - obj.y1),
      }

    case 'triangle':
      if (
        obj.x === undefined ||
        obj.y === undefined ||
        obj.width === undefined ||
        obj.height === undefined
      )
        return null
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }

    case 'text':
      if (obj.x === undefined || obj.y === undefined || !obj.text) return null
      const fontSize = obj.fontSize || 16
      const textWidth = obj.text.length * fontSize * 0.6 // 估算宽度
      return { x: obj.x, y: obj.y - fontSize, width: textWidth, height: fontSize }
  }

  return null
}

// （已去除自动扩容逻辑）

// 检查点是否在对象内
const isPointInObject = (x: number, y: number, obj: DrawObject): boolean => {
  // path：用点到线段距离做命中（更准）
  if (obj.type === 'path' && obj.points && obj.points.length > 1) {
    // 轮廓填充后“视觉宽度”会比 baseWidth 略大（maxW ~ 1.25 * baseWidth）
    const tol = Math.max(10, (obj.lineWidth || 3) * 2)
    return isPointNearPath({ x, y }, obj.points, tol)
  }

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

// 获取鼠标在canvas上的坐标
const getCanvasCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
  const el = liveCanvasRef.value || historyCanvasRef.value
  if (!el) return null

  // 优先使用缓存 rect，避免在 move 中频繁触发布局计算
  const rect = cachedCanvasRect ?? el.getBoundingClientRect()
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

  // 计算 CSS 缩放比例（解决 Canvas 被 CSS 缩放时坐标不准的问题）
  // 注意：rect 已包含 CSS transform scale 的影响，所以 scaleX/Y 已隐式考虑了 zoomLevel
  const scaleX = cachedCanvasRect ? cachedScaleX : canvasWidth.value / rect.width
  const scaleY = cachedCanvasRect ? cachedScaleY : canvasHeight.value / rect.height

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}

// 鼠标按下
const handleMouseDown = (e: MouseEvent) => {
  // 一次交互开始时更新 rect 缓存（后续 move 复用）
  updateCanvasRectCache()
  const screen = getCanvasCoords(e)
  if (!screen) return
  const coords = screenToWorld(screen)

  startPoint.value = coords
  isDrawing.value = true

  switch (currentTool.value) {
    case 'hand':
      // 手型工具：开始拖动画布
      isPanning.value = true
      panStartPoint.value = { x: e.clientX, y: e.clientY }
      panStartOffset.value = { ...canvasOffset.value }
      if (liveCanvasRef.value) {
        liveCanvasRef.value.style.cursor = 'grabbing'
      }
      break

    case 'select':
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

        if (liveCanvasRef.value) {
          liveCanvasRef.value.style.cursor = 'grabbing'
        }
      } else {
        // 点击在空白处或未选中的图形上，开始框选
        selectedObjects.value.clear()
        selectionBox.value = {
          x: coords.x,
          y: coords.y,
          width: 0,
          height: 0,
        }
      }
      break

    case 'draw':
      // 开始绘制路径
      if (toolConfig.value.handwritingStyle === 'signature' && signaturePad) {
        // Signature Pad 模式：让 Signature Pad 处理绘制
        // Signature Pad 会自动处理鼠标事件
        currentPath.value = []
      } else {
        // 普通模式：开始记录路径点
        strokeHasFlushedChunks.value = false
        currentPath.value = [coords]
      }
      break

    case 'eraser-draw':
      // 橡皮擦：整笔擦除
      handleEraser(coords)
      break

    case 'text':
      // 添加文本
      addText(coords)
      break
  }
}

// 鼠标移动
const handleMouseMove = (e: MouseEvent) => {
  // 手型工具拖动
  if (isPanning.value && panStartPoint.value) {
    // client 像素 -> 逻辑 canvas 坐标（CSS px），与 canvasOffset 同单位
    const dx = (e.clientX - panStartPoint.value.x) * cachedScaleX
    const dy = (e.clientY - panStartPoint.value.y) * cachedScaleY
    canvasOffset.value = {
      x: panStartOffset.value.x + dx,
      y: panStartOffset.value.y + dy,
    }
    return
  }

  const screen = getCanvasCoords(e)
  if (!screen) return
  const coords = screenToWorld(screen)

  // 橡皮擦悬停效果
  if (currentTool.value === 'eraser-draw') {
    const objIndex = findObjectAtPoint(coords.x, coords.y)
    if (hoveredObject.value !== objIndex) {
      hoveredObject.value = objIndex
      scheduleRender()
    }
  }

  if (!isDrawing.value || !startPoint.value) {
    return
  }

  switch (currentTool.value) {
    case 'select':
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

        scheduleRender()
      } else if (selectionBox.value) {
        // 绘制选框
        selectionBox.value = {
          x: Math.min(startPoint.value.x, coords.x),
          y: Math.min(startPoint.value.y, coords.y),
          width: Math.abs(coords.x - startPoint.value.x),
          height: Math.abs(coords.y - startPoint.value.y),
        }
        scheduleRender()
      }
      break

    case 'draw':
      // 如果是 Signature Pad 风格，Signature Pad会自动处理绘制
      // 普通风格继续使用原有逻辑
      if (toolConfig.value.handwritingStyle !== 'signature') {
        // 使用距离阈值控制采样密度，减少锯齿与过密点
        addDrawPointIfFarEnough(currentPath.value, coords)

        // 分段固化：避免 currentPath 过长导致每帧 getStroke 变慢
        if (currentPath.value.length >= LIVE_STROKE_CHUNK_POINTS) {
          // 保留尾部重叠点，保证同一笔的几何连续（优先消除“缝隙/断裂”）
          // 这里采用“重叠覆盖”策略：固化段保留更多尾部点，与下一段中心线重叠。
          // 在我们关闭中间段 taper/cap 的前提下，重叠带来的轻微变厚通常比“断裂”更可接受。
          const lastIdx = currentPath.value.length - 1
          const tailStart = Math.max(0, lastIdx - LIVE_STROKE_CHUNK_OVERLAP_POINTS)
          // 固化段：不包含最后一个点（最后一个点会在下一段继续被更新/修正）
          const chunkPoints = currentPath.value.slice(0, lastIdx)
          // 下一段：保留尾部重叠点
          const tailPoints = currentPath.value.slice(tailStart)
          if (chunkPoints.length > 1) {
            objects.value.push({
              type: 'path',
              color: toolConfig.value.color || '#000000',
              lineWidth: toolConfig.value.size || 3,
              points: chunkPoints,
              handwritingStyle: 'normal',
              // 中间段不做 taper（否则每段末端变尖，视觉上像断开）
              pfTaperStart: !strokeHasFlushedChunks.value,
              pfTaperEnd: false,
            })
            historyDirty = true
            strokeHasFlushedChunks.value = true
          }
          // 继续当前一笔：保留尾部重叠点作为下一段起点
          currentPath.value = tailPoints
        }

        tempObject.value = {
          type: 'path',
          color: toolConfig.value.color || '#000000',
          lineWidth: toolConfig.value.size || 3,
          points: [...currentPath.value],
          handwritingStyle: 'normal',
          // 如果前面已经固化过分段，那么当前段不是整笔起点：关闭起笔 taper，避免连接处变细
          pfTaperStart: !strokeHasFlushedChunks.value,
          // 实时预览永远不做“收笔 taper”（否则每帧都在收尖，视觉上会断）
          pfTaperEnd: false,
        }
        scheduleRender()
      }
      break

    case 'eraser-draw':
      // 橡皮擦拖动擦除
      handleEraser(coords)
      break

    case 'rectangle':
      // 绘制矩形预览
      tempObject.value = {
        type: 'rectangle',
        color: toolConfig.value.color || '#000000',
        lineWidth: toolConfig.value.size || 3,
        x: Math.min(startPoint.value.x, coords.x),
        y: Math.min(startPoint.value.y, coords.y),
        width: Math.abs(coords.x - startPoint.value.x),
        height: Math.abs(coords.y - startPoint.value.y),
      }
      scheduleRender()
      break

    case 'circle':
      // 绘制圆形预览（参考 Windows 画板：起始点和当前点构成矩形，圆内接在矩形中）
      const width = Math.abs(coords.x - startPoint.value.x)
      const height = Math.abs(coords.y - startPoint.value.y)
      const centerX = (startPoint.value.x + coords.x) / 2
      const centerY = (startPoint.value.y + coords.y) / 2
      const radius = Math.min(width, height) / 2

      tempObject.value = {
        type: 'circle',
        color: toolConfig.value.color || '#000000',
        lineWidth: toolConfig.value.size || 3,
        x: centerX,
        y: centerY,
        radius,
      }
      scheduleRender()
      break

    case 'line':
      // 绘制直线预览
      tempObject.value = {
        type: 'line',
        color: toolConfig.value.color || '#000000',
        lineWidth: toolConfig.value.size || 3,
        x1: startPoint.value.x,
        y1: startPoint.value.y,
        x2: coords.x,
        y2: coords.y,
      }
      scheduleRender()
      break

    case 'triangle':
      // 绘制三角形预览
      tempObject.value = {
        type: 'triangle',
        color: toolConfig.value.color || '#000000',
        lineWidth: toolConfig.value.size || 3,
        x: Math.min(startPoint.value.x, coords.x),
        y: Math.min(startPoint.value.y, coords.y),
        width: Math.abs(coords.x - startPoint.value.x),
        height: Math.abs(coords.y - startPoint.value.y),
      }
      scheduleRender()
      break
  }
}

// 鼠标抬起
const handleMouseUp = () => {
  // 一次交互结束后清空缓存，避免布局变化导致坐标漂移
  cachedCanvasRect = null
  // 手型工具：结束拖动
  if (isPanning.value) {
    isPanning.value = false
    panStartPoint.value = null
    if (liveCanvasRef.value) {
      liveCanvasRef.value.style.cursor = currentTool.value === 'hand' ? 'grab' : 'crosshair'
    }
    return
  }

  if (currentTool.value === 'select') {
    // 选择工具处理
    if (isDraggingObjects.value) {
      // 拖拽结束，保存状态
      saveState()
      // 第X步：通知父组件内容已变化
      emit('content-change')
    } else if (
      selectionBox.value &&
      selectionBox.value.width > 5 &&
      selectionBox.value.height > 5
    ) {
      // 框选结束，选中与选框相交的所有对象
      const selectedIndices = findObjectsInRect(selectionBox.value)
      selectedObjects.value = new Set(selectedIndices)
      scheduleRender()
    } else {
      // 点击空白处，清空选择
      selectedObjects.value.clear()
      scheduleRender()
    }

    // 统一重置选择工具的状态
    isDraggingObjects.value = false
    dragStartPoint.value = null
    objectsOriginalPositions.value.clear()
    selectionBox.value = null

    // 恢复光标
    if (liveCanvasRef.value) {
      liveCanvasRef.value.style.cursor = 'crosshair'
    }
  } else if (tempObject.value && isDrawing.value && currentTool.value !== 'draw') {
    // 添加临时对象到列表（非draw工具）
    objects.value.push(tempObject.value)
    historyDirty = true
    tempObject.value = null
    saveState()
    // 第X步：通知父组件内容已变化
    emit('content-change')
  } else if (currentTool.value === 'draw' && isDrawing.value) {
    if (toolConfig.value.handwritingStyle === 'signature' && signaturePad) {
      // Signature Pad模式：获取绘制数据并保存
      const data = signaturePad.toData()
      if (data && data.length > 0) {
        // 获取最后一个stroke的点
        const lastStroke = data[data.length - 1]
        if (lastStroke && lastStroke.points && lastStroke.points.length > 0) {
          // 将Signature Pad的点转换为普通路径点
          const points: { x: number; y: number }[] = []
          lastStroke.points.forEach((pt: any) => {
            points.push({ x: pt.x, y: pt.y })
          })
          
          // 保存到对象列表
          if (points.length > 0) {
            objects.value.push({
              type: 'path',
              color: toolConfig.value.color || '#000000',
              lineWidth: toolConfig.value.size || 3,
              points: points,
              handwritingStyle: 'signature',
            })
            historyDirty = true
            saveState()
            
            // 清空Signature Pad并重新渲染主画布
            signaturePad.clear()
            scheduleRender()
            emit('content-change')
          }
        }
      }
    } else {
      // draw工具普通模式：添加路径对象
      if (tempObject.value && tempObject.value.points && tempObject.value.points.length > 0) {
        objects.value.push({
          ...tempObject.value,
          points: tempObject.value.points,
          pfTaperStart: !strokeHasFlushedChunks.value,
          pfTaperEnd: true,
        })
        historyDirty = true
        saveState()
        emit('content-change')
      }
      tempObject.value = null
    }
  }

  // 统一重置绘制状态
  isDrawing.value = false
  currentPath.value = []
  strokeHasFlushedChunks.value = false
  startPoint.value = null
}

// 计算两个触摸点之间的距离
const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
  // 计算横向距离差
  const dx = touch1.clientX - touch2.clientX
  // 计算纵向距离差
  const dy = touch1.clientY - touch2.clientY
  // 使用勾股定理计算直线距离
  return Math.sqrt(dx * dx + dy * dy)
}

// 计算两个触摸点的中心点坐标
const getTouchCenter = (touch1: Touch, touch2: Touch): { x: number; y: number } => {
  return {
    // 计算X轴中心点
    x: (touch1.clientX + touch2.clientX) / 2,
    // 计算Y轴中心点
    y: (touch1.clientY + touch2.clientY) / 2,
  }
}

// 触摸事件处理
const handleTouchStart = (e: TouchEvent) => {
  // 流程：阻止默认行为
  e.preventDefault()

  // 流程：判断是否为双指触摸
  if (e.touches.length === 2) {
    // 流程：标记为双指手势
    isTwoFingerGesture.value = true

    // 流程：清除单指延迟定时器
    if (singleTouchTimer !== null) {
      clearTimeout(singleTouchTimer)
      singleTouchTimer = null
    }

    // 流程：清除待处理的单指触摸状态
    pendingSingleTouch.value = false

    // 流程：如果之前触发了单指绘图，取消绘图状态
    if (isDrawing.value) {
      isDrawing.value = false
      currentPath.value = []
      tempObject.value = null
      isDraggingObjects.value = false
      isPanning.value = false
      render()
    }

    // 流程：记录初始双指距离
    initialTouchDistance.value = getTouchDistance(e.touches[0], e.touches[1])
    gestureStartDistance.value = initialTouchDistance.value

    // 流程：记录当前缩放比例作为初始值
    initialTouchScale.value = zoomLevel.value

    // 流程：记录初始双指中心点坐标（屏幕绝对坐标，避免wrapper变化影响）
    const center = getTouchCenter(e.touches[0], e.touches[1])
    initialTouchCenterX.value = center.x
    initialTouchCenterY.value = center.y
    gestureStartCenterX.value = center.x
    gestureStartCenterY.value = center.y

    // 流程：记录当前画布偏移量作为初始值
    initialTouchTranslateX.value = canvasOffset.value.x
    initialTouchTranslateY.value = canvasOffset.value.y
  } else if (e.touches.length === 1) {
    // 流程：单指触摸，记录触摸点并标记为待处理状态
    const touch = e.touches[0]
    pendingSingleTouch.value = true
    pendingTouchX.value = touch.clientX
    pendingTouchY.value = touch.clientY

    // 流程：设置延迟定时器（80ms）判断是否为双指操作
    singleTouchTimer = window.setTimeout(() => {
      // 流程：延迟后仍是单指且未开始绘图，执行绘图操作
      if (pendingSingleTouch.value && !isTwoFingerGesture.value) {
        // 即将触发 mousedown：刷新 rect 缓存，避免首次 move 读布局
        updateCanvasRectCache()
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: pendingTouchX.value,
          clientY: pendingTouchY.value,
        })
        handleMouseDown(mouseEvent)
        pendingSingleTouch.value = false
      }
      singleTouchTimer = null
    }, 80)
  }
}

const handleTouchMove = (e: TouchEvent) => {
  // 流程：阻止默认行为
  e.preventDefault()

  // 流程：如果单指触摸处于待处理状态，检测移动距离
  if (e.touches.length === 1 && pendingSingleTouch.value) {
    const touch = e.touches[0]
    // 流程：计算移动距离
    const deltaX = touch.clientX - pendingTouchX.value
    const deltaY = touch.clientY - pendingTouchY.value
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // 流程：如果移动距离超过阈值（5px），立即开始绘图
    if (distance > 5) {
      // 流程：清除延迟定时器
      if (singleTouchTimer !== null) {
        clearTimeout(singleTouchTimer)
        singleTouchTimer = null
      }

      // 流程：立即触发mousedown事件
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: pendingTouchX.value,
        clientY: pendingTouchY.value,
      })
      handleMouseDown(mouseDownEvent)

      // 流程：清除待处理状态
      pendingSingleTouch.value = false

      // 流程：触发mousemove事件
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      })
      handleMouseMove(mouseMoveEvent)
      return
    }
  }

  // 流程：判断是否为双指触摸
  if (e.touches.length === 2) {
    // 流程：计算当前双指距离
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1])

    // 流程：计算当前双指中心点坐标（屏幕绝对坐标）
    const currentCenter = getTouchCenter(e.touches[0], e.touches[1])

    // 流程：计算双指距离变化
    const distanceChange = Math.abs(currentDistance - gestureStartDistance.value)

    // 流程：计算缩放变化率（相对于初始距离的百分比）
    const scaleChangeRatio = distanceChange / gestureStartDistance.value

    // 流程：判断是否有明显的缩放意图（超过5%或30px）
    const hasZoomIntent = scaleChangeRatio > 0.05 || distanceChange > 30

    // 流程：计算缩放比例
    const scaleChange = currentDistance / initialTouchDistance.value
    const newScale = initialTouchScale.value * scaleChange
    const clampedScale = Math.min(Math.max(newScale, 0.1), 3)

    // 流程：计算手指中心点的位移
    const centerDeltaX = currentCenter.x - initialTouchCenterX.value
    const centerDeltaY = currentCenter.y - initialTouchCenterY.value

    // 流程：缩放时需要补偿，确保手指下的内容"钉住"
    if (hasZoomIntent) {
      // 以手指中心点作为锚点：保持该点对应的 world 坐标不变
      const canvasEl = liveCanvasRef.value || historyCanvasRef.value
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()
      const centerCanvasX = (currentCenter.x - rect.left) * (canvasWidth.value / rect.width)
      const centerCanvasY = (currentCenter.y - rect.top) * (canvasHeight.value / rect.height)

      // 手势开始时，中心点对应的 world 坐标
      const startCenterCanvasX = (gestureStartCenterX.value - rect.left) * (canvasWidth.value / rect.width)
      const startCenterCanvasY = (gestureStartCenterY.value - rect.top) * (canvasHeight.value / rect.height)
      const worldX = (startCenterCanvasX - initialTouchTranslateX.value) / initialTouchScale.value
      const worldY = (startCenterCanvasY - initialTouchTranslateY.value) / initialTouchScale.value

      zoomLevel.value = clampedScale
      canvasOffset.value = {
        x: centerCanvasX - worldX * clampedScale,
        y: centerCanvasY - worldY * clampedScale,
      }
    } else {
      // 流程：没有缩放意图，只平移
      canvasOffset.value = {
        x: initialTouchTranslateX.value + centerDeltaX,
        y: initialTouchTranslateY.value + centerDeltaY,
      }
    }
  } else if (e.touches.length === 1 && !isTwoFingerGesture.value) {
    // 流程：单指触摸且不是双指手势，转换为鼠标事件执行绘图操作
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    })
    handleMouseMove(mouseEvent)
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  // 流程：阻止默认行为
  e.preventDefault()

  // 流程：如果剩余手指数小于2，重置双指触摸初始距离
  if (e.touches.length < 2) {
    initialTouchDistance.value = 0
  }

  // 流程：如果所有手指都离开屏幕
  if (e.touches.length === 0) {
    // 流程：清除单指延迟定时器
    if (singleTouchTimer !== null) {
      clearTimeout(singleTouchTimer)
      singleTouchTimer = null
    }

    // 流程：清除待处理的单指触摸状态
    pendingSingleTouch.value = false

    // 流程：重置双指手势标记
    isTwoFingerGesture.value = false

    // 流程：执行鼠标抬起事件
    handleMouseUp()
  }
}

// 克隆对象位置信息
const cloneObjectPosition = (obj: DrawObject): ObjectPosition => {
  switch (obj.type) {
    case 'path':
      return { points: obj.points ? [...obj.points.map((p) => ({ ...p }))] : [] }
    case 'rectangle':
    case 'triangle':
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
    case 'circle':
      return { x: obj.x, y: obj.y, radius: obj.radius }
    case 'line':
      return { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 }
    case 'text':
      return { x: obj.x, y: obj.y }
    default:
      return {}
  }
}

// 移动对象（根据原始位置和偏移量）
const moveObject = (obj: DrawObject, original: ObjectPosition, dx: number, dy: number) => {
  switch (obj.type) {
    case 'path':
      if (original.points && obj.points) {
        obj.points = original.points.map((p: { x: number; y: number }) => ({
          x: p.x + dx,
          y: p.y + dy,
        }))
      }
      break
    case 'rectangle':
    case 'triangle':
      if (original.x !== undefined && original.y !== undefined) {
        obj.x = original.x + dx
        obj.y = original.y + dy
      }
      break
    case 'circle':
      if (original.x !== undefined && original.y !== undefined) {
        obj.x = original.x + dx
        obj.y = original.y + dy
      }
      break
    case 'line':
      if (
        original.x1 !== undefined &&
        original.y1 !== undefined &&
        original.x2 !== undefined &&
        original.y2 !== undefined
      ) {
        obj.x1 = original.x1 + dx
        obj.y1 = original.y1 + dy
        obj.x2 = original.x2 + dx
        obj.y2 = original.y2 + dy
      }
      break
    case 'text':
      if (original.x !== undefined && original.y !== undefined) {
        obj.x = original.x + dx
        obj.y = original.y + dy
      }
      break
  }
}

// 橡皮擦处理
const handleEraser = (coords: { x: number; y: number }) => {
  const eraserSize = toolConfig.value.size || 15
  const eraserRadius = eraserSize / 2

  // 查找需要删除的对象
  const toDelete: number[] = []

  objects.value.forEach((obj, index) => {
    if (obj.type === 'path' && obj.points && obj.points.length > 1) {
      const tol = eraserRadius + (obj.lineWidth || 3)
      if (isPointNearPath(coords, obj.points, tol)) {
        toDelete.push(index)
      }
      return
    }

    const bounds = getObjectBounds(obj)
    if (!bounds) return

    // 计算橡皮擦圆心到对象边界框最近点的距离（非 path 仍用 bbox 快速近似）
    const closestX = Math.max(bounds.x, Math.min(coords.x, bounds.x + bounds.width))
    const closestY = Math.max(bounds.y, Math.min(coords.y, bounds.y + bounds.height))

    const dx = coords.x - closestX
    const dy = coords.y - closestY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < eraserRadius) {
      toDelete.push(index)
    }
  })

  // 删除对象
  if (toDelete.length > 0) {
    objects.value = objects.value.filter((_, index) => !toDelete.includes(index))
    historyDirty = true
    saveState()
    render()
    // 第X步：通知父组件内容已变化
    emit('content-change')
  }
}

// 添加文本
const addText = (coords: { x: number; y: number }) => {
  const text = prompt('请输入文本：', '点击编辑文本')
  if (!text) return

  const textObj: DrawObject = {
    type: 'text',
    color: toolConfig.value.color || '#000000',
    lineWidth: 1,
    text,
    x: coords.x,
    y: coords.y,
    fontSize: toolConfig.value.size || 16,
  }

  objects.value.push(textObj)
  historyDirty = true
  saveState()
  render()
  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 保存状态到历史记录
const saveState = () => {
  // 如果当前不在历史记录末尾，删除后面的记录
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  // 保存当前状态（深拷贝）
  history.value.push(JSON.parse(JSON.stringify(objects.value)))
  historyIndex.value = history.value.length - 1

  // 限制历史记录数量
  if (history.value.length > 20) {
    history.value.shift()
    historyIndex.value--
  }

  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 撤销
const undo = () => {
  if (!canUndo.value) return

  historyIndex.value--
  objects.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  historyDirty = true
  render()
  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 重做
const redo = () => {
  if (!canRedo.value) return

  historyIndex.value++
  objects.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  historyDirty = true
  render()
  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 清空画布确认弹窗状态
const clearDialogRef = ref<InstanceType<typeof Dialog>>()

// 实际执行清空逻辑
const performClearCanvas = () => {
  // 清空对象列表
  objects.value = []

  // 清空选择状态
  selectedObjects.value.clear()
  selectionBox.value = null

  // 保存状态并重新渲染
  saveState()
  historyDirty = true
  render()
  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 清空画布：先弹出确认对话框
const clearCanvas = () => {
  clearDialogRef.value?.openDialog()
}

// 确认清空
const handleConfirmClear = () => {
  clearDialogRef.value?.closeDialog()
  performClearCanvas()
}

// 取消清空
const handleCancelClear = () => {
  clearDialogRef.value?.closeDialog()
}

// 工具切换
const handleToolChange = (tool: string) => {
  // 切换工具前，清空选择状态
  if (currentTool.value === 'select') {
    selectedObjects.value.clear()
    selectionBox.value = null
  }

  currentTool.value = tool
  hoveredObject.value = null

  // 切换工具时，如果Signature Pad有内容，清空它
  if (signaturePad && currentTool.value !== 'draw') {
    signaturePad.clear()
  }

  // 更新光标样式
  if (liveCanvasRef.value) {
    liveCanvasRef.value.style.cursor = tool === 'hand' ? 'grab' : 'crosshair'
  }

  historyDirty = true
  render()
}

// 配置变化
const handleConfigChange = (config: { [key: string]: string | number | boolean | undefined }) => {
  const next = {
    ...toolConfig.value,
    ...config,
  }

  // 如果有强制画笔颜色，忽略外部传入的 color，始终使用 forcePenColor
  if (props.forcePenColor) {
    next.color = props.forcePenColor
  }

  toolConfig.value = next

  // 更新 Signature Pad 配置
  if (signaturePad) {
    if (config.color) {
      signaturePad.penColor = config.color as string
    }
    if (config.size) {
      signaturePad.minWidth = (config.size as number) * 0.5
      signaturePad.maxWidth = (config.size as number) * 1.5
    }
  }
}

// 缩放控制
const zoomIn = () => {
  // 边界检查
  if (zoomLevel.value >= 3) {
    console.warn('[DrawingBoard] zoomIn: 已达最大缩放，忽略。当前=', zoomLevel.value)
    return
  }
  // 更新缩放
  const before = zoomLevel.value
  zoomLevel.value = Math.min(3, zoomLevel.value + 0.1)
  // 记录缩放变化
  console.warn('[DrawingBoard] zoomIn: 触发点击，缩放从', before, '到', zoomLevel.value)
  // viewport 变化需要重绘
  historyDirty = true
  scheduleRender()
}

const zoomOut = () => {
  // 边界检查
  if (zoomLevel.value <= 0.1) {
    console.warn('[DrawingBoard] zoomOut: 已达最小缩放，忽略。当前=', zoomLevel.value)
    return
  }
  // 更新缩放
  const before = zoomLevel.value
  zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1)
  // 记录缩放变化
  console.warn('[DrawingBoard] zoomOut: 触发点击，缩放从', before, '到', zoomLevel.value)
  // viewport 变化需要重绘
  historyDirty = true
  scheduleRender()
}

// 监控缩放变化并记录应用到样式的transform
watch(zoomLevel, (val, oldVal) => {
  console.warn('[DrawingBoard] zoomLevel变更:', oldVal, '=>', val)
})

// viewport 变化：需要触发重绘（history 重新按新的 viewport 渲染）
watch(
  () => zoomLevel.value,
  () => {
    historyDirty = true
    scheduleRender()
  },
)

watch(
  () => canvasOffset.value,
  () => {
    historyDirty = true
    scheduleRender()
  },
  { deep: true },
)

// 键盘事件处理
const handleKeyDown = (e: KeyboardEvent) => {
  // Delete键：删除选中的对象
  if (e.key === 'Delete' && currentTool.value === 'select' && selectedObjects.value.size > 0) {
    e.preventDefault()

    // 删除选中的对象（从后往前删除避免索引问题）
    const indicesToDelete = Array.from(selectedObjects.value).sort((a, b) => b - a)
    indicesToDelete.forEach((index) => {
      objects.value.splice(index, 1)
    })

    // 清空选择状态
    selectedObjects.value.clear()

    // 保存状态并重新渲染
    saveState()
    render()
  }

  // Escape键：取消选择
  if (e.key === 'Escape' && currentTool.value === 'select') {
    e.preventDefault()
    selectedObjects.value.clear()
    selectionBox.value = null
    render()
  }

  // Ctrl/Cmd + A：全选所有对象
  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && currentTool.value === 'select') {
    e.preventDefault()
    selectedObjects.value = new Set(objects.value.map((_, index) => index))
    render()
  }
}

// 生命周期
onMounted(() => {
  // 流程：初始化画布
  initCanvas()

  // 流程：添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // 流程：清理资源
  ctx = null
  liveCtx = null

  if (rafRenderId !== null) {
    window.cancelAnimationFrame(rafRenderId)
    rafRenderId = null
    renderScheduled = false
  }

  // 流程：清理单指延迟定时器
  if (singleTouchTimer !== null) {
    clearTimeout(singleTouchTimer)
    singleTouchTimer = null
  }

  // 流程：移除键盘事件监听
  window.removeEventListener('keydown', handleKeyDown)
})

// 暴露方法给父组件
defineExpose({
  // 流程：保存当前绘图数据
  saveData: () => {
    return {
      objects: objects.value,
      history: history.value,
      historyIndex: historyIndex.value
    }
  },
  
  // 流程：加载绘图数据
  loadData: (data: { objects: DrawObject[]; history: DrawObject[][]; historyIndex: number }) => {
    objects.value = data.objects
    history.value = data.history
    historyIndex.value = data.historyIndex
    
    // 重置缩放和偏移
    zoomLevel.value = props.initialZoom ?? 1
    canvasOffset.value = { x: 0, y: 0 }
    
    // 重新渲染
    nextTick(() => {
      historyDirty = true
      render()
    })
  },
  
  // 流程：清空画布
  clearAll: () => {
    objects.value = []
    history.value = [[]]
    historyIndex.value = 0
    
    // 重置缩放和偏移
    zoomLevel.value = props.initialZoom ?? 1
    canvasOffset.value = { x: 0, y: 0 }

    historyDirty = true
    render()
  },
  
  // 流程：重置缩放和偏移
  resetZoom: () => {
    zoomLevel.value = props.initialZoom ?? 1
    canvasOffset.value = { x: 0, y: 0 }
  },
  
  // 流程：获取缩略图
  getThumbnail: (maxWidth = 200, maxHeight = 150): string => {
    // 检查canvas是否存在
    if (!historyCanvasRef.value) return ''

    // 确保 history 已是最新
    if (historyDirty) {
      render()
    }
    
    // 创建临时canvas生成缩略图
    const sourceCanvas = historyCanvasRef.value
    const overlayCanvas = liveCanvasRef.value
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return ''

    // 先合成一张完整画面（history + live）
    const compositeCanvas = document.createElement('canvas')
    compositeCanvas.width = sourceCanvas.width
    compositeCanvas.height = sourceCanvas.height
    const compositeCtx = compositeCanvas.getContext('2d')
    if (!compositeCtx) return ''
    compositeCtx.drawImage(sourceCanvas, 0, 0)
    if (overlayCanvas) {
      compositeCtx.drawImage(overlayCanvas, 0, 0)
    }
    
    // 计算缩放比例
    const scale = Math.min(maxWidth / compositeCanvas.width, maxHeight / compositeCanvas.height)
    tempCanvas.width = compositeCanvas.width * scale
    tempCanvas.height = compositeCanvas.height * scale
    
    // 绘制缩略图
    tempCtx.fillStyle = '#ffffff'
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    tempCtx.drawImage(compositeCanvas, 0, 0, tempCanvas.width, tempCanvas.height)
    
    // 返回base64数据
    return tempCanvas.toDataURL('image/png', 0.8)
  },

  // 流程：导出画布为 JPG 图片
  exportToJpg: (quality = 0.9): string => {
    // 检查canvas是否存在
    if (!historyCanvasRef.value) return ''

    // 确保 history 已是最新
    if (historyDirty) {
      render()
    }
    
    // 创建临时canvas（确保有白色背景）
    const sourceCanvas = historyCanvasRef.value
    const overlayCanvas = liveCanvasRef.value
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return ''
    
    // 设置临时canvas尺寸
    tempCanvas.width = sourceCanvas.width
    tempCanvas.height = sourceCanvas.height
    
    // 填充白色背景（JPG 不支持透明）
    tempCtx.fillStyle = '#ffffff'
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    
    // 绘制原canvas内容（history + live）
    tempCtx.drawImage(sourceCanvas, 0, 0)
    if (overlayCanvas) {
      tempCtx.drawImage(overlayCanvas, 0, 0)
    }
    
    // 返回 JPG base64 数据
    return tempCanvas.toDataURL('image/jpeg', quality)
  },

  // 流程：设置背景图片（动态）
  setBackgroundImage: (imageUrl: string): Promise<void> => {
    console.log('[DrawingBoard] setBackgroundImage called', {
      hasImage: !!imageUrl,
      length: imageUrl ? imageUrl.length : 0,
    })
    return loadBackgroundImage(imageUrl)
  },

  // 流程：获取画布是否有内容（背景图片或绘制对象）
  hasContent: (): boolean => {
    return backgroundLoaded.value || objects.value.length > 0
  }
})
</script>

<style scoped>
.canvas-demo-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #fafafb;
  position: relative;
  overflow: hidden;
}

/* 工具栏包装器（浮动在顶部） */
.toolbar-wrapper {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  z-index: 100;
  pointer-events: none;
  display: flex;
  justify-content: center;
}

.toolbar-wrapper :deep(.unified-toolbar-container) {
  pointer-events: auto;
  padding: 0;
}

/* 左侧垂直工具栏布局 */
.toolbar-wrapper-left {
  top: 16px;
  left: 16px;
  right: auto;
  bottom: 16px;
  width: auto;
  flex-direction: column;
  justify-content: center;
}

.toolbar-wrapper-left :deep(.unified-toolbar-container) {
  flex-direction: column;
}

/* 当工具栏在左侧时，画布容器需要左侧留出空间 */
.toolbar-left .canvas-wrapper {
  padding-top: 24px;
  padding-left: 80px;
}

/* 画布容器（占满整个对话框） */
.canvas-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 24px;
  padding-top: 80px;
  position: relative;
}

.canvas-container {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.02),
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 1px 3px rgba(0, 0, 0, 0.06);
  background-color: #ffffff;
  cursor: crosshair;
  transition: box-shadow 0.2s ease;
  will-change: transform;
}

 .canvas-history {
   z-index: 1;
 }

 .canvas-live {
   z-index: 2;
   background-color: transparent;
 }

.canvas-container:hover {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 2px 6px rgba(0, 0, 0, 0.08);
}

/* Signature Pad 画布样式 */
.signature-pad-canvas {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: auto;
  z-index: 10;
}

/* Excalidraw 风格浮动缩放控制面板 */
.zoom-control-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.04);
  z-index: 200; /* 提高层级，避免被带有 transform 的 canvas 叠盖 */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
}

.zoom-control-panel:hover {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 12px 32px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.06);
}

.zoom-btn {
  color: #6b6b6b;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  width: 32px;
  height: 32px;
}

.zoom-btn:hover:not(:disabled) {
  background-color: #f5f5f5;
  color: #1e1e1e;
}

.zoom-btn:active:not(:disabled) {
  background-color: #e8e8e8;
  transform: scale(0.96);
}

.zoom-btn:disabled {
color: #d1d1d1;
cursor: not-allowed;
}

.zoom-display {
color: #1e1e1e;
font-size: 13px;
font-weight: 500;
min-width: 50px;
text-align: center;
padding: 0 8px;
user-select: none;
letter-spacing: -0.01em;
}

.pf-config-help {
margin-left: 6px;
color: #9aa0a6;
}

.pf-config-desc {
margin-top: 6px;
font-size: 12px;
line-height: 16px;
color: #6b6b6b;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .canvas-wrapper {
    padding: 16px;
    padding-top: 70px;
  }
  .toolbar-wrapper {
    top: 12px;
  }
  .zoom-control-panel {
    bottom: 0;
    right: 0;
    padding: 4px 6px;
    gap: 2px;
  }

  .zoom-btn {
    width: 28px;
    height: 28px;
  }

  .zoom-display {
    font-size: 12px;
    min-width: 45px;
    padding: 0 6px;
  }
}

/* ==================== 页面管理抽屉样式 ==================== */
/* 触发按钮 */
.pages-drawer-trigger {
  position: absolute;
  top: 80px;
  left: 16px;
  z-index: 150;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
  }
}

/* 抽屉对话框 */
.pages-drawer-dialog {
  :deep(.q-dialog__backdrop) {
    background: rgba(0, 0, 0, 0.3);
  }
}

/* 抽屉卡片 */
.pages-drawer-card {
  width: 320px;
  height: 100vh;
  max-height: 100vh;
  margin: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  
  .drawer-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    font-weight: 600;
  }
  
  .drawer-content {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
}

/* 草稿卡片 */
.draft-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgba(33, 150, 243, 0.5);
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
    transform: translateX(4px);
  }
  
  &.is-active {
    border-color: #2196f3;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    box-shadow: 0 2px 12px rgba(33, 150, 243, 0.3);
  }
}

/* 页面编号徽章（左侧，小字号） */
.page-number-badge {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.draft-card.is-active .page-number-badge {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
}

/* 草稿缩略图 */
.draft-thumbnail {
  flex: 1;
  height: 80px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* 删除按钮（右上角） */
.delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  background: rgba(255, 255, 255, 0.9);
  
  &:hover {
    background: white;
  }
}

.draft-card:hover .delete-btn {
  opacity: 1;
}

/* 新增页面卡片 */
.add-page-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border: 2px dashed rgba(33, 150, 243, 0.3);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(33, 150, 243, 0.02);
  
  &:hover {
    border-color: rgba(33, 150, 243, 0.6);
    background: rgba(33, 150, 243, 0.05);
    transform: scale(1.02);
  }
}

.add-page-text {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #2196f3;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .pages-drawer-trigger {
    background: rgba(30, 30, 30, 0.95);
  }
  
  .pages-drawer-card {
    background: #1e1e1e;
  }
  
  .draft-card {
    background: #2a2a2a;
    border-color: rgba(255, 255, 255, 0.1);
    
    &:hover {
      border-color: rgba(33, 150, 243, 0.5);
    }
    
    &.is-active {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
    }
  }
  
  .add-page-card {
    border-color: rgba(33, 150, 243, 0.3);
    background: rgba(33, 150, 243, 0.05);
    
    &:hover {
      background: rgba(33, 150, 243, 0.1);
    }
  }
}

/* 清空画布确认对话框样式 */
.clear-confirm-dialog {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #333333;
}

/* 底部工具栏插槽容器 */
.toolbar-bottom-wrapper {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
