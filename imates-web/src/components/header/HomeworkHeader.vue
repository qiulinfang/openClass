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

// 检查作答内容是否为空
const isEmptyAnswer = (val: any): boolean => {
  if (val === null || val === undefined) return true
  if (typeof val === 'string') return val.trim() === ''
  if (Array.isArray(val))
    return (
      val.length === 0 ||
      val.every(
        (item) =>
          item === null || item === undefined || (typeof item === 'string' && item.trim() === ''),
      )
    )
  if (typeof val === 'object') {
    return (
      Object.keys(val).length === 0 ||
      Object.values(val).every(
        (item) =>
          item === null || item === undefined || (typeof item === 'string' && item.trim() === ''),
      )
    )
  }
  return false
}

// 判断题目是否已作答
const getQuestionStatus = (question: ExerciseItem): 'answered' | 'unanswered' => {
  const structured = question.structuredContent
  if (!structured) return 'unanswered'

  const hasBoardData = hasBoardAnswerData(structured.boardData)
  const hasUserAnswer = !isEmptyAnswer(structured.userAnswer)

  if (hasBoardData || hasUserAnswer) return 'answered'
  return 'unanswered'
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
  justify-content: center;
}

.question-circles {
  display: flex;
  gap: 8px;
  padding: 2px 4px;
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
    box-shadow: 0 4px 12px rgba(110, 85, 255, 0.3);
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
      box-shadow: 0 4px 12px rgba(110, 85, 255, 0.2);
    }
  }
}
</style>
