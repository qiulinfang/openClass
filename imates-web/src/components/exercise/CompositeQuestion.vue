<template>
  <BaseQuestion 
    class="composite-question"
    :question="question"
    :show-title="showTitle"
    :show-id="showId"
    :show-analysis="showAnalysis"
  >
    <!-- 材料区域放入 stem 插槽，保持与普通题干一致 -->
    <template #stem>
      <div class="material-section">
        <div class="q-mt-sm markdown-content" v-html="renderMessageContent(question.material || '')"></div>
      </div>
    </template>

    <!-- 子题列表作为 default 插槽内容 -->
    <div class="sub-questions-list q-mt-md">
      <div 
        v-for="(sub, sIdx) in question.subQuestions" 
        :key="sub.id || sIdx" 
        class="sub-question-item"
      >
        <div class="sub-question-header q-mb-md">
          <span class="sub-question-index">子题 {{ sIdx + 1 }}</span>
        </div>
        
        <!-- 如果子题还是 composite，递归渲染 -->
        <CompositeQuestion
          v-if="sub.type === 'composite'"
          :question="sub"
          :model-value="modelValue"
          @update:model-value="$emit('update:modelValue', $event)"
          :show-title="false"
          :show-id="false"
          :disabled="disabled"
          :show-analysis="showAnalysis"
        />

        <!-- 主观题渲染 -->
        <SubjectiveQuestion 
          v-else-if="sub.structuredContent?.type === 'subjective' || sub.type === 'subjective'"
          :question="sub"
          :model-value="modelValue[sub.id]"
          @update:model-value="handleUpdate(sub.id, $event)"
          :show-title="true"
          :show-id="showId"
          :disabled="disabled"
          :show-analysis="showAnalysis"
        />

        <!-- 普通子题渲染 -->
        <component 
          v-else
          :is="getComponent(sub.structuredContent?.type || sub.type)" 
          :question="sub" 
          :model-value="modelValue[sub.id]"
          @update:model-value="handleUpdate(sub.id, $event)"
          :show-title="true"
          :show-id="showId"
          :disabled="disabled"
          :show-analysis="showAnalysis"
        />
      </div>
    </div>
  </BaseQuestion>
</template>

<script lang="ts">
export default {
  name: 'CompositeQuestion'
}
</script>

<script setup lang="ts">
import type { ExerciseItem } from '../../types/exercise'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import ChoiceQuestion from './ChoiceQuestion.vue'
import FillBlankQuestion from './FillBlankQuestion.vue'
import JudgmentQuestion from './JudgmentQuestion.vue'
import SubjectiveQuestion from './SubjectiveQuestion.vue'
import BaseQuestion from './BaseQuestion.vue'

const props = withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: Record<string, unknown>
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  disabled?: boolean
}>(), {
  modelValue: () => ({}),
  showTitle: true,
  showId: true,
  showAnalysis: false,
  disabled: false
})

const emit = defineEmits(['update:modelValue', 'change'])

const { renderMessageContent } = useMessageRenderer()

const handleUpdate = (id: string, value: unknown) => {
  const newValue = { ...props.modelValue, [id]: value }
  emit('update:modelValue', newValue)
}

// 组件映射逻辑
const getComponent = (type: string | undefined) => {
  switch (type) {
    case 'single_choice':
    case 'multiple_choice':
      return ChoiceQuestion
    case 'fill_in_blank':
      return FillBlankQuestion
    case 'true_false':
      return JudgmentQuestion
    default:
      return BaseQuestion
  }
}

</script>

<style scoped lang="scss">
.material-section {
  .markdown-content {
    line-height: 1.6;
    font-size: 16px;
    color: #333;
  }
}

.sub-questions-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.sub-question-item {
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #edf2f7;
  transition: all 0.2s;

  &:hover {
    border-color: #615efe;
    box-shadow: 0 4px 12px rgba(97, 94, 254, 0.05);
  }

  .sub-question-header {
    display: flex;
    align-items: center;

    .sub-question-index {
      font-size: 14px;
      font-weight: 600;
      color: #615efe;
      background: rgba(97, 94, 254, 0.1);
      padding: 4px 12px;
      border-radius: 20px;
    }
  }

  /* 覆盖子题内部 BaseQuestion 的 padding，因为外部已经有 padding 了 */
  :deep(.base-question) {
    padding: 0;
    background: transparent;
  }
}
</style>
