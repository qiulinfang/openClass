<template>
  <div 
    class="pdf-page pdf-page-item" 
    :style="pageStyle"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @wheel="handleWheel"
  >
    <!-- PDF 渲染层 -->
    <canvas 
      ref="pdfCanvas" 
      class="pdf-layer"
      :style="pdfCanvasStyle"
    ></canvas>
    
    <!-- Fabric.js 标注层容器 -->
    <canvas 
      ref="fabricWrapper"
      class="canvas-container"
      :style="fabricWrapperStyle"
    >
      <!-- Fabric.js 会在这个 canvas 元素上创建绘图上下文 -->
    </canvas>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="page-loading">
      <q-spinner-dots size="30px" color="primary" />
      <div class="loading-text">正在加载第 {{ layout.pageNum }} 页...</div>
    </div>
    
    <!-- 错误状态 -->
    <div v-if="error" class="page-error">
      <div class="error-icon">⚠️</div>
      <div class="error-text">第 {{ layout.pageNum }} 页加载失败</div>
      <q-btn 
        size="sm" 
        color="primary" 
        @click="retryLoad"
      >
        重试
      </q-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, toRaw } from 'vue'
import { Canvas, PencilBrush, Rect, Polygon, FabricObject } from 'fabric'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { IndexedDBService } from '@/services/indexeddb-service'

// Props 定义
interface Props {
  layout: {
    pageNum: number
    top: number
    height: number
    width: number
  }
}

const props = defineProps<Props>()

// 定义事件emit
const emit = defineEmits<{
  'screenshot-captured': [blob: Blob]
}>()

// 使用 Store
const store = usePdfViewerStore()

// 组件状态
const pdfCanvas = ref<HTMLCanvasElement>()
const fabricWrapper = ref<HTMLCanvasElement>()
const fabricInstance = ref<Canvas | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

// 双指滑动状态
const touchState = ref({
  isTwoFinger: false, // 是否为双指操作
  startY: 0, // 双指中心点起始Y坐标
  lastY: 0, // 上一次的Y坐标
  fabricWasDrawing: false // 记录Fabric之前的绘图模式状态
})

// 截图状态
const screenshotState = ref({
  isDrawing: false, // 是否正在绘制截图选区
  startPoint: null as { x: number; y: number } | null, // 矩形截图的起始点
  currentRect: null as Rect | null, // 当前绘制的矩形选区
  polygonPoints: [] as { x: number; y: number }[], // 多边形截图的点集
  currentPolygon: null as Polygon | null // 当前绘制的多边形选区
})

// 工具函数：将十六进制颜色转换为 rgba 格式
const hexToRgba = (hex: string, alpha: number): string => {
  // 移除 # 号
  hex = hex.replace('#', '')
  
  // 处理缩写格式 (如 #FFF)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  
  // 解析 RGB 值
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // 返回 rgba 格式
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 计算属性
const pageStyle = computed(() => ({
  position: 'relative' as const,
  width: `${props.layout.width}px`,
  height: `${props.layout.height}px`,
  margin: '0 auto 20px',
  backgroundColor: '#f5f5f5',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  borderRadius: '4px',
  overflow: 'hidden'
}))

// PDF Canvas 样式
const pdfCanvasStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none' as const  // 修改为 none，让 Fabric canvas 处理所有事件
}))

// Fabric.js 容器样式
const fabricWrapperStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  userSelect: 'none' as const,
  width: '100%',
  height: '100%',
  pointerEvents: 'auto' as const,  // 确保 Fabric canvas 能接收事件
  zIndex: 2  // 确保在最上层
}))

// 初始化 PDF 页面
const initPdfPage = async () => {
  if (!store.pdfDoc || !pdfCanvas.value) {
    return
  }
  
  try {
    isLoading.value = true
    error.value = null
    
    // 获取 PDF 页面
    const rawPdfDoc = toRaw(store.pdfDoc) // 使用 toRaw 获取原始 PDF 文档对象
    const page = await rawPdfDoc.getPage(props.layout.pageNum)
    const rawPage = toRaw(page) // 使用 toRaw 获取原始页面对象
    
    // 计算视口
    const viewport = rawPage.getViewport({ scale: store.scale })
    
    // 设置 Canvas 尺寸
    const canvas = pdfCanvas.value
    const context = canvas.getContext('2d')
    if (!context) return
    
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    // 渲染 PDF 页面
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas // 添加 canvas 属性
    }
    
    await rawPage.render(renderContext).promise
    
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页 PDF 渲染失败:`, err)
    error.value = err instanceof Error ? err.message : '渲染失败'
  } finally {
    isLoading.value = false
  }
}

// 初始化 Fabric.js Canvas
const initFabricCanvas = async () => {
  if (!fabricWrapper.value || !pdfCanvas.value) {
    return
  }
  
  try {
    // 确保使用与PDF canvas相同的尺寸
    const pdfCanvasElement = pdfCanvas.value
    const canvasWidth = pdfCanvasElement.width
    const canvasHeight = pdfCanvasElement.height
    
    // 创建 Fabric Canvas 实例，使用与PDF相同的尺寸
    fabricInstance.value = new Canvas(fabricWrapper.value, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
      // 确保 Canvas 正确覆盖 PDF
      absolutePositioned: true,
      // 添加调试信息
      enablePointerEvents: true
    })
    
    // 设置绘制模式
    updateFabricMode()
    
    // 加载现有笔记
    await loadAnnotations()
    
    // 监听 Fabric 事件
    setupFabricEvents()
    
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页 Fabric Canvas 初始化失败:`, err)
  }
}

// 更新 Fabric 模式
const updateFabricMode = () => {
  if (!fabricInstance.value) {
    return
  }
  
  const tool = store.selectedTool
  
  // 重置所有模式
  fabricInstance.value.isDrawingMode = false
  fabricInstance.value.selection = true
  
  
  switch (tool) {
    case 'highlighter':
      fabricInstance.value.isDrawingMode = true
      fabricInstance.value.freeDrawingBrush = new PencilBrush(fabricInstance.value as unknown as Canvas)
      // 荧光笔：将颜色转换为带透明度的 rgba 格式
      fabricInstance.value.freeDrawingBrush.color = hexToRgba(
        store.drawingConfig.highlighterColor, 
        store.drawingConfig.highlighterOpacity / 100
      )
      fabricInstance.value.freeDrawingBrush.width = store.drawingConfig.highlighterWidth
      // 重置为正常绘制模式
      Object.assign(fabricInstance.value.freeDrawingBrush, { globalCompositeOperation: 'source-over' })
      break
      
    case 'pen':
      fabricInstance.value.isDrawingMode = true
      fabricInstance.value.freeDrawingBrush = new PencilBrush(fabricInstance.value as unknown as Canvas)
      // 签字笔：使用不透明颜色
      fabricInstance.value.freeDrawingBrush.color = store.drawingConfig.penColor
      fabricInstance.value.freeDrawingBrush.width = store.drawingConfig.penWidth
      // 重置为正常绘制模式
      Object.assign(fabricInstance.value.freeDrawingBrush, { globalCompositeOperation: 'source-over' })
      break
      
    case 'eraser':
      // 整笔擦除模式：拖动触碰删除整个对象
      fabricInstance.value.isDrawingMode = false
      fabricInstance.value.selection = false
      break
      
    case 'screenshot':
      // 截图模式：禁用绘图和选择，使用自定义鼠标事件绘制选区
      fabricInstance.value.isDrawingMode = false
      fabricInstance.value.selection = false
      break
      
    default:
      // 选择模式
      fabricInstance.value.isDrawingMode = false
      fabricInstance.value.selection = true
      break
  }
  
  // 强制重新渲染
  fabricInstance.value.renderAll()
}

// 加载笔记
const loadAnnotations = async () => {
  if (!fabricInstance.value) return
  
  try {
    const annotations = store.allAnnotations[props.layout.pageNum] || []
    
    if (annotations.length > 0) {
      await fabricInstance.value.loadFromJSON({ objects: annotations })
      fabricInstance.value.renderAll()
    }
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页加载笔记失败:`, err)
  }
}

// 保存笔记
const saveAnnotations = () => {
  if (!fabricInstance.value) return
  
  try {
    // 1. 获取Fabric对象的JSON表示
    const json = fabricInstance.value.toJSON()
    const objects = json.objects || []
    
    // 2. 使用IndexedDB的深度序列化方法清理不可序列化对象
    const cleanObjects = IndexedDBService.deepSerialize(objects) as object[]
    
    // 3. 更新到 Store
    store.updateAnnotations(props.layout.pageNum, cleanObjects)
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页保存笔记失败:`, err)
  }
}

// 设置 Fabric 事件监听
const setupFabricEvents = () => {
  if (!fabricInstance.value) return
  
  // 对象修改事件
  fabricInstance.value.on('object:modified', () => {
    saveAnnotations()
  })
  
  // 对象添加事件
  fabricInstance.value.on('object:added', () => {
    saveAnnotations()
  })
  
  // 对象删除事件
  fabricInstance.value.on('object:removed', () => {
    saveAnnotations()
  })
  
  // 路径创建事件（绘制完成）
  fabricInstance.value.on('path:created', () => {
    saveAnnotations()
  })
  
  // 鼠标按下事件（用于整笔擦除模式 - 开始拖动）
  let isErasing = false
  
  fabricInstance.value.on('mouse:down', (event) => {
    // 橡皮擦工具：整笔擦除模式
    if (store.selectedTool === 'eraser') {
      isErasing = true
      // 检查鼠标下方是否有对象
      const pointer = fabricInstance.value?.getPointer(event.e)
      if (pointer) {
        checkAndDeleteObjects(pointer)
      }
    }
    
    // 截图工具：开始绘制选区
    if (store.selectedTool === 'screenshot') {
      handleScreenshotMouseDown(event)
    }
  })
  
  // 鼠标移动事件（用于整笔擦除 - 拖动擦除）
  fabricInstance.value.on('mouse:move', (event) => {
    // 橡皮擦工具：整笔擦除模式
    if (isErasing && store.selectedTool === 'eraser') {
      const pointer = fabricInstance.value?.getPointer(event.e)
      if (pointer) {
        checkAndDeleteObjects(pointer)
      }
    }
    
    // 截图工具：绘制选区
    if (store.selectedTool === 'screenshot') {
      handleScreenshotMouseMove(event)
    }
  })
  
  // 鼠标松开事件（用于整笔擦除 - 停止拖动）
  fabricInstance.value.on('mouse:up', () => {
    isErasing = false
    
    // 截图工具：完成选区绘制
    if (store.selectedTool === 'screenshot') {
      handleScreenshotMouseUp()
    }
  })
  
  // 鼠标双击事件（用于多边形截图 - 完成绘制）
  fabricInstance.value.on('mouse:dblclick', () => {
    if (store.selectedTool === 'screenshot' && store.drawingConfig.screenshotShape === 'polygon') {
      finishPolygonScreenshot()
    }
  })
}

// 截图 - 鼠标按下事件处理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleScreenshotMouseDown = (event: any) => {
  if (!fabricInstance.value) return
  
  const pointer = fabricInstance.value.getPointer(event.e)
  const shapeType = store.drawingConfig.screenshotShape
  
  console.log('[截图] 🖱️ 鼠标按下', {
    形状类型: shapeType,
    坐标: `(${pointer.x.toFixed(2)}, ${pointer.y.toFixed(2)})`
  })
  
  if (shapeType === 'rectangle') {
    // 矩形截图：记录起始点并开始绘制
    screenshotState.value.isDrawing = true
    screenshotState.value.startPoint = { x: pointer.x, y: pointer.y }
    
    console.log('[截图] 📐 开始绘制矩形选区', {
      起始点: `(${pointer.x.toFixed(2)}, ${pointer.y.toFixed(2)})`
    })
    
    // 创建初始矩形
    const rect = new Rect({
      left: pointer.x,
      top: pointer.y,
      width: 0,
      height: 0,
      fill: store.drawingConfig.screenshotFillColor,
      stroke: store.drawingConfig.screenshotStrokeColor,
      strokeWidth: store.drawingConfig.screenshotStrokeWidth,
      selectable: false,
      evented: false
    })
    
    fabricInstance.value.add(rect as unknown as FabricObject)
    screenshotState.value.currentRect = rect
  } else if (shapeType === 'polygon') {
    // 多边形截图：添加点到点集
    screenshotState.value.polygonPoints.push({ x: pointer.x, y: pointer.y })
    
    console.log('[截图] 🔷 添加多边形顶点', {
      顶点序号: screenshotState.value.polygonPoints.length,
      坐标: `(${pointer.x.toFixed(2)}, ${pointer.y.toFixed(2)})`,
      总顶点数: screenshotState.value.polygonPoints.length
    })
    
    // 更新或创建多边形
    updatePolygonPreview()
  }
}

// 截图 - 鼠标移动事件处理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleScreenshotMouseMove = (event: any) => {
  if (!fabricInstance.value) return
  
  const shapeType = store.drawingConfig.screenshotShape
  
  if (shapeType === 'rectangle' && screenshotState.value.isDrawing && screenshotState.value.currentRect) {
    // 矩形截图：更新矩形大小
    const pointer = fabricInstance.value.getPointer(event.e)
    const startPoint = screenshotState.value.startPoint
    
    if (startPoint) {
      const width = pointer.x - startPoint.x
      const height = pointer.y - startPoint.y
      
      screenshotState.value.currentRect.set({
        left: width > 0 ? startPoint.x : pointer.x,
        top: height > 0 ? startPoint.y : pointer.y,
        width: Math.abs(width),
        height: Math.abs(height)
      })
      
      fabricInstance.value.renderAll()
    }
  }
}

// 截图 - 鼠标松开事件处理
const handleScreenshotMouseUp = () => {
  const shapeType = store.drawingConfig.screenshotShape
  
  if (shapeType === 'rectangle' && screenshotState.value.isDrawing) {
    // 矩形截图：完成绘制并捕获图像
    screenshotState.value.isDrawing = false
    
    if (screenshotState.value.currentRect) {
      const rect = screenshotState.value.currentRect
      console.log('[截图] ✅ 矩形选区绘制完成', {
        左上角: `(${rect.left?.toFixed(2)}, ${rect.top?.toFixed(2)})`,
        宽度: rect.width?.toFixed(2),
        高度: rect.height?.toFixed(2)
      })
      
      captureScreenshotArea(screenshotState.value.currentRect as unknown as FabricObject)
    }
  }
}

// 更新多边形预览
const updatePolygonPreview = () => {
  if (!fabricInstance.value) return
  
  const points = screenshotState.value.polygonPoints
  
  if (points.length < 2) return
  
  console.log('[截图] 🔄 更新多边形预览', {
    顶点数: points.length,
    顶点坐标: points.map((p, i) => `P${i+1}(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', ')
  })
  
  // 移除旧的多边形
  if (screenshotState.value.currentPolygon) {
    fabricInstance.value.remove(screenshotState.value.currentPolygon as unknown as FabricObject)
  }
  
  // 创建新的多边形（使用points数组格式）
  const polygon = new Polygon(points.map(p => ({ x: p.x, y: p.y })), {
    fill: store.drawingConfig.screenshotFillColor,
    stroke: store.drawingConfig.screenshotStrokeColor,
    strokeWidth: store.drawingConfig.screenshotStrokeWidth,
    selectable: false,
    evented: false
  })
  
  fabricInstance.value.add(polygon as unknown as FabricObject)
  screenshotState.value.currentPolygon = polygon
  fabricInstance.value.renderAll()
}

// 完成多边形截图
const finishPolygonScreenshot = () => {
  if (!fabricInstance.value || !screenshotState.value.currentPolygon) return
  
  console.log('[截图] ✅ 多边形选区绘制完成（双击）', {
    顶点数: screenshotState.value.polygonPoints.length,
    边界框: screenshotState.value.currentPolygon.getBoundingRect()
  })
  
  // 捕获多边形区域的图像
  captureScreenshotArea(screenshotState.value.currentPolygon as unknown as FabricObject)
  
  // 重置多边形状态
  screenshotState.value.polygonPoints = []
  screenshotState.value.currentPolygon = null
}

// 捕获截图区域图像（包含PDF层和标注层）
const captureScreenshotArea = async (shape: FabricObject) => {
  if (!pdfCanvas.value || !fabricInstance.value || !fabricWrapper.value) return
  
  const startTime = Date.now()
  console.log('[截图生成] 🎬 ========== 开始捕获截图区域 ==========', {
    页码: props.layout.pageNum,
    时间: new Date().toLocaleTimeString()
  })
  
  try {
    // 步骤1：更新对象坐标（确保边界框计算正确）
    console.log('[截图生成] 步骤1/7 📐 计算选区边界...')
    shape.setCoords()
    
    // 步骤2：获取形状的边界框
    const boundingRect = shape.getBoundingRect()
    
    // 调试：输出shape的原始属性
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shapeAny = shape as any
    console.log('[截图生成] 步骤1/7 ✓ 边界计算完成', {
      形状类型: shape.type,
      左上角: `(${boundingRect.left.toFixed(2)}, ${boundingRect.top.toFixed(2)})`,
      原始宽度: shapeAny.width,
      原始高度: shapeAny.height,
      缩放比例: `X:${shapeAny.scaleX} Y:${shapeAny.scaleY}`
    })
    
    // 步骤3：确保边界框尺寸有效（至少1x1像素）
    const validWidth = Math.max(1, Math.round(boundingRect.width))
    const validHeight = Math.max(1, Math.round(boundingRect.height))
    
    console.log('[截图生成] 步骤2/7 📏 验证选区尺寸', {
      宽度: `${validWidth}px`,
      高度: `${validHeight}px`,
      面积: `${(validWidth * validHeight).toFixed(0)} px²`,
      分辨率: `${validWidth}x${validHeight}`
    })
    
    // 步骤4：创建临时canvas用于合成图像（使用有效尺寸）
    console.log('[截图生成] 步骤3/7 📦 创建临时画布...')
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = validWidth
    tempCanvas.height = validHeight
    const tempCtx = tempCanvas.getContext('2d')
    
    if (!tempCtx) {
      console.error('[截图生成] ❌ 无法创建临时Canvas上下文')
      return
    }
    
    console.log('[截图生成] 步骤3/7 ✓ 临时画布创建完成', {
      画布尺寸: `${validWidth} x ${validHeight}`,
      画布类型: '2D Context'
    })
    
    // 步骤5：第一层 - 从PDF canvas中提取对应区域
    console.log('[截图生成] 步骤4/7 📄 提取PDF内容层...')
    tempCtx.drawImage(
      pdfCanvas.value,
      Math.round(boundingRect.left), 
      Math.round(boundingRect.top),
      validWidth, 
      validHeight,
      0, 0,
      validWidth, 
      validHeight
    )
    console.log('[截图生成] 步骤4/7 ✓ PDF内容层提取完成')
    
    // 步骤6：第二层 - 从Fabric canvas中提取对应区域（包含所有标注）
    console.log('[截图生成] 步骤5/7 ✏️ 叠加标注层...')
    
    // 先临时隐藏截图选区形状，避免它出现在截图中
    const shapeVisible = shape.visible
    shape.set({ visible: false })
    fabricInstance.value.renderAll()
    console.log('[截图生成] 步骤5/7   → 临时隐藏选区框')
    
    // 绘制Fabric层到临时canvas
    tempCtx.drawImage(
      fabricWrapper.value,
      Math.round(boundingRect.left), 
      Math.round(boundingRect.top),
      validWidth, 
      validHeight,
      0, 0,
      validWidth, 
      validHeight
    )
    
    // 恢复截图选区形状的可见性
    shape.set({ visible: shapeVisible })
    fabricInstance.value.renderAll()
    console.log('[截图生成] 步骤5/7   → 恢复选区框可见性')
    console.log('[截图生成] 步骤5/7 ✓ 标注层叠加完成')
    
    console.log('[截图生成] 步骤6/7 ✨ 双层合成完成（PDF + 标注）')
    
    // 步骤7：转换为图片并发送到对话面板
    // 流程：使用JPEG格式，压缩质量40%（与安卓原生保持一致）
    console.log('[截图生成] 步骤7/7 🔄 转换为JPEG格式（质量40%）...')
    tempCanvas.toBlob((blob) => {
      if (blob) {
        const captureTime = Date.now() - startTime
        console.log('[截图生成] 步骤7/7 ✓ JPEG转换完成', {
          文件大小: `${(blob.size / 1024).toFixed(2)} KB`,
          格式: 'JPEG (质量40%)',
          原始大小: `${blob.size} bytes`
        })
        
        // emit事件，将blob传递给父组件
        emit('screenshot-captured', blob)
        console.log('[截图生成] 📤 图片已发送到父组件（PdfViewerView）')
        
        // 清除绘制的选区形状
        fabricInstance.value?.remove(shape)
        fabricInstance.value?.renderAll()
        console.log('[截图生成] 🧹 清除选区形状')
        
        // 重置截图状态
        resetScreenshotState()
        console.log('[截图生成] 🔄 重置截图状态')
        
        console.log('[截图生成] 🎉 ========== 截图生成完成 ==========', {
          总耗时: `${captureTime}ms`,
          成功状态: '✅ 成功',
          下一步: '等待发送到AI'
        })
      }
    }, 'image/jpeg', 0.4)
    
  } catch (error) {
    const captureTime = Date.now() - startTime
    console.error('[截图生成] ❌ ========== 捕获失败 ==========', {
      错误信息: error,
      失败位置: '截图生成流程',
      已耗时: `${captureTime}ms`
    })
  }
}

// 重置截图状态
const resetScreenshotState = () => {
  screenshotState.value.isDrawing = false
  screenshotState.value.startPoint = null
  screenshotState.value.currentRect = null
  screenshotState.value.polygonPoints = []
  screenshotState.value.currentPolygon = null
  console.log('[截图] 🔄 截图状态已重置')
}

// 检查并删除与橡皮擦相交的对象
const checkAndDeleteObjects = (pointer: { x: number; y: number }) => {
  if (!fabricInstance.value) return
  
  const eraserSize = store.drawingConfig.eraserSize
  const objects = fabricInstance.value.getObjects()
  
  // 遍历所有对象，检查是否与橡皮擦区域相交
  objects.forEach((obj) => {
    if (obj.type === 'path') {
      // 获取对象的边界框
      const bounds = obj.getBoundingRect()
      
      // 检查橡皮擦圆形区域是否与对象边界框相交
      const eraserRadius = eraserSize / 2
      
      // 计算橡皮擦圆心到矩形最近点的距离
      const closestX = Math.max(bounds.left, Math.min(pointer.x, bounds.left + bounds.width))
      const closestY = Math.max(bounds.top, Math.min(pointer.y, bounds.top + bounds.height))
      
      const distanceX = pointer.x - closestX
      const distanceY = pointer.y - closestY
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)
      
      // 如果距离小于橡皮擦半径，说明相交，删除对象
      if (distance < eraserRadius) {
        fabricInstance.value?.remove(obj)
      }
    }
  })
  
  fabricInstance.value.renderAll()
}

// 重试加载
const retryLoad = async () => {
  await initPdfPage()
  if (!error.value) {
    await initFabricCanvas()
  }
}

// 计算双指中心点的Y坐标
const getTwoFingerCenterY = (touches: TouchList): number => {
  // 如果不是两个触摸点，返回0
  if (touches.length !== 2) return 0
  
  // 计算两个触摸点的中心Y坐标
  const touch1 = touches[0]
  const touch2 = touches[1]
  return (touch1.clientY + touch2.clientY) / 2
}

// 获取滚动容器（优先查找 Quasar 虚拟滚动容器）
const getScrollContainer = (): HTMLElement | null => {
  // 从当前元素向上查找
  let parent = pdfCanvas.value?.parentElement
  
  while (parent) {
    // 优先查找 Quasar 虚拟滚动容器
    if (parent.classList.contains('q-virtual-scroll')) {
      // q-virtual-scroll 的实际滚动元素
      const scrollContent = parent.querySelector('.q-virtual-scroll__content')
      if (scrollContent?.parentElement) {
        return scrollContent.parentElement as HTMLElement
      }
      return parent
    }
    
    // 查找其他滚动容器
    const overflowY = window.getComputedStyle(parent).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    
    parent = parent.parentElement
  }
  
  // 如果没找到，返回 document.documentElement（整个页面）
  return document.documentElement
}

// 触摸开始事件处理
const handleTouchStart = (event: TouchEvent) => {
  // 检查是否为双指触摸
  if (event.touches.length === 2) {
    // 双指触摸，进入滚动模式
    touchState.value.isTwoFinger = true
    touchState.value.startY = getTwoFingerCenterY(event.touches)
    touchState.value.lastY = touchState.value.startY
    
    // 禁用 Fabric 的绘图模式
    if (fabricInstance.value) {
      touchState.value.fabricWasDrawing = fabricInstance.value.isDrawingMode
      fabricInstance.value.isDrawingMode = false
      fabricInstance.value.selection = false
    }
  } else {
    // 单指触摸，确保不在滚动模式
    touchState.value.isTwoFinger = false
  }
}

// 触摸移动事件处理
const handleTouchMove = (event: TouchEvent) => {
  // 只处理双指滚动
  if (!touchState.value.isTwoFinger || event.touches.length !== 2) {
    return
  }
  
  // 阻止默认行为（防止页面缩放等）
  event.preventDefault()
  
  // 计算当前双指中心点Y坐标
  const currentY = getTwoFingerCenterY(event.touches)
  
  // 计算移动距离（当前Y - 上一次Y）
  const deltaY = currentY - touchState.value.lastY
  
  // 获取 Quasar 滚动容器
  const scrollContainer = getScrollContainer()
  if (scrollContainer) {
    // 控制滚动：向下滑动（deltaY > 0）则向上滚动（scrollTop 减小）
    // 向上滑动（deltaY < 0）则向下滚动（scrollTop 增大）
    scrollContainer.scrollTop -= deltaY
  }
  
  // 更新上一次的Y坐标
  touchState.value.lastY = currentY
}

// 触摸结束事件处理
const handleTouchEnd = (event: TouchEvent) => {
  // 如果是双指滚动模式结束
  if (touchState.value.isTwoFinger) {
    // 检查剩余触摸点数量
    if (event.touches.length < 2) {
      // 退出滚动模式
      touchState.value.isTwoFinger = false
      
      // 恢复 Fabric 的绘图模式
      if (fabricInstance.value && touchState.value.fabricWasDrawing) {
        fabricInstance.value.isDrawingMode = touchState.value.fabricWasDrawing
        updateFabricMode()
      }
    }
  }
}

// 鼠标滚轮事件处理
const handleWheel = (event: WheelEvent) => {
  // 阻止默认行为（防止 Fabric.js 或浏览器默认滚动）
  event.preventDefault()
  
  // 获取 Quasar 滚动容器
  const scrollContainer = getScrollContainer()
  if (!scrollContainer) return
  
  // 根据滚轮的 deltaY 控制滚动
  // deltaY > 0 表示向下滚动，deltaY < 0 表示向上滚动
  scrollContainer.scrollTop += event.deltaY
}

// 生命周期
onMounted(async () => {
  await nextTick()
  
  // 初始化 PDF 页面
  await initPdfPage()
  
  // 初始化 Fabric Canvas
  if (!error.value) {
    await initFabricCanvas()
  }
})

onUnmounted(async () => {
  // 保存最终状态到内存
  saveAnnotations()
  
  // 立即保存到 IndexedDB（不使用防抖）
  await store.flushSave()
  
  // 销毁 Fabric Canvas
  if (fabricInstance.value) {
    fabricInstance.value.dispose()
    fabricInstance.value = null
  }
})

// 监听工具变化
watch(() => store.selectedTool, () => {
  updateFabricMode()
})

// 监听绘制配置变化
watch(() => store.drawingConfig, () => {
  updateFabricMode()
}, { deep: true })

// 监听缩放变化
watch(() => store.scale, async () => {
  // 重新渲染 PDF
  await initPdfPage()
  
  // 重新初始化 Fabric Canvas
  if (fabricInstance.value) {
    fabricInstance.value.dispose()
    await initFabricCanvas()
  }
})
</script>

<style scoped>
.pdf-page {
  position: relative;
}

.pdf-layer {
  z-index: 1;
}

.canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
}

/* Fabric.js Canvas 样式 */
.canvas-container canvas {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  pointer-events: auto !important;
  touch-action: none !important;
  user-select: none !important;
  z-index: 2 !important;  /* 确保 Fabric canvas 在最上层 */
}

.page-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  padding: 16px;
  border-radius: 8px;
  z-index: 10;
}

.loading-text {
  font-size: 14px;
  color: #666;
}

.page-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.9);
  padding: 16px;
  border-radius: 8px;
  z-index: 10;
}

.error-icon {
  font-size: 24px;
}

.error-text {
  font-size: 14px;
  color: #d32f2f;
  text-align: center;
}
</style>
