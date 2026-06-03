<template>
  <view class="homework-answer-view">
    <!-- 顶部状态栏 -->
    <view class="status-bar"></view>
    
    <!-- 头部 -->
    <view class="header">
      <view class="header-left" @click="goBack">
        <image src="/static/icons/goback.svg" mode="aspectFit" class="back-icon" />
      </view>
      <text class="title">{{ displayTitle }}</text>
      <view class="header-right"></view>
    </view>

    <!-- 模式切换标签 -->
    <view class="mode-tabs">
      <view 
        class="mode-tab" 
        :class="{ active: activeMode === 'solve' }" 
        @click="activeMode = 'solve'"
      >
        <text>作答</text>
      </view>
      <view 
        class="mode-tab" 
        :class="{ active: activeMode === 'chat' }" 
        @click="activeMode = 'chat'"
      >
        <text>助教</text>
      </view>
    </view>

    <!-- 内容区 -->
    <view class="main-content">
      <!-- 作答区域 -->
      <view class="answer-container" v-show="activeMode === 'solve'">
        <!-- 题目列表（侧边栏或浮层） -->
        <view v-if="showQuestionList" class="question-list-sidebar">
          <QuestionList
            ref="questionListRef"
            type="homework"
            :external-questions="externalQuestions"
            :show-mistake-badge="false"
            @question-selected="handleStartAnswer"
          />
        </view>

        <!-- 作答主区 -->
        <view class="solve-area">
          <view v-if="currentAnswerQuestion" class="question-card">
            <view class="question-render">
              <ChoiceQuestion
                v-if="currentAnswerQuestion.type === 'single_choice' || currentAnswerQuestion.type === 'multiple_choice'"
                :question="currentAnswerQuestion"
                v-model="currentQuestionChooseList"
                :disabled="isHomeworkSubmitted"
                show-title
              />
              <JudgmentQuestion
                v-else-if="currentAnswerQuestion.type === 'true_false' || currentAnswerQuestion.type === 'judgment'"
                :question="currentAnswerQuestion"
                v-model="currentQuestionJudgment"
                :disabled="isHomeworkSubmitted"
                show-title
              />
              <FillBlankQuestion
                v-else-if="currentAnswerQuestion.type === 'fill_in_blank' || currentAnswerQuestion.type === 'fill'"
                :question="currentAnswerQuestion"
                v-model="currentQuestionFillList"
                :disabled="isHomeworkSubmitted"
                show-title
              />
              <CompositeQuestion
                v-else-if="currentAnswerQuestion.type === 'composite'"
                :question="currentAnswerQuestion"
                v-model="currentQuestionCompositeData"
                :disabled="isHomeworkSubmitted"
                show-title
              />
              <BaseQuestion
                v-else
                :question="currentAnswerQuestion"
                show-title
              />

              <!-- 提交后的解析 -->
              <view v-if="isHomeworkSubmitted" class="analysis-section">
                <view class="divider"></view>
                <view class="result-item">
                  <text class="label">参考答案：</text>
                  <rich-text class="content" :nodes="currentAnswerQuestion.answer"></rich-text>
                </view>
                <view class="result-item">
                  <text class="label">解析：</text>
                  <rich-text class="content" :nodes="currentAnswerQuestion.explanation"></rich-text>
                </view>
              </view>
            </view>

            <!-- 操作按钮 -->
            <view class="action-bar" v-if="!isHomeworkLocked">
              <Button
                :label="homeworkButtonText"
                variant="primary"
                size="md"
                @click="handleSubmit"
              />
            </view>
          </view>
          <view v-else class="empty-solve">
            <text>请选择题目开始作答</text>
          </view>
        </view>
      </view>

      <!-- 聊天区域 -->
      <view class="chat-container" v-show="activeMode === 'chat'">
        <HomeworkChatPanel
          :question="currentAnswerQuestion"
          @close="activeMode = 'solve'"
        />
      </view>
    </view>

    <!-- 悬浮按钮切换题目列表 -->
    <view class="fab-btn" v-if="activeMode === 'solve'" @click="showQuestionList = !showQuestionList">
      <text>{{ showQuestionList ? '收起列表' : '展开列表' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useHomeworkStore } from '../stores/homeworkStore'
import type { ExerciseItem } from '../types'
import QuestionList from '../components/question/QuestionList.vue'
import ChoiceQuestion from '../components/exercise/ChoiceQuestion.vue'
import JudgmentQuestion from '../components/exercise/JudgmentQuestion.vue'
import FillBlankQuestion from '../components/exercise/FillBlankQuestion.vue'
import CompositeQuestion from '../components/exercise/CompositeQuestion.vue'
import BaseQuestion from '../components/exercise/BaseQuestion.vue'
import HomeworkChatPanel from '../components/chat/chatpanel/HomeworkChatPanel.vue'
import Button from '../components/base/Button.vue'
import { getHomeworkButtonText } from '../constants/homework'

defineOptions({
  name: 'HomeworkAnswerView',
})

const homeworkStore = useHomeworkStore()
const showQuestionList = ref(true)
const isHomeworkSubmitted = ref(false)
const currentAnswerQuestion = ref<ExerciseItem | null>(null)
const questionListRef = ref(null)
const activeMode = ref<'solve' | 'chat'>('solve')

const externalQuestions = computed(() => homeworkStore.questions)
const homeworkName = computed(() => homeworkStore.homeworkName)
const currentHomeworkInfo = computed(() => homeworkStore.currentHomeworkInfo)
const answerDataCache = computed(() => homeworkStore.answerDataCache)

const displayTitle = computed(() => homeworkName.value || '作业作答')

const homeworkButtonText = computed(() => {
  if (isHomeworkSubmitted.value) return '已提交'
  if (!currentHomeworkInfo.value) return '提交作业'
  const info = currentHomeworkInfo.value
  const isExpired = info.deadline ? new Date(info.deadline).getTime() <= Date.now() : false
  const canLateSubmit = info.lateSubmit === '1'
  return getHomeworkButtonText(info.status, isExpired, canLateSubmit)
})

const isHomeworkLocked = computed(() => {
  if (isHomeworkSubmitted.value) return true
  if (!currentHomeworkInfo.value) return false
  const info = currentHomeworkInfo.value
  const isExpired = info.deadline ? new Date(info.deadline).getTime() <= Date.now() : false
  const canLateSubmit = info.lateSubmit === '1'
  const canResubmit = homeworkStore.resubmitType === '1'
  if (info.status === '3' && !canResubmit && !canLateSubmit) return true
  if (isExpired && !canLateSubmit && !canResubmit) return true
  return false
})

const currentQuestionChooseList = computed({
  get: () => {
    const key = currentAnswerQuestion.value?.id
    return key ? (answerDataCache.value as any)[key]?.chooseList || [] : []
  },
  set: (val: any) => {
    const key = currentAnswerQuestion.value?.id
    if (key) {
      if (!(answerDataCache.value as any)[key]) (answerDataCache.value as any)[key] = {}
      ;(answerDataCache.value as any)[key].chooseList = val
    }
  }
})

const currentQuestionJudgment = computed({
  get: () => {
    const key = currentAnswerQuestion.value?.id
    return key ? (answerDataCache.value as any)[key]?.judgmentValue || '' : ''
  },
  set: (val: any) => {
    const key = currentAnswerQuestion.value?.id
    if (key) {
      if (!(answerDataCache.value as any)[key]) (answerDataCache.value as any)[key] = {}
      ;(answerDataCache.value as any)[key].judgmentValue = val
    }
  }
})

const currentQuestionFillList = computed({
  get: () => {
    const key = currentAnswerQuestion.value?.id
    return key ? (answerDataCache.value as any)[key]?.fillList || [] : []
  },
  set: (val: any) => {
    const key = currentAnswerQuestion.value?.id
    if (key) {
      if (!(answerDataCache.value as any)[key]) (answerDataCache.value as any)[key] = {}
      ;(answerDataCache.value as any)[key].fillList = val
    }
  }
})

const currentQuestionCompositeData = computed({
  get: () => {
    const key = currentAnswerQuestion.value?.id
    return key ? (answerDataCache.value as any)[key]?.compositeData || {} : {}
  },
  set: (val: any) => {
    const key = currentAnswerQuestion.value?.id
    if (key) {
      if (!(answerDataCache.value as any)[key]) (answerDataCache.value as any)[key] = {}
      ;(answerDataCache.value as any)[key].compositeData = val
    }
  }
})

const handleStartAnswer = (question: ExerciseItem) => {
  currentAnswerQuestion.value = question
  if ((uni as any).getSystemInfoSync().windowWidth < 600) {
    showQuestionList.value = false
  }
}

const handleSubmit = async () => {
  (uni as any).showLoading({ title: '提交中...' })
  try {
    isHomeworkSubmitted.value = true
    (uni as any).showToast({ title: '提交成功', icon: 'success' })
  } catch (error) {
    (uni as any).showToast({ title: '提交失败', icon: 'none' })
  } finally {
    (uni as any).hideLoading()
  }
}

const goBack = () => {
  (uni as any).navigateBack()
}

onMounted(async () => {
  if (externalQuestions.value.length > 0) {
    currentAnswerQuestion.value = externalQuestions.value[0]
  }
})

onUnmounted(() => {
  homeworkStore.resetAnswerState()
})
</script>

<style scoped>
.homework-answer-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f7f6ff;
}

.status-bar {
  height: var(--status-bar-height);
  background-color: #0f002e;
}

.header {
  height: 100rpx;
  background-color: #0f002e;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  color: #fff;
}

.back-icon {
  width: 48rpx;
  height: 48rpx;
}

.title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
}

.header-right {
  width: 60rpx;
}

.mode-tabs {
  display: flex;
  background-color: #fff;
  border-bottom: 2rpx solid #eee;
  height: 88rpx;
}

.mode-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.mode-tab.active {
  color: #6e55ff;
  font-weight: 600;
}

.mode-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 4rpx;
  background-color: #6e55ff;
  border-radius: 2rpx;
}

.main-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.answer-container, .chat-container {
  width: 100%;
  height: 100%;
}

.answer-container {
  display: flex;
}

.question-list-sidebar {
  width: 300rpx;
  border-right: 2rpx solid #eee;
  background-color: #ffffff;
}

.solve-area {
  flex: 1;
  padding: 24rpx;
  overflow-y: auto;
}

.question-card {
  background-color: #ffffff;
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.analysis-section {
  margin-top: 40rpx;
  padding-top: 40rpx;
  border-top: 2rpx dashed #eee;
}

.result-item {
  margin-bottom: 24rpx;
}

.result-item .label {
  font-size: 28rpx;
  font-weight: 600;
  color: #615efe;
  display: block;
  margin-bottom: 8rpx;
}

.result-item .content {
  font-size: 28rpx;
  color: #333;
}

.action-bar {
  margin-top: 60rpx;
  display: flex;
  justify-content: center;
}

.empty-solve {
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
