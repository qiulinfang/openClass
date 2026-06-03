<template>
  <div class="composite-question">
    <!-- 主材料展示 -->
    <div class="material-section q-mb-md">
      <div class="text-subtitle1 text-weight-bold" v-if="showTitle">【主题干/材料】</div>
      <div class="q-mt-sm markdown-content" v-html="renderMessageContent(question.material || '')"></div>
    </div>

    <!-- 子题列表 -->
    <div class="sub-questions-list">
      <div 
        v-for="(sub, sIdx) in question.subQuestions" 
        :key="sub.id || sIdx" 
        class="sub-question-item q-ml-md q-mt-lg"
      >
        <div class="text-weight-bold text-primary q-mb-sm">子题 ({{ sIdx + 1 }}):</div>
        
        <!-- 如果子题还是 composite，递归渲染 -->
        <CompositeQuestion 
          v-if="sub.type === 'composite'" 
          :question="sub"
          :model-value="modelValue"
          @update:model-value="$emit('update:modelValue', $event)"
          show-title
          :disabled="disabled"
        />

        <!-- 材料题/主观题渲染手写区域 -->
        <div v-else-if="sub.type === 'essay'" class="essay-question-container">
          <BaseQuestion
            :question="wrapQuestion(sub)"
            show-title
          />
          <div class="drawing-board-wrapper q-mt-md">
            <DrawingBoardNew
              :ref="(el: any) => setDrawingBoardRef(el, sub.id)"
              :showGrid="false"
              :enableAskAi="false"
              :show-toolbar="!disabled"
              :disabled="disabled"
              :show-zoom-controls="false"
              background-position="topLeft"
              :initial-zoom="70"
              @save="(data: any) => handleBoardSave(sub.id, data)"
            />
          </div>
        </div>

        <!-- 普通子题渲染 -->
        <component 
          v-else
          :is="getComponent(sub.type)" 
          :question="wrapQuestion(sub)" 
          :model-value="modelValue[sub.id]"
          @update:model-value="handleUpdate(sub.id, $event)"
          show-title
          :disabled="disabled"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'CompositeQuestion'
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ExerciseItem } from '../../types/exercise'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import ChoiceQuestion from './ChoiceQuestion.vue'
import FillBlankQuestion from './FillBlankQuestion.vue'
import JudgmentQuestion from './JudgmentQuestion.vue'
import BaseQuestion from './BaseQuestion.vue'
import DrawingBoardNew from '../drawing/drawingBoardNew.vue'

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

// 手写板引用管理
const drawingBoardRefs = ref<Record<string, any>>({})
const setDrawingBoardRef = (el: any, id: string) => {
  if (el) {
    drawingBoardRefs.value[id] = el
    // 延迟加载初始数据，确保组件已就绪
    setTimeout(() => {
      const initialData = props.modelValue[id]?.boardData
      if (initialData) {
        el.loadData(initialData)
      }
    }, 100)
  }
}

// 处理手写板数据更新
const handleBoardSave = (id: string, boardData: any) => {
  const currentVal = props.modelValue[id] || {}
  handleUpdate(id, {
    ...currentVal,
    boardData: boardData,
    type: 'board'
  })
}

const handleUpdate = (id: string, value: any) => {
  const newValue = { ...props.modelValue, [id]: value }
  emit('update:modelValue', newValue)
}

// 组件映射逻辑
const getComponent = (type: string) => {
  switch (type) {
    case 'single_choice':
    case 'multiple_choice':
      return ChoiceQuestion
    case 'fill_in_blank':
      return FillBlankQuestion
    case 'true_false':
    case 'judgment':
      return JudgmentQuestion
    default:
      return BaseQuestion
  }
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
.drawing-board-wrapper {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  height: 400px;
}
</style>
