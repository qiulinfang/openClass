<template>
  <view class="find-exercise-view">
    <!-- 头部工具栏 -->
    <view class="toolbar">
      <view class="back-btn" @click="goBack">
        <image src="/static/icons/arrow.svg" mode="aspectFit" class="back-icon" />
      </view>
      
      <text class="toolbar-title">我的习题</text>
      
      <view class="selection-info" v-if="hasSelectableQuestions">
        <text class="selection-count">已选{{ selectedCount }}/{{ selectableCount }}</text>
      </view>
      
      <view class="start-btn-container">
        <Button
          label="开始练习"
          :variant="hasSelectedQuestions ? 'primary' : 'ghost'"
          :disabled="!hasSelectedQuestions"
          size="sm"
          @click="handleStartExercise"
        />
      </view>
    </view>

    <!-- 主要内容区域 -->
    <view class="main-content">
      <view v-if="isInitializing" class="loading-state">
        <text>加载中...</text>
      </view>
      
      <view v-else class="question-list-container">
        <scroll-view scroll-y class="question-list">
          <view v-for="q in similarQuestions" :key="q.id" class="question-item">
            <view class="item-header">
              <checkbox
                :value="q.bmNo"
                :checked="selectedQuestionIds.includes(q.bmNo)"
                @click="toggleSelection(q.bmNo)"
              />
              <text class="item-title">{{ q.title || '题目' }}</text>
            </view>
            <view class="item-body">
              <rich-text :nodes="q.question || q.title || ''"></rich-text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuestionStore } from '../stores/questionStore'
import type { ExerciseItem } from '../types'
import Button from '../components/base/Button.vue'
import { normalizeSubject } from '../constants/subjects'

defineOptions({
  name: 'FindExerciseView'
})

const questionStore = useQuestionStore()
const similarQuestions = ref<any[]>([])
const selectedQuestionIds = ref<string[]>([])
const isInitializing = ref(true)

const hasSelectedQuestions = computed(() => selectedQuestionIds.value.length > 0)
const hasSelectableQuestions = computed(() => similarQuestions.value.length > 0)
const selectedCount = computed(() => selectedQuestionIds.value.length)
const selectableCount = computed(() => similarQuestions.value.length)

const toggleSelection = (id: string) => {
  const index = selectedQuestionIds.value.indexOf(id)
  if (index > -1) {
    selectedQuestionIds.value.splice(index, 1)
  } else {
    selectedQuestionIds.value.push(id)
  }
}

const handleStartExercise = () => {
  if (!hasSelectedQuestions.value) return
  uni.navigateTo({
    url: `/pages/exercise/solve?ids=${selectedQuestionIds.value.join(',')}`
  })
}

const goBack = () => {
  uni.navigateBack()
}

onMounted(async () => {
  // 模拟获取数据逻辑
  isInitializing.value = false
})
</script>

<style scoped>
.find-exercise-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f8f9fa;
}

.toolbar {
  height: 100rpx;
  background-color: #0f002e;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  color: #ffffff;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
}

.back-icon {
  width: 40rpx;
  height: 40rpx;
  transform: rotate(180deg);
}

.toolbar-title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  margin-left: 20rpx;
}

.selection-info {
  margin-right: 20rpx;
  font-size: 24rpx;
}

.main-content {
  flex: 1;
  overflow: hidden;
}

.loading-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.question-list-container {
  height: 100%;
}

.question-list {
  height: 100%;
  padding: 24rpx;
}

.question-item {
  background-color: #ffffff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.item-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.item-title {
  font-size: 28rpx;
  font-weight: 600;
  margin-left: 16rpx;
}

.item-body {
  font-size: 28rpx;
  color: #333;
}
</style>
