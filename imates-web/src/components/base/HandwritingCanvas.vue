<template>
  <div class="handwriting-canvas-container" ref="containerRef">
    <canvas
      ref="canvasRef"
      @mousedown="startDrawing"
      @mousemove="draw"
      @mouseup="stopDrawing"
      @mouseleave="stopDrawing"
      @touchstart.prevent="handleTouchStart"
      @touchmove.prevent="handleTouchMove"
      @touchend.prevent="handleTouchEnd"
      class="handwriting-canvas"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  strokeColor: {
    type: String,
    default: '#000000'
  },
  lineWidth: {
    type: Number,
    default: 2
  }
})

const emit = defineEmits(['change'])

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
let ctx: CanvasRenderingContext2D | null = null

// 历史记录
const history = ref<string[]>([])
const historyIndex = ref(-1)

const initCanvas = () => {
  if (!canvasRef.value || !containerRef.value) return
  const canvas = canvasRef.value
  const container = containerRef.value
  
  const rect = container.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = props.strokeColor
    ctx.lineWidth = props.lineWidth
    
    // 如果有历史记录，重新绘制当前状态
    if (historyIndex.value >= 0) {
      restoreFromHistory(history.value[historyIndex.value])
    }
  }
}

const saveToHistory = () => {
  const base64 = getBase64()
  if (!base64) return
  
  // 如果当前不在历史末尾，截断之后的重做记录
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  
  history.value.push(base64)
  historyIndex.value = history.value.length - 1
}

const restoreFromHistory = (base64: string) => {
  if (!ctx || !canvasRef.value) return
  const img = new Image()
  img.onload = () => {
    ctx?.clearRect(0, 0, canvasRef.value!.width, canvasRef.value!.height)
    ctx?.drawImage(img, 0, 0)
    emit('change', base64)
  }
  img.src = base64
}

const undo = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--
    restoreFromHistory(history.value[historyIndex.value])
  } else if (historyIndex.value === 0) {
    historyIndex.value = -1
    clearCanvas(false) // 只有一条记录时撤销即清空，但不保存历史
  }
}

const redo = () => {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    restoreFromHistory(history.value[historyIndex.value])
  }
}

const startDrawing = (e: MouseEvent) => {
  isDrawing.value = true
  if (!ctx || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  ctx.beginPath()
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
}

const draw = (e: MouseEvent) => {
  if (!isDrawing.value || !ctx || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
  ctx.stroke()
}

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false
    saveToHistory()
    emit('change', getBase64())
  }
}

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length !== 1) return
  isDrawing.value = true
  if (!ctx || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const touch = e.touches[0]
  ctx.beginPath()
  ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top)
}

const handleTouchMove = (e: TouchEvent) => {
  if (!isDrawing.value || e.touches.length !== 1 || !ctx || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const touch = e.touches[0]
  ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top)
  ctx.stroke()
}

const handleTouchEnd = () => {
  stopDrawing()
}

const clearCanvas = (save = true) => {
  if (!ctx || !canvasRef.value) return
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  if (save) {
    history.value = []
    historyIndex.value = -1
  }
  emit('change', null)
}

const getBase64 = () => {
  if (!canvasRef.value) return null
  return canvasRef.value.toDataURL('image/png')
}

defineExpose({
  clear: clearCanvas,
  undo,
  redo,
  getBase64,
  canUndo: () => historyIndex.value >= 0,
  canRedo: () => historyIndex.value < history.value.length - 1
})

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', initCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', initCanvas)
})

watch(() => props.strokeColor, (newColor) => {
  if (ctx) ctx.strokeStyle = newColor
})

watch(() => props.lineWidth, (newWidth) => {
  if (ctx) ctx.lineWidth = newWidth
})
</script>

<style scoped>
.handwriting-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: transparent;
  cursor: crosshair;
  overflow: hidden;
}

.handwriting-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
