<template>
  <div class="question-list">
    <!-- 搜索栏和工具栏 -->
    <div class="search-container q-pa-md">
      <div class="search-toolbar">
        <q-input
          v-model="searchQuery"
          placeholder="搜索题目..."
          outlined
          dense
          clearable
          @input="onSearchInput"
          class="search-input"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>

        <!-- 定位到当前题目按钮 -->
        <q-btn
          icon="my_location"
          color="primary"
          outline
          round
          @click="() => scrollToCurrentQuestion()"
          :disable="selectedQuestionIndex < 0"
          class="locate-current-btn"
        >
          <q-tooltip>定位到当前题目</q-tooltip>
        </q-btn>

        <!-- 拍照搜题按钮 -->
        <q-btn
          icon="camera_alt"
          color="primary"
          outline
          round
          @click="throttledStartPhotoSearch"
          class="photo-search-btn"
        >
          <q-tooltip>拍照搜题</q-tooltip>
        </q-btn>

        <!-- 调试模式切换按钮 - 生产环境隐藏 -->
        <q-btn
          v-if="false"
          icon="bug_report"
          color="orange"
          outline
          round
          @click="debugMode = !debugMode"
          class="debug-toggle-btn"
        >
          <q-tooltip>切换调试模式</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- 题目列表 - 卡片布局 -->
    <div class="question-cards-container q-pa-md">
      <!-- 加载状态 -->
      <div v-if="loading" class="native-loading-container">
        <q-spinner-dots size="50px" color="primary" />
        <div class="text-h6 q-mt-md native-text-xl">正在加载题目列表...</div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredQuestions.length === 0" class="native-empty-state">
        <q-icon name="quiz" size="80px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7 native-text-3xl">
          {{ searchQuery ? '未找到匹配的题目' : '暂无题目' }}
        </div>
        <q-btn
          v-if="!searchQuery"
          color="primary"
          outline
          class="q-mt-md native-btn"
          @click="throttledLoadQuestions"
        >
          重新加载
        </q-btn>
      </div>

      <!-- 题目卡片列表 - 使用虚拟滚动优化性能 -->
      <div v-else class="question-cards-container">
        <VirtualQuestionList
          :questions="searchQuery ? filteredQuestions : questions"
          :selected-question-index="searchQuery ? -1 : selectedQuestionIndex"
          :search-query="searchQuery"
          @question-selected="handleQuestionSelected"
          @start-ai-guidance="handleStartAiGuidance"
          @move-to-top="moveQuestionToTop"
        />
      </div>
    </div>

    <!-- 聊天测试面板 - 生产环境隐藏 -->
    <ChatTestPanel v-if="false" />

    <!-- 调试控制面板 - 生产环境隐藏 -->
    <div v-if="false" class="debug-panel q-mt-md">
      <q-card flat bordered class="q-pa-md">
        <div class="text-h6 q-mb-md">调试控制面板</div>
        
        <div class="row q-gutter-md q-mb-md">
          <q-toggle
            v-model="useMockData"
            label="使用假数据"
            @update:model-value="onMockDataToggle"
            color="primary"
          />
          
          <q-input
            v-model.number="mockDataCount"
            type="number"
            label="假数据数量"
            min="1"
            max="100"
            style="width: 150px"
            dense
          />
        </div>
        
        <div class="row q-gutter-sm">
          <q-btn
            color="primary"
            outline
            size="sm"
            @click="loadMockData"
            class="debug-toggle-btn"
          >
            加载数学假数据
          </q-btn>
          
          <q-btn
            color="secondary"
            outline
            size="sm"
            @click="loadSpecialQuestions"
            class="debug-toggle-btn"
          >
            加载特殊字符题目
          </q-btn>
          
          <q-btn
            color="negative"
            outline
            size="sm"
            @click="clearQuestions"
            class="debug-toggle-btn"
          >
            清空题目
          </q-btn>
        </div>
      </q-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { useQuasar } from 'quasar'
import { showMessage, ThrottleUtils } from '../utils'
import { useExerciseStore } from '../stores/exerciseStore'
import type { ExerciseItem } from '../types'
import { MathJaxUtils } from '../utils/mathjax'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import { apiService } from '../services/api-service'
import { androidBridge } from '../services/android-bridge'
import VirtualQuestionList from './VirtualQuestionList.vue'
import ChatTestPanel from './ChatTestPanel.vue'
import { generateMathQuestions, generateBiologyQuestions, generateSpecialCharacterQuestions } from '../utils/mockDataGenerator'

const $q = useQuasar()
const emit = defineEmits<{
  startAiGuidance: [question: ExerciseItem]
  questionSelected: [question: ExerciseItem, index: number]
}>()

// 响应式数据
const questions = ref<ExerciseItem[]>([])
const selectedSubject = ref('math')
const selectedQuestionIndex = ref(-1)
const loading = ref(false)
const deletingIds = ref(new Set<string>())
const contentRefs = ref<Map<string, HTMLElement>>(new Map())

// 搜索相关
const searchQuery = ref('')
const searchTimeout = ref<number | null>(null)

// 假数据相关
const debugMode = ref(false)
const mockDataCount = ref(10)
const useMockData = ref(false)


// 计算属性
const filteredQuestions = computed(() => {
  if (!searchQuery.value?.trim()) {
    return questions.value
  }

  const query = searchQuery.value.toLowerCase().trim()
  return questions.value.filter(
    (question) =>
      (question.title && question.title.toLowerCase().includes(query)) ||
      (question.question && question.question.toLowerCase().includes(query)),
  )
})

// 工具方法


// 使用与 ChatBubble 相同的渲染器
const { renderMessageContent } = useMessageRenderer()

// 设置内容引用，使用懒加载优化MathJax渲染
const renderedQuestions = new Set<string>()
const setContentRef = (el: HTMLElement | null, questionId: string) => {
  if (el && el instanceof HTMLElement) {
    contentRefs.value.set(questionId, el)
    // 只在首次渲染时处理MathJax，使用懒加载避免阻塞主线程
    if (!renderedQuestions.has(questionId)) {
      renderedQuestions.add(questionId)
      nextTick(() => {
        // 使用懒加载模式，只有当元素进入视口时才渲染
        MathJaxUtils.renderMath(el, true)
      })
    }
  }
}

// 主要方法

// 处理题目选择事件（来自虚拟滚动组件）
const handleQuestionSelected = async (question: ExerciseItem, index: number) => {
  await selectQuestion(index)
}

// 处理AI指导事件（来自虚拟滚动组件）
const handleStartAiGuidance = (question: ExerciseItem) => {
  sendToAi(question)
}

// 创建节流版本的方法
const throttledStartPhotoSearch = ThrottleUtils.verySlow(() => {
  startPhotoSearch()
}) // 1秒节流，防止重复拍照

const throttledLoadQuestions = ThrottleUtils.verySlow(() => {
  loadQuestions()
}) // 1秒节流，防止重复加载

const loadQuestions = async () => {
  loading.value = true
  try {
    let convertedQuestions: ExerciseItem[] = []

    if (useMockData.value) {
      // 使用假数据
      switch (selectedSubject.value) {
        case 'math':
          convertedQuestions = generateMathQuestions(mockDataCount.value)
          break
        case 'biology':
          convertedQuestions = generateBiologyQuestions(mockDataCount.value)
          break
        default:
          convertedQuestions = generateMathQuestions(mockDataCount.value)
      }
    } else {
      // 使用API服务获取题目列表
      const questionList = await apiService.getExerciseList(selectedSubject.value)

      // 转换 API 响应的 ExerciseItem 类型到 store 的 ExerciseItem 类型
      convertedQuestions = questionList.map((q: unknown) => {
        const question = q as Record<string, unknown>
        return {
          id: (question.id as string) || (question.bmNo as string) || '',
          bmNo: (question.bmNo as string) || (question.id as string) || '',
          title: (question.title as string) || '',
          question: (question.content as string) || (question.question as string) || (question.title as string) || '',
          answer: (question.answer as string) || '',
          explanation: (question.explanation as string) || '',
          analysisData: (question.analysisData as string) || '',
          subject: (question.subject as string) || selectedSubject.value.toLowerCase(),
        }
      })
    }

    // 同步到全局 store，确保 selectQuestion 能够定位
    // store会自动进行去重处理
    const store = useExerciseStore()
    store.setQuestions(convertedQuestions)
    
    // 从store获取去重后的题目列表
    questions.value = [...store.questions]

    if (convertedQuestions.length > 0) {
      // 等待 DOM 更新，但不立即渲染所有数学公式
      // 改为懒加载模式，避免阻塞主线程
      await nextTick()
      // 只渲染前几个可见的题目，其余使用懒加载
      const visibleQuestions = document.querySelectorAll('.question-card')
      const firstFew = Array.from(visibleQuestions).slice(0, 3)
      firstFew.forEach(el => {
        if (el instanceof HTMLElement) {
          MathJaxUtils.renderMath(el, false) // 立即渲染前几个
        }
      })
    }
  } catch (error) {
    showMessage('加载题目失败: ' + (error as Error).message, 'error')
  } finally {
    loading.value = false
  }
}

// 刷新题目列表数据（不重新加载，保持当前状态）
const refreshQuestions = () => {
  // 从store同步最新的题目列表
  const store = useExerciseStore()
  questions.value = [...store.questions]
  
  // 保持当前选中的题目索引
  const currentIndex = store.currentQuestionIndex
  if (currentIndex >= 0 && currentIndex < questions.value.length) {
    selectedQuestionIndex.value = currentIndex
  }
  
}

const deleteQuestion = (questionId: string) => {
  try {
    $q.dialog({
      title: '删除题目',
      message: '确定要删除这道题目吗？删除后无法恢复。',
      persistent: true,
      class: 'gemini-delete-dialog',
      ok: {
        label: '删除',
        color: 'negative',
        unelevated: true,
        class: 'gemini-delete-btn'
      },
      cancel: {
        label: '取消',
        color: 'grey-7',
        flat: true,
        class: 'gemini-cancel-btn'
      }
    }).onOk(async () => {
      deletingIds.value.add(questionId)

      // 使用API服务删除题目
      const success = await apiService.deleteExercise(questionId, selectedSubject.value)

      if (success) {
        // 删除成功，从本地列表中移除
        questions.value = questions.value.filter((q) => q.id !== questionId)

        // 同步到 store
        const store = useExerciseStore()
        store.setQuestions(questions.value)
        
        // 从store获取最新的题目列表（确保数据一致性）
        questions.value = [...store.questions]

      } else {
        showMessage('删除题目失败', 'error')
      }

      deletingIds.value.delete(questionId)
    })
  } catch (error) {
    showMessage('删除题目失败: ' + (error as Error).message, 'error')
    deletingIds.value.delete(questionId)
  }
}


// 搜索相关方法
const onSearchInput = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }

  searchTimeout.value = window.setTimeout(() => {
    // 搜索逻辑已通过计算属性实现
  }, 300)
}


// 题目选择方法
const selectQuestion = async (index: number) => {
  if (index >= 0 && index < questions.value.length) {
    selectedQuestionIndex.value = index

    // 通知store更新当前选中的题目，这会自动加载历史记录但不开始AI指导
    const exerciseStore = useExerciseStore()
    await exerciseStore.selectQuestion(index)

    // 发出题目选择事件
    const question = questions.value[index]
    emit('questionSelected', question, index)

    // 题目选择成功，已加载历史记录，无需自动开始AI指导
  } else {
    // 选择题目失败，通过界面状态反馈
  }
}

// 定位到当前题目
const scrollToCurrentQuestion = (targetIndex?: number) => {
  const indexToScroll = targetIndex !== undefined ? targetIndex : selectedQuestionIndex.value
  
  if (indexToScroll < 0) {
    console.log('📍 [滚动] 没有指定的题目索引，跳过滚动')
    return
  }

  try {
    // 等待DOM更新
    nextTick(() => {
      const container = document.querySelector('.question-cards-container')
      if (!container) {
        console.log('📍 [滚动] 题目列表容器未找到，跳过滚动')
        return
      }

      // 检查题目列表是否可见
      const containerRect = container.getBoundingClientRect()
      const isVisible = containerRect.width > 0 && containerRect.height > 0
      
      if (!isVisible) {
        console.log('📍 [滚动] 题目列表不可见，跳过滚动')
        return
      }

      // 查找指定索引的题目卡片
      const questionCards = container.querySelectorAll('.question-card')
      const targetCard = questionCards[indexToScroll]
      
      if (targetCard) {
        console.log('📍 [滚动] 开始滚动到指定题目', {
          targetIndex: indexToScroll,
          totalCards: questionCards.length
        })
        
        // 滚动到指定题目卡片
        targetCard.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        })
        
        console.log('📍 [滚动] 滚动完成')
      } else {
        console.log('📍 [滚动] 未找到指定题目卡片，跳过滚动')
      }
    })
  } catch (error) {
    console.error('📍 [滚动] 滚动失败:', error)
  }
}

// 滚动到指定题目并设置为选中状态
const scrollToQuestionAndSelect = async (targetIndex: number) => {
  if (targetIndex < 0 || targetIndex >= questions.value.length) {
    console.log('📍 [滚动选择] 无效的题目索引，跳过操作')
    return
  }

  try {
    console.log('📍 [滚动选择] 开始滚动到题目并设置为选中状态', {
      targetIndex,
      totalQuestions: questions.value.length
    })

    // 先更新选中状态
    selectedQuestionIndex.value = targetIndex
    
    // 通知store更新当前选中的题目
    const exerciseStore = useExerciseStore()
    await exerciseStore.selectQuestion(targetIndex)

    // 等待DOM更新后滚动
    nextTick(() => {
      const container = document.querySelector('.question-cards-container')
      if (!container) {
        console.log('📍 [滚动选择] 题目列表容器未找到，跳过滚动')
        return
      }

      // 检查题目列表是否可见
      const containerRect = container.getBoundingClientRect()
      const isVisible = containerRect.width > 0 && containerRect.height > 0
      
      if (!isVisible) {
        console.log('📍 [滚动选择] 题目列表不可见，跳过滚动')
        return
      }

      // 查找指定索引的题目卡片
      const questionCards = container.querySelectorAll('.question-card')
      const targetCard = questionCards[targetIndex]
      
      if (targetCard) {
        console.log('📍 [滚动选择] 开始滚动到指定题目', {
          targetIndex,
          totalCards: questionCards.length
        })
        
        // 滚动到指定题目卡片
        targetCard.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        })
        
        console.log('📍 [滚动选择] 滚动和选择完成')
      } else {
        console.log('📍 [滚动选择] 未找到指定题目卡片，跳过滚动')
      }
    })
  } catch (error) {
    console.error('📍 [滚动选择] 操作失败:', error)
  }
}



// 题目置顶处理
const moveQuestionToTop = async (questionId: string) => {
  try {
    const currentIndex = questions.value.findIndex((q) => q.id === questionId)
    if (currentIndex <= 0) return // 已经在顶部或找不到题目

    // 直接在前端进行置顶操作
    const question = questions.value.splice(currentIndex, 1)[0]
    questions.value.unshift(question)

    // 更新选中状态
    if (selectedQuestionIndex.value === currentIndex) {
      selectedQuestionIndex.value = 0
    } else if (selectedQuestionIndex.value < currentIndex) {
      selectedQuestionIndex.value++
    }

    // 同步到store
    const exerciseStore = useExerciseStore()
    exerciseStore.setQuestions(questions.value)


    // 题目置顶后滚动到最顶部
    await nextTick()
    const container = document.querySelector('.question-cards-container')
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (error) {
    showMessage('置顶失败', 'error')
  }
}

// 拍照搜题
const startPhotoSearch = () => {
  try {
    const subjectName = selectedSubject.value

    if (androidBridge.isAndroidBridgeAvailable()) {
      // 在Android环境中调用原生拍照搜题
      androidBridge.takePicture(subjectName)
      showMessage('正在启动拍照搜题...', 'info')
    } else {
      // 在非Android环境中模拟拍照搜题
      showMessage('模拟拍照搜题...', 'info')

      // 模拟延迟后添加一个示例题目
      setTimeout(async () => {
        const mockQuestion: ExerciseItem = {
          id: 'photo_search_' + Date.now(),
          bmNo: 'PS' + Date.now(),
          title: '拍照搜题示例题目',
          question: '这是一道通过拍照搜题功能添加的示例题目。请解这个方程：2x + 3 = 7',
          answer: 'x = 2',
          explanation: '将方程两边同时减去3，得到2x = 4，然后两边同时除以2，得到x = 2。',
          analysisData: '将方程两边同时减去3，得到2x = 4，然后两边同时除以2，得到x = 2。',
          subject: subjectName,
        }

        // 尝试使用API服务添加题目
        const success = await apiService.addQuestionToList(mockQuestion, selectedSubject.value)

        if (success) {
          // 添加成功，重新加载列表
          await loadQuestions()
        } else {
          // API 添加失败，回退到本地添加
          questions.value.unshift(mockQuestion)

          // 同步到store
          const exerciseStore = useExerciseStore()
          exerciseStore.setQuestions(questions.value as any)

        }
      }, 2000)
    }
  } catch (error) {
    showMessage('启动拍照搜题失败', 'error')
  }
}

// 发送给AI
const sendToAi = async (question: ExerciseItem) => {
  try {
    const exerciseStore = useExerciseStore()

    // 关键修复：在store的questions数组中查找题目索引，而不是在本地questions数组中查找
    const storeIndex = exerciseStore.questions.findIndex((q) => q.id === question.id)
    if (storeIndex >= 0) {
      // 使用store中的索引来选择题目
      await exerciseStore.selectQuestion(storeIndex)
      
      // 等待题目选择完成后再启动AI指导
      // startAiGuidance会等待loadChatHistory完成，确保聊天记录正确加载
      await exerciseStore.startAiGuidance()
    } else {
      // 如果store中没有找到题目，说明数据不同步，需要重新同步
      showMessage('题目数据不同步，请重新加载', 'warning')
      return
    }

    // 发出事件通知父组件切换到AI聊天界面
    emit('startAiGuidance', question)

  } catch (error) {
    showMessage('发送给AI失败', 'error')
  }
}

// 假数据相关方法
const onMockDataToggle = () => {
  useMockData.value = !useMockData.value
  if (useMockData.value) {
    showMessage('已切换到假数据模式', 'info')
  } else {
    showMessage('已切换到真实数据模式', 'info')
  }
  loadQuestions()
}

const loadMockData = () => {
  useMockData.value = true
  loadQuestions()
}

const loadSpecialQuestions = () => {
  useMockData.value = true
  const specialQuestions = generateSpecialCharacterQuestions(5)
  const store = useExerciseStore()
  store.setQuestions(specialQuestions)
  questions.value = [...store.questions]
  showMessage('已加载特殊字符题目', 'info')
}

const clearQuestions = () => {
  questions.value = []
  const store = useExerciseStore()
  store.setQuestions([])
  showMessage('已清空题目列表', 'info')
}

// 生命周期
onMounted(() => {
  loadQuestions()
})

// 暴露方法给父组件
defineExpose({
  loadQuestions,
  selectQuestion,
  refreshQuestions,
  scrollToCurrentQuestion,
  scrollToQuestionAndSelect,
})
</script>

<style lang="scss" scoped>
// ===== 变量定义 - Gemini 风格 =====
$primary-color: #1a73e8;
$primary-color-light: rgba(26, 115, 232, 0.08);
$primary-color-hover: rgba(26, 115, 232, 0.04);
$border-color: rgba(0, 0, 0, 0.06);
$border-color-subtle: rgba(0, 0, 0, 0.03);
$background-white: #ffffff;
$background-light: #f8f9fa;
$background-grey: #f1f3f4;
$background-hover: rgba(0, 0, 0, 0.02);
$background-selected: rgba(26, 115, 232, 0.08);
$text-primary: #202124;
$text-secondary: #5f6368;
$text-tertiary: #9aa0a6;
$shadow-subtle: 0 1px 2px 0 rgba(60, 64, 67, 0.1);
$shadow-hover: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
$transition-smooth: all 0.15s cubic-bezier(0.4, 0.0, 0.2, 1);

// ===== 混合器定义 =====
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

@mixin button-base {
  border: none;
  border-radius: 16px;
  transition: $transition-smooth;
  cursor: pointer;
}

@mixin card-shadow($level: subtle) {
  @if $level == subtle {
    box-shadow: $shadow-subtle;
  } @else if $level == hover {
    box-shadow: $shadow-hover;
  } @else if $level == selected {
    box-shadow: 0 0 0 1px rgba(26, 115, 232, 0.2), $shadow-subtle;
  }
}

@mixin responsive-padding($mobile: 12px 16px, $tablet: 16px 20px) {
  padding: $tablet;
  
  @media (max-width: 768px) {
    padding: $mobile;
  }
}

// ===== 主容器样式 =====
.question-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: $background-light;

  // 搜索容器
  .search-container {
    background-color: $background-light;
    @include responsive-padding(12px 16px, 16px 20px);

    .search-toolbar {
      @include flex-center;
      gap: 12px;

      .search-input {
        flex: 1;
        
        :deep(.q-field__control) {
          border-radius: 24px;
          border: 1px solid $border-color;
          background-color: $background-light;
          transition: $transition-smooth;
          
          &:hover {
            border-color: rgba(26, 115, 232, 0.3);
            background-color: $background-white;
          }
          
          &.q-field--focused {
            border-color: $primary-color;
            background-color: $background-white;
            box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
          }
        }
        
        :deep(.q-field__native) {
          padding: 8px 16px;
          font-size: 14px;
        }
      }

      .locate-current-btn {
        @include button-base;
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 22px;
        background-color: $background-light;
        border: 1px solid $border-color;
        
        &:hover:not(:disabled) {
          background-color: $primary-color-hover;
          border-color: rgba(26, 115, 232, 0.2);
          @include card-shadow(hover);
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .photo-search-btn {
        @include button-base;
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 22px;
        background-color: $background-light;
        border: 1px solid $border-color;
        
        &:hover {
          background-color: $primary-color-hover;
          border-color: rgba(26, 115, 232, 0.2);
          @include card-shadow(hover);
        }
      }

      .debug-toggle-btn {
        @include button-base;
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 22px;
        background-color: $background-light;
        border: 1px solid $border-color;
        
        &:hover {
          background-color: rgba(255, 152, 0, 0.1);
          border-color: rgba(255, 152, 0, 0.3);
          @include card-shadow(hover);
        }
      }
    }
  }

  // 题目卡片容器
  .question-cards-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background-color: $background-light;

    .question-cards-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: min-content;
    }
  }

  // 题目卡片
  .question-card {
    cursor: pointer;
    overflow: visible;
    transform: translateZ(0);
    backface-visibility: hidden;
    border: none;
    border-radius: 16px;
    background-color: transparent;
    transition: $transition-smooth;
    box-shadow: none;
    padding: 4px;
    min-width: 0; // 允许卡片收缩以处理长内容

    &.question-deleting {
      opacity: 0.6;
      pointer-events: none;
    }

    // 高亮当前题目效果
    &.highlight-current {
      animation: highlight-pulse 2s ease-in-out;
      
      .question-block {
        border-color: $primary-color;
        box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2), $shadow-hover;
        background-color: rgba(26, 115, 232, 0.02);
      }
    }

    // 题目组块
    .question-block {
      background-color: $background-white;
      border-radius: 12px;
      overflow: visible; // 改为visible以允许长公式显示
      border: 1px solid $border-color;
      @include card-shadow(subtle);
      transition: border-color 0.2s ease;
      min-width: 0; // 允许组块收缩
    }

    // 悬停效果
    &:hover {
      .question-block {
        background-color: $background-white;
        border-radius: 12px;
        @include card-shadow(hover);
      }
    }

    // 选中状态
    &.question-selected {
      .question-block {
        border-color: $primary-color;
        border-radius: 12px;
        @include card-shadow(selected);
      }
    }
  }

  // 题目头部
  .question-header {
    @include flex-center;
    justify-content: space-between;
    background-color: transparent;
    border-bottom: none;
    @include responsive-padding(12px 16px, 16px 20px);

    .question-number {
      @include flex-center;
      width: 28px;
      height: 28px;
      background-color: $primary-color;
      color: white;
      border-radius: 14px;
      font-weight: 500;
      font-size: 13px;
      flex-shrink: 0;
      @include card-shadow(subtle);
    }


    .question-actions {
      @include flex-center;
      gap: 6px;
      flex-shrink: 0;
      height: 32px; // 固定高度，无论是否显示按钮

      .action-btn {
        @include button-base;
        background-color: transparent;
        width: 24px; // 减小图标大小
        height: 24px; // 减小图标大小
        border-radius: 12px;
        
        &:hover {
          background-color: $background-hover;
          @include card-shadow(subtle);
        }
        
        :deep(.q-btn__content) {
          font-size: 14px; // 减小图标字体大小
        }
      }
    }
  }


  // 题目内容区域
  .question-content-area {
    background-color: transparent;
    @include responsive-padding(12px 16px 16px 16px, 16px 20px 20px 20px);
    overflow-x: auto;
    overflow-y: hidden;
    min-width: 0; // 允许内容收缩
    
    // 内容区域滚动条样式
    &::-webkit-scrollbar {
      height: 4px;
    }
    
    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
      transition: background 0.2s ease;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.4);
    }
    
    // 确保内容区域可以处理长公式
    .question-content {
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      
      // 内容滚动条样式
      &::-webkit-scrollbar {
        height: 4px;
      }
      
      &::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 3px;
      }
      
      &::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
        transition: background 0.2s ease;
      }
      
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.4);
    }
  }
  }
}

// ===== Markdown 内容样式 =====
.markdown-content {
  font-size: 14px !important;
  line-height: 1.5;
  color: $text-primary;
  overflow-x: auto;
  overflow-y: hidden;
  word-wrap: break-word;
  word-break: break-word;
  
  // MathJax 公式样式处理
  :deep(.mjx-chtml),
  :deep(.mjx-math) {
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    display: inline-block;
    vertical-align: middle;
  }
  
  // 行内公式处理
  :deep(.mjx-chtml[display="inline"]) {
    max-width: 100%;
    overflow-x: auto;
    white-space: nowrap;
  }
  
  // 块级公式处理
  :deep(.mjx-chtml[display="block"]) {
    max-width: 100%;
    overflow-x: auto;
    margin: 8px 0;
    text-align: center;
  }
  
  // 公式容器滚动条样式
  :deep(.mjx-chtml)::-webkit-scrollbar {
    height: 3px;
  }
  
  :deep(.mjx-chtml)::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 2px;
  }
  
  :deep(.mjx-chtml)::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 2px;
  }
  
  :deep(.mjx-chtml)::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.5);
  }

  :deep(p) {
    margin: 0 0 8px 0;
    font-size: inherit;
    line-height: inherit;

    &:last-child {
      margin-bottom: 0;
    }

    + p {
      margin-top: 12px;
    }
  }

  :deep(br) {
    line-height: 1.5;
    display: block;
    margin: 4px 0;
  }

  :deep(strong) {
    font-weight: 500;
    color: $text-primary;
  }

  :deep(em) {
    font-style: italic;
    color: $text-secondary;
  }

  :deep(code) {
    background-color: $background-grey;
    padding: 3px 6px;
    border-radius: 6px;
    font-family: 'Google Sans Mono', 'Courier New', monospace;
    font-size: 0.9em;
    color: $text-primary;
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
    display: block;
    @include card-shadow(subtle);
  }

  :deep(blockquote) {
    border-left: 3px solid $primary-color;
    margin: 8px 0;
    padding-left: 12px;
    color: $text-secondary;
    background-color: $background-light;
    border-radius: 0 6px 6px 0;
    padding: 8px 12px;
  }

  :deep(ul),
  :deep(ol) {
    margin: 8px 0;
    padding-left: 20px;
  }

  :deep(li) {
    margin: 4px 0;
    color: $text-primary;
  }

  :deep(*) {
    word-wrap: break-word;
    word-break: break-word;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 12px 0 8px 0;
    font-weight: 500;
    color: $text-primary;
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
    border-radius: 8px;
    overflow: hidden;
    @include card-shadow(subtle);
  }

  :deep(th),
  :deep(td) {
    border: 1px solid $border-color;
    padding: 8px 12px;
    text-align: left;
  }

  :deep(th) {
    background-color: $background-grey;
    font-weight: 500;
    color: $text-primary;
  }
}

// ===== 其他样式 =====
// ===== 加载和空状态样式 =====
.native-loading-container,
.native-empty-state {
  @include flex-center;
  flex-direction: column;
  min-height: 240px;
  text-align: center;
  padding: 32px 20px;
  
  .text-h6 {
    color: $text-secondary;
    font-weight: 400;
    margin-top: 16px;
  }
  
  .q-btn {
    margin-top: 20px;
    border-radius: 20px;
    padding: 8px 24px;
    font-weight: 500;
    text-transform: none;
    @include card-shadow(subtle);
    
    &:hover {
      @include card-shadow(hover);
    }
  }
}

.debug-content {
  padding: 12px;
  background-color: $background-light;
  border-radius: 8px;
  margin-top: 12px;
  font-size: 12px;
  border-left: 3px solid #ff9800;
  color: $text-secondary;
  font-family: 'Google Sans Mono', 'Courier New', monospace;
}

.debug-panel {
  .debug-toggle-btn {
    @include button-base;
    border-radius: 8px;
    font-weight: 500;
    text-transform: none;
    
    &:hover {
      @include card-shadow(hover);
    }
  }
}

// ===== 响应式设计 =====
@media (max-width: 768px) {
  .question-list {
    .search-container {
      .search-toolbar {
        .photo-search-btn {
          width: 40px;
          height: 40px;
          border-radius: 20px;
        }
      }
    }

    .question-cards-container {
      .question-card {
        .question-header {
          .question-number {
            width: 24px;
            height: 24px;
            font-size: 12px;
            border-radius: 12px;
          }


          .question-actions {
            height: 28px; // 移动端固定高度
            
            .action-btn {
              width: 20px; // 移动端更小的图标
              height: 20px; // 移动端更小的图标
              border-radius: 10px;
              
              :deep(.q-btn__content) {
                font-size: 12px; // 移动端更小的字体
              }
            }
          }
        }

      }
    }
  }

  .markdown-content {
    font-size: 13px !important;
    overflow: visible;
  }
}

@media (max-width: 480px) {
  .question-list {
    .search-container {
      .search-toolbar {
        .photo-search-btn {
          width: 36px;
          height: 36px;
          border-radius: 18px;
        }
      }
    }

    .question-cards-container {
      .question-card {
        .question-header {
          .question-number {
            width: 22px;
            height: 22px;
            font-size: 11px;
            border-radius: 11px;
          }

          .question-actions {
            height: 24px; // 最小屏幕固定高度
            gap: 4px;

            .action-btn {
              width: 18px; // 最小屏幕更小的图标
              height: 18px; // 最小屏幕更小的图标
              border-radius: 9px;
              
              :deep(.q-btn__content) {
                font-size: 11px; // 最小屏幕更小的字体
              }
            }
          }
        }
      }
    }
  }
}

// ===== Gemini 风格对话框样式 =====
:deep(.gemini-delete-dialog) {
  .q-dialog__inner {
    padding: 24px;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
    background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
    border: 1px solid rgba(0, 0, 0, 0.06);
    max-width: 400px;
    width: 90vw;
    animation: gemini-dialog-enter 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  }

  .q-dialog__title {
    font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 20px;
    font-weight: 500;
    color: #202124;
    margin-bottom: 8px;
    line-height: 1.3;
  }

  .q-dialog__message {
    font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #5f6368;
    line-height: 1.5;
    margin-bottom: 24px;
  }

  .q-dialog__actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 0;
    padding-top: 0;
  }
}

// Gemini 风格按钮样式
:deep(.gemini-delete-btn) {
  font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  font-size: 14px;
  text-transform: none;
  letter-spacing: 0.25px;
  border-radius: 20px;
  padding: 10px 24px;
  min-width: 80px;
  height: 40px;
  background: linear-gradient(135deg, #ea4335 0%, #d33b2c 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(234, 67, 53, 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  
  &:hover {
    background: linear-gradient(135deg, #d33b2c 0%, #b52d20 100%);
    box-shadow: 0 4px 12px rgba(234, 67, 53, 0.4);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(234, 67, 53, 0.3);
  }
}

:deep(.gemini-cancel-btn) {
  font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  font-size: 14px;
  text-transform: none;
  letter-spacing: 0.25px;
  border-radius: 20px;
  padding: 10px 24px;
  min-width: 80px;
  height: 40px;
  color: #5f6368;
  background: transparent;
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  
  &:hover {
    background: rgba(95, 99, 104, 0.08);
    color: #202124;
  }
  
  &:active {
    background: rgba(95, 99, 104, 0.12);
  }
}

// 对话框进入动画
@keyframes gemini-dialog-enter {
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

// 高亮动画
@keyframes highlight-pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
  }
}
</style>

