<template>
  <div class="question-footer" v-if="show">
    <div class="analysis-section">
      <div class="analysis-block">
        <div class="section-title">参考答案：</div>
        <div
          class="section-content answer-val"
          v-if="formattedAnswer"
          v-html="formattedAnswer"
        ></div>
        <div class="field-missing-warning" v-else>【警告：未配置参考答案】</div>
      </div>
      <div class="analysis-block" style="margin-top: 16px">
        <div class="section-title">题目解析：</div>
        <div
          class="section-content explanation-val"
          v-if="formattedAnalysis"
          v-html="formattedAnalysis"
        ></div>
        <div class="empty-analysis-tip" v-else>暂无解析</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExerciseItem } from '../../types'
import { useMessageRenderer } from '../../composables/useMessageRenderer'

const props = withDefaults(
  defineProps<{
    question: ExerciseItem
    show?: boolean
  }>(),
  {
    show: false,
  },
)

const { renderMessageContent } = useMessageRenderer()

const formattedAnswer = computed(() => {
  const structured = props.question.structuredContent || props.question
  if (structured?.type === 'fill_in_blank' && Array.isArray(structured.blanks)) {
    const blankAnswers = structured.blanks.map((blank, index) => {
      const ans = Array.isArray(blank.answers) ? blank.answers.join(' 或 ') : blank.answer || ''
      return `(${index + 1}): ${ans}`
    })
    return renderMessageContent(blankAnswers.join('; '))
  }
  const answer = structured?.answer
  if (Array.isArray(answer)) return renderMessageContent(answer.join(', '))
  if (answer === undefined || answer === null) return ''
  return renderMessageContent(String(answer))
})

const formattedAnalysis = computed(() => {
  const q = props.question
  const structured = q.structuredContent
  const rawAnalysis =
    q.explanation || q.questionReason || q.analysisData || structured?.analysis || ''

  if (!rawAnalysis || !rawAnalysis.trim()) return ''
  return renderMessageContent(rawAnalysis)
})
</script>

<style scoped>
.question-footer {
  margin-top: 24px;
  padding-top: 16px;
}

.analysis-section {
  background-color: #f6f6f6;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}

.section-content {
  font-size: 15px;
  line-height: 1.6;
}

.section-content.answer-val {
  color: #334155;
}

.field-missing-warning {
  color: #ef4444;
  background-color: #fef2f2;
  border: 1px dashed #fca5a5;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-top: 4px;
  display: block;
  width: fit-content;
}

.empty-analysis-tip {
  color: #94a3b8;
  font-size: 14px;
}

:deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
:deep(th),
:deep(td) {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
}
:deep(th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #475569;
}
</style>
