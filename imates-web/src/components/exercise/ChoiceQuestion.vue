<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-analysis="showAnalysis">
    <div class="choice-options">
      <div 
        v-for="opt in options" 
        :key="opt.label"
        class="option-item"
        :class="{ 
          selected: isSelected(opt.label),
          correct: isSelected(opt.label) && isCorrect(opt.label) && disabled,
          wrong: isSelected(opt.label) && !isCorrect(opt.label) && disabled
        }"
        @click="handleSelect(opt.label)"
      >
        <div class="option-label">{{ opt.label }}</div>
        <div class="option-text" v-html="renderMessageContent(opt.text)"></div>
        <div class="option-status-icon" v-if="disabled && isSelected(opt.label)">
          <q-icon v-if="isCorrect(opt.label)" name="check_circle" color="green" size="20px" />
          <q-icon v-else name="cancel" color="red" size="20px" />
        </div>
      </div>
    </div>
  </BaseQuestion>
</template>

<script lang="ts">
export default {
  name: 'ChoiceQuestion'
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExerciseItem } from '../../types'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import BaseQuestion from './BaseQuestion.vue'

const props = defineProps<{
  question: ExerciseItem
  modelValue?: string[]
  showTitle?: boolean
  showAnalysis?: boolean
  disabled?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const { renderMessageContent } = useMessageRenderer()

const options = computed(() => props.question.structuredContent?.options || [])

const isSelected = (label: string) => props.modelValue?.includes(label)
const isCorrect = (label: string) => props.question.answer === label

const handleSelect = (label: string) => {
  if (props.disabled) return // 禁用交互
  
  let newValue = [...(props.modelValue || [])]
  const index = newValue.indexOf(label)
  if (index > -1) {
    newValue.splice(index, 1)
  } else {
    // 假设目前只有单选
    newValue = [label]
  }
  emit('update:modelValue', newValue)
  emit('change', newValue)
}
</script>

<style scoped>
.choice-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid #eee;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  gap: 12px;
  position: relative;
}

.option-item:hover:not(.selected) {
  background: #f9f9ff;
  border-color: #615efe;
}

.option-item.selected {
  background: #f0f0ff;
  border-color: #615efe;
}

.option-label {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #666;
  flex-shrink: 0;
}

.option-item.selected .option-label {
  background: #615efe;
  color: white;
  border-color: #615efe;
}

.option-text {
  flex: 1;
  font-size: 15px;
}

.option-status-icon {
  width: 20px;
  height: 20px;
}

.option-item.correct {
  border-color: #22c55e;
  background: #f0fff4;
}

.option-item.correct .option-label {
  background: #22c55e;
  border-color: #22c55e;
  color: white;
}

.option-item.wrong {
  border-color: #ef4444;
  background: #fef2f2;
}

.option-item.wrong .option-label {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}
</style>
