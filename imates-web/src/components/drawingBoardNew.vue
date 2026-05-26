<template>
  <div class="sketchpad-wrapper">
    <div
      v-if="showToolbar"
      class="toolbar"
      :class="{ 'toolbar--bottom': props.toolbarPosition === 'bottom' }"
    >
      <div class="toolbar-slot toolbar-slot--left">
        <slot name="toolbar-left" />
      </div>

      <div class="toolbar-center">
        <Toolbar
          :tools="toolbarTools"
          :selected-tool="toolbarSelectedTool"
          :tool-config="toolbarToolConfig"
          :tool-states="{ undo: canUndo, redo: canRedo }"
          :allow-popup="props.allowPopup"
          variant="floating"
          orientation="horizontal"
          @tool-change="handleToolbarToolChange"
          @config-change="handleToolbarConfigChange"
          @undo="undo"
          @redo="redo"
          @clear="showClearConfirm = true"
          @insert-image="triggerImageSelect"
        ></Toolbar>
      </div>

      <div class="toolbar-slot toolbar-slot--right">
        <slot name="toolbar-right" />
      </div>
    </div>

    <!-- 清空确认弹窗 -->
    <Dialog
      v-model="showClearConfirm"
      title="确认清空"
      confirm-button-text="清空"
      cancel-button-text="取消"
      @confirm="confirmClearAll"
      @cancel="showClearConfirm = false"
    >
      确定要清空画板上的所有内容吗？此操作不可撤销。
    </Dialog>

    <!-- 画布容器 -->
    <div
      ref="containerRef"
      class="canvas-container"
      style="touch-action: none"
      @pointerdown="handleAskAiPointerDown"
      @pointermove="handleAskAiPointerMove"
      @pointerup="handleAskAiPointerUp"
      @pointercancel="handleAskAiPointerUp"
      @pointerleave="handleAskAiPointerUp"
    >
      <!-- 历史层：绘制背景、网格、已完成的笔画 (交互事件透传) -->
      <canvas ref="historyCanvasRef" class="canvas-layer canvas-history"></canvas>

      <!-- 实时层：绘制正在画的线、选框、控制手柄 (接收交互事件) -->
      <canvas
        ref="liveCanvasRef"
        class="canvas-layer canvas-live"
        :class="cursorClass"
        style="touch-action: none"
        @pointerdown="handlePointerDown"
        @wheel="handleWheel"
        @pointerleave="handlePointerLeave"
        @pointerenter="renderLive()"
      ></canvas>

      <!-- 问问学伴截图框选遮罩 -->
      <div
        v-if="currentMode === 'askAi' && askAiDragRect"
        class="ask-ai-screenshot-overlay"
        :style="getAskAiRectStyle(askAiDragRect)"
      ></div>

      <svg
        v-if="
          currentMode === 'askAi' &&
          selectMode === 'freeform' &&
          askAiDragPath &&
          askAiDragPath.length
        "
        class="ask-ai-freeform-overlay"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          :d="askAiFreeformPathD"
          fill="rgba(110, 85, 255, 0.12)"
          stroke="#6e55ff"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>

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

      <button
        v-if="selectedImageDeleteButtonVisible"
        class="image-delete-btn"
        type="button"
        :style="selectedImageDeleteButtonStyle"
        @pointerdown.stop
        @click.stop="handleDeleteSelectedImage"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>

    <div class="toast" :class="{ show: showToast }">已导出</div>

    <!-- 橡皮擦光标 (DOM层) -->
    <div
      v-if="currentMode === 'eraser-stroke' && eraserCursor.visible"
      class="eraser-cursor"
      :style="{
        left: eraserCursor.x + 'px',
        top: eraserCursor.y + 'px',
        width: eraserCursor.size + 'px',
        height: eraserCursor.size + 'px',
      }"
    ></div>

    <!-- 缩放控制浮动框 -->
    <div v-if="showZoomControls" class="zoom-control-panel">
      <button class="zoom-btn zoom-out" @click="zoomOut" :disabled="camera.zoom <= MIN_ZOOM">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <CommonSelect
        class="zoom-select"
        :options="zoomPresetOptions"
        :model-value="zoomPresetModelValue"
        @change="handleZoomPresetChange"
      >
        <template #label> {{ Math.round(camera.zoom * 100) }}% </template>
      </CommonSelect>

      <button class="zoom-btn zoom-in" @click="zoomIn" :disabled="camera.zoom >= MAX_ZOOM">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      <button class="zoom-btn zoom-fit" @click="fitToContent" title="适应内容">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="8 3 3 3 3 8"></polyline>
          <polyline points="16 3 21 3 21 8"></polyline>
          <polyline points="8 21 3 21 3 16"></polyline>
          <polyline points="16 21 21 21 21 16"></polyline>
        </svg>
      </button>
    </div>

    <!-- 调试面板 -->
    <div v-if="isDev" class="debug-panel">
      <label> <input type="checkbox" v-model="showDebugPanel" /> 调试面板 </label>
      <div v-if="showDebugPanel">
        <div>
          <label
            >X: <input type="number" v-model.number="backgroundOrigin.x" @input="requestRenderAll"
          /></label>
        </div>
        <div>
          <label
            >Y: <input type="number" v-model.number="backgroundOrigin.y" @input="requestRenderAll"
          /></label>
        </div>
        <div>
          <button @click="updateBackgroundOrigin">重置为居中靠上</button>
        </div>
      </div>
    </div>

    <!-- 增加 overlay 插槽，允许外部注入覆盖层（如裁剪组件） -->
    <slot name="overlay" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ZOOM_PRESET_OPTIONS } from '../constants/options'
import Toolbar from './Toolbar.vue'
import CommonSelect from './base/Select.vue'
import Dialog from './base/Dialog.vue'
import ScreenshotInputDialog from './dialog/ImageProcessorDialog .vue'
import { showMessage } from '@/utils'
import type { AttachedScreenshot } from '@/types'
import { useImagePicker } from '../composables/useImagePicker'

const emit = defineEmits<{
  (e: 'clear'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'save', data: { objects: any[]; history: any[]; historyIndex: number }): void
  (e: 'tool-change', tool: string): void
  (
    e: 'ask-ai-image-selected',
    imageInfo: {
      filePath: string
      width: number
      height: number
      fileSize: number
      base64DataUrl?: string
    }
  ): void
}>()
// 组件属性定义
const props = defineProps({
  // === 背景与画布配置 ===
  // 背景图片URL
  backgroundImage: { type: String, default: '' },
  // 背景图片位置：'center' 或 'topLeft'
  backgroundPosition: { type: String as () => 'center' | 'topLeft', default: 'center' },
  // 是否自适应包含背景图 (contain 模式)
  backgroundContain: { type: Boolean, default: false },
  // 是否自适应背景图大小
  fitBackground: { type: Boolean, default: false },
  // 是否启用缓冲区（1.2倍画布尺寸），若为 false 则 Canvas 与容器 1:1
  enableBuffer: { type: Boolean, default: true },
  // 初始缩放比例
  initialZoom: { type: Number, default: 1 },
  // 是否显示网格
  showGrid: { type: Boolean, default: true },

  // === 工具与交互配置 ===
  // 覆盖工具栏显示的工具列表（可选）
  tools: { type: Array as () => string[], default: undefined },
  // 强制画笔颜色
  forcePenColor: { type: String, default: undefined },
  // 是否启用AI问答功能
  enableAskAi: { type: Boolean, default: false },
  // 是否允许工具栏弹出配置面板
  allowPopup: { type: Boolean, default: true },

  // === 界面显示控制 ===
  // 是否显示工具栏（默认显示）
  showToolbar: { type: Boolean, default: true },
  // 工具栏位置：'top'(默认), 'bottom'
  toolbarPosition: { type: String as () => 'top' | 'bottom', default: 'top' },
  // 是否显示缩放控制（默认显示）
  showZoomControls: { type: Boolean, default: true },
  // 是否禁用画板交互
  disabled: { type: Boolean, default: false },
})
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

const { pickImage } = useImagePicker()

// --- 引用与状态 ---
// 双 Canvas 引用
const historyCanvasRef = ref<HTMLCanvasElement | null>(null)
const liveCanvasRef = ref<HTMLCanvasElement | null>(null)

const containerRef = ref<HTMLDivElement | null>(null)
const textInputRef = ref<HTMLTextAreaElement | null>(null)

const currentMode = ref('draw')
const currentColor = ref('#212529')
const currentSize = ref(2)
const currentOpacity = ref(1)
const selectMode = ref('rectangle')

const hoverPos = ref<{ x: number; y: number } | null>(null)
const showToast = ref(false)
const showDebugPanel = ref(false)

const backgroundImg = ref<HTMLImageElement | null>(null)
const backgroundLoaded = ref(false)
const backgroundOrigin = reactive({ x: 0, y: 0 })
const backgroundScale = ref(1)

function updateBackgroundOrigin() {
  if (!backgroundImg.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  // 注意：Canvas 的尺寸在 resizeCanvas 中根据 enableBuffer 进行了放大
  const bufferScale = props.enableBuffer ? 1.2 : 1.0
  const canvasWidth = rect.width * bufferScale
  const canvasHeight = rect.height * bufferScale

  const imgWidth = backgroundImg.value.naturalWidth || backgroundImg.value.width
  const imgHeight = backgroundImg.value.naturalHeight || backgroundImg.value.height

  if (props.backgroundContain) {
    // Contain 模式：保持宽高比，缩放到刚好完全显示在容器内
    const scaleX = canvasWidth / imgWidth
    const scaleY = canvasHeight / imgHeight
    const scale = Math.min(scaleX, scaleY)

    backgroundScale.value = scale

    // 居中计算
    backgroundOrigin.x = (canvasWidth - imgWidth * scale) / 2
    backgroundOrigin.y = (canvasHeight - imgHeight * scale) / 2
  } else {
    // 默认行为：如果不使用 contain，则按原图 1:1 渲染
    backgroundScale.value = 1

    if (props.backgroundPosition === 'topLeft') {
      backgroundOrigin.x = 100
      backgroundOrigin.y = 100
    } else {
      // 居中
      backgroundOrigin.x = (canvasWidth - imgWidth) / 2
      backgroundOrigin.y = (canvasHeight - imgHeight) / 2
    }
  }

  requestRenderAll()
}

// 橡皮擦光标
const eraserCursor = reactive({
  visible: false,
  x: 0,
  y: 0,
  size: 0,
})

// 工具状态配置
const toolStates = reactive({
  draw: { color: '#212529', size: 1.5, opacity: 1 },
  highlighter: { color: '#ffc107', size: 12, opacity: 0.4 },
  rectangle: { color: '#212529', size: 3, opacity: 1 },
  circle: { color: '#212529', size: 3, opacity: 1 },
  line: { color: '#212529', size: 3, opacity: 1 },
  triangle: { color: '#212529', size: 3, opacity: 1 },
  coordinate: { color: '#212529', size: 2, opacity: 1 },
  text: { color: '#212529', size: 16, opacity: 1 },
  'eraser-stroke': { color: '#ffffff', size: 15, opacity: 1 },
})

// 问问学伴截图相关状态
const askAiDragRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const askAiStartPoint = ref<{ x: number; y: number } | null>(null)
const askAiDragPath = ref<Point[] | null>(null)

const showClearConfirm = ref(false)

const confirmClearAll = () => {
  clearAll()
  showClearConfirm.value = false
}

interface Point {
  x: number
  y: number
}

const toolbarTools = computed(() => {
  if (props.tools) {
    return {
      middle: props.tools,
    }
  }
  return {
    middle: [
      'undo',
      'redo',
      'clear',
      'hand',
      'select',
      'draw',
      'highlighter',
      'eraser-stroke',
      'insertImage',
      'coordinate',
    ],
  }
})

const toolbarSelectedTool = computed(() => currentMode.value)

const toolbarToolConfig = ref({
  color: currentColor.value,
  size: currentSize.value,
  opacity: currentOpacity.value,
  selectMode: selectMode.value,
})

watch(
  () => props.forcePenColor,
  (newColor) => {
    if (newColor) {
      currentColor.value = newColor
      // 同步更新所有工具的状态，防止切换模式后颜色变回默认
      Object.keys(toolStates).forEach((key) => {
        if (toolStates[key]) {
          toolStates[key].color = newColor
        }
      })
    }
  },
  { immediate: true }
)

watch(currentColor, (v) => {
  if (props.forcePenColor && v !== props.forcePenColor) {
    currentColor.value = props.forcePenColor
    return
  }
  toolbarToolConfig.value.color = v
})
watch(currentSize, (v) => (toolbarToolConfig.value.size = v))
watch(currentOpacity, (v) => (toolbarToolConfig.value.opacity = v))
watch(selectMode, (v) => (toolbarToolConfig.value.selectMode = v))

function handleToolbarToolChange(tool) {
  console.log('[drawingBoardNew] handleToolbarToolChange:', tool)
  // 问问学伴工具：进入截图模式
  if (tool === 'askAi') {
    enterAskAiMode()
    return
  }

  // 裁剪工具：通知外部进入裁剪模式，不进入画板内部模式
  if (tool === 'crop') {
    console.log('[drawingBoardNew] 触发裁剪工具事件')
    emit('tool-change', 'crop')
    return
  }

  // 清空工具
  if (tool === 'clear') {
    console.log('[drawingBoardNew] 执行清空操作')
    clearAll()
    emit('clear')
    return
  }

  // 撤销/重做工具拦截
  if (tool === 'undo') {
    undo()
    emit('undo')
    return
  }
  if (tool === 'redo') {
    redo()
    emit('redo')
    return
  }

  if (toolStates[currentMode.value]) {
    toolStates[currentMode.value] = {
      color: currentColor.value,
      size: currentSize.value,
      opacity: currentOpacity.value,
    }
  }
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
  if (typeof cfg?.size === 'number') currentSize.value = cfg.size
  if (typeof cfg?.opacity === 'number') currentOpacity.value = cfg.opacity
  if (cfg?.selectMode) selectMode.value = cfg.selectMode

  if (toolStates[currentMode.value]) {
    toolStates[currentMode.value] = {
      color: currentColor.value,
      size: currentSize.value,
      opacity: currentOpacity.value,
    }
  }
}

function clearCanvas() {
  emit('clear')
}

// 文本输入状态
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

// --- 核心数据 ---
// 双 Context
let historyCtx: CanvasRenderingContext2D | null = null
let liveCtx: CanvasRenderingContext2D | null = null

const historyStep = ref(0)
const MAX_HISTORY = 40
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_SAVE_DELAY_MS = 800

const camera = reactive({ x: 0, y: 0, zoom: 1 })
const MIN_ZOOM = 0.01
const MAX_ZOOM = 10.0

const imageCache = new Map<string, HTMLImageElement>()

let strokes: any[] = []
let history: any[] = [JSON.stringify([])]
const activePointers = new Map()
let activeAction = null

function getCachedImage(dataUrl: string) {
  if (!dataUrl) return null
  const cached = imageCache.get(dataUrl)
  if (cached) return cached
  const img = new Image()
  img.src = dataUrl
  img.onload = () => requestRenderAll()
  imageCache.set(dataUrl, img)
  return img
}

function normalizeZoom(z: number) {
  let zoom = z
  if (typeof zoom !== 'number' || Number.isNaN(zoom) || zoom <= 0) zoom = 1
  if (zoom > 10) zoom = zoom / 100
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

function ensureBoundsForStroke(obj: any) {
  if (!obj) return
  if (obj.bounds) return

  if ((!obj.type || obj.type === 'stroke') && Array.isArray(obj.points) && obj.points.length) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    obj.points.forEach((p: any) => {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    })
    if (minX !== Infinity) obj.bounds = { minX, minY, maxX, maxY }
    return
  }
  if (
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number'
  ) {
    const minX = Math.min(obj.x, obj.x + obj.width)
    const maxX = Math.max(obj.x, obj.x + obj.width)
    const minY = Math.min(obj.y, obj.y + obj.height)
    const maxY = Math.max(obj.y, obj.y + obj.height)
    obj.bounds = { minX, minY, maxX, maxY }
    return
  }
  if (obj.type === 'image' && typeof obj.x === 'number' && typeof obj.y === 'number') {
    const w = typeof obj.width === 'number' ? obj.width : 0
    const h = typeof obj.height === 'number' ? obj.height : 0
    obj.bounds = { minX: obj.x, minY: obj.y, maxX: obj.x + w, maxY: obj.y + h }
    return
  }
  if (obj.type === 'text' && typeof obj.x === 'number' && typeof obj.y === 'number') {
    const fontSize = typeof obj.fontSize === 'number' ? obj.fontSize : 16
    const text = (obj.text || '').toString()
    const approxWidth = Math.max(1, text.length) * fontSize * 0.6
    obj.bounds = { minX: obj.x, minY: obj.y - fontSize, maxX: obj.x + approxWidth, maxY: obj.y }
  }
}

const zoomPresetOptions = ZOOM_PRESET_OPTIONS

const zoomPresetModelValue = computed(() => {
  const candidates = zoomPresetOptions
  const eps = 0.001
  const matched = candidates.find((o) => {
    const v = typeof o?.value === 'number' ? o.value : Number(o?.value)
    if (Number.isNaN(v)) return false
    return Math.abs(v - camera.zoom) < eps
  })
  if (!matched) return null
  return typeof matched.value === 'number' ? matched.value : Number(matched.value)
})

function handleZoomPresetChange(v: string | number | null) {
  if (typeof v !== 'number') return
  const rect = liveCanvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  zoomToPoint(centerX, centerY, v)
}

const isSpacePressed = ref(false)
let resizeTimer = null

function loadBackgroundImage(url) {
  if (!url) {
    backgroundImg.value = null
    backgroundLoaded.value = false
    renderHistory()
    return
  }
  const img = new Image()
  img.onload = () => {
    backgroundImg.value = img
    backgroundLoaded.value = true
    updateBackgroundOrigin()
    if (props.fitBackground) {
      camera.x = 0
      camera.y = 0
      camera.zoom = 1
    }
    renderHistory()
  }
  img.src = url
}

watch(() => props.backgroundImage, loadBackgroundImage, { immediate: true })

// 多选状态
const selectedIndices = reactive(new Set<number>())
let groupBounds = null
let selectionRect = null
let activeHandle = null

const canUndo = computed(() => {
  return historyStep.value > 0
})
const canRedo = computed(() => {
  const len = Array.isArray(history) ? history.length : 0
  return historyStep.value < len - 1
})

const cursorClass = computed(() => {
  if (isSpacePressed.value || (activeAction && activeAction.type === 'pan'))
    return 'cursor-grabbing'
  if (isSpacePressed.value || currentMode.value === 'hand') return 'cursor-grab'
  if (currentMode.value === 'eraser-stroke') return 'cursor-none'
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

const renderTick = ref(0)

// --- 坐标系统 ---
function screenToWorld(sx, sy) {
  if (!liveCanvasRef.value) return { x: 0, y: 0 }
  const rect = liveCanvasRef.value.getBoundingClientRect()

  // 获取相对于 Canvas 元素左上角的 client 坐标
  let localX = sx - rect.left
  let localY = sy - rect.top

  const x = (localX - camera.x) / camera.zoom
  const y = (localY - camera.y) / camera.zoom
  return { x, y }
}

function worldToScreen(wx, wy) {
  if (!liveCanvasRef.value) return { x: 0, y: 0 }
  const sx = wx * camera.zoom + camera.x
  const sy = wy * camera.zoom + camera.y
  return { x: sx, y: sy }
}

const selectedImageIndex = computed(() => {
  if (selectedIndices.size !== 1) return null
  const idx = Array.from(selectedIndices)[0]
  const obj = strokes[idx]
  if (!obj || obj.type !== 'image') return null
  return idx
})

const selectedImageDeleteButtonVisible = computed(() => {
  return selectedImageIndex.value !== null && !!containerRef.value
})

const selectedImageDeleteButtonStyle = computed(() => {
  renderTick.value
  const idx = selectedImageIndex.value
  if (idx === null) return {}
  const obj = strokes[idx]
  const bounds = obj?.bounds
  if (!bounds || typeof bounds.maxX !== 'number' || typeof bounds.minY !== 'number') return {}
  const pos = worldToScreen(bounds.maxX, bounds.minY)
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
})

function handleDeleteSelectedImage() {
  const idx = selectedImageIndex.value
  if (idx === null) return
  strokes.splice(idx, 1)
  selectedIndices.clear()
  groupBounds = null
  saveState()
  requestRenderAll()
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

// --- 渲染引擎 (核心分离) ---
function resizeCanvas() {
  if (!containerRef.value || !liveCanvasRef.value || !historyCanvasRef.value) return
  const dpr = window.devicePixelRatio || 1
  const rect = containerRef.value.getBoundingClientRect()

  // 根据 enableBuffer 决定放大系数
  const scale = props.enableBuffer ? 1.2 : 1.0
  const width = rect.width * scale
  const height = rect.height * scale

  // 调整两个 Canvas 的大小
  ;[liveCanvasRef.value, historyCanvasRef.value].forEach((cvs) => {
    if (cvs.width !== width * dpr || cvs.height !== height * dpr) {
      cvs.width = width * dpr
      cvs.height = height * dpr
      cvs.style.width = `${width}px`
      cvs.style.height = `${height}px`
    }
  })

  updateBackgroundOrigin()
  requestRenderAll()
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
}

function drawStrokeToContext(targetCtx, obj) {
  if (!obj) return
  if (!obj.type || obj.type === 'stroke') {
    if (!obj.points || obj.points.length === 0) return
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
      Math.PI * 2
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
  } else if (obj.type === 'coordinate') {
    targetCtx.strokeStyle = obj.color
    targetCtx.lineWidth = obj.size
    targetCtx.lineCap = 'round'
    targetCtx.lineJoin = 'round'
    targetCtx.globalAlpha = obj.opacity ?? 1

    const arrowSize = Math.max(10, obj.size * 5)
    const tickSize = Math.max(5, obj.size * 3)
    const tickInterval = Math.max(20, obj.size * 10)

    // 计算中心点（原点）
    const centerX = obj.x + obj.width / 2
    const centerY = obj.y + obj.height / 2

    // 绘制刻度线
    targetCtx.beginPath()
    targetCtx.lineWidth = Math.max(1, obj.size * 0.5)

    // X轴刻度（正方向）
    for (let x = centerX + tickInterval; x < obj.x + obj.width - arrowSize; x += tickInterval) {
      targetCtx.moveTo(x, centerY - tickSize / 2)
      targetCtx.lineTo(x, centerY + tickSize / 2)
    }
    // X轴刻度（负方向）
    for (let x = centerX - tickInterval; x > obj.x + arrowSize; x -= tickInterval) {
      targetCtx.moveTo(x, centerY - tickSize / 2)
      targetCtx.lineTo(x, centerY + tickSize / 2)
    }
    // Y轴刻度（正方向）
    for (let y = centerY + tickInterval; y < obj.y + obj.height - arrowSize; y += tickInterval) {
      targetCtx.moveTo(centerX - tickSize / 2, y)
      targetCtx.lineTo(centerX + tickSize / 2, y)
    }
    // Y轴刻度（负方向）
    for (let y = centerY - tickInterval; y > obj.y + arrowSize; y -= tickInterval) {
      targetCtx.moveTo(centerX - tickSize / 2, y)
      targetCtx.lineTo(centerX + tickSize / 2, y)
    }
    targetCtx.stroke()

    // 绘制坐标轴线
    targetCtx.lineWidth = obj.size
    targetCtx.beginPath()

    // X轴（水平线，穿过原点）
    targetCtx.moveTo(obj.x, centerY)
    targetCtx.lineTo(obj.x + obj.width, centerY)

    // Y轴（垂直线，穿过原点）
    targetCtx.moveTo(centerX, obj.y)
    targetCtx.lineTo(centerX, obj.y + obj.height)
    targetCtx.stroke()

    // 绘制箭头（实心三角形）- 只保留正方向
    const drawArrow = (x: number, y: number, angle: number) => {
      targetCtx.save()
      targetCtx.translate(x, y)
      targetCtx.rotate(angle)
      targetCtx.beginPath()
      targetCtx.moveTo(0, 0)
      targetCtx.lineTo(-arrowSize, -arrowSize / 2)
      targetCtx.lineTo(-arrowSize, arrowSize / 2)
      targetCtx.closePath()
      targetCtx.fillStyle = obj.color
      targetCtx.fill()
      targetCtx.restore()
    }

    // X轴正方向箭头（右端）
    drawArrow(obj.x + obj.width, centerY, 0)
    // Y轴正方向箭头（上端）
    drawArrow(centerX, obj.y, -Math.PI / 2)

    // 绘制原点标记
    const originRadius = Math.max(3, obj.size * 1.5)
    targetCtx.beginPath()
    targetCtx.arc(centerX, centerY, originRadius, 0, Math.PI * 2)
    targetCtx.fillStyle = obj.color
    targetCtx.fill()

    // 绘制轴标签
    const fontSize = Math.max(12, obj.size * 6)
    targetCtx.font = `${fontSize}px "Times New Roman", Georgia, serif`
    targetCtx.fillStyle = obj.color
    targetCtx.textAlign = 'center'
    targetCtx.textBaseline = 'middle'

    // X轴标签
    targetCtx.fillText('x', obj.x + obj.width - arrowSize / 2, centerY + arrowSize)
    // Y轴标签
    targetCtx.fillText('y', centerX + arrowSize, obj.y + arrowSize / 2)
    // 原点标签
    targetCtx.fillText('O', centerX - arrowSize / 2, centerY + arrowSize)

    targetCtx.globalAlpha = 1
  } else if (obj.type === 'image') {
    const dataUrl = obj.dataUrl
    if (!dataUrl) return
    const img = getCachedImage(dataUrl)
    if (!img || !img.complete) return
    const x = typeof obj.x === 'number' ? obj.x : 0
    const y = typeof obj.y === 'number' ? obj.y : 0
    const w = typeof obj.width === 'number' ? obj.width : img.naturalWidth
    const h = typeof obj.height === 'number' ? obj.height : img.naturalHeight
    targetCtx.globalAlpha = typeof obj.opacity === 'number' ? obj.opacity : 1
    targetCtx.drawImage(img, x, y, w, h)
    targetCtx.globalAlpha = 1
  }
}

// 渲染历史层（重绘成本高，只在必要时调用）
function renderHistory() {
  if (!historyCtx || !historyCanvasRef.value) return
  const dpr = window.devicePixelRatio || 1
  const width = historyCanvasRef.value.width
  const height = historyCanvasRef.value.height

  // 1. 清空 & 基础变换
  historyCtx.setTransform(1, 0, 0, 1, 0, 0)
  historyCtx.fillStyle = '#ffffff'
  historyCtx.fillRect(0, 0, width, height)

  // 2. 绘制网格
  if (props.showGrid) {
    drawGrid(historyCtx, width, height)
  }

  // 3. 应用相机变换
  historyCtx.setTransform(
    dpr * camera.zoom,
    0,
    0,
    dpr * camera.zoom,
    camera.x * dpr,
    camera.y * dpr
  )
  historyCtx.lineCap = 'round'
  historyCtx.lineJoin = 'round'

  // 4. 背景图
  if (backgroundImg.value && backgroundLoaded.value) {
    if (props.backgroundContain) {
      historyCtx.drawImage(
        backgroundImg.value,
        backgroundOrigin.x,
        backgroundOrigin.y,
        backgroundImg.value.naturalWidth * backgroundScale.value,
        backgroundImg.value.naturalHeight * backgroundScale.value
      )
    } else {
      historyCtx.drawImage(backgroundImg.value, backgroundOrigin.x, backgroundOrigin.y)
    }
  }

  // 5. 所有已完成对象
  if (!Array.isArray(strokes)) {
    strokes = []
  }
  // 先绘制图片（置于最底层）
  strokes.forEach((obj) => {
    if (obj.type === 'image') {
      drawStrokeToContext(historyCtx, obj)
    }
  })
  // 再绘制其他类型的笔画
  strokes.forEach((obj) => {
    if (obj.type !== 'image') {
      drawStrokeToContext(historyCtx, obj)
    }
  })
}

// 渲染实时层（轻量级，帧率高）
function renderLive() {
  if (!liveCtx || !liveCanvasRef.value) return
  const dpr = window.devicePixelRatio || 1
  const width = liveCanvasRef.value.width
  const height = liveCanvasRef.value.height

  // 1. 清空 Live 层
  liveCtx.setTransform(1, 0, 0, 1, 0, 0)
  liveCtx.clearRect(0, 0, width, height)

  // 2. 应用相机变换
  liveCtx.setTransform(dpr * camera.zoom, 0, 0, dpr * camera.zoom, camera.x * dpr, camera.y * dpr)
  liveCtx.lineCap = 'round'
  liveCtx.lineJoin = 'round'

  // 3. 绘制当前正在进行的动作 (笔画/形状)
  if (activeAction) {
    if (activeAction.type === 'draw' && activeAction.stroke) {
      drawStrokeToContext(liveCtx, activeAction.stroke)
    } else if (activeAction.type === 'shape') {
      // 形状预览
      const sx = activeAction.startPos.x
      const sy = activeAction.startPos.y
      // 注意：这里的 wp 需要在调用 renderLive 前更新到 activeAction 或作为参数
      // 这里简化处理：activeAction 中存储 currentPos
      const curr = activeAction.currentPos || activeAction.startPos

      let x, y, w, h
      if (activeAction.shapeType === 'line') {
        // 线条特殊处理
        drawStrokeToContext(liveCtx, {
          type: 'line',
          x: sx,
          y: sy,
          width: curr.x - sx,
          height: curr.y - sy,
          color: currentColor.value,
          size: currentSize.value,
          opacity: currentOpacity.value,
        })
      } else {
        x = Math.min(sx, curr.x)
        y = Math.min(sy, curr.y)
        w = Math.abs(curr.x - sx)
        h = Math.abs(curr.y - sy)
        drawStrokeToContext(liveCtx, {
          type: activeAction.shapeType,
          x,
          y,
          width: w,
          height: h,
          color: currentColor.value,
          size: currentSize.value,
          opacity: currentOpacity.value,
        })
      }
    } else if (activeAction.type === 'box_select') {
      if (selectionRect) drawSelectionRect(liveCtx, selectionRect)
    } else if (activeAction.type === 'freeform_select') {
      if (activeAction.path) drawFreeformPath(liveCtx, activeAction.path)
    }
  }

  // 4. 绘制选中框和控制点 (UI)
  if (selectedIndices.size > 0 && currentMode.value === 'select') {
    if (!groupBounds && selectedIndices.size > 0) {
      // 重新计算一次，防止为空
      groupBounds = getGroupBounds(selectedIndices)
    }
    if (groupBounds) {
      drawTransformControls(liveCtx, groupBounds)
    }
  }
}

// 统一请求更新
function requestRenderAll() {
  renderTick.value++
  renderHistory()
  renderLive()
}

// --- 辅助绘制 ---
function drawSelectionRect(ctx, rect) {
  ctx.save()
  ctx.strokeStyle = '#3b82f6'
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
  ctx.lineWidth = 1 / camera.zoom
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

function drawFreeformPath(ctx, path) {
  if (!path || path.length < 2) return
  ctx.save()
  ctx.strokeStyle = '#3b82f6'
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)'
  ctx.lineWidth = 2 / camera.zoom
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

function drawTransformControls(ctx, b) {
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

  const handles = [
    { x: minX, y: minY },
    { x: midX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: midY },
    { x: maxX, y: maxY },
    { x: midX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: midY },
  ]

  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1 / zoom

  handles.forEach((h) => {
    ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
    ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
  })
}

// --- 碰撞检测 ---
function getHandleAtPosition(wx, wy) {
  if (!groupBounds || selectedIndices.size === 0) return null
  const zoom = camera.zoom
  const padding = 5 / zoom
  const handleSize = 8 / zoom
  const hitRadius = Math.max(10 / zoom, handleSize)

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
    if (Math.abs(wx - h.x) <= hitRadius && Math.abs(wy - h.y) <= hitRadius) return h.type
  }
  return null
}

function hitTest(wx, wy, extraRadius = 0) {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const s = strokes[i]
    if (s?.type === 'image') {
      ensureBoundsForStroke(s)
      if (!s.bounds) continue
      const padding = 10 / camera.zoom + extraRadius
      if (
        wx >= s.bounds.minX - padding &&
        wx <= s.bounds.maxX + padding &&
        wy >= s.bounds.minY - padding &&
        wy <= s.bounds.maxY + padding
      ) {
        return i
      }
      continue
    }
    const padding = (s.type === 'text' ? 10 : Math.max(s.size, 5)) / camera.zoom + 5 + extraRadius
    const expand = s.type === 'text' ? 0 : s.size / 2

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
    } else if (['rectangle', 'circle', 'triangle', 'line', 'coordinate'].includes(s.type)) {
      const threshold = s.size / 2 + 10 / camera.zoom + extraRadius
      if (s.type === 'rectangle') {
        const dLeft = Math.abs(wx - s.x),
          dRight = Math.abs(wx - (s.x + s.width))
        const dTop = Math.abs(wy - s.y),
          dBottom = Math.abs(wy - (s.y + s.height))
        const inX = wx >= s.x - threshold && wx <= s.x + s.width + threshold
        const inY = wy >= s.y - threshold && wy <= s.y + s.height + threshold
        if (
          inX &&
          inY &&
          (dLeft < threshold || dRight < threshold || dTop < threshold || dBottom < threshold)
        )
          return i
      } else if (s.type === 'circle') {
        const cx = s.x + s.width / 2,
          cy = s.y + s.height / 2,
          r = Math.abs(s.width / 2)
        const dist = Math.sqrt((wx - cx) ** 2 + (wy - cy) ** 2)
        if (Math.abs(dist - r) < threshold) return i
      } else if (s.type === 'triangle') {
        const p1 = { x: s.x + s.width / 2, y: s.y },
          p2 = { x: s.x + s.width, y: s.y + s.height },
          p3 = { x: s.x, y: s.y + s.height }
        if (
          distToSegment(wx, wy, p1, p2) < threshold ||
          distToSegment(wx, wy, p2, p3) < threshold ||
          distToSegment(wx, wy, p3, p1) < threshold
        )
          return i
      } else if (s.type === 'line') {
        const p1 = { x: s.x, y: s.y },
          p2 = { x: s.x + s.width, y: s.y + s.height }
        if (distToSegment(wx, wy, p1, p2) < threshold) return i
      } else if (s.type === 'coordinate') {
        // 坐标轴碰撞检测：检查X轴、Y轴和箭头（新形式：原点在中心）
        const arrowSize = Math.max(8, s.size * 4)
        const centerX = s.x + s.width / 2
        const centerY = s.y + s.height / 2
        // X轴线段（水平穿过中心）
        const xAxisP1 = { x: s.x, y: centerY }
        const xAxisP2 = { x: s.x + s.width, y: centerY }
        // Y轴线段（垂直穿过中心）
        const yAxisP1 = { x: centerX, y: s.y }
        const yAxisP2 = { x: centerX, y: s.y + s.height }
        // X轴箭头（右端）
        const xArrowRightP1 = { x: s.x + s.width - arrowSize, y: centerY - arrowSize / 2 }
        const xArrowRightP2 = { x: s.x + s.width, y: centerY }
        const xArrowRightP3 = { x: s.x + s.width - arrowSize, y: centerY + arrowSize / 2 }
        // X轴箭头（左端）
        const xArrowLeftP1 = { x: s.x + arrowSize, y: centerY - arrowSize / 2 }
        const xArrowLeftP2 = { x: s.x, y: centerY }
        const xArrowLeftP3 = { x: s.x + arrowSize, y: centerY + arrowSize / 2 }
        // Y轴箭头（上端）
        const yArrowTopP1 = { x: centerX - arrowSize / 2, y: s.y + arrowSize }
        const yArrowTopP2 = { x: centerX, y: s.y }
        const yArrowTopP3 = { x: centerX + arrowSize / 2, y: s.y + arrowSize }
        // Y轴箭头（下端）
        const yArrowBottomP1 = { x: centerX - arrowSize / 2, y: s.y + s.height - arrowSize }
        const yArrowBottomP2 = { x: centerX, y: s.y + s.height }
        const yArrowBottomP3 = { x: centerX + arrowSize / 2, y: s.y + s.height - arrowSize }
        if (
          distToSegment(wx, wy, xAxisP1, xAxisP2) < threshold ||
          distToSegment(wx, wy, yAxisP1, yAxisP2) < threshold ||
          distToSegment(wx, wy, xArrowRightP1, xArrowRightP2) < threshold ||
          distToSegment(wx, wy, xArrowRightP2, xArrowRightP3) < threshold ||
          distToSegment(wx, wy, xArrowRightP3, xArrowRightP1) < threshold ||
          distToSegment(wx, wy, xArrowLeftP1, xArrowLeftP2) < threshold ||
          distToSegment(wx, wy, xArrowLeftP2, xArrowLeftP3) < threshold ||
          distToSegment(wx, wy, xArrowLeftP3, xArrowLeftP1) < threshold ||
          distToSegment(wx, wy, yArrowTopP1, yArrowTopP2) < threshold ||
          distToSegment(wx, wy, yArrowTopP2, yArrowTopP3) < threshold ||
          distToSegment(wx, wy, yArrowTopP3, yArrowTopP1) < threshold ||
          distToSegment(wx, wy, yArrowBottomP1, yArrowBottomP2) < threshold ||
          distToSegment(wx, wy, yArrowBottomP2, yArrowBottomP3) < threshold ||
          distToSegment(wx, wy, yArrowBottomP3, yArrowBottomP1) < threshold
        )
          return i
      }
    } else {
      const threshold = s.size / 2 + 10 / camera.zoom + extraRadius
      const thresholdSq = threshold * threshold
      if (s.points.length === 1) {
        if ((wx - s.points[0].x) ** 2 + (wy - s.points[0].y) ** 2 < thresholdSq) return i
      } else {
        for (let j = 0; j < s.points.length - 1; j++) {
          const p1 = s.points[j],
            p2 = s.points[j + 1]
          const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
          let distSq = 0
          if (l2 === 0) distSq = (wx - p1.x) ** 2 + (wy - p1.y) ** 2
          else {
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

function distToSegment(wx, wy, p1, p2) {
  const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
  if (l2 === 0) return Math.sqrt((wx - p1.x) ** 2 + (wy - p1.y) ** 2)
  let t = ((wx - p1.x) * (p2.x - p1.x) + (wy - p1.y) * (p2.y - p1.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.sqrt((wx - (p1.x + t * (p2.x - p1.x))) ** 2 + (wy - (p1.y + t * (p2.y - p1.y))) ** 2)
}

function hitTestRect(rect) {
  const indices = []
  const minX = Math.min(rect.x, rect.x + rect.w),
    maxX = Math.max(rect.x, rect.x + rect.w)
  const minY = Math.min(rect.y, rect.y + rect.h),
    maxY = Math.max(rect.y, rect.y + rect.h)
  strokes.forEach((s, i) => {
    if (
      s.bounds.minX >= minX &&
      s.bounds.maxX <= maxX &&
      s.bounds.minY >= minY &&
      s.bounds.maxY <= maxY
    ) {
      indices.push(i)
    }
  })
  return indices
}

function hitTestFreeform(path) {
  if (!path || path.length < 3) return []

  const indices = []
  strokes.forEach((s, i) => {
    // 获取对象的边界信息
    const { minX, minY, maxX, maxY } = s.bounds
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // 检测点：4个角点 + 中心点 + 4个边界中点
    const testPoints = [
      // 4个角点
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
      // 中心点
      { x: centerX, y: centerY },
      // 4个边界中点
      { x: centerX, y: minY }, // 上边中点
      { x: maxX, y: centerY }, // 右边中点
      { x: centerX, y: maxY }, // 下边中点
      { x: minX, y: centerY }, // 左边中点
    ]

    // 如果任意检测点在自由绘制路径内，则选中该对象
    if (testPoints.some((point) => isPointInPolygon(point.x, point.y, path))) {
      indices.push(i)
    }
  })

  return indices
}

function isPointInSelectionBounds(x, y) {
  if (!groupBounds || selectedIndices.size === 0) return false
  const zoom = camera.zoom
  const padding = 5 / zoom
  return (
    x >= groupBounds.minX - padding &&
    x <= groupBounds.maxX + padding &&
    y >= groupBounds.minY - padding &&
    y <= groupBounds.maxY + padding
  )
}

function isPointInPolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y,
      xj = polygon[j].x,
      yj = polygon[j].y
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// --- 历史记录 ---
function saveState() {
  if (!Array.isArray(strokes)) strokes = []
  if (!Array.isArray(history)) history = []
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

  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null
    const data = saveData()
    emit('save', data)
  }, AUTO_SAVE_DELAY_MS)
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
    const parsed = JSON.parse(jsonStr)
    strokes = Array.isArray(parsed) ? parsed : []
    selectedIndices.clear()
    groupBounds = null
    requestRenderAll()
  } catch (e) {
    console.error(e)
  }
}

// --- 交互逻辑 ---
function handlePointerDown(e) {
  if (inputState.visible) return

  // askAi 框选截图模式下，禁止进入画板绘制逻辑（否则会落入 draw 分支产生笔迹）
  if (currentMode.value === 'askAi') return

  if (liveCanvasRef.value) {
    liveCanvasRef.value.setPointerCapture(e.pointerId)
  }
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  // 1. 手势识别（双指缩放）
  if (activePointers.size === 2) {
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
  
  // 超过两指则不处理新动作
  if (activePointers.size > 2) return

  // 2. 导航动作（平移）- 无论是否 disabled 都要允许
  if (isSpacePressed.value || currentMode.value === 'hand' || props.disabled) {
    activeAction = { type: 'pan', lastPos: { x: e.clientX, y: e.clientY } }
    return
  }

  // 3. 禁用检查 - 仅拦截修改数据的操作
  if (props.disabled) return

  const worldPos = screenToWorld(e.clientX, e.clientY)

  if (currentMode.value === 'text') {
    startTextInput(worldPos.x, worldPos.y)
    return
  }

  if (currentMode.value === 'select') {
    // 优先检查控制点（缩放），再检查选择框内部（移动）
    const handle = getHandleAtPosition(worldPos.x, worldPos.y)
    if (handle) {
      activeHandle = handle
      activeAction = {
        type: 'resize',
        handle: handle,
        startPos: worldPos,
        startBounds: { ...groupBounds },
        snapshotStrokes: Array.from(selectedIndices).map((i) =>
          JSON.parse(JSON.stringify(strokes[i]))
        ),
      }
      return
    }

    if (
      selectedIndices.size > 0 &&
      groupBounds &&
      isPointInSelectionBounds(worldPos.x, worldPos.y)
    ) {
      activeAction = { type: 'move', lastPos: worldPos }
      // 此处不需要立即 render，move 过程中会 render
      return
    }

    if (activeAction && activeAction.type === 'move') return

    const hitIndex = hitTest(worldPos.x, worldPos.y)
    if (hitIndex !== -1) {
      if (!selectedIndices.has(hitIndex)) {
        selectedIndices.clear()
        selectedIndices.add(hitIndex)
      }
      activeAction = { type: 'move', lastPos: worldPos }
      requestRenderAll() // 选中状态改变，需要更新 UI
    } else {
      selectedIndices.clear()
      if (selectMode.value === 'freeform') {
        activeAction = { type: 'freeform_select', path: [worldPos] }
      } else {
        activeAction = { type: 'box_select', startPos: worldPos }
        selectionRect = { x: worldPos.x, y: worldPos.y, w: 0, h: 0 }
      }
      renderLive()
    }
  } else if (currentMode.value === 'eraser-stroke') {
    const hitIndex = hitTest(worldPos.x, worldPos.y, currentSize.value / 2)
    if (hitIndex !== -1 && strokes[hitIndex]?.type !== 'image') {
      strokes.splice(hitIndex, 1)
      saveState()
      renderHistory() // 历史改变
    }
    activeAction = { type: 'erase' }
  } else if (
    ['rectangle', 'circle', 'triangle', 'line', 'coordinate'].includes(currentMode.value)
  ) {
    selectedIndices.clear()
    groupBounds = null
    activeAction = {
      type: 'shape',
      shapeType: currentMode.value,
      startPos: worldPos,
      currentPos: worldPos, // 初始化 currentPos
    }
    renderLive()
  } else {
    // 绘图模式：优化点 -> 不直接 push 到 strokes，只存在 activeAction 中
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
    activeAction = { type: 'draw', stroke: newStroke }
    renderLive()
  }
}

function handlePointerMove(e) {
  const wp = screenToWorld(e.clientX, e.clientY)
  hoverPos.value = wp

  if (currentMode.value === 'eraser-stroke') {
    const sketchpadWrapper = containerRef.value?.parentElement
    if (sketchpadWrapper) {
      const rect = sketchpadWrapper.getBoundingClientRect()
      eraserCursor.x = e.clientX - rect.left - (currentSize.value * camera.zoom) / 2
      eraserCursor.y = e.clientY - rect.top - (currentSize.value * camera.zoom) / 2
      eraserCursor.size = currentSize.value * camera.zoom
      eraserCursor.visible = true
    }
  } else {
    eraserCursor.visible = false
  }

  if (!activePointers.has(e.pointerId)) {
    // Hover 状态下处理光标
    if (!activeAction && currentMode.value === 'select') {
      activeHandle = getHandleAtPosition(wp.x, wp.y)
      if (activeHandle) {
        // 设置光标样式...
      } else if (selectedIndices.size > 0 && groupBounds && isPointInSelectionBounds(wp.x, wp.y)) {
        liveCanvasRef.value.style.cursor = 'move'
      } else {
        liveCanvasRef.value.style.cursor = 'default'
      }
    }
    return
  }

  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (!activeAction) return

  if (activeAction.type === 'gesture') {
    if (activePointers.size < 2) return
    
    // 缩放手势：必须重绘所有层
    const pts = Array.from(activePointers.values())
    const dist = getDistance(pts[0], pts[1])
    if (!activeAction.startDist || dist === 0) return
    
    const center = getCenter(pts[0], pts[1])
    const scaleFactor = dist / activeAction.startDist
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, activeAction.startZoom * scaleFactor))
    const rect = liveCanvasRef.value.getBoundingClientRect()
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
    requestRenderAll()
  } else if (activeAction.type === 'pan') {
    // 平移：必须重绘所有层
    const dx = e.clientX - activeAction.lastPos.x
    const dy = e.clientY - activeAction.lastPos.y
    camera.x += dx
    camera.y += dy
    activeAction.lastPos = { x: e.clientX, y: e.clientY }
    requestRenderAll()
  } else if (activeAction.type === 'draw') {
    // 绘制：只更新 Live 层！性能提升点
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
    renderLive()
  } else if (activeAction.type === 'move') {
    // 移动对象：因为直接修改了 strokes 数据，这里还是全量重绘保证正确性
    // (进一步优化可以把移动的对象暂时移出 strokes 放入 live，但这需要更复杂的状态管理)
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
      } else if (['rectangle', 'circle', 'triangle', 'line', 'coordinate'].includes(obj.type)) {
        obj.x += dx
        obj.y += dy
        obj.bounds.minX += dx
        obj.bounds.maxX += dx
        obj.bounds.minY += dy
        obj.bounds.maxY += dy
      } else if (obj.type === 'image') {
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
    // 重新计算选中对象的整体边界框
    groupBounds = getGroupBounds(selectedIndices)
    activeAction.lastPos = wp
    requestRenderAll()
  } else if (activeAction.type === 'box_select') {
    // 选框：只更新 Live 层
    const sx = activeAction.startPos.x
    const sy = activeAction.startPos.y
    selectionRect = {
      x: Math.min(sx, wp.x),
      y: Math.min(sy, wp.y),
      w: Math.abs(wp.x - sx),
      h: Math.abs(wp.y - sy),
    }
    renderLive()
  } else if (activeAction.type === 'freeform_select') {
    // 自由选框：只更新 Live 层
    activeAction.path.push(wp)
    renderLive()
  } else if (activeAction.type === 'erase') {
    // 擦除：涉及 strokes 修改，需重绘历史
    const hitIndex = hitTest(wp.x, wp.y, currentSize.value / 2)
    if (hitIndex !== -1 && strokes[hitIndex]?.type !== 'image') {
      strokes.splice(hitIndex, 1)
      renderHistory()
    }
  } else if (activeAction.type === 'shape') {
    // 形状预览：只更新 Live 层
    activeAction.currentPos = wp
    renderLive()
  } else if (activeAction.type === 'resize') {
    // 变形：全量重绘
    handleResize(wp)
  }
}

function handleResize(currPos) {
  const { startBounds, handle, snapshotStrokes } = activeAction
  const indices = Array.from(selectedIndices)
  const newBounds = { ...startBounds }
  const dx = currPos.x - activeAction.startPos.x
  const dy = currPos.y - activeAction.startPos.y

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

  const scaleX = newBounds.width / startBounds.width
  const scaleY = newBounds.height / startBounds.height

  indices.forEach((idx, i) => {
    const original = snapshotStrokes[i]
    const target = strokes[idx]

    if (target.type === 'text') {
      const relX = (original.x - startBounds.minX) / startBounds.width
      const relY = (original.y - startBounds.minY) / startBounds.height
      target.x = newBounds.minX + relX * newBounds.width
      target.y = newBounds.minY + relY * newBounds.height
      target.size = original.size * Math.min(Math.abs(scaleX), Math.abs(scaleY))
      target.bounds.minX = target.x
      target.bounds.minY = target.y
    } else if (['rectangle', 'circle', 'triangle', 'line', 'coordinate'].includes(target.type)) {
      const relX = (original.x - startBounds.minX) / startBounds.width
      const relY = (original.y - startBounds.minY) / startBounds.height
      target.x = newBounds.minX + relX * newBounds.width
      target.y = newBounds.minY + relY * newBounds.height
      target.width = original.width * scaleX
      target.height = original.height * scaleY
      target.size = original.size * Math.min(Math.abs(scaleX), Math.abs(scaleY))
      target.bounds = {
        minX: Math.min(target.x, target.x + target.width),
        maxX: Math.max(target.x, target.x + target.width),
        minY: Math.min(target.y, target.y + target.height),
        maxY: Math.max(target.y, target.y + target.height),
      }
    } else if (target.type === 'image') {
      const relX = (original.x - startBounds.minX) / startBounds.width
      const relY = (original.y - startBounds.minY) / startBounds.height
      target.x = newBounds.minX + relX * newBounds.width
      target.y = newBounds.minY + relY * newBounds.height
      target.width = original.width * scaleX
      target.height = original.height * scaleY
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
      target.size = (original.size * (Math.abs(scaleX) + Math.abs(scaleY))) / 2
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
  // 重新计算选中对象的整体边界框
  groupBounds = getGroupBounds(selectedIndices)
  requestRenderAll()
}

function handlePointerLeave(e) {
  hoverPos.value = null
  renderLive()
}

function endAction(e) {
  activePointers.delete(e.pointerId)
  
  // 如果从双指变为单指，结束手势缩放
  if (activePointers.size < 2 && activeAction?.type === 'gesture') {
    activeAction = null
  }

  if (activePointers.size === 0) {
    if (activeAction) {
      if (activeAction.type === 'box_select') {
        const indices = hitTestRect(selectionRect)
        selectedIndices.clear()
        indices.forEach((i) => selectedIndices.add(i))
        selectionRect = null
        // 清除矩形框选动作
        activeAction = null
        renderLive()
      } else if (activeAction.type === 'freeform_select') {
        const indices = hitTestFreeform(activeAction.path)
        selectedIndices.clear()
        indices.forEach((i) => selectedIndices.add(i))
        // 清除自由框选动作，避免临时路径残留
        activeAction = null
        renderLive()
      } else if (['move', 'resize', 'erase'].includes(activeAction.type)) {
        saveState()
        // 动作结束，UI层可能还有残影，清除UI层，确保历史层是最新的
        renderLive()
      } else if (activeAction.type === 'draw') {
        // 绘制结束：将 Live 层的临时笔画推入 strokes，重绘 History
        if (!Array.isArray(strokes)) strokes = []
        if (activeAction.stroke) {
          strokes.push(activeAction.stroke)
        }
        saveState()
        renderHistory()
        renderLive() // 清除 Live 层的内容
      } else if (activeAction.type === 'shape') {
        const wp = activeAction.currentPos || activeAction.startPos
        let x, y, width, height
        if (activeAction.shapeType === 'line') {
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
          if (!Array.isArray(strokes)) strokes = []
          strokes.push(shape)
          saveState()
        }
        renderHistory()
        renderLive()
      }
    }
    activeAction = null
    activeHandle = null
  }
}

// --- 文本输入 ---
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
    renderHistory()
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
  const rect = liveCanvasRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  const wx = (mouseX - camera.x) / oldZoom
  const wy = (mouseY - camera.y) / oldZoom
  camera.x = mouseX - wx * newZoom
  camera.y = mouseY - wy * newZoom
  camera.zoom = newZoom
  requestRenderAll()
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
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndices.size > 0) {
    const indices = Array.from(selectedIndices).sort((a: number, b: number) => b - a)
    indices.forEach((i) => strokes.splice(i, 1))
    selectedIndices.clear()
    groupBounds = null
    saveState()
    requestRenderAll()
  }
}

function handleKeyup(e) {
  if (e.code === 'Space') {
    isSpacePressed.value = false
    if (activeAction && activeAction.type === 'pan' && !activePointers.size) activeAction = null
  }
}

function setMode(mode) {
  const wasAskAi = currentMode.value === 'askAi'
  currentMode.value = mode

  if (wasAskAi && mode !== 'askAi') {
    resetAskAiSelection()
    document.body.style.cursor = ''
  }

  if (mode === 'askAi') {
    resetAskAiSelection()
    document.body.style.cursor = 'crosshair'
  }

  if (mode !== 'select') {
    selectedIndices.clear()
    groupBounds = null
    requestRenderAll()
  }
}

// 进入问问学伴截图模式
function enterAskAiMode() {
  setMode('askAi')
}

function resetAskAiSelection() {
  askAiDragRect.value = null
  askAiStartPoint.value = null
  askAiDragPath.value = null
}

const askAiFreeformPathD = computed(() => {
  const path = askAiDragPath.value
  if (!path || path.length === 0) return ''
  const parts: string[] = []
  path.forEach((p, idx) => {
    const sx = p.x * camera.zoom + camera.x
    const sy = p.y * camera.zoom + camera.y
    parts.push(`${idx === 0 ? 'M' : 'L'} ${sx} ${sy}`)
  })
  return parts.join(' ')
})

// 获取内容坐标（考虑缩放和平移）
function getContentPoint(clientX: number, clientY: number): Point | null {
  if (!liveCanvasRef.value) return null
  const rect = liveCanvasRef.value.getBoundingClientRect()
  const x = (clientX - rect.left - camera.x) / camera.zoom
  const y = (clientY - rect.top - camera.y) / camera.zoom
  return { x, y }
}

// 处理问问学伴截图的指针按下
function handleAskAiPointerDown(e: PointerEvent) {
  if (currentMode.value !== 'askAi') return

  const p = getContentPoint(e.clientX, e.clientY)
  if (p) {
    if (selectMode.value === 'freeform') {
      askAiDragPath.value = [p]
      askAiStartPoint.value = null
      askAiDragRect.value = null
    } else {
      askAiStartPoint.value = p
      askAiDragRect.value = { x: p.x, y: p.y, w: 0, h: 0 }
      askAiDragPath.value = null
    }
  }
}

// 处理问问学伴截图的指针移动
function handleAskAiPointerMove(e: PointerEvent) {
  if (currentMode.value !== 'askAi') return

  const p = getContentPoint(e.clientX, e.clientY)
  if (!p) return

  if (selectMode.value === 'freeform') {
    if (!askAiDragPath.value) return
    askAiDragPath.value = [...askAiDragPath.value, p]
    return
  }

  if (!askAiStartPoint.value) return
  const start = askAiStartPoint.value
  askAiDragRect.value = {
    x: Math.min(start.x, p.x),
    y: Math.min(start.y, p.y),
    w: Math.abs(p.x - start.x),
    h: Math.abs(p.y - start.y),
  }
}

// 处理问问学伴截图的指针抬起
function handleAskAiPointerUp() {
  if (currentMode.value !== 'askAi') return

  if (selectMode.value === 'freeform') {
    const path = askAiDragPath.value
    if (path && path.length >= 3) {
      takeAskAiScreenshotFreeform(path)
      return
    }
    resetAskAiSelection()
    return
  }

  const rect = askAiDragRect.value
  if (rect && rect.w >= 5 && rect.h >= 5) {
    takeAskAiScreenshot(rect)
  } else {
    resetAskAiSelection()
  }
}

function takeAskAiScreenshotFreeform(path: Point[]) {
  const historyCanvas = historyCanvasRef.value
  const liveCanvas = liveCanvasRef.value

  if (!historyCanvas || !liveCanvas || !path.length) {
    resetAskAiSelection()
    return
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  path.forEach((p) => {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  })

  const w = maxX - minX
  const h = maxY - minY
  if (w < 5 || h < 5) {
    resetAskAiSelection()
    return
  }

  const dpr = window.devicePixelRatio || 1
  const zoom = camera.zoom
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = Math.round(w * zoom * dpr)
  tempCanvas.height = Math.round(h * zoom * dpr)
  const ctx = tempCanvas.getContext('2d')
  if (!ctx) {
    resetAskAiSelection()
    return
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

  ctx.save()
  ctx.beginPath()
  path.forEach((p, idx) => {
    const lx = (p.x - minX) * zoom * dpr
    const ly = (p.y - minY) * zoom * dpr
    if (idx === 0) ctx.moveTo(lx, ly)
    else ctx.lineTo(lx, ly)
  })
  ctx.closePath()
  ctx.clip()

  const sx = (minX * zoom + camera.x) * dpr
  const sy = (minY * zoom + camera.y) * dpr
  const sw = w * zoom * dpr
  const sh = h * zoom * dpr
  ctx.drawImage(historyCanvas, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height)
  ctx.drawImage(liveCanvas, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height)
  ctx.restore()

  const dataUrl = tempCanvas.toDataURL('image/png')

  // 关键修复：直接向父组件发送截图数据，不再触发内部弹窗
  emit('ask-ai-image-selected', {
    filePath: '',
    width: Math.round(w * zoom),
    height: Math.round(h * zoom),
    fileSize: 0,
    base64DataUrl: dataUrl,
  })

  resetAskAiSelection()
}

// 生成问问学伴截图
function takeAskAiScreenshot(rect: { x: number; y: number; w: number; h: number }) {
  const historyCanvas = historyCanvasRef.value
  const liveCanvas = liveCanvasRef.value

  if (!historyCanvas || !liveCanvas) {
    resetAskAiSelection()
    return
  }

  const dpr = window.devicePixelRatio || 1
  const zoom = camera.zoom
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = Math.round(rect.w * zoom * dpr)
  tempCanvas.height = Math.round(rect.h * zoom * dpr)
  const ctx = tempCanvas.getContext('2d')

  if (!ctx) {
    resetAskAiSelection()
    return
  }

  const sx = (rect.x * zoom + camera.x) * dpr
  const sy = (rect.y * zoom + camera.y) * dpr
  const sw = rect.w * zoom * dpr
  const sh = rect.h * zoom * dpr

  // 绘制背景为白色
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)

  // 合并绘制历史层和实时层
  ctx.drawImage(historyCanvas, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height)
  ctx.drawImage(liveCanvas, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height)

  // 转换为 dataUrl
  const dataUrl = tempCanvas.toDataURL('image/png')

  // 关键修复：直接向父组件发送截图数据，不再触发内部弹窗
  emit('ask-ai-image-selected', {
    filePath: '',
    width: Math.round(rect.w * zoom),
    height: Math.round(rect.h * zoom),
    fileSize: 0,
    base64DataUrl: dataUrl,
  })

  // 重置状态
  resetAskAiSelection()
}

// 获取框选框样式
function getAskAiRectStyle(rect: { x: number; y: number; w: number; h: number }) {
  if (!liveCanvasRef.value || !containerRef.value) return {}

  const canvasRect = liveCanvasRef.value.getBoundingClientRect()
  const containerRect = containerRef.value.getBoundingClientRect()

  // 计算 Canvas 相对于 Container 的偏移
  const offsetX = canvasRect.left - containerRect.left
  const offsetY = canvasRect.top - containerRect.top

  return {
    left: `${rect.x * camera.zoom + camera.x + offsetX}px`,
    top: `${rect.y * camera.zoom + camera.y + offsetY}px`,
    width: `${rect.w * camera.zoom}px`,
    height: `${rect.h * camera.zoom}px`,
  }
}

function zoomIn() {
  if (camera.zoom >= MAX_ZOOM) return
  const rect = liveCanvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const newZoom = Math.min(MAX_ZOOM, Number((camera.zoom + 0.1).toFixed(4)))
  zoomToPoint(centerX, centerY, newZoom)
}

function zoomOut() {
  if (camera.zoom <= MIN_ZOOM) return
  const rect = liveCanvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const newZoom = Math.max(MIN_ZOOM, Number((camera.zoom - 0.1).toFixed(4)))
  zoomToPoint(centerX, centerY, newZoom)
}

function fitToScreen() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const targetWidth = rect.width
  const targetHeight = rect.height
  const scaleX = targetWidth / (targetWidth / camera.zoom)
  const scaleY = targetHeight / (targetHeight / camera.zoom)
  const newZoom = Math.min(scaleX, scaleY, MAX_ZOOM)
  camera.zoom = Math.max(newZoom, MIN_ZOOM)
  camera.x = 0
  camera.y = 0
  requestRenderAll()
}

function fitToContent() {
  if (strokes.length === 0) {
    fitToScreen()
    return
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  strokes.forEach((stroke) => {
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
  const padding = 50
  const contentWidth = maxX - minX + padding * 2
  const contentHeight = maxY - minY + padding * 2
  if (!containerRef.value) return
  const containerRect = containerRef.value.getBoundingClientRect()
  const scaleX = containerRect.width / contentWidth
  const scaleY = containerRect.height / contentHeight
  const newZoom = Math.min(scaleX, scaleY, MAX_ZOOM)
  camera.zoom = Math.max(newZoom, MIN_ZOOM)
  camera.x = containerRect.width / 2 - ((minX + maxX) / 2) * camera.zoom
  camera.y = containerRect.height / 2 - ((minY + maxY) / 2) * camera.zoom
  requestRenderAll()
}

function zoomToPoint(clientX, clientY, newZoom) {
  const oldZoom = camera.zoom
  const rect = liveCanvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const wx = (clientX - rect.left - camera.x) / oldZoom
  const wy = (clientY - rect.top - camera.y) / oldZoom
  camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom))
  camera.x = clientX - rect.left - wx * camera.zoom
  camera.y = clientY - rect.top - wy * camera.zoom
  requestRenderAll()
}

// --- 生命周期 ---
onMounted(() => {
  historyCtx = historyCanvasRef.value.getContext('2d', { alpha: false })
  liveCtx = liveCanvasRef.value.getContext('2d') // Live 必须支持 alpha
  resizeCanvas()
  camera.zoom = normalizeZoom(props.initialZoom)
  // 注意：不要在 onMounted 中调用 saveState()，
  // 因为它会创建自动保存定时器，可能在草稿加载前覆盖数据
  containerRef.value?.addEventListener('dragover', handleDragOver)
  containerRef.value?.addEventListener('drop', handleDrop)
  window.addEventListener('paste', handlePaste)
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
  window.removeEventListener('paste', handlePaste)
  containerRef.value?.removeEventListener('dragover', handleDragOver)
  containerRef.value?.removeEventListener('drop', handleDrop)
})

function triggerImageSelect() {
  Promise.resolve().then(async () => {
    try {
      const imageInfo = await pickImage()
      if (!imageInfo) return

      if (imageInfo.base64DataUrl) {
        await insertImageFromDataUrl(imageInfo.base64DataUrl)
        return
      }

      showMessage('图片选择失败，请重试', 'error')
    } catch (error) {
      console.error('[drawingBoardNew][triggerImageSelect] 图片选择异常:', error)
      showMessage('图片选择失败，请重试', 'error')
    }
  })
}

function handleDragOver(e: DragEvent) {
  if (!e.dataTransfer) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

async function handleDrop(e: DragEvent) {
  if (!e.dataTransfer) return
  e.preventDefault()
  const file = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith('image/'))
  if (!file) return
  const wp = screenToWorld(e.clientX, e.clientY)
  await insertImageFromFile(file, wp)
}

async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items || !items.length) return
  for (const item of Array.from(items)) {
    if (item.type && item.type.startsWith('image/')) {
      const blob = item.getAsFile()
      if (!blob) continue
      const wp = hoverPos.value || getViewCenterWorld()
      await insertImageFromFile(blob, wp)
      break
    }
  }
}

function getViewCenterWorld() {
  const rect = liveCanvasRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImageElement(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
    img.src = dataUrl
  })
}

async function insertImageFromFile(file: Blob, pos?: { x: number; y: number }) {
  const dataUrl = await fileToDataUrl(file)
  const img = await loadImageElement(dataUrl)
  imageCache.set(dataUrl, img)

  const maxDisplayWidth = 420
  const scale = img.naturalWidth > maxDisplayWidth ? maxDisplayWidth / img.naturalWidth : 1
  const w = Math.max(1, img.naturalWidth * scale)
  const h = Math.max(1, img.naturalHeight * scale)

  const p = pos || getViewCenterWorld()
  const x = p.x - w / 2
  const y = p.y - h / 2

  const obj: any = {
    type: 'image',
    x,
    y,
    width: w,
    height: h,
    dataUrl,
    opacity: 1,
    bounds: { minX: x, minY: y, maxX: x + w, maxY: y + h },
  }

  strokes.push(obj)
  selectedIndices.clear()
  selectedIndices.add(strokes.length - 1)
  groupBounds = getGroupBounds(selectedIndices)
  setMode('select')
  saveState()
  requestRenderAll()
}

async function insertImageFromDataUrl(dataUrl: string, pos?: { x: number; y: number }) {
  if (!dataUrl) return

  let img = imageCache.get(dataUrl)
  if (!img) {
    img = await loadImageElement(dataUrl)
    imageCache.set(dataUrl, img)
  }

  const maxDisplayWidth = 420
  const scale = img.naturalWidth > maxDisplayWidth ? maxDisplayWidth / img.naturalWidth : 1
  const w = Math.max(1, img.naturalWidth * scale)
  const h = Math.max(1, img.naturalHeight * scale)

  const p = pos || getViewCenterWorld()
  const x = p.x - w / 2
  const y = p.y - h / 2

  const obj: any = {
    type: 'image',
    x,
    y,
    width: w,
    height: h,
    dataUrl,
    opacity: 1,
    bounds: { minX: x, minY: y, maxX: x + w, maxY: y + h },
  }

  strokes.push(obj)
  selectedIndices.clear()
  selectedIndices.add(strokes.length - 1)
  groupBounds = getGroupBounds(selectedIndices)
  setMode('select')
  saveState()
  requestRenderAll()
}

// --- 暴露给父组件的方法 ---
const saveData = () => ({
  objects: Array.isArray(strokes) ? strokes : [],
  history: Array.isArray(history) ? history : [],
  historyIndex: historyStep.value,
})
const loadData = (data) => {
  // 关键：清除可能正在运行的自动保存定时器，防止加载数据前被空数据覆盖
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }

  strokes = Array.isArray(data?.objects) ? data.objects : []
  history = Array.isArray(data?.history) && data.history.length > 0 
    ? data.history 
    : [JSON.stringify(strokes)]

  let idx = typeof data?.historyIndex === 'number' ? data.historyIndex : history.length - 1
  const maxIdx = history.length - 1
  if (idx > maxIdx) idx = maxIdx
  if (idx < 0) idx = 0
  historyStep.value = idx

  strokes.forEach((s) => ensureBoundsForStroke(s))
  requestRenderAll()
}

const clearAll = () => {
  console.log('[drawingBoardNew] clearAll 执行, 原笔迹数量:', strokes.length)
  strokes = []
  selectedIndices.clear()
  groupBounds = null
  activeAction = null
  activeHandle = null
  selectionRect = null
  history = [JSON.stringify([])]
  historyStep.value = 0
  // 清除自动保存定时器，防止清空后仍然触发保存
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  requestRenderAll()
}

const getThumbnail = (width = 300, height = 200) => {
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

const exportToJpg = (quality = 0.9) => {
  // 合并背景和 strokes 到一个临时 canvas
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  if (backgroundImg.value && backgroundLoaded.value) {
    const w = props.backgroundContain
      ? backgroundImg.value.naturalWidth * backgroundScale.value
      : backgroundImg.value.naturalWidth || backgroundImg.value.width
    const h = props.backgroundContain
      ? backgroundImg.value.naturalHeight * backgroundScale.value
      : backgroundImg.value.naturalHeight || backgroundImg.value.height

    minX = Math.min(minX, backgroundOrigin.x)
    minY = Math.min(minY, backgroundOrigin.y)
    maxX = Math.max(maxX, backgroundOrigin.x + w)
    maxY = Math.max(maxY, backgroundOrigin.y + h)
  }
  strokes.forEach((s) => {
    if (s.mode === 'eraser') return
    ensureBoundsForStroke(s)
    if (!s.bounds) return
    minX = Math.min(minX, s.bounds.minX)
    minY = Math.min(minY, s.bounds.minY)
    maxX = Math.max(maxX, s.bounds.maxX)
    maxY = Math.max(maxY, s.bounds.maxY)
  })
  if (minX === Infinity) {
    if (!liveCanvasRef.value) return ''
    const rect = liveCanvasRef.value.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width)),
      height = Math.max(1, Math.round(rect.height))
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    const cx = c.getContext('2d')
    if (!cx) return ''
    cx.fillStyle = '#ffffff'
    cx.fillRect(0, 0, width, height)
    return c.toDataURL('image/jpeg', quality)
  }
  const padding = 40
  const width = maxX - minX + padding * 2
  const height = maxY - minY + padding * 2
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return ''
  tempCtx.fillStyle = '#ffffff'
  tempCtx.fillRect(0, 0, width, height)
  tempCtx.save()
  tempCtx.translate(-minX + padding, -minY + padding)
  tempCtx.lineCap = 'round'
  tempCtx.lineJoin = 'round'
  if (backgroundImg.value && backgroundLoaded.value) {
    if (props.backgroundContain) {
      tempCtx.drawImage(
        backgroundImg.value,
        backgroundOrigin.x,
        backgroundOrigin.y,
        backgroundImg.value.naturalWidth * backgroundScale.value,
        backgroundImg.value.naturalHeight * backgroundScale.value
      )
    } else {
      tempCtx.drawImage(backgroundImg.value, backgroundOrigin.x, backgroundOrigin.y)
    }
  }
  strokes.forEach((s) => drawStrokeToContext(tempCtx, s))
  tempCtx.restore()
  return tempCanvas.toDataURL('image/jpeg', quality)
}

// 强制同步渲染（用于截图等场景）
async function forceRender() {
  if (!historyCtx || !historyCanvasRef.value || !liveCtx || !liveCanvasRef.value) return

  // 强制触发渲染
  renderTick.value++
  renderHistory()
  renderLive()

  // 等待渲染完成（等待下一帧）
  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve)
    })
  })

  // 再次确保渲染完成
  renderHistory()
  renderLive()
}

const exportStrokesOnly = () => {
  if (!strokes || strokes.length === 0) return ''

  // 1. 计算所有笔迹的整体包围盒
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  let hasValidStroke = false

  strokes.forEach((s) => {
    // 排除背景图片和橡皮擦（如果橡皮擦模式是 stroke，则也参与计算，但通常我们只想要画出的内容）
    if (s.type === 'image' || s.mode === 'eraser') return

    ensureBoundsForStroke(s)
    if (s.bounds) {
      minX = Math.min(minX, s.bounds.minX)
      minY = Math.min(minY, s.bounds.minY)
      maxX = Math.max(maxX, s.bounds.maxX)
      maxY = Math.max(maxY, s.bounds.maxY)
      hasValidStroke = true
    }
  })

  if (!hasValidStroke) return ''

  // 2. 添加少量内边距
  const padding = 10
  const width = maxX - minX + padding * 2
  const height = maxY - minY + padding * 2

  // 3. 创建临时画布进行裁剪绘制
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return ''

  // 填充白色背景
  tempCtx.fillStyle = '#ffffff'
  tempCtx.fillRect(0, 0, width, height)

  // 4. 移动原点并绘制笔迹
  tempCtx.save()
  tempCtx.translate(-minX + padding, -minY + padding)
  tempCtx.lineCap = 'round'
  tempCtx.lineJoin = 'round'

  strokes.forEach((s) => {
    if (s.type !== 'image') {
      drawStrokeToContext(tempCtx, s)
    }
  })
  tempCtx.restore()

  return tempCanvas.toDataURL('image/png')
}

const exportToPng = () => {
  // 如果有笔迹，优先导出笔迹区域；否则导出全屏
  const strokesOnly = exportStrokesOnly()
  if (strokesOnly) return strokesOnly

  if (!liveCanvasRef.value) return ''
  // 简单导出当前视图可见区域
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = liveCanvasRef.value.width
  tempCanvas.height = liveCanvasRef.value.height
  const ctx = tempCanvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
  ctx.drawImage(historyCanvasRef.value!, 0, 0)
  ctx.drawImage(liveCanvasRef.value, 0, 0)
  return tempCanvas.toDataURL('image/png')
}

const getDataUrl = () => {
  return exportToPng()
}

defineExpose({
  saveData,
  loadData,
  getThumbnail,
  clearAll,
  exportToJpg,
  exportToPng,
  exportStrokesOnly,
  getDataUrl,
  insertImageFromDataUrl,
  forceRender,
  // 工具栏相关
  toolbarTools,
  toolbarSelectedTool,
  toolbarToolConfig,
  handleToolbarToolChange,
  handleToolbarConfigChange,
  undo,
  redo,
  canUndo,
  canRedo,
  triggerImageSelect,
})
</script>

<style scoped>
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
  margin: 0 auto;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible; /* 允许 Canvas 超出容器边界 */
  background-color: #ffffff;
}

.image-delete-btn {
  position: absolute;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.65);
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 60;
  pointer-events: auto;
}

.image-delete-btn:hover {
  background: rgba(0, 0, 0, 0.68);
}

/* 关键样式：所有层绝对定位重叠 */
.canvas-layer {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 100%;
  display: block;
}

/* 历史层在下，且不响应鼠标事件（透传给上层） */
.canvas-history {
  z-index: 10;
  background-color: #ffffff;
  pointer-events: none;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

/* 实时层在上，透明背景，响应鼠标事件 */
.canvas-live {
  z-index: 20;
  background-color: transparent;
  pointer-events: auto; /* 关键：接收交互 */
}

/* 其他 UI 样式保持不变 */
.text-input {
  position: absolute;
  background-color: transparent;
  border: 1px dashed #3b82f6;
  outline: none;
  padding: 0;
  margin: 0;
  resize: none;
  overflow: hidden;
  z-index: 30;
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
  justify-content: space-between;
  gap: 12px;
  width: 98%;
  max-width: 768px;
  z-index: 50; /* Toolbar 在最上层 */
}

.toolbar--bottom {
  top: auto;
  bottom: 24px;
}

.toolbar-slot {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.toolbar-slot--left {
  justify-content: flex-start;
}
.toolbar-slot--right {
  justify-content: flex-end;
}
.toolbar-center {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
  min-width: 100px;
}

.insert-image-btn {
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  font-size: 12px;
  color: #333333;
  cursor: pointer;
}

.insert-image-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.hidden-file-input {
  display: none;
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
  z-index: 60;
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
.cursor-none {
  cursor: none;
}

.eraser-cursor {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  pointer-events: none;
  z-index: 40;
  box-sizing: border-box;
  background-color: rgba(0, 0, 0, 0.05);
}

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
  z-index: 50;
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

.zoom-select :deep(.select-trigger) {
  width: auto;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: none;
  background: rgba(0, 0, 0, 0.02);
  font-size: 13px;
  font-weight: 500;
  color: #333333;
}
.zoom-select :deep(.select-trigger:hover) {
  background: rgba(0, 0, 0, 0.05);
}
.zoom-select :deep(.select-dropdown) {
  left: auto;
  right: 0;
  min-width: 120px;
  z-index: 60;
  top: auto;
  bottom: calc(100% + 8px);
}
.zoom-fit {
  margin-left: 2px;
}

.debug-panel {
  position: absolute;
  top: 120px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  font-size: 12px;
  z-index: 60;
}
.debug-panel div {
  margin-bottom: 5px;
}
.debug-panel input[type='number'] {
  width: 60px;
  margin-left: 5px;
}
.debug-panel button {
  font-size: 11px;
  padding: 4px 8px;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}
.debug-panel button:hover {
  background: #e0e0e0;
}

/* 问问学伴截图框选遮罩 */
.ask-ai-screenshot-overlay {
  position: absolute;
  border: 2px dashed #6e55ff;
  background-color: rgba(110, 85, 255, 0.1);
  pointer-events: none;
  z-index: 100;
}

.ask-ai-freeform-overlay {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.ask-ai-freeform-overlay path {
  fill: rgba(110, 85, 255, 0.12);
  stroke: #6e55ff;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
</style>