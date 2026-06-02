<template>
  <!-- 在小程序中，不使用 Teleport，直接使用 fixed 定位的 view -->
  <view v-if="modelValue" class="image-viewer-root">
    <view class="preview-overlay" @click="handleClose">
      <!-- 关闭按钮 -->
      <button
        class="close-btn"
        @click.stop="handleClose"
      >
        <text>✕</text>
      </button>

      <button
        class="save-btn"
        @click.stop="handleSave"
      >
        <image :src="downloadIcon" mode="aspectFit" class="save-icon" />
      </button>

      <!-- 上一张按钮 -->
      <button
        v-if="showPrev"
        class="nav-btn prev-btn"
        @click.stop="handlePrev"
      >
        <text>‹</text>
      </button>

      <!-- 下一张按钮 -->
      <button
        v-if="showNext"
        class="nav-btn next-btn"
        @click.stop="handleNext"
      >
        <text>›</text>
      </button>

      <!-- 图片计数器 -->
      <view v-if="totalImages > 1" class="image-counter">
        <text>{{ currentIndex + 1 }} / {{ totalImages }}</text>
      </view>

      <!-- 图片预览区域 -->
      <view
        class="preview-content"
        @click.stop
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
      >
        <image
          v-if="currentImageUrl"
          :src="currentImageUrl"
          mode="aspectFit"
          class="preview-image"
          :style="imageStyle"
        />
      </view>
    </view>
  </view>
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

  activeTouches.clear()
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

const activeTouches = new Map<number, Point>()
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

const handleTouchStart = (e: TouchEvent) => {
  if (!props.modelValue) return
  enableTransition.value = false

  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i]
    activeTouches.set(touch.identifier, { x: touch.clientX, y: touch.clientY })
  }

  if (activeTouches.size === 1) {
    const touch = e.touches[0]
    lastSinglePointer.value = { id: touch.identifier, x: touch.clientX, y: touch.clientY }
    gestureStart.value = null
  } else if (activeTouches.size === 2) {
    const pts = Array.from(activeTouches.values())
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

const handleTouchMove = (e: TouchEvent) => {
  if (!props.modelValue) return

  for (let i = 0; i < e.touches.length; i++) {
    const touch = e.touches[i]
    activeTouches.set(touch.identifier, { x: touch.clientX, y: touch.clientY })
  }

  if (activeTouches.size === 1 && lastSinglePointer.value) {
    const touch = e.touches[0]
    const dx = touch.clientX - lastSinglePointer.value.x
    const dy = touch.clientY - lastSinglePointer.value.y
    translateX.value += dx
    translateY.value += dy
    lastSinglePointer.value = { id: touch.identifier, x: touch.clientX, y: touch.clientY }
  } else if (activeTouches.size >= 2 && gestureStart.value) {
    const pts = Array.from(activeTouches.values())
    const a = pts[0]
    const b = pts[1]

    const distance = getDistance(a, b)
    const angleDeg = getAngleDeg(a, b)
    const midpoint = getMidpoint(a, b)

    const scaleFactor = gestureStart.value.distance > 0 ? distance / gestureStart.value.distance : 1
    const newScale = clamp(gestureStart.value.startScale * scaleFactor, MIN_SCALE, MAX_SCALE)

    const deltaAngle = angleDeg - gestureStart.value.angleDeg
    
    let newRotation = rotationDeg.value
    if (Math.abs(deltaAngle) > ROTATION_THRESHOLD) {
      newRotation = gestureStart.value.startRotationDeg + deltaAngle
    }

    // 小程序中通过系统信息获取屏幕尺寸替代 getBoundingClientRect
    const sysInfo = uni.getSystemInfoSync()
    const centerX = sysInfo.windowWidth / 2
    const centerY = sysInfo.windowHeight / 2
    
    const scaleRatio = newScale / gestureStart.value.startScale
    const startRelativeX = gestureStart.value.midpoint.x - centerX - gestureStart.value.startTranslateX
    const startRelativeY = gestureStart.value.midpoint.y - centerY - gestureStart.value.startTranslateY
    
    translateX.value = midpoint.x - centerX - startRelativeX * scaleRatio
    translateY.value = midpoint.y - centerY - startRelativeY * scaleRatio
    
    scale.value = newScale
    rotationDeg.value = newRotation
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    activeTouches.delete(e.changedTouches[i].identifier)
  }

  if (activeTouches.size === 1) {
    const remainingId = Array.from(activeTouches.keys())[0]
    const pt = activeTouches.get(remainingId)
    if (pt) {
      lastSinglePointer.value = { id: remainingId, x: pt.x, y: pt.y }
    }
    gestureStart.value = null
  } else if (activeTouches.size < 1) {
    const startRotationDeg = gestureStart.value?.startRotationDeg || 0
    lastSinglePointer.value = null
    gestureStart.value = null

    const snappedRotation = snapToNearest90(rotationDeg.value, startRotationDeg)
    if (snappedRotation !== rotationDeg.value) {
      enableTransition.value = true
      rotationDeg.value = snappedRotation
      setTimeout(() => {
        enableTransition.value = false
      }, 300)
    }
  }
}

const handleSave = async () => {
  const url = currentImageUrl.value
  if (!url) return

  // 小程序中保存图片到相册
  uni.saveImageToPhotosAlbum({
    filePath: url, // 如果是网络地址可能需要先 uni.downloadFile
    success: () => {
      showMessage('已保存到相册', 'success')
    },
    fail: (err) => {
      console.error('保存失败', err)
      showMessage('保存失败', 'error')
    }
  })
}

// 移除不适用的事件监听
onMounted(() => {
})

onUnmounted(() => {
})
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

