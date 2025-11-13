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
            :tool-config="currentToolConfig"
            :tool-states="toolStates"
            :backgroundColor="toolbarBackgroundColor"
            @tool-change="handleToolChange"
            @config-change="handleConfigChange"
            @back="handleGoBack"
            @search="handleSearch"
            @hide-notes="handleHideNotes"
            @undo="handleUndo"
            @redo="handleRedo"
            @help="handleHelp"
          >
            <template #right-actions>
              <q-btn flat round dense icon="chat" @click="chatPanelVisible = !chatPanelVisible" />
            </template>
          </UnifiedToolbar>


          <!-- PDF页面列表 -->
          <q-virtual-scroll
            v-if="!isLoading && !error"
            :items="pageLayouts"
            virtual-scroll-item-size="800"
            virtual-scroll-slice-size="5"
            virtual-scroll-slice-ratio-before="2"
            virtual-scroll-slice-ratio-after="2"
            class="virtual-scroll"
            v-slot="{ item }"
          >
            <PdfPage
              :layout="item"
              :key="item.pageNum"
              class="pdf-page-item"
              @screenshot-captured="handleScreenshotCaptured"
            />
          </q-virtual-scroll>

          <!-- 加载状态 -->
          <div v-if="isLoading" class="loading-overlay">
            <q-spinner-dots size="50px" color="primary" />
          </div>

          <!-- 错误状态 -->
          <div v-if="error" class="error-overlay">
            <div class="error-state text-center q-pa-xl">
              <q-icon name="error" size="50px" color="negative" />
              <div class="q-mt-md">{{ error }}</div>
              <div class="q-mt-sm text-caption">请检查文件是否损坏或网络连接是否正常</div>
              <q-btn color="primary" @click="retry" class="q-mt-md">重试</q-btn>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!isLoading && !error && pageLayouts.length === 0" class="empty-state">
            <div class="empty-content text-center q-pa-xl">
              <q-icon name="picture_as_pdf" size="80px" color="grey-5" />
              <div class="q-mt-md text-h6 text-grey-6">暂无PDF文档</div>
              <div class="q-mt-sm text-caption text-grey-5">请选择或加载PDF文件开始查看</div>
            </div>
          </div>
          <!-- 截图输入对话框 -->
          <ScreenshotInputDialog
            v-model="screenshotDialogVisible"
            :screenshot-data-url="screenshotDataUrl"
            @confirm="handleScreenshotConfirm"
            @cancel="handleScreenshotCancel"
          />
          <!-- PDF调试面板（仅开发环境） -->
          <PdfDebugPanel v-if="isDev" v-model="debugPanelVisible" />
          <!-- 调试面板显示按钮（当面板关闭时显示） -->
          <q-btn
            v-if="isDev && !debugPanelVisible"
            round
            color="primary"
            icon="bug_report"
            size="md"
            class="debug-panel-toggle-btn"
            @click="debugPanelVisible = true"
            title="打开调试面板 (Ctrl+Shift+D)"
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
import { onMounted, onBeforeUnmount, computed, ref, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { resourceManager } from '@/services/resource-storage'
import { asyncStorage } from '@/services/chat-storage'
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { PdfStateAdapterVue } from '@/services/pdf/adapters/vue/PdfStateAdapterVue'
import type { UserTextbookInfo, LocalFileInfo, ChatBubble, AiTextbookSession } from '@/types'
import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
import PdfPage from '@/components/PdfPage.vue'
import ChatView from '@/components/ChatView.vue'
import SessionList from '@/components/SessionList.vue'
import ScreenshotInputDialog from '@/components/ScreenshotInputDialog.vue'
import PdfDebugPanel from '@/components/PdfDebugPanel.vue'
import {
  getScreenshotSessions,
  addScreenshotSession,
  deleteScreenshotSession,
  batchDeleteScreenshotSessions,
  updateScreenshotSession,
} from '@/utils/storage/screenshotSessions'

// 使用 Store 和路由
const store = usePdfViewerStore()
const route = useRoute()
const router = useRouter()

// PDF页面组件引用管理（用于undo/redo）
const pageComponents = ref<
  Map<number, { undo: () => boolean; redo: () => boolean; canUndo: () => boolean; canRedo: () => boolean }>
>(new Map())

// 注册页面组件
const registerPageComponent = (
  pageNum: number,
  component: { undo: () => boolean; redo: () => boolean; canUndo: () => boolean; canRedo: () => boolean },
) => {
  pageComponents.value.set(pageNum, component)
}

// 注销页面组件
const unregisterPageComponent = (pageNum: number) => {
  pageComponents.value.delete(pageNum)
}

// 工具状态更新触发器（用于强制更新 toolStates computed）
const toolStatesUpdateTrigger = ref(0)

// 触发工具状态更新（供子组件调用）
const triggerToolStatesUpdate = () => {
  toolStatesUpdateTrigger.value++
}

// 提供注册函数和更新触发器给子组件
provide('registerPageComponent', registerPageComponent)
provide('unregisterPageComponent', unregisterPageComponent)
provide('triggerToolStatesUpdate', triggerToolStatesUpdate)

// 统一工具栏工具集合（本地变量）
const pdfToolbarTools = {
  left: ['back'],
  middle: [  'pen', 'highlighter', 'eraser', 'screenshot'],
}

// 开发环境检查（仅开发环境显示调试面板）
// 优先使用环境变量，如果没有设置则使用 Vite 的默认开发环境变量
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

// 调试面板状态（开发环境下默认显示）
const debugPanelVisible = ref(isDev)

// 使用 exerciseStore 来发送AI消息
const aiTextbookStore = useAiTextbookChatStore()

// 初始化服务类和适配器
const pdfCoreService = new PdfCoreService()
const stateAdapter = new PdfStateAdapterVue()

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

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getSessionId = (session: AiTextbookSession): string => {
  return session.sessionId || session.id || ''
}

// 截图输入对话框状态
const screenshotDialogVisible = ref(false)
const screenshotDataUrl = ref('')

// 获取当前 resourceId（仅从路由参数获取）
const getCurrentResourceId = (): string | undefined => {
  return (route.query.resourceId as string) || undefined
}

// 加载会话列表（按 resourceId 过滤）
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
  // 增加切换 chatview 的逻辑：如果当前不是 AI 问答 Tab，则切换到 AI 问答
  if (activeTab.value !== 'ai-chat') {
    activeTab.value = 'ai-chat'
  }
  
  // 加载会话详情
  await loadSessionDetail(record)
}

// 加载会话详情
const loadSessionDetail = async (record: AiTextbookSession) => {
  try {
    // 步骤1：确定 resourceId（优先使用 record.resourceId，如果没有则从 storageKey 中提取）
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
    
    // 步骤3：先尝试直接从存储中检查是否有消息历史（避免不必要的清空）
    let loadedMessages: ChatBubble[] = []
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
        
        const history = await asyncStorage.loadChatHistory(storageKey)
        
        if (history && history.messages && history.messages.length > 0) {
          hasStorageHistory = true
          // 有存储历史，使用 loadChatHistory 加载（传入 storageKey 和 sessionId）
          await aiTextbookStore.loadChatHistory(storageKey, getSessionId(record))
          loadedMessages = aiTextbookStore.messages
          // 如果会话包含图片消息，标记使用截图接口
          if (record.hasImage) {
            aiTextbookStore.useScreenshotApi = true
          }
          console.log('[会话详情] 从存储加载消息', {
            resourceId: targetResourceId,
            sessionId: getSessionId(record),
            storageKey: storageKey,
            messageCount: loadedMessages.length,
            hasImage: record.hasImage
          })
        } else {
          // 存储中没有消息，标记为无历史记录
          hasStorageHistory = false
          console.log('[会话详情] 存储中无消息', {
            resourceId: targetResourceId,
            sessionId: getSessionId(record),
            storageKey: storageKey
          })
        }
      } catch (error) {
        console.error('[会话详情] 检查存储失败:', error)
        hasStorageHistory = false
      }
    }
    
    // 步骤4：如果存储中没有消息，则根据 AiTextbookSession 重建消息历史（降级方案）
    if (!hasStorageHistory) {
      console.log('[会话详情] 使用降级方案重建消息')
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
    
    console.log('[会话详情] 已加载会话详情', {
      sessionId: getSessionId(record),
      question: record.question,
      hasAnswer: !!record.answer,
      messageCount: loadedMessages.length || aiTextbookStore.messages.length,
      fromStorage: loadedMessages.length > 0,
      hasImage: record.hasImage
    })
  } catch (error) {
    console.error('[会话详情] 加载会话详情失败:', error)
    // 如果 showMessage 已导入，可以使用它
    // showMessage('加载会话详情失败', 'error')
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

// 计算属性
const pageLayouts = computed(() => store.pageLayouts)
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)

// 保存成功提示显示状态（自动隐藏）
const showSaveSuccess = computed(() => {
  if (!store.lastSaveTime) return false
  const timeSinceSave = Date.now() - store.lastSaveTime
  return timeSinceSave < 2000 // 2秒后自动隐藏
})



// 当前工具配置
const currentToolConfig = computed(() => {
  const config = store.drawingConfig

  // 1. 根据当前工具返回对应的配置
  switch (store.selectedTool) {
    case 'pen':
      return {
        color: config.penColor,
        size: config.penWidth,
      }
    case 'highlighter':
      return {
        color: config.highlighterColor,
        size: config.highlighterWidth,
      }
    case 'eraser':
      return {
        size: config.eraserSize,
      }
    case 'screenshot':
      return {
        shape: config.screenshotShape,
      }
    case 'select':
      return {
        selectMode: config.selectMode || 'rectangle',
      }
    default:
      return {}
  }
})

// 工具状态
const toolStates = computed(() => {
  // 访问 trigger 以确保响应式更新
  const _ = toolStatesUpdateTrigger.value
  
  const lastModifiedPage = store.lastModifiedPage
  
  // 如果没有最后修改的页面，尝试使用第一个有历史记录的页面
    let targetPage = lastModifiedPage
    if (targetPage === null) {
      // 获取第一个有历史记录的页面
      for (const [pageNum, component] of pageComponents.value.entries()) {
        if (component.canUndo() || component.canRedo()) {
          targetPage = pageNum
          break
        }
      }
    
    // 如果还是没有，使用第一个页面
    if (targetPage === null && pageComponents.value.size > 0) {
      targetPage = Array.from(pageComponents.value.keys())[0]
    }
  }
  
  if (targetPage === null) {
    return {
      undo: false,
      redo: false,
    }
  }

  const pageComponent = pageComponents.value.get(targetPage)
  if (pageComponent) {
    // 调用函数获取最新的状态值（响应式更新）
    return {
      undo: pageComponent.canUndo(),
      redo: pageComponent.canRedo(),
    }
  }

  return {
    undo: false,
    redo: false,
  }
})

// 处理工具切换
const handleToolChange = (tool: string) => {
  console.log('[工具切换] 视图层处理工具变化', {
    tool,
    previousTool: store.selectedTool,
    timestamp: new Date().toISOString(),
  })

  // 1. 更新 store 中的选中工具
  store.setSelectedTool(tool)
}

// 处理配置变化
const handleConfigChange = (config: { [key: string]: string | number | boolean | undefined }) => {
  // 1. 根据当前工具更新对应的配置
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
    case 'eraser':
      if (config.size !== undefined) {
        store.updateDrawingConfig({ eraserSize: config.size as number })
      }
      break
    case 'screenshot':
      if (config.shape) {
        store.updateDrawingConfig({ screenshotShape: config.shape as string })
      }
      break
    case 'select':
      if (config.selectMode) {
        store.updateDrawingConfig({ selectMode: config.selectMode as string })
      }
      break
  }
}

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

// 处理隐藏笔记
const handleHideNotes = () => {
  // 切换隐藏笔记状态
  store.hideNotes = !store.hideNotes
}

// 处理帮助
const handleHelp = () => {
  // TODO: 实现帮助功能
  console.log('帮助操作')
  // 可以显示帮助对话框或跳转到帮助页面
}

// 处理撤销
const handleUndo = () => {
  const lastModifiedPage = store.lastModifiedPage
  if (lastModifiedPage === null) {
    // 如果没有最后修改的页面，尝试使用第一个有历史记录的页面
    for (const [pageNum, component] of pageComponents.value.entries()) {
      if (component.canUndo()) {
        const success = component.undo()
        if (success) {
          console.log(`撤销第 ${pageNum} 页的操作`)
        }
        return
      }
    }
    console.log('没有可撤销的操作')
    return
  }

  const pageComponent = pageComponents.value.get(lastModifiedPage)
  if (pageComponent && pageComponent.canUndo()) {
    const success = pageComponent.undo()
    if (success) {
      console.log(`撤销第 ${lastModifiedPage} 页的操作`)
    }
  } else {
    console.log(`第 ${lastModifiedPage} 页无法撤销`)
  }
}

// 处理重做
const handleRedo = () => {
  const lastModifiedPage = store.lastModifiedPage
  if (lastModifiedPage === null) {
    // 如果没有最后修改的页面，尝试使用第一个有历史记录的页面
    for (const [pageNum, component] of pageComponents.value.entries()) {
      if (component.canRedo()) {
        const success = component.redo()
        if (success) {
          console.log(`重做第 ${pageNum} 页的操作`)
        }
        return
      }
    }
    console.log('没有可重做的操作')
    return
  }

  const pageComponent = pageComponents.value.get(lastModifiedPage)
  if (pageComponent && pageComponent.canRedo()) {
    const success = pageComponent.redo()
    if (success) {
      console.log(`重做第 ${lastModifiedPage} 页的操作`)
    }
  } else {
    console.log(`第 ${lastModifiedPage} 页无法重做`)
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

    // 5. 设置当前文件信息到Store
    store.setCurrentFileInfo(id, resourceId)

    console.log('文件加载成功:', { fileName, size: file.size })
    return file
  } catch (err) {
    console.error('从路由加载文件失败:', err)
    throw err
  }
}

// 重试加载
const retry = async () => {
  try {
    const file = await loadFileFromRoute()
    await loadPdfWithService(file)
  } catch (err) {
    console.error('重试加载失败:', err)
  }
}

// 使用服务类加载PDF
const loadPdfWithService = async (file: File) => {
  try {
    stateAdapter.setLoading(true)
    stateAdapter.setError(null)

    // 1. 设置当前文件信息到Store
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    if (resourceId && id) {
      store.setCurrentFileInfo(id, resourceId)
      // 同时设置到 aiTextbookStore，确保会话列表能正确过滤
      aiTextbookStore.setResourceId(resourceId)
    }

    // 2. 从localFiles加载笔记数据
    await store.loadAnnotationsFromLocalFile()

    // 3. 使用PdfCoreService加载PDF
    const result = await pdfCoreService.loadPdf(file)

    // 4. 计算页面布局
    const scale = stateAdapter.getState().scale
    const layouts = await pdfCoreService.calculatePageLayouts(scale, store.pageGap)

    // 5. 更新状态适配器
    stateAdapter.setPdfLoaded({
      ...result,
      pageLayouts: layouts,
    })

    // 6. 同时更新store（保持兼容性）
    store.pdfDoc = result.pdfDoc
    store.originalPdfBytes = result.originalPdfBytes
    store.pageLayouts = layouts
    store.totalPages = result.totalPages
    store.isDocLoaded = true

    console.log('PDF 加载完成:', {
      totalPages: result.totalPages,
      layouts: layouts.length,
    })
  } catch (error) {
    console.error('PDF 加载失败:', error)
    stateAdapter.setError(error instanceof Error ? error.message : 'PDF 加载失败')
    store.error = error instanceof Error ? error.message : 'PDF 加载失败'
  } finally {
    stateAdapter.setLoading(false)
    store.isLoading = false
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

// 处理截图捕获事件
// 流程：接收截图blob → 转换为base64 → 弹出输入对话框 → 用户输入问题后发送给AI
const handleScreenshotCaptured = async (blob: Blob) => {
  try {
    // 步骤1：接收截图数据
    // 步骤2：将blob转换为base64DataUrl
    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    // 步骤3：弹出输入对话框，等待用户输入问题
    screenshotDataUrl.value = base64DataUrl
    screenshotDialogVisible.value = true
  } catch (error) {
    // 处理错误
  }
}

// 处理截图输入对话框确认
const handleScreenshotConfirm = async (question: string, dataUrl: string) => {
  try {
    // 步骤1：打开对话面板并切换到AI问答Tab
    chatPanelVisible.value = true
    activeTab.value = 'ai-chat'

    // 步骤2：创建临时图片以获取宽高
    const img = new Image()
    img.src = dataUrl

    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
    })

    // 步骤3：发送消息给AI（使用用户输入的问题作为coversation）
    // 流程：文件名使用.jpg后缀（与安卓原生保持一致）
    const fileName = `screenshot-${Date.now()}.jpg`

    // 构建完整的图片数据，包含宽高信息，确保消息列表能正确显示图片
    const imageData = {
      filePath: fileName,
      base64DataUrl: dataUrl,
      width: img.width,
      height: img.height,
      fileSize: Math.round(dataUrl.length * 0.75), // base64编码后大小约为原始大小的1.33倍，这里估算原始大小
    }

    // 步骤3.5：获取并设置 resourceId（必须在发送消息前设置，以便消息能立即保存）
    const currentResourceId = route.query.resourceId as string || aiTextbookStore.resourceId || ''
    
    // 步骤3.6：创建新会话ID（在发送消息前创建，确保会话ID一致）
    const sessionId = `screenshot_${Date.now()}`
    
    if (currentResourceId) {
      // 每次截图都强制创建新会话：先清空消息，再设置 resourceId（会重置会话状态）
      aiTextbookStore.clearMessages()
      aiTextbookStore.setResourceId(currentResourceId)
      // 设置 sessionId，确保 sendMessage 使用这个 sessionId
      aiTextbookStore.currentSessionId = sessionId
      aiTextbookStore.isNewSession = true
    }

    // 调试日志：验证文字和图片是否一起传递
    console.log('[PDF_VIEWER] 📤 发送截图消息:', {
      question: question,
      hasImage: !!imageData?.base64DataUrl,
      imageSize: imageData ? `${imageData.width}x${imageData.height}` : 'none',
    })

    await aiTextbookStore.sendMessage(
      question, // ⭐ 使用用户输入的问题作为coversation
      'mate', // 使用默认AI模型
      imageData, // ⭐ 传递完整的图片数据（包含宽高），确保消息列表正确显示
      false, // 不隐藏前缀
    )

    // 步骤4：创建新会话并保存到localStorage（使用包含 sessionId 的 storageKey）
    const storageKey = currentResourceId ? `ai-textbook-${currentResourceId}-${sessionId}` : undefined
    const now = Date.now()
    const newSession: AiTextbookSession = {
      sessionId: sessionId,
      sessionName: question, // 使用问题作为会话名称
      createTime: now,
      updateTime: now,
      msgCount: 0, // 初始消息数为0，将在消息发送后更新
      pinned: false,
      resourceId: currentResourceId, // 保存 resourceId
      thumbnailImage: dataUrl, // 保存截图图片（base64格式）
      storageKey: storageKey, // 保存存储键（包含 sessionId）
      hasImage: true, // 标记为包含图片的会话
      // 向后兼容字段
      id: sessionId,
      question: question,
      answer: undefined, // 答案将在AI回复后更新
      timestamp: now,
    }
    addScreenshotSession(newSession)
    loadSessions() // 刷新会话列表
  } catch (error) {
    // 处理错误
  }
}

// 处理截图输入对话框取消
const handleScreenshotCancel = () => {
  screenshotDataUrl.value = ''
}

// 监听scale变化，重新计算布局
watch(
  () => store.scale,
  async (newScale, oldScale) => {
    // 如果PDF未加载或scale未变化，跳过
    if (!store.isDocLoaded || newScale === oldScale) {
      return
    }

    try {
      console.log('缩放变化，重新计算布局:', { oldScale, newScale })
      // 重新计算页面布局
      const layouts = await pdfCoreService.calculatePageLayouts(newScale, store.pageGap)
      // 更新store中的布局
      store.pageLayouts = layouts
      // 更新状态适配器
      stateAdapter.setPageLayouts(layouts)
    } catch (error) {
      console.error('重新计算布局失败:', error)
    }
  },
)


// 快捷键处理（仅开发环境）
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl+Shift+D (Windows/Linux) 或 Cmd+Shift+D (Mac)
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
    event.preventDefault()
    debugPanelVisible.value = !debugPanelVisible.value
  }
}

// 生命周期
onMounted(async () => {
  try {
    // 初始化页面可见性监听
    store.initVisibilityListener()

    // 添加快捷键监听（仅开发环境）
    if (isDev) {
      window.addEventListener('keydown', handleKeyDown)
    }

    // 加载会话列表
    loadSessions()

    const file = await loadFileFromRoute()
    await loadPdfWithService(file)
  } catch (err) {
    console.error('PDF 加载失败:', err)
  }
})

// 页面卸载前立即保存笔记
onBeforeUnmount(async () => {
  // 移除页面可见性监听
  store.removeVisibilityListener()

  // 移除快捷键监听（仅开发环境）
  if (isDev) {
    window.removeEventListener('keydown', handleKeyDown)
  }

  // 立即保存笔记
  await store.flushSave()
})
</script>

<style scoped>
.content-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
  height: 100vh;
  width: 100%;
}

.full-height {
  height: 100%;
  width: 100%;
}

.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100%;
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
  color: #fff; /* 白色图标 */
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
  height: 100%;
  position: relative;
  overflow: hidden;
  background-color: #0A0020;
  display: flex;
  flex-direction: column;
}

/* 虚拟滚动容器 - 支持横向和纵向滚动 */
.virtual-scroll {
  height: 100%;
  width: 100%;
  /* 支持横向滚动 */
  overflow-x: auto;
  overflow-y: auto;
  /* 确保滚动条样式美观 */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.3) rgba(0, 0, 0, 0.1);
}

/* Webkit浏览器的滚动条样式 */
.virtual-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.virtual-scroll::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
}

.virtual-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.virtual-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

/* 确保虚拟滚动的内容容器也支持横向滚动 */
.virtual-scroll :deep(.q-virtual-scroll__content) {
  /* 当内容宽度超过容器时，允许横向滚动 */
  min-width: 100%;
  /* 确保内容不会被压缩 */
  width: max-content;
}

/* 虚拟滚动的内容包装器 */
.virtual-scroll :deep(.q-virtual-scroll__content-wrapper) {
  /* 允许内容自然宽度，不被压缩 */
  min-width: 100%;
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


/* 调试面板显示按钮 */
.debug-panel-toggle-btn {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.debug-panel-toggle-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
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
