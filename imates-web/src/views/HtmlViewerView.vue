<template>
  <!-- HTML内容区域 -->
  <div class="html-viewer-container">
    <!-- 工具栏 -->
    <UnifiedToolbar
      :tools="['back', 'chat']"
      :selected-tool="selectedTool"
      @tool-change="handleToolChange"
      @back="handleGoBack"
      @chat="handleToggleChatPanel"
    />
    
    <!-- HTML内容区域（带对话面板时） -->
    <q-splitter
      v-if="chatPanelVisible"
      v-model="splitterModel"
      :limits="[30, 70]"
      class="full-height"
    >
      <template v-slot:before>
        <div class="html-content-wrapper">
          <!-- iframe 显示 HTML -->
          <iframe
            v-if="!isLoading && !error && htmlContent"
            :src="htmlContentUrl"
            class="html-iframe"
            frameborder="0"
            allowfullscreen
          />
          
          <!-- 加载状态 -->
          <div v-if="isLoading" class="loading-overlay">
            <div class="loading-state text-center q-pa-xl">
              <q-spinner-dots size="50px" color="primary" />
              <div class="q-mt-md">正在加载HTML...</div>
              <div class="q-mt-sm text-caption">请稍候</div>
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
          <div v-if="!isLoading && !error && !htmlContent" class="empty-state">
            <div class="empty-content text-center q-pa-xl">
              <q-icon name="description" size="80px" color="grey-5" />
              <div class="q-mt-md text-h6 text-grey-6">暂无HTML文档</div>
              <div class="q-mt-sm text-caption text-grey-5">请选择或加载HTML文件开始查看</div>
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
              <SessionList 
                :records="questionRecords"
                @record-click="handleQuestionRecordClick"
              />
            </div>
          </div>
        </div>
      </template>
    </q-splitter>
    
    <!-- HTML内容区域（无对话面板时） -->
    <div v-else class="html-content-wrapper full-height">
      <!-- iframe 显示 HTML -->
      <iframe
        v-if="!isLoading && !error && htmlContent"
        :src="htmlContentUrl"
        class="html-iframe"
        frameborder="0"
        allowfullscreen
      />
      
      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-state text-center q-pa-xl">
          <q-spinner-dots size="50px" color="primary" />
          <div class="q-mt-md">正在加载HTML...</div>
          <div class="q-mt-sm text-caption">请稍候</div>
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
      <div v-if="!isLoading && !error && !htmlContent" class="empty-state">
        <div class="empty-content text-center q-pa-xl">
          <q-icon name="description" size="80px" color="grey-5" />
          <div class="q-mt-md text-h6 text-grey-6">暂无HTML文档</div>
          <div class="q-mt-sm text-caption text-grey-5">请选择或加载HTML文件开始查看</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import { resourceManager } from '@/services/resource-storage'
import type { UserTextbookInfo, LocalFileInfo, QuestionRecord } from '@/types'
import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
import ChatView from '@/components/ChatView.vue'
import SessionList from '@/components/SessionList.vue'

// 使用路由
const route = useRoute()
const router = useRouter()

// 使用 AI Store
const aiTextbookStore = useAiTextbookChatStore()

// 组件状态
const isLoading = ref(false)
const error = ref<string | null>(null)
const htmlContent = ref<string | null>(null)
const selectedTool = ref('')
const fileName = ref('')

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

// HTML内容URL（使用Blob URL）
const htmlBlobUrl = ref<string | null>(null)

const htmlContentUrl = computed(() => {
  if (!htmlContent.value) return ''
  
  // 清理旧的URL
  if (htmlBlobUrl.value) {
    URL.revokeObjectURL(htmlBlobUrl.value)
  }
  
  // 创建新的Blob URL
  const blob = new Blob([htmlContent.value], { type: 'text/html' })
  htmlBlobUrl.value = URL.createObjectURL(blob)
  return htmlBlobUrl.value
})

// 处理工具切换
const handleToolChange = (tool: string) => {
  selectedTool.value = tool
}

// 处理返回
const handleGoBack = () => {
  router.back()
}

// 处理对话面板切换
const handleToggleChatPanel = (visible?: boolean) => {
  chatPanelVisible.value = visible !== undefined ? visible : !chatPanelVisible.value
}

// 处理对话面板关闭
const handleCloseChatPanel = () => {
  chatPanelVisible.value = false
}

// 处理聊天响应事件
const handleChatResponse = () => {
  // 聊天响应完成
}

// 处理聊天焦点事件
const handleChatFocus = () => {
  // 聊天输入框获得焦点
}

// 处理滚动到底部事件
const handleScrollToBottom = () => {
  // 滚动到底部
}

// 从路由参数加载文件
const loadFileFromRoute = async () => {
  try {
    // 从路由 query 参数获取文件信息
    const resourceId = route.query.resourceId as string
    const id = route.query.id as string
    console.log('[HtmlViewer] 从路由加载文件:', { resourceId, id })

    if (!resourceId || !id) {
      throw new Error('缺少必要的路由参数: resourceId 和 id')
    }

    // 1. 根据 id 从 IndexedDB 获取教材信息
    const textbook = (await resourceManager.indexedDB.get('textbooks', id)) as UserTextbookInfo
    if (!textbook) {
      throw new Error(`教材 ${id} 不存在`)
    }

    console.log('[HtmlViewer] 找到教材:', textbook)

    // 2. 在教材的 localFiles 中查找对应的文件元数据
    let fileData: Uint8Array | null = null

    if (textbook.localFiles && Array.isArray(textbook.localFiles)) {
      const localFile = textbook.localFiles.find((file: LocalFileInfo) => file.id === resourceId)
      if (localFile) {
        fileName.value = localFile.fileName || 'unknown.html'
        // 从textbook_files表按需读取文件数据
        fileData = await resourceManager.getFileData(id, resourceId)
        if (fileData) {
          console.log('[HtmlViewer] 找到本地文件:', { fileName: fileName.value, fileSize: fileData.length })
        }
      }
    }

    // 3. 如果没有找到本地文件，提示用户先下载
    if (!fileData) {
      console.log('[HtmlViewer] 本地文件不存在，需要先下载')
      throw new Error('文件未下载到本地，请先在资源管理页面下载该文件')
    }

    // 4. 将 Uint8Array 转换为字符串（HTML内容）
    const decoder = new TextDecoder('utf-8')
    const htmlText = decoder.decode(fileData)

    console.log('[HtmlViewer] 文件加载成功:', { fileName: fileName.value, size: htmlText.length })
    return htmlText
  } catch (err) {
    console.error('[HtmlViewer] 从路由加载文件失败:', err)
    throw err
  }
}

// 重试加载
const retry = async () => {
  isLoading.value = true
  error.value = null
  htmlContent.value = null
  
  try {
    const htmlText = await loadFileFromRoute()
    htmlContent.value = htmlText
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载HTML文件失败'
  } finally {
    isLoading.value = false
  }
}

// 生命周期
onMounted(async () => {
  isLoading.value = true
  
  try {
    const htmlText = await loadFileFromRoute()
    htmlContent.value = htmlText
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载HTML文件失败'
  } finally {
    isLoading.value = false
  }
})

// 清理资源
onBeforeUnmount(() => {
  if (htmlBlobUrl.value) {
    URL.revokeObjectURL(htmlBlobUrl.value)
  }
})
</script>

<style scoped>
.html-viewer-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100vh;
  width: 100%;
}

.full-height {
  height: 100%;
  width: 100%;
}

.html-content-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.html-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
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
