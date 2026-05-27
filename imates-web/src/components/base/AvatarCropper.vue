<template>
  <Teleport to="body">
    <div v-if="modelValue" class="avatar-crop-overlay" @click.self="handleCancel">
      <div class="avatar-crop-container" @click.stop>
        <canvas
          ref="canvasRef"
          class="crop-canvas"
          @pointerdown.stop.prevent="onPointerDown"
          @pointermove.stop.prevent="onPointerMove"
          @wheel.prevent="onWheel"
        />

        <div class="crop-actions">
          <button type="button" class="crop-action-btn" @click.stop="reset" :disabled="!isReady">重置</button>
          <button
            type="button"
            class="crop-action-btn primary"
            :disabled="!isReady"
            @click.stop="handleConfirm"
          >
            使用
          </button>
        </div>

        <q-btn flat round dense @click.stop="handleCancel" class="crop-close-btn goback-btn">
          <img :src="goBackIcon" alt="返回" class="goback-icon" />
        </q-btn>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import goBackIcon from '/icons/goback.svg'

interface Props {
  modelValue: boolean
  src: string
  outputSize?: number
  quality?: number
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', croppedDataUrl: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  outputSize: 256,
  quality: 0.92,
})

const emit = defineEmits<Emits>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const isReady = computed(() => !!imgEl.value && !!canvasRef.value)

const canvasW = ref(0)
const canvasH = ref(0)

const isPanningImage = ref(false)
const panLastPos = ref({ x: 0, y: 0 })

const pointers = ref(new Map<number, { x: number; y: number }>())
const pinch = ref<null | {
  startDist: number
  startZoom: number
  startCenter: { x: number; y: number }
  startOffset: { x: number; y: number }
}>(null)

const getCircleRadius = () => {
  const size = Math.max(160, Math.floor(Math.min(canvasW.value, canvasH.value) * 0.62))
  return size / 2
}

const baseScale = ref(1)
const zoom = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)

const getCtx = () => {
  const canvas = canvasRef.value
  if (!canvas) return null
  return canvas.getContext('2d')
}

const ensureCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1

  canvasW.value = Math.max(1, Math.floor(rect.width))
  canvasH.value = Math.max(1, Math.floor(rect.height))

  canvas.width = Math.floor(canvasW.value * dpr)
  canvas.height = Math.floor(canvasH.value * dpr)

  const ctx = getCtx()
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
}

const computeBaseScale = () => {
  const img = imgEl.value
  if (!img) return

  // 微信头像裁剪：固定圆形预览框，图片需要 cover 圆形外接正方形
  const diameter = getCircleRadius() * 2
  const s = Math.max(diameter / img.width, diameter / img.height)
  baseScale.value = s || 1
}

const clampOffsets = () => {
  const img = imgEl.value
  if (!img) return

  const scale = baseScale.value * zoom.value
  const halfW = (img.width * scale) / 2
  const halfH = (img.height * scale) / 2

  const cx = canvasW.value / 2
  const cy = canvasH.value / 2

  const r = getCircleRadius()
  const limitRect = {
    left: cx - r,
    top: cy - r,
    right: cx + r,
    bottom: cy + r,
  }

  const minCenterX = limitRect.right - halfW
  const maxCenterX = limitRect.left + halfW
  const minCenterY = limitRect.bottom - halfH
  const maxCenterY = limitRect.top + halfH

  const centerX = cx + offsetX.value
  const centerY = cy + offsetY.value

  const clampedCenterX = Math.min(Math.max(centerX, minCenterX), maxCenterX)
  const clampedCenterY = Math.min(Math.max(centerY, minCenterY), maxCenterY)

  offsetX.value = clampedCenterX - cx
  offsetY.value = clampedCenterY - cy
}

const draw = () => {
  const ctx = getCtx()
  const img = imgEl.value
  if (!ctx || !img) return

  ctx.clearRect(0, 0, canvasW.value, canvasH.value)

  const scale = baseScale.value * zoom.value
  const cx = canvasW.value / 2 + offsetX.value
  const cy = canvasH.value / 2 + offsetY.value

  const drawW = img.width * scale
  const drawH = img.height * scale

  // 绘制图片
  ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH)

  // 固定圆形遮罩（透视区域显示图片）
  const r = getCircleRadius()
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, canvasW.value, canvasH.value)
  ctx.arc(canvasW.value / 2, canvasH.value / 2, r, 0, Math.PI * 2)
  ctx.clip('evenodd')
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(0, 0, canvasW.value, canvasH.value)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(canvasW.value / 2, canvasH.value / 2, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

const reset = () => {
  zoom.value = 1
  offsetX.value = 0
  offsetY.value = 0
  ensureCanvasSize()
  computeBaseScale()
  clampOffsets()
  draw()
}

const onWheel = (e: WheelEvent) => {
  if (!isReady.value) return
  const delta = e.deltaY
  const factor = delta > 0 ? 1 / 1.08 : 1.08
  zoom.value = Math.min(Math.max(zoom.value * factor, 1), 6)
  clampOffsets()
  draw()
}

const getDist = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  const dx = p1.x - p2.x
  const dy = p1.y - p2.y
  return Math.sqrt(dx * dx + dy * dy)
}

const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
}

const getCanvasPoint = (clientX: number, clientY: number) => {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

const onPointerDown = (e: PointerEvent) => {
  if (!isReady.value) return
  if (e.button !== undefined && e.button !== 0) return

  const canvas = canvasRef.value
  if (!canvas) return

  const { x, y } = getCanvasPoint(e.clientX, e.clientY)
  pointers.value.set(e.pointerId, { x, y })

  // 多指：进入 pinch 缩放/平移
  if (pointers.value.size === 2) {
    const pts = Array.from(pointers.value.values())
    pinch.value = {
      startDist: getDist(pts[0], pts[1]),
      startZoom: zoom.value,
      startCenter: getCenter(pts[0], pts[1]),
      startOffset: { x: offsetX.value, y: offsetY.value },
    }
    isPanningImage.value = false
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    return
  }

  // 单指：拖动图片
  isPanningImage.value = true
  panLastPos.value = { x, y }
  try {
    canvas.setPointerCapture(e.pointerId)
  } catch {
    // ignore
  }
}

const onPointerMove = (e: PointerEvent) => {
  if (!isReady.value) return

  const { x, y } = getCanvasPoint(e.clientX, e.clientY)
  if (pointers.value.has(e.pointerId)) {
    pointers.value.set(e.pointerId, { x, y })
  }

  // pinch 缩放/平移
  if (pinch.value && pointers.value.size >= 2) {
    const pts = Array.from(pointers.value.values())
    const dist = getDist(pts[0], pts[1])
    const center = getCenter(pts[0], pts[1])
    const ratio = pinch.value.startDist ? dist / pinch.value.startDist : 1
    zoom.value = Math.min(Math.max(pinch.value.startZoom * ratio, 1), 6)

    // 用两指中心点的位移来平移图片
    offsetX.value = pinch.value.startOffset.x + (center.x - pinch.value.startCenter.x)
    offsetY.value = pinch.value.startOffset.y + (center.y - pinch.value.startCenter.y)
    clampOffsets()
    draw()
    return
  }

  if (isPanningImage.value) {
    const dx = x - panLastPos.value.x
    const dy = y - panLastPos.value.y
    panLastPos.value = { x, y }
    offsetX.value += dx
    offsetY.value += dy
    clampOffsets()
    draw()
    return
  }
}

const onPointerUp = () => {
  // pointerup / cancel 时由 pointerId 事件先删指针（下面单独的 listener 做）
  isPanningImage.value = false
  pinch.value = null

  clampOffsets()
  draw()
}

const exportCroppedDataUrl = async (): Promise<string> => {
  const img = imgEl.value
  if (!img) throw new Error('图片未加载')

  const scale = baseScale.value * zoom.value
  const cx = canvasW.value / 2 + offsetX.value
  const cy = canvasH.value / 2 + offsetY.value

  const radius = getCircleRadius()
  const diameter = radius * 2

  // 固定圆形的外接正方形区域（在 canvas 坐标）
  const rectLeft = canvasW.value / 2 - radius
  const rectTop = canvasH.value / 2 - radius

  const sx = (rectLeft - (cx - (img.width * scale) / 2)) / scale
  const sy = (rectTop - (cy - (img.height * scale) / 2)) / scale
  const sw = diameter / scale
  const sh = diameter / scale

  const safeSx = Math.max(0, Math.min(img.width, sx))
  const safeSy = Math.max(0, Math.min(img.height, sy))
  const safeSw = Math.max(1, Math.min(img.width - safeSx, sw))
  const safeSh = Math.max(1, Math.min(img.height - safeSy, sh))

  const out = document.createElement('canvas')
  out.width = props.outputSize
  out.height = props.outputSize

  const outCtx = out.getContext('2d')
  if (!outCtx) throw new Error('裁剪失败')

  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'

  const side = Math.min(safeSw, safeSh)
  const dx = (safeSw - side) / 2
  const dy = (safeSh - side) / 2
  outCtx.drawImage(img, safeSx + dx, safeSy + dy, side, side, 0, 0, props.outputSize, props.outputSize)

  return out.toDataURL('image/jpeg', props.quality)
}

const handleConfirm = async () => {
  try {
    const dataUrl = await exportCroppedDataUrl()
    emit('confirm', dataUrl)
    emit('update:modelValue', false)
  } catch (e) {
    console.error('[AvatarCropOverlay] 裁剪失败:', e)
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:modelValue', false)
}

let resizeObserver: ResizeObserver | null = null

const setup = async () => {
  await nextTick()
  ensureCanvasSize()
  computeBaseScale()
  clampOffsets()
  draw()

  const canvas = canvasRef.value
  if (canvas && !resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      ensureCanvasSize()
      computeBaseScale()
      clampOffsets()
      draw()
    })
    resizeObserver.observe(canvas)
  }
}

watch(
  () => [props.modelValue, props.src] as const,
  async ([visible, src]) => {
    if (!visible) return
    if (!src) return

    pointers.value.clear()
    pinch.value = null
    isPanningImage.value = false

    const img = new Image()
    img.onload = async () => {
      imgEl.value = img
      await setup()
      reset()
    }
    img.onerror = () => {
      imgEl.value = null
    }
    img.src = src
  }
)

const handleResize = () => {
  if (!props.modelValue) return
  ensureCanvasSize()
  computeBaseScale()
  clampOffsets()
  draw()
}

window.addEventListener('resize', handleResize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeObserver && canvasRef.value) {
    resizeObserver.unobserve(canvasRef.value)
  }
  resizeObserver = null
})

// 统一收尾：删除 pointer 并在最后一根手指抬起时退出 pinch
const onGlobalPointerUp = (e: PointerEvent) => {
  if (!props.modelValue) return
  if (pointers.value.has(e.pointerId)) {
    pointers.value.delete(e.pointerId)
  }
  if (pointers.value.size < 2) {
    pinch.value = null
  }
  onPointerUp()
}

window.addEventListener('pointerup', onGlobalPointerUp)
window.addEventListener('pointercancel', onGlobalPointerUp)

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', onGlobalPointerUp)
  window.removeEventListener('pointercancel', onGlobalPointerUp)
})
</script>

<style scoped>
.avatar-crop-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: rgba(0, 0, 0, 1);
}

.avatar-crop-container {
  position: absolute;
  inset: 0;
}

.crop-canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  touch-action: none;
  user-select: none;
}

.crop-actions {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: flex;
  gap: 10px;
  z-index: 12001;
}

.crop-action-btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(20, 20, 20, 0.55);
  color: #fff;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
}

.crop-action-btn.primary {
  background: rgba(110, 85, 255, 0.85);
  border-color: rgba(110, 85, 255, 0.9);
}

.crop-action-btn:disabled {
  opacity: 0.5;
}

.crop-close-btn {
  position: fixed;
  left: 18px;
  top: 18px;
  z-index: 12001;
}

.goback-btn {
  padding: 8px;
}

.goback-icon {
  width: 24px;
  height: 24px;
  display: block;
}
</style>
