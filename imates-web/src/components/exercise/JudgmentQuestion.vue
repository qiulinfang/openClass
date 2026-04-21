<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-analysis="showAnalysis">
    <div class="judgment-actions">
      <div 
        class="judgment-item correct" 
        :class="{ active: modelValue === '对', result: showResult && isCorrect('对') }"
        @click="handleSelect('对')"
      >
        <span class="label">正确</span>
      </div>
      <div 
        class="judgment-item wrong" 
        :class="{ active: modelValue === '错', result: showResult && isCorrect('错') }"
        @click="handleSelect('错')"
      >
        <span class="label">错误</span>
      </div>
    </div>
  </BaseQuestion>
</template>

<script lang="ts">
export default {
  name: 'JudgmentQuestion'
}
</script>

<script setup lang="ts">
import type { ExerciseItem } from '../../types'
import BaseQuestion from './BaseQuestion.vue'

defineOptions({
  name: 'JudgmentQuestion'
})

const props = defineProps<{
  question: ExerciseItem
  modelValue?: string
  showTitle?: boolean
  showAnalysis?: boolean
  showResult?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const isCorrect = (val: string) => {
  const answer = props.question.answer?.trim()
  if (val === '对') return answer === '对' || answer === '√' || answer === '正确'
  if (val === '错') return answer === '错' || answer === '×' || answer === '错误'
  return false
}

const handleSelect = (val: string) => {
  if (props.showResult) return
  emit('update:modelValue', val)
  emit('change', val)
}
</script>

<style scoped lang="scss">
.judgment-actions {
  display: flex;
  gap: 16px;
  padding: 12px 0;
}

.judgment-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  cursor: pointer;
  transition: all 0.2s;

  .label {
    font-size: 15px;
    font-weight: 500;
    color: #64748b;
  }

  &:hover:not(.active) {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  &.correct.active {
    background: #f0fdf4;
    border-color: #22c55e;
    .label { color: #166534; }
  }

  &.wrong.active {
    background: #fef2f2;
    border-color: #ef4444;
    .label { color: #991b1b; }
  }

  &.result:not(.active) {
    border: 1px dashed currentColor;
  }
}
</style>
