<template>
  <Teleport to="body">
    <div v-if="modelValue" class="screen-capture-overlay" @click.self="handleCancel">
      <div class="screen-capture-container" @click.stop>
        <canvas
          ref="canvasRef"
          class="capture-canvas"
          :style="{ cursor: currentCursor }"
          @pointerdown.stop.prevent="startCrop"
          @pointermove.stop.prevent="handlePointerMove"
          @pointerup.stop.prevent="endCrop"
          @pointercancel.stop.prevent="endCrop"
          @pointerleave.stop.prevent="handlePointerLeave"
          @mousedown.stop.prevent="startCropMouse"
          @mousemove.stop.prevent="handleMouseMove"
          @mouseup.stop.prevent="endCrop"
          @mouseleave.stop.prevent="handleMouseLeave"
          @touchstart.stop.prevent="startCropTouch"
          @touchmove.stop.prevent="handleTouchMove"
          @touchend.stop.prevent="endCrop"
          @touchcancel.stop.prevent="endCrop"
        ></canvas>

        <div v-if="!isCropping && !cropRect" class="crop-mask crop-mask-full">
          <div class="crop-hint-box">
            <div class="crop-hint-rect"></div>
            <div class="crop-hint-text">在中间区域拖动框选题目</div>
          </div>
        </div>
        <template v-else>
          <div class="crop-mask crop-mask-top" :style="cropMaskTopStyle"></div>
          <div class="crop-mask crop-mask-bottom" :style="cropMaskBottomStyle"></div>
          <div class="crop-mask crop-mask-left" :style="cropMaskLeftStyle"></div>
          <div class="crop-mask crop-mask-right" :style="cropMaskRightStyle"></div>
          <div class="crop-overlay" :style="cropOverlayStyle">
            <div class="crop-corner crop-corner-nw"></div>
            <div class="crop-corner crop-corner-ne"></div>
            <div class="crop-corner crop-corner-sw"></div>
            <div class="crop-corner crop-corner-se"></div>
          </div>
        </template>

        <div class="capture-actions">
          <button type="button" class="capture-action-btn" @click.stop="handleRetake">重截</button>
          <button
            type="button"
            class="capture-action-btn primary"
            :disabled="!cropRect"
            @click.stop="handleConfirm"
          >
            确认
          </button>
        </div>

        <button type="button" class="capture-close-btn" @click.stop="handleCancel">×</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { androidBridge } from '@/services/business/android-bridge'

type CropRect = { x: number; y: number; width: number; height: number }

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'captured', payload: { dataUrl: string; width: number; height: number }): void
  (e: 'cancel'): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const imageDataUrl = ref('')
const imageEl = ref<HTMLImageElement | null>(null)

const isAndroidSnapshotAvailable = computed(() => {
  return androidBridge.isAndroidBridgeAvailable() && typeof window !== 'undefined' && !!window.AndroidBridge?.takeSnapshot
})

const cropRect = ref<CropRect | null>(null)
const isCropping = ref(false)
const cropStartPos = ref({ x: 0, y: 0 })

const lastPointerDownAt = ref(0)
const lastTouchStartAt = ref(0)

const debugEnabled = computed(() => {
  if (typeof window === 'undefined') return false
  return window.localStorage?.getItem('screen_capture_debug') === '1'
})

const debugLog = (...args: any[]) => {
  if (!debugEnabled.value) return
  // eslint-disable-next-line no-console
  console.log('[ScreenCaptureOverlay]', ...args)
}

const currentCursor = computed(() => {
  return isCropping.value ? 'crosshair' : cropRect.value ? 'default' : 'crosshair'
})

const close = () => {
  emit('update:modelValue', false)
}

const handleCancel = () => {
  close()
  emit('cancel')
}

const handleRetake = async () => {
  cropRect.value = null
  await captureScreen()
}

const getCanvasSize = () => {
  const canvas = canvasRef.value
  if (!canvas) return { width: 0, height: 0 }
  const rect = canvas.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

const cropOverlayStyle = computed(() => {
  if (!cropRect.value) return {}
  return {
    left: `${cropRect.value.x}px`,
    top: `${cropRect.value.y}px`,
    width: `${cropRect.value.width}px`,
    height: `${cropRect.value.height}px`,
  }
})

const cropMaskTopStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width } = getCanvasSize()
  return {
    top: '0',
    left: '0',
    width: `${width}px`,
    height: `${cropRect.value.y}px`,
  }
})

const cropMaskBottomStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width, height } = getCanvasSize()
  const bottomY = cropRect.value.y + cropRect.value.height
  return {
    top: `${bottomY}px`,
    left: '0',
    width: `${width}px`,
    height: `${height - bottomY}px`,
  }
})

const cropMaskLeftStyle = computed(() => {
  if (!cropRect.value) return {}
  return {
    top: `${cropRect.value.y}px`,
    left: '0',
    width: `${cropRect.value.x}px`,
    height: `${cropRect.value.height}px`,
  }
})

const cropMaskRightStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width } = getCanvasSize()
  const rightX = cropRect.value.x + cropRect.value.width
  return {
    top: `${cropRect.value.y}px`,
    left: `${rightX}px`,
    width: `${width - rightX}px`,
    height: `${cropRect.value.height}px`,
  }
})

const drawToCanvas = () => {
  const canvas = canvasRef.value
  const img = imageEl.value
  if (!canvas || !img) return

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const cw = Math.max(1, Math.floor(rect.width))
  const ch = Math.max(1, Math.floor(rect.height))

  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
    canvas.width = cw * dpr
    canvas.height = ch * dpr
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.drawImage(img, 0, 0, cw, ch)
}

const captureScreen = async () => {
  try {
    if (isAndroidSnapshotAvailable.value) {
      const dataUrl = await captureScreenFromAndroid()
      await applyCapturedDataUrl(dataUrl)
      return
    }

    // Web 场景：直接选择当前窗口，无需弹窗
    const stream = await navigator.mediaDevices.getDisplayMedia({ 
      video: true, 
      audio: false 
    })
    const video = document.createElement('video')
    video.playsInline = true
    video.muted = true
    video.srcObject = stream

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        resolve()
      }
      const onError = () => reject(new Error('video load failed'))
      video.addEventListener('loadedmetadata', onLoaded, { once: true })
      video.addEventListener('error', onError, { once: true })
      video.play().catch(reject)
    })

    await new Promise((r) => requestAnimationFrame(() => r(null)))

    const vw = video.videoWidth || 0
    const vh = video.videoHeight || 0
    if (!vw || !vh) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error('invalid video size')
    }

    const temp = document.createElement('canvas')
    temp.width = vw
    temp.height = vh
    const tctx = temp.getContext('2d')
    if (!tctx) {
      stream.getTracks().forEach((t) => t.stop())
      throw new Error('no canvas ctx')
    }
    tctx.drawImage(video, 0, 0, vw, vh)
    stream.getTracks().forEach((t) => t.stop())

    await applyCapturedDataUrl(temp.toDataURL('image/png'))
  } catch (e) {
    handleCancel()
  }
}

const applyCapturedDataUrl = async (dataUrl: string) => {
  imageDataUrl.value = dataUrl

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('image load failed'))
    img.src = imageDataUrl.value
  })

  imageEl.value = img
  await nextTick()
  drawToCanvas()
}

const normalizeSnapshotDataUrl = (payload: unknown): string => {
  if (!payload) return ''

  const asDataUrl = (s: string) => {
    if (!s) return ''
    if (s.startsWith('data:image/')) return s
    // 兼容纯 base64 字符串
    if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 100) return `data:image/png;base64,${s}`
    return ''
  }

  if (typeof payload === 'string') {
    // 可能是 JSON 字符串或 dataUrl/base64
    const direct = asDataUrl(payload)
    if (direct) return direct

    try {
      const obj = JSON.parse(payload)
      return normalizeSnapshotDataUrl(obj)
    } catch {
      return ''
    }
  }

  if (typeof payload === 'object') {
    const anyObj = payload as any
    return (
      asDataUrl(anyObj.dataUrl) ||
      asDataUrl(anyObj.base64DataUrl) ||
      asDataUrl(anyObj.base64) ||
      asDataUrl(anyObj.data) ||
      asDataUrl(anyObj.imageData) ||
      ''
    )
  }

  return ''
}

const captureScreenFromAndroid = async (): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const commandId = `snapshot_${Date.now()}_${Math.random().toString(16).slice(2)}`

    let done = false
    const cleanup = () => {
      if (done) return
      done = true
      androidBridge.removeEventListener('snapshotTaken', onTaken)
      window.clearTimeout(timeoutId)
    }

    const onTaken = (imageData: unknown) => {
      cleanup()
      const dataUrl = normalizeSnapshotDataUrl(imageData)
      if (!dataUrl) {
        reject(new Error('invalid snapshot payload'))
        return
      }
      resolve(dataUrl)
    }

    androidBridge.addEventListener('snapshotTaken', onTaken)

    const ok = androidBridge.takeSnapshot(commandId)
    if (!ok) {
      cleanup()
      reject(new Error('takeSnapshot failed'))
      return
    }

    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('takeSnapshot timeout'))
    }, 12000)
  })
}

watch(
  () => props.modelValue,
  async (v) => {
    if (!v) return
    cropRect.value = null
    await nextTick()
    await captureScreen()
  },
)

const clampRect = (x: number, y: number, w: number, h: number) => {
  const { width, height } = getCanvasSize()
  const nx = Math.max(0, Math.min(x, width))
  const ny = Math.max(0, Math.min(y, height))
  const nw = Math.max(0, Math.min(w, width - nx))
  const nh = Math.max(0, Math.min(h, height - ny))
  return { x: nx, y: ny, width: nw, height: nh }
}

const getRelativePos = (clientX: number, clientY: number) => {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

const startCropAt = async (pos: { x: number; y: number }, pointerId?: number) => {
  const canvas = canvasRef.value
  if (!canvas) return
  debugLog('startCropAt', {
    x: pos.x,
    y: pos.y,
    pointerId,
    before: {
      isCropping: isCropping.value,
      cropRect: cropRect.value,
    },
  })
  cropStartPos.value = { x: pos.x, y: pos.y }
  cropRect.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  await nextTick()
  isCropping.value = true
  debugLog('startCropAt done', {
    isCropping: isCropping.value,
    cropRect: cropRect.value,
  })

  if (pointerId != null) {
    try {
      canvas.setPointerCapture(pointerId)
    } catch {
      // ignore
    }
  }
}

const updateCropAt = (pos: { x: number; y: number }) => {
  if (!isCropping.value || !cropRect.value) return
  const startX = cropStartPos.value.x
  const startY = cropStartPos.value.y
  const left = Math.min(startX, pos.x)
  const top = Math.min(startY, pos.y)
  const width = Math.abs(pos.x - startX)
  const height = Math.abs(pos.y - startY)
  cropRect.value = clampRect(left, top, width, height)
  if (debugEnabled.value) {
    const now = performance.now()
    ;(updateCropAt as any).__lastLogTs ??= 0
    const last = (updateCropAt as any).__lastLogTs as number
    if (now - last > 120) {
      ;(updateCropAt as any).__lastLogTs = now
      debugLog('updateCropAt', {
        x: pos.x,
        y: pos.y,
        cropRect: cropRect.value,
      })
    }
  }
}

const startCrop = (e: PointerEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return

  lastPointerDownAt.value = Date.now()

  debugLog('pointerdown', {
    pointerId: e.pointerId,
    pointerType: (e as any).pointerType,
    button: (e as any).button,
    buttons: (e as any).buttons,
    isCropping: isCropping.value,
    hasCropRect: !!cropRect.value,
  })

  // Android WebView 的 PointerEvent 在触摸场景下可能出现 button = -1 等非 0 值；
  // 这里只对 mouse 做左键校验，避免触摸无法开始框选。
  if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) {
    debugLog('pointerdown blocked by button check', {
      pointerId: e.pointerId,
      pointerType: (e as any).pointerType,
      button: (e as any).button,
      buttons: (e as any).buttons,
    })
    return
  }

  const pos = getRelativePos(e.clientX, e.clientY)
  if (!pos) return
  startCropAt(pos, e.pointerId)
}

const handlePointerMove = (e: PointerEvent) => {
  const pos = getRelativePos(e.clientX, e.clientY)
  if (!pos) return
  updateCropAt(pos)
}

const startCropMouse = (e: MouseEvent) => {
  if (Date.now() - lastTouchStartAt.value < 800) return
  if (e.button !== 0) return
  const pos = getRelativePos(e.clientX, e.clientY)
  if (!pos) return
  startCropAt(pos)
}

const handleMouseMove = (e: MouseEvent) => {
  if (Date.now() - lastTouchStartAt.value < 800) return
  const pos = getRelativePos(e.clientX, e.clientY)
  if (!pos) return
  updateCropAt(pos)
}

const handleMouseLeave = () => {
  if (isCropping.value) endCrop()
}

const startCropTouch = (e: TouchEvent) => {
  if (Date.now() - lastPointerDownAt.value < 500) return
  lastTouchStartAt.value = Date.now()
  const touch = e.touches?.[0]
  if (!touch) return
  const pos = getRelativePos(touch.clientX, touch.clientY)
  if (!pos) return
  startCropAt(pos)
}

const handleTouchMove = (e: TouchEvent) => {
  if (Date.now() - lastPointerDownAt.value < 500) return
  const touch = e.touches?.[0]
  if (!touch) return
  const pos = getRelativePos(touch.clientX, touch.clientY)
  if (!pos) return
  updateCropAt(pos)
}

const endCrop = () => {
  if (!isCropping.value) return
  isCropping.value = false
  if (!cropRect.value) return
  if (cropRect.value.width < 5 || cropRect.value.height < 5) {
    cropRect.value = null
  }
  debugLog('endCrop', {
    cropRect: cropRect.value,
  })
}

const handlePointerLeave = () => {
  if (isCropping.value) endCrop()
}

const handleConfirm = async () => {
  const img = imageEl.value
  const rect = cropRect.value
  const canvas = canvasRef.value
  if (!img || !rect || !canvas) return

  const dpr = window.devicePixelRatio || 1
  const cw = Math.max(1, Math.floor(canvas.getBoundingClientRect().width))
  const ch = Math.max(1, Math.floor(canvas.getBoundingClientRect().height))

  const sx = Math.round((rect.x / cw) * img.width)
  const sy = Math.round((rect.y / ch) * img.height)
  const sw = Math.round((rect.width / cw) * img.width)
  const sh = Math.round((rect.height / ch) * img.height)

  const out = document.createElement('canvas')
  out.width = Math.max(1, sw)
  out.height = Math.max(1, sh)
  const ctx = out.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height)

  const dataUrl = out.toDataURL('image/png')
  emit('captured', { dataUrl, width: out.width, height: out.height })
  close()
}

const handleResize = () => {
  if (!props.modelValue) return
  drawToCanvas()
}

window.addEventListener('resize', handleResize)

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.screen-capture-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: rgba(0, 0, 0, 0.6);
}

.screen-capture-container {
  position: absolute;
  inset: 0;
}

.capture-canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  touch-action: none;
  user-select: none;
}

.crop-mask {
  position: absolute;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.crop-mask-full {
  inset: 0;
}

.crop-hint-box {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 360px;
  height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.crop-hint-rect {
  width: 360px;
  height: 240px;
  border: 2px dashed rgba(255, 255, 255, 0.8);
  border-radius: 12px;
}

.crop-hint-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.crop-overlay {
  position: absolute;
  border: 2px solid rgba(110, 85, 255, 0.95);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25) inset;
  pointer-events: none;
}

.crop-corner {
  position: absolute;
  width: 14px;
  height: 14px;
}

.crop-corner-nw {
  left: -2px;
  top: -2px;
  border-left: 3px solid rgba(110, 85, 255, 1);
  border-top: 3px solid rgba(110, 85, 255, 1);
}

.crop-corner-ne {
  right: -2px;
  top: -2px;
  border-right: 3px solid rgba(110, 85, 255, 1);
  border-top: 3px solid rgba(110, 85, 255, 1);
}

.crop-corner-sw {
  left: -2px;
  bottom: -2px;
  border-left: 3px solid rgba(110, 85, 255, 1);
  border-bottom: 3px solid rgba(110, 85, 255, 1);
}

.crop-corner-se {
  right: -2px;
  bottom: -2px;
  border-right: 3px solid rgba(110, 85, 255, 1);
  border-bottom: 3px solid rgba(110, 85, 255, 1);
}

.capture-actions {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: flex;
  gap: 10px;
  z-index: 12001;
}

.capture-action-btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(20, 20, 20, 0.55);
  color: #fff;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
}

.capture-action-btn.primary {
  background: rgba(110, 85, 255, 0.85);
  border-color: rgba(110, 85, 255, 0.9);
}

.capture-action-btn:disabled {
  opacity: 0.5;
}

.capture-close-btn {
  position: fixed;
  left: 18px;
  top: 18px;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(20, 20, 20, 0.55);
  color: #fff;
  font-size: 20px;
  line-height: 34px;
  text-align: center;
  z-index: 12001;
}
</style>
