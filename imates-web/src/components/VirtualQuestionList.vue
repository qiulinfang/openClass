<template>
  <div class="virtual-question-list">
    <!-- 题目卡片容器 - 与QuestionList.vue保持一致的内边距 -->
    <div class="question-cards-container">
      <!-- 普通题目列表容器 -->
      <div class="question-list-container">
        <div 
          v-for="(item, index) in filteredQuestions" 
          :key="item.id"
          class="question-item-wrapper"
        >
          <div 
            class="question-card"
            :class="{ 
              'question-selected': selectedQuestionIndex === index,
              'question-deleting': deletingIds.has(item.id)
            }"
            @click="throttledHandleCardClick(item, index)"
          >
            <div class="question-block">
              <!-- 题目头部 -->
              <div class="question-header">
                <!-- 左侧：题目序号 -->
                <div class="question-number">{{ index + 1 }}</div>
                
                <!-- 右侧：功能区 -->
                <div class="question-actions">
                  <!-- 按钮组 - 只在选中时显示 -->
                  <div v-show="selectedQuestionIndex === index">
                    <!-- 主要操作按钮 - 发送给AI -->
                    <q-btn
                      icon="smart_toy"
                      color="primary"
                      flat
                      round
                      size="sm"
                      @click.stop="throttledSendToAi(item)"
                      class="action-btn primary-action"
                    >
                      <q-tooltip>发送给AI</q-tooltip>
                    </q-btn>

                    <!-- 置顶按钮 -->
                    <q-btn
                      v-if="index > 0"
                      icon="vertical_align_top"
                      color="orange"
                      flat
                      round
                      size="sm"
                      @click.stop="throttledMoveToTop(item.id)"
                      class="action-btn"
                    >
                      <q-tooltip>置顶</q-tooltip>
                    </q-btn>

                    <q-btn
                      icon="delete"
                      color="negative"
                      flat
                      round
                      size="sm"
                      :loading="deletingIds.has(item.id)"
                      :disable="deletingIds.has(item.id)"
                      @click.stop="throttledDeleteQuestion(item.id)"
                      class="action-btn"
                    >
                      <q-tooltip>{{ deletingIds.has(item.id) ? '处理中...' : '删除题目' }}</q-tooltip>
                    </q-btn>
                  </div>
                </div>
              </div>

              <!-- 题目内容 -->
              <div class="question-content-area">
                <div
                  class="markdown-content question-content"
                  v-html="renderMessageContent(item.question || item.title || '暂无内容')"
                  :ref="(el) => setContentRef(el as HTMLElement | null, item.id)"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick } from 'vue'
import { showMessage, ThrottleUtils, throttle } from '../utils'
import type { ExerciseItem } from '../types'
import { MathJaxUtils } from '../utils/math/mathjax'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { apiService } from '../services/api-service'
const emit = defineEmits<{
  startAiGuidance: [question: ExerciseItem]
  questionSelected: [question: ExerciseItem, index: number]
  moveToTop: [questionId: string]
}>()

// Props
// 导入类型定义
import type { VirtualQuestionListProps } from '../types'

// 定义Props
type Props = VirtualQuestionListProps

const props = withDefaults(defineProps<Props>(), {
  searchQuery: ''
})

// 响应式数据
const contentRefs = ref<Map<string, HTMLElement>>(new Map())
const renderedQuestions = new Set<string>()
const deletingIds = ref(new Set<string>())
const intersectionObservers = new Map<string, IntersectionObserver>() // 存储观察器，便于清理

// 移除虚拟滚动相关配置，使用普通列表渲染

// 使用与 ChatBubble 相同的渲染器
const { renderMessageContent } = useMessageRenderer()

// 计算属性 - 过滤后的题目列表
const filteredQuestions = computed(() => {
  if (!props.searchQuery?.trim()) {
    return props.questions
  }

  const query = props.searchQuery.toLowerCase().trim()
  return props.questions.filter(
    (question) =>
      (question.title && question.title.toLowerCase().includes(query)) ||
      (question.question && question.question.toLowerCase().includes(query)),
  )
})

// 设置内容引用，使用 Intersection Observer 实现真正的视口懒加载
const setContentRef = (el: HTMLElement | null, questionId: string) => {
  if (el && el instanceof HTMLElement) {
    contentRefs.value.set(questionId, el)
    
    // 只在首次渲染时处理MathJax，使用 Intersection Observer 实现懒加载
    if (!renderedQuestions.has(questionId)) {
      renderedQuestions.add(questionId)
      
      // 获取题目在列表中的索引
      const questionIndex = props.questions.findIndex(q => q.id === questionId)
      
      // 前3个题目立即渲染，确保首屏快速显示
      if (questionIndex < 3) {
        MathJaxUtils.renderMath(el, false) // 立即渲染
        nextTick(() => {
          adjustCardHeight(el, questionId)
        })
        return
      }
      
      // 其他题目使用 Intersection Observer 懒加载
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // 元素进入视口，立即渲染 MathJax
              MathJaxUtils.renderMath(el, false) // 立即渲染，不使用懒加载模式
              
              // 渲染完成后调整高度
              nextTick(() => {
                adjustCardHeight(el, questionId)
              })
              
              // 停止观察，避免重复渲染
              observer.unobserve(el)
              intersectionObservers.delete(questionId) // 从存储中移除
            }
          })
        },
        {
          root: null, // 使用视口作为根
          rootMargin: '100px', // 提前100px开始渲染，确保流畅体验
          threshold: 0.1 // 元素10%可见时触发
        }
      )
      
      // 存储观察器，便于清理
      intersectionObservers.set(questionId, observer)
      
      // 开始观察元素
      observer.observe(el)
    }
  }
}

// 调整卡片高度 - 简化版本，不再需要复杂的高度计算
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const adjustCardHeight = (_contentEl: HTMLElement, _questionId: string) => {
  // 普通列表模式下，让内容自然流动，不需要强制设置高度
  // 保留此函数是为了兼容现有的 Intersection Observer 调用
}

// 创建节流版本的方法 - 使用简单的节流工具
const throttledHandleCardClick = ThrottleUtils.fast(async (question: ExerciseItem, index: number) => {
  await selectQuestion(index)
})

const throttledSendToAi = throttle((question: ExerciseItem) => {
  sendToAi(question)
}, 3000) // 3秒节流，防止频繁发送给AI

const throttledDeleteQuestion = ThrottleUtils.slow((questionId: string) => {
  deleteQuestion(questionId)
})

const throttledMoveToTop = ThrottleUtils.standard((questionId: string) => {
  moveToTop(questionId)
})

// 选择题目
const selectQuestion = async (index: number) => {
  emit('questionSelected', props.questions[index], index)
}

// 发送给AI
const sendToAi = (question: ExerciseItem) => {
  emit('startAiGuidance', question)
}

// 删除题目
const deleteQuestion = async (questionId: string) => {
  try {
    deletingIds.value.add(questionId)

    try {
      // 使用API服务删除题目
      const success = await apiService.deleteExercise(questionId, 'math')

      if (success) {
        showMessage('题目删除成功', 'positive')
        // 这里可以触发父组件刷新题目列表
      } else {
        showMessage('题目删除失败', 'error')
      }
    } catch (error) {
      showMessage('删除题目时出错: ' + (error as Error).message, 'error')
    } finally {
      deletingIds.value.delete(questionId)
    }
  } catch (error) {
    showMessage('删除题目时出错: ' + (error as Error).message, 'error')
    deletingIds.value.delete(questionId)
  }
}

// 置顶题目
const moveToTop = (questionId: string) => {
  emit('moveToTop', questionId)
}

// 组件卸载时清理资源
onUnmounted(() => {
  // 清理所有 Intersection Observer
  intersectionObservers.forEach((observer) => {
    observer.disconnect()
  })
  intersectionObservers.clear()
  
  // 清理 MathJax
  MathJaxUtils.cleanup()
})
</script>

<style lang="scss" scoped>
// ===== 变量定义 - 与QuestionList.vue保持一致 =====
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
.virtual-question-list {
  height: 100%;
  width: 100%;
  overflow-x: hidden; // 隐藏横向滚动条
  overflow-y: auto; // 允许纵向滚动
}

// ===== 题目卡片容器样式 - 与QuestionList.vue保持一致 =====
.question-cards-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: $background-light;
}

.question-list-container {
  height: 100%;
  overflow-x: hidden; // 隐藏横向滚动条
  overflow-y: visible; // 允许内容自然流动
  width: 100%; // 确保容器宽度100%
}

.question-item-wrapper {
  padding: 0; // 移除内边距，因为外层容器已经处理了
  box-sizing: border-box;
  width: 100%;
  overflow: visible; // 确保内容不被截断
  margin-bottom: 8px; // 添加底部间距，与QuestionList.vue的gap一致
}

// ===== 题目卡片样式 =====
.question-card {
  cursor: pointer;
  overflow: visible;
  transform: translateZ(0);
  backface-visibility: hidden;
  border: none;
  border-radius: 16px;
  background-color: transparent;
  transition: $transition-smooth;
  box-shadow: none;
  padding: 4px;
  min-width: 0; // 允许卡片收缩以处理长内容
  width: 100%;
  height: auto; // 改为自动高度

    &.question-deleting {
      opacity: 0.6;
      pointer-events: none;
    }

    // 高亮当前题目效果
    &.highlight-current {
      animation: highlight-pulse 2s ease-in-out;
      
      .question-block {
        border-color: $primary-color;
        box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2), $shadow-hover;
        background-color: rgba(26, 115, 232, 0.02);
      }
    }

  // 题目组块
  .question-block {
    background-color: $background-white;
    border-radius: 12px;
    overflow: visible;
    border: 1px solid $border-color;
    @include card-shadow(subtle);
    transition: border-color 0.2s ease;
    min-width: 0;
    width: 100%;
    height: auto; // 改为自动高度
    display: flex;
    flex-direction: column;
  }

  // 悬停效果
  &:hover {
    .question-block {
      background-color: $background-white;
      border-radius: 12px;
      @include card-shadow(hover);
    }
  }

  // 选中状态
  &.question-selected {
    .question-block {
      border-color: $primary-color;
      border-radius: 12px;
      @include card-shadow(selected);
    }
  }
}

// ===== 题目头部样式 =====
.question-header {
  @include flex-center;
  justify-content: space-between;
  background-color: transparent;
  border-bottom: none;
  @include responsive-padding(12px 16px, 16px 20px);

  .question-number {
    @include flex-center;
    width: 28px;
    height: 28px;
    background-color: $primary-color;
    color: white;
    border-radius: 14px;
    font-weight: 500;
    font-size: 13px;
    flex-shrink: 0;
    @include card-shadow(subtle);
  }

  .question-actions {
    @include flex-center;
    gap: 6px;
    flex-shrink: 0;
    height: 32px; // 固定高度，无论是否显示按钮

    .action-btn {
      @include button-base;
      background-color: transparent;
      width: 24px; // 减小图标大小
      height: 24px; // 减小图标大小
      border-radius: 12px;
      transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
      
      &:hover:not(:disabled) {
        background-color: $background-hover;
        @include card-shadow(subtle);
        transform: scale(1.05);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      
      &.q-btn--loading {
        opacity: 0.7;
        cursor: not-allowed;
      }
      
      :deep(.q-btn__content) {
        font-size: 14px; // 减小图标字体大小
      }
      
      // 主要操作按钮特殊样式
      &.primary-action {
        &:hover:not(:disabled) {
          background-color: rgba(26, 115, 232, 0.1);
          color: $primary-color;
        }
      }
    }
  }
}

// ===== 题目内容区域样式 =====
.question-content-area {
  background-color: transparent;
  @include responsive-padding(12px 16px 16px 16px, 16px 20px 20px 20px);
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  width: 100%;
  flex: 1;
  
  // 内容区域滚动条样式
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
  
  // 确保内容区域可以处理长公式
  .question-content {
    min-width: 0;
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
}

// ===== Markdown 内容样式 =====
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

// ===== 响应式设计 =====
@media (max-width: 768px) {
  .question-card {
    .question-header {
      .question-number {
        width: 24px;
        height: 24px;
        font-size: 12px;
        border-radius: 12px;
      }

      .question-actions {
        height: 28px; // 移动端固定高度
        
        .action-btn {
          width: 20px; // 移动端更小的图标
          height: 20px; // 移动端更小的图标
          border-radius: 10px;
          
          :deep(.q-btn__content) {
            font-size: 12px; // 移动端更小的字体
          }
        }
      }
    }
  }

  .markdown-content {
    font-size: 13px !important;
    overflow: visible;
  }
}

@media (max-width: 480px) {
  .question-card {
    .question-header {
      .question-number {
        width: 22px;
        height: 22px;
        font-size: 11px;
        border-radius: 11px;
      }

      .question-actions {
        height: 24px; // 最小屏幕固定高度
        gap: 4px;

        .action-btn {
          width: 18px; // 最小屏幕更小的图标
          height: 18px; // 最小屏幕更小的图标
          border-radius: 9px;
          
          :deep(.q-btn__content) {
            font-size: 11px; // 最小屏幕更小的字体
          }
        }
      }
    }
  }
}

// ===== Gemini 风格对话框样式 =====
:deep(.gemini-delete-dialog) {
  .q-dialog__inner {
    padding: 24px;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
    background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
    border: 1px solid rgba(0, 0, 0, 0.06);
    max-width: 400px;
    width: 90vw;
    animation: gemini-dialog-enter 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  }

  .q-dialog__title {
    font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 20px;
    font-weight: 500;
    color: #202124;
    margin-bottom: 8px;
    line-height: 1.3;
  }

  .q-dialog__message {
    font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #5f6368;
    line-height: 1.5;
    margin-bottom: 24px;
  }

  .q-dialog__actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 0;
    padding-top: 0;
  }
}

// Gemini 风格按钮样式
:deep(.gemini-delete-btn) {
  font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  font-size: 14px;
  text-transform: none;
  letter-spacing: 0.25px;
  border-radius: 20px;
  padding: 10px 24px;
  min-width: 80px;
  height: 40px;
  background: linear-gradient(135deg, #ea4335 0%, #d33b2c 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(234, 67, 53, 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  
  &:hover {
    background: linear-gradient(135deg, #d33b2c 0%, #b52d20 100%);
    box-shadow: 0 4px 12px rgba(234, 67, 53, 0.4);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(234, 67, 53, 0.3);
  }
}

:deep(.gemini-cancel-btn) {
  font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  font-size: 14px;
  text-transform: none;
  letter-spacing: 0.25px;
  border-radius: 20px;
  padding: 10px 24px;
  min-width: 80px;
  height: 40px;
  color: #5f6368;
  background: transparent;
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  
  &:hover {
    background: rgba(95, 99, 104, 0.08);
    color: #202124;
  }
  
  &:active {
    background: rgba(95, 99, 104, 0.12);
  }
}

// 对话框进入动画
@keyframes gemini-dialog-enter {
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

// 高亮动画
@keyframes highlight-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
  }
}
</style>
