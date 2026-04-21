<template>
  <div class="practice-result-statistics">
    <div class="statistics-header">
      <h3 class="title">练习结果统计</h3>
      <div class="score-badge">
        <span class="score">{{ correctCount }}</span>
        <span class="total">/ {{ totalCount }}</span>
      </div>
    </div>

    <div class="statistics-grid">
      <div 
        v-for="(result, index) in results" 
        :key="result.id"
        class="result-item"
        :class="[result.isCorrect ? 'is-correct' : 'is-wrong']"
      >
        <div class="item-index">{{ index + 1 }}</div>
        <div class="item-status">
          <q-icon :name="result.isCorrect ? 'check_circle' : 'cancel'" size="24px" />
        </div>
        <div class="item-info">
          <div class="item-title">{{ result.title }}</div>
          <div class="item-comparison">
            <div class="answer-row">
              <span class="label">你的作答：</span>
              <span class="value user-value">{{ formatValue(result.userAnswer, result.type) }}</span>
            </div>
            <div class="answer-row" v-if="!result.isCorrect">
              <span class="label">标准答案：</span>
              <span class="value correct-value">{{ formatValue(result.correctAnswer, result.type) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface QuestionResult {
  id: string
  title: string
  type: string
  userAnswer: any
  correctAnswer: any
  isCorrect: boolean
}

const props = defineProps<{
  results: QuestionResult[]
}>()

const totalCount = computed(() => props.results.length)
const correctCount = computed(() => props.results.filter(r => r.isCorrect).length)

const formatValue = (val: any, type: string) => {
  if (val === undefined || val === null || val === '') return '未作答'
  if (type === 'choice') {
    return Array.isArray(val) ? val.join(', ') : val
  }
  if (type === 'judgment') {
    return val === true || val === 'true' ? '对' : '错'
  }
  if (type === 'fill' && Array.isArray(val)) {
    return val.map((v, i) => `(${i + 1}) ${v || '空'}`).join(' ')
  }
  return val
}
</script>

<style scoped lang="scss">
.practice-result-statistics {
  padding: 20px;
  background: white;
  border-radius: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;

  .statistics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f1f5f9;

    .title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }

    .score-badge {
      background: #f8fafc;
      padding: 8px 16px;
      border-radius: 20px;
      .score {
        font-size: 24px;
        font-weight: 800;
        color: #6e55ff;
      }
      .total {
        font-size: 16px;
        color: #64748b;
        margin-left: 4px;
      }
    }
  }

  .statistics-grid {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-right: 8px;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 2px;
    }
  }

  .result-item {
    display: flex;
    align-items: flex-start;
    padding: 16px;
    border-radius: 12px;
    gap: 16px;
    border: 1px solid #f1f5f9;
    transition: all 0.2s;

    &.is-correct {
      background: #f0fdf4;
      border-color: #bbf7d0;
      .item-status { color: #22c55e; }
      .item-index { background: #22c55e; color: white; }
    }

    &.is-wrong {
      background: #fef2f2;
      border-color: #fecaca;
      .item-status { color: #ef4444; }
      .item-index { background: #ef4444; color: white; }
    }

    .item-index {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .item-info {
      flex: 1;
      min-width: 0;
    }

    .item-title {
      font-size: 15px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-comparison {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .answer-row {
      font-size: 13px;
      display: flex;
      .label { color: #64748b; width: 70px; flex-shrink: 0; }
      .value { font-weight: 600; }
      .user-value { color: #334155; }
      .correct-value { color: #22c55e; }
    }
  }
}
</style>
