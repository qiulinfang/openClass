<template>
  <BaseQuestion 
    class="composite-question"
    :question="question"
    :show-title="showTitle"
    :show-id="showId"
    :show-analysis="showAnalysis"
    :score-point-list="scorePointList"
  >
    <!-- 材料区域放入 stem 插槽，保持与普通题干一致 -->
    <template #stem>
      <div class="material-section">
        <div class="q-mt-sm markdown-content" v-html="renderMessageContent(question.material || '')"></div>
      </div>
    </template>

    <!-- 子题列表作为 default 插槽内容 -->

    <!-- 子题 Tab 切换栏 (仅在 tab 模式显示) -->
    <div class="sub-question-tabs-container q-mt-md" v-if="localLayoutMode === 'tab' && question.subQuestions && question.subQuestions.length > 1">
      <div class="tabs-label">子题：</div>
      <div class="tabs-wrapper">
        <button
          v-for="(sub, sIdx) in question.subQuestions"
          :key="'tab-' + (sub.id || sIdx)"
          class="sub-tab-btn"
          :class="{ 
            active: activeSubIdx === sIdx,
            answered: isSubAnswered(sub)
          }"
          type="button"
          @click="handleTabClick(sIdx)"
        >
          <span>{{ sIdx + 1 }}</span>
          <span class="status-dot" v-if="isSubAnswered(sub)"></span>
        </button>
      </div>
    </div>

    <!-- 子题内容区域 (Tab 模式) -->
    <div class="sub-questions-list q-mt-md" v-if="localLayoutMode === 'tab' && question.subQuestions && question.subQuestions.length > 0">
      <Transition name="fade-slide" mode="out-in">
        <div 
          :key="activeSubIdx" 
          class="sub-question-item"
        >
          <template v-if="question.subQuestions[activeSubIdx]">
            <!-- 如果子题还是 composite，递归渲染 -->
            <CompositeQuestion
              v-if="question.subQuestions[activeSubIdx].type === 'composite'"
              ref="subjectiveQuestionRefsTab"
              :question="question.subQuestions[activeSubIdx]"
              :model-value="(modelValue[question.subQuestions[activeSubIdx].id] as any) || {}"
              @update:model-value="handleUpdate(question.subQuestions[activeSubIdx].id, $event)"
              :show-title="false"
              :show-id="false"
              :disabled="disabled"
              :show-analysis="showAnalysis"
              :layout-mode="localLayoutMode"
            />

            <!-- 主观题渲染 -->
            <SubjectiveQuestion 
              v-else-if="question.subQuestions[activeSubIdx].structuredContent?.type === 'subjective' || question.subQuestions[activeSubIdx].type === 'subjective'"
              ref="subjectiveQuestionRefsTab"
              :question="question.subQuestions[activeSubIdx]"
              :model-value="modelValue[question.subQuestions[activeSubIdx].id]"
              @update:model-value="handleUpdate(question.subQuestions[activeSubIdx].id, $event)"
              :show-title="true"
              :show-id="showId"
              :disabled="disabled"
              :show-analysis="showAnalysis"
              :show-ocr-overlay="showOcrOverlay"
              :question-data="questionData"
              :score-point-list="scorePointList"
              :focused-point-index="focusedPointIndex"
            />

            <!-- 普通子题渲染 -->
            <component 
              v-else
              ref="subjectiveQuestionRefsTab"
              :is="getComponent(question.subQuestions[activeSubIdx].structuredContent?.type || question.subQuestions[activeSubIdx].type)" 
              :question="question.subQuestions[activeSubIdx]" 
              :model-value="modelValue[question.subQuestions[activeSubIdx].id]"
              @update:model-value="handleUpdate(question.subQuestions[activeSubIdx].id, $event)"
              :show-title="true"
              :show-id="showId"
              :disabled="disabled"
              :show-analysis="showAnalysis"
              :show-ocr-overlay="showOcrOverlay"
              :question-data="questionData"
              :score-point-list="scorePointList"
              :focused-point-index="focusedPointIndex"
            />
          </template>
        </div>
      </Transition>
    </div>

    <!-- 子题内容区域 (List 模式 - 从头到尾完整渲染) -->
    <div class="sub-questions-list list-layout q-mt-md" v-if="localLayoutMode === 'list' && question.subQuestions && question.subQuestions.length > 0">
      <div 
        v-for="(sub, sIdx) in question.subQuestions"
        :key="sub.id || sIdx" 
        class="sub-question-item q-mb-sm"
      >
        <!-- 如果子题还是 composite，递归渲染 -->
        <CompositeQuestion
          v-if="sub.type === 'composite'"
          :ref="(el) => setNestedCompositeRef(sub.id, el)"
          :question="sub"
          :model-value="(modelValue[sub.id] as any) || {}"
          @update:model-value="handleUpdate(sub.id, $event)"
          :show-title="false"
          :show-id="false"
          :disabled="disabled"
          :show-analysis="showAnalysis"
          :layout-mode="localLayoutMode"
          :show-ocr-overlay="showOcrOverlay"
          :question-data="questionData"
          :score-point-list="scorePointList"
          :focused-point-index="focusedPointIndex"
          :active-point-id="activePointId"
          @select-score-point="emit('select-score-point', $event)"
        />

        <!-- 主观题渲染 -->
        <SubjectiveQuestion 
          v-else-if="sub.structuredContent?.type === 'subjective' || sub.type === 'subjective'"
          :ref="(el) => setSubjectiveRef(sub.id, el)"
          :question="sub"
          :model-value="modelValue[sub.id]"
          @update:model-value="handleUpdate(sub.id, $event)"
          :show-title="true"
          :show-id="showId"
          :disabled="disabled"
          :show-analysis="showAnalysis"
          :show-ocr-overlay="showOcrOverlay"
          :question-data="questionData"
          :score-point-list="scorePointList"
          :focused-point-index="focusedPointIndex"
          :active-point-id="activePointId"
          @select-score-point="emit('select-score-point', $event)"
        />

        <!-- 普通子题渲染 -->
        <component 
          v-else
          :ref="(el) => {
            if (sub.type === 'fill_in_blank' || sub.structuredContent?.type === 'fill_in_blank') {
              setSubjectiveRef(sub.id, el)
            }
          }"
          :is="getComponent(sub.structuredContent?.type || sub.type)" 
          :question="sub" 
          :model-value="modelValue[sub.id]"
          @update:model-value="handleUpdate(sub.id, $event)"
          :show-title="true"
          :show-id="showId"
          :disabled="disabled"
          :show-analysis="showAnalysis"
          :show-ocr-overlay="showOcrOverlay"
          :question-data="questionData"
          :score-point-list="scorePointList"
          :focused-point-index="focusedPointIndex"
          :active-point-id="activePointId"
          @select-score-point="emit('select-score-point', $event)"
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
import { ref, watch, reactive, computed } from 'vue'
import type { ExerciseItem } from '../../types/exercise'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import ChoiceQuestion from './ChoiceQuestion.vue'
import FillBlankQuestion from './FillBlankQuestion.vue'
import JudgmentQuestion from './JudgmentQuestion.vue'
import SubjectiveQuestion from './SubjectiveQuestion.vue'
import BaseQuestion from './BaseQuestion.vue'

const props = withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: Record<string, any>
  showTitle?: boolean
  showId?: boolean
  showAnalysis?: boolean
  disabled?: boolean
  layoutMode?: 'tab' | 'list'
  showOcrOverlay?: boolean
  questionData?: any[]
  scorePointList?: any[]
  focusedPointIndex?: number
  activePointId?: string
}>(), {
  modelValue: () => ({}),
  showTitle: true,
  showId: true,
  showAnalysis: false,
  disabled: false,
  layoutMode: 'list',
  showOcrOverlay: false,
  focusedPointIndex: undefined,
  activePointId: ''
})

const emit = defineEmits(['update:modelValue', 'change', 'select-score-point'])

const activeSubIdx = ref(0)
const localLayoutMode = ref<'tab' | 'list'>(props.layoutMode)

const handleTabClick = (sIdx: number) => {
  if (activeSubIdx.value === sIdx) return
  forceSave()
  activeSubIdx.value = sIdx
}

watch(() => props.layoutMode, (newVal) => {
  localLayoutMode.value = newVal
})

console.log('[COMPOSITE_RENDER_DEBUG] rendering CompositeQuestion: ', {
  id: props.question.id,
  type: props.question.type,
  materialLength: props.question.material?.length || 0,
  subQuestionsCount: props.question.subQuestions?.length || 0,
  subQuestions: props.question.subQuestions
})

const isSubAnswered = (sub: any): boolean => {
  if (!props.modelValue) return false
  if (sub.type === 'composite' && sub.subQuestions) {
    return sub.subQuestions.some((child: any) => isSubAnswered(child))
  }
  const val = props.modelValue[sub.id]
  if (!val) return false
  if (typeof val === 'string') return val.trim().length > 0
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'object') {
    const subVal = val as any
    if (subVal.type === 'text') return !!subVal.textContent?.trim()
    if (subVal.type === 'board') return !!subVal.boardData
    if (subVal.type === 'photo') return !!subVal.photoUrl
  }
  return true
}

const { renderMessageContent } = useMessageRenderer()

const subAnswers = computed<Record<string, any>>({
  get: () => props.modelValue || {},
  set: (val) => emit('update:modelValue', val),
})

const handleUpdate = (id: string, value: unknown) => {
  const updated = { ...subAnswers.value, [id]: value }
  subAnswers.value = updated
  emit('change', updated)
}

const subjectiveQuestionRefsTab = ref<any>(null)
const subjectiveQuestionRefsListMap = reactive<Record<string, any>>({})
const nestedCompositeRefsListMap = reactive<Record<string, any>>({})

const setSubjectiveRef = (id: string, el: any) => {
  if (el) {
    subjectiveQuestionRefsListMap[id] = el
  } else {
    delete subjectiveQuestionRefsListMap[id]
  }
}

const setNestedCompositeRef = (id: string, el: any) => {
  if (el) {
    nestedCompositeRefsListMap[id] = el
  } else {
    delete nestedCompositeRefsListMap[id]
  }
}

// 深度保存所有子主观题与填空题数据
const forceSave = () => {
  if (localLayoutMode.value === 'tab') {
    const activeSub = props.question.subQuestions?.[activeSubIdx.value]
    if (activeSub) {
      if (activeSub.type === 'composite') {
        // 如果是嵌套的 composite 题，递归调用其 forceSave
        const nestedComposite = subjectiveQuestionRefsTab.value
        nestedComposite?.forceSave?.()
      } else if (activeSub.structuredContent?.type === 'subjective' || activeSub.type === 'subjective') {
        const subComponent = subjectiveQuestionRefsTab.value
        const mixedInputArea = subComponent?.getMixedInputArea?.()
        if (mixedInputArea) {
          mixedInputArea.blur?.()
          const board = mixedInputArea.getDrawingBoard?.()
          const boardData = board?.saveData()
          if (boardData) {
            activeSub.structuredContent.boardData = boardData
          }
          const boardImg = board?.exportToJpg?.(0.9)
          const subVal = (props.modelValue && props.modelValue[activeSub.id]) || {}
          subVal.boardImg = boardImg
          subVal.boardData = boardData
          handleUpdate(activeSub.id, subVal)
        }
      } else if (activeSub.type === 'fill_in_blank' || activeSub.structuredContent?.type === 'fill_in_blank') {
        const subComponent = subjectiveQuestionRefsTab.value
        subComponent?.forceSave?.()
      }
    }
  } else {
    // List 模式：遍历所有子题目
    props.question.subQuestions?.forEach((sub) => {
      if (sub.type === 'composite') {
        // 如果是子 composite，递归调用
        const subRefs = nestedCompositeRefsListMap[sub.id]
        subRefs?.forceSave?.()
      } else if (sub.structuredContent?.type === 'subjective' || sub.type === 'subjective') {
        const subRefs = subjectiveQuestionRefsListMap[sub.id]
        const mixedInputArea = subRefs?.getMixedInputArea?.()
        if (mixedInputArea) {
          mixedInputArea.blur?.()
          const board = mixedInputArea.getDrawingBoard?.()
          const boardData = board?.saveData()
          if (boardData) {
            sub.structuredContent.boardData = boardData
          }
          const boardImg = board?.exportToJpg?.(0.9)
          const subVal = (props.modelValue && props.modelValue[sub.id]) || {}
          subVal.boardImg = boardImg
          subVal.boardData = boardData
          handleUpdate(sub.id, subVal)
        }
      } else if (sub.type === 'fill_in_blank' || sub.structuredContent?.type === 'fill_in_blank') {
        const subRefs = subjectiveQuestionRefsListMap[sub.id]
        subRefs?.forceSave?.()
      }
    })
  }
}

defineExpose({
  forceSave
})

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
  }
}

.sub-questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-question-tabs-container {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
  background: transparent;
  padding: 4px 0;
  border-bottom: 1px dashed #e2e8f0;
  gap: 12px;

  .tabs-label {
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8; /* 更优雅的浅灰蓝 */
    white-space: nowrap;
  }

  .tabs-wrapper {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .sub-tab-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px; /* 扁平微圆角比纯圆更现代 */
    border: 1px solid #e2e8f0;
    background: #ffffff;
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    user-select: none;
    -webkit-tap-highlight-color: transparent;

    &:hover {
      border-color: #615efe;
      color: #615efe;
      background: rgba(97, 94, 254, 0.04);
      transform: translateY(-1px);
    }

    &:active {
      transform: scale(0.95);
    }

    &.active {
      background: #615efe;
      border-color: #615efe;
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(97, 94, 254, 0.25);
    }

    &.answered:not(.active) {
      background: #f0fdf4;
      border-color: #bbf7d0;
      color: #166534;
    }

    .status-dot {
      position: absolute;
      top: -3px;
      right: -3px;
      width: 6px;
      height: 6px;
      background-color: #22c55e;
      border-radius: 50%;
      border: 1.5px solid #ffffff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
  }
}

.sub-question-item {
  padding: 0;
  background: transparent;
  border: none;
  transition: all 0.2s;

  &:hover {
    border-color: transparent;
    box-shadow: none;
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

  /* 消除子题目由于层层嵌套而产生的累加 padding 积压 */
  :deep(.base-question) {
    padding: 0 !important;
    background: transparent !important;
  }

  /* 递归复合子题包裹器不需要重复的边框和背景，消除嵌套厚重感 */
  :deep(.sub-question-item) {
    padding: 8px 0 0 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }
}

/* 过渡动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* 布局切换样式 */
.composite-layout-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;

  .layout-toggle-label {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
  }

  .layout-toggle-group {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }

  .layout-toggle-btn {
    border: none;
    background: transparent;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    user-select: none;

    &:hover {
      color: #615efe;
    }

    &.active {
      background: #ffffff;
      color: #615efe;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      font-weight: 600;
    }
  }
}

.sub-question-index-header {
  margin-bottom: 12px;
  border-bottom: 1px solid #edf2f7;
  padding-bottom: 8px;

  .sub-index-tag {
    display: inline-block;
    font-size: 12px;
    font-weight: 600;
    color: #615efe;
    background: rgba(97, 94, 254, 0.08);
    padding: 3px 10px;
    border-radius: 6px;
  }
}
</style>
