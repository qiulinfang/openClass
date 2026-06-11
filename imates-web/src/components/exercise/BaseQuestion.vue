<template>
  <div class="base-question">
    <!-- 开发环境调试按钮 -->
    <button 
      v-if="isDev"
      class="dev-debug-btn"
      title="打印题目调试信息"
      type="button"
      @click="logQuestionInfo"
    >
      Debug
    </button>

    <div class="question-header" v-if="showTitle">
      <span class="question-type-tag" v-if="showTypeTag && typeLabel">{{ typeLabel }}</span>
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

const isDev = import.meta.env.DEV

const logQuestionInfo = () => {
  console.log('=== [DEBUG] Question Info ===')
  console.log('ID:', props.question.id)
  console.log('bmNo:', props.question.bmNo)
  console.log('Type:', props.question.type)
  console.log('Raw Question Object:', props.question)
  console.log('=============================')
}

const props = withDefaults(defineProps<{
  question: ExerciseItem
  showTitle?: boolean
  showId?: boolean
  showTypeTag?: boolean
  showAnalysis?: boolean
}>(), {
  showTitle: false,
  showId: false,
  showTypeTag: false,
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
  return props.question.structuredContent?.stem || props.question.question || props.question.title || ''
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
  position: relative;
  padding: 16px;
  background: white;
  border-radius: 8px;
  color: #333;
}

.dev-debug-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #ef4444;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  cursor: pointer;
  z-index: 100;
  transition: all 0.2s ease;
}

.dev-debug-btn:hover {
  background: #fee2e2;
  border-color: #f87171;
  color: #dc2626;
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

/* 强制所有富文本和题干中的图片不能超过容器宽度，并防变形 */
:deep(img) {
  max-width: 100% !important;
  height: auto !important;
  display: block;
  margin: 8px 0;
  border-radius: 6px;
}
</style>
