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
        @click="emit('close')"
        class="close-button"
      />
    </div>

    <!-- Tab 内容区域 -->
    <div class="chat-content-container">
      <!-- AI 问答 Tab -->
      <div v-show="activeTab === 'ai-chat'" class="tab-content">
        <ChatView
          ref="chatViewRef"
          type="ai-exercise"
          :compressed-height="360"
          :question="question"
          :hide-ask-teacher-icon="false"
          :toolbar-tools="toolbarToolNames"
          @scroll-to-bottom="emit('scroll-to-bottom')"
          @send-message="emit('send-message', $event)"
          @open-teacher-dialog="handleOpenTeacherDialog"
          @switch-to-teacher="handleSwitchToTeacher"
          @paste-to-draft="emit('paste-to-draft', $event)"
          @screenshot-click="handleScreenshotClick"
          @request-screenshot="handleRequestScreenshot"
          @new-session-click="handleAddSessionClick"
        />
      </div>
      <!-- 会话记录 Tab -->
      <div v-show="activeTab === 'question-record'" class="tab-content">
        <div class="session-list-wrapper">
          <SessionList
            :records="sessions"
            :selectedRecordId="selectedRecordId"
            @screenshot-click="handleSessionClick"
            @record-delete="handleSessionDelete"
            @record-pin="handleSessionPin"
            @batch-delete="handleBatchDelete"
            :showHeader="false"
          />
        </div>
      </div>
    </div>

    <!-- 全局聊天对话框 -->
    <GlobalChatDialog v-model="showGlobalChatDialog" :entry="globalChatEntry" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onMounted, onUnmounted, type ComponentPublicInstance } from 'vue'
import { CHAT_TAB_OPTIONS } from '../constants/options'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useScreenSnapshot } from '@/composables/useScreenSnapshot'
import { showMessage } from '../utils'
import ChatView from '@/components/ChatView.vue'
import SessionList from '@/components/SessionList.vue'
import GlobalChatDialog from '@/components/dialog/GlobalChatDialog.vue'
import type { AiTextbookSession, ChatEntry, ExerciseItem } from '@/types'
import type { BuiltinToolType } from '../types/toolbarTools'

const props = defineProps<{
  // 当前题目
  question?: ExerciseItem | null
  // 会话数据
  sessions?: AiTextbookSession[]
}>()

const emit = defineEmits<{
  'scroll-to-bottom': []
  'send-message': [message: string]
  'open-teacher-dialog': [data: { sessionId: string; message?: any }]
  'switch-to-teacher': [forwardData: {
    messages?: any[]
    currentQuestion?: unknown
    additionalMessage?: string
    forwardMode?: string
    successCount?: number
    sessionId?: string
  }]
  'paste-to-draft': [payload: any]
  'session-click': [record: AiTextbookSession]
  'add-session': []
  'close': []
}>()

const aiExerciseStore = useAiExerciseChatStore()

// ChatView 实例引用
const chatViewRef = ref<ComponentPublicInstance | null>(null)

// 工具栏工具配置 - 极简版：只传工具名称字符串数组
const toolbarToolNames: BuiltinToolType[] = ['screenshot', 'formula', 'ask-teacher', 'new-session']

// 截图工具
const { captureScreenSnapshot } = useScreenSnapshot()

// Tab 状态
const activeTab = ref<'ai-chat' | 'question-record'>('ai-chat')

// Tab 选项
const tabOptions = CHAT_TAB_OPTIONS as Array<{ label: string; value: 'ai-chat' | 'question-record' }>

// 选中的会话ID
const selectedRecordId = ref<string | undefined>(undefined)

// 全局聊天对话框显示状态
const showGlobalChatDialog = ref(false)

const globalChatEntry = ref<ChatEntry | undefined>(undefined)

// 计算本地会话数据 - 将 ExerciseSession 转换为 AiTextbookSession 格式
const sessions = computed<AiTextbookSession[]>(() => {
  const sourceSessions = props.sessions || aiExerciseStore.sessions || []
  // 转换格式以兼容 SessionList 组件
  return sourceSessions.map((s: any) => ({
    sessionId: s.id,
    sessionName: s.title,
    createTime: s.createdAt,
    updateTime: s.updatedAt,
    // 保留原始字段以便兼容
    ...s,
  }))
})

// 处理会话点击
const handleSessionClick = async (record: AiTextbookSession) => {
  selectedRecordId.value = record.id || record.sessionId
  // 切换到 AI 问答 Tab
  activeTab.value = 'ai-chat'
  emit('session-click', record)
  console.log("record",record)
  // 切换到对应会话，加载该会话的消息
  const sessionId = record.id || record.sessionId
  if (sessionId) {
    await aiExerciseStore.switchToSession(sessionId)
  }
  
  await nextTick()
  ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
}

// 处理单条删除
const handleSessionDelete = async (record: AiTextbookSession) => {
  const sessionId = record.id || record.sessionId
  if (!sessionId) return
  const index = aiExerciseStore.sessions.findIndex((s: any) => (s.id || s.sessionId) === sessionId)
  if (index !== -1) {
    aiExerciseStore.sessions.splice(index, 1)
    if (selectedRecordId.value === sessionId) {
      selectedRecordId.value = undefined
    }
    // 如果删除后没有会话了，重置 store 状态
    if (aiExerciseStore.sessions.length === 0) {
      aiExerciseStore.resetState()
    }
  }
}

// 处理批量删除
const handleBatchDelete = async (recordIds: string[]) => {
  aiExerciseStore.sessions = aiExerciseStore.sessions.filter(
    (s: any) => !recordIds.includes(s.id || s.sessionId)
  )
  if (selectedRecordId.value && recordIds.includes(selectedRecordId.value)) {
    selectedRecordId.value = undefined
  }
  // 如果删除后没有会话了，重置 store 状态
  if (aiExerciseStore.sessions.length === 0) {
    aiExerciseStore.resetState()
  }
}

// 处理置顶
const handleSessionPin = async (record: AiTextbookSession) => {
  record.pinned = !record.pinned
}

// 处理截图按钮点击 - 通过 ChatView 的 screenshot-click 触发
const handleScreenshotClick = async () => {
  // 检查是否已选中题目
  if (!props.question) {
    showMessage('请先选择一道题目', 'warning')
    return
  }

  try {
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) return

    // 将截图添加到聊天输入框
    const imageInfo = {
      filePath: '',
      width: width || 0,
      height: height || 0,
      fileSize: Math.round(dataUrl.length * 0.75),
      base64DataUrl: dataUrl,
    }

    // 调用 ChatView 的 onImageSelected 方法添加图片到输入框
    const chatView = chatViewRef.value as any
    if (chatView?.onImageSelected) {
      await chatView.onImageSelected(imageInfo)
    }
  } catch (error) {
    console.error('截图失败:', error)
  }
}

// 处理 ChatView 的截图请求 - ScreenshotInputDialog 点击"添加更多"时触发
const handleRequestScreenshot = async (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => {
  console.log('[ExerciseChatPanel] 处理截图请求:', payload)

  // 检查是否已选中题目
  if (!props.question) {
    showMessage('请先选择一道题目', 'warning')
    return
  }

  if (payload?.kind !== 'screen_snapshot') return

  try {
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) return

    // 将截图添加到 ChatView 输入框
    const chatView = chatViewRef.value as any
    if (chatView?.onImageSelected) {
      await chatView.onImageSelected({
        filePath: '',
        width: width || 0,
        height: height || 0,
        fileSize: Math.round(dataUrl.length * 0.75),
        base64DataUrl: dataUrl,
      })
    }
  } catch (error) {
    console.error('[ExerciseChatPanel] 截图失败:', error)
  }
}

// 处理新增会话按钮点击
const handleAddSessionClick = () => {
  emit('add-session')
}

// 处理打开老师对话框
const handleOpenTeacherDialog = ({ sessionId }: { sessionId: string; message?: any }) => {
  globalChatEntry.value = { mode: 'session', category: 'teacher', sessionId }
  showGlobalChatDialog.value = true
  emit('open-teacher-dialog', { sessionId })
}

// 处理批量转发后切换到老师对话
const handleSwitchToTeacher = (forwardData: {
  messages?: any[]
  currentQuestion?: unknown
  additionalMessage?: string
  forwardMode?: string
  successCount?: number
  sessionId?: string
}) => {
  if (forwardData.sessionId) {
    globalChatEntry.value = { mode: 'session', category: 'teacher', sessionId: forwardData.sessionId }
    showGlobalChatDialog.value = true
    emit('switch-to-teacher', forwardData)
  }
}

// 暴露的方法
defineExpose({
  // 切换到 AI 问答 Tab
  switchToAiChat: () => {
    activeTab.value = 'ai-chat'
  },
  // 切换到会话记录 Tab
  switchToSessionRecord: () => {
    activeTab.value = 'question-record'
  },
  // 获取当前 Tab
  getActiveTab: () => activeTab.value,
  // 获取 ChatView 引用
  getChatViewRef: () => chatViewRef.value,
  // 滚动到指定会话
  scrollToSession: (sessionId: string) => {
    ;(chatViewRef.value as any)?.scrollToSession?.(sessionId)
  },
  // 设置选中的会话ID
  setSelectedRecordId: (id: string | undefined) => {
    selectedRecordId.value = id
  },
})
</script>

<style scoped>
.chat-panel-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #e8e9ff;
  border-radius: 20px 0 0 20px;
  overflow: hidden;
}

/* 聊天面板头部 */
.chat-panel-header {
  background: #e8e9ff;
  padding-top: 10px;
  height: 48px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  position: relative;
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
.tab-item.tab-active {
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
.tab-item.tab-active::after {
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

.chat-content-container {
  flex: 1;
  overflow: hidden;
}

/* PDF 对话面板顶部工具按钮：截图 */
.pdf-toolbar-btn {
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
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

/* 头部右侧操作区 */
.header-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 新增会话按钮 */
.add-session-btn {
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.add-session-icon {
  width: 32px;
  height: 32px;
}

/* 关闭按钮 */
.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  color: #393548;
  z-index: 1;
}
</style>
