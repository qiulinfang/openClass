<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-id="showId" :show-analysis="false">
    <template #extra>
      <slot name="extra"></slot>
    </template>
    
    <!-- 题干部分：支持渲染 [blank_n] 占位符 -->
    <template #stem>
      <div class="fill-blank-question-stem">
        <template v-for="(part, index) in parsedParts" :key="index">
          <span v-if="part.type === 'text'" class="text-part" v-html="renderMessageContent(part.content || '')"></span>
          <span
            v-else
            class="blank-tag-inline"
            :class="{
              'is-active': activeBlank === part.blankIndex - 1,
              'is-answered': isBlankAnswered(part.blankIndex - 1),
              'is-unanswered': !isBlankAnswered(part.blankIndex - 1) && activeBlank !== part.blankIndex - 1
            }"
            @click="selectBlank(part.blankIndex - 1)"
          >
            {{ getBlankText(part.blankIndex - 1) }}
          </span>
        </template>
      </div>
    </template>

    <!-- 填空输入区域 (仅显示当前选中的空) -->
    <div class="blank-inputs-container q-mt-md" v-if="blankCount > 0 && activeBlank !== null">
      <MixedInputArea
        :key="'blank-input-' + activeBlank"
        :model-value="finalAnswers[activeBlank]"
        question-type="fill"
        :disabled="disabled"
        :label="''"
        :placeholder="'请输入第 ' + (activeBlank + 1) + ' 空的答案'"
        @update:model-value="val => handleBlankUpdate(activeBlank!, val)"
      />
    </div>
    <div v-else-if="blankCount === 0" class="field-missing-warning" style="margin-bottom: 12px;">【警告：填空题未配置任何填空项 (blanks)】</div>

    <QuestionAnalysis :question="question" :show="showAnalysis" />
  </BaseQuestion>
</template>

<script lang="ts">
export default {
  name: 'FillBlankQuestion'
}
</script>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import BaseQuestion from './BaseQuestion.vue'
import MixedInputArea from './MixedInputArea.vue'
import QuestionAnalysis from './QuestionAnalysis.vue'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import type { ExerciseItem, StructuredAnswerItem } from '../../types/exercise'

const props = withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: StructuredAnswerItem[]
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

const emit = defineEmits<{
  (e: 'update:modelValue', value: StructuredAnswerItem[]): void
}>()

const { renderMessageContent } = useMessageRenderer()

// 状态管理
const activeBlank = ref<number | null>(null)

// 内部最终答案数组
const finalAnswers = ref<StructuredAnswerItem[]>(props.modelValue || [])

// 填空数量
const blankCount = computed(() => {
  const blanks = props.question.structuredContent?.blanks
  if (Array.isArray(blanks)) return blanks.length
  if (typeof blanks === 'number') return blanks
  return 0
})

// 解析题干
const parsedParts = computed(() => {
  const stem = props.question.structuredContent?.stem || ''
  const regex = /\[blank_(\d+)\]/g
  const parts: Array<{ type: 'text' | 'blank', content?: string, blankIndex: number }> = []
  
  let lastIndex = 0
  let match

  while ((match = regex.exec(stem)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: stem.substring(lastIndex, match.index),
        blankIndex: -1
      })
    }
    parts.push({
      type: 'blank',
      blankIndex: parseInt(match[1])
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < stem.length) {
    parts.push({
      type: 'text',
      content: stem.substring(lastIndex),
      blankIndex: -1
    })
  }

  return parts
})

// 判断填空项是否已作答
const isBlankAnswered = (index: number): boolean => {
  const ans = finalAnswers.value[index]
  if (!ans) return false
  if (ans.type === 'photo') return !!ans.photoUrl
  if (ans.type === 'board') {
    return Array.isArray(ans.boardData?.objects) && ans.boardData.objects.length > 0
  }
  return false
}

// 获取填空占位符文本
const getBlankText = (index: number): string => {
  if (activeBlank.value === index) return '正在作答'
  return isBlankAnswered(index) ? '已作答' : '点击作答'
}

// 切换选中的填空项
const selectBlank = (index: number) => {
  if (props.disabled) return
  activeBlank.value = index
}

// 初始化
onMounted(() => {
  if (props.modelValue) {
    finalAnswers.value = [...props.modelValue]
  }
  if (blankCount.value > 0 && activeBlank.value === null) {
    activeBlank.value = 0
  }
})

// 监听外部 modelValue 变化
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    finalAnswers.value = [...newVal]
  }
}, { deep: true })

const handleBlankUpdate = (index: number, val: any) => {
  finalAnswers.value[index] = val
  emit('update:modelValue', [...finalAnswers.value])
}
</script>

<style scoped lang="scss">
.fill-blank-question-stem {
  font-size: 16px;
  line-height: 1.8;
  color: #333;
  word-break: break-all;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  font-weight: 500;

  .text-part {
    :deep(p) {
      display: inline;
      margin: 0;
    }
  }

  .blank-tag-inline {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 6px;
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s ease;
    vertical-align: middle;

    &.is-active {
      background: #e8e9ff;
      color: #6e55ff;
      border: 1px solid #a5b4fc;
    }

    &.is-answered {
      background: #6e55ff;
      color: #ffffff;
      border: 1px solid #6e55ff;
    }

    &.is-unanswered {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #e2e8f0;

      &:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
    }
  }
}

.blank-inputs-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
