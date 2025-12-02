<template>
  <div class="similar-question-list">
    <!-- 相似题目列表 -->
    <RubberBandList class="scroll-wrapper">
      <div class="scroll-content">
        <div class="q-pa-md">
        <!-- 加载状态 -->
        <div v-if="loading" class="native-loading-container">
          <q-spinner-dots size="50px" color="primary" />
          <div class="text-h6 q-mt-md native-text-xl">正在查找相似题目...</div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="similarQuestions.length === 0" class="native-empty-state">
          <q-icon name="search_off" size="80px" color="grey-5" />
          <div class="text-h6 q-mt-md text-grey-7 native-text-3xl">未找到相似题目</div>
          <div class="text-body2 text-grey-6 q-mt-sm native-text-md">
            {{ hasSelectedQuestion ? '当前题目暂无相似题目' : '请先选择一道题目' }}
          </div>
          <q-btn
            v-if="hasSelectedQuestion"
            color="primary"
            outline
            class="q-mt-md native-btn"
            @click="findSimilarQuestions"
          >
            重新查找
          </q-btn>
        </div>

        <!-- 相似题目项 - 与 QuestionList 保持一致的卡片布局 -->
        <div v-else class="similar-questions-container">
          <div
            v-for="(question, index) in similarQuestions"
            :key="question.bmNo || index"
            class="similar-question-item"
            :class="{ 'question-in-user-list': questions.some(q => q.bmNo === question.bmNo) }"
          >
            <!-- 题目组块 - 统一背景包裹 -->
            <div class="question-block">
              <!-- 题目序号 -->
              <div class="question-number">{{ index + 1 }}</div>

              <!-- 题目内容 - Markdown渲染 -->
              <div
                class="question-content"
                @touchstart="handleContentTouchStart"
                @touchmove="handleContentTouchMove"
                @wheel="handleContentWheel"
              >
                <div
                  v-html="renderMarkdown(getQuestionContent(question))"
                  class="markdown-content"
                  v-mathjax-preview="handleImagePreview"
                ></div>
              </div>

              <!-- 添加按钮 -->
              <q-btn
                icon="add"
                color="primary"
                flat
                round
                size="sm"
                class="add-btn"
                @click="!question.atUserList && addToMyList(question)"
                :disable="question.atUserList"
              >
                <q-tooltip>
                  {{ question.atUserList ? '已在题库中' : '添加到第一题位置' }}
                </q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>
        </div>
      </div>
    </RubberBandList>
    <ImageViewer v-model="showImagePreview" :image-url="previewImageUrl" alt="题目图片" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuestionStore } from '../stores/questionStore'
import { storeToRefs } from 'pinia'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { showMessage } from '../utils'
import RubberBandList from './RubberBandList.vue'
import ImageViewer from './ImageViewer.vue'
const questionStore = useQuestionStore()
const { currentQuestion, similarQuestions, questions } = storeToRefs(questionStore)

// 定义事件
const emit = defineEmits<{
  questionAdded: []
}>()

// 响应式数据
const loading = ref(false)
const showImagePreview = ref(false)
const previewImageUrl = ref<string>('')

// 外层列表滚动改为使用 RubberBandList 橡皮筋滚动效果，不再依赖 BetterScroll

// 计算属性
const hasSelectedQuestion = computed(() => {
  return currentQuestion.value !== null
})

// 查找相似题目
const findSimilarQuestions = async () => {
  if (!hasSelectedQuestion.value) {
    showMessage('请先选择一道题目', 'warning')
    return
  }

  try {
    loading.value = true
    await questionStore.findSimilarQuestions(currentQuestion.value?.id || '')

    if (similarQuestions.value.length === 0) {
      showMessage('未找到相似题目', 'info')
    }
    
    // 等待 DOM 根据 latest similarQuestions 渲染完
    await nextTick()
  } catch (error) {
    showMessage('查找相似题目失败', 'error')
  } finally {
    loading.value = false
  }
}

// 添加题目到题目列表
const addToMyList = async (question: any) => {
  if (!question) return
  try {
    const subject = currentQuestion.value?.subject || ''
    await questionStore.addSimilarQuestionToList(question, subject)

    // 通知父组件刷新题目列表
    emit('questionAdded')
    showMessage('添加成功', 'success')
  } catch (error) {
    // 根据错误类型显示不同的提示信息
    const errorMessage = error instanceof Error && error.message.includes('已存在') 
      ? '该题目已存在于题目列表中，无法重复添加'
      : '添加题目失败，请重试'
    showMessage(errorMessage, 'warning')
  }
}

// 使用与 QuestionList 相同的渲染器
const { renderMessageContent } = useMessageRenderer()

// 获取题目内容
const getQuestionContent = (question: any) => {
  return question.content || question.question || question.title || ''
}

// Markdown渲染 - 使用公共方法
const renderMarkdown = (content: string) => {
  return renderMessageContent(content)
}

const handleImagePreview = (url: string) => {
  previewImageUrl.value = url
  showImagePreview.value = true
}

// 检查元素是否有滚动条
const hasScrollbar = (element: HTMLElement): boolean => {
  if (!element) return false
  const hasVerticalScrollbar = element.scrollHeight > element.clientHeight
  const hasHorizontalScrollbar = element.scrollWidth > element.clientWidth
  return hasVerticalScrollbar || hasHorizontalScrollbar
}

// 查找最近的 question-content 容器
const findQuestionContentContainer = (target: EventTarget | null): HTMLElement | null => {
  if (!target || !(target instanceof HTMLElement)) return null

  let element: HTMLElement | null = target
  while (element && element !== document.body) {
    if (element.classList.contains('question-content')) {
      return element
    }
    element = element.parentElement
  }
  return null
}

// 处理内部滚动容器事件，有滚动条时阻止事件冒泡，避免 BetterScroll 劫持
const handleContentTouchStart = (event: TouchEvent) => {
  const container = findQuestionContentContainer(event.target)
  if (container && hasScrollbar(container)) {
    event.stopPropagation()
  }
}

const handleContentTouchMove = (event: TouchEvent) => {
  const container = findQuestionContentContainer(event.target)
  if (container && hasScrollbar(container)) {
    event.stopPropagation()
  }
}

const handleContentWheel = (event: WheelEvent) => {
  const container = findQuestionContentContainer(event.target)
  if (container && hasScrollbar(container)) {
    event.stopPropagation()
  }
}

// 生命周期
onMounted(async () => {
  // 如果已经选择了题目，自动查找相似题目
  if (hasSelectedQuestion.value) {
    findSimilarQuestions()
  }
})

// 暴露方法给父组件
defineExpose({
  findSimilarQuestions,
})
</script>

<style lang="scss" scoped>
// ===== 变量定义 - Gemini 风格 =====
$primary-color: #1a73e8;
$primary-color-light: rgba(26, 115, 232, 0.08);
$primary-color-hover: rgba(26, 115, 232, 0.04);
$border-color: rgba(0, 0, 0, 0.06);
$border-color-subtle: rgba(0, 0, 0, 0.03);
$background-white: #ffffff;
$background-light: #f8f9fa;
$background-grey: #f1f3f4;
$background-hover: rgba(0, 0, 0, 0.02);
$background-selected: rgba(26, 115, 232, 0.08);
$text-primary: #202124;
$text-secondary: #5f6368;
$text-tertiary: #9aa0a6;
$shadow-subtle: 0 1px 2px 0 rgba(60, 64, 67, 0.1);
$shadow-hover: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
$transition-smooth: all 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);

// ===== 混合器定义 =====
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

@mixin button-base {
  border: none;
  border-radius: 16px;
  transition: $transition-smooth;
  cursor: pointer;
}

@mixin card-shadow($level: subtle) {
  @if $level == subtle {
    box-shadow: $shadow-subtle;
  } @else if $level == hover {
    box-shadow: $shadow-hover;
  } @else if $level == selected {
    box-shadow: 0 0 0 1px rgba(26, 115, 232, 0.2), $shadow-subtle;
  }
}

@mixin responsive-padding($mobile: 12px 16px, $tablet: 16px 20px) {
  padding: $tablet;
  
  @media (max-width: 768px) {
    padding: $mobile;
  }
}

// ===== 主容器样式 =====
.similar-question-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: $background-light;
}

.scroll-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.scroll-content {
  min-height: calc(100% + 1px);
}

.similar-questions-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.similar-question-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 4px;
  border: none;
  border-radius: 16px;
  background-color: transparent;
  transition: $transition-smooth;
  cursor: pointer;
  transform: translateZ(0);
  backface-visibility: hidden;
  // 题目组块 - 与 QuestionList 保持一致
  .question-block {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 16px;
    background-color: $background-white;
    border-radius: 12px;
    border: 1px solid $border-color;
    @include card-shadow(subtle);
    transition: border-color 0.2s ease;
    overflow: visible; // 允许长公式显示
    min-width: 0; // 允许组块收缩
  }

  // 悬停效果
  &:hover {
    .question-block {
      @include card-shadow(hover);
    }
  }

  // 已在题库状态 - 橙色风格（与 FindExerciseQuestionList 对齐）
  &.question-in-user-list {
    .question-block {
      background-color: #fff9f6; // 浅橙色背景
      border-color: #ff9767; // 橙色边框
    }
  }

  &.question-adding {
    opacity: 0.6;
    pointer-events: none;
  }
}

.similar-question-item .question-number {
  @include flex-center;
  width: 28px;
  height: 28px;
  background-color: $background-grey !important;
  color: $text-secondary !important;
  border-radius: 14px;
  font-weight: 500;
  font-size: 13px;
  flex-shrink: 0;
  @include card-shadow(subtle);
}

.question-content {
  flex: 1;
  min-width: 0;
  // 固定题目内容区域的最大宽度，超出部分使用横向滚动条（与 QuestionList 类似）
  max-width: 540px;
  overflow-x: auto;
  overflow-y: hidden;
  
  // 内容滚动条样式
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.4);
  }
}

.add-btn {
  flex-shrink: 0;
  margin-top: 4px;
  @include button-base;
  background-color: transparent;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  
  &:hover {
    background-color: $background-hover;
    @include card-shadow(subtle);
  }
  
  :deep(.q-btn__content) {
    font-size: 14px;
  }
}

// ===== Markdown 内容样式 - 与 QuestionList 保持一致 =====
.markdown-content {
  font-size: 14px !important;
  line-height: 1.5;
  color: $text-primary;
  overflow-x: auto;
  overflow-y: hidden;
  word-wrap: break-word;
  word-break: break-word;
  
  // MathJax 公式样式处理
  :deep(.mjx-chtml),
  :deep(.mjx-math) {
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    display: inline-block;
    vertical-align: middle;
  }
  
  // 行内公式处理
  :deep(.mjx-chtml[display="inline"]) {
    max-width: 100%;
    overflow-x: auto;
    white-space: nowrap;
  }
  
  // 块级公式处理
  :deep(.mjx-chtml[display="block"]) {
    max-width: 100%;
    overflow-x: auto;
    margin: 8px 0;
    text-align: center;
  }
  
  // 公式容器滚动条样式
  :deep(.mjx-chtml)::-webkit-scrollbar {
    height: 3px;
  }
  
  :deep(.mjx-chtml)::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 2px;
  }
  
  :deep(.mjx-chtml)::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 2px;
  }
  
  :deep(.mjx-chtml)::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.5);
  }

  :deep(p) {
    margin: 0 0 8px 0;
    font-size: inherit;
    line-height: inherit;

    &:last-child {
      margin-bottom: 0;
    }

    + p {
      margin-top: 12px;
    }
  }

  :deep(br) {
    line-height: 1.5;
    display: block;
    margin: 4px 0;
  }

  :deep(strong) {
    font-weight: 500;
    color: $text-primary;
  }

  :deep(em) {
    font-style: italic;
    color: $text-secondary;
  }

  :deep(code) {
    background-color: $background-grey;
    padding: 3px 6px;
    border-radius: 6px;
    font-family: 'Google Sans Mono', 'Courier New', monospace;
    font-size: 0.9em;
    color: $text-primary;
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
    display: block;
    @include card-shadow(subtle);
  }

  :deep(blockquote) {
    border-left: 3px solid $primary-color;
    margin: 8px 0;
    padding-left: 12px;
    color: $text-secondary;
    background-color: $background-light;
    border-radius: 0 6px 6px 0;
    padding: 8px 12px;
  }

  :deep(ul),
  :deep(ol) {
    margin: 8px 0;
    padding-left: 20px;
  }

  :deep(li) {
    margin: 4px 0;
    color: $text-primary;
  }

  :deep(*) {
    word-wrap: break-word;
    word-break: break-word;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 12px 0 8px 0;
    font-weight: 500;
    color: $text-primary;
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
    border-radius: 8px;
    overflow: hidden;
    @include card-shadow(subtle);
  }

  :deep(th),
  :deep(td) {
    border: 1px solid $border-color;
    padding: 8px 12px;
    text-align: left;
  }

  :deep(th) {
    background-color: $background-grey;
    font-weight: 500;
    color: $text-primary;
  }
}

// ===== 加载和空状态样式 - 与 QuestionList 保持一致 =====
.native-loading-container,
.native-empty-state {
  @include flex-center;
  flex-direction: column;
  min-height: 240px;
  text-align: center;
  padding: 32px 20px;
  
  .text-h6 {
    color: $text-secondary;
    font-weight: 400;
    margin-top: 16px;
  }
  
  .q-btn {
    margin-top: 20px;
    border-radius: 20px;
    padding: 8px 24px;
    font-weight: 500;
    text-transform: none;
    @include card-shadow(subtle);
    
    &:hover {
      @include card-shadow(hover);
    }
  }
}

// ===== 响应式设计 - 与 QuestionList 保持一致 =====
@media (max-width: 768px) {
  .similar-question-item {
    .question-block {
      padding: 12px;
      gap: 8px;
    }

    .question-number {
      width: 24px;
      height: 24px;
      font-size: 12px;
      border-radius: 12px;
      background-color: $background-grey !important;
      color: $text-secondary !important;
    }

    .add-btn {
      width: 20px;
      height: 20px;
      border-radius: 10px;
      
      :deep(.q-btn__content) {
        font-size: 12px;
      }
    }
  }

  .markdown-content {
    font-size: 13px !important;
    overflow: visible;
  }
}

@media (max-width: 480px) {
  .similar-question-item {
    .question-block {
      padding: 10px;
      gap: 6px;
    }

    .question-number {
      width: 22px;
      height: 22px;
      font-size: 11px;
      border-radius: 11px;
      background-color: $background-grey !important;
      color: $text-secondary !important;
    }

    .add-btn {
      width: 18px;
      height: 18px;
      border-radius: 9px;
      
      :deep(.q-btn__content) {
        font-size: 11px;
      }
    }
  }
}

// ===== Gemini 风格通知样式 =====
:deep(.gemini-notify) {
  font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: gemini-notify-enter 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  
  .q-notification__message {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    padding: 0 8px;
  }
  
  .q-notification__actions {
    .q-btn {
      border-radius: 8px;
      width: 24px;
      height: 24px;
      min-height: 24px;
      padding: 0;
      
      .q-btn__content {
        font-size: 16px;
      }
    }
  }
  
  // 不同类型通知的颜色
  &.q-notification--positive {
    background: linear-gradient(135deg, #34a853 0%, #2d8f47 100%);
    color: white;
  }
  
  &.q-notification--negative {
    background: linear-gradient(135deg, #ea4335 0%, #d33b2c 100%);
    color: white;
  }
  
  &.q-notification--warning {
    background: linear-gradient(135deg, #fbbc04 0%, #f9ab00 100%);
    color: #202124;
  }
  
  &.q-notification--info {
    background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
    color: white;
  }
}

// 通知进入动画
@keyframes gemini-notify-enter {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
