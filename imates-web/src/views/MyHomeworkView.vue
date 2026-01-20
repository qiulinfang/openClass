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
          <CommonSelect
            v-model="selectedSubject"
            :options="subjects"
            placeholder="全部"
          />
        </div>
      </div>
    </div>

    <div class="content">
      <RubberBandList
        ref="rubberBandListRef"
        class="homework-list-wrapper"
        :enable-refresh="true"
        :enable-load-more="hasMore"
        :is-loading-more="loading"
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
            <div class="card-left">
              <div class="card-title-row">
                <div class="card-title">{{ item.name }}</div>
                <div class="card-tags">
                  <span v-for="tag in item.tags" :key="tag" class="card-tag">
                    {{ tag }}
                  </span>
                </div>
              </div>
              <div
                class="card-desc markdown-content"
                v-html="renderMessageContent(item.questionContent)"
                v-mathjax-preview="handleImagePreview"
              ></div>
            </div>
            <div class="card-right">
              <div class="card-date">{{ selectedDate }}</div>
              <CommonActionButton label="去作答" size="mdCompact"  @click="goAnswer(item)" />
            </div>
          </div>
        </div>
        <div v-if="!hasMore && !loading && homeworkList.length > 0" class="list-footer">没有更多了</div>
      </RubberBandList>
    </div>
    <ImageViewer v-model="showImagePreview" :image-url="previewImageUrl" alt="题目图片" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { apiService, type HomeworkQueryResp } from '@/services/http/api-service'
import { useHomeworkStore } from '@/stores/homeworkStore'
import type { ExerciseItem } from '@/types'
import CommonActionButton from '@/components/base/Button.vue'
import CommonDatePicker from '@/components/base/DatePicker.vue'
import CommonSelect from '@/components/base/Select.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import RubberBandList from '@/components/base/VirtualList.vue'
import homeworkDeepIcon from '/icons/homework_deep.svg'

defineOptions({
  name: 'MyHomeworkView',
})

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)

const subjects = [
  { label: '全部', value: '' },
  { label: '语文', value: '1' },
  { label: '数学', value: '2' },
  { label: '英语', value: '3' },
  { label: '物理', value: '4' },
  { label: '化学', value: '5' },
  { label: '生物', value: '6' },
  { label: '政治', value: '7' },
  { label: '历史', value: '8' },
  { label: '地理', value: '9' },
]

const selectedSubject = ref('')

const { renderMessageContent } = useMessageRenderer()
const showImagePreview = ref(false)
const previewImageUrl = ref('')

// 作业列表数据
const homeworkList = ref<HomeworkQueryResp[]>([])
const loading = ref(false)
const pageNumber = ref(1)

// RubberBandList 组件引用
const rubberBandListRef = ref<InstanceType<typeof RubberBandList> | null>(null)
const pageSize = ref(20)
const hasMore = ref(true)

// 获取作业列表
const fetchHomeworkList = async (reset = false) => {
  if (loading.value && !reset) return
  if (!reset && !hasMore.value) return

  if (reset) {
    pageNumber.value = 1
    homeworkList.value = []
    hasMore.value = true
  }

  loading.value = true
  try {
    const queryReq = {
      pageNumber: pageNumber.value,
      pageSize: pageSize.value,
      subject: selectedSubject.value || undefined,
      // 如果需要按日期筛选，可以添加时间范围
      // createTimeStart: selectedDate.value,
      // createTimeEnd: selectedDate.value,
    }

    const result = await apiService.homeworkPage(queryReq)

    if (result?.records) {
      const records = result.records
      if (reset) {
        homeworkList.value = records
      } else {
        homeworkList.value = [...homeworkList.value, ...records]
      }
      // 判断是否还有更多数据
      hasMore.value = records.length >= pageSize.value
      pageNumber.value++
    } else {
      hasMore.value = false
    }
  } catch (error) {
    console.error('[MyHomeworkView] 获取作业列表异常:', error)
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

// 下拉刷新（与 MyResourcesView 保持一致）
const handleRefresh = async () => {
  try {
    await fetchHomeworkList(true)
  } finally {
    // 通知 RubberBandList 刷新已完成，复位回弹效果
    rubberBandListRef.value?.finishRefresh()
  }
}

// 上拉加载更多
const handleLoadMore = async () => {
  if (!loading.value && hasMore.value) {
    await fetchHomeworkList(false)
  }
}

const displayHomeworkList = computed(() => {
  return homeworkList.value.map((homework, index) => {
    // 格式化为前端需要的显示格式
    return {
      id: homework.id,
      name: homework.name,
      // 暂时使用空标签，后续可以从作业详情中获取
      tags: [],
      // 使用创建时间作为日期显示
      date: homework.createTime ? new Date(homework.createTime).toISOString().slice(0, 10).replace(/-/g, '/') : selectedDate.value,
      // 预览内容暂时为空，后续可以通过作业详情API获取题目信息
      questionContent: `${homework.subject}作业 - 共${homework.questionCount || 0}题`,
      // 保留原始作业数据，供跳转答题时使用
      homework: homework,
    }
  })
})

const handleImagePreview = (url: string) => {
  previewImageUrl.value = url
  showImagePreview.value = true
}

onMounted(async () => {
  await fetchHomeworkList(true)
})

// 监听筛选条件变化，重新加载数据
watch(
  [selectedDate, selectedSubject],
  async () => {
    await fetchHomeworkList(true)
  },
  { immediate: false }
)

const router = useRouter()
const homeworkStore = useHomeworkStore()

// 这里 item 来自 displayHomeworkList 计算属性
const goAnswer = async (item: any) => {
  // 获取作业详情以获取题目列表
  try {
    const homeworkDetail = await apiService.homeworkInfo(item.id)

    if (homeworkDetail && homeworkDetail.questions) {
      // 将题目列表存入 homeworkStore
      const exerciseItems: ExerciseItem[] = homeworkDetail.questions.map((question: any, index: number) => {
        const bmNo = question.bmNo || question.id || String(index + 1)
        const rawQuestion = question.questionData || question.content || ''
        const questionText = rawQuestion.replace(/^[a-zA-Z0-9_]+(?:_of_[a-zA-Z0-9_]+)*:\s*/gm, '').replace(/^null\s*$/gm, '')

        const merged = {
          id: question.id,
          bmNo,
          question: questionText,
          answer: question.answer || '',
          explanation: question.explanation || question.analysisData || '',
          questionData: rawQuestion,
          subject: homeworkDetail.subject,
        }

        return merged as unknown as ExerciseItem
      })

      homeworkStore.setQuestions(exerciseItems)
      // 记录当前这份作业的名称，供 HomeworkAnswerView 使用
      homeworkStore.setHomeworkName(homeworkDetail.name)

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
      console.error('[MyHomeworkView] 获取作业详情失败或无题目数据:', homeworkDetail)
      // 可以显示错误提示给用户
    }
  } catch (error) {
    console.error('[MyHomeworkView] 获取作业详情异常:', error)
    // 可以显示错误提示给用户
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

.date-input,
.subject-select {
  min-width: 180px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 0 12px;
  font-size: 14px;
  color: #111827;
  outline: none;
}

.date-input:focus,
.subject-select:focus {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
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
  color: #9ca3af;
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
  color: #9ca3af;
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
  color: #9ca3af;
}

.homework-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.08);
  height: 131px;
  display: flex;
  align-items: stretch;
}

.card-left {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  width: 75%;
  position: relative;
}

.card-left::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 70px;
  pointer-events: none;
  background: linear-gradient(to top, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: #6b21a8;
  background: #f3e8ff;
}

.card-desc {
  /* 防止图片等内容撑破卡片 */
  overflow: auto;
}

.card-desc :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
  width: 25%;
  position: relative;
}

.card-date {
  font-size: 12px;
  color: #9ca3af;
  position: absolute;
  top: 0;
  right: 0;
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
