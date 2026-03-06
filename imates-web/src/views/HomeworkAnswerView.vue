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
      <FloatBubble
        :items="floatMenuItems"
        class="textbookip-float"
        @select="handleFloatMenuSelect"
      >
        <img :src="textbookipIcon" alt="textbookip" />
      </FloatBubble>
      <div class="left-panel">
        <QuestionList
          ref="questionListRef"
          type="homework"
          :search-query="questionSearchQuery"
          @update:searchQuery="(v) => (questionSearchQuery = v)"
          :external-questions="externalQuestions"
          :show-photo-search="false"
          :show-send-to-ai="false"
          :show-question-actions="false"
          @questionSelected="handleStartAnswer"
          @openMiniClass="handleOpenMiniClass"
        >
          <template #question-status="{ question }">
            <StatusTag
              :text="getQuestionStatusText(question)"
              :type="getQuestionStatusType(question)"
              size="xs"
            />
          </template>
        </QuestionList>
      </div>
      <div class="right-panel">
        <div class="right-panel-options">
          <MultiSelect
            v-model="currentQuestionChooseList"
            :options="rightPanelOptions"
            vertical
          />
        </div>
        <div class="drawing-board-wrapper">
          <DrawingBoardNew
            :ref="(el) => setDrawingBoardRef(el, 0)"
            :background-image="questionBgImage"
            :initial-zoom="70"
            @clear="handleClearRequest"
          >
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
      :question-index-map="lastUploadPageIndices"
      @confirm="handleUploadConfirm"
    />

    <Dialog
      ref="clearDialogRef"
      title="清空确认"
      :confirmButtonText="'清空'"
      :cancelButtonText="'取消'"
      @confirm="confirmClearCanvas"
      @cancel="cancelClearCanvas"
    >
      确定要清空画布吗？此操作不可撤销。
    </Dialog>

    <!-- 漏题确认对话框 -->
    <Dialog
      ref="incompleteHomeworkDialogRef"
      title="作业提交确认"
      :confirmButtonText="'继续提交'"
      :cancelButtonText="'取消提交'"
      @confirm="handleIncompleteHomeworkConfirm"
      @cancel="handleIncompleteHomeworkCancel"
    >
      <div class="incomplete-homework-content">
        第{{ incompleteDialogData.incompleteQuestionNumbers.join('、') }}题未完成，确定要提交吗？
      </div>
    </Dialog>

    <Dialog
      ref="xuebanLimitDialogRef"
      title="提示"
      :confirmButtonText="'知道了'"
      :cancelButtonText="'关闭'"
      @confirm="handleXuebanLimitDialogConfirm"
      @cancel="handleXuebanLimitDialogCancel"
    >
      当前作业老师只允许自己思考作答哦
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import QuestionList from '@/components/QuestionList.vue'
import DrawingBoardNew from '@/components/drawingBoardNew.vue'
import FloatBubble from '@/components/base/FloatBubble.vue'
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
import { normalizeSubject } from '@/constants/subjects'
import Dialog from '@/components/base/Dialog.vue'
import StatusTag from '@/components/base/StatusTag.vue'
import goBackIcon from '/icons/goback.svg'
import pagePrevIcon from '/icons/left.svg'
import pageAddIcon from '/icons/addPaper.svg'
import pageNextIcon from '/icons/right.svg'
import textbookipIcon from '/icons/textbookip.png'
import wodezuodaSelectIcon from '/icons/wodezuoda_select.svg'
import xuebandayiUnselectIcon from '/icons/xuebandayi_unselect.svg'
import MultiSelect from '@/components/base/MultiSelect.vue'

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

const setDrawingBoardRef = (el: InstanceType<typeof DrawingBoardNew> | null, pageIndex: number) => {
  drawingBoardRefs.value[pageIndex] = el
}

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)

const questionSearchQuery = ref('')

const rightPanelOptions = ['A', 'B', 'C', 'D']

// 当前题目的选中选项（从缓存中获取或默认空字符串）
const currentQuestionChooseList = computed({
  get: () => {
    const questionKey = getQuestionKey(currentAnswerQuestion.value)
    if (!questionKey) return []
    const cache = (answerDataCache.value as Record<string, any>)[questionKey]
    return cache?.chooseList || []
  },
  set: (value: string[]) => {
    const questionKey = getQuestionKey(currentAnswerQuestion.value)
    if (!questionKey) return
    const cache = (answerDataCache.value as Record<string, any>)[questionKey] || {}
    cache.chooseList = value
    ;(answerDataCache.value as Record<string, any>)[questionKey] = cache
  },
})

// Float 气泡菜单配置
const floatMenuItems = computed(() => {
  return [
    { label: '学伴辅导', icon: xuebandayiUnselectIcon },
    { label: '我的作答', icon: wodezuodaSelectIcon },
  ]
})

const handleFloatMenuSelect = async (item: { label: string }) => {
  if (item.label === '学伴辅导') {
    xuebanLimitDialogRef.value?.openDialog()
    // handleGoToXueban();
  } else if (item.label === '我的作答') {
    // 作业作答页本身就是“我的作答”，这里只需关闭菜单即可
    return
  }
}

const xuebanLimitDialogRef = ref<InstanceType<typeof Dialog>>()

const handleXuebanLimitDialogConfirm = () => {
  xuebanLimitDialogRef.value?.closeDialog()
}

const handleXuebanLimitDialogCancel = () => {
  xuebanLimitDialogRef.value?.closeDialog()
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
    query: { questionId: questionId?.toString(), tab: 'chatAi', scene: 'homework' },
  })
}


// 是否有选中的题目（QuestionList 中选中即可，不需要渲染到 canvas）
const hasSelectedQuestion = computed(() => {
  return (
    questionListRef.value?.selectedQuestionIndex !== undefined &&
    questionListRef.value.selectedQuestionIndex >= 0
  )
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

  // 初始化所有题目状态为未作答
  externalQuestions.value.forEach((question) => {
    const questionKey = getQuestionKey(question)
    if (questionKey) {
      const cache = (answerDataCache.value as Record<string, any>)[questionKey]
      if (!cache) {
        // 初始化未作答状态
        // 初始化题目的缓存数据结构
        ;(answerDataCache.value as Record<string, any>)[questionKey] = {
          boardData: { objects: [], history: [[]], historyIndex: 0 }, // 画板状态数据
          imageData: null, // 导出的图片数据
          chooseList: [], // 选择的选项（A/B/C/D）
          timestamp: Date.now(), // 创建时间戳
        }
        console.log(`[HomeworkAnswerView] 初始化题目状态为未作答: ${questionKey}`)
      }
    }
  })

  // 优先使用 store 中记录的选中索引
  let targetIndex = currentQuestionIndex.value ?? -1

  // 如果没有选中或索引越界，则默认选中第一题
  if (targetIndex < 0 || targetIndex >= externalQuestions.value.length) {
    targetIndex = 0
  }

  // 等待 QuestionList 渲染完成后再调用滚动
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 300))

  if (
    questionListRef.value &&
    typeof questionListRef.value.scrollToQuestionAndSelect === 'function'
  ) {
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

// 获取指定题目的白板缓存结构（简化版，单页）
const getBoardCache = (questionKey: string): { pages: Record<string, unknown>[] } => {
  const raw = (answerDataCache.value as Record<string, any>)[questionKey]

  if (raw) {
    return {
      pages: [raw],
    }
  }

  return {
    pages: [],
  }
}

// 获取题目状态
type QuestionStatus = 'unanswered' | 'answered'

const hasBoardAnswerData = (boardData: any): boolean => {
  const objects = boardData?.objects
  return Array.isArray(objects) && objects.length > 0
}

const getQuestionStatus = (question: ExerciseItem): QuestionStatus => {
  const questionKey = getQuestionKey(question)
  if (!questionKey) return 'unanswered'

  const cache = (answerDataCache.value as Record<string, any>)[questionKey]
  if (!cache) return 'unanswered'

  const hasBoardData = hasBoardAnswerData(cache.boardData)
  const hasSelectedOption = Array.isArray(cache.chooseList) && cache.chooseList.length > 0

  // 已作答：boardData 和 selectedOption 都有
  if (hasBoardData && hasSelectedOption) return 'answered'

  // 未作答：boardData 和 selectedOption 都没有
  return 'unanswered'
}

// 获取题目状态文字
const getQuestionStatusText = (question: ExerciseItem): string => {
  const status = getQuestionStatus(question)
  const textMap: Record<QuestionStatus, string> = {
    unanswered: '未作答',
    answered: '已作答',
  }
  return textMap[status]
}

// 获取题目状态颜色类型
const getQuestionStatusType = (question: ExerciseItem): 'yellow' | 'green' => {
  const status = getQuestionStatus(question)
  const typeMap: Record<QuestionStatus, 'yellow' | 'green'> = {
    unanswered: 'yellow',
    answered: 'green',
  }
  return typeMap[status]
}
const saveCurrentPage = () => {
  if (!currentAnswerQuestion.value) return
  const board = drawingBoardRefs.value[0] // 只有一个页面，使用索引0
  if (!board) return

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  if (!questionKey) return

  const boardData = board.saveData()
  if (!boardData) return

  // 同时保存画板状态数据和导出的图片
  const imageData = board.exportToJpg?.(0.9)

  const existingCache = (answerDataCache.value as Record<string, any>)[questionKey] || {}
  ;(answerDataCache.value as Record<string, any>)[questionKey] = {
    ...existingCache,
    boardData: boardData, // 画板状态数据
    imageData: imageData || null, // 导出的图片数据
    timestamp: Date.now(), // 保存时间戳
  }
  console.log('[HomeworkAnswerView] 保存作答数据到全局缓存:', questionKey, {
    hasImage: !!imageData,
  })
}

const handleClearRequest = () => {
  clearDialogRef.value?.openDialog()
}

const confirmClearCanvas = () => {
  const board = drawingBoardRefs.value[0] // 只有一个页面，使用索引0
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
    const clearedBoardData = board.saveData()
    const existingCache = (answerDataCache.value as Record<string, any>)[questionKey] || {}
    ;(answerDataCache.value as Record<string, any>)[questionKey] = {
      ...existingCache,
      boardData: clearedBoardData || { objects: [], history: [[]], historyIndex: 0 },
      imageData: null, // 清空后没有图片数据
      timestamp: Date.now(),
    }
  }

  clearDialogRef.value?.closeDialog()
}

const cancelClearCanvas = () => {
  clearDialogRef.value?.closeDialog()
}

// 根据缓存恢复当前题目的画布数据
const restoreCurrentPage = (question: ExerciseItem | null) => {
  const questionKey = getQuestionKey(question)
  if (!questionKey) {
    // 没有题目，清空画布
    drawingBoardRefs.value[0]?.clearAll()
    return
  }

  const rawCache = (answerDataCache.value as Record<string, any>)[questionKey]
  if (rawCache && rawCache.boardData) {
    // 加载缓存的画板状态数据
    drawingBoardRefs.value[0]?.loadData(rawCache.boardData as any)
    console.log('[HomeworkAnswerView] 从缓存恢复画布数据:', questionKey)
  } else {
    // 没有缓存数据，清空画布
    drawingBoardRefs.value[0]?.clearAll()
    console.log('[HomeworkAnswerView] 没有缓存数据，清空画布:', questionKey)
  }
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
    await new Promise((resolve) => setTimeout(resolve, 50))

    const el = questionRenderRef.value
    if (!el) {
      console.warn('[HomeworkAnswerView] questionRenderRef 为空，放弃本次题目截图')
      return
    }

    // 确保 v-html 内容已渲染到 DOM
    if (!el.innerHTML || el.innerHTML.trim() === '') {
      console.warn('[HomeworkAnswerView] 隐藏容器内容为空，等待渲染...')
      await new Promise((resolve) => setTimeout(resolve, 100))
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

    // 规范化学科前缀（支持数字ID/英文/中文/SUBJECT_*）
    const subjectPrefix = normalizeSubject((question.subject || getSubject() || 'SUBJECT_MATH').toString())

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

// 上传对话框显示状态
const showCameraDialog = ref(false)
// 初始照片列表（白板上传时使用）
const initialUploadPhotos = ref<string[]>([])

const clearDialogRef = ref<InstanceType<typeof Dialog>>()
const incompleteHomeworkDialogRef = ref<InstanceType<typeof Dialog>>()
const incompleteDialogData = ref({
  totalQuestions: 0,
  submittedQuestions: 0,
  incompleteQuestionNumbers: [] as number[]
})
let incompleteHomeworkResolve: (value: boolean) => void

// 上传作业按钮点击：先执行白板导出逻辑（handleBoardUpload）
// handleBoardUpload 内部会根据现有白板页导出图片并打开上传对话框
const handleUploadHomework = async () => {
  await handleBoardUpload()
}

// 白板上传按钮点击 - 收集所有题目的图片并打开对话框
const handleBoardUpload = async () => {
  console.log('[HomeworkAnswerView][handleBoardUpload] start collecting all homework images')

  // 1. 先保存当前页内容到缓存
  saveCurrentPage()

  const photos: string[] = []
  const pageIndexMap: number[] = []

  // 2. 遍历所有题目，收集已保存的图片数据
  externalQuestions.value.forEach((question, index) => {
    const questionKey = getQuestionKey(question)
    const cache = (answerDataCache.value as Record<string, any>)[questionKey]

    if (cache && cache.imageData) {
      photos.push(cache.imageData)
      pageIndexMap.push(index) // 使用题目在列表中的索引
      console.log(`[HomeworkAnswerView] 收集题目图片: ${questionKey}, 索引: ${index}`)
    }
  })

  console.log('[HomeworkAnswerView][handleBoardUpload] collected images', {
    totalQuestions: externalQuestions.value.length,
    photosCount: photos.length,
    pageIndexMap: pageIndexMap.slice(),
  })

  // 3. 如果没有任何图片数据，提示用户
  if (!photos.length) {
    showMessage('没有找到任何作答内容，请先在题目上进行作答', 'warning')
    return
  }

  // 4. 打开上传确认对话框，展示所有收集的图片
  lastUploadPageIndices.value = pageIndexMap
  initialUploadPhotos.value = photos
  showCameraDialog.value = true

  console.log('[HomeworkAnswerView][handleBoardUpload] dialog opened with all homework images')
}

// 上传确认回调
// 计算保留的题目索引
const calculateKeptQuestionIndices = (photos: string[]): number[] => {
  if (!lastUploadPageIndices.value.length || !initialUploadPhotos.value.length) {
    return []
  }

  const originalPhotos = initialUploadPhotos.value
  const keepFlags = new Array(originalPhotos.length).fill(false)
  const used = new Array(photos.length).fill(false)

  // 计算 originalPhotos 中哪些位置被保留（按内容匹配，考虑重复时按顺序消费）
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

  // 计算保留的题目索引
  const keptQuestionIndices: number[] = []
  for (let i = 0; i < originalPhotos.length; i++) {
    if (keepFlags[i]) {
      const questionIndex = lastUploadPageIndices.value[i]
      if (typeof questionIndex === 'number') {
        keptQuestionIndices.push(questionIndex)
      }
    }
  }
  return keptQuestionIndices
}

// 根据保留的题目更新缓存数据
const updateCacheWithKeptQuestions = (keptQuestionIndices: number[]) => {
  externalQuestions.value.forEach((question, index) => {
    const questionKey = getQuestionKey(question)
    if (questionKey) {
      const cache = (answerDataCache.value as Record<string, any>)[questionKey]
      if (cache) {
        if (keptQuestionIndices.includes(index)) {
          // 这个题目的图片被保留，数据已存在，无需操作
          console.log(`[HomeworkAnswerView] 保留题目数据: ${questionKey}`)
        } else {
          // 这个题目的图片被删除，清空图片数据
          cache.imageData = null
          ;(answerDataCache.value as Record<string, any>)[questionKey] = cache
          console.log(`[HomeworkAnswerView] 清空题目图片数据: ${questionKey}`)
        }
      }
    }
  })
}

// 准备提交数据
const prepareSubmitData = (keptQuestionIndices: number[], photos: string[], questionIndexMap?: number[]) => {
  const questionAnswerList: Array<{ questionId: string; answerList: string[]; chooseList?: string[] }> = []

  const mapUsable = Array.isArray(questionIndexMap) && questionIndexMap.length === photos.length

  if (mapUsable) {
    // 每题多图：按题目索引分组
    const buckets = new Map<number, string[]>()
    for (let i = 0; i < photos.length; i++) {
      const qIndex = questionIndexMap![i]
      if (typeof qIndex !== 'number') continue
      if (!buckets.has(qIndex)) buckets.set(qIndex, [])
      buckets.get(qIndex)!.push(photos[i])
    }

    keptQuestionIndices.forEach((questionIndex) => {
      const answerPhotos = buckets.get(questionIndex) || []
      if (!answerPhotos.length) return
      const question = externalQuestions.value[questionIndex]
      if (!question) return
      const questionKey = getQuestionKey(question)
      const cache = questionKey ? (answerDataCache.value as Record<string, any>)[questionKey] : undefined
      const chooseList = Array.isArray(cache?.chooseList) ? cache.chooseList : []

      questionAnswerList.push({
        questionId: question.id || question.bmNo || '',
        answerList: answerPhotos,
        chooseList: chooseList.length ? chooseList : undefined,
      })
    })
  } else {
    // 兼容旧逻辑：每题一张图，按顺序映射
    keptQuestionIndices.forEach((questionIndex, photoIndex) => {
      const question = externalQuestions.value[questionIndex]
      if (question && photos[photoIndex]) {
        const questionKey = getQuestionKey(question)
        const cache = questionKey ? (answerDataCache.value as Record<string, any>)[questionKey] : undefined
        const chooseList = Array.isArray(cache?.chooseList) ? cache.chooseList : []

        questionAnswerList.push({
          questionId: question.id || question.bmNo || '',
          answerList: [photos[photoIndex]],
          chooseList: chooseList.length ? chooseList : undefined,
        })
      }
    })
  }

  console.log('[HomeworkAnswerView] 准备提交数据', {
    totalQuestions: externalQuestions.value.length,
    keptQuestions: keptQuestionIndices.length,
    submittedAnswers: questionAnswerList.length,
  })

  return questionAnswerList
}

// 显示漏题确认对话框
const showIncompleteHomeworkDialog = (totalQuestions: number, submittedQuestions: number, incompleteQuestionNumbers: number[]): Promise<boolean> => {
  return new Promise((resolve) => {
    incompleteHomeworkResolve = resolve
    incompleteDialogData.value = { totalQuestions, submittedQuestions, incompleteQuestionNumbers }
    incompleteHomeworkDialogRef.value?.openDialog()
  })
}

// 漏题确认对话框 - 确认提交
const handleIncompleteHomeworkConfirm = () => {
  incompleteHomeworkDialogRef.value?.closeDialog()
  if (incompleteHomeworkResolve) {
    incompleteHomeworkResolve(true)
  }
}

// 漏题确认对话框 - 取消提交
const handleIncompleteHomeworkCancel = () => {
  incompleteHomeworkDialogRef.value?.closeDialog()
  if (incompleteHomeworkResolve) {
    incompleteHomeworkResolve(false)
  }
}

// 执行作业答案提交
const submitHomeworkAnswers = async (questionAnswerList: Array<{ questionId: string; answerList: string[] }>) => {
  const homeworkId = route.params.homeworkId as string
  if (!homeworkId) {
    throw new Error('作业信息缺失')
  }

  const submitReq = {
    homeworkId: homeworkId,
    questionAnswerList: questionAnswerList,
  }

  const result = await apiService.homeworkSubmitSave(submitReq)
  if (!result?.success) {
    throw new Error(result?.message || '提交失败')
  }
}

// 上传确认回调
const handleUploadConfirm = async (photos: string[], questionIndexMap?: number[]) => {
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
    // 1. 计算保留的题目索引
    const mapUsable = Array.isArray(questionIndexMap) && questionIndexMap.length === photos.length
    const keptQuestionIndices = mapUsable
      ? Array.from(new Set(questionIndexMap as number[])).filter((n) => typeof n === 'number')
      : calculateKeptQuestionIndices(photos)

    // 2. 更新缓存数据
    updateCacheWithKeptQuestions(keptQuestionIndices)

    // 3. 准备提交数据
    const questionAnswerList = prepareSubmitData(keptQuestionIndices, photos, mapUsable ? (questionIndexMap as number[]) : undefined)

    // 4. 检查是否漏题（使用与 tag 相同的判断逻辑）
    const totalQuestions = externalQuestions.value.length

    // 计算已作答的题目数量（boardData 和 selectedOption 都有的才算已作答）
    const answeredQuestionIndices: number[] = []
    externalQuestions.value.forEach((question, index) => {
      const questionKey = getQuestionKey(question)
      if (questionKey) {
        const cache = (answerDataCache.value as Record<string, any>)[questionKey]
        if (cache) {
          const hasBoardData = hasBoardAnswerData(cache.boardData)
          const hasSelectedOption = Array.isArray(cache.chooseList) && cache.chooseList.length > 0
          if (hasBoardData && hasSelectedOption) {
            answeredQuestionIndices.push(index)
          }
        }
      }
    })

    const submittedQuestions = answeredQuestionIndices.length

    if (submittedQuestions < totalQuestions) {
      // 有题目未完成，计算未完成的题目编号
      const incompleteQuestionNumbers: number[] = []
      for (let i = 0; i < totalQuestions; i++) {
        if (!answeredQuestionIndices.includes(i)) {
          incompleteQuestionNumbers.push(i + 1) // 题目编号从1开始
        }
      }

      // 弹出确认对话框
      const confirmed = await showIncompleteHomeworkDialog(totalQuestions, submittedQuestions, incompleteQuestionNumbers)
      if (!confirmed) {
        return // 用户取消提交
      }
    }

    // 5. 执行提交
    await submitHomeworkAnswers(questionAnswerList)

    showMessage('提交成功', 'success')
    showCameraDialog.value = false
  } catch (error) {
    console.error('[HomeworkAnswerView] 提交答案异常:', error)
    showMessage(error instanceof Error ? error.message : '提交失败，请重试', 'error')
  }
}
</script>

<style scoped>
 
.homework-answer-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0f002e;
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
  border-radius: 16px 16px 0 0; /* 左上角和右上角圆角 */
}

.textbookip-float {
  position: fixed;
  right: calc(-64px + env(safe-area-inset-right, 0px));
  bottom: calc(189px + env(safe-area-inset-bottom, 0px));
  z-index: 1000;
}

.textbookip-float img {
  width: 120px;
  height: auto;
  pointer-events: auto;
}

.textbookip-float :deep(.bubble-menu) {
  z-index: 1000 !important;
}

.textbookip-float :deep(.trigger-wrapper) {
  z-index: 1001 !important;
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

.right-panel-options {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
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

.question-status-icon {
  width: 44px;
  height: 20px;
  margin-left: 8px;
  vertical-align: middle;
}

:deep(.status-tag) {
  margin-left: 8px;
}

.incomplete-homework-content {
  text-align: center;
  padding: 16px 0;
  color: #374151;
  line-height: 1.5;
}
</style>
