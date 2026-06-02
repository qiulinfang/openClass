<template>
  <BaseQuestion :question="question" :show-title="showTitle" :show-id="showId">
    <template #extra>
      <slot name="extra"></slot>
    </template>
    <template #stem>
      <view class="fill-blank-question">
        <view class="question-stem-content">
          <template v-for="(part, index) in parsedParts">
            <rich-text v-if="part.type === 'text'" :key="'text-' + index" class="text-part" :nodes="renderMessageContent(part.content || '')"></rich-text>
            <input
              v-else
              :key="'blank-' + part.blankIndex"
              :value="answers[part.blankIndex]"
              type="text"
              class="blank-input"
              :class="{ 'is-disabled': disabled }"
              :style="{ width: getBlankWidth(part.blankIndex) }"
              placeholder="填入"
              :disabled="disabled"
              @input="(e) => handleInput(e, part.blankIndex)"
            />
          </template>
        </view>
      </view>
    </template>
  </BaseQuestion>
</template>

<script lang="ts">
export default {
  name: 'FillBlankQuestion'
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseQuestion from './BaseQuestion.vue'
import { useMessageRenderer } from '../../composables/useMessageRenderer.js'

const props = withDefaults(defineProps<{
  question: any
  modelValue?: string[]
  showTitle?: boolean
  showId?: boolean
  disabled?: boolean
}>(), {
  showTitle: false,
  showId: true,
  disabled: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const { renderMessageContent } = useMessageRenderer()

// 内部维护答案数组
const answers = ref<string[]>(props.modelValue || [])

// 监听外部值变化同步到内部
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    answers.value = [...newVal]
  }
}, { deep: true })

// 解析题干，将括号拆分为输入框
const parsedParts = computed(() => {
  const isChoice = props.question.type === 'single_choice' || props.question.type === 'multiple_choice'
  const stem = (!isChoice && props.question.questionContent)
    ? props.question.questionContent
    : (props.question.structuredContent?.stem || props.question.title || '')
    
  const regex = /\[blank_\d+\]/g
  const parts: Array<{ type: 'text' | 'blank', content?: string, blankIndex: number }> = []
  
  let lastIndex = 0
  let blankCount = 0
  let match

  while ((match = regex.exec(stem)) !== null) {
    // 添加文本部分
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: stem.substring(lastIndex, match.index),
        blankIndex: -1
      })
    }
    // 添加填空部分
    parts.push({
      type: 'blank',
      blankIndex: blankCount++
    })
    lastIndex = regex.lastIndex
  }

  // 添加剩余文本
  if (lastIndex < stem.length) {
    parts.push({
      type: 'text',
      content: stem.substring(lastIndex),
      blankIndex: -1
    })
  }

  // 初始化 answers 数组长度
  if (answers.value.length < blankCount) {
    const newAnswers = [...answers.value]
    for (let i = answers.value.length; i < blankCount; i++) {
      newAnswers[i] = ''
    }
    answers.value = newAnswers
  }

  return parts
})

const getBlankWidth = (index: number) => {
  const content = answers.value[index] || ''
  // 计算内容的实际宽度。汉字约 18px，字母/数字约 10px
  let width = 0
  for (let i = 0; i < content.length; i++) {
    width += content.charCodeAt(i) > 127 ? 18 : 10
  }
  const minWidth = 80
  return `${Math.max(minWidth, width + 30)}px`
}

const handleInput = (event: any, index: number) => {
  answers.value[index] = event.detail.value
  emit('update:modelValue', [...answers.value])
}
</script>

<style scoped lang="scss">
.fill-blank-question {
  .question-stem-content {
    font-size: 16px;
    line-height: 1.6;
    color: #333;
    word-break: break-all;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    font-weight: 500;
  }

  .text-part {
    white-space: pre-wrap;
    display: inline;
    
    :deep(p) {
      display: inline;
      margin: 0;
    }
  }

  .blank-input {
    border: none;
    border-bottom: 2px solid #6e55ff;
    background: transparent;
    padding: 0 8px;
    margin: 0 4px;
    font-size: 16px;
    color: #6e55ff;
    font-weight: 600;
    text-align: center;
    outline: none;
    height: 28px;

    &::placeholder {
      color: #cbd5e1;
      font-weight: 400;
      font-size: 14px;
    }

    &:focus {
      border-bottom-color: #4f39f6;
      background: rgba(110, 85, 255, 0.05);
    }

    &.is-disabled {
      border-bottom-color: #e2e8f0;
      color: #64748b;
      cursor: not-allowed;
    }
  }
}
</style>
