<template>
  <div class="subjective-question">
    <BaseQuestion 
      :question="question" 
      :show-title="showTitle" 
      :show-id="showId"
      :show-analysis="false"
      :score-point-list="scorePointList"
    >
      <template #extra>
        <slot name="extra"></slot>
      </template>
      
      <div class="answer-area q-mt-md">
        <!-- 如果开启 OCR 标注覆膜或存在得分点及手写图片，使用 StudentHandwritingOcrOverlay -->
        <template v-if="hasOcrOverlayData">
          <StudentHandwritingOcrOverlay
            :question-data="displayQuestionData"
            :score-point-list="displayScorePointList"
            :focused-point-index="focusedPointIndex"
            :active-point-id="activePointId"
            @select-point="(payload) => emit('select-score-point', payload)"
          />
        </template>

        <!-- 否则渲染常规交互区域 MixedInputArea -->
        <template v-else>
          <MixedInputArea
            ref="mixedInputAreaRef"
            :model-value="modelValue"
            question-type="subjective"
            :label="''"
            :disabled="disabled"
            :rows="12"
            placeholder="请输入您的作答内容..."
            @update:model-value="(val) => emit('update:modelValue', val as StructuredAnswerItem)"
          />
        </template>
      </div>

      <QuestionAnalysis :question="question" :show="showAnalysis" />
    </BaseQuestion>
  </div>
</template>

<script lang="ts">
export default {
  name: 'SubjectiveQuestion'
}
</script>

<script setup lang="ts">
import { ref, computed } from 'vue'
import BaseQuestion from './BaseQuestion.vue'
import MixedInputArea from './MixedInputArea.vue'
import QuestionAnalysis from './QuestionAnalysis.vue'
import StudentHandwritingOcrOverlay from '../display/StudentHandwritingOcrOverlay.vue'
import type { ExerciseItem, StructuredAnswerItem } from '../../types/exercise'

const props = withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: StructuredAnswerItem
  showTitle?: boolean
  showId?: boolean
  disabled?: boolean
  enableAskAi?: boolean
  showAnalysis?: boolean
  showOcrOverlay?: boolean
  questionData?: any[]
  scorePointList?: any[]
  focusedPointIndex?: number
  activePointId?: string
}>(), {
  showTitle: false,
  showId: true,
  disabled: false,
  enableAskAi: false,
  activePointId: '',
  showAnalysis: false,
  showOcrOverlay: false,
  focusedPointIndex: undefined
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: StructuredAnswerItem): void
  (e: 'change', value: StructuredAnswerItem): void
  (e: 'select-score-point', payload: any): void
}>()

const mixedInputAreaRef = ref<InstanceType<typeof MixedInputArea> | null>(null)

const displayScorePointList = computed(() => {
  if (!props.scorePointList) return []

  const targetQId = String(props.question.id || props.question.bmNo || '').trim()

  if (props.scorePointList instanceof Map) {
    if (props.scorePointList.has(targetQId)) {
      return props.scorePointList.get(targetQId) || []
    }
    for (const [key, points] of props.scorePointList.entries()) {
      if (key === targetQId || targetQId.endsWith(key) || key.endsWith(targetQId)) {
        return points || []
      }
    }
    return []
  }

  if (Array.isArray(props.scorePointList)) {
    return props.scorePointList
  }

  return []
})

import { useHomeworkStore } from '@/stores/homeworkStore'

const homeworkStore = useHomeworkStore()

const displayQuestionData = computed(() => {
  if (Array.isArray(props.questionData) && props.questionData.length > 0) {
    return props.questionData
  }

  const targetQId = String(props.question.id || props.question.bmNo || '').trim()

  if (homeworkStore.questionDataMap && homeworkStore.questionDataMap.has(targetQId)) {
    return homeworkStore.questionDataMap.get(targetQId) || []
  }
  for (const [key, val] of (homeworkStore.questionDataMap?.entries() || [])) {
    if (key === targetQId || targetQId.endsWith(key) || key.endsWith(targetQId)) {
      return val || []
    }
  }

  const imgs: string[] = []
  if (Array.isArray(displayScorePointList.value)) {
    displayScorePointList.value.forEach((sp: any) => {
      if (Array.isArray(sp.answerData)) imgs.push(...sp.answerData)
      if (sp.studentAnswerImage) imgs.push(sp.studentAnswerImage)
      if (sp.rearrange_students_answer) imgs.push(sp.rearrange_students_answer)
      if (sp.student_answer_image) imgs.push(sp.student_answer_image)
      if (sp.imageUrl) imgs.push(sp.imageUrl)
    })
  }

  if (props.modelValue?.type === 'img' && props.modelValue.content) {
    imgs.push(props.modelValue.content)
  }
  const qAny = props.question as any
  if (Array.isArray(qAny?.answerData)) {
    imgs.push(...qAny.answerData)
  } else if (typeof qAny?.answerData === 'string' && qAny.answerData) {
    imgs.push(qAny.answerData)
  }
  if (Array.isArray(qAny?.answerList)) {
    imgs.push(...qAny.answerList)
  }

  const uniqueImgs = Array.from(new Set(imgs.filter(Boolean)))
  if (uniqueImgs.length > 0) {
    return [{ questionId: targetQId, answerData: uniqueImgs }]
  }
  return []
})

const hasOcrOverlayData = computed(() => {
  return displayQuestionData.value.length > 0 && (props.showOcrOverlay === true || displayScorePointList.value.length > 0)
})

defineExpose({
  getMixedInputArea: () => mixedInputAreaRef.value
})
</script>

<style scoped lang="scss">
.subjective-question {
  .answer-area {
    width: 100%;
  }
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
