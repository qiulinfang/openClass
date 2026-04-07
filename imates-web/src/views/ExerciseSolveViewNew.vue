<template>
  <div class="exercise-solve-container">
    <!-- 核心工作区 -->
    <div class="exercise-body">
      <SplitPanel
        ref="splitPanelRef"
        :initial-mode="mode"
        :left-config="[36, 30, 50]"
        :center-config="[64, 50, 80]"
        :right-config="[36, 36, 60]"
        :transition-duration="0.5"
        :transition-easing="'ease-in-out'"
        :show-splitters="true"
        :splitter-class="mode === 'left' ? 'handle-blue' : 'handle-indigo'"
        @mode-change="handleModeChange"
        @toggle="onToggle"
      >
        <!-- 左侧 Header -->
        <template #left-header>
          <div class="left-header-back" @click="goBack">
            <img :src="goBackIcon" alt="返回" class="back-icon" />
          </div>
        </template>

        <!-- 中间 Header -->
        <template #center-header>
          <div class="center-header-actions">
            <!-- 草稿本工具栏 -->
            <UnifiedToolbar
              v-if="draftBoardRef"
              :tools="draftBoardRef.toolbarTools"
              :selected-tool="draftBoardRef.toolbarSelectedTool"
              :tool-config="draftBoardRef.toolbarToolConfig"
              :tool-states="{ undo: draftBoardRef.canUndo, redo: draftBoardRef.canRedo }"
              variant="browser"
              orientation="horizontal"
              @tool-change="(tool) => draftBoardRef?.handleToolbarToolChange(tool)"
              @config-change="(cfg) => draftBoardRef?.handleToolbarConfigChange(cfg)"
              @undo="draftBoardRef?.undo()"
              @redo="draftBoardRef?.redo()"
              @clear="handleDraftClearClick"
              @insert-image="draftBoardRef?.triggerImageSelect()"
            />
            <CommonSelect
              v-show="mode === 'left'"
              v-model="selectedSubjectFilter"
              :options="SUBJECT_OPTIONS"
              variant="outline"
              class="subject-filter-select"
              style="opacity: 1; transition: opacity 0.5s ease-in-out"
              :class="{ 'hidden-select': mode !== 'left' }"
              @change="onSubjectFilterChange"
            />
          </div>
        </template>
        <!-- 左侧：题目面板 -->
        <template #left="{ isVisible }">
          <div class="panel-bg"></div>
          <div
            class="panel-content"
            :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
            :style="{ width: '100%', minWidth: '300px' }"
          >
            <div class="panel-card problem-card">
              <div class="panel-card-body">
                <QuestionList
                  ref="questionListRef"
                  type="exercise"
                  :show-photo-search="true"
                  :show-send-to-ai="true"
                  :show-question-actions="true"
                  :selected-subject-filter="selectedSubjectFilter"
                  @question-selected="handleQuestionSelected"
                  @start-ai-guidance="handleStartAiGuidance"
                  @open-mini-class="handleOpenMiniClass"
                  @paste-to-draft="handlePasteToDraft"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- 中间：题目内容 + 草稿本 -->
        <template #center="{}">
          <div class="panel-bg"></div>
          <div class="panel-content" :style="{ width: '100%', minWidth: '500px' }">
            <div
              class="panel-card draft-card"
              :class="{ 'draft-mode-left': mode === 'left', 'draft-mode-right': mode === 'right' }"
            >
              <!-- 题目区域（可收缩） -->
              <div
                class="question-image-section"
                :class="{ collapsed: isQuestionImageCollapsed }"
                :style="{ height: isQuestionImageCollapsed ? '20%' : '70%' }"
              >
                <div class="question-image-header">
                  <span class="question-image-title">题目</span>
                  <button class="collapse-btn" @click="toggleQuestionImage">
                    <span class="collapse-icon" :class="{ rotated: isQuestionImageCollapsed }">
                      {{ isQuestionImageCollapsed ? '▼' : '▲' }}
                    </span>
                    {{ isQuestionImageCollapsed ? '展开' : '收起' }}
                  </button>
                </div>
                <div class="question-image-content">
                  <div
                    v-if="questionHtml"
                    class="question-html-content markdown-content"
                    v-html="questionHtml"
                  ></div>
                  <div v-else class="question-image-placeholder">请选择题目以查看内容</div>
                </div>
              </div>
              <!-- 草稿本区域 -->
              <div class="panel-card-body draft-body">
                <DrawingBoardNew
                  ref="draftBoardRef"
                  :showGrid="false"
                  :initial-zoom="70"
                  :show-toolbar="false"
                  @save="handleDraftSave"
                  @clear="handleDraftClearClick"
                />
                <!-- IP 悬浮功能 - 使用 FloatBubble 组件（整体定位） -->
                <FloatBubble
                  toggle-only
                  :class="['textbookip-float', mode === 'left' ? 'float-right' : 'float-left']"
                  @toggle="handleToggle"
                >
                  <img :src="textbookipIcon" alt="textbookip" />
                </FloatBubble>
              </div>
            </div>
          </div>
        </template>

        <!-- 右侧：AI 面板 - 使用 ExerciseChatPanel 组件 -->
        <template #right="{ isVisible }">
          <div
            class="exercise-chat-panel-wrapper"
            :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
            :style="{ width: '100%', minWidth: '300px' }"
          >
            <ExerciseChatPanel
              ref="exerciseChatPanelRef"
              :question="currentQuestion"
              @scroll-to-bottom="scrollToBottom"
              @send-message="handleSendSuggestion"
              @open-teacher-dialog="handleOpenTeacherDialog"
              @switch-to-teacher="handleSwitchToTeacher"
              @paste-to-draft="handlePasteToDraft"
              @request-screenshot="handleRequestScreenshot"
              @screenshot-click="handleOpenScreenCapture"
              @add-session="handleAddSessionCard"
              @close="handleToggle"
            />
          </div>
        </template>
      </SplitPanel>
    </div>

    <!-- 清空草稿确认对话框 -->
    <Dialog
      ref="clearDraftDialogRef"
      title="清除确认"
      :confirmButtonText="'清除'"
      :cancelButtonText="'取消'"
      @confirm="confirmClearDraft"
      @cancel="cancelClearDraft"
    >
      确定要清空当前题目的草稿吗？此操作不可撤销。
    </Dialog>

    <!-- 清除所有会话确认对话框 -->
    <Dialog
      ref="clearAllDialogRef"
      title="清除确认"
      :confirmButtonText="'清除'"
      :cancelButtonText="'取消'"
      @confirm="confirmClearAllSessions"
      @cancel="cancelClearAllSessions"
    >
      确定要清除当前题目的所有会话吗？此操作不可撤销。
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showMessage } from '@/utils'
import * as htmlToImage from 'html-to-image'
import { useScreenSnapshot } from '@/composables/useScreenSnapshot'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import SplitPanel from '@/components/base/SplitPanel.vue'
import QuestionList from '@/components/QuestionList.vue'
import DrawingBoardNew from '@/components/DrawingBoardNew.vue'
import ExerciseChatPanel from '@/components/ExerciseChatPanel.vue'
import Button from '@/components/base/Button.vue'
import Dialog from '@/components/base/Dialog.vue'
import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
import CommonSelect from '@/components/base/Select.vue'
import FloatBubble from '@/components/base/FloatBubble.vue'
import { SUBJECT_OPTIONS } from '@/constants/subjects'
import { useDraftStore } from '@/stores/draftStore'
import { useQuestionStore } from '@/stores/questionStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { storeToRefs } from 'pinia'
import newSessionIcon from '/icons/new.svg'
import sessionManagerIcon from '/icons/session_manager.svg'
import deleteSessionIcon from '/icons/delete.svg'
import goBackBlackIcon from '/icons/goback_black.svg'
import goBackIcon from '/icons/goback.svg'
import textbookipIcon from '/icons/textbookip.png'
import ipWordIcon from '/icons/ipWord2.svg'
import wodezuodaUnselectIcon from '/icons/wodezuoda_unselect.svg'
import xuebandayiSelectIcon from '/icons/xuebandayi_select.svg'
import questionSearchIcon from '/icons/questionSearch.svg'

// Markdown + 公式渲染工具
const { renderMessageContent } = useMessageRenderer()

// 截图工具
const { captureScreenSnapshot } = useScreenSnapshot()

// 学科过滤相关
const selectedSubjectFilter = ref<string>('') // 空字符串表示显示所有学科

// 学科过滤变化处理
const onSubjectFilterChange = async () => {
  console.log('[ExerciseSolveViewNew] 学科过滤条件改变:', selectedSubjectFilter.value)
}

// Float 气泡菜单配置
const floatMenuItems = computed(() => [
  {
    label: '拍照搜题',
    icon: questionSearchIcon,
  },
])

// 处理 Float 菜单选择
const handleFloatMenuSelect = async (item: { label: string }) => {
  if (item.label === '拍照搜题') {
    // 切换到拍照搜题
    router.push({
      path: '/photo-search',
      query: { subject: 'math' },
    })
  }
}

// 探索遮罩状态
const showExploreOverlay = ref(false)

// 处理探索遮罩点击
const handleExploreOverlayClick = () => {
  showExploreOverlay.value = false
}

// 模式: 'left' = 题目+草稿, 'right' = 草稿+AI
const mode = ref<'left' | 'right'>('left')

// 锁定状态（来自 SplitPanel）
const isLocked = ref(false)

// Refs
const splitPanelRef = ref<InstanceType<typeof SplitPanel> | null>(null)
const questionListRef = ref(null)
const draftBoardRef = ref<InstanceType<typeof DrawingBoardNew> | null>(null)
const exerciseChatPanelRef = ref<InstanceType<typeof ExerciseChatPanel> | null>(null)
const clearAllDialogRef = ref<InstanceType<typeof Dialog> | null>(null)

// Router
const router = useRouter()

// 返回上一页
const goBack = () => {
  router.back()
}

// 对话框状态
const showSessionListPanel = ref(false)

// Store
const draftStore = useDraftStore()
const questionStore = useQuestionStore()
const aiExerciseStore = useAiExerciseChatStore()
const { currentQuestion } = storeToRefs(questionStore)

// 当前题目下是否存在 AI 会话（用于控制"清除会话"按钮可用状态）
const hasAiSessions = computed(() => {
  return Array.isArray(aiExerciseStore.sessions) && aiExerciseStore.sessions.length > 0
})

const currentDraftQuestionId = ref<string | null>(null)
const clearDraftDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
let draftAutoSaveTimer: ReturnType<typeof setTimeout> | null = null
const DRAFT_AUTO_SAVE_DELAY_MS = 800

// 题目相关
const questionHtml = ref('')
const isQuestionImageCollapsed = ref(true) // 默认收起，显示40px

// 切换题目图片展开/收起
const toggleQuestionImage = () => {
  isQuestionImageCollapsed.value = !isQuestionImageCollapsed.value
}

// 切换模式
const handleToggle = () => {
  splitPanelRef.value?.toggle()
}

// SplitPanel 事件
const handleModeChange = (newMode: 'left' | 'right') => {
  mode.value = newMode
}

const onToggle = (newMode: 'left' | 'right') => {
  // 模式切换
}

// 处理题目选择
const handleQuestionSelected = async () => {
  if (!currentQuestion.value) {
    return
  }

  // 先保存当前题目的草稿（如果有）
  if (currentDraftQuestionId.value) {
    await flushDraftAutoSave(currentDraftQuestionId.value)
  }

  // 生成题目 HTML
  const raw = (currentQuestion.value?.question || currentQuestion.value?.title || '').toString()
  questionHtml.value = renderMessageContent(raw)

  await nextTick()

  // 渲染数学公式
  const contentEl = document.querySelector('.question-html-content')
  if (contentEl) {
    await MathJaxUtils.renderMathAndWait(contentEl as HTMLElement)
  }

  // 加载当前题目的草稿
  await loadCurrentDraft()
}

const handleStartAiGuidance = () => {
  // 切换到 AI 模式
  if (mode.value === 'left' && splitPanelRef.value) {
    splitPanelRef.value.toggle()
  }
}

const handleOpenMiniClass = (question: any) => {
  // 打开微课
}

const handlePasteToDraft = (payload: any) => {
  draftBoardRef.value?.pasteImage?.(payload.dataUrl)
}

// 处理草稿本保存事件
const handleDraftSave = async (data: {
  objects: any[]
  history: any[][]
  historyIndex: number
}) => {
  const currentQ = currentQuestion.value
  if (currentQ && currentQ.id) {
    // 验证当前草稿题目ID与选中题目ID是否一致
    if (currentDraftQuestionId.value && currentDraftQuestionId.value !== currentQ.id) {
      return
    }

    await draftStore.saveDraft(currentQ.id, {
      objects: data.objects,
      history: data.history,
      historyIndex: data.historyIndex,
    })
  }
}

// 从画板获取草稿数据
const getDraftDataFromBoard = (): {
  objects: any[]
  history: any[][]
  historyIndex: number
} | null => {
  const board = draftBoardRef.value as any
  if (!board || typeof board.saveData !== 'function') {
    return null
  }
  const data = board.saveData()
  if (!data) return null
  return {
    objects: Array.isArray(data.objects) ? data.objects : [],
    history: Array.isArray(data.history) ? data.history : [],
    historyIndex: typeof data.historyIndex === 'number' ? data.historyIndex : -1,
  }
}

// 立即保存草稿
const saveDraftNow = async (questionId?: string | null) => {
  const currentQ = currentQuestion.value
  const qid = questionId || currentDraftQuestionId.value || currentQ?.id
  if (!qid) {
    return
  }

  // 验证当前题目ID与要保存的题目ID是否一致，避免保存错误题目的数据
  if (currentQ?.id && qid !== currentQ.id) {
    return
  }

  const data = getDraftDataFromBoard()
  if (!data) {
    return
  }

  await draftStore.saveDraft(qid, data)
}

// 调度自动保存
const scheduleDraftAutoSave = () => {
  if (draftAutoSaveTimer) {
    clearTimeout(draftAutoSaveTimer)
    draftAutoSaveTimer = null
  }

  draftAutoSaveTimer = setTimeout(() => {
    draftAutoSaveTimer = null
    saveDraftNow()
  }, DRAFT_AUTO_SAVE_DELAY_MS)
}

// 立即刷新自动保存
const flushDraftAutoSave = async (questionId?: string | null) => {
  if (draftAutoSaveTimer) {
    clearTimeout(draftAutoSaveTimer)
    draftAutoSaveTimer = null
  }
  await saveDraftNow(questionId)
}

// 处理清空草稿按钮点击（来自 DrawingBoardNew 的 clear 事件）
const handleDraftClearClick = () => {
  if (clearDraftDialogRef.value && typeof clearDraftDialogRef.value.openDialog === 'function') {
    clearDraftDialogRef.value.openDialog()
  }
}

// 确认清空草稿（对话框确认按钮回调）
const confirmClearDraft = async () => {
  const currentQ = currentQuestion.value
  if (currentQ?.id) {
    await draftStore.deleteDraft(currentQ.id)
  }

  if (draftBoardRef.value && typeof (draftBoardRef.value as any).clearAll === 'function') {
    ;(draftBoardRef.value as any).clearAll()
  }

  clearDraftDialogRef.value?.closeDialog()
}

// 取消清空草稿对话框
const cancelClearDraft = () => {
  if (clearDraftDialogRef.value && typeof clearDraftDialogRef.value.closeDialog === 'function') {
    clearDraftDialogRef.value.closeDialog()
  }
}

// 加载当前题目的草稿数据
const loadCurrentDraft = async () => {
  const currentQ = currentQuestion.value
  if (!currentQ || !currentQ.id) {
    return
  }

  // 延迟等待草稿本组件渲染完成
  await nextTick()

  try {
    // 先清空画板，避免上一题的数据残留
    if (draftBoardRef.value && typeof (draftBoardRef.value as any).clearAll === 'function') {
      ;(draftBoardRef.value as any).clearAll()
    }

    // 检查是否有草稿数据
    const draft = await draftStore.getDraft(currentQ.id)
    if (draft && draftBoardRef.value) {
      // 加载草稿数据到画板
      const board = draftBoardRef.value as any
      if (typeof board.loadData === 'function') {
        board.loadData({
          objects: draft.objects,
          history: draft.history,
          historyIndex: draft.historyIndex,
        })
      }
    }

    // 关键：在清空旧数据并加载新数据后，再设置 currentDraftQuestionId
    // 防止自动保存验证通过但保存了错误的数据
    currentDraftQuestionId.value = currentQ.id
  } catch (error) {
    console.error('[草稿链路] 草稿加载失败:', error)
  }
}

const scrollToBottom = () => {
  // 滚动到底部
}

// 定义 ChatView 暴露的方法和属性类型
interface ChatViewRef {
  inputMessage: string
  sendMessage: () => void
  addSessionCard: () => void
}

// 处理推荐问题点击：直接发送消息
const handleSendSuggestion = (message: string) => {
  const chatViewRef = exerciseChatPanelRef.value?.getChatViewRef() as ChatViewRef | undefined
  if (chatViewRef?.sendMessage) {
    // 设置输入内容并发送
    chatViewRef.inputMessage = message
    chatViewRef.sendMessage()
  }
}

const handleOpenTeacherDialog = () => {
  // 打开老师对话框
}

const handleSwitchToTeacher = () => {
  // 切换到老师聊天
}

// 确认清除所有会话（对话框确认按钮回调）
const confirmClearAllSessions = async () => {
  await handleClearAllSessions()
  clearAllDialogRef.value?.closeDialog()
}

// 取消清除所有会话对话框
const cancelClearAllSessions = () => {
  if (clearAllDialogRef.value && typeof clearAllDialogRef.value.closeDialog === 'function') {
    clearAllDialogRef.value.closeDialog()
  }
}

// 处理清除所有会话按钮点击
const handleClearAllSessionsClick = () => {
  if (hasAiSessions.value && clearAllDialogRef.value) {
    clearAllDialogRef.value.openDialog()
  }
}

// 新建会话（底部会话管理按钮 / 右上角新增会话按钮复用同一逻辑）
const handleAddSessionCard = async () => {
  const chatViewRef = exerciseChatPanelRef.value?.getChatViewRef() as ChatViewRef | undefined
  if (chatViewRef?.addSessionCard) {
    chatViewRef.addSessionCard()
  }
}

// 清除当前题目的所有 AI 会话（仅前端清除，不调用后端接口）
const handleClearAllSessions = async () => {
  try {
    // 防御：如果没有会话，直接关闭面板
    if (!aiExerciseStore.sessions || aiExerciseStore.sessions.length === 0) {
      exerciseChatPanelRef.value?.switchToAiChat()
      return
    }

    // 仅前端清除会话列表和消息
    aiExerciseStore.sessions = []
    aiExerciseStore.currentSessionId = null
    aiExerciseStore.messages = [] // 清空当前显示的消息

    // 关闭会话管理面板
    if (exerciseChatPanelRef.value) {
      exerciseChatPanelRef.value.switchToAiChat()
    }
  } catch (error) {
    console.error('清除会话失败:', error)
  }
}

// 截图相关
const handleOpenScreenCapture = () => {
  // 调用 ExerciseChatPanel 的方法触发截图
  ;(exerciseChatPanelRef.value as any)?.getChatViewRef()?.requestScreenshot?.()
}

// 截图相关 - 处理截图请求，使用 captureScreenSnapshot 与 MainView 保持一致
const handleRequestScreenshot = async (payload: { kind: 'screen_snapshot' | 'pdf_page' }) => {
  if (payload?.kind !== 'screen_snapshot') return

  try {
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) return

    // 调用 ChatView 的 onImageSelected 触发正常的截图处理流程
    if ((exerciseChatPanelRef.value as any)?.getChatViewRef()?.onImageSelected) {
      await (exerciseChatPanelRef.value as any).getChatViewRef().onImageSelected({
        base64DataUrl: dataUrl,
        filePath: '',
        width: width || 0,
        height: height || 0,
        fileSize: Math.round(dataUrl.length * 0.75), // base64 大致大小估算
      })
    } else {
      showMessage('截图功能暂不可用', 'warning')
    }
  } catch {
    // 静默处理
  }
}

// 页面卸载前保存草稿
window.addEventListener('beforeunload', () => {
  if (currentDraftQuestionId.value) {
    void flushDraftAutoSave(currentDraftQuestionId.value)
  }
})

// 组件卸载前保存草稿（用于路由切换）
onBeforeUnmount(() => {
  if (currentDraftQuestionId.value) {
    void flushDraftAutoSave(currentDraftQuestionId.value)
  }
})

// 页面加载后自动选择第一题
onMounted(async () => {
  // 延迟确保 QuestionList 组件已渲染并有数据
  if (questionListRef.value && typeof (questionListRef.value as any).scrollToQuestionAndSelect === 'function') {
    (questionListRef.value as any).scrollToQuestionAndSelect(0)
    // 手动触发题目选择后的加载逻辑
    await handleQuestionSelected()
  }
})
</script>

<style scoped>
/* 左侧 Header 返回按钮 */
.left-header-back {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
  padding: 0 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.left-header-back:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.left-header-back .back-icon {
  width: 24px;
  height: 24px;
  display: block;
}

/* 主容器 */
.exercise-solve-container {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
}

/* 主体区域 */
.exercise-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Header 样式（在 SplitPanel header slot 中使用） */
.header-left {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
}

.center-header-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.subject-filter-select {
  margin-left: auto;
  margin-right: 0px;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-white {
  color: #fff;
  font-size: 1rem;
}

.title-group .main-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  line-height: 1.2;
  color: #1e293b;
}

.title-group .sub-title {
  font-size: 9px;
  color: #94a3b8;
  margin: 0;
  letter-spacing: 0.1em;
  font-weight: 600;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  background: #f1f5f9;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #64748b;
}

.mode-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  background: #0f172a;
  color: #fff;
  border: none;
  border-radius: 9999px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-toggle-btn:hover:not(:disabled) {
  background: #1e293b;
  transform: scale(1.05);
}

.mode-toggle-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.mode-toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-icon {
  transition: transform 0.5s ease-out;
  display: inline-block;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}
/* 面板内容样式 - 使用普通元素实现渐变背景 */
.panel-content {
  height: 100%;
  position: relative;
  background: #ffffff;
  transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out;
  border-radius: 20px;
  will-change: opacity, transform;
}

/* 背景层 - 替代伪元素 */
.panel-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to right, #0f002e 50%, #ffffff 50%);
  border-radius: 20px;
  z-index: -1;
  opacity: 1;
  transition: opacity 0.5s ease-in-out;
}

/* 隐藏时背景层也隐藏 */
.panel-hidden .panel-bg {
  opacity: 0;
}

.panel-hidden {
  opacity: 0;
  pointer-events: none;
}

.panel-visible {
  opacity: 1;
}

/* 卡片样式 */
.panel-card {
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top-right-radius: 20px;
  transition: border-radius 0.5s ease-in-out;
}

/* AI 面板容器样式 - 使用伪元素实现渐变背景以优化性能 */
.exercise-chat-panel-wrapper {
  height: 100%;
  position: relative;
  transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out;
  will-change: opacity, transform;
}

.exercise-chat-panel-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, #0f002e 0%, #ffffff 70%);
  z-index: -1;
  opacity: 1;
  transition: opacity 0.5s ease-in-out;
}

.exercise-chat-panel-wrapper.panel-hidden::before {
  opacity: 0;
}

.panel-card-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 草稿本动态圆角样式 */
.draft-card {
  transition: border-radius 0.5s ease-in-out;
}

.draft-mode-left {
  border-top-left-radius: 0;
  border-top-right-radius: 20px;
}

.draft-mode-right {
  border-top-left-radius: 20px;
  border-top-right-radius: 0;
}

/* 左侧题目面板圆角 - 除左下角外 */
.problem-card {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 20px;
  transition: border-radius 0.5s ease-in-out;
}

/* 会话底部操作条样式 */
.session-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f7f6ff;
  z-index: 100;
  width: 100%;
}

/* 题目图片区域 */
.question-image-section {
  display: flex;
  flex-direction: column;
  background: #fff;
  transition: height 0.5s ease-in-out;
  overflow: hidden;
}

.question-image-section.collapsed {
  flex-shrink: 0;
}

.question-image-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #ffffff;
  flex-shrink: 0;
}

.question-image-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.collapse-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: color 0.2s;
}

.collapse-btn:hover {
  color: #3b82f6;
}

.collapse-icon {
  transition: transform 0.3s ease;
  display: inline-block;
}

.collapse-icon.rotated {
  transform: rotate(180deg);
}

.question-image-content {
  flex: 1;
  padding: 12px 16px;
  overflow: auto;
  background: #ffffff;
}

.question-html-content {
  width: 100%;
  height: 100%;
}

.question-html-content :deep(img) {
  max-width: 100%;
  height: auto;
}

.question-image-placeholder {
  color: #94a3b8;
  font-size: 14px;
  text-align: center;
}

/* 隐藏的题目渲染容器 */
.question-render-hidden {
  position: fixed;
  top: 0;
  left: 0;
  width: 600px;
  background: #ffffff;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}

.question-render-hidden img {
  max-width: 300px;
  height: auto;
}

/* 截图按钮样式 */
.screenshot-btn {
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.screenshot-icon {
  display: block;
  height: 32px;
  object-fit: contain;
}

/* FloatBubble 悬浮按钮样式 */
.textbookip-float {
  position: absolute;
  bottom: 100px;
  z-index: 100;
  transition: left 0.5s ease-in-out, right 0.5s ease-in-out;
}

/* 做题模式（left）：紧贴草稿本右侧 */
.textbookip-float.float-right {
  right: -70px;
}

/* AI模式（right）：紧贴草稿本左侧 */
.textbookip-float.float-left {
  left: -70px;
}

/* 悬浮按钮图片大小 */
.textbookip-float img {
  width: 135px;
  object-fit: contain;
}

/* AI模式：IP形象带从小到大缩放过渡动画 */
.textbookip-float.float-left img {
  animation: ipScaleIn 0.1s ease-in-out forwards;
  transform: scaleX(-1);
}

@keyframes ipScaleIn {
  0% {
    transform: scaleX(-1) scale(0.75);
  }
  100% {
    transform: scaleX(-1) scale(1);
  }
}
</style>
