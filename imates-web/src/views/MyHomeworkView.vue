<template>
  <div class="my-homework-view">
    <div class="title">作业查看</div>
    <div class="header">
      <div class="filters">
        <div class="filter-item">
          <span class="filter-label">日期：</span>
          <CommonDatePicker v-model="selectedDate" placeholder="请选择日期" />
        </div>
        <div class="filter-item">
          <span class="filter-label">学科：</span>
          <CommonSelect v-model="selectedSubject" :options="subjects" placeholder="请选择学科" />
        </div>
      </div>
      <!-- 调试按钮，dev 下才显示 -->
      <Button
        v-if="isDev"
        label="清空本地作业数据(Debug)"
        variant="secondary"
        size="mdCompact"
        style="border: 1.5px dashed #ff5b5b; color: #ff5b5b"
        @click="handleClearAllHomework"
      />
    </div>

    <div class="content">
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
        <div v-if="!loading && homeworkList.length === 0" class="empty-state">
          <img :src="homeworkDeepIcon" class="empty-icon" alt="作业图标" />
          <div class="empty-text">暂无作业</div>
          <div class="empty-desc">当前日期和学科条件下没有找到作业</div>
        </div>

        <!-- 作业列表 -->
        <div v-else class="homework-grid">
          <div v-for="item in displayHomeworkList" :key="item.id" class="homework-card">
            <div class="card-content">
              <div class="card-left">
                <div class="card-title">{{ item.name }}</div>

                <div class="card-tags">
                  <StatusTag
                    v-for="tag in item.tags"
                    :key="tag"
                    :text="tag"
                    type="gray"
                    variant="text"
                    size="sm"
                  />
                </div>

                <div class="card-meta">
                  <span class="meta-score">{{ item.scoreText }}</span>
                  <span
                    v-if="item.timeLeftText"
                    class="meta-deadline"
                    :class="{ 'is-expired': item.isExpired }"
                  >
                    {{ item.timeLeftText }}
                  </span>
                  <span v-if="item.rangeText" class="meta-range">{{ item.rangeText }}</span>
                </div>
              </div>

              <div class="card-right">
                <StatusTag :text="item.statusText" :type="item.statusTagType" size="sm" dot />
                <Button
                  :label="item.buttonText"
                  size="mdCompact"
                  :variant="item.buttonVariant"
                  :disabled="item.buttonDisabled"
                  @click="goAnswer(item)"
                />
              </div>
            </div>

            <div v-if="item.remark" class="card-footer">
              <div class="homework-remark">{{ item.remark }}</div>
            </div>
          </div>
        </div>
        <div v-if="!hasMore && !loading && homeworkList.length > 0" class="list-footer">
          没有更多了
        </div>
      </RubberBandList>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import type { HomeworkUndoItem, HomeworkQuestionDetail } from '@/types'
import type { ExerciseItem } from '@/types'
import {
  SUBJECT_ID_TO_NAME,
  HOMEWORK_SUBJECT_OPTIONS,
  normalizeSubject,
} from '@/constants/subjects'
import {
  getHomeworkStatusText,
  getHomeworkStatusType,
  getHomeworkStatusTagType,
  getHomeworkTagText,
  getHomeworkButtonText,
  getHomeworkButtonVariant,
} from '@/constants/homework'
import Button from '@/components/base/Button.vue'
import CommonDatePicker from '@/components/base/DatePicker.vue'
import CommonSelect from '@/components/base/Select.vue'
import RubberBandList from '@/components/base/VirtualScroll.vue'
import StatusTag from '@/components/base/Tag.vue'
import homeworkDeepIcon from '/icons/homework_deep.svg'

defineOptions({
  name: 'MyHomeworkView',
})

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)

const subjects = HOMEWORK_SUBJECT_OPTIONS

const selectedSubject = ref('')

// 作业列表数据
const homeworkList = ref<(HomeworkUndoItem & { isSubmitted?: boolean })[]>([])
const loading = ref(false)
const pageNumber = ref(1)

// 防抖定时器
const debounceTimer = ref<number | null>(null)

// RubberBandList 组件引用
const rubberBandListRef = ref<InstanceType<typeof RubberBandList> | null>(null)
const pageSize = ref(20)
const hasMore = ref(true)

// 获取作业列表
const fetchHomeworkList = async () => {
  if (loading.value) return

  loading.value = true
  try {
    // 构建查询参数
    const queryReq = {
      pageNumber: pageNumber.value,
      pageSize: pageSize.value,
      subject: selectedSubject.value || undefined,
      date: selectedDate.value || undefined,
    }

    // 使用 homeworkStore 的缓存方法
    const result = await homeworkStore.fetchHomeworkList(queryReq)

    // 异步查询每个作业在本地的实际提交状态
    const mappedResult = await Promise.all(
      result.map(async (item) => {
        const dbData = await homeworkStore.loadHomeworkSubmissionFromDB(item.id)
        return {
          ...item,
          isSubmitted: dbData ? dbData.isSubmitted : false,
        }
      }),
    )

    if (pageNumber.value === 1) {
      homeworkList.value = mappedResult
    } else {
      homeworkList.value = [...homeworkList.value, ...mappedResult]
    }
    // 判断是否还有更多数据
    hasMore.value = result.length >= pageSize.value
  } catch (error) {
    console.error('[MyHomeworkView] 获取作业列表异常:', error)
    homeworkList.value = pageNumber.value === 1 ? [] : homeworkList.value
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

// 下拉刷新
const handleRefresh = async () => {
  try {
    pageNumber.value = 1
    hasMore.value = true

    // 强制刷新，忽略缓存
    const queryReq = {
      pageNumber: pageNumber.value,
      pageSize: pageSize.value,
      subject: selectedSubject.value || undefined,
      date: selectedDate.value || undefined,
    }

    const result = await homeworkStore.fetchHomeworkList(queryReq, true)

    // 异步查询每个作业在本地的实际提交状态
    const mappedResult = await Promise.all(
      result.map(async (item) => {
        const dbData = await homeworkStore.loadHomeworkSubmissionFromDB(item.id)
        return {
          ...item,
          isSubmitted: dbData ? dbData.isSubmitted : false,
        }
      }),
    )

    homeworkList.value = mappedResult
    hasMore.value = result.length >= pageSize.value
  } catch (error) {
    console.error('[MyHomeworkView] ❌ 下拉刷新失败:', error)
  } finally {
    // 通知 RubberBandList 刷新已完成，复位回弹效果
    rubberBandListRef.value?.finishRefresh()
  }
}

// 上拉加载更多
const handleLoadMore = async () => {
  if (!loading.value && hasMore.value) {
    pageNumber.value++
    await fetchHomeworkList()
  }
}

// 优化后的计算属性，使用缓存减少重复计算
const displayHomeworkList = computed(() => {
  return homeworkList.value.map((homework: HomeworkUndoItem & { isSubmitted?: boolean }) => {
    const statusText = homework.isSubmitted
      ? '已提交'
      : getHomeworkStatusText(homework.status, homework.deadline)
    const statusType = getHomeworkStatusType(homework.status)
    const statusTagType = homework.isSubmitted
      ? 'green'
      : getHomeworkStatusTagType(statusType, homework.deadline)

    // 生成标签数组
    const tags = []
    if (homework.subject) {
      // 根据科目ID映射到中文名称
      const subjectName =
        SUBJECT_ID_TO_NAME[homework.subject as keyof typeof SUBJECT_ID_TO_NAME] || homework.subject
      tags.push(subjectName)
    }
    if (homework.fullSubmit === '1') tags.push(getHomeworkTagText('fullSubmit'))
    if (homework.lateSubmit === '1') tags.push(getHomeworkTagText('lateSubmit'))
    if (homework.resubmit === '1') tags.push(getHomeworkTagText('resubmit'))

    const releaseText = homework.releaseTime ? formatDate(homework.releaseTime) : ''
    const deadlineText = homework.deadline ? formatDate(homework.deadline) : ''
    const rangeText =
      releaseText && deadlineText ? `${releaseText}-${deadlineText}` : releaseText || deadlineText

    const scoreText = homework.totalScore ? `总分：${homework.totalScore}分` : '总分：--'

    const deadlineMs = homework.deadline ? new Date(homework.deadline).getTime() : NaN
    const nowMs = Date.now()
    const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= nowMs : false
    const timeLeftText = getTimeLeftText(homework.deadline)

    const canLateSubmit = homework.lateSubmit === '1'
    const buttonDisabled = false
    const buttonText = homework.isSubmitted ? '去查看' : '去作答'
    const buttonVariant: 'outline' | 'primary' = homework.isSubmitted ? 'outline' : 'primary'

    // 生成内容描述 - 优化日期格式化
    const contentParts = []
    if (homework.totalScore) contentParts.push(`总分：${homework.totalScore}分`)
    if (homework.releaseTime) {
      const releaseDate = formatDate(homework.releaseTime)
      contentParts.push(`发布时间：${releaseDate}`)
    }
    if (homework.deadline) {
      const deadlineDate = formatDate(homework.deadline)
      contentParts.push(`截止时间：${deadlineDate}`)
    }

    // 格式化为前端需要的显示格式
    return {
      id: homework.id, // 作业唯一标识
      name: homework.title, // 作业标题（显示名称）
      tags: tags, // 作业标签数组（学科、提交类型等）
      statusText, // 状态文本（已提交、未提交等）
      statusType, // 状态类型（用于样式判断）
      statusTagType: statusTagType as 'green' | 'purple' | 'gray', // 状态标签颜色类型
      scoreText, // 分数文本（总分：XX分）
      timeLeftText, // 剩余时间文本（还剩X天X小时截止）
      isExpired, // 是否已过期
      rangeText, // 时间范围文本（今天 或 发布-截止日期）
      buttonText, // 按钮文本（去作答、已提交等）
      buttonVariant, // 按钮样式变体
      buttonDisabled, // 按钮是否禁用
      date: homework.releaseTime ? formatDate(homework.releaseTime) : '暂无', // 发布日期（用于排序或显示）
      description: contentParts.join(' · '), // 作业描述（总分、发布时间、截止时间等组合）
      remark: homework.remark || '', // 作业备注（教师添加的额外说明）
      homework: homework, // 保留原始作业数据，供跳转答题时使用
    }
  })
})

// 日期格式化辅助函数
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }
  return date.toISOString().slice(0, 10).replace(/-/g, '/')
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

// 监听筛选条件变化，添加防抖优化
watch(
  [selectedDate, selectedSubject],
  () => {
    // 清除之前的防抖定时器
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }

    // 设置防抖，300ms后执行
    debounceTimer.value = window.setTimeout(async () => {
      pageNumber.value = 1
      hasMore.value = true
      await fetchHomeworkList()
      debounceTimer.value = null
    }, 300)
  },
  { immediate: false },
)

onMounted(async () => {
  pageNumber.value = 1
  hasMore.value = true
  await fetchHomeworkList()
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
    debounceTimer.value = null
  }
})

const router = useRouter()
const homeworkStore = useHomeworkStore()

const isDev = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true'

const handleClearAllHomework = async () => {
  try {
    await homeworkStore.clearAllHomeworkSubmissionsFromDB()
    homeworkStore.resetAnswerState()
    homeworkStore.clearHomeworkListCache()
    await handleRefresh()
    showMessage('成功清空本地所有作业信息及作答记录！', 'success')
  } catch (error) {
    console.error('清空作业信息失败:', error)
    showMessage('清空作业信息失败', 'error')
  }
}

import { mapHomeworkQuestionFromApi } from '@/services/boundary/homework'

// 这里 item 来自 displayHomeworkList 计算属性
const goAnswer = async (item: { id: string; homework: HomeworkUndoItem }) => {
  // 获取作业详情以获取题目列表
  try {
    const questionDetails = await apiService.getHomeworkDetailList(item.id)

    if (questionDetails && questionDetails.length > 0) {
      // 将题目列表存入 homeworkStore
      const exerciseItems: ExerciseItem[] = questionDetails.map(
        (question: HomeworkQuestionDetail, index: number) => {
          return mapHomeworkQuestionFromApi(question, index, item.homework.subject)
        },
      )

      // 尝试加载本地 IndexedDB 中的已有数据进行智能无损合并
      const existingSubmission = await homeworkStore.loadHomeworkSubmissionFromDB(item.id)

      homeworkStore.setQuestions(exerciseItems)
      // 记录当前这份作业的原始信息、名称 and 允许重复提交类型，供 HomeworkAnswerView 使用
      homeworkStore.setCurrentHomeworkInfo(item.homework)
      homeworkStore.setHomeworkName(item.homework.title)
      homeworkStore.setResubmitType(item.homework.resubmit || '0')

      // 用新获取的题目智能覆盖/合并到 IndexedDB，保留已有的作答记录
      await homeworkStore.updateQuestionsInDB(item.id)

      router.push({
        name: 'homeworkAnswer',
        params: {
          homeworkId: item.id,
        },
        query: {
          scene: 'homework',
        },
      })
    } else {
      console.error('[MyHomeworkView] 获取作业详情失败或无题目数据:', questionDetails)
      showMessage('作业题目为空，无法进入作答', 'warning')
      return
    }
  } catch (error) {
    console.error('[MyHomeworkView] 获取作业详情异常:', error)
    showMessage('获取作业详情失败，请稍后重试', 'error')
  }
}
</script>

<style scoped>
.my-homework-view {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 24px;
  min-height: 56px;
  background-color: #ffffff;
  padding: 20px;
}

.filters {
  display: flex;
  align-items: center;
  gap: 32px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-label {
  font-size: 14px;
  color: #4b5563;
  white-space: nowrap;
}

.title {
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  color: #111827;
  background-color: #ffffff;
  padding: 20px 20px 0 20px;
}

.content {
  flex: 1;
  overflow-y: auto;
  background-color: #f1f3ff;
  padding: 20px 20px 0 20px;
}

.homework-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
}

.list-footer {
  text-align: center;
  color: #696675;
  font-size: 12px;
  padding: 8px 0 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: #696675;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: #696675;
}

.homework-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.08);
  min-height: 124px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.card-left {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  line-height: 1.2;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  white-space: nowrap;
  overflow: hidden;
  font-size: 12px;
}

.meta-score {
  color: #6b7280;
}

.meta-deadline {
  color: #ef4444;
}

.meta-deadline.is-expired {
  color: #6b7280;
}

.meta-range {
  color: #696675;
  overflow: hidden;
  text-overflow: ellipsis;
}

.homework-remark {
  font-size: 12px;
  color: #696675;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
  display: flex;
  align-items: center;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 10px;
}

@media (max-width: 1024px) {
  .homework-grid {
    grid-template-columns: 1fr;
  }

  .title {
    padding-right: 0;
  }
}
</style>
