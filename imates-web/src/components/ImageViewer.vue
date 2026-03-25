<template>
  <!-- 使用 Teleport 将预览层挂到 body，避免受父级对话框影响 -->
  <Teleport to="body">
    <div v-if="modelValue" class="image-viewer-root">
      <div class="preview-overlay" @click="handleClose">
        <!-- 关闭按钮 -->
        <button
          type="button"
          class="close-btn"
          @click.stop="handleClose"
        >
          ✕
        </button>

        <button
          type="button"
          class="save-btn"
          @click.stop="handleSave"
          title="保存到本地"
        >
          <img :src="downloadIcon" alt="下载" class="save-icon" />
        </button>

        <!-- 上一张按钮 -->
        <button
          v-if="showPrev"
          type="button"
          class="nav-btn prev-btn"
          @click.stop="handlePrev"
          title="上一张"
        >
          ‹
        </button>

        <!-- 下一张按钮 -->
        <button
          v-if="showNext"
          type="button"
          class="nav-btn next-btn"
          @click.stop="handleNext"
          title="下一张"
        >
          ›
        </button>

        <!-- 图片计数器 -->
        <div v-if="totalImages > 1" class="image-counter">
          {{ currentIndex + 1 }} / {{ totalImages }}
        </div>

        <!-- 图片预览区域 -->
        <div
          ref="previewContentRef"
          class="preview-content"
          @click.stop
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
          @pointerleave="handlePointerUp"
        >
          <img
            v-if="currentImageUrl"
            :src="currentImageUrl"
            :alt="currentAlt || '图片预览'"
            class="preview-image"
            :style="imageStyle"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import downloadIcon from '/icons/download.svg'
import { androidBridge } from '@/services/business/android-bridge'
import { showMessage } from '@/utils'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface ImageItem {
  url: string
  alt?: string
}

interface Props {
  modelValue: boolean
  imageUrl?: string
  alt?: string
  images?: ImageItem[]
  initialIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  alt: '图片预览',
  images: () => [],
  initialIndex: 0,
  imageUrl: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'change': [index: number]
}>()

const currentIndex = ref(props.initialIndex)

const previewContentRef = ref<HTMLElement | null>(null)

const translateX = ref(0)
const translateY = ref(0)
const scale = ref(1)
const rotationDeg = ref(0)

const enableTransition = ref(false) // 用于控制吸附时的过渡动画

const MIN_SCALE = 0.5
const MAX_SCALE = 5

// 旋转角度阈值：只有角度变化超过此值才进行旋转
const ROTATION_THRESHOLD = 7 // 5度

const resetTransform = () => {
  translateX.value = 0
  translateY.value = 0
  scale.value = 1
  rotationDeg.value = 0

  activePointers.clear()
  gestureStart.value = null
  enableTransition.value = false
}

const snapToNearest90 = (deg: number, startDeg: number) => {
  // 计算相对于开始角度的偏移（不归一化，保持累积性）
  const deltaDeg = deg - startDeg
  const absoluteDelta = Math.abs(deltaDeg)
  
  // 判断是否超过30度
  if (absoluteDelta <= 30) {
    // 30度以内，回到开始时的角度
    return startDeg
  } else {
    // 超过30度，吸附到最近的90度倍数
    // 找到当前角度最接近的90度倍数
    const nearest90 = Math.round(deg / 90) * 90
    return nearest90
  }
}

const imageStyle = computed(() => {
  const transition = enableTransition.value ? 'transform 0.3s ease' : 'none'
  return {
    transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value}) rotate(${rotationDeg.value}deg)`,
    transformOrigin: 'center center',
    transition
  } as Record<string, string>
})

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

const getAngleDeg = (a: Point, b: Point) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

const getMidpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2
})

const syncPointer = (e: PointerEvent) => {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
}

const handlePointerDown = (e: PointerEvent) => {
  if (!props.modelValue) return

  // 避免双指手势触发浏览器默认缩放/滚动
  e.preventDefault()
  e.stopPropagation()

  // 手势开始时禁用过渡，避免拖拽卡顿
  enableTransition.value = false

  syncPointer(e)

  try {
    previewContentRef.value?.setPointerCapture(e.pointerId)
  } catch {
    // ignore
  }

  if (activePointers.size === 1) {
    lastSinglePointer.value = { id: e.pointerId, x: e.clientX, y: e.clientY }
    gestureStart.value = null
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
      startScale: scale.value,
      startRotationDeg: rotationDeg.value,
      startTranslateX: translateX.value,
      startTranslateY: translateY.value
    }
    lastSinglePointer.value = null
  }
}

const handlePointerMove = (e: PointerEvent) => {
  if (!props.modelValue) return
  if (!activePointers.has(e.pointerId)) return

  e.preventDefault()
  e.stopPropagation()

  syncPointer(e)

  if (activePointers.size === 1 && lastSinglePointer.value?.id === e.pointerId) {
    const dx = e.clientX - lastSinglePointer.value.x
    const dy = e.clientY - lastSinglePointer.value.y
    translateX.value += dx
    translateY.value += dy
    lastSinglePointer.value = { id: e.pointerId, x: e.clientX, y: e.clientY }
    return
  }

  if (activePointers.size >= 2 && gestureStart.value) {
    const pts = Array.from(activePointers.values())
    const a = pts[0]
    const b = pts[1]

    const distance = getDistance(a, b)
    const angleDeg = getAngleDeg(a, b)
    const midpoint = getMidpoint(a, b)

    const scaleFactor = gestureStart.value.distance > 0 ? distance / gestureStart.value.distance : 1
    const newScale = clamp(gestureStart.value.startScale * scaleFactor, MIN_SCALE, MAX_SCALE)

    const deltaAngle = angleDeg - gestureStart.value.angleDeg
    
    // 只有角度变化超过阈值时才进行旋转
    let newRotation = rotationDeg.value
    if (Math.abs(deltaAngle) > ROTATION_THRESHOLD) {
      newRotation = gestureStart.value.startRotationDeg + deltaAngle
    }

    // 计算以双指中点为缩放中心的平移补偿
    const containerRect = previewContentRef.value?.getBoundingClientRect()
    if (!containerRect) return
    
    // 容器中心屏幕坐标
    const centerX = containerRect.left + containerRect.width / 2
    const centerY = containerRect.top + containerRect.height / 2
    
    // 缩放比例
    const scaleRatio = newScale / gestureStart.value.startScale
    
    // 开始时的相对位置：双指中点相对于（容器中心 + 初始平移）的偏移
    const startRelativeX = gestureStart.value.midpoint.x - centerX - gestureStart.value.startTranslateX
    const startRelativeY = gestureStart.value.midpoint.y - centerY - gestureStart.value.startTranslateY
    
    // 正确的平移公式：
    // T_new = M - C - startRelative * scaleRatio
    // 这样确保缩放后，双指中点精确保持在当前手指位置
    translateX.value = midpoint.x - centerX - startRelativeX * scaleRatio
    translateY.value = midpoint.y - centerY - startRelativeY * scaleRatio
    
    scale.value = newScale
    rotationDeg.value = newRotation
  }
}

const handlePointerUp = (e: PointerEvent) => {
  if (!activePointers.has(e.pointerId)) return

  e.preventDefault()
  e.stopPropagation()

  activePointers.delete(e.pointerId)

  try {
    previewContentRef.value?.releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }

  if (activePointers.size === 1) {
    // 从双指回到单指：以剩余那根手指作为新的拖拽起点
    const remainingId = Array.from(activePointers.keys())[0]
    const pt = activePointers.get(remainingId)
    if (pt) {
      lastSinglePointer.value = { id: remainingId, x: pt.x, y: pt.y }
    }
    gestureStart.value = null
    return
  }

  if (activePointers.size < 1) {
    // 保存手势开始时的角度，用于吸附判断
    const startRotationDeg = gestureStart.value?.startRotationDeg || 0
    lastSinglePointer.value = null
    gestureStart.value = null

    // 手势结束时，将旋转吸附到最近的 90 度，并启用过渡动画
    const snappedRotation = snapToNearest90(rotationDeg.value, startRotationDeg)
    if (snappedRotation !== rotationDeg.value) {
      enableTransition.value = true
      rotationDeg.value = snappedRotation
      // 过渡结束后禁用过渡，避免影响后续交互
      setTimeout(() => {
        enableTransition.value = false
      }, 300)
    }
  }
}

// 监听 initialIndex 变化
watch(() => props.initialIndex, (newVal) => {
  currentIndex.value = newVal
})

// 计算属性：当前图片 URL
const currentImageUrl = computed(() => {
  if (props.images.length > 0) {
    return props.images[currentIndex.value]?.url || ''
  }
  return props.imageUrl || ''
})

// 计算属性：当前图片 alt
const currentAlt = computed(() => {
  if (props.images.length > 0) {
    return props.images[currentIndex.value]?.alt || props.alt
  }
  return props.alt
})

// 计算属性：当前图片总数
const totalImages = computed(() => {
  return props.images.length > 0 ? props.images.length : 1
})

// 计算属性：是否显示上一张按钮
const showPrev = computed(() => {
  return props.images.length > 1 && currentIndex.value > 0
})

// 计算属性：是否显示下一张按钮
const showNext = computed(() => {
  return props.images.length > 1 && currentIndex.value < props.images.length - 1
})

// 监听 modelValue，打开时重置索引
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    currentIndex.value = props.initialIndex
    resetTransform()
  } else {
    resetTransform()
  }
})

watch(() => currentImageUrl.value, () => {
  resetTransform()
})

// 上一张
const handlePrev = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    emit('change', currentIndex.value)
  }
}

// 下一张
const handleNext = () => {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
    emit('change', currentIndex.value)
  }
}

// 键盘事件处理
const handleKeydown = (e: KeyboardEvent) => {
  if (!props.modelValue) return
  if (e.key === 'ArrowLeft') {
    handlePrev()
  } else if (e.key === 'ArrowRight') {
    handleNext()
  } else if (e.key === 'Escape') {
    handleClose()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const handleClose = () => {
  emit('update:modelValue', false)
  resetTransform()
}

const getExtFromDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
  if (!match) return 'png'
  const mime = match[1]
  const ext = mime.split('/')[1]
  return ext || 'png'
}

const dataUrlToBlob = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) throw new Error('invalid data url')
  const header = dataUrl.slice(0, commaIndex)
  const base64 = dataUrl.slice(commaIndex + 1)
  const mimeMatch = header.match(/^data:([^;]+);base64$/)
  const mime = mimeMatch?.[1] || 'application/octet-stream'
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const blobToDataUrl = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read blob failed'))
    reader.readAsDataURL(blob)
  })
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

const fetchAsBlob = async (url: string) => {
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`fetch failed: ${resp.status}`)
  }
  return await resp.blob()
}

const handleSave = async () => {
  const url = currentImageUrl.value
  if (!url) return

  try {
    // Android WebView：优先走原生保存到相册
    if (androidBridge.isAndroidBridgeAvailable() && androidBridge.saveBase64ImageToGallery) {
      let dataUrl = url
      if (!dataUrl.startsWith('data:image/')) {
        try {
          const blob = await fetchAsBlob(url)
          dataUrl = await blobToDataUrl(blob)
        } catch (fetchErr) {
          // fetch 失败（CORS 等），尝试直接在新窗口打开
          console.warn('[ImageViewer] fetch failed, falling back to window.open:', fetchErr)
          window.open(url, '_blank', 'noopener')
          showMessage('已在新窗口打开，请长按/右键保存', 'info')
          return
        }
      }

      const ext = getExtFromDataUrl(dataUrl)
      const filename = `image_${Date.now()}.${ext}`
      const result = androidBridge.saveBase64ImageToGallery(dataUrl, filename)
      if (result?.success) {
        showMessage('已保存到相册', 'success')
        return
      }
      // 原生失败则继续走 Web 下载兜底
    }

    // Web：下载
    if (url.startsWith('data:image/')) {
      const ext = getExtFromDataUrl(url)
      const filename = `image_${Date.now()}.${ext}`
      downloadBlob(dataUrlToBlob(url), filename)
      showMessage('开始下载', 'success')
      return
    }

    try {
      const blob = await fetchAsBlob(url)
      const type = blob.type || ''
      const ext = type.startsWith('image/') ? type.split('/')[1] : 'png'
      const filename = `image_${Date.now()}.${ext}`
      downloadBlob(blob, filename)
      showMessage('开始下载', 'success')
    } catch (fetchErr) {
      // fetch 失败（CORS 等），兜底：直接打开图片地址
      console.warn('[ImageViewer] fetch failed, falling back to window.open:', fetchErr)
      window.open(url, '_blank', 'noopener')
      showMessage('已在新窗口打开，请长按/右键保存', 'info')
    }
  } catch (e) {
    // 兜底：直接打开图片地址
    console.error('[ImageViewer] 保存失败:', e)
    try {
      window.open(url, '_blank', 'noopener')
      showMessage('已在新窗口打开，请长按/右键保存', 'info')
    } catch (err) {
      showMessage('保存失败', 'error')
    }
  }
}
</script>

<style scoped lang="scss">
.image-viewer-root {
  // 确保图片预览层级高于其他自定义对话框（如 Modal，遮罩层 z-index=9000）
  position: fixed;
  inset: 0;
  z-index: var(--z-image-viewer-overlay);
}

.preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  cursor: pointer;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.1);
}

.save-btn {
  position: absolute;
  top: 20px;
  right: 68px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: scale(1.05);
}

.save-icon {
  width: 20px;
  height: 20px;
  display: block;
}

/* 导航按钮 */
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 24px;
  font-weight: bold;
  padding: 0;
  line-height: 1;
}

.nav-btn:hover {
  background: rgba(0, 0, 0, 0.7);
  transform: translateY(-50%) scale(1.1);
}

.prev-btn {
  left: 20px;
}

.next-btn {
  right: 20px;
}

/* 图片计数器 */
.image-counter {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
}

.preview-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px 20px;
  touch-action: none;
}

.preview-image {
  max-width: 90vw;
  max-height: 90vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  user-select: none;
  pointer-events: none;
  transform-origin: center center;
  will-change: transform;
}
</style>

