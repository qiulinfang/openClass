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
          <div v-for="item in homeworkList" :key="item.id" class="homework-card">
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
import { apiService, type TopicPackageItem } from '@/services/http/api-service'
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

// 习题列表数据
const topicList = ref<TopicPackageItem[]>([])
const loading = ref(false)
const pageNumber = ref(0)

// RubberBandList 组件引用
const rubberBandListRef = ref<InstanceType<typeof RubberBandList> | null>(null)
const pageSize = ref(20)
const hasMore = ref(true)

// 获取习题列表
const fetchTopicPackages = async (reset = false) => {
  if (loading.value && !reset) return
  if (!reset && !hasMore.value) return
  
  if (reset) {
    pageNumber.value = 1
    topicList.value = []
    hasMore.value = true
  }
  
  loading.value = true
  try {
    const result = await apiService.getTopicPackagePage(
      pageNumber.value,
      pageSize.value,
      selectedDate.value || undefined,
      selectedSubject.value || undefined,
    )
    
    if (result?.records) {
      const records = result.records
      if (reset) {
        topicList.value = records
      } else {
        topicList.value = [...topicList.value, ...records]
      }
      // 判断是否还有更多数据
      hasMore.value = records.length >= pageSize.value
      pageNumber.value++
    } else {
      hasMore.value = false
    }
  } catch (error) {
    console.error('[MyHomeworkView] 获取习题列表异常:', error)
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

// 下拉刷新（与 MyResourcesView 保持一致）
const handleRefresh = async () => {
  try {
    await fetchTopicPackages(true)
  } finally {
    // 通知 RubberBandList 刷新已完成，复位回弹效果
    rubberBandListRef.value?.finishRefresh()
  }
}

// 上拉加载更多
const handleLoadMore = async () => {
  if (!loading.value && hasMore.value) {
    await fetchTopicPackages(false)
  }
}

const homeworkList = computed(() => {
  return topicList.value.map((pkg, index) => {
    const firstTopic = pkg.topicList && pkg.topicList.length > 0 ? pkg.topicList[0] : null
    // 0. 去掉行首 key（main / c1 / gc1_of_c3 等）
    const cleanedQuestionContent = (firstTopic?.questionData || '')
        // 去掉每一行开头的 key:（支持 main: c1: c2: gc1_of_c3: 等格式）
        .replace(/^[a-zA-Z0-9_]+(?:_of_[a-zA-Z0-9_]+)*:\s*/gm, '')
        // 去掉只剩 null 的整行（可选，但强烈建议）
        .replace(/^null\s*$/gm, '')
    return {
      id: pkg.id || String(index + 1),
      bmNo: pkg.bmNo || String(index + 1),
      name: pkg.name || `作业${index + 1}`,
      // 后端 tags 为字符串，这里拆分为数组，供界面展示使用
      tags: pkg.tags ? pkg.tags.split(/\s+/).filter(Boolean) : [],
      // 日期：优先使用后端返回的更新时间字段 updateTime，若不存在则退回到当天日期占位
      date: pkg.updateTime || new Date().toISOString().slice(0, 10).replace(/-/g, '/'),
      // 预览内容：使用套餐中第一题的题干
      questionContent: cleanedQuestionContent,
      // 保留原始题目列表，供跳转答题时使用
      topics: pkg.topicList || [],
      answer: pkg.answer || '',
      explanation: pkg.explanation || '',
      questionData: pkg.questionData || '',
    }
  })
})

const handleImagePreview = (url: string) => {
  previewImageUrl.value = url
  showImagePreview.value = true
}

onMounted(async () => {
  await fetchTopicPackages(true)
})

// 监听筛选条件变化，重新加载数据
watch(
  [selectedDate, selectedSubject],
  async () => {
    await fetchTopicPackages(true)
  },
  { immediate: false }
)

const router = useRouter()
const homeworkStore = useHomeworkStore()

// 这里 item 来自 homeworkList 计算属性，结构较为宽松，使用 any 简化类型约束
const goAnswer = (item: any) => {
  const payload = item.topics || []

  // 将题目列表存入 homeworkStore
  const exerciseItems: ExerciseItem[] = payload.map((topic: any, index: number) => {
    const bmNo = topic.bmNo || item.bmNo || String(index + 1)
    const rawQuestion = topic.questionData || item.questionData || ''
    const question = rawQuestion.replace(/^[a-zA-Z0-9_]+(?:_of_[a-zA-Z0-9_]+)*:\s*/gm, '').replace(/^null\s*$/gm, '')
    // 优先使用 topic 自身的解析和答案，其次才退回到套餐级字段
    const answer = topic.answer || item.answer || ''
    const explanation =
      topic.explanation || topic.analysisData || item.explanation || ''
    const rawQuestionData = topic.questionData || item.questionData || ''
    const questionData = rawQuestionData.replace(/^[a-zA-Z0-9_]+(?:_of_[a-zA-Z0-9_]+)*:\s*/gm, '').replace(/^null\s*$/gm, '')

    // 先展开 item，把作业级字段全部带过去，再覆盖题目级别字段
    const merged = {
      ...item,
      id: topic.id,
      bmNo,
      question,
      answer,
      explanation,
      questionData,
    }

    // 通过 unknown 再断言为 ExerciseItem，避免 TS 结构不完全重合的告警
    return merged as unknown as ExerciseItem
  })
  homeworkStore.setQuestions(exerciseItems)
  // 记录当前这份作业的名称，供 HomeworkAnswerView 使用
  const name = item.name || ''
  homeworkStore.setHomeworkName(name)

  router.push({
    name: 'homeworkAnswer',
    params: {
      homeworkId: item.id,
    },
    query: {
      scene: 'homework',
    },
  })
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
    