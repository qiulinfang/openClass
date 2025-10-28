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
            :tools="['back', 'pen', 'highlighter', 'eraser', 'screenshot', 'reset', 'chat']"
            :selected-tool="store.selectedTool"
            :tool-config="currentToolConfig"
            @tool-change="handleToolChange"
            @config-change="handleConfigChange"
            @back="handleGoBack"
            @chat="handleToggleChatPanel"
          />
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
            <PdfPage :layout="item" :key="item.pageNum" class="pdf-page-item" @screenshot-captured="handleScreenshotCaptured" />
          </q-virtual-scroll>

          <!-- 加载状态 -->
          <div v-if="isLoading" class="loading-overlay">
            <div class="loading-state text-center q-pa-xl">
              <q-spinner-dots size="50px" color="primary" />
              <div class="q-mt-md">正在加载PDF...</div>
              <div v-if="renderProgress.current > 0" class="q-mt-sm">
                进度: {{ renderProgress.current }} / {{ renderProgress.total }}
              </div>
              <div class="q-mt-sm text-caption">支持文本选择、注释工具和自动保存</div>
            </div>
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
                @response="handleChatResponse"
                @focus="handleChatFocus"
                @scroll-to-bottom="handleScrollToBottom"
              />
            </div>
            
            <!-- 问题记录 Tab -->
            <div v-if="activeTab === 'question-record'" class="tab-content">
              <QuestionRecordList 
                :records="questionRecords"
                @record-click="handleQuestionRecordClick"
              />
            </div>
          </div>
        </div>
      </template>
    </q-splitter>

    <!-- PDF内容区域（无对话面板时） -->
    <div v-else class="pdf-viewer-container full-height">
      <!-- 工具栏 -->
      <UnifiedToolbar
        :tools="['back', 'pen', 'highlighter', 'eraser', 'screenshot', 'reset', 'chat']"
        :selected-tool="store.selectedTool"
        :tool-config="currentToolConfig"
        @tool-change="handleToolChange"
        @config-change="handleConfigChange"
        @back="handleGoBack"
        @chat="handleToggleChatPanel"
      />
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
        <PdfPage :layout="item" :key="item.pageNum" class="pdf-page-item" @screenshot-captured="handleScreenshotCaptured" />
      </q-virtual-scroll>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-state text-center q-pa-xl">
          <q-spinner-dots size="50px" color="primary" />
          <div class="q-mt-md">正在加载PDF...</div>
          <div v-if="renderProgress.current > 0" class="q-mt-sm">
            进度: {{ renderProgress.current }} / {{ renderProgress.total }}
          </div>
          <div class="q-mt-sm text-caption">支持文本选择、注释工具和自动保存</div>
        </div>
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
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useExerciseStore } from '@/stores/exerciseStore'
import { resourceManager } from '@/services/resource-manager'
import type { UserTextbookInfo, LocalFileInfo, QuestionRecord } from '@/types'
import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
import PdfPage from '@/components/PdfPage.vue'
import ChatView from '@/components/ChatView.vue'
import QuestionRecordList from '@/components/QuestionRecordList.vue'

// 使用 Store 和路由
const store = usePdfViewerStore()
const route = useRoute()
const router = useRouter()

// 使用 exerciseStore 来发送AI消息
const exerciseStore = useExerciseStore()

// 组件状态
const renderProgress = ref({
  current: 0,
  total: 0,
})

// 对话面板状态
const chatPanelVisible = ref(false)
const splitterModel = ref(60) // 分隔比例（左侧占60%）

// Tab 状态
const activeTab = ref('ai-chat') // 当前激活的 tab

// Tab 选项
const tabOptions = [
  { label: '问题记录', value: 'question-record', icon: 'quiz' },
  { label: 'AI问答', value: 'ai-chat', icon: 'chat' }
]

// 问题记录数据
const questionRecords = ref<QuestionRecord[]>([])

// 处理问题记录点击
const handleQuestionRecordClick = () => {
  activeTab.value = 'ai-chat'
}

// 计算属性
const pageLayouts = computed(() => store.pageLayouts)
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)

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
    default:
      return {}
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
  }
}

// 处理返回
const handleGoBack = () => {
  // 1. 使用路由返回
  router.back()
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

    // 2. 在教材的 localFiles 中查找对应的文件
    let fileData: Uint8Array | null = null
    let fileName = 'unknown.pdf'

    if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
      const localFile = textbook.localFiles.find((file: LocalFileInfo) => file.id === resourceId)
      if (localFile && localFile.fileData) {
        fileData = localFile.fileData
        fileName = localFile.fileName || fileName
        console.log('找到本地文件:', { fileName, fileSize: fileData.length })
      }
    }

    // 3. 如果没有找到本地文件，尝试从服务器下载
    if (!fileData) {
      console.log('本地文件不存在，尝试从服务器下载...')
      const downloadUrl = await resourceManager.getResourceDownloadUrl(resourceId)
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
    await store.loadPdf(file)
  } catch (err) {
    console.error('重试加载失败:', err)
  }
}

// 处理对话面板切换
const handleToggleChatPanel = (visible?: boolean) => {
  // 1. 如果提供了参数，使用参数值
  // 2. 如果没有提供参数，切换当前状态
  chatPanelVisible.value = visible !== undefined ? visible : !chatPanelVisible.value
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
// 流程：接收截图blob → 转换为base64 → 打开对话面板 → 发送给AI
const handleScreenshotCaptured = async (blob: Blob) => {
  const startTime = Date.now()
  console.log('[截图→AI] 🚀 ========== 开始处理截图 ==========')
  
  try {
    // 步骤1：接收截图数据
    console.log('[截图→AI] 步骤1/5 📥 接收到截图数据', {
      时间戳: new Date().toLocaleTimeString(),
      文件大小: `${(blob.size / 1024).toFixed(2)} KB`,
      文件类型: blob.type,
      原始大小: `${blob.size} bytes`
    })
    
    // 步骤2：将blob转换为base64DataUrl
    console.log('[截图→AI] 步骤2/5 🔄 开始转换为Base64格式...')
    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    
    const base64Size = base64DataUrl.length
    console.log('[截图→AI] 步骤2/5 ✓ Base64转换完成', {
      Base64长度: `${(base64Size / 1024).toFixed(2)} KB`,
      压缩比: `${((base64Size / blob.size) * 100).toFixed(1)}%`
    })
    
    // 步骤3：打开对话面板并切换到AI问答Tab
    console.log('[截图→AI] 步骤3/5 📂 打开对话面板...')
    chatPanelVisible.value = true
    activeTab.value = 'ai-chat'
    console.log('[截图→AI] 步骤3/5 ✓ 对话面板已打开', {
      当前Tab: 'AI问答',
      面板可见: chatPanelVisible.value
    })
    
    // 步骤4：创建临时图片以获取宽高
    console.log('[截图→AI] 步骤4/5 🖼️ 加载图片获取尺寸...')
    const img = new Image()
    img.src = base64DataUrl
    
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
    })
    
    console.log('[截图→AI] 步骤4/5 ✓ 图片加载完成', {
      宽度: `${img.width}px`,
      高度: `${img.height}px`,
      分辨率: `${img.width}x${img.height}`,
      像素总数: `${(img.width * img.height / 1000000).toFixed(2)}M`
    })
    
    // 步骤5：使用exerciseStore直接发送图片消息给AI
    // 流程：文件名使用.jpg后缀（与安卓原生保持一致）
    const fileName = `screenshot-${Date.now()}.jpg`
    console.log('[截图→AI] 步骤5/5 📤 发送图片到AI...', {
      文件名: fileName,
      AI类型: 'ai-textbook',
      AI模型: 'mate',
      消息类型: '纯图片消息（无文本）',
      说明: '教材模式下无需选择题目',
      Base64长度: base64DataUrl.length,
      Base64前缀: base64DataUrl.substring(0, 50),
      图片尺寸: `${img.width}x${img.height}`,
      图片格式: 'JPEG (质量40%)'
    })
    
    // 🔍 调试：打印即将发送的数据预览
    console.log('[截图→AI] 🔍 请求数据预览:', {
      content: '',
      type: 'ai',
      chatRole: 'mate',
      imageData: {
        filePath: fileName,
        base64Length: base64DataUrl.length,
        format: base64DataUrl.substring(0, 30)
      },
      aiType: 'ai-textbook'
    })
    
    await exerciseStore.sendChatMessage(
      '', // 空文本，只发送图片
      'ai', // 发送给AI
      'mate', // 使用默认AI模型
      {
        filePath: fileName,
        base64DataUrl: base64DataUrl
      },
      false, // 不隐藏前缀
      'ai-textbook' // AI教材类型
    )
    
    const endTime = Date.now()
    const duration = endTime - startTime
    console.log('[截图→AI] 步骤5/5 ✓ AI发送完成')
    console.log('[截图→AI] 🎉 ========== 截图处理完成 ==========', {
      总耗时: `${duration}ms`,
      成功状态: '✅ 成功'
    })
  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime
    console.error('[截图→AI] ❌ ========== 处理失败 ==========', {
      错误信息: error,
      失败位置: '截图处理流程',
      已耗时: `${duration}ms`
    })
  }
}

// 生命周期
onMounted(async () => {
  try {
    const file = await loadFileFromRoute()
    await store.loadPdf(file)
  } catch (err) {
    console.error('PDF 加载失败:', err)
  }
})

// 页面卸载前立即保存笔记
onBeforeUnmount(async () => {
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
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
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
  color: #1976D2;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
  font-weight: 500;
}

.tab-active:hover {
  background: white;
  color: #1976D2;
}

.tab-active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #1976D2;
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

.virtual-scroll {
  height: 100%;
  width: 100%;
}

.pdf-page-item {
  display: flex;
  justify-content: center;
  padding: 10px 0;
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

.loading-state,
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
    display: none; /* 移动端只显示图标 */
  }
  
  .tab-list {
    padding: 2px;
  }
}
</style>
