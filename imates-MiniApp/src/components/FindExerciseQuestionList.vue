<template>
  <view class="find-exercise-question-list">
    <!-- 题目列表内容 -->
    <RubberBandList
      class="scroll-wrapper"
      :enable-load-more="canLoadMore"
      :load-more-threshold="200"
      :loading="isLoading"
      @loadMore="handleLoadMore"
    >
      <view class="scroll-content">
        <!-- 加载状态 - 使用骨架屏 -->
        <view v-if="isLoading && similarQuestions.length === 0" class="native-loading-container">
          <QuestionListSkeleton animation-speed="fast" :skeleton-count="4" :columns="2" />
        </view>
        <!-- 空状态 -->
        <view v-else-if="similarQuestions.length === 0 && !isLoading" class="empty-state-container">
          <view class="empty-state-content">
            <view class="empty-icon-wrapper">
              <view class="empty-icon-bg"></view>
            </view>
            <view class="empty-title">未找到相似题目</view>
            <view class="empty-description">
              根据当前知识点暂未找到相关题目，<br />
              请尝试调整知识点范围或刷新页面
            </view>
            <BaseButton
              label="刷新页面"
              @click="handleRefresh"
              class="empty-action-btn"
            />
          </view>
        </view>

        <!-- 题目列表 - 优化后的卡片布局 -->
        <view v-else class="questions-container">
          <view
            v-for="(question, index) in similarQuestions"
            :key="question.bmNo"
            class="question-item"
            :class="{
              'question-selected': isSelected(question.bmNo),
              'question-in-user-list': question.atUserList,
            }"
            @click="handleQuestionClick(question)"
          >
            <!-- 题目组块 - 统一背景包裹，包含复选框 -->
            <view class="question-block">
              <!-- 题目序号和复选框 -->
              <view class="question-header">
                <view class="question-number">题目{{ index + 1 }}</view>
                <view class="question-checkbox">
                  <BaseCheckbox
                    :model-value="isSelected(question.bmNo)"
                    @update:model-value="() => handleToggleSelection(question.bmNo)"
                    :disabled="question.atUserList"
                    @click.stop
                    class="checkbox-btn"
                  />
                </view>
              </view>

              <!-- 题目内容 - Markdown渲染 -->
              <view
                class="question-content"
                @touchstart.stop="handleContentTouchStart"
                @touchmove.stop="handleContentTouchMove"
              >
                <rich-text :nodes="renderQuestionContent(question)" class="markdown-content"></rich-text>
              </view>
            </view>
          </view>

          <!-- 加载更多指示器 -->
          <view v-if="isLoading && similarQuestions.length > 0" class="load-more-indicator">
            <BaseLoading size="24" text="正在加载更多题目..." />
          </view>

          <!-- 没有更多数据提示 -->
          <view v-else-if="!canLoadMore && similarQuestions.length > 0" class="no-more-data">
            <text class="no-more-text">没有更多题目了</text>
          </view>

          <!-- 加载更多按钮 -->
          <view v-else-if="canLoadMore && !isLoading" class="load-more-button">
            <BaseButton
              label="加载更多题目"
              @click="handleLoadMore"
              class="load-more-btn"
              variant="ghost"
            />
          </view>
        </view>
      </view>
    </RubberBandList>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useFindExerciseStore } from '../stores/findExerciseStore'
import { storeToRefs } from 'pinia'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import BaseButton from './base/Button.vue'
import BaseCheckbox from './base/Checkbox.vue'
import BaseLoading from './base/Loading.vue'
import QuestionListSkeleton from './display/QuestionListSkeleton.vue'

// 定义事件
const emit = defineEmits<{
  questionSelected: [questionId: string]
  questionDeselected: [questionId: string]
  refresh: []
}>()

// 使用store
const findExerciseStore = useFindExerciseStore()
const { similarQuestions, selectedQuestionIds, isLoading, canLoadMore } =
  storeToRefs(findExerciseStore)

// 使用消息渲染器
const { renderMessageContent } = useMessageRenderer()

// 防抖相关状态
const isLoadMorePending = ref(false)

// 计算属性
const isSelected = (questionId: string) => {
  // 如果题目已在用户列表中，则始终显示为选中状态
  const question = similarQuestions.value.find((q) => q.bmNo === questionId)
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
  const question = similarQuestions.value.find((q) => q.bmNo === questionId)
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

// 处理加载更多按钮点击
const handleLoadMore = async () => {
  if (isLoading.value || !canLoadMore.value || isLoadMorePending.value) return

  try {
    isLoadMorePending.value = true
    const success = await findExerciseStore.loadMoreQuestions()
    if (success) {
    } else {
    }
  } catch (error) {
    console.error('加载更多题目失败:', error)
  } finally {
    isLoadMorePending.value = false
  }
}

// 渲染题目内容（支持Markdown和公式）
const renderQuestionContent = (question: {
  question?: string
  title?: string
  content?: string
}) => {
  const content = question.question || question.title || question.content || ''
  return renderMessageContent(content)
}

const handleContentTouchStart = (event: TouchEvent) => {
  // 小程序中阻止冒泡
}

const handleContentTouchMove = (event: TouchEvent) => {
  // 小程序中阻止冒泡
}

// 生命周期
// 暴露方法给父组件
defineExpose({
  refresh: handleRefresh,
  loadMore: handleLoadMore,
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
$transition-smooth: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

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
    box-shadow:
      0 0 0 1px rgba(26, 115, 232, 0.2),
      $shadow-subtle;
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
  overflow: hidden;
}

.scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.scroll-content {
  min-height: calc(100% + 1px);
}

.questions-container {
  display: grid;
  grid-template-columns: 50% 50%;

  // 加载更多按钮跨两列居中
  .load-more-indicator,
  .no-more-data,
  .load-more-button {
    grid-column: 1 / -1; // 跨所有列
  }
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
    height: 149px;
    padding: 8px 16px;
    background-color: $background-white;
    border-radius: 12px;
    border: 1px solid $border-color;
    @include card-shadow(subtle);
    overflow: hidden; // 防止内容溢出卡片边界，但不影响内部滚动
    min-width: 0; // 允许组块收缩
  }

  // 悬停效果
  &:hover {
    .question-block {
      @include card-shadow(hover);
      border-color: $primary-color;
    }
  }

  // 选中状态 - 蓝色风格
  &.question-selected {
    .question-block {
      background-color: #eff3ff; // 浅蓝色背景
      border-color: #5E80FE; // 蓝色边框
    }
  }

  // 已在题库状态 - 橙色风格
  &.question-in-user-list {
    .question-block {
      background-color: #fff9f6; // 浅橙色背景
      border-color: #ff9767; // 橙色边框
    }
  }
}

.question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0; // 固定头部高度，不压缩
  margin-bottom: 8px; // 添加底部间距
}

.question-checkbox {
  flex-shrink: 0;
  padding: 4px; // 增加点击区域
  margin: -4px; // 抵消padding对布局的影响
}

.question-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 28px;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
  white-space: nowrap;
}

.question-content {
  flex: 1;
  min-width: 0;
  min-height: 0; // 允许收缩
  overflow-x: auto;
  overflow-y: auto; // 垂直方向溢出时显示滚动条
  height: 0; // 配合 flex: 1 使用，确保高度计算正确
  position: relative; // 确保滚动条正确显示
  touch-action: pan-y pan-x; // 允许垂直和水平滚动，确保嵌套滚动正常工作
  -webkit-overflow-scrolling: touch; // iOS 平滑滚动
  overscroll-behavior: auto;

  // 内容滚动条样式
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
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

}

// 选中状态的复选框样式 - 蓝色
.question-item.question-selected .checkbox-btn {
  :deep(.q-checkbox__inner--truthy .q-checkbox__bg){
      background-color: #5e80fe; // 蓝色
      border-color: #5e80fe;
  }
}

// 已在题库状态的复选框样式 - 橙色
.question-item.question-selected.question-in-user-list .checkbox-btn {
  :deep(.q-checkbox__inner--truthy .q-checkbox__bg) {
    background-color: #ff9767;
    border-color: #ff9767;
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
  :deep(.mjx-chtml[display='inline']) {
    max-width: 100%;
    overflow-x: auto;
    white-space: nowrap;
  }

  // 块级公式处理
  :deep(.mjx-chtml[display='block']) {
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
.native-loading-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

// ===== 空状态样式 - 知识点查找题目专用设计 =====
.empty-state-container {
  @include flex-center;
  flex: 1;
  min-height: 400px;
  padding: 48px 24px;
  background: linear-gradient(180deg, $background-light 0%, rgba(255, 255, 255, 0.8) 100%);
}

.empty-state-content {
  @include flex-center;
  flex-direction: column;
  max-width: 480px;
  width: 100%;
  text-align: center;
}

.empty-icon-wrapper {
  position: relative;
  margin-bottom: 32px;
  
  .q-icon {
    position: relative;
    z-index: 2;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.08));
  }
  
  .empty-icon-bg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 120px;
    height: 120px;
    background: radial-gradient(circle, rgba(26, 115, 232, 0.06) 0%, transparent 70%);
    border-radius: 50%;
    z-index: 1;
  }
}

.empty-title {
  font-size: 24px;
  font-weight: 500;
  color: $text-primary;
  margin-bottom: 12px;
  line-height: 1.4;
}

.empty-description {
  font-size: 15px;
  color: $text-secondary;
  line-height: 1.6;
  margin-bottom: 32px;
  max-width: 360px;
}

.empty-action-btn {
  border-radius: 24px;
  padding: 12px 32px;
  font-weight: 500;
  font-size: 15px;
  text-transform: none;
  min-height: 44px;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
  transition: $transition-smooth;

  &:hover {
    box-shadow: 0 4px 12px rgba(26, 115, 232, 0.3);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(26, 115, 232, 0.25);
  }

  .q-icon {
    font-size: 20px;
    margin-right: 8px;
  }
}

// 兼容旧样式（保持向后兼容）
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
  width: 100%;

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
  width: 100%;

  .no-more-text {
    margin-left: 8px;
    font-size: 14px;
  }
}

.load-more-button {
  @include flex-center;
  padding: 16px;
  width: 100%;

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
  .questions-container {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .question-item {
    .question-block {
      height: 400px; // 移动端高度，从320px增加到400px
      padding: 12px;
      gap: 8px;
    }

    .question-number {
      min-width: 40px;
      height: 24px;
      padding: 3px 6px;
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
  .questions-container {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .question-item {
    .question-block {
      height: 380px; // 小屏幕高度，从300px增加到380px
      padding: 10px;
      gap: 6px;
    }

    .question-number {
      min-width: 36px;
      height: 22px;
      padding: 2px 5px;
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

  // 移动端空状态优化
  .empty-state-container {
    min-height: 300px;
    padding: 32px 16px;
  }

  .empty-icon-wrapper {
    margin-bottom: 24px;
    
    .q-icon {
      font-size: 72px !important;
    }
    
    .empty-icon-bg {
      width: 96px;
      height: 96px;
    }
  }

  .empty-title {
    font-size: 20px;
    margin-bottom: 10px;
  }

  .empty-description {
    font-size: 14px;
    margin-bottom: 24px;
    max-width: 100%;
  }

  .empty-action-btn {
    padding: 10px 24px;
    font-size: 14px;
    min-height: 40px;
  }
}
</style>
