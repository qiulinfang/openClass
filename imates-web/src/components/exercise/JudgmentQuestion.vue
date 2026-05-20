<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-analysis="showAnalysis">
    <div class="judgment-actions">
      <div 
        class="judgment-item correct" 
        :class="{ 
          active: modelValue === correctLabel, 
          'is-correct': modelValue === correctLabel && disabled && isCorrect(correctLabel),
          'is-wrong': modelValue === correctLabel && disabled && !isCorrect(correctLabel)
        }"
        @click="handleSelect(correctLabel)"
      >
        <span class="label">{{ correctDisplay }}</span>
        <div class="status-icon" v-if="disabled && modelValue === correctLabel">
          <q-icon v-if="isCorrect(correctLabel)" name="check_circle" color="green" size="20px" />
          <q-icon v-else name="cancel" color="red" size="20px" />
        </div>
      </div>
      <div 
        class="judgment-item wrong" 
        :class="{ 
          active: modelValue === wrongLabel, 
          'is-correct': modelValue === wrongLabel && disabled && isCorrect(wrongLabel),
          'is-wrong': modelValue === wrongLabel && disabled && !isCorrect(wrongLabel)
        }"
        @click="handleSelect(wrongLabel)"
      >
        <span class="label">{{ wrongDisplay }}</span>
        <div class="status-icon" v-if="disabled && modelValue === wrongLabel">
          <q-icon v-if="isCorrect(wrongLabel)" name="check_circle" color="green" size="20px" />
          <q-icon v-else name="cancel" color="red" size="20px" />
        </div>
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
import { computed } from 'vue'
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
  disabled?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'change'])

// 动态获取显示文本和内部标识
const correctDisplay = computed(() => {
  const options = props.question.structuredContent?.options
  return (options && options.length > 0) ? options[0].text : '正确'
})

const wrongDisplay = computed(() => {
  const options = props.question.structuredContent?.options
  return (options && options.length > 1) ? options[1].text : '错误'
})

// 内部标识值，用于 v-model
const correctLabel = computed(() => {
  const options = props.question.structuredContent?.options
  return (options && options.length > 0) ? options[0].text : '对'
})

const wrongLabel = computed(() => {
  const options = props.question.structuredContent?.options
  return (options && options.length > 1) ? options[1].text : '错'
})

const isCorrect = (val: string) => {
  const structured = props.question.structuredContent
  const rawAnswer = structured?.answer ?? props.question.answer
  
  // 转换答案为字符串进行比较
  let standardAnswer = ''
  if (typeof rawAnswer === 'boolean') {
    standardAnswer = rawAnswer ? correctLabel.value : wrongLabel.value
  } else if (rawAnswer) {
    standardAnswer = String(rawAnswer).trim()
  }

  // 兼容 ID 和 文本
  const options = structured?.options
  if (options && options.length > 0) {
    if (val === options[0].text) {
      return standardAnswer === options[0].text || standardAnswer === options[0].label || standardAnswer === 'true' || (rawAnswer as any) === true
    }
    if (options.length > 1 && val === options[1].text) {
      return standardAnswer === options[1].text || standardAnswer === options[1].label || standardAnswer === 'false' || (rawAnswer as any) === false
    }
  }

  // 默认逻辑
  if (val === '对') return ['对', '√', '正确', 'true', 'T'].includes(standardAnswer) || (rawAnswer as any) === true
  if (val === '错') return ['错', '×', '错误', 'false', 'F'].includes(standardAnswer) || (rawAnswer as any) === false
  
  return val === standardAnswer
}

const handleSelect = (val: string) => {
  if (props.disabled) return
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

  &.correct.active, &.wrong.active {
    background: #f5f3ff;
    border-color: #6e55ff;
    .label { color: #6e55ff; }
  }

  &.is-correct.active {
    background: #f0fdf4;
    border-color: #22c55e;
    .label { color: #166534; }
  }

  &.is-wrong.active {
    background: #fef2f2;
    border-color: #ef4444;
    .label { color: #991b1b; }
  }

  .status-icon {
    margin-left: 8px;
    display: flex;
    align-items: center;
  }
}
</style>
