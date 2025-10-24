<template>
  <div class="pdf-page pdf-page-item" :style="pageStyle">
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
import { Canvas, PencilBrush, IText } from 'fabric'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'

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

// 使用 Store
const store = usePdfViewerStore()

// 组件状态
const pdfCanvas = ref<HTMLCanvasElement>()
const fabricWrapper = ref<HTMLCanvasElement>()
const fabricInstance = ref<Canvas | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

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
    
    console.log(`第 ${props.layout.pageNum} 页 PDF 渲染完成`)
    
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
    
    console.log(`第 ${props.layout.pageNum} 页初始化Fabric Canvas，尺寸: ${canvasWidth}x${canvasHeight}`)
    
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
    
    console.log(`第 ${props.layout.pageNum} 页 Fabric Canvas 初始化完成，尺寸: ${canvasWidth}x${canvasHeight}`)
    
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页 Fabric Canvas 初始化失败:`, err)
  }
}

// 更新 Fabric 模式
const updateFabricMode = () => {
  console.log('🎨 [PdfPage] 更新 Fabric 模式:', store.selectedTool)
  if (!fabricInstance.value) {
    console.warn('🎨 [PdfPage] Fabric实例不存在，无法更新模式')
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
      fabricInstance.value.freeDrawingBrush.color = store.drawingConfig.highlighterColor
      fabricInstance.value.freeDrawingBrush.width = store.drawingConfig.highlighterWidth
      break
      
    case 'pen':
      fabricInstance.value.isDrawingMode = true
      fabricInstance.value.freeDrawingBrush = new PencilBrush(fabricInstance.value as unknown as Canvas)
      fabricInstance.value.freeDrawingBrush.color = store.drawingConfig.penColor
      fabricInstance.value.freeDrawingBrush.width = store.drawingConfig.penWidth
      break
      
    case 'eraser':
      fabricInstance.value.isDrawingMode = true
      fabricInstance.value.freeDrawingBrush = new PencilBrush(fabricInstance.value as unknown as Canvas)
      fabricInstance.value.freeDrawingBrush.color = 'transparent'
      fabricInstance.value.freeDrawingBrush.width = store.drawingConfig.eraserSize
      break
      
    case 'text':
      // 文本模式：点击添加文本框
      fabricInstance.value.isDrawingMode = false
      fabricInstance.value.selection = true
      break
      
    default:
      // 选择模式
      fabricInstance.value.isDrawingMode = false
      fabricInstance.value.selection = true
      console.log('🎨 [PdfPage] 选择模式激活')
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
      console.log(`第 ${props.layout.pageNum} 页加载了 ${annotations.length} 个笔记`)
    }
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页加载笔记失败:`, err)
  }
}

// 保存笔记
const saveAnnotations = () => {
  console.log('🎨 [PdfPage] 保存笔记')
  if (!fabricInstance.value) return
  
  try {
    const json = fabricInstance.value.toJSON()
    const objects = json.objects || []
    
    // 更新到 Store
    store.updateAnnotations(props.layout.pageNum, objects)
    
    console.log(`第 ${props.layout.pageNum} 页保存了 ${objects.length} 个笔记`)
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页保存笔记失败:`, err)
  }
}

// 设置 Fabric 事件监听
const setupFabricEvents = () => {
  if (!fabricInstance.value) return
  
  console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页设置Fabric事件监听`)
  
  // 对象修改事件
  fabricInstance.value.on('object:modified', () => {
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页对象被修改`)
    saveAnnotations()
  })
  
  // 对象添加事件
  fabricInstance.value.on('object:added', () => {
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页对象被添加`)
    saveAnnotations()
  })
  
  // 对象删除事件
  fabricInstance.value.on('object:removed', () => {
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页对象被删除`)
    saveAnnotations()
  })
  
  // 路径创建事件（绘制完成）
  fabricInstance.value.on('path:created', () => {
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页路径被创建`)
    saveAnnotations()
  })
  
  // 文本编辑事件
  fabricInstance.value.on('text:changed', () => {
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页文本被修改`)
    saveAnnotations()
  })
  
  // 鼠标按下事件
  fabricInstance.value.on('mouse:down', (event) => {
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页鼠标按下:`, event.pointer)
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页点击目标:`, event.target)
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页当前工具:`, store.selectedTool)
    
    const tool = store.selectedTool
    
    // 对于形状工具和文本工具，直接创建对象（不检查target）
    if (['text', 'rectangle', 'circle', 'line', 'arrow', 'triangle'].includes(tool)) {
      console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页创建 ${tool} 对象`)
      
      switch (tool) {
        case 'text':
          addTextObject(event.pointer)
          break
        case 'rectangle':
          addRectangle(event.pointer)
          break
        case 'circle':
          addCircle(event.pointer)
          break
        case 'line':
          addLine(event.pointer)
          break
        case 'arrow':
          addArrow(event.pointer)
          break
        case 'triangle':
          addTriangle(event.pointer)
          break
      }
    } else {
      console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页工具 ${tool} 不需要点击创建对象`)
    }
  })
  
  // 鼠标移动事件（用于调试）
  fabricInstance.value.on('mouse:move', (event) => {
    // 只在绘制模式下记录，避免日志过多
    if (fabricInstance.value?.isDrawingMode) {
      console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页鼠标移动:`, event.pointer)
    }
  })
  
  // 绘制开始事件
  fabricInstance.value.on('path:created', (event) => {
    console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页开始绘制:`, event.path)
  })
}

// 添加文本对象
const addTextObject = (pointer: { x: number; y: number }) => {
  if (!fabricInstance.value) return
  
  const text = new IText('点击编辑文本', {
    left: pointer.x,
    top: pointer.y,
    fontFamily: 'Arial',
    fontSize: store.drawingConfig.textSize,
    fill: store.drawingConfig.textColor
  })
  
  fabricInstance.value.add(text)
  fabricInstance.value.setActiveObject(text)
  text.enterEditing()
}

// 添加矩形
const addRectangle = (pointer: { x: number; y: number }) => {
  if (!fabricInstance.value) return
  
  const rect = new Rect({
    left: pointer.x,
    top: pointer.y,
    width: 100,
    height: 60,
    fill: 'transparent',
    stroke: store.drawingConfig.shapeColor,
    strokeWidth: store.drawingConfig.shapeStrokeWidth
  })
  
  fabricInstance.value.add(rect)
  fabricInstance.value.setActiveObject(rect)
  console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页添加矩形`)
}

// 添加圆形
const addCircle = (pointer: { x: number; y: number }) => {
  if (!fabricInstance.value) return
  
  const circle = new Circle({
    left: pointer.x,
    top: pointer.y,
    radius: 50,
    fill: 'transparent',
    stroke: store.drawingConfig.shapeColor,
    strokeWidth: store.drawingConfig.shapeStrokeWidth
  })
  
  fabricInstance.value.add(circle)
  fabricInstance.value.setActiveObject(circle)
  console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页添加圆形`)
}

// 添加直线
const addLine = (pointer: { x: number; y: number }) => {
  if (!fabricInstance.value) return
  
  const line = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
    stroke: store.drawingConfig.shapeColor,
    strokeWidth: store.drawingConfig.shapeStrokeWidth
  })
  
  fabricInstance.value.add(line)
  fabricInstance.value.setActiveObject(line)
  console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页添加直线`)
}

// 添加三角形
const addTriangle = (pointer: { x: number; y: number }) => {
  if (!fabricInstance.value) return
  
  const triangle = new Triangle({
    left: pointer.x,
    top: pointer.y,
    width: 80,
    height: 80,
    fill: 'transparent',
    stroke: store.drawingConfig.shapeColor,
    strokeWidth: store.drawingConfig.shapeStrokeWidth
  })
  
  fabricInstance.value.add(triangle)
  fabricInstance.value.setActiveObject(triangle)
  console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页添加三角形`)
}

// 添加箭头（使用Line实现）
const addArrow = (pointer: { x: number; y: number }) => {
  if (!fabricInstance.value) return
  
  // 创建箭头线条
  const line = new Line([pointer.x, pointer.y, pointer.x + 100, pointer.y], {
    stroke: store.drawingConfig.shapeColor,
    strokeWidth: store.drawingConfig.shapeStrokeWidth
  })
  
  fabricInstance.value.add(line)
  fabricInstance.value.setActiveObject(line)
  console.log(`🎨 [PdfPage] 第${props.layout.pageNum}页添加箭头`)
}

// 重试加载
const retryLoad = async () => {
  await initPdfPage()
  if (!error.value) {
    await initFabricCanvas()
  }
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

onUnmounted(() => {
  // 保存最终状态
  saveAnnotations()
  
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
