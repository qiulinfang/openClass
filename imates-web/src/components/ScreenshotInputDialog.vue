<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="截图提问"
    :initial-width="560"
    :initial-height="500"
    :min-width="400"
    :min-height="350"
    title-align="left"
    header-background-color="#ffffff"
    class="screenshot-input-dialog"
  >
    <div class="screenshot-input-content">
      <!-- 截图预览区域（框选模式） -->
      <div class="screenshot-preview">
        <div v-if="screenshotDataUrl" class="crop-container">
          <canvas
            ref="cropCanvas"
            :class="['crop-canvas', { 'is-dragging': isDragging, 'is-drawing': isCropping, 'is-resizing': isResizing }]"
            :style="{ cursor: props.enableCrop ? currentCursor : 'default' }"
            @mousedown="handleStartCrop"
            @mousemove="handleMouseMoveWrapper"
            @mouseup="handleEndCrop"
            @mouseleave="handleMouseLeaveWrapper"
            @touchstart="handleStartCrop"
            @touchmove="handleUpdateCrop"
            @touchend="handleEndCrop"
          ></canvas>
          <!-- 灰色蒙版层（四个遮罩层覆盖框选区域外的部分） -->
          <template v-if="props.enableCrop && cropRect">
            <!-- 顶部遮罩 -->
            <div class="crop-mask crop-mask-top" :style="cropMaskTopStyle"></div>
            <!-- 底部遮罩 -->
            <div class="crop-mask crop-mask-bottom" :style="cropMaskBottomStyle"></div>
            <!-- 左侧遮罩 -->
            <div class="crop-mask crop-mask-left" :style="cropMaskLeftStyle"></div>
            <!-- 右侧遮罩 -->
            <div class="crop-mask crop-mask-right" :style="cropMaskRightStyle"></div>
          </template>
          <!-- 框选遮罩 -->
          <div v-if="props.enableCrop && cropRect" class="crop-overlay" :style="cropOverlayStyle">
            <!-- 四个角的 L 形标记 -->
            <div class="crop-corner crop-corner-nw"></div>
            <div class="crop-corner crop-corner-ne"></div>
            <div class="crop-corner crop-corner-sw"></div>
            <div class="crop-corner crop-corner-se"></div>
          </div>
        </div>
      </div>
      
      <!-- 输入框区域 -->
      <div class="input-section">
        <q-input
          v-model="questionText"
          type="textarea"
          placeholder="请输入要问的问题"
          rows="3"
          outlined
          dense
          class="question-input"
          @keydown.enter.ctrl="handleConfirm"
          @keydown.enter.meta="handleConfirm"
        />
      </div>
      
      <!-- 按钮区域 -->
      <div class="dialog-footer">
        <q-btn
          flat
          label="取消"
          color="grey-7"
          @click="handleCancel"
          class="cancel-btn"
        />
        <q-btn
          label="确定"
          color="primary"
          @click.stop.prevent="handleConfirm"
          :disable="!questionText.trim()"
          class="confirm-btn"
        />
      </div>
    </div>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import { showMessage } from '@/utils'

interface Props {
  modelValue: boolean
  screenshotDataUrl?: string
  enableCrop?: boolean  // 是否启用框选模式，默认为 true
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', question: string, screenshotDataUrl: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  screenshotDataUrl: '',
  enableCrop: true
})

const emit = defineEmits<Emits>()

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 问题文本
const questionText = ref('')

// 框选相关状态
const cropCanvas = ref<HTMLCanvasElement | null>(null)
const cropRect = ref<{
  x: number
  y: number
  width: number
  height: number
} | null>(null)
const isCropping = ref(false)
const isDragging = ref(false)
const isResizing = ref(false)
const resizeHandle = ref<'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null>(null)
const cropStartPos = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const resizeStartPos = ref({ x: 0, y: 0, rect: { x: 0, y: 0, width: 0, height: 0 } })
const RESIZE_HANDLE_SIZE = 10
// 图片在 canvas 上的绘制信息（用于坐标映射）
const imageDrawInfo = ref<{
  drawX: number
  drawY: number
  drawWidth: number
  drawHeight: number
  originalWidth: number
  originalHeight: number
} | null>(null)
const currentCursor = ref('crosshair')

// 裁剪遮罩样式
const cropOverlayStyle = computed(() => {
  if (!cropRect.value) return {}
  return {
    left: `${cropRect.value.x}px`,
    top: `${cropRect.value.y}px`,
    width: `${cropRect.value.width}px`,
    height: `${cropRect.value.height}px`,
  }
})

// 灰色蒙版样式（四个遮罩层）
const getContainerSize = () => {
  if (!cropCanvas.value) return { width: 0, height: 0 }
  const container = cropCanvas.value.parentElement
  if (!container) return { width: 0, height: 0 }
  const rect = container.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

// 顶部遮罩样式
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

// 底部遮罩样式
const cropMaskBottomStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width, height } = getContainerSize()
  const bottomY = cropRect.value.y + cropRect.value.height
  return {
    top: `${bottomY}px`,
    left: '0',
    width: `${width}px`,
    height: `${height - bottomY}px`,
  }
})

// 左侧遮罩样式
const cropMaskLeftStyle = computed(() => {
  if (!cropRect.value) return {}
  return {
    top: `${cropRect.value.y}px`,
    left: '0',
    width: `${cropRect.value.x}px`,
    height: `${cropRect.value.height}px`,
  }
})

// 右侧遮罩样式
const cropMaskRightStyle = computed(() => {
  if (!cropRect.value) return {}
  const { width } = getContainerSize()
  const rightX = cropRect.value.x + cropRect.value.width
  return {
    top: `${cropRect.value.y}px`,
    left: `${rightX}px`,
    width: `${width - rightX}px`,
    height: `${cropRect.value.height}px`,
  }
})

// 初始化裁剪画布
const initCropCanvas = () => {
  if (!cropCanvas.value || !props.screenshotDataUrl) return

  // 使用 requestAnimationFrame 确保在 DOM 完全渲染后获取尺寸
  requestAnimationFrame(() => {
    if (!cropCanvas.value) return

    const canvas = cropCanvas.value
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 获取设备像素比（DPR），用于高DPI设备支持
    const dpr = window.devicePixelRatio || 1

    // 计算 CSS 像素尺寸（逻辑像素）
    const container = canvas.parentElement
    let cssWidth = 520
    let cssHeight = 300
    
    if (container) {
      const rect = container.getBoundingClientRect()
      // 确保容器有有效尺寸
      if (rect.width > 0 && rect.height > 0) {
        cssWidth = rect.width
        cssHeight = rect.height
      }
    }

    // 设置 Canvas 实际像素尺寸（高DPI支持）
    // 实际像素尺寸 = CSS像素尺寸 × DPR
    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr

    // 设置 Canvas CSS 显示尺寸（逻辑像素）
    // 这样 Canvas 的显示大小和逻辑坐标系统保持一致
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    // 缩放上下文以适应高DPI
    // 之后所有的绘制操作都使用逻辑像素坐标（CSS像素）
    ctx.scale(dpr, dpr)

    const img = new Image()
    img.onload = () => {
      if (!cropCanvas.value) {
        return
      }

      // 计算图片的缩放和位置，使其以 contain 模式填充 canvas
      // 使用逻辑像素尺寸（CSS像素）进行计算
      const canvasAspect = cssWidth / cssHeight
      const imgAspect = img.width / img.height

      let drawWidth = cssWidth
      let drawHeight = cssHeight
      let drawX = 0
      let drawY = 0

      if (imgAspect > canvasAspect) {
        // 图片更宽，以宽度为准，上下留白
        drawWidth = cssWidth
        drawHeight = drawWidth / imgAspect
        drawY = (cssHeight - drawHeight) / 2
      } else {
        // 图片更高，以高度为准，左右留白
        drawHeight = cssHeight
        drawWidth = drawHeight * imgAspect
        drawX = (cssWidth - drawWidth) / 2
      }

      // 保存图片绘制信息（用于坐标映射）
      // 所有坐标都使用逻辑像素（CSS像素）
      imageDrawInfo.value = {
        drawX,
        drawY,
        drawWidth,
        drawHeight,
        originalWidth: img.width,
        originalHeight: img.height,
      }

      // 输出弹出框中图片的大小
      console.log('[截图工具] 弹出框中图片大小:', {
        width: img.width,
        height: img.height
      })

      // 清空画布（使用逻辑像素尺寸）
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, cssWidth, cssHeight)

      // 绘制图片（contain 模式，使用逻辑像素坐标）
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

      // 初始化时不创建裁剪框，等待用户绘制
      cropRect.value = null
    }
    img.onerror = () => {
    }
    img.src = props.screenshotDataUrl
  })
}

// 判断点是否在裁剪框内
const isPointInCropRect = (x: number, y: number): boolean => {
  if (!cropRect.value) return false
  return (
    x >= cropRect.value.x &&
    x <= cropRect.value.x + cropRect.value.width &&
    y >= cropRect.value.y &&
    y <= cropRect.value.y + cropRect.value.height
  )
}

// 检测鼠标位置在哪个调整区域
const getResizeHandle = (x: number, y: number): 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null => {
  if (!cropRect.value) return null
  
  const rect = cropRect.value
  const size = RESIZE_HANDLE_SIZE
  
  // 检测四个角
  const isNearNW = Math.abs(x - rect.x) < size && Math.abs(y - rect.y) < size
  const isNearNE = Math.abs(x - (rect.x + rect.width)) < size && Math.abs(y - rect.y) < size
  const isNearSW = Math.abs(x - rect.x) < size && Math.abs(y - (rect.y + rect.height)) < size
  const isNearSE = Math.abs(x - (rect.x + rect.width)) < size && Math.abs(y - (rect.y + rect.height)) < size
  
  if (isNearNW) return 'nw'
  if (isNearNE) return 'ne'
  if (isNearSW) return 'sw'
  if (isNearSE) return 'se'
  
  // 检测四个边
  const isNearTop = Math.abs(y - rect.y) < size && x >= rect.x && x <= rect.x + rect.width
  const isNearBottom = Math.abs(y - (rect.y + rect.height)) < size && x >= rect.x && x <= rect.x + rect.width
  const isNearLeft = Math.abs(x - rect.x) < size && y >= rect.y && y <= rect.y + rect.height
  const isNearRight = Math.abs(x - (rect.x + rect.width)) < size && y >= rect.y && y <= rect.y + rect.height
  
  if (isNearTop) return 'n'
  if (isNearBottom) return 's'
  if (isNearLeft) return 'w'
  if (isNearRight) return 'e'
  
  return null
}

// 获取调整手柄对应的光标样式
const getCursorForHandle = (handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null): string => {
  if (!handle) return 'default'
  
  const cursorMap: Record<string, string> = {
    'n': 'n-resize',
    's': 's-resize',
    'e': 'e-resize',
    'w': 'w-resize',
    'nw': 'nw-resize',
    'ne': 'ne-resize',
    'sw': 'sw-resize',
    'se': 'se-resize',
  }
  
  return cursorMap[handle] || 'default'
}

// 包装函数：只在启用框选时执行
const handleStartCrop = (e: MouseEvent | TouchEvent) => {
  if (!props.enableCrop) return
  startCrop(e)
}

const handleMouseMoveWrapper = (e: MouseEvent) => {
  if (!props.enableCrop) return
  handleMouseMove(e)
}

const handleEndCrop = () => {
  if (!props.enableCrop) return
  endCrop()
}

const handleMouseLeaveWrapper = () => {
  if (!props.enableCrop) return
  handleMouseLeave()
}

const handleUpdateCrop = (e: MouseEvent | TouchEvent) => {
  if (!props.enableCrop) return
  updateCrop(e)
}

// 开始裁剪（绘制、拖动或调整大小）
const startCrop = (e: MouseEvent | TouchEvent) => {
  if (!cropCanvas.value) return

  e.preventDefault()

  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const clickX = clientX - rect.left
  const clickY = clientY - rect.top

  // 首先检测是否在调整区域
  const handle = cropRect.value ? getResizeHandle(clickX, clickY) : null
  if (handle && cropRect.value) {
    // 调整大小模式
    isResizing.value = true
    resizeHandle.value = handle
    resizeStartPos.value = {
      x: clickX,
      y: clickY,
      rect: {
        x: cropRect.value.x,
        y: cropRect.value.y,
        width: cropRect.value.width,
        height: cropRect.value.height,
      },
    }
  } else if (cropRect.value && isPointInCropRect(clickX, clickY)) {
    // 拖动模式：计算拖动偏移量
    isDragging.value = true
    dragOffset.value = {
      x: clickX - cropRect.value.x,
      y: clickY - cropRect.value.y,
    }
  } else {
    // 绘制模式：开始绘制新的裁剪框
    isCropping.value = true
    cropStartPos.value = {
      x: clickX,
      y: clickY,
    }
    // 清除旧框，开始绘制新框
    cropRect.value = {
      x: clickX,
      y: clickY,
      width: 0,
      height: 0,
    }
  }
}

// 更新裁剪（绘制、拖动或调整大小）
const updateCrop = (e: MouseEvent | TouchEvent) => {
  if (!cropCanvas.value) return

  if (!isDragging.value && !isCropping.value && !isResizing.value) return

  e.preventDefault()

  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const currentX = clientX - rect.left
  const currentY = clientY - rect.top

  if (isResizing.value && cropRect.value && resizeHandle.value) {
    // 调整大小模式
    const start = resizeStartPos.value
    const deltaX = currentX - start.x
    const deltaY = currentY - start.y
    const originalRect = start.rect
    
    const newRect = {
      x: originalRect.x,
      y: originalRect.y,
      width: originalRect.width,
      height: originalRect.height,
    }
    
    switch (resizeHandle.value) {
      case 'nw':
        newRect.x = Math.max(0, originalRect.x + deltaX)
        newRect.y = Math.max(0, originalRect.y + deltaY)
        newRect.width = originalRect.width - deltaX
        newRect.height = originalRect.height - deltaY
        break
      case 'ne':
        newRect.y = Math.max(0, originalRect.y + deltaY)
        newRect.width = originalRect.width + deltaX
        newRect.height = originalRect.height - deltaY
        break
      case 'sw':
        newRect.x = Math.max(0, originalRect.x + deltaX)
        newRect.width = originalRect.width - deltaX
        newRect.height = originalRect.height + deltaY
        break
      case 'se':
        newRect.width = originalRect.width + deltaX
        newRect.height = originalRect.height + deltaY
        break
      case 'n':
        newRect.y = Math.max(0, originalRect.y + deltaY)
        newRect.height = originalRect.height - deltaY
        break
      case 's':
        newRect.height = originalRect.height + deltaY
        break
      case 'w':
        newRect.x = Math.max(0, originalRect.x + deltaX)
        newRect.width = originalRect.width - deltaX
        break
      case 'e':
        newRect.width = originalRect.width + deltaX
        break
    }
    
    // 确保最小尺寸
    if (newRect.width < 20) {
      if (resizeHandle.value === 'w' || resizeHandle.value === 'nw' || resizeHandle.value === 'sw') {
        newRect.x = originalRect.x + originalRect.width - 20
      }
      newRect.width = 20
    }
    if (newRect.height < 20) {
      if (resizeHandle.value === 'n' || resizeHandle.value === 'nw' || resizeHandle.value === 'ne') {
        newRect.y = originalRect.y + originalRect.height - 20
      }
      newRect.height = 20
    }
    
    // 限制在画布范围内
    newRect.x = Math.max(0, Math.min(newRect.x, canvas.width))
    newRect.y = Math.max(0, Math.min(newRect.y, canvas.height))
    newRect.width = Math.min(newRect.width, canvas.width - newRect.x)
    newRect.height = Math.min(newRect.height, canvas.height - newRect.y)
    
    cropRect.value = newRect
  } else if (isDragging.value && cropRect.value) {
    // 拖动模式：移动裁剪框
    const newX = currentX - dragOffset.value.x
    const newY = currentY - dragOffset.value.y

    const maxX = canvas.width - cropRect.value.width
    const maxY = canvas.height - cropRect.value.height

    cropRect.value = {
      ...cropRect.value,
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    }
  } else if (isCropping.value) {
    // 绘制模式：更新裁剪框大小
    const newRect = {
      x: Math.max(0, Math.min(cropStartPos.value.x, currentX)),
      y: Math.max(0, Math.min(cropStartPos.value.y, currentY)),
      width: Math.abs(currentX - cropStartPos.value.x),
      height: Math.abs(currentY - cropStartPos.value.y),
    }

    newRect.width = Math.min(newRect.width, canvas.width - newRect.x)
    newRect.height = Math.min(newRect.height, canvas.height - newRect.y)

    cropRect.value = newRect
  }
}

// 结束裁剪（绘制、拖动或调整大小）
const endCrop = () => {
  isCropping.value = false
  isDragging.value = false
  isResizing.value = false
  resizeHandle.value = null
  
  // 如果绘制出的框太小，清除它（允许重新绘制）
  if (cropRect.value && cropRect.value.width < 10 && cropRect.value.height < 10) {
    cropRect.value = null
  }
}

// 处理鼠标移动（更新光标样式或更新裁剪）
const handleMouseMove = (e: MouseEvent) => {
  if (!cropCanvas.value) return
  
  if (isDragging.value || isCropping.value || isResizing.value) {
    updateCrop(e)
    return
  }
  
  const canvas = cropCanvas.value
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  const handle = cropRect.value ? getResizeHandle(x, y) : null
  if (handle) {
    currentCursor.value = getCursorForHandle(handle)
  } else if (cropRect.value && isPointInCropRect(x, y)) {
    currentCursor.value = 'move'
  } else {
    currentCursor.value = 'crosshair'
  }
}

// 处理鼠标离开
const handleMouseLeave = () => {
  if (!isDragging.value && !isCropping.value && !isResizing.value) {
    endCrop()
  }
  currentCursor.value = 'crosshair'
}

// 获取裁剪后的图片
const getCroppedImage = (): Promise<string | null> => {
  return new Promise((resolve) => {
    // 如果截图数据为空，直接返回 null
    if (!props.screenshotDataUrl) {
      resolve(null)
      return
    }

    // 如果未启用框选模式，直接使用原始图片
    if (!props.enableCrop) {
      resolve(props.screenshotDataUrl)
      return
    }

    // 如果没有框选，直接使用原始图片
    if (!cropCanvas.value || !cropRect.value || !imageDrawInfo.value) {
      resolve(props.screenshotDataUrl)
      return
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(props.screenshotDataUrl)
      return
    }

    // 添加超时机制，防止图片加载卡住
    const timeout = setTimeout(() => {
      resolve(props.screenshotDataUrl)
    }, 5000)

    const img = new Image()
    img.onload = () => {
      clearTimeout(timeout)
      try {
        // 将 canvas 上的裁剪区域坐标映射回原始图片坐标
        const { drawX, drawY, drawWidth, drawHeight, originalWidth, originalHeight } =
          imageDrawInfo.value!

        // 计算缩放比例
        const scaleX = originalWidth / drawWidth
        const scaleY = originalHeight / drawHeight

        // 计算裁剪区域在 canvas 上的实际位置（相对于图片绘制区域）
        // 首先，将裁剪区域限制在图片绘制区域内
        const cropRectInCanvas = cropRect.value!
        const cropStartX = Math.max(drawX, cropRectInCanvas.x)
        const cropStartY = Math.max(drawY, cropRectInCanvas.y)
        const cropEndX = Math.min(drawX + drawWidth, cropRectInCanvas.x + cropRectInCanvas.width)
        const cropEndY = Math.min(drawY + drawHeight, cropRectInCanvas.y + cropRectInCanvas.height)

        // 计算裁剪区域相对于图片绘制区域的坐标和尺寸
        const cropXInImage = cropStartX - drawX
        const cropYInImage = cropStartY - drawY
        const cropWidthInImage = cropEndX - cropStartX
        const cropHeightInImage = cropEndY - cropStartY

        // 确保裁剪区域有效
        if (cropWidthInImage <= 0 || cropHeightInImage <= 0) {
          resolve(props.screenshotDataUrl)
          return
        }

        // 将绘制区域的坐标映射回原始图片坐标
        const sourceX = Math.max(0, cropXInImage * scaleX)
        const sourceY = Math.max(0, cropYInImage * scaleY)
        const sourceWidth = Math.min(originalWidth - sourceX, cropWidthInImage * scaleX)
        const sourceHeight = Math.min(originalHeight - sourceY, cropHeightInImage * scaleY)

        // 确保源区域有效
        if (sourceWidth <= 0 || sourceHeight <= 0) {
          resolve(props.screenshotDataUrl)
          return
        }

        // 设置输出 canvas 尺寸（使用映射后的原始图片尺寸，保持宽高比）
        canvas.width = Math.round(sourceWidth)
        canvas.height = Math.round(sourceHeight)

        // 从原始图片裁剪
        ctx.drawImage(
          img,
          Math.round(sourceX),
          Math.round(sourceY),
          Math.round(sourceWidth),
          Math.round(sourceHeight),
          0,
          0,
          canvas.width,
          canvas.height,
        )

        // 转换为 base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        resolve(dataUrl)
      } catch {
        resolve(props.screenshotDataUrl)
      }
    }
    img.onerror = () => {
      clearTimeout(timeout)
      resolve(props.screenshotDataUrl)
    }
    img.src = props.screenshotDataUrl
  })
}

// 监听对话框打开，重置表单和初始化画布
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    questionText.value = ''
    cropRect.value = null
    isCropping.value = false
    isDragging.value = false
    isResizing.value = false
    currentCursor.value = props.enableCrop ? 'crosshair' : 'default'
    
    // 等待 DOM 更新后初始化画布
    await nextTick()
    if (props.screenshotDataUrl) {
      initCropCanvas()
    }
  }
})

// 监听截图数据变化，重新初始化画布
watch(() => props.screenshotDataUrl, async (newValue) => {
  if (newValue && props.modelValue) {
    await nextTick()
    initCropCanvas()
  }
})

// 确定按钮
const handleConfirm = async () => {
  if (!questionText.value.trim()) {
    showMessage('请输入要问的问题', 'warning')
    return
  }
  
  if (!props.screenshotDataUrl) {
    showMessage('截图数据丢失，请重新截图', 'error')
    return
  }
  
  // 获取裁剪后的图片（如果有框选的话）
  const finalImageDataUrl = await getCroppedImage()
  if (!finalImageDataUrl) {
    showMessage('图片处理失败，请重新截图', 'error')
    return
  }
  
  emit('confirm', questionText.value.trim(), finalImageDataUrl)
  localVisible.value = false
}

// 取消按钮
const handleCancel = () => {
  emit('cancel')
  localVisible.value = false
}
</script>

<style lang="scss" scoped>
.screenshot-input-dialog {
  .screenshot-input-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 20px;
    gap: 16px;
  }
  
  .screenshot-preview {
    flex: 1;
    min-height: 200px;
    max-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e0e0e0;
    position: relative;
    
    .crop-container {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .crop-canvas {
      width: 100%;
      height: 100%;
      object-fit: contain;
      touch-action: none;
      user-select: none;
      
      &.is-dragging {
        cursor: move;
      }
      
      &.is-drawing {
        cursor: crosshair;
      }
      
      &.is-resizing {
        cursor: nw-resize;
      }
    }
    
    // 灰色蒙版样式
    .crop-mask {
      position: absolute;
      background: rgba(0, 0, 0, 0.5); /* 灰色半透明蒙版 */
      pointer-events: none;
      z-index: 1;
    }
    
    .crop-overlay {
      position: absolute;
      background: transparent; /* 框选区域透明，显示清晰的图片 */
      pointer-events: none;
      z-index: 2; /* 确保框选区域在蒙版之上 */
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
    
    .preview-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }
  
  .input-section {
    flex-shrink: 0;
    
    .question-input {
      :deep(.q-field__control) {
        min-height: 80px;
      }
    }
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    flex-shrink: 0;
    padding-top: 8px;
    
    .cancel-btn,
    .confirm-btn {
      min-width: 80px;
    }
  }
}
</style>

