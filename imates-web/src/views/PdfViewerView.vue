<template>
  <!-- 内容区域和对话面板 -->
  <div class="content-layout">
    <q-splitter 
      v-model="splitterModel"
      :limits="[30, 70]"
      :disable="!pdfViewerStore.chatPanelVisible || pdfViewerStore.selectedTool === 'screenshot'"
      :class="['full-height', { 'full-width-before': !pdfViewerStore.chatPanelVisible, 'chat-panel-visible': pdfViewerStore.chatPanelVisible, 'splitter-resizing': isSplitterResizing }]"
      @pointerdown.capture="handleSplitterPointerDown"
    >
      <!-- PDF内容区域 -->
      <template v-slot:before>
        <div class="pdf-viewer-container">
          <!-- 工具栏 -->
          <Toolbar
            :tools="pdfToolbarTools"
            variant="browser"
            :selected-tool="pdfViewerStore.selectedTool"
            :tool-states="toolStates"
            :tool-config="toolbarToolConfig"
            :backgroundColor="toolbarBackgroundColor"
            @tool-change="handleToolChange"
            @config-change="handleConfigChange"
            @back="handleGoBack"
            @search="handleSearch"
            @help="handleHelp"
            @undo="handleUndo"
            @redo="handleRedo"
          >
            <template #left-actions>
              <!-- 返回按钮 -->
              <q-btn
                flat
                round
                dense
                @click="handleGoBack"
                class="goback-btn"
              >
                <img :src="goBackIcon" alt="返回" class="goback-icon" />
              </q-btn>
            </template>
            <template #right-actions>
              <div class="direction-toggle-wrapper q-mr-sm">
                <q-btn
                  flat
                  dense
                  @click="setVerticalReading"
                  class="direction-btn"
                >
                  <img
                    :src="!isHorizontalReading ? shangxiaSelectIcon : shangxiaIcon"
                    alt="纵向阅读"
                    class="direction-icon"
                  />
                </q-btn>
                <q-btn
                  flat
                  dense
                  @click="setHorizontalReading"
                  class="direction-btn"
                >
                  <img
                    :src="isHorizontalReading ? zuoyouSelectIcon : zuoyouIcon"
                    alt="横向阅读"
                    class="direction-icon"
                  />
                </q-btn>
                <q-tooltip>{{ isHorizontalReading ? '切换为纵向滚动' : '切换为横向滚动' }}</q-tooltip>
              </div>
              <!-- 调试面板按钮 -->
              <q-btn
                v-if="isDev"
                flat
                round
                dense
                icon="bug_report"
                color="white"
                @click="handleToggleDebug"
                class="q-mr-sm"
              />
            </template>
          </Toolbar>
          <!-- PDF 不分页渲染 -->
          <PdfPage
            v-if="currentFile"
            ref="pdfPageRef"
            :file="currentFile"
            :layout-suspended="isSplitterResizing"
            @screenshot-captured="handleScreenshotCaptured"
          />

          <MiniClass v-model="showMiniClassDialog" :class-url="miniClassUrl" :question-title="miniClassQuestionTitle" />

          <q-btn
            v-if="shouldShowMiniClassFab"
            class="mini-class-fab"
            round
            unelevated
            color="primary"
            @pointerdown="onMiniClassFabPointerDown"
            @click="onMiniClassFabClick"
          >
            <q-icon name="ondemand_video" color="white" size="22px" />
            <q-tooltip>微课</q-tooltip>
          </q-btn>
        </div>
      </template>

      <!-- 对话面板 -->
      <template v-slot:after v-if="pdfViewerStore.chatPanelVisible">
        <PdfChatPanel 
          ref="chatPanelRef" 
          :attached-screenshots="aiTextbookStore.inputAttachedScreenshots"
          @close="handleCloseChatPanel"
          @screenshot-click="handleScreenshotClick"
        />
      </template>
    </q-splitter>
  </div>
</template>

<script lang="ts">
export default {
  name: 'pdfViewer',
}
</script>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref, nextTick, type ComponentPublicInstance, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore, type ScreenshotDrawingState } from '@/stores/aiTextbookChatStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { resourceManager } from '@/services/storage/resource-storage'
import { showMessage } from '@/utils'
import type { UserTextbookInfo, LocalFileInfo, ChatBubble, AiTextbookSession, AttachedScreenshot } from '@/types'
import {
  addScreenshotSession,
} from '@/utils/storage/screenshotSessions'
import Toolbar from '@/components/Toolbar.vue'
import PdfPage from '@/components/PdfPage.vue'
import PdfChatPanel from '@/components/chat/chatpanel/PdfChatPanel.vue'
import MiniClass from '@/components/MiniClass.vue'
import goBackIcon from '/icons/goback.svg'
import shangxiaSelectIcon from '/icons/shangxia_select.svg'
import shangxiaIcon from '/icons/shangxia.svg'
import zuoyouSelectIcon from '/icons/zuoyou_select.svg'
import zuoyouIcon from '/icons/zuoyou.svg'
import { useUIStore } from '@/stores/uiStore'
import { getUserId } from '@/services/http/auth-service'

type PdfPagePublicInstance = ComponentPublicInstance<{
  toggleDebugPanel: () => void
  toggleNoteMode: () => void
  toggleHighlightMode: () => void
  togglePenMode: () => void
  toggleEraserMode: () => void
  undoLastStroke: () => void
  redoLastStroke: () => void
  toggleGestureMode: () => void
  toggleScreenshotMode: () => void
  toggleSelectMode: () => void
  toggleReadingDirection: () => Promise<void> | void
  setSelectionMode: (mode: 'rectangle' | 'freeform') => void
  refreshLayout: () => void
}>

// 调试面板状态
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

// 使用 pdfViewerStore 和路由
const pdfViewerStore = usePdfViewerStore()
const route = useRoute()
const router = useRouter()

// 统一工具栏工具集合（本地变量）
// left: 返回按钮
// middle: 绘图相关工具（荧光笔、文字笔记等）
// right: 撤销、重做按钮
const pdfToolbarTools = {
  left: ['undo', 'redo'],
  middle: ['hand', 'select', 'draw', 'highlighter', 'eraser-draw', 'screenshot'],
}

// 使用 exerciseStore 来发送AI消息
const aiTextbookStore = useAiTextbookChatStore()
// 使用通用 AI 会话（用于截图输入走通用会话）
const aiGeneralStore = useAiGeneralChatStore()

const uiStore = useUIStore()
const showMiniClassDialog = computed({
  get: () => uiStore.showMiniClassDialog,
  set: (value) => {
    if (!value) {
      uiStore.closeMiniClassDialog()
    }
  },
})
const miniClassUrl = computed(() => uiStore.miniClassUrl)
const miniClassQuestionTitle = computed(() => uiStore.miniClassQuestionTitle)

const REQUIRED_CHAPTER_INFO = {
  grade: '初一',
  subject: '数学',
  textbook: '探究型公开课',
  chapter_title: '最短路径的基本原理',
} as const

const shouldShowMiniClassFab = computed(() => {
  const info = aiTextbookStore.chapterInfo
  if (!info) return false
  return (
    info.grade === REQUIRED_CHAPTER_INFO.grade &&
    info.subject === REQUIRED_CHAPTER_INFO.subject &&
    info.textbook === REQUIRED_CHAPTER_INFO.textbook &&
    info.chapter_title === REQUIRED_CHAPTER_INFO.chapter_title
  )
})

const miniClassFabPos = ref({ x: 0, y: 0 })
const isDraggingMiniClassFab = ref(false)
const miniClassFabPointerId = ref<number | null>(null)
const miniClassFabStart = ref({
  pointerX: 0,
  pointerY: 0,
  startX: 0,
  startY: 0,
})
const miniClassFabMoved = ref(false)
const lastMiniClassFabDragEndAt = ref(0)
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const onMiniClassFabPointerMove = (e: PointerEvent) => {
  if (miniClassFabPointerId.value === null || e.pointerId !== miniClassFabPointerId.value) return

  const dx = e.clientX - miniClassFabStart.value.pointerX
  const dy = e.clientY - miniClassFabStart.value.pointerY

  if (!miniClassFabMoved.value && Math.hypot(dx, dy) > 4) {
    miniClassFabMoved.value = true
  }

  isDraggingMiniClassFab.value = true

  const container = document.querySelector('.pdf-viewer-container') as HTMLElement | null
  if (!container) return
  const rect = container.getBoundingClientRect()
  const btnSize = 56

  const nextX = miniClassFabStart.value.startX + dx
  const nextY = miniClassFabStart.value.startY + dy

  miniClassFabPos.value = {
    x: clamp(nextX, 8, rect.width - btnSize - 8),
    y: clamp(nextY, 8, rect.height - btnSize - 8),
  }
}

const onMiniClassFabPointerUp = (e: PointerEvent) => {
  if (miniClassFabPointerId.value === null || e.pointerId !== miniClassFabPointerId.value) return

  try {
    window.removeEventListener('pointermove', onMiniClassFabPointerMove)
    window.removeEventListener('pointerup', onMiniClassFabPointerUp)
    window.removeEventListener('pointercancel', onMiniClassFabPointerUp)
  } catch {
  }

  miniClassFabPointerId.value = null
  isDraggingMiniClassFab.value = false
  if (miniClassFabMoved.value) {
    lastMiniClassFabDragEndAt.value = Date.now()
  }
}

const onMiniClassFabPointerDown = (e: PointerEvent) => {
  if (miniClassFabPointerId.value !== null) return
  miniClassFabPointerId.value = e.pointerId
  miniClassFabMoved.value = false

  const container = document.querySelector('.pdf-viewer-container') as HTMLElement | null
  if (!container) return
  const rect = container.getBoundingClientRect()
  const btnSize = 56

  const current = miniClassFabPos.value
  const isDefault = current.x === 0 && current.y === 0
  const defaultX = rect.width - btnSize - 16
  const defaultY = rect.height - btnSize - 16

  miniClassFabStart.value = {
    pointerX: e.clientX,
    pointerY: e.clientY,
    startX: isDefault ? defaultX : current.x,
    startY: isDefault ? defaultY : current.y,
  }

  if (isDefault) {
    miniClassFabPos.value = {
      x: clamp(defaultX, 8, rect.width - btnSize - 8),
      y: clamp(defaultY, 8, rect.height - btnSize - 8),
    }
  }

  try {
    window.addEventListener('pointermove', onMiniClassFabPointerMove)
    window.addEventListener('pointerup', onMiniClassFabPointerUp)
    window.addEventListener('pointercancel', onMiniClassFabPointerUp)
  } catch {
  }
}

const onMiniClassFabClick = () => {
  if (Date.now() - lastMiniClassFabDragEndAt.value < 200) {
    return
  }
  try {
    uiStore.openMiniClassDialog('https://www.imates.com.cn:9099/wk/math/steiner-lab-tablet.html', '微课')
  } catch {
    uiStore.openMiniClassDialog('https://www.imates.com.cn:9099/wk/math/steiner-lab-tablet.html', '微课')
  }
}

// 组件状态（renderProgress 已移除，不再使用）

// 工具栏背景色
const toolbarBackgroundColor = ref('#0A0020')

// 对话面板状态
const splitterModel = ref(60) // 分隔比例（左侧占60%）
const isSplitterResizing = ref(false)

// ChatPanel 实例引用，用于在新增截图会话后刷新列表
const chatPanelRef = ref<InstanceType<typeof PdfChatPanel> | null>(null)

const stopSplitterResize = () => {
  if (!isSplitterResizing.value) return
  isSplitterResizing.value = false
  document.body.classList.remove('pdf-splitter-resizing')
  requestAnimationFrame(() => {
    pdfPageRef.value?.refreshLayout?.()
  })
}

const handleSplitterPointerDown = (e: PointerEvent) => {
  if (!pdfViewerStore.chatPanelVisible) return
  const target = e.target as HTMLElement | null
  if (!target?.closest('.q-splitter__separator')) return

  isSplitterResizing.value = true
  document.body.classList.add('pdf-splitter-resizing')
}

const handleGlobalPointerUp = () => {
  stopSplitterResize()
}

watch(
  () => pdfViewerStore.chatPanelVisible,
  (visible) => {
    if (!visible) {
      stopSplitterResize()
    }
  }
)

// 处理工具配置变化（颜色、粗细等），写入 pdfViewerStore.drawingConfig
const handleConfigChange = (config: {
  [key: string]: string | number | boolean | undefined
}) => {
  switch (pdfViewerStore.selectedTool) {
    case 'select':
      if (config.selectMode) {
        const mode = config.selectMode as 'rectangle' | 'freeform'
        pdfPageRef.value?.setSelectionMode?.(mode)
      }
      break
    case 'draw':
      if (config.color) {
        pdfViewerStore.updateDrawingConfig({ penColor: config.color as string })
      }
      if (config.size !== undefined) {
        pdfViewerStore.updateDrawingConfig({ penWidth: config.size as number })
      }
      if (config.opacity !== undefined) {
        pdfViewerStore.updateDrawingConfig({ penOpacity: config.opacity as number })
      }
      break
    case 'highlighter':
      if (config.color) {
        pdfViewerStore.updateDrawingConfig({ highlighterColor: config.color as string })
      }
      if (config.size !== undefined) {
        pdfViewerStore.updateDrawingConfig({ highlighterWidth: config.size as number })
      }
      if (config.opacity !== undefined) {
        pdfViewerStore.updateDrawingConfig({ highlighterOpacity: config.opacity as number })
      }
      break
    case 'eraser-draw':
      if (config.size !== undefined) {
        pdfViewerStore.updateDrawingConfig({ eraserSize: config.size as number })
      }
      break
    case 'screenshot':
      if (config.shape) {
        pdfViewerStore.updateDrawingConfig({ screenshotShape: config.shape as string })
      }
      break
  }
}

// PdfPage 实例引用
const pdfPageRef = ref<PdfPagePublicInstance | null>(null)

const isHorizontalReading = ref(false)

const handleToggleReadingDirection = async () => {
  try {
    isHorizontalReading.value = !isHorizontalReading.value
    await (pdfPageRef.value as any)?.toggleReadingDirection?.()
  } catch (e) {
    console.error('[PdfViewerView] toggleReadingDirection failed:', e)
  }
}

const setVerticalReading = async () => {
  if (!isHorizontalReading.value) return
  try {
    isHorizontalReading.value = false
    await (pdfPageRef.value as any)?.toggleReadingDirection?.()
  } catch (e) {
    console.error('[PdfViewerView] setVerticalReading failed:', e)
  }
}

const setHorizontalReading = async () => {
  if (isHorizontalReading.value) return
  try {
    isHorizontalReading.value = true
    await (pdfPageRef.value as any)?.toggleReadingDirection?.()
  } catch (e) {
    console.error('[PdfViewerView] setHorizontalReading failed:', e)
  }
}

// 当前文件
const currentFile = ref<File | null>(null)

// 当前工具（与 Toolbar 工具枚举和 PdfPage 交互模式统一）
type PdfToolId = 'hand' | 'select' | 'highlighter' | 'draw' | 'eraser-draw' | 'note' | 'screenshot'
const currentTool = ref<PdfToolId>('hand')

// 处理工具切换：直接使用 Toolbar 的工具 ID 作为全局枚举
const handleToolChange = (tool: string) => {
  if (!pdfPageRef.value) return
  // 仅处理我们支持的绘图相关工具
  // 兼容历史工具 ID：Toolbar 仍可能发出 draw，等价于 draw
  const normalizedTool = tool === 'draw' ? 'draw' : tool
  if (!['hand', 'select', 'highlighter', 'draw', 'eraser-draw', 'note', 'screenshot'].includes(normalizedTool)) {
    return
  }

  const clickedTool = normalizedTool as PdfToolId

  // 如果点击的工具已经是当前选中工具，则视为“取消选中”，切回 hand 模式
  if (pdfViewerStore.selectedTool === clickedTool && clickedTool !== 'hand') {
    const t: PdfToolId = 'hand'
    currentTool.value = t
    pdfViewerStore.selectedTool = t
    pdfPageRef.value.toggleGestureMode?.()
    return
  }

  const t = clickedTool
  // 更新当前工具和 pdfViewerStore 中的选中工具，保证所有组件使用同一套枚举
  currentTool.value = t
  pdfViewerStore.selectedTool = t
  if (t === 'hand') {
    pdfPageRef.value.toggleGestureMode?.()
  } else if (t === 'select') {
    pdfPageRef.value.toggleSelectMode?.()
  } else if (t === 'highlighter') {
    pdfPageRef.value.toggleHighlightMode?.()
  } else if (t === 'draw') {
    pdfPageRef.value.togglePenMode?.()
  } else if (t === 'eraser-draw') {
    pdfPageRef.value.toggleEraserMode?.()
  } else if (t === 'note') {
    pdfPageRef.value.toggleNoteMode?.()
  } else if (t === 'screenshot') {
    pdfPageRef.value.toggleScreenshotMode?.()
  }
}

// 工具状态：使用 Toolbar 的工具 ID
const toolStates = computed(() => {
  return {
    hand: true,
    select: true,
    highlighter: true,
    draw: true,
    'eraser-draw': true,
    note: true,
    undo: true,
    redo: true,
  }
})

// 绑定到 Toolbar 的工具配置（颜色、粗细等），来源于 pdfViewerStore.drawingConfig
const toolbarToolConfig = computed(() => {
  return {
    color:
      pdfViewerStore.selectedTool === 'draw'
        ? pdfViewerStore.drawingConfig.penColor
        : pdfViewerStore.selectedTool === 'highlighter'
        ? pdfViewerStore.drawingConfig.highlighterColor
        : pdfViewerStore.drawingConfig.penColor, // 默认显示笔颜色，未选中时也能高亮默认色
    size:
      pdfViewerStore.selectedTool === 'draw'
        ? pdfViewerStore.drawingConfig.penWidth
        : pdfViewerStore.selectedTool === 'highlighter'
        ? pdfViewerStore.drawingConfig.highlighterWidth
        : pdfViewerStore.selectedTool === 'eraser-draw'
        ? pdfViewerStore.drawingConfig.eraserSize
        : undefined,
    opacity:
      pdfViewerStore.selectedTool === 'draw'
        ? pdfViewerStore.drawingConfig.penOpacity
        : pdfViewerStore.selectedTool === 'highlighter'
        ? pdfViewerStore.drawingConfig.highlighterOpacity
        : undefined,
  }
})


// 处理返回
const handleGoBack = () => {
  // 检查是否从学习页面跳转（通过检查路由参数中是否有 fromLearning）
  const fromLearning = route.query.fromLearning === 'true'

  if (fromLearning) {
    // 从学习页面跳转来的，返回到知识图谱页面，并传递学习对话框所需的信息
    router.push({
      name: 'knowledgeGraph',
      query: {
        // 传递学习对话框所需的信息，用于自动打开对话框
        openLearning: 'true',
        learningNodeId: route.query.learningNodeId as string,
        learningSectionName: (route.query.sectionName as string) || (route.query.textbookName as string),
        learningLevel: route.query.learningLevel as string,
        textbookId: route.query.id as string,
        // ✅ 修复：添加章节信息传递，确保返回后微课按钮能正常显示
        learningChapterGrade: route.query.chapterGrade as string,
        learningChapterSubject: route.query.chapterSubject as string,
        learningChapterTextbook: route.query.chapterTextbook as string,
        learningChapterTitle: route.query.chapterTitle as string,
      },
    })
  } else {
    // 其他情况，使用默认的返回行为
    router.back()
  }
}



// 处理搜索
const handleSearch = () => {
  // TODO: 实现搜索功能
  console.log('搜索操作')
}

// 处理帮助
const handleHelp = () => {
  // TODO: 实现帮助功能
  console.log('帮助操作')
  // 可以显示帮助对话框或跳转到帮助页面
}

// 顶部工具栏：切换调试面板
const handleToggleDebug = () => {
  pdfPageRef.value?.toggleDebugPanel()
}

// 顶部工具栏：切换笔记模式
const handleToggleNoteMode = () => {
  pdfPageRef.value?.toggleNoteMode()
}

// 处理撤销：调用 PdfPage 暴露的撤销方法
const handleUndo = () => {
  pdfPageRef.value?.undoLastStroke()
}

// 处理重做：调用 PdfPage 暴露的重做方法
const handleRedo = () => {
  pdfPageRef.value?.redoLastStroke()
}

const handleOpenMiniClass = () => {
  try {
    uiStore.openMiniClassDialog('https://www.imates.com.cn:9099/demo/demo1.html', '微课')
  } catch (error) {
    console.error('[PdfViewerView] 打开微课失败', error)
    showMessage('打开微课失败', 'error')
  }
}

// 从路由参数加载文件
const loadFileFromRoute = async () => {
  try {
    // 从路由 query 参数获取文件信息（LearningView 传递的是 query 参数）
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    console.log('从路由加载文件:', { resourceId, id })

    if (!resourceId || !id) {
      throw new Error('缺少必要的路由参数: resourceId 和 id')
    }

    console.log('从路由加载文件:', { resourceId, id })

    // 1. 根据 id 从 IndexedDB 获取教材信息（使用主键查询）
    const textbook = (await resourceManager.indexedDB.get('textbooks', id)) as UserTextbookInfo
    if (!textbook) {
      throw new Error(`教材 ${id} 不存在`)
    }

    console.log('找到教材:', textbook)

    // 2. 在教材的 localFiles 中查找对应的文件元数据
    let fileData: Uint8Array | null = null
    let fileName = 'unknown.pdf'

    if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
      const localFile = textbook.localFiles.find((file: LocalFileInfo) => file.id === resourceId)
      if (localFile) {
        fileName = localFile.fileName || fileName
        // 从textbook_files表按需读取文件数据
        fileData = await resourceManager.getFileData(id, resourceId)
        if (fileData) {
          console.log('找到本地文件:', { fileName, fileSize: fileData.length })
        }
      }
    }

    // 3. 如果没有找到本地文件，提示用户先下载
    if (!fileData) {
      console.log('本地文件不存在，需要先下载')
      // 流程：格式化资源路径（确保以/开头）
      const downloadUrl = resourceId.startsWith('/') ? resourceId : `/${resourceId}`
      if (downloadUrl) {
        // 这里可以实现下载逻辑，暂时抛出错误提示用户
        throw new Error('文件未下载到本地，请先在资源管理页面下载该文件')
      } else {
        throw new Error('无法获取文件下载链接')
      }
    }

    // 4. 将 Uint8Array 转换为 File 对象
    const file = new File([fileData.buffer as ArrayBuffer], fileName, { type: 'application/pdf' })

    console.log('文件加载成功:', { fileName, size: file.size })
    return file
  } catch (err) {
    console.error('从路由加载文件失败:', err)
    throw err
  }
}

// 加载PDF文件（设置文件，由 PdfPage 组件内部处理加载）
const loadPdfWithService = async (file: File) => {
  try {
    // 1. 设置当前文件信息到Store
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    if (resourceId && id) {
      pdfViewerStore.setCurrentFileInfo(id, resourceId)
      // 同时设置到 aiTextbookStore，确保会话列表能正确过滤
      aiTextbookStore.setResourceId(resourceId)
    }

    const currentSectionName = (route.query.sectionName as string) || (route.query.textbookName as string) || null
    aiTextbookStore.setSectionName(currentSectionName)

    const chapterInfo = {
      grade: (route.query.chapterGrade as string) || '',
      subject: (route.query.chapterSubject as string) || '',
      textbook: (route.query.chapterTextbook as string) || '',
      chapter_title: (route.query.chapterTitle as string) || '',
    }
    aiTextbookStore.setChapterInfo(
      chapterInfo.grade || chapterInfo.subject || chapterInfo.textbook || chapterInfo.chapter_title
        ? chapterInfo
        : null,
    )

    // 2. 设置当前文件，PdfPage 组件会自动加载
    currentFile.value = file

    console.log('PDF 文件设置完成:', {
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (error) {
    console.error('PDF 文件设置失败:', error)
  }
}

// 处理对话面板关闭
const handleCloseChatPanel = () => {
  if (pdfViewerStore.selectedTool === 'screenshot') {
    handleToolChange('hand')
  }
  pdfViewerStore.closeChatPanel()
}

// 最多允许挂载的截图数量（与 ScreenshotInputDialog 保持一致）
const MAX_SCREENSHOTS = 3

// 处理截图捕获事件：接收 PdfPage 截图 blob，转换为 base64，并弹出输入对话框
const handleScreenshotCaptured = async (blob: Blob) => {
  try {
    // 1. 检查截图数量限制（最多3张）
    const currentCount = aiTextbookStore.inputAttachedScreenshots?.length ?? 0
    if (currentCount >= MAX_SCREENSHOTS) {
      showMessage(`最多只能添加 ${MAX_SCREENSHOTS} 张截图`, 'warning')
      // 退出截图模式
      pdfViewerStore.selectedTool = 'hand' as any
      return
    }

    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    const shotId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const shot: AttachedScreenshot = {
      id: shotId,
      dataUrl: base64DataUrl, // 缩略图
      originalDataUrl: base64DataUrl, // 原图（新截图原图和缩略图相同）
      width: 0,
      height: 0,
    }

    // 单一数据源：立即写入 store（此时 ChatInput 缩略图会立刻出现）
    aiTextbookStore.appendInputAttachedScreenshots([shot])
    aiTextbookStore.setInputScreenshotDrawingStates({
      ...aiTextbookStore.inputScreenshotDrawingStates,
      [shotId]: aiTextbookStore.inputScreenshotDrawingStates[shotId] || { objects: [], history: [], historyIndex: -1 },
    } as any)

    // 打开编辑弹窗并定位到新图（弹窗由 ChatView 维护）
    chatPanelRef.value?.openTextbookScreenshotEditor?.({ shotId, lastCapturedShotId: shotId })
    
    // 截图完成后自动退出截图模式，切换回 hand 模式
    console.log('[PdfViewerView] 截图完成，自动切换回 hand 模式')
    handleToolChange('hand')
  } catch (error) {
    console.error('[PdfViewerView] 处理截图数据失败', error)
  }
}

// 处理统一的截图工具点击事件
const handleScreenshotClick = (enable: boolean) => {
  console.log('[PdfViewerView] 截图工具切换:', enable)
  if (enable) {
    // 开启截图模式
    if (pdfViewerStore.selectedTool !== 'screenshot') {
      handleToolChange('screenshot')
    }
  } else {
    // 关闭截图模式
    if (pdfViewerStore.selectedTool === 'screenshot') {
      handleToolChange('hand')
    }
  }
}

// 生命周期
onMounted(async () => {
  try {
    window.addEventListener('pointerup', handleGlobalPointerUp)
    window.addEventListener('pointercancel', handleGlobalPointerUp)
    // 加载 aiGeneral 会话列表
    await aiGeneralStore.loadSessions()
    const file = await loadFileFromRoute()
    await loadPdfWithService(file)
    // 加载当前教材的聊天历史
    const currentResourceId = (route.query.resourceId as string) || aiTextbookStore.resourceId || ''
    if (currentResourceId) {
      aiTextbookStore.setResourceId(currentResourceId)
      await aiTextbookStore.loadChatHistory(currentResourceId)
    }
  } catch (err) {
    console.error('PDF 加载失败:', err)
  }
})

// 页面卸载前清理
onBeforeUnmount(() => {
  window.removeEventListener('pointerup', handleGlobalPointerUp)
  window.removeEventListener('pointercancel', handleGlobalPointerUp)
  document.body.classList.remove('pdf-splitter-resizing')
  stopSplitterResize()
  // 退出 PDF 页面时清空当前工具，避免影响其它页面
  pdfViewerStore.selectedTool = '' as any
  pdfViewerStore.closeChatPanel()
})
</script>

<style scoped>
.content-layout {
  flex: 1;
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 0;
}

.full-height {
  height: 100%;
  width: 100%;
}

.mini-class-fab {
  position: absolute;
  left: 16px;
  bottom: 50%;
  z-index: 5;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  touch-action: none;
  user-select: none;
}


:deep(.q-splitter),
:deep(.q-splitter__container),
:deep(.q-splitter__panel) {
  height: 100%;
  min-height: 0;
}

:deep(.q-splitter__before),
:deep(.q-splitter__after) {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 右侧对话面板容器（after 面板）：左侧圆角 + 柔和紫色阴影 */
:deep(.q-splitter__after) {
  border-top-left-radius: 16px;
  border-bottom-left-radius: 16px;
  /* 模拟截图中的竖向紫色阴影：略向左扩散，柔和过渡 */
  box-shadow: 0px 4px 10px 0px rgba(30, 0, 120, 0.32);
  z-index: 2;
}

.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #e8e9ff;
}

/* 聊天面板头部 */
.chat-panel-header {
  background: #e8e9ff; /* 红色背景 */
  padding-top: 10px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

/* 移除 .chat-tabs 容器，因为 header 现在是 flex 容器 */

/* Tab 列表 */
.tab-list {
  display: flex;
  gap: 2px; /* Tab 之间的间距 */
}

/* 每个 Tab 项 */
.tab-item {
  position: relative;
  padding: 8px 18px;
  color: #a19cb6; /* 白色文字 */
  text-decoration: none;
  font-size: 15px;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  background: transparent; /* 默认透明背景 */
  border-radius: 0; /* 移除圆角 */
  box-shadow: none; /* 移除阴影 */
  width: 100px;
}

/* 激活的 Tab 项 */
.tab-active {
  /* 使用 sessionbackgroung.png 作为激活状态背景 */
  background-image: url('/icons/sessionbackfround.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: center center;
  color: #504b64;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  height: 40px; /* 保持原有高度 */
  line-height: 24px; /* 让文字在背景中垂直居中 */
  width: 100px;
}

/* 激活 Tab 底部下划线 */
.tab-active::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 30%;
  height: 3px;
  background: #6E55FF; /* 亮紫色下划线 */
  border-radius: 2px;
}

/* Tab 项的 hover 效果 */
.tab-item:hover:not(.tab-active) {
  opacity: 0.85;
  background: transparent; /* 确保 hover 时背景不变 */
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548; /* 白色图标 */
  z-index: 1; /* 确保在前景 */
}

.chat-content-container {
  flex: 1;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  border-radius: 20px;
}

.session-list-wrapper {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.pdf-viewer-container {
  width: 100%;
  position: relative;
  background-color: #0A0020;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* PDF页面容器 - 支持横向和纵向滚动 */
.pdf-pages-container {
  height: 100%;
  width: 100%;
  /* 支持横向滚动 */
  overflow-x: auto;
  overflow-y: auto;
  /* 确保滚动条样式美观 */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) rgba(0, 0, 0, 0.1);
  /* 当内容宽度超过容器时，允许横向滚动 */
  min-width: 100%;
  /* 确保内容不会被压缩 */
  width: max-content;
}

/* Webkit浏览器的滚动条样式 */
.pdf-pages-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.pdf-pages-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
}

.pdf-pages-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.pdf-pages-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.pdf-page-item {
  display: flex;
  justify-content: flex-start;
  padding: 10px;
  /* 确保页面项不会被压缩，允许横向溢出 */
  min-width: fit-content;
  width: 100%;
  /* 防止flex压缩 */
  flex-shrink: 0;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.error-state {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}

.empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 300px;
}


/* 当聊天面板隐藏时，让before插槽占据整个宽度 */
.full-width-before :deep(.q-splitter__before) {
  width: 100% !important;
}

:deep(.q-splitter__separator) {
  background-color: transparent;
  cursor: col-resize;
  position: relative;
  width: 24px;
  margin-left: -12px;
  margin-right: -12px;
  z-index: 5;
  will-change: left, right;
}
:deep(.q-splitter__after) {
  overflow: visible !important;
}

.splitter-resizing :deep(.q-splitter__before),
.splitter-resizing :deep(.q-splitter__after) {
  transition: none !important;
}

.splitter-resizing :deep(.q-splitter__separator) {
  transition: none !important;
}

/* 在右侧面板上绘制 seekbar 效果 */
:deep(.q-splitter__after)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 10px;
  height: 100%;
  pointer-events: none;
  transform: translateX(-5px);
  background-image: url('/icons/seekbar.svg');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: contain;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .pdf-page-item {
    padding: 5px 0;
  }

  .loading-state,
  .error-state {
    margin: 16px;
    max-width: calc(100% - 32px);
  }

  .tab-item {
    padding: 10px 12px;
    font-size: 13px;
    min-width: 60px;
  }

  .tab-item span {
    display: none;
    /* 移动端只显示图标 */
  }

  .tab-list {
    padding: 2px;
  }
}

/* 返回按钮样式 */
.goback-btn {
  padding: 8px;
}

.goback-icon {
  width: 24px;
  height: 24px;
  display: block;
}

/* 阅读方向切换按钮组 */
.direction-toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.direction-btn {
  padding: 4px;
  border-radius: 4px;
  transition: transform 0.2s ease;
}

.direction-btn:active {
  transform: scale(0.9);
}

.direction-icon {
  width: 24px;
  height: 24px;
  display: block;
  transition: opacity 0.2s ease, transform 0.2s ease;
  animation: iconSwitch 0.3s ease;
}

@keyframes iconSwitch {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
