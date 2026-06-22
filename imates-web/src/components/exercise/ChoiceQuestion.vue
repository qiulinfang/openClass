<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-id="showId" :show-analysis="false">
    <template #extra>
      <slot name="extra"></slot>
    </template>
    <div class="choice-options" v-if="processedOptions && processedOptions.length > 0">
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
    <div v-else class="field-missing-warning" style="margin-bottom: 12px;">【警告：选择题未配置选项内容 (options)】</div>
    
    <QuestionAnalysis :question="question" :show="showAnalysis" />
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
import QuestionAnalysis from './QuestionAnalysis.vue'

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
    // 兼容新旧结构：优先使用 id 和 content，若不存在则退回使用 label 和 text
    value: opt.id || opt.label || '',
    label: opt.id || opt.label || '',
    text: opt.content || opt.text || ''
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
</style>
