<template>
  <div class="question-record-list">
    <!-- 空状态 -->
    <div v-if="!records || records.length === 0" class="empty-state">
      <q-icon name="quiz" size="48px" color="grey-5" />
      <div class="q-mt-md text-h6 text-grey-6">问题记录</div>
      <div class="q-mt-sm text-caption text-grey-5">您的问题记录将显示在这里</div>
    </div>

    <!-- 问题记录列表 -->
    <div v-else class="record-list">
      <div
        v-for="record in records"
        :key="record.id"
        class="record-item"
        @click="handleRecordClick(record)"
      >
        <div class="record-header">
          <div class="record-time">{{ formatTime(record.timestamp) }}</div>
          <q-icon name="chevron_right" size="xs" color="grey-6" />
        </div>
        <div class="record-question">{{ record.question }}</div>
        <div v-if="record.answer" class="record-answer">
          {{ truncateText(record.answer, 100) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuestionRecord } from '@/types'

// 定义 props
interface Props {
  records?: QuestionRecord[]
}

withDefaults(defineProps<Props>(), {
  records: () => []
})

// 定义 emits
const emit = defineEmits<{
  'record-click': [record: QuestionRecord]
}>()

// 处理记录点击
const handleRecordClick = (record: QuestionRecord) => {
  emit('record-click', record)
}

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 截断文本
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}
</script>

<style lang="scss" scoped>
.question-record-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.record-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(144, 89, 255, 0.3);
    border-radius: 3px;
    
    &:hover {
      background: rgba(144, 89, 255, 0.5);
    }
  }
}

.record-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  
  &:hover {
    background: rgba(144, 89, 255, 0.1);
    border-color: rgba(144, 89, 255, 0.3);
    transform: translateX(4px);
  }
  
  &:active {
    transform: translateX(2px);
  }
  
  .record-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    
    .record-time {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    }
  }
  
  .record-question {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 6px;
    line-height: 1.4;
  }
  
  .record-answer {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.4;
  }
}
</style>

