<template>
  <div class="question-list" @click.stop>
    {{ currentQuestion?.id }}
    <!-- 题目列表 - 卡片布局 -->
    <div
      ref="scrollContainer"
      class="question-cards-container"
    >
      <!-- 骨架屏加载状态 -->
      <QuestionListSkeleton v-if="loading" />

      <!-- 空状态 -->
      <div v-else-if="displayList.length === 0" class="native-empty-state">
        <q-icon name="quiz" size="80px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7 native-text-3xl">
          {{ searchQuery || selectedSubjectFilter ? '未找到匹配的题目' : '暂无题目' }}
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

      <!-- 题目列表 -->
      <div v-else class="question-cards-list">
        <div
          v-for="item in allRenderItems"
          :key="item.id"
          class="question-item-wrapper"
          :data-index="item.actualIndex"
        >
          <!-- 占位符 -->
          <div
            v-if="item.isPlaceholder"
            class="question-card-placeholder"
            :ref="(el) => observePlaceholderRef(el as HTMLElement | null, item.actualIndex)"
            :style="{ minHeight: getPlaceholderHeight(item.id, item.actualIndex) + 'px' }"
          >
            <div class="question-block">
              <!-- 占位符头部 -->
              <div class="question-header">
                <div class="question-number-placeholder"></div>
                <div class="question-actions-placeholder">
                  <div class="placeholder-btn"></div>
                  <div class="placeholder-btn"></div>
                  <div class="placeholder-btn"></div>
                </div>
              </div>

              <!-- 占位符内容 -->
              <div class="question-content-area">
                <div class="question-content-placeholder">
                  <div class="placeholder-line placeholder-line-long"></div>
                  <div class="placeholder-line placeholder-line-medium"></div>
                  <div class="placeholder-line placeholder-line-short"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 实际题目 -->
          <div
            v-else
            ref="(el) => setQuestionCardRef(el as HTMLElement | null, item.id, item.actualIndex)"
            :data-question-id="item.id"
            class="question-card"
            :class="{
              'question-selected': isQuestionSelected(item.id),
              'question-deleting': deletingIds.has(item.id),
            }"
            @click.stop="throttledHandleCardClick(item.question!, item.actualIndex)"
          >
            <div class="question-block">
              <!-- 题目头部 -->
              <div class="question-header">
                <!-- 左侧：题目序号 -->
                <div class="question-number">题目{{ item.originalIndex + 1 }}</div>

                <!-- 右侧：功能区 -->
                <div class="question-actions">
                  <!-- 更多按钮 -->
                  <div>
                    <q-btn
                      icon="more_vert"
                      color="grey-7"
                      flat
                      round
                      size="sm"
                      @click.stop="toggleMoreMenu(item.id)"
                      class="action-btn more-btn"
                    >
                      <q-tooltip>更多</q-tooltip>

                      <!-- 功能菜单气泡框 -->
                      <q-popup-proxy
                        v-model="showMoreMenu[item.id]"
                        anchor="top right"
                        self="bottom right"
                        :breakpoint="0"
                        no-parent-event
                      >
                        <q-card class="more-menu-card">
                          <q-list dense>
                            <!-- 发送给AI -->
                            <q-item
                              clickable
                              @click="
                                closeMenuAndExecute(item.id, () =>
                                  throttledSendToAi(item.question!),
                                )
                              "
                              class="menu-item"
                            >
                              <q-item-section avatar>
                                <q-icon name="smart_toy" color="primary" size="20px" />
                              </q-item-section>
                              <q-item-section>发送给AI</q-item-section>
                            </q-item>

                            <!-- 微课 -->
                            <q-item
                              clickable
                              @click="
                                closeMenuAndExecute(item.id, () =>
                                  throttledOpenMiniClass(item.question!),
                                )
                              "
                              class="menu-item"
                            >
                              <q-item-section avatar>
                                <q-icon name="ondemand_video" color="purple" size="20px" />
                              </q-item-section>
                              <q-item-section>微课</q-item-section>
                            </q-item>

                            <!-- 置顶 -->
                            <q-item
                              v-if="item.actualIndex > 0"
                              clickable
                              @click="
                                closeMenuAndExecute(item.id, () => throttledMoveToTop(item.id))
                              "
                              class="menu-item"
                            >
                              <q-item-section avatar>
                                <q-icon name="vertical_align_top" color="orange" size="20px" />
                              </q-item-section>
                              <q-item-section>置顶</q-item-section>
                            </q-item>

                            <!-- 收藏 -->
                            <q-item
                              clickable
                              @click="
                                closeMenuAndExecute(item.id, () =>
                                  throttledToggleFavorite(item.question!),
                                )
                              "
                              class="menu-item"
                            >
                              <q-item-section avatar>
                                <q-icon
                                  :name="
                                    isExerciseFavorite(item.question!.id) ? 'star' : 'star_border'
                                  "
                                  :color="
                                    isExerciseFavorite(item.question!.id) ? 'warning' : 'grey-7'
                                  "
                                  size="20px"
                                />
                              </q-item-section>
                              <q-item-section>
                                {{
                                  isExerciseFavorite(item.question!.id) ? '取消收藏' : '收藏题目'
                                }}
                              </q-item-section>
                            </q-item>

                            <!-- 分隔线 -->
                            <q-separator />

                            <!-- 删除 -->
                            <q-item
                              clickable
                              @click="
                                closeMenuAndExecute(item.id, () => throttledDeleteQuestion(item.id))
                              "
                              :disable="deletingIds.has(item.id)"
                              class="menu-item delete-item"
                            >
                              <q-item-section avatar>
                                <q-icon
                                  name="delete"
                                  color="negative"
                                  size="20px"
                                  :class="{ 'icon-loading': deletingIds.has(item.id) }"
                                />
                              </q-item-section>
                              <q-item-section>
                                {{ deletingIds.has(item.id) ? '删除中...' : '删除题目' }}
                              </q-item-section>
                            </q-item>
                          </q-list>
                        </q-card>
                      </q-popup-proxy>
                    </q-btn>
                  </div>
                </div>
              </div>

              <!-- 题目内容 -->
              <div class="question-content-area">
                <div
                  class="markdown-content question-content"
                  v-html="
                    renderMessageContent(
                      item.question?.question || item.question?.title || '暂无内容',
                    )
                  "
                  :ref="(el) => setContentRef(el as HTMLElement | null, item.id)"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 微课对话框 -->
    <MiniClass
      v-model="showMiniClassDialog"
      :class-url="miniClassUrl"
      :question-title="miniClassQuestionTitle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { showMessage, ThrottleUtils, throttle } from '../utils'
import { useQuestionStore } from '../stores/questionStore'
import { storeToRefs } from 'pinia'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useUIStore } from '../stores/uiStore'
import type { ExerciseItem } from '../types'
import { apiService } from '../services/api-service'
import { MathJaxUtils } from '../utils/math/mathjax'
import { useMessageRenderer } from '../composables/useMessageRenderer'
import {
  useQuestionStatistics,
  type TitleHeightStat,
  type HeightComparison,
} from '../composables/useQuestionStatistics'
import QuestionListSkeleton from './QuestionListSkeleton.vue'
import MiniClass from './MiniClass.vue'
import { toggleExerciseFavorite, getFavoriteExercises } from '../utils/favorites'

const props = defineProps<{
  searchQuery?: string
  selectedSubjectFilter?: string | null
}>()

const emit = defineEmits<{
  startAiGuidance: [question: ExerciseItem]
  questionSelected: [question: ExerciseItem, index: number]
  openMiniClass: [question: ExerciseItem]
}>()

// 响应式数据
const questions = ref<ExerciseItem[]>([])
const selectedSubject = ref('math')
const selectedQuestionIndex = ref(-1)
const loading = ref(true)

// 从 props 获取搜索和过滤状态
const searchQuery = computed(() => props.searchQuery || '')
const selectedSubjectFilter = computed(() => props.selectedSubjectFilter || null)

// 题目 Store
const questionStore = useQuestionStore()
const { currentQuestion } = storeToRefs(questionStore)

// 判断题目是否被选中（基于题目ID，支持筛选状态）
const isQuestionSelected = (questionId: string): boolean => {
  if (!currentQuestion.value) {
    return false
  }
  return currentQuestion.value.id === questionId
}

// 题目删除和渲染相关
const deletingIds = ref(new Set<string>())
const contentRefs = ref<Map<string, HTMLElement>>(new Map())
const renderedQuestions = new Set<string>()
const intersectionObservers = new Map<string, IntersectionObserver>()

// 更多菜单显示状态
const showMoreMenu = ref<Record<string, boolean>>({})

// 渐进式渲染相关
interface RenderItem {
  id: string
  actualIndex: number // 在筛选列表中的索引
  originalIndex: number // 在原始列表中的索引
  isPlaceholder: boolean
  question?: ExerciseItem // 占位符时不存在
}

const renderedIndexes = ref(new Set<number>()) // 已渲染的索引
const placeholderHeights = ref<Map<number, number>>(new Map()) // 占位符高度缓存（保留用于兼容）
const placeholderObservers = new Map<number, IntersectionObserver>() // 占位符观察器
const PRE_RENDER_COUNT = 3 // 前N个题目立即渲染
const ESTIMATED_PLACEHOLDER_HEIGHT = 207 // 估算占位符高度（单位：px，基于统计数据：无图片题目平均高度）

// 动态高度测量相关（方案A）
const questionHeights = ref<Map<string, number>>(new Map()) // 题目ID -> 高度映射
const indexToHeight = ref<Map<number, number>>(new Map()) // 索引 -> 高度映射（便于快速查找）
const questionCardRefs = ref<Map<string, HTMLElement>>(new Map()) // 实际题目卡片引用
const resizeObservers = new Map<string, ResizeObserver>() // ResizeObserver映射
const heightMeasurementTimers = new Map<string, NodeJS.Timeout>() // 延迟测量定时器

// 所有类型定义和工具函数已迁移到 useQuestionStatistics composable

// 使用与 ChatBubble 相同的渲染器
const { renderMessageContent } = useMessageRenderer()

// UI Store（用于微课对话框）
const uiStore = useUIStore()
const showMiniClassDialog = computed({
  get: () => uiStore.showMiniClassDialog,
  set: (value) => {
    if (!value) {
      uiStore.closeMiniClassDialog()
    }
  },
})
const miniClassUrl = computed(() => uiStore.miniClassUrl)
const miniClassQuestionTitle = computed(() => uiStore.miniClassQuestionTitle)

// 计算属性
const filteredQuestions = computed(() => {
  let result = questions.value

  // 先应用学科过滤
  if (selectedSubjectFilter.value) {
    const filterSubject = String(selectedSubjectFilter.value).toUpperCase()

    // 学科映射表（支持多种格式）
    const subjectMap: Record<string, string[]> = {
      SUBJECT_MATH: ['SUBJECT_MATH', 'MATH', '数学'],
      SUBJECT_BIOLOGY: ['SUBJECT_BIOLOGY', 'BIOLOGY', '生物'],
      SUBJECT_CHEMISTRY: ['SUBJECT_CHEMISTRY', 'CHEMISTRY', '化学'],
      SUBJECT_PHYSICS: ['SUBJECT_PHYSICS', 'PHYSICS', '物理'],
      SUBJECT_CHINESE: ['SUBJECT_CHINESE', 'CHINESE', '语文'],
      SUBJECT_ENGLISH: ['SUBJECT_ENGLISH', 'ENGLISH', '英语'],
    }

    // 获取过滤学科的所有可能值
    const filterValues = subjectMap[filterSubject] || [filterSubject]

    result = result.filter((question) => {
      if (!question.subject) return false

      // 获取题目学科的各种可能格式
      const questionSubject = question.subject.trim()
      const questionSubjectUpper = questionSubject.toUpperCase()

      // 检查是否匹配过滤学科的任何一种格式
      return filterValues.some((value) => {
        const valueUpper = value.toUpperCase()
        return (
          questionSubjectUpper === valueUpper ||
          questionSubject === value ||
          questionSubjectUpper.includes(valueUpper) ||
          valueUpper.includes(questionSubjectUpper)
        )
      })
    })
  }

  // 再应用搜索过滤
  if (searchQuery.value?.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(
      (question) =>
        (question.title && question.title.toLowerCase().includes(query)) ||
        (question.question && question.question.toLowerCase().includes(query)),
    )
  }

  return result
})

// 显示的列表（应用了搜索和学科过滤）
const displayList = computed(() => {
  return filteredQuestions.value
})

// 滚动容器引用（用于滚动定位）
const scrollContainer = ref<HTMLElement | null>(null)

// 先声明 setQuestionCardRef，稍后实现
let setQuestionCardRefImpl: (
  el: HTMLElement | null,
  questionId: string,
  index: number,
) => void = () => {}

// 初始化统计 composable
const statistics = useQuestionStatistics({
  displayList,
  questionHeights,
  indexToHeight,
  questionCardRefs,
  renderedIndexes,
  scrollContainer,
  setQuestionCardRef: (el, questionId, index) => {
    if (setQuestionCardRefImpl) {
      setQuestionCardRefImpl(el, questionId, index)
    }
  },
})

// 从 composable 解构出需要的函数和状态
const {
  heightStats,
  titleHeightStats,
  heightComparisons,
  estimateHeightByStats,
  recordQuestionHeight: recordQuestionHeightFromStats,
  outputComparisonStatistics,
  analyzeTitleHeightRelation,
  activelyBindQuestionRefs,
  manuallyMeasureAllQuestions,
  performMeasurement: performMeasurementFromStats,
} = statistics

// 所有项目的渲染列表：支持渐进式渲染（占位符 + 实际题目）
const allRenderItems = computed(() => {
  const list = displayList.value
  const items: RenderItem[] = []

  list.forEach((question, index) => {
    // 前N个题目立即渲染，不使用占位符
    const shouldRender = index < PRE_RENDER_COUNT || renderedIndexes.value.has(index)
    
    // 计算题目在原始列表中的索引
    const originalIndex = questions.value.findIndex((q) => q.id === question.id)

    items.push({
      id: question.id,
      actualIndex: index, // 在筛选列表中的索引
      originalIndex: originalIndex >= 0 ? originalIndex : index, // 在原始列表中的索引，如果找不到则使用当前索引作为fallback
      isPlaceholder: !shouldRender,
      question: shouldRender ? question : undefined,
    })
  })

  return items
})

// 工具方法

// 主要方法

// 监听占位符进入视口，替换为实际题目
const observePlaceholderRef = (el: HTMLElement | null, index: number) => {
  if (!el || !scrollContainer.value) return

  // 如果已经渲染，不需要观察
  if (renderedIndexes.value.has(index)) return

  // 如果已经有观察器，先清理
  const existingObserver = placeholderObservers.get(index)
  if (existingObserver) {
    existingObserver.disconnect()
    placeholderObservers.delete(index)
  }

  // 创建新的观察器
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !renderedIndexes.value.has(index)) {
          // 占位符进入视口，标记为已渲染
          renderedIndexes.value.add(index)

          // 记录占位符高度（如果有）
          if (entry.boundingClientRect.height > 0) {
            placeholderHeights.value.set(index, entry.boundingClientRect.height)
          }

          // 停止观察并清理
          observer.disconnect()
          placeholderObservers.delete(index)
        }
      })
    },
    {
      root: scrollContainer.value,
      rootMargin: '200px', // 提前200px开始渲染
      threshold: 0.01, // 只要有一点可见就触发
    },
  )

  observer.observe(el)
  placeholderObservers.set(index, observer)
}

// 设置内容引用，使用 Intersection Observer 实现真正的视口懒加载
const setContentRef = (el: HTMLElement | null, questionId: string) => {
  if (el && el instanceof HTMLElement) {
    contentRefs.value.set(questionId, el)

    // 只在首次渲染时处理MathJax，使用 Intersection Observer 实现懒加载
    if (!renderedQuestions.has(questionId)) {
      renderedQuestions.add(questionId)

      // 获取题目在列表中的索引
      const list = displayList.value
      const questionIndex = list.findIndex((q) => q.id === questionId)

      // 前3个题目立即渲染，确保首屏快速显示
      if (questionIndex < 3) {
        MathJaxUtils.renderMath(el, false) // 立即渲染
        return
      }

      // 其他题目使用 Intersection Observer 懒加载
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // 元素进入视口，立即渲染 MathJax
              MathJaxUtils.renderMath(el, false) // 立即渲染，不使用懒加载模式

              // 停止观察，避免重复渲染
              observer.unobserve(el)
              intersectionObservers.delete(questionId) // 从存储中移除
            }
          })
        },
        {
          root: scrollContainer.value, // 使用滚动容器作为根
          rootMargin: '100px', // 提前100px开始渲染，确保流畅体验
          threshold: 0.1, // 元素10%可见时触发
        },
      )

      // 存储观察器，便于清理
      intersectionObservers.set(questionId, observer)

      // 开始观察元素
      observer.observe(el)
    }
  }
}

// 设置实际题目卡片的引用并开始监听高度变化
setQuestionCardRefImpl = (el: HTMLElement | null, questionId: string, index: number) => {
  if (!el || questionCardRefs.value.has(questionId)) return

  questionCardRefs.value.set(questionId, el)

  // 使用 ResizeObserver 监听高度变化
  const resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      // 使用 contentRect 或 target 的 getBoundingClientRect
      const height = entry.target.getBoundingClientRect().height

      // 等待内容稳定后再记录（避免频繁更新）
      clearTimeout(heightMeasurementTimers.get(questionId))
      const timer = setTimeout(() => {
        if (height > 0) {
          recordQuestionHeightFromStats(questionId, index, height)
        }
      }, 200) // 延迟200ms，等待MathJax渲染完成

      heightMeasurementTimers.set(questionId, timer)
    })
  })

  resizeObserver.observe(el)
  resizeObservers.set(questionId, resizeObserver)

  // 立即尝试测量一次（用于快速显示的题目）
  nextTick(() => {
    const height = el.getBoundingClientRect().height
    if (height > 0) {
      // 延迟测量，等待可能的MathJax渲染
      setTimeout(() => {
        const finalHeight = el.getBoundingClientRect().height
        recordQuestionHeightFromStats(questionId, index, finalHeight)
      }, 300) // 给MathJax更多时间
    }
  })
}

// 导出给模板使用（在模板中被使用，但 TypeScript 可能无法识别）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setQuestionCardRef = setQuestionCardRefImpl

// 创建节流版本的方法
const throttledHandleCardClick = ThrottleUtils.fast(
  async (question: ExerciseItem, index: number) => {
    await selectQuestion(question, index)
  },
)

const throttledSendToAi = throttle((question: ExerciseItem) => {
  sendToAi(question)
}, 3000) // 3秒节流，防止频繁发送给AI

const throttledOpenMiniClass = ThrottleUtils.fast((question: ExerciseItem) => {
  openMiniClass(question)
})

const throttledDeleteQuestion = ThrottleUtils.slow((questionId: string) => {
  deleteQuestion(questionId)
})

const throttledMoveToTop = ThrottleUtils.standard((questionId: string) => {
  moveQuestionToTop(questionId)
})

// 收藏相关状态
const favoriteStatus = ref<Map<string, boolean>>(new Map())

// 检查题目是否已收藏
const isExerciseFavorite = (itemId: string): boolean => {
  return favoriteStatus.value.get(itemId) ?? false
}

// 初始化收藏状态
const initFavoriteStatus = () => {
  const favorites = getFavoriteExercises()
  favoriteStatus.value.clear()
  favorites.forEach((f) => {
    favoriteStatus.value.set(f.item.id, true)
  })
}

// 切换收藏状态
const toggleFavorite = (item: ExerciseItem) => {
  const wasFavorite = isExerciseFavorite(item.id)
  const success = toggleExerciseFavorite(item)

  if (success) {
    // 更新收藏状态
    favoriteStatus.value.set(item.id, !wasFavorite)
    showMessage(!wasFavorite ? '已收藏' : '已取消收藏', 'success')
  } else {
    showMessage('操作失败，请重试', 'error')
  }
}

const throttledToggleFavorite = ThrottleUtils.fast((item: ExerciseItem) => {
  toggleFavorite(item)
})

// 切换更多菜单显示状态
const toggleMoreMenu = (questionId: string) => {
  const currentValue = showMoreMenu.value[questionId] || false
  showMoreMenu.value[questionId] = !currentValue
}

// 关闭更多菜单并执行操作
const closeMenuAndExecute = (questionId: string, action: () => void) => {
  showMoreMenu.value[questionId] = false
  action()
}

const throttledLoadQuestions = ThrottleUtils.verySlow(() => {
  loadQuestions()
}) // 1秒节流，防止重复加载

// 包装函数：用于调用 composable 的方法
const wrappedAnalyzeTitleHeightRelation = () => {
  analyzeTitleHeightRelation(
    recordQuestionHeightFromStats,
    computed(() => questions.value),
  )
}

const wrappedManuallyMeasureAllQuestions = () => {
  return manuallyMeasureAllQuestions(recordQuestionHeightFromStats)
}

// 获取占位符高度（优化版 - 支持ID和索引，基于统计数据智能估算）
const getPlaceholderHeight = (questionId: string, index: number): number => {
  // 1. 优先使用已测量的该题目高度（如果之前测量过）
  if (questionHeights.value.has(questionId)) {
    return questionHeights.value.get(questionId)!
  }

  // 2. 使用当前索引的高度缓存（如果之前在同一位置测量过）
  if (indexToHeight.value.has(index)) {
    return indexToHeight.value.get(index)!
  }

  // 3. 尝试从题目数据智能估算（基于统计数据分析）
  try {
    const list = displayList.value
    if (index >= 0 && index < list.length) {
      const question = list[index]
      if (question && question.id === questionId) {
        const title = question.title || question.question || ''
        if (title) {
          const estimatedHeight = estimateHeightByStats(title)
          if (estimatedHeight > 0) {
            return estimatedHeight
          }
        }
      }
    }

    // 如果通过ID找不到，尝试通过索引查找
    if (index >= 0 && index < list.length) {
      const question = list[index]
      if (question) {
        const title = question.title || question.question || ''
        if (title) {
          const estimatedHeight = estimateHeightByStats(title)
          if (estimatedHeight > 0) {
            return estimatedHeight
          }
        }
      }
    }
  } catch {
    // 如果出错，继续使用下面的兜底策略
  }

  // 4. 如果有统计信息，使用智能估算（使用中位数）
  const stats = heightStats.value
  if (stats.samples.length > 0) {
    // 优先使用中位数（更稳定）
    return stats.median > 0 ? stats.median : stats.avg
  }

  // 5. 兼容旧的高度缓存（如果有）
  if (placeholderHeights.value.has(index)) {
    return placeholderHeights.value.get(index)!
  }

  // 6. 使用基于统计数据的默认值（无图片题目的平均高度）
  return ESTIMATED_PLACEHOLDER_HEIGHT
}

const loadQuestions = async () => {
  loading.value = true

  // 重置渐进式渲染状态
  renderedIndexes.value.clear()
  placeholderHeights.value.clear()
  placeholderObservers.forEach((observer) => {
    observer.disconnect()
  })
  placeholderObservers.clear()

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

      // 确保前N个题目标记为已渲染（用于立即渲染）
      const preRenderCount = Math.min(PRE_RENDER_COUNT, questions.value.length)
      for (let i = 0; i < preRenderCount; i++) {
        renderedIndexes.value.add(i)
      }

      // 延迟一段时间后，尝试主动绑定和测量（给DOM渲染和MathJax渲染时间）
      setTimeout(() => {
        if (renderedIndexes.value.size > 0) {
          activelyBindQuestionRefs()
          setTimeout(() => {
            performMeasurementFromStats(recordQuestionHeightFromStats)
          }, 500)
        }
      }, 1000) // 延迟1秒，等待DOM和MathJax渲染
    }
  } catch (error) {
    showMessage('加载题目失败: ' + ((error as Error)?.message || '未知错误'), 'error')
  } finally {
    loading.value = false
    await nextTick()
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

// 搜索和过滤逻辑已通过计算属性实现，通过 watch 监听 props 变化来重置渲染状态

// 题目选择方法
const selectQuestion = async (question: ExerciseItem, index: number) => {
  console.log('selectQuestion', question, index)
  if (index >= 0 && index < questions.value.length) {
    selectedQuestionIndex.value = index

    const questionStore = useQuestionStore()
    const storeIndex = questionStore.questions.findIndex((q: ExerciseItem) => q.id === question.id)
    
    if (storeIndex >= 0) {
      // 使用store中的索引来选择题目
      await questionStore.selectQuestion(storeIndex)
    }

    // 发出题目选择事件
    emit('questionSelected', question, index)

    // 题目选择成功，已加载历史记录，无需自动开始AI指导
  } else {
    // 选择题目失败，通过界面状态反馈
  }
}

// 定位到当前题目
const scrollToCurrentQuestion = (targetIndex?: number) => {
  const indexToScroll = targetIndex !== undefined ? targetIndex : selectedQuestionIndex.value

  if (indexToScroll < 0 || !scrollContainer.value) {
    return
  }

  try {
    const list = displayList.value
    if (indexToScroll >= list.length) {
      return
    }

    // 找到目标元素
    const targetElement = scrollContainer.value.querySelector(`[data-index="${indexToScroll}"]`)
    if (targetElement) {
      const containerHeight = scrollContainer.value.clientHeight
      const elementTop = (targetElement as HTMLElement).offsetTop
      const elementHeight = (targetElement as HTMLElement).offsetHeight

      // 计算滚动位置，使目标元素居中
      const targetScrollTop = Math.max(0, elementTop - (containerHeight - elementHeight) / 2)

      // 滚动到目标位置
      scrollContainer.value.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      })
    }
  } catch {
    // 滚动失败
  }
}

// 滚动到指定题目并设置为选中状态
const scrollToQuestionAndSelect = async (targetIndex: number) => {
  const list = displayList.value
  if (targetIndex < 0 || targetIndex >= list.length) {
    return
  }

  try {
    // 先更新选中状态
    selectedQuestionIndex.value = targetIndex

    // 通知store更新当前选中的题目（需要转换为原始列表索引）
    const questionStore = useQuestionStore()
    // 关键修复：根据题目ID在store的questions数组中查找索引，而不是使用筛选后的索引
    const targetQuestion = list[targetIndex]
    const storeIndex = questionStore.questions.findIndex((q: ExerciseItem) => q.id === targetQuestion.id)
    if (storeIndex >= 0) {
      await questionStore.selectQuestion(storeIndex)
    }

    // 等待DOM更新后滚动
    await nextTick()
    scrollToCurrentQuestion(targetIndex)
  } catch {
    // 滚动选择失败
  }
}

// 删除题目
const deleteQuestion = async (questionId: string) => {
  try {
    deletingIds.value.add(questionId)

    // 清理高度缓存和观察器
    cleanupQuestionHeight(questionId)

    try {
      // 使用API服务删除题目
      const success = await apiService.deleteExercise(questionId, selectedSubject.value)

      if (success) {
        showMessage('题目删除成功', 'positive')
        // 重新加载题目列表（会自动重置渲染状态）
        await loadQuestions()
        // 重新映射索引高度
        remapIndexHeights()
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

    // 重新映射索引高度
    remapIndexHeights()

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

// 拍照搜题功能已移至父组件 ExerciseSolveView

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
        'mate',
      )
    } else {
      // 如果store中没有找到题目，说明数据不同步，需要重新同步
      showMessage('题目数据不同步，请重新加载', 'warning')
      return
    }

    // 发出事件通知父组件切换到AI聊天界面
    emit('startAiGuidance', question)
  } catch {
    // 发生错误时重置AI指导状态
    const questionStore = useQuestionStore()
    if (questionStore.currentQuestion) {
      questionStore.currentQuestion.isAiGuiding = false
      questionStore.currentQuestion.beginGuideToSolve = false
    }
    showMessage('启动AI指导失败', 'error')
  }
}

// 打开微课（使用Web技术实现）
const openMiniClass = async (question: ExerciseItem) => {
  try {
    // 使用硬编码的微课URL
    const classUrl = 'https://www.imates.com.cn:9099/demo/demo1.html'

    if (!classUrl || classUrl.trim() === '') {
      showMessage('该题目暂无微课', 'warning')
      return
    }

    // 优先通过事件通知父组件（ExerciseSolveView）打开微课
    emit('openMiniClass', question)
  } catch {
    showMessage('打开微课失败', 'error')
  }
}

// 重新映射索引高度（用于列表变化后）
const remapIndexHeights = () => {
  indexToHeight.value.clear()
  displayList.value.forEach((question, index) => {
    if (questionHeights.value.has(question.id)) {
      indexToHeight.value.set(index, questionHeights.value.get(question.id)!)
    }
  })
}

// 清理题目高度缓存和观察器
const cleanupQuestionHeight = (questionId: string) => {
  // 清理高度缓存
  questionHeights.value.delete(questionId)

  // 清理观察器
  const observer = resizeObservers.get(questionId)
  if (observer) {
    observer.disconnect()
    resizeObservers.delete(questionId)
  }

  // 清理定时器
  const timer = heightMeasurementTimers.get(questionId)
  if (timer) {
    clearTimeout(timer)
    heightMeasurementTimers.delete(questionId)
  }

  // 清理引用
  questionCardRefs.value.delete(questionId)
}

// 监听搜索变化，重置渲染状态
watch(
  searchQuery,
  () => {
    // 搜索时重置所有渲染状态
    renderedIndexes.value.clear()
    placeholderHeights.value.clear()

    // 保留ID映射，清空索引映射（因为列表顺序可能变化）
    indexToHeight.value.clear()

    // 清理所有占位符观察器
    placeholderObservers.forEach((observer) => {
      observer.disconnect()
    })
    placeholderObservers.clear()

    // 重新映射索引高度
    remapIndexHeights()
  },
  { immediate: false },
)

// 监听学科过滤变化，重置渲染状态
watch(
  selectedSubjectFilter,
  () => {
    // 学科过滤时重置所有渲染状态
    renderedIndexes.value.clear()
    placeholderHeights.value.clear()

    // 保留ID映射，清空索引映射（因为列表顺序可能变化）
    indexToHeight.value.clear()

    // 清理所有占位符观察器
    placeholderObservers.forEach((observer) => {
      observer.disconnect()
    })
    placeholderObservers.clear()

    // 重新映射索引高度
    remapIndexHeights()
  },
  { immediate: false },
)

// 监听列表变化，更新渲染状态
watch(
  () => displayList.value.length,
  (newLength, oldLength) => {
    // 如果列表长度减少，清理不再存在的索引
    if (newLength < oldLength) {
      const currentIndexes = new Set(Array.from({ length: newLength }, (_, i) => i))
      const indexesToRemove: number[] = []

      renderedIndexes.value.forEach((index) => {
        if (!currentIndexes.has(index)) {
          indexesToRemove.push(index)
        }
      })

      indexesToRemove.forEach((index) => {
        renderedIndexes.value.delete(index)
        placeholderHeights.value.delete(index)

        const observer = placeholderObservers.get(index)
        if (observer) {
          observer.disconnect()
          placeholderObservers.delete(index)
        }
      })
    }
  },
)

// 组件卸载时清理资源
onUnmounted(() => {
  // 清理所有 Intersection Observer
  intersectionObservers.forEach((observer) => {
    observer.disconnect()
  })
  intersectionObservers.clear()

  // 清理所有占位符观察器
  placeholderObservers.forEach((observer) => {
    observer.disconnect()
  })
  placeholderObservers.clear()

  // 清理所有 ResizeObserver
  resizeObservers.forEach((observer) => {
    observer.disconnect()
  })
  resizeObservers.clear()

  // 清理所有定时器
  heightMeasurementTimers.forEach((timer) => {
    clearTimeout(timer)
  })
  heightMeasurementTimers.clear()

  // 清理窗口大小变化监听（如果有）
  if (windowResizeCleanup) {
    window.removeEventListener('resize', windowResizeCleanup)
    windowResizeCleanup = null
  }

  // 清理 MathJax
  MathJaxUtils.cleanup()
})

// 窗口大小变化处理（可选，用于响应式布局）
let windowResizeCleanup: (() => void) | null = null

// 生命周期
// 监听 questions 变化，更新收藏状态
watch(
  () => questions.value,
  () => {
    initFavoriteStatus()
  },
  { deep: true },
)

onMounted(() => {
  loadQuestions()
  initFavoriteStatus()

  // 设置窗口大小变化监听
  let resizeTimeout: NodeJS.Timeout
  const handleResize = () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      // 重新测量所有已渲染的题目
      questionCardRefs.value.forEach((el, questionId) => {
        const index = displayList.value.findIndex((q) => q.id === questionId)
        if (index >= 0 && el) {
          const height = el.getBoundingClientRect().height
          if (height > 0) {
            recordQuestionHeightFromStats(questionId, index, height)
          }
        }
      })
    }, 300)
  }

  window.addEventListener('resize', handleResize)
  windowResizeCleanup = handleResize
})

// 暴露方法给父组件
defineExpose({
  loadQuestions,
  selectQuestion,
  refreshQuestions,
  scrollToCurrentQuestion,
  scrollToQuestionAndSelect,
  analyzeTitleHeightRelation: wrappedAnalyzeTitleHeightRelation, // 暴露统计分析方法
  manuallyMeasureAllQuestions: wrappedManuallyMeasureAllQuestions, // 暴露手动测量方法
  getTitleHeightStats: () => titleHeightStats.value, // 暴露统计数据
  outputComparisonStatistics, // 暴露对比统计方法
  getHeightComparisons: () => heightComparisons.value, // 暴露对比数据
})

// 将统计方法挂载到 window 对象上，方便在浏览器控制台中调用
if (typeof window !== 'undefined') {
  interface WindowWithStats extends Window {
    analyzeTitleHeightRelation: () => void
    manuallyMeasureAllQuestions: () => number
    getTitleHeightStats: () => TitleHeightStat[]
    outputComparisonStatistics: () => void
    getHeightComparisons: () => HeightComparison[]
  }
  const win = window as unknown as WindowWithStats
  win.analyzeTitleHeightRelation = wrappedAnalyzeTitleHeightRelation
  win.manuallyMeasureAllQuestions = wrappedManuallyMeasureAllQuestions
  win.getTitleHeightStats = () => titleHeightStats.value
  win.outputComparisonStatistics = outputComparisonStatistics
  win.getHeightComparisons = () => heightComparisons.value
}

// 监听统计数据的累积，在合适的时候自动输出统计（可选）
watch(
  () => titleHeightStats.value.length,
  () => {
    // 统计数据变化时的处理
  },
  { immediate: false },
)
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
$transition-smooth: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

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
    box-shadow:
      0 0 0 1px rgba(26, 115, 232, 0.2),
      $shadow-subtle;
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
  background-color: #f7f6ff;
  position: relative;

  // 题目卡片容器
  .question-cards-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    background-color: #f7f6ff;
    position: relative;
    padding: 0 8px 8px 8px;

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

  // 占位符卡片样式
  .question-card-placeholder {
    cursor: default;
    overflow: visible;
    transform: translateZ(0);
    backface-visibility: hidden;
    border: none;
    border-radius: 16px;
    background-color: transparent;
    padding: 4px;
    min-width: 0;
    pointer-events: none; // 禁用交互

    .question-block {
      background-color: transparent;
      border-radius: 12px;
      overflow: visible;
      border: none;
      box-shadow: none;
      min-width: 0;
    }

    .question-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: transparent;
      border-bottom: none;
      padding: 8px 20px 0 20px;

      .question-number-placeholder {
        width: 28px;
        height: 28px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200px 100%;
        border-radius: 14px;
        animation: placeholder-shimmer 1.5s infinite;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: transparent; // 隐藏数字
        font-size: 0; // 隐藏数字
      }

      .question-actions-placeholder {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        height: 32px;

        .placeholder-btn {
          width: 24px;
          height: 24px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200px 100%;
          border-radius: 12px;
          animation: placeholder-shimmer 1.5s infinite;

          &:nth-child(1) {
            animation-delay: 0s;
          }
          &:nth-child(2) {
            animation-delay: 0.2s;
          }
          &:nth-child(3) {
            animation-delay: 0.4s;
          }
        }
      }
    }

    .question-content-area {
      background-color: transparent;
      padding: 16px 20px 20px 20px;
      overflow-x: auto;
      overflow-y: hidden;
      min-width: 0;

      .question-content-placeholder {
        min-width: 0;

        .placeholder-line {
          height: 16px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200px 100%;
          border-radius: 8px;
          animation: placeholder-shimmer 1.5s infinite;
          margin-bottom: 12px;

          &.placeholder-line-long {
            width: 85%;
          }

          &.placeholder-line-medium {
            width: 65%;
          }

          &.placeholder-line-short {
            width: 45%;
          }

          &:last-child {
            margin-bottom: 0;
          }
        }
      }
    }
  }

  // 占位符动画
  @keyframes placeholder-shimmer {
    0% {
      background-position: -200px 0;
    }
    100% {
      background-position: calc(200px + 100%) 0;
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
        box-shadow:
          0 0 0 2px rgba(26, 115, 232, 0.2),
          $shadow-hover;
        background-color: rgba(26, 115, 232, 0.02);
      }
    }

    // 题目组块 - 去除卡片效果
    .question-block {
      background-color: transparent;
      border-radius: 12px;
      overflow: visible; // 改为visible以允许长公式显示
      border: none;
      box-shadow: none;
      transition: all 0.2s ease;
      min-width: 0; // 允许组块收缩
    }

    // 悬停效果 - 去除卡片效果
    &:hover {
      .question-block {
        background-color: transparent;
        border-radius: 12px;
        box-shadow: none;
      }
    }

    // 选中状态 - 背景白色，边框紫色
    &.question-selected {
      .question-block {
        background-color: $background-white;
        border: 1px solid #8b5cf6;
        border-radius: 12px;
        box-shadow: none;
      }
    }
  }

  // 题目头部
  .question-header {
    @include flex-center;
    justify-content: space-between;
    background-color: transparent;
    border-bottom: none;
    @include responsive-padding(8px 20px 0 20px, 8px 20px 0 20px);

    .question-number {
      color: $text-primary;
      font-weight: 500;
      font-size: 13px;
      flex-shrink: 0;
      white-space: nowrap;
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
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

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

        // 更多按钮特殊样式
        &.more-btn {
          &:hover:not(:disabled) {
            background-color: rgba(95, 99, 104, 0.1);
            color: $text-primary;
          }
        }
      }
    }

    // 更多菜单气泡框样式
    .more-menu-card {
      border-radius: 12px;
      box-shadow: $shadow-hover;
      border: 1px solid $border-color;
      min-width: 160px;
      overflow: hidden;
      background-color: $background-white;

      :deep(.q-list) {
        padding: 4px 0;

        .menu-item {
          min-height: 40px;
          padding: 8px 16px;
          transition: $transition-smooth;

          &:hover {
            background-color: $background-hover;
          }

          &.q-item--clickable {
            cursor: pointer;
          }

          &.q-item--disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          // 删除项特殊样式
          &.delete-item {
            &:hover {
              background-color: rgba(234, 67, 53, 0.08);
            }

            .q-item__section {
              color: #ea4335;
            }
          }

          .q-item__section {
            &--avatar {
              min-width: 32px;

              .q-icon {
                &.icon-loading {
                  animation: spin 1s linear infinite;
                }
              }
            }
          }
        }
      }

      :deep(.q-separator) {
        margin: 4px 0;
        border-color: $border-color;
      }
    }
  }

  // q-popup-proxy 圆角卡片样式
  :deep(.q-popup-proxy) {
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.08);
    background-color: $background-white;
    border: 1px solid $border-color;

    .q-menu {
      border-radius: 16px;
      overflow: hidden;
      box-shadow: none;
      background-color: transparent;
      border: none;
    }
  }

  // 题目内容区域
  .question-content-area {
    background-color: transparent;
    @include responsive-padding(6px 16px 16px 16px, 8px 20px 20px 20px);
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
  :deep(.mjx-chtml[display='inline']) {
    max-width: 100%;
    overflow-x: auto;
    white-space: nowrap;
  }

  // 块级公式处理
  :deep(.mjx-chtml[display='block']) {
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
    .question-cards-container {
      .question-card {
        .question-header {
          .question-number {
            font-size: 12px;
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
    .question-cards-container {
      .question-card {
        .question-header {
          .question-number {
            font-size: 11px;
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
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.08);
    background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
    border: 1px solid rgba(0, 0, 0, 0.06);
    max-width: 400px;
    width: 90vw;
    animation: gemini-dialog-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .q-dialog__title {
    font-family:
      'Google Sans',
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      sans-serif;
    font-size: 20px;
    font-weight: 500;
    color: #202124;
    margin-bottom: 8px;
    line-height: 1.3;
  }

  .q-dialog__message {
    font-family:
      'Google Sans',
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      sans-serif;
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
  font-family:
    'Google Sans',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

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
  font-family:
    'Google Sans',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

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

// 旋转动画
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
