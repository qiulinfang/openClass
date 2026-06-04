<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-id="showId" :show-analysis="showAnalysis">
    <template #extra>
      <slot name="extra"></slot>
    </template>
    
    <div class="judgment-actions">
      <div 
        v-for="(opt, index) in displayOptions"
        :key="opt.id"
        class="judgment-item"
        :class="{ 
          'correct-type': index === 0,
          'wrong-type': index === 1,
          active: modelValue === opt.id, 
          'is-correct': modelValue === opt.id && disabled && isCorrect(opt.id),
          'is-wrong': modelValue === opt.id && disabled && !isCorrect(opt.id)
        }"
        @click="handleSelect(opt.id)"
      >
        <span class="label" v-html="renderMessageContent(opt.content)"></span>
        <div class="status-icon" v-if="disabled && modelValue === opt.id">
          <q-icon v-if="isCorrect(opt.id)" name="check_circle" color="green" size="20px" />
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
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import BaseQuestion from './BaseQuestion.vue'

const props = withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: string | boolean
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

// 标准化选项
const displayOptions = computed(() => {
  const options = props.question.structuredContent?.options || []
  if (options.length >= 2) {
    return options.map(opt => ({
      id: opt.id || '',
      content: opt.content || ''
    }))
  }
  // 兜底默认选项
  return [
    { id: 'true', content: '正确' },
    { id: 'false', content: '错误' }
  ]
})

/**
 * 判断是否正确
 * @param val 当前选中的 ID
 */
const isCorrect = (val: string | boolean) => {
  const answer = props.question.structuredContent?.answer
  return String(answer) === String(val)
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

  &:hover:not(.active):not(.disabled) {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  // 选中状态
  &.active {
    background: #f5f3ff;
    border-color: #6e55ff;
    .label { color: #6e55ff; }
  }

  // 结果反馈状态
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
