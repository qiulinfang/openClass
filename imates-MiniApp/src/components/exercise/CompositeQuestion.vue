<template>
  <view class="composite-question">
    <!-- 主材料展示 -->
    <view class="material-section q-mb-md">
      <view class="text-subtitle1 text-weight-bold" v-if="showTitle">【主题干/材料】</view>
      <rich-text class="q-mt-sm markdown-content" :nodes="renderMessageContent(question.material || '')"></rich-text>
    </view>

    <!-- 子题列表 -->
    <view class="sub-questions-list">
      <view 
        v-for="(sub, sIdx) in question.subQuestions" 
        :key="sub.id || sIdx" 
        class="sub-question-item q-ml-md q-mt-lg"
      >
        <view class="text-weight-bold text-primary q-mb-sm">子题 ({{ Number(sIdx) + 1 }}):</view>
        
        <!-- 如果子题还是 composite，递归渲染 -->
        <CompositeQuestion 
          v-if="sub.type === 'composite'" 
          :question="sub"
          v-model="modelValue"
          show-title
        />

        <!-- 普通子题渲染 -->
        <ChoiceQuestion
          v-if="sub.type === 'single_choice' || sub.type === 'multiple_choice'"
          :question="wrapQuestion(sub)"
          v-model="modelValue[sub.id]"
          show-title
          :disabled="disabled"
        />
        <FillBlankQuestion
          v-else-if="sub.type === 'fill_in_blank'"
          :question="wrapQuestion(sub)"
          v-model="modelValue[sub.id]"
          show-title
          :disabled="disabled"
        />
        <JudgmentQuestion
          v-else-if="sub.type === 'true_false' || sub.type === 'judgment'"
          :question="wrapQuestion(sub)"
          v-model="modelValue[sub.id]"
          show-title
          :disabled="disabled"
        />
        <BaseQuestion
          v-else
          :question="wrapQuestion(sub)"
          show-title
        />
      </view>
    </view>
  </view>
</template>

<script lang="ts">
export default {
  name: 'CompositeQuestion'
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExerciseItem } from '../../types'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import ChoiceQuestion from './ChoiceQuestion.vue'
import FillBlankQuestion from './FillBlankQuestion.vue'
import JudgmentQuestion from './JudgmentQuestion.vue'
import BaseQuestion from './BaseQuestion.vue'

const props = withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: Record<string, any>
  showTitle?: boolean
  disabled?: boolean
}>(), {
  modelValue: () => ({}),
  showTitle: true,
  disabled: false
})

const emit = defineEmits(['update:modelValue', 'change'])

const { renderMessageContent } = useMessageRenderer()

const handleUpdate = (id: string, value: any) => {
  const newValue = { ...props.modelValue, [id]: value }
  emit('update:modelValue', newValue)
}

// 包装普通子题为组件需要的格式 (保持与 TestExerciseView 逻辑一致)
const wrapQuestion = (sub: any) => {
  if (!sub) return sub
  
  const rawOptions = sub.options || sub.structuredContent?.options || []
  const wrappedOptions = rawOptions.map((opt: any) => ({
    label: opt.id || opt.label, 
    text: opt.content || opt.text 
  }))
  
  return {
    ...sub,
    questionContent: sub.stem || sub.questionContent || sub.structuredContent?.stem || '',
    structuredContent: {
      stem: sub.stem || sub.questionContent || sub.structuredContent?.stem || '',
      options: wrappedOptions
    }
  }
}
</script>

<style scoped>
.composite-question {
  border-left: 4px solid #1976D2;
  padding-left: 16px;
}
.sub-question-item {
  border-top: 1px dashed #ddd;
  padding-top: 16px;
}
.markdown-content {
  line-height: 1.6;
  font-size: 1.1rem;
}
</style>
