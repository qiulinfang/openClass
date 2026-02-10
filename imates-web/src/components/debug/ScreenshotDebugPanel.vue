<template>
  <div v-if="isDev && debugImageData" class="screenshot-debug-panel">
    <div class="debug-header">
      <span>🔍 截图调试信息</span>
      <button class="debug-close" @click.stop="handleClose">×</button>
    </div>
    
    <div class="debug-content">
      <!-- 基础信息 -->
      <div class="debug-section">
        <div class="debug-item">
          <strong>来源:</strong> {{ debugImageData.source }}
        </div>
        <div class="debug-item">
          <strong>格式:</strong> {{ debugImageData.format }}
        </div>
        <div class="debug-item">
          <strong>尺寸:</strong> {{ debugImageData.width }} × {{ debugImageData.height }}
        </div>
        <div class="debug-item">
          <strong>数据长度:</strong> {{ debugImageData.dataLength?.toLocaleString() }} 字节
        </div>
        <div class="debug-item">
          <strong>前缀:</strong> <code>{{ debugImageData.prefix }}</code>
        </div>
        <div v-if="debugImageData.timestamp" class="debug-item">
          <strong>时间戳:</strong> {{ new Date(debugImageData.timestamp).toLocaleTimeString() }}
        </div>
      </div>

      <!-- Canvas 图像预览 -->
      <div class="debug-section">
        <div class="debug-section-title">📷 图像预览</div>
        <div class="canvas-container">
          <canvas 
            ref="canvasRef"
            class="screenshot-canvas"
            @click="handleCanvasClick"
            @mousemove="handleCanvasMouseMove"
            @mouseleave="handleCanvasMouseLeave"
          ></canvas>
          <div v-if="canvasHoverInfo" class="canvas-hover-info">
            <div class="hover-position">坐标: ({{ canvasHoverInfo.x }}, {{ canvasHoverInfo.y }})</div>
            <div class="hover-color">颜色: {{ canvasHoverInfo.color }}</div>
          </div>
        </div>
      </div>

      <!-- 图像分析 -->
      <div class="debug-section">
        <div class="debug-section-title">📊 图像分析</div>
        <div class="analysis-grid">
          <div class="analysis-item">
            <div class="analysis-label">宽高比</div>
            <div class="analysis-value">{{ aspectRatio }}</div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">总像素</div>
            <div class="analysis-value">{{ totalPixels.toLocaleString() }}</div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">文件大小</div>
            <div class="analysis-value">{{ fileSizeKB }} KB</div>
          </div>
          <div class="analysis-item">
            <div class="analysis-label">压缩比</div>
            <div class="analysis-value">{{ compressionRatio }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

interface DebugImageData {
  source: string
  format: string
  width: number
  height: number
  dataLength: number
  prefix: string
  timestamp: number
  dataUrl?: string // 添加 dataUrl 用于 Canvas 渲染
}

interface Props {
  debugImageData: DebugImageData | null
}

interface Emits {
  (e: 'close'): void
}

interface CanvasHoverInfo {
  x: number
  y: number
  color: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 开发环境标识
// const isDev = import.meta.env.DEV
const isDev = true

// Canvas 相关
const canvasRef = ref<HTMLCanvasElement>()
const canvasHoverInfo = ref<CanvasHoverInfo | null>(null)

// 计算属性
const aspectRatio = computed(() => {
  if (!props.debugImageData) return 'N/A'
  const { width, height } = props.debugImageData
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height)
  return `${width / divisor}:${height / divisor}`
})

const totalPixels = computed(() => {
  if (!props.debugImageData) return 0
  return props.debugImageData.width * props.debugImageData.height
})

const fileSizeKB = computed(() => {
  if (!props.debugImageData) return 0
  return (props.debugImageData.dataLength / 1024).toFixed(1)
})

const compressionRatio = computed(() => {
  if (!props.debugImageData) return 'N/A'
  // 假设未压缩的 RGBA 数据大小
  const uncompressedSize = props.debugImageData.width * props.debugImageData.height * 4
  const ratio = uncompressedSize / props.debugImageData.dataLength
  return ratio.toFixed(1) + ':1'
})

// 方法
const handleClose = () => {
  emit('close')
}

const renderImageToCanvas = () => {
  if (!canvasRef.value || !props.debugImageData?.dataUrl) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = new Image()
  img.onload = () => {
    // 设置 Canvas 尺寸
    const maxWidth = 280
    const maxHeight = 200
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
    
    canvas.width = img.width * scale
    canvas.height = img.height * scale

    // 绘制图像
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  }
  img.src = props.debugImageData.dataUrl
}

const handleCanvasClick = (event: MouseEvent) => {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((event.clientX - rect.left) * (canvas.width / rect.width))
  const y = Math.floor((event.clientY - rect.top) * (canvas.height / rect.height))
  
  console.log(`[ScreenshotDebug] Canvas clicked at: (${x}, ${y})`)
}

const handleCanvasMouseMove = (event: MouseEvent) => {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((event.clientX - rect.left) * (canvas.width / rect.width))
  const y = Math.floor((event.clientY - rect.top) * (canvas.height / rect.height))
  
  const ctx = canvas.getContext('2d')
  if (ctx && x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
    const imageData = ctx.getImageData(x, y, 1, 1)
    const pixel = imageData.data
    const r = pixel[0]
    const g = pixel[1]
    const b = pixel[2]
    const a = pixel[3]
    
    canvasHoverInfo.value = {
      x,
      y,
      color: `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`
    }
  }
}

const handleCanvasMouseLeave = () => {
  canvasHoverInfo.value = null
}

// 监听 dataUrl 变化，重新渲染 Canvas
watch(() => props.debugImageData?.dataUrl, () => {
  nextTick(() => {
    renderImageToCanvas()
  })
}, { immediate: true })
</script>

<style scoped>
/* 截图调试面板样式 */
.screenshot-debug-panel {
  position: fixed;
  top: 60px;
  right: 18px;
  width: 320px;
  max-height: 600px;
  background: rgba(0, 0, 0, 0.95);
  color: #fff;
  border-radius: 12px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 12px;
  z-index: 20002;
  overflow: hidden;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.debug-close:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.debug-content {
  padding: 16px;
  max-height: 550px;
  overflow-y: auto;
}

.debug-section {
  margin-bottom: 20px;
}

.debug-section:last-child {
  margin-bottom: 0;
}

.debug-section-title {
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.debug-item {
  margin-bottom: 8px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.debug-item strong {
  color: #4ade80;
  min-width: 70px;
  flex-shrink: 0;
}

.debug-item code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  word-break: break-all;
  flex: 1;
}

/* Canvas 容器样式 */
.canvas-container {
  position: relative;
  display: inline-block;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
}

.screenshot-canvas {
  display: block;
  cursor: crosshair;
  max-width: 100%;
  height: auto;
}

.canvas-hover-info {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 10px;
  pointer-events: none;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.hover-position,
.hover-color {
  margin-bottom: 2px;
}

.hover-position:last-child,
.hover-color:last-child {
  margin-bottom: 0;
}

/* 分析网格样式 */
.analysis-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.analysis-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.analysis-label {
  font-size: 10px;
  color: #94a3b8;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.analysis-value {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

/* 滚动条样式 */
.debug-content::-webkit-scrollbar {
  width: 6px;
}

.debug-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.debug-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.debug-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
