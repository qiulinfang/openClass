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

      </div>
    </div>

    <!-- 题目列表 - 卡片布局 -->
    <div class="question-cards-container q-pa-md">
      <!-- 骨架屏加载状态 -->
      <QuestionListSkeleton v-if="loading" />

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

      <!-- 题目卡片列表 -->
      <div v-else class="question-cards-list">
        <div 
          v-for="(item, index) in (searchQuery ? filteredQuestions : questions)" 
          :key="item.id"
          class="question-item-wrapper"
        >
          <div 
            class="question-card"
            :class="{ 
              'question-selected': (searchQuery ? -1 : selectedQuestionIndex) === index,
              'question-deleting': deletingIds.has(item.id)
            }"
            @click="throttledHandleCardClick(item, index)"
          >
            <div class="question-block">
              <!-- 题目头部 -->
              <div class="question-header">
                <!-- 左侧：题目序号 -->
                <div class="question-number">{{ index + 1 }}</div>
                
                <!-- 右侧：功能区 -->
                <div class="question-actions">
                  <!-- 按钮组 - 只在选中时显示 -->
                  <div v-show="(searchQuery ? -1 : selectedQuestionIndex) === index">
                    <!-- 主要操作按钮 - 发送给AI -->
                    <q-btn
                      icon="smart_toy"
                      color="primary"
                      flat
                      round
                      size="sm"
                      @click.stop="throttledSendToAi(item)"
                      class="action-btn primary-action"
                    >
                      <q-tooltip>发送给AI</q-tooltip>
                    </q-btn>

                    <!-- 置顶按钮 -->
                    <q-btn
                      v-if="index > 0"
                      icon="vertical_align_top"
                      color="orange"
                      flat
                      round
                      size="sm"
                      @click.stop="throttledMoveToTop(item.id)"
                      class="action-btn"
                    >
                      <q-tooltip>置顶</q-tooltip>
                    </q-btn>

                    <q-btn
                      icon="delete"
                      color="negative"
                      flat
                      round
                      size="sm"
                      :loading="deletingIds.has(item.id)"
                      :disable="deletingIds.has(item.id)"
                      @click.stop="throttledDeleteQuestion(item.id)"
                      class="action-btn"
                    >
                      <q-tooltip>{{ deletingIds.has(item.id) ? '处理中...' : '删除题目' }}</q-tooltip>
                    </q-btn>
                  </div>
                </div>
              </div>

              <!-- 题目内容 -->
              <div class="question-content-area">
                <div
                  class="markdown-content question-content"
                  v-html="renderMessageContent(item.question || item.title || '暂无内容')"
                  :ref="(el) => setContentRef(el as HTMLElement | null, item.id)"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { showMessage, ThrottleUtils, throttle } from '../utils'
import { useQuestionStore } from '../stores/questionStore'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import type { ExerciseItem } from '../types'
import { apiService } from '../services/api-service'
import { androidBridge } from '../services/android-bridge'
import { MathJaxUtils } from '../utils/math/mathjax'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import QuestionListSkeleton from './QuestionListSkeleton.vue'

const emit = defineEmits<{
  startAiGuidance: [question: ExerciseItem]
  questionSelected: [question: ExerciseItem, index: number]
}>()

// 响应式数据
const questions = ref<ExerciseItem[]>([])
const selectedSubject = ref('math')
const selectedQuestionIndex = ref(-1)
const loading = ref(true)

// 搜索相关
const searchQuery = ref('')
const searchTimeout = ref<number | null>(null)

// 题目删除和渲染相关
const deletingIds = ref(new Set<string>())
const contentRefs = ref<Map<string, HTMLElement>>(new Map())
const renderedQuestions = new Set<string>()
const intersectionObservers = new Map<string, IntersectionObserver>()

// 使用与 ChatBubble 相同的渲染器
const { renderMessageContent } = useMessageRenderer()



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



// 主要方法

// 设置内容引用，使用 Intersection Observer 实现真正的视口懒加载
const setContentRef = (el: HTMLElement | null, questionId: string) => {
  if (el && el instanceof HTMLElement) {
    contentRefs.value.set(questionId, el)
    
    // 只在首次渲染时处理MathJax，使用 Intersection Observer 实现懒加载
    if (!renderedQuestions.has(questionId)) {
      renderedQuestions.add(questionId)
      
      // 获取题目在列表中的索引
      const questionIndex = questions.value.findIndex(q => q.id === questionId)
      
      // 前3个题目立即渲染，确保首屏快速显示
      if (questionIndex < 3) {
        MathJaxUtils.renderMath(el, false) // 立即渲染
        nextTick(() => {
          adjustCardHeight(el, questionId)
        })
        return
      }
      
      // 其他题目使用 Intersection Observer 懒加载
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // 元素进入视口，立即渲染 MathJax
              MathJaxUtils.renderMath(el, false) // 立即渲染，不使用懒加载模式
              
              // 渲染完成后调整高度
              nextTick(() => {
                adjustCardHeight(el, questionId)
              })
              
              // 停止观察，避免重复渲染
              observer.unobserve(el)
              intersectionObservers.delete(questionId) // 从存储中移除
            }
          })
        },
        {
          root: null, // 使用视口作为根
          rootMargin: '100px', // 提前100px开始渲染，确保流畅体验
          threshold: 0.1 // 元素10%可见时触发
        }
      )
      
      // 存储观察器，便于清理
      intersectionObservers.set(questionId, observer)
      
      // 开始观察元素
      observer.observe(el)
    }
  }
}

// 调整卡片高度 - 简化版本，不再需要复杂的高度计算
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const adjustCardHeight = (_contentEl: HTMLElement, _questionId: string) => {
  // 普通列表模式下，让内容自然流动，不需要强制设置高度
  // 保留此函数是为了兼容现有的 Intersection Observer 调用
}

// 创建节流版本的方法
const throttledHandleCardClick = ThrottleUtils.fast(async (question: ExerciseItem, index: number) => {
  await selectQuestion(index)
})

const throttledSendToAi = throttle((question: ExerciseItem) => {
  sendToAi(question)
}, 3000) // 3秒节流，防止频繁发送给AI

const throttledDeleteQuestion = ThrottleUtils.slow((questionId: string) => {
  deleteQuestion(questionId)
})

const throttledMoveToTop = ThrottleUtils.standard((questionId: string) => {
  moveQuestionToTop(questionId)
})

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
    // 使用 store 的 fetchQuestions 方法，它会优先从本地存储加载
    const questionStore = useQuestionStore()
    // fetchQuestions 方法会先尝试从本地存储加载，如果没有数据再请求API
    await questionStore.fetchQuestions(selectedSubject.value, true)
    
    // 从store获取去重后的题目列表
    questions.value = [...questionStore.questions]

    if (questions.value.length > 0) {
      // 等待 DOM 更新
      await nextTick()
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
  const questionStore = useQuestionStore()
  questions.value = [...questionStore.questions]
  
  // 保持当前选中的题目索引
  const currentIndex = questionStore.currentQuestionIndex
  if (currentIndex >= 0 && currentIndex < questions.value.length) {
    selectedQuestionIndex.value = currentIndex
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
    const questionStore = useQuestionStore()
    await questionStore.selectQuestion(index)

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
  } catch {
    console.error('📍 [滚动] 滚动失败')
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
    const questionStore = useQuestionStore()
    await questionStore.selectQuestion(targetIndex)

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
  } catch {
    console.error('📍 [滚动选择] 操作失败')
  }
}



// 删除题目
const deleteQuestion = async (questionId: string) => {
  try {
    deletingIds.value.add(questionId)

    try {
      // 使用API服务删除题目
      const success = await apiService.deleteExercise(questionId, selectedSubject.value)

      if (success) {
        showMessage('题目删除成功', 'positive')
        // 重新加载题目列表
        await loadQuestions()
      } else {
        showMessage('题目删除失败', 'error')
      }
    } catch (error) {
      showMessage('删除题目时出错: ' + (error as Error).message, 'error')
    } finally {
      deletingIds.value.delete(questionId)
    }
  } catch (error) {
    showMessage('删除题目时出错: ' + (error as Error).message, 'error')
    deletingIds.value.delete(questionId)
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
    const questionStore = useQuestionStore()
    await questionStore.setQuestions(questions.value, selectedSubject.value)


    // 题目置顶后滚动到最顶部
    await nextTick()
    const container = document.querySelector('.question-cards-container')
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch {
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
    } else {
      // 在非Android环境中模拟拍照搜题
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
          const questionStore = useQuestionStore()
          await questionStore.setQuestions(questions.value, selectedSubject.value)

        }
      }, 2000)
    }
  } catch {
    showMessage('启动拍照搜题失败', 'error')
  }
}

// 发送给AI
const sendToAi = async (question: ExerciseItem) => {
  try {
    const questionStore = useQuestionStore()
    const aiExerciseStore = useAiExerciseChatStore()

    // 关键修复：在store的questions数组中查找题目索引，而不是在本地questions数组中查找
    const storeIndex = questionStore.questions.findIndex((q: ExerciseItem) => q.id === question.id)
    if (storeIndex >= 0) {
      // 使用store中的索引来选择题目
      await questionStore.selectQuestion(storeIndex)
      
      // 第1步：检查是否选择了题目
      if (!questionStore.currentQuestion) {
        showMessage('请先选择一道题目', 'warning')
        return
      }

      // 第2步：标记当前题目正在进行AI指导
      questionStore.currentQuestion.isAiGuiding = true
      questionStore.currentQuestion.beginGuideToSolve = true

      // 第3步：清除聊天记录
      await aiExerciseStore.clearChatHistory(questionStore.currentQuestion.id)
      
      // 第4步：发送题目内容给AI进行分析（每次都是新的开始）
      const questionContent = questionStore.currentQuestion.question || '题目内容为空'
      const initialMessage = `我们开始吧，${questionContent}`
      
      await aiExerciseStore.sendMessage(
        initialMessage,
        questionStore.currentQuestion,
        { id: '', userId: '' },
        'MATH',
        'mate'
      )
    } else {
      // 如果store中没有找到题目，说明数据不同步，需要重新同步
      showMessage('题目数据不同步，请重新加载', 'warning')
      return
    }

    // 发出事件通知父组件切换到AI聊天界面
    emit('startAiGuidance', question)

  } catch (error) {
    console.error('启动AI指导失败:', error)
    // 发生错误时重置AI指导状态
    const questionStore = useQuestionStore()
    if (questionStore.currentQuestion) {
      questionStore.currentQuestion.isAiGuiding = false
      questionStore.currentQuestion.beginGuideToSolve = false
    }
    showMessage('启动AI指导失败', 'error')
  }
}


// 生命周期
onMounted(() => {
  loadQuestions()
})

// 组件卸载时清理资源
onUnmounted(() => {
  // 清理所有 Intersection Observer
  intersectionObservers.forEach((observer) => {
    observer.disconnect()
  })
  intersectionObservers.clear()
  
  // 清理 MathJax
  MathJaxUtils.cleanup()
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

  // 题目卡片列表容器
  .question-cards-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .question-item-wrapper {
    padding: 0;
    box-sizing: border-box;
    width: 100%;
    overflow: visible;
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
        transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
        
        &:hover:not(:disabled) {
          background-color: $background-hover;
          @include card-shadow(subtle);
          transform: scale(1.05);
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        
        &.q-btn--loading {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        :deep(.q-btn__content) {
          font-size: 14px; // 减小图标字体大小
        }
        
        // 主要操作按钮特殊样式
        &.primary-action {
          &:hover:not(:disabled) {
            background-color: rgba(26, 115, 232, 0.1);
            color: $primary-color;
          }
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
// ===== 空状态样式 =====
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

