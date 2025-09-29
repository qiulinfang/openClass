<template>
  <div class="find-exercise-question-list">
    <!-- 题目列表内容 -->
    <q-scroll-area 
      class="questions-scroll" 
      :thumb-style="thumbStyle"
      @scroll="handleScrollEvent"
    >
      <div class="q-pa-md">
        <!-- 加载状态 -->
        <div v-if="isLoading && similarQuestions.length === 0" class="native-loading-container">
          <q-spinner-dots size="50px" color="primary" />
          <div class="text-h6 q-mt-md native-text-xl">正在查找相似题目...</div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="similarQuestions.length === 0 && !isLoading" class="native-empty-state">
          <q-icon name="search_off" size="80px" color="grey-5" />
          <div class="text-h6 q-mt-md text-grey-7 native-text-3xl">未找到相似题目</div>
          <div class="text-body2 text-grey-6 q-mt-sm native-text-md">
            请尝试调整搜索条件或刷新页面
          </div>
          <q-btn
            flat
            color="primary"
            label="刷新页面"
            icon="refresh"
            @click="handleRefresh"
            class="q-mt-md"
          />
        </div>

        <!-- 题目列表 - 优化后的卡片布局 -->
        <div v-else class="questions-container">
          <div
            v-for="(question, index) in similarQuestions"
            :key="question.bmNo"
            class="question-item"
            :class="{ 
              'question-selected': isSelected(question.bmNo),
              'question-in-user-list': question.atUserList 
            }"
            @click="handleQuestionClick(question)"
          >
            <!-- 题目组块 - 统一背景包裹，包含复选框 -->
            <div class="question-block">
              <!-- 题目序号和复选框 -->
              <div class="question-header">
                <div class="question-number">{{ index + 1 }}</div>
                <div class="question-checkbox">
                  <q-checkbox
                    :model-value="isSelected(question.bmNo)"
                    @update:model-value="() => handleToggleSelection(question.bmNo)"
                    :disable="question.atUserList"
                    :readonly="question.atUserList"
                    color="primary"
                    @click.stop
                    class="checkbox-btn"
                    size="md"
                  />
                </div>
              </div>

              <!-- 题目内容 - Markdown渲染 -->
              <div class="question-content">
                <div
                  v-html="renderQuestionContent(question)"
                  class="markdown-content"
                ></div>
              </div>
            </div>
          </div>

          <!-- 加载更多指示器 -->
          <div v-if="isLoading && similarQuestions.length > 0" class="load-more-indicator">
            <q-spinner-dots size="24px" color="primary" />
            <span class="loading-text">正在加载更多题目...</span>
          </div>

          <!-- 没有更多数据提示 -->
          <div v-else-if="!canLoadMore && similarQuestions.length > 0" class="no-more-data">
            <q-icon name="check_circle" size="20px" color="grey-5" />
            <span class="no-more-text">没有更多题目了</span>
          </div>

          <!-- 加载更多按钮 -->
          <div v-else-if="canLoadMore && !isLoading" class="load-more-button">
            <q-btn
              flat
              color="primary"
              label="加载更多题目"
              icon="expand_more"
              @click="handleLoadMore"
              class="load-more-btn"
            />
          </div>
        </div>
      </div>
    </q-scroll-area>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useFindExerciseStore } from '../stores/findExerciseStore'
import { storeToRefs } from 'pinia'
import { useMessageRenderer } from '../composables/useMessageRenderer'

// 定义事件
const emit = defineEmits<{
  questionSelected: [questionId: string]
  questionDeselected: [questionId: string]
  refresh: []
}>()

// 使用store
const findExerciseStore = useFindExerciseStore()
const { similarQuestions, selectedQuestionIds, isLoading, canLoadMore } = storeToRefs(findExerciseStore)

// 使用消息渲染器
const { renderMessageContent } = useMessageRenderer()

// 防抖相关状态
const isLoadMorePending = ref(false)
const loadMoreTimeout = ref<number | null>(null)

// 滚动条样式
const thumbStyle = {
  right: '4px',
  borderRadius: '5px',
  backgroundColor: '#027be3',
  width: '5px',
  opacity: '0.75',
}

// 计算属性
const isSelected = (questionId: string) => {
  // 如果题目已在用户列表中，则始终显示为选中状态
  const question = similarQuestions.value.find(q => q.bmNo === questionId)
  if (question?.atUserList) {
    return true
  }
  return selectedQuestionIds.value.includes(questionId)
}

// 方法
const handleQuestionClick = (question: { bmNo: string; atUserList?: boolean }) => {
  if (!question.atUserList) {
    handleToggleSelection(question.bmNo)
  }
}

const handleToggleSelection = (questionId: string) => {
  // 检查题目是否已在用户列表中
  const question = similarQuestions.value.find(q => q.bmNo === questionId)
  if (question?.atUserList) {
    // 已收藏的题目不允许取消选择
    return
  }
  
  const wasSelected = selectedQuestionIds.value.includes(questionId)
  findExerciseStore.toggleQuestionSelection(questionId)
  
  if (wasSelected) {
    emit('questionDeselected', questionId)
  } else {
    emit('questionSelected', questionId)
  }
}

const handleRefresh = () => {
  emit('refresh')
}

// 处理滚动事件 - 实现滚动到底部自动加载更多（带防抖）
const handleScrollEvent = (info: { verticalPosition: number; verticalPercentage: number; verticalSize: number; verticalContainerSize: number }) => {
  const { verticalPosition, verticalSize, verticalContainerSize } = info
  
  // 当滚动到距离底部100px时触发加载更多
  if (verticalPosition + verticalContainerSize >= verticalSize - 100) {
    // 防抖处理，避免重复触发
    if (loadMoreTimeout.value) {
      clearTimeout(loadMoreTimeout.value)
    }
    
    loadMoreTimeout.value = setTimeout(() => {
      handleLoadMore()
    }, 300) // 300ms防抖
  }
}

// 处理加载更多按钮点击
const handleLoadMore = async () => {
  if (isLoading.value || !canLoadMore.value || isLoadMorePending.value) return
  
  try {
    isLoadMorePending.value = true
    const success = await findExerciseStore.loadMoreQuestions()
    if (success) {
      console.log('成功加载更多题目')
    } else {
      console.log('没有更多题目了')
    }
  } catch (error) {
    console.error('加载更多题目失败:', error)
  } finally {
    isLoadMorePending.value = false
  }
}

// 渲染题目内容（支持Markdown和公式）
const renderQuestionContent = (question: { question?: string; title?: string; content?: string }) => {
  const content = question.question || question.title || question.content || ''
  return renderMessageContent(content)
}

// 暴露方法给父组件
defineExpose({
  refresh: handleRefresh,
  loadMore: handleLoadMore
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
.find-exercise-question-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: $background-light;
}

.questions-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.questions-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  @include responsive-padding(8px 12px, 12px 16px);
}

.question-item {
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

  // 题目组块 - 优化后的设计
  .question-block {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 16px;
    background-color: $background-white;
    border-radius: 12px;
    border: 1px solid $border-color;
    @include card-shadow(subtle);
    overflow: visible; // 允许长公式显示
    min-width: 0; // 允许组块收缩
  }

  // 悬停效果
  &:hover {
    .question-block {
      @include card-shadow(hover);
      border-color: $primary-color;
    }
  }

  &.question-selected {
    .question-block {
      border-color: $primary-color;
      background-color: rgba(26, 115, 232, 0.05);
    }
  }

  &.question-in-user-list {
    .question-block {
      background-color: rgba(34, 197, 94, 0.08);
      border-color: rgba(34, 197, 94, 0.5);
    }
  }
}

.question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.question-checkbox {
  flex-shrink: 0;
  padding: 4px; // 增加点击区域
  margin: -4px; // 抵消padding对布局的影响
}

.question-number {
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

// 选中状态下的题目序号样式
.question-item.question-selected .question-number {
  background-color: $primary-color !important;
  color: white !important;
}

// 已收藏状态下的题目序号样式
.question-item.question-in-user-list .question-number {
  background-color: #22c55e !important;
  color: white !important;
}

.question-content {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  
  // 内容滚动条样式
  &::-webkit-scrollbar {
    height: 2px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 1px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 1px;
    transition: background 0.2s ease;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.4);
  }
}

// 复选框样式优化
.checkbox-btn {
  // 增加整体点击区域
  min-width: 32px;
  min-height: 32px;
  padding: 6px;
  
  :deep(.q-checkbox__bg) {
    border-radius: 6px;
    border-width: 2px;
    transition: all 0.2s ease;
    width: 20px;
    height: 20px;
  }
  
  :deep(.q-checkbox__check) {
    color: white;
    font-weight: bold;
    font-size: 14px;
  }
  
  // 选中状态样式 - 更有活力的蓝色
  &.q-checkbox--truthy {
    :deep(.q-checkbox__bg) {
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      border-color: #1976d2;
      box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
    }
  }
  
  // 未选中状态样式
  &.q-checkbox--falsy {
    :deep(.q-checkbox__bg) {
      background-color: transparent;
      border-color: #e0e0e0;
      
      &:hover {
        border-color: $primary-color;
        background-color: rgba(25, 118, 210, 0.05);
      }
    }
  }
  
  // 禁用状态样式
  &.q-checkbox--disabled {
    :deep(.q-checkbox__bg) {
      background-color: #f5f5f5;
      border-color: #e0e0e0;
      opacity: 0.6;
    }
  }
}

// ===== Markdown 内容样式 - 与 SimilarQuestionList 保持一致 =====
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
    height: 2px;
  }
  
  :deep(.mjx-chtml)::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 1px;
  }
  
  :deep(.mjx-chtml)::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 1px;
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

// ===== 加载和空状态样式 - 与 SimilarQuestionList 保持一致 =====
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

// ===== 加载更多相关样式 =====
.load-more-indicator {
  @include flex-center;
  flex-direction: column;
  padding: 20px;
  color: $text-secondary;
  
  .loading-text {
    margin-top: 8px;
    font-size: 14px;
    font-weight: 500;
  }
}

.no-more-data {
  @include flex-center;
  padding: 16px;
  color: $text-tertiary;
  
  .no-more-text {
    margin-left: 8px;
    font-size: 14px;
  }
}

.load-more-button {
  @include flex-center;
  padding: 16px;
  
  .load-more-btn {
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

// ===== 响应式设计 - 与 SimilarQuestionList 保持一致 =====
@media (max-width: 768px) {
  .question-item {
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
  }

  .markdown-content {
    font-size: 13px !important;
    overflow: visible;
  }
  
  .load-more-indicator {
    padding: 16px;
    
    .loading-text {
      font-size: 13px;
    }
  }
  
  .no-more-data {
    padding: 12px;
    
    .no-more-text {
      font-size: 13px;
    }
  }
}

@media (max-width: 480px) {
  .question-item {
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
  }
  
  .load-more-button {
    padding: 12px;
    
    .load-more-btn {
      padding: 6px 20px;
      font-size: 13px;
    }
  }
}
</style>
