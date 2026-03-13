<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="screen-capture-overlay"
      :class="{ 'is-snapshot-preparing': isSnapshotPreparing }"
      @click.self="handleCancel"
    >
      <div class="screen-capture-container" @click.stop>
        <canvas
          ref="canvasRef"
          class="capture-canvas"
          :style="{ cursor: currentCursor }"
          @pointerdown.stop.prevent="startCrop"
          @pointermove.stop.prevent="handlePointerMove"
          @pointerup.stop.prevent="handlePointerUp"
          @pointercancel.stop.prevent="handlePointerCancel"
          @pointerleave.stop.prevent="handlePointerLeave"
          @mousedown.stop.prevent="startCropMouse"
          @mousemove.stop.prevent="handleMouseMove"
          @mouseup.stop.prevent="handleMouseUp"
          @mouseleave.stop.prevent="handleMouseLeave"
          @touchstart.stop.prevent="startCropTouch"
          @touchmove.stop.prevent="handleTouchMove"
          @touchend.stop.prevent="handleTouchEnd"
          @touchcancel.stop.prevent="handleTouchCancel"
        ></canvas>

        <template v-if="!isSnapshotPreparing">
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
        </template>

        <div class="capture-actions">
          <button
            type="button"
            class="capture-action-btn"
            :disabled="isSnapshotPreparing"
            @click.stop="handleRetake"
          >
            重截
          </button>
          <button
            type="button"
            class="capture-action-btn primary"
            :disabled="!cropRect || isSnapshotPreparing"
            @click.stop="handleConfirm"
          >
            确认
          </button>
        </div>

        <q-btn flat round dense @click.stop="handleCancel" class="capture-close-btn goback-btn">
          <img :src="goBackIcon" alt="返回" class="goback-icon" />
        </q-btn>

        <!-- 开发环境调试面板 -->
        <ScreenshotDebugPanel 
          :debug-image-data="debugImageData" 
          @close="debugImageData = null" 
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { androidBridge } from '@/services/business/android-bridge'
import goBackIcon from '/icons/goback.svg'
import ScreenshotDebugPanel from '@/components/debug/ScreenshotDebugPanel.vue'

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
const isSnapshotPreparing = ref(false)

const lastPointerDownAt = ref(0)
const lastTouchStartAt = ref(0)

const isDev = ref(true) // 开发环境固定为 true，生产环境可改为 false
const debugImageData = ref<{
  source: string
  format: string
  width: number
  height: number
  dataLength: number
  prefix: string
  timestamp: number
  dataUrl?: string
} | null>(null)

const debugEnabled = computed(() => {
  return true
})

const debugLog = (...args: any[]) => {
   
  console.log('[ScreenCaptureOverlay]', ...args)
}

const logPointer = (type: string, e: PointerEvent) => {
  debugLog(type, {
    pointerId: e.pointerId,
    pointerType: (e as any).pointerType,
    button: (e as any).button,
    buttons: (e as any).buttons,
    clientX: e.clientX,
    clientY: e.clientY,
    isCropping: isCropping.value,
    hasCropRect: !!cropRect.value,
  })
}

const logMouse = (type: string, e: MouseEvent) => {
  debugLog(type, {
    button: (e as any).button,
    buttons: (e as any).buttons,
    clientX: e.clientX,
    clientY: e.clientY,
    isCropping: isCropping.value,
    hasCropRect: !!cropRect.value,
  })
}

const logTouch = (type: string, e: TouchEvent) => {
  const t = e.touches?.[0] || e.changedTouches?.[0]
  debugLog(type, {
    touches: e.touches?.length ?? 0,
    changedTouches: e.changedTouches?.length ?? 0,
    clientX: t?.clientX,
    clientY: t?.clientY,
    isCropping: isCropping.value,
    hasCropRect: !!cropRect.value,
  })
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
  if (isSnapshotPreparing.value) return
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
      isSnapshotPreparing.value = true
      await nextTick()
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const dataUrl = await captureScreenFromAndroid()
      await applyCapturedDataUrl(dataUrl)
      isSnapshotPreparing.value = false
      return
    }

    isSnapshotPreparing.value = true

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
    isSnapshotPreparing.value = false
  } catch (e) {
    isSnapshotPreparing.value = false
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
  
  // 开发环境调试信息
  if (isDev.value) {
    const isAndroid = isAndroidSnapshotAvailable.value
    const prefix = dataUrl.substring(0, 50)
    const formatMatch = dataUrl.match(/^data:image\/(\w+);/)
    const format = formatMatch ? formatMatch[1] : 'unknown'
    
    debugImageData.value = {
      source: isAndroid ? 'Android原生' : 'Web DisplayMedia',
      format,
      width: img.width,
      height: img.height,
      dataLength: dataUrl.length,
      prefix,
      timestamp: Date.now(),
      dataUrl
    }
  }
  debugLog('applyCapturedDataUrl loaded', {
    dataUrlLength: imageDataUrl.value?.length || 0,
    width: img.width,
    height: img.height,
  })
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
    let timeoutId: number | undefined
    const cleanup = () => {
      if (done) return
      done = true
      androidBridge.removeEventListener('snapshotTaken', onTaken)
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }

    const onTaken = (imageData: unknown) => {
      cleanup()
      const dataUrl = normalizeSnapshotDataUrl(imageData)
      if (!dataUrl) {
        reject(new Error('invalid snapshot payload'))
        return
      }
      
      // 记录截图方法
      debugLog('截图完成', {
        commandId,
        method: imageData && typeof imageData === 'object' ? (imageData as any).method : 'unknown',
        dataUrlLength: dataUrl.length
      })
      
      resolve(dataUrl)
    }

    androidBridge.addEventListener('snapshotTaken', onTaken)

    // 关键：在调用原生截图前，等待当前帧完全渲染
    const triggerNativeSnapshot = async () => {
      // 等待当前 JavaScript 执行完成
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // 等待浏览器渲染完成
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      })

      const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

      const waitForMediaProjectionPermissionResult = (timeoutMs = 12000) => {
        return new Promise<boolean | null>((resolve) => {
          const onResult = (granted: boolean) => {
            window.clearTimeout(tid)
            androidBridge.removeEventListener('mediaProjectionPermissionResult', onResult)
            resolve(granted)
          }

          const tid = window.setTimeout(() => {
            androidBridge.removeEventListener('mediaProjectionPermissionResult', onResult)
            resolve(null)
          }, timeoutMs)

          androidBridge.addEventListener('mediaProjectionPermissionResult', onResult)
        })
      }

      const waitForMediaProjectionPermission = async (timeoutMs = 12000, intervalMs = 250) => {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
          if (done) return false
          if (androidBridge.hasMediaProjectionPermission()) return true
          await sleep(intervalMs)
        }
        return false
      }
      
      // 检查 MediaProjection 权限
      if (androidBridge.hasMediaProjectionPermission()) {
        debugLog('使用 MediaProjection 截图')
      } else {
        debugLog('MediaProjection 权限未授权，将使用 rootView.draw() 截图')
        let permissionRequestStarted = false
        try {
          permissionRequestStarted = androidBridge.requestMediaProjectionPermission()
        } catch {
          permissionRequestStarted = false
        }

        if (!permissionRequestStarted) {
          cleanup()
          reject(new Error('MediaProjection permission request rejected'))
          return
        }

        debugLog('开始等待 MediaProjection 权限授权...')
        const permissionResult = await waitForMediaProjectionPermissionResult()
        if (permissionResult === false) {
          debugLog('MediaProjection 权限被拒绝，清理资源')
          cleanup()
          reject(new Error('MediaProjection permission denied'))
          return
        }

        const granted =
          permissionResult === true ? true : await waitForMediaProjectionPermission()
        debugLog('MediaProjection 权限授权结果:', granted)
        if (!granted) {
          debugLog('MediaProjection 权限授权失败，清理资源')
          cleanup()
          reject(new Error('MediaProjection permission not granted'))
          return
        }

        debugLog('MediaProjection 权限已授权，准备调用原生截图')
      }
      
      debugLog('调用原生截图方法，commandId:', commandId)
      timeoutId = window.setTimeout(() => {
        debugLog('截图超时，清理资源')
        cleanup()
        reject(new Error('takeSnapshot timeout'))
      }, 12000)
      const ok = androidBridge.takeSnapshot(commandId)
      debugLog('原生截图方法调用结果:', ok)
      if (!ok) {
        debugLog('原生截图调用失败，清理资源')
        cleanup()
        reject(new Error('takeSnapshot failed'))
      }
    }

    debugLog('开始执行 triggerNativeSnapshot')
    triggerNativeSnapshot()
  })
}

watch(
  () => props.modelValue,
  async (v) => {
    if (!v) return
    cropRect.value = null
    imageDataUrl.value = ''
    imageEl.value = null
    isSnapshotPreparing.value = false
    await nextTick()
    await captureScreen()
  },
  { immediate: true },
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

const startCrop = (e: PointerEvent) => {
  if (isSnapshotPreparing.value) return
  const canvas = canvasRef.value
  if (!canvas) return

  lastPointerDownAt.value = Date.now()

  logPointer('pointerdown', e)

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
  logPointer('pointermove', e)
  const pos = getRelativePos(e.clientX, e.clientY)
  if (!pos) return
  updateCropAt(pos)
}

const handlePointerUp = (e: PointerEvent) => {
  logPointer('pointerup', e)
  endCrop()
}

const handlePointerCancel = (e: PointerEvent) => {
  logPointer('pointercancel', e)
  endCrop()
}

const startCropMouse = (e: MouseEvent) => {
  if (isSnapshotPreparing.value) return
  logMouse('mousedown', e)
  if (Date.now() - lastTouchStartAt.value < 800) return
  if (e.button !== 0) return
  const pos = getRelativePos(e.clientX, e.clientY)
  if (!pos) return
  startCropAt(pos)
}

const handleMouseMove = (e: MouseEvent) => {
  logMouse('mousemove', e)
  if (Date.now() - lastTouchStartAt.value < 800) return
  const pos = getRelativePos(e.clientX, e.clientY)
  if (!pos) return
  updateCropAt(pos)
}

const handleMouseUp = (e: MouseEvent) => {
  logMouse('mouseup', e)
  endCrop()
}

const handleMouseLeave = () => {
  debugLog('mouseleave', {
    isCropping: isCropping.value,
    hasCropRect: !!cropRect.value,
  })
  if (isCropping.value) endCrop()
}

const startCropTouch = (e: TouchEvent) => {
  if (isSnapshotPreparing.value) return
  logTouch('touchstart', e)
  if (Date.now() - lastPointerDownAt.value < 500) return
  lastTouchStartAt.value = Date.now()
  const touch = e.touches?.[0]
  if (!touch) return
  const pos = getRelativePos(touch.clientX, touch.clientY)
  if (!pos) return
  startCropAt(pos)
}

const handleTouchMove = (e: TouchEvent) => {
  logTouch('touchmove', e)
  if (Date.now() - lastPointerDownAt.value < 500) return
  const touch = e.touches?.[0]
  if (!touch) return
  const pos = getRelativePos(touch.clientX, touch.clientY)
  if (!pos) return
  updateCropAt(pos)
}

const handleTouchEnd = (e: TouchEvent) => {
  logTouch('touchend', e)
  endCrop()
}

const handleTouchCancel = (e: TouchEvent) => {
  logTouch('touchcancel', e)
  endCrop()
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
  debugLog('pointerleave', {
    isCropping: isCropping.value,
    hasCropRect: !!cropRect.value,
  })
  if (isCropping.value) endCrop()
}

const handleConfirm = async () => {
  if (isSnapshotPreparing.value) return
  let img = imageEl.value
  const rect = cropRect.value
  const canvas = canvasRef.value
  if (!rect || !canvas) return

  if (!img && imageDataUrl.value) {
    const fallbackImg = new Image()
    try {
      await new Promise<void>((resolve, reject) => {
        fallbackImg.onload = () => resolve()
        fallbackImg.onerror = () => reject(new Error('image load failed'))
        fallbackImg.src = imageDataUrl.value
      })
      imageEl.value = fallbackImg
      img = fallbackImg
    } catch {
      return
    }
  }

  if (!img) {
    debugLog('handleConfirm aborted: img is null', {
      dataUrlLength: imageDataUrl.value?.length || 0,
      hasCropRect: !!cropRect.value,
    })
    return
  }

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
  z-index: 20000;
  background: rgba(0, 0, 0, 0.6);
}

.screen-capture-overlay.is-snapshot-preparing {
  background: transparent;
}

.screen-capture-container {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.capture-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: block;
  touch-action: none;
  user-select: none;
  z-index: 0;
}

.crop-mask {
  position: absolute;
  background: rgba(0, 0, 0, 0.5);
  pointer-events: none;
  z-index: 1;
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
  background: transparent;
  pointer-events: none;
  z-index: 2;
}

.crop-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  pointer-events: none;
}

.crop-corner-nw {
  top: 0;
  left: 0;
  border-top: 4px solid white;
  border-left: 4px solid white;
}

.crop-corner-ne {
  top: 0;
  right: 0;
  border-top: 4px solid white;
  border-right: 4px solid white;
}

.crop-corner-sw {
  bottom: 0;
  left: 0;
  border-bottom: 4px solid white;
  border-left: 4px solid white;
}

.crop-corner-se {
  bottom: 0;
  right: 0;
  border-bottom: 4px solid white;
  border-right: 4px solid white;
}

.capture-actions {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: flex;
  gap: 10px;
  z-index: 20001;
  pointer-events: auto;
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
  z-index: 20001;
  pointer-events: auto;
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
