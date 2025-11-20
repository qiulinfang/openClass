<template>
  <div class="question-list" @click.stop>
    <!-- 搜索输入框 -->
    <div class="search-container">
      <q-btn flat round dense class="photo-search-btn" @click="handlePhotoSearch">
        <img :src="searchQuestionIcon" alt="拍照搜题" class="photo-search-icon" />
        <q-tooltip>拍照搜题</q-tooltip>
      </q-btn>
      <q-input
        :model-value="searchQuery"
        @update:model-value="handleSearchInput"
        placeholder="搜索题目..."
        outlined
        dense
        clearable
        class="search-input"
      >
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <!-- 题目列表 - 卡片布局 -->
    <div ref="scrollContainer" class="question-cards-container" @scroll="handleScroll">
      <!-- 空状态 -->
      <div v-if="displayedQuestions.length === 0 && !loading" class="native-empty-state">
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

      <!-- 加载状态 -->
      <div v-if="renderingQuestions && displayedQuestions.length > 0" class="rendering-container">
        <q-spinner color="primary" size="32px" />
        <span class="rendering-text">正在渲染题目...</span>
      </div>

      <!-- 题目列表 -->
      <div v-if="displayedQuestions.length > 0 && !renderingQuestions" class="question-cards-list">
        <div
          v-for="(question, index) in displayedQuestions"
          :key="question.id"
          class="question-item-wrapper"
          :data-index="index"
        >
          <!-- 实际题目 -->
          <div
            ref="(el) => setQuestionCardRef(el as HTMLElement | null, question.id, index)"
            :data-question-id="question.id"
            class="question-card"
            :class="{
              'question-selected': isQuestionSelected(question.id),
              'question-deleting': deletingIds.has(question.id),
            }"
            @click.stop="throttledHandleCardClick(question, index)"
          >
            <div class="question-block">
              <!-- 题目头部 -->
              <div class="question-header">
                <!-- 左侧：题目序号 -->
                <div class="question-number">题目{{ index + 1 }}</div>

                <!-- 右侧：功能区（仅当前题目选中时显示更多按钮） -->
                <div class="question-actions" v-if="isQuestionSelected(question.id)">
                  <!-- 更多按钮：只在题目被选中时出现 -->
                  <div>
                    <q-btn
                      icon="more_vert"
                      color="grey-7"
                      flat
                      round
                      size="sm"
                      @click.stop="toggleMoreMenu(question.id)"
                      class="action-btn more-btn"
                    >
                      <q-tooltip>更多</q-tooltip>

                      <!-- 功能菜单气泡框 -->
                      <q-popup-proxy
                        v-model="showMoreMenu[question.id]"
                        anchor="top right"
                        self="bottom right"
                        :breakpoint="0"
                        no-parent-event
                      >
                        <q-card class="more-menu-card native-more-menu-card">
                          <q-list dense class="native-more-menu-list">
                            <!-- 发送给AI -->
                            <q-item
                              clickable
                              @click="
                                closeMenuAndExecute(question.id, () => throttledSendToAi(question))
                              "
                              class="menu-item native-more-menu-item"
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
                                closeMenuAndExecute(question.id, () =>
                                  throttledOpenMiniClass(question),
                                )
                              "
                              class="menu-item native-more-menu-item"
                            >
                              <q-item-section avatar>
                                <q-icon name="ondemand_video" color="purple" size="20px" />
                              </q-item-section>
                              <q-item-section>微课</q-item-section>
                            </q-item>

                            <!-- 置顶 -->
                            <q-item
                              v-if="index > 0"
                              clickable
                              @click="
                                closeMenuAndExecute(question.id, () =>
                                  throttledMoveToTop(question.id),
                                )
                              "
                              class="menu-item native-more-menu-item"
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
                                closeMenuAndExecute(question.id, () =>
                                  throttledToggleFavorite(question),
                                )
                              "
                              class="menu-item native-more-menu-item native-more-menu-favorite"
                            >
                              <q-item-section avatar>
                                <q-icon
                                  :name="isExerciseFavorite(question.id) ? 'star' : 'star_border'"
                                  :color="isExerciseFavorite(question.id) ? 'warning' : 'grey-7'"
                                  size="20px"
                                />
                              </q-item-section>
                              <q-item-section>
                                {{ isExerciseFavorite(question.id) ? '取消收藏' : '收藏题目' }}
                              </q-item-section>
                            </q-item>

                            <!-- 拍作业 -->
                            <q-item
                              clickable
                              @click="
                                closeMenuAndExecute(question.id, () =>
                                  throttledTakePictureToTeacher(question),
                                )
                              "
                              class="menu-item native-more-menu-item"
                            >
                              <q-item-section avatar>
                                <q-icon name="camera_alt" color="pink" size="20px" />
                              </q-item-section>
                              <q-item-section>拍作业</q-item-section>
                            </q-item>

                            <!-- 删除区域 -->
                            <div class="native-more-menu-delete-wrapper">
                              <q-item
                                clickable
                                @click="
                                  closeMenuAndExecute(question.id, () =>
                                    throttledDeleteQuestion(question.id),
                                  )
                                "
                                :disable="deletingIds.has(question.id)"
                                class="menu-item delete-item native-more-menu-delete-item"
                              >
                                <q-item-section avatar>
                                  <q-icon
                                    name="delete"
                                    color="negative"
                                    size="20px"
                                    :class="{ 'icon-loading': deletingIds.has(question.id) }"
                                  />
                                </q-item-section>
                                <q-item-section>
                                  {{ deletingIds.has(question.id) ? '删除中...' : '删除题目' }}
                                </q-item-section>
                              </q-item>
                            </div>
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
                  v-html="renderMessageContent(question?.question || question?.title || '暂无内容')"
                  :ref="(el) => handleContentRef(el, question.id)"
                ></div>
              </div>
            </div>
          </div>
        </div>
        <!-- 加载更多提示 -->
        <div v-if="hasMoreQuestions && renderingQuestions" class="load-more-container">
          <q-spinner color="primary" size="24px" />
          <span class="load-more-text">加载中...</span>
        </div>
      </div>
    </div>

    <!-- 微课对话框 -->
    <MiniClass
      v-model="showMiniClassDialog"
      :class-url="miniClassUrl"
      :question-title="miniClassQuestionTitle"
    />

    <!-- 统一聊天对话框 -->
    <UnifiedChatDialog
      ref="unifiedChatDialogRef"
      v-model="showUnifiedChatDialog"
      :initial-teacher-subject="selectedSubjectForTeacher"
      @session-created="handleSessionCreated"
    />

    <!-- 图片预览对话框 -->
    <ImageViewer
      v-model="showImagePreview"
      :image-url="previewImageUrl"
      alt="题目图片"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showMessage, ThrottleUtils, throttle } from '../utils'
import { useQuestionStore } from '../stores/questionStore'
import { storeToRefs } from 'pinia'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useUIStore } from '../stores/uiStore'
import type { ExerciseItem, ChatBubble } from '../types'
import { apiService } from '../services/api-service'
import { MathJaxUtils } from '../utils/math/mathjax'
import { useMessageRenderer } from '../composables/useMessageRenderer'

import MiniClass from './MiniClass.vue'
import UnifiedChatDialog from './UnifiedChatDialog.vue'
import ImageViewer from './ImageViewer.vue'
import { toggleExerciseFavorite, getFavoriteExercises } from '../utils/storage/favorites'
import { useImagePicker } from '../composables/useImagePicker'
import { useTeacherGeneralChatStore } from '../stores/teacherGeneralChatStore'

// 导入拍照搜题图标
import searchQuestionIcon from '/icons/search_question.svg'   

const props = defineProps<{
  searchQuery?: string
  selectedSubjectFilter?: string | null
}>()

const emit = defineEmits<{
  startAiGuidance: [question: ExerciseItem]
  questionSelected: [question: ExerciseItem, index: number]
  openMiniClass: [question: ExerciseItem]
  'update:searchQuery': [value: string]
}>()

// 响应式数据
const questions = ref<ExerciseItem[]>([])
const selectedSubject = ref('math')
const selectedQuestionIndex = ref(-1)
const loading = ref(true)

// 分页相关
const INITIAL_DISPLAY_COUNT = 20 // 初始显示的题目数量
const LOAD_MORE_COUNT = 20 // 每次加载更多的题目数量
const displayedCount = ref(INITIAL_DISPLAY_COUNT) // 已显示的题目数量

// 从 props 获取搜索和过滤状态
const searchQuery = computed(() => props.searchQuery || '') //搜索关键词
const selectedSubjectFilter = computed(() => props.selectedSubjectFilter || null) //全部学科

// 处理搜索输入
const handleSearchInput = (value: string | number | null) => {
  emit('update:searchQuery', (value || '').toString())
}

// 题目 Store
const questionStore = useQuestionStore()
const { currentQuestion } = storeToRefs(questionStore)

// 路由
const router = useRouter()

// 当前科目（用于拍照搜题）
const currentSubjectForPhotoSearch = computed(() => {
  const currentQuestion = questionStore.currentQuestion
  if (currentQuestion?.subject) {
    const subjectMap: Record<string, string> = {
      SUBJECT_MATH: 'math',
      SUBJECT_BIOLOGY: 'biology',
      SUBJECT_CHEMISTRY: 'chemistry',
      SUBJECT_PHYSICS: 'physics',
      SUBJECT_CHINESE: 'chinese',
      SUBJECT_ENGLISH: 'english',
    }
    return subjectMap[currentQuestion.subject] || currentQuestion.subject.toLowerCase() || 'math'
  }
  // 如果没有当前题目，根据用户选择的科目判断
  const subjectMap: Record<string, string> = {
    SUBJECT_MATH: 'math',
    SUBJECT_BIOLOGY: 'biology',
    SUBJECT_CHEMISTRY: 'chemistry',
    SUBJECT_PHYSICS: 'physics',
    SUBJECT_CHINESE: 'chinese',
    SUBJECT_ENGLISH: 'english',
  }
  // 从 selectedSubjectFilter 获取学科
  if (selectedSubjectFilter.value) {
    const filterSubject = String(selectedSubjectFilter.value).toUpperCase()
    return subjectMap[filterSubject] || 'math'
  }
  return 'math'
})

// 拍照搜题处理
const handlePhotoSearch = () => {
  // 统一使用路由跳转到 PhotoSearchView（包括 Android 环境）
  const subject = currentSubjectForPhotoSearch.value || 'math'
  router.push({
    path: '/photo-search',
    query: { subject },
  })
}

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

// 图片预览相关状态
const showImagePreview = ref(false)
const previewImageUrl = ref<string>('')

// 批量渲染相关
const renderingQuestions = ref(false) // 是否正在渲染题目
const renderedQuestionIds = ref(new Set<string>()) // 已渲染完成的题目ID集合

// 动态高度测量相关（方案A）
const questionHeights = ref<Map<string, number>>(new Map()) // 题目ID -> 高度映射
const indexToHeight = ref<Map<number, number>>(new Map()) // 索引 -> 高度映射（便于快速查找）
const questionCardRefs = ref<Map<string, HTMLElement>>(new Map()) // 实际题目卡片引用
const resizeObservers = new Map<string, ResizeObserver>() // ResizeObserver映射
const heightMeasurementTimers = new Map<string, ReturnType<typeof setTimeout>>() // 延迟测量定时器

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

// 拍作业相关依赖
const { pickImage } = useImagePicker()
const teacherStore = useTeacherGeneralChatStore()
const unifiedChatDialogRef = ref<InstanceType<typeof UnifiedChatDialog> | null>(null)
const showUnifiedChatDialog = ref(false)
const selectedSubjectForTeacher = ref<'biology' | 'math'>('math')
// 保存待发送的图片信息（在会话创建后直接创建消息并保存）
const pendingImageInfo = ref<{
  filePath: string
  width: number
  height: number
  fileSize: number
  base64DataUrl?: string
} | null>(null)

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

// 已显示的题目列表（分页显示）
const displayedQuestions = computed(() => {
  return displayList.value.slice(0, displayedCount.value)
})

// 是否还有更多题目
const hasMoreQuestions = computed(() => {
  return displayedCount.value < displayList.value.length
})

// 滚动容器引用（用于滚动定位）
const scrollContainer = ref<HTMLElement | null>(null)

// 先声明 setQuestionCardRef，稍后实现
let setQuestionCardRefImpl: (
  el: HTMLElement | null,
  questionId: string,
  index: number,
) => void = () => {}

// 检查当前批次的所有题目是否都已渲染完成
const checkBatchRenderComplete = async (maxRetries = 100) => {
  const currentBatch = displayedQuestions.value.slice(0, displayedCount.value)
  const allRendered = currentBatch.every((question) => renderedQuestionIds.value.has(question.id))

  if (allRendered || maxRetries <= 0) {
    // 所有题目都已渲染完成，或者达到最大重试次数，显示列表
    renderingQuestions.value = false
  } else {
    // 等待一段时间后再次检查
    await new Promise((resolve) => setTimeout(resolve, 100))
    await checkBatchRenderComplete(maxRetries - 1)
  }
}

// 处理内容引用（用于模板中的 ref）
const handleContentRef = (el: unknown, questionId: string) => {
  const element = (el as { $el?: HTMLElement })?.$el || (el as HTMLElement)
  if (element instanceof HTMLElement) {
    setContentRef(element, questionId)
  }
}

// 设置内容引用，渲染MathJax并标记为已渲染完成
const setContentRef = async (el: HTMLElement | null, questionId: string) => {
  if (el) {
    contentRefs.value.set(questionId, el)

    // 只在首次渲染时处理MathJax
    if (!renderedQuestions.has(questionId)) {
      renderedQuestions.add(questionId)

      // 渲染MathJax
      await MathJaxUtils.renderMath(el, false)

      // 给图片添加点击事件监听器
      await nextTick()
      attachImageClickListeners(el)

      // 标记为已渲染完成
      renderedQuestionIds.value.add(questionId)
      // 检查当前批次是否全部渲染完成
      await checkBatchRenderComplete()
    }
  }
}

// 给元素内的所有图片添加点击事件监听器
const attachImageClickListeners = (container: HTMLElement) => {
  const images = container.querySelectorAll('img')
  images.forEach((img) => {
    // 避免重复添加监听器
    if (img.dataset.hasClickListener === 'true') {
      return
    }

    img.dataset.hasClickListener = 'true'
    img.style.cursor = 'pointer'

    img.addEventListener('click', (e) => {
      e.stopPropagation()
      const imageUrl = img.src
      if (imageUrl) {
        previewImageUrl.value = imageUrl
        showImagePreview.value = true
      }
    })
  })
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
          questionHeights.value.set(questionId, height)
          indexToHeight.value.set(index, height)
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
        questionHeights.value.set(questionId, finalHeight)
        indexToHeight.value.set(index, finalHeight)
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

// 拍作业功能
const takePictureToTeacher = async (question: ExerciseItem) => {
  try {
    // 第1步：选择图片
    const imageInfo = await pickImage()
    if (!imageInfo) {
      return
    }

    // 第2步：验证图片数据完整性
    if (!imageInfo.filePath) {
      showMessage('图片路径不存在，请重试', 'error')
      return
    }
    if (!imageInfo.base64DataUrl) {
      showMessage('图片数据不完整，请重试', 'error')
      return
    }

    // 第3步：保存图片信息，等待会话创建后发送
    pendingImageInfo.value = imageInfo

    // 第4步：根据题目学科确定教师科目
    let subject: 'biology' | 'math' = 'math'
    if (question.subject) {
      const subjectMap: Record<string, 'biology' | 'math'> = {
        SUBJECT_BIOLOGY: 'biology',
        SUBJECT_MATH: 'math',
      }
      const subjectUpper = question.subject.toUpperCase()
      if (subjectMap[subjectUpper]) {
        subject = subjectMap[subjectUpper]
      }
    }
    selectedSubjectForTeacher.value = subject

    // 第5步：创建教师会话并打开对话框（会话创建后会触发handleSessionCreated，在那里发送图片）
    await selectSubjectForTeacher(subject)
  } catch (error) {
    console.error('[QuestionList] ❌ 处理图片失败:', error)
    showMessage('处理图片失败，请重试', 'error')
    pendingImageInfo.value = null
  }
}

// 初始化教师对话（供拍作业使用）
const selectSubjectForTeacher = async (subject: 'biology' | 'math') => {
  try {
    // 第1步：确保用户信息已加载
    const { getUserInfo } = await import('../services/auth-storage-service')
    const userInfo = getUserInfo() || {
      id: '',
      name: '',
      avatar: '',
      roles: [] as string[],
    }

    if (!userInfo?.id) {
      // 尝试从localStorage加载
      const { loadFromStorage } = await import('../services/auth-storage-service')
      const hasCache = loadFromStorage()
      if (!hasCache) {
        showMessage('无法获取用户信息，请重新登录', 'error')
        return
      }
    }

    // 第2步：设置科目并打开对话框
    selectedSubjectForTeacher.value = subject
    showUnifiedChatDialog.value = true

    // 第3步：等待组件加载完成
    await nextTick()

    // 第4步：通过组件创建新会话
    if (unifiedChatDialogRef.value) {
      await unifiedChatDialogRef.value.createTeacherSession(subject)
    }
  } catch (error) {
    console.error('[QuestionList] ❌ 准备教师对话失败:', error)
    showMessage('准备教师对话失败，请重试', 'error')
  }
}

// 处理会话创建事件
const handleSessionCreated = async (sessionId: string, type: 'ai-general' | 'teacher-general') => {
  // 如果是教师会话，设置会话到 Store（使用统一存储格式）
  if (type === 'teacher-general') {
    const session = teacherStore.getSession(sessionId)
    if (session) {
      teacherStore.setSession(session)

      // 如果有待发送的图片，直接创建消息并保存到持久化存储
      if (pendingImageInfo.value) {
        const imageInfo = pendingImageInfo.value
        pendingImageInfo.value = null

        // 等待会话加载完成
        await nextTick()

        // 创建图片消息
        const imageMessage: ChatBubble = {
          id: Date.now().toString(),
          content: '',
          type: 'user',
          timestamp: new Date().toISOString(),
          sender: 'user',
          messageType: 'image',
          imageData: {
            filePath: imageInfo.filePath,
            width: imageInfo.width,
            height: imageInfo.height,
            fileSize: imageInfo.fileSize,
            base64DataUrl: imageInfo.base64DataUrl,
          },
        }

        // 添加到 store
        teacherStore.addMessage(imageMessage)

        // 保存到持久化存储
        await teacherStore.saveChatHistory()

        // 发送图片消息到后端
        try {
          await teacherStore.sendMessage('', {
            filePath: imageInfo.filePath,
            width: imageInfo.width,
            height: imageInfo.height,
            fileSize: imageInfo.fileSize,
            base64DataUrl: imageInfo.base64DataUrl,
          })
        } catch (error) {
          console.error('[QuestionList] ❌ 发送图片消息失败:', error)
          showMessage('发送图片消息失败，请重试', 'error')
        }
      }
    }
  }
}

const throttledTakePictureToTeacher = ThrottleUtils.fast((question: ExerciseItem) => {
  takePictureToTeacher(question)
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

// 滚动处理函数
const handleScroll = throttle((event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  const { scrollTop, scrollHeight, clientHeight } = target
  const scrollBottom = scrollHeight - scrollTop - clientHeight

  // 当距离底部小于100px时，触发加载更多
  if (scrollBottom < 100 && hasMoreQuestions.value && !renderingQuestions.value) {
    loadMoreQuestions()
  }
}, 200) // 200ms节流

// 加载更多题目
const loadMoreQuestions = async () => {
  if (renderingQuestions.value || !hasMoreQuestions.value) return

  try {
    // 增加显示的题目数量
    displayedCount.value = Math.min(
      displayedCount.value + LOAD_MORE_COUNT,
      displayList.value.length,
    )

    // 等待DOM更新
    await nextTick()

    // 开始批量渲染新加载的题目
    renderingQuestions.value = true
    // 等待新加载的题目全部渲染完成
    await checkBatchRenderComplete()
  } catch (error) {
    console.error('[QuestionList] ❌ 加载更多题目失败:', error)
    renderingQuestions.value = false
  }
}

const loadQuestions = async () => {
  loading.value = true

  // 重置渲染状态
  renderedQuestionIds.value.clear()
  renderedQuestions.clear()
  renderingQuestions.value = false
  try {
    const questionStore = useQuestionStore()

    // 第1步：如果 store 中已有题目，直接使用（避免覆盖父组件已加载的正确科目）
    if (questionStore.questions.length > 0) {
      questions.value = [...questionStore.questions]
    } else {
      // 第2步：如果 store 中没有题目，需要确定科目并加载
      // 优先使用 selectedSubjectFilter 来确定科目
      if (selectedSubjectFilter.value === null) {
        // 全部学科：加载所有学科的题目
        await questionStore.fetchAllSubjectsQuestions(true)
      } else {
        // 具体学科：加载指定学科的题目
        let subjectToLoad = selectedSubject.value // 默认使用 math

        // 将 Subject 枚举值转换为科目名称
        const subjectMap: Record<string, string> = {
          SUBJECT_MATH: 'math',
          SUBJECT_BIOLOGY: 'biology',
          SUBJECT_CHEMISTRY: 'chemistry',
          SUBJECT_PHYSICS: 'physics',
          SUBJECT_CHINESE: 'chinese',
          SUBJECT_ENGLISH: 'english',
        }
        const filterValue = String(selectedSubjectFilter.value).toUpperCase()
        subjectToLoad = subjectMap[filterValue] || filterValue.toLowerCase() || 'math'
        // 更新 selectedSubject 以便后续使用
        selectedSubject.value = subjectToLoad

        // 使用 store 的 fetchQuestions 方法，它会优先从本地存储加载
        // fetchQuestions 方法会先尝试从本地存储加载，如果没有数据再请求API
        await questionStore.fetchQuestions(subjectToLoad, true)
      }

      // 从store获取去重后的题目列表
      questions.value = [...questionStore.questions]
    }

    if (questions.value.length > 0) {
      // 重置显示数量为初始值
      displayedCount.value = INITIAL_DISPLAY_COUNT

      // 等待 DOM 更新
      await nextTick()

      // 开始批量渲染
      renderingQuestions.value = true
      // 等待所有题目渲染完成
      await checkBatchRenderComplete()
    }
  } catch (error) {
    showMessage('加载题目失败: ' + ((error as Error)?.message || '未知错误'), 'error')
    renderingQuestions.value = false
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
    const storeIndex = questionStore.questions.findIndex(
      (q: ExerciseItem) => q.id === targetQuestion.id,
    )
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
      // 确定要删除的题目的科目
      const question = questions.value.find((q) => q.id === questionId || q.bmNo === questionId)
      const questionSubject = question?.subject || selectedSubject.value

      // 将 Subject 枚举值转换为科目名称
      const subjectMap: Record<string, string> = {
        SUBJECT_MATH: 'math',
        SUBJECT_BIOLOGY: 'biology',
        SUBJECT_CHEMISTRY: 'chemistry',
        SUBJECT_PHYSICS: 'physics',
        SUBJECT_CHINESE: 'chinese',
        SUBJECT_ENGLISH: 'english',
      }

      // 确定科目名称
      let subjectToDelete = selectedSubject.value
      if (questionSubject) {
        const subjectUpper = String(questionSubject).toUpperCase()
        if (subjectMap[subjectUpper]) {
          subjectToDelete = subjectMap[subjectUpper]
        } else if (subjectUpper.includes('BIOLOGY')) {
          subjectToDelete = 'biology'
        } else if (subjectUpper.includes('MATH')) {
          subjectToDelete = 'math'
        } else {
          subjectToDelete = subjectUpper.toLowerCase()
        }
      }

      // 使用API服务删除题目
      const success = await apiService.deleteExercise(questionId, subjectToDelete)

      if (success) {
        showMessage('题目删除成功', 'positive')

        // 删除成功后，强制从服务器重新获取题目列表
        const questionStore = useQuestionStore()

        // 根据当前筛选条件决定刷新方式
        if (selectedSubjectFilter.value === null) {
          // 全部学科：刷新所有学科的题目
          await questionStore.fetchAllSubjectsQuestions(false) // false 表示强制从服务器获取
        } else {
          // 具体学科：刷新指定学科的题目
          await questionStore.fetchQuestions(subjectToDelete, false) // false 表示强制从服务器获取
        }

        // 重新加载题目列表（会自动重置渲染状态）
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
      const questionContent = questionStore.currentQuestion.question || questionStore.currentQuestion.title || '题目内容为空'
      const initialMessage = `我们开始吧，${questionContent}`

      await aiExerciseStore.sendMessage(
        initialMessage,
        questionStore.currentQuestion,
        { id: '', userId: '' },
        'MATH',
        'mate',
        undefined,
        true, // hidePrefix: true，存储到本地时去除"我们开始吧"前缀
      )
    } else {
      // 如果store中没有找到题目，说明数据不同步，需要重新同步
      showMessage('题目数据不同步，请重新加载', 'warning')
      return
    }

    // 发出事件通知父组件切换到AI聊天界面
    emit('startAiGuidance', question)
  } catch (error) {
    // 发生错误时重置AI指导状态
    const questionStore = useQuestionStore()
    if (questionStore.currentQuestion) {
      questionStore.currentQuestion.isAiGuiding = false
      questionStore.currentQuestion.beginGuideToSolve = false
    }

    // 记录详细错误信息
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[QuestionList] 启动AI指导失败:', {
      error,
      errorMessage,
      questionId: question.id,
      questionTitle: question.question?.substring(0, 50) || '未知题目',
      timestamp: new Date().toISOString(),
    })

    // 根据错误类型显示更具体的错误提示
    let userMessage = '启动AI指导失败'
    if (
      errorMessage.includes('网络') ||
      errorMessage.includes('Network') ||
      errorMessage.includes('fetch')
    ) {
      userMessage = '启动AI指导失败：网络连接异常，请检查网络后重试'
    } else if (errorMessage.includes('超时') || errorMessage.includes('timeout')) {
      userMessage = '启动AI指导失败：请求超时，请稍后重试'
    } else if (
      errorMessage.includes('权限') ||
      errorMessage.includes('auth') ||
      errorMessage.includes('401') ||
      errorMessage.includes('403')
    ) {
      userMessage = '启动AI指导失败：权限不足，请重新登录'
    } else if (
      errorMessage.includes('服务器') ||
      errorMessage.includes('server') ||
      errorMessage.includes('500')
    ) {
      userMessage = '启动AI指导失败：服务器异常，请稍后重试'
    } else if (errorMessage) {
      userMessage = `启动AI指导失败：${errorMessage}`
    }

    showMessage(userMessage, 'error')
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

watch(
  renderingQuestions,
  (newVal) => {
  },
  { deep: true, immediate: true },
)

// 监听搜索变化，重置渲染状态
watch(
  searchQuery,
  async () => {
    // 搜索时重置所有渲染状态
    renderedQuestionIds.value.clear()
    renderedQuestions.clear()
    renderingQuestions.value = false
    // 重置显示数量
    displayedCount.value = INITIAL_DISPLAY_COUNT

    // 等待DOM更新
    await nextTick()

    // 开始批量渲染
    if (displayedQuestions.value.length > 0) {
      renderingQuestions.value = true
      await checkBatchRenderComplete()
    }
  },
  { immediate: false },
)

// 监听学科过滤变化，重置渲染状态并可能需要重新加载题目
watch(
  selectedSubjectFilter,
  async (newFilter) => {
    // 学科过滤时重置所有渲染状态
    renderedQuestionIds.value.clear()
    renderedQuestions.clear()
    renderingQuestions.value = false
    // 重置显示数量
    displayedCount.value = INITIAL_DISPLAY_COUNT

    const questionStore = useQuestionStore()

    if (newFilter === null) {
      // 全部学科：加载所有学科的题目
      await questionStore.fetchAllSubjectsQuestions(true)
      questions.value = [...questionStore.questions]
    } else {
      // 具体学科：加载指定学科的题目
      // 将 Subject 枚举值转换为科目名称
      const subjectMap: Record<string, string> = {
        SUBJECT_MATH: 'math',
        SUBJECT_BIOLOGY: 'biology',
        SUBJECT_CHEMISTRY: 'chemistry',
        SUBJECT_PHYSICS: 'physics',
        SUBJECT_CHINESE: 'chinese',
        SUBJECT_ENGLISH: 'english',
      }
      const filterValue = String(newFilter).toUpperCase()
      const targetSubject = subjectMap[filterValue] || filterValue.toLowerCase() || 'math'

      // 检查当前 store 中的题目是否属于目标科目
      const currentQuestions = questionStore.questions
      const hasTargetSubjectQuestions =
        currentQuestions.length > 0 &&
        currentQuestions.some((q) => {
          const qSubject = (q.subject || '').toLowerCase()
          return (
            qSubject === targetSubject ||
            qSubject.includes(targetSubject) ||
            targetSubject.includes(qSubject)
          )
        })

      // 如果当前没有目标科目的题目，需要重新加载
      if (!hasTargetSubjectQuestions) {
        selectedSubject.value = targetSubject
        await questionStore.fetchQuestions(targetSubject, true)
        questions.value = [...questionStore.questions]
      }
    }

    // 等待DOM更新
    await nextTick()

    // 开始批量渲染
    if (displayedQuestions.value.length > 0) {
      renderingQuestions.value = true
      await checkBatchRenderComplete()
    }
  },
  { immediate: false },
)

// 组件卸载时清理资源
onUnmounted(() => {
  // 清理所有 Intersection Observer
  intersectionObservers.forEach((observer) => {
    observer.disconnect()
  })
  intersectionObservers.clear()

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
  let resizeTimeout: ReturnType<typeof setTimeout>
  const handleResize = () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      // 重新测量所有已渲染的题目
      questionCardRefs.value.forEach((el, questionId) => {
        const index = displayList.value.findIndex((q) => q.id === questionId)
        if (index >= 0 && el) {
          const height = el.getBoundingClientRect().height
          if (height > 0) {
            questionHeights.value.set(questionId, height)
            indexToHeight.value.set(index, height)
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

  // 搜索容器
  .search-container {
    display: flex;
    padding: 12px 16px;
    background-color: #f7f6ff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    flex-shrink: 0;

    .photo-search-btn {
      padding: 4px;
      margin-right: 4px;
      min-width: 32px;
      min-height: 32px;

      .photo-search-icon {
        width: 35px;
        height: 35px;
        object-fit: contain;
      }

      &:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .search-input {
      width: 100%;

      :deep(.q-field__control) {
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background-color: #ffffff;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);

        &:hover {
          border-color: rgba(0, 0, 0, 0.15);
        }

        &.q-field--focused {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
        }
      }

      :deep(.q-field__native) {
        padding: 10px 16px;
        font-size: 14px;
        min-height: 40px;
      }

      :deep(.q-field__append) {
        padding-right: 12px;

        .q-icon {
          color: #5f6368;
          font-size: 20px;
        }
      }
    }
  }

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
      position: relative; // 确保可以相对定位伪元素
      .question-block {
        background-color: $background-white;
        border-radius: 12px;
        box-shadow: none;
      }

      // 用 ::before 画出紫色描边，不影响布局
      &::before {
        content: '';
        position: absolute;
        inset: 0;               // 覆盖整个 li 区域
        border-radius: 12px;
        pointer-events: none;
        box-shadow: 0 0 0 1px #8b5cf6; // 相当于 1px 边框，但不占空间
      }
    }
  }

  // 题目头部
  .question-header {
    @include flex-center;
    justify-content: space-between;
    background-color: transparent;
    border-bottom: none;
    height: 40px;
    @include responsive-padding(8px 20px 0 20px, 8px 20px 0 20px);

    .question-number {
      color: $text-primary;
      font-weight: 600;
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

    // 原生风格更多菜单气泡框
    .native-more-menu-card {
      border-radius: 18px;
      padding: 8px 10px 10px;
      min-width: 170px;
      background: #ffffff;
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.12),
        0 4px 12px rgba(0, 0, 0, 0.08);
      border: none;
    }

    .native-more-menu-list {
      :deep(.q-item) {
        &.native-more-menu-item {
          padding: 8px 10px;
          min-height: 40px;
        }

        .q-item__section {
          font-size: 14px;
        }
      }
    }

    // 收藏行上方稍微留出空间
    .native-more-menu-favorite {
      margin-top: 4px;
    }

    // 底部整块粉色删除区域
    .native-more-menu-delete-wrapper {
      margin-top: 8px;
      padding-top: 4px;
      border-radius: 14px;
      background: #ffeef0;
    }

    .native-more-menu-delete-item {
      padding: 10px 14px;

      :deep(.q-item__section) {
        color: #ff4b5c;
        font-weight: 500;
      }

      :deep(.q-icon) {
        color: #ff4b5c !important;
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
    cursor: pointer;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
    @include card-shadow(subtle);

    &:hover {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
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

// ===== 加载更多提示样式 =====
.load-more-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  width: 100%;
}

.load-more-text {
  text-align: center;
  color: $text-secondary;
  font-size: 14px;
}

// ===== 渲染中状态样式 =====
.rendering-container {
  @include flex-center;
  flex-direction: column;
  min-height: 300px;
  padding: 40px 20px;
  width: 100%;

  .rendering-text {
    margin-top: 16px;
    color: $text-secondary;
    font-size: 14px;
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
