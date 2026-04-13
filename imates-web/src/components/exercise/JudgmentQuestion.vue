<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-analysis="showAnalysis">
    <div class="judgment-actions">
      <button 
        class="judgment-btn correct" 
        :class="{ active: modelValue === '对', result: showResult && isCorrect('对') }"
        @click="handleSelect('对')"
      >
        <span class="icon">√</span>
        <span class="label">正确</span>
      </button>
      <button 
        class="judgment-btn wrong" 
        :class="{ active: modelValue === '错', result: showResult && isCorrect('错') }"
        @click="handleSelect('错')"
      >
        <span class="icon">×</span>
        <span class="label">错误</span>
      </button>
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

<style scoped>
.judgment-actions {
  display: flex;
  gap: 20px;
  justify-content: center;
  padding: 10px 0;
}

.judgment-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 32px;
  border: 1px solid #eee;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.judgment-btn .icon {
  font-size: 24px;
  font-weight: bold;
}

.judgment-btn .label {
  font-size: 14px;
  font-weight: 500;
}

.judgment-btn.correct { color: #22c55e; }
.judgment-btn.wrong { color: #ef4444; }

.judgment-btn.correct.active {
  background: #f0fff4;
  border-color: #22c55e;
}

.judgment-btn.wrong.active {
  background: #fef2f2;
  border-color: #ef4444;
}

.judgment-btn.result {
  box-shadow: 0 0 0 2px currentColor;
}
</style>
