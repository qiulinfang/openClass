<template>
    <div class="simple-pdf-viewer">
      <!-- 顶部工具栏 -->
      <div class="toolbar">
        <q-btn
          flat
          round
          icon="arrow_back"
          @click="handleGoBack"
          class="back-btn"
        />
        <div class="toolbar-title">{{ fileName }}</div>
        <div class="toolbar-spacer"></div>
        <!-- 缩放控制 -->
        <div class="zoom-controls">
            <q-btn
              flat
              dense
              icon="remove"
              size="sm"
              @click="handleZoomOut"
              :disable="scale <= 0.5"
              title="缩小"
            />
            <div class="zoom-percentage">{{ scalePercentage }}%</div>
            <q-btn
              flat
              dense
              icon="add"
              size="sm"
              @click="handleZoomIn"
              :disable="scale >= 3.0"
              title="放大"
            />
        </div>
      </div>

      <!-- 笔记工具栏 -->
      <UnifiedToolbar
        variant="browser"
        :tools="{
          left: ['back', 'undo', 'redo'],
          middle: ['pen', 'highlighter', 'eraser', 'screenshot', 'select'],
          right: [],
        }"
        :selected-tool="store.selectedTool"
        :tool-config="currentToolConfig"
        :tool-states="toolStates"
        @tool-change="handleToolChange"
        @config-change="handleConfigChange"
        @undo="handleUndo"
        @redo="handleRedo"
        @back="handleGoBack"
      />
  
      <!-- PDF 内容区域 -->
      <div 
        class="pdf-container" 
        ref="pdfContainer"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-state">
          <q-spinner color="primary" size="50px" />
          <div class="loading-text">正在加载PDF...</div>
        </div>
  
        <!-- 错误状态 -->
        <div v-else-if="error" class="error-state">
          <q-icon name="error_outline" size="80px" color="negative" />
          <div class="error-text">{{ error }}</div>
          <q-btn
            color="primary"
            label="重试"
            @click="retryLoad"
            class="q-mt-md"
          />
        </div>
  
        <!-- PDF 内容 -->
        <div v-else-if="pdf" class="pdf-content">
          <div
            v-for="pageNum in totalPages"
            :key="pageNum"
            class="pdf-page-wrapper"
            :ref="el => setPageRef(el, pageNum)"
          >
            <!-- PDF 渲染层 -->
            <div class="pdf-layer-wrapper">
            <VuePDF
              :pdf="pdf"
              :page="pageNum"
                :scale="scale"
              text-layer
              annotation-layer
              class="pdf-page"
              @loaded="onPageLoaded"
              @error="onPageError"
            />
            </div>
            <!-- Konva 笔记层 -->
            <div
              v-if="!store.hideNotes"
              :ref="el => setKonvaRef(el, pageNum)"
              class="konva-container"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script lang="ts">
  export default {
    name: 'NewPdfView'
  }
  </script>
  
  <script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, type ComponentPublicInstance } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { VuePDF, usePDF } from '@tato30/vue-pdf'
  import '@tato30/vue-pdf/style.css'
  import { resourceManager } from '@/services/resource-storage'
  import type { UserTextbookInfo, LocalFileInfo } from '@/types'
  import { usePdfViewerStore } from '@/stores/pdfViewerStore'
  import { KonvaCanvasService, type DrawObject, type DrawingConfig } from '@/services/pdf/konva/KonvaCanvasService'
  import { IndexedDBService } from '@/services/indexeddb-service'
  import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
  
  const route = useRoute()
  const router = useRouter()
  
  // 使用 Store
  const store = usePdfViewerStore()
  
  // 响应式状态
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const fileName = ref('')
  const scale = ref(1.0)
  const totalPages = ref(0)
  const loadedPages = ref(0)
  const pdfContainer = ref<HTMLElement | null>(null)
  
  // 当前文件信息
  const currentTextbookId = ref<string>('')
  const currentResourceId = ref<string>('')
  
  // Konva 服务实例（每页一个）
  const konvaServices = ref<Map<number, KonvaCanvasService>>(new Map())
  
  // 页面和 Konva 容器的引用
  const pageRefs = ref<Map<number, HTMLElement>>(new Map())
  const konvaRefs = ref<Map<number, HTMLElement>>(new Map())
  
  // 撤销/重做历史记录（每页独立）
  const pageHistories = ref<Map<number, DrawObject[][]>>(new Map())
  const pageHistoryIndices = ref<Map<number, number>>(new Map())
  const maxHistorySize = 20
  
  // 触摸手势相关状态
  const touchState = ref<{
    initialDistance: number | null
    initialScale: number
    touches: TouchList | null
    isTwoFinger: boolean
  }>({
    initialDistance: null,
    initialScale: 1.0,
    touches: null,
    isTwoFinger: false,
  })
  
  // 性能优化：使用 requestAnimationFrame 节流更新
  let rafId: number | null = null
  let pendingScale: number | null = null
  
  // 缓存 PDF 数据
  const cachedPdfData = ref<ArrayBuffer | null>(null)
  
  // PDF 数据源（使用 computed，让 usePDF 可以响应式更新）
  const pdfSource = computed(() => {
    if (cachedPdfData.value) {
      return {
        data: cachedPdfData.value,
        cMapUrl: '/cmaps/',
        cMapPacked: true,
      }
    }
    return null
  })
  
  // 使用 VuePDF 的 usePDF
  const { pdf } = usePDF(pdfSource)
  
  // 计算属性
  const scalePercentage = computed(() => Math.round(scale.value * 100))
  
  // 当前工具配置
  const currentToolConfig = computed(() => {
    return {
      color: store.selectedTool === 'pen' ? store.drawingConfig.penColor 
           : store.selectedTool === 'highlighter' ? store.drawingConfig.highlighterColor 
           : undefined,
      size: store.selectedTool === 'pen' ? store.drawingConfig.penWidth
          : store.selectedTool === 'highlighter' ? store.drawingConfig.highlighterWidth
          : store.selectedTool === 'eraser' ? store.drawingConfig.eraserSize
          : undefined,
      handwritingStyle: store.selectedTool === 'pen' ? store.drawingConfig.penHandwritingStyle : undefined,
      shape: store.selectedTool === 'screenshot' ? store.drawingConfig.screenshotShape : undefined,
      selectMode: store.selectedTool === 'select' ? store.drawingConfig.selectMode : undefined,
    }
  })
  
  // 工具状态
  const toolStates = computed(() => {
    // 这里可以根据需要返回工具状态，比如撤销/重做是否可用
    return {}
  })
  
  // 从路由参数加载文件
  const loadFileFromRoute = async () => {
    try {
      isLoading.value = true
      error.value = null
  
      // 从路由 query 参数获取文件信息
      const resourceId = route.query.resourceId as string
      const id = route.query.id as string
  
      if (!resourceId || !id) {
        throw new Error('缺少必要的路由参数: resourceId 和 id')
      }
  
      // 1. 根据 id 从 IndexedDB 获取教材信息
      const textbook = (await resourceManager.indexedDB.get(
        'textbooks',
        id,
      )) as UserTextbookInfo
  
      if (!textbook) {
        throw new Error(`教材 ${id} 不存在`)
      }
  
      // 2. 在教材的 localFiles 中查找对应的文件元数据
      let fileData: Uint8Array | null = null
      let file = 'unknown.pdf'
  
      if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
        const localFile = textbook.localFiles.find(
          (file: LocalFileInfo) => file.id === resourceId,
        )
        if (localFile) {
          file = localFile.fileName || file
          // 从textbook_files表按需读取文件数据
          fileData = await resourceManager.getFileData(id, resourceId)
        }
      }
  
      // 3. 如果没有找到本地文件，提示用户先下载
      if (!fileData) {
        throw new Error('文件未下载到本地，请先在资源管理页面下载该文件')
      }
  
      // 4. 设置文件名和文件ID
      fileName.value = file
      currentTextbookId.value = id
      currentResourceId.value = resourceId
  
      // 5. 缓存 PDF 数据（使用 slice 创建副本，避免被 PDF.js 转移）
      try {
        cachedPdfData.value = (fileData.buffer as ArrayBuffer).slice(0)
      } catch {
        // 如果 slice 失败，使用 Uint8Array 创建副本
        const uint8Array = new Uint8Array(fileData)
        const copiedUint8Array = new Uint8Array(uint8Array.length)
        copiedUint8Array.set(uint8Array)
        cachedPdfData.value = copiedUint8Array.buffer
      }
      
      // 6. 加载笔记数据
      await loadAnnotationsFromDB()
    } catch (err) {
      console.error('从路由加载文件失败:', err)
      error.value = err instanceof Error ? err.message : '加载文件失败'
      isLoading.value = false
    }
  }
  
  // 设置页面引用
  const setPageRef = (el: HTMLElement | Element | ComponentPublicInstance | null, pageNum: number) => {
    if (el && el instanceof HTMLElement) {
      pageRefs.value.set(pageNum, el)
      // 页面加载后初始化 Konva
      nextTick(() => {
        initKonvaForPage(pageNum)
      })
    }
  }
  
  // 设置 Konva 容器引用
  const setKonvaRef = (el: HTMLElement | Element | ComponentPublicInstance | null, pageNum: number) => {
    if (el && el instanceof HTMLElement) {
      konvaRefs.value.set(pageNum, el)
    }
  }
  
  // 初始化指定页面的 Konva
  const initKonvaForPage = async (pageNum: number) => {
    const konvaContainer = konvaRefs.value.get(pageNum)
    if (!konvaContainer || !pdf.value) return
    
    // 如果已经初始化过，跳过
    if (konvaServices.value.has(pageNum)) return
    
    try {
      await nextTick()
      
      // 获取 PDF 页面的尺寸
      const pdfDoc = 'promise' in pdf.value ? await pdf.value.promise : pdf.value
      if (!('getPage' in pdfDoc)) return
      
      const page = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale: scale.value })
      
      const canvasWidth = viewport.width
      const canvasHeight = viewport.height
      
      // 创建 Konva 配置
      const drawingConfig: DrawingConfig = {
        penColor: store.drawingConfig.penColor,
        penWidth: store.drawingConfig.penWidth,
        penHandwritingStyle: store.drawingConfig.penHandwritingStyle,
        highlighterColor: store.drawingConfig.highlighterColor,
        highlighterWidth: store.drawingConfig.highlighterWidth,
        highlighterOpacity: store.drawingConfig.highlighterOpacity,
        eraserSize: store.drawingConfig.eraserSize,
        eraserMode: store.drawingConfig.eraserMode as 'stroke' | 'pixel' | undefined,
        screenshotShape: store.drawingConfig.screenshotShape as 'rectangle' | 'polygon' | undefined,
        screenshotStrokeColor: store.drawingConfig.screenshotStrokeColor,
        screenshotFillColor: store.drawingConfig.screenshotFillColor,
        screenshotStrokeWidth: store.drawingConfig.screenshotStrokeWidth,
        selectMode: store.drawingConfig.selectMode as 'rectangle' | 'freeform' | undefined,
      }
      
      // 创建 Konva 服务实例
      const konvaService = new KonvaCanvasService(drawingConfig, {
        onDataChange: () => {
          // 保存状态到历史记录
          saveStateForPage(pageNum)
          // 保存到 Store 和 IndexedDB
          saveAnnotationsForPage(pageNum)
        },
        onScreenshotCaptured: (blob) => {
          // 处理截图
          handleScreenshotCaptured(blob)
        },
      })
      
      // 初始化 Konva Stage
      konvaService.init(konvaContainer, canvasWidth, canvasHeight, scale.value)
      
      // 设置当前工具
      konvaService.setTool(store.selectedTool)
      
      // 保存服务实例
      konvaServices.value.set(pageNum, konvaService)
      
      // 加载现有笔记
      await loadAnnotationsForPage(pageNum)
      
      // 初始化历史记录
      saveStateForPage(pageNum)
    } catch (err) {
      console.error(`第 ${pageNum} 页 Konva 初始化失败:`, err)
    }
  }
  
  // 加载所有页面的笔记数据
  const loadAnnotationsFromDB = async () => {
    if (!currentTextbookId.value || !currentResourceId.value) return
    
    try {
      const textbook = (await resourceManager.indexedDB.get(
        'textbooks',
        currentTextbookId.value,
      )) as UserTextbookInfo
      
      if (!textbook || !textbook.localFiles) return
      
      const localFile = textbook.localFiles.find(
        (file: LocalFileInfo) => file.id === currentResourceId.value,
      )
      
      if (localFile && localFile.annotations) {
        // 更新 Store 中的笔记数据
        Object.keys(localFile.annotations).forEach((pageNumStr) => {
          const pageNum = parseInt(pageNumStr, 10)
          const annotations = (localFile.annotations?.[pageNum] || []) as object[]
          store.updateAnnotations(pageNum, annotations)
        })
      }
    } catch (err) {
      console.error('加载笔记数据失败:', err)
    }
  }
  
  // 加载指定页面的笔记
  const loadAnnotationsForPage = async (pageNum: number) => {
    const konvaService = konvaServices.value.get(pageNum)
    if (!konvaService) return
    
    try {
      // 从 store 获取注释
      const pageAnnotations = store.allAnnotations[pageNum] || []
      
      // 转换为 DrawObject 格式
      const drawObjects: DrawObject[] = pageAnnotations.map((obj: unknown) => {
        return obj as DrawObject
      })
      
      // 加载到 Konva
      konvaService.load(drawObjects, scale.value)
    } catch (err) {
      console.error(`第 ${pageNum} 页加载笔记失败:`, err)
    }
  }
  
  // 保存指定页面的笔记
  const saveAnnotationsForPage = async (pageNum: number) => {
    const konvaService = konvaServices.value.get(pageNum)
    if (!konvaService || !currentTextbookId.value || !currentResourceId.value) return
    
    try {
      // 序列化 Konva 对象为 DrawObject（标准化坐标）
      const normalizedObjects = konvaService.serialize(scale.value)
      
      // 深度序列化（移除 Vue 响应式代理）
      const serializedObjects = IndexedDBService.deepSerialize(normalizedObjects)
      
      // 更新 Store
      store.updateAnnotations(pageNum, serializedObjects as object[])
      
      // 触发防抖保存
      store.debouncedSave()
    } catch (err) {
      console.error(`第 ${pageNum} 页保存笔记失败:`, err)
    }
  }
  
  // 保存状态到历史记录
  const saveStateForPage = (pageNum: number) => {
    const konvaService = konvaServices.value.get(pageNum)
    if (!konvaService) return
    
    const currentState = konvaService.serialize(scale.value)
    
    // 获取或创建历史记录
    let history = pageHistories.value.get(pageNum) || [[]]
    let historyIndex = pageHistoryIndices.value.get(pageNum) || 0
    
    // 如果不在历史记录末尾，删除后面的记录
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1)
    }
    
    // 保存当前状态
    history.push(JSON.parse(JSON.stringify(currentState)))
    historyIndex = history.length - 1
    
    // 限制历史记录数量
    if (history.length > maxHistorySize) {
      history.shift()
      historyIndex--
    }
    
    pageHistories.value.set(pageNum, history)
    pageHistoryIndices.value.set(pageNum, historyIndex)
  }
  
  // 处理截图
  const handleScreenshotCaptured = (blob: Blob) => {
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `screenshot-${Date.now()}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // 工具切换
  const handleToolChange = (tool: string) => {
    store.setSelectedTool(tool)
    // 更新所有页面的工具
    konvaServices.value.forEach((service) => {
      service.setTool(tool)
    })
  }
  
  // 配置变更
  const handleConfigChange = (config: Record<string, unknown>) => {
    store.updateDrawingConfig(config)
    // 更新所有页面的配置
    const drawingConfig: DrawingConfig = {
      penColor: store.drawingConfig.penColor,
      penWidth: store.drawingConfig.penWidth,
      penHandwritingStyle: store.drawingConfig.penHandwritingStyle,
      highlighterColor: store.drawingConfig.highlighterColor,
      highlighterWidth: store.drawingConfig.highlighterWidth,
      highlighterOpacity: store.drawingConfig.highlighterOpacity,
      eraserSize: store.drawingConfig.eraserSize,
      eraserMode: store.drawingConfig.eraserMode as 'stroke' | 'pixel' | undefined,
      screenshotShape: store.drawingConfig.screenshotShape as 'rectangle' | 'polygon' | undefined,
      screenshotStrokeColor: store.drawingConfig.screenshotStrokeColor,
      screenshotFillColor: store.drawingConfig.screenshotFillColor,
      screenshotStrokeWidth: store.drawingConfig.screenshotStrokeWidth,
      selectMode: store.drawingConfig.selectMode as 'rectangle' | 'freeform' | undefined,
    }
    konvaServices.value.forEach((service) => {
      service.updateConfig(drawingConfig)
    })
  }
  
  // 撤销
  const handleUndo = () => {
    // 找到最近修改的页面（这里简化处理，撤销当前可见的第一页）
    const firstPageNum = 1
    const history = pageHistories.value.get(firstPageNum)
    const historyIndex = pageHistoryIndices.value.get(firstPageNum) || 0
    
    if (!history || historyIndex <= 0) return
    
    const newIndex = historyIndex - 1
    const previousState = JSON.parse(JSON.stringify(history[newIndex]))
    
    const konvaService = konvaServices.value.get(firstPageNum)
    if (konvaService) {
      konvaService.load(previousState, scale.value)
      pageHistoryIndices.value.set(firstPageNum, newIndex)
      saveAnnotationsForPage(firstPageNum)
    }
  }
  
  // 重做
  const handleRedo = () => {
    const firstPageNum = 1
    const history = pageHistories.value.get(firstPageNum)
    const historyIndex = pageHistoryIndices.value.get(firstPageNum) || 0
    
    if (!history || historyIndex >= history.length - 1) return
    
    const newIndex = historyIndex + 1
    const nextState = JSON.parse(JSON.stringify(history[newIndex]))
    
    const konvaService = konvaServices.value.get(firstPageNum)
    if (konvaService) {
      konvaService.load(nextState, scale.value)
      pageHistoryIndices.value.set(firstPageNum, newIndex)
      saveAnnotationsForPage(firstPageNum)
    }
  }
  
  // 监听 PDF 加载完成
  const onPageLoaded = () => {
    loadedPages.value++
    // 如果所有页面都加载完成，更新加载状态
    if (totalPages.value > 0 && loadedPages.value >= totalPages.value) {
      isLoading.value = false
    }
  }
  
  // 监听 PDF 加载错误
  const onPageError = (err: Error) => {
    console.error('PDF 页面加载错误:', err)
    error.value = 'PDF 页面加载失败'
    isLoading.value = false
  }
  
  // 计算两点之间的距离
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch2.clientX - touch1.clientX
    const dy = touch2.clientY - touch1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  // 触摸开始
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指触摸，开始缩放
      const distance = getDistance(e.touches[0], e.touches[1])
      touchState.value = {
        initialDistance: distance,
        initialScale: scale.value,
        touches: e.touches,
        isTwoFinger: true,
      }
      // 阻止默认行为（如页面滚动），只在双指触摸时阻止
      e.preventDefault()
      // 禁用所有 Konva 层的交互
      konvaServices.value.forEach((service) => {
        service.setListening(false)
      })
    } else if (e.touches.length === 1) {
      // 单指触摸，恢复 Konva 层交互
      touchState.value.isTwoFinger = false
      konvaServices.value.forEach((service) => {
        service.setListening(true)
      })
    }
  }
  
  // 使用 requestAnimationFrame 更新缩放值，避免频繁重绘
  const updateScale = () => {
    if (pendingScale !== null) {
      // 保存当前待处理的值
      const currentScale = pendingScale
      pendingScale = null
      rafId = null
      
      // 更新缩放值
      scale.value = currentScale
      
      // 检查在更新过程中是否有新的触摸事件产生新的待处理值
      // 如果有，继续调度下一次更新，确保快速缩放时能够连续更新
      if (pendingScale !== null && touchState.value.initialDistance !== null) {
        rafId = requestAnimationFrame(updateScale)
      }
    } else {
      rafId = null
    }
  }
  
  // 触摸移动
  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && touchState.value.initialDistance !== null) {
      // 计算当前双指距离
      const currentDistance = getDistance(e.touches[0], e.touches[1])
      
      // 计算缩放比例
      const scaleRatio = currentDistance / touchState.value.initialDistance
      const newScale = touchState.value.initialScale * scaleRatio
      
      // 限制缩放范围在 0.5 到 3.0 之间
      const clampedScale = Math.max(0.5, Math.min(3.0, newScale))
      
      // 使用 requestAnimationFrame 节流更新，避免频繁重绘
      pendingScale = clampedScale
      if (rafId === null) {
        rafId = requestAnimationFrame(updateScale)
      }
      
      // 阻止默认行为，防止页面滚动
      e.preventDefault()
      // 确保 Konva 层不响应
      touchState.value.isTwoFinger = true
      konvaServices.value.forEach((service) => {
        service.setListening(false)
      })
    } else if (e.touches.length === 1 && touchState.value.initialDistance !== null) {
      // 如果从双指变为单指，重置状态，允许单指滚动和绘制
      touchState.value = {
        initialDistance: null,
        initialScale: 1.0,
        touches: null,
        isTwoFinger: false,
      }
      // 恢复 Konva 层交互
      konvaServices.value.forEach((service) => {
        service.setListening(true)
      })
      // 取消待处理的更新
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      pendingScale = null
    }
  }
  
  // 触摸结束
  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      // 确保最后的缩放值被应用
      if (pendingScale !== null && rafId === null) {
        scale.value = pendingScale
        pendingScale = null
      }
      
      // 重置触摸状态
      touchState.value = {
        initialDistance: null,
        initialScale: 1.0,
        touches: null,
        isTwoFinger: false,
      }
      
      // 恢复 Konva 层交互
      konvaServices.value.forEach((service) => {
        service.setListening(true)
      })
    }
  }
  
  // 缩放控制
  const handleZoomIn = () => {
    if (scale.value < 3.0) {
      scale.value = Math.min(3.0, scale.value + 0.25)
    }
  }
  
  const handleZoomOut = () => {
    if (scale.value > 0.5) {
      scale.value = Math.max(0.5, scale.value - 0.25)
    }
  }
  
  // 返回上一页
  const handleGoBack = () => {
    // 如果是从学习页面跳转过来的，返回时重新打开学习对话框
    if (route.query.fromLearning === 'true') {
      router.push({
        name: 'learning',
        query: {
          nodeId: route.query.learningNodeId as string,
          sectionName: route.query.textbookName as string,
          textbookId: route.query.id as string,
          level: route.query.learningLevel as string,
        },
      })
    } else {
      // 否则返回上一页
      router.back()
    }
  }
  
  // 重试加载
  const retryLoad = async () => {
    loadedPages.value = 0
    await loadFileFromRoute()
  }
  
  // 监听 PDF 对象变化，获取总页数
  watch(
    pdf,
    async (newPdf) => {
      if (newPdf) {
        try {
          // usePDF 返回的可能是 PDFDocumentLoadingTask，需要等待 promise
          const pdfDoc = 'promise' in newPdf ? await newPdf.promise : newPdf
          // 检查是否有 numPages 属性
          if ('numPages' in pdfDoc && typeof pdfDoc.numPages === 'number') {
            totalPages.value = pdfDoc.numPages
            // PDF 加载完成后，重置加载状态
            if (pdfDoc.numPages > 0) {
              isLoading.value = false
              // 初始化所有页面的 Konva
              await nextTick()
              for (let i = 1; i <= pdfDoc.numPages; i++) {
                await initKonvaForPage(i)
              }
            }
          }
        } catch (err) {
          console.error('获取 PDF 总页数失败:', err)
        }
      }
    },
    { immediate: true },
  )
  
  // 监听缩放变化，更新所有 Konva Stage
  watch(scale, (newScale) => {
    konvaServices.value.forEach((service, pageNum) => {
      // 获取 PDF 页面尺寸
      if (pdf.value) {
        nextTick(async () => {
          try {
            const pdfDoc = 'promise' in pdf.value! ? await pdf.value!.promise : pdf.value!
            if ('getPage' in pdfDoc) {
              const page = await pdfDoc.getPage(pageNum)
              const viewport = page.getViewport({ scale: newScale })
              service.updateSize(viewport.width, viewport.height, newScale)
            }
          } catch (err) {
            console.error(`更新第 ${pageNum} 页尺寸失败:`, err)
          }
        })
      }
    })
  })
  
  // 监听工具配置变化
  watch(
    () => store.drawingConfig,
    (newConfig) => {
      const drawingConfig: DrawingConfig = {
        penColor: newConfig.penColor,
        penWidth: newConfig.penWidth,
        penHandwritingStyle: newConfig.penHandwritingStyle,
        highlighterColor: newConfig.highlighterColor,
        highlighterWidth: newConfig.highlighterWidth,
        highlighterOpacity: newConfig.highlighterOpacity,
        eraserSize: newConfig.eraserSize,
        eraserMode: newConfig.eraserMode as 'stroke' | 'pixel' | undefined,
        screenshotShape: newConfig.screenshotShape as 'rectangle' | 'polygon' | undefined,
        screenshotStrokeColor: newConfig.screenshotStrokeColor,
        screenshotFillColor: newConfig.screenshotFillColor,
        screenshotStrokeWidth: newConfig.screenshotStrokeWidth,
        selectMode: newConfig.selectMode as 'rectangle' | 'freeform' | undefined,
      }
      konvaServices.value.forEach((service) => {
        service.updateConfig(drawingConfig)
      })
    },
    { deep: true },
  )
  
  // 监听工具切换
  watch(
    () => store.selectedTool,
    (newTool) => {
      konvaServices.value.forEach((service) => {
        service.setTool(newTool)
      })
    },
  )
  
  // 生命周期
  onMounted(async () => {
    await loadFileFromRoute()
  })
  
  onBeforeUnmount(() => {
    // 清理资源
    cachedPdfData.value = null
    // 清理所有 Konva 服务
    konvaServices.value.forEach((service) => {
      // Konva 服务没有显式的销毁方法，但可以清理引用
    })
    konvaServices.value.clear()
    // 确保保存所有笔记
    store.flushSave()
  })
  </script>
  
  <style lang="scss" scoped>
  .simple-pdf-viewer {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: #f5f5f5;
    overflow: hidden;
  }
  
  .toolbar {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background-color: #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 10;
  
    .back-btn {
      margin-right: 16px;
    }
  
    .toolbar-title {
      flex: 1;
      font-size: 16px;
      font-weight: 500;
      color: #212121;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  
    .toolbar-spacer {
      flex: 1;
    }
  
    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 16px;
  
      .zoom-percentage {
        min-width: 50px;
        text-align: center;
        font-size: 14px;
        color: #757575;
      }
    }
  }
  
  .pdf-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;
    background-color: #525252;
    // 改善触摸体验
    touch-action: pan-y pinch-zoom;
    -webkit-overflow-scrolling: touch;
  }
  
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 400px;
  
    .loading-text,
    .error-text {
      margin-top: 16px;
      font-size: 16px;
      color: #757575;
    }
  
    .error-text {
      color: #d32f2f;
      text-align: center;
      max-width: 500px;
    }
  }
  
  .pdf-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    max-width: 100%;
    // 性能优化：提示浏览器优化缩放动画
    will-change: transform;
  }
  
  .pdf-page-wrapper {
    position: relative;
    background-color: #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    margin: 0 auto;
    // 性能优化：启用 GPU 加速
    transform: translateZ(0);
    will-change: transform;
  }
  
  .pdf-layer-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
  
  .pdf-page {
    display: block;
    width: 100%;
    height: auto;
    // 性能优化：启用 GPU 加速
    transform: translateZ(0);
  }
  
  .konva-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    user-select: none;
    pointer-events: auto;
    z-index: 2;
  }
  
  // VuePDF 样式覆盖
  :deep(.vue-pdf) {
    canvas {
      display: block;
      width: 100% !important;
      height: auto !important;
    }
  }
  </style>