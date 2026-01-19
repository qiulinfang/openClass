<template>
  <div class="exercise-solve-container">
    <!-- 顶部工具栏 -->
    <div class="app-header">
      <!-- 左侧返回按钮（从作业作答页跳转过来时显示） -->
      <div v-if="showBackButton" class="toolbar-left">
        <div class="back-btn" @click="goBackToHomework">
          <img :src="goBackIcon" alt="返回" class="back-icon" />
        </div>
      </div>
      <div class="app-toolbar">
        <!-- 居中的功能导航 -->
        <div class="toolbar-center">
          <div class="function-nav">
            <div
              class="nav-item"
              :class="{ active: currentFunction === 'chatAi', disabled: !canUseChatAi }"
              @click="canUseChatAi && (currentFunction = 'chatAi')"
            >
              学伴答疑
            </div>
            <div
              class="nav-item"
              :class="{ active: currentFunction === 'teacherChat', disabled: !canUseTeacherChat }"
              @click="canUseTeacherChat && (currentFunction = 'teacherChat')"
            >
              老师答疑
            </div>
            <div
              class="nav-item active-item"
              :class="{
                active: currentFunction === 'viewAnswer',
                disabled: isFromHomework || !canUseViewAnswer,
              }"
              @click="!isFromHomework && canUseViewAnswer && (currentFunction = 'viewAnswer')"
            >
              查看答案
            </div>
            <div
              class="nav-item"
              :class="{
                active: currentFunction === 'similarQuestion',
                disabled: isFromHomework || !canUseSimilarQuestion,
              }"
              @click="
                !isFromHomework && canUseSimilarQuestion && (currentFunction = 'similarQuestion')
              "
            >
              举一反三
            </div>
          </div>
          <!-- 题目过滤下拉框 -->
          <CommonSelect
            v-if="!isFromHomework"
            v-model="selectedSubjectFilter"
            :options="subjectOptions"
            class="subject-filter-select"
            @change="onSubjectFilterChange"
          />
        </div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
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
                  @update:search-query="searchQuery = $event"
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
                  v-show="currentFunction === 'chatAi'"
                  type="ai-exercise"
                  :compressed-height="327"
                  :question="currentQuestion"
                  @response="handleChatResponse"
                  @scroll-to-bottom="scrollToBottom"
                  @send-message="handleSendSuggestion"
                  @focus-input="handleFocusInput"
                >
                  <!-- 作业场景下，在 ChatInput 头部前缀增加"返回作业"按钮（样式与问老师按钮一致） -->
                  <template #header-prefix v-if="isFromHomework">
                    <button
                      type="button"
                      class="toolbar-btn"
                      @click="goBackToHomework"
                    >
                      <img
                        :src="backToHomeworkIcon"
                        alt="返回作业"
                        class="toolbar-icon"
                      />
                    </button>
                  </template>
                  <!-- 会话面板关闭：仅在 header-suffix 中显示右上角会话管理按钮 -->
                  <template v-if="!aiChatViewRef?.showSessionListPanel" #header-suffix>
                    <button
                      type="button"
                      class="session-toggle-btn"
                      @click="toggleSessionListPanel"
                    >
                      <img :src="sessionManagerIcon" alt="会话管理" class="session-toggle-icon" />
                    </button>
                  </template>

                  <!-- 会话面板打开：使用 header-all 替换 ChatInput 头部整块为会话操作条 -->
                  <template v-else #header-all>
                    <div class="session-bottom-bar">
                      <!-- 返回按钮 -->
                      <button class="session-manager-btn" @click="handleCloseSessionPanel">
                        <img :src="goBackIcon" alt="返回" class="session-manager-icon" />
                        <span class="session-back-text">返回</span>
                      </button>
                      <!-- 新建按钮 -->
                      <button class="session-manager-btn primary" @click="handleAddSessionCard">
                        <img :src="newSessionIcon" alt="新建" class="session-manager-icon" />
                        <span class="session-back-text">新建</span>
                      </button>
                      <!-- 分享按钮 -->
                      <!-- <button class="session-manager-btn" @click="handleShareSession">
                        <img :src="shareIcon" alt="分享" class="session-manager-icon" />
                      </button> -->
                      <!-- 清除会话按钮：删除所有会话（先弹出确认对话框） -->
                      <button
                        class="session-manager-btn"
                        :disabled="!hasAiSessions"
                        @click="hasAiSessions && (showClearAllConfirmDialog = true)"
                      >
                        <img :src="deleteSessionIcon" alt="清除会话" class="session-manager-icon" />
                        <span class="session-back-text">清除会话</span>
                      </button>
                    </div>
                  </template>
                  <!-- 新增会话按钮：仅在 AI 引导答题且已选中题目时显示 -->
                  <template #header-right v-if="currentFunction === 'chatAi' && currentQuestion">
                    <div @click="handleAddSessionCard" class="add-session-btn">
                      <img :src="addSessionIcon" class="add-session-icon" alt="新增会话" />
                    </div>
                  </template>
                </ChatView>

                <!-- 老师聊天界面 -->
                <ChatView
                  ref="teacherChatViewRef"
                  v-show="currentFunction === 'teacherChat'"
                  type="teacher"
                  :compressed-height="327"
                  @open-teacher-dialog="handleOpenTeacherDialog"
                  @switch-to-teacher="handleSwitchToTeacher"
                >
                  <!-- 作业场景下，在 ChatInput 头部前缀增加"返回作业"按钮 -->
                  <template #header-prefix v-if="isFromHomework">
                    <button
                      type="button"
                      class="toolbar-btn"
                      @click="goBackToHomework"
                    >
                      <img
                        :src="backToHomeworkIcon"
                        alt="返回作业"
                        class="toolbar-icon"
                      />
                    </button>
                  </template>
                </ChatView>
                <!-- 答案显示 -->
                <AnswerView v-if="currentFunction === 'viewAnswer'" />

                <!-- 相似题目 -->
                <SimilarQuestionList
                  v-if="currentFunction === 'similarQuestion'"
                  @question-added="handleQuestionAdded"
                />
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
      :initial-teacher-subject="currentSubject"
    />

    <!-- 题目调试面板 - 只在开发场景下显示 -->
    <QuestionDebugPanel v-if="isDev" v-model="showQuestionDebugPanel" />

    <!-- 清除所有会话确认对话框 -->
    <DraggableDialog
      v-model="showClearAllConfirmDialog"
      type="delete"
      :delete-content="'确定要清除当前题目的所有会话吗？此操作不可撤销。'"
      @cancel="showClearAllConfirmDialog = false"
      @confirm="confirmClearAllSessions"
    />
  </div>
</template>

<script setup lang="ts">
// 定义组件名称，便于 keep-alive 缓存和 Vue DevTools 识别
defineOptions({
  name: 'ExerciseSolveView',
})

import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
 import { useRoute, useRouter } from 'vue-router'
 import { useQuestionStore } from '../stores/questionStore'
 import { useHomeworkStore } from '../stores/homeworkStore'
 import { getUserInfo, getSubject } from '../services'
 import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
 import { storeToRefs } from 'pinia'
import { showMessage } from '../utils'
import QuestionList from '../components/QuestionList.vue'
import ChatView from '../components/ChatView.vue'
import AnswerView from '../components/AnswerView.vue'
import SimilarQuestionList from '../components/SimilarQuestionList.vue'
import GlobalChatDialog from '../components/dialog/GlobalChatDialog.vue'
import QuestionDebugPanel from '../components/debug/QuestionDebugPanel.vue'
import DraggableDialog from '../components/base/Modal.vue'
import { useUIStore } from '../stores/uiStore'
import type { ExerciseItem, ChatBubble } from '../types'
import { Subject } from '../types'
import RubberBandList from '../components/base/VirtualList.vue'
import CommonSelect from '../components/base/Select.vue'
import addSessionIcon from '/icons/addsession.png'
import newSessionIcon from '/icons/new.svg'
import goBackIcon from '/icons/goback.svg'
import sessionManagerIcon from '/icons/session_manager.svg'
import shareIcon from '/icons/share.svg'
import deleteSessionIcon from '/icons/delete.svg'
import backToHomeworkIcon from '/icons/backtohomework.svg'

// 第1步：判断是否显示调试功能（仅通过环境变量控制）
// 必须设置 VITE_ENABLE_DEBUG 环境变量来控制调试功能的显示
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

const route = useRoute()
const router = useRouter()
const questionStore = useQuestionStore()
const homeworkStore = useHomeworkStore()
const aiExerciseStore = useAiExerciseChatStore()
const uiStore = useUIStore()

// 从两个 store 解构出各自的 currentQuestion（重命名避免冲突）
const { currentQuestion: exerciseCurrentQuestion, questions } = storeToRefs(questionStore)
const { currentQuestion: homeworkCurrentQuestion, questions: homeworkQuestions } =
  storeToRefs(homeworkStore)

const currentFunction = ref<'chatAi' | 'teacherChat' | 'viewAnswer' | 'similarQuestion' | ''>('')

// 是否处于作业场景：通过路由参数 scene=homework 或 homeworkExercise 路由名判断
const isFromHomework = computed(() => {
  const scene = route.query.scene as string | undefined
  return scene === 'homework' || route.name === 'homeworkExercise'
})

// 统一的 currentQuestion：根据场景选择来源
// - 作业场景：使用 homeworkStore.currentQuestion
// - 习题场景：使用 questionStore.currentQuestion
const currentQuestion = computed(() => {
  return isFromHomework.value ? homeworkCurrentQuestion.value : exerciseCurrentQuestion.value
})

// 是否显示返回按钮（从作业作答页跳转过来时显示）
const showBackButton = computed(() => {
  return isFromHomework.value || route.query.tab === 'chatAi'
})

// 返回作业作答页（选中状态依赖 homeworkStore.currentQuestionIndex）
const goBackToHomework = () => {
  router.back()
}

// 分屏组件模型值（控制左侧题目列表的宽度比例，30%表示左侧占30%）
const splitterModel = ref(30)

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)
// AI ChatView 组件引用（用于控制会话管理面板）
const aiChatViewRef = ref<InstanceType<typeof ChatView> | null>(null)
// 老师 ChatView 组件引用
const teacherChatViewRef = ref<InstanceType<typeof ChatView> | null>(null)
// 橡皮筋下拉刷新容器引用
const rubberBandListRef = ref<InstanceType<typeof RubberBandList> | null>(null)

// GlobalChatDialog 组件引用
const globalChatDialogRef = ref<InstanceType<typeof GlobalChatDialog> | null>(null)
const showUnifiedChatDialog = ref(false)

// 清除所有会话确认对话框
const showClearAllConfirmDialog = ref(false)

// 当前科目（用于 UnifiedChatDialog）- 使用 computed 监听 localStorage 变化
const currentSubject = computed(() => {
  return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
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
const subjectOptions = [
  { label: '全部学科', value: '' },
  { label: '数学', value: 'SUBJECT_MATH' },
  { label: '生物', value: 'SUBJECT_BIOLOGY' },
  { label: '化学', value: 'SUBJECT_CHEMISTRY' },
  { label: '物理', value: 'SUBJECT_PHYSICS' },
  { label: '语文', value: 'SUBJECT_CHINESE' },
  { label: '英语', value: 'SUBJECT_ENGLISH' },
]

// 学科过滤变化处理
const onSubjectFilterChange = () => {
  // 过滤逻辑在 QuestionList 组件内部处理
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

const handleChatResponse = () => {
  // AI回复后的处理逻辑
}

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
  showClearAllConfirmDialog.value = false
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

// 处理聚焦输入框
const handleFocusInput = () => {
  // 触发输入框聚焦（ChatView 内部会处理）
  // 这里可以添加额外逻辑，比如滚动到底部等
}

// 处理从ChatView转发后跳转到老师对话的事件
const handleOpenTeacherDialog = async ({ sessionId }: { sessionId: string; message?: ChatBubble }) => {
  try {
    // 根据当前题目的学科确定对应的教师会话
    let targetSessionId = sessionId

    // 如果没有传入 sessionId，则根据当前题目学科映射到写死会话
    if (!targetSessionId && currentQuestion.value) {
      const subject = currentQuestion.value.subject
      const userId = getUserId() || 'default'
      // 将题目的学科映射到写死会话的 sessionId（包含userId）
      const subjectMapping: Record<string, string> = {
        'SUBJECT_MATH': `teacher_${userId}_math`,
        'SUBJECT_BIOLOGY': `teacher_${userId}_biology`,
        'SUBJECT_CHINESE': `teacher_${userId}_chinese`,
        'SUBJECT_ENGLISH': `teacher_${userId}_english`,
        'SUBJECT_PHYSICS': `teacher_${userId}_physics`,
        'SUBJECT_CHEMISTRY': `teacher_${userId}_chemistry`,
        'SUBJECT_HISTORY': `teacher_${userId}_history`,
        'SUBJECT_GEOGRAPHY': `teacher_${userId}_geography`,
        'SUBJECT_POLITICS': `teacher_${userId}_politics`
      }

      const mappedSessionId = subjectMapping[subject] || `teacher_${userId}_math` // 默认使用数学老师
      targetSessionId = mappedSessionId
    }

    // 切换到老师答疑功能
    currentFunction.value = 'teacherChat'

    // 打开GlobalChatDialog（如果还没打开）
    if (!showUnifiedChatDialog.value) {
      showUnifiedChatDialog.value = true
      // 等待组件挂载
      await nextTick()
    }

    // 设置对应的教师会话
    if (targetSessionId) {
      const allSessions = Object.values(teacherChatStore.loadAllSessions())
      const session = allSessions.find(s => s.sessionId === targetSessionId)
      if (session) {
        teacherChatStore.setSession(session)
      }
    }

    // 切换到教师分类
    if (globalChatDialogRef.value) {
      globalChatDialogRef.value.switchCategory('teacher')
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
    // 如果没有传入 sessionId，则根据当前题目学科映射到写死会话
    let targetSessionId = forwardData?.sessionId

    if (!targetSessionId && currentQuestion.value) {
      const subject = currentQuestion.value.subject
      const userId = getUserId() || 'default'
      // 将题目的学科映射到写死会话的 sessionId（包含userId）
      const subjectMapping: Record<string, string> = {
        'SUBJECT_MATH': `teacher_${userId}_math`,
        'SUBJECT_BIOLOGY': `teacher_${userId}_biology`,
        'SUBJECT_CHINESE': `teacher_${userId}_chinese`,
        'SUBJECT_ENGLISH': `teacher_${userId}_english`,
        'SUBJECT_PHYSICS': `teacher_${userId}_physics`,
        'SUBJECT_CHEMISTRY': `teacher_${userId}_chemistry`,
        'SUBJECT_HISTORY': `teacher_${userId}_history`,
        'SUBJECT_GEOGRAPHY': `teacher_${userId}_geography`,
        'SUBJECT_POLITICS': `teacher_${userId}_politics`
      }

      const mappedSessionId = subjectMapping[subject] || `teacher_${userId}_math` // 默认使用数学老师
      targetSessionId = mappedSessionId
    }

    // 切换到老师答疑功能
    currentFunction.value = 'teacherChat'

    // 打开GlobalChatDialog（如果还没打开）
    if (!showUnifiedChatDialog.value) {
      showUnifiedChatDialog.value = true
      // 等待组件挂载
      await nextTick()
    }

    // 设置对应的教师会话
    if (targetSessionId) {
      const allSessions = Object.values(teacherChatStore.loadAllSessions())
      const session = allSessions.find(s => s.sessionId === targetSessionId)
      if (session) {
        teacherChatStore.setSession(session)
      }
    }

    // 切换到教师分类
    if (globalChatDialogRef.value) {
      globalChatDialogRef.value.switchCategory('teacher')
    }
  } catch (error) {
    console.error('打开老师对话失败:', error)
    showMessage('打开老师对话失败', 'error')
  }
}


const handleStartAiGuidance = async () => {
  // 切换到AI聊天界面
  currentFunction.value = 'chatAi'
}

const handleQuestionSelected = async () => {
  // 切换题目时，关闭 AI 会话管理面板
  if (aiChatViewRef.value && 'showSessionListPanel' in aiChatViewRef.value) {
    ;(aiChatViewRef.value as any).showSessionListPanel = false
  }

  // 第1步：如果当前没有任何功能被选中，自动切换到AI指导模式
  if (!currentFunction.value || !['chatAi', 'teacherChat', 'viewAnswer', 'similarQuestion'].includes(currentFunction.value)) {
    currentFunction.value = 'chatAi'
  }

  // 第2步：如果已选择题目，加载对应题目的聊天记录
  if (currentQuestion.value) {
    // 统一使用 bmNo 作为 AI 题目聊天历史的存储键（无 bmNo 时回退到 id）
    const questionId = currentQuestion.value.bmNo || currentQuestion.value.id
    console.log('[EXERCISE] 选题：', {
      bmNo: currentQuestion.value.bmNo,
      id: currentQuestion.value.id,
      usedKey: questionId,
    })

    // 第3步：根据当前功能类型加载对应题目的聊天记录
    if (currentFunction.value === 'chatAi') {
      // 学伴答疑：加载AI题目的聊天记录
      // 多会话系统：loadChatHistory 会自动加载会话列表和最近活跃的会话
      await aiExerciseStore.loadChatHistory(questionId)

      // 如果没有会话，自动创建一个默认会话（保持原有体验）
      if (aiExerciseStore.sessions.length === 0) {
        await aiExerciseStore.createNewSession(questionId)
      }
    }
    // 老师答疑不需要预加载聊天记录，由ChatView组件处理
  }
}

const handleQuestionAdded = () => {
  // 只刷新题目列表数据，不重新加载整个列表
  if (questionListRef.value) {
    questionListRef.value.refreshQuestions()
  }
}

// 处理下拉刷新（由 RubberBandList 触发）
const handlePullDownRefresh = async () => {
  try {
    if (questionListRef.value && typeof questionListRef.value.refreshQuestions === 'function') {
      await questionListRef.value.refreshQuestions()
    }
  } catch (error) {
    showMessage('刷新失败，请稍后重试', 'error')
  } finally {
    rubberBandListRef.value?.finishRefresh()
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
    // 规范化学科前缀
    const subjectRaw = (question.subject || getSubject() || 'SUBJECT_MATH').toString().toUpperCase()
    let subjectPrefix = 'math'
    if (subjectRaw.includes('BIOLOGY')) subjectPrefix = 'biology'
    else if (subjectRaw.includes('MATH')) subjectPrefix = 'math'
    else if (subjectRaw.includes('CHEMISTRY')) subjectPrefix = 'chemistry'
    else if (subjectRaw.includes('PHYSICS')) subjectPrefix = 'physics'
    else if (subjectRaw.includes('CHINESE')) subjectPrefix = 'chinese'
    else if (subjectRaw.includes('ENGLISH')) subjectPrefix = 'english'

    const classUrl = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`

    // 打印微课链接
    console.log('[微课链接]', classUrl)
    console.log('[微课链接详情]', {
      subjectPrefix,
      bmNo,
      subjectRaw,
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

onMounted(async () => {
  console.log('[ExerciseSolveView] onMounted')
  // 静默初始化，不显示加载状态
  try {
    // 从路由参数中获取 tab 参数，设置当前功能
    const tabParam = route.query.tab as string | undefined
    if (tabParam && ['chatAi', 'teacherChat', 'viewAnswer', 'similarQuestion'].includes(tabParam)) {
      currentFunction.value = tabParam as typeof currentFunction.value
      console.log('[ExerciseSolveView] 从路由参数设置 tab:', tabParam)
    }

    // 从路由参数中获取题目ID（统一使用 query）
    const routeSubject = route.query.subject as string | undefined
    const questionIdsParam = route.query.questionIds as string | undefined
    const questionIdParam = route.query.questionId as string | undefined

    // 作业场景：不做学科推断，也不设置学科筛选（作业题目通常没有 subject 字段）
    // 避免 QuestionList 按 subject 过滤把作业题目全部过滤掉
    let subjectName = 'math'
    let subjectFilterValue: string | null = null

    if (!isFromHomework.value) {
      // 将 Subject 枚举值转换为科目名称
      const subjectMap: Record<string, string> = {
        [Subject.SUBJECT_MATH]: 'math',
        [Subject.SUBJECT_BIOLOGY]: 'biology',
        [Subject.SUBJECT_CHEMISTRY]: 'chemistry',
        [Subject.SUBJECT_PHYSICS]: 'physics',
        [Subject.SUBJECT_CHINESE]: 'chinese',
        [Subject.SUBJECT_ENGLISH]: 'english',
      }

      // 科目名称到筛选面板值的反向映射
      const reverseSubjectMap: Record<string, string> = {
        math: 'SUBJECT_MATH',
        biology: 'SUBJECT_BIOLOGY',
        chemistry: 'SUBJECT_CHEMISTRY',
        physics: 'SUBJECT_PHYSICS',
        chinese: 'SUBJECT_CHINESE',
        english: 'SUBJECT_ENGLISH',
      }

      // 确定要加载的科目
      subjectName = 'math' // 默认使用数学
      subjectFilterValue = null // 筛选面板的值

      if (routeSubject) {
        // 如果路由参数中提供了科目，使用路由参数中的科目
        const routeSubjectUpper = String(routeSubject).toUpperCase()
        subjectName =
          subjectMap[routeSubjectUpper] ||
          subjectMap[routeSubject] ||
          routeSubject.toLowerCase() ||
          'math'

        // 将路由参数中的科目值（如 SUBJECT_BIOLOGY）设置为筛选面板的值
        if (routeSubjectUpper.startsWith('SUBJECT_')) {
          subjectFilterValue = routeSubjectUpper
        } else {
          // 如果不是标准格式，尝试从科目名称反向映射
          subjectFilterValue = reverseSubjectMap[subjectName] || null
        }
      } else {
        // 否则从用户store中获取科目
        const userSubject = getSubject()
        if (userSubject) {
          const userSubjectUpper = String(userSubject).toUpperCase()
          subjectName =
            subjectMap[userSubjectUpper] ||
            subjectMap[userSubject] ||
            userSubject.toLowerCase() ||
            'math'

          // 将用户store中的科目转换为筛选面板的值
          if (userSubjectUpper.startsWith('SUBJECT_')) {
            subjectFilterValue = userSubjectUpper
          } else {
            subjectFilterValue = reverseSubjectMap[subjectName] || null
          }
        }
      }

      // 设置筛选面板的学科过滤下拉框（仅习题场景使用）
      if (subjectFilterValue) {
        selectedSubjectFilter.value = subjectFilterValue
      } else {
        selectedSubjectFilter.value = ''
      }
    } else {
      // 作业场景：不做任何 subject 过滤
      selectedSubjectFilter.value = ''
    }

    // 如果提供了 questionIds 参数，说明是刚添加的题目，需要从服务器刷新
    // 否则优先使用本地数据
    const useLocalFirst = !questionIdsParam

    // 处理题目定位
    let targetQuestionId: string | undefined

    // 获取当前场景下的题目列表（ref）
    const activeQuestionsRef = isFromHomework.value ? homeworkQuestions : questions

    // 习题场景：通过接口 / 本地缓存加载题目
    if (!isFromHomework.value) {
      // 根据筛选面板的学科过滤值决定加载方式
      if (!selectedSubjectFilter.value) {
        // 全部学科：加载所有学科的题目
        await questionStore.fetchAllSubjectsQuestions(useLocalFirst)
      } else {
        // 具体学科：加载指定学科的题目
        await questionStore.fetchQuestions(subjectName, useLocalFirst)
      }
    }

    // 注意：作业场景下不再重新拉取题目，直接使用 MyHomeworkView / HomeworkAnswerView 预先写入的 homeworkStore.questions

    // 当前可用的题目数组
    const activeQuestions = activeQuestionsRef.value

    // 优先使用 questionIds（多个题目，定位到第一个）
    if (questionIdsParam) {
      const questionIds = questionIdsParam.split(',').filter((id) => id.trim())
      if (questionIds.length > 0) {
        targetQuestionId = questionIds[0]
        // 验证这些题目是否在列表中
        const foundIds = questionIds.filter((id) =>
          activeQuestions.some((q) => q.bmNo === id || q.id === id)
        )
        if (foundIds.length < questionIds.length) {
          console.warn('[ExerciseSolveView] ⚠️ 部分题目未在列表中，可能需要等待服务器同步')
          // 如果部分题目未找到，尝试再次从服务器刷新（仅习题场景）
          if (!isFromHomework.value) {
            await questionStore.fetchQuestions(subjectName, false)
            // 刷新后更新本地题目数组
            const refreshedQuestions = questions.value
            const foundIdsAfterRefresh = questionIds.filter((id) =>
              refreshedQuestions.some((q) => q.bmNo === id || q.id === id)
            )
          }
        }
      }
    } else if (questionIdParam) {
      // 使用单个 questionId
      targetQuestionId = questionIdParam
    }

    // 定位到目标题目
    if (targetQuestionId && questionListRef.value) {
      await nextTick()
      // 等待题目列表渲染完成
      await new Promise((resolve) => setTimeout(resolve, 300))

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
  } catch (error) {
    console.error(`[ExerciseSolveView] ❌ 初始化失败:`, error)
  }
})

// 组件卸载时清空习题场景下的当前选中题目
onBeforeUnmount(() => {
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

// 题目过滤下拉框样式（在功能导航中）
.subject-filter-select {
  min-width: 120px;
  max-width: 150px;
  position: absolute;
  right: -12px;
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

.app-header {
  height: $header-height;
  min-height: $header-height;
  max-height: $header-height;
  border-bottom: none;
  box-shadow: none;
  background-color: #0f002e; /* 深紫色背景 */
  flex-shrink: 0;
  position: relative;
}

.app-toolbar {
  height: $header-height;
  min-height: $header-height;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 16px;
}

.toolbar-left {
  position: absolute;
  left: 24px;
  top: 11px;
  z-index: 10;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  background: transparent;
  transition: background-color 0.15s ease;
}

.back-icon {
  width: 25px;
  height: 25px;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.toolbar-center {
  flex: 1;
  display: flex;
  position: relative;
  justify-content: center;
  align-items: center;
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  background-color: #f8f9fa; /* Gemini 风格的整体背景 */
  min-height: 0;
  width: 100%;
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

.function-nav {
  display: flex;
  align-items: center;
}

.nav-item {
  font-size: 14px;
  color: #9792ac; /* 浅灰色文字 */
  cursor: pointer;
  // 用高度+左右 padding 控制宽度，不再让它随文字无限变窄
  position: relative;
  display: inline-flex; /* 以内联块的形式，让背景宽度只包裹内容 */
  align-items: center;
  justify-content: center;
  min-width: 110px; /* 适配你的 sessionbackground.svg 宽度，可按实际调整 */
  height: 36px; /* 对应底图高度，可按实际调整 */
  box-sizing: border-box;
  font-weight: 500;

  // 激活状态 - 使用 sessionbackground.svg 作为背景
  &.active {
    background-image: url('/icons/sessionbackfround.png');
    background-repeat: no-repeat;
    background-size: 100% 100%; // 背景完整铺满 nav-item
    background-position: center;
    color: #504b64;
    font-weight: 600;
    &::after {
      content: '';
      position: absolute;
      bottom: 1px;
      left: 50%;
      transform: translateX(-50%);
      width: 30%;
      height: 3px;
      background: #6e55ff; /* 亮紫色下划线 */
      border-radius: 2px;
    }
    .nav-icon {
      filter: none;
    }
  }
}

// 特殊的激活项（查看答案）样式已包含在 .nav-item.active 中

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

  :deep(.chat-input-area) {
    background-color: #ffffff;
  }
}

.toolbar-btn {
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border: none;
  cursor: pointer;
}

.toolbar-icon {
  display: block;
  height: 32px;
  object-fit: contain;
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

.add-session-icon {
  width: 32px;
  height: 32px;
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

@media (max-width: $mobile-breakpoint) {
  .main-content {
    flex-direction: column !important;
    flex: 1;
    min-height: 0;
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

  .function-nav {
    gap: 12px;
    padding: 0 8px;
  }

  .nav-item {
    font-size: 12px;
    padding: 6px 12px;
  }

  .subject-filter-select {
    min-width: 100px;
    max-width: 120px;

    :deep(.q-field__native) {
      font-size: 12px;
      padding: 6px 10px;
    }
  }
}
</style>
