<template>
  <header class="homework-header">
    <div class="header-left">
      <slot name="left-action">
        <div class="back-btn" @click="emit('back')">
          <img :src="goBackIcon" alt="返回" class="back-icon" />
        </div>
      </slot>
    </div>
    <div class="header-center">
      <div class="question-circles-container">
        <div class="question-circles">
          <button
            v-for="(question, index) in questions"
            :key="getQuestionKey(question)"
            class="question-circle"
            :class="{
              'is-active': index === currentIndex,
              'is-answered': getQuestionStatus(question) === 'answered',
              'is-unanswered': getQuestionStatus(question) === 'unanswered',
            }"
            @click="emit('select-question', question, index)"
          >
            {{ index + 1 }}
          </button>
        </div>
      </div>
    </div>
    <div class="header-right">
      <slot name="right-action">
        <q-btn
          class="draft-toggle-btn"
          unelevated
          :class="{ 'is-active': showDraft }"
          @click="emit('toggle-draft')"
        >
          草稿纸
        </q-btn>
      </slot>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExerciseItem } from '@/types'
import goBackIcon from '/icons/goback.svg'

interface Props {
  title?: string
  questions: ExerciseItem[]
  currentIndex: number
  showDraft?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  questions: () => [],
  currentIndex: 0,
  showDraft: false,
})

const emit = defineEmits<{
  back: []
  'select-question': [question: ExerciseItem, index: number]
  'prev-question': []
  'next-question': []
  'toggle-draft': []
}>()

// 获取题目唯一标识
const getQuestionKey = (question: ExerciseItem): string => {
  if (!question) return ''
  const qId = question.bmNo || (question as { id?: string | number }).id || ''
  return qId.toString()
}

// 判断白板数据是否包含绘制对象
const hasBoardAnswerData = (boardData: any): boolean => {
  const objects = boardData?.objects
  return Array.isArray(objects) && objects.length > 0
}

// 检查题目是否已完全作答（每个空、每个小题均需完成）
const isQuestionFullyAnswered = (question: ExerciseItem): boolean => {
  const type = question.type || question.structuredContent?.type || ''
  const structured = question.structuredContent
  if (!structured) return false

  const isValEmpty = (item: any): boolean => {
    if (item === null || item === undefined) return true
    if (typeof item === 'string') return item.trim() === ''
    if (typeof item === 'object') {
      if (item.type === 'photo') {
        return !item.photoUrl
      }
      if (item.type === 'board' || ('boardData' in item)) {
        const boardData = item.boardData || item
        const hasObjects = Array.isArray(boardData?.objects) && boardData.objects.length > 0
        const hasPhoto = !!item.photoUrl
        return !hasObjects && !hasPhoto
      }
      return Object.keys(item).length === 0
    }
    return false
  }

  // 1. 选择题
  if (['single_choice', 'multiple_choice'].includes(type)) {
    const val = structured.userAnswer
    return Array.isArray(val) && val.length > 0
  }

  // 2. 判断题
  if (['true_false', 'judgment'].includes(type)) {
    const val = structured.userAnswer
    return val !== undefined && val !== null && val !== ''
  }

  // 3. 填空题：必须每一空都有作答内容
  if (type === 'fill_in_blank') {
    const expectedCount = Array.isArray(structured.blanks)
      ? structured.blanks.length
      : (typeof structured.blanks === 'number' ? structured.blanks : 0)
    if (expectedCount === 0) return false
    const val = structured.userAnswer
    if (!Array.isArray(val) || val.length < expectedCount) return false
    return val.slice(0, expectedCount).every(item => !isValEmpty(item))
  }

  // 4. 主观题
  if (type === 'subjective') {
    const val = structured.userAnswer
    if (!val) {
      const hasBoardData = Array.isArray(structured.boardData?.objects) && structured.boardData.objects.length > 0
      return hasBoardData
    }
    return !isValEmpty(val)
  }

  // 5. 复合题：每个子题都必须完全作答
  if (type === 'composite') {
    const subQuestions = question.subQuestions
    if (!Array.isArray(subQuestions) || subQuestions.length === 0) return false
    const subAnswers = structured.userAnswer || {}
    return subQuestions.every(sub => {
      const subCopy: ExerciseItem = {
        ...sub,
        structuredContent: {
          ...sub.structuredContent,
          userAnswer: subAnswers[sub.id]
        }
      }
      return isQuestionFullyAnswered(subCopy)
    })
  }

  const val = structured.userAnswer
  return val !== undefined && val !== null && val !== ''
}

// 判断题目是否已作答（全空/全子题完全作答）
const getQuestionStatus = (question: ExerciseItem): 'answered' | 'unanswered' => {
  return isQuestionFullyAnswered(question) ? 'answered' : 'unanswered'
}
</script>

<style lang="scss" scoped>
.homework-header {
  height: 64px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f7f6ff;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  width: 100%;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  max-width: 25%;

  :deep(.back-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: transparent;
    transition: background-color 0.2s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  }

  :deep(.back-icon) {
    width: 24px;
    height: 24px;
    filter: brightness(0.2); // 使返回图标呈现深色，与浅色Header契合
  }

  :deep(.homework-name) {
    font-size: 16px;
    font-weight: 600;
    color: #393548;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  margin: 0 16px;
  position: relative;
  min-width: 0; /* 防止子元素溢出，使其能够收缩 */

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 24px;
    height: 100%;
    background: linear-gradient(to right, #f7f6ff, transparent);
    z-index: 2;
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 24px;
    height: 100%;
    background: linear-gradient(to left, #f7f6ff, transparent);
    z-index: 2;
    pointer-events: none;
  }
}

.question-circles-container {
  overflow-x: auto;
  scrollbar-width: none; // Firefox
  &::-webkit-scrollbar {
    display: none; // Chrome, Safari
  }
  display: flex;
  align-items: center;
  width: 100%;
}

.question-circles {
  display: flex;
  gap: 8px;
  padding: 2px 4px;
  margin: 0 auto; /* 关键：未溢出时居中，溢出时靠左并允许滚动 */
}

.question-circle {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    border-color: #6e55ff;
    color: #6e55ff;
  }

  &.is-answered {
    background: #f7f6ff;
    border-color: #B3A7FF;
    color: rgba(110, 85, 255, 0.5);
  }

  &.is-active {
    background: #6e55ff !important;
    border-color: #6e55ff !important;
    color: #ffffff !important;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  :deep(.draft-toggle-btn) {
    background: #e2e8f0;
    color: #475569;
    font-weight: 600;
    border-radius: 20px;
    padding: 6px 16px;
    font-size: 14px;
    text-transform: none;
    transition: all 0.2s ease;

    &.is-active {
      background: #6e55ff;
      color: #ffffff;
    }
  }
}
</style>
