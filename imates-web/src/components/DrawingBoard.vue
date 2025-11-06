<template>
  <div class="canvas-demo-container">
    <!-- 统一工具栏（浮动在顶部） -->
    <div class="toolbar-wrapper">
      <UnifiedToolbar
        :tools="[
          'hand',
          'select',
          'draw',
          'eraser-draw',
          'text',
          'rectangle',
          'circle',
          'line',
          'triangle',
          'undo',
          'redo',
          'clear',
        ]"
        :selected-tool="currentTool"
        :tool-config="toolConfig"
        :tool-states="{ undo: canUndo, redo: canRedo }"
        @tool-change="handleToolChange"
        @config-change="handleConfigChange"
        @undo="undo"
        @redo="redo"
        @clear="clearCanvas"
      />
    </div>

    <!-- 画布容器（占满整个对话框） -->
    <div
      class="canvas-wrapper"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <canvas ref="canvasRef" class="canvas-container" :style="canvasStyle"></canvas>
      <!-- Signature Pad 画布（覆盖在主画布上，仅在signature模式下显示） -->
      <canvas 
        ref="signaturePadRef" 
        class="signature-pad-canvas" 
        :style="{ 
          ...canvasStyle, 
          display: toolConfig.handwritingStyle === 'signature' && currentTool === 'draw' ? 'block' : 'none',
          pointerEvents: toolConfig.handwritingStyle === 'signature' && currentTool === 'draw' ? 'auto' : 'none'
        }"
      ></canvas>

      <!-- 浮动缩放控制面板 -->
      <div
        class="zoom-control-panel"
        @mousedown.stop
        @mouseup.stop
        @touchstart.stop
        @touchmove.stop
        @touchend.stop
      >
        <q-btn
          flat
          round
          dense
          icon="zoom_out"
          :disable="zoomLevel <= 0.1"
          @click="zoomOut"
          class="zoom-btn"
        >
          <q-tooltip>缩小</q-tooltip>
        </q-btn>

        <div class="zoom-display">{{ Math.round(zoomLevel * 100) }}%</div>

        <q-btn
          flat
          round
          dense
          icon="zoom_in"
          :disable="zoomLevel >= 3"
          @click="zoomIn"
          class="zoom-btn"
        >
          <q-tooltip>放大</q-tooltip>
        </q-btn>

        
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import UnifiedToolbar from './UnifiedToolbar.vue'
import SignaturePad from 'signature_pad'

// 新增：定义对外事件
const emit = defineEmits<{
  // 内容变化事件（用于父组件更新缩略图）
  'content-change': []
}>()

// 绘图对象类型定义
interface DrawObject {
  type: 'path' | 'rectangle' | 'circle' | 'line' | 'triangle' | 'text'
  color: string
  lineWidth: number
  points?: { x: number; y: number }[]
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  text?: string
  fontSize?: number
  opacity?: number
  handwritingStyle?: 'signature' | 'normal' // 画笔样式：Signature Pad风格或普通风格
  rawPoints?: { x: number; y: number }[] // 原始点（可选，用于平滑处理）
}

// 对象位置信息类型
interface ObjectPosition {
  points?: { x: number; y: number }[]
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

// Canvas 引用
const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null

// 画布尺寸
const canvasWidth = ref(2100)
const canvasHeight = ref(2400)

// 当前工具
const currentTool = ref('select')

// 工具配置
const toolConfig = ref<{ color?: string; size?: number; handwritingStyle?: 'signature' | 'normal' }>({
  color: '#000000',
  size: 3,
  handwritingStyle: 'normal',
})

// Signature Pad 实例
const signaturePadRef = ref<HTMLCanvasElement>()
let signaturePad: SignaturePad | null = null

// 绘制Signature Pad风格的路径（使用平滑贝塞尔曲线）
const drawSignaturePath = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  lineWidth: number,
  color: string
) => {
  if (points.length < 2) return
  
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  if (points.length === 2) {
    // 只有两个点，直接连线
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[1].x, points[1].y)
    ctx.stroke()
  } else {
    // 使用二次贝塞尔曲线平滑
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]
      
      // 计算控制点（使用中点）
      const cpX = curr.x + (next.x - prev.x) * 0.3
      const cpY = curr.y + (next.y - prev.y) * 0.3
      
      ctx.quadraticCurveTo(cpX, cpY, curr.x, curr.y)
    }
    
    // 连接到最后一个点
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
    ctx.stroke()
  }
  
  ctx.restore()
}

// ==================== 绘制对象管理 ====================
// 绘制对象列表
const objects = ref<DrawObject[]>([])

// 历史记录
const history = ref<DrawObject[][]>([[]])
const historyIndex = ref(0)

// 计算是否可以撤销/重做
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// 当前绘制状态
const isDrawing = ref(false)
const currentPath = ref<{ x: number; y: number }[]>([])
const startPoint = ref<{ x: number; y: number } | null>(null)
const tempObject = ref<DrawObject | null>(null)

// 橡皮擦悬停对象
const hoveredObject = ref<number | null>(null)

// 对象选择相关
const selectedObjects = ref<Set<number>>(new Set())
const selectionBox = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const isDraggingObjects = ref(false)
const dragStartPoint = ref<{ x: number; y: number } | null>(null)
const objectsOriginalPositions = ref<Map<number, ObjectPosition>>(new Map())

// 缩放状态
const zoomLevel = ref(1)

// 画布偏移（手型工具拖动）
const canvasOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStartPoint = ref<{ x: number; y: number } | null>(null)
const panStartOffset = ref({ x: 0, y: 0 })

// 双指触摸状态
const initialTouchDistance = ref(0)
const initialTouchScale = ref(1)
const initialTouchCenterX = ref(0)
const initialTouchCenterY = ref(0)
const initialTouchTranslateX = ref(0)
const initialTouchTranslateY = ref(0)
const isTwoFingerGesture = ref(false)
const pendingSingleTouch = ref(false)
const pendingTouchX = ref(0)
const pendingTouchY = ref(0)
const gestureStartDistance = ref(0)
const gestureStartCenterX = ref(0)
const gestureStartCenterY = ref(0)
let singleTouchTimer: number | null = null

// 画布样式（居中 + translate + scale）
const canvasStyle = computed(() => {
  return {
    width: `${canvasWidth.value}px`,
    height: `${canvasHeight.value}px`,
    // 先居中，再偏移，最后缩放（从右往左执行）
    transform: `translate(-50%, -50%) translate(${canvasOffset.value.x}px, ${canvasOffset.value.y}px) scale(${zoomLevel.value})`,
  }
})

// 初始化画布
const initCanvas = async () => {
  // 等待DOM更新
  await nextTick()

  // 获取canvas元素和上下文
  if (!canvasRef.value) return

  ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  // 设置画布尺寸
  canvasRef.value.width = canvasWidth.value
  canvasRef.value.height = canvasHeight.value

  // 初始化 Signature Pad（用于交互式绘制）
  if (signaturePadRef.value) {
    signaturePadRef.value.width = canvasWidth.value
    signaturePadRef.value.height = canvasHeight.value
    signaturePad = new SignaturePad(signaturePadRef.value, {
      backgroundColor: 'rgba(255, 255, 255, 0)',
      penColor: toolConfig.value.color || '#000000',
      throttle: 0, // 不限制绘制频率
      minWidth: (toolConfig.value.size || 3) * 0.5,
      maxWidth: (toolConfig.value.size || 3) * 1.5,
    })
    
    // 注意：Signature Pad会自动处理绘制，我们只需要在鼠标抬起时保存数据
  }

  // 保存初始状态
  saveState()

  // 渲染画布
  render()
}

// 渲染画布
const render = () => {
  if (!ctx || !canvasRef.value) return

  // 清空画布
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  // 绘制所有对象
  objects.value.forEach((obj, index) => {
    if (!ctx) return

    // 保存上下文状态
    ctx.save()

    // 设置透明度（橡皮擦悬停效果）
    if (index === hoveredObject.value && currentTool.value === 'eraser-draw') {
      ctx.globalAlpha = 0.5
    } else if (obj.opacity !== undefined) {
      ctx.globalAlpha = obj.opacity
    }

    // 根据类型绘制对象
    drawObject(obj)

    // 恢复上下文状态
    ctx.restore()

    // 如果对象被选中，绘制高亮边框
    if (selectedObjects.value.has(index)) {
      drawObjectHighlight(obj)
    }
  })

  // 绘制临时对象（正在绘制中）
  if (tempObject.value) {
    ctx.save()
    drawObject(tempObject.value)
    ctx.restore()
  }

  // 绘制选框
  if (selectionBox.value) {
    drawSelectionBox(selectionBox.value)
  }
}

// 绘制单个对象
const drawObject = (obj: DrawObject) => {
  if (!ctx) return

  ctx.strokeStyle = obj.color
  ctx.fillStyle = obj.color
  ctx.lineWidth = obj.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (obj.type) {
    case 'path':
      // 绘制路径
      if (obj.points && obj.points.length > 1) {
        if (obj.handwritingStyle === 'signature') {
          // Signature Pad 风格：使用平滑的贝塞尔曲线绘制（模拟Signature Pad效果）
          drawSignaturePath(ctx, obj.points, obj.lineWidth, obj.color)
        } else {
          // 普通风格：使用直线连接
          ctx.beginPath()
          ctx.moveTo(obj.points[0].x, obj.points[0].y)
          for (let i = 1; i < obj.points.length; i++) {
            ctx.lineTo(obj.points[i].x, obj.points[i].y)
          }
          ctx.stroke()
        }
      }
      break

    case 'rectangle':
      // 绘制矩形
      if (
        obj.x !== undefined &&
        obj.y !== undefined &&
        obj.width !== undefined &&
        obj.height !== undefined
      ) {
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height)
      }
      break

    case 'circle':
      // 绘制圆形
      if (obj.x !== undefined && obj.y !== undefined && obj.radius !== undefined) {
        ctx.beginPath()
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
      break

    case 'line':
      // 绘制直线
      if (
        obj.x1 !== undefined &&
        obj.y1 !== undefined &&
        obj.x2 !== undefined &&
        obj.y2 !== undefined
      ) {
        ctx.beginPath()
        ctx.moveTo(obj.x1, obj.y1)
        ctx.lineTo(obj.x2, obj.y2)
        ctx.stroke()
      }
      break

    case 'triangle':
      // 绘制三角形
      if (
        obj.x !== undefined &&
        obj.y !== undefined &&
        obj.width !== undefined &&
        obj.height !== undefined
      ) {
        ctx.beginPath()
        ctx.moveTo(obj.x + obj.width / 2, obj.y)
        ctx.lineTo(obj.x, obj.y + obj.height)
        ctx.lineTo(obj.x + obj.width, obj.y + obj.height)
        ctx.closePath()
        ctx.stroke()
      }
      break

    case 'text':
      // 绘制文本
      if (obj.text && obj.x !== undefined && obj.y !== undefined) {
        ctx.font = `${obj.fontSize || 16}px Arial`
        ctx.fillText(obj.text, obj.x, obj.y)
      }
      break
  }
}

// 绘制选框（虚线矩形）
const drawSelectionBox = (box: { x: number; y: number; width: number; height: number }) => {
  if (!ctx) return

  ctx.save()
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = '#0080FF'
  ctx.lineWidth = 2
  ctx.strokeRect(box.x, box.y, box.width, box.height)
  ctx.restore()
}

// 绘制对象高亮边框
const drawObjectHighlight = (obj: DrawObject) => {
  if (!ctx) return

  const bounds = getObjectBounds(obj)
  if (!bounds) return

  ctx.save()
  ctx.strokeStyle = '#0080FF'
  ctx.lineWidth = 3
  ctx.setLineDash([5, 5])

  // 绘制高亮矩形（稍微放大）
  const padding = 5
  ctx.strokeRect(
    bounds.x - padding,
    bounds.y - padding,
    bounds.width + padding * 2,
    bounds.height + padding * 2,
  )

  ctx.restore()
}

// 获取对象边界
const getObjectBounds = (
  obj: DrawObject,
): { x: number; y: number; width: number; height: number } | null => {
  switch (obj.type) {
    case 'path':
      if (!obj.points || obj.points.length === 0) return null
      const xs = obj.points.map((p) => p.x)
      const ys = obj.points.map((p) => p.y)
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      }

    case 'rectangle':
      if (
        obj.x === undefined ||
        obj.y === undefined ||
        obj.width === undefined ||
        obj.height === undefined
      )
        return null
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }

    case 'circle':
      if (obj.x === undefined || obj.y === undefined || obj.radius === undefined) return null
      return {
        x: obj.x - obj.radius,
        y: obj.y - obj.radius,
        width: obj.radius * 2,
        height: obj.radius * 2,
      }

    case 'line':
      if (
        obj.x1 === undefined ||
        obj.y1 === undefined ||
        obj.x2 === undefined ||
        obj.y2 === undefined
      )
        return null
      return {
        x: Math.min(obj.x1, obj.x2),
        y: Math.min(obj.y1, obj.y2),
        width: Math.abs(obj.x2 - obj.x1),
        height: Math.abs(obj.y2 - obj.y1),
      }

    case 'triangle':
      if (
        obj.x === undefined ||
        obj.y === undefined ||
        obj.width === undefined ||
        obj.height === undefined
      )
        return null
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }

    case 'text':
      if (obj.x === undefined || obj.y === undefined || !obj.text) return null
      const fontSize = obj.fontSize || 16
      const textWidth = obj.text.length * fontSize * 0.6 // 估算宽度
      return { x: obj.x, y: obj.y - fontSize, width: textWidth, height: fontSize }
  }

  return null
}

// （已去除自动扩容逻辑）

// 检查点是否在对象内
const isPointInObject = (x: number, y: number, obj: DrawObject): boolean => {
  const bounds = getObjectBounds(obj)
  if (!bounds) return false

  // 扩大边界以便于选择
  const padding = 10
  return (
    x >= bounds.x - padding &&
    x <= bounds.x + bounds.width + padding &&
    y >= bounds.y - padding &&
    y <= bounds.y + bounds.height + padding
  )
}

// 查找鼠标位置的对象
const findObjectAtPoint = (x: number, y: number): number | null => {
  // 从后往前查找（最上层优先）
  for (let i = objects.value.length - 1; i >= 0; i--) {
    if (isPointInObject(x, y, objects.value[i])) {
      return i
    }
  }
  return null
}

// 检查矩形是否与对象相交
const isRectIntersectObject = (
  rect: { x: number; y: number; width: number; height: number },
  obj: DrawObject,
): boolean => {
  const bounds = getObjectBounds(obj)
  if (!bounds) return false

  // 两个矩形相交的判定
  return !(
    rect.x > bounds.x + bounds.width ||
    rect.x + rect.width < bounds.x ||
    rect.y > bounds.y + bounds.height ||
    rect.y + rect.height < bounds.y
  )
}

// 查找与矩形相交的所有对象
const findObjectsInRect = (rect: {
  x: number
  y: number
  width: number
  height: number
}): number[] => {
  const result: number[] = []
  objects.value.forEach((obj, index) => {
    if (isRectIntersectObject(rect, obj)) {
      result.push(index)
    }
  })
  return result
}

// 获取鼠标在canvas上的坐标
const getCanvasCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
  if (!canvasRef.value) return null

  const rect = canvasRef.value.getBoundingClientRect()
  let clientX, clientY

  if (e instanceof MouseEvent) {
    clientX = e.clientX
    clientY = e.clientY
  } else if (e instanceof TouchEvent && e.touches.length > 0) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else {
    return null
  }

  return {
    x: (clientX - rect.left) / zoomLevel.value,
    y: (clientY - rect.top) / zoomLevel.value,
  }
}

// 鼠标按下
const handleMouseDown = (e: MouseEvent) => {
  const coords = getCanvasCoords(e)
  if (!coords) return

  startPoint.value = coords
  isDrawing.value = true

  switch (currentTool.value) {
    case 'hand':
      // 手型工具：开始拖动画布
      isPanning.value = true
      panStartPoint.value = { x: e.clientX, y: e.clientY }
      panStartOffset.value = { ...canvasOffset.value }
      if (canvasRef.value) {
        canvasRef.value.style.cursor = 'grabbing'
      }
      break

    case 'select':
      // 检查是否点击在已选中的图形上
      let clickedOnSelected = false
      for (const index of selectedObjects.value) {
        if (isPointInObject(coords.x, coords.y, objects.value[index])) {
          clickedOnSelected = true
          break
        }
      }

      if (clickedOnSelected && selectedObjects.value.size > 0) {
        // 点击在已选中的图形上，开始拖拽
        isDraggingObjects.value = true
        dragStartPoint.value = { ...coords }

        // 保存所有选中对象的原始位置
        objectsOriginalPositions.value.clear()
        selectedObjects.value.forEach((index) => {
          const obj = objects.value[index]
          objectsOriginalPositions.value.set(index, cloneObjectPosition(obj))
        })

        if (canvasRef.value) {
          canvasRef.value.style.cursor = 'grabbing'
        }
      } else {
        // 点击在空白处或未选中的图形上，开始框选
        selectedObjects.value.clear()
        selectionBox.value = {
          x: coords.x,
          y: coords.y,
          width: 0,
          height: 0,
        }
      }
      break

    case 'draw':
      // 开始绘制路径
      if (toolConfig.value.handwritingStyle === 'signature' && signaturePad) {
        // Signature Pad 模式：让 Signature Pad 处理绘制
        // Signature Pad 会自动处理鼠标事件
        currentPath.value = []
      } else {
        // 普通模式：开始记录路径点
        currentPath.value = [coords]
      }
      break

    case 'eraser-draw':
      // 橡皮擦：整笔擦除
      handleEraser(coords)
      break

    case 'text':
      // 添加文本
      addText(coords)
      break
  }
}

// 鼠标移动
const handleMouseMove = (e: MouseEvent) => {
  // 手型工具拖动
  if (isPanning.value && panStartPoint.value) {
    const dx = e.clientX - panStartPoint.value.x
    const dy = e.clientY - panStartPoint.value.y
    canvasOffset.value = {
      x: panStartOffset.value.x + dx,
      y: panStartOffset.value.y + dy,
    }
    return
  }

  const coords = getCanvasCoords(e)
  if (!coords) return

  // 橡皮擦悬停效果
  if (currentTool.value === 'eraser-draw') {
    const objIndex = findObjectAtPoint(coords.x, coords.y)
    if (hoveredObject.value !== objIndex) {
      hoveredObject.value = objIndex
      render()
    }
  }

  if (!isDrawing.value || !startPoint.value) {
    return
  }

  switch (currentTool.value) {
    case 'select':
      if (isDraggingObjects.value && dragStartPoint.value) {
        // 拖拽选中的对象
        const dx = coords.x - dragStartPoint.value.x
        const dy = coords.y - dragStartPoint.value.y

        // 移动所有选中对象
        selectedObjects.value.forEach((index) => {
          const obj = objects.value[index]
          const original = objectsOriginalPositions.value.get(index)
          if (original) {
            moveObject(obj, original, dx, dy)
          }
        })

        render()
      } else if (selectionBox.value) {
        // 绘制选框
        selectionBox.value = {
          x: Math.min(startPoint.value.x, coords.x),
          y: Math.min(startPoint.value.y, coords.y),
          width: Math.abs(coords.x - startPoint.value.x),
          height: Math.abs(coords.y - startPoint.value.y),
        }
        render()
      }
      break

    case 'draw':
      // 如果是 Signature Pad 风格，Signature Pad会自动处理绘制
      // 普通风格继续使用原有逻辑
      if (toolConfig.value.handwritingStyle !== 'signature') {
        currentPath.value.push(coords)
        tempObject.value = {
          type: 'path',
          color: toolConfig.value.color || '#000000',
          lineWidth: toolConfig.value.size || 3,
          points: [...currentPath.value],
          handwritingStyle: 'normal',
        }
        render()
      }
      break

    case 'eraser-draw':
      // 橡皮擦拖动擦除
      handleEraser(coords)
      break

    case 'rectangle':
      // 绘制矩形预览
      tempObject.value = {
        type: 'rectangle',
        color: toolConfig.value.color || '#000000',
        lineWidth: toolConfig.value.size || 3,
        x: Math.min(startPoint.value.x, coords.x),
        y: Math.min(startPoint.value.y, coords.y),
        width: Math.abs(coords.x - startPoint.value.x),
        height: Math.abs(coords.y - startPoint.value.y),
      }
      render()
      break

    case 'circle':
      // 绘制圆形预览（参考 Windows 画板：起始点和当前点构成矩形，圆内接在矩形中）
      const width = Math.abs(coords.x - startPoint.value.x)
      const height = Math.abs(coords.y - startPoint.value.y)
      const centerX = (startPoint.value.x + coords.x) / 2
      const centerY = (startPoint.value.y + coords.y) / 2
      const radius = Math.min(width, height) / 2

      tempObject.value = {
        type: 'circle',
        color: toolConfig.value.color || '#000000',
        lineWidth: toolConfig.value.size || 3,
        x: centerX,
        y: centerY,
        radius,
      }
      render()
      break

    case 'line':
      // 绘制直线预览
      tempObject.value = {
        type: 'line',
        color: toolConfig.value.color || '#000000',
        lineWidth: toolConfig.value.size || 3,
        x1: startPoint.value.x,
        y1: startPoint.value.y,
        x2: coords.x,
        y2: coords.y,
      }
      render()
      break

    case 'triangle':
      // 绘制三角形预览
      tempObject.value = {
        type: 'triangle',
        color: toolConfig.value.color || '#000000',
        lineWidth: toolConfig.value.size || 3,
        x: Math.min(startPoint.value.x, coords.x),
        y: Math.min(startPoint.value.y, coords.y),
        width: Math.abs(coords.x - startPoint.value.x),
        height: Math.abs(coords.y - startPoint.value.y),
      }
      render()
      break
  }
}

// 鼠标抬起
const handleMouseUp = () => {
  // 手型工具：结束拖动
  if (isPanning.value) {
    isPanning.value = false
    panStartPoint.value = null
    if (canvasRef.value) {
      canvasRef.value.style.cursor = currentTool.value === 'hand' ? 'grab' : 'crosshair'
    }
    return
  }

  if (currentTool.value === 'select') {
    // 选择工具处理
    if (isDraggingObjects.value) {
      // 拖拽结束，保存状态
      saveState()
      // 第X步：通知父组件内容已变化
      emit('content-change')
    } else if (
      selectionBox.value &&
      selectionBox.value.width > 5 &&
      selectionBox.value.height > 5
    ) {
      // 框选结束，选中与选框相交的所有对象
      const selectedIndices = findObjectsInRect(selectionBox.value)
      selectedObjects.value = new Set(selectedIndices)
      render()
    } else {
      // 点击空白处，清空选择
      selectedObjects.value.clear()
      render()
    }

    // 统一重置选择工具的状态
    isDraggingObjects.value = false
    dragStartPoint.value = null
    objectsOriginalPositions.value.clear()
    selectionBox.value = null

    // 恢复光标
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'crosshair'
    }
  } else if (tempObject.value && isDrawing.value && currentTool.value !== 'draw') {
    // 添加临时对象到列表（非draw工具）
    objects.value.push(tempObject.value)
    tempObject.value = null
    saveState()
    // 第X步：通知父组件内容已变化
    emit('content-change')
  } else if (currentTool.value === 'draw' && isDrawing.value) {
    if (toolConfig.value.handwritingStyle === 'signature' && signaturePad) {
      // Signature Pad模式：获取绘制数据并保存
      const data = signaturePad.toData()
      if (data && data.length > 0) {
        // 获取最后一个stroke的点
        const lastStroke = data[data.length - 1]
        if (lastStroke && lastStroke.points && lastStroke.points.length > 0) {
          // 将Signature Pad的点转换为普通路径点
          const points: { x: number; y: number }[] = []
          lastStroke.points.forEach((pt: any) => {
            points.push({ x: pt.x, y: pt.y })
          })
          
          // 保存到对象列表
          if (points.length > 0) {
            objects.value.push({
              type: 'path',
              color: toolConfig.value.color || '#000000',
              lineWidth: toolConfig.value.size || 3,
              points: points,
              handwritingStyle: 'signature',
            })
            saveState()
            
            // 清空Signature Pad并重新渲染主画布
            signaturePad.clear()
            render()
            emit('content-change')
          }
        }
      }
    } else {
      // draw工具普通模式：添加路径对象
      if (tempObject.value && tempObject.value.points && tempObject.value.points.length > 0) {
        objects.value.push(tempObject.value)
        saveState()
        emit('content-change')
      }
      tempObject.value = null
    }
  }

  // 统一重置绘制状态
  isDrawing.value = false
  currentPath.value = []
  startPoint.value = null
}

// 计算两个触摸点之间的距离
const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
  // 计算横向距离差
  const dx = touch1.clientX - touch2.clientX
  // 计算纵向距离差
  const dy = touch1.clientY - touch2.clientY
  // 使用勾股定理计算直线距离
  return Math.sqrt(dx * dx + dy * dy)
}

// 计算两个触摸点的中心点坐标
const getTouchCenter = (touch1: Touch, touch2: Touch): { x: number; y: number } => {
  return {
    // 计算X轴中心点
    x: (touch1.clientX + touch2.clientX) / 2,
    // 计算Y轴中心点
    y: (touch1.clientY + touch2.clientY) / 2,
  }
}

// 触摸事件处理
const handleTouchStart = (e: TouchEvent) => {
  // 流程：阻止默认行为
  e.preventDefault()

  // 流程：判断是否为双指触摸
  if (e.touches.length === 2) {
    // 流程：标记为双指手势
    isTwoFingerGesture.value = true

    // 流程：清除单指延迟定时器
    if (singleTouchTimer !== null) {
      clearTimeout(singleTouchTimer)
      singleTouchTimer = null
    }

    // 流程：清除待处理的单指触摸状态
    pendingSingleTouch.value = false

    // 流程：如果之前触发了单指绘图，取消绘图状态
    if (isDrawing.value) {
      isDrawing.value = false
      currentPath.value = []
      tempObject.value = null
      isDraggingObjects.value = false
      isPanning.value = false
      render()
    }

    // 流程：记录初始双指距离
    initialTouchDistance.value = getTouchDistance(e.touches[0], e.touches[1])
    gestureStartDistance.value = initialTouchDistance.value

    // 流程：记录当前缩放比例作为初始值
    initialTouchScale.value = zoomLevel.value

    // 流程：记录初始双指中心点坐标（屏幕绝对坐标，避免wrapper变化影响）
    const center = getTouchCenter(e.touches[0], e.touches[1])
    initialTouchCenterX.value = center.x
    initialTouchCenterY.value = center.y
    gestureStartCenterX.value = center.x
    gestureStartCenterY.value = center.y

    // 流程：记录当前画布偏移量作为初始值
    initialTouchTranslateX.value = canvasOffset.value.x
    initialTouchTranslateY.value = canvasOffset.value.y
  } else if (e.touches.length === 1) {
    // 流程：单指触摸，记录触摸点并标记为待处理状态
    const touch = e.touches[0]
    pendingSingleTouch.value = true
    pendingTouchX.value = touch.clientX
    pendingTouchY.value = touch.clientY

    // 流程：设置延迟定时器（80ms）判断是否为双指操作
    singleTouchTimer = window.setTimeout(() => {
      // 流程：延迟后仍是单指且未开始绘图，执行绘图操作
      if (pendingSingleTouch.value && !isTwoFingerGesture.value) {
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: pendingTouchX.value,
          clientY: pendingTouchY.value,
        })
        handleMouseDown(mouseEvent)
        pendingSingleTouch.value = false
      }
      singleTouchTimer = null
    }, 80)
  }
}

const handleTouchMove = (e: TouchEvent) => {
  // 流程：阻止默认行为
  e.preventDefault()

  // 流程：如果单指触摸处于待处理状态，检测移动距离
  if (e.touches.length === 1 && pendingSingleTouch.value) {
    const touch = e.touches[0]
    // 流程：计算移动距离
    const deltaX = touch.clientX - pendingTouchX.value
    const deltaY = touch.clientY - pendingTouchY.value
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // 流程：如果移动距离超过阈值（5px），立即开始绘图
    if (distance > 5) {
      // 流程：清除延迟定时器
      if (singleTouchTimer !== null) {
        clearTimeout(singleTouchTimer)
        singleTouchTimer = null
      }

      // 流程：立即触发mousedown事件
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: pendingTouchX.value,
        clientY: pendingTouchY.value,
      })
      handleMouseDown(mouseDownEvent)

      // 流程：清除待处理状态
      pendingSingleTouch.value = false

      // 流程：触发mousemove事件
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      })
      handleMouseMove(mouseMoveEvent)
      return
    }
  }

  // 流程：判断是否为双指触摸
  if (e.touches.length === 2) {
    // 流程：计算当前双指距离
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1])

    // 流程：计算当前双指中心点坐标（屏幕绝对坐标）
    const currentCenter = getTouchCenter(e.touches[0], e.touches[1])

    // 流程：计算双指距离变化
    const distanceChange = Math.abs(currentDistance - gestureStartDistance.value)

    // 流程：计算缩放变化率（相对于初始距离的百分比）
    const scaleChangeRatio = distanceChange / gestureStartDistance.value

    // 流程：判断是否有明显的缩放意图（超过5%或30px）
    const hasZoomIntent = scaleChangeRatio > 0.05 || distanceChange > 30

    // 流程：计算缩放比例
    const scaleChange = currentDistance / initialTouchDistance.value
    const newScale = initialTouchScale.value * scaleChange
    const clampedScale = Math.min(Math.max(newScale, 0.1), 3)

    // 流程：计算手指中心点的位移
    const centerDeltaX = currentCenter.x - initialTouchCenterX.value
    const centerDeltaY = currentCenter.y - initialTouchCenterY.value

    // 流程：缩放时需要补偿，确保手指下的内容"钉住"
    if (hasZoomIntent) {
      // 关键算法：保持手指位置的canvas坐标不变
      // 1. 计算手指在初始canvas上的逻辑坐标（相对于canvas中心）
      //    由于canvas居中，屏幕中心就是canvas中心
      //    手指的canvas坐标 = (手指屏幕位置 - 屏幕中心 - offset) / scale
      
      // 获取屏幕中心（wrapper中心）
      if (!canvasRef.value) return
      const wrapperEl = canvasRef.value.closest('.canvas-wrapper') as HTMLElement
      if (!wrapperEl) return
      const wrapperRect = wrapperEl.getBoundingClientRect()
      const screenCenterX = wrapperRect.left + wrapperRect.width / 2
      const screenCenterY = wrapperRect.top + wrapperRect.height / 2
      
      // 计算手指相对于屏幕中心的位置（初始）
      const fingerRelativeX = initialTouchCenterX.value - screenCenterX
      const fingerRelativeY = initialTouchCenterY.value - screenCenterY
      
      // 计算手指在canvas上的逻辑坐标
      const canvasPointX = (fingerRelativeX - initialTouchTranslateX.value) / initialTouchScale.value
      const canvasPointY = (fingerRelativeY - initialTouchTranslateY.value) / initialTouchScale.value
      
      // 2. 应用新的缩放
      zoomLevel.value = clampedScale
      
      // 3. 计算新的offset，使该逻辑坐标点保持在当前手指位置
      //    手指屏幕位置 = 屏幕中心 + canvas坐标 × 新scale + 新offset
      //    所以：新offset = 手指屏幕位置 - 屏幕中心 - canvas坐标 × 新scale
      const currentFingerRelativeX = currentCenter.x - screenCenterX
      const currentFingerRelativeY = currentCenter.y - screenCenterY
      
      canvasOffset.value = {
        x: currentFingerRelativeX - canvasPointX * clampedScale,
        y: currentFingerRelativeY - canvasPointY * clampedScale,
      }
    } else {
      // 流程：没有缩放意图，只平移
      canvasOffset.value = {
        x: initialTouchTranslateX.value + centerDeltaX,
        y: initialTouchTranslateY.value + centerDeltaY,
      }
    }
  } else if (e.touches.length === 1 && !isTwoFingerGesture.value) {
    // 流程：单指触摸且不是双指手势，转换为鼠标事件执行绘图操作
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    })
    handleMouseMove(mouseEvent)
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  // 流程：阻止默认行为
  e.preventDefault()

  // 流程：如果剩余手指数小于2，重置双指触摸初始距离
  if (e.touches.length < 2) {
    initialTouchDistance.value = 0
  }

  // 流程：如果所有手指都离开屏幕
  if (e.touches.length === 0) {
    // 流程：清除单指延迟定时器
    if (singleTouchTimer !== null) {
      clearTimeout(singleTouchTimer)
      singleTouchTimer = null
    }

    // 流程：清除待处理的单指触摸状态
    pendingSingleTouch.value = false

    // 流程：重置双指手势标记
    isTwoFingerGesture.value = false

    // 流程：执行鼠标抬起事件
    handleMouseUp()
  }
}

// 克隆对象位置信息
const cloneObjectPosition = (obj: DrawObject): ObjectPosition => {
  switch (obj.type) {
    case 'path':
      return { points: obj.points ? [...obj.points.map((p) => ({ ...p }))] : [] }
    case 'rectangle':
    case 'triangle':
      return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
    case 'circle':
      return { x: obj.x, y: obj.y, radius: obj.radius }
    case 'line':
      return { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 }
    case 'text':
      return { x: obj.x, y: obj.y }
    default:
      return {}
  }
}

// 移动对象（根据原始位置和偏移量）
const moveObject = (obj: DrawObject, original: ObjectPosition, dx: number, dy: number) => {
  switch (obj.type) {
    case 'path':
      if (original.points && obj.points) {
        obj.points = original.points.map((p: { x: number; y: number }) => ({
          x: p.x + dx,
          y: p.y + dy,
        }))
      }
      break
    case 'rectangle':
    case 'triangle':
      if (original.x !== undefined && original.y !== undefined) {
        obj.x = original.x + dx
        obj.y = original.y + dy
      }
      break
    case 'circle':
      if (original.x !== undefined && original.y !== undefined) {
        obj.x = original.x + dx
        obj.y = original.y + dy
      }
      break
    case 'line':
      if (
        original.x1 !== undefined &&
        original.y1 !== undefined &&
        original.x2 !== undefined &&
        original.y2 !== undefined
      ) {
        obj.x1 = original.x1 + dx
        obj.y1 = original.y1 + dy
        obj.x2 = original.x2 + dx
        obj.y2 = original.y2 + dy
      }
      break
    case 'text':
      if (original.x !== undefined && original.y !== undefined) {
        obj.x = original.x + dx
        obj.y = original.y + dy
      }
      break
  }
}

// 橡皮擦处理
const handleEraser = (coords: { x: number; y: number }) => {
  const eraserSize = toolConfig.value.size || 15
  const eraserRadius = eraserSize / 2

  // 查找需要删除的对象
  const toDelete: number[] = []

  objects.value.forEach((obj, index) => {
    const bounds = getObjectBounds(obj)
    if (!bounds) return

    // 计算橡皮擦圆心到对象边界框最近点的距离
    const closestX = Math.max(bounds.x, Math.min(coords.x, bounds.x + bounds.width))
    const closestY = Math.max(bounds.y, Math.min(coords.y, bounds.y + bounds.height))

    const distance = Math.sqrt(Math.pow(coords.x - closestX, 2) + Math.pow(coords.y - closestY, 2))

    // 如果距离小于橡皮擦半径，标记删除
    if (distance < eraserRadius) {
      toDelete.push(index)
    }
  })

  // 删除对象
  if (toDelete.length > 0) {
    objects.value = objects.value.filter((_, index) => !toDelete.includes(index))
    saveState()
    render()
    // 第X步：通知父组件内容已变化
    emit('content-change')
  }
}

// 添加文本
const addText = (coords: { x: number; y: number }) => {
  const text = prompt('请输入文本：', '点击编辑文本')
  if (!text) return

  const textObj: DrawObject = {
    type: 'text',
    color: toolConfig.value.color || '#000000',
    lineWidth: 1,
    text,
    x: coords.x,
    y: coords.y,
    fontSize: toolConfig.value.size || 16,
  }

  objects.value.push(textObj)
  saveState()
  render()
  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 保存状态到历史记录
const saveState = () => {
  // 如果当前不在历史记录末尾，删除后面的记录
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  // 保存当前状态（深拷贝）
  history.value.push(JSON.parse(JSON.stringify(objects.value)))
  historyIndex.value = history.value.length - 1

  // 限制历史记录数量
  if (history.value.length > 20) {
    history.value.shift()
    historyIndex.value--
  }

  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 撤销
const undo = () => {
  if (!canUndo.value) return

  historyIndex.value--
  objects.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  render()
  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 重做
const redo = () => {
  if (!canRedo.value) return

  historyIndex.value++
  objects.value = JSON.parse(JSON.stringify(history.value[historyIndex.value]))
  render()
  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 清空画布
const clearCanvas = () => {
  // 清空对象列表
  objects.value = []

  // 清空选择状态
  selectedObjects.value.clear()
  selectionBox.value = null

  // 保存状态并重新渲染
  saveState()
  render()
  // 第X步：通知父组件内容已变化
  emit('content-change')
}

// 工具切换
const handleToolChange = (tool: string) => {
  // 切换工具前，清空选择状态
  if (currentTool.value === 'select') {
    selectedObjects.value.clear()
    selectionBox.value = null
  }

  currentTool.value = tool
  hoveredObject.value = null

  // 切换工具时，如果Signature Pad有内容，清空它
  if (signaturePad && currentTool.value !== 'draw') {
    signaturePad.clear()
  }

  // 更新光标样式
  if (canvasRef.value) {
    canvasRef.value.style.cursor = tool === 'hand' ? 'grab' : 'crosshair'
  }

  render()
}

// 配置变化
const handleConfigChange = (config: { [key: string]: string | number | boolean | undefined }) => {
  toolConfig.value = { 
    ...toolConfig.value, 
    ...config,
    handwritingStyle: config.handwritingStyle as 'signature' | 'normal' | undefined
  }
  
  // 更新 Signature Pad 配置
  if (signaturePad) {
    if (config.color) {
      signaturePad.penColor = config.color as string
    }
    if (config.size) {
      signaturePad.minWidth = (config.size as number) * 0.5
      signaturePad.maxWidth = (config.size as number) * 1.5
    }
  }
}

// 缩放控制
const zoomIn = () => {
  // 第1步：边界检查
  if (zoomLevel.value >= 3) {
    console.warn('[DrawingBoard] zoomIn: 已达最大缩放，忽略。当前=', zoomLevel.value)
    return
  }
  // 第2步：更新缩放
  const before = zoomLevel.value
  zoomLevel.value = Math.min(3, zoomLevel.value + 0.1)
  // 第3步：记录缩放变化
  console.warn('[DrawingBoard] zoomIn: 触发点击，缩放从', before, '到', zoomLevel.value)
}

const zoomOut = () => {
  // 第1步：边界检查
  if (zoomLevel.value <= 0.1) {
    console.warn('[DrawingBoard] zoomOut: 已达最小缩放，忽略。当前=', zoomLevel.value)
    return
  }
  // 第2步：更新缩放
  const before = zoomLevel.value
  zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1)
  // 第3步：记录缩放变化
  console.warn('[DrawingBoard] zoomOut: 触发点击，缩放从', before, '到', zoomLevel.value)
}

// 监控缩放变化并记录应用到样式的transform
watch(zoomLevel, (val, oldVal) => {
  console.warn('[DrawingBoard] zoomLevel变更:', oldVal, '=>', val)
})

// 键盘事件处理
const handleKeyDown = (e: KeyboardEvent) => {
  // Delete键：删除选中的对象
  if (e.key === 'Delete' && currentTool.value === 'select' && selectedObjects.value.size > 0) {
    e.preventDefault()

    // 删除选中的对象（从后往前删除避免索引问题）
    const indicesToDelete = Array.from(selectedObjects.value).sort((a, b) => b - a)
    indicesToDelete.forEach((index) => {
      objects.value.splice(index, 1)
    })

    // 清空选择状态
    selectedObjects.value.clear()

    // 保存状态并重新渲染
    saveState()
    render()
  }

  // Escape键：取消选择
  if (e.key === 'Escape' && currentTool.value === 'select') {
    e.preventDefault()
    selectedObjects.value.clear()
    selectionBox.value = null
    render()
  }

  // Ctrl/Cmd + A：全选所有对象
  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && currentTool.value === 'select') {
    e.preventDefault()
    selectedObjects.value = new Set(objects.value.map((_, index) => index))
    render()
  }
}

// 生命周期
onMounted(() => {
  console.log('[DrawingBoard] 🚀 组件挂载 - onMounted')
  
  // 流程：初始化画布
  initCanvas()

  // 流程：添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
  
  console.log('[DrawingBoard] ✅ 组件初始化完成')
})

onUnmounted(() => {
  // 流程：清理资源
  ctx = null

  // 流程：清理单指延迟定时器
  if (singleTouchTimer !== null) {
    clearTimeout(singleTouchTimer)
    singleTouchTimer = null
  }

  // 流程：移除键盘事件监听
  window.removeEventListener('keydown', handleKeyDown)
})

// 暴露方法给父组件
defineExpose({
  // 流程：保存当前绘图数据
  saveData: () => {
    return {
      objects: objects.value,
      history: history.value,
      historyIndex: historyIndex.value
    }
  },
  
  // 流程：加载绘图数据
  loadData: (data: { objects: DrawObject[]; history: DrawObject[][]; historyIndex: number }) => {
    console.log('[DrawingBoard] 📥 加载绘图数据:', {
      objectsCount: data.objects.length,
      historyLength: data.history.length,
      historyIndex: data.historyIndex
    })
    
    objects.value = data.objects
    history.value = data.history
    historyIndex.value = data.historyIndex
    
    // 重新渲染
    nextTick(() => {
      render()
      console.log('[DrawingBoard] ✅ 绘图数据已加载并重新渲染')
    })
  },
  
  // 流程：清空画布
  clearAll: () => {
    objects.value = []
    history.value = [[]]
    historyIndex.value = 0
    render()
  },
  
  // 流程：获取缩略图
  getThumbnail: (maxWidth = 200, maxHeight = 150): string => {
    // 第1步：检查canvas是否存在
    if (!canvasRef.value) return ''
    
    // 第2步：创建临时canvas生成缩略图
    const sourceCanvas = canvasRef.value
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return ''
    
    // 第3步：计算缩放比例
    const scale = Math.min(maxWidth / sourceCanvas.width, maxHeight / sourceCanvas.height)
    tempCanvas.width = sourceCanvas.width * scale
    tempCanvas.height = sourceCanvas.height * scale
    
    // 第4步：绘制缩略图
    tempCtx.fillStyle = '#ffffff'
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    tempCtx.drawImage(sourceCanvas, 0, 0, tempCanvas.width, tempCanvas.height)
    
    // 第5步：返回base64数据
    return tempCanvas.toDataURL('image/png', 0.8)
  }
})
</script>

<style scoped>
.canvas-demo-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #fafafb;
  position: relative;
  overflow: hidden;
}

/* 工具栏包装器（浮动在顶部） */
.toolbar-wrapper {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  z-index: 100;
  pointer-events: none;
  display: flex;
  justify-content: center;
}

.toolbar-wrapper :deep(.unified-toolbar-container) {
  pointer-events: auto;
  padding: 0;
}

/* 画布容器（占满整个对话框） */
.canvas-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 24px;
  padding-top: 80px;
  position: relative;
}

.canvas-container {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.02),
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 1px 3px rgba(0, 0, 0, 0.06);
  background-color: #ffffff;
  cursor: crosshair;
  transition: box-shadow 0.2s ease;
  will-change: transform;
}

.canvas-container:hover {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 2px 6px rgba(0, 0, 0, 0.08);
}

/* Signature Pad 画布样式 */
.signature-pad-canvas {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: auto;
  z-index: 10;
}

/* Excalidraw 风格浮动缩放控制面板 */
.zoom-control-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.04);
  z-index: 200; /* 提高层级，避免被带有 transform 的 canvas 叠盖 */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
}

.zoom-control-panel:hover {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 12px 32px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.06);
}

.zoom-btn {
  color: #6b6b6b;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  width: 32px;
  height: 32px;
}

.zoom-btn:hover:not(:disabled) {
  background-color: #f5f5f5;
  color: #1e1e1e;
}

.zoom-btn:active:not(:disabled) {
  background-color: #e8e8e8;
  transform: scale(0.96);
}

.zoom-btn:disabled {
  color: #d1d1d1;
  cursor: not-allowed;
}

.zoom-display {
  color: #1e1e1e;
  font-size: 13px;
  font-weight: 500;
  min-width: 50px;
  text-align: center;
  padding: 0 8px;
  user-select: none;
  letter-spacing: -0.01em;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .canvas-wrapper {
    padding: 16px;
    padding-top: 70px;
  }

  .toolbar-wrapper {
    top: 12px;
  }

  .zoom-control-panel {
    bottom: 0;
    right: 0;
    padding: 4px 6px;
    gap: 2px;
  }

  .zoom-btn {
    width: 28px;
    height: 28px;
  }

  .zoom-display {
    font-size: 12px;
    min-width: 45px;
    padding: 0 6px;
  }
}

/* ==================== 页面管理抽屉样式 ==================== */
/* 触发按钮 */
.pages-drawer-trigger {
  position: absolute;
  top: 80px;
  left: 16px;
  z-index: 150;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
  }
}

/* 抽屉对话框 */
.pages-drawer-dialog {
  :deep(.q-dialog__backdrop) {
    background: rgba(0, 0, 0, 0.3);
  }
}

/* 抽屉卡片 */
.pages-drawer-card {
  width: 320px;
  height: 100vh;
  max-height: 100vh;
  margin: 0;
  border-radius: 0;
  display: flex;
  flex-direction: column;
  
  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    flex-shrink: 0;
  }
  
  .drawer-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    font-weight: 600;
  }
  
  .drawer-content {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }
}

/* 草稿卡片 */
.draft-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: rgba(33, 150, 243, 0.5);
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
    transform: translateX(4px);
  }
  
  &.is-active {
    border-color: #2196f3;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    box-shadow: 0 2px 12px rgba(33, 150, 243, 0.3);
  }
}

/* 页面编号徽章（左侧，小字号） */
.page-number-badge {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.draft-card.is-active .page-number-badge {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
}

/* 草稿缩略图 */
.draft-thumbnail {
  flex: 1;
  height: 80px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* 删除按钮（右上角） */
.delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  background: rgba(255, 255, 255, 0.9);
  
  &:hover {
    background: white;
  }
}

.draft-card:hover .delete-btn {
  opacity: 1;
}

/* 新增页面卡片 */
.add-page-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  border: 2px dashed rgba(33, 150, 243, 0.3);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(33, 150, 243, 0.02);
  
  &:hover {
    border-color: rgba(33, 150, 243, 0.6);
    background: rgba(33, 150, 243, 0.05);
    transform: scale(1.02);
  }
}

.add-page-text {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #2196f3;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .pages-drawer-trigger {
    background: rgba(30, 30, 30, 0.95);
  }
  
  .pages-drawer-card {
    background: #1e1e1e;
    
    .drawer-header {
      border-bottom-color: rgba(255, 255, 255, 0.1);
    }
  }
  
  .draft-card {
    background: #2a2a2a;
    border-color: rgba(255, 255, 255, 0.1);
    
    &:hover {
      border-color: rgba(33, 150, 243, 0.5);
    }
    
    &.is-active {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
    }
  }
  
  .add-page-card {
    border-color: rgba(33, 150, 243, 0.3);
    background: rgba(33, 150, 243, 0.05);
    
    &:hover {
      background: rgba(33, 150, 243, 0.1);
    }
  }
}
</style>
