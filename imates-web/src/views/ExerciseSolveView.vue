<template>
  <div class="exercise-solve-container">
    <!-- 顶部工具栏 -->
    <Toolbar :nav-items="navItems" v-model="currentFunction">
      <template #left>
        <div class="back-btn" @click="goBack">
          <img :src="goBackIcon" alt="返回" class="back-icon" />
        </div>
      </template>
      <template #right>
        <CommonSelect
          v-if="!isFromHomework"
          v-model="selectedSubjectFilter"
          :options="SUBJECT_OPTIONS"
          class="subject-filter-select"
          @change="onSubjectFilterChange"
        />
      </template>
    </Toolbar>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- IP 悬浮功能 - 使用 FloatBubble 组件（整体定位） -->
      <FloatBubble
        :items="floatMenuItems"
        class="textbookip-float"
        @select="handleFloatMenuSelect"
      >
        <img :src="textbookipIcon" alt="textbookip" />
      </FloatBubble>
      <!-- 探索遮罩（参考 PdfChatPanel：在 explore 模式时显示，阻止背后交互） -->
      <div v-if="showExploreOverlay" class="explore-overlay" @click.stop="handleExploreOverlayClick">
        <img :src="ipWordIcon" alt="ipWord" class="explore-icon ipWord" />
      </div>
      <!-- 分屏组件包裹左侧题目列表和右侧功能区域 -->
      <q-splitter v-model="splitterModel" :limits="[20, 50]" class="splitter-container">
        <!-- 左侧题目列表 -->
        <template v-slot:before>
          <div class="question-panel">
            <q-card flat bordered class="full-height">
              <q-card-section class="q-pa-none full-height">
                <QuestionList
                  ref="questionListRef"
                  :type="isFromHomework ? 'homework' : 'exercise'"
                  :show-photo-search="!isFromHomework"
                  :search-query="searchQuery"
                  :selected-subject-filter="selectedSubjectFilter"
                  @start-ai-guidance="handleStartAiGuidance"
                  @question-selected="handleQuestionSelected"
                  @open-mini-class="handleOpenMiniClass"
                  @paste-to-draft="handlePasteToDraft"
                  @update:search-query="searchQuery = $event"
                  @question-deleted="handleQuestionDeleted"
                />
              </q-card-section>
            </q-card>
          </div>
        </template>

        <!-- 分隔条标记 -->
        <template v-slot:separator>
          <div class="splitter-handle">
            <div class="splitter-dots">
              <span class="dot"></span>
            </div>
          </div>
        </template>

        <!-- 右侧功能区域 -->
        <template v-slot:after>
          <div class="function-panel">
            <q-card flat class="full-height">
              <!-- 功能内容区域 -->
              <q-card-section class="function-content q-pa-none">
                <!-- AI聊天界面 -->
                <ChatView
                  ref="aiChatViewRef"
                  v-if="currentFunction === 'chatAi'"
                  type="ai-exercise"
                  :compressed-height="327"
                  :question="currentQuestion"
                  :hide-ask-teacher-icon="isFromHomework"
                  @scroll-to-bottom="scrollToBottom"
                  @send-message="handleSendSuggestion"
                  @open-teacher-dialog="handleOpenTeacherDialog"
                  @switch-to-teacher="handleSwitchToTeacher"
                  @paste-to-draft="handlePasteToDraft"
                >
                  <!-- 会话面板关闭：仅在 header-suffix 中显示右上角会话管理按钮 -->
                  <template v-if="!aiChatViewRef?.showSessionListPanel" #header-suffix>
                    <Button
                      label="会话管理"
                      :icon="sessionManagerIcon"
                      size="sm"
                      variant="outline"
                      @click="toggleSessionListPanel"
                    />
                  </template>

                  <!-- 会话面板打开：使用 header-all 替换 ChatInput 头部整块为会话操作条 -->
                  <template v-else #header-all>
                    <div class="session-bottom-bar">
                      <!-- 返回按钮 -->
                      <Button
                        label="返回"
                        :icon="goBackBlackIcon"
                        size="xs"
                        variant="ghost"
                        @click="handleCloseSessionPanel"
                      />
                      <!-- 新建按钮 -->
                      <Button
                        label="新建"
                        :icon="newSessionIcon"
                        size="xs"
                        variant="primary"
                        @click="handleAddSessionCard"
                      />
                      <!-- 分享按钮 -->
                      <!-- <button class="session-manager-btn" @click="handleShareSession">
                        <img :src="shareIcon" alt="分享" class="session-manager-icon" />
                      </button> -->
                      <!-- 清除会话按钮：删除所有会话（先弹出确认对话框） -->
                      <Button
                        label="清除会话"
                        :icon="deleteSessionIcon"
                        size="xs"
                        variant="danger"
                        :disabled="!hasAiSessions"
                        @click="handleClearAllSessionsClick"
                      />
                    </div>
                  </template>
                </ChatView>
                <!-- 老师聊天界面 -->
                <ChatView
                  ref="teacherChatViewRef"
                  v-if="currentFunction === 'teacherChat'"
                  type="teacher"
                  :compressed-height="327"
                  @switch-to-teacher="handleSwitchToTeacher"
                >
                  <!-- 作业场景下，在 ChatInput 头部前缀增加"返回作业"按钮 -->
                  <template #header-prefix v-if="isFromHomework">
                    <Button
                      label="返回作业"
                      :icon="backToHomeworkIcon"
                      size="sm"
                      variant="ghost"
                      @click="goBack"
                    />
                  </template>
                </ChatView>
                <!-- 答案显示 -->
                <AnswerView v-if="currentFunction === 'viewAnswer'" />

                <!-- 相似题目 -->
                <SimilarQuestionList
                  v-if="currentFunction === 'similarQuestion'"
                  @question-added="handleQuestionAdded"
                />

                <!-- 草稿本（通过 FloatBubble 切换，不使用 tab） -->
                <div v-if="currentFunction === 'draft'" class="draft-board-container">
                  <DrawingBoardNew
                    ref="draftBoardRef"
                    :showGrid="false"
                    :initial-zoom="70"
                    :background-image="draftBackgroundImage"
                    @save="handleDraftSave"
                    @clear="handleDraftClearClick"
                  />
                </div>
              </q-card-section>
            </q-card>
          </div>
        </template>
      </q-splitter>
    </div>

    <!-- GlobalChatDialog - 用于转发消息时打开 -->
    <GlobalChatDialog
      ref="globalChatDialogRef"
      v-model="showUnifiedChatDialog"
      :initial-teacher-subject="currentTeacherSubject"
      :entry="unifiedChatEntry"
    />

    <!-- 题目调试面板 - 只在开发场景下显示 -->
    <QuestionDebugPanel v-if="isDev" v-model="showQuestionDebugPanel" />

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
// 定义组件名称，便于 keep-alive 缓存和 Vue DevTools 识别
defineOptions({
  name: 'ExerciseSolveView',
})

import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch, provide } from 'vue'
 import { useRoute, useRouter } from 'vue-router'
 import { useQuestionStore } from '../stores/questionStore'
 import { useHomeworkStore } from '../stores/homeworkStore'
 import { getUserInfo, getUserId, getSubject } from '../services'
 import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useTeacherChatStore } from '../stores/teacherChatStore'
 import { storeToRefs } from 'pinia'
import { showMessage } from '../utils'
import QuestionList from '../components/QuestionList.vue'
import ChatView from '../components/ChatView.vue'
import AnswerView from '../components/AnswerView.vue'
import SimilarQuestionList from '../components/SimilarQuestionList.vue'
import GlobalChatDialog from '../components/dialog/GlobalChatDialog.vue'
import QuestionDebugPanel from '../components/debug/QuestionDebugPanel.vue'
import Dialog from '../components/base/Dialog.vue'
import Toolbar from '../components/base/Toolbar.vue'
import CommonSelect from '../components/base/Select.vue'
import Button from '../components/base/Button.vue'
import { useUIStore } from '../stores/uiStore'
import type { ExerciseItem, ChatBubble, SceneType } from '../types'
import type { ChatEntry } from '../types/chat'
import RubberBandList from '../components/base/VirtualList.vue'
import FloatBubble from '../components/base/FloatBubble.vue'
import DrawingBoardNew from '../components/drawingBoardNew.vue'
import { SUBJECT_OPTIONS, SUPPORTED_SUBJECTS, normalizeSubject } from '../constants/subjects'
import { useDraftStore } from '../stores/draftStore'
import addSessionIcon from '/icons/addsession.png'
import newSessionIcon from '/icons/new.svg'
import sessionManagerIcon from '/icons/session_manager.svg'
import deleteSessionIcon from '/icons/delete.svg'
import backToHomeworkIcon from '/icons/backtohomework.svg'
import goBackIcon from '/icons/goback.svg'
import goBackBlackIcon from '/icons/goback_black.svg'
import textbookipIcon from '/icons/textbookip.png'
import ipWordIcon from '/icons/ipWord2.svg'
import qipaoIcon from '/icons/qipao_coagao.svg'
import wodezuodaUnselectIcon from '/icons/wodezuoda_unselect.svg'
import xuebandayiSelectIcon from '/icons/xuebandayi_select.svg'
import xuebandayiUnselectIcon from '/icons/xuebandayi_unselect.svg'
import caogaobenSelectIcon from '/icons/caogaoben_select.svg'
import caogaobenUnselectIcon from '/icons/caogaoben_unselect.svg'

// 判断是否显示调试功能（仅通过环境变量控制）
// 必须设置 VITE_ENABLE_DEBUG 环境变量来控制调试功能的显示
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

const route = useRoute()
const router = useRouter()
const questionStore = useQuestionStore()
const homeworkStore = useHomeworkStore()
const aiExerciseStore = useAiExerciseChatStore()
const teacherChatStore = useTeacherChatStore()
const uiStore = useUIStore()

// 从两个 store 解构出各自的 currentQuestion（重命名避免冲突）
const { currentQuestion: exerciseCurrentQuestion, questions } = storeToRefs(questionStore)
const { currentQuestion: homeworkCurrentQuestion, questions: homeworkQuestions } =
  storeToRefs(homeworkStore)

const currentFunction = ref<'chatAi' | 'teacherChat' | 'viewAnswer' | 'similarQuestion' | 'draft' | ''>('')

let draftAutoSaveTimer: ReturnType<typeof setTimeout> | null = null
const DRAFT_AUTO_SAVE_DELAY_MS = 800
const currentDraftQuestionId = ref<string | null>(null)

// 是否处于作业场景：通过路由参数 scene=homework/favorites 或 homeworkExercise 路由名判断
const isFromHomework = computed(() => {
  const scene = route.query.scene as SceneType | undefined
  return scene === 'homework' || route.name === 'homeworkExercise'
})

const showGobakBtn = computed(() => {
  const scene = route.query.scene as SceneType | undefined
  return scene === 'homework' || scene === 'favorites'
})

const showExploreOverlay = ref(false)

// Float 气泡菜单配置
const floatMenuItems = computed(() => {
  if (isFromHomework.value) {
    return [
      { label: '学伴辅导', icon: xuebandayiSelectIcon },
      { label: '我的作答', icon: wodezuodaUnselectIcon },
    ]
  }
  return [
    {
      label: '学伴答疑',
      icon: currentFunction.value === 'chatAi' ? xuebandayiSelectIcon : xuebandayiUnselectIcon,
    },
    {
      label: '草稿本',
      icon: currentFunction.value === 'draft' ? caogaobenSelectIcon : caogaobenUnselectIcon,
    },
  ]
})

const switchFunction = async (
  next: typeof currentFunction.value
) => {
  if (currentFunction.value === 'draft' && next !== 'draft') {
    await flushDraftAutoSave(currentDraftQuestionId.value)
    currentDraftQuestionId.value = null
  }

  currentFunction.value = next

  if (next === 'draft') {
    await loadCurrentDraft()
  }
}

// 处理 Float 菜单选择
const handleFloatMenuSelect = async (item: { label: string }) => {
  if (item.label === '学伴答疑' || item.label === '学伴辅导') {
    // 切换到学伴答疑
    await switchFunction('chatAi')
  } else if (item.label === '草稿本') {
    // 切换到草稿本（不使用 tab，通过 FloatBubble 切换）
    await switchFunction('draft')
  } else if (item.label === '我的作答') {
    if (isFromHomework.value) {
      goBack()
      return
    }
    // 切换到查看答案
    await switchFunction('viewAnswer')
  }
}

const handleExploreOverlayClick = () => {
  showExploreOverlay.value = false
}

// 统一的 currentQuestion：根据场景选择来源
// - 作业场景：使用 homeworkStore.currentQuestion
// - 习题场景：使用 questionStore.currentQuestion
const currentQuestion = computed(() => {
  return isFromHomework.value ? homeworkCurrentQuestion.value : exerciseCurrentQuestion.value
})

// 返回作业作答页（选中状态依赖 homeworkStore.currentQuestionIndex）
const goBack = () => {
  router.back()
}

// 分屏组件模型值（控制左侧题目列表的宽度比例，30%表示左侧占30%）
const splitterModel = ref(30)

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)
// AI ChatView 组件引用（用于控制会话管理面板）
const aiChatViewRef = ref<InstanceType<typeof ChatView> | null>(null)

// 草稿本组件引用
const draftBoardRef = ref<InstanceType<typeof DrawingBoardNew> | null>(null)
const draftBackgroundImage = ref('')
// 草稿数据存储
const draftStore = useDraftStore()

// GlobalChatDialog 组件引用
const globalChatDialogRef = ref<InstanceType<typeof GlobalChatDialog> | null>(null)
const showUnifiedChatDialog = ref(false)
const unifiedChatEntry = ref<ChatEntry>({ mode: 'default', category: 'ai-general' })

// 清除所有会话确认对话框
const clearAllDialogRef = ref<InstanceType<typeof Dialog>>()

// 清空草稿确认对话框
const clearDraftDialogRef = ref<InstanceType<typeof Dialog>>()

// 当前教师聊天学科（用于 GlobalChatDialog）
// 教师聊天目前只支持 math/biology，因此这里做收敛（避免全量学科导致类型不匹配）
const currentTeacherSubject = computed(() => {
  return normalizeSubject(getSubject()) === 'biology' ? 'biology' : 'math'
})

// 当前题目下是否存在 AI 会话（用于控制“清除会话”按钮可用状态）
const hasAiSessions = computed(() => {
  return Array.isArray(aiExerciseStore.sessions) && aiExerciseStore.sessions.length > 0
})

// 题目调试面板显示状态
const showQuestionDebugPanel = ref(false)

// 搜索相关
const searchQuery = ref('')

// 学科过滤相关
const selectedSubjectFilter = ref<string>('') // 空字符串表示显示所有学科

// 学科过滤变化处理
const onSubjectFilterChange = async () => {
  // 学科过滤条件改变时，清除当前功能选择
  await switchFunction('chatAi')


  // 单连接多会话架构：学科切换时不操作WebSocket连接（连接由路由守卫管理）
  if (!isFromHomework.value) {
    console.log('[ExerciseSolveView] 学科过滤条件改变，清除教师聊天记录（连接保持）')
    try {
      teacherChatStore.clearMessages()
      console.log('[ExerciseSolveView] 教师聊天记录已清除（连接保持）')
    } catch (error) {
      console.error('[ExerciseSolveView] 清除教师聊天记录失败:', error)
    }
  }
}

const hasSelectedQuestion = computed(() => {
  return currentQuestion.value !== null
})

// 按钮可用性computed属性
const canUseChatAi = computed(() => hasSelectedQuestion.value)
const canUseTeacherChat = computed(() => {
  // 在作业场景下禁用老师答疑功能
  if (isFromHomework.value) {
    return false
  }
  // 在普通习题场景下，需要选中题目才能使用
  return hasSelectedQuestion.value
})
const canUseViewAnswer = computed(() => {
  return hasSelectedQuestion.value && aiExerciseStore.canViewAnswer
})
const canUseSimilarQuestion = computed(
  () => hasSelectedQuestion.value && aiExerciseStore.canViewAnswer
)

const canUseDraft = computed(() => hasSelectedQuestion.value)

// 导航项配置
const navItems = computed(() => [
  {
    key: currentFunction.value === 'draft' ? 'draft' : 'chatAi',
    label: currentFunction.value === 'draft' ? '草稿本' : '学伴答疑',
    disabled: currentFunction.value === 'draft' ? !canUseDraft.value : !canUseChatAi.value
  },
  {
    key: 'teacherChat',
    label: '老师答疑',
    disabled: !canUseTeacherChat.value
  },
  {
    key: 'viewAnswer',
    label: '查看答案',
    disabled: isFromHomework.value || !canUseViewAnswer.value
  },
  {
    key: 'similarQuestion',
    label: '举一反三',
    disabled: isFromHomework.value || !canUseSimilarQuestion.value
  }
])

// 切换会话管理面板
const toggleSessionListPanel = async () => {
  if (aiChatViewRef.value) {
    const newValue = !aiChatViewRef.value.showSessionListPanel
    aiChatViewRef.value.showSessionListPanel = newValue
  }
}

// 关闭会话管理面板
const handleCloseSessionPanel = () => {
  if (aiChatViewRef.value) {
    aiChatViewRef.value.showSessionListPanel = false
  }
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

// 处理清除所有会话按钮点击
const handleClearAllSessionsClick = () => {
  if (hasAiSessions.value && clearAllDialogRef.value) {
    console.log('[ExerciseSolveView] 调用 openDialog')
    clearAllDialogRef.value.openDialog()
  } else {
    console.log('[ExerciseSolveView] 条件不满足，跳过 openDialog')
  }
}

// 新建会话（底部会话管理按钮 / 右上角新增会话按钮复用同一逻辑）
const handleAddSessionCard = async () => {
  if (aiChatViewRef.value?.addSessionCard) {
    await aiChatViewRef.value.addSessionCard()
  }
}

// 清除当前题目的所有 AI 会话
const handleClearAllSessions = async () => {
  try {
    if (!currentQuestion.value) return
    const questionBmNo = (currentQuestion.value.bmNo || currentQuestion.value.id || '').toString()
    if (!questionBmNo) return

    // 防御：如果没有会话，直接关闭面板
    if (!aiExerciseStore.sessions || aiExerciseStore.sessions.length === 0) {
      if (aiChatViewRef.value) {
        aiChatViewRef.value.showSessionListPanel = false
      }
      return
    }

    // 并行删除：先拍一份当前会话 ID 快照，再使用 Promise.all 同时删除
    const sessionIds = aiExerciseStore.sessions.map((session) => session.id)
    await Promise.all(
      sessionIds.map((sessionId) => aiExerciseStore.deleteSession(sessionId, questionBmNo))
    )

    // 关闭会话管理面板
    if (aiChatViewRef.value) {
      aiChatViewRef.value.showSessionListPanel = false
    }
  } catch (error) {
    console.error('清除会话失败:', error)
  }
}

// 处理推荐问题点击：直接发送消息
const handleSendSuggestion = (message: string) => {
  if (aiChatViewRef.value?.sendMessage) {
    // 设置输入内容并发送
    aiChatViewRef.value.inputMessage = message
    aiChatViewRef.value.sendMessage()
  }
}

// 根据当前题目科目获取教师会话ID的工具函数
const getTeacherSessionBySubject = (): string => {
  const userId = getUserId() || 'default'
  const allSessions = teacherChatStore.loadAllSessions()

  // 获取当前题目的科目
  const currentQuestion = questionStore.currentQuestion
  if (!currentQuestion?.subject) {
    // 默认使用数学老师
    return `teacher_${userId}_math`
  }

  // subject 字段直接是小写的科目名称，如 "math", "biology"
  const subject = currentQuestion.subject.toUpperCase()

  // 根据科目从会话列表中找到对应的会话ID
  for (const [sessionId, session] of Object.entries(allSessions)) {
    if (session.subject === subject) {
      return sessionId
    }
  }

  // 如果找不到对应科目，默认使用数学老师
  return `teacher_${userId}_math`
}

// 处理从ChatView转发后跳转到老师对话的事件
const handleOpenTeacherDialog = async () => {
  try {
    // 切换到老师答疑功能
    await switchFunction('teacherChat')
    const targetSessionId = getTeacherSessionBySubject()
    const activated = await teacherChatStore.activateTeacherSession(targetSessionId)
    if (!activated) {
      console.error('[ExerciseSolveView] 激活教师会话失败:', targetSessionId)
    }
  } catch (error) {
    console.error('打开老师对话失败:', error)
    showMessage('打开老师对话失败', 'error')
  }
}

// 处理批量转发后跳转到老师对话的事件
const handleSwitchToTeacher = async (forwardData?: {
  messages?: ChatBubble[];
  currentQuestion?: unknown;
  additionalMessage?: string;
  forwardMode?: string;
  successCount?: number;
  sessionId?: string;
}) => {
  try {
    // 如果传入了 sessionId，使用传入的会话ID，否则使用当前题目的会话
    let targetSessionId = forwardData?.sessionId

    if (!targetSessionId) {
      targetSessionId = getTeacherSessionBySubject()
    }

    // 切换到老师答疑功能
    await switchFunction('teacherChat')

    const activated = await teacherChatStore.activateTeacherSession(targetSessionId)
    if (!activated) {
      console.error('[ExerciseSolveView] 激活教师会话失败:', targetSessionId)
    }
  } catch (error) {
    console.error('打开老师对话失败:', error)
    showMessage('打开老师对话失败', 'error')
  }
}


const handleStartAiGuidance = async () => {
  // 切换到AI聊天界面
  await switchFunction('chatAi')
}

const handleQuestionSelected = async () => {
  // 切换题目时，关闭 AI 会话管理面板
  if (aiChatViewRef.value && 'showSessionListPanel' in aiChatViewRef.value) {
    ;(aiChatViewRef.value as any).showSessionListPanel = false
  }

  // 草稿本打开状态下切题：先保存旧题草稿，再加载新题草稿
  if (currentFunction.value === 'draft') {
    await flushDraftAutoSave(currentDraftQuestionId.value)
    await loadCurrentDraft()
    return
  }

  // 如果当前没有任何功能被选中，或者处于相似题目/查看答案模式，自动切换到AI指导模式
  if (!currentFunction.value || !['chatAi', 'teacherChat'].includes(currentFunction.value)) {
    await switchFunction('chatAi')
  }

  // 如果已选择题目，加载对应题目的聊天记录
  if (currentQuestion.value) {
    // 统一使用 bmNo 作为 AI 题目聊天历史的存储键（无 bmNo 时回退到 id）
    const questionId = currentQuestion.value.bmNo || currentQuestion.value.id
    console.log('[EXERCISE] 选题：', {
      bmNo: currentQuestion.value.bmNo,
      id: currentQuestion.value.id,
      usedKey: questionId,
    })

    // 根据当前功能类型加载对应题目的聊天记录
    if (currentFunction.value === 'chatAi') {
      // 学伴答疑：加载AI题目的聊天记录
      // 多会话系统：loadChatHistory 会自动加载会话列表和最近活跃的会话
      await aiExerciseStore.loadChatHistory(questionId)

      // 如果没有会话，自动创建一个默认会话（保持原有体验）
      if (aiExerciseStore.sessions.length === 0) {
        await aiExerciseStore.createNewSession(questionId)
      }
    }

    // 在习题场景下，建立教师WebSocket连接（根据题目科目）
    if (!isFromHomework.value) {
      const teacherSessionId = getTeacherSessionBySubject()

      // 检查当前是否已经连接到相同的会话
      const currentSessionId = teacherChatStore.currentSession?.sessionId
      if (currentSessionId === teacherSessionId) {
        console.log('[ExerciseSolveView] 当前已连接到相同教师会话，复用连接:', teacherSessionId)
        return
      }

      // 如果连接到不同的会话，先断开旧连接
      if (currentSessionId && currentSessionId !== teacherSessionId) {
        console.log('[ExerciseSolveView] 切换教师会话，断开旧连接:', currentSessionId)
        try {
          await teacherChatStore.cleanupMessageReceiver()
          teacherChatStore.clearMessages()
          console.log('[ExerciseSolveView] 旧教师连接已断开并清除记录')
        } catch (error) {
          console.error('[ExerciseSolveView] 断开旧教师连接失败:', error)
        }
      }

      // 建立新连接
      const activated = await teacherChatStore.activateTeacherSession(teacherSessionId)
      if (activated) {
        console.log('[ExerciseSolveView] 教师聊天历史加载完成')
      } else {
        console.error('[ExerciseSolveView] 激活教师会话失败:', teacherSessionId)
      }
    }
  }
}

const handleQuestionAdded = () => {
  // 只刷新题目列表数据，不重新加载整个列表
  if (questionListRef.value) {
    questionListRef.value.refreshQuestions()
  }
}

// 保存草稿数据
const handleDraftSave = async (data: { objects: any[]; history: any[][]; historyIndex: number }) => {
  const currentQ = currentQuestion.value
  if (currentQ && currentQ.id) {
    // 验证当前草稿题目ID与选中题目ID是否一致
    if (currentDraftQuestionId.value && currentDraftQuestionId.value !== currentQ.id) {
      return
    }
    
    await draftStore.saveDraft(currentQ.id, {
      objects: data.objects,
      history: data.history,
      historyIndex: data.historyIndex
    })
  }
}

const getDraftDataFromBoard = (): { objects: any[]; history: any[][]; historyIndex: number } | null => {
  const board = draftBoardRef.value as any
  if (!board || typeof board.saveData !== 'function') return null
  const data = board.saveData()
  if (!data) return null
  return {
    objects: Array.isArray(data.objects) ? data.objects : [],
    history: Array.isArray(data.history) ? data.history : [],
    historyIndex: typeof data.historyIndex === 'number' ? data.historyIndex : -1
  }
}

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

const flushDraftAutoSave = async (questionId?: string | null) => {
  if (draftAutoSaveTimer) {
    clearTimeout(draftAutoSaveTimer)
    draftAutoSaveTimer = null
  }
  await saveDraftNow(questionId)
}

// 处理题目删除（按开关决定是否同步删除草稿）
const handleQuestionDeleted = (payload: { questionId: string; withDraft: boolean }) => {
  if (payload.withDraft) {
    draftStore.deleteDraft(payload.questionId)
  }
}

const handlePasteToDraft = async (payload: { dataUrl: string; messageId?: string; questionId?: string }) => {
  if (!payload?.dataUrl) return
  await switchFunction('draft')
  await nextTick()

  const board = draftBoardRef.value as any
  if (board && typeof board.insertImageFromDataUrl === 'function') {
    await board.insertImageFromDataUrl(payload.dataUrl)
  } else {
    draftBackgroundImage.value = payload.dataUrl
  }
}

// 处理打开微课
const handleOpenMiniClass = (question: ExerciseItem) => {
  try {
    // 按学科 + bmNo 动态拼接微课 URL
    const bmNo = (question.bmNo || '').trim()
    if (!bmNo) {
      showMessage('题目编号缺失，无法打开微课', 'warning')
      return
    }
    // 直接使用题目的小写subject作为前缀
    const subjectPrefix = question.subject || 'math'

    const classUrl = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`

    // 打印微课链接
    console.log('[微课链接]', classUrl)
    console.log('[微课链接详情]', {
      subjectPrefix,
      bmNo,
      questionSubject: question.subject,
      questionBmNo: question.bmNo,
      fullUrl: classUrl,
    })

    if (!classUrl || classUrl.trim() === '') {
      showMessage('该题目暂无微课', 'warning')
      return
    }

    // 直接打开微课链接，由 MiniClass 组件内部处理加载错误
    // 移除 Image 检测逻辑，避免 ERR_BLOCKED_BY_ORB 错误
    const questionTitle = question.title || question.question?.substring(0, 50) || ''
    uiStore.openMiniClassDialog(classUrl, questionTitle)
  } catch (error) {
    console.error(`[ExerciseSolveView] 打开微课失败:`, error)
    showMessage('打开微课失败', 'error')
  }
}


// 滚动到页面底部的方法
const scrollToBottom = () => {
  // 使用 nextTick 确保 DOM 更新完成
  nextTick(() => {
    // 获取页面的实际滚动高度
    const getScrollHeight = () => {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight
      )
    }

    const scrollHeight = getScrollHeight()

    // 方法1: 使用 window.scrollTo 滚动到页面底部
    window.scrollTo({
      top: scrollHeight,
      behavior: 'smooth',
    })

    // 方法2: 尝试滚动到视口高度 + 当前滚动位置
    setTimeout(() => {
      const viewportHeight = window.innerHeight
      const currentScroll = window.pageYOffset
      const targetScroll = currentScroll + viewportHeight

      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      })
    }, 100)

    // 方法3: 强制滚动到最大高度
    setTimeout(() => {
      const maxHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight
      )

      window.scrollTo(0, maxHeight)
    }, 300)
  })
}

// 初始化路由参数
const initializeRouteParams = async () => {
  // 从路由参数中获取 tab 参数，设置当前功能
  const tabParam = route.query.tab as string | undefined
  if (tabParam && ['chatAi', 'teacherChat', 'viewAnswer', 'similarQuestion'].includes(tabParam)) {
    await switchFunction(tabParam as typeof currentFunction.value)
    console.log('[ExerciseSolveView] 从路由参数设置 tab:', tabParam)
  }
}

// 处理学科和过滤逻辑
const initializeSubjectAndFilters = () => {
  // 作业场景：不做学科推断，也不设置学科筛选
  if (isFromHomework.value) {
    selectedSubjectFilter.value = ''
    return 'math' // 默认返回数学，但作业场景不使用
  }

  const routeSubject = route.query.subject as string | undefined
  let subjectName = 'math'

  if (routeSubject) {
    // 路由参数：统一归一化为小写
    subjectName = normalizeSubject(routeSubject)
    // 如果不是有效的学科名称，使用默认值
    if (!SUPPORTED_SUBJECTS.includes(subjectName as any)) {
      subjectName = 'math'
    }
  } else {
    // 从用户store获取科目（历史可能是大写/小写/中文），统一归一化
    subjectName = normalizeSubject(getSubject())
  }

  // 设置小写格式的筛选值
  selectedSubjectFilter.value = subjectName

  return subjectName
}

// 加载题目数据
const loadQuestionsData = async (subjectName: string, questionIdsParam?: string) => {
  // 如果提供了 questionIds 参数，说明是刚添加的题目，需要从服务器刷新
  const useLocalFirst = !questionIdsParam

  // 习题场景：通过接口 / 本地缓存加载题目
  if (!isFromHomework.value) {
    if (!selectedSubjectFilter.value) {
      // 全部学科：加载所有学科的题目
      await questionStore.fetchAllSubjectsQuestions(useLocalFirst)
    } else {
      // 具体学科：加载指定学科的题目
      await questionStore.fetchQuestions(subjectName, useLocalFirst)
    }
  }
  // 注意：作业场景下不再重新拉取题目，直接使用预先写入的 homeworkStore.questions
}

// 处理题目定位
const handleQuestionPositioning = async (targetQuestionId?: string) => {
  if (!targetQuestionId || !questionListRef.value) {
    return
  }

  await nextTick()
  // 等待题目列表渲染完成
  await new Promise((resolve) => setTimeout(resolve, 300))

  // 获取当前场景下的题目列表
  const activeQuestions = (isFromHomework.value ? homeworkQuestions : questions).value

  // 在题目列表中查找对应的题目索引
  const targetIndex = activeQuestions.findIndex(
    (q) => q.id === targetQuestionId || q.bmNo === targetQuestionId
  )

  if (targetIndex >= 0) {
    // 等待组件完全渲染后再定位
    await nextTick()
    setTimeout(() => {
      if (
        questionListRef.value &&
        typeof questionListRef.value.scrollToQuestionAndSelect === 'function'
      ) {
        questionListRef.value.scrollToQuestionAndSelect(targetIndex)
      }
    }, 500)
  } else {
    console.warn('[ExerciseSolveView] ⚠️ 未找到目标题目，ID:', targetQuestionId)
  }
}

// 获取目标题目ID
const getTargetQuestionId = (questionIdsParam?: string, questionIdParam?: string) => {
  // 获取当前场景下的题目列表
  const activeQuestions = (isFromHomework.value ? homeworkQuestions : questions).value

  // 优先使用 questionIds（多个题目，定位到第一个）
  if (questionIdsParam) {
    const questionIds = questionIdsParam.split(',').filter((id) => id.trim())
    if (questionIds.length > 0) {
      const targetId = questionIds[0]

      // 验证这些题目是否在列表中
      const foundIds = questionIds.filter((id) =>
        activeQuestions.some((q) => q.bmNo === id || q.id === id)
      )

      if (foundIds.length < questionIds.length) {
        console.warn('[ExerciseSolveView] ⚠️ 部分题目未在列表中，可能需要等待服务器同步')
        // 如果部分题目未找到，尝试再次从服务器刷新（仅习题场景）
        if (!isFromHomework.value) {
          // 这里需要返回一个标志，表示需要重新加载
          return { targetId, needsReload: true }
        }
      }

      return { targetId, needsReload: false }
    }
  } else if (questionIdParam) {
    // 使用单个 questionId
    return { targetId: questionIdParam, needsReload: false }
  }

  return { targetId: undefined, needsReload: false }
}

onMounted(async () => {
  console.log('[ExerciseSolveView] onMounted')

  try {
    const key = 'exerciseSolve.exploreOverlayShown'
    if (localStorage.getItem(key) !== 'true') {
      showExploreOverlay.value = true
      localStorage.setItem(key, 'true')
    }
  } catch (e) {
    // ignore
  }

  try {
    // 步骤1：初始化路由参数
    await initializeRouteParams()

    // 步骤2：处理学科和过滤逻辑
    const subjectName = initializeSubjectAndFilters()

    // 步骤3：从路由参数中获取题目ID
    const questionIdsParam = route.query.questionIds as string | undefined
    const questionIdParam = route.query.questionId as string | undefined

    // 步骤4：加载题目数据
    await loadQuestionsData(subjectName, questionIdsParam)

    // 步骤5：获取目标题目ID并处理定位
    const { targetId, needsReload } = getTargetQuestionId(questionIdsParam, questionIdParam)

    // 如果需要重新加载题目数据
    if (needsReload && targetId && !isFromHomework.value) {
      await questionStore.fetchQuestions(subjectName, false)
    }

    // 步骤6：定位到目标题目
    await handleQuestionPositioning(targetId)
  } catch (error) {
    console.error(`[ExerciseSolveView] ❌ 初始化失败:`, error)
  }
})

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
      draftBoardRef.value.loadData({
        objects: draft.objects,
        history: draft.history,
        historyIndex: draft.historyIndex
      })
    }

    currentDraftQuestionId.value = currentQ.id
  } catch (error) {
    console.error('[ExerciseSolveView] 草稿加载失败:', error)
  }
}

// 组件卸载时清空习题场景下的当前选中题目
onBeforeUnmount(() => {
  if (currentFunction.value === 'draft') {
    flushDraftAutoSave(currentDraftQuestionId.value)
  }
  // 作业场景依赖 homeworkStore.currentQuestionIndex 来在多个页面间保持选中状态
  if (!isFromHomework.value) {
    questionStore.clearCurrentQuestion()
  }
})
</script>

<style lang="scss" scoped>
// SCSS 变量定义
$header-height: 56px;
$border-color: #e5e7eb;
$border-width: 1px;
$scrollbar-width: 6px;
$scrollbar-track-color: #f1f1f1;
$scrollbar-thumb-color: #c1c1c1;
$scrollbar-thumb-hover-color: #a8a8a8;
$border-radius: 3px;
$background-color: #ffffff;
$panel-background: #fafbfc;

// 断点变量
$mobile-breakpoint: 768px;
$tablet-breakpoint: 1024px;
$desktop-breakpoint: 1025px;

// 混入 - 滚动样式
@mixin scrollable-area {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

// 混入 - 自定义滚动条
@mixin custom-scrollbar {
  &::-webkit-scrollbar {
    width: $scrollbar-width;
  }

  &::-webkit-scrollbar-track {
    background: $scrollbar-track-color;
    border-radius: $border-radius;
  }

  &::-webkit-scrollbar-thumb {
    background: $scrollbar-thumb-color;
    border-radius: $border-radius;

    &:hover {
      background: $scrollbar-thumb-hover-color;
    }
  }
}

// 混入 - 全高度布局
@mixin full-height-flex {
  height: 100%;
  display: flex;
  flex-direction: column;
}

// 混入 - 隐藏移动端滚动条
@mixin hide-mobile-scrollbar {
  scrollbar-width: none; // Firefox
  -ms-overflow-style: none; // IE and Edge

  &::-webkit-scrollbar {
    display: none; // Chrome, Safari, Opera
  }
}

// 主要样式
.exercise-solve-container {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}


.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  background-color: #f8f9fa; /* Gemini 风格的整体背景 */
  min-height: 0;
  width: 100%;
  border-radius: 16px 16px 0 0; /* 左上角和右上角圆角 */
  position: relative;
}

/* 探索遮罩层：参考 PdfChatPanel 的 explore-overlay，覆盖 main-content，禁止背后交互 */
.explore-overlay {
  position: absolute;
  inset: 0;
  background: #f9f9ff;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  border-radius: 16px 16px 0 0;
}

// FloatBubble 组件整体定位（右侧 0，底部 30%）
.textbookip-float {
  position: fixed;
  right: calc(-64px + env(safe-area-inset-right, 0px));
  bottom: calc(189px + env(safe-area-inset-bottom, 0px));
  z-index: 1000;
}

.textbookip-float img {
  width: 120px;
  height: auto;
  pointer-events: auto;
  user-select: none;
}

.explore-icon {
  position: absolute;
  width: 194px;
  height: auto;
  pointer-events: none;
  user-select: none;
}

.explore-icon.ipWord {
  right: 5%;
  bottom: 41%;
  width: 225px;
  height: auto;
}

// 分屏容器样式
.splitter-container {
  flex: 1;
  min-height: 0;
  height: 100%;

  :deep(.q-splitter__panel) {
    overflow: hidden;
  }

  :deep(.q-splitter__before) {
    overflow: hidden;
  }

  :deep(.q-splitter__after) {
    overflow: hidden;
  }

  // 分隔条样式
  :deep(.q-splitter__separator) {
    background-color: #f0f0f0;
    cursor: col-resize;
    position: relative;
  }
}

// 分隔条标记样式
.splitter-handle {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.splitter-dots {
  display: flex;
  flex-direction: column;
}

/* 在分隔条上绘制 seekbar 效果（基础状态） */
.splitter-container :deep(.q-splitter__separator)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 10px;
  height: 100%;
  pointer-events: none;
  transform: translateX(-5px);
  background-image: url('/icons/seekbar.svg');
  background-repeat: no-repeat;
  background-position: center center;
  background-size: contain;
}

.question-panel {
  background-color: #f8f9fa; /* Gemini 风格的浅灰背景 */
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .q-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: transparent;
    border: none;
    box-shadow: none;
  }

  .q-card-section {
    flex: 1;
    min-height: 0;
    @include scrollable-area;
    @include custom-scrollbar;
    background-color: transparent;

    :deep(.question-list) {
      height: 100%;
      overflow-y: auto;
    }
  }
}

.function-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff; /* 聊天区域保持白色背景 */
  overflow: hidden;

  .q-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: transparent;
    border: none;
    box-shadow: none;
  }
}


.function-content {
  flex: 1;
  background-color: #ffffff; /* 聊天内容区域白色背景 */
  min-height: 0;
  @include scrollable-area;
  @include custom-scrollbar;
  overflow: hidden;
  /* 移除顶部边框，使用背景色区分 */

  > * {
    height: 100%;
  }

  :deep(.chat-view) {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: $background-color;
  }

  :deep(.chat-messages-container) {
    background-color: $background-color;
  }

  :deep(.chat-messages) {
    flex: 1;
    overflow-y: auto;
  }

  :deep(.answer-view),
  :deep(.similar-question-list) {
    height: 100%;
    overflow-y: auto;
    background-color: $background-color;
  }

  // 草稿本容器样式
  :deep(.draft-board-container) {
    height: 100%;
    width: 100%;
    background-color: #f3f4f6;
  }

  :deep(.chat-input-area) {
    background-color: #ffffff;
  }
}


// 工具类
.full-height {
  height: 100%;
}

:deep(.q-toolbar) {
  border-bottom: $border-width solid $border-color;
}

// 统一滚动条样式
:deep(.q-scrollarea__thumb--v) {
  background-color: $scrollbar-thumb-color;
  border-radius: $border-radius;
  width: $scrollbar-width;
}

:deep(.q-scrollarea__bar--v) {
  background-color: $scrollbar-track-color;
  width: $scrollbar-width;
}

// 过渡效果
.question-panel,
.function-panel {
  transition: all 0.2s ease;
}

// 确保所有边框颜色一致
* {
  border-color: $border-color !important;
}

.session-toggle-btn {
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border: none;
  cursor: pointer;
}

.session-toggle-icon {
  display: block;
  height: 32px;
  object-fit: contain;
}

.toolbar-btn {
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.toolbar-icon {
  display: block;
  height: 32px;
  object-fit: contain;
}

// 会话管理按钮样式
.session-manager-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px; // 图标与文字间距
  padding: 6px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #4b5563;
  font-size: 14px;
  line-height: 1;
}

.session-manager-icon {
  display: block;
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.session-action-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

// 底部会话操作按钮文字（返回 / 新建 / 清除会话）
.session-back-text {
  font-size: 14px;
  line-height: 1;
  color: inherit; // 跟随按钮颜色（普通 / primary）
}

// 清除所有会话确认弹窗内容样式
.delete-confirm-content {
  height: 100%;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  border: none;
}

// 响应式设计
// 会话管理底部按钮栏
.session-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #ffffff;
  z-index: 100;
  width: 100%;
}

.session-bottom-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s ease;

  &:hover {
    color: #3b82f6;
  }

  &:active {
    transform: scale(0.95);
  }

  &.primary {
    color: #3b82f6;
  }

  &.disabled {
    color: #d1d5db;
    cursor: not-allowed;
  }
}

.session-bottom-action-text {
  font-size: 12px;
  font-weight: 500;
}

// 返回按钮样式
.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}

.back-icon {
  width: 25px;
  height: 25px;
}

@media (max-width: $mobile-breakpoint) {
  .main-content {
    flex-direction: column !important;
    flex: 1;
    min-height: 0;
    border-radius: 16px 16px 0 0; /* 左上角和右上角圆角 */
  }

  .splitter-container {
    :deep(.q-splitter) {
      flex-direction: column;
    }
  }

  .question-panel {
    /* 移动端也使用背景色区分，不用边框 */

    .q-card-section {
      @include hide-mobile-scrollbar;
    }
  }

  .function-content {
    @include hide-mobile-scrollbar;
  }

  .back-btn {
    width: 36px;
    height: 36px;
  }

  .back-icon {
    width: 22px;
    height: 22px;
  }
}

// 学科过滤选择器样式
.subject-filter-select {
  min-width: 120px;
  max-width: 150px;

  :deep(.select-trigger) {
    background-color: transparent;
    border: none;
    font-size: 16px;
    font-weight: 400;
    color: #d4d1dd;
    width: 100px;
  }

  :deep(.select-icon-wrapper) {
    color: #d4d1dd;
    font-size: 18px;
    transition: transform 0.2s ease;
  }

  :deep(.select-dropdown) {
    min-width: 120px;
  }

  :deep(.select-icon) {
    filter: brightness(0) invert(1);
  }
}
</style>
