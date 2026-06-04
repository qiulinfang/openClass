<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-id="showId" :show-analysis="showAnalysis">
    <template #extra>
      <slot name="extra"></slot>
    </template>
    <div class="choice-options">
      <div 
        v-for="opt in processedOptions" 
        :key="opt.value"
        class="option-item"
        :class="{ 
          selected: isSelected(opt.value),
          correct: isSelected(opt.value) && isCorrect(opt.value) && disabled,
          wrong: isSelected(opt.value) && !isCorrect(opt.value) && disabled
        }"
        @click="handleSelect(opt.value)"
      >
        <div class="option-label">{{ opt.label }}</div>
        <div class="option-text" v-html="renderMessageContent(opt.text)"></div>
        <div class="option-status-icon" v-if="disabled && isSelected(opt.value)">
          <q-icon v-if="isCorrect(opt.value)" name="check_circle" color="green" size="20px" />
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

const props = withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: string[]
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  disabled?: boolean
}>(), {
  showTitle: false,
  showId: true,
  showAnalysis: false,
  disabled: false
})

const emit = defineEmits(['update:modelValue', 'change'])

const { renderMessageContent } = useMessageRenderer()

const processedOptions = computed(() => {
  const rawOptions = props.question.structuredContent?.options || []
  return rawOptions.map((opt) => ({
    // 新结构：使用 id 作为标识和显示卷标，content 作为内容
    value: opt.id || '',
    label: opt.id || '',
    text: opt.content || ''
  }))
})

const isSelected = (value: string) => props.modelValue?.includes(value)
const isCorrect = (value: string) => {
  const answer = props.question.structuredContent?.answer
  if (Array.isArray(answer)) {
    return answer.includes(value)
  }
  // 仅保留对字符串化的支持，不再处理旧版的布尔值回退（已在数据层统一）
  return String(answer) === value
}

const handleSelect = (value: string) => {
  if (props.disabled) return 

  let newValue = [...(props.modelValue || [])]
  const index = newValue.indexOf(value)
  if (index > -1) {
    newValue.splice(index, 1)
  } else {
    const isMultiple = props.question.structuredContent?.type === 'multiple_choice'

    if (isMultiple) {
      newValue.push(value)
      newValue.sort()
    } else {
      newValue = [value]
    }
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
