<template>
  <div class="homework-answer-view">
    <BusinessHeader
      :title="displayTitle"
      @back="goBack"
    />
    <div class="answer-body">
      <SplitPanel
        ref="splitPanelRef"
        :initial-mode="mode"
        :left-config="[36, 30, 50]"
        :center-config="[64, 50, 80]"
        :right-config="[36, 36, 60]"
        :transition-duration="0.5"
        :transition-easing="'ease-in-out'"
        :show-splitters="true" 
        @mode-change="handleModeChange"
      >
        <!-- 左侧：题目列表 -->
        <template #left="{ isVisible }">
          <div class="panel-bg1">
            <div
              class="panel-content"
              :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
              :style="{ width: '100%', minWidth: '300px' }"
            >
              <div class="panel-card">
                <div class="panel-card-body">
                  <QuestionList
                    ref="questionListRef"
                    type="homework"
                    :search-query="questionSearchQuery"
                    @update:searchQuery="(v) => (questionSearchQuery = v)"
                    :external-questions="externalQuestions"
                    :show-photo-search="false"
                    :show-send-to-ai="true"
                    :show-question-actions="false"
                    :show-mistake-badge="false"
                    @questionSelected="handleStartAnswer"
                    @openMiniClass="handleOpenMiniClass"
                  >
                    <template #question-number-extra="{ question }">
                      <img
                        v-if="isHomeworkSubmitted && isObjective(question)"
                        :src="checkQuestionCorrect(question) ? duileIcon : cuoleIcon"
                        class="result-icon-mini"
                      />
                    </template>
                    <template #question-status="{ question }">
                      <Tag
                        v-if="!(isHomeworkSubmitted && isObjective(question))"
                        :text="getQuestionStatusText(question)"
                        :type="getQuestionStatusType(question)"
                        size="xs"
                      />
                    </template>
                    <template #actions-append="{ question }">
                      <!-- 作业提交后，仅在当前选中的题目功能区追加显示"问问学伴"图标 -->
                      <q-btn
                        v-if="isHomeworkSubmitted && getQuestionKey(question) === getQuestionKey(currentAnswerQuestion)"
                        flat
                        round
                        dense
                        class="action-btn xueban-action-btn"
                        @click.stop="handleToggle(question)"
                      >
                        <img :src="askXuebanIcon" alt="问问学伴" class="action-icon" />
                      </q-btn>
                    </template>
                  </QuestionList>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 中间：作答区域 -->
        <template #center="{}">
          <div class="panel-bg"></div>
          <div class="panel-content" :style="{ width: '100%', minWidth: '500px' }">
            <div class="panel-card question-solve-card" :class="{ 'is-submitted': isHomeworkSubmitted }">
              <!-- 工具栏 (与 handleBoardUpload 按钮同行) -->
              <div class="question-render-toolbar" v-if="currentAnswerQuestion && !isHomeworkLocked">
                <div class="toolbar-right">
                  <Button
                    :label="homeworkButtonText"
                    variant="primary"
                    size="mdCompact"
                    @click="handleBoardUpload"
                  />
                </div>
              </div>

              <!-- 题目区域（可收缩） -->
              <div class="question-image-section" :class="{ collapsed: isQuestionImageCollapsed }">
                <div class="question-image-content">
                  <!-- 情况 A: 交互式组件 (仅限 选择、判断、填空 和 主观题) -->
                  <div
                    class="question-render-container"
                    v-if="currentAnswerQuestion && currentAnswerQuestion.structuredContent && ['single_choice', 'multiple_choice', 'true_false', 'composite', 'fill_in_blank', 'subjective'].includes(currentAnswerQuestion.type || '')"
                  >
                    <div
                      class="question-render-area"
                      ref="currentQuestionRenderRef"
                    >
                      <ChoiceQuestion
                        v-if="currentAnswerQuestion.type === 'single_choice' || currentAnswerQuestion.type === 'multiple_choice'"
                        :question="currentAnswerQuestion"
                        v-model="currentAnswerQuestion.structuredContent.userAnswer"
                        :disabled="isHomeworkSubmitted"
                        show-title
                      />
                      <JudgmentQuestion
                        v-else-if="currentAnswerQuestion.type === 'true_false'"
                        :question="currentAnswerQuestion"
                        v-model="currentAnswerQuestion.structuredContent.userAnswer"
                        :disabled="isHomeworkSubmitted"
                        show-title
                      />
                      <CompositeQuestion
                        v-else-if="currentAnswerQuestion.type === 'composite'"
                        :question="currentAnswerQuestion"
                        v-model="currentAnswerQuestion.structuredContent.userAnswer"
                        :disabled="isHomeworkSubmitted"
                        show-title
                      />
                      <FillBlankQuestion
                        v-else-if="currentAnswerQuestion.type === 'fill_in_blank'"
                        :question="currentAnswerQuestion"
                        v-model="currentAnswerQuestion.structuredContent.userAnswer"
                        :disabled="isHomeworkSubmitted"
                        show-title
                      />
                      <SubjectiveQuestion
                        v-else-if="currentAnswerQuestion.type === 'subjective'"
                        ref="subjectiveQuestionRef"
                        :question="currentAnswerQuestion"
                        v-model="currentAnswerQuestion.structuredContent.userAnswer"
                        :disabled="isHomeworkSubmitted"
                        show-title
                      />
                    </div>
                  </div>

                  <!-- 情况 B: 渲染 HTML (白板手写 及 其他) -->
                  <div class="question-render-container" v-else-if="currentAnswerQuestion">
                    <div class="question-render-area">
                      <div
                        v-if="currentAnswerQuestion"
                        class="question-html-preview markdown-content"
                        v-html="questionHtml"
                      ></div>
                    </div>
                  </div>

                  <div v-else class="empty-render-area">
                    <div class="empty-tip">请选择题目开始作答</div>
                  </div>
                </div>
              </div>

              <!-- 收缩切换按钮 -->
              <div class="collapse-toggle-btn" v-if="currentAnswerQuestion" @click="toggleQuestionImage">
                <img :src="collapseToggleIcon" alt="toggle" class="collapse-toggle-svg" />
              </div>

              <!-- 下方区域：提交前显示草稿本，提交后显示答案解析 -->
              <div class="panel-card-body solve-body" v-if="currentAnswerQuestion">
                <!-- 1. 提交前：草稿本区域 (带工具栏) -->
                <div class="draft-board-section" v-if="!isHomeworkLocked">
                  <!-- 画板 -->
                  <div class="drawing-board-wrapper">
                    <DrawingBoardNew
                      :ref="(el) => setDrawingBoardRef(el, 0)"
                      :showGrid="false"
                      :enableAskAi="true"
                      :show-toolbar="true"
                      :disabled="false"
                      :show-zoom-controls="false"
                      :background-image="''"
                      :initial-zoom="100"
                      @clear="handleClearRequest"
                    />
                  </div>
                </div>

                <!-- 2. 提交后：答案和解析区域 -->
                <div v-else class="answer-analysis-wrapper">
                  <div class="result-section">
                      <div class="result-item answer-item">
                        <div class="item-label">参考答案：</div>
                        <div class="item-content" v-html="renderMessageContent(String(currentAnswerQuestion.answer || '').replace(/\$\s+/g, '$').replace(/\s+\$/g, '$'))"></div>
                      </div>
                    <div v-if="!isCurrentQuestionCorrect" class="result-item mistake-item">
                      <span class="item-label">是否添加到错题本：</span>
                      <div class="item-controls">
                        <Radio v-model="mistakeAddedStatus" val="yes" label="是" @update:model-value="handleMistakeChange" />
                        <Radio v-model="mistakeAddedStatus" val="no" label="否" @update:model-value="handleMistakeChange" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 底部留白 -->
              <div class="action-footer-placeholder" v-if="currentAnswerQuestion"></div>
            </div>
            <!-- IP 悬浮功能 -->
            <div
              :class="['textbookip-float', mode === 'left' ? 'float-right' : 'float-left']"
              @click="() => handleToggle()"
            >
              <img :src="textbookipIcon" alt="textbookip" class="textbookip-icon" />
            </div>
          </div>
        </template>

        <!-- 右侧：AI 面板 -->
        <template #right="{ isVisible }">
          <div class="panel-bg2">
            <div
              class="panel-content"
              :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
              :style="{ width: '100%', minWidth: '300px' }"
            >
              <div class="panel-card ai-chat-card">
                <div class="panel-card-body">
                  <HomeworkChatPanel
                    ref="homeworkChatPanelRef"
                    :question="currentAnswerQuestion"
                    @close="handleToggle()"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
      </SplitPanel>
    </div>

    <!-- 隐藏的题目渲染容器，用于生成截图 -->
    <div
      ref="questionRenderRef"
      class="question-render-hidden markdown-content"
    >
      <template v-if="currentAnswerQuestion?.structuredContent">
        <ChoiceQuestion
          v-if="currentAnswerQuestion.type === 'single_choice' || currentAnswerQuestion.type === 'multiple_choice'"
          :question="currentAnswerQuestion"
          v-model="currentAnswerQuestion.structuredContent.userAnswer"
        />
        <FillBlankQuestion
          v-else-if="currentAnswerQuestion.type === 'fill_in_blank'"
          :question="currentAnswerQuestion"
          v-model="currentAnswerQuestion.structuredContent.userAnswer"
        />
        <JudgmentQuestion
          v-else-if="currentAnswerQuestion.type === 'true_false'"
          :question="currentAnswerQuestion"
          v-model="currentAnswerQuestion.structuredContent.userAnswer"
        />
        <BaseQuestion
          v-else
          :question="currentAnswerQuestion"
        />
      </template>
      <div v-else v-html="questionHtml"></div>
    </div>

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
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import SplitPanel from '@/components/base/SplitPanel.vue'
import BusinessHeader from '@/components/header/BusinessHeader.vue'
import QuestionList from '@/components/question/QuestionList.vue'
import DrawingBoardNew from '@/components/drawing/drawingBoardNew.vue'
import Button from '@/components/base/Button.vue'
import CameraUploadDialog from '@/components/dialog/CameraUploadDialog.vue'
import type { ExerciseItem, HomeworkQuestionAnswer } from '@/types'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import * as htmlToImage from 'html-to-image'
import { initExerciseAnswerFields } from '@/utils/business/exercise-utils'
import { useUIStore } from '@/stores/uiStore'
import { getSubject } from '@/services'
import { normalizeSubject } from '@/constants/subjects'
import { getHomeworkButtonText } from '@/constants/homework'
import Dialog from '@/components/base/Dialog.vue'
import Tag from '@/components/base/Tag.vue'
import HomeworkChatPanel from '@/components/chat/chatpanel/HomeworkChatPanel.vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { addMistake, isMistake, deleteMistake } from '@/services/storage/mistake-storage'
import ChoiceQuestion from '@/components/exercise/ChoiceQuestion.vue'
import textbookipIcon from '/icons/textbookip.png'
import askXuebanIcon from '/icons/askXueban.svg'
import duileIcon from '/icons/duile.svg'
import cuoleIcon from '/icons/cuole.svg'
import collapseToggleIcon from '/icons/collapse-toggle-icon.svg'
import CompositeQuestion from '@/components/exercise/CompositeQuestion.vue'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion.vue'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion.vue'
import SubjectiveQuestion from '@/components/exercise/SubjectiveQuestion.vue'
import BaseQuestion from '@/components/exercise/BaseQuestion.vue'
import Radio from '@/components/base/Radio.vue'

interface StructuredAnswer {
  type: 'text' | 'board'
  textContent?: string
  boardData?: any
  timestamp?: number
}

interface SubjectiveAnswer extends StructuredAnswer {}

interface AnswerCacheItem {
  chooseList?: string[]
  judgmentValue?: string
  fillList?: StructuredAnswer[]
  boardData?: {
    objects: unknown[]
    [key: string]: unknown
  }
  compositeAnswers?: Record<string, any>
  subjectiveData?: SubjectiveAnswer
  imageData?: string | null
  timestamp?: number
}

defineOptions({
  name: 'HomeworkAnswerView',
})

const route = useRoute()
const router = useRouter()
const homeworkStore = useHomeworkStore()
const uiStore = useUIStore()
const aiGeneralStore = useAiGeneralChatStore()

// 模式: 'left' = 题目+作答, 'right' = 作答+AI
const mode = ref<'left' | 'right'>('left')
// 作业是否已提交（提交后显示答案和解析）
const isHomeworkSubmitted = ref(false)
const splitPanelRef = ref<InstanceType<typeof SplitPanel> | null>(null)
const homeworkChatPanelRef = ref<InstanceType<typeof HomeworkChatPanel> | null>(null)

// 作业题目列表、当前选中索引和作业名称、作答缓存：从 homeworkStore 获取
const {
  questions: externalQuestions,
  currentQuestionIndex,
  homeworkName,
  resubmitType,
  currentHomeworkInfo,
} = storeToRefs(homeworkStore)

const homeworkButtonText = computed(() => {
  if (isHomeworkSubmitted.value) return '已提交'
  if (!currentHomeworkInfo.value) return '提交作业'

  const info = currentHomeworkInfo.value
  const deadlineMs = info.deadline ? new Date(info.deadline).getTime() : NaN
  const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= Date.now() : false
  const canLateSubmit = info.lateSubmit === '1'
  
  return getHomeworkButtonText(info.status, isExpired, canLateSubmit)
})

// 作业是否锁定（已提交或已截止且不允许补交）
const isHomeworkLocked = computed(() => {
  if (isHomeworkSubmitted.value) return true
  if (!currentHomeworkInfo.value) return false
  
  const info = currentHomeworkInfo.value
  const deadlineMs = info.deadline ? new Date(info.deadline).getTime() : NaN
  const isExpired = Number.isFinite(deadlineMs) ? deadlineMs <= Date.now() : false
  const canLateSubmit = info.lateSubmit === '1'
  const canResubmit = resubmitType.value === '1'
  
  // 核心锁定逻辑：
  // 1. 如果服务端状态已结束(status='3')，且既不能重交也不能补交
  if (info.status === '3' && !canResubmit && !canLateSubmit) {
    return true
  }

  // 2. 如果已过期且不允许补交，且不允许重交
  if (isExpired && !canLateSubmit && !canResubmit) {
    return true
  }
  
  return false
})

// 当前在白板上作答的题目
const currentAnswerQuestion = ref<ExerciseItem | null>(null)

// 当前题目渲染区域的引用，用于截图作答内容
const currentQuestionRenderRef = ref<HTMLElement | null>(null)

// 上一道作答的题目（用于切题时保存数据）
const previousQuestionKey = ref<string>('')

// DrawingBoard 组件引用
const drawingBoardRefs = ref<Array<any>>([])

const setDrawingBoardRef = (el: any, pageIndex: number) => {
  drawingBoardRefs.value[pageIndex] = el
}

// QuestionList 组件引用
const questionListRef = ref<InstanceType<typeof QuestionList> | null>(null)
// 用于绑定题目列表搜索关键字
const questionSearchQuery = ref('')

// 切换模式并发送题目给 AI
const handleToggle = async (question?: ExerciseItem) => {
  const qId = question?.bmNo || question?.id || '无'
  console.log('[HOMEWORK_ANSWER_VIEW] handleToggle 触发, 传入题目 ID:', qId)

  // 实时从 IndexedDB 检查最新的提交状态
  const homeworkId = route.params.homeworkId as string
  if (homeworkId) {
    const dbData = await homeworkStore.loadHomeworkSubmissionFromDB(homeworkId)
    console.log('[HOMEWORK_ANSWER_VIEW] 实时检查数据库提交状态:', dbData?.isSubmitted)
    if (dbData) {
      isHomeworkSubmitted.value = dbData.isSubmitted
    }
  }

  console.log('[HOMEWORK_ANSWER_VIEW] 当前页面记录的提交状态:', isHomeworkSubmitted.value)

  if (!isHomeworkSubmitted.value) {
    showMessage('需要提交作业后才能使用学伴答疑哦', 'warning')
    return
  }

  // 校验解析数据：如果 questionReason 为空，则不允许答疑
  const targetQuestion = question || currentAnswerQuestion.value
  if (!targetQuestion?.questionReason) {
    showMessage('这道题模型还在学习过程中', 'info')
    return
  }

  // 逻辑调整：
  // 1. 如果传入了题目（点击了问问学伴图标），确保面板是打开的
  if (question && (question.bmNo || question.id)) {
    console.log('[HOMEWORK_ANSWER_VIEW] 点击了具体题目, 准备确保面板开启')
    if (mode.value === 'left') {
      splitPanelRef.value?.toggle()
    }
  } else {
    // 2. 如果没有传入题目（点击了悬浮图标或关闭按钮），则执行正常的切换
    console.log('[HOMEWORK_ANSWER_VIEW] 执行正常面板切换')
    splitPanelRef.value?.toggle()
  }

  // 如果传了题目，则调用 AI 面板发送消息
  if (question && (question.bmNo || question.id) && homeworkChatPanelRef.value) {
    console.log('[HOMEWORK_ANSWER_VIEW] 准备调用 HomeworkChatPanel.sendQuestion:', question.bmNo || question.id)
    nextTick(() => {
      const panel = homeworkChatPanelRef.value as { sendQuestion?: (q: ExerciseItem) => void }
      panel.sendQuestion?.(question)
    })
  }
}

// SplitPanel 事件
const handleModeChange = (newMode: 'left' | 'right') => {
  mode.value = newMode
  // 切换到 AI 模式时，自动刷新通用对话列表
  if (newMode === 'right') {
    aiGeneralStore.loadSessions()
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
// 题目区域是否收起
const isQuestionImageCollapsed = ref(false)

// 切换题目区域展开/收起
const toggleQuestionImage = () => {
  isQuestionImageCollapsed.value = !isQuestionImageCollapsed.value
}
// 保存上传图片对应的题目索引的响应式数组
const lastUploadPageIndices = ref<number[]>([])
// 在 HomeworkAnswerView.vue 中返回作业页面的标题
const title = computed(() => {
  const homeworkId = route.params.homeworkId as string | undefined
  return homeworkId ? `作业作伤 - ${homeworkId}` : '作业作答'
})

// 展示用标题：优先显示作业名称，缺省时回退到原有 title
const displayTitle = computed(() => {
  // 修正标题错字"作业作伤" -> "作业作答"
  const defaultTitle = route.params.homeworkId ? `作业作答 - ${route.params.homeworkId}` : '作业作答'
  return (homeworkName.value && homeworkName.value.trim()) || defaultTitle
})

// 获取题目唯一标识
const getQuestionKey = (question: ExerciseItem | null): string => {
  if (!question) return ''
  const qId = question.bmNo || (question as { id?: string | number }).id || ''
  return qId.toString()
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
  const structured = question.structuredContent
  if (!structured) return 'unanswered'

  const hasBoardData = hasBoardAnswerData(structured.boardData)
  
  let hasUserAnswer = false
  const type = question.type || ''
  const val = structured.userAnswer

  if (type === 'single_choice' || type === 'multiple_choice') {
    hasUserAnswer = Array.isArray(val) && val.length > 0
  } else if (type === 'true_false') {
    hasUserAnswer = val !== undefined && val !== null && val !== ''
  } else if (type === 'fill_in_blank') {
    hasUserAnswer = Array.isArray(val) && val.some((v: any) => {
      if (typeof v === 'string') return v && v.trim() !== ''
      return v && (v.textContent || v.boardData)
    })
  } else if (type === 'composite') {
    hasUserAnswer = val && typeof val === 'object' && Object.keys(val).length > 0
  } else if (type === 'subjective') {
    hasUserAnswer = val && (val.textContent?.trim() || hasBoardAnswerData(val.boardData))
  }

  if (hasBoardData || hasUserAnswer) return 'answered'
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

const isObjective = (question: ExerciseItem): boolean => {
  return ['single_choice', 'multiple_choice', 'true_false'].includes(question.type || '')
}

// 将当前题目的画板数据与导出图片保存到题目中
const saveCurrentPage = async (questionToSave: ExerciseItem | null = currentAnswerQuestion.value, asyncImage = false) => {
  try {
    if (!questionToSave) return

    const questionKey = getQuestionKey(questionToSave)
    if (!questionKey) return

    console.log(`[HOMEWORK_IMAGE_PROCESS] 开始保存题目数据: ${questionKey}, 是否异步: ${asyncImage}`)

    if (!questionToSave.structuredContent) {
      questionToSave.structuredContent = {
        stem: questionToSave.title || '',
        type: questionToSave.type || 'subjective'
      }
    }

    const board = drawingBoardRefs.value[0]
    let hasStrokes = false
    let boardData: any = null

    if (board && questionToSave === currentAnswerQuestion.value) {
      boardData = board.saveData()
      if (boardData) {
        questionToSave.structuredContent.boardData = boardData
        const objects = boardData.objects
        hasStrokes = Array.isArray(objects) && objects.length > 0
      }
    }

    const isObjectiveType = ['single_choice', 'multiple_choice', 'true_false'].includes(questionToSave.type || '')

    const captureBoardImage = () => {
      if (board && questionToSave === currentAnswerQuestion.value) {
        const imageData = board.exportToJpg?.(0.9)
        if (imageData) {
          questionToSave.structuredContent!.imageData = imageData
          console.log(`[HOMEWORK_IMAGE_PROCESS] 画板截图完成: ${questionKey}`)
        }
      }
    }

    // 1. 客观题的处理：没有笔迹则清除图片，有笔迹则做画板截图
    if (isObjectiveType) {
      if (!hasStrokes) {
        questionToSave.structuredContent.imageData = null
        console.log(`[HOMEWORK_IMAGE_PROCESS] 客观题无笔迹，清除图片缓存并跳过截图: ${questionKey}`)
        return
      } else {
        if (asyncImage) {
          setTimeout(captureBoardImage, 0)
        } else {
          captureBoardImage()
        }
        return
      }
    }

    // 2. 非客观题且有笔迹：做画板截图
    if (hasStrokes) {
      if (asyncImage) {
        setTimeout(captureBoardImage, 0)
      } else {
        captureBoardImage()
      }
      return
    }

    // 3. 非客观题（如填空题）且没有笔迹：使用 questionRenderRef 结构化截图 (仅限 fill_in_blank)
    const isStructured = ['fill_in_blank'].includes(questionToSave.type || '')
    if (isStructured && questionRenderRef.value) {
      const renderEl = questionRenderRef.value
      
      const captureStructuredImage = async () => {
        try {
          console.log(`[HOMEWORK_IMAGE_PROCESS] captureStructuredImage 开始: ${questionKey}`)
          await MathJaxUtils.renderMathAndWait(renderEl)
          
          const imgs = Array.from(renderEl.querySelectorAll('img'))
          await Promise.all(imgs.map(img => {
            if (img.complete) return Promise.resolve()
            return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })
          }))

          const dataUrl = await htmlToImage.toPng(renderEl, {
            backgroundColor: '#ffffff',
            pixelRatio: 1.5,
            cacheBust: true,
            style: {
              transform: 'scale(1)',
              transformOrigin: 'top left'
            }
          })

          questionToSave.structuredContent!.imageData = dataUrl
          console.log(`[HOMEWORK_IMAGE_PROCESS] 结构化题目截图成功: ${questionKey}`)
        } catch (err) {
          console.error(`[HOMEWORK_IMAGE_PROCESS] 结构化题目截图失败: ${questionKey}`, err)
        }
      }

      if (asyncImage) {
        setTimeout(captureStructuredImage, 100)
      } else {
        await captureStructuredImage()
      }
    }

    console.log(`[HOMEWORK_IMAGE_PROCESS] saveCurrentPage 执行结束: ${questionKey}`)
  } catch (globalSaveError) {
    console.error('[HOMEWORK_IMAGE_PROCESS] saveCurrentPage 全局错误:', globalSaveError)
  }
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
  const board = drawingBoardRefs.value[0]
  if (!board) {
    clearDialogRef.value?.closeDialog()
    return
  }

  board.loadData({
    objects: [],
    history: [[]],
    historyIndex: 0,
  })
  board.clearAll()

  if (currentAnswerQuestion.value) {
    if (!currentAnswerQuestion.value.structuredContent) {
      currentAnswerQuestion.value.structuredContent = {
        stem: currentAnswerQuestion.value.title || '',
        type: currentAnswerQuestion.value.type || 'subjective'
      }
    }
    const structured = currentAnswerQuestion.value.structuredContent
    structured.boardData = { objects: [], history: [[]], historyIndex: 0 }
    structured.imageData = null
  }

  clearDialogRef.value?.closeDialog()
}

// Markdown + 公式渲染工具
const { renderMessageContent } = useMessageRenderer()

/** 判断题目是否回答正确 */
const checkQuestionCorrect = (question: ExerciseItem): boolean => {
  if (!isHomeworkSubmitted.value) return true
  
  const structured = question.structuredContent
  if (!structured) return false

  const type = question.type || ''
  const val = structured.userAnswer

  // 1. 选择题判断
  if (type === 'single_choice' || type === 'multiple_choice') {
    const userChoices = val
    if (!userChoices || !Array.isArray(userChoices) || userChoices.length === 0) return false

    const standardChoices = Array.isArray(structured.answer) 
      ? structured.answer 
      : [String(structured.answer)]

    if (userChoices.length !== standardChoices.length) return false
    return userChoices.every((c: string) => standardChoices.includes(c))
  }

  // 2. 判断题判断
  if (type === 'true_false') {
    const userVal = val
    if (userVal === undefined || userVal === null || userVal === '') return false
    
    return String(structured.answer) === String(userVal)
  }

  return false
}

/** 判断当前客观题是否回答正确 */
const isCurrentQuestionCorrect = computed(() => {
  if (!currentAnswerQuestion.value) return true
  return checkQuestionCorrect(currentAnswerQuestion.value)
})

/** 自动记录错题到错题本 */
const autoRecordMistakes = async () => {
  console.log('[HomeworkAnswerView] 开始自动记录错题...')
  const homeworkId = route.params.homeworkId as string
  
  let mistakeCount = 0
  
  for (const question of externalQuestions.value) {
    const isObjectiveType = ['single_choice', 'multiple_choice', 'judgment', 'true_false'].includes(question.type || '')
    
    if (isObjectiveType && !checkQuestionCorrect(question)) {
      const questionKey = getQuestionKey(question)
      const structured = question.structuredContent
      let originalAnswer: any = null
      if (structured) {
        originalAnswer = {}
        const type = question.type || ''
        if (type === 'single_choice' || type === 'multiple_choice') {
          originalAnswer.chooseList = structured.userAnswer || []
        } else if (type === 'true_false') {
          originalAnswer.judgmentValue = structured.userAnswer || ''
        } else if (type === 'fill_in_blank') {
          originalAnswer.fillList = structured.userAnswer || []
        } else if (type === 'composite') {
          originalAnswer.compositeAnswers = structured.userAnswer || {}
        } else if (type === 'subjective') {
          originalAnswer.subjectiveData = structured.userAnswer || { type: 'text' }
        }
        if (structured.boardData) {
          originalAnswer.boardData = structured.boardData
        }
        if (structured.imageData !== undefined) {
          originalAnswer.imageData = structured.imageData
        }
      }
      
      try {
        await addMistake({
          bmNo: questionKey,
          homeworkId: homeworkId,
          homeworkName: homeworkName.value,
          originalAnswer: originalAnswer,
          questionData: question
        })
        mistakeCount++
        console.log(`[HomeworkAnswerView] 自动记录错题成功: ${questionKey}`)
      } catch (err) {
        console.error(`[HomeworkAnswerView] 自动记录错题失败: ${questionKey}`, err)
      }
    }
  }
  
  if (mistakeCount > 0) {
    console.log(`[HomeworkAnswerView] 自动记录完成，共记录 ${mistakeCount} 道错题`)
  }
}

// QuestionList 左侧点击“开始作答”时触发，将题目发送到右侧白板
const handleStartAnswer = async (question: ExerciseItem) => {
  const questionKey = getQuestionKey(question)
  const oldQuestion = currentAnswerQuestion.value
  const oldQuestionKey = getQuestionKey(oldQuestion)
  
  // 0. 重复调用守卫：如果是同一道题，且已经处于当前题目状态，则跳过
  if (oldQuestionKey === questionKey && questionKey !== '') {
    console.log(`[HOMEWORK_IMAGE_PROCESS] handleStartAnswer: 题目未变化 (${questionKey})，跳过处理`)
    return
  }

  console.log(`[HOMEWORK_IMAGE_PROCESS] handleStartAnswer: 从 ${oldQuestionKey || '无'} 切换到 ${questionKey}`)

  // 1. 强制同步保存上一题数据 (确保图片生成)
  if (oldQuestion && oldQuestionKey !== questionKey) {
    try {
      console.log(`[HOMEWORK_IMAGE_PROCESS] 切换题目，正在保存上一题 ${oldQuestionKey} (带1.5s超时保护)...`)
      const savePromise = saveCurrentPage(oldQuestion, false)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save timeout')), 1500)
      )
      await Promise.race([savePromise, timeoutPromise])
      console.log(`[HOMEWORK_IMAGE_PROCESS] 上一题 ${oldQuestionKey} 保存完成或超时继续`)
    } catch (saveError: unknown) {
      const errMsg = saveError instanceof Error ? saveError.message : String(saveError)
      console.warn(`[HOMEWORK_IMAGE_PROCESS] 保存上一题数据超时或失败: ${errMsg}`)
    }
  }
  // 2. 立即更新 UI 状态
  currentAnswerQuestion.value = question
  previousQuestionKey.value = questionKey
  questionBgImage.value = ''
  
  const raw = question.structuredContent?.stem || ''
  questionHtml.value = renderMessageContent(raw)

  // 3. 检查背景图缓存
  if (questionKey && questionImageCache.has(questionKey)) {
    questionBgImage.value = questionImageCache.get(questionKey) || ''
  }

  // 4. 恢复新题笔迹
  await nextTick()
  restoreCurrentPage(question)

  // 5. 异步生成本题背景图截图
  const seq = ++questionBgCaptureSeq.value
  if (!questionBgImage.value) {
    setTimeout(() => {
      updateQuestionBackgroundImage(seq)
    }, 50)
  }
}

/** 错题本添加状态：'yes' 或 'no' */
const mistakeAddedStatus = ref<'yes' | 'no'>('no')

/** 处理错题本状态切换 */
const handleMistakeChange = async (val: 'yes' | 'no') => {
  if (!currentAnswerQuestion.value) return
  
  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  if (val === 'yes') {
    const structured = currentAnswerQuestion.value.structuredContent
    let originalAnswer: any = null
    if (structured) {
      originalAnswer = {}
      const type = currentAnswerQuestion.value.type || ''
      if (type === 'single_choice' || type === 'multiple_choice') {
        originalAnswer.chooseList = structured.userAnswer || []
      } else if (type === 'true_false') {
        originalAnswer.judgmentValue = structured.userAnswer || ''
      } else if (type === 'fill_in_blank') {
        originalAnswer.fillList = structured.userAnswer || []
      } else if (type === 'composite') {
        originalAnswer.compositeAnswers = structured.userAnswer || {}
      } else if (type === 'subjective') {
        originalAnswer.subjectiveData = structured.userAnswer || { type: 'text' }
      }
      if (structured.boardData) {
        originalAnswer.boardData = structured.boardData
      }
      if (structured.imageData !== undefined) {
        originalAnswer.imageData = structured.imageData
      }
    }
    const homeworkId = route.params.homeworkId as string
    
    await addMistake({
      bmNo: questionKey,
      homeworkId: homeworkId,
      homeworkName: homeworkName.value,
      originalAnswer: originalAnswer,
      questionData: currentAnswerQuestion.value
    })
    showMessage('已成功加入错题本', 'success')
  } else {
    await deleteMistake(questionKey)
    showMessage('已从错题本移除', 'info')
  }
}

/** 初始化当前题目的错题状态 */
const initMistakeStatus = async () => {
  if (!currentAnswerQuestion.value) {
    mistakeAddedStatus.value = 'no'
    return
  }
  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  const exists = await isMistake(questionKey)
  mistakeAddedStatus.value = exists ? 'yes' : 'no'
}

// 监听题目切换，更新错题状态
watch(() => currentAnswerQuestion.value, () => {
  initMistakeStatus()
}, { immediate: true })

// 题目 HTML 变化时：等待 DOM 更新后截图
const updateQuestionBackgroundImage = async (seq: number) => {
  const isStale = () => seq !== questionBgCaptureSeq.value

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  console.log(`[HOMEWORK_RENDER] updateQuestionBackgroundImage 开始: ${questionKey || '无'}, Seq: ${seq}`)

  if (!currentAnswerQuestion.value) {
    console.warn('[HOMEWORK_RENDER] 没有当前题目，清空背景图')
    questionBgImage.value = ''
    return
  }

  const val = currentAnswerQuestion.value
  const key = (val.bmNo || val.id || '').toString()
  if (key && questionImageCache.has(key)) {
    console.log(`[HOMEWORK_RENDER] 命中背景图缓存: ${key}`)
    questionBgImage.value = questionImageCache.get(key) || ''
    return
  }

  const html = questionHtml.value
  if (!html) {
    console.warn('[HOMEWORK_RENDER] 题目 HTML 内容为空，清空背景图')
    questionBgImage.value = ''
    return
  }

  const el = questionRenderRef.value
  if (!el) {
    console.warn('[HOMEWORK_RENDER] questionRenderRef 为空，放弃本次题目截图')
    return
  }

  if (!el.innerHTML || el.innerHTML.trim() === '') {
    console.warn('[HOMEWORK_RENDER] 隐藏容器内容为空，等待渲染...')
    await nextTick()
    if (isStale()) return
  }

  try {
    console.log(`[HOMEWORK_RENDER] 1. 正在调用 MathJaxUtils.renderMathAndWait...`)
    await MathJaxUtils.renderMathAndWait(el)
    console.log(`[HOMEWORK_RENDER] MathJax 渲染完成`)
    if (isStale()) return

    const imgs = Array.from(el.querySelectorAll('img'))
    if (imgs.length > 0) {
      console.log(`[HOMEWORK_RENDER] 2. 正在等待 ${imgs.length} 张图片加载...`)
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve) => {
            img.onload = resolve
            img.onerror = resolve
          })
        })
      )
      console.log(`[HOMEWORK_RENDER] 所有图片加载完成`)
    }
    if (isStale()) return

    imgs.forEach((img) => {
      img.removeAttribute('width')
      img.removeAttribute('height')
      ;(img as HTMLImageElement).style.width = 'auto'
      ;(img as HTMLImageElement).style.height = 'auto'
      ;(img as HTMLImageElement).style.maxWidth = '100%'
    })

    console.log(`[HOMEWORK_RENDER] 3. 正在执行 htmlToImage.toPng...`)
    const dataUrl = await htmlToImage.toPng(el, {
      backgroundColor: '#ffffff',
      pixelRatio: 1.5,
      cacheBust: true,
    })
    console.log(`[HOMEWORK_RENDER] 背景图转换成功`)
    if (isStale()) return
    questionBgImage.value = dataUrl

    if (key) {
      questionImageCache.set(key, dataUrl)
      console.log(`[HOMEWORK_RENDER] 背景图已写入缓存: ${key}`)
    }
  } catch (e) {
    console.error('[HOMEWORK_RENDER] 背景图截图过程出错:', e)
    if (isStale()) return
    questionBgImage.value = ''
  }
}

// 根据缓存恢复当前题目的画布数据
const restoreCurrentPage = (question: ExerciseItem | null) => {
  const questionKey = getQuestionKey(question)
  const board = drawingBoardRefs.value[0]

  console.log(`[HOMEWORK_RENDER] restoreCurrentPage 开始: ${questionKey || '无'}`)

  if (!questionKey) {
    console.log('[HOMEWORK_RENDER] 无题目 Key，清空画布')
    board?.clearAll()
    return
  }

  if (!board) {
    console.warn('[HOMEWORK_RENDER] 画板 Ref 尚未准备好，无法恢复笔迹:', questionKey)
    return
  }

  const structured = question?.structuredContent
  if (structured && structured.boardData) {
    console.log(`[HOMEWORK_RENDER] 正在从缓存恢复笔迹数据: ${questionKey}`)
    board.loadData(structured.boardData as any)
    console.log('[HOMEWORK_RENDER] 笔迹恢复完成')
  } else {
    console.log(`[HOMEWORK_RENDER] 无缓存笔迹，清空画布: ${questionKey}`)
    board.clearAll()
  }
}

const isBacking = ref(false)
// 返回作业列表页面
const goBack = async () => {
  if (isBacking.value) return
  isBacking.value = true

  console.log('[HOMEWORK_BACK] 开始执行返回逻辑')
  const homeworkId = route.params.homeworkId as string
  
  try {
    if (homeworkId) {
      console.log('[HOMEWORK_BACK] 检测到 homeworkId:', homeworkId)
      
      const savePromise = saveCurrentPage()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save timeout')), 2500)
      )

      console.log('[HOMEWORK_BACK] 1. 正在调用 saveCurrentPage (带2.5s超时保护)...')
      try {
        await Promise.race([savePromise, timeoutPromise])
        console.log('[HOMEWORK_BACK] saveCurrentPage 执行完毕')
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        console.warn('[HOMEWORK_BACK] saveCurrentPage 保存可能已挂起或超时:', errMsg)
      }
      
      console.log('[HOMEWORK_BACK] 2. 正在持久化作答数据到本地数据库...')
      await homeworkStore.saveCurrentHomeworkSubmission(homeworkId, isHomeworkSubmitted.value)
      console.log('[HOMEWORK_BACK] 持久化保存指令已发出')
    } else {
      console.warn('[HOMEWORK_BACK] 未检测到 homeworkId, 跳过持久化步骤')
    }
  } catch (err) {
    console.error('[HOMEWORK_BACK] 返回过程中捕获到异常:', err)
  } finally {
    console.log('[HOMEWORK_BACK] 准备执行路由跳转')
    router.push({ name: 'myHomework' })
    console.log('[HOMEWORK_BACK] 路由跳转指令已发出')
    setTimeout(() => { isBacking.value = false }, 500)
  }
}

// 打开微课（复用 ExerciseSolveView 中的逻辑）
const handleOpenMiniClass = (question: ExerciseItem) => {
  try {
    const bmNo = (question.bmNo || '').trim()
    if (!bmNo) {
      showMessage('题目编号缺失，无法打开微课', 'warning')
      return
    }

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

const handleBoardUpload = async () => {
  console.log('[HomeworkAnswerView][handleBoardUpload] start collecting all homework images')

  // 1. 先保存当前页内容到缓存
  await saveCurrentPage()

  const photos: string[] = []
  const pageIndexMap: number[] = []

  // 2. 遍历所有题目，收集已保存的图片数据
  externalQuestions.value.forEach((question, index) => {
    const structured = question.structuredContent
    if (structured && structured.imageData) {
      photos.push(structured.imageData)
      pageIndexMap.push(index) // 使用题目在列表中的索引
      console.log(`[HomeworkAnswerView] 收集题目图片: ${getQuestionKey(question)}, 索引: ${index}`)
    }
  })

  console.log('[HomeworkAnswerView][handleBoardUpload] collected images', {
    totalQuestions: externalQuestions.value.length,
    photosCount: photos.length,
    pageIndexMap: pageIndexMap.slice(),
  })

  // 3. 检查是否有任何作答内容（不再仅根据图片有无来判断）
  const hasAnyAnswer = externalQuestions.value.some(q => getQuestionStatus(q) === 'answered')
  if (!hasAnyAnswer) {
    showMessage('没有找到任何作答内容，请先在题目上进行作答', 'warning')
    return
  }

  // 4. 如果没有手写图片（例如全是无笔迹的客观题），直接进入提交流程，无需弹窗确认图片
  if (photos.length === 0) {
    console.log('[HomeworkAnswerView][handleBoardUpload] no photos but has answers, submitting directly')
    await handleUploadConfirm([], [])
    return
  }

  // 5. 打开上传确认对话框，展示所有收集的图片
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

  // 计算保留 of 题目索引
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
    const structured = question.structuredContent
    if (structured) {
      if (keptQuestionIndices.includes(index)) {
        // 这个题目的图片被保留，数据已存在，无需操作
        console.log(`[HomeworkAnswerView] 保留题目数据: ${getQuestionKey(question)}`)
      } else {
        // 这个题目的图片被删除，清空图片数据
        structured.imageData = null
        console.log(`[HomeworkAnswerView] 清空题目图片数据: ${getQuestionKey(question)}`)
      }
    }
  })
}

// 辅助函数：递归构建题目的结构化提交答案
const buildAnswerForQuestion = (
  question: ExerciseItem, 
  questionIndex: number, 
  imageBuckets: Map<number, string[]>,
  parentUserAnswer?: any
): HomeworkQuestionAnswer | null => {
  if (!question) return null
  const structured = question.structuredContent
  if (!structured) return null

  // 优先使用传入的子题作答数据，否则使用自身的 userAnswer
  const userAnswer = parentUserAnswer !== undefined ? parentUserAnswer : structured.userAnswer

  const type = question.type || ''
  let answers: any = null

  if (type === 'single_choice' || type === 'multiple_choice') {
    answers = Array.isArray(userAnswer) ? userAnswer.map(String) : []
  } else if (type === 'true_false') {
    answers = (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') ? String(userAnswer) : ''
  } else if (type === 'fill_in_blank') {
    if (Array.isArray(userAnswer)) {
      answers = userAnswer.map((item: any) => {
        if (typeof item === 'object' && item !== null) {
          const itemType = item.type || 'text'
          let content: any = ''
          if (itemType === 'board') {
            content = item.boardData || null
          } else if (itemType === 'photo') {
            content = item.photoUrl || ''
          } else {
            content = item.textContent || ''
          }
          return { type: itemType, content }
        }
        
        const valStr = String(item || '')
        if (valStr.startsWith('{') && valStr.includes('"objects"')) {
          try {
            return { type: 'board', content: JSON.parse(valStr) }
          } catch(e) {}
        } else if (valStr.startsWith('{') && valStr.includes('"type":"photo"')) {
          try {
            const parsed = JSON.parse(valStr)
            return { type: 'photo', content: parsed.photoUrl || '' }
          } catch(e) {}
        }
        return { type: 'text', content: valStr }
      })
    } else {
      answers = []
    }
  } else if (type === 'subjective') {
    let item = userAnswer
    if (typeof item === 'string' && item.startsWith('{')) {
      try {
        item = JSON.parse(item)
      } catch(e) {}
    }
    if (typeof item === 'object' && item !== null) {
      const itemType = item.type || 'text'
      let content: any = ''
      if (itemType === 'board') {
        content = item.boardData || null
      } else if (itemType === 'photo') {
        content = item.photoUrl || ''
      } else {
        content = item.textContent || ''
      }
      answers = { type: itemType, content }
    } else {
      answers = { type: 'text', content: String(item || '') }
    }
  } else if (type === 'composite') {
    const nestedAnswers: HomeworkQuestionAnswer[] = []
    if (question.subQuestions && Array.isArray(question.subQuestions)) {
      question.subQuestions.forEach((subQuestion, subIndex) => {
        const subUserAnswer = (userAnswer && typeof userAnswer === 'object') ? userAnswer[subQuestion.id] : undefined
        const subAns = buildAnswerForQuestion(subQuestion, subIndex, imageBuckets, subUserAnswer)
        if (subAns) {
          nestedAnswers.push(subAns)
        }
      })
    }
    answers = nestedAnswers
  }

  const currentImages = imageBuckets.get(questionIndex) || []
  const hasImages = currentImages.length > 0
  const hasContent = answers !== null && (
    (Array.isArray(answers) && answers.length > 0) || 
    (typeof answers === 'string' && answers !== '') ||
    (typeof answers === 'object' && Object.keys(answers).length > 0)
  )

  if (!hasImages && !hasContent) return null

  return {
    questionId: question.id || question.bmNo || '',
    type: question.type || 'subjective',
    answers,
    images: currentImages.length ? currentImages : undefined
  }
}

// 准备提交数据
const prepareSubmitData = (keptQuestionIndices: number[], photos: string[], questionIndexMap?: number[]): HomeworkQuestionAnswer[] => {
  const questionAnswerList: HomeworkQuestionAnswer[] = []

  const mapUsable = Array.isArray(questionIndexMap) && questionIndexMap.length === photos.length
  
  // 建立题目索引到图片的映射
  const imageBuckets = new Map<number, string[]>()
  if (mapUsable) {
    for (let i = 0; i < photos.length; i++) {
      const qIndex = questionIndexMap![i]
      if (typeof qIndex !== 'number') continue
      if (!imageBuckets.has(qIndex)) imageBuckets.set(qIndex, [])
      imageBuckets.get(qIndex)!.push(photos[i])
    }
  } else {
    // 兼容旧逻辑：虽然本场景基本都是 mapUsable，但也保留顺序映射的兜底
    keptQuestionIndices.forEach((questionIndex, photoIndex) => {
      if (!imageBuckets.has(questionIndex)) imageBuckets.set(questionIndex, [])
      if (photos[photoIndex]) {
        imageBuckets.get(questionIndex)!.push(photos[photoIndex])
      }
    })
  }

  // 遍历全部题目，构造结构化提交数据 (包含子题嵌套)
  externalQuestions.value.forEach((question, questionIndex) => {
    const ans = buildAnswerForQuestion(question, questionIndex, imageBuckets)
    if (ans) {
      questionAnswerList.push(ans)
    }
  })

  console.log('[HomeworkAnswerView] 准备提交数据', {
    totalQuestions: externalQuestions.value.length,
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
const submitHomeworkAnswers = async (questionAnswerList: any[]) => {
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

    // 计算已作答的题目数量
    const answeredQuestionIndices: number[] = []
    externalQuestions.value.forEach((question, index) => {
      if (getQuestionStatus(question) === 'answered') {
        answeredQuestionIndices.push(index)
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
    isHomeworkSubmitted.value = true // 设置为已提交状态

    // 自动记录错题
    await autoRecordMistakes()

    // 持久化到 IndexedDB
    if (route.params.homeworkId) {
      await homeworkStore.saveCurrentHomeworkSubmission(route.params.homeworkId as string, true)
    }
  } catch (error) {
    console.error('[HomeworkAnswerView] 提交答案异常:', error)
    showMessage(error instanceof Error ? error.message : '提交失败，请重试', 'error')
  }
}

// 题目列表已从 homeworkStore 获取，根据 currentQuestionIndex 恢复当前选中题目
onMounted(async () => {
  const homeworkId = route.params.homeworkId as string
  console.log(`[HOMEWORK_STORAGE] onMounted 开始加载作业: ${homeworkId || '无'}`)

  if (homeworkId) {
    // 优先从 IndexedDB 加载已提交的历史数据
    console.log(`[HOMEWORK_STORAGE] 1. 正在从 DB 加载作业提交数据: ${homeworkId}`)
    const dbData = await homeworkStore.loadHomeworkSubmissionFromDB(homeworkId)
    if (dbData) {
      // 判断逻辑：如果 resubmitType 为 '1' (允许重复提交)，则不锁定提交状态
      if (resubmitType.value === '1') {
        isHomeworkSubmitted.value = false
        console.log('[HOMEWORK_STORAGE] 作业允许重复提交，解锁编辑模式')
      } else {
        isHomeworkSubmitted.value = dbData.isSubmitted
      }
      console.log(`[HOMEWORK_STORAGE] DB 恢复完成, 提交状态: ${dbData.isSubmitted}`)
    } else {
      console.log('[HOMEWORK_STORAGE] DB 中未找到该作业的提交记录')
    }
  }

  if (!externalQuestions.value.length) {
    console.warn('[HOMEWORK_STORAGE] 未获取到题目列表，中止初始化')
    return
  }

  // 初始化所有题目状态为未作答
  console.log(`[HOMEWORK_STORAGE] 2. 正在初始化 ${externalQuestions.value.length} 道题目的本地结构...`)
  externalQuestions.value.forEach((question) => {
    initExerciseAnswerFields(question)
  })
  console.log('[HOMEWORK_STORAGE] 题目本地结构初始化完成')

  // 优先使用 store 中记录的选中索引
  let targetIndex = currentQuestionIndex.value ?? -1

  // 如果没有选中或索引越界，则默认选中第一题
  if (targetIndex < 0 || targetIndex >= externalQuestions.value.length) {
    targetIndex = 0
  }

  // 等待 QuestionList 渲染完成后再滚动
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
  console.log('[HomeworkAnswerView] onMounted 初始题目数据:', {
    index: targetIndex,
    id: targetQuestion?.id,
    answer: targetQuestion?.answer,
    explanation: targetQuestion?.explanation
  })
  await handleStartAnswer(targetQuestion)
})

onUnmounted(() => {
  homeworkStore.resetAnswerState()
})
</script>

<style scoped lang="scss">
 
.homework-answer-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0f002e;
}

.answer-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 面板内容样式 */
.panel-content {
  height: 100%;
  position: relative;
  background: #ffffff;
  border-radius: 20px;
  transition: opacity 0.5s ease-in-out;
}

/* 背景层 */
.panel-bg1 {
  height: 100%;
  background: linear-gradient(to right, #0f002e 4% , #ffffff 6%);
  width: 100%;
}

.panel-bg2 {
  height: 100%;
  background: linear-gradient(to left, #0f002e 4% , #ffffff 6%);
  width: 100%;
}

.panel-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to right, #0f002e 50%, #ffffff 50%);
  border-radius: 20px;
  z-index: -1;
  opacity: 1;
}

.panel-hidden {
  opacity: 0;
  pointer-events: none;
}

.panel-visible {
  opacity: 1;
}

.panel-bg1 :deep(.panel-card) {
  border-top-right-radius: 0;
}

/* 卡片样式 */
.panel-card {
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top-right-radius: 20px;
  transition: border-radius 0.5s ease-in-out;
}

.panel-card-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 题目渲染卡片 */
.question-solve-card {
  border-radius: 20px;
}

.question-render-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
}

.question-render-toolbar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 24px;
  z-index: 50;
  background-color: #ffffff;
}

.question-render-area {
  flex: 1;
  overflow-y: auto;
  padding: 10px 30px 30px;
  background-color: #ffffff;
}

.empty-render-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-tip {
  color: #94a3b8;
  font-size: 16px;
  font-weight: 500;
}

.action-footer-placeholder {
  height: 24px;
  flex-shrink: 0;
}

.question-solve-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
}

/* 题目图片区域 - 使用 flex 优化动画性能 */
.question-image-section {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid rgba(110, 85, 255, 0.32);
  flex: 7 0 0; /* 默认展开占 70% */
  min-height: 0;
  transition: flex 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  margin: 8px 12px 0 12px;
  position: relative;
  will-change: flex;
  contain: layout paint;
}

.question-image-section.collapsed {
  flex: 0.25 0 0; /* 收起时占约 20% */
}

.question-image-content {
  flex: 1;
  padding: 12px 16px;
  overflow: auto;
  background: #ffffff;
}

.collapse-toggle-btn {
  position: relative;
  top: -1px;
  height: auto;
  width: auto;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
}

.collapse-toggle-svg {
  width: 54px;
  height: auto;
}

.question-render-hidden {
  position: fixed;
  top: 0;
  left: 0;
  width: 600px;
  background: #ffffff;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}

.question-render-hidden img {
  max-width: 300px;
  height: auto;
}

.solve-body {
  flex: 3 0 0; /* 下方区域占约 30% */
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 12px 12px 12px;
  transition: flex 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: flex;
}

.draft-board-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.question-image-section.collapsed + .collapse-toggle-btn + .solve-body {
  flex: 10 0 0;
}

.question-image-section.collapsed .collapse-toggle-svg {
  transform: rotate(180deg);
}

.drawing-board-wrapper {
  flex: 1;
  width: 100%;
  position: relative;
  min-height: 0;
}

.question-render-container {
  height: 100%;
}

.question-render-area {
  padding: 0;
}

.question-solve-card.is-submitted {
  background: #ffffff;
}

.question-html-preview {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 12px 16px;
  background: #ffffff;
  z-index: 0;
  overflow-y: auto;
  pointer-events: none;
}

.answer-analysis-wrapper {
  padding: 16px;
  overflow-y: auto;
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-item {
  .item-label {
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 8px;
  }
  
  .item-content {
    font-size: 15px;
    line-height: 1.6;
    color: #334155;
    word-break: break-all;
  }
}

.empty-render-area {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.textbookip-float {
  position: absolute;
  bottom: 189px;
  z-index: 1000;
  cursor: pointer;
}

.float-right {
  right: -60px;
}

.float-left {
  left: -60px;
  transform: scaleX(-1);
}

.textbookip-float img {
  width: 120px;
  height: auto;
  pointer-events: auto;
}

.question-render-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
  background: transparent;
}

.action-footer-placeholder {
  height: 20px;
  flex-shrink: 0;
}


.question-status-container {
  display: flex;
  align-items: center;
  gap: 4px;

  .result-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }
}
.result-icon-mini {
  position: absolute;
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin-left: 4px;
  left: 40px;
}

</style>
