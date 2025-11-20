<template>
  <!-- 内容区域和对话面板 -->
  <div class="content-layout">
    <q-splitter 
      v-model="splitterModel"
      :limits="[30, 70]"
      :disable="!chatPanelVisible"
      :class="['full-height', { 'full-width-before': !chatPanelVisible, 'chat-panel-visible': chatPanelVisible }]"
    >
      <!-- PDF内容区域 -->
      <template v-slot:before>
        <div class="pdf-viewer-container">
          <!-- 工具栏 -->
          <UnifiedToolbar
            :tools="pdfToolbarTools"
            variant="browser"
            :selected-tool="store.selectedTool"
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
              <q-btn
                flat
                round
                dense
                icon="chat"
                color="white"
                @click="chatPanelVisible = !chatPanelVisible"
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
        </div>
      </template>

      <!-- 对话面板 -->
      <template v-slot:after v-if="chatPanelVisible">
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
              size="sm"
              @click="handleCloseChatPanel"
              class="close-button"
            />
          </div>

          <!-- Tab 内容区域 -->
          <div class="chat-content-container">
            <!-- AI 问答 Tab -->
            <div v-if="activeTab === 'ai-chat'" class="tab-content">
              <ChatView
                type="ai-textbook"
                :attached-screenshot="pendingScreenshot"
                @remove-screenshot="handleRemoveScreenshot"
                @send-with-screenshot="handleSendWithScreenshot"
                @response="handleChatResponse"
                @focus="handleChatFocus"
                @scroll-to-bottom="handleScrollToBottom"
                :compressed-height="360"
              />
            </div>

            <!-- 会话记录 Tab -->
            <div v-if="activeTab === 'question-record'" class="tab-content">
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
import { resourceManager } from '@/services/resource-storage'
import type { UserTextbookInfo, LocalFileInfo, ChatBubble, AiTextbookSession } from '@/types'
import {
  getScreenshotSessions,
  addScreenshotSession,
  deleteScreenshotSession,
  batchDeleteScreenshotSessions,
  updateScreenshotSession,
} from '@/utils/storage/screenshotSessions'
import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
import PdfPage from '@/components/PdfPage.vue'
import ChatView from '@/components/ChatView.vue'
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

// 使用 Store 和路由
const store = usePdfViewerStore()
const route = useRoute()
const router = useRouter()

// 绘制功能已移除，不再需要页面组件引用管理

// 统一工具栏工具集合（本地变量）
// middle 区域：绘图相关工具（荧光笔、文字笔记等）
const pdfToolbarTools = {
  left: ['back'],
  middle: ['hand', 'highlighter', 'pen', 'eraser-draw', 'note', 'screenshot'],
}


// 使用 exerciseStore 来发送AI消息
const aiTextbookStore = useAiTextbookChatStore()

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

// 挂起的截图信息：供 ChatView 输入区域展示与发送
const pendingScreenshot = ref<
  | {
      dataUrl: string
      width: number
      height: number
      fileName: string
      fileSize: number
    }
  | undefined
>(undefined)

// 选中的会话ID
const selectedRecordId = ref<string | undefined>(undefined)

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getSessionId = (session: AiTextbookSession): string => {
  return session.sessionId || session.id || ''
}


// 获取当前 resourceId（仅从路由参数获取）
const getCurrentResourceId = (): string | undefined => {
  return (route.query.resourceId as string) || undefined
}

// 加载会话列表（按 resourceId 过滤），对齐 PdfViewerView111 的截图会话逻辑
const loadSessions = () => {
  const currentResourceId = getCurrentResourceId()
  const allSessions = getScreenshotSessions()

  // 如果没有 resourceId，显示所有会话（兼容旧数据）
  if (!currentResourceId) {
    sessions.value = allSessions
    return
  }

  // 过滤出匹配当前 resourceId 的会话
  sessions.value = allSessions.filter((record) => {
    // 优先使用 record.resourceId
    if (record.resourceId) {
      return record.resourceId === currentResourceId
    }

    // 如果没有 resourceId，尝试从 storageKey 中提取
    if (record.storageKey) {
      const match = record.storageKey.match(/^ai-textbook-(.+?)(?:-|$)/)
      if (match && match[1]) {
        return match[1] === currentResourceId
      }
    }

    // 如果都没有，不显示（避免显示其他资源的会话）
    return false
  })
}

// 处理会话点击
const handleSessionClick = async (record: AiTextbookSession) => {
  // 设置选中状态
  selectedRecordId.value = getSessionId(record)
  
  // 打开对话面板（如果未打开）
  if (!chatPanelVisible.value) {
    chatPanelVisible.value = true
  }
  
  // 加载会话详情
  await loadSessionDetail(record)
}

// 加载会话详情
const loadSessionDetail = async (record: AiTextbookSession) => {
  try {
    let targetResourceId = record.resourceId
    if (!targetResourceId && record.storageKey) {
      // 从 storageKey 中提取 resourceId（格式：ai-textbook-${resourceId} 或 ai-textbook-${resourceId}-${sessionId}）
      const match = record.storageKey.match(/^ai-textbook-(.+?)(?:-|$)/)
      if (match && match[1]) {
        targetResourceId = match[1]
      }
    }
    
    // 步骤2：设置 resourceId（如果存在）
    if (targetResourceId) {
      aiTextbookStore.setResourceId(targetResourceId)
    }
    
    // 步骤3：尝试从存储中加载消息历史
    let hasStorageHistory = false
    
    if (targetResourceId) {
      try {
        // 优先使用 record.storageKey（如果存在且是完整格式），否则构建包含 sessionId 的存储键
        let storageKey: string
        if (record.storageKey && record.storageKey.startsWith('ai-textbook-')) {
          // 如果 storageKey 是完整格式（可能包含 sessionId），直接使用
          storageKey = record.storageKey
        } else if (getSessionId(record)) {
          // 使用 sessionId 构建包含 sessionId 的存储键
          storageKey = `ai-textbook-${targetResourceId}-${getSessionId(record)}`
        } else {
          // 降级方案：使用旧的格式（向后兼容）
          storageKey = `ai-textbook-${targetResourceId}`
        }
        
        // 直接调用 loadChatHistory，它会内部处理存储加载
        await aiTextbookStore.loadChatHistory(storageKey, getSessionId(record))
        
        // 检查是否成功加载了消息历史
        hasStorageHistory = aiTextbookStore.messages.length > 0
        
        if (hasStorageHistory) {
          // 如果会话包含图片消息，标记使用截图接口
          if (record.hasImage) {
            aiTextbookStore.useScreenshotApi = true
          }
          console.log('[会话详情] 从存储加载消息', {
            resourceId: targetResourceId,
            sessionId: getSessionId(record),
            storageKey: storageKey,
            messageCount: aiTextbookStore.messages.length,
            hasImage: record.hasImage
          })
        } else {
          console.log('[会话详情] 存储中无消息', {
            resourceId: targetResourceId,
            sessionId: getSessionId(record),
            storageKey: storageKey
          })
        }
      } catch (error) {
        console.error('[会话详情] 加载存储失败:', error)
        hasStorageHistory = false
      }
    }
    
    // 步骤4：如果存储中没有消息，则根据 AiTextbookSession 重建消息历史（降级方案）
    if (!hasStorageHistory) {
      // 清空当前消息（因为存储中没有消息）
      aiTextbookStore.clearMessages()
      
      // 如果会话包含图片，标记使用截图接口
      if (record.hasImage) {
        aiTextbookStore.useScreenshotApi = true
      }
    
      // 创建用户消息（问题）
      const sessionId = getSessionId(record)
      const timestamp = record.timestamp || record.createTime || Date.now()
      if (record.question) {
        const userMessage: ChatBubble = {
          id: `${sessionId}_user_${timestamp}`,
          content: record.question,
          type: 'user',
          timestamp: new Date(timestamp).toISOString(),
          sender: 'user',
          messageType: record.hasImage ? 'image' : 'text' // 根据 hasImage 设置消息类型
        }
        aiTextbookStore.addMessage(userMessage)
      }
    
      // 创建AI回复消息（答案）
      if (record.answer) {
        const aiMessage: ChatBubble = {
          id: `${sessionId}_ai_${timestamp + 1000}`, // 假设1秒后回复
          content: record.answer,
          type: 'ai',
          timestamp: new Date(timestamp + 1000).toISOString(),
          sender: 'ai',
          messageType: 'text'
        }
        aiTextbookStore.addMessage(aiMessage)
      }
    }
  } catch (error) {
    console.error('[会话详情] 加载会话详情失败:', error)
    // 如果 showMessage 已导入，可以使用它
    // showMessage('加载会话详情失败', 'error')
  }
}

// 处理工具配置变化（颜色、粗细等），写入 pdfViewerStore.drawingConfig
const handleConfigChange = (config: {
  [key: string]: string | number | boolean | undefined
}) => {
  switch (store.selectedTool) {
    case 'pen':
      if (config.color) {
        store.updateDrawingConfig({ penColor: config.color as string })
      }
      if (config.size !== undefined) {
        store.updateDrawingConfig({ penWidth: config.size as number })
      }
      break
    case 'highlighter':
      if (config.color) {
        store.updateDrawingConfig({ highlighterColor: config.color as string })
      }
      if (config.size !== undefined) {
        store.updateDrawingConfig({ highlighterWidth: config.size as number })
      }
      break
    case 'eraser-draw':
      if (config.size !== undefined) {
        store.updateDrawingConfig({ eraserSize: config.size as number })
      }
      break
  }
}

// 处理会话删除
const handleSessionDelete = (record: AiTextbookSession) => {
  const sessionId = getSessionId(record)
  if (deleteScreenshotSession(sessionId)) {
    // 如果删除的是当前选中的会话，清除选中状态
    if (selectedRecordId.value === sessionId) {
      selectedRecordId.value = undefined
    }
    loadSessions()
  }
}

// 处理批量删除
const handleBatchDelete = (recordIds: string[]) => {
  if (batchDeleteScreenshotSessions(recordIds)) {
    // 如果删除的会话中包含当前选中的会话，清除选中状态
    if (selectedRecordId.value && recordIds.includes(selectedRecordId.value)) {
      selectedRecordId.value = undefined
    }
    loadSessions()
  }
}

// 处理置顶
const handleSessionPin = (record: AiTextbookSession) => {
  record.pinned = !record.pinned
  if (updateScreenshotSession(record)) {
    loadSessions()
  }
}

// PdfPage 实例引用
const pdfPageRef = ref<PdfPagePublicInstance | null>(null)

// 当前文件
const currentFile = ref<File | null>(null)

// 当前工具（与 UnifiedToolbar 工具枚举和 PdfPage 交互模式统一）
type PdfToolId = 'hand' | 'highlighter' | 'pen' | 'eraser-draw' | 'note' | 'screenshot'
const currentTool = ref<PdfToolId>('hand')

// 绘制功能已移除，不再需要保存成功提示

const handleToggleHighlight = () => {
  pdfPageRef.value?.toggleHighlightMode()
}

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
  if (store.selectedTool === clickedTool && clickedTool !== 'hand') {
    const t: PdfToolId = 'hand'
    currentTool.value = t
    store.selectedTool = t
    console.log('[工具切换] 再次点击相同工具，切回 hand 模式')
    pdfPageRef.value.toggleGestureMode?.()
    return
  }

  const t = clickedTool
  // 更新当前工具和 store 中的选中工具，保证所有组件使用同一套枚举
  currentTool.value = t
  store.selectedTool = t
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
      store.selectedTool === 'pen'
        ? store.drawingConfig.penColor
        : store.selectedTool === 'highlighter'
        ? store.drawingConfig.highlighterColor
        : undefined,
    size:
      store.selectedTool === 'pen'
        ? store.drawingConfig.penWidth
        : store.selectedTool === 'highlighter'
        ? store.drawingConfig.highlighterWidth
        : store.selectedTool === 'eraser-draw'
        ? store.drawingConfig.eraserSize
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
      store.setCurrentFileInfo(id, resourceId)
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
  chatPanelVisible.value = false
}

// 处理聊天响应事件
const handleChatResponse = () => {
  // 聊天响应完成，可以在这里添加额外逻辑
}

// 处理聊天焦点事件
const handleChatFocus = () => {
  // 聊天输入框获得焦点
}

// 处理滚动到底部事件
const handleScrollToBottom = () => {
  // 滚动到底部
}

// 从 ChatView 移除挂起截图
const handleRemoveScreenshot = () => {
  pendingScreenshot.value = undefined
}

// 处理截图捕获事件：接收 PdfPage 截图 blob，转换为 base64，并挂到 ChatView
const handleScreenshotCaptured = async (blob: Blob) => {
  try {
    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    // 创建临时图片以获取宽高等信息
    const img = new Image()
    img.src = base64DataUrl

    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
    })

    pendingScreenshot.value = {
      dataUrl: base64DataUrl,
      width: img.width,
      height: img.height,
      fileName: `screenshot-${Date.now()}.jpg`,
      fileSize: Math.round(base64DataUrl.length * 0.75),
    }

    // 截图后自动打开对话面板并切到 AI 问答 Tab
    chatPanelVisible.value = true
    activeTab.value = 'ai-chat'
  } catch (error) {
    console.error('[PdfViewerView] 处理截图数据失败', error)
  }
}

// ChatView 触发：携带截图发送问题给 AI
const handleSendWithScreenshot = async (question: string) => {
  if (!pendingScreenshot.value) return
  const { dataUrl, width, height, fileName, fileSize } = pendingScreenshot.value
  // 一次发送后清空挂起的截图
  pendingScreenshot.value = undefined

  try {
    const imageData = {
      filePath: fileName,
      base64DataUrl: dataUrl,
      width,
      height,
      fileSize,
    }
    const currentResourceId = (route.query.resourceId as string) || aiTextbookStore.resourceId || ''
    const sessionId = `screenshot_${Date.now()}`
    if (currentResourceId) {
      aiTextbookStore.clearMessages()
      aiTextbookStore.setResourceId(currentResourceId)
      aiTextbookStore.currentSessionId = sessionId
      aiTextbookStore.isNewSession = true
    }
    await aiTextbookStore.sendMessage(question, 'mate', imageData, false)

    const now = Date.now()
    const storageKey = currentResourceId
      ? `ai-textbook-${currentResourceId}-${sessionId}`
      : undefined
    const newSession: AiTextbookSession = {
      sessionId,
      sessionName: question,
      createTime: now,
      updateTime: now,
      msgCount: 0,
      pinned: false,
      thumbnailImage: dataUrl,
      hasImage: true,
      resourceId: currentResourceId || undefined,
      storageKey,
      id: sessionId,
      question,
      answer: '',
    }
    addScreenshotSession(newSession)
    loadSessions()
  } catch (error) {
    console.error('[PdfViewerView] 发送截图消息失败', error)
  }
}

// 自动打开并选中指定会话（从路由参数）
const autoSelectSession = async () => {
  const sessionIdFromRoute = route.query.sessionId as string | undefined
  if (!sessionIdFromRoute) {
    return
  }

  // 等待会话列表加载完成和DOM更新
  await nextTick()
  
  // 如果会话列表为空，等待一下再重试
  if (sessions.value.length === 0) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // 查找对应的会话
  const targetSession = sessions.value.find((session) => {
    const id = getSessionId(session)
    return id === sessionIdFromRoute
  })

  if (targetSession) {
    // 打开会话面板
    chatPanelVisible.value = true
    
    // 切换到会话记录tab
    activeTab.value = 'question-record'
    
    // 等待一下确保面板已打开
    await nextTick()
    
    // 选中会话并加载详情
    await handleSessionClick(targetSession)
  }
}

// 生命周期
onMounted(async () => {
  try {
    // 加载会话列表
    loadSessions()

    const file = await loadFileFromRoute()
    await loadPdfWithService(file)
    
    // 如果路由参数中有 sessionId，自动打开并选中对应会话
    await autoSelectSession()
  } catch (err) {
    console.error('PDF 加载失败:', err)
  }
})

// 页面卸载前清理
onBeforeUnmount(async () => {
  store.selectedTool = ''
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
  cursor: pointer;
  transition: all 0.3s;
  background: transparent; /* 默认透明背景 */
  border-radius: 0; /* 移除圆角 */
  box-shadow: none; /* 移除阴影 */
}

/* 激活的 Tab 项 */
.tab-active {
  background: #f6f8ff; /* 白色背景 */
  color: #504b64; /* 红色文字 */
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  height: 40px; /* 调整高度以匹配设计 */
  line-height: 24px; /* 垂直居中 */
}

/* 移除激活状态的下划线 */
.tab-active::after {
  display: none;
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
  color: #0000004d; /* 白色图标 */
  z-index: 1; /* 确保在前景 */
}

.chat-content-container {
  flex: 1;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  overflow: hidden;
  border-radius: 20px;
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

/* q-splitter 分隔条样式 - 只在对话面板显示时应用 */
.chat-panel-visible :deep(.q-splitter__separator) {
  background-color: #e0e0e0;
  cursor: col-resize;
  position: relative;
  width: 4px;
}

.chat-panel-visible :deep(.q-splitter__separator:hover) {
  background-color: #1976d2;
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
