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

watch([formattedStem], () => {
  if (stemElement) renderMath(stemElement)
})
</script>

<style scoped>
.base-question {
  position: relative;
  padding: 0;
  background: white;
  border-radius: 8px;
  color: #393548;
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



/* 强制所有富文本和题干中的图片不能超过容器宽度，并防变形 */
:deep(img) {
  max-width: 100% !important;
  height: auto !important;
  display: block;
  margin: 8px 0;
  border-radius: 6px;
}

:deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
:deep(th), :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
}
:deep(th) {
  background-color: #f8fafc;
  font-weight: 600;
  color: #475569;
}

:deep(ol),
:deep(ul) {
  padding-left: 0;
  margin-left: 0;
  list-style-position: inside;
}
</style>
