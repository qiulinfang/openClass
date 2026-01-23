<template>
  <div class="homework-answer-view">
    <header class="answer-header">
      <div class="toolbar-left">
        <div class="back-btn" @click="goBack">
          <img :src="goBackIcon" alt="返回" class="back-icon" />
        </div>
      </div>
      <div class="answer-title">{{ displayTitle }}</div>
    </header>
    <div class="answer-body">
      <div class="left-panel">
        <QuestionList
          ref="questionListRef"
          type="homework"
          :search-query="questionSearchQuery"
          @update:searchQuery="(v) => (questionSearchQuery = v)"
          :external-questions="externalQuestions"
          :show-photo-search="false"
          :show-send-to-ai="false"
          @questionSelected="handleStartAnswer"
          @openMiniClass="handleOpenMiniClass"
        />
      </div>
      <div class="right-panel">
        <div class="drawing-board-wrapper">
          <DrawingBoardNew
            v-for="page in boardPageSlots"
            :key="page"
            :ref="(el) => setDrawingBoardRef(el, page)"
            v-show="currentPageIndex === page"
            :background-image="page === 0 ? questionBgImage : ''"
            :initial-zoom="70"
            @clear="handleClearRequest"
          >
            <template #toolbar-left>
              <CommonActionButton
                label="学伴辅导"
                variant="ghost"
                size="sm"
                :disabled="!hasSelectedQuestion"
                @click="handleGoToXueban"
              />
            </template>

            <template #toolbar-right>
              <CommonActionButton
                label="上传作业"
                variant="primary"
                size="sm"
                :disabled="!currentAnswerQuestion"
                @click="handleUploadHomework"
              />
            </template>
          </DrawingBoardNew>
        </div>
      </div>
    </div>

    <!-- 隐藏的题目渲染容器，用于生成截图 -->
    <div
      ref="questionRenderRef"
      class="question-render-hidden markdown-content"
      v-html="questionHtml"
    ></div>

    <!-- 上传对话框（相机上传 / 白板上传共用） -->
    <CameraUploadDialog
      v-model="showCameraDialog"
      :initial-photos="initialUploadPhotos"
      @confirm="handleUploadConfirm"
    />

    <Dialog
      ref="clearDialogRef"
      title="清空确认"
      :confirmButtonText="'清空'"
      :cancelButtonText="'取消'"
      @confirm="confirmClearCanvas"
    >
      确定要清空画布吗？此操作不可撤销。
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import QuestionList from '@/components/QuestionList.vue'
import DrawingBoardNew from '@/components/DrawingBoardNew.vue'
import CommonActionButton from '@/components/base/Button.vue'
import CameraUploadDialog from '@/components/dialog/CameraUploadDialog.vue'
import type { ExerciseItem } from '@/types'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import * as htmlToImage from 'html-to-image'
import { useUIStore } from '@/stores/uiStore'
import { getSubject } from '@/services'
import Dialog from '@/components/base/Dialog.vue'
import goBackIcon from '/icons/goback.svg'
import pagePrevIcon from '/icons/left.svg'
import pageAddIcon from '/icons/addPaper.svg'
import pageNextIcon from '/icons/right.svg'

defineOptions({
  name: 'HomeworkAnswerView',
})

const route = useRoute()
const router = useRouter()
const homeworkStore = useHomeworkStore()
const uiStore = useUIStore()

// 作业题目列表、当前选中索引和作业名称、作答缓存：从 homeworkStore 获取
const {
  questions: externalQuestions,
  currentQuestionIndex,
  homeworkName,
  answerDataCache,
} = storeToRefs(homeworkStore)

// 当前在白板上作答的题目
const currentAnswerQuestion = ref<ExerciseItem | null>(null)

// 上一道作答的题目（用于切题时保存数据）
const previousQuestionKey = ref<string>('')

// DrawingBoard 组件引用
const MAX_BOARD_PAGES = 3
const drawingBoardRefs = ref<Array<InstanceType<typeof DrawingBoardNew> | null>>([])

const setDrawingBoardRef = (el: any, pageIndex: number) => {
  drawingBoardRefs.value[pageIndex] = el as InstanceType<typeof DrawingBoardNew> | null
}

const boardPageSlots = computed(() => {
  const count = Math.min(Math.max(totalPages.value, 1), MAX_BOARD_PAGES)
  return Array.from({ length: count }, (_, i) => i)
})

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)

const questionSearchQuery = ref('')

// 是否有选中的题目（QuestionList 中选中即可，不需要渲染到 canvas）
const hasSelectedQuestion = computed(() => {
  return questionListRef.value?.selectedQuestionIndex !== undefined 
    && questionListRef.value.selectedQuestionIndex >= 0
})

// Markdown + 公式渲染工具
const { renderMessageContent } = useMessageRenderer()

// 当前题目的 HTML（用于截图）
const questionHtml = computed(() => {
  if (!currentAnswerQuestion.value) return ''
  const q = currentAnswerQuestion.value
  const raw = (q.question || q.title || '').toString()
  return renderMessageContent(raw)
})

// 截图用隐藏容器
const questionRenderRef = ref<HTMLElement | null>(null)

// 生成的题目截图 dataURL，传给 DrawingBoard 作为背景图
const questionBgImage = ref<string>('')

// 题目截图缓存：key = 题目唯一标识（优先 bmNo，其次 id）
const questionImageCache = new Map<string, string>()

// 当前题目的白板页索引和总页数（UI 显示用，真实数据存储在 answerDataCache 中）
const currentPageIndex = ref(0)
const totalPages = ref(1)

// 最近一次白板上传导出的图片与白板页索引映射：
// lastUploadPageIndices[i] = 对应 initialUploadPhotos[i] 的白板页索引
const lastUploadPageIndices = ref<number[]>([])

const title = computed(() => {
  const homeworkId = route.params.homeworkId as string | undefined
  return homeworkId ? `作业作答 - ${homeworkId}` : '作业作答'
})

// 展示用标题：优先显示作业名称，缺省时回退到原有 title
const displayTitle = computed(() => {
  return (homeworkName.value && homeworkName.value.trim()) || title.value
})

// 题目列表已从 homeworkStore 获取，根据 currentQuestionIndex 恢复当前选中题目
onMounted(async () => {
  if (!externalQuestions.value.length) return

  // 优先使用 store 中记录的选中索引
  let targetIndex = currentQuestionIndex.value ?? -1

  // 如果没有选中或索引越界，则默认选中第一题
  if (targetIndex < 0 || targetIndex >= externalQuestions.value.length) {
    targetIndex = 0
  }

  // 等待 QuestionList 渲染完成后再调用滚动
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 300))

  if (questionListRef.value && typeof questionListRef.value.scrollToQuestionAndSelect === 'function') {
    questionListRef.value.scrollToQuestionAndSelect(targetIndex)
  }

  // 同步到右侧作答区域
  const targetQuestion = externalQuestions.value[targetIndex]
  handleStartAnswer(targetQuestion)
})

// 获取题目唯一标识
const getQuestionKey = (question: ExerciseItem | null): string => {
  if (!question) return ''
  return (question.bmNo || question.id || '').toString()
}

// 获取指定题目的白板缓存结构（兼容旧数据结构）
const getBoardCache = (questionKey: string): { pages: any[]; currentPageIndex: number } => {
  const raw = (answerDataCache.value as Record<string, any>)[questionKey]

  if (raw && Array.isArray(raw.pages)) {
    const idx = typeof raw.currentPageIndex === 'number' ? raw.currentPageIndex : 0
    return {
      pages: raw.pages,
      currentPageIndex: idx < raw.pages.length ? idx : 0,
    }
  }

  if (raw) {
    return {
      pages: [raw],
      currentPageIndex: 0,
    }
  }

  return {
    pages: [],
    currentPageIndex: 0,
  }
}

// 调试：监听当前白板页索引变化
watch(
  currentPageIndex,
  (val, oldVal) => {
    console.log('[HomeworkAnswerView] currentPageIndex changed', {
      from: oldVal,
      to: val,
      hasQuestionBgImage: !!questionBgImage.value,
    })
  }
)

// 保存当前题目当前页的作答数据到全局缓存
const saveCurrentPage = () => {
  if (!currentAnswerQuestion.value) return
  const board = drawingBoardRefs.value[currentPageIndex.value]
  if (!board) return

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  if (!questionKey) return

  const data = board.saveData()
  if (!data) return

  const cache = getBoardCache(questionKey)
  const pageIndex = typeof currentPageIndex.value === 'number' ? currentPageIndex.value : (cache.currentPageIndex ?? 0)
  if (!cache.pages || !Array.isArray(cache.pages)) {
    cache.pages = []
  }
  cache.pages[pageIndex] = data
  cache.currentPageIndex = pageIndex

  ;(answerDataCache.value as Record<string, any>)[questionKey] = cache
  console.log('[HomeworkAnswerView] 保存当前页作答数据到全局缓存:', questionKey, 'page', pageIndex)
}

const handleClearRequest = () => {
  clearDialogRef.value?.openDialog()
}

const confirmClearCanvas = () => {
  const board = drawingBoardRefs.value[currentPageIndex.value]
  if (!board) {
    clearDialogRef.value?.closeDialog()
    return
  }

  // 先清空画布数据
  board.loadData({
    objects: [],
    history: [[]],
    historyIndex: 0,
  })

  // 再调用clearAll来重置工具状态
  board.clearAll()

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  if (questionKey) {
    const cache = getBoardCache(questionKey)
    const pageIndex = typeof currentPageIndex.value === 'number' ? currentPageIndex.value : (cache.currentPageIndex ?? 0)

    if (!cache.pages || !Array.isArray(cache.pages)) {
      cache.pages = []
    }

    const clearedData = board.saveData()
    cache.pages[pageIndex] = clearedData || { objects: [], history: [[]], historyIndex: 0 }
    cache.currentPageIndex = pageIndex

    ;(answerDataCache.value as Record<string, any>)[questionKey] = cache
  }

    clearDialogRef.value?.closeDialog()
}

const cancelClearCanvas = () => {
    clearDialogRef.value?.closeDialog()
}

// 根据缓存恢复当前题目的当前页到画布
const restoreCurrentPage = (question: ExerciseItem | null) => {
  const questionKey = getQuestionKey(question)
  if (!questionKey) {
    currentPageIndex.value = 0
    totalPages.value = 1
    drawingBoardRefs.value.forEach((b) => b?.clearAll())
    return
  }

  const cache = getBoardCache(questionKey)
  totalPages.value = Math.min(cache.pages.length > 0 ? cache.pages.length : 1, MAX_BOARD_PAGES)
  currentPageIndex.value = Math.min(cache.currentPageIndex ?? 0, totalPages.value - 1)

  nextTick(() => {
    for (let i = 0; i < totalPages.value; i++) {
      const board = drawingBoardRefs.value[i]
      if (!board) continue
      if (cache.pages.length > 0 && cache.pages[i]) {
        board.loadData(cache.pages[i] as any)
      } else {
        board.clearAll()
      }
    }
  })
}

// QuestionList 左侧点击“开始作答”时触发，将题目发送到右侧白板
const handleStartAnswer = (question: ExerciseItem) => {
  // 1. 保存当前题目当前页的作答数据（如果有）
  saveCurrentPage()

  // 2. 切换到新题目
  currentAnswerQuestion.value = question
  const newKey = getQuestionKey(question)
  previousQuestionKey.value = newKey

  // 3. 恢复新题目的当前页作答数据（如果有缓存）
  nextTick(() => {
    restoreCurrentPage(question)
  })
}

// 题目 HTML 变化时：等待 DOM 更新后截图
watch(
  questionHtml,
  async (html) => {
    if (!html || !currentAnswerQuestion.value) {
      questionBgImage.value = ''
      return
    }

    const val = currentAnswerQuestion.value
    const key = (val.bmNo || val.id || '').toString()
    // 如果已有缓存，直接复用，避免重复截图 
    if (key && questionImageCache.has(key)) {
      questionBgImage.value = questionImageCache.get(key) || ''
      return
    }

    // 等待 v-html 渲染到 DOM（关键：等待两次 nextTick 确保 DOM 更新完成）
    await nextTick()
    await nextTick()
    
    // 额外等待一小段时间确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const el = questionRenderRef.value
    if (!el) { 
      console.warn('[HomeworkAnswerView] questionRenderRef 为空，放弃本次题目截图')
      return
    }
    
    // 确保 v-html 内容已渲染到 DOM
    if (!el.innerHTML || el.innerHTML.trim() === '') {
      console.warn('[HomeworkAnswerView] 隐藏容器内容为空，等待渲染...')
      await new Promise(resolve => setTimeout(resolve, 100))
      await nextTick()
    }

    try {
      // 先清除上一题在该容器上的 MathJax 渲染状态，然后再渲染当前题目的公式
      // await MathJaxUtils.clearMath(el)
      // 对于截图场景，需要等待 MathJax 完全排版完成后再生成 PNG
      await MathJaxUtils.renderMathAndWait(el)

      // 统一规范题目内图片的布局：清理自身宽高属性，限制最大宽度为容器宽度
      const imgs = el.querySelectorAll('img')
      imgs.forEach((img) => {
        img.removeAttribute('width')
        img.removeAttribute('height')
        ;(img as HTMLImageElement).style.width = 'auto'
        ;(img as HTMLImageElement).style.height = 'auto'
        ;(img as HTMLImageElement).style.maxWidth = '100%'
      })

      // 开发环境：将题目 DOM 中 src 指向 imates.com.cn/temporaryImg 的 <img>
      // 改写为相对路径 /temporaryImg/...，方便通过 Vite devServer 代理解决 CORS；
      // 生产环境：直接使用接口返回的完整路径，不做重写，由后端部署决定访问方式。
      if (import.meta.env.DEV) {
        imgs.forEach((img) => {
          const src = img.getAttribute('src') || ''
          if (!src) return

          let newSrc = src
          const httpPrefix = 'http://imates.com.cn/temporaryImg/'
          const httpsPrefix = 'https://imates.com.cn/temporaryImg/'

          if (src.startsWith(httpPrefix)) {
            newSrc = '/temporaryImg/' + src.substring(httpPrefix.length)
          } else if (src.startsWith(httpsPrefix)) {
            newSrc = '/temporaryImg/' + src.substring(httpsPrefix.length)
          }

          if (newSrc !== src) {
            console.log('[HomeworkAnswerView] 重写题目图片 URL(dev):', src, '=>', newSrc)
            img.setAttribute('src', newSrc)
            ;(img as HTMLImageElement).crossOrigin = 'anonymous'
          }
        })
      }

      // 使用 html-to-image 将题目 DOM 转为图片（基于 SVG foreignObject，性能优于 html2canvas）
      const dataUrl = await htmlToImage.toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 1.5,
        cacheBust: true,
      })
      console.log('[HomeworkAnswerView] 截图成功，dataUrl 长度 =', dataUrl?.length)
      questionBgImage.value = dataUrl

      // 写入缓存，后续再次作答同一题目时直接复用
      if (key) {
        questionImageCache.set(key, dataUrl)
      }

      console.log('[HomeworkAnswerView] questionBgImage updated', {
        questionKey: key,
        dataUrlLength: dataUrl?.length || 0,
        hasCurrentQuestion: !!currentAnswerQuestion.value,
      })
    } catch (e) {
      console.error('[HomeworkAnswerView] 使用 html-to-image 生成题目截图失败:', e)
      questionBgImage.value = ''
    }
  },
  { immediate: false }
)

const goBack = () => {
  router.push({ name: 'myHomework' })
}

// 打开微课（复用 ExerciseSolveView 中的逻辑）
const handleOpenMiniClass = (question: ExerciseItem) => {
  try {
    const bmNo = (question.bmNo || '').trim()
    if (!bmNo) {
      showMessage('题目编号缺失，无法打开微课', 'warning')
      return
    }

    // 规范化学科前缀
    const subjectRaw =
      (question.subject || getSubject() || 'SUBJECT_MATH').toString().toUpperCase()
    let subjectPrefix = 'math'
    if (subjectRaw.includes('BIOLOGY')) subjectPrefix = 'biology'
    else if (subjectRaw.includes('MATH')) subjectPrefix = 'math'
    else if (subjectRaw.includes('CHEMISTRY')) subjectPrefix = 'chemistry'
    else if (subjectRaw.includes('PHYSICS')) subjectPrefix = 'physics'
    else if (subjectRaw.includes('CHINESE')) subjectPrefix = 'chinese'
    else if (subjectRaw.includes('ENGLISH')) subjectPrefix = 'english'

    const classUrl = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`

    if (!classUrl || classUrl.trim() === '') {
      showMessage('该题目暂无微课', 'warning')
      return
    }

    const questionTitle = question.title || question.question?.substring(0, 50) || ''
    uiStore.openMiniClassDialog(classUrl, questionTitle)
  } catch (error) {
    console.error('[HomeworkAnswerView] 打开微课失败:', error)
    showMessage('打开微课失败', 'error')
  }
}

// 去学伴按钮点击 - 跳转到作业答题专用路由
const handleGoToXueban = () => {
  // 1. 先保存当前题目当前页的作答数据到全局缓存，避免跳转后丢失
  saveCurrentPage()

  // 2. 获取 QuestionList 选中的题目，作为跳转参数
  const selectedQuestion = questionListRef.value?.getSelectedQuestion?.()
  if (!selectedQuestion) return
  
  const questionId = selectedQuestion.bmNo || selectedQuestion.id
  router.push({ 
    name: 'homeworkExercise',
    query: { questionId: questionId?.toString(), tab: 'chatAi', scene: 'homework' }
  })
}

// 上传对话框显示状态
const showCameraDialog = ref(false)
// 初始照片列表（白板上传时使用）
const initialUploadPhotos = ref<string[]>([])

const clearDialogRef = ref<InstanceType<typeof Dialog>>()

// 上传作业按钮点击：先执行白板导出逻辑（handleBoardUpload）
// handleBoardUpload 内部会根据现有白板页导出图片并打开上传对话框
const handleUploadHomework = async () => {
  await handleBoardUpload()
}

// 白板上传按钮点击 - 导出画布图片并打开对话框
const handleBoardUpload = async () => {
  if (!currentAnswerQuestion.value) return

  console.log('[HomeworkAnswerView][handleBoardUpload] start', {
    questionKey: getQuestionKey(currentAnswerQuestion.value),
    currentPageIndex: currentPageIndex.value,
  })

  // 1. 先保存当前页内容到缓存
  saveCurrentPage()

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  if (!questionKey) return

  const cache = getBoardCache(questionKey)

  console.log('[HomeworkAnswerView][handleBoardUpload] after saveCurrentPage', {
    pagesLength: cache.pages.length,
    cacheCurrentPageIndex: cache.currentPageIndex,
  })

  // 2. 如果没有任何页，直接返回
  if (!cache.pages.length) {
    showMessage('当前没有可上传的白板页', 'warning')
    return
  }

  const originalPageIndex = cache.currentPageIndex ?? 0
  const photos: string[] = []
  const pageIndexMap: number[] = []

  // 3. 直接从每一页独立画板导出（最多3页）
  const pageCount = Math.min(cache.pages.length, MAX_BOARD_PAGES)
  for (let i = 0; i < pageCount; i++) {
    const board = drawingBoardRefs.value[i]
    if (!board) continue

    // 先保存一次，保证缓存与页面内容一致
    const latest = board.saveData?.()
    if (latest && cache.pages) {
      cache.pages[i] = latest
    }

    const imageData = board.exportToJpg?.(0.9)
    if (imageData) {
      photos.push(imageData)
      pageIndexMap.push(i)
    }
  }

  // 4. 还原索引与缓存（不会影响画板实例状态）
  cache.currentPageIndex = Math.min(originalPageIndex, pageCount - 1)
  ;(answerDataCache.value as Record<string, any>)[questionKey] = cache
  currentPageIndex.value = cache.currentPageIndex
  totalPages.value = pageCount

  console.log('[HomeworkAnswerView][handleBoardUpload] restore current page done', {
    questionKey,
    restorePageIndex: originalPageIndex,
    totalPages: cache.pages.length,
    photosCount: photos.length,
    hasQuestionBgImage: !!questionBgImage.value,
  })

  if (photos.length) {
    // 记录本次上传图片与白板页索引的映射
    lastUploadPageIndices.value = pageIndexMap
    initialUploadPhotos.value = photos
    showCameraDialog.value = true
  } else {
    showMessage('当前没有可上传的白板页', 'warning')
  }
}

// 白板页控制：上一页
const handlePrevPage = () => {
  if (!currentAnswerQuestion.value) return

  saveCurrentPage()

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  const cache = getBoardCache(questionKey)

  if (cache.pages.length <= 1 || cache.currentPageIndex <= 0) return

  cache.currentPageIndex -= 1
  ;(answerDataCache.value as Record<string, any>)[questionKey] = cache

  totalPages.value = cache.pages.length
  currentPageIndex.value = cache.currentPageIndex
}

// 白板页控制：下一页
const handleNextPage = () => {
  if (!currentAnswerQuestion.value) return

  saveCurrentPage()

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  const cache = getBoardCache(questionKey)

  if (cache.pages.length <= 1 || cache.currentPageIndex >= cache.pages.length - 1) return

  cache.currentPageIndex += 1
  ;(answerDataCache.value as Record<string, any>)[questionKey] = cache

  totalPages.value = cache.pages.length
  currentPageIndex.value = cache.currentPageIndex
}

// 白板页控制：新增白板页
const handleAddPage = () => {
  if (!currentAnswerQuestion.value) return

  if (totalPages.value >= MAX_BOARD_PAGES) {
    showMessage(`最多只能添加 ${MAX_BOARD_PAGES} 页白板`, 'warning')
    return
  }

  saveCurrentPage()

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  const cache = getBoardCache(questionKey)

  if (!cache.pages || !Array.isArray(cache.pages)) {
    cache.pages = []
  }

  cache.pages.push(null)
  cache.currentPageIndex = cache.pages.length - 1

  ;(answerDataCache.value as Record<string, any>)[questionKey] = cache

  totalPages.value = Math.min(cache.pages.length, MAX_BOARD_PAGES)
  currentPageIndex.value = cache.currentPageIndex

  nextTick(() => {
    drawingBoardRefs.value[currentPageIndex.value]?.clearAll()
  })
}

// 上传确认回调
const handleUploadConfirm = async (photos: string[]) => {
  if (!photos.length) {
    showMessage('请选择要上传的图片', 'warning')
    return
  }
  
  // 获取当前题目 ID
  const questionId = currentAnswerQuestion.value?.id || currentAnswerQuestion.value?.bmNo
  if (!questionId) {
    showMessage('请先选择题目', 'warning')
    return
  }
  
  try {
    // 如果这是一次白板上传（存在最近一次的页索引映射），
    // 需要根据用户保留的图片计算需要保留/删除的白板页，并更新 answerDataCache。
    if (lastUploadPageIndices.value.length && initialUploadPhotos.value.length) {
      const originalPhotos = initialUploadPhotos.value

      // 计算 originalPhotos 中哪些位置被保留（按内容匹配，考虑重复时按顺序消费）
      const keepFlags = new Array(originalPhotos.length).fill(false)
      const used = new Array(photos.length).fill(false)

      for (let i = 0; i < originalPhotos.length; i++) {
        const p = originalPhotos[i]
        let found = -1
        for (let j = 0; j < photos.length; j++) {
          if (!used[j] && photos[j] === p) {
            found = j
            used[j] = true
            break
          }
        }
        if (found !== -1) {
          keepFlags[i] = true
        }
      }

      const keptPageIndices: number[] = []
      for (let i = 0; i < originalPhotos.length; i++) {
        if (keepFlags[i]) {
          const pageIdx = lastUploadPageIndices.value[i]
          if (typeof pageIdx === 'number') {
            keptPageIndices.push(pageIdx)
          }
        }
      }

      console.log('[HomeworkAnswerView][handleUploadConfirm] 计算保留白板页', {
        originalPhotosCount: originalPhotos.length,
        confirmPhotosCount: photos.length,
        lastUploadPageIndices: lastUploadPageIndices.value.slice(),
        keptPageIndices: keptPageIndices.slice(),
      })

      if (currentAnswerQuestion.value) {
        const questionKey = getQuestionKey(currentAnswerQuestion.value)
        if (questionKey) {
          const cache = getBoardCache(questionKey)

          if (keptPageIndices.length === 0) {
            // 用户删除了本次上传的所有图片：视为本题所有白板页废弃
            cache.pages = []
            cache.currentPageIndex = 0
            ;(answerDataCache.value as Record<string, any>)[questionKey] = cache
            currentPageIndex.value = 0
            totalPages.value = 1
            drawingBoardRefs.value.forEach((b) => b?.clearAll())
            console.log('[HomeworkAnswerView][handleUploadConfirm] 所有白板页被删除，清空缓存', {
              questionKey,
            })
          } else {
            // 根据保留的页索引重建 pages，并计算新的 currentPageIndex
            const uniqueKept = Array.from(new Set(keptPageIndices)).sort((a, b) => a - b)

            const newPages: any[] = []
            const originalToNew = new Map<number, number>()
            uniqueKept.forEach((pageIdx, newIdx) => {
              if (pageIdx >= 0 && pageIdx < cache.pages.length) {
                newPages.push(cache.pages[pageIdx])
                originalToNew.set(pageIdx, newIdx)
              }
            })

            cache.pages = newPages

            let newCurrent = 0
            if (originalToNew.has(cache.currentPageIndex)) {
              newCurrent = originalToNew.get(cache.currentPageIndex) || 0
            } else if (newPages.length > 0) {
              newCurrent = newPages.length - 1
            }

            cache.currentPageIndex = newCurrent
            ;(answerDataCache.value as Record<string, any>)[questionKey] = cache

            currentPageIndex.value = newCurrent
            totalPages.value = newPages.length > 0 ? newPages.length : 1

            nextTick(() => {
              for (let i = 0; i < Math.min(totalPages.value, MAX_BOARD_PAGES); i++) {
                const board = drawingBoardRefs.value[i]
                if (!board) continue
                if (newPages.length > 0 && newPages[i]) {
                  board.loadData(newPages[i] as any)
                } else {
                  board.clearAll()
                }
              }
            })

            console.log('[HomeworkAnswerView][handleUploadConfirm] 更新白板页缓存', {
              questionKey,
              newPagesLength: newPages.length,
              newCurrent,
            })
          }
        }
      }
    }


    // 使用所有选择的图片作为答案内容（base64 字符串数组）
    const answerContent = photos
    
    const success = await apiService.submitTopicAnswer(questionId, answerContent)
    
    if (success) {
      showMessage('提交成功', 'success')
      showCameraDialog.value = false
    } else {
      showMessage('提交失败，请重试', 'error')
    }
  } catch (error) {
    console.error('[HomeworkAnswerView] 提交答案异常:', error)
    showMessage('提交失败，请重试', 'error')
  }
}
</script>

<style scoped> 
.homework-answer-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f3ff;
}
 
.answer-header {
  height: 56px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f002e;
  color: #ffffff;
  position: relative;
}

.answer-title {
  font-size: 18px;
  font-weight: 600;
}

.toolbar-left {
  position: absolute;
  left: 24px;
  z-index: 10;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  background: transparent;
  transition: background-color 0.15s ease;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.back-icon {
  width: 25px;
  height: 25px;
}

.answer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  width: 30%;
  min-width: 280px;
  max-width: 420px;
  border-right: 1px solid rgba(17, 24, 39, 0.08);
  background: #f9fafb;
  overflow: hidden;
}

.right-panel {
  flex: 1;
  background: #ffffff;
  overflow: hidden;
  max-width: 100%;
  position: relative;
}

.drawing-board-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.question-render-hidden {
  position: fixed;
  top: 0;
  left: 0;
  width: 600px;
  background: #ffffff;
  opacity: 1;
  pointer-events: none;
  z-index: -1;
}

.question-render-hidden img {
  max-width: 300px;
  height: auto;
}


.more-menu-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
  font-size: 14px;
  line-height: 1.4;
  padding: 6px 6px;
  cursor: pointer;
}

.delete-confirm-content {
  height: 100%;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  border: none;
}

.more-menu-item-row:hover {
  background-color: rgba(15, 23, 42, 0.03);
}

.more-menu-item-row > .q-icon {
  flex-shrink: 0;
}

/* 底部白板页控制按钮样式 */
.page-controls-bottom {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 4px 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.05);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 左右页切换图标尺寸（略小） */
.nav-icon-left,
.nav-icon-right {
  width: 42px;
  height: 42px;
}

/* 中间新增页图标尺寸（略大一点） */
.nav-icon-center {
  width: 42px;
  height: 42px;
}

.page-btn.add-page-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
}

.page-btn.add-page-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5);
}

.page-btn.add-page-btn .add-icon {
  width: 100%;
  height: 100%;
  filter: brightness(0) invert(1);
}

.page-info-bottom {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  margin-left: 4px;
}
</style>
