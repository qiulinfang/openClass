<template>
  <div class="exercise-solve-container">
    <!-- 顶部工具栏 -->
    <div class="app-header">
      <div class="app-toolbar">
        
        <!-- 居中的功能按钮组 -->
        <div class="toolbar-center">
          <div class="function-buttons q-gutter-xs">
            <q-btn
              flat
              dense
              label="AI指导"
              icon="smart_toy"
              :disable="!hasSelectedQuestion"
              :color="currentFunction === 'chatAi' ? 'primary' : 'grey-6'"
              @click="currentFunction = 'chatAi'"
              class="function-btn"
            />
            <q-btn
              flat
              dense
              label="老师答疑"
              icon="school"
              :disable="!canAskTeacher"
              :color="currentFunction === 'askTeacher' ? 'primary' : 'grey-6'"
              @click="currentFunction = 'askTeacher'"
              class="function-btn"
            />
            <q-btn
              flat
              dense
              label="查看答案"
              icon="visibility"
              :disable="!canViewAnswer"
              :color="currentFunction === 'viewAnswer' ? 'primary' : 'grey-6'"
              @click="currentFunction = 'viewAnswer'"
              class="function-btn"
            />
            <q-btn
              flat
              dense
              label="举一反三"
              icon="find_in_page"
              :disable="!canViewAnswer"
              :color="currentFunction === 'similarQuestion' ? 'primary' : 'grey-6'"
              @click="currentFunction = 'similarQuestion'"
              class="function-btn"
            />
          </div>
        </div>
        
        <!-- 占位元素保持布局平衡 -->
        <div class="toolbar-spacer"></div>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content row no-wrap">
      <!-- 左侧题目列表 -->
      <div class="question-panel col-4">
        <q-card flat bordered class="full-height">
          <q-card-section class="q-pa-none full-height">
            <QuestionList 
              ref="questionListRef"
              @start-ai-guidance="handleStartAiGuidance"
              @question-selected="handleQuestionSelected"
            />
          </q-card-section>
        </q-card>
      </div>

      <!-- 右侧功能区域 -->
      <div class="function-panel col-8">
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
import { useExerciseStore } from '../stores/exerciseStore'
import { storeToRefs } from 'pinia'
import QuestionList from '../components/QuestionList.vue'
import ChatView from '../components/ChatView.vue'
import AnswerView from '../components/AnswerView.vue'
import SimilarQuestionList from '../components/SimilarQuestionList.vue'


const exerciseStore = useExerciseStore()
const { currentQuestion, canViewAnswer } = storeToRefs(exerciseStore)

const currentFunction = ref<'chatAi' | 'askTeacher' | 'viewAnswer' | 'similarQuestion'>('chatAi')


// 退出状态标记
const isExiting = ref(false)

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)

const hasSelectedQuestion = computed(() => {
  return currentQuestion.value !== null
})

const canAskTeacher = computed(() => {
  return hasSelectedQuestion.value && exerciseStore.teacherMessages.length > 0
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

const handleScrollToQuestionAndSelect = (targetIndex: number) => {
  // 调用题目列表的滚动到指定题目并设置为选中状态方法
  if (questionListRef.value && typeof questionListRef.value.scrollToQuestionAndSelect === 'function') {
    console.log('📍 [父组件] 调用题目列表滚动到指定题目并设置为选中状态', targetIndex)
    questionListRef.value.scrollToQuestionAndSelect(targetIndex)
  }
}

// 滚动到页面底部的方法
const scrollToBottom = () => {
  console.log('🎯 [ExerciseSolveView] 滚动到页面底部')
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

const exitActivity = async () => {
  // 防止重复点击
  if (isExiting.value) return
  
  isExiting.value = true
  
  try {
    // 使用快速保存方法，不阻塞退出操作
    exerciseStore.quickSaveProgress().catch(() => {
    })
    
    // 立即退出，不等待保存完成
    exerciseStore.exitActivity()
  } finally {
    // 确保状态被重置（虽然通常不会执行到这里，因为已经退出了）
    isExiting.value = false
  }
}

onMounted(async () => {
    // Web环境：直接使用配置
    const config = {
      apiBaseURL: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
      subject: 'MATH',
      token: localStorage.getItem('token') || ''
    }
    
    // 静默初始化，不显示加载状态
    try {
      await exerciseStore.initializeStore(config)
      await exerciseStore.fetchQuestions()
    } catch (error) {
      console.error('初始化失败:', error)
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

.app-header {
  height: $header-height;
  min-height: $header-height;
  max-height: $header-height;
  border-bottom: $border-width solid $border-color;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: #ffffff;
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
  width: 40px; // 与返回按钮宽度保持平衡
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  background-color: #f8f9fa; /* Gemini 风格的整体背景 */
  min-height: 0;
}

.question-panel {
  background-color: #f8f9fa; /* Gemini 风格的浅灰背景 */
  @include full-height-flex;
  overflow: hidden;

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

  .q-card {
    @include full-height-flex;
    background-color: transparent;
    border: none;
    box-shadow: none;
  }
}

.function-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 4px 8px;
}

.function-btn {
  font-size: 13px;
  padding: 6px 12px;
  min-width: auto;
  border-radius: 6px;
  transition: all 0.2s ease;
  position: relative;
  
  
  // 选中状态样式 - 深蓝色，无光晕效果
  &.text-primary {
    background: #1a73e8;
    color: #ffffff !important;
    font-weight: 600;
    border: 1px solid #1a73e8;
    position: relative;
    z-index: 1;
    
    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 2px;
      background: linear-gradient(90deg, #ffffff, #e3f2fd);
      border-radius: 1px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
  }
  
  // 可选状态样式 - 沉重、缺乏活力
  &.text-grey-6 {
    background: #e9ecef !important;
    color: #6c757d !important;
    border: 1px solid #dee2e6 !important;
    font-weight: normal !important;
  }
  
  // 禁用状态样式 - 极简、几乎不可见
  &.q-btn--disable,
  &[disabled] {
    background: #f8f9fa !important;
    color: #adb5bd !important;
    border: 1px solid #e9ecef !important;
    cursor: not-allowed !important;
    opacity: 0.4;
    font-weight: normal !important;
    position: relative;
    
    // 禁用时移除选中状态的样式
    &.text-primary {
      background: #f8f9fa !important;
      color: #adb5bd !important;
      font-weight: normal !important;
      border: 1px solid #e9ecef !important;
      
      &::after {
        display: none !important;
      }
    }
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

// 全局禁用状态样式 - 确保 Quasar 禁用按钮正确应用样式
:deep(.q-btn--disable) {
  background: #f5f5f5 !important;
  color: #757575 !important;
  border: 1px solid #d0d0d0 !important;
  cursor: not-allowed !important;
  opacity: 0.7;
  font-weight: normal !important;
  position: relative;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  
  &::before {
    content: '🚫';
    position: absolute;
    top: 50%;
    right: 8px;
    transform: translateY(-50%);
    font-size: 12px;
    opacity: 0.6;
  }
  
  
  // 禁用时移除选中状态的样式
  &.text-primary {
    background: #f5f5f5 !important;
    color: #757575 !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
    font-weight: normal !important;
    border: 1px solid #d0d0d0 !important;
    text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
    
    &::before {
      content: '🚫';
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      font-size: 12px;
      opacity: 0.6;
    }
    
    &::after {
      display: none !important;
    }
  }
}

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

  .function-buttons {
    gap: 4px;
    padding: 2px 4px;
  }

  .function-btn {
    font-size: 11px;
    padding: 4px 8px;
    min-width: auto;
  }
  
  .toolbar-spacer {
    width: 32px;
  }
}

@media (min-width: #{$mobile-breakpoint + 1px}) and (max-width: $tablet-breakpoint) {
  .question-panel {
    flex: 0 0 35%;
  }

  .function-panel {
    flex: 0 0 65%;
  }
}

@media (min-width: $desktop-breakpoint) {
  .question-panel {
    flex: 0 0 30%;
  }

  .function-panel {
    flex: 0 0 70%;
  }
}
</style>
