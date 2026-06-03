<template>
  <view class="my-homework-view">
    <view class="title-section">
      <text class="title-text">作业查看</text>
    </view>
    
    <view class="header-filters">
      <view class="filter-item">
        <text class="filter-label">日期：</text>
        <DatePicker v-model="selectedDate" placeholder="请选择日期" />
      </view>
      <view class="filter-item">
        <text class="filter-label">学科：</text>
        <Select
          v-model="selectedSubject"
          :options="subjects"
          placeholder="请选择学科"
        />
      </view>
    </view>

    <view class="content-area">
      <RubberBandList
        ref="rubberBandListRef"
        class="homework-list-wrapper"
        :enable-refresh="true"
        :enable-load-more="hasMore"
        :loading="loading"
        @refresh="handleRefresh"
        @load-more="handleLoadMore"
      >
        <!-- 空状态提示 -->
        <view v-if="!loading && homeworkList.length === 0" class="empty-state">
          <image src="/static/icons/homework_deep.svg" mode="aspectFit" class="empty-icon" />
          <text class="empty-text">暂无作业</text>
          <text class="empty-desc">当前日期和学科条件下没有找到作业</text>
        </view>

        <!-- 作业列表 -->
        <view v-else class="homework-list">
          <view v-for="item in displayHomeworkList" :key="item.id" class="homework-card">
            <view class="card-main">
              <view class="card-left">
                <text class="card-title">{{ item.name }}</text>
                <view class="card-tags">
                  <Tag
                    v-for="tag in item.tags"
                    :key="tag"
                    :text="tag"
                    type="gray"
                    variant="text"
                    size="sm"
                  />
                </view>
                <view class="card-meta">
                  <text class="meta-score">{{ item.scoreText }}</text>
                  <text
                    v-if="item.timeLeftText"
                    class="meta-deadline"
                    :class="{ 'is-expired': item.isExpired }"
                  >
                    {{ item.timeLeftText }}
                  </text>
                  <text v-if="item.rangeText" class="meta-range">{{ item.rangeText }}</text>
                </view>
              </view>

              <view class="card-right">
                <Tag
                  :text="item.statusText"
                  :type="item.statusTagType"
                  size="sm"
                  dot
                />
                <Button
                  :label="item.buttonText"
                  size="mdCompact"
                  :variant="item.buttonVariant === 'expired' ? 'ghost' : 'primary'"
                  :disabled="item.buttonDisabled"
                  @click="goAnswer(item)"
                />
              </view>
            </view>
            <view v-if="item.remark" class="card-footer">
              <text class="homework-remark">{{ item.remark }}</text>
            </view>
          </view>
        </view>
        <view v-if="!hasMore && !loading && homeworkList.length > 0" class="list-end">没有更多了</view>
      </RubberBandList>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useHomeworkStore } from '../stores/homeworkStore'
import { apiService } from '../services'
import type { HomeworkUndoItem, HomeworkQuestionDetail, ExerciseItem } from '../types'
import { SUBJECT_ID_TO_NAME, HOMEWORK_SUBJECT_OPTIONS } from '../constants/subjects'
import { 
  getHomeworkStatusText, 
  getHomeworkStatusType, 
  getHomeworkStatusTagType, 
  getHomeworkTagText, 
  getHomeworkButtonVariant 
} from '../constants/homework'
import Button from '../components/base/Button.vue'
import DatePicker from '../components/base/DatePicker.vue'
import Select from '../components/base/Select.vue'
import RubberBandList from '../components/base/VirtualScroll.vue'
import Tag from '../components/base/Tag.vue'

defineOptions({
  name: 'MyHomeworkView',
})

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)
const subjects = HOMEWORK_SUBJECT_OPTIONS
const selectedSubject = ref('')

const homeworkList = ref<HomeworkUndoItem[]>([])
const loading = ref(false)
const pageNumber = ref(0)
const pageSize = ref(20)
const hasMore = ref(true)
const rubberBandListRef = ref(null)

const homeworkStore = useHomeworkStore()

const fetchHomeworkList = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const queryReq = {
      pageNumber: pageNumber.value,
      pageSize: pageSize.value,
      subject: selectedSubject.value || undefined,
      date: selectedDate.value || undefined,
    }
    const result = await homeworkStore.fetchHomeworkList(queryReq)
    if (pageNumber.value === 0) {
      homeworkList.value = result
    } else {
      homeworkList.value = [...homeworkList.value, ...result]
    }
    hasMore.value = result.length >= pageSize.value
  } catch (error) {
    console.error('[MyHomeworkView] 获取作业列表异常:', error)
    if (pageNumber.value === 0) homeworkList.value = []
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

const handleRefresh = async () => {
  pageNumber.value = 0
  hasMore.value = true
  await fetchHomeworkList()
  if (rubberBandListRef.value) {
    (rubberBandListRef.value as any).finishRefresh()
  }
}

const handleLoadMore = async () => {
  if (!loading.value && hasMore.value) {
    pageNumber.value++
    await fetchHomeworkList()
  }
}

const displayHomeworkList = computed(() => {
  return homeworkList.value.map((homework: HomeworkUndoItem) => {
    const statusText = getHomeworkStatusText(homework.status, homework.deadline)
    const statusType = getHomeworkStatusType(homework.status)
    const statusTagType = getHomeworkStatusTagType(statusType, homework.deadline)

    const tags: string[] = []
    if (homework.subject) {
      const subjectName = (SUBJECT_ID_TO_NAME as any)[homework.subject] || homework.subject
      tags.push(subjectName)
    }
    if (homework.fullSubmit === '1') tags.push(getHomeworkTagText('fullSubmit'))
    if (homework.lateSubmit === '1') tags.push(getHomeworkTagText('lateSubmit'))
    if (homework.resubmit === '1') tags.push(getHomeworkTagText('resubmit'))

    const releaseText = homework.releaseTime ? formatDate(homework.releaseTime) : ''
    const deadlineText = homework.deadline ? formatDate(homework.deadline) : ''
    const rangeText = (releaseText && deadlineText) ? `${releaseText}-${deadlineText}` : (releaseText || deadlineText)
    const scoreText = homework.totalScore ? `总分：${homework.totalScore}分` : '总分：--'

    const deadlineMs = homework.deadline ? new Date(homework.deadline).getTime() : NaN
    const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= Date.now() : false
    const timeLeftText = getTimeLeftText(homework.deadline)

    return {
      id: homework.id,
      name: homework.title,
      tags: tags,
      statusText,
      statusTagType: statusTagType as 'green' | 'purple' | 'gray',
      scoreText,
      timeLeftText,
      isExpired,
      rangeText,
      buttonText: '去查看',
      buttonVariant: getHomeworkButtonVariant(false),
      buttonDisabled: false,
      remark: homework.remark || '',
      homework: homework,
    }
  })
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toISOString().slice(0, 10).replace(/-/g, '/')
}

const getTimeLeftText = (deadline?: string) => {
  if (!deadline) return ''
  const deadlineMs = new Date(deadline).getTime()
  if (!Number.isFinite(deadlineMs)) return ''
  const diff = deadlineMs - Date.now()
  if (diff <= 0) return '已截止'

  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  if (hours > 0) parts.push(`${hours}小时`)
  if (parts.length === 0) parts.push(`${Math.max(1, minutes)}分钟`)
  return `还剩${parts.join('')}截止`
}

watch([selectedDate, selectedSubject], () => {
  pageNumber.value = 0
  hasMore.value = true
  fetchHomeworkList()
})

onMounted(() => {
  fetchHomeworkList()
})

const goAnswer = async (item: any) => {
  try {
    const questionDetails = await apiService.getHomeworkDetailList(item.id)
    if (questionDetails && questionDetails.length > 0) {
      // 简化版的转换逻辑，实际可能需要 mapHomeworkQuestionToExercise
      const exerciseItems: ExerciseItem[] = questionDetails.map((q: any) => ({
        id: q.questionId,
        bmNo: q.questionId,
        question: q.questionContent,
        answer: q.questionAnswer,
        type: 'essay' // 默认类型
      }))

      homeworkStore.setQuestions(exerciseItems)
      homeworkStore.setCurrentHomeworkInfo(item.homework)
      homeworkStore.setHomeworkName(item.homework.title)
      homeworkStore.setResubmitType(item.homework.resubmit || '0')

      ;(uni as any).navigateTo({
        url: `/pages/homework/answer?homeworkId=${item.id}&scene=homework`
      })
    } else {
      (uni as any).showToast({ title: '作业题目为空', icon: 'none' })
    }
  } catch (error) {
    (uni as any).showToast({ title: '获取作业详情失败', icon: 'none' })
  }
}
</script>

<style scoped>
.my-homework-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f1f3ff;
}

.title-section {
  background-color: #ffffff;
  padding: 40rpx 32rpx 20rpx;
  text-align: center;
}

.title-text {
  font-size: 40rpx;
  font-weight: 600;
  color: #111827;
}

.header-filters {
  background-color: #ffffff;
  display: flex;
  padding: 0 32rpx 40rpx;
  gap: 40rpx;
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.filter-label {
  font-size: 28rpx;
  color: #4b5563;
  white-space: nowrap;
}

.content-area {
  flex: 1;
  overflow: hidden;
  padding: 24rpx;
}

.homework-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.homework-card {
  background-color: #ffffff;
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 8rpx 24rpx rgba(99, 102, 241, 0.08);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.card-left {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
  display: block;
  margin-bottom: 16rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.meta-deadline {
  color: #ef4444;
}

.meta-deadline.is-expired {
  color: #6b7280;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  flex-shrink: 0;
}

.card-footer {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid #f3f4f6;
}

.homework-remark {
  font-size: 24rpx;
  color: #696675;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-end {
  text-align: center;
  padding: 32rpx 0;
  color: #9ca3af;
  font-size: 24rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  width: 128rpx;
  height: 128rpx;
  margin-bottom: 32rpx;
  opacity: 0.5;
}

.empty-text {
  font-size: 32rpx;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 28rpx;
  color: #9ca3af;
}
</style>
