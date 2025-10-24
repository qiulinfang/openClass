<template>
  <!-- 内容区域和对话面板 -->
  <div class="content-layout">
    <!-- PDF内容区域 -->
    <div class="pdf-viewer-content" :class="{ 'with-chat': chatPanelVisible }">
      <div class="pdf-viewer-container">
        <!-- 工具栏 -->
        <Toolbar @toggle-chat-panel="handleToggleChatPanel" />
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
          <PdfPage :layout="item" :key="item.pageNum" class="pdf-page-item" />
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

     <!-- 分隔条 -->
     <div 
       v-if="chatPanelVisible" 
       class="resizer"
       @mousedown="startResize"
       @touchstart="startResizeTouch"
     ></div>
    
     <!-- 对话面板 -->
     <div v-if="chatPanelVisible" class="chat-panel-container" :style="{ width: chatPanelWidth + 'px' }">
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
           <div class="question-record-content">
             <div class="empty-state">
               <q-icon name="quiz" size="48px" color="grey-5" />
               <div class="q-mt-md text-h6 text-grey-6">问题记录</div>
               <div class="q-mt-sm text-caption text-grey-5">您的问题记录将显示在这里</div>
             </div>
           </div>
         </div>
       </div>
     </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { resourceManager } from '@/services/resource-manager'
import type { UserTextbookInfo, LocalFileInfo } from '@/types'
import Toolbar from '@/components/Toolbar.vue'
import PdfPage from '@/components/PdfPage.vue'
import ChatView from '@/components/ChatView.vue'

// 使用 Store 和路由
const store = usePdfViewerStore()
const route = useRoute()

// 组件状态
const renderProgress = ref({
  current: 0,
  total: 0,
})

// 对话面板状态
const chatPanelVisible = ref(false)
const chatPanelWidth = ref(400) // 对话面板宽度
const isResizing = ref(false) // 是否正在调整大小
const isTouchResizing = ref(false) // 是否正在触摸调整大小
const startX = ref(0) // 开始触摸的X坐标

// Tab 状态
const activeTab = ref('ai-chat') // 当前激活的 tab

// Tab 选项
const tabOptions = [
  { label: '问题记录', value: 'question-record', icon: 'quiz' },
  { label: 'AI问答', value: 'ai-chat', icon: 'chat' }
]

// 计算属性
const pageLayouts = computed(() => store.pageLayouts)
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)

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
const handleToggleChatPanel = (visible: boolean) => {
  chatPanelVisible.value = visible
}

// 处理对话面板关闭
const handleCloseChatPanel = () => {
  chatPanelVisible.value = false
}

// 处理聊天响应事件
const handleChatResponse = () => {
  // 聊天响应完成，可以在这里添加额外逻辑
  console.log('聊天响应完成')
}

// 处理聊天焦点事件
const handleChatFocus = () => {
  // 聊天输入框获得焦点
  console.log('聊天输入框获得焦点')
}

// 处理滚动到底部事件
const handleScrollToBottom = () => {
  // 滚动到底部
  console.log('滚动到底部')
}

// 开始调整大小
const startResize = (e: MouseEvent) => {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

// 处理调整大小
const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  
  const containerWidth = document.querySelector('.content-layout')?.clientWidth || 0
  const newWidth = containerWidth - e.clientX
  
  // 设置最小和最大宽度限制
  const minWidth = 300
  const maxWidth = containerWidth * 0.7 // 最大不超过70%
  
  if (newWidth >= minWidth && newWidth <= maxWidth) {
    chatPanelWidth.value = newWidth
  }
}

// 停止调整大小
const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// 开始触摸调整大小
const startResizeTouch = (e: TouchEvent) => {
  isTouchResizing.value = true
  startX.value = e.touches[0].clientX
  
  document.addEventListener('touchmove', handleResizeTouch, { passive: false })
  document.addEventListener('touchend', stopResizeTouch)
  e.preventDefault()
}

// 处理触摸调整大小
const handleResizeTouch = (e: TouchEvent) => {
  if (!isTouchResizing.value) return
  
  const containerWidth = document.querySelector('.content-layout')?.clientWidth || 0
  const currentX = e.touches[0].clientX
  const deltaX = startX.value - currentX
  const newWidth = chatPanelWidth.value + deltaX
  
  // 设置最小和最大宽度限制
  const minWidth = 300
  const maxWidth = containerWidth * 0.7 // 最大不超过70%
  
  if (newWidth >= minWidth && newWidth <= maxWidth) {
    chatPanelWidth.value = newWidth
    startX.value = currentX // 更新起始位置
  }
  
  e.preventDefault()
}

// 停止触摸调整大小
const stopResizeTouch = () => {
  isTouchResizing.value = false
  document.removeEventListener('touchmove', handleResizeTouch)
  document.removeEventListener('touchend', stopResizeTouch)
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

.pdf-viewer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.3s ease;
}

.chat-panel-container {
  flex-shrink: 0;
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

.question-record-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.resizer {
  width: 8px;
  background: #000000;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  transition: all 0.2s ease;
  touch-action: none; /* 防止触摸时的默认行为 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.resizer::before {
  content: '';
  position: absolute;
  width: 3px;
  height: 45px;
  background: #a29d9d;
  border-radius: 1px;
  transition: all 0.2s ease;
  left: 50%;
  transform: translateX(-50%);
}

.resizer:hover::before {
  background: #888888;
  width: 3px;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.15);
}

.resizer:active::before {
  background: #aaaaaa;
  width: 3px;
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

  .pdf-viewer-content.with-chat {
    width: calc(100% - 300px);
  }

  .resizer {
    width: 10px;
    background: #000000;
  }
  
  .resizer::before {
    width: 3px;
    height: 80px;
    background: #666666;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.1);
    left: 50%;
    transform: translateX(-50%);
  }
  
  .resizer:hover::before,
  .resizer:active::before {
    background: #888888;
    width: 4px;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  }
  
  .chat-panel-container {
    min-width: 250px;
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

@media (max-width: 480px) {
  .pdf-viewer-content.with-chat {
    width: 0;
    overflow: hidden;
  }

  .chat-panel-container {
    width: 100%;
  }
}
</style>
