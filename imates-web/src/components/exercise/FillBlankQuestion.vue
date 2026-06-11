<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-id="showId" :show-analysis="showAnalysis">
    <template #extra>
      <slot name="extra"></slot>
    </template>
    
    <!-- 题干部分：支持渲染 [blank_n] 占位符 -->
    <template #stem>
      <div class="fill-blank-question-stem">
        <template v-for="(part, index) in parsedParts" :key="index">
          <span v-if="part.type === 'text'" class="text-part" v-html="renderMessageContent(part.content || '')"></span>
          <span v-else class="blank-tag">({{ part.blankIndex }})</span>
        </template>
      </div>
    </template>

    <!-- 填空输入区域 -->
    <div class="blank-inputs-container q-mt-md">
      <div 
        v-for="i in blankCount" 
        :key="'blank-item-' + (i - 1)"
        class="blank-item"
        :class="{ 'is-active': activeBlank === i - 1 }"
      >
        <MixedInputArea
          :model-value="finalAnswers[i-1]"
          question-type="fill"
          :disabled="disabled"
          :placeholder="'请输入第 ' + i + ' 空的答案'"
          @update:model-value="val => handleBlankUpdate(i - 1, val)"
          @focus="activeBlank = i - 1"
        >
        </MixedInputArea>
      </div>
    </div>
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
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import type { ExerciseItem } from '../../types/exercise'

export interface StructuredAnswer {
  type: 'board' | 'photo'
  boardData?: any
  photoUrl?: string
  boardImg?: string
  timestamp?: number
}

const props = withDefaults(defineProps<{
  question: ExerciseItem
  modelValue?: (string | StructuredAnswer)[]
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
  (e: 'update:modelValue', value: (string | StructuredAnswer)[]): void
}>()

const { renderMessageContent } = useMessageRenderer()

// 状态管理
const activeBlank = ref<number | null>(null)

// 内部最终答案数组
const finalAnswers = ref<(string | StructuredAnswer)[]>(props.modelValue || [])

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

// 初始化
onMounted(() => {
  if (props.modelValue) {
    finalAnswers.value = [...props.modelValue]
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

  .blank-tag {
    color: #615efe;
    margin: 0 4px;
    font-weight: bold;
    text-decoration: underline;
  }
}

.blank-inputs-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.blank-item {
  &.is-active {
    // 激活状态由 MixedInputArea 内部处理，这里保留结构
  }
}
</style>
