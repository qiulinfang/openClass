<template>
  <q-layout view="lHh Lpr lFf">
    <!-- 顶部工具栏 -->
    <q-header elevated class="bg-white text-primary app-header" reveal>
      <q-toolbar class="app-toolbar">
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
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page class="find-exercise-page">
        <!-- 主要内容区域 -->
        <div class="main-content">
          <!-- 初始化加载状态 -->
          <div v-if="isInitializing" class="initialization-loading">
            <q-spinner-dots size="50px" color="primary" />
            <div class="text-h6 q-mt-md">正在初始化...</div>
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
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useFindExerciseStore } from '../stores/findExerciseStore'
import { storeToRefs } from 'pinia'
import QuestionList from '../components/FindExerciseQuestionList.vue'
import type { FindExerciseConfig } from '../types'
import { Subject } from '../types'

// 声明全局 Android 接口类型
declare global {
  interface Window {
    Android: {
      startExerciseSolve: () => void;
      startExerciseSolveWebView: () => void;
      finishActivity: () => void;
    };
  }
}

// 定义组件名称，便于 Vue DevTools 识别
defineOptions({
  name: 'FindExerciseView'
})

const router = useRouter()

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
    // 使用带加载状态的方法，避免显示空状态
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
      if (window.Android && window.Android.startExerciseSolveWebView) {
        window.Android.startExerciseSolveWebView()
      } else {
        console.warn('Android.startExerciseSolveWebView 不可用')
        // 备用方案：使用原有的 startExerciseSolve 方法
        if (window.Android && window.Android.startExerciseSolve) {
          window.Android.startExerciseSolve()
        }
      }
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
    
    // 调用 Android 原生方法关闭当前 Activity，返回到知识图谱页
    if (window.Android && window.Android.finishActivity) {
      window.Android.finishActivity()
    } else {
      // 备用方案：如果 Android 方法不可用，则使用路由返回
      console.warn('Android.finishActivity 不可用，使用路由返回')
      router.push('/')
    }
  } finally {
    isExiting.value = false
  }
}

// 初始化
onMounted(async () => {
  try {
    console.log('FindExerciseView 开始初始化...')
    
    // 等待Android配置注入
    await waitForAndroidConfig()
    
    // 检查Android配置
    let config: FindExerciseConfig
    
    if (window.AndroidConfig) {
      // 使用Android传递的配置
      console.log('使用Android配置:', window.AndroidConfig)
      config = {
        apiBaseURL: window.AndroidConfig.apiBaseURL || 'http://www.imates.com.cn:8222/blw-edu-service-alc',
        subject: window.AndroidConfig.subject || Subject.SUBJECT_MATH,
        token: window.AndroidConfig.token || '',
        knowledgeList: window.AndroidConfig.knowledgeList || ''
      }
    } else {
      // 从URL参数获取配置
      const urlParams = new URLSearchParams(window.location.search)
      console.log('使用URL参数配置')
      config = {
        apiBaseURL: 'http://www.imates.com.cn:8222/blw-edu-service-alc',
        subject: Subject.SUBJECT_MATH,
        token: localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '',
        knowledgeList: urlParams.get('knowledgeList') || ''
      }
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

// 等待Android配置注入
function waitForAndroidConfig(): Promise<void> {
  return new Promise((resolve) => {
    if (window.AndroidConfig) {
      resolve()
      return
    }
    
    // 监听配置注入
    const checkConfig = () => {
      if (window.AndroidConfig) {
        console.log('Android配置已注入')
        resolve()
      } else {
        setTimeout(checkConfig, 50)
      }
    }
    
    // 最多等待2秒
    setTimeout(() => {
      console.log('等待Android配置超时，使用默认配置')
      resolve()
    }, 2000)
    
    checkConfig()
  })
}

// 暴露方法给Android调用
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
.find-exercise-page {
  height: calc(100vh - #{$header-height});
  max-height: calc(100vh - #{$header-height});
  overflow: hidden;
  background: #f8f9fa;
}

.app-header {
  height: $header-height;
  min-height: $header-height;
  max-height: $header-height;
  border-bottom: 1px solid $border-color;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.app-toolbar {
  height: $header-height;
  min-height: $header-height;
  display: flex;
  align-items: center;
  padding: 0 16px;
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
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.question-list-container {
  flex: 1;
  min-height: 0;
}

.initialization-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  text-align: center;
  padding: 32px 20px;
  
  .text-h6 {
    color: #6b7280;
    font-weight: 400;
    margin-top: 16px;
  }
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
