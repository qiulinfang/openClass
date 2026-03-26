<template>
  <Teleport to="body">
    <div v-if="modelValue" class="image-crop-overlay" @click.self="handleCancel">
      <div class="image-crop-container">
        <Button
          label="取消"
          :icon="goBackIcon"
          variant="ghost"
          size="mdCompact"
          class="crop-back-btn"
          @click="handleCancel"
        />

        <div class="crop-container">
          <canvas
            v-if="imageSrc"
            ref="cropCanvasRef"
            :class="[
              'crop-canvas',
              { 'is-dragging': isDragging, 'is-drawing': isCropping },
            ]"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerup="handlePointerUp"
            @pointercancel="handlePointerUp"
            @pointerleave="handlePointerUp"
            @wheel.prevent="handleWheel"
          ></canvas>

          <!-- 灰色蒙版层 -->
          <div v-if="!cropRect" class="crop-mask crop-mask-full">
            <div class="crop-hint-box">
              <div class="crop-hint-rect"></div>
              <div class="crop-hint-text">{{ hintText }}</div>
            </div>
          </div>
          <template v-else>
            <div class="crop-mask crop-mask-top" :style="cropMaskTopStyle"></div>
            <div class="crop-mask crop-mask-bottom" :style="cropMaskBottomStyle"></div>
            <div class="crop-mask crop-mask-left" :style="cropMaskLeftStyle"></div>
            <div class="crop-mask crop-mask-right" :style="cropMaskRightStyle"></div>
          </template>

          <!-- 框选遮罩（中间透明显示清晰图片） -->
          <div v-if="cropRect" class="crop-overlay" :style="cropOverlayStyle">
            <div class="crop-corner crop-corner-nw"></div>
            <div class="crop-corner crop-corner-ne"></div>
            <div class="crop-corner crop-corner-sw"></div>
            <div class="crop-corner crop-corner-se"></div>
          </div>
        </div>

        <!-- 框选模式下的操作按钮（右上角确定） -->
        <div class="crop-actions-panel">
          <Button
            label="确定"
            :icon="yesIcon"
            variant="ghost"
            size="sm"
            :disabled="!cropRect"
            class="crop-confirm-btn"
            @click="handleConfirm"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from './Button.vue'
import goBackIcon from '/icons/goback.svg'
import yesIcon from '/icons/yes.svg'

interface Props {
  modelValue: boolean
  imageSrc: string
  hintText?: string
  showInfo?: boolean
  quality?: number
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', croppedDataUrl: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  hintText: '在中间区域拖动框选题目',
  showInfo: true,
  quality: 0.9,
})

const emit = defineEmits<Emits>()

const cropCanvasRef = ref<HTMLCanvasElement | null>(null)

const containerSize = ref({ width: 0, height: 0 })
const canvasClientRect = ref<{ left: number; top: number } | null>(null)
let rafMoveId: number | null = null
let pendingMovePoint: { x: number; y: number } | null = null

// 图片绘制信息（用于从 canvas 坐标映射回图片像素坐标）
const imageNaturalSize = ref({ width: 0, height: 0 })
const drawInfo = ref({ scale: 1, dpr: 1 })
const loadedImage = ref<HTMLImageElement | null>(null)

const userScale = ref(1)
const rotationDeg = ref(0)

const ROTATION_THRESHOLD = 7

const translateX = ref(0)
const translateY = ref(0)

type Point = { x: number; y: number }

const activePointers = new Map<number, Point>()
const lastSinglePointer = ref<{ id: number; x: number; y: number } | null>(null)
const gestureStart = ref<{
  distance: number
  angleDeg: number
  midpoint: Point
  startScale: number
  startRotationDeg: number
  startTranslateX: number
  startTranslateY: number
} | null>(null)

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const getDistance = (a: Point, b: Point) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

const getMidpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

const getAngleDeg = (a: Point, b: Point) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

const normalizeDeg = (deg: number) => {
  const v = deg % 360
  return v < 0 ? v + 360 : v
}

const snapToNearest90 = (deg: number) => Math.round(deg / 90) * 90

const syncPointer = (e: PointerEvent) => {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
}

// 框选状态
const cropRect = ref<{
  x: number
  y: number
  width: number
  height: number
} | null>(null)
const isCropping = ref(false)
const isDragging = ref(false)
const cropStartPos = ref({ x: 0, y: 0 })

// 裁剪遮罩样式计算
const cropOverlayStyle = computed(() => {
  if (!cropRect.value) return {}
  return {
    left: `${cropRect.value.x}px`,
    top: `${cropRect.value.y}px`,
    width: `${cropRect.value.width}px`,
    height: `${cropRect.value.height}px`,
  }
})

const getContainerSize = () => {
  return containerSize.value
}

const refreshCanvasMeasure = () => {
  const canvas = cropCanvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  containerSize.value = { width: rect.width, height: rect.height }
  canvasClientRect.value = { left: rect.left, top: rect.top }
}

const cropMaskTopStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width } = getContainerSize()
  return {
    top: '0',
    left: '0',
    width: `${width}px`,
    height: `${cropRect.value.y}px`,
  }
})

const cropMaskBottomStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width, height } = getContainerSize()
  const bottomY = cropRect.value.y + cropRect.value.height
  return {
    top: `${bottomY}px`,
    left: '0',
    width: `${width}px`,
    height: `${Math.max(0, height - bottomY)}px`,
  }
})

const cropMaskLeftStyle = computed(() => {
  if (!cropRect.value) return {}
  return {
    top: `${cropRect.value.y}px`,
    height: `${cropRect.value.height}px`,
    left: '0',
    width: `${cropRect.value.x}px`,
  }
})

const cropMaskRightStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width } = getContainerSize()
  const rightX = cropRect.value.x + cropRect.value.width
  return {
    top: `${cropRect.value.y}px`,
    left: `${rightX}px`,
    height: `${cropRect.value.height}px`,
    width: `${Math.max(0, width - rightX)}px`,
  }
})

const resizeAndRedraw = () => {
  const canvas = cropCanvasRef.value
  const img = loadedImage.value
  if (!canvas || !img) return

  const rect = canvas.getBoundingClientRect()
  containerSize.value = { width: rect.width, height: rect.height }
  canvasClientRect.value = { left: rect.left, top: rect.top }
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const rot = normalizeDeg(rotationDeg.value)
  const isRotated = rot === 90 || rot === 270
  const effectiveW = isRotated ? img.naturalHeight : img.naturalWidth
  const effectiveH = isRotated ? img.naturalWidth : img.naturalHeight

  const baseScale = Math.min(rect.width / effectiveW, rect.height / effectiveH)
  const scale = baseScale * userScale.value

  drawInfo.value = { scale, dpr }
  imageNaturalSize.value = { width: img.naturalWidth, height: img.naturalHeight }

  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const rad = (rot * Math.PI) / 180

  ctx.save()
  ctx.translate(centerX + translateX.value, centerY + translateY.value)
  ctx.rotate(rad)
  ctx.scale(scale, scale)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  ctx.restore()
}

const loadAndDraw = async (src: string) => {
  if (!src) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
  loadedImage.value = img
  cropRect.value = null
  isCropping.value = false
  isDragging.value = false
  userScale.value = 1
  rotationDeg.value = 0
  translateX.value = 0
  translateY.value = 0
  await Promise.resolve()
  resizeAndRedraw()
}

// 获取鼠标在画布上的坐标
const getCanvasPoint = (clientX: number, clientY: number) => {
  const canvas = cropCanvasRef.value
  if (!canvas) return { x: 0, y: 0 }

  const rect = canvasClientRect.value
  if (!rect) {
    refreshCanvasMeasure()
  }
  const r = canvasClientRect.value
  if (!r) return { x: 0, y: 0 }
  return {
    x: clientX - r.left,
    y: clientY - r.top,
  }
}

// 开始框选
const startCrop = (e: MouseEvent) => {
  if (!cropCanvasRef.value) return

  refreshCanvasMeasure()
  
  const point = getCanvasPoint(e.clientX, e.clientY)
  isCropping.value = true
  cropStartPos.value = point
  
  // 清除之前的框选
  cropRect.value = null
}

// 处理鼠标移动
const handleCropMouseMove = (e: MouseEvent) => {
  if (!isCropping.value || !cropCanvasRef.value) return

  pendingMovePoint = getCanvasPoint(e.clientX, e.clientY)
  if (rafMoveId != null) return

  rafMoveId = requestAnimationFrame(() => {
    rafMoveId = null
    const point = pendingMovePoint
    pendingMovePoint = null
    if (!point) return

    const { width: containerW, height: containerH } = getContainerSize()
    const rawX = Math.min(cropStartPos.value.x, point.x)
    const rawY = Math.min(cropStartPos.value.y, point.y)
    const rawW = Math.abs(point.x - cropStartPos.value.x)
    const rawH = Math.abs(point.y - cropStartPos.value.y)

    const x = Math.max(0, Math.min(rawX, containerW))
    const y = Math.max(0, Math.min(rawY, containerH))
    const w = Math.max(0, Math.min(rawW, containerW - x))
    const h = Math.max(0, Math.min(rawH, containerH - y))

    cropRect.value = { x, y, width: w, height: h }
  })
}

// 结束框选
const endCrop = () => {
  isCropping.value = false
  if (rafMoveId != null) {
    cancelAnimationFrame(rafMoveId)
    rafMoveId = null
  }
  pendingMovePoint = null
}

const handlePointerDown = (e: PointerEvent) => {
  if (!props.modelValue) return
  if (!cropCanvasRef.value) return

  e.preventDefault()
  e.stopPropagation()

  syncPointer(e)

  try {
    cropCanvasRef.value.setPointerCapture(e.pointerId)
  } catch {
    // ignore
  }

  if (activePointers.size === 1) {
    lastSinglePointer.value = { id: e.pointerId, x: e.clientX, y: e.clientY }
    gestureStart.value = null

    // 单指：仅用于框选
    isDragging.value = false
    startCrop({ clientX: e.clientX, clientY: e.clientY } as unknown as MouseEvent)
    return
  }

  if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values())
    const a = pts[0]
    const b = pts[1]
    gestureStart.value = {
      distance: getDistance(a, b),
      angleDeg: getAngleDeg(a, b),
      midpoint: getMidpoint(a, b),
      startScale: userScale.value,
      startRotationDeg: rotationDeg.value,
      startTranslateX: translateX.value,
      startTranslateY: translateY.value,
    }
    lastSinglePointer.value = null
    // 双指开始：停止框选
    if (isCropping.value) {
      endCrop()
    }
  }
}

const handlePointerMove = (e: PointerEvent) => {
  if (!props.modelValue) return
  if (!activePointers.has(e.pointerId)) return

  e.preventDefault()
  e.stopPropagation()

  syncPointer(e)

  // 单指
  if (activePointers.size === 1 && lastSinglePointer.value?.id === e.pointerId) {
    // 单指：框选更新
    handleCropMouseMove({ clientX: e.clientX, clientY: e.clientY } as unknown as MouseEvent)
    return
  }

  // 双指捏合缩放（对齐 ImageViewer：以中点为缩放中心做平移补偿）
  if (activePointers.size >= 2 && gestureStart.value) {
    const pts = Array.from(activePointers.values())
    const a = pts[0]
    const b = pts[1]

    const distance = getDistance(a, b)
    const angleDeg = getAngleDeg(a, b)
    const midpoint = getMidpoint(a, b)

    const scaleFactor = gestureStart.value.distance > 0 ? distance / gestureStart.value.distance : 1
    const newScale = clamp(gestureStart.value.startScale * scaleFactor, 0.5, 6)

    const containerRect = cropCanvasRef.value?.getBoundingClientRect()
    if (!containerRect) return

    const centerX = containerRect.left + containerRect.width / 2
    const centerY = containerRect.top + containerRect.height / 2

    const scaleRatio = gestureStart.value.startScale > 0 ? newScale / gestureStart.value.startScale : 1
    const startRelativeX = gestureStart.value.midpoint.x - centerX - gestureStart.value.startTranslateX
    const startRelativeY = gestureStart.value.midpoint.y - centerY - gestureStart.value.startTranslateY

    translateX.value = midpoint.x - centerX - startRelativeX * scaleRatio
    translateY.value = midpoint.y - centerY - startRelativeY * scaleRatio

    const deltaAngle = angleDeg - gestureStart.value.angleDeg
    if (Math.abs(deltaAngle) > ROTATION_THRESHOLD) {
      rotationDeg.value = gestureStart.value.startRotationDeg + deltaAngle
    }

    userScale.value = newScale
    resizeAndRedraw()
  }
}

const handlePointerUp = (e: PointerEvent) => {
  if (!activePointers.has(e.pointerId)) return

  e.preventDefault()
  e.stopPropagation()

  activePointers.delete(e.pointerId)

  try {
    cropCanvasRef.value?.releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }

  if (activePointers.size === 1) {
    const remainingId = Array.from(activePointers.keys())[0]
    const pt = activePointers.get(remainingId)
    if (pt) {
      lastSinglePointer.value = { id: remainingId, x: pt.x, y: pt.y }
    }
    gestureStart.value = null
    return
  }

  if (activePointers.size < 1) {
    lastSinglePointer.value = null
    gestureStart.value = null
    isDragging.value = false

    // 双指旋转结束：吸附到最近 90 度
    const snapped = snapToNearest90(rotationDeg.value)
    if (snapped !== rotationDeg.value) {
      rotationDeg.value = snapped
      resizeAndRedraw()
    }

    // 结束单指框选
    endCrop()
  }
}

// 导出裁剪后的图片
const exportCroppedImage = async (): Promise<string> => {
  const img = loadedImage.value
  const canvas = cropCanvasRef.value
  if (!cropRect.value || !img || !canvas) {
    throw new Error('没有选择裁剪区域')
  }

  const dpr = drawInfo.value.dpr || (window.devicePixelRatio || 1)
  const sx = Math.max(0, Math.round(cropRect.value.x * dpr))
  const sy = Math.max(0, Math.round(cropRect.value.y * dpr))
  const sw = Math.max(1, Math.round(cropRect.value.width * dpr))
  const sh = Math.max(1, Math.round(cropRect.value.height * dpr))

  const outCanvas = document.createElement('canvas')
  outCanvas.width = sw
  outCanvas.height = sh
  const ctx = outCanvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  return outCanvas.toDataURL('image/jpeg', props.quality)
}

const clampScale = (v: number) => {
  const min = 0.5
  const max = 6
  return Math.max(min, Math.min(max, v))
}

const handleWheel = (e: WheelEvent) => {
  const factor = e.deltaY > 0 ? 1 / 1.08 : 1.08
  userScale.value = clampScale(userScale.value * factor)
  resizeAndRedraw()
}

// 处理确认
const handleConfirm = async () => {
  if (!cropRect.value) return
  
  try {
    const croppedDataUrl = await exportCroppedImage()
    emit('confirm', croppedDataUrl)
    emit('update:modelValue', false)
  } catch (error) {
    console.error('[ImageCropOverlay] 图片裁剪失败:', error)
  }
}

// 处理取消
const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}

const handleRetake = () => {
  cropRect.value = null
  isCropping.value = false
  isDragging.value = false
}

const handleResize = () => resizeAndRedraw()

watch(
  () => props.imageSrc,
  (src) => {
    if (!props.modelValue) return
    if (!src) return
    loadAndDraw(src).catch((e) => {
      console.error('[ImageCropOverlay] 图片加载失败:', e)
    })
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible && props.imageSrc) {
      loadAndDraw(props.imageSrc).catch((e) => {
        console.error('[ImageCropOverlay] 图片加载失败:', e)
      })
    }
  },
)

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
/* ==================== 全屏矩形框选裁剪样式（对齐 PhotoSearchView） ==================== */
.image-crop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #000;
  z-index: 12000;
}

.image-crop-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.crop-back-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 42px;
  height: 42px;
  z-index: 10001;
}

.back-icon {
  max-width: 100%;
  max-height: 100%;
  display: block;
  object-fit: contain;
}

.crop-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.crop-canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}

.crop-canvas.is-dragging {
  cursor: move;
}

.crop-canvas.is-drawing {
  cursor: crosshair;
}

/* 裁剪遮罩 */
.crop-mask {
  position: absolute;
  background: rgba(0, 0, 0, 0.5);
  pointer-events: none;
  z-index: 1;
}

.crop-mask-full {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
}

.crop-mask-top {
  left: 0;
  right: 0;
  top: 0;
}

.crop-mask-bottom {
  left: 0;
  right: 0;
}

.crop-mask-left {
  top: 0;
}


.crop-mask-right {
  top: 0;
}

/* 框选提示 */
.crop-hint-box {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.crop-hint-rect {
  width: 56%;
  max-width: 420px;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  border: 2px dashed rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
}

.crop-hint-text {
  margin-top: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 13px;
}

/* 框选区域边框 */
.crop-overlay {
  position: absolute;
  background: transparent;
  pointer-events: none;
  z-index: 2;
}

/* 四个角的 L 形标记 */
.crop-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  pointer-events: none;
}

.crop-corner-nw {
  top: 0;
  left: 0;
  border-top: 4px solid #fff;
  border-left: 4px solid #fff;
}

.crop-corner-ne {
  top: 0;
  right: 0;
  border-top: 4px solid #fff;
  border-right: 4px solid #fff;
}

.crop-corner-sw {
  bottom: 0;
  left: 0;
  border-bottom: 4px solid #fff;
  border-left: 4px solid #fff;
}

.crop-corner-se {
  bottom: 0;
  right: 0;
  border-bottom: 4px solid #fff;
  border-right: 4px solid #fff;
}


/* 框选模式下的操作按钮（右上角确定） */
.crop-actions-panel {
  position: absolute;
  right: 16px;
  top: 16px;
  display: flex;
  justify-content: flex-end;
  z-index: 10001;
}

.crop-back-btn {
  position: absolute;
  left: 16px;
  top: 16px;
  z-index: 10001;
}
</style>
