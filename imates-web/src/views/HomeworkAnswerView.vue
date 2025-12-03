<template>
  <div class="homework-answer-view">
    <header class="answer-header">
      <div class="toolbar-left">
        <div class="back-btn" @click="goBack">
          <img src="/icons/goback.svg" alt="返回" class="back-icon" />
        </div>
      </div>
      <div class="answer-title">{{ title }}</div>
    </header>
    <div class="answer-body">
      <div class="left-panel">
        <QuestionList ref="questionListRef" :external-questions="externalQuestions" :show-photo-search="false">
          <template #more-extra="{ question, close }">
            <div
              class="more-menu-item-row"
              @click="() => { close(); handleStartAnswer(question) }"
            >
              <img src="icons/my_exercises.svg" alt="开始作答" width="20" height="20" />
              <div>开始作答</div> 
            </div>
          </template>
        </QuestionList>
      </div>
      <div class="right-panel">
        <DrawingBoard
          ref="drawingBoardRef"
          :current-question="currentAnswerQuestion"
          :background-image="questionBgImage"
          layout-mode="doubleHeight"
          :initialZoom="0.5"
        >
          <!-- 左侧插槽：去学伴（QuestionList 选中题目即可） -->
          <template #toolbar-left>
            <CommonActionButton
              label="去学伴"
              variant="ghost"
              size="sm"
              :disabled="!hasSelectedQuestion"
              @click="handleGoToXueban"
            />
          </template>
          <!-- 右侧插槽：相机上传 + 白板上传 -->
          <template #toolbar-right>
            <CommonActionButton
              label="相机上传"
              variant="outline"
              size="sm"
              :disabled="!hasSelectedQuestion"
              @click="handleCameraUpload"
            />
            <CommonActionButton
              label="白板上传"
              variant="primary"
              size="sm"
              :disabled="!questionBgImage"
              @click="handleBoardUpload"
            />
          </template>
        </DrawingBoard>
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuestionList from '@/components/QuestionList.vue'
import DrawingBoard from '@/components/DrawingBoard.vue'
import CommonActionButton from '@/components/CommonActionButton.vue'
import CameraUploadDialog from '@/components/CameraUploadDialog.vue'
import type { ExerciseItem } from '@/types'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import { apiService } from '@/services/api-service'
import { showMessage } from '@/utils'
import * as htmlToImage from 'html-to-image'

defineOptions({
  name: 'HomeworkAnswerView',
})

const route = useRoute()
const router = useRouter()

// 作业题目列表：由路由参数（如 MyHomeworkView 传入）或后续作业接口填充
const externalQuestions = ref<ExerciseItem[]>([])

// 当前在白板上作答的题目
const currentAnswerQuestion = ref<ExerciseItem | null>(null)

// 上一道作答的题目（用于切题时保存数据）
const previousQuestionKey = ref<string>('')

// DrawingBoard 组件引用
const drawingBoardRef = ref<InstanceType<typeof DrawingBoard> | null>(null)

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)

// 是否有选中的题目（QuestionList 中选中即可，不需要渲染到 canvas）
const hasSelectedQuestion = computed(() => {
  return questionListRef.value?.selectedQuestionIndex !== undefined 
    && questionListRef.value.selectedQuestionIndex >= 0
})

// 每道题的作答数据缓存：key = 题目唯一标识，value = DrawingBoard.saveData() 返回的数据
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrawingData = ReturnType<InstanceType<typeof DrawingBoard>['saveData']>
const answerDataCache = new Map<string, DrawingData>()

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

const title = computed(() => {
  const homeworkId = route.params.homeworkId as string | undefined
  return homeworkId ? `作业作答 - ${homeworkId}` : '作业作答'
})

// 从路由 query 中解析题目列表（questions 为经过 encodeURIComponent 的 JSON 字符串）
onMounted(async () => {
  const raw = route.query.questions
  if (typeof raw === 'string') {
    try {
      const decoded = decodeURIComponent(raw)
      const parsed = JSON.parse(decoded)
      console.log(parsed)
      if (Array.isArray(parsed)) {
        // MyHomeworkView 传入的是 topics，结构为 { id, questionData }
        // 这里统一转换为 ExerciseItem，至少补齐 id 和 question 字段
        externalQuestions.value = parsed.map((item: any) => {
          const id = (item?.id ?? '').toString()
          const questionData = (item?.questionData ?? '').toString()
          const exercise: ExerciseItem = {
            id,
            question: questionData,
          } as ExerciseItem
          return exercise
        })
      }
    } catch (e) {
      console.error('[HomeworkAnswerView] 解析路由题目列表失败:', e)
      externalQuestions.value = []
    }
  } else {
    externalQuestions.value = []
  }

  // 尝试恢复选中题目（统一使用 sessionStorage）
  // - 从 my-homework 跳转时设置
  // - 从 homework-exercise 返回时设置
  const returnQuestionId = sessionStorage.getItem('homeworkReturnQuestionId')
  if (returnQuestionId && externalQuestions.value.length > 0) {
    // 找到对应题目的索引（bmNo 或 id 匹配）
    const targetIndex = externalQuestions.value.findIndex((q) => {
      const key = (q.bmNo || q.id || '').toString()
      return key === returnQuestionId
    })

    if (targetIndex >= 0) {
      // 先选中并滚动到该题目（左侧列表）
      // 等待 QuestionList 渲染完成后再调用滚动
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 300))
      
      if (questionListRef.value && typeof questionListRef.value.scrollToQuestionAndSelect === 'function') {
        questionListRef.value.scrollToQuestionAndSelect(targetIndex)
      }

      // 同步到右侧作答区域
      const targetQuestion = externalQuestions.value[targetIndex]
      handleStartAnswer(targetQuestion)
    }

    // 使用一次后清理缓存
    sessionStorage.removeItem('homeworkReturnQuestionId')
  }
})

// 获取题目唯一标识
const getQuestionKey = (question: ExerciseItem | null): string => {
  if (!question) return ''
  return (question.bmNo || question.id || '').toString()
}

// QuestionList 左侧点击“开始作答”时触发，将题目发送到右侧白板
const handleStartAnswer = (question: ExerciseItem) => {
  // 1. 保存当前题目的作答数据（如果有）
  const currentKey = previousQuestionKey.value
  if (currentKey && drawingBoardRef.value) {
    const data = drawingBoardRef.value.saveData()
    if (data) {
      answerDataCache.set(currentKey, data as DrawingData)
      console.log('[HomeworkAnswerView] 保存题目作答数据:', currentKey)
    }
  }

  // 2. 切换到新题目
  currentAnswerQuestion.value = question
  const newKey = getQuestionKey(question)
  previousQuestionKey.value = newKey

  // 3. 恢复新题目的作答数据（如果有缓存）
  nextTick(() => {
    if (newKey && answerDataCache.has(newKey) && drawingBoardRef.value) {
      const cachedData = answerDataCache.get(newKey)!
      drawingBoardRef.value.loadData(cachedData)
      console.log('[HomeworkAnswerView] 恢复题目作答数据:', newKey)
    } else if (drawingBoardRef.value) {
      // 没有缓存，清空画布（保留背景图）
      drawingBoardRef.value.clearAll()
      console.log('[HomeworkAnswerView] 新题目，清空画布:', newKey)
    }
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
      // 渲染 MathJax 公式
      await MathJaxUtils.renderMath(el, false) 

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

// 去学伴按钮点击 - 跳转到作业答题专用路由
const handleGoToXueban = () => {
  // 获取 QuestionList 选中的题目
  const selectedQuestion = questionListRef.value?.getSelectedQuestion?.()
  if (!selectedQuestion) return
  
  const questionId = selectedQuestion.bmNo || selectedQuestion.id
  router.push({ 
    name: 'homeworkExercise',
    query: { questionId: questionId?.toString(), tab: 'chatAi' }
  })
}

// 上传对话框显示状态
const showCameraDialog = ref(false)
// 初始照片列表（白板上传时使用）
const initialUploadPhotos = ref<string[]>([])

// 相机上传按钮点击 - 打开空对话框
const handleCameraUpload = () => {
  initialUploadPhotos.value = []
  showCameraDialog.value = true
}

// 白板上传按钮点击 - 导出画布图片并打开对话框
const handleBoardUpload = () => {
  if (!drawingBoardRef.value) return
  
  const imageData = drawingBoardRef.value.exportToJpg(0.9)
  if (imageData) {
    initialUploadPhotos.value = [imageData]
    showCameraDialog.value = true
  }
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
    // 取第一张图片作为答案内容
    const answerContent = photos[0]
    
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

  &:hover {
    background-color: rgba(15, 23, 42, 0.03);
  }

  > .q-icon {
    flex-shrink: 0;
  }
}
</style>
