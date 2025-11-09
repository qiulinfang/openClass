<template>
  <div class="exercise-solve-container">
    <!-- 顶部工具栏 -->
    <div class="app-header">
      <div class="app-toolbar">
        <!-- 左侧汉堡按钮 -->
        <q-btn icon="menu" flat round class="filter-menu-btn" @click="toggleFilterPanel">
          <q-tooltip>打开筛选面板</q-tooltip>
        </q-btn>
        
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
              :class="{ active: currentFunction === 'askTeacher', disabled: !canUseAskTeacher }"
              @click="canUseAskTeacher && (currentFunction = 'askTeacher')"
            >
              老师答疑
            </div>
            <div
              class="nav-item active-item"
              :class="{ active: currentFunction === 'viewAnswer', disabled: !canUseViewAnswer }"
              @click="canUseViewAnswer && (currentFunction = 'viewAnswer')"
            >
              <span class="nav-icon">👤</span>
              查看答案
            </div>
            <div
              class="nav-item"
              :class="{ active: currentFunction === 'similarQuestion', disabled: !canUseSimilarQuestion }"
              @click="canUseSimilarQuestion && (currentFunction = 'similarQuestion')"
            >
              举一反三
            </div>
          </div>
        </div>
        
        <!-- 占位元素保持布局平衡 -->
        <div class="toolbar-spacer"></div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content" @click="handleContentClick">
      <!-- 筛选面板 -->
      <transition name="filter-panel-transition">
        <div class="filter-panel-wrapper" v-if="showFilterPanel" @click.stop>
          <div class="filter-panel">
            <div class="filter-panel-content">
              <!-- 搜索输入框 -->
              <q-input
                v-model="searchQuery"
                placeholder="搜索题目..."
                outlined
                dense
                clearable
                @input="onSearchInput"
                class="search-input"
              >
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>

              <!-- 学科过滤下拉框 -->
              <q-select
                v-model="selectedSubjectFilter"
                :options="subjectOptions"
                option-value="value"
                option-label="label"
                behavior="menu"
                emit-value
                map-options
                outlined
                dense
                class="subject-filter-select"
                @update:model-value="onSubjectFilterChange"
              >
              </q-select>

              <!-- 对比统计按钮 - 只在开发场景下显示 -->
              <q-btn
                v-if="isDev"
                icon="analytics"
                label="输出对比统计"
                flat
                class="stats-btn"
                @click="handleOutputStatistics"
              >
                <q-tooltip>输出对比统计（估算vs真实高度）</q-tooltip>
              </q-btn>

              <!-- 题目调试面板按钮 - 只在开发场景下显示 -->
              <q-btn
                v-if="isDev"
                icon="bug_report"
                label="题目调试"
                flat
                class="debug-btn"
                @click="showQuestionDebugPanel = true"
              >
                <q-tooltip>打开题目调试面板</q-tooltip>
              </q-btn>

            </div>
          </div>
        </div>
      </transition>
      
      <!-- 分屏组件包裹左侧题目列表和右侧功能区域 -->
      <q-splitter
        v-model="splitterModel"
        :limits="[20, 50]"
        class="splitter-container"
      >
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
              <span class="dot"></span>
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
                  v-if="currentFunction === 'chatAi'"
                  type="ai-exercise"
                  @response="handleChatResponse"
                  @switch-to-teacher="handleSwitchToTeacher"
                  @open-teacher-dialog="handleOpenTeacherDialog"
                  @scroll-to-bottom="scrollToBottom"
                />

                <!-- 问老师界面 -->
                <ChatView 
                  v-if="currentFunction === 'askTeacher'" 
                  type="teacher-exercise"
                  @scroll-to-bottom="scrollToBottom"
                />

                <!-- 答案显示 -->
                <AnswerView
                  v-if="currentFunction === 'viewAnswer'"
                  :answer="currentQuestion?.answer || ''"
                  :analysis="currentQuestion?.analysisData || ''"
                />

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
    <QuestionDebugPanel
      v-if="isDev"
      v-model="showQuestionDebugPanel"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useQuestionStore } from '../stores/questionStore'
import { useUserStore } from '../stores/userStore'
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

// 第1步：判断是否显示调试功能（仅通过环境变量控制）
// 必须设置 VITE_ENABLE_DEBUG 环境变量来控制调试功能的显示
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

const route = useRoute()
const questionStore = useQuestionStore()
const userStore = useUserStore()
const aiExerciseStore = useAiExerciseChatStore()
const teacherStore = useTeacherExerciseChatStore()
const uiStore = useUIStore()
const { currentQuestion, questions } = storeToRefs(questionStore)

const currentFunction = ref<'chatAi' | 'askTeacher' | 'viewAnswer' | 'similarQuestion'>('chatAi')

// 分屏组件模型值（控制左侧题目列表的宽度比例，30%表示左侧占30%）
const splitterModel = ref(30)

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)

// UnifiedChatDialog 组件引用
const unifiedChatDialogRef = ref<InstanceType<typeof UnifiedChatDialog> | null>(null)
const showUnifiedChatDialog = ref(false)

// 当前科目（用于 UnifiedChatDialog）
const currentSubject = computed(() => {
  return userStore.subject === 'BIOLOGY' ? 'biology' : 'math'
})

// 筛选面板显示状态
const showFilterPanel = ref(false)

// 题目调试面板显示状态
const showQuestionDebugPanel = ref(false)

// 切换筛选面板显示状态
const toggleFilterPanel = () => {
  showFilterPanel.value = !showFilterPanel.value
}

// 处理内容区域点击（关闭筛选面板）
const handleContentClick = () => {
  // 如果筛选面板显示，点击内容区域时关闭
  if (showFilterPanel.value) {
    showFilterPanel.value = false
  }
}

// 搜索相关
const searchQuery = ref('')
const searchTimeout = ref<number | null>(null)

// 学科过滤相关
const selectedSubjectFilter = ref<string | null>(null) // null 表示显示所有学科
const subjectOptions = [
  { label: '全部学科', value: null },
  { label: '数学', value: 'SUBJECT_MATH' },
  { label: '生物', value: 'SUBJECT_BIOLOGY' },
  { label: '化学', value: 'SUBJECT_CHEMISTRY' },
  { label: '物理', value: 'SUBJECT_PHYSICS' },
  { label: '语文', value: 'SUBJECT_CHINESE' },
  { label: '英语', value: 'SUBJECT_ENGLISH' },
]

// 搜索输入处理
const onSearchInput = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }

  searchTimeout.value = window.setTimeout(() => {
    // 搜索逻辑在 QuestionList 组件内部处理
  }, 300)
}

// 学科过滤变化处理
const onSubjectFilterChange = () => {
  // 过滤逻辑在 QuestionList 组件内部处理
}

// 输出对比统计
const handleOutputStatistics = () => {
  if (questionListRef.value && typeof questionListRef.value.outputComparisonStatistics === 'function') {
    questionListRef.value.outputComparisonStatistics()
  }
}

const hasSelectedQuestion = computed(() => {
  return currentQuestion.value !== null
})

// 按钮可用性computed属性
const canUseChatAi = computed(() => hasSelectedQuestion.value)
const canUseAskTeacher = computed(() => {
  return hasSelectedQuestion.value && aiExerciseStore.canViewAnswer
})
const canUseViewAnswer = computed(() => aiExerciseStore.canViewAnswer)
const canUseSimilarQuestion = computed(() => aiExerciseStore.canViewAnswer)

const handleChatResponse = () => {
  // AI回复后的处理逻辑
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
  // 第1步：如果当前不在AI指导模式，自动切换到AI指导模式
  if (currentFunction.value !== 'chatAi') {
    currentFunction.value = 'chatAi'
  }
  
  // 第2步：如果已选择题目，加载对应题目的聊天记录
  if (currentQuestion.value) {
    const questionId = currentQuestion.value.id
    
    // 第3步：根据当前功能类型加载对应题目的聊天记录
    if (currentFunction.value === 'chatAi') {
      // AI引导答题：加载AI题目的聊天记录
      // 注意：ChatView的executeQuestionSwitch不会自动加载AI题目的聊天记录
      // 需要在这里手动加载
      await aiExerciseStore.loadChatHistory(questionId)
    }
  }
}

const handleQuestionAdded = () => {
  // 只刷新题目列表数据，不重新加载整个列表
  if (questionListRef.value) {
    questionListRef.value.refreshQuestions()
  }
}

// 处理打开微课
const handleOpenMiniClass = (question: ExerciseItem) => {
  try {
    // 使用硬编码的微课URL
    const classUrl = 'https://www.imates.com.cn:9099/demo/demo1.html'
    
    if (!classUrl || classUrl.trim() === '') {
      showMessage('该题目暂无微课', 'warning')
      return
    }

    // 更新UI Store中的微课信息并打开弹框
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
    await new Promise(resolve => setTimeout(resolve, 300))
    
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
      
      // 创建或获取会话（使用题目ID和题目标题）
      const createdSession = teacherStore.getOrCreateSession(
        question.id,
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
    const questionContent = questionStore.currentQuestion?.question || question.question || question.title || '题目内容为空'
    
    // 第7步：发送题目内容给老师
    if (teacherStore.currentSession) {
      // 先添加用户消息（题目内容）
      const userMessage: import('../types').ChatBubble = {
        id: Date.now().toString(),
        content: questionContent,
        type: 'user',
        timestamp: new Date().toISOString(),
        sender: 'user',
        messageType: 'text'
      }
      
      // 添加到消息列表
      teacherStore.addMessage(userMessage)
      
      // 发送消息给老师
      // 注意：teacherExerciseChatStore 的 sendMessage 需要多个参数
      const subject = question.subject === 'BIOLOGY' ? 'BIOLOGY' : 'MATH'
      await teacherStore.sendMessage(
        questionContent,
        question,
        userStore.userInfo,
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
      behavior: 'smooth'
    })
    
    // 方法2: 尝试滚动到视口高度 + 当前滚动位置
    setTimeout(() => {
      const viewportHeight = window.innerHeight
      const currentScroll = window.pageYOffset
      const targetScroll = currentScroll + viewportHeight
      
      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
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
    // 静默初始化，不显示加载状态
    try {
      // 初始化用户store
      await userStore.initializeStore()
      
      // 从路由参数中获取科目和题目ID
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
        [Subject.SUBJECT_ENGLISH]: 'english'
      }
      
      // 科目名称到筛选面板值的反向映射
      const reverseSubjectMap: Record<string, string> = {
        'math': 'SUBJECT_MATH',
        'biology': 'SUBJECT_BIOLOGY',
        'chemistry': 'SUBJECT_CHEMISTRY',
        'physics': 'SUBJECT_PHYSICS',
        'chinese': 'SUBJECT_CHINESE',
        'english': 'SUBJECT_ENGLISH'
      }
      
      // 确定要加载的科目
      let subjectName = 'math' // 默认使用数学
      let subjectFilterValue: string | null = null // 筛选面板的值
      
      if (routeSubject) {
        // 如果路由参数中提供了科目，使用路由参数中的科目
        const routeSubjectUpper = String(routeSubject).toUpperCase()
        subjectName = subjectMap[routeSubjectUpper] || subjectMap[routeSubject] || routeSubject.toLowerCase() || 'math'
        
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
        const userSubject = userStore.subject
        if (userSubject) {
          const userSubjectUpper = String(userSubject).toUpperCase()
          subjectName = subjectMap[userSubjectUpper] || subjectMap[userSubject] || userSubject.toLowerCase() || 'math'
          
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
        // 如果没有设置具体科目，设置为全部学科（null）
        selectedSubjectFilter.value = null
      }
      
      // 如果提供了 questionIds 参数，说明是刚添加的题目，需要从服务器刷新
      // 否则优先使用本地数据
      const useLocalFirst = !questionIdsParam
      
      // 根据筛选面板的学科过滤值决定加载方式
      if (selectedSubjectFilter.value === null) {
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
        const questionIds = questionIdsParam.split(',').filter(id => id.trim())
        if (questionIds.length > 0) {
          targetQuestionId = questionIds[0]
          // 验证这些题目是否在列表中
          const foundIds = questionIds.filter(id => 
            questions.value.some(q => q.bmNo === id || q.id === id)
          )
          if (foundIds.length < questionIds.length) {
            console.warn('[ExerciseSolveView] ⚠️ 部分题目未在列表中，可能需要等待服务器同步')
            // 如果部分题目未找到，尝试再次从服务器刷新
            await questionStore.fetchQuestions(subjectName, false)
            
            // 再次验证
            const foundIdsAfterRefresh = questionIds.filter(id => 
              questions.value.some(q => q.bmNo === id || q.id === id)
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
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // 在题目列表中查找对应的题目索引
        const targetIndex = questions.value.findIndex(q => q.id === targetQuestionId || q.bmNo === targetQuestionId)
        if (targetIndex >= 0) {
          // 等待组件完全渲染后再定位
          await nextTick()
          setTimeout(() => {
            if (questionListRef.value && typeof questionListRef.value.scrollToQuestionAndSelect === 'function') {
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

// 汉堡按钮（在工具栏左侧）
.filter-menu-btn {
  margin-left: 8px;
  color: rgba(255, 255, 255, 0.9);
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  :deep(.q-icon) {
    color: rgba(255, 255, 255, 0.9);
    font-size: 24px;
  }
}

// 筛选面板包装器
.filter-panel-wrapper {
  position: relative;
  flex: 0 0 22%; // 固定22%宽度，不会缩小，内容区域会相应缩小
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

// 筛选面板过渡动画
.filter-panel-transition-enter-active,
.filter-panel-transition-leave-active {
  transition: all 0.3s ease;
}

.filter-panel-transition-enter-from {
  opacity: 0;
  transform: translateX(-20px);
  flex: 0 0 0%; // 使用flex而不是width
}

.filter-panel-transition-leave-to {
  opacity: 0;
  transform: translateX(-20px);
  flex: 0 0 0%; // 使用flex而不是width
}

// 筛选面板（与工具箱保持一致）
.filter-panel {
  width: 100%;
  height: 100%;
  background: #3D3070;
  border-bottom: 1px solid rgba(229, 231, 235, 0.3);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  position: relative;
  
  // 自定义滚动条样式
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  }
  
  .filter-panel-content {
    flex: 1;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    
    .search-input {
      width: 100%;
      
      :deep(.q-field__control) {
        border-radius: 12px;
        border: none;
        background-color: rgba(255, 255, 255, 0.95);
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        
        &:hover {
          background-color: #ffffff;
        }
        
        &.q-field--focused {
          background-color: #ffffff;
          box-shadow: 0 0 0 2px rgba(138, 128, 255, 0.3);
        }
      }
      
      :deep(.q-field__native) {
        padding: 12px 16px;
        font-size: 14px;
        min-height: 48px;
      }
      
      :deep(.q-field__append) {
        padding-right: 12px;
        
        .q-icon {
          color: #5f6368;
          font-size: 20px;
        }
      }
    }
    
    .subject-filter-select {
      width: 100%;
      
      :deep(.q-field__control) {
        border-radius: 12px;
        border: none;
        background-color: rgba(255, 255, 255, 0.95);
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        
        &:hover {
          background-color: #ffffff;
        }
        
        &.q-field--focused {
          background-color: #ffffff;
          box-shadow: 0 0 0 2px rgba(138, 128, 255, 0.3);
        }
      }
      
      :deep(.q-field__native) {
        padding: 12px 16px;
        font-size: 14px;
        min-height: 48px;
      }
      
      :deep(.q-field__prepend) {
        padding-left: 12px;
        
        .q-icon {
          color: #5f6368;
          font-size: 20px;
        }
      }
    }
    
    .stats-btn {
      width: 100%;
      height: 48px;
      background-color: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.9);
      
      &:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
      
      :deep(.q-icon) {
        font-size: 20px;
      }
    }
  }
}

.app-header {
  height: $header-height;
  min-height: $header-height;
  max-height: $header-height;
  border-bottom: none;
  box-shadow: none;
  background-color: #3d3070; /* 深紫色背景 */
  flex-shrink: 0;
}

.app-toolbar {
  height: $header-height;
  min-height: $header-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toolbar-spacer {
  width: 40px; // 与汉堡按钮宽度保持平衡
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  background-color: #f8f9fa; /* Gemini 风格的整体背景 */
  min-height: 0;
  width: 100%;
  transition: margin-left 0.3s ease, width 0.3s ease; // 平滑动画（与工具箱保持一致）
  
  // 当筛选面板显示时，内容区域保持正常布局
  // 筛选面板作为普通流式布局的一部分，不需要偏移
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
    width: 6px; // 增加分隔条宽度，使拖动更容易
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
  gap: 4px;
  align-items: center;
  justify-content: center;
}

.splitter-dots .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: #999;
  display: block;
  transition: background-color 0.2s;
}

.splitter-container :deep(.q-splitter__separator):hover .splitter-dots .dot {
  background-color: #666;
}

.splitter-container :deep(.q-splitter__separator):active .splitter-dots .dot {
  background-color: #333;
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
  gap: 24px;
  padding: 0 16px;
}

.nav-item {
  font-size: 14px;
  color: #B0BEC5; /* 浅灰色文字 */
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 8px 16px;
  border-radius: 8px;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover:not(.disabled) {
    color: #E1BEE7; /* 悬停时稍亮一点 */
  }
  
  // 激活状态 - 白色背景，深色文字，紫色下划线
  &.active {
    background-color: #ffffff;
    color: #673AB7; /* 深紫色文字，与背景色匹配 */
    font-weight: 500;
    
    // 紫色下划线
    &::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 3px;
      background: #9C27B0; /* 亮紫色下划线 */
      border-radius: 2px;
    }
    
    // 图标在激活状态下也应该是深紫色
    .nav-icon {
      filter: brightness(0.7) saturate(1.5);
    }
  }
  
  // 禁用状态
  &.disabled {
    color: #757575;
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  // 导航图标
  .nav-icon {
    font-size: 16px;
    filter: brightness(0.9);
    
    .active & {
      filter: brightness(1.2);
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

// 响应式设计
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
  
  .toolbar-spacer {
    width: 32px;
  }
}
</style>
