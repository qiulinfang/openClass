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
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { FabricCanvasServiceEnhanced } from '@/services/pdf/core/FabricCanvasServiceEnhanced'
import { PdfStateAdapterVue } from '@/services/pdf/adapters/vue/PdfStateAdapterVue'
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

// 使用 Store 和适配器
const store = usePdfViewerStore()
const stateAdapter = new PdfStateAdapterVue()

// 组件状态
const pdfCanvas = ref<HTMLCanvasElement>()
const fabricWrapper = ref<HTMLCanvasElement>()
const fabricService = ref<FabricCanvasServiceEnhanced | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

// 双指滑动状态
const touchState = ref({
  isTwoFinger: false,
  startY: 0,
  lastY: 0,
  fabricWasDrawing: false
})

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
  pointerEvents: 'none' as const
}))

// Fabric.js 容器样式
const fabricWrapperStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  userSelect: 'none' as const,
  width: '100%',
  height: '100%',
  pointerEvents: 'auto' as const,
  zIndex: 2
}))

// 初始化 PDF 页面
const initPdfPage = async () => {
  if (!store.pdfDoc || !pdfCanvas.value) {
    return
  }
  
  try {
    isLoading.value = true
    error.value = null
    
    // 使用PdfCoreService渲染页面（传入store中的pdfDoc）
    // 注意：这里需要确保pdfCoreService能够使用store中的pdfDoc
    // 如果pdfCoreService需要自己的实例，可以从store获取
    const rawPdfDoc = toRaw(store.pdfDoc)
    const page = await rawPdfDoc.getPage(props.layout.pageNum)
    const rawPage = toRaw(page)
    
    const viewport = rawPage.getViewport({ scale: store.scale })
    
    const canvas = pdfCanvas.value
    const context = canvas.getContext('2d')
    if (!context) return
    
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
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
    
    // 创建FabricCanvasServiceEnhanced实例
    const drawingConfig = stateAdapter.getDrawingConfig()
    const service = new FabricCanvasServiceEnhanced(drawingConfig)
    
    // 初始化服务
    await service.initialize(
      fabricWrapper.value,
      pdfCanvas.value,
      canvasWidth,
      canvasHeight,
      props.layout.pageNum,
      {
        onAnnotationChanged: (annotations) => {
          // 保存注释到Store
          const cleanObjects = annotations.map(a => a.content)
          const serializedObjects = IndexedDBService.deepSerialize(cleanObjects) as object[]
          store.updateAnnotations(props.layout.pageNum, serializedObjects)
        },
        onScreenshotCaptured: (blob) => {
          emit('screenshot-captured', blob)
        },
      }
    )
    
    fabricService.value = service
    
    // 设置当前工具模式
    const selectedTool = stateAdapter.getSelectedTool()
    service.setToolMode(selectedTool)
    
    // 加载现有笔记
    await loadAnnotations()
    
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页 Fabric Canvas 初始化失败:`, err)
    error.value = err instanceof Error ? err.message : '初始化失败'
  }
}

// 加载笔记
const loadAnnotations = async () => {
  if (!fabricService.value) return
  
  try {
    // 从store获取注释（store中的格式是object[]）
    const pageAnnotations = store.allAnnotations[props.layout.pageNum] || []
    
    if (pageAnnotations.length > 0) {
      // 将store中的对象数组转换为AnnotationData格式
      const annotationData = pageAnnotations.map((obj, index) => ({
        id: `annotation-${props.layout.pageNum}-${index}`,
        type: 'fabric',
        content: obj,
        pageNum: props.layout.pageNum,
      }))
      
      // 使用FabricCanvasServiceEnhanced的loadAnnotations方法
      fabricService.value.loadAnnotations(annotationData)
    }
  } catch (err) {
    console.error(`第 ${props.layout.pageNum} 页加载笔记失败:`, err)
  }
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
  if (touches.length !== 2) return 0
  const touch1 = touches[0]
  const touch2 = touches[1]
  return (touch1.clientY + touch2.clientY) / 2
}

// 获取滚动容器
const getScrollContainer = (): HTMLElement | null => {
  let parent = pdfCanvas.value?.parentElement
  
  while (parent) {
    if (parent.classList.contains('q-virtual-scroll')) {
      const scrollContent = parent.querySelector('.q-virtual-scroll__content')
      if (scrollContent?.parentElement) {
        return scrollContent.parentElement as HTMLElement
      }
      return parent
    }
    
    const overflowY = window.getComputedStyle(parent).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent
    }
    
    parent = parent.parentElement
  }
  
  return document.documentElement
}

// 触摸开始事件处理
const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length === 2) {
    touchState.value.isTwoFinger = true
    touchState.value.startY = getTwoFingerCenterY(event.touches)
    touchState.value.lastY = touchState.value.startY
    
    // 禁用 Fabric 的绘图模式
    if (fabricService.value) {
      const fabricCanvas = fabricService.value.getFabricCanvas()
      if (fabricCanvas) {
        touchState.value.fabricWasDrawing = fabricCanvas.isDrawingMode
        fabricCanvas.isDrawingMode = false
        fabricCanvas.selection = false
      }
    }
  } else {
    touchState.value.isTwoFinger = false
  }
}

// 触摸移动事件处理
const handleTouchMove = (event: TouchEvent) => {
  if (!touchState.value.isTwoFinger || event.touches.length !== 2) {
    return
  }
  
  event.preventDefault()
  
  const currentY = getTwoFingerCenterY(event.touches)
  const deltaY = currentY - touchState.value.lastY
  
  const scrollContainer = getScrollContainer()
  if (scrollContainer) {
    scrollContainer.scrollTop -= deltaY
  }
  
  touchState.value.lastY = currentY
}

// 触摸结束事件处理
const handleTouchEnd = (event: TouchEvent) => {
  if (touchState.value.isTwoFinger) {
    if (event.touches.length < 2) {
      touchState.value.isTwoFinger = false
      
      // 恢复 Fabric 的绘图模式
      if (fabricService.value && touchState.value.fabricWasDrawing) {
        const fabricCanvas = fabricService.value.getFabricCanvas()
        if (fabricCanvas) {
          fabricCanvas.isDrawingMode = touchState.value.fabricWasDrawing
          const selectedTool = stateAdapter.getSelectedTool()
          fabricService.value.setToolMode(selectedTool)
        }
      }
    }
  }
}

// 鼠标滚轮事件处理
const handleWheel = (event: WheelEvent) => {
  event.preventDefault()
  
  const scrollContainer = getScrollContainer()
  if (!scrollContainer) return
  
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
  if (fabricService.value) {
    const annotations = fabricService.value.getAnnotations()
    const cleanObjects = annotations.map(a => a.content)
    const serializedObjects = IndexedDBService.deepSerialize(cleanObjects) as object[]
    store.updateAnnotations(props.layout.pageNum, serializedObjects)
  }
  
  // 立即保存到 IndexedDB（不使用防抖）
  await store.flushSave()
  
  // 销毁 Fabric Service
  if (fabricService.value) {
    fabricService.value.dispose()
    fabricService.value = null
  }
})

// 监听工具变化
watch(() => store.selectedTool, () => {
  if (fabricService.value) {
    const tool = stateAdapter.getSelectedTool()
    fabricService.value.setToolMode(tool)
  }
})

// 监听绘制配置变化
watch(() => store.drawingConfig, () => {
  if (fabricService.value) {
    const config = stateAdapter.getDrawingConfig()
    fabricService.value.updateConfig(config)
    
    // 重新设置工具模式以应用新配置
    const tool = stateAdapter.getSelectedTool()
    fabricService.value.setToolMode(tool)
  }
}, { deep: true })

// 监听缩放变化
watch(() => store.scale, async () => {
  // 重新渲染 PDF
  await initPdfPage()
  
  // 重新初始化 Fabric Canvas
  if (fabricService.value) {
    fabricService.value.dispose()
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
  z-index: 2 !important;
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
