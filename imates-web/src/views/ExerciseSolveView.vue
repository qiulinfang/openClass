<template>
  <div class="exercise-solve-container">
    <!-- 顶部工具栏 -->
    <div class="app-header">
      <div class="app-toolbar">
        <!-- 左侧返回按钮（从作业作答页跳转过来时显示） -->
        <div v-if="showBackButton" class="toolbar-left">
          <div class="back-btn" @click="goBackToHomework">
            <img src="/icons/goback.svg" alt="返回" class="back-icon" />
          </div>
        </div>
        <!-- 居中的功能导航 -->
        <div class="toolbar-center">
          <div class="function-nav">
            <div
              class="nav-item"
              :class="{ active: currentFunction === 'chatAi', disabled: !canUseChatAi }"
              @click="canUseChatAi && (currentFunction = 'chatAi')"
            >
              AI引导答题
            </div>
            <div
              class="nav-item"
              :class="{
                active: currentFunction === 'askTeacher',
                disabled: isFromHomework || !canUseAskTeacher,
              }"
              @click="!isFromHomework && canUseAskTeacher && (currentFunction = 'askTeacher')"
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
                  :search-query="searchQuery"
                  :selected-subject-filter="selectedSubjectFilter"
                  @start-ai-guidance="handleStartAiGuidance"
                  @question-selected="handleQuestionSelected"
                  @send-question-to-teacher="handleSendQuestionToTeacher"
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
                  @switch-to-teacher="handleSwitchToTeacher"
                  @open-teacher-dialog="handleOpenTeacherDialog"
                  @scroll-to-bottom="scrollToBottom"
                  @send-message="handleSendSuggestion"
                  @focus-input="handleFocusInput"
                >
                  <template #header-suffix>
                    <!-- 会话管理按钮 -->
                    <button
                      type="button"
                      class="session-manager-btn"
                      @click="toggleSessionListPanel"
                    >
                      <img
                        src="/icons/session_manager.svg"
                        alt="会话管理"
                        class="session-manager-icon"
                      />
                    </button>
                    <!-- 会话管理弹出层 -->
                    <div v-if="aiChatViewRef?.showSessionListPanel" class="session-bottom-bar">
                      <!-- 关闭按钮 -->
                      <button class="session-bottom-action" @click="handleCloseSessionPanel">
                        <img
                          src="/icons/session_manager.svg"
                          alt="会话管理"
                          class="session-action-icon"
                        />
                      </button>
                      <!-- 新建按钮 -->
                      <button class="session-bottom-action primary" @click="handleAddSessionCard">
                        <img src="/icons/new.svg" alt="新建" class="session-action-icon" />
                      </button>
                      <!-- 分享按钮 -->
                      <button class="session-bottom-action" @click="handleShareSession">
                        <img src="/icons/share.svg" alt="分享" class="session-action-icon" />
                      </button>
                    </div>
                  </template>
                </ChatView>

                <!-- 问老师界面 -->
                <ChatView
                  v-show="currentFunction === 'askTeacher'"
                  type="teacher-exercise"
                  :compressed-height="327"
                  :question="currentQuestion"
                  @scroll-to-bottom="scrollToBottom"
                >
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

    <!-- UnifiedChatDialog - 用于转发消息时打开 -->
    <UnifiedChatDialog
      ref="unifiedChatDialogRef"
      v-model="showUnifiedChatDialog"
      :initial-teacher-subject="currentSubject"
    />

    <!-- 题目调试面板 - 只在开发场景下显示 -->
    <QuestionDebugPanel v-if="isDev" v-model="showQuestionDebugPanel" />
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
import { getUserInfo, getSubject, initializeStore } from '../services/auth-storage-service'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useTeacherExerciseChatStore } from '../stores/teacherExerciseChatStore'
import { storeToRefs } from 'pinia'
import { showMessage } from '../utils'
import QuestionList from '../components/QuestionList.vue'
import ChatView from '../components/ChatView.vue'
import AnswerView from '../components/AnswerView.vue'
import SimilarQuestionList from '../components/SimilarQuestionList.vue'
import UnifiedChatDialog from '../components/UnifiedChatDialog.vue'
import QuestionDebugPanel from '../components/debug/QuestionDebugPanel.vue'
import { useUIStore } from '../stores/uiStore'
import type { ExerciseItem, ChatBubble } from '../types'
import { Subject } from '../types'
import RubberBandList from '../components/RubberBandList.vue'
import CommonSelect from '../components/CommonSelect.vue'

// 第1步：判断是否显示调试功能（仅通过环境变量控制）
// 必须设置 VITE_ENABLE_DEBUG 环境变量来控制调试功能的显示
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

const route = useRoute()
const router = useRouter()
const questionStore = useQuestionStore()
const aiExerciseStore = useAiExerciseChatStore()
const teacherStore = useTeacherExerciseChatStore()
const uiStore = useUIStore()
const { currentQuestion, questions } = storeToRefs(questionStore)

const currentFunction = ref<'chatAi' | 'askTeacher' | 'viewAnswer' | 'similarQuestion' | ''>('')

// 是否从作业答题路由进入（homeworkExercise）
const isFromHomework = computed(() => {
  return route.name === 'homeworkExercise'
})

// 是否显示返回按钮（从作业作答页跳转过来时显示）
const showBackButton = computed(() => {
  return isFromHomework.value || route.query.tab === 'chatAi'
})

// 返回作业作答页
const goBackToHomework = () => {
  // 将当前题目的 questionId 存入 sessionStorage，供作业作答页恢复选中状态
  if (currentQuestion.value) {
    const questionId = (currentQuestion.value.bmNo || currentQuestion.value.id || '').toString()
    if (questionId) {
      sessionStorage.setItem('homeworkReturnQuestionId', questionId)
    }
  }

  router.back()
}

// 分屏组件模型值（控制左侧题目列表的宽度比例，30%表示左侧占30%）
const splitterModel = ref(30)

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)
// AI ChatView 组件引用（用于控制会话管理面板）
const aiChatViewRef = ref<InstanceType<typeof ChatView> | null>(null)
// 橡皮筋下拉刷新容器引用
const rubberBandListRef = ref<InstanceType<typeof RubberBandList> | null>(null)

// UnifiedChatDialog 组件引用
const unifiedChatDialogRef = ref<InstanceType<typeof UnifiedChatDialog> | null>(null)
const showUnifiedChatDialog = ref(false)

// 当前科目（用于 UnifiedChatDialog）- 使用 computed 监听 localStorage 变化
const currentSubject = computed(() => {
  return getSubject() === 'BIOLOGY' ? 'biology' : 'math'
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
const canUseAskTeacher = computed(() => hasSelectedQuestion.value)
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

// 新建会话
const handleAddSessionCard = async () => {
  if (aiChatViewRef.value?.addSessionCard) {
    await aiChatViewRef.value.addSessionCard()
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

const handleSwitchToTeacher = async () => {
  // 切换到老师界面（消息已经持久化到store中）
  currentFunction.value = 'askTeacher'
}

// 处理打开老师对话框（转发消息时调用）
const handleOpenTeacherDialog = async () => {
  // 对于题目对话场景，只切换到老师答疑面板，不打开 UnifiedChatDialog
  currentFunction.value = 'askTeacher'
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

  // 第1步：如果当前不在AI指导模式，自动切换到AI指导模式
  if (currentFunction.value !== 'chatAi') {
    currentFunction.value = 'chatAi'
  }

  // 第2步：如果已选择题目，加载对应题目的聊天记录
  if (currentQuestion.value) {
    // 统一使用 bmNo 作为 AI 题目聊天历史的存储键（无 bmNo 时回退到 id）
    const questionId = currentQuestion.value.bmNo || currentQuestion.value.id
    console.log('[AI_EXERCISE] 选题：', {
      bmNo: currentQuestion.value.bmNo,
      id: currentQuestion.value.id,
      usedKey: questionId,
    })
    // 第3步：根据当前功能类型加载对应题目的聊天记录
    if (currentFunction.value === 'chatAi') {
      // AI引导答题：加载AI题目的聊天记录
      // 多会话系统：loadChatHistory 会自动加载会话列表和最近活跃的会话
      await aiExerciseStore.loadChatHistory(questionId)

      // 如果没有会话，自动创建一个默认会话（保持原有体验）
      if (aiExerciseStore.sessions.length === 0) {
        await aiExerciseStore.createNewSession(questionId)
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

// 处理拍作业：发送题目给老师
const handleSendQuestionToTeacher = async (question: ExerciseItem) => {
  try {
    // 第1步：切换到老师通用对话模式（这会触发 ChatView 的初始化）
    currentFunction.value = 'askTeacher'

    // 第2步：等待 ChatView 组件挂载并初始化会话
    await nextTick()

    // 第3步：等待一会确保 ChatView 的 initializeTeacherSession 完成
    // ChatView 会自动创建会话（因为有 currentQuestion）
    await new Promise((resolve) => setTimeout(resolve, 300))

    // 第4步：确保会话已创建，如果没有则创建一个新的会话
    if (!teacherStore.currentSession && questionStore.currentQuestion) {
      // 清理题目标题（移除LaTeX）
      const rawTitle = question.question || question.title || '题目'
      const cleanTitle = rawTitle
        .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
        .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
        .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim()

      // 确定科目（默认使用数学科目，可以根据实际情况调整）
      const subject = question.subject === 'BIOLOGY' ? 'biology' : 'math'

      // 创建或获取会话（使用题目bmNo和题目标题）
      const createdSession = teacherStore.getOrCreateSession(
        question.bmNo,
        cleanTitle || '题目',
        subject
      )

      if (createdSession) {
        // 初始化消息监听器
        await teacherStore.initMessageReceiver()
      }
    }

    // 第5步：等待会话初始化完成
    await nextTick()

    // 第6步：准备题目内容并发送给老师
    const questionContent =
      questionStore.currentQuestion?.question ||
      question.question ||
      question.title ||
      '题目内容为空'

    // 第7步：发送题目内容给老师
    if (teacherStore.currentSession) {
      // 先添加用户消息（题目内容）
      const userMessage: import('../types').ChatBubble = {
        id: Date.now().toString(),
        content: questionContent,
        type: 'user',
        timestamp: new Date().toISOString(),
        sender: 'user',
        messageType: 'text',
      }

      // 添加到消息列表
      teacherStore.addMessage(userMessage)

      // 发送消息给老师
      // 注意：teacherExerciseChatStore 的 sendMessage 需要多个参数
      const subject = question.subject === 'BIOLOGY' ? 'BIOLOGY' : 'MATH'
      await teacherStore.sendMessage(
        questionContent,
        question,
        getUserInfo(),
        subject,
        'teacher',
        undefined,
        false,
        true // skipUserMessage: true，因为消息已经添加过了
      )

      showMessage('题目已发送给老师', 'success')
    } else {
      console.error(`[ExerciseSolveView] 会话创建失败，无法发送题目`)
      showMessage('会话创建失败，请重试', 'error')
    }
  } catch (error) {
    console.error(`[ExerciseSolveView] 拍作业失败:`, error)
    showMessage('拍作业失败: ' + (error as Error).message, 'error')
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
    // 初始化用户store
    await initializeStore()

    // 从路由参数中获取 tab 参数，设置当前功能
    const tabParam = route.query.tab as string | undefined
    if (tabParam && ['chatAi', 'askTeacher', 'viewAnswer', 'similarQuestion'].includes(tabParam)) {
      currentFunction.value = tabParam as typeof currentFunction.value
      console.log('[ExerciseSolveView] 从路由参数设置 tab:', tabParam)
    }

    // 从路由参数中获取科目和题目ID（统一使用 query）
    const routeSubject = route.query.subject as string | undefined
    const questionIdsParam = route.query.questionIds as string | undefined
    const questionIdParam = route.query.questionId as string | undefined
    // 将 Subject 枚举值转换为科目名称
    // 注意：Subject 枚举的值就是字符串，所以可以直接使用字符串作为键
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
    let subjectName = 'math' // 默认使用数学
    let subjectFilterValue: string | null = null // 筛选面板的值

    if (routeSubject) {
      // 如果路由参数中提供了科目，使用路由参数中的科目
      const routeSubjectUpper = String(routeSubject).toUpperCase()
      subjectName =
        subjectMap[routeSubjectUpper] ||
        subjectMap[routeSubject] ||
        routeSubject.toLowerCase() ||
        'math'

      // 将路由参数中的科目值（如 SUBJECT_BIOLOGY）设置为筛选面板的值
      // 确保是标准的 Subject 枚举格式
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
          // 否则尝试从科目名称反向映射
          subjectFilterValue = reverseSubjectMap[subjectName] || null
        }
      }
    }

    // 设置筛选面板的学科过滤下拉框
    if (subjectFilterValue) {
      selectedSubjectFilter.value = subjectFilterValue
    } else {
      // 如果没有设置具体科目，设置为全部学科（空字符串）
      selectedSubjectFilter.value = ''
    }

    // 如果提供了 questionIds 参数，说明是刚添加的题目，需要从服务器刷新
    // 否则优先使用本地数据
    const useLocalFirst = !questionIdsParam

    // 根据筛选面板的学科过滤值决定加载方式
    if (!selectedSubjectFilter.value) {
      // 全部学科：加载所有学科的题目
      await questionStore.fetchAllSubjectsQuestions(useLocalFirst)
    } else {
      // 具体学科：加载指定学科的题目
      await questionStore.fetchQuestions(subjectName, useLocalFirst)
    }
    // 处理题目定位
    let targetQuestionId: string | undefined

    // 优先使用 questionIds（多个题目，定位到第一个）
    if (questionIdsParam) {
      const questionIds = questionIdsParam.split(',').filter((id) => id.trim())
      if (questionIds.length > 0) {
        targetQuestionId = questionIds[0]
        // 验证这些题目是否在列表中
        const foundIds = questionIds.filter((id) =>
          questions.value.some((q) => q.bmNo === id || q.id === id)
        )
        if (foundIds.length < questionIds.length) {
          console.warn('[ExerciseSolveView] ⚠️ 部分题目未在列表中，可能需要等待服务器同步')
          // 如果部分题目未找到，尝试再次从服务器刷新
          await questionStore.fetchQuestions(subjectName, false)

          // 再次验证
          const foundIdsAfterRefresh = questionIds.filter((id) =>
            questions.value.some((q) => q.bmNo === id || q.id === id)
          )
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
      const targetIndex = questions.value.findIndex(
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

// 组件卸载时清空当前选中的题目
onBeforeUnmount(() => {
  // 清空当前选中的题目，避免离开页面后仍然保留选中状态
  questionStore.clearCurrentQuestion()
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
  left: 28px;
  top: 14.5px;
  z-index: 10;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  // 其余样式保持不变
}

.back-icon {
  width: 25px;
  height: 25px;
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

// 移除旧的按钮样式，使用新的导航样式

// 会话管理按钮样式
.session-manager-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.session-manager-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.session-action-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

// 响应式设计
// 会话管理底部按钮栏
.session-bottom-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 12px 16px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  z-index: 100;
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
