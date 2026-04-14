<template>
  <div class="exercise-solve-container">
    <!-- 顶部导航栏 -->
    <header class="exercise-solve-header">
      <!-- 左侧：返回按钮 -->
      <div class="header-left">
        <div class="left-header-back" @click="goBack">
          <img :src="goBackIcon" alt="返回" class="back-icon" />
        </div>
      </div>

      <!-- 中间：工具栏和过滤器 -->
      <div class="header-center">
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
            :show-ask-ai="true"
            @tool-change="(tool) => draftBoardRef?.handleToolbarToolChange(tool)"
            @config-change="(cfg) => draftBoardRef?.handleToolbarConfigChange(cfg)"
            @undo="draftBoardRef?.undo()"
            @redo="draftBoardRef?.redo()"
            @clear="handleDraftClearClick"
            @insert-image="draftBoardRef?.triggerImageSelect()"
            @ask-ai="handleAskAiClick"
          />
        </div>
      </div>

      <!-- 右侧：学科筛选 -->
      <div class="header-right">
        <CommonSelect
          v-model="selectedSubjectFilter"
          :options="SUBJECT_OPTIONS"
          variant="outline"
          class="subject-filter-select"
          style="opacity: 1; transition: opacity 0.5s ease-in-out"
          @change="onSubjectFilterChange"
        />
      </div>
    </header>

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
        <!-- 左侧：题目面板 -->
        <template #left="{ isVisible }">
          <div
            class="panel-bg1"
          >
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
                    @question-deleted="handleQuestionDeleted"
                    @start-ai-guidance="handleStartAiGuidance"
                    @open-mini-class="handleOpenMiniClass"
                    @paste-to-draft="handlePasteToDraft"
                  />
                </div>
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
              >
                <div class="question-image-content">
                  <div
                    v-if="questionHtml"
                    class="question-html-content markdown-content"
                    v-html="questionHtml"
                  ></div>
                  <div v-else class="question-image-placeholder">请选择题目以查看内容</div>
                </div>
              </div>
              <div class="collapse-toggle-btn" @click="toggleQuestionImage">
                <img :src="collapseToggleIcon" alt="toggle" class="collapse-toggle-svg" />
              </div>
              <!-- 草稿本区域 -->
              <div class="panel-card-body draft-body">
                <DrawingBoardNew
                  ref="draftBoardRef"
                  :showGrid="false"
                  :initial-zoom="100"
                  :show-toolbar="false"
                  @save="handleDraftSave"
                  @clear="handleDraftClearClick"
                />
              </div>
            </div>
            <!-- IP 悬浮功能 - 使用 FloatBubble 组件（移到 panel-content 层级避免被裁剪） -->
            <FloatBubble
              toggle-only
              :draggable="true"
              :drag-min-y="-300"
              :drag-max-y="30"
              :class="['textbookip-float', mode === 'left' ? 'float-right' : 'float-left']"
              @toggle="handleToggle"
            >
              <img :src="textbookipIcon" alt="textbookip" />
            </FloatBubble>
          </div>
        </template>

        <!-- 右侧：AI 面板 - 使用 ExerciseChatPanelNew 组件 -->
        <template #right="{ isVisible }">
          <div
            class="panel-bg2"
          >
            <div
              class="panel-content"
              :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
              :style="{ width: '100%', minWidth: '300px' }"
            >
              <div class="panel-card ai-chat-card">
                <div class="panel-card-body">
                  <ExerciseChatPanelNew
                    ref="exerciseChatPanelRef"
                    :question="currentQuestion"
                    :sessions="aiExerciseStore.sessions"
                    :show-close-button="true"
                    @close="handleCloseChatPanel"
                    @scroll-to-bottom="scrollToBottom"
                    @send-message="handleSendSuggestion"
                    @open-teacher-dialog="handleOpenTeacherDialog"
                    @switch-to-teacher="handleSwitchToTeacher"
                    @paste-to-draft="handlePasteToDraft"
                    @add-session="handleAddSessionCard"
                  />
                </div>
              </div>
            </div>
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

  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showMessage } from '@/utils'
import { useScreenSnapshot } from '@/composables/useScreenSnapshot'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import SplitPanel from '@/components/base/SplitPanel.vue'
import QuestionList from '@/components/QuestionList.vue'
import DrawingBoardNew from '@/components/DrawingBoardNew.vue'
import ExerciseChatPanelNew from '@/components/ExerciseChatPanelNew.vue'
import Dialog from '@/components/base/Dialog.vue'
import UnifiedToolbar from '@/components/UnifiedToolbar.vue'
import CommonSelect from '@/components/base/Select.vue'
import FloatBubble from '@/components/base/FloatBubble.vue'
import { SUBJECT_OPTIONS } from '@/constants/subjects'
import { useDraftStore } from '@/stores/draftStore'
import { useQuestionStore } from '@/stores/questionStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { storeToRefs } from 'pinia'
import { useExerciseChatPanel } from '@/composables/useExerciseChatPanel'
import goBackIcon from '/icons/goback.svg'
import textbookipIcon from '/icons/textbookip.png'
import questionSearchIcon from '/icons/questionSearch.svg'
import collapseToggleIcon from '/icons/collapse-toggle-icon.svg'

// Markdown + 公式渲染工具
const { renderMessageContent } = useMessageRenderer()

// ExerciseChatPanelNew 内部已配置工具栏

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

// ExerciseChatPanel 全局状态同步
const { isExerciseChatPanelVisible } = useExerciseChatPanel()
watch(isExerciseChatPanelVisible, (visible) => {
  if (visible && mode.value !== 'right') {
    mode.value = 'right'
    splitPanelRef.value?.toggle?.()
  }
})

// 锁定状态（来自 SplitPanel）
const isLocked = ref(false)

// Refs
const splitPanelRef = ref<InstanceType<typeof SplitPanel> | null>(null)
const questionListRef = ref(null)
const draftBoardRef = ref<InstanceType<typeof DrawingBoardNew> | null>(null)
const exerciseChatPanelRef = ref<InstanceType<typeof ExerciseChatPanelNew> | null>(null)

// Router
const router = useRouter()

// 返回上一页
const goBack = () => {
  router.back()
}

// Store
const draftStore = useDraftStore()
const questionStore = useQuestionStore()
const aiExerciseStore = useAiExerciseChatStore()
const { currentQuestion } = storeToRefs(questionStore)
const { currentSessionId } = storeToRefs(aiExerciseStore)

// 当前题目下是否存在 AI 会话
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
  // 切换到 AI 模式时，自动切换到 AI 问答 Tab
  if (newMode === 'right') {
    exerciseChatPanelRef.value?.switchToAiChat?.()
  }
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

const handlePasteToDraft = async (payload: { dataUrl: string }) => {
  if (!payload?.dataUrl) return
  const board = draftBoardRef.value as any
  if (board && typeof board.insertImageFromDataUrl === 'function') {
    await board.insertImageFromDataUrl(payload.dataUrl)
  }
}

// 处理题目删除（按开关决定是否同步删除草稿）
const handleQuestionDeleted = (payload: { questionId: string; withDraft: boolean }) => {
  if (payload.withDraft) {
    const targetQuestion = questionStore.questions.find(
      (question: any) => (question?.id || '').toString() === payload.questionId
    )
    const questionBmNo = (
      targetQuestion?.bmNo || targetQuestion?.id || payload.questionId || ''
    ).toString()

    const relatedDraftKeys = Array.from(draftStore.drafts.keys()).filter((key: string) =>
      key === payload.questionId ||
      key.startsWith(`${payload.questionId}::`) ||
      key === questionBmNo ||
      key.startsWith(`${questionBmNo}::`)
    )
    if (relatedDraftKeys.length > 0) {
      void draftStore.deleteDrafts(relatedDraftKeys)
    }
  }
}

// 处理草稿本保存事件
const handleDraftSave = async (data: {
  objects: any[]
  history: any[][]
  historyIndex: number
}) => {
  const currentQ = currentQuestion.value
  const currentDraftKey = getCurrentDraftKey()
  if (currentQ && currentDraftKey) {
    // 验证当前草稿键与当前上下文是否一致
    if (currentDraftQuestionId.value && currentDraftQuestionId.value !== currentDraftKey) {
      return
    }

    await draftStore.saveDraft(currentDraftKey, {
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
const saveDraftNow = async (draftKey?: string | null) => {
  const currentQ = currentQuestion.value
  const targetDraftKey = draftKey || currentDraftQuestionId.value || getCurrentDraftKey()
  if (!targetDraftKey) {
    return
  }

  // 验证当前题目标识与要保存的草稿键是否一致，避免保存错误题目的数据
  const questionBmNo = (currentQ?.bmNo || currentQ?.id || '').toString()
  if (questionBmNo && !targetDraftKey.startsWith(`${questionBmNo}::`) && targetDraftKey !== questionBmNo) {
    return
  }

  const data = getDraftDataFromBoard()
  if (!data) {
    return
  }

  await draftStore.saveDraft(targetDraftKey, data)
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
const flushDraftAutoSave = async (draftKey?: string | null) => {
  if (draftAutoSaveTimer) {
    clearTimeout(draftAutoSaveTimer)
    draftAutoSaveTimer = null
  }
  await saveDraftNow(draftKey)
}

// 处理清空草稿按钮点击（来自 DrawingBoardNew 的 clear 事件）
const handleDraftClearClick = () => {
  if (clearDraftDialogRef.value && typeof clearDraftDialogRef.value.openDialog === 'function') {
    clearDraftDialogRef.value.openDialog()
  }
}

// 确认清空草稿（对话框确认按钮回调）
const confirmClearDraft = async () => {
  const currentDraftKey = getCurrentDraftKey()
  if (currentDraftKey) {
    await draftStore.deleteDraft(currentDraftKey)
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
const loadCurrentDraft = async (draftKey?: string | null) => {
  const currentQ = currentQuestion.value
  const targetDraftKey = draftKey || getCurrentDraftKey()
  if (!currentQ || !currentQ.id || !targetDraftKey) {
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
    const draft = await draftStore.getDraft(targetDraftKey)
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
    currentDraftQuestionId.value = targetDraftKey
  } catch (error) {
    console.error('[草稿链路] 草稿加载失败:', error)
  }
}

const buildDraftKey = (questionBmNo?: string | null, sessionId?: string | null) => {
  if (!questionBmNo) {
    return null
  }
  return `${questionBmNo}::${sessionId || 'default'}`
}

const getCurrentDraftKey = () => {
  const questionBmNo = (currentQuestion.value?.bmNo || currentQuestion.value?.id || '').toString()
  return buildDraftKey(questionBmNo, currentSessionId.value)
}

const handleSessionDraftChange = async (nextSessionId?: string | null, previousSessionId?: string | null) => {
  const currentQ = currentQuestion.value
  if (!currentQ?.id) {
    return
  }

  const questionBmNo = (currentQ.bmNo || currentQ.id || '').toString()
  const previousDraftKey = buildDraftKey(questionBmNo, previousSessionId)
  const nextDraftKey = buildDraftKey(questionBmNo, nextSessionId)

  if (previousDraftKey && previousDraftKey === currentDraftQuestionId.value) {
    await flushDraftAutoSave(previousDraftKey)
  }

  await loadCurrentDraft(nextDraftKey)
}

const handleAddSessionCard = async () => {
  const previousSessionId = currentSessionId.value
  const chatView = exerciseChatPanelRef.value?.getChatViewRef?.() as any
  if (chatView?.addSessionCard) {
    await chatView.addSessionCard()
    await handleSessionDraftChange(currentSessionId.value, previousSessionId)
  }
}

const scrollToBottom = () => {
  // 滚动到底部
}

// 处理推荐问题点击：直接发送消息
const handleSendSuggestion = (message: string) => {
  const chatViewRef = exerciseChatPanelRef.value?.getChatViewRef?.() as any
  if (chatViewRef?.sendMessage) {
    // 设置输入内容并发送
    chatViewRef.inputMessage = message
    chatViewRef.sendMessage()
  }
}

const handleCloseChatPanel = () => {
  // 关闭聊天面板，切换回题目模式
  if (mode.value === 'right' && splitPanelRef.value) {
    splitPanelRef.value.toggle()
  }
}

const handleOpenTeacherDialog = () => {
  // 打开老师对话框（由 ExerciseChatPanelNew 内部处理）
}

const handleSwitchToTeacher = () => {
  // 切换到老师聊天（由 ExerciseChatPanelNew 内部处理）
}

// 问AI按钮点击处理 - 直接截图并放入 Chat Input
const handleAskAiClick = async () => {
  try {
    // 1. 直接调用底层安卓原生API截图
    const { dataUrl, width, height } = await captureScreenSnapshot()
    if (!dataUrl) {
      showMessage('截图失败，请重试', 'warning')
      return
    }

    // 2. 显示 AI 面板
    if (mode.value === 'left' && splitPanelRef.value) {
      splitPanelRef.value.toggle()
    }

    // 3. 将截图放入 chat input 截图区域
    nextTick(() => {
      const chatView = exerciseChatPanelRef.value?.getChatViewRef?.() as any
      if (chatView?.onImageSelected) {
        chatView.onImageSelected({
          base64DataUrl: dataUrl,
          filePath: '',
          width: width || 0,
          height: height || 0,
          fileSize: Math.round(dataUrl.length * 0.75),
        })
      } else {
        showMessage('聊天功能暂不可用', 'warning')
      }
    })
  } catch (error) {
    console.error('截图失败:', error)
    showMessage('截图失败，请重试', 'warning')
  }
}

// 截图相关 - 处理截图请求（由 ExerciseChatPanelNew 内部处理截图）

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

watch(currentSessionId, async (nextSessionId, previousSessionId) => {
  if (!currentQuestion.value?.id || nextSessionId === previousSessionId) {
    return
  }

  await handleSessionDraftChange(nextSessionId, previousSessionId)
})

// 页面加载后自动选择第一题
onMounted(async () => {
  // 检查是否需要切换到 AI 模式（从 HtmlPreviewView 返回时）
  if (isExerciseChatPanelVisible.value && mode.value !== 'right') {
    mode.value = 'right'
    await nextTick()
    splitPanelRef.value?.toggle?.()
  }

  // 延迟确保 QuestionList 组件已渲染并有数据
  if (questionListRef.value && typeof (questionListRef.value as any).scrollToQuestionAndSelect === 'function') {
    (questionListRef.value as any).scrollToQuestionAndSelect(0)
    // 手动触发题目选择后的加载逻辑
    await handleQuestionSelected()
  }
})
</script>

<style scoped>
/* 顶部导航栏样式 */
.exercise-solve-header {
  height: 56px;
  flex-shrink: 0;
  background: #0f002e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  box-sizing: border-box;
  z-index: 100;
  color: #ffffff;
}

.header-left {
  display: flex;
  align-items: center;
  flex: 1; /* 使用 flex: 1 而不是固定宽度 */
}

.header-center {
  flex: 0 0 auto; /* 核心工具栏不伸缩，由两侧 flex: 1 挤压到中间 */
  display: flex;
  justify-content: center;
}

.header-right {
  flex: 1; /* 使用 flex: 1 保持对称 */
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-right: 8px;
}

/* 左侧 Header 返回按钮 */
.left-header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 40px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 50%;
}

.left-header-back:hover {
  background-color: rgba(255, 255, 255, 0.1);
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
  border-radius: 20px;
  transition: opacity 0.5s ease-in-out;
}

/* 背景层 - 替代伪元素 */
.panel-bg1 {
  height: 100%;
  background: linear-gradient(to right, #0f002e 4% , #ffffff 6%);
  width: 100%;
}

.panel-bg2 {
  height: 100%;
  background: linear-gradient(to left, #0f002e 4% , #ffffff 6%);
  width: 100%;
}

/* 隐藏时背景层不参与交互 */
.panel-hidden .panel-bg1,
.panel-hidden .panel-bg2 {
  pointer-events: none;
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
  overflow: hidden;
  transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out;
  will-change: opacity, transform;
  border-top-right-radius: 20px; /* 仅右上角圆角 */
}

.exercise-chat-panel-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to left, #0f002e 4%, #ffffff 6%); /* 与 panel-bg1 一致的渐变 */
  z-index: -1;
  opacity: 1;
  transition: opacity 0.5s ease-in-out;
}

.exercise-chat-panel-wrapper.panel-hidden::before {
  opacity: 0;
}

.function-panel {
  position: relative;
  z-index: 1;
  height: 100%;
}

.exercise-chat-card {
  height: 100%;
  background: transparent;
}

.function-content {
  height: 100%;
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
  border-bottom-right-radius: 0;
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

/* 题目图片区域 - 使用 flex 优化动画性能 */
.question-image-section {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid rgba(110, 85, 255, 0.32);
  flex: 7 0 0; /* 默认展开占 70% */
  min-height: 0;
  transition: flex 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  margin: 8px 12px 0 12px;
  position: relative;
  will-change: flex;
  contain: layout paint;
}

.question-image-section.collapsed {
  flex: 0.25 0 0; /* 收起时占约 20% */
}

.question-image-content {
  flex: 1;
  padding: 12px 16px;
  overflow: auto;
  background: #ffffff;
}

.collapse-toggle-btn {
  position: relative;
  top:-1px;
  height: auto;
  width: auto;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  padding: 0;
  align-self: center;
  background: transparent;
}

.collapse-toggle-svg {
  width: 100px;
  height: auto;
  display: block;
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

/* 问AI按钮样式 */
.ask-ai-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  margin-left: 12px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6e55ff 0%, #9b7bff 100%);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ask-ai-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(110, 85, 255, 0.4);
}

.ask-ai-btn:active {
  transform: translateY(0);
}

.ask-ai-icon {
  width: 20px;
  height: 20px;
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

.ai-chat-card {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
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
