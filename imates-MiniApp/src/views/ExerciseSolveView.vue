<template>
  <view class="exercise-solve-view">
    <!-- 头部工具栏 -->
    <view class="toolbar">
      <view class="back-btn" @click="goBack">
        <image src="/static/icons/arrow.svg" mode="aspectFit" class="back-icon" />
      </view>
      <view class="subject-filter">
        <Select
          v-if="!isFromHomework"
          v-model="selectedSubjectFilter"
          :options="subjectOptions"
          class="subject-select"
        />
      </view>
    </view>

    <!-- 主要内容区域 -->
    <view class="main-content">
      <!-- 题目列表 -->
      <view v-if="showQuestionList" class="question-list-sidebar">
        <QuestionList
          ref="questionListRef"
          :type="isFromHomework ? 'homework' : 'exercise'"
          :search-query="searchQuery"
          @question-selected="handleQuestionSelected"
        />
      </view>

      <!-- 功能区域 -->
      <view class="function-panel">
        <view class="nav-tabs">
          <view
            v-for="item in navItems"
            :key="item.key"
            class="nav-tab"
            :class="{ active: currentFunction === item.key, disabled: item.disabled }"
            @click="!item.disabled && switchFunction(item.key)"
          >
            <image :src="item.icon" mode="aspectFit" class="tab-icon" />
            <text class="tab-label">{{ item.label }}</text>
          </view>
        </view>

        <view class="function-content">
          <!-- 这里根据 currentFunction 渲染不同的视图，简化为 Placeholder -->
          <view v-if="currentFunction === 'chatAi'" class="view-placeholder">
            <text>学伴答疑视图 (开发中)</text>
          </view>
          <view v-else-if="currentFunction === 'viewAnswer'" class="view-placeholder">
            <text>查看答案视图 (开发中)</text>
          </view>
          <view v-else-if="currentFunction === 'similarQuestion'" class="view-placeholder">
            <text>举一反三视图 (开发中)</text>
          </view>
          <view v-else-if="currentFunction === 'myDraft'" class="view-placeholder">
            <text>我的作答/草稿视图 (开发中)</text>
          </view>
          <view v-else class="empty-function">
            <text>请选择功能</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 悬浮按钮切换题目列表 -->
    <view class="fab-btn" @click="showQuestionList = !showQuestionList">
      <text>{{ showQuestionList ? '收起列表' : '展开列表' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuestionStore } from '../stores/questionStore'
import { useHomeworkStore } from '../stores/homeworkStore'
import QuestionList from '../components/question/QuestionList.vue'
import Select from '../components/base/Select.vue'
import { SUBJECT_OPTIONS } from '../constants/subjects'

defineOptions({
  name: 'ExerciseSolveView',
})

const questionStore = useQuestionStore()
const homeworkStore = useHomeworkStore()
const showQuestionList = ref(true)
const currentFunction = ref('chatAi')
const searchQuery = ref('')
const selectedSubjectFilter = ref('')
const isFromHomework = ref(false) // 简化逻辑

const subjectOptions = SUBJECT_OPTIONS

const navItems = computed(() => [
  { key: 'chatAi', label: '学伴答疑', icon: '/static/icons/xuebanask.svg', disabled: false },
  { key: 'viewAnswer', label: '查看答案', icon: '/static/icons/seeAnswer.svg', disabled: false },
  { key: 'similarQuestion', label: '举一反三', icon: '/static/icons/onetothree.svg', disabled: false },
  { key: 'myDraft', label: '我的作答', icon: '/static/icons/myanswer.svg', disabled: false }
])

const switchFunction = (key: string) => {
  currentFunction.value = key
}

const handleQuestionSelected = () => {
  if ((uni as any).getSystemInfoSync().windowWidth < 600) {
    showQuestionList.value = false
  }
}

const goBack = () => {
  (uni as any).navigateBack()
}

onMounted(() => {
  // 初始化逻辑
})
</script>

<style scoped>
.exercise-solve-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f7f6ff;
}

.toolbar {
  height: 100rpx;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  border-bottom: 2rpx solid #eee;
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

.subject-filter {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.question-list-sidebar {
  width: 300rpx;
  border-right: 2rpx solid #eee;
  background-color: #ffffff;
}

.function-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.nav-tabs {
  display: flex;
  background-color: #ffffff;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #eee;
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  opacity: 0.5;
}

.nav-tab.active {
  opacity: 1;
}

.nav-tab.disabled {
  opacity: 0.2;
}

.tab-icon {
  width: 48rpx;
  height: 48rpx;
}

.tab-label {
  font-size: 24rpx;
}

.function-content {
  flex: 1;
  padding: 24rpx;
  overflow-y: auto;
}

.view-placeholder, .empty-function {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 28rpx;
}

.fab-btn {
  position: fixed;
  right: 32rpx;
  bottom: 120rpx;
  background-color: #6e55ff;
  color: #ffffff;
  padding: 16rpx 32rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(110, 85, 255, 0.3);
  z-index: 100;
}

@media (max-width: 600rpx) {
  .question-list-sidebar {
    position: fixed;
    left: 0;
    top: 100rpx;
    bottom: 0;
    z-index: 99;
    width: 80%;
    box-shadow: 8rpx 0 24rpx rgba(0, 0, 0, 0.1);
  }
}
</style>
