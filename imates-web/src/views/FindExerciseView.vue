<template>
  <div class="find-exercise-view">
    <!-- 内部工具栏 -->
    <div class="internal-toolbar">
      <!-- 返回按钮 -->
      <q-btn 
        flat 
        round 
        dense 
        icon="arrow_back" 
        @click="goBack" 
        class="q-mr-sm toolbar-back-btn"
        :loading="isExiting"
        :disable="isExiting"
      />
      
      <div class="toolbar-title">
        <span>我的习题</span>
      </div>
      
      <q-space />
      
      <!-- 选中状态显示 -->
      <div class="selection-info" v-if="hasSelectableQuestions">
        <span class="selection-count">
          已选{{ selectedCount }}/{{ selectableCount }}
        </span>
      </div>
      
      <!-- 全选复选框 -->
      <div class="select-all-container" v-if="hasSelectableQuestions">
        <q-checkbox
          :model-value="isAllSelected"
          @update:model-value="handleToggleSelectAll"
          label="全选"
          color="primary"
          size="md"
          class="select-all-checkbox"
        />
      </div>
      
      <!-- 开始练习按钮 -->
      <q-btn
        unelevated
        rounded
        :label="'开始练习'"
        :color="hasSelectedQuestions ? 'orange' : 'grey-5'"
        :disable="!hasSelectedQuestions"
        :loading="isStarting"
        @click="handleStartExercise"
        class="start-practice-btn"
        no-caps
      />
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 初始化加载状态 - 使用骨架屏 -->
      <div v-if="isInitializing" class="initialization-loading">
        <QuestionListSkeleton animation-speed="slow" :skeleton-count="10" :columns="2" />
      </div>
      
      <!-- 题目列表 -->
      <div v-else class="question-list-container">
        <q-card flat class="full-height">
          <q-card-section class="q-pa-none full-height">
            <FindExerciseQuestionList 
              ref="questionListRef"
              @refresh="handleRefresh"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFindExerciseStore } from '../stores/findExerciseStore'
import { useQuestionStore } from '../stores/questionStore'
import { storeToRefs } from 'pinia'
import FindExerciseQuestionList from '../components/FindExerciseQuestionList.vue'
import QuestionListSkeleton from '../components/QuestionListSkeleton.vue'
import type { FindExerciseConfig } from '../types'
import { Subject } from '../types'
import { getScopedStorageValue } from '../services'
import { on } from 'events'

// 定义组件名称，便于 Vue DevTools 识别
defineOptions({
  name: 'FindExerciseView'
})

const router = useRouter()
const route = useRoute()

// 组件引用
const questionListRef = ref<InstanceType<typeof FindExerciseQuestionList> | null>(null)

// 使用store
const findExerciseStore = useFindExerciseStore()
const questionStore = useQuestionStore()
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
const handleToggleSelectAll = (value?: boolean) => {
  // 如果传入了值，说明是复选框的update事件
  if (value !== undefined) {
    const shouldSelect = value
    const isCurrentlyAllSelected = isAllSelected.value
    
    // 只有当状态需要改变时才执行
    if (shouldSelect && !isCurrentlyAllSelected) {
      findExerciseStore.toggleSelectAll()
    } else if (!shouldSelect && isCurrentlyAllSelected) {
      findExerciseStore.toggleSelectAll()
    }
  } else {
    // 直接调用切换方法
    findExerciseStore.toggleSelectAll()
  }
}

/**
 * 处理开始练习按钮点击
 * 先添加选中的题目到练习列表，然后跳转到 ExerciseSolveWebViewActivity
 */
const handleStartExercise = async () => {
  if (!hasSelectedQuestions.value) return
  
  try {
    isStarting.value = true
    // 获取所有选中的题目ID（包括手动选中的和已收藏的）
    const manuallySelectedIds = selectedQuestionIds.value.filter(id => id)
    const favoritedIds = similarQuestions.value
      .filter(q => q.atUserList)
      .map(q => q.bmNo)
      .filter(id => id)
    const allSelectedIds = [...new Set([...manuallySelectedIds, ...favoritedIds])]
    // 检查是否有手动选中的题目需要添加
    const hasManuallySelected = manuallySelectedIds.length > 0
    const hasFavoritedOnly = favoritedIds.length > 0 && !hasManuallySelected
    
    let success = true
    
    // 只有当有手动选中的题目时才需要调用API添加
    if (hasManuallySelected) {
      success = await findExerciseStore.addSelectedQuestionsToList()
      
      if (!success) {
        console.error('[FindExerciseView] 添加题目失败，无法开始练习')
        return
      }
      
      // 添加成功后，刷新questionStore的题目列表，确保新添加的题目显示
      // 第1步：获取科目名称
      const subjectName = findExerciseStore.config?.subject === Subject.SUBJECT_MATH ? 'math' : 'biology'
      // 第2步：强制从服务器刷新题目列表，不使用本地缓存
      await questionStore.fetchQuestions(subjectName, false)
      
      // 验证刷新后的题目列表
      const refreshedQuestions = questionStore.questions
      // 检查新添加的题目是否在列表中
      const addedQuestionsFound = manuallySelectedIds.filter(id => 
        refreshedQuestions.some(q => q.bmNo === id || q.id === id)
      )
      if (addedQuestionsFound.length < manuallySelectedIds.length) {
        console.warn('[FindExerciseView] 警告：部分题目可能未成功添加到列表')
      }
    } else if (hasFavoritedOnly) {
    }
    
    if (success) {
      // 跳转到练习页面，传递所有选中的题目ID（包括手动选中的和已收藏的）
      router.push({
        path: '/exercise-solve',
        query: {
          questionIds: allSelectedIds.join(','),
          subject: findExerciseStore.config?.subject || Subject.SUBJECT_MATH,
          token: findExerciseStore.config?.token || ''
        }
      })
    }
  } catch (error) {
    console.error('[FindExerciseView] 开始练习时发生错误:', error)
  } finally {
    isStarting.value = false
  }
}


const goBack = async () => {
  if (isExiting.value) return
  
  isExiting.value = true
  
  try {
   
    // 使用路由返回到知识图谱页面
    router.push({ name: 'knowledgeGraph' })
  } finally {
    isExiting.value = false
  }
}

// 初始化
onMounted(async () => {
  try {
    // 从Vue Router的query参数获取配置
    const config: FindExerciseConfig = {
      apiBaseURL: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
      subject: (route.query.subject as string) === 'SUBJECT_BIOLOGY' ? Subject.SUBJECT_BIOLOGY : Subject.SUBJECT_MATH,
      token: (route.query.token as string) || getScopedStorageValue('token') || '',
      knowledgeList: (route.query.knowledgeList as string) || '',
      bmNoList: (route.query.bmNoList as string) || ''
    }
    // 初始化store和获取数据
    await findExerciseStore.initializeStore(config)
    await findExerciseStore.fetchQuestionList()
  } catch (error) {
    console.error('初始化失败:', error)
  } finally {
    // 无论成功还是失败，都结束初始化状态
    isInitializing.value = false
  }
})

onUnmounted(() => {
  // 清理状态
  findExerciseStore.resetState()
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
  background: #0f002e; // 深紫色背景
  border-bottom: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 1;
  
  // 确保所有按钮图标为白色
  .toolbar-back-btn {
    color: white;
    
    :deep(.q-icon) {
      color: white !important;
    }
  }
}

.toolbar-title {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: white; // 白色文字，匹配图片样式
  margin-left: 400px;
}

.selection-info {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: white; // 白色文字，匹配图片样式
  margin-right: 12px;
}

.selection-count {
  font-weight: 500;
  color: white; // 白色文字，匹配图片样式
}

.select-all-container {
  display: flex;
  align-items: center;
  margin-right: 12px;
}

.select-all-checkbox {
  font-size: 14px;
  font-weight: 500;
  
  :deep(.q-checkbox__label) {
    font-size: 14px;
    font-weight: 500;
    color: white; // 白色文字，匹配图片样式
  }
  
  // 复选框在深色背景下的样式
  :deep(.q-checkbox__bg) {
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  :deep(.q-checkbox__bg--active) {
    background-color: white;
    border-color: white;
  }
  
  :deep(.q-checkbox__check) {
    color: #667eea; // 选中时，对勾使用深紫色
  }
}

.start-practice-btn {
  font-size: 14px;
  font-weight: 500;
  padding: 8px 16px;
  min-width: auto;
  
  &.bg-orange {
    background-color: #ff7d40 !important;
    color: white !important;
  }
  
  // 确保橙色按钮在深色背景上正确显示
  &.bg-orange-5,
  &[color="orange"] {
    background-color: #ff7d40 !important;
    color: white !important;
  }
  
  // 禁用状态的灰色按钮
  &.bg-grey-5 {
    background-color: rgba(255, 255, 255, 0.3) !important;
    color: rgba(255, 255, 255, 0.6) !important;
  }
}

.main-content {
  flex: 1;
  min-height: 0;
  padding: 8px;
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
  
    .toolbar-back-btn {
    :deep(.q-icon) {
      color: white !important; // 确保返回按钮图标为白色
    }
  }
  
  .selection-info {
    font-size: 12px;
    margin-right: 8px;
  }
  
  .selection-count {
    font-size: 12px;
  }
  
  .select-all-container {
    margin-right: 8px;
  }
  
  .select-all-checkbox {
    font-size: 12px;
    
    :deep(.q-checkbox__label) {
      font-size: 12px;
    }
  }
  
  .start-practice-btn {
    font-size: 12px;
    padding: 6px 12px;
  }
}
</style>
