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
                @click="handleBoardUpload"
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
// 用于绑定题目列表搜索关键字
const questionSearchQuery = ref('')
// 用于多选题右面板的选项集，绑定到多选控件
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
    { label: '学伴答疑', icon: xuebandayiUnselectIcon },
    { label: '我的作答', icon: wodezuodaSelectIcon },
  ]
})
// 处理 FloatBubble 菜单项选择，控制学伴对话弹窗显示
const handleFloatMenuSelect = async (item: { label: string }) => {
  if (item.label === '学伴答疑') {
    xuebanLimitDialogRef.value?.openDialog()
    // handleGoToXueban();
  } else if (item.label === '我的作答') {
    // 作业作答页本身就是“我的作答”，这里只需关闭菜单即可
    return
  }
}
// 负责引用并操作“学伴限时对话”对话框组件实例
const xuebanLimitDialogRef = ref<InstanceType<typeof Dialog>>()
// 在作业答题页确认学伴限制弹窗时关闭该弹窗
const handleXuebanLimitDialogConfirm = () => {
  xuebanLimitDialogRef.value?.closeDialog()
}
// 关闭作业页的“学伴限时对话”弹窗
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

// 当前题目的 HTML（用于截图）
const questionHtml = ref('')

// 截图用隐藏容器
const questionRenderRef = ref<HTMLElement | null>(null)
// 生成的题目截图 dataURL，传给 DrawingBoard 作为背景图
const questionBgImage = ref<string>('')
// 题目截图缓存：key = 题目唯一标识（优先 bmNo，其次 id）
const questionImageCache = new Map<string, string>()
// 用于标记题目背景截图的序列号，防止重复截图冲突
const questionBgCaptureSeq = ref(0)
// 保存上传图片对应的题目索引的响应式数组
const lastUploadPageIndices = ref<number[]>([])
// 在 HomeworkAnswerView.vue 中返回作业页面的标题
const title = computed(() => {
  const homeworkId = route.params.homeworkId as string | undefined
  return homeworkId ? `作业作答 - ${homeworkId}` : '作业作答'
})

// 展示用标题：优先显示作业名称，缺省时回退到原有 title
const displayTitle = computed(() => {
  return (homeworkName.value && homeworkName.value.trim()) || title.value
})

// 获取题目唯一标识
const getQuestionKey = (question: ExerciseItem | null): string => {
  if (!question) return ''
  return (question.bmNo || question.id || '').toString()
}

// 获取题目状态
type QuestionStatus = 'unanswered' | 'answered'

// 判断白板数据是否包含绘制对象
const hasBoardAnswerData = (boardData: any): boolean => {
  const objects = boardData?.objects
  return Array.isArray(objects) && objects.length > 0
}

// 在 HomeworkAnswerView.vue 中判断题目是否已作答
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

// 将当前题目的画板数据与导出图片缓存到全局缓存中
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

// 在当前题目的画布执行清空请求并打开确认对话框
const handleClearRequest = () => {
  clearDialogRef.value?.openDialog()
}

// 关闭清空确认对话框
const cancelClearCanvas = () => {
  clearDialogRef.value?.closeDialog()
}

// 在当前题目的画布执行清空并同步缓存数据的操作
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


// Markdown + 公式渲染工具
const { renderMessageContent } = useMessageRenderer()

// QuestionList 左侧点击“开始作答”时触发，将题目发送到右侧白板
const handleStartAnswer = async (question: ExerciseItem) => {
  // 保存当前题目当前页的作答数据（如果有）
  saveCurrentPage()

  // 切换到新题目
  currentAnswerQuestion.value = question
  previousQuestionKey.value =  getQuestionKey(question)

  // 新题目的渲染后 HTML，用于截图
  const raw = ( currentAnswerQuestion.value.question ||  currentAnswerQuestion.value.title || '').toString()
  questionHtml.value = renderMessageContent(raw)

  // 确保 v-html 内容已渲染到 DOM
  await nextTick()

  // 新题目 HTML 变化时：等待 DOM 更新后截图
  const seq = ++questionBgCaptureSeq.value
  // 生成新题目背景截图并缓存
  await updateQuestionBackgroundImage(seq)

  // 从全局缓存恢复或清空新题目的绘图板数据
  restoreCurrentPage(question)
}

// 题目 HTML 变化时：等待 DOM 更新后截图
const updateQuestionBackgroundImage = async (seq: number) => {
  const isStale = () => seq !== questionBgCaptureSeq.value

  // 如果没有当前题目，清空背景图
  if (!currentAnswerQuestion.value) {
    console.warn('[HomeworkAnswerView] 没有当前题目，清空背景图')
    questionBgImage.value = ''
    return
  }

  // 如果已有缓存，直接复用避免重复截图
  const val = currentAnswerQuestion.value
  const key = (val.bmNo || val.id || '').toString()
  if (key && questionImageCache.has(key)) {
    questionBgImage.value = questionImageCache.get(key) || ''
    return
  }

  // 如果没有题目 HTML 内容，清空背景图并返回
  const html = questionHtml.value
  if (!html) {
    console.warn('[HomeworkAnswerView] 题目 HTML 内容为空，清空背景图')
    questionBgImage.value = ''
    return
  }

  // 获取题目渲染容器的DOM引用
  const el = questionRenderRef.value
  if (!el) {
    console.warn('[HomeworkAnswerView] questionRenderRef 为空，放弃本次题目截图')
    return
  }

  // 检查容器内容是否已渲染完成，如果为空则等待一段时间
  if (!el.innerHTML || el.innerHTML.trim() === '') {
    console.warn('[HomeworkAnswerView] 隐藏容器内容为空，等待渲染...')
    await nextTick()
    if (isStale()) return
  }

  try {
    // el渲染数学公式
    await MathJaxUtils.renderMathAndWait(el)
    if (isStale()) return

    // el规范图像
    const imgs = el.querySelectorAll('img')
    imgs.forEach((img) => {
      img.removeAttribute('width')
      img.removeAttribute('height')
      ;(img as HTMLImageElement).style.width = 'auto'
      ;(img as HTMLImageElement).style.height = 'auto'
      ;(img as HTMLImageElement).style.maxWidth = '100%'
    })

    // el转换为图片
    const dataUrl = await htmlToImage.toPng(el, {
      backgroundColor: '#ffffff',
      pixelRatio: 1.5,
      cacheBust: true,
    })
    if (isStale()) return
    questionBgImage.value = dataUrl

    // 写入缓存
    if (key) {
      questionImageCache.set(key, dataUrl)
    }
  } catch (e) {
    console.error('[HomeworkAnswerView] 使用 html-to-image 生成题目截图失败:', e)
    if (isStale()) return
    questionBgImage.value = ''
  }
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

// 返回作业列表页面
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
// 清空画布确认对话框的引用
const clearDialogRef = ref<InstanceType<typeof Dialog>>()
// 漏题确认对话框的引用
const incompleteHomeworkDialogRef = ref<InstanceType<typeof Dialog>>()
// 漏题确认对话框的数据
const incompleteDialogData = ref({
  totalQuestions: 0,
  submittedQuestions: 0,
  incompleteQuestionNumbers: [] as number[]
})
let incompleteHomeworkResolve: (value: boolean) => void

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
  await handleStartAnswer(targetQuestion)
})
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
