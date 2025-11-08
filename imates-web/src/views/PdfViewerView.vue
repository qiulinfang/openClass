<template>
  <!-- 内容区域和对话面板 -->
  <div class="content-layout">
    <q-splitter
      v-if="chatPanelVisible"
      v-model="splitterModel"
      :limits="[30, 70]"
      class="full-height"
    >
      <!-- PDF内容区域 -->
      <template v-slot:before>
        <div class="pdf-viewer-container">
          <!-- 工具栏 -->
          <UnifiedToolbar
            variant="browser"
            :tools="{
              left: ['back', 'undo', 'redo'],
              middle: [
                'search',
                'hideNotes',
                'pen',
                'highlighter',
                'eraser',
                'screenshot',
                'select',
              ],
              right: ['help'],
            }"
            :selected-tool="store.selectedTool"
            :tool-config="currentToolConfig"
            :tool-states="toolStates"
            :backgroundColor="toolbarBackgroundColor"
            @tool-change="handleToolChange"
            @config-change="handleConfigChange"
            @back="handleGoBack"
            @undo="handleUndo"
            @redo="handleRedo"
            @search="handleSearch"
            @hide-notes="handleHideNotes"
            @help="handleHelp"
          />

          <!-- 缩放控制按钮 -->
          <div class="zoom-controls">
            <q-btn-group flat>
              <q-btn
                flat
                dense
                icon="remove"
                size="sm"
                @click="handleZoomOut"
                :disable="store.scale <= 0.5"
                title="缩小"
              />
              <q-btn
                flat
                dense
                :label="`${store.scalePercentage}%`"
                size="sm"
                @click="handleResetZoom"
                title="重置缩放"
                class="zoom-percentage"
              />
              <q-btn
                flat
                dense
                icon="add"
                size="sm"
                @click="handleZoomIn"
                :disable="store.scale >= 3.0"
                title="放大"
              />
            </q-btn-group>
          </div>

          <!-- 保存状态提示 -->
          <q-banner v-if="store.isSaving" class="save-status-banner" dense :class="'bg-info'">
            <template v-slot:avatar>
              <q-spinner-dots size="20px" color="white" />
            </template>
            正在保存笔记...
          </q-banner>

          <q-banner
            v-else-if="store.saveError"
            class="save-status-banner"
            dense
            :class="'bg-negative'"
            @click="store.saveError = null"
            style="cursor: pointer"
          >
            <template v-slot:avatar>
              <q-icon name="error" size="20px" color="white" />
            </template>
            保存失败: {{ store.saveError }}
            <template v-slot:action>
              <q-btn flat dense icon="close" @click.stop="store.saveError = null" />
            </template>
          </q-banner>

          <q-banner
            v-else-if="showSaveSuccess"
            class="save-status-banner"
            dense
            :class="'bg-positive'"
          >
            <template v-slot:avatar>
              <q-icon name="check_circle" size="20px" color="white" />
            </template>
            笔记已保存
          </q-banner>
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
        </div>
      </template>

      <!-- 对话面板 -->
      <template v-slot:after>
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
                  <q-icon :name="tab.icon" size="sm" />
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
                :resource-id="resourceId"
                @response="handleChatResponse"
                @focus="handleChatFocus"
                @scroll-to-bottom="handleScrollToBottom"
              />
            </div>

            <!-- 问题记录 Tab -->
            <div v-if="activeTab === 'question-record'" class="tab-content">
              <SessionList :records="questionRecords" @record-click="handleQuestionRecordClick" />
            </div>
          </div>
        </div>
      </template>
    </q-splitter>

    <!-- PDF内容区域（无对话面板时） -->
    <div v-else class="pdf-viewer-container full-height">
      <!-- 工具栏 -->
      <UnifiedToolbar
        variant="browser"
        :tools="{
          left: ['back', 'undo', 'redo'],
          middle: ['search', 'hideNotes', 'pen', 'highlighter', 'eraser', 'screenshot', 'select'],
          right: ['help'],
        }"
        :selected-tool="store.selectedTool"
        :tool-config="currentToolConfig"
        :tool-states="toolStates"
        :backgroundColor="toolbarBackgroundColor"
        @tool-change="handleToolChange"
        @config-change="handleConfigChange"
        @back="handleGoBack"
        @undo="handleUndo"
        @redo="handleRedo"
        @search="handleSearch"
        @hide-notes="handleHideNotes"
        @help="handleHelp"
      />

      <!-- 缩放控制按钮 -->
      <div class="zoom-controls">
        <q-btn-group flat>
          <q-btn
            flat
            dense
            icon="remove"
            size="sm"
            @click="handleZoomOut"
            :disable="store.scale <= 0.5"
            title="缩小"
          />
          <q-btn
            flat
            dense
            :label="`${store.scalePercentage}%`"
            size="sm"
            @click="handleResetZoom"
            title="重置缩放"
            class="zoom-percentage"
          />
          <q-btn
            flat
            dense
            icon="add"
            size="sm"
            @click="handleZoomIn"
            :disable="store.scale >= 3.0"
            title="放大"
          />
        </q-btn-group>
      </div>

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
    </div>
  </div>

  <!-- 截图输入对话框 -->
  <ScreenshotInputDialog
    v-model="screenshotDialogVisible"
    :screenshot-data-url="screenshotDataUrl"
    :enable-crop="false"
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
import { PdfCoreService } from '@/services/pdf/core/PdfCoreService'
import { PdfStateAdapterVue } from '@/services/pdf/adapters/vue/PdfStateAdapterVue'
import type { UserTextbookInfo, LocalFileInfo, QuestionRecord } from '@/types'
import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
import PdfPage from '@/components/PdfPage.vue'
import ChatView from '@/components/ChatView.vue'
import SessionList from '@/components/SessionList.vue'
import ScreenshotInputDialog from '@/components/ScreenshotInputDialog.vue'
import PdfDebugPanel from '@/components/PdfDebugPanel.vue'

// 使用 Store 和路由
const store = usePdfViewerStore()
const route = useRoute()
const router = useRouter()

// PDF页面组件引用管理（用于undo/redo）
const pageComponents = ref<
  Map<number, { undo: () => boolean; redo: () => boolean; canUndo: boolean; canRedo: boolean }>
>(new Map())

// 注册页面组件
const registerPageComponent = (
  pageNum: number,
  component: { undo: () => boolean; redo: () => boolean; canUndo: boolean; canRedo: boolean },
) => {
  pageComponents.value.set(pageNum, component)
}

// 注销页面组件
const unregisterPageComponent = (pageNum: number) => {
  pageComponents.value.delete(pageNum)
}

// 提供注册函数给子组件
provide('registerPageComponent', registerPageComponent)
provide('unregisterPageComponent', unregisterPageComponent)

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
  { label: '问题记录', value: 'question-record', icon: 'quiz' },
  { label: 'AI问答', value: 'ai-chat', icon: 'chat' },
]

// 问题记录数据
const questionRecords = ref<QuestionRecord[]>([])

// 截图输入对话框状态
const screenshotDialogVisible = ref(false)
const screenshotDataUrl = ref('')

// 处理问题记录点击
const handleQuestionRecordClick = () => {
  activeTab.value = 'ai-chat'
}

// 计算属性
const pageLayouts = computed(() => store.pageLayouts)
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)
const resourceId = computed(() => route.query.resourceId as string | undefined)

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
        handwritingStyle: config.penHandwritingStyle || 'writing',
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

// 工具状态（用于禁用undo/redo按钮）
const toolStates = computed(() => {
  const lastModifiedPage = store.lastModifiedPage
  if (lastModifiedPage === null) {
    return {
      undo: false,
      redo: false,
    }
  }

  const pageComponent = pageComponents.value.get(lastModifiedPage)
  if (pageComponent) {
    return {
      undo: pageComponent.canUndo,
      redo: pageComponent.canRedo,
    }
  }

  return {
    undo: false,
    redo: false,
  }
})

// 处理工具切换
const handleToolChange = (tool: string) => {
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
      if (config.handwritingStyle) {
        store.updateDrawingConfig({
          penHandwritingStyle: config.handwritingStyle as
            | 'brush'
            | 'writing'
            | 'spray'
            | 'oil-paint'
            | 'crayon'
            | 'marker'
            | 'pencil'
            | 'watercolor',
        })
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

// 处理撤销
const handleUndo = () => {
  const lastModifiedPage = store.lastModifiedPage
  if (lastModifiedPage === null) {
    return
  }

  const pageComponent = pageComponents.value.get(lastModifiedPage)
  if (pageComponent && pageComponent.canUndo) {
    const success = pageComponent.undo()
    if (success) {
    }
  } else {
  }
}

// 处理重做
const handleRedo = () => {
  const lastModifiedPage = store.lastModifiedPage
  if (lastModifiedPage === null) {
    return
  }

  const pageComponent = pageComponents.value.get(lastModifiedPage)
  if (pageComponent && pageComponent.canRedo) {
    const success = pageComponent.redo()
    if (success) {
    }
  } else {
  }
}

// 处理搜索
const handleSearch = () => {
  // TODO: 实现搜索功能
}

// 处理隐藏笔记
const handleHideNotes = () => {
  // 切换隐藏笔记状态
  store.hideNotes = !store.hideNotes
}

// 处理帮助
const handleHelp = () => {
  // TODO: 实现帮助功能
  // 可以显示帮助对话框或跳转到帮助页面
}

// 从路由参数加载文件
const loadFileFromRoute = async () => {
  try {
    // 从路由 query 参数获取文件信息（LearningView 传递的是 query 参数）
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    if (!resourceId || !id) {
      throw new Error('缺少必要的路由参数: resourceId 和 id')
    }
    // 1. 根据 id 从 IndexedDB 获取教材信息（使用主键查询）
    const textbook = (await resourceManager.indexedDB.get('textbooks', id)) as UserTextbookInfo
    if (!textbook) {
      throw new Error(`教材 ${id} 不存在`)
    }
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
        }
      }
    }

    // 3. 如果没有找到本地文件，提示用户先下载
    if (!fileData) {
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
  const startTime = Date.now()
  try {


    // 步骤2：将blob转换为base64DataUrl
    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    const base64Size = base64DataUrl.length
  

    // 步骤3：弹出输入对话框，等待用户输入问题
    screenshotDataUrl.value = base64DataUrl
    screenshotDialogVisible.value = true
    const endTime = Date.now()
    const duration = endTime - startTime
  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime
    console.error('[截图→AI] ❌ ========== 处理失败 ==========', {
      错误信息: error,
      失败位置: '截图处理流程',
      已耗时: `${duration}ms`,
    })
  }
}

// 处理截图输入对话框确认
const handleScreenshotConfirm = async (question: string, dataUrl: string) => {
  const startTime = Date.now()
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

    await aiTextbookStore.sendMessage(
      question, // ⭐ 使用用户输入的问题作为coversation
      'mate', // 使用默认AI模型
      imageData, // ⭐ 传递完整的图片数据（包含宽高），确保消息列表正确显示
      false, // 不隐藏前缀
    )

    const endTime = Date.now()
    const duration = endTime - startTime
  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime
    console.error('[截图→AI] ❌ ========== 发送失败 ==========', {
      错误信息: error,
      失败位置: '发送截图问答',
      已耗时: `${duration}ms`,
    })
  }
}

// 处理截图输入对话框取消
const handleScreenshotCancel = () => {
  screenshotDataUrl.value = ''
}

// 处理缩放
const handleZoomIn = () => {
  store.zoomIn()
}

const handleZoomOut = () => {
  store.zoomOut()
}

const handleResetZoom = () => {
  store.resetZoom()
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
}

.chat-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f5f5f5;
  flex-shrink: 0;
}

.chat-tabs {
  flex: 1;
  display: flex;
  justify-content: center;
}

.tab-list {
  display: flex;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  padding: 4px;
  gap: 0;
  position: relative;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: rgba(0, 0, 0, 0.6);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  position: relative;
  min-width: 80px;
  justify-content: center;
  letter-spacing: 0.25px;
}

.tab-item:hover {
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.87);
}

.tab-active {
  background: white;
  color: #1976d2;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.24);
  font-weight: 500;
}

.tab-active:hover {
  background: white;
  color: #1976d2;
}

.tab-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #1976d2;
  border-radius: 1px;
}

.close-button {
  color: #666;
}

.chat-content-container {
  flex: 1;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  overflow: hidden;
}

.pdf-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
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

.save-status-banner {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  min-width: 300px;
  max-width: 500px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

.zoom-controls {
  position: fixed;
  top: 60px;
  right: 16px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 4px;
}

.zoom-controls .q-btn-group {
  border-radius: 6px;
}

.zoom-controls .q-btn {
  min-width: 40px;
}

.zoom-percentage {
  min-width: 60px;
  font-weight: 500;
}

/* 调试面板显示按钮 */
.debug-panel-toggle-btn {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
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
