<template>
  <view class="mistake-book-view">
    <!-- 主体布局 -->
    <view class="main-layout">
      <!-- 左侧：列表 -->
      <view class="layout-column left">
        <view class="column-header">
          <image src="/static/icons/mistakeLogo.svg" mode="aspectFit" class="mistake-logo" />
        </view>
        <view class="column-main left-sidebar-card">
          <QuestionList
            class="mistake-question-list"
            type="mistake"
            :external-questions="mistakeStore.questions"
            :show-mistake-badge="false"
            @refresh="mistakeStore.fetchMistakes"
            @question-selected="handleQuestionSelected"
          />
        </view>
      </view>

      <!-- 中间装订线 (简化版) -->
      <view class="layout-divider"></view>

      <!-- 右侧：内容 -->
      <view class="layout-column right">
        <view class="column-header">
          <view class="filter-tabs">
            <Select v-model="mistakeStore.filters.subject" :options="subjectOptions" class="filter-tab" />
            <Select v-model="mistakeStore.filters.source" :options="sourceOptions" class="filter-tab" />
          </view>
        </view>
        <view class="column-main right-content-card">
          <!-- 上部分：题目内容 -->
          <view class="question-section">
            <scroll-view scroll-y class="question-body">
              <!-- A. 客观题 -->
              <template v-if="['single_choice', 'multiple_choice', 'true_false', 'judgment'].includes(currentQuestionData?.type || '')">
                <view v-if="currentQuestionData?.structuredContent" class="structured-question-container">
                  <ChoiceQuestion
                    v-if="currentQuestionData.type === 'single_choice' || currentQuestionData.type === 'multiple_choice'"
                    :question="currentQuestionData"
                    :model-value="currentQuestionChooseList"
                    :disabled="true"
                    show-title
                    :show-id="false"
                  >
                    <template #extra>
                      <view class="mistake-source-info">
                        <text class="source-tag" v-if="latestRecord?.homeworkId">来源于{{ latestRecord.homeworkName || '作业' }}</text>
                        <text class="source-tag" v-else>来源于独立练习</text>
                      </view>
                    </template>
                  </ChoiceQuestion>
                  <JudgmentQuestion
                    v-else
                    :question="currentQuestionData"
                    :model-value="currentQuestionJudgment"
                    :disabled="true"
                    show-title
                    :show-id="false"
                  >
                    <template #extra>
                      <view class="mistake-source-info">
                        <text class="source-tag" v-if="latestRecord?.homeworkId">来源于{{ latestRecord.homeworkName || '作业' }}</text>
                        <text class="source-tag" v-else>来源于独立练习</text>
                      </view>
                    </template>
                  </JudgmentQuestion>
                </view>
                <view v-else class="question-text">
                  <rich-text :nodes="currentQuestionData?.question || currentQuestionData?.title || ''"></rich-text>
                </view>
              </template>

              <!-- B. 填空题 -->
              <template v-else-if="['fill_in_blank', 'fill'].includes(currentQuestionData?.type || '')">
                <view v-if="currentQuestionData?.structuredContent" class="structured-question-container">
                  <FillBlankQuestion
                    :question="currentQuestionData"
                    :model-value="currentQuestionFillList"
                    :disabled="true"
                    show-title
                    :show-id="false"
                  >
                    <template #extra>
                      <view class="mistake-source-info">
                        <text class="source-tag" v-if="latestRecord?.homeworkId">来源于{{ latestRecord.homeworkName || '作业' }}</text>
                        <text class="source-tag" v-else>来源于独立练习</text>
                      </view>
                    </template>
                  </FillBlankQuestion>
                </view>
                <view v-else class="question-text">
                  <rich-text :nodes="currentQuestionData?.question || currentQuestionData?.title || ''"></rich-text>
                </view>
              </template>

              <!-- C. 主观题 -->
              <template v-else>
                <view class="question-text">
                  <rich-text :nodes="currentQuestionData?.question || currentQuestionData?.title || ''"></rich-text>
                </view>
              </template>
            </scroll-view>
          </view>

          <!-- 分隔线 -->
          <view class="section-divider"></view>

          <!-- 下部分：答案解析 -->
          <view class="answer-section" :class="{ 'is-expanded': showAnalysis }">
            <view class="answer-header-row">
              <view class="interaction-tabs">
                <view 
                  class="tab-item" 
                  :class="{ active: showAnalysis }"
                  @click="showAnalysis = !showAnalysis"
                >
                  <text>查看答案</text>
                  <view class="tab-indicator" v-if="showAnalysis"></view>
                </view>
              </view>

              <view class="header-actions">
                <Button
                  variant="ghost"
                  class="btn-remove"
                  label="移除"
                  @click="confirmDelete(currentMistake)"
                />
                <Button
                  variant="primary"
                  class="btn-add"
                  label="添加到习题"
                  @click="addToExerciseList(currentMistake)"
                />
              </view>
            </view>

            <!-- 答案/解析展示区 -->
            <scroll-view v-show="showAnalysis" scroll-y class="answer-display">
              <view class="explanation-content">
                <view v-if="currentMistake?.questionData?.answer" class="standard-answer-section">
                  <view class="section-title">标准答案</view>
                  <rich-text class="answer-text" :nodes="currentMistake.questionData.answer"></rich-text>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
      </view>
    </view>

    <!-- 删除确认对话框 -->
    <Dialog
      ref="deleteDialogRef"
      title="删除确认"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="doDelete"
    >
      <text>确定要从错题本中移除这道题吗？</text>
    </Dialog>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useMistakeStore } from '../stores/mistakeStore'
import { apiService } from '../services'
import Dialog from '../components/base/Dialog.vue'
import Button from '../components/base/Button.vue'
import Select from '../components/base/Select.vue'
import QuestionList from '../components/question/QuestionList.vue'
import ChoiceQuestion from '../components/exercise/ChoiceQuestion.vue'
import FillBlankQuestion from '../components/exercise/FillBlankQuestion.vue'
import JudgmentQuestion from '../components/exercise/JudgmentQuestion.vue'
import type { MistakeItem } from '../services/storage/mistake-storage'
import { KNOWLEDGE_GRAPH_SUBJECT_OPTIONS } from '../constants/subjects'

defineOptions({
  name: 'MistakeBookView'
})

const mistakeStore = useMistakeStore()
const deleteDialogRef = ref(null)
const pendingDeleteItem = ref<MistakeItem | null>(null)
const showAnalysis = ref(false)

const currentMistake = computed(() => mistakeStore.currentMistake)

const currentQuestionData = computed(() => {
  const data = currentMistake.value?.questionData
  return data || null
})

const latestRecord = computed(() => currentMistake.value?.practiceHistory?.[0] || null)

const currentQuestionChooseList = computed(() => latestRecord.value?.originalAnswer?.chooseList || [])
const currentQuestionJudgment = computed(() => latestRecord.value?.originalAnswer?.judgmentValue || '')
const currentQuestionFillList = computed(() => latestRecord.value?.originalAnswer?.fillList || [])

watch(() => currentMistake.value, () => {
  showAnalysis.value = false
}, { immediate: true })

const subjectOptions = [
  { label: '全部学科', value: '全部学科' },
  ...KNOWLEDGE_GRAPH_SUBJECT_OPTIONS.map(opt => ({
    label: opt.label,
    value: opt.label
  }))
]

const sourceOptions = [
  { label: '全部来源', value: '全部来源' },
  { label: '随堂练习', value: '随堂练习' },
  { label: '课后作业', value: '课后作业' }
]

const handleQuestionSelected = (question: any, index: number) => {
  mistakeStore.selectMistake(index)
}

const addToExerciseList = async (item: MistakeItem | null) => {
  if (!item) return
  try {
    const subject = item.questionData.subject || 'math'
    const response = await apiService.addQuestionToList(item.questionData, subject)
    if (response.success) {
      uni.showToast({ title: '已成功加入习题列表', icon: 'success' })
    } else {
      uni.showToast({ title: '此题暂不支持加入习题集', icon: 'none' })
    }
  } catch (error) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

const confirmDelete = (item: MistakeItem | null) => {
  if (!item) return
  pendingDeleteItem.value = item
  if (deleteDialogRef.value) {
    (deleteDialogRef.value as any).open()
  }
}

const doDelete = async () => {
  if (pendingDeleteItem.value) {
    const index = mistakeStore.mistakes.findIndex(m => m.id === pendingDeleteItem.value?.id)
    if (index !== -1) {
      await mistakeStore.deleteMistake(index)
    }
  }
  if (deleteDialogRef.value) {
    (deleteDialogRef.value as any).close()
  }
}

onMounted(async () => {
  await mistakeStore.fetchMistakes()
})

onUnmounted(() => {
  mistakeStore.clearState()
})
</script>

<style scoped>
.mistake-book-view {
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #e9eaff 0%, #f2f3ff 50%, #f7f7f7 100%);
  display: flex;
  flex-direction: column;
}

.main-layout {
  flex: 1;
  display: flex;
  padding: 80rpx 24rpx 24rpx;
  overflow: hidden;
}

.layout-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.layout-column.left {
  width: 360rpx;
  margin-right: 12rpx;
}

.layout-column.right {
  flex: 1;
  min-width: 0;
}

.column-header {
  height: 80rpx;
  position: relative;
  margin-bottom: 24rpx;
}

.mistake-logo {
  width: 160rpx;
  height: 60rpx;
}

.filter-tabs {
  display: flex;
  gap: 16rpx;
  justify-content: flex-end;
}

.column-main {
  flex: 1;
  background: #ffffff;
  border-radius: 40rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 24rpx rgba(97, 94, 254, 0.1);
  display: flex;
  flex-direction: column;
}

.layout-divider {
  width: 40rpx;
  background-image: url('/static/icons/shuding.svg');
  background-repeat: repeat-y;
  background-size: 100% auto;
}

.question-section {
  flex: 1;
  padding: 32rpx;
  overflow: hidden;
}

.question-body {
  height: 100%;
}

.section-divider {
  height: 2rpx;
  background-color: #f0f2f7;
  margin: 0 32rpx;
}

.answer-section {
  padding: 32rpx;
  background-color: #ffffff;
}

.answer-section.is-expanded {
  flex: 1.2;
}

.answer-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.interaction-tabs {
  display: flex;
  gap: 32rpx;
}

.tab-item {
  position: relative;
  padding: 8rpx 0;
  font-size: 30rpx;
  color: #999;
}

.tab-item.active {
  color: #333;
  font-weight: bold;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 6rpx;
  background-color: #615efe;
  border-radius: 4rpx;
}

.header-actions {
  display: flex;
  gap: 16rpx;
}

.mistake-source-info {
  margin-top: 16rpx;
}

.source-tag {
  background-color: #f0f2ff;
  color: #615efe;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.answer-display {
  height: 300rpx;
  background-color: #fcfcff;
  border-radius: 24rpx;
  padding: 24rpx;
  border: 2rpx solid #f0f2ff;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #615efe;
  margin-bottom: 16rpx;
}

.answer-text {
  font-size: 28rpx;
  color: #374151;
  line-height: 1.6;
}
</style>
