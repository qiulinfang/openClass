<template>
  <!-- 内容区域和对话面板 -->
  <div class="content-layout">
    <q-splitter 
      v-model="splitterModel"
      :limits="[30, 70]"
      :disable="!pdfViewerStore.chatPanelVisible"
      :class="['full-height', { 'full-width-before': !pdfViewerStore.chatPanelVisible, 'chat-panel-visible': pdfViewerStore.chatPanelVisible }]"
    >
      <!-- PDF内容区域 -->
      <template v-slot:before>
        <div class="pdf-viewer-container">
          <!-- 工具栏 -->
          <UnifiedToolbar
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
          >
            <template #right-actions>
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
          </UnifiedToolbar>
          <!-- PDF 不分页渲染 -->
          <PdfPage
            v-if="currentFile"
            ref="pdfPageRef"
            :file="currentFile"
            @screenshot-captured="handleScreenshotCaptured"
          />

          <!-- 截图输入对话框 -->
          <ScreenshotInputDialog
            v-model="screenshotDialogVisible"
            :screenshot-data-url="screenshotDataUrl"
            @confirm="handleScreenshotConfirm"
            @cancel="handleScreenshotCancel"
          />
        </div>
      </template>

      <!-- 对话面板 -->
      <template v-slot:after v-if="pdfViewerStore.chatPanelVisible">
        <div class="chat-panel-container">
          <!-- 对话面板头部 -->
          <div class="chat-panel-header">
            <!-- Tab 切换 -->
            <div class="chat-tabs">
              <div class="tab-list">
                <div
                  v-for="tab in tabOptions"
                  :key="tab.value"
                  :class="['tab-item', { 'tab-active': activeTab === tab.value }]"
                  @click="activeTab = tab.value"
                >
                  <span>{{ tab.label }}</span>
                </div>
              </div>
            </div>
            <!-- 关闭按钮 -->
            <q-btn
              flat
              round
              dense
              icon="close"
              size="md"
              @click="handleCloseChatPanel"
              class="close-button"
            />
          </div>

          <!-- Tab 内容区域 -->
          <div class="chat-content-container">
            <!-- AI 问答 Tab -->
            <div v-show="activeTab === 'ai-chat'" class="tab-content">
              <ChatView
                ref="chatViewRef"
                type="ai-textbook"
                :compressed-height="360"
              />
            </div>
            <!-- 会话记录 Tab -->
            <div v-show="activeTab === 'question-record'" class="tab-content">
              <div class="session-list-wrapper">
                <SessionList
                  :records="sessions"
                  :selectedRecordId="selectedRecordId"
                  @record-click="handleSessionClick"
                  @record-delete="handleSessionDelete"
                  @record-pin="handleSessionPin"
                  @batch-delete="handleBatchDelete"
                  :showHeader="false"
                />
              </div>
            </div>
          </div>
        </div>
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
import { onMounted, onBeforeUnmount, computed, ref, nextTick, type ComponentPublicInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { resourceManager } from '@/services/resource-storage'
import type { UserTextbookInfo, LocalFileInfo, ChatBubble, AiTextbookSession } from '@/types'
import {
  getScreenshotSessions,
  getScreenshotSessionsByResourceId,
  addScreenshotSession,
  deleteScreenshotSession,
  batchDeleteScreenshotSessions,
  updateScreenshotSession,
} from '@/utils/storage/screenshotSessions'
import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
import PdfPage from '@/components/PdfPage.vue'
import ChatView from '@/components/ChatView.vue'
import ScreenshotInputDialog from '@/components/ScreenshotInputDialog.vue'
import SessionList from '@/components/SessionList.vue'

type PdfPagePublicInstance = ComponentPublicInstance<{
  toggleDebugPanel: () => void
  toggleNoteMode: () => void
  toggleHighlightMode: () => void
  togglePenMode: () => void
  toggleEraserMode: () => void
  undoLastStroke: () => void
  toggleGestureMode: () => void
  toggleScreenshotMode: () => void
}>

// 调试面板状态
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

// 使用 pdfViewerStore 和路由
const pdfViewerStore = usePdfViewerStore()
const route = useRoute()
const router = useRouter()

// 统一工具栏工具集合（本地变量）
// middle 区域：绘图相关工具（荧光笔、文字笔记等）
const pdfToolbarTools = {
  left: ['back'],
  middle: ['hand', 'highlighter', 'pen', 'eraser-draw', 'note', 'screenshot'],
}

// 使用 exerciseStore 来发送AI消息
const aiTextbookStore = useAiTextbookChatStore()
// 使用通用 AI 会话（用于截图输入走通用会话）
const aiGeneralStore = useAiGeneralChatStore()

// 组件状态（renderProgress 已移除，不再使用）

// 工具栏背景色
const toolbarBackgroundColor = ref('#0A0020')

// 对话面板状态
const chatPanelVisible = ref(false)
const splitterModel = ref(60) // 分隔比例（左侧占60%）

// Tab 状态
const activeTab = ref('ai-chat') // 当前激活的 tab

// Tab 选项
const tabOptions = [
  { label: '会话记录', value: 'question-record', icon: 'quiz' },
  { label: 'AI问答', value: 'ai-chat', icon: 'chat' },
]

// 会话数据（从localStorage加载）
const sessions = ref<AiTextbookSession[]>([])

// 选中的会话ID
const selectedRecordId = ref<string | undefined>(undefined)

// ChatView 实例引用，用于调用暴露的方法（如滚动到指定会话）
const chatViewRef = ref<InstanceType<typeof ChatView> | null>(null)

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getSessionId = (session: AiTextbookSession): string => {
  return session.sessionId || session.id || ''
}


// 获取当前 resourceId（仅从路由参数获取）
const getCurrentResourceId = (): string | undefined => {
  return (route.query.resourceId as string) || undefined
}

// 加载会话列表（物理上按 resourceId 查询），对齐消息存储维度
const loadSessions = async () => {
  const currentResourceId = getCurrentResourceId() || ''
  // 没有 resourceId 时，仍然加载全部（兼容旧入口）
  // 有 resourceId 时，直接在 IndexedDB 中按 resourceId 查询
  const byResource = await getScreenshotSessionsByResourceId(currentResourceId)
  sessions.value = byResource
  console.log('[会话] 加载(按 resourceId)', { currentResourceId, sessions: sessions.value })
}

// 处理会话点击
const handleSessionClick = async (record: AiTextbookSession) => {
  // 设置选中状态
  selectedRecordId.value = getSessionId(record)
  const sessionId = getSessionId(record)

  // 打开对话面板
  if (!chatPanelVisible.value) {
    chatPanelVisible.value = true
  }
  pdfViewerStore.openChatPanel()

  // 切换到 AI 问答 Tab，让容器显示出来
  activeTab.value = 'ai-chat'

  // 等待 DOM 更新，让容器高度生效后再滚动
  await nextTick()
  // 给一点额外时间让 BetterScroll 感知到容器高度变化
  chatViewRef.value?.scrollToSession(sessionId)
}

// 处理工具配置变化（颜色、粗细等），写入 pdfViewerStore.drawingConfig
const handleConfigChange = (config: {
  [key: string]: string | number | boolean | undefined
}) => {
  switch (pdfViewerStore.selectedTool) {
    case 'pen':
      if (config.color) {
        pdfViewerStore.updateDrawingConfig({ penColor: config.color as string })
      }
      if (config.size !== undefined) {
        pdfViewerStore.updateDrawingConfig({ penWidth: config.size as number })
      }
      break
    case 'highlighter':
      if (config.color) {
        pdfViewerStore.updateDrawingConfig({ highlighterColor: config.color as string })
      }
      if (config.size !== undefined) {
        pdfViewerStore.updateDrawingConfig({ highlighterWidth: config.size as number })
      }
      break
    case 'eraser-draw':
      if (config.size !== undefined) {
        pdfViewerStore.updateDrawingConfig({ eraserSize: config.size as number })
      }
      break
  }
}

// 处理会话删除
const handleSessionDelete = async (record: AiTextbookSession) => {
  const sessionId = getSessionId(record)
  const ok = await deleteScreenshotSession(sessionId)
  if (ok) {
    // 如果删除的是当前选中的会话，清除选中状态
    if (selectedRecordId.value === sessionId) {
      selectedRecordId.value = undefined
    }
    await loadSessions()
  }
}

// 处理批量删除
const handleBatchDelete = async (recordIds: string[]) => {
  const ok = await batchDeleteScreenshotSessions(recordIds)
  if (ok) {
    // 如果删除的会话中包含当前选中的会话，清除选中状态
    if (selectedRecordId.value && recordIds.includes(selectedRecordId.value)) {
      selectedRecordId.value = undefined
    }
    await loadSessions()
  }
}

// 处理置顶
const handleSessionPin = async (record: AiTextbookSession) => {
  record.pinned = !record.pinned
  const ok = await updateScreenshotSession(record)
  if (ok) {
    await loadSessions()
  }
}

// PdfPage 实例引用
const pdfPageRef = ref<PdfPagePublicInstance | null>(null)

// 当前文件
const currentFile = ref<File | null>(null)

// 当前工具（与 UnifiedToolbar 工具枚举和 PdfPage 交互模式统一）
type PdfToolId = 'hand' | 'highlighter' | 'pen' | 'eraser-draw' | 'note' | 'screenshot'
const currentTool = ref<PdfToolId>('hand')

// 处理工具切换：直接使用 UnifiedToolbar 的工具 ID 作为全局枚举
const handleToolChange = (tool: string) => {
  console.log('[工具切换] tool', tool)
  if (!pdfPageRef.value) return
  console.log(111)
  // 仅处理我们支持的绘图相关工具
  if (!['hand', 'highlighter', 'pen', 'eraser-draw', 'note', 'screenshot'].includes(tool)) {
    return
  }
  console.log(222)

  const clickedTool = tool as PdfToolId

  // 如果点击的工具已经是当前选中工具，则视为“取消选中”，切回 hand 模式
  if (pdfViewerStore.selectedTool === clickedTool && clickedTool !== 'hand') {
    const t: PdfToolId = 'hand'
    currentTool.value = t
    pdfViewerStore.selectedTool = t
    console.log('[工具切换] 再次点击相同工具，切回 hand 模式')
    pdfPageRef.value.toggleGestureMode?.()
    return
  }

  const t = clickedTool
  // 更新当前工具和 pdfViewerStore 中的选中工具，保证所有组件使用同一套枚举
  currentTool.value = t
  pdfViewerStore.selectedTool = t
  if (t === 'hand') {
    pdfPageRef.value.toggleGestureMode?.()
  } else if (t === 'highlighter') {
    pdfPageRef.value.toggleHighlightMode?.()
  } else if (t === 'pen') {
    pdfPageRef.value.togglePenMode?.()
  } else if (t === 'eraser-draw') {
    pdfPageRef.value.toggleEraserMode?.()
  } else if (t === 'note') {
    pdfPageRef.value.toggleNoteMode?.()
  } else if (t === 'screenshot') {
    pdfPageRef.value.toggleScreenshotMode?.()
  }
}

// 工具状态：使用 UnifiedToolbar 的工具 ID
const toolStates = computed(() => {
  return {
    hand: true,
    highlighter: true,
    pen: true,
    'eraser-draw': true,
    note: true,
    undo: true,
    redo: false,
  }
})

// 绑定到 UnifiedToolbar 的工具配置（颜色、粗细等），来源于 pdfViewerStore.drawingConfig
const toolbarToolConfig = computed(() => {
  return {
    color:
      pdfViewerStore.selectedTool === 'pen'
        ? pdfViewerStore.drawingConfig.penColor
        : pdfViewerStore.selectedTool === 'highlighter'
        ? pdfViewerStore.drawingConfig.highlighterColor
        : undefined,
    size:
      pdfViewerStore.selectedTool === 'pen'
        ? pdfViewerStore.drawingConfig.penWidth
        : pdfViewerStore.selectedTool === 'highlighter'
        ? pdfViewerStore.drawingConfig.highlighterWidth
        : pdfViewerStore.selectedTool === 'eraser-draw'
        ? pdfViewerStore.drawingConfig.eraserSize
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
        learningSectionName: route.query.textbookName as string,
        learningLevel: route.query.learningLevel as string,
        textbookId: route.query.id as string,
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

// 处理重做
const handleRedo = () => {
  // 绘制功能已移除，重做功能也移除
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
  pdfViewerStore.closeChatPanel() 
}

// 截图输入对话框状态
const screenshotDialogVisible = ref(false)
const screenshotDataUrl = ref('')

// 处理截图捕获事件：接收 PdfPage 截图 blob，转换为 base64，并弹出输入对话框
const handleScreenshotCaptured = async (blob: Blob) => {
  try {
    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    screenshotDataUrl.value = base64DataUrl
    screenshotDialogVisible.value = true
  } catch (error) {
    console.error('[PdfViewerView] 处理截图数据失败', error)
  }
}

// 处理截图输入对话框确认：打开对话面板并将图片+问题发送给 AI
const handleScreenshotConfirm = async (question: string, dataUrl: string) => {
  try {
    console.log('[PdfViewerView] 截图输入对话框确认', { question, dataUrl })
    chatPanelVisible.value = true
    activeTab.value = 'ai-chat'
    // 打开对话面板并切换到 AI 问答 Tab
    pdfViewerStore.openChatPanel()
    // 设置当前教材ID
    const currentResourceId = (route.query.resourceId as string) || aiTextbookStore.resourceId || ''
    if (currentResourceId) {
      aiTextbookStore.setResourceId(currentResourceId)
    }
    // 为本次截图会话生成会话ID（同时作为存储键使用）
    const now = Date.now()
    const sessionId = currentResourceId
      ? `ai-textbook-${currentResourceId}-${now}`
      : `ai-textbook-${now}`
    aiTextbookStore.currentSessionId = sessionId

    // 创建临时图片以获取宽高
    const img = new Image()
    img.src = dataUrl

    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
    })

    const fileName = `screenshot-${Date.now()}.jpg`

    const imageData = {
      filePath: fileName,
      base64DataUrl: dataUrl,
      width: img.width,
      height: img.height,
      fileSize: Math.round(dataUrl.length * 0.75),
    }
    // 仅通过 aiTextbookStore 发送一次请求，使用复用的 sessionId
    await aiTextbookStore.sendMessage(
      question,
      'mate',
      imageData,
      false,
    )

    // 发送成功后，创建并持久化一条截图会话记录，结构与截图会话模块保持一致
    console.log('[PdfViewerView] 创建会话', { sessionId })
    const newSession: AiTextbookSession = {
      sessionId,
      sessionName: question,
      createTime: now,
      updateTime: now,
      msgCount: 0,
      pinned: false,
      // 缩略图：直接使用当前截图的 base64 作为预览
      thumbnailImage: dataUrl,
      hasImage: true,
      resourceId: currentResourceId || undefined,
      // 兼容字段
      id: sessionId,
      question,
      answer: '',
    }
    addScreenshotSession(newSession)
    // 新增会话写入完成后，刷新当前会话列表，使 UI 立即显示
    loadSessions()
  } catch (error) {
    console.error('[PdfViewerView] 发送截图消息失败', error)
  } finally {
    screenshotDialogVisible.value = false
    screenshotDataUrl.value = ''
  }
}

// 处理截图输入对话框取消
const handleScreenshotCancel = () => {
  screenshotDialogVisible.value = false
  screenshotDataUrl.value = ''
}


// 生命周期
onMounted(async () => {
  try {
    // 加载 aiGeneral 会话列表
    await aiGeneralStore.loadSessions()
    // 加载 aiTextbook 会话列表
    loadSessions()
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
}

.full-height {
  height: 100%;
  width: 100%;
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
  color: #fff; /* 白色图标 */
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
  background-color: #e0e0e0;
  cursor: col-resize;
  position: relative;
  width: 0px;
  z-index: 5;
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
  z-index: 2;
}

:deep(.q-splitter__panel) {
  overflow: hidden;
}

:deep(.q-splitter__before),
:deep(.q-splitter__after) {
  overflow: hidden;
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
</style>
