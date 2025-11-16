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
            <div class="answer-content" v-html="formattedAnswer"></div>
          </q-card-section>
        </q-card>

        <!-- 空状态：只根据答案是否存在判断 -->
        <div v-if="!answer" class="native-empty-state text-center q-pa-xl">
          <q-icon name="help_outline" size="80px" color="grey-5" />
          <div class="text-h6 q-mt-md text-grey-7 native-text-3xl">暂无答案内容</div>
          <div class="text-body2 text-grey-6 q-mt-sm native-text-md">请先选择一道题目</div>
        </div>
      </div>
    </q-scroll-area>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { useQuestionStore } from '../stores/questionStore'

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

// 使用公共的 markdown 渲染器
const { renderMessageContent } = useMessageRenderer()

// 格式化答案内容（使用统一的 markdown 渲染）
const formattedAnswer = computed(() => {
  if (!answer.value) return ''
  return renderMessageContent(answer.value)
})

</script>

<style scoped>
.answer-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}


.answer-card {
  border-left: 4px solid #4caf50;
  margin: var(--native-margin-md);
}

.answer-content {
  line-height: 1.6;
  font-size: var(--native-font-size-xl);
  padding: var(--native-padding-lg);
  color: #333;
  white-space: pre-wrap; /* 保持换行符和空格 */
  overflow-x: auto;
  overflow-y: hidden;
  min-width: 0;
  
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

/* Markdown 内容样式 - 与其他组件保持一致 */

/* MathJax 公式样式处理 */
.answer-content :deep(.mjx-chtml),
.answer-content :deep(.mjx-math) {
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  display: inline-block;
  vertical-align: middle;
}

.answer-content :deep(.mjx-chtml[display="inline"]) {
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
}

.answer-content :deep(.mjx-chtml[display="block"]) {
  max-width: 100%;
  overflow-x: auto;
  margin: 8px 0;
  text-align: center;
}

.answer-content :deep(.mjx-chtml)::-webkit-scrollbar {
  height: 3px;
}

.answer-content :deep(.mjx-chtml)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}

.answer-content :deep(.mjx-chtml)::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
}

.answer-content :deep(.mjx-chtml)::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

.answer-content :deep(h1),
.answer-content :deep(h2),
.answer-content :deep(h3),
.answer-content :deep(h4),
.answer-content :deep(h5),
.answer-content :deep(h6) {
  margin: 0 0 8px 0;
  font-weight: 600;
}

.answer-content :deep(p) {
  margin: 0 0 8px 0;
}

.answer-content :deep(ul),
.answer-content :deep(ol) {
  margin: 0 0 8px 0;
  padding-left: 20px;
}

.answer-content :deep(li) {
  margin-bottom: 4px;
}

.answer-content :deep(code) {
  background: #f5f5f5;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.answer-content :deep(pre) {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.answer-content :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 12px;
  margin: 8px 0;
  color: #666;
}

.answer-content :deep(strong) {
  color: #1976d2;
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