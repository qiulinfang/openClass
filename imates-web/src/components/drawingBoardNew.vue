<template>
  <div class="sketchpad-wrapper">
    <div class="toolbar">
      <UnifiedToolbar
        :tools="toolbarTools"
        :selected-tool="toolbarSelectedTool"
        :tool-config="toolbarToolConfig"
        :tool-states="{ undo: canUndo, redo: canRedo }"
        variant="floating"
        orientation="horizontal"
        @tool-change="handleToolbarToolChange"
        @config-change="handleToolbarConfigChange"
        @undo="undo"
        @redo="redo"
        @clear="clearCanvas"
      ></UnifiedToolbar>
    </div>

    <div ref="containerRef" class="canvas-container" style="touch-action: none">
      <canvas
        ref="canvasRef"
        class="canvas-element"
        :class="cursorClass"
        @pointerdown="handlePointerDown"
        @wheel="handleWheel"
        @pointerleave="
          hoverPos = null;
          renderAll()
        "
        @pointerenter="renderAll()"
      ></canvas>

      <textarea
        v-if="inputState.visible"
        ref="textInputRef"
        v-model="inputState.text"
        class="text-input"
        :style="{
          left: inputState.x + 'px',
          top: inputState.y + 'px',
          fontSize: inputState.fontSize + 'px',
          color: inputState.color,
          height: inputState.height,
          minWidth: '50px',
        }"
        @blur="finishInput"
        @keydown.stop="handleInputKeydown"
        @input="autoResizeInput"
      ></textarea>
    </div>

    <div class="toast" :class="{ show: showToast }">已导出</div>

    <!-- 橡皮擦光标 -->
    <div
      v-if="currentMode === 'eraser-stroke' && eraserCursor.visible"
      class="eraser-cursor"
      :style="{
        left: eraserCursor.x + 'px',
        top: eraserCursor.y + 'px',
        width: eraserCursor.size + 'px',
        height: eraserCursor.size + 'px'
      }"
    ></div>

    <!-- 缩放控制浮动框 -->
    <div class="zoom-control-panel">
      <button class="zoom-btn zoom-out" @click="zoomOut" :disabled="camera.zoom <= MIN_ZOOM">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      
      <div class="zoom-display" @click="fitToScreen">
        {{ Math.round(camera.zoom * 100) }}%
      </div>
      
      <button class="zoom-btn zoom-in" @click="zoomIn" :disabled="camera.zoom >= MAX_ZOOM">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      
      <button class="zoom-btn zoom-fit" @click="fitToContent" title="适应内容">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10,17 15,12 10,7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import UnifiedToolbar from './UnifiedToolbar.vue'

const emit = defineEmits<{
  clear: [],
  contentChange: []
}>()

const props = defineProps({
  backgroundImage: { type: String, default: '' },
  fitBackground: { type: Boolean, default: false },
})

// --- 引用与状态 ---
const canvasRef = ref(null)
const containerRef = ref(null)
const textInputRef = ref(null)

const currentMode = ref('draw')
const currentColor = ref('#212529')
const currentSize = ref(3)
const currentOpacity = ref(1)
const selectMode = ref('rectangle') // 选择模式：rectangle 或 freeform

const hoverPos = ref(null) // 用于渲染实时光标（如橡皮擦圆圈）
const showToast = ref(false)

const backgroundImg = ref(null)
const backgroundLoaded = ref(false)

// 橡皮擦光标状态
const eraserCursor = reactive({
  visible: false,
  x: 0,
  y: 0,
  size: 0
})

// 记录不同工具的配置状态，防止切换时混淆
const toolStates = reactive({
  draw: { color: '#212529', size: 3, opacity: 1 },
  highlighter: { color: '#ffc107', size: 12, opacity: 0.4 },
  rectangle: { color: '#212529', size: 3, opacity: 1 },
  circle: { color: '#212529', size: 3, opacity: 1 },
  line: { color: '#212529', size: 3, opacity: 1 },
  triangle: { color: '#212529', size: 3, opacity: 1 },
  text: { color: '#212529', size: 16, opacity: 1 },
  'eraser-stroke': { color: '#ffffff', size: 15, opacity: 1 },
})

const toolbarTools = {
  middle: [
    'undo',
    'redo',
    'clear',
    'hand',
    'select',
    'draw',
    'highlighter',
    'eraser-stroke',
    'shape',
  ],
}

const toolbarSelectedTool = computed(() => {
  return currentMode.value
})

const toolbarToolConfig = ref({
  color: currentColor.value,
  size: currentSize.value,
  opacity: currentOpacity.value,
  selectMode: selectMode.value,
})

watch(currentColor, (v) => {
  toolbarToolConfig.value = { ...toolbarToolConfig.value, color: v }
})

watch(currentSize, (v) => {
  toolbarToolConfig.value = { ...toolbarToolConfig.value, size: v }
})

watch(currentOpacity, (v) => {
  toolbarToolConfig.value = { ...toolbarToolConfig.value, opacity: v }
})

watch(selectMode, (v) => {
  toolbarToolConfig.value = { ...toolbarToolConfig.value, selectMode: v }
})

function handleToolbarToolChange(tool) {
  // 1. 保存当前模式的配置到对应状态中
  if (toolStates[currentMode.value]) {
    toolStates[currentMode.value] = {
      color: currentColor.value,
      size: currentSize.value,
      opacity: currentOpacity.value,
    }
  }

  // 2. 恢复目标模式之前的配置
  if (toolStates[tool]) {
    currentColor.value = toolStates[tool].color
    currentSize.value = toolStates[tool].size
    currentOpacity.value = toolStates[tool].opacity
  }

  return setMode(tool)
}

function handleToolbarConfigChange(cfg) {
  if (cfg?.color) {
    if (cfg.color !== currentColor.value) {
      currentColor.value = cfg.color
      if (['eraser-stroke', 'select', 'hand'].includes(currentMode.value)) setMode('draw')
    }
  }
  if (typeof cfg?.size === 'number') {
    currentSize.value = cfg.size
  }
  if (typeof cfg?.opacity === 'number') {
    currentOpacity.value = cfg.opacity
  }
  if (cfg?.selectMode) {
    selectMode.value = cfg.selectMode
  }

  // 同步更新到 toolStates 中，确保切换回来时是最后一次设置的值
  if (toolStates[currentMode.value]) {
    toolStates[currentMode.value] = {
      color: currentColor.value,
      size: currentSize.value,
      opacity: currentOpacity.value,
    }
  }
}

const inputState = reactive({
  visible: false,
  x: 0,
  y: 0,
  worldX: 0,
  worldY: 0,
  text: '',
  color: '#000000',
  fontSize: 16,
  height: 'auto',
})

// 核心数据
let ctx = null
let strokes = []
let history = []
const activePointers = new Map()
let activeAction = null
const historyStep = ref(-1)
const MAX_HISTORY = 40

const camera = reactive({ x: 0, y: 0, zoom: 1 })
const MIN_ZOOM = 0.01
const MAX_ZOOM = 10.0

const isSpacePressed = ref(false)
let resizeTimer = null

// 加载背景图片
function loadBackgroundImage(url) {
  if (!url) {
    backgroundImg.value = null
    backgroundLoaded.value = false
    renderAll()
    return
  }
  const img = new Image()
  img.onload = () => {
    backgroundImg.value = img
    backgroundLoaded.value = true
    if (props.fitBackground) {
      // 如果需要适应背景，可以调整相机位置或缩放
      // 这里简单处理：重置相机
      camera.x = 0
      camera.y = 0
      camera.zoom = 1
    }
    renderAll()
  }
  img.src = url
}

watch(
  () => props.backgroundImage,
  (newUrl) => {
    loadBackgroundImage(newUrl)
  },
  { immediate: true },
)

// 多选状态
const selectedIndices = reactive(new Set())
let groupBounds = null // 选中物体的整体包围盒
let selectionRect = null // 框选时的临时矩形
let activeHandle = null // 当前拖拽的控制点

// 计算属性
const canUndo = computed(() => historyStep.value >= 0)
const canRedo = computed(() => historyStep.value < history.length - 1)

const cursorClass = computed(() => {
  if (isSpacePressed.value || (activeAction && activeAction.type === 'pan'))
    return 'cursor-grabbing'
  if (isSpacePressed.value || currentMode.value === 'hand') return 'cursor-grab'
  if (currentMode.value === 'eraser-stroke') return 'cursor-none' // 隐藏默认光标，使用自定义指示器
  if (activeHandle) {
    if (activeHandle === 'nw' || activeHandle === 'se') return 'nwse-resize'
    if (activeHandle === 'ne' || activeHandle === 'sw') return 'nesw-resize'
    if (activeHandle === 'n' || activeHandle === 's') return 'ns-resize'
    if (activeHandle === 'w' || activeHandle === 'e') return 'ew-resize'
  }
  if (currentMode.value === 'select') return 'cursor-default'
  if (currentMode.value === 'text') return 'cursor-text'
  return 'cursor-crosshair'
})

// --- 坐标与辅助函数 ---
function screenToWorld(sx, sy) {
  if (!canvasRef.value) return { x: 0, y: 0 }
  const rect = canvasRef.value.getBoundingClientRect()
  const x = (sx - rect.left - camera.x) / camera.zoom
  const y = (sy - rect.top - camera.y) / camera.zoom
  return { x, y }
}

function worldToScreen(wx, wy) {
  if (!canvasRef.value) return { x: 0, y: 0 }
  const sx = wx * camera.zoom + camera.x
  const sy = wy * camera.zoom + camera.y
  return { x: sx, y: sy }
}

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

function getCenter(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
}

function getGroupBounds(indices) {
  if (!indices || indices.size === 0) return null
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  indices.forEach((idx) => {
    const s = strokes[idx]
    if (s.bounds) {
      minX = Math.min(minX, s.bounds.minX)
      minY = Math.min(minY, s.bounds.minY)
      maxX = Math.max(maxX, s.bounds.maxX)
      maxY = Math.max(maxY, s.bounds.maxY)
    }
  })
  if (minX === Infinity) return null
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

// --- 渲染引擎 ---
function resizeCanvas() {
  if (!containerRef.value || !canvasRef.value) return
  const dpr = window.devicePixelRatio || 1
  const rect = containerRef.value.getBoundingClientRect()
  const canvasWidth = rect.width
  const canvasHeight = rect.height

  if (
    canvasRef.value.width !== canvasWidth * dpr ||
    canvasRef.value.height !== canvasHeight * dpr
  ) {
    canvasRef.value.width = canvasWidth * dpr
    canvasRef.value.height = canvasHeight * dpr
    canvasRef.value.style.width = `${canvasWidth}px`
    canvasRef.value.style.height = `${canvasHeight}px`
    renderAll()
  }
}

function drawGrid(ctx, width, height) {
  const zoom = camera.zoom
  const step = 20 * zoom
  let gridSize = 20
  if (step < 5) return
  if (step < 10) gridSize = 100
  if (step < 2) gridSize = 500

  const offsetX = camera.x % (gridSize * zoom)
  const offsetY = camera.y % (gridSize * zoom)

  ctx.beginPath()
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1

  for (let x = offsetX; x < width; x += gridSize * zoom) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }
  for (let y = offsetY; y < height; y += gridSize * zoom) {
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()

  // 原点
  const originX = camera.x
  const originY = camera.y
  if (originX > -50 && originX < width + 50 && originY > -50 && originY < height + 50) {
    ctx.beginPath()
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 2
    ctx.moveTo(originX - 10, originY)
    ctx.lineTo(originX + 10, originY)
    ctx.moveTo(originX, originY - 10)
    ctx.lineTo(originX, originY + 10)
    ctx.stroke()
  }
}

function drawStrokeToContext(targetCtx, obj) {
  if (!obj.type || obj.type === 'stroke') {
    if (obj.points.length === 0) return
    targetCtx.beginPath()
    targetCtx.lineWidth = obj.size
    targetCtx.lineCap = 'round'
    targetCtx.lineJoin = 'round'
    targetCtx.strokeStyle = obj.mode === 'eraser' ? '#f9fafb' : obj.color
    targetCtx.globalAlpha = obj.opacity ?? 1

    if (obj.points.length < 2) {
      targetCtx.moveTo(obj.points[0].x, obj.points[0].y)
      targetCtx.lineTo(obj.points[0].x, obj.points[0].y)
    } else {
      targetCtx.moveTo(obj.points[0].x, obj.points[0].y)
      for (let i = 1; i < obj.points.length - 1; i++) {
        const p1 = obj.points[i]
        const p2 = obj.points[i + 1]
        const midX = (p1.x + p2.x) / 2
        const midY = (p1.y + p2.y) / 2
        targetCtx.quadraticCurveTo(p1.x, p1.y, midX, midY)
      }
      const last = obj.points[obj.points.length - 1]
      targetCtx.lineTo(last.x, last.y)
    }
    targetCtx.stroke()
    targetCtx.globalAlpha = 1
  } else if (obj.type === 'text') {
    targetCtx.font = `${obj.size * 5}px sans-serif`
    targetCtx.fillStyle = obj.color
    targetCtx.textBaseline = 'top'
    const lines = obj.text.split('\n')
    const lineHeight = obj.size * 5 * 1.2
    lines.forEach((line, i) => {
      targetCtx.fillText(line, obj.x, obj.y + i * lineHeight)
    })
    // 更新文本Bounds
    const maxWidth = Math.max(...lines.map((l) => targetCtx.measureText(l).width))
    obj.bounds = {
      minX: obj.x,
      maxX: obj.x + maxWidth,
      minY: obj.y,
      maxY: obj.y + lines.length * lineHeight,
    }
  } else if (obj.type === 'rectangle') {
    targetCtx.strokeStyle = obj.color
    targetCtx.lineWidth = obj.size
    targetCtx.globalAlpha = obj.opacity ?? 1
    targetCtx.strokeRect(obj.x, obj.y, obj.width, obj.height)
    targetCtx.globalAlpha = 1
  } else if (obj.type === 'circle') {
    targetCtx.strokeStyle = obj.color
    targetCtx.lineWidth = obj.size
    targetCtx.globalAlpha = obj.opacity ?? 1
    targetCtx.beginPath()
    targetCtx.arc(
      obj.x + obj.width / 2,
      obj.y + obj.height / 2,
      Math.abs(obj.width / 2),
      0,
      Math.PI * 2,
    )
    targetCtx.stroke()
    targetCtx.globalAlpha = 1
  } else if (obj.type === 'triangle') {
    targetCtx.strokeStyle = obj.color
    targetCtx.lineWidth = obj.size
    targetCtx.globalAlpha = obj.opacity ?? 1
    targetCtx.beginPath()
    targetCtx.moveTo(obj.x + obj.width / 2, obj.y)
    targetCtx.lineTo(obj.x + obj.width, obj.y + obj.height)
    targetCtx.lineTo(obj.x, obj.y + obj.height)
    targetCtx.closePath()
    targetCtx.stroke()
    targetCtx.globalAlpha = 1
  } else if (obj.type === 'line') {
    targetCtx.strokeStyle = obj.color
    targetCtx.lineWidth = obj.size
    targetCtx.lineCap = 'round'
    targetCtx.globalAlpha = obj.opacity ?? 1
    targetCtx.beginPath()
    targetCtx.moveTo(obj.x, obj.y)
    targetCtx.lineTo(obj.x + obj.width, obj.y + obj.height)
    targetCtx.stroke()
    targetCtx.globalAlpha = 1
  }
}

function renderAll() {
  if (!ctx || !canvasRef.value) return
  const dpr = window.devicePixelRatio || 1
  const width = canvasRef.value.width
  const height = canvasRef.value.height

  // 清空
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#f9fafb'
  ctx.fillRect(0, 0, width, height)

  drawGrid(ctx, width, height)

  ctx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, camera.x * dpr, camera.y * dpr)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // 绘制背景图
  if (backgroundImg.value && backgroundLoaded.value) {
    ctx.drawImage(backgroundImg.value, 0, 0)
  }

  strokes.forEach((obj, index) => {
    drawStrokeToContext(ctx, obj)
  })

  // 绘制框选矩形
  if (selectionRect) {
    drawSelectionRect(selectionRect)
  }

  // 绘制自由框选路径
  if (activeAction && activeAction.type === 'freeform_select' && activeAction.path) {
    drawFreeformPath(activeAction.path)
  }

  // 绘制变换控制框
  if (selectedIndices.size > 0 && currentMode.value === 'select') {
    groupBounds = getGroupBounds(selectedIndices)
    if (groupBounds) {
      drawTransformControls(groupBounds)
    }
  }
}

function drawSelectionRect(rect) {
  ctx.save()
  ctx.strokeStyle = '#3b82f6'
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
  ctx.lineWidth = 1 / camera.zoom
  // 框选通常不需要虚线，实线更清晰
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

function drawFreeformPath(path) {
  if (!path || path.length < 2) return
  
  ctx.save()
  ctx.strokeStyle = '#3b82f6'
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
  ctx.lineWidth = 2 / camera.zoom
  
  // 绘制路径
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y)
  }
  ctx.closePath()
  
  // 填充和描边
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawTransformControls(b) {
  const zoom = camera.zoom
  const padding = 5 / zoom
  const handleSize = 8 / zoom
  const minX = b.minX - padding
  const minY = b.minY - padding
  const width = b.width + padding * 2
  const height = b.height + padding * 2
  const maxX = minX + width
  const maxY = minY + height
  const midX = minX + width / 2
  const midY = minY + height / 2

  ctx.save()
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1 / zoom
  ctx.setLineDash([4 / zoom, 4 / zoom])
  ctx.strokeRect(minX, minY, width, height)
  ctx.restore()

  // 绘制8个控制点
  const handles = [
    { x: minX, y: minY, type: 'nw' },
    { x: midX, y: minY, type: 'n' },
    { x: maxX, y: minY, type: 'ne' },
    { x: maxX, y: midY, type: 'e' },
    { x: maxX, y: maxY, type: 'se' },
    { x: midX, y: maxY, type: 's' },
    { x: minX, y: maxY, type: 'sw' },
    { x: minX, y: midY, type: 'w' },
  ]

  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1 / zoom

  handles.forEach((h) => {
    ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
    ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
  })
}

// --- 碰撞检测升级 ---
function getHandleAtPosition(wx, wy) {
  if (!groupBounds || selectedIndices.size === 0) return null
  const zoom = camera.zoom
  const padding = 5 / zoom
  const handleSize = 8 / zoom
  const hitRadius = Math.max(10 / zoom, handleSize) // 扩大点击区域

  const minX = groupBounds.minX - padding
  const minY = groupBounds.minY - padding
  const width = groupBounds.width + padding * 2
  const height = groupBounds.height + padding * 2
  const maxX = minX + width
  const maxY = minY + height
  const midX = minX + width / 2
  const midY = minY + height / 2

  const handles = [
    { x: minX, y: minY, type: 'nw' },
    { x: midX, y: minY, type: 'n' },
    { x: maxX, y: minY, type: 'ne' },
    { x: maxX, y: midY, type: 'e' },
    { x: maxX, y: maxY, type: 'se' },
    { x: midX, y: maxY, type: 's' },
    { x: minX, y: maxY, type: 'sw' },
    { x: minX, y: midY, type: 'w' },
  ]

  for (const h of handles) {
    if (Math.abs(wx - h.x) <= hitRadius && Math.abs(wy - h.y) <= hitRadius) {
      return h.type
    }
  }
  return null
}

function hitTest(wx, wy, extraRadius = 0) {
  // 倒序检测，优先选中最上层的
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i]
    const padding =
      (s.type === 'text' ? 10 : Math.max(s.size, 5)) / camera.zoom + 5 + extraRadius / camera.zoom
    const expand = s.type === 'text' ? 0 : s.size / 2

    // 粗略检测包围盒
    if (
      wx < s.bounds.minX - padding - expand ||
      wx > s.bounds.maxX + padding + expand ||
      wy < s.bounds.minY - padding - expand ||
      wy > s.bounds.maxY + padding + expand
    ) {
      continue
    }

    if (s.type === 'text') {
      return i
    } else if (['rectangle', 'circle', 'triangle', 'line'].includes(s.type)) {
      // 形状碰撞检测
      const threshold = s.size / 2 + 10 / camera.zoom + extraRadius / camera.zoom
      if (s.type === 'rectangle') {
        const dLeft = Math.abs(wx - s.x)
        const dRight = Math.abs(wx - (s.x + s.width))
        const dTop = Math.abs(wy - s.y)
        const dBottom = Math.abs(wy - (s.y + s.height))

        const inX = wx >= s.x - threshold && wx <= s.x + s.width + threshold
        const inY = wy >= s.y - threshold && wy <= s.y + s.height + threshold

        if (inX && inY) {
          if (dLeft < threshold || dRight < threshold || dTop < threshold || dBottom < threshold)
            return i
        }
      } else if (s.type === 'circle') {
        const centerX = s.x + s.width / 2
        const centerY = s.y + s.height / 2
        const radius = Math.abs(s.width / 2)
        const dist = Math.sqrt((wx - centerX) ** 2 + (wy - centerY) ** 2)
        if (Math.abs(dist - radius) < threshold) return i
      } else if (s.type === 'triangle') {
        const p1 = { x: s.x + s.width / 2, y: s.y }
        const p2 = { x: s.x + s.width, y: s.y + s.height }
        const p3 = { x: s.x, y: s.y + s.height }

        if (distToSegment(wx, wy, p1, p2) < threshold) return i
        if (distToSegment(wx, wy, p2, p3) < threshold) return i
        if (distToSegment(wx, wy, p3, p1) < threshold) return i
      } else if (s.type === 'line') {
        const p1 = { x: s.x, y: s.y }
        const p2 = { x: s.x + s.width, y: s.y + s.height }
        if (distToSegment(wx, wy, p1, p2) < threshold) return i
      }
    } else {
      const threshold = s.size / 2 + 10 / camera.zoom + extraRadius / camera.zoom
      const thresholdSq = threshold * threshold

      if (s.points.length === 1) {
        const p = s.points[0]
        const distSq = (wx - p.x) ** 2 + (wy - p.y) ** 2
        if (distSq < thresholdSq) return i
      } else {
        for (let j = 0; j < s.points.length - 1; j++) {
          const p1 = s.points[j]
          const p2 = s.points[j + 1]

          // 点到线段距离平方
          const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
          let distSq = 0
          if (l2 === 0) {
            distSq = (wx - p1.x) ** 2 + (wy - p1.y) ** 2
          } else {
            let t = ((wx - p1.x) * (p2.x - p1.x) + (wy - p1.y) * (p2.y - p1.y)) / l2
            t = Math.max(0, Math.min(1, t))
            distSq = (wx - (p1.x + t * (p2.x - p1.x))) ** 2 + (wy - (p1.y + t * (p2.y - p1.y))) ** 2
          }

          if (distSq < thresholdSq) return i
        }
      }
    }
  }
  return -1
}

// 辅助函数：点到线段距离
function distToSegment(wx, wy, p1, p2) {
  const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
  if (l2 === 0) return Math.sqrt((wx - p1.x) ** 2 + (wy - p1.y) ** 2)
  let t = ((wx - p1.x) * (p2.x - p1.x) + (wy - p1.y) * (p2.y - p1.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.sqrt((wx - (p1.x + t * (p2.x - p1.x))) ** 2 + (wy - (p1.y + t * (p2.y - p1.y))) ** 2)
}

// 检测矩形框选中的物体
function hitTestRect(rect) {
  const indices = []
  const minX = Math.min(rect.x, rect.x + rect.w)
  const maxX = Math.max(rect.x, rect.x + rect.w)
  const minY = Math.min(rect.y, rect.y + rect.h)
  const maxY = Math.max(rect.y, rect.y + rect.h)

  strokes.forEach((s, i) => {
    // 简单的包围盒包含检测
    if (
      s.bounds.minX >= minX &&
      s.bounds.maxX <= maxX &&
      s.bounds.minY >= minY &&
      s.bounds.maxY <= maxY
    ) {
      indices.push(i)
    }
    // 或者相交检测 (可选，这里用包含逻辑更符合习惯)
  })
  return indices
}

// 检测自由框选路径内的物体
function hitTestFreeform(path) {
  if (!path || path.length < 3) return []
  
  const indices = []
  
  strokes.forEach((s, i) => {
    // 检测物体的包围盒4个角点是否有任何一个在路径内
    const corners = [
      { x: s.bounds.minX, y: s.bounds.minY }, // 左上
      { x: s.bounds.maxX, y: s.bounds.minY }, // 右上
      { x: s.bounds.maxX, y: s.bounds.maxY }, // 右下
      { x: s.bounds.minX, y: s.bounds.maxY }, // 左下
    ]
    
    // 只要有一个角点在路径内就选中
    const isInside = corners.some(corner => isPointInPolygon(corner.x, corner.y, path))
    
    if (isInside) {
      indices.push(i)
    }
  })
  
  return indices
}

 // 判断点是否在选择框范围内（用于整体拖动）
 function isPointInSelectionBounds(x, y) {
   if (!groupBounds || selectedIndices.size === 0) return false
 
   const zoom = camera.zoom
   const padding = 5 / zoom
   const minX = groupBounds.minX - padding
   const minY = groupBounds.minY - padding
   const width = groupBounds.width + padding * 2
   const height = groupBounds.height + padding * 2
   const maxX = minX + width
   const maxY = minY + height
 
   return x >= minX && x <= maxX && y >= minY && y <= maxY
 }

// 判断点是否在多边形内（射线法）
function isPointInPolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// --- 历史记录 ---
function saveState() {
  const snapshot = JSON.stringify(strokes)
  if (historyStep.value < history.length - 1) {
    history = history.slice(0, historyStep.value + 1)
  }
  if (history.length >= MAX_HISTORY) {
    history.shift()
    historyStep.value--
  }
  history.push(snapshot)
  historyStep.value++
}

function undo() {
  if (historyStep.value > 0) {
    historyStep.value--
    loadState(history[historyStep.value])
  }
}

function redo() {
  if (historyStep.value < history.length - 1) {
    historyStep.value++
    loadState(history[historyStep.value])
  }
}

function loadState(jsonStr) {
  try {
    strokes = JSON.parse(jsonStr)
    selectedIndices.clear()
    groupBounds = null
    renderAll()
  } catch (e) {
    console.error(e)
  }
}

// --- 交互逻辑 ---
function handlePointerDown(e) {
  if (inputState.visible) return
  canvasRef.value.setPointerCapture(e.pointerId)
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  // 双指手势
  if (activePointers.size === 2) {
    if (activeAction && activeAction.type === 'draw') strokes.pop()
    const pts = Array.from(activePointers.values())
    activeAction = {
      type: 'gesture',
      startDist: getDistance(pts[0], pts[1]),
      startZoom: camera.zoom,
      startCenter: getCenter(pts[0], pts[1]),
      startCamera: { ...camera },
    }
    return
  }
  if (activePointers.size > 2) return

  const worldPos = screenToWorld(e.clientX, e.clientY)

  // 空格或手势工具平移
  if (isSpacePressed.value || currentMode.value === 'hand') {
    activeAction = { type: 'pan', lastPos: { x: e.clientX, y: e.clientY } }
    return
  }

  // 插入文本
  if (currentMode.value === 'text') {
    startTextInput(worldPos.x, worldPos.y)
    return
  }

  // 选择模式
  if (currentMode.value === 'select') {
    // 0. 已有选区时，优先允许在蓝框内整体拖动（但控制点缩放优先级更高）
    if (selectedIndices.size > 0 && groupBounds && isPointInSelectionBounds(worldPos.x, worldPos.y)) {
      // 注意：如果点在控制点上，后面会被 resize 覆盖
      activeAction = {
        type: 'move',
        lastPos: worldPos,
      }
      renderAll()
      // 不 return，让控制点检测有机会覆盖
    }

    // 1. 优先检测控制点 (缩放)
    const handle = getHandleAtPosition(worldPos.x, worldPos.y)
    if (handle) {
      activeHandle = handle
      activeAction = {
        type: 'resize',
        handle: handle,
        startPos: worldPos,
        startBounds: { ...groupBounds },
        // 深拷贝选中物体，用于基准计算
        snapshotStrokes: Array.from(selectedIndices).map((i) =>
          JSON.parse(JSON.stringify(strokes[i])),
        ),
      }
      return
    }

    // 如果前面已进入 move（蓝框内拖动），这里直接结束
    if (activeAction && activeAction.type === 'move') {
      return
    }

    // 2. 检测点击物体
    const hitIndex = hitTest(worldPos.x, worldPos.y)

    if (hitIndex !== -1) {
      // 点击了物体
      if (!selectedIndices.has(hitIndex)) {
        // 如果点击了未选中的，且没有按Shift(暂不支持Shift连选)，则清空重选
        selectedIndices.clear()
        selectedIndices.add(hitIndex)
      }
      // 如果点击了已选中的，准备移动
      activeAction = {
        type: 'move',
        lastPos: worldPos,
      }
      renderAll()
    } else {
      // 3. 点击了空地 -> 框选
      selectedIndices.clear() // 清除现有选择
      if (selectMode.value === 'freeform') {
        // 自由框选
        activeAction = {
          type: 'freeform_select',
          path: [worldPos],
        }
      } else {
        // 矩形框选
        activeAction = {
          type: 'box_select',
          startPos: worldPos,
        }
        selectionRect = { x: worldPos.x, y: worldPos.y, w: 0, h: 0 }
      }
      renderAll()
    }
  } else if (currentMode.value === 'eraser-stroke') {
    // 橡皮擦模式：点击即删除
    const hitIndex = hitTest(worldPos.x, worldPos.y, currentSize.value / 2)
    if (hitIndex !== -1) {
      strokes.splice(hitIndex, 1)
      saveState()
      renderAll()
    }
    // 同时也支持拖拽擦除，所以设置 activeAction
    activeAction = { type: 'erase' }
  } else if (['rectangle', 'circle', 'triangle', 'line'].includes(currentMode.value)) {
    // 形状模式
    selectedIndices.clear()
    groupBounds = null
    activeAction = {
      type: 'shape',
      shapeType: currentMode.value,
      startPos: worldPos,
    }
  } else {
    // 绘图模式
    selectedIndices.clear()
    groupBounds = null
    const newStroke = {
      type: 'stroke',
      points: [{ x: worldPos.x, y: worldPos.y }],
      color: currentColor.value,
      size: currentSize.value,
      opacity: currentOpacity.value,
      mode: currentMode.value,
      bounds: { minX: worldPos.x, maxX: worldPos.x, minY: worldPos.y, maxY: worldPos.y },
    }
    strokes.push(newStroke)
    activeAction = { type: 'draw', stroke: newStroke }
    renderAll()
  }
}

function handlePointerMove(e) {
  const wp = screenToWorld(e.clientX, e.clientY)
  hoverPos.value = wp

  // 更新橡皮擦光标位置
  if (currentMode.value === 'eraser-stroke') {
    const screenPos = worldToScreen(wp.x, wp.y)
    eraserCursor.x = screenPos.x - currentSize.value * camera.zoom / 2
    eraserCursor.y = screenPos.y - currentSize.value * camera.zoom / 2
    eraserCursor.size = currentSize.value * camera.zoom
    eraserCursor.visible = true
  } else {
    eraserCursor.visible = false
  }

  if (!activePointers.has(e.pointerId)) return
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (!activeAction) {
    // 更新鼠标悬停样式
    if (currentMode.value === 'select') {
      const wp = screenToWorld(e.clientX, e.clientY)
      activeHandle = getHandleAtPosition(wp.x, wp.y)

      if (activeHandle) {
        if (activeHandle.includes('nw') || activeHandle.includes('se')) {
          canvasRef.value.style.cursor = 'nwse-resize'
        } else if (activeHandle.includes('ne') || activeHandle.includes('sw')) {
          canvasRef.value.style.cursor = 'nesw-resize'
        } else if (activeHandle.includes('n') || activeHandle.includes('s')) {
          canvasRef.value.style.cursor = 'ns-resize'
        } else if (activeHandle.includes('e') || activeHandle.includes('w')) {
          canvasRef.value.style.cursor = 'ew-resize'
        }
      } else if (selectedIndices.size > 0 && groupBounds && isPointInSelectionBounds(wp.x, wp.y)) {
        canvasRef.value.style.cursor = 'move'
      } else {
        canvasRef.value.style.cursor = 'default'
      }
    }
    return
  }

  // use wp declared at top

  if (activeAction.type === 'gesture' && activePointers.size === 2) {
    // ... 缩放逻辑 (保持不变) ...
    const pts = Array.from(activePointers.values())
    const dist = getDistance(pts[0], pts[1])
    const center = getCenter(pts[0], pts[1])
    const scaleFactor = dist / activeAction.startDist
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, activeAction.startZoom * scaleFactor))
    const rect = canvasRef.value.getBoundingClientRect()
    const startCenterRel = {
      x: activeAction.startCenter.x - rect.left,
      y: activeAction.startCenter.y - rect.top,
    }
    const wx = (startCenterRel.x - activeAction.startCamera.x) / activeAction.startZoom
    const wy = (startCenterRel.y - activeAction.startCamera.y) / activeAction.startZoom
    const newCenterRel = { x: center.x - rect.left, y: center.y - rect.top }
    camera.zoom = newZoom
    camera.x = newCenterRel.x - wx * newZoom
    camera.y = newCenterRel.y - wy * newZoom
    renderAll()
  } else if (activeAction.type === 'pan') {
    const dx = e.clientX - activeAction.lastPos.x
    const dy = e.clientY - activeAction.lastPos.y
    camera.x += dx
    camera.y += dy
    activeAction.lastPos = { x: e.clientX, y: e.clientY }
    renderAll()
  } else if (activeAction.type === 'draw') {
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
    const stroke = activeAction.stroke
    events.forEach((ev) => {
      const p = screenToWorld(ev.clientX, ev.clientY)
      stroke.points.push(p)
      stroke.bounds.minX = Math.min(stroke.bounds.minX, p.x)
      stroke.bounds.maxX = Math.max(stroke.bounds.maxX, p.x)
      stroke.bounds.minY = Math.min(stroke.bounds.minY, p.y)
      stroke.bounds.maxY = Math.max(stroke.bounds.maxY, p.y)
    })
    renderAll()
  } else if (activeAction.type === 'move') {
    const dx = wp.x - activeAction.lastPos.x
    const dy = wp.y - activeAction.lastPos.y

    selectedIndices.forEach((idx) => {
      const obj = strokes[idx]
      if (obj.type === 'text') {
        obj.x += dx
        obj.y += dy
        obj.bounds.minX += dx
        obj.bounds.maxX += dx
        obj.bounds.minY += dy
        obj.bounds.maxY += dy
      } else if (['rectangle', 'circle', 'triangle', 'line'].includes(obj.type)) {
        obj.x += dx
        obj.y += dy
        obj.bounds.minX += dx
        obj.bounds.maxX += dx
        obj.bounds.minY += dy
        obj.bounds.maxY += dy
      } else {
        obj.points.forEach((p) => {
          p.x += dx
          p.y += dy
        })
        obj.bounds.minX += dx
        obj.bounds.maxX += dx
        obj.bounds.minY += dy
        obj.bounds.maxY += dy
      }
    })

    activeAction.lastPos = wp
    renderAll()
  } else if (activeAction.type === 'box_select') {
    const sx = activeAction.startPos.x
    const sy = activeAction.startPos.y
    selectionRect = {
      x: Math.min(sx, wp.x),
      y: Math.min(sy, wp.y),
      w: Math.abs(wp.x - sx),
      h: Math.abs(wp.y - sy),
    }
    renderAll()
  } else if (activeAction.type === 'freeform_select') {
    // 自由框选：添加路径点
    activeAction.path.push(wp)
    renderAll()
  } else if (activeAction.type === 'erase') {
    // 拖拽擦除
    const hitIndex = hitTest(wp.x, wp.y, currentSize.value / 2)
    if (hitIndex !== -1) {
      strokes.splice(hitIndex, 1)
      renderAll()
    }
  } else if (activeAction.type === 'shape') {
    // 形状绘制预览
    renderAll()
    // 绘制预览形状
    const x = Math.min(activeAction.startPos.x, wp.x)
    const y = Math.min(activeAction.startPos.y, wp.y)
    const width = Math.abs(wp.x - activeAction.startPos.x)
    const height = Math.abs(wp.y - activeAction.startPos.y)

    ctx.save()
    ctx.strokeStyle = currentColor.value
    ctx.lineWidth = currentSize.value
    ctx.globalAlpha = currentOpacity.value

    if (activeAction.shapeType === 'rectangle') {
      ctx.strokeRect(x, y, width, height)
    } else if (activeAction.shapeType === 'circle') {
      ctx.beginPath()
      ctx.arc(x + width / 2, y + height / 2, Math.abs(width / 2), 0, Math.PI * 2)
      ctx.stroke()
    } else if (activeAction.shapeType === 'triangle') {
      ctx.beginPath()
      ctx.moveTo(x + width / 2, y)
      ctx.lineTo(x + width, y + height)
      ctx.lineTo(x, y + height)
      ctx.closePath()
      ctx.stroke()
    } else if (activeAction.shapeType === 'line') {
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(activeAction.startPos.x, activeAction.startPos.y)
      ctx.lineTo(wp.x, wp.y)
      ctx.stroke()
    }

    ctx.restore()
  } else if (activeAction.type === 'resize') {
    handleResize(wp)
  }
}

function handleResize(currPos) {
  const { startBounds, handle, snapshotStrokes } = activeAction
  const indices = Array.from(selectedIndices)

  // 计算新包围盒
  const newBounds = { ...startBounds }
  const dx = currPos.x - activeAction.startPos.x
  const dy = currPos.y - activeAction.startPos.y

  // 根据拖拽的手柄调整边界
  if (handle.includes('e')) newBounds.width += dx
  if (handle.includes('s')) newBounds.height += dy
  if (handle.includes('w')) {
    newBounds.minX += dx
    newBounds.width -= dx
  }
  if (handle.includes('n')) {
    newBounds.minY += dy
    newBounds.height -= dy
  }

  // 重新计算maxX/Y，防止翻转导致的负尺寸 (简化处理：限制最小尺寸)
  if (newBounds.width < 10) {
    newBounds.width = 10
    if (handle.includes('w')) newBounds.minX = startBounds.maxX - 10
  }
  if (newBounds.height < 10) {
    newBounds.height = 10
    if (handle.includes('n')) newBounds.minY = startBounds.maxY - 10
  }
  newBounds.maxX = newBounds.minX + newBounds.width
  newBounds.maxY = newBounds.minY + newBounds.height

  // 计算缩放比例
  const scaleX = newBounds.width / startBounds.width
  const scaleY = newBounds.height / startBounds.height

  // 应用变换到所有选中物体
  indices.forEach((idx, i) => {
    const original = snapshotStrokes[i]
    const target = strokes[idx]

    if (target.type === 'text') {
      const relX = (original.x - startBounds.minX) / startBounds.width
      const relY = (original.y - startBounds.minY) / startBounds.height
      target.x = newBounds.minX + relX * newBounds.width
      target.y = newBounds.minY + relY * newBounds.height
      target.size = original.size * Math.min(Math.abs(scaleX), Math.abs(scaleY)) // 字体大小按比例
      // 更新Bounds
      // 这里的Bounds更新不精确，渲染时会重新计算准确的Text Bounds
      target.bounds.minX = target.x
      target.bounds.minY = target.y
    } else if (['rectangle', 'circle', 'triangle', 'line'].includes(target.type)) {
      const relX = (original.x - startBounds.minX) / startBounds.width
      const relY = (original.y - startBounds.minY) / startBounds.height
      target.x = newBounds.minX + relX * newBounds.width
      target.y = newBounds.minY + relY * newBounds.height
      target.width = original.width * scaleX
      target.height = original.height * scaleY
      // 更新线宽
      target.size = original.size * Math.min(Math.abs(scaleX), Math.abs(scaleY))
      // 更新Bounds
      target.bounds = {
        minX: Math.min(target.x, target.x + target.width),
        maxX: Math.max(target.x, target.x + target.width),
        minY: Math.min(target.y, target.y + target.height),
        maxY: Math.max(target.y, target.y + target.height),
      }
    } else {
      target.points = original.points.map((p) => {
        const relX = (p.x - startBounds.minX) / startBounds.width
        const relY = (p.y - startBounds.minY) / startBounds.height
        return {
          x: newBounds.minX + relX * newBounds.width,
          y: newBounds.minY + relY * newBounds.height,
        }
      })
      // 线宽跟随整体缩放
      target.size = (original.size * (Math.abs(scaleX) + Math.abs(scaleY))) / 2

      // 更新Bounds
      let bMinX = Infinity,
        bMinY = Infinity,
        bMaxX = -Infinity,
        bMaxY = -Infinity
      target.points.forEach((p) => {
        if (p.x < bMinX) bMinX = p.x
        if (p.x > bMaxX) bMaxX = p.x
        if (p.y < bMinY) bMinY = p.y
        if (p.y > bMaxY) bMaxY = p.y
      })
      target.bounds = { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY }
    }
  })
  renderAll()
}

function endAction(e) {
  activePointers.delete(e.pointerId)
  if (activePointers.size === 0) {
    if (activeAction) {
      if (activeAction.type === 'box_select') {
        // 完成矩形框选
        const indices = hitTestRect(selectionRect)
        selectedIndices.clear()
        indices.forEach((i) => selectedIndices.add(i))
        selectionRect = null
        renderAll()
      } else if (activeAction.type === 'freeform_select') {
        // 完成自由框选
        const indices = hitTestFreeform(activeAction.path)
        selectedIndices.clear()
        indices.forEach((i) => selectedIndices.add(i))
        renderAll()
      } else if (['draw', 'move', 'resize', 'erase'].includes(activeAction.type)) {
        saveState()
      } else if (activeAction.type === 'shape') {
        // 完成形状绘制
        const wp = screenToWorld(e.clientX, e.clientY)
        let x, y, width, height

        if (activeAction.shapeType === 'line') {
          // 直线需要保留方向
          x = activeAction.startPos.x
          y = activeAction.startPos.y
          width = wp.x - x
          height = wp.y - y
        } else {
          x = Math.min(activeAction.startPos.x, wp.x)
          y = Math.min(activeAction.startPos.y, wp.y)
          width = Math.abs(wp.x - activeAction.startPos.x)
          height = Math.abs(wp.y - activeAction.startPos.y)
        }

        // 只有当形状有一定大小时才添加
        if (Math.abs(width) > 2 || Math.abs(height) > 2) {
          const shape = {
            type: activeAction.shapeType,
            x,
            y,
            width,
            height,
            color: currentColor.value,
            size: currentSize.value,
            opacity: currentOpacity.value,
            bounds: {
              minX: Math.min(x, x + width),
              maxX: Math.max(x, x + width),
              minY: Math.min(y, y + height),
              maxY: Math.max(y, y + height),
            },
          }
          strokes.push(shape)
          saveState()
        }
        renderAll()
      }
    }
    activeAction = null
    activeHandle = null
  }
}

// --- 文本输入 (保持原有逻辑) ---
function startTextInput(worldX, worldY) {
  inputState.worldX = worldX
  inputState.worldY = worldY
  inputState.text = ''
  inputState.color = currentColor.value
  inputState.fontSize = currentSize.value * 5 * camera.zoom
  inputState.visible = true
  const screenPos = worldToScreen(worldX, worldY)
  inputState.x = screenPos.x
  inputState.y = screenPos.y
  nextTick(() => {
    if (textInputRef.value) textInputRef.value.focus()
  })
}

function finishInput() {
  if (!inputState.visible) return
  const text = inputState.text.trim()
  if (text) {
    strokes.push({
      type: 'text',
      x: inputState.worldX,
      y: inputState.worldY,
      text: text,
      color: inputState.color,
      size: currentSize.value,
      bounds: {
        minX: inputState.worldX,
        maxX: inputState.worldX,
        minY: inputState.worldY,
        maxY: inputState.worldY,
      },
    })
    saveState()
    renderAll()
  }
  inputState.visible = false
  inputState.text = ''
  inputState.height = 'auto'
}

function handleInputKeydown(e) {
  if (e.key === 'Escape') finishInput()
}

function autoResizeInput(e) {
  e.target.style.height = 'auto'
  inputState.height = e.target.scrollHeight + 'px'
}

// --- 通用事件 ---
function handleWheel(e) {
  e.preventDefault()
  const zoomIntensity = 0.1
  const delta = -Math.sign(e.deltaY)
  const scale = Math.exp(delta * zoomIntensity)
  const oldZoom = camera.zoom
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * scale))
  const rect = canvasRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  const wx = (mouseX - camera.x) / oldZoom
  const wy = (mouseY - camera.y) / oldZoom
  camera.x = mouseX - wx * newZoom
  camera.y = mouseY - wy * newZoom
  camera.zoom = newZoom
  renderAll()
}

function handleKeydown(e) {
  if (inputState.visible) return
  if (e.code === 'Space' && !isSpacePressed.value) isSpacePressed.value = true
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault()
      undo()
    }
    if (e.key === 'y' || e.key === 'Y') {
      e.preventDefault()
      redo()
    }
  }
  if (e.key === 'v' || e.key === 'V') setMode('select')
  if (e.key === 'p' || e.key === 'P') handleToolbarToolChange('draw')
  if (e.key === 'h' || e.key === 'H') handleToolbarToolChange('highlighter')
  if (e.key === 'e' || e.key === 'E') setMode('eraser-stroke')
  if (e.key === 't' || e.key === 'T') setMode('text')

  // 删除功能
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndices.size > 0) {
    // 降序删除
    const indices = Array.from(selectedIndices).sort((a: number, b: number) => b - a)
    indices.forEach((i) => strokes.splice(i, 1))
    selectedIndices.clear()
    groupBounds = null
    saveState()
    renderAll()
  }
}

function handleKeyup(e) {
  if (e.code === 'Space') {
    isSpacePressed.value = false
    if (activeAction && activeAction.type === 'pan' && !activePointers.size) activeAction = null
  }
}

function setMode(mode) {
  currentMode.value = mode
  if (mode !== 'select') {
    selectedIndices.clear()
    groupBounds = null
    renderAll()
  }
}

function onColorChange(e) {
  currentColor.value = e.target.value
  if (['eraser', 'select', 'hand'].includes(currentMode.value)) setMode('draw')
}

function zoomIn() {
  if (camera.zoom >= MAX_ZOOM) return
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  zoomToPoint(centerX, centerY, camera.zoom * 1.2)
}

function zoomOut() {
  if (camera.zoom <= MIN_ZOOM) return
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  zoomToPoint(centerX, centerY, camera.zoom / 1.2)
}

function fitToScreen() {
  if (!containerRef.value) return
  
  const rect = containerRef.value.getBoundingClientRect()
  const targetWidth = rect.width
  const targetHeight = rect.height
  
  // 计算适合屏幕的缩放比例
  const scaleX = targetWidth / (targetWidth / camera.zoom)
  const scaleY = targetHeight / (targetHeight / camera.zoom)
  const newZoom = Math.min(scaleX, scaleY, MAX_ZOOM)
  
  camera.zoom = Math.max(newZoom, MIN_ZOOM)
  camera.x = 0
  camera.y = 0
  renderAll()
}

function fitToContent() {
  if (strokes.length === 0) {
    fitToScreen()
    return
  }
  
  // 计算所有笔迹的边界
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  strokes.forEach(stroke => {
    if (stroke.bounds) {
      minX = Math.min(minX, stroke.bounds.minX)
      minY = Math.min(minY, stroke.bounds.minY)
      maxX = Math.max(maxX, stroke.bounds.maxX)
      maxY = Math.max(maxY, stroke.bounds.maxY)
    }
  })
  
  if (minX === Infinity) {
    fitToScreen()
    return
  }
  
  // 添加边距
  const padding = 50
  const contentWidth = maxX - minX + padding * 2
  const contentHeight = maxY - minY + padding * 2
  
  if (!containerRef.value) return
  const containerRect = containerRef.value.getBoundingClientRect()
  
  // 计算适合内容的缩放比例
  const scaleX = containerRect.width / contentWidth
  const scaleY = containerRect.height / contentHeight
  const newZoom = Math.min(scaleX, scaleY, MAX_ZOOM)
  
  camera.zoom = Math.max(newZoom, MIN_ZOOM)
  // 居中内容
  camera.x = containerRect.width / 2 - (minX + maxX) / 2 * camera.zoom
  camera.y = containerRect.height / 2 - (minY + maxY) / 2 * camera.zoom
  
  renderAll()
}

function zoomToPoint(clientX, clientY, newZoom) {
  const oldZoom = camera.zoom
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  
  const wx = (clientX - rect.left - camera.x) / oldZoom
  const wy = (clientY - rect.top - camera.y) / oldZoom
  
  camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))
  camera.x = clientX - rect.left - wx * camera.zoom
  camera.y = clientY - rect.top - wy * camera.zoom
  
  renderAll()
}

function saveImage() {
  if (strokes.length === 0) {
    alert('画布为空')
    return
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  strokes.forEach((s) => {
    if (s.mode === 'eraser') return
    if (s.bounds) {
      minX = Math.min(minX, s.bounds.minX)
      minY = Math.min(minY, s.bounds.minY)
      maxX = Math.max(maxX, s.bounds.maxX)
      maxY = Math.max(maxY, s.bounds.maxY)
    }
  })
  if (minX === Infinity) {
    minX = 0
    minY = 0
    maxX = 100
    maxY = 100
  }
  const padding = 40
  const width = maxX - minX + padding * 2
  const height = maxY - minY + padding * 2
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const tCtx = tempCanvas.getContext('2d')
  tCtx.fillStyle = '#ffffff'
  tCtx.fillRect(0, 0, width, height)
  tCtx.translate(-minX + padding, -minY + padding)
  tCtx.lineCap = 'round'
  tCtx.lineJoin = 'round'
  strokes.forEach((s) => drawStrokeToContext(tCtx, s))
  const link = document.createElement('a')
  link.download = `sketch_export_${Date.now()}.png`
  link.href = tempCanvas.toDataURL('image/png')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  showToast.value = true
  setTimeout(() => (showToast.value = false), 2000)
}

// --- 生命周期 ---
onMounted(() => {
  ctx = canvasRef.value.getContext('2d', { alpha: false })
  resizeCanvas()
  saveState()
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resizeCanvas, 100)
  })
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', endAction)
  window.addEventListener('pointercancel', endAction)
  window.addEventListener('pointerout', (e) => {
    if (e.target === document.body) endAction(e)
  })
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', endAction)
  window.removeEventListener('pointercancel', endAction)
  window.removeEventListener('pointerout', endAction)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
})

// --- 暴露给父组件的方法 ---
const saveData = () => {
  return {
    objects: strokes,
    history,
    historyIndex: historyStep.value,
  }
}

const loadData = (data) => {
  strokes = data.objects
  history = data.history
  historyStep.value = data.historyIndex
  renderAll()
}

const getThumbnail = (width, height) => {
  // 计算绘图内容的边界
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  strokes.forEach((s) => {
    if (s.mode === 'eraser') return
    if (s.bounds) {
      minX = Math.min(minX, s.bounds.minX)
      minY = Math.min(minY, s.bounds.minY)
      maxX = Math.max(maxX, s.bounds.maxX)
      maxY = Math.max(maxY, s.bounds.maxY)
    }
  })
  if (minX === Infinity) {
    // 空画布，返回空白缩略图
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/png')
  }
  const padding = 20
  const contentWidth = maxX - minX + padding * 2
  const contentHeight = maxY - minY + padding * 2
  const scale = Math.min(width / contentWidth, height / contentHeight)
  const thumbCanvas = document.createElement('canvas')
  thumbCanvas.width = width
  thumbCanvas.height = height
  const thumbCtx = thumbCanvas.getContext('2d')
  thumbCtx.fillStyle = '#ffffff'
  thumbCtx.fillRect(0, 0, width, height)
  thumbCtx.save()
  thumbCtx.translate(padding, padding)
  thumbCtx.scale(scale, scale)
  thumbCtx.translate(-minX, -minY)
  strokes.forEach((s) => drawStrokeToContext(thumbCtx, s))
  thumbCtx.restore()
  return thumbCanvas.toDataURL('image/png')
}

defineExpose({
  saveData,
  loadData,
  getThumbnail,
})
</script>
<style scoped>
/* 样式复用之前的，新增光标样式 */
.sketchpad-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

.canvas-element {
  display: block;
  background-color: #ffffff;
  width: 100%;
  height: 100%;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.text-input {
  position: absolute;
  background-color: transparent;
  border: 1px dashed #3b82f6;
  outline: none;
  padding: 0;
  margin: 0;
  resize: none;
  overflow: hidden;
  z-index: 20;
  font-family: sans-serif;
  line-height: 1.2;
  color: black;
  min-width: 50px;
}

.toolbar {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 98%;
  max-width: 768px;
  z-index: 10;
}

.toolbar-section {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.toolbar-center {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
  min-width: 100px;
}
.size-control {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100px;
}
.size-slider {
  width: 100%;
  height: 4px;
  background-color: #e5e7eb;
  border-radius: 8px;
  appearance: none;
  cursor: pointer;
}
.toolbar-separator {
  width: 1px;
  height: 32px;
  background-color: #e5e7eb;
  flex-shrink: 0;
}
.toolbar-separator-small {
  width: 1px;
  height: 32px;
  background-color: #e5e7eb;
  margin: 0 4px;
}
.tool-btn {
  padding: 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background-color: transparent;
  transition: all 0.2s;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tool-btn:hover {
  background-color: #f3f4f6;
}
.tool-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none;
}
.tool-btn.active {
  background-color: #e5e7eb;
  color: #000000;
  transform: translateY(-2px);
  border-color: #3b82f6;
}
.clear-btn {
  color: #ef4444;
}
.save-btn {
  color: #2563eb;
}
.color-wrapper {
  position: relative;
  overflow: hidden;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  cursor: pointer;
}
input[type='color'] {
  position: absolute;
  left: -50%;
  top: -50%;
  width: 200%;
  height: 200%;
  cursor: pointer;
  padding: 0;
  border: none;
}
input[type='range'] {
  accent-color: #374151;
}
.toast {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  padding: 4px 16px;
  border-radius: 9999px;
  font-size: 12px;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 50;
  opacity: 0;
}
.toast.show {
  opacity: 1;
}

.cursor-crosshair {
  cursor: crosshair;
}
.cursor-text {
  cursor: text;
}
.cursor-default {
  cursor: default;
}
.cursor-grab {
  cursor: grab;
}
.cursor-grabbing {
  cursor: grabbing;
}
.nwse-resize {
  cursor: nwse-resize;
}
.nesw-resize {
  cursor: nesw-resize;
}
.ns-resize {
  cursor: ns-resize;
}
.ew-resize {
  cursor: ew-resize;
}

/* 橡皮擦光标样式 */
.eraser-cursor {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  pointer-events: none;
  z-index: 30;
  box-sizing: border-box;
  background-color: rgba(0, 0, 0, 0.05);
}

/* 缩放控制面板样式 */
.zoom-control-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  padding: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 40;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #666666;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.zoom-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
  color: #333333;
}

.zoom-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.zoom-display {
  min-width: 48px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  color: #333333;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.zoom-display:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #000000;
}

.zoom-fit {
  margin-left: 2px;
}

.toolbar::-webkit-scrollbar {
  display: none;
}
.toolbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
