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
            placeholder="请选择学科"
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
        <div class="homework-grid">
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
              <div class="card-date">{{ item.date }}</div>
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
import { apiService, type TopicPackageItem } from '@/services/api-service'
import { useHomeworkStore } from '@/stores/homeworkStore'
import type { ExerciseItem } from '@/types'
import CommonActionButton from '@/components/CommonActionButton.vue'
import CommonDatePicker from '@/components/CommonDatePicker.vue'
import CommonSelect from '@/components/CommonSelect.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import RubberBandList from '@/components/RubberBandList.vue'

defineOptions({
  name: 'MyHomeworkView',
})

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)

const subjects = [
  { label: '数学', value: 'math' },
  { label: '生物', value: 'biology' },
  { label: '物理', value: 'physics' },
  { label: '化学', value: 'chemistry' },
]

const selectedSubject = ref('math')

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
    const result = await apiService.getTopicPackagePage(pageNumber.value, pageSize.value)
    
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
    return {
      id: pkg.id || String(index + 1),
      name: pkg.name || `作业${index + 1}`,
      // 后端 tags 为字符串，这里拆分为数组，供界面展示使用
      tags: pkg.tags ? pkg.tags.split(/\s+/).filter(Boolean) : [],
      // 当前接口未提供明确日期字段，这里暂时使用当天日期，占位展示
      date: new Date().toISOString().slice(0, 10).replace(/-/g, '/'),
      // 预览内容：使用套餐中第一题的题干
      questionContent: firstTopic?.questionData || '',
      // 保留原始题目列表，供跳转答题时使用
      topics: pkg.topicList || [],
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

const goAnswer = (item: { id: string; name?: string; topics?: Array<{ id: string; questionData: string }> }) => {
  const payload = item.topics || []

  // 将题目列表存入 homeworkStore
  const exerciseItems: ExerciseItem[] = payload.map((topic) => ({
    id: topic.id,
    bmNo: topic.id, // 作业题目使用 id 作为 bmNo
    question: topic.questionData,
  } as ExerciseItem))
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
