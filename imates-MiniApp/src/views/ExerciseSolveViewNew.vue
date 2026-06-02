<template>
  <view class="exercise-solve-new">
    <!-- 顶部状态栏 -->
    <view class="status-bar"></view>
    
    <!-- 顶部导航 -->
    <view class="header">
      <view class="header-left" @click="goBack">
        <image src="/static/icons/goback.svg" mode="aspectFit" class="back-icon" />
      </view>
      <view class="header-center">
        <text class="title">习题精练</text>
      </view>
      <view class="header-right">
        <Select
          v-model="selectedSubjectFilter"
          :options="subjectOptions"
          class="subject-select"
        />
      </view>
    </view>

    <!-- 主要工作区 -->
    <view class="main-workspace">
      <!-- 模式切换标签 -->
      <view class="mode-tabs">
        <view 
          class="mode-tab" 
          :class="{ active: mode === 'left' }" 
          @click="mode = 'left'"
        >
          <text>题目</text>
        </view>
        <view 
          class="mode-tab" 
          :class="{ active: mode === 'center' }" 
          @click="mode = 'center'"
        >
          <text>草稿</text>
        </view>
        <view 
          class="mode-tab" 
          :class="{ active: mode === 'right' }" 
          @click="mode = 'right'"
        >
          <text>学伴</text>
        </view>
      </view>

      <view class="content-container">
        <!-- 题目列表/题目内容 -->
        <view class="view-section" v-show="mode === 'left'">
          <view class="question-list-wrapper" v-if="!currentQuestion">
            <QuestionList
              ref="questionListRef"
              type="exercise"
              @question-selected="handleQuestionSelected"
            />
          </view>
          <view class="question-detail-wrapper" v-else>
            <view class="question-header">
              <text class="question-title">{{ currentQuestion.title || '题目内容' }}</text>
              <view class="reset-btn" @click="resetQuestion">重选</view>
            </view>
            <scroll-view scroll-y class="question-body">
              <rich-text :nodes="questionHtml"></rich-text>
            </scroll-view>
          </view>
        </view>

        <!-- 草稿本 -->
        <view class="view-section" v-show="mode === 'center'">
          <DrawingBoardNew
            ref="draftBoardRef"
            @save="handleDraftSave"
            @clear="handleDraftClearClick"
          />
        </view>

        <!-- AI 聊天 -->
        <view class="view-section" v-show="mode === 'right'">
          <ExerciseChatPanelNew
            ref="exerciseChatPanelRef"
            :question="currentQuestion"
            @close="mode = 'left'"
            @request-screenshot="handleAskAiClick"
          />
        </view>
      </view>
    </view>

    <!-- 悬浮按钮 -->
    <FloatBubble @click="handleToggle">
      <image src="/static/icons/textbookip.png" mode="aspectFit" />
    </FloatBubble>

    <!-- 清空确认对话框 -->
    <Dialog
      ref="clearDraftDialogRef"
      title="清除确认"
      confirm-button-text="清除"
      cancel-button-text="取消"
      @confirm="confirmClearDraft"
    >
      确定要清空当前题目的草稿吗？
    </Dialog>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import QuestionList from '../components/question/QuestionList.vue'
import DrawingBoardNew from '../components/drawing/DrawingBoardNew.vue'
import ExerciseChatPanelNew from '../components/chat/chatpanel/ExerciseChatPanelNew.vue'
import Select from '../components/base/Select.vue'
import FloatBubble from '../components/base/Fab.vue'
import Dialog from '../components/base/Dialog.vue'
import { SUBJECT_OPTIONS } from '../constants/subjects.js'
import { useQuestionStore } from '../stores/questionStore.js'
import { storeToRefs } from 'pinia'

defineOptions({
  name: 'ExerciseSolveViewNew',
})

const questionStore = useQuestionStore()
const { currentQuestion } = storeToRefs(questionStore)
const mode = ref<'left' | 'center' | 'right'>('left')
const selectedSubjectFilter = ref('')
const subjectOptions = SUBJECT_OPTIONS
const questionHtml = ref('')

const questionListRef = ref(null)
const draftBoardRef = ref(null)
const exerciseChatPanelRef = ref(null)
const clearDraftDialogRef = ref(null)

const goBack = () => {
  uni.navigateBack()
}

const handleQuestionSelected = (question: any) => {
  questionHtml.value = question.question || question.title || ''
  mode.value = 'left'
}

const resetQuestion = () => {
  questionStore.clearCurrentQuestion()
}

const handleToggle = () => {
  if (mode.value === 'left') mode.value = 'right'
  else if (mode.value === 'right') mode.value = 'left'
}

const handleDraftSave = (data: any) => {
  // 保存草稿逻辑
}

const handleDraftClearClick = () => {
  clearDraftDialogRef.value?.openDialog()
}

const confirmClearDraft = () => {
  (draftBoardRef.value as any)?.clearAll()
  clearDraftDialogRef.value?.closeDialog()
}

const handleAskAiClick = () => {
  mode.value = 'center'
  uni.showToast({ title: '请在草稿本上划选截图区域', icon: 'none' })
}

onMounted(() => {
  if (currentQuestion.value) {
    questionHtml.value = currentQuestion.value.question || currentQuestion.value.title || ''
  }
})
</script>

<style scoped>
.exercise-solve-new {
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

.header-center {
  flex: 1;
  text-align: center;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
}

.header-right {
  width: 200rpx;
}

.main-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.content-container {
  flex: 1;
  position: relative;
}

.view-section {
  width: 100%;
  height: 100%;
}

.question-list-wrapper, .question-detail-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.question-header {
  padding: 24rpx 32rpx;
  background-color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2rpx solid #eee;
}

.question-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.reset-btn {
  font-size: 24rpx;
  color: #6e55ff;
}

.question-body {
  flex: 1;
  padding: 32rpx;
  background-color: #fff;
}
</style>
