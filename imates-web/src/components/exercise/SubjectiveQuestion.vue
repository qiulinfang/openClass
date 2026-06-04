<template>
  <div class="subjective-question">
    <BaseQuestion 
      :question="question" 
      :show-title="showTitle" 
      :show-id="showId"
      :show-analysis="showAnalysis"
    >
      <template #extra>
        <slot name="extra"></slot>
      </template>
      
      <div class="answer-area q-mt-md">
        <MixedInputArea
          :model-value="modelValue"
          question-type="subjective"
          :label="showTitle ? '作答区：' : ''"
          :disabled="disabled"
          :rows="12"
          placeholder="请输入您的作答内容..."
          @update:model-value="(val) => emit('update:modelValue', val as SubjectiveAnswer)"
        />
      </div>
    </BaseQuestion>
  </div>
</template>

<script lang="ts">
export default {
  name: 'SubjectiveQuestion'
}
</script>

<script setup lang="ts">
import BaseQuestion from './BaseQuestion.vue'
import MixedInputArea from './MixedInputArea.vue'
import type { ExerciseItem } from '../../types/exercise'

interface SubjectiveAnswer {
  type: 'text' | 'board'
  textContent?: string
  boardData?: unknown
  timestamp?: number
}

withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: SubjectiveAnswer
  showTitle?: boolean
  showId?: boolean
  disabled?: boolean
  enableAskAi?: boolean
  showAnalysis?: boolean
}>(), {
  showTitle: false,
  showId: true,
  disabled: false,
  enableAskAi: false,
  showAnalysis: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: SubjectiveAnswer): void
  (e: 'change', value: SubjectiveAnswer): void
}>()
</script>

<style scoped lang="scss">
.subjective-question {
  .answer-area {
    width: 100%;
  }
}
</style>
