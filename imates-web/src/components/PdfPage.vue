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
import { Canvas, PencilBrush } from 'fabric'
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
    const json = fabricInstance.value.toJSON()
    const objects = json.objects || []
    
    // 更新到 Store
    store.updateAnnotations(props.layout.pageNum, objects)
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
    // 保存笔记
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
  })
  
  // 鼠标松开事件（用于整笔擦除 - 停止拖动）
  fabricInstance.value.on('mouse:up', () => {
    isErasing = false
  })
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
