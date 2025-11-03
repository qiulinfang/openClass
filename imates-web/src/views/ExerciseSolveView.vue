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
              :class="{ active: currentFunction === 'chatAi', disabled: !hasSelectedQuestion }"
              @click="hasSelectedQuestion && (currentFunction = 'chatAi')"
            >
              AI引导答题
            </div>
            <div
              class="nav-item"
              :class="{ active: currentFunction === 'askTeacher', disabled: !canAskTeacher }"
              @click="canAskTeacher && (currentFunction = 'askTeacher')"
            >
              老师答疑
            </div>
            <div
              class="nav-item active-item"
              :class="{ active: currentFunction === 'viewAnswer', disabled: !canViewAnswer }"
              @click="canViewAnswer && (currentFunction = 'viewAnswer')"
            >
              <span class="nav-icon">👤</span>
              查看答案
            </div>
            <div
              class="nav-item"
              :class="{ active: currentFunction === 'similarQuestion', disabled: !canViewAnswer }"
              @click="canViewAnswer && (currentFunction = 'similarQuestion')"
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
    <div class="main-content row no-wrap" @click="handleContentClick">
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
                emit-value
                map-options
                outlined
                dense
                class="subject-filter-select"
                @update:model-value="onSubjectFilterChange"
              >
              </q-select>

              <!-- 对比统计按钮 -->
              <q-btn
                icon="analytics"
                label="输出对比统计"
                flat
                class="stats-btn"
                @click="handleOutputStatistics"
              >
                <q-tooltip>输出对比统计（估算vs真实高度）</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>
      </transition>
      <!-- 左侧题目列表 -->
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

      <!-- 右侧功能区域 -->
      <div class="function-panel" :class="{ 'content-shifted': showFilterPanel }">
        <q-card flat class="full-height">
          <!-- 功能内容区域 -->
          <q-card-section class="function-content q-pa-none">
            <!-- AI聊天界面 -->
            <ChatView
              v-if="currentFunction === 'chatAi'"
              type="ai-exercise"
              @response="handleChatResponse"
              @switch-to-teacher="handleSwitchToTeacher"
              @scroll-to-question-and-select="handleScrollToQuestionAndSelect"
              @scroll-to-bottom="scrollToBottom"
            />

            <!-- 问老师界面 -->
            <ChatView 
              v-if="currentFunction === 'askTeacher'" 
              type="teacher"
              @scroll-to-question-and-select="handleScrollToQuestionAndSelect"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useQuestionStore } from '../stores/questionStore'
import { useUserStore } from '../stores/userStore'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useTeacherChatStore } from '../stores/teacherChatStore'
import { storeToRefs } from 'pinia'
import { showMessage } from '../utils'
import QuestionList from '../components/QuestionList.vue'
import ChatView from '../components/ChatView.vue'
import AnswerView from '../components/AnswerView.vue'
import SimilarQuestionList from '../components/SimilarQuestionList.vue'
import { useUIStore } from '../stores/uiStore'
import type { ExerciseItem } from '../types'

// 加载时间日志
const loadStartTime = performance.now()
// 获取时间字符串的工具函数
const getTimeString = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}
console.log(`${getTimeString()} [ExerciseSolveView] 组件开始初始化`)

const route = useRoute()
const questionStore = useQuestionStore()
const userStore = useUserStore()
const aiExerciseStore = useAiExerciseChatStore()
const teacherStore = useTeacherChatStore()
const uiStore = useUIStore()
const { currentQuestion, questions } = storeToRefs(questionStore)

const initTime = performance.now()
console.log(`${getTimeString()} [ExerciseSolveView] Store初始化完成，耗时: ${(initTime - loadStartTime).toFixed(2)}ms`)

const currentFunction = ref<'chatAi' | 'askTeacher' | 'viewAnswer' | 'similarQuestion'>('chatAi')

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)

// 筛选面板显示状态
const showFilterPanel = ref(false)

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

// 拍照搜题功能已移至工具箱（MyProfileView）

// 输出对比统计
const handleOutputStatistics = () => {
  if (questionListRef.value && typeof questionListRef.value.outputComparisonStatistics === 'function') {
    questionListRef.value.outputComparisonStatistics()
  }
}

const hasSelectedQuestion = computed(() => {
  return currentQuestion.value !== null
})

// 从aiExerciseStore获取canViewAnswer状态
const canViewAnswer = computed(() => aiExerciseStore.canViewAnswer)

const canAskTeacher = computed(() => {
  return hasSelectedQuestion.value && teacherStore.messages.length > 0
})

const handleChatResponse = () => {
  // AI回复后的处理逻辑
}

const handleSwitchToTeacher = () => {
  // 切换到老师界面（消息已经持久化到store中）
  currentFunction.value = 'askTeacher'
}

const handleStartAiGuidance = async () => {
  try {
    // 切换到AI聊天界面
    currentFunction.value = 'chatAi'

    // 注意：题目选择已经在QuestionList的sendToAi方法中完成，
    // 这里不需要重复选择，避免覆盖正确的选择结果
    // startAiGuidance 方法已经会自动发送题目内容给AI，这里不需要重复发送
  } catch {
    // Handle error silently
  }
}

const handleQuestionSelected = async () => {
  // 如果当前不在AI指导模式，自动切换到AI指导模式
  if (currentFunction.value !== 'chatAi') {
    currentFunction.value = 'chatAi'
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
    console.log(`${getTimeString()} [ExerciseSolveView] 开始处理打开微课，题目ID: ${question.id}`)
    console.log(`${getTimeString()} [ExerciseSolveView] 题目信息:`, {
      id: question.id,
      title: question.title,
      questionPreview: question.question?.substring(0, 100)
    })
    
    // 使用硬编码的微课URL
    const classUrl = 'https://www.imates.com.cn:9099/demo/demo1.html'
    console.log(`${getTimeString()} [ExerciseSolveView] 使用的微课URL: ${classUrl}`)
    
    if (!classUrl || classUrl.trim() === '') {
      console.warn(`${getTimeString()} [ExerciseSolveView] 微课URL为空，取消打开`)
      showMessage('该题目暂无微课', 'warning')
      return
    }

    // 更新UI Store中的微课信息并打开弹框
    const questionTitle = question.title || question.question?.substring(0, 50) || ''
    console.log(`${getTimeString()} [ExerciseSolveView] 更新UI Store微课信息，标题: ${questionTitle}`)
    uiStore.openMiniClassDialog(classUrl, questionTitle)
    
    console.log(`${getTimeString()} [ExerciseSolveView] 打开微课弹框成功完成`)
  } catch (error) {
    console.error(`${getTimeString()} [ExerciseSolveView] 打开微课失败:`, error)
    showMessage('打开微课失败', 'error')
  }
}

// 处理拍作业：发送题目给老师
const handleSendQuestionToTeacher = async (question: ExerciseItem) => {
  try {
    console.log(`${getTimeString()} [ExerciseSolveView] 开始处理拍作业，题目ID: ${question.id}`)
    
    // 第1步：切换到老师答疑模式（这会触发 ChatView 的初始化）
    currentFunction.value = 'askTeacher'
    
    // 第2步：等待 ChatView 组件挂载并初始化会话
    await nextTick()
    
    // 第3步：等待一会确保 ChatView 的 initializeTeacherSession 完成
    // ChatView 会自动创建会话（因为有 currentQuestion）
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // 第4步：确保会话已创建，如果没有则创建一个新的会话
    if (!teacherStore.currentSession && questionStore.currentQuestion) {
      console.log(`${getTimeString()} [ExerciseSolveView] 会话不存在，创建新会话`)
      
      // 生成会话ID和名称
      const aiSessionId = `ai_session_${question.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 清理题目标题（移除LaTeX）
      const rawTitle = question.question || question.title || '题目'
      const cleanTitle = rawTitle
        .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
        .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
        .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim()
      
      const aiSessionName = (cleanTitle || '数学题目').substring(0, 30) + '...'
      
      // 创建会话（默认使用数学科目，可以根据实际情况调整）
      const createdSession = teacherStore.createTeacherSession(
        aiSessionId,
        aiSessionName,
        'math' // 可以根据题目的 subject 字段动态设置
      )
      
      if (createdSession) {
        // 初始化消息监听器
        await teacherStore.initMessageReceiver()
        console.log(`${getTimeString()} [ExerciseSolveView] 新会话已创建: ${createdSession.sessionId}`)
      }
    }
    
    // 第5步：等待会话初始化完成
    await nextTick()
    
    // 第6步：准备题目内容并发送给老师
    const questionContent = questionStore.currentQuestion?.question || question.question || question.title || '题目内容为空'
    
    // 第7步：发送题目内容给老师
    if (teacherStore.currentSession) {
      console.log(`${getTimeString()} [ExerciseSolveView] 发送题目内容给老师`)
      
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
      await teacherStore.sendMessage(questionContent)
      
      console.log(`${getTimeString()} [ExerciseSolveView] 题目已发送给老师`)
      showMessage('题目已发送给老师', 'success')
    } else {
      console.error(`${getTimeString()} [ExerciseSolveView] 会话创建失败，无法发送题目`)
      showMessage('会话创建失败，请重试', 'error')
    }
  } catch (error) {
    console.error(`${getTimeString()} [ExerciseSolveView] 拍作业失败:`, error)
    showMessage('拍作业失败: ' + (error as Error).message, 'error')
  }
}

const handleScrollToQuestionAndSelect = (targetIndex: number) => {
  // 调用题目列表的滚动到指定题目并设置为选中状态方法
  if (questionListRef.value && typeof questionListRef.value.scrollToQuestionAndSelect === 'function') {
    console.log(`${getTimeString()} [ExerciseSolveView] 调用题目列表滚动到指定题目并设置为选中状态，索引: ${targetIndex}`)
    questionListRef.value.scrollToQuestionAndSelect(targetIndex)
  }
}

// 滚动到页面底部的方法
const scrollToBottom = () => {
  console.log(`${getTimeString()} [ExerciseSolveView] 滚动到页面底部`)
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
    // 加载时间日志
    const mountedStartTime = performance.now()
    const totalInitTime = mountedStartTime - loadStartTime
    console.log(`${getTimeString()} [ExerciseSolveView] onMounted 开始，距离组件初始化: ${totalInitTime.toFixed(2)}ms`)
    
    // 静默初始化，不显示加载状态
    try {
      // 初始化用户store
      const userStoreStartTime = performance.now()
      console.log(`${getTimeString()} [ExerciseSolveView] 开始初始化 userStore.initializeStore()`)
      await userStore.initializeStore()
      const userStoreEndTime = performance.now()
      const userStoreDuration = userStoreEndTime - userStoreStartTime
      console.log(`${getTimeString()} [ExerciseSolveView] userStore.initializeStore() 完成，耗时: ${userStoreDuration.toFixed(2)}ms`)
      
      // 优先使用本地数据，不立即请求API
      // fetchQuestions 方法会先尝试从本地存储加载，如果没有数据再请求API
      const fetchQuestionsStartTime = performance.now()
      console.log(`${getTimeString()} [ExerciseSolveView] 开始获取题目列表 questionStore.fetchQuestions('math', true)`)
      await questionStore.fetchQuestions('math', true)
      const fetchQuestionsEndTime = performance.now()
      const fetchQuestionsDuration = fetchQuestionsEndTime - fetchQuestionsStartTime
      console.log(`${getTimeString()} [ExerciseSolveView] questionStore.fetchQuestions() 完成，耗时: ${fetchQuestionsDuration.toFixed(2)}ms`)
      
      // 检查路由参数中是否有 questionId，如果有则定位到该题目
      const questionId = route.query.questionId as string | undefined
      if (questionId && questionListRef.value) {
        await nextTick()
        // 等待题目列表渲染完成
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // 在题目列表中查找对应的题目索引
        const targetIndex = questions.value.findIndex(q => q.id === questionId || q.bmNo === questionId)
        if (targetIndex >= 0) {
          console.log(`${getTimeString()} [ExerciseSolveView] 找到目标题目，索引: ${targetIndex}`)
          // 等待组件完全渲染后再定位
          await nextTick()
          setTimeout(() => {
            if (questionListRef.value && typeof questionListRef.value.scrollToQuestionAndSelect === 'function') {
              questionListRef.value.scrollToQuestionAndSelect(targetIndex)
              console.log(`${getTimeString()} [ExerciseSolveView] 已定位到题目，索引: ${targetIndex}`)
            }
          }, 500)
        } else {
          console.log(`${getTimeString()} [ExerciseSolveView] 未找到目标题目，questionId: ${questionId}`)
        }
      }
      
      // 总耗时统计
      const mountedEndTime = performance.now()
      const mountedDuration = mountedEndTime - mountedStartTime
      const totalDuration = mountedEndTime - loadStartTime
      console.log(`${getTimeString()} [ExerciseSolveView] onMounted 完成，总耗时: ${mountedDuration.toFixed(2)}ms`)
      console.log(`${getTimeString()} [ExerciseSolveView] 完整加载统计:`)
      console.log(`   - 组件初始化到Store初始化: ${totalInitTime.toFixed(2)}ms`)
      console.log(`   - userStore初始化: ${userStoreDuration.toFixed(2)}ms`)
      console.log(`   - fetchQuestions: ${fetchQuestionsDuration.toFixed(2)}ms`)
      console.log(`   - onMounted总耗时: ${mountedDuration.toFixed(2)}ms`)
      console.log(`   - 组件加载总耗时: ${totalDuration.toFixed(2)}ms`)
    } catch (error) {
      const errorTime = performance.now()
      const errorDuration = errorTime - mountedStartTime
      console.error(`${getTimeString()} [ExerciseSolveView] 初始化失败，耗时: ${errorDuration.toFixed(2)}ms`, error)
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

.question-panel {
  background-color: #f8f9fa; /* Gemini 风格的浅灰背景 */
  @include full-height-flex;
  overflow: hidden;
  flex: 0 0 30%;
  min-width: 0;

  .q-card {
    @include full-height-flex;
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
  @include full-height-flex;
  background-color: #ffffff; /* 聊天区域保持白色背景 */
  flex: 1 1 auto;
  min-width: 0;
  transition: flex-basis 0.3s ease, margin-left 0.3s ease; // 平滑动画，flex-basis和margin-left变化时有渐变效果

  .q-card {
    @include full-height-flex;
    background-color: transparent;
    border: none;
    box-shadow: none;
  }
  
  // 当筛选面板显示时，内容区域平滑调整
  &.content-shifted {
    flex: 0 0 calc(100% - 22%); // 使用 flex-basis，确保 transition 生效
    margin-left: auto; // 将面板推到右侧，确保右侧始终紧贴右边框
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
    border-bottom: $border-width solid $border-color;
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

  .question-panel {
    height: 40vh !important;
    max-height: 40vh;
    /* 移动端也使用背景色区分，不用边框 */

    .q-card-section {
      @include hide-mobile-scrollbar;
    }
  }

  .function-panel {
    height: 60vh !important;
    max-height: 60vh;
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

@media (min-width: #{$mobile-breakpoint + 1px}) and (max-width: $tablet-breakpoint) {
  .question-panel {
    flex: 0 0 35%;
    
    &.with-filter-panel {
      flex: 0 0 calc(35% - 300px);
    }
  }

  .function-panel {
    flex: 0 0 65%;
    transition: flex-basis 0.3s ease, margin-left 0.3s ease; // 平滑动画，flex-basis和margin-left变化时有渐变效果
    
    &.content-shifted {
      flex: 0 0 calc(100% - 22%); // 使用 flex-basis，确保 transition 生效
      margin-left: auto; // 将面板推到右侧，确保右侧始终紧贴右边框
    }
  }
}

@media (min-width: $desktop-breakpoint) {
  .question-panel {
    flex: 0 0 30%;
    
    &.with-filter-panel {
      flex: 0 0 calc(30% - 300px);
    }
  }

  .function-panel {
    flex: 0 0 70%;
    transition: flex-basis 0.3s ease, margin-left 0.3s ease; // 平滑动画，flex-basis和margin-left变化时有渐变效果
    
    &.content-shifted {
      flex: 0 0 48%; // 使用 flex-basis，确保 transition 生效
      margin-left: auto; // 将面板推到右侧，确保右侧始终紧贴右边框
    }
  }
}
</style>
