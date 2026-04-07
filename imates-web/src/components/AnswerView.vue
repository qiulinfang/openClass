
<template>
  <div class="answer-view">
    <q-scroll-area class="full-height" :thumb-style="thumbStyle">
      <div class="q-pa-md">
        <!-- 答案内容 -->
        <q-card flat bordered class="answer-card q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 text-primary q-mb-sm">
              <q-icon name="check_circle" class="q-mr-xs" />
              标准答案
            </div>
            <div
              class="answer-content"
              v-html="formattedAnswer"
              :ref="(el) => setContentRef(el)"
            ></div>
          </q-card-section>
        </q-card>

        <!-- 解析内容 -->
        <!-- <q-card flat bordered class="explanation-card q-mb-md" v-if="explanation">
          <q-card-section>
            <div class="text-subtitle2 text-info q-mb-sm">
              <q-icon name="lightbulb" class="q-mr-xs" />
              题目解析
            </div>
            <div
              class="explanation-content"
              v-html="formattedExplanation"
              :ref="(el) => setExplanationContentRef(el)"
            ></div>
          </q-card-section>
        </q-card> -->

        <!-- 空状态：只根据答案是否存在判断 -->
        <div v-if="!answer" class="native-empty-state text-center q-pa-xl">
          <q-icon name="help_outline" size="80px" color="grey-5" />
          <div class="text-h6 q-mt-md text-grey-7 native-text-3xl">暂无答案内容</div>
          <div class="text-body2 text-grey-6 q-mt-sm native-text-md">请先选择一道题目</div>
        </div>
      </div>
    </q-scroll-area>
    <!-- no image preview needed for text-only AnswerView -->
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { useQuestionStore } from '../stores/questionStore'
import { MathJaxUtils } from '../utils/math/mathjax'

const thumbStyle = {
  right: '4px',
  borderRadius: '5px',
  backgroundColor: '#027be3',
  width: '5px',
  opacity: '0.75'
}

// 从题目 store 中读取当前题目
const questionStore = useQuestionStore()
const { currentQuestion } = storeToRefs(questionStore)

const answer = computed(() => currentQuestion.value?.answer || '')
const explanation = computed(() => currentQuestion.value?.explanation || '')

// 使用公共的 markdown 渲染器
const { renderMessageContent } = useMessageRenderer()

// 格式化答案内容（使用统一的 markdown 渲染）
const formattedAnswer = computed(() => {
  if (!answer.value) return ''
  return renderMessageContent(answer.value)
})

// 格式化解析内容（使用统一的 markdown 渲染）
const formattedExplanation = computed(() => {
  console.log('[AnswerView] explanation:', explanation.value)
  if (!explanation.value) return ''
  return renderMessageContent(explanation.value)
})

// 内容元素引用（用于 MathJax 渲染）
let contentElement: HTMLElement | null = null
let explanationContentElement: HTMLElement | null = null

const setContentRef = (el: Element | null | { $el?: HTMLElement } ) => {
  const element = (el as { $el?: HTMLElement })?.$el || (el as HTMLElement | null)
  if (element instanceof HTMLElement) {
    contentElement = element
    nextTick(() => {
      // 使用懒加载模式（true）与 ChatMessage 保持一致
      MathJaxUtils.renderMath(element, true).catch((err) => {
        console.warn('[AnswerView] MathJax 渲染失败:', err)
      })
    })
  }
}

const setExplanationContentRef = (el: Element | null | { $el?: HTMLElement } ) => {
  const element = (el as { $el?: HTMLElement })?.$el || (el as HTMLElement | null)
  if (element instanceof HTMLElement) {
    explanationContentElement = element
    nextTick(() => {
      // 使用懒加载模式（true）与 ChatMessage 保持一致
      MathJaxUtils.renderMath(element, true).catch((err) => {
        console.warn('[AnswerView] MathJax 渲染失败:', err)
      })
    })
  }
}

// 当 formattedAnswer 变化时，重新渲染 MathJax
watch(formattedAnswer, () => {
  if (contentElement) {
    nextTick(() => {
      MathJaxUtils.renderMath(contentElement as HTMLElement, true).catch((err) => {
        console.warn('[AnswerView] MathJax 渲染失败:', err)
      })
    })
  }
})

// 当 formattedExplanation 变化时，重新渲染 MathJax
watch(formattedExplanation, () => {
  if (explanationContentElement) {
    nextTick(() => {
      MathJaxUtils.renderMath(explanationContentElement as HTMLElement, true).catch((err) => {
        console.warn('[AnswerView] MathJax 渲染失败:', err)
      })
    })
  }
})

onBeforeUnmount(() => {
  MathJaxUtils.cleanup()
})

</script>

<style scoped lang="scss">
.answer-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}


.answer-card {
  border-left: 4px solid #4caf50;
  margin: var(--native-margin-md);
}

.explanation-card {
  border-left: 4px solid #2196f3;
  margin: var(--native-margin-md);
}

.answer-content {
  line-height: 1.6;
  font-size: var(--native-font-size-xl);
  padding: var(--native-padding-lg);
  color: #333;
  white-space: normal; /* 不保留原始换行，遵循 Markdown 行处理 */
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;

  /* 内容滚动条样式 */
}

.explanation-content {
  line-height: 1.6;
  font-size: var(--native-font-size-xl);
  padding: var(--native-padding-lg);
  color: #333;
  white-space: normal; /* 不保留原始换行，遵循 Markdown 行处理 */
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;

  &:deep(h1),
  &:deep(h2),
  &:deep(h3),
  &:deep(h4),
  &:deep(h5),
  &:deep(h6) {
    font-size: 16px;
  }
  /* 内容滚动条样式 */
}

.answer-content::-webkit-scrollbar {
  height: 4px;
}

.answer-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.answer-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.answer-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.4);
}

.explanation-content::-webkit-scrollbar {
  height: 4px;
}

.explanation-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.explanation-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  transition: background 0.2s ease;
}

.explanation-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.4);
}

/* Markdown 内容样式 - 与其他组件保持一致 */

/* MathJax 公式样式处理 */
.answer-content :deep(.mjx-chtml),
.answer-content :deep(.mjx-math),
.explanation-content :deep(.mjx-chtml),
.explanation-content :deep(.mjx-math) {
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  display: inline-block;
  vertical-align: middle;
}

.answer-content :deep(.mjx-chtml[display="inline"]),
.explanation-content :deep(.mjx-chtml[display="inline"]) {
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

.answer-content :deep(.mjx-chtml[display="block"]),
.explanation-content :deep(.mjx-chtml[display="block"]) {
  max-width: 100%;
  overflow-x: auto;
  margin: 8px 0;
  text-align: center;
}

.answer-content :deep(.mjx-chtml)::-webkit-scrollbar,
.explanation-content :deep(.mjx-chtml)::-webkit-scrollbar {
  height: 3px;
}

.answer-content :deep(.mjx-chtml)::-webkit-scrollbar-track,
.explanation-content :deep(.mjx-chtml)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.answer-content :deep(.mjx-chtml)::-webkit-scrollbar-thumb,
.explanation-content :deep(.mjx-chtml)::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
}

.answer-content :deep(.mjx-chtml)::-webkit-scrollbar-thumb:hover,
.explanation-content :deep(.mjx-chtml)::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.answer-content :deep(h1),
.answer-content :deep(h2),
.answer-content :deep(h3),
.answer-content :deep(h4),
.answer-content :deep(h5),
.answer-content :deep(h6),
.explanation-content :deep(h1),
.explanation-content :deep(h2),
.explanation-content :deep(h3),
.explanation-content :deep(h4),
.explanation-content :deep(h5),
.explanation-content :deep(h6) {
  margin: 0 0 8px 0;
  font-weight: 600;
}

.answer-content :deep(p),
.explanation-content :deep(p) {
  margin: 0 0 8px 0;
}

.answer-content :deep(ul),
.answer-content :deep(ol),
.explanation-content :deep(ul),
.explanation-content :deep(ol) {
  margin: 0 0 8px 0;
  padding-left: 20px;
}

.answer-content :deep(li),
.explanation-content :deep(li) {
  margin-bottom: 4px;
}

.answer-content :deep(code),
.explanation-content :deep(code) {
  background: #f5f5f5;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.answer-content :deep(pre),
.explanation-content :deep(pre) {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.answer-content :deep(blockquote),
.explanation-content :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 12px;
  margin: 8px 0;
  color: #666;
}

.answer-content :deep(strong) {
  color: #1976d2;
  font-weight: 600;
}

.explanation-content :deep(strong) {
  color: #2196f3;
  font-weight: 600;
}

.analysis-content :deep(strong) {
  color: #388e3c;
  font-weight: 600;
}

.q-card-section {
  padding: var(--native-padding-lg) var(--native-padding-xl);
}

.text-subtitle2 {
  font-size: var(--native-font-size-md);
  font-weight: 500;
  margin-bottom: var(--native-margin-md);
}

.text-subtitle2 .q-icon {
  font-size: var(--native-icon-size-md);
}

</style>