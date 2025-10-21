<template>
  <div class="find-exercise-view">
    <!-- 内部工具栏 -->
    <div class="internal-toolbar">
      <q-btn 
        flat 
        round 
        dense 
        icon="arrow_back" 
        @click="goBack" 
        class="q-mr-sm"
        :loading="isExiting"
        :disable="isExiting"
      />
      
      <div class="toolbar-title">
        <span>练习题</span>
      </div>
      
      <q-space />
      
      <!-- 选中状态显示 -->
      <div class="selection-info" v-if="hasSelectableQuestions">
        <span class="selection-count">
          已选择 {{ selectedCount }} / {{ selectableCount }} 题
        </span>
      </div>
      
      <q-space />
      
      <!-- 操作按钮 -->
      <div class="toolbar-actions">
        <!-- 全选/取消全选按钮 -->
        <q-btn
          v-if="hasSelectableQuestions"
          flat
          dense
          :icon="isAllSelected ? 'check_box' : 'check_box_outline_blank'"
          :label="isAllSelected ? '取消全选' : '全选'"
          :color="isAllSelected ? 'primary' : 'grey-6'"
          @click="handleToggleSelectAll"
          class="select-all-btn"
        />
        
        <!-- 开始练习按钮 -->
        <q-btn
          flat
          dense
          icon="play_arrow"
          :label="hasSelectedQuestions ? '开始练习' : '请先选择题目'"
          :color="hasSelectedQuestions ? 'positive' : 'grey-5'"
          :disable="!hasSelectedQuestions"
          :loading="isStarting"
          @click="handleStartExercise"
        />
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 初始化加载状态 - 使用骨架屏 -->
      <div v-if="isInitializing" class="initialization-loading">
        <QuestionListSkeleton animation-speed="slow" :skeleton-count="5" />
      </div>
      
      <!-- 题目列表 -->
      <div v-else class="question-list-container">
        <q-card flat class="full-height">
          <q-card-section class="q-pa-none full-height">
            <QuestionList 
              ref="questionListRef"
              @question-selected="handleQuestionSelected"
              @question-deselected="handleQuestionDeselected"
              @refresh="handleRefresh"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFindExerciseStore } from '../stores/findExerciseStore'
import { storeToRefs } from 'pinia'
import QuestionList from '../components/FindExerciseQuestionList.vue'
import QuestionListSkeleton from '../components/QuestionListSkeleton.vue'
import type { FindExerciseConfig } from '../types'
import { Subject } from '../types'

// 定义组件名称，便于 Vue DevTools 识别
defineOptions({
  name: 'FindExerciseView'
})

const router = useRouter()
const route = useRoute()

// 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)

// 使用store
const findExerciseStore = useFindExerciseStore()
const { 
  hasSelectedQuestions,
  similarQuestions,
  selectedQuestionIds
} = storeToRefs(findExerciseStore)

// 本地状态
const isExiting = ref(false)
const isStarting = ref(false)
const isInitializing = ref(true) // 添加初始化状态

// 计算属性
const selectableQuestions = computed(() => 
  similarQuestions.value.filter(q => !q.atUserList)
)

const hasSelectableQuestions = computed(() => 
  selectableQuestions.value.length > 0
)

const selectedCount = computed(() => {
  const manuallySelected = selectedQuestionIds.value.length
  const favorited = similarQuestions.value.filter(q => q.atUserList).length
  return manuallySelected + favorited
})

const selectableCount = computed(() => 
  similarQuestions.value.length // 总题目数量，包括已收藏的
)

const isAllSelected = computed(() => {
  if (selectableQuestions.value.length === 0) return false
  return selectableQuestions.value.every(q => selectedQuestionIds.value.includes(q.bmNo))
})

// 方法
const handleQuestionSelected = (questionId: string) => {
  console.log('题目已选中:', questionId)
}

const handleQuestionDeselected = (questionId: string) => {
  console.log('题目已取消选中:', questionId)
}

const handleRefresh = async () => {
  try {
    // 重置分页状态并重新加载
    findExerciseStore.resetPagination()
    await findExerciseStore.findSimilarQuestions()
  } catch (error) {
    console.error('刷新失败:', error)
  }
}

/**
 * 处理全选/取消全选
 */
const handleToggleSelectAll = () => {
  findExerciseStore.toggleSelectAll()
}

/**
 * 处理开始练习按钮点击
 * 先添加选中的题目到练习列表，然后跳转到 ExerciseSolveWebViewActivity
 */
const handleStartExercise = async () => {
  if (!hasSelectedQuestions.value) return
  
  try {
    isStarting.value = true
    console.log('开始练习 - 先添加题目，后跳转页面')
    
    // 检查是否有手动选中的题目需要添加
    const hasManuallySelected = selectedQuestionIds.value.length > 0
    const hasFavoritedOnly = similarQuestions.value.some(q => q.atUserList) && !hasManuallySelected
    
    let success = true
    
    // 只有当有手动选中的题目时才需要调用API添加
    if (hasManuallySelected) {
      console.log('有手动选中的题目，需要添加到练习列表')
      success = await findExerciseStore.addSelectedQuestionsToList()
      
      if (!success) {
        console.error('添加题目失败，无法开始练习')
        return
      }
    } else if (hasFavoritedOnly) {
      console.log('只有已收藏的题目，直接跳转到练习页面')
    }
    
    if (success) {
      console.log('准备跳转到练习页面')
      
      // 跳转到练习页面
      router.push({
        path: '/exercise-solve',
        query: {
          questionIds: selectedQuestionIds.value.join(','),
          subject: findExerciseStore.config?.subject || Subject.SUBJECT_MATH,
          token: findExerciseStore.config?.token || ''
        }
      })
    }
  } catch (error) {
    console.error('开始练习时发生错误:', error)
  } finally {
    isStarting.value = false
  }
}


const goBack = async () => {
  if (isExiting.value) return
  
  isExiting.value = true
  
  try {
    // 部分清理状态（保留选中状态，以便从练习页面返回时保持选择）
    findExerciseStore.partialResetState()
    
    // 使用路由返回到知识图谱页面
    router.push({ name: 'knowledgeGraph' })
  } finally {
    isExiting.value = false
  }
}

// 初始化
onMounted(async () => {
  try {
    console.log('FindExerciseView 开始初始化...')
    
    // 从Vue Router的query参数获取配置
    console.log('使用Vue Router query参数配置')
    const config: FindExerciseConfig = {
      apiBaseURL: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
      subject: (route.query.subject as string) === 'SUBJECT_BIOLOGY' ? Subject.SUBJECT_BIOLOGY : Subject.SUBJECT_MATH,
      token: (route.query.token as string) || localStorage.getItem('token') || '',
      knowledgeList: (route.query.knowledgeList as string) || ''
    }
    
    console.log('最终配置:', config)
    
    // 初始化store和获取数据
    await findExerciseStore.initializeStore(config)
    await findExerciseStore.fetchQuestionList()
    
    console.log('FindExerciseView 初始化完成')
  } catch (error) {
    console.error('初始化失败:', error)
  } finally {
    // 无论成功还是失败，都结束初始化状态
    isInitializing.value = false
  }
})

// 暴露方法给Web调用
defineExpose({
  refreshQuestions: handleRefresh,
  startExercise: handleStartExercise
})
</script>

<style lang="scss" scoped>
// 变量定义
$header-height: 56px;
$border-color: #e5e7eb;
$primary-color: #1976d2;

// 禁用页面缩放和选择
:deep(html), :deep(body) {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  touch-action: manipulation !important;
  -webkit-touch-callout: none !important;
  -webkit-text-size-adjust: none !important;
  -ms-text-size-adjust: none !important;
  text-size-adjust: none !important;
}

// 禁用所有元素的文本选择
:deep(*) {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  -webkit-touch-callout: none !important;
}

// 允许输入框和可编辑元素的选择
:deep(input), :deep(textarea), :deep([contenteditable]) {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
}

// 主要样式
.find-exercise-view {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
}

.internal-toolbar {
  height: $header-height;
  min-height: $header-height;
  max-height: $header-height;
  background: white;
  border-bottom: 1px solid $border-color;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 1;
}

.toolbar-title {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.selection-info {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #6b7280;
  margin-right: 16px;
}

.selection-count {
  font-weight: 500;
  color: #374151;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-all-btn {
  font-size: 14px;
  font-weight: 500;
  
  .q-btn__content {
    gap: 4px;
  }
}

.main-content {
  flex: 1;
  min-height: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.question-list-container {
  flex: 1;
  min-height: 0;
}

.initialization-loading {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.full-height {
  height: 100%;
}

// 响应式设计
@media (max-width: 768px) {
  .main-content {
    padding: 8px;
  }
  
  .toolbar-title {
    font-size: 16px;
  }
  
  .selection-info {
    font-size: 12px;
    margin-right: 8px;
  }
  
  .toolbar-actions {
    .q-btn {
      font-size: 12px;
      padding: 4px 8px;
    }
  }
  
  .select-all-btn {
    font-size: 12px;
    
    .q-btn__content {
      gap: 2px;
    }
  }
}
</style>
