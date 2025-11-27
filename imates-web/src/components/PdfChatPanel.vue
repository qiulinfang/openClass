<template>
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
        @click="handleClose"
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
        >
          <!-- 通过 ChatView 的 header-prefix 插槽引入“选中并问”按钮 -->
          <template #header-prefix>
            <button type="button" class="pdf-toolbar-btn" @click="handleSelectAndAskClick">
              <img :src="selectAndAskIconToUse" alt="选中并问" class="pdf-toolbar-icon" />
            </button>
          </template>
        </ChatView>
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

<script setup lang="ts">
import { ref, onMounted, nextTick, computed, type ComponentPublicInstance } from 'vue'
import { useRoute } from 'vue-router'
import { usePdfViewerStore } from '@/stores/pdfViewerStore'
import { useAiTextbookChatStore } from '@/stores/aiTextbookChatStore'
import ChatView from '@/components/ChatView.vue'
import SessionList from '@/components/SessionList.vue'
import type { AiTextbookSession } from '@/types'
import {
  getScreenshotSessionsByResourceId,
  deleteScreenshotSession,
  batchDeleteScreenshotSessions,
  updateScreenshotSession,
} from '@/utils/storage/screenshotSessions'
import selectAndAskIcon from '/icons/selectAndAsk.svg'
import selectAndAskIconSelected from '/icons/selectAndAsk_select.svg'

const pdfViewerStore = usePdfViewerStore()
const aiTextbookStore = useAiTextbookChatStore()
const route = useRoute()

const emit = defineEmits<{
  'select-and-ask-click': []
}>()

// ChatView 实例引用
const chatViewRef = ref<ComponentPublicInstance | null>(null)

// Tab 状态
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

// Tab 选项
const tabOptions = [
  { label: '会话记录', value: 'question-record', icon: 'quiz' },
  { label: 'AI问答', value: 'ai-chat', icon: 'chat' },
]

// 会话数据
const sessions = ref<AiTextbookSession[]>([])

// 选中的会话ID
const selectedRecordId = ref<string | undefined>(undefined)

// “选中并问”按钮选中状态：与截图工具是否被选中保持一致
const isSelectAndAskSelected = computed(() => pdfViewerStore.selectedTool === 'screenshot')

// 计算当前使用的“选中并问”图标
const selectAndAskIconToUse = computed(() =>
  isSelectAndAskSelected.value ? selectAndAskIconSelected : selectAndAskIcon,
)

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getSessionId = (session: AiTextbookSession): string => {
  return session.sessionId || session.id || ''
}

// 获取当前 resourceId（仅从路由参数获取）
const getCurrentResourceId = (): string | undefined => {
  return (route.query.resourceId as string) || undefined
}

// 加载会话列表
const loadSessions = async () => {
  const currentResourceId = getCurrentResourceId() || ''
  const byResource = await getScreenshotSessionsByResourceId(currentResourceId)
  sessions.value = byResource
  console.log('[会话] 加载(按 resourceId)', { currentResourceId, sessions: sessions.value })
}

// 处理会话点击
const handleSessionClick = async (record: AiTextbookSession) => {
  selectedRecordId.value = getSessionId(record)
  const sessionId = getSessionId(record)

  // 打开对话面板
  pdfViewerStore.openChatPanel()
  // 切换到 AI 问答 Tab
  activeTab.value = 'ai-chat'

  await nextTick()
  ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
}

// 处理会话删除
const handleSessionDelete = async (record: AiTextbookSession) => {
  const sessionId = getSessionId(record)
  const ok = await deleteScreenshotSession(sessionId)
  if (ok) {
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

// 关闭对话面板
const handleClose = () => {
  pdfViewerStore.closeChatPanel()
}

// 处理“选中并问”点击：交给父组件触发截图工具与后续流程
const handleSelectAndAskClick = () => {
  emit('select-and-ask-click')
}

// 对外暴露：供父组件在新增截图会话后刷新列表
onMounted(async () => {
  await loadSessions()
})

defineExpose({
  reloadSessions: loadSessions,
})
</script>

<style scoped>
.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #e8e9ff;
}

/* 聊天面板头部 */
.chat-panel-header {
  background: #e8e9ff;
  padding-top: 10px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

/* Tab 列表 */
.tab-list {
  display: flex;
  gap: 2px;
}

/* 每个 Tab 项 */
.tab-item {
  position: relative;
  padding: 8px 18px;
  color: #a19cb6;
  text-decoration: none;
  font-size: 15px;
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  width: 100px;
}

/* 激活的 Tab 项 */
.tab-active {
  background-image: url('/icons/sessionbackfround.png');
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: center center;
  color: #504b64;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  height: 40px;
  line-height: 24px;
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
  background: #6e55ff;
  border-radius: 2px;
}

/* Tab hover */
.tab-item:hover:not(.tab-active) {
  opacity: 0.85;
  background: transparent;
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548;
  z-index: 1;
}

.chat-content-container {
  flex: 1;
  overflow: hidden;
}

/* PDF 对话面板顶部工具按钮：选中并问 */
.pdf-toolbar-btn {
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.pdf-toolbar-icon {
  display: block;
  height: 32px;
  object-fit: contain;
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
</style>
