<template>
  <div class="question-list" @click.stop>
    <!-- 全局加载遮罩 -->
    <div
      v-if="loading || renderingQuestions"
      class="question-list-loading-overlay"
    >
      <div class="question-list-loading-spinner"></div>
      <div class="question-list-loading-text">题目加载中...</div>
    </div>
    <!-- 搜索输入框 -->
    <div class="search-container">
      <!-- 拍照搜题按钮：根据策略能力和 props 决定是否显示 -->
      <q-btn v-if="props.showPhotoSearch !== false && strategy.canPhotoSearch()" flat round dense class="photo-search-btn" @click="handlePhotoSearch">
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

    <!-- 题目列表 - 卡片布局，使用 RubberBandList 实现橡皮筋滚动、下拉刷新（分页模式） -->
    <RubberBandList
      ref="scrollContainer"
      class="question-cards-container"
      :enable-refresh="true"
      :refresh-threshold="100"
      :enable-load-more="false"
      :loading="renderingQuestions"
      @refresh="handlePullDownRefresh"
    >
      <!-- 空状态：根据策略获取文案 -->
      <div v-if="displayedQuestions.length === 0 && !loading" class="native-empty-state">
        <q-icon name="quiz" size="80px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7 native-text-3xl">
          {{ searchQuery || selectedSubjectFilter ? strategy.getNoResultText() : strategy.getEmptyText() }}
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
      <div v-if="displayedQuestions.length > 0" class="question-cards-list">
        <div
          v-for="(question, index) in displayedQuestions"
          :key="question.bmNo"
          class="question-item-wrapper"
          :data-index="index"
        >
          <!-- 实际题目 -->
          <div
            ref="(el) => setQuestionCardRef(el as HTMLElement | null, question.bmNo, index)"
            class="question-card"
            :class="{
              'question-selected': isQuestionSelected(question.bmNo),
              'question-deleting': deletingIds.has(question.bmNo),
            }"
            @click.stop="selectQuestion(question, index)"
          >
            <div class="question-block">
              <!-- 题目头部 -->
              <div class="question-header">
                <!-- 左侧：题目序号 + 状态 -->
                <div class="question-title-row">
                  <div class="question-number">题目{{ getQuestionDisplayIndex(question.bmNo) }}</div>
                  <!-- 题目状态插槽 -->
                  <slot name="question-status" :question="question" :index="index" />
                </div>

                <!-- 右侧：功能区（仅当前题目选中时显示更多按钮） -->
                <div class="question-actions" v-if="isQuestionSelected(question.bmNo)">
                  <q-btn
                    v-if="strategy.canSendToAi() && props.showSendToAi !== false"
                    flat
                    round
                    dense
                    size="sm"
                    class="action-btn"
                    @click.stop="throttledSendToAi(question)"
                  >
                    <img :src="askXuebanIcon" alt="问问学伴" class="action-icon" />
                  </q-btn>

                  <q-btn
                    v-if="strategy.canOpenMiniClass()"
                    flat
                    round
                    dense
                    size="sm"
                    class="action-btn"
                    @click.stop="throttledOpenMiniClass(question)"
                  >
                    <img :src="weikeIcon" alt="微课" class="action-icon" />
                  </q-btn>

                  <!-- 更多按钮 + 自定义气泡框 BubblePopup -->
                  <BubblePopup
                    v-model="showMoreMenu[question.bmNo]"
                    placement="bottom"
                    :offset="8"
                    :show-arrow="false"
                  >
                    <template #trigger>
                      <q-btn
                        icon="more_vert"
                        color="grey-7"
                        flat
                        round
                        size="sm"
                        class="action-btn more-btn"
                      >
                      </q-btn>
                    </template>

                    <ActionList :items="buildMoreActions(question, index)">
                      <!-- 额外操作插槽：例如“开始作答”等，由父组件通过插槽扩展 -->
                      <template #extra>
                        <slot
                          name="more-extra"
                          :question="question"
                          :index="index"
                          :close="() => closeMoreMenuById(question.bmNo)"
                        />
                      </template>
                    </ActionList>
                  </BubblePopup>
                </div>
              </div>

              <!-- 题目内容 -->
              <div class="question-content-area">
                <div
                  class="markdown-content question-content"
                  v-html="renderMessageContent(question?.question || question?.title || '暂无内容')"
                  v-paste-to-draft="makePasteToDraftHandler(question.bmNo)"
                  :ref="(el) => handleContentRef(el, question.bmNo)"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部分页器 -->
      <div v-if="displayList.length > 0 && totalPages > 1" class="question-pagination">
        <q-pagination
          v-model="currentPage"
          :max="totalPages"
          :max-pages="7"
          direction-links
          size="md"
          @update:model-value="handlePageChange"
        />
        <div class="pagination-info">
          第 {{ currentPage }} / {{ totalPages }} 页，共 {{ displayList.length }} 题
        </div>
      </div>
    </RubberBandList>

    <!-- 微课对话框 -->
    <MiniClass
      v-model="showMiniClassDialog"
      :class-url="miniClassUrl"
      :question-title="miniClassQuestionTitle"
    />


    <!-- 图片预览对话框 -->
    <ImageViewer v-model="showImagePreview" :image-url="previewImageUrl" alt="题目图片" />

    <!-- 删除题目确认对话框（使用 Dialog 组件，插槽中维护删除聊天记录和草稿开关） -->
    <Dialog
      v-if="showDeleteDialog"
      ref="deleteDialogRef"
      :title="'确定要删除这道题目吗？'"
      :confirmButtonText="'删除'"
      :cancelButtonText="'取消'"
      @confirm="deleteQuestion"
      @cancel="cancelDeleteDialog"
    >
      <div class="delete-dialog-options">
        <q-toggle
          class="delete-dialog-toggle"
          v-model="deleteWithChat"
          label="同时删除该题目的对话记录"
          dense
          color="#6e55ff"
          keep-color
        />
        <q-toggle
          class="delete-dialog-toggle"
          v-model="deleteWithDraft"
          label="同时删除该题目的草稿"
          dense
          color="#6e55ff"
          keep-color
        />
      </div>
    </Dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showMessage, ThrottleUtils, throttle } from '../utils'
import { useQuestionStore } from '../stores/questionStore'
import { useHomeworkStore } from '../stores/homeworkStore'
import { useAiExerciseChatStore } from '../stores/aiExerciseChatStore'
import { useUIStore } from '../stores/uiStore'
import type { ExerciseItem } from '../types'
import { apiService } from '../services/http/api-service'
import { MathJaxUtils } from '../utils/math/mathjax'
import { useMessageRenderer } from '../composables/useMessageRenderer'

import MiniClass from './MiniClass.vue'
import ImageViewer from './ImageViewer.vue'
import RubberBandList from './base/VirtualList.vue'
import Dialog from './base/Dialog.vue'
import BubblePopup from './base/Popover.vue'
import ActionList from './ActionList.vue'
import { toggleExerciseFavorite, getFavoriteExercises } from '../utils/storage/favorites'
import { normalizeSubject } from '../constants/subjects'

// 策略模式支持
import type { QuestionListType } from './question/strategies'
import { createQuestionListStrategy } from './question/strategies'

// 导入拍照搜题图标
import searchQuestionIcon from '/icons/search_question.svg'
// 导入功能图标
import zhidingIcon from '/icons/zhiding.svg'
import quxiaozhidingIcon from '/icons/quxiaozhiding.svg'
import shoucangIcon from '/icons/shoucang1.svg'
import xingxingLightIcon from '/icons/xingxing-light.svg'
import askXuebanIcon from '/icons/askXueban.svg'
import weikeIcon from '/icons/weike.svg'

const props = withDefaults(defineProps<{
  searchQuery?: string
  selectedSubjectFilter?: string | null
  // 当父组件传入题目列表时，QuestionList 仅负责展示和操作，不再自行从 store/API 加载
  externalQuestions?: ExerciseItem[]
  // 是否显示拍照搜题按钮，默认 true
  showPhotoSearch?: boolean
  // 是否显示“发送给AI”操作，默认 true；可在作业作答页关闭
  showSendToAi?: boolean
  // 题目列表类型：exercise（我的习题，默认）或 homework（我的作业）
  type?: QuestionListType
}>(), {
  showSendToAi: true,
})

const emit = defineEmits<{
  startAiGuidance: [question: ExerciseItem]
  questionSelected: [question: ExerciseItem, index: number]
  openMiniClass: [question: ExerciseItem]
  'update:searchQuery': [value: string]
  'questionDeleted': [payload: { questionId: string; withDraft: boolean }]
  'paste-to-draft': [payload: { dataUrl: string; questionId: string }]
}>()

const makePasteToDraftHandler = (questionId: string) => {
  return (dataUrl: string) => emit('paste-to-draft', { dataUrl, questionId })
}

// 创建策略实例（根据 type prop 决定使用哪个策略）
const strategy = computed(() => createQuestionListStrategy(props.type || 'exercise'))

// 响应式数据
const questions = ref<ExerciseItem[]>([])
const selectedSubject = ref('math')
const selectedQuestionIndex = ref(-1)
const loading = ref(true)

// 分屏组件模型值
const PAGE_SIZE = 50 // 每页显示50题
const INITIAL_DISPLAY_COUNT = PAGE_SIZE // 初始显示的题目数量
const LOAD_MORE_COUNT = PAGE_SIZE // 每次加载更多的题目数量
const displayedCount = ref(INITIAL_DISPLAY_COUNT) // 已显示的题目数量
const currentPage = ref(1) // 当前页码

// 从 props 获取搜索和过滤状态
// 兼容两种模式：
// 1) 受控：父组件传入 searchQuery，并通过 update:searchQuery 更新
// 2) 非受控：父组件不传 searchQuery，由组件内部维护
const internalSearchQuery = ref('')
const searchQuery = computed(() => {
  return props.searchQuery !== undefined ? (props.searchQuery || '') : internalSearchQuery.value
}) //搜索关键词
const selectedSubjectFilter = computed(() => props.selectedSubjectFilter || null) //全部学科

// 处理搜索输入
const handleSearchInput = (value: string | number | null) => {
  const next = (value || '').toString()
  if (props.searchQuery !== undefined) {
    emit('update:searchQuery', next)
  } else {
    internalSearchQuery.value = next
  }
}

// 题目 Store（保留用于 sendToAi 等习题特有功能）
const questionStore = useQuestionStore()

// 当前选中的题目（从策略获取）
const currentQuestion = computed(() => strategy.value.getCurrentQuestion())

// 路由
const router = useRouter()

// 当前科目（用于拍照搜题）
const currentSubjectForPhotoSearch = computed(() => {
  const current = currentQuestion.value
  if (current?.subject) {
    return normalizeSubject(current.subject)
  }
  // 如果没有当前题目，将selectedSubjectFilter转换为小写格式
  if (selectedSubjectFilter.value) {
    return normalizeSubject(selectedSubjectFilter.value)
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
  return currentQuestion.value.bmNo === questionId
}

// 题目全局序号映射：根据原始 questions 列表的位置计算（从 1 开始）
const questionIndexMap = computed(() => {
  const map = new Map<string, number>()
  questions.value.forEach((q, idx) => {
    if (q.bmNo) {
      map.set(q.bmNo, idx)
    }
  })
  return map
})

const getQuestionDisplayIndex = (questionId: string): number => {
  const idx = questionIndexMap.value.get(questionId)
  return typeof idx === 'number' ? idx + 1 : 0
}

// 题目删除相关
const deletingIds = ref(new Set<string>()) //题目ID集合
const contentRefs = ref<Map<string, HTMLElement>>(new Map()) //题目卡片引用
const intersectionObservers = new Map<string, IntersectionObserver>() //题目卡片观察者

// 题目渲染完成状态（用于更精确控制加载中的时长）
const questionRenderedMap = ref<Map<string, boolean>>(new Map()) //题目ID -> 渲染完成状态映射

// 更多菜单显示状态
const showMoreMenu = ref<Record<string, boolean>>({})

// 图片预览相关状态
const showImagePreview = ref(false)
const previewImageUrl = ref<string>('')

// 加载状态（用于驱动 RubberBandList 底部“正在加载...” 提示）
const renderingQuestions = ref(false)

// 动态高度测量相关（方案A）
const questionHeights = ref<Map<string, number>>(new Map()) // 题目ID -> 高度映射
const indexToHeight = ref<Map<number, number>>(new Map()) // 索引 -> 高度映射（便于快速查找）
const questionCardRefs = ref<Map<string, HTMLElement>>(new Map()) // 实际题目卡片引用
const resizeObservers = new Map<string, ResizeObserver>() // ResizeObserver映射
const heightMeasurementTimers = new Map<string, ReturnType<typeof setTimeout>>() // 延迟测量定时器

const deleteDialogRef = ref<InstanceType<typeof Dialog> | null>(null)

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
    const filterSubject = normalizeSubject(selectedSubjectFilter.value)
    result = result.filter((question) => normalizeSubject((question as any).subject) === filterSubject)
  }

  // 再应用搜索过滤
  if (searchQuery.value?.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(
      (question) =>
        (question.title && question.title.toLowerCase().includes(query)) ||
        (question.question && question.question.toLowerCase().includes(query))
    )
  }

  return result
})

// 显示的列表（应用了搜索和学科过滤）
const displayList = computed(() => {
  return filteredQuestions.value
})

// 总页数
const totalPages = computed(() => {
  const total = displayList.value.length
  return total === 0 ? 1 : Math.ceil(total / PAGE_SIZE)
})

// 已显示的题目列表（按页分页，每页50条）
const displayedQuestions = computed(() => {
  const page = Math.min(currentPage.value, totalPages.value)
  const start = (page - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  return displayList.value.slice(start, end)
})

// 是否还有更多题目（分页模式下不再使用loadMore）
const hasMoreQuestions = computed(() => {
  return false
})

// 滚动容器引用（用于滚动定位与 RubberBandList 实例）
const scrollContainer = ref<InstanceType<typeof RubberBandList> | HTMLElement | null>(null)

// 先声明 setQuestionCardRef，稍后实现
let setQuestionCardRefImpl: (
  el: HTMLElement | null,
  questionId: string,
  index: number
) => void = () => {}

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


      // 渲染MathJax
      await MathJaxUtils.renderMath(el, false)

      // 给图片添加点击事件监听器
      await nextTick()
      attachImageClickListeners(el)

      // 标记该题目已完成渲染（包括公式和图片处理）
      questionRenderedMap.value.set(questionId, true)
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
  }
)

const throttledSendToAi = throttle((question: ExerciseItem) => {
  sendToAi(question)
}, 3000) // 3秒节流，防止频繁发送给AI

const throttledOpenMiniClass = ThrottleUtils.fast((question: ExerciseItem) => {
  openMiniClass(question)
})

const showDeleteDialog = ref(false)
const deleteTargetQuestion = ref<ExerciseItem | null>(null)
const deleteWithChat = ref(false)
const deleteWithDraft = ref(false)

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
    favoriteStatus.value.set(f.item.bmNo, true)
  })
}

// 切换收藏状态
const toggleFavorite = (item: ExerciseItem) => {
  const wasFavorite = isExerciseFavorite(item.bmNo)
  const success = toggleExerciseFavorite(item)

  if (success) {
    // 更新收藏状态
    favoriteStatus.value.set(item.bmNo, !wasFavorite)
    showMessage(!wasFavorite ? '已收藏' : '已取消收藏', 'success')
  } else {
    showMessage('操作失败，请重试', 'error')
  }
}

const throttledToggleFavorite = ThrottleUtils.fast((item: ExerciseItem) => {
  toggleFavorite(item)
})

// 通用操作列表：构造更多菜单的 actions（根据策略能力决定显示哪些操作）
const buildMoreActions = (question: ExerciseItem, index: number) => {
  const bmNo = question.bmNo
  const currentStrategy = strategy.value

  const wrap = (handler: () => void) => {
    if (!bmNo) return () => {}
    return () => closeMenuAndExecute(bmNo, handler)
  }

  return [
    {
      key: 'pin',
      label: index === 0 ? '取消置顶' : '置顶',
      icon: index === 0 ? quxiaozhidingIcon : zhidingIcon,
      visible: currentStrategy.canMoveToTop(),
      onClick: wrap(() => throttledMoveToTop(bmNo)),
    },
    {
      key: 'favorite',
      label: isExerciseFavorite(bmNo) ? '取消收藏' : '收藏题目',
      icon: isExerciseFavorite(bmNo) ? xingxingLightIcon : shoucangIcon,
      visible: currentStrategy.canFavorite(),
      onClick: wrap(() => throttledToggleFavorite(question)),
    },
    {
      key: 'delete',
      label: deletingIds.value.has(bmNo) ? '删除中...' : '删除题目',
      icon: 'icons/delete.svg',
      iconClass: deletingIds.value.has(bmNo) ? 'icon-loading' : '',
      visible: currentStrategy.canDelete(),
      loading: deletingIds.value.has(bmNo),
      onClick: wrap(() => openDeleteDialog(question)),
    },
  ]
}

// 根据题目的 subject 字段推断用于 AI 接口的学科（'MATH' 或 'BIOLOGY'）
const getAiSubjectFromQuestion = (question: ExerciseItem): 'MATH' | 'BIOLOGY' => {
  const s = normalizeSubject((question as any).subject)
  return s === 'biology' ? 'BIOLOGY' : 'MATH'
}


const openDeleteDialog = (question: ExerciseItem) => {
  deleteTargetQuestion.value = question
  deleteWithChat.value = false
  deleteWithDraft.value = false
  showDeleteDialog.value = true

  nextTick(() => {
    if (deleteDialogRef.value && typeof (deleteDialogRef.value as any).openDialog === 'function') {
      ;(deleteDialogRef.value as any).openDialog()
    }
  })
}

const resetDeleteState = () => {
  showDeleteDialog.value = false
  deleteTargetQuestion.value = null
  deleteWithChat.value = false
  deleteWithDraft.value = false
}

const getSubjectToDelete = (question: ExerciseItem) => {
  const questionSubject = question.subject || selectedSubject.value
  let subjectToDelete = selectedSubject.value
  if (questionSubject) {
    subjectToDelete = questionSubject.toLowerCase()
  }
  return subjectToDelete
}

const applyLocalRemove = (question: ExerciseItem) => {
  const currentStrategy = strategy.value
  const storeQuestions = currentStrategy.getQuestions()
  const storeIndex = storeQuestions.findIndex(
    (q: ExerciseItem) => q.id === question.id || q.bmNo === question.bmNo
  )
  if (storeIndex !== -1) {
    storeQuestions.splice(storeIndex, 1)
  }

  const localIndex = questions.value.findIndex(
    (q) => q.id === question.id || q.bmNo === question.bmNo
  )
  if (localIndex !== -1) {
    questions.value.splice(localIndex, 1)
  }
}

const showDeleteToast = () => {
  if (deleteWithChat.value) {
    showMessage('题目及相关对话记录已删除', 'success')
    return
  }
  if (deleteWithDraft.value) {
    showMessage('题目及草稿已删除', 'success')
    return
  }
  showMessage('题目删除成功', 'positive')
}

const refreshAfterDelete = async (subjectToDelete: string) => {
  const currentStrategy = strategy.value
  if (selectedSubjectFilter.value === null) {
    await currentStrategy.fetchAllSubjectsQuestions(false)
    return
  }
  await currentStrategy.fetchQuestions({ subject: subjectToDelete, useLocalFirst: false })
}

const deleteQuestion = async () => {
  if (!deleteTargetQuestion.value) return

  const question = deleteTargetQuestion.value

  if (!question.bmNo) {
    showMessage('无法确定要删除的题目', 'error')
    return
  }

  deletingIds.value.add(question.bmNo)
  cleanupQuestionHeight(question.bmNo)

  try {
    const subjectToDelete = getSubjectToDelete(question)
    console.log(`[QuestionList] ✅ 删除题目 ${question} 的科目是 ${subjectToDelete}`)

    const success = await apiService.deleteExercise(question.id, subjectToDelete)
    if (!success) {
      showMessage('题目删除失败', 'error')
      return
    }

    if (deleteWithChat.value && question.bmNo) {
      const aiExerciseStore = useAiExerciseChatStore()
      await aiExerciseStore.clearChatHistory(question.bmNo)
    }

    applyLocalRemove(question)

    emit('questionDeleted', { questionId: question.id, withDraft: deleteWithDraft.value })
    showDeleteToast()
    await refreshAfterDelete(subjectToDelete)
  } catch (error) {
    showMessage('删除题目时出错: ' + (error as Error).message, 'error')
  } finally {
    deletingIds.value.delete(question.bmNo)
    resetDeleteState()
  }
}

// 取消删除对话框
const cancelDeleteDialog = () => {
  // 关闭对话框并重置相关状态
  if (deleteDialogRef.value && typeof (deleteDialogRef.value as any).closeDialog === 'function') {
    ;(deleteDialogRef.value as any).closeDialog()
  }
  resetDeleteState()
}

// 切换更多菜单显示状态
const toggleMoreMenu = (questionId: string) => {
  const currentValue = showMoreMenu.value[questionId] || false
  showMoreMenu.value[questionId] = !currentValue
}

// 仅关闭指定题目的更多菜单
const closeMoreMenuById = (questionId: string) => {
  showMoreMenu.value[questionId] = false
}

// 关闭更多菜单并执行操作
const closeMenuAndExecute = (questionId: string, action: () => void) => {
  closeMoreMenuById(questionId)
  action()
}

const throttledLoadQuestions = ThrottleUtils.verySlow(() => {
  loadQuestions()
}) // 1秒节流，防止重复加载

// 滚动处理逻辑改由 RubberBandList 的 loadMore 事件触发

// 加载更多题目
const loadMoreQuestions = async () => {
  if (renderingQuestions.value || !hasMoreQuestions.value) return

  try {
    console.log('[QuestionList] 加载更多题目: before', {
      displayedCount: displayedCount.value,
      total: displayList.value.length,
    })
    renderingQuestions.value = true
    displayedCount.value = Math.min(
      displayedCount.value + LOAD_MORE_COUNT,
      displayList.value.length
    )
    console.log('[QuestionList] 加载更多题目: after', {
      displayedCount: displayedCount.value,
      total: displayList.value.length,
    })
    setTimeout(() => {
      renderingQuestions.value = false
    }, 2000)
  } catch (error) {
    console.error('[QuestionList] ❌ 加载更多题目失败:', error)
  }
}

const loadQuestions = async () => {
  // 如果父组件通过 externalQuestions 传入题目列表，则不再自行加载，只同步本地列表
  if (props.externalQuestions && Array.isArray(props.externalQuestions)) {
    questions.value = [...props.externalQuestions]
    if (questions.value.length > 0) {
      displayedCount.value = INITIAL_DISPLAY_COUNT
      currentPage.value = 1
    }
    loading.value = false
    return
  }
  
  const currentStrategy = strategy.value
  console.log('[QuestionList] 开始加载题目', {
    type: props.type || 'exercise',
    selectedSubjectFilter: selectedSubjectFilter.value,
  })
  loading.value = true

  try {
    // 如果策略的 store 中已有题目，直接使用
    if (currentStrategy.hasQuestions()) {
      console.log('[QuestionList] 使用 store 缓存题目', {
        count: currentStrategy.getQuestions().length,
      })
      questions.value = [...currentStrategy.getQuestions()]
    } else {
      // 如果 store 中没有题目，需要确定科目并加载
      if (selectedSubjectFilter.value === null) {
        // 全部学科：加载所有学科的题目
        console.log('[QuestionList] 从服务器加载全部学科题目')
        await currentStrategy.fetchAllSubjectsQuestions(true)
      } else {
        // 具体学科：加载指定学科的题目
        // selectedSubjectFilter 现在是大写枚举格式，需要转换为小写
        const subjectToLoad = selectedSubjectFilter.value.toLowerCase()
        selectedSubject.value = subjectToLoad

        console.log('[QuestionList] 从服务器加载单一学科题目', { subjectToLoad })
        await currentStrategy.fetchQuestions({ subject: subjectToLoad, useLocalFirst: true })
      }

      // 从策略获取题目列表
      questions.value = [...currentStrategy.getQuestions()]
    }

    if (questions.value.length > 0) {
      displayedCount.value = INITIAL_DISPLAY_COUNT
      currentPage.value = 1
      console.log('[QuestionList] 加载题目完成', {
        total: questions.value.length,
        initialDisplay: displayedCount.value,
      })
    }
  } catch (error) {
    showMessage('加载题目失败: ' + ((error as Error)?.message || '未知错误'), 'error')
  } finally {
    console.log('[QuestionList] 结束加载题目')
    loading.value = false
  }
}

// 刷新题目列表数据（不重新加载，保持当前状态）
const refreshQuestions = () => {
  // 从策略的 store 同步最新的题目列表
  const currentStrategy = strategy.value
  questions.value = [...currentStrategy.getQuestions()]

  // 保持当前选中的题目索引
  const currentIndex = currentStrategy.getCurrentQuestionIndex()
  if (currentIndex >= 0 && currentIndex < questions.value.length) {
    selectedQuestionIndex.value = currentIndex
  }
}

// 下拉刷新处理（由 RubberBandList 触发）
// 要求：强制重新请求接口，而不是只同步本地 store
const handlePullDownRefresh = async () => {
  // 外部题目模式：仅同步 externalQuestions，不请求服务器
  if (props.externalQuestions && Array.isArray(props.externalQuestions)) {
    try {
      console.log('[QuestionList] 下拉刷新（外部题目模式）')
      if (props.externalQuestions) {
        questions.value = [...props.externalQuestions]
      }
    } finally {
      const container = scrollContainer.value as any
      if (container && typeof container.finishRefresh === 'function') {
        container.finishRefresh()
      }
    }
    return
  }
  
  const currentStrategy = strategy.value
  try {
    console.log('[QuestionList] 下拉刷新开始', {
      type: props.type || 'exercise',
      selectedSubject: selectedSubject.value,
      filter: selectedSubjectFilter.value,
    })

    // 根据当前筛选条件决定刷新范围
    if (selectedSubjectFilter.value === null) {
      // 全部学科：强制从服务器拉取所有学科题目
      await currentStrategy.fetchAllSubjectsQuestions(false)
    } else {
      // 单一学科：强制从服务器拉取
      const subjectToRefresh = normalizeSubject(
        (selectedSubjectFilter.value || selectedSubject.value || 'math').toString()
      )
      await currentStrategy.fetchQuestions({ subject: subjectToRefresh, useLocalFirst: false })
    }

    // 接口成功后，同步本地 questions 列表和当前选中索引
    refreshQuestions()
    console.log('[QuestionList] 下拉刷新完成', {
      total: questions.value.length,
    })
  } catch (error) {
    showMessage('刷新失败，请稍后重试', 'error')
  } finally {
    const container = scrollContainer.value as any
    if (container && typeof container.finishRefresh === 'function') {
      container.finishRefresh()
    }
  }
}

// 搜索和过滤逻辑已通过计算属性实现，通过 watch 监听 props 变化来重置渲染状态

// 题目选择方法
const selectQuestion = async (question: ExerciseItem, index: number) => {
  if (index >= 0 && index < questions.value.length) {
    selectedQuestionIndex.value = index

    // 通过策略选择题目
    const currentStrategy = strategy.value
    const storeQuestions = currentStrategy.getQuestions()
    const storeIndex = storeQuestions.findIndex(
      (q: ExerciseItem) => q.bmNo === question.bmNo
    )

    if (storeIndex >= 0) {
      await currentStrategy.selectQuestion(storeIndex)
    }

    // 发出题目选择事件
    emit('questionSelected', question, index)
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

    // 获取实际的滚动容器 DOM 元素
    // scrollContainer 可能是 RubberBandList 组件实例或原生 HTMLElement
    let actualContainer: HTMLElement | null = null
    const container = scrollContainer.value as any
    if (container.scrollContainerRef) {
      // RubberBandList 组件，获取其内部的滚动容器
      actualContainer = container.scrollContainerRef
    } else if (container instanceof HTMLElement) {
      // 原生 HTMLElement
      actualContainer = container
    }

    if (!actualContainer) {
      return
    }

    // 找到目标元素
    const targetElement = actualContainer.querySelector(`[data-index="${indexToScroll}"]`)
    if (targetElement) {
      const containerHeight = actualContainer.clientHeight
      const elementTop = (targetElement as HTMLElement).offsetTop
      const elementHeight = (targetElement as HTMLElement).offsetHeight

      // 计算滚动位置，使目标元素居中
      const targetScrollTop = Math.max(0, elementTop - (containerHeight - elementHeight) / 2)

      // 滚动到目标位置
      actualContainer.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      })
    }
  } catch {
    // 滚动失败
  }
}

// 分页切换处理
const handlePageChange = (page: number) => {
  currentPage.value = page

  // 切页后回到列表顶部
  nextTick(() => {
    const container = document.querySelector('.question-cards-container') as HTMLElement | null
    if (container) {
      // 直接跳到顶部，不使用平滑滚动
      container.scrollTop = 0
    }
  })
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

    // 通过策略更新当前选中的题目
    const currentStrategy = strategy.value
    const targetQuestion = list[targetIndex]
    const storeQuestions = currentStrategy.getQuestions()
    const storeIndex = storeQuestions.findIndex(
      (q: ExerciseItem) => q.bmNo === targetQuestion.bmNo
    )
    if (storeIndex >= 0) {
      await currentStrategy.selectQuestion(storeIndex)
    }

    // 等待DOM更新后滚动
    await nextTick()
    scrollToCurrentQuestion(targetIndex)
  } catch {
    // 滚动选择失败
  }
}

// 题目置顶/取消置顶处理
const moveQuestionToTop = async (questionId: string) => {
  try {
    const currentIndex = questions.value.findIndex((q) => q.bmNo === questionId)
    if (currentIndex < 0) return // 找不到题目

    const currentStrategy = strategy.value

    if (currentIndex === 0) {
      // 已经在顶部，取消置顶 - 移到最后
      const question = questions.value.splice(currentIndex, 1)[0]
      questions.value.push(question)

      // 取消置顶后，选择原来位置（现在是最后）
      const newIndex = questions.value.length - 1
      selectedQuestionIndex.value = newIndex
      await currentStrategy.selectQuestion(newIndex)

      showMessage('已取消置顶', 'positive')
    } else {
      // 不在顶部，置顶操作
      const question = questions.value.splice(currentIndex, 1)[0]
      questions.value.unshift(question)

      // 置顶后，直接将置顶的题目标记为选中（索引 0）
      selectedQuestionIndex.value = 0
      await currentStrategy.selectQuestion(0)

      // 题目置顶后滚动到最顶部
      await nextTick()
      const container = document.querySelector('.question-cards-container')
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }

    // 通过策略同步到 store
    await currentStrategy.setQuestions(questions.value, selectedSubject.value)

  } catch {
    showMessage('操作失败', 'error')
  }
}

// 拍照搜题功能已移至父组件 ExerciseSolveView

// 发送给AI
const sendToAi = async (question: ExerciseItem) => {
  try {
    
    // 发出事件通知父组件切换到AI聊天界面
    emit('startAiGuidance', question)
    const aiExerciseStore = useAiExerciseChatStore()

    // 根据题目 subject 计算要传给 AI 的学科
    const aiSubject = getAiSubjectFromQuestion(question)

    // 根据当前列表类型 / 策略判断使用哪个 store
    const isHomeworkType = strategy.value?.getListTitle?.() === '我的作业' || props.type === 'homework'

    if (isHomeworkType) {
      // 作业场景：使用 homeworkStore
      const homeworkStore = useHomeworkStore()

      const storeIndex = homeworkStore.questions.findIndex(
        (q: ExerciseItem) => q.bmNo === question.bmNo
      )
      if (storeIndex < 0) {
        showMessage('题目数据不同步，请重新加载', 'warning')
        return
      }

      await homeworkStore.selectQuestion(storeIndex)

      const current = homeworkStore.currentQuestion
      if (!current) {
        showMessage('请先选择一道题目', 'warning')
        return
      }

      const questionBmNo = current.bmNo
      await aiExerciseStore.clearChatHistory(questionBmNo)

      const questionContent = current.question || current.title || '题目内容为空'
      const initialMessage = `我们开始吧，${questionContent}`

      await aiExerciseStore.sendMessage(
        initialMessage,
        current,
        { id: '', userId: '' },
        aiSubject,
        'mate',
        undefined,
        true,
      )
    } else {
      // 习题场景：沿用 questionStore 逻辑
      const questionStore = useQuestionStore()

      const storeIndex = questionStore.questions.findIndex(
        (q: ExerciseItem) => q.bmNo === question.bmNo
      )
      if (storeIndex < 0) {
        showMessage('题目数据不同步，请重新加载', 'warning')
        return
      }

      // 使用store中的索引来选择题目
      await questionStore.selectQuestion(storeIndex)

      // 检查是否选择了题目
      if (!questionStore.currentQuestion) {
        showMessage('请先选择一道题目', 'warning')
        return
      }

      // 标记当前题目正在进行AI指导
      questionStore.currentQuestion.isAiGuiding = true
      questionStore.currentQuestion.beginGuideToSolve = true

      // 清除聊天记录
      const questionBmNo = questionStore.currentQuestion.bmNo
      await aiExerciseStore.clearChatHistory(questionBmNo)
      // 发送题目内容给AI进行分析（每次都是新的开始）
      const questionContent =
        questionStore.currentQuestion.question ||
        questionStore.currentQuestion.title ||
        '题目内容为空'
      const initialMessage = `我们开始吧，${questionContent}`

      await aiExerciseStore.sendMessage(
        initialMessage,
        questionStore.currentQuestion,
        { id: '', userId: '' },
        aiSubject,
        'mate',
        undefined,
        true, // hidePrefix: true，存储到本地时去除"我们开始吧"前缀
      )
    }

  } catch (error) {
    // 发生错误时重置AI指导状态（仅对习题场景有效）
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
      questionId: question.bmNo,
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

// 监听搜索变化，重置分页
watch(
  searchQuery,
  () => {
    displayedCount.value = INITIAL_DISPLAY_COUNT
    currentPage.value = 1
  },
  { immediate: false }
)

// 监听外部传入的题目列表变化（例如 HomeworkAnswerView 在 onMounted 后解析路由再赋值）
watch(
  () => props.externalQuestions,
  (newVal) => {
    if (newVal && Array.isArray(newVal)) {
      questions.value = [...newVal]
      if (questions.value.length > 0) {
        displayedCount.value = INITIAL_DISPLAY_COUNT
        currentPage.value = 1
      }
    }
  },
  { immediate: false }
)

// 监听学科过滤变化，重置分页并可能需要重新加载题目
watch(
  selectedSubjectFilter,
  async (newFilter) => {
    // 外部题目模式：不触发任何 store/API 加载，仅重置分页，让过滤逻辑基于 externalQuestions 生效
    if (props.externalQuestions && Array.isArray(props.externalQuestions)) {
      displayedCount.value = INITIAL_DISPLAY_COUNT
      currentPage.value = 1
      return
    }
    
    // 学科过滤时重置显示数量和页码
    displayedCount.value = INITIAL_DISPLAY_COUNT
    currentPage.value = 1

    const currentStrategy = strategy.value

    if (newFilter === null) {
      // 全部学科：加载所有学科的题目
      await currentStrategy.fetchAllSubjectsQuestions(true)
      questions.value = [...currentStrategy.getQuestions()]
    } else {
      // 具体学科：加载指定学科的题目
      const filterValue = String(newFilter).toUpperCase()
      const targetSubject = filterValue.toLowerCase()

      // 检查当前策略的 store 中的题目是否属于目标科目
      const currentQuestions = currentStrategy.getQuestions()
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
        await currentStrategy.fetchQuestions({ subject: targetSubject, useLocalFirst: true })
        questions.value = [...currentStrategy.getQuestions()]
      }
    }
  },
  { immediate: false }
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
  { deep: true }
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
        const index = displayList.value.findIndex((q) => q.bmNo === questionId)
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
  // 暴露选中状态
  selectedQuestionIndex,
  getSelectedQuestion: () => {
    if (selectedQuestionIndex.value >= 0 && selectedQuestionIndex.value < questions.value.length) {
      return questions.value[selectedQuestionIndex.value]
    }
    return null
  },
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
  background-color: #f7f6ff;
  position: relative;

  // 仅在题目列表页内覆盖 Quasar 主色为紫色
  // 所有使用 color="primary" / text-primary 的组件都会呈现为紫色
  --q-primary: #5f6368;

  // 搜索容器
  .search-container {
    display: flex;
    padding: 12px 16px;
    background-color: #f7f6ff;
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
  }

  // 分页器容器（Gemini 风格）
  .question-pagination {
    padding: 12px 12px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background-color: #f7f6ff;

    :deep(.q-pagination) {
      display: inline-flex;
      align-items: center;
      gap: 4px;

      .q-btn {
        min-width: 32px;
        min-height: 32px;
        padding: 0 10px;
        border-radius: 16px;
        font-size: 12px;
        text-transform: none;
        box-shadow: none;
        background-color: transparent;
        color: $text-secondary;

        &.q-btn--active,
        &.q-btn--standard.q-btn--active {
          background-color: $primary-color-light;
          color: $primary-color;
          @include card-shadow(subtle);
        }

        &:hover:not(.q-btn--active) {
          background-color: $background-hover;
        }

        .q-icon {
          font-size: 16px;
        }
      }
    }

    .pagination-info {
      font-size: 12px;
      color: $text-secondary;
      text-align: center;
    }
  }

  // 题目卡片列表容器
  .question-cards-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 4px 0;
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
        box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2), $shadow-hover;
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

      // 选中时题目内容颜色变为黑色
      .question-content-area {
        .question-content,
        .markdown-content {
          color: #393548;
        }
      }

      // 用 ::before 画出紫色描边，不影响布局
      &::before {
        content: '';
        position: absolute;
        inset: 0; // 覆盖整个 li 区域
        border-radius: 12px;
        pointer-events: none;
        box-shadow: 0 0 0 1px #8b5cf6; // 相当于 1px 边框，但不占空间
      }

      // 选中时题目序号也变为黑色
      .question-header .question-number {
        color: #393548;
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
      color: #9792AC;
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

      .action-icon {
        width: 16px;
        height: 16px;
        display: block;
      }

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

    // 题目标题行（序号+状态插槽）
    .question-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;
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

.question-list-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  z-index: 1;
}

.question-list-loading-spinner {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 3px solid #6e55ff;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}

.delete-dialog-toggle {
  :deep(.q-toggle__track) {
    background-color: #6e55ff;
  }

  :deep(.q-toggle__inner--truthy .q-toggle__thumb:after) {
    background-color: #6e55ff;
  }

  :deep(body.desktop .q-toggle:not(.disabled) .q-toggle__thumb:before) {
    background-color: #6e55ff;
  }
}

// ===== Markdown 内容样式 =====
.markdown-content {
  font-size: 14px !important;
  line-height: 1.5;
  color: #9792AC;
  overflow-x: auto;
  overflow-y: hidden;
  word-wrap: break-word;
  word-break: break-word;

  // MathJax 公式样式处理
  :deep(mjx-container),
  :deep(mjx-container.MathJax),
  :deep(.mjx-chtml),
  :deep(.mjx-math) {
    overflow-x: auto !important;
    overflow-y: hidden !important;
    max-width: 300px !important;
    display: inline-block !important; /* 所有公式都用 inline-block */
    vertical-align: middle !important;
    scrollbar-width: none !important; /* Firefox */
    -ms-overflow-style: none !important; /* IE/Edge */

    &::-webkit-scrollbar {
      display: none !important; /* Chrome/Safari/Opera */
    }
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
    color: #9792AC;
  }

  :deep(em) {
    font-style: italic;
    color: #9792AC;
  }

  :deep(code) {
    background-color: $background-grey;
    padding: 3px 6px;
    border-radius: 6px;
    font-family: 'Google Sans Mono', 'Courier New', monospace;
    font-size: 0.9em;
    color: #9792AC;
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
    display: block;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
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
    color: #9792AC;
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
    color: #9792AC;
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
    color: #9792AC;
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

.question-header {
  .question-number {
    font-size: 12px;
    color: #9792AC;
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

.markdown-content {
  font-size: 13px !important;
  color: #9792AC;
  overflow: visible;
}

@media (max-width: 480px) {
  .question-list {
    .question-cards-container {
      .question-card {
        .question-header {
          .question-number {
            font-size: 11px;
            color: #9792AC;
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
    animation: gemini-dialog-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
