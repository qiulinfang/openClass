<template>
  <div class="base-question">
    <div class="question-header" v-if="showTitle">
      <span class="question-type-tag" v-if="typeLabel">{{ typeLabel }}</span>
      <span class="question-bm-no" v-if="question.bmNo && showId">{{ question.bmNo }}</span>
      <slot name="extra"></slot>
    </div>
    
    <div class="question-stem" :ref="(el) => setStemRef(el)">
      <slot name="stem">
        <div v-html="formattedStem"></div>
      </slot>
    </div>

    <div class="question-content">
      <slot></slot>
    </div>

    <div class="question-footer" v-if="showAnalysis && (question.answer || question.explanation)">
      <div class="analysis-section" v-if="question.answer">
        <div class="section-title">参考答案</div>
        <div class="section-content answer" v-html="formattedAnswer"></div>
      </div>
      <div class="analysis-section" v-if="question.explanation">
        <div class="section-title">题目解析</div>
        <div class="section-content" v-html="formattedExplanation"></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'BaseQuestion'
}
</script>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import type { ExerciseItem } from '../../types'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import { MathJaxUtils } from '../../utils/math/mathjax'

defineOptions({
  name: 'BaseQuestion'
})

const props = withDefaults(defineProps<{
  question: ExerciseItem
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
}>(), {
  showTitle: false,
  showId: true,
  showAnalysis: false
})

const { renderMessageContent } = useMessageRenderer()

const typeLabel = computed(() => {
  const map: Record<string, string> = {
    single_choice: '单选题',
    multiple_choice: '多选题',
    fill_in_blank: '填空题',
    true_false: '判断题',
    subjective: '解答题',
    composite: '复合题'
  }
  const type = props.question.structuredContent?.type
  return type ? map[type] : ''
})

const stemRaw = computed(() => {
  return props.question.structuredContent?.stem || ''
})

const formattedStem = computed(() => renderMessageContent(stemRaw.value))
const formattedAnswer = computed(() => {
  const answer = props.question.structuredContent?.answer
  if (Array.isArray(answer)) return renderMessageContent(answer.join(', '))
  if (answer === undefined || answer === null) return ''
  return renderMessageContent(String(answer))
})
const formattedExplanation = computed(() => renderMessageContent(props.question.structuredContent?.analysis || ''))

let stemElement: HTMLElement | null = null

const setStemRef = (el: unknown) => {
  if (el && typeof el === 'object' && 'nodeType' in (el as any)) {
    stemElement = el as HTMLElement
    renderMath(el as HTMLElement)
  }
}

const renderMath = (el: HTMLElement) => {
  nextTick(() => {
    MathJaxUtils.renderMath(el, true).catch(err => {
      console.warn('[BaseQuestion] MathJax 渲染失败:', err)
    })
  })
}

watch([formattedStem, formattedAnswer, formattedExplanation], () => {
  if (stemElement) renderMath(stemElement)
})
</script>

<style scoped>
.base-question {
  padding: 16px;
  background: white;
  border-radius: 8px;
  color: #333;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.question-type-tag {
  background: #f0f0ff;
  color: #615efe;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.question-bm-no {
  color: #999;
  font-size: 12px;
}

.question-stem {
  font-size: 16px;
  line-height: 1.6;
  font-weight: 500;
  margin-bottom: 16px;
}

.question-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px dashed #eee;
}

.analysis-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #615efe;
  margin-bottom: 8px;
}

.section-content {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.section-content.answer {
  color: #22c55e;
  font-weight: 600;
}
</style>
