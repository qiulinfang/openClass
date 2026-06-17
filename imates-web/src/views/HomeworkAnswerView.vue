<template>
  <div class="homework-answer-view">
    <HomeworkHeader
      :questions="externalQuestions"
      :current-index="currentQuestionIndex"
      @select-question="handleSelectQuestion"
    >
      <template #left-action>
        <div class="back-btn" @click="goBack">
          <img :src="goBackIcon" alt="返回" class="back-icon" />
        </div>
      </template>
      <template #right-action>
        <q-btn
          class="draft-toggle-btn"
          unelevated
          :class="{ 'is-active': showDraftDialog }"
          @click="handleToggleDraft"
        >
          草稿纸
        </q-btn>
        <Button
          v-if="currentAnswerQuestion && !isHomeworkLocked"
          :label="homeworkButtonText"
          variant="primary"
          size="mdCompact"
          :loading="isSubmitting"
          @click="handleBoardUpload"
        />
      </template>
    </HomeworkHeader>
    <div class="answer-body-container">
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
          <!-- 左侧：Markdown 题干区域 -->
          <template #left="{ isVisible }">
            <div class="panel-bg1">
              <div
                class="panel-content"
                :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
                :style="{ width: '100%', minWidth: '300px' }"
              >
                <div class="panel-card">
                  <div class="panel-card-body">
                    <div class="markdown-question-container" v-if="currentAnswerQuestion">
                      <div class="question-html-preview markdown-content">
                        <div class="left-panel-question-title" v-if="currentAnswerQuestion">
                          题目{{ currentQuestionIndex + 1 }}
                        </div>
                        <div v-html="questionHtml"></div>
                      </div>
                    </div>
                    <div v-else class="empty-render-area">
                      <div class="empty-tip">请选择题目开始作答</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 中间：作答区域 -->
          <template #center="{}">
            <div class="panel-bg"></div>
            <div class="panel-content" :style="{ width: '100%', minWidth: '500px' }">
              <div
                class="panel-card question-solve-card"
                :class="{ 'is-submitted': isHomeworkSubmitted }"
              >
                <!-- 题目区域 -->
                <div class="question-image-section">
                  <div class="question-image-content">
                    <!-- 交互式组件 (仅限 选择、判断、填空 和 主观题) -->
                    <div
                      class="question-render-container"
                      v-if="
                        currentAnswerQuestion &&
                        currentAnswerQuestion.structuredContent &&
                        [
                          'single_choice',
                          'multiple_choice',
                          'true_false',
                          'composite',
                          'fill_in_blank',
                          'subjective',
                        ].includes(currentAnswerQuestion.type || '')
                      "
                    >
                      <div class="question-render-area" ref="currentQuestionRenderRef">
                        <ChoiceQuestion
                          v-if="
                            currentAnswerQuestion.type === 'single_choice' ||
                            currentAnswerQuestion.type === 'multiple_choice'
                          "
                          :question="currentAnswerQuestion"
                          v-model="currentAnswerQuestion.structuredContent.userAnswer"
                          :disabled="isHomeworkSubmitted"
                          :show-analysis="isHomeworkSubmitted"
                          show-title
                          :show-id="false"
                        />
                        <JudgmentQuestion
                          v-else-if="currentAnswerQuestion.type === 'true_false'"
                          :question="currentAnswerQuestion"
                          v-model="currentAnswerQuestion.structuredContent.userAnswer"
                          :disabled="isHomeworkSubmitted"
                          :show-analysis="isHomeworkSubmitted"
                          show-title
                          :show-id="false"
                        />
                        <CompositeQuestion
                          v-else-if="currentAnswerQuestion.type === 'composite'"
                          :question="currentAnswerQuestion"
                          v-model="currentAnswerQuestion.structuredContent.userAnswer"
                          :disabled="isHomeworkSubmitted"
                          :show-analysis="isHomeworkSubmitted"
                          show-title
                          :show-id="false"
                        />
                        <FillBlankQuestion
                          v-else-if="currentAnswerQuestion.type === 'fill_in_blank'"
                          :question="currentAnswerQuestion"
                          v-model="currentAnswerQuestion.structuredContent.userAnswer"
                          :disabled="isHomeworkSubmitted"
                          :show-analysis="isHomeworkSubmitted"
                          show-title
                          :show-id="false"
                        />
                        <SubjectiveQuestion
                          v-else-if="currentAnswerQuestion.type === 'subjective'"
                          ref="subjectiveQuestionRef"
                          :question="currentAnswerQuestion"
                          v-model="currentAnswerQuestion.structuredContent.userAnswer"
                          :disabled="isHomeworkSubmitted"
                          :show-analysis="isHomeworkSubmitted"
                          show-title
                          :show-id="false"
                        />
                      </div>
                    </div>

                    <div v-else-if="currentAnswerQuestion" class="empty-render-area">
                      <div class="empty-tip">请使用顶部“草稿纸”进行作答</div>
                    </div>

                    <div v-else class="empty-render-area">
                      <div class="empty-tip">请选择题目开始作答</div>
                    </div>
                  </div>
                </div>

                <!-- 下方区域：提交后显示答案解析 -->
                <div
                  class="panel-card-body solve-body"
                  v-if="currentAnswerQuestion && isHomeworkLocked"
                >
                  <!-- 答案和解析区域 -->
                  <div class="answer-analysis-wrapper">
                    <div class="result-section">
                      <div v-if="!isCurrentQuestionCorrect" class="result-item mistake-item">
                        <span class="item-label">是否添加到错题本：</span>
                        <div class="item-controls">
                          <Radio
                            v-model="mistakeAddedStatus"
                            val="yes"
                            label="是"
                            @update:model-value="handleMistakeChange"
                          />
                          <Radio
                            v-model="mistakeAddedStatus"
                            val="no"
                            label="否"
                            @update:model-value="handleMistakeChange"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
    </div>

    <!-- 上传对话框（相机上传 / 白板上传共用）已在重构中停用 -->

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

    <!-- 漏题提示对话框 -->
    <Dialog
      ref="incompleteHomeworkDialogRef"
      title="作业未完成"
      :confirmButtonText="'去作答'"
      :showCancelButton="false"
      @confirm="handleIncompleteHomeworkConfirm"
      @cancel="handleIncompleteHomeworkCancel"
    >
      <div class="incomplete-homework-content">
        第{{
          incompleteDialogData.incompleteQuestionNumbers.join('、')
        }}题未完成，请全部完成后再提交！
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

    <!-- 草稿纸弹窗 -->
    <div v-show="showDraftDialog" class="draft-dialog-overlay" @click.self="handleToggleDraft">
      <div class="draft-dialog-container">
        <div class="draft-dialog-header">
          <span class="draft-dialog-title">草稿纸</span>
          <q-btn
            flat
            round
            dense
            icon="close"
            class="draft-dialog-close"
            @click="handleToggleDraft"
          />
        </div>
        <div class="draft-dialog-body">
          <div class="draft-board-section">
            <!-- 画板 -->
            <div class="drawing-board-wrapper">
              <DrawingBoardNew
                :ref="(el) => setDrawingBoardRef(el, 0)"
                :showGrid="false"
                :enableAskAi="true"
                :show-toolbar="false"
                :disabled="false"
                :show-zoom-controls="false"
                :background-image="''"
                :initial-zoom="100"
                @clear="handleClearRequest"
              />
            </div>
          </div>
        </div>
        <div class="draft-dialog-footer" v-if="drawingBoardRefs[0]">
          <Toolbar
            :tools="drawingBoardRefs[0].toolbarTools"
            :selected-tool="drawingBoardRefs[0].toolbarSelectedTool"
            :tool-config="drawingBoardRefs[0].toolbarToolConfig"
            :tool-states="{
              undo: drawingBoardRefs[0].canUndo,
              redo: drawingBoardRefs[0].canRedo,
            }"
            :allow-popup="true"
            variant="floating"
            orientation="horizontal"
            @tool-change="handleToolbarToolChange"
            @config-change="(cfg) => drawingBoardRefs[0].handleToolbarConfigChange(cfg)"
            @undo="() => drawingBoardRefs[0].undo()"
            @redo="() => drawingBoardRefs[0].redo()"
            @clear="handleClearRequest"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import SplitPanel from '@/components/base/SplitPanel.vue'
import HomeworkHeader from '@/components/header/HomeworkHeader.vue'
import DrawingBoardNew from '@/components/drawing/drawingBoardNew.vue'
import Toolbar from '@/components/drawing/Toolbar.vue'
import Button from '@/components/base/Button.vue'
import type { ExerciseItem, HomeworkQuestionAnswer } from '@/types'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { apiService } from '@/services/http/api-service'
import { showMessage } from '@/utils'
import { initExerciseAnswerFields } from '@/utils/business/exercise-utils'
import { getQuestionStrategy } from '@/utils/business/question-strategies'
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
import goBackIcon from '/icons/goback.svg'
import CompositeQuestion from '@/components/exercise/CompositeQuestion.vue'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion.vue'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion.vue'
import SubjectiveQuestion from '@/components/exercise/SubjectiveQuestion.vue'
import Radio from '@/components/base/Radio.vue'

interface StructuredAnswer {
  type: 'board' | 'photo'
  boardData?: any
  photoUrl?: string
  boardImg?: string
}

interface SubjectiveAnswer extends StructuredAnswer {}

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
const showDraftDialog = ref(false)

const handleSelectQuestion = (question: ExerciseItem, index: number) => {
  handleStartAnswer(question)
}

const handlePrevQuestion = () => {
  if (currentQuestionIndex.value > 0) {
    const newIndex = currentQuestionIndex.value - 1
    handleStartAnswer(externalQuestions.value[newIndex])
  }
}

const handleNextQuestion = () => {
  if (currentQuestionIndex.value < externalQuestions.value.length - 1) {
    const newIndex = currentQuestionIndex.value + 1
    handleStartAnswer(externalQuestions.value[newIndex])
  }
}

const handleToggleDraft = () => {
  showDraftDialog.value = !showDraftDialog.value
}
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

// 上一道作答的题目（用于切题时保存数据）
const previousQuestionKey = ref<string>('')

// DrawingBoard 组件引用
const drawingBoardRefs = ref<Array<any>>([])

const setDrawingBoardRef = (el: any, pageIndex: number) => {
  drawingBoardRefs.value[pageIndex] = el
}

const handleToolbarToolChange = (tool: string) => {
  const board = drawingBoardRefs.value[0]
  if (!board) return
  if (tool === 'clear') {
    handleClearRequest()
  } else {
    board.handleToolbarToolChange(tool)
  }
}

/**
 * 切换分屏布局模式并发送题目给 AI 进行答疑
 * @param question 可选的题目对象，传入时表示针对具体题目发起答疑
 */
const handleToggle = async (question?: ExerciseItem) => {
  const homeworkId = route.params.homeworkId as string

  // 1. 实时从本地 IndexedDB 检查并更新最新的提交状态
  if (homeworkId) {
    const dbData = await homeworkStore.loadHomeworkSubmissionFromDB(homeworkId)
    if (dbData) {
      isHomeworkSubmitted.value = dbData.isSubmitted
    }
  }

  // 2. 只有已提交作业，才允许使用 AI 答疑功能
  if (!isHomeworkSubmitted.value) {
    showMessage('需要提交作业后才能使用学伴答疑哦', 'warning')
    return
  }

  // 3. 校验该题是否包含有效的解析数据 (questionReason)，若无则提示模型正在学习
  const targetQuestion = question || currentAnswerQuestion.value
  if (!targetQuestion?.questionReason) {
    showMessage('这道题模型还在学习过程中', 'info')
    return
  }

  // 4. 面板开启切换逻辑
  if (question && (question.bmNo || question.id)) {
    // 若点击了具体的题目答疑图标，且右侧面板关闭，则强制展开右侧面板
    if (mode.value === 'left') {
      splitPanelRef.value?.toggle()
    }
  } else {
    // 若点击的是悬浮按钮或关闭按钮，直接执行普通的双向折叠切换
    splitPanelRef.value?.toggle()
  }

  // 5. 若传入了具体题目，待 AI 面板就绪后，将题目投递给 AI 进行交互问答
  if (question && (question.bmNo || question.id) && homeworkChatPanelRef.value) {
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

// 提交按钮的 loading 状态
const isSubmitting = ref(false)

// 展示用标题：优先显示作业名称，缺省时回退到原有 title
const displayTitle = computed(() => {
  // 修正标题错字"作业作伤" -> "作业作答"
  const defaultTitle = route.params.homeworkId
    ? `作业作答 - ${route.params.homeworkId}`
    : '作业作答'
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

/**
 * 判断单项作答内容（支持普通文本、对象结构或序列化 JSON 字符串）是否非空且有效
 * @param item 作答内容数据项
 * @returns 是否包含有效内容
 */
const hasValueContent = (item: any): boolean => {
  if (!item) return false

  // 1. 作答为对象结构
  if (typeof item === 'object') {
    // 拍照图片类型：判断是否有图片 URL
    if (item.type === 'photo') {
      return !!item.photoUrl
    }
    // 白板手写类型（包括 type === 'board' 或直接是 boardData 结构自身）
    const boardData = item.boardData || item
    return Array.isArray(boardData?.objects) && boardData.objects.length > 0
  }

  // 2. 作答为字符串结构
  if (typeof item === 'string') {
    // 若属于 JSON 序列化字符串，尝试解析后判断
    if (item.startsWith('{')) {
      try {
        const parsed = JSON.parse(item)
        if (parsed.type === 'photo') {
          return !!parsed.photoUrl
        }
        const boardData = parsed.boardData || parsed
        return Array.isArray(boardData?.objects) && boardData.objects.length > 0
      } catch (e) {
        return false
      }
    }
    // 普通文本：去空后校验
    return !!item.trim()
  }

  return false
}

// 在 HomeworkAnswerView.vue 中判断题目是否已作答
const getQuestionStatus = (question: ExerciseItem): QuestionStatus => {
  const structured = question.structuredContent
  if (!structured) return 'unanswered'

  const hasBoardData = hasBoardAnswerData(structured.boardData)
  const hasUserAnswer = !getQuestionStrategy(question.type).isEmpty(structured.userAnswer)

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

/**
 * 将指定题目的手写板笔迹数据保存到对应的题目结构化数据中
 * @param questionToSave 待保存的题目对象，默认为当前正在答题的题目
 */
const saveCurrentPage = async (
  questionToSave: ExerciseItem | null = currentAnswerQuestion.value,
) => {
  try {
    if (!questionToSave) return

    const questionKey = getQuestionKey(questionToSave)
    if (!questionKey) return

    // 1. 确保题目的结构化内容字段 (structuredContent) 已初始化
    if (!questionToSave.structuredContent) {
      questionToSave.structuredContent = {
        stem: questionToSave.title || '',
        type: questionToSave.type || 'subjective',
      }
    }

    const board = drawingBoardRefs.value[0]

    // 2. 仅当保存的目标题目是当前活跃题目，且白板实例已就绪时，提取并更新笔迹数据
    if (board && questionToSave === currentAnswerQuestion.value) {
      const boardData = board.saveData()
      if (boardData) {
        questionToSave.structuredContent.boardData = boardData
      }
    }
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
        type: currentAnswerQuestion.value.type || 'subjective',
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

  return getQuestionStrategy(question.type).checkCorrect(structured.userAnswer, structured.answer)
}

/** 判断当前客观题是否回答正确 */
const isCurrentQuestionCorrect = computed(() => {
  if (!currentAnswerQuestion.value) return true
  return checkQuestionCorrect(currentAnswerQuestion.value)
})

/**
 * 根据题目类型与结构化作答内容构建错题本所需的原始答案数据格式
 * @param question 题目项对象
 * @returns 错题本所需的 originalAnswer 对象
 */
const buildOriginalAnswer = (question: ExerciseItem): any => {
  const structured = question.structuredContent
  if (!structured) return null

  const originalAnswer = getQuestionStrategy(question.type).buildOriginalAnswer(
    structured.userAnswer,
  )

  if (structured.boardData) {
    originalAnswer.boardData = structured.boardData
  }
  if (structured.imageData !== undefined) {
    originalAnswer.imageData = structured.imageData
  }

  return originalAnswer
}

/** 自动记录错题到错题本 */
const autoRecordMistakes = async () => {
  const homeworkId = route.params.homeworkId as string

  let mistakeCount = 0

  for (const question of externalQuestions.value) {
    const isObjectiveType = ['single_choice', 'multiple_choice', 'judgment', 'true_false'].includes(
      question.type || '',
    )

    if (isObjectiveType && !checkQuestionCorrect(question)) {
      const questionKey = getQuestionKey(question)
      const originalAnswer = buildOriginalAnswer(question)

      try {
        await addMistake({
          bmNo: questionKey,
          homeworkId: homeworkId,
          homeworkName: homeworkName.value,
          originalAnswer: originalAnswer,
          questionData: question,
        })
        mistakeCount++
      } catch (err) {
        console.error(`[HomeworkAnswerView] 自动记录错题失败: ${questionKey}`, err)
      }
    }
  }
}

// QuestionList 左侧点击“开始作答”时触发，将题目发送到右侧白板
const handleStartAnswer = async (question: ExerciseItem) => {
  const questionKey = getQuestionKey(question)
  const oldQuestion = currentAnswerQuestion.value
  const oldQuestionKey = getQuestionKey(oldQuestion)

  if (oldQuestionKey === questionKey && questionKey !== '') {
    return
  }

  // 1. 同步保存上一题数据
  if (oldQuestion && oldQuestionKey !== questionKey) {
    try {
      const savePromise = saveCurrentPage(oldQuestion)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Save timeout')), 1500),
      )
      await Promise.race([savePromise, timeoutPromise])

      // 切换题目时，自动持久化当前作答数据到本地数据库
      const homeworkId = route.params.homeworkId as string
      if (homeworkId) {
        await homeworkStore.saveCurrentHomeworkSubmission(homeworkId, isHomeworkSubmitted.value)
      }
    } catch (saveError: unknown) {
      const errMsg = saveError instanceof Error ? saveError.message : String(saveError)
      console.warn(`[HOMEWORK_IMAGE_PROCESS] 保存上一题数据超时或失败: ${errMsg}`)
    }
  }
  // 2. 立即更新 UI 状态
  currentAnswerQuestion.value = question
  previousQuestionKey.value = questionKey

  const idx = externalQuestions.value.findIndex((q) => getQuestionKey(q) === questionKey)
  if (idx !== -1) {
    currentQuestionIndex.value = idx
  }

  const raw = question.question || question.title || ''
  questionHtml.value = renderMessageContent(raw)

  // 3. 恢复新题笔迹
  await nextTick()
  restoreCurrentPage(question)
}

/** 错题本添加状态：'yes' 或 'no' */
const mistakeAddedStatus = ref<'yes' | 'no'>('no')

/** 处理错题本状态切换 */
const handleMistakeChange = async (val: 'yes' | 'no') => {
  if (!currentAnswerQuestion.value) return

  const questionKey = getQuestionKey(currentAnswerQuestion.value)
  if (val === 'yes') {
    const originalAnswer = buildOriginalAnswer(currentAnswerQuestion.value)
    const homeworkId = route.params.homeworkId as string

    await addMistake({
      bmNo: questionKey,
      homeworkId: homeworkId,
      homeworkName: homeworkName.value,
      originalAnswer: originalAnswer,
      questionData: currentAnswerQuestion.value,
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
watch(
  () => currentAnswerQuestion.value,
  () => {
    initMistakeStatus()
  },
  { immediate: true },
)

// 根据缓存恢复当前题目的画布数据
const restoreCurrentPage = (question: ExerciseItem | null) => {
  const questionKey = getQuestionKey(question)
  const board = drawingBoardRefs.value[0]
  if (!questionKey) {
    board?.clearAll()
    return
  }

  if (!board) {
    console.warn('[HOMEWORK_RENDER] 画板 Ref 尚未准备好，无法恢复笔迹:', questionKey)
    return
  }

  const structured = question?.structuredContent
  if (structured && structured.boardData) {
    board.loadData(structured.boardData as any)
  } else {
    board.clearAll()
  }
}

const isBacking = ref(false)
// 返回作业列表页面
const goBack = async () => {
  if (isBacking.value) return
  isBacking.value = true

  const homeworkId = route.params.homeworkId as string

  try {
    if (homeworkId) {
      await saveCurrentPage()
      await homeworkStore.saveCurrentHomeworkSubmission(homeworkId, isHomeworkSubmitted.value)
    }
  } catch (err) {
    console.error('[HOMEWORK_BACK] 返回过程中捕获到异常:', err)
  } finally {
    router.push({ name: 'myHomework' })
    setTimeout(() => {
      isBacking.value = false
    }, 500)
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

    const subjectPrefix = normalizeSubject(
      (question.subject || getSubject() || 'SUBJECT_MATH').toString(),
    )

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

// 清空画布确认对话框的引用
const clearDialogRef = ref<InstanceType<typeof Dialog>>()
// 漏题确认对话框的引用
const incompleteHomeworkDialogRef = ref<InstanceType<typeof Dialog>>()
// 漏题确认对话框的数据
const incompleteDialogData = ref({
  totalQuestions: 0,
  submittedQuestions: 0,
  incompleteQuestionNumbers: [] as number[],
})
let incompleteHomeworkResolve: (value: boolean) => void

/**
 * 递归构建单个题目的结构化提交答案数据
 * @param question 题目项数据
 * @param questionIndex 题目在列表中的索引值
 * @param imageBuckets 暂存草稿图片的容器
 * @param parentUserAnswer 复合题子题传入的作答数据 (普通题不需要传)
 * @returns 组装好的 HomeworkQuestionAnswer 对象，若无有效作答内容则返回 null
 */
interface IntermediateQuestionAnswer {
  questionId: string
  type: string
  answers: string | string[] | IntermediateQuestionAnswer[]
  images?: string[]
}

const buildAnswerForQuestion = (
  question: ExerciseItem,
  questionIndex: number,
  imageBuckets: Map<number, string[]>,
  parentUserAnswer?: unknown,
): IntermediateQuestionAnswer | null => {
  if (!question) return null
  const structured = question.structuredContent
  if (!structured) return null

  // 优先采用传入的子题作答数据，否则使用自身 structured 中的 userAnswer
  const userAnswer = parentUserAnswer !== undefined ? parentUserAnswer : structured.userAnswer

  const type = question.type || ''
  let answers: string | string[] | IntermediateQuestionAnswer[] = ''

  if (type === 'composite') {
    // 复合题：递归处理子题作答列表
    const nestedAnswers: IntermediateQuestionAnswer[] = []
    if (question.subQuestions && Array.isArray(question.subQuestions)) {
      question.subQuestions.forEach((subQuestion, subIndex) => {
        const subUserAnswer =
          userAnswer && typeof userAnswer === 'object'
            ? (userAnswer as Record<string, unknown>)[subQuestion.id]
            : undefined
        const subAns = buildAnswerForQuestion(subQuestion, subIndex, imageBuckets, subUserAnswer)
        if (subAns) {
          nestedAnswers.push(subAns)
        }
      })
    }
    answers = nestedAnswers
  } else {
    // 非复合题：使用对应的策略格式化作答内容
    answers = getQuestionStrategy(type).formatForSubmit(userAnswer, questionIndex)
  }

  // 校验当前题目的图片与作答内容是否均为空
  const currentImages = imageBuckets.get(questionIndex) || []
  const hasImages = currentImages.length > 0
  const hasContent = !getQuestionStrategy(type).isEmpty(userAnswer)

  if (!hasImages && !hasContent) return null

  return {
    questionId: question.id || question.bmNo || '',
    type: question.type || 'subjective',
    answers,
    images: currentImages.length ? currentImages : undefined,
  }
}

/**
 * 提取所有题目的本地作答并准备提交数据格式
 * @returns 规范化的作业提交数组
 */
const prepareSubmitData = (): IntermediateQuestionAnswer[] => {
  const questionAnswerList: IntermediateQuestionAnswer[] = []
  const emptyBuckets = new Map<number, string[]>() // 空 map，草稿图片不传给后端

  externalQuestions.value.forEach((question, questionIndex) => {
    const ans = buildAnswerForQuestion(question, questionIndex, emptyBuckets)
    if (ans) {
      questionAnswerList.push(ans)
    }
  })
  return questionAnswerList
}

/**
 * 显示漏题确认提示弹窗
 * @param totalQuestions 作业总题目数
 * @param submittedQuestions 已作答的题目数
 * @param incompleteQuestionNumbers 未完成的题目编号集合 (1-indexed)
 * @returns 是否确认的 Promise
 */
const showIncompleteHomeworkDialog = (
  totalQuestions: number,
  submittedQuestions: number,
  incompleteQuestionNumbers: number[],
): Promise<boolean> => {
  return new Promise((resolve) => {
    incompleteHomeworkResolve = resolve
    incompleteDialogData.value = { totalQuestions, submittedQuestions, incompleteQuestionNumbers }
    incompleteHomeworkDialogRef.value?.openDialog()
  })
}

/**
 * 漏题确认弹窗点击“去作答”回调，自动滚动选中首道未作答题目
 */
const handleIncompleteHomeworkConfirm = () => {
  incompleteHomeworkDialogRef.value?.closeDialog()

  // 选中第一道未答的题目
  const firstUnansweredNum = incompleteDialogData.value.incompleteQuestionNumbers[0]
  if (typeof firstUnansweredNum === 'number') {
    const targetIndex = firstUnansweredNum - 1
    handleStartAnswer(externalQuestions.value[targetIndex])
  }

  if (incompleteHomeworkResolve) {
    incompleteHomeworkResolve(false) // 返回 false，终止提交
  }
}

/**
 * 漏题确认弹窗点击取消时的回调
 */
const handleIncompleteHomeworkCancel = () => {
  incompleteHomeworkDialogRef.value?.closeDialog()
  if (incompleteHomeworkResolve) {
    incompleteHomeworkResolve(false)
  }
}

/**
 * 递归函数：将作答内容中的所有 base64 图片/手写板数据上传到云端后，就地替换为云端 CDN 链接地址
 * @param questionAnswerList 等待上传的提交答案列表
 */
const uploadAnswersImages = async (
  questionAnswerList: IntermediateQuestionAnswer[],
): Promise<void> => {
  for (const qAns of questionAnswerList) {
    if (qAns.type === 'subjective') {
      // 检查主观题作答内容是否为 Base64，如果是则上传并覆盖
      if (typeof qAns.answers === 'string' && qAns.answers.startsWith('data:image')) {
        const path = await apiService.uploadImageAndGetUrl(qAns.answers)
        qAns.answers = path
      }
    } else if (qAns.type === 'fill_in_blank') {
      // 检查填空题每个空格是否为 Base64，如果是则上传并就地替换
      if (Array.isArray(qAns.answers)) {
        for (let i = 0; i < qAns.answers.length; i++) {
          const ansStr = qAns.answers[i]
          if (typeof ansStr === 'string' && ansStr.startsWith('data:image')) {
            const path = await apiService.uploadImageAndGetUrl(ansStr)
            qAns.answers[i] = path
          }
        }
      }
    } else if (qAns.type === 'composite') {
      // 复合题：递归处理子题作答中的图片
      if (Array.isArray(qAns.answers)) {
        await uploadAnswersImages(qAns.answers as IntermediateQuestionAnswer[])
      }
    }
  }
}

/**
 * 将前端内部的作答结构转换并扁平化为后端要求的 QuestionAnswer 结构
 */
const transformToBackendFormat = (list: IntermediateQuestionAnswer[]): HomeworkQuestionAnswer[] => {
  const result: HomeworkQuestionAnswer[] = []

  const traverse = (item: IntermediateQuestionAnswer) => {
    if (item.type === 'composite') {
      // 复合题：递归扁平化子题
      if (Array.isArray(item.answers)) {
        item.answers.forEach((subItem) => {
          traverse(subItem as IntermediateQuestionAnswer)
        })
      }
    } else {
      let answerData: string[] = []

      if (item.type === 'single_choice' || item.type === 'multiple_choice') {
        answerData = Array.isArray(item.answers)
          ? (item.answers as string[]).map(String)
          : item.answers !== undefined && item.answers !== null && item.answers !== ''
            ? [String(item.answers)]
            : []
      } else if (item.type === 'true_false' || item.type === 'judgment') {
        answerData =
          item.answers !== undefined && item.answers !== null && item.answers !== ''
            ? [String(item.answers)]
            : []
      } else if (item.type === 'fill_in_blank') {
        answerData = Array.isArray(item.answers)
          ? (item.answers as string[]).map(String)
          : item.answers !== undefined && item.answers !== null && item.answers !== ''
            ? [String(item.answers)]
            : []
      } else {
        // 主观题及其他
        answerData =
          item.answers !== undefined && item.answers !== null && item.answers !== ''
            ? [String(item.answers)]
            : []
      }

      result.push({
        questionId: item.questionId,
        answerData,
      })
    }
  }

  list.forEach(traverse)
  return result
}

/**
 * 提交作业答卷数据
 * 步骤：先将本地所有 Base64 图片 (手写板/照片) 递归上传至云端替换为 URL，最后调用接口提交
 * @param questionAnswerList 格式化好的题目作答数据列表
 */
const submitHomeworkAnswers = async (questionAnswerList: IntermediateQuestionAnswer[]) => {
  const homeworkId = route.params.homeworkId as string
  if (!homeworkId) {
    throw new Error('作业信息缺失')
  }

  showMessage('正在上传图片并保存作答，请稍候...', 'info')

  // 1. 递归上传所有 Base64 图片并就地替换为云端 CDN 链接地址
  await uploadAnswersImages(questionAnswerList)

  // 2. 转换扁平化为后端要求的格式
  const finalQuestionAnswerList = transformToBackendFormat(questionAnswerList)
  console.log('[Submit] 提交后端的最终扁平化数据:', finalQuestionAnswerList)

  // 3. 调用后端接口保存提交
  const result = await apiService.homeworkSubmitSave({
    homeworkId,
    questionAnswerList: finalQuestionAnswerList,
  })

  if (!result.success) {
    throw new Error(result.message || '提交保存失败')
  }
}

/**
 * 触发作业提交动作，进行保存、漏答校验与云端数据提交
 */
const handleBoardUpload = async () => {
  // 防重复点击守卫
  if (isSubmitting.value) return
  isSubmitting.value = true

  try {
    // 1. 自动保存当前选中题目的画布笔迹及作答状态至缓存
    await saveCurrentPage()

    // 2. 检查是否有任何作答记录，若无有效回答，则直接阻断提交
    const hasAnyAnswer = externalQuestions.value.some((q) => getQuestionStatus(q) === 'answered')
    if (!hasAnyAnswer) {
      showMessage('没有找到任何作答内容，请先在题目上进行作答', 'warning')
      isSubmitting.value = false
      return
    }

    // 3. 全局漏答校验，禁止漏题直接提交
    const totalQuestions = externalQuestions.value.length
    const answeredQuestionIndices: number[] = []
    externalQuestions.value.forEach((question, index) => {
      if (getQuestionStatus(question) === 'answered') {
        answeredQuestionIndices.push(index)
      }
    })

    const submittedQuestions = answeredQuestionIndices.length

    // 若存在未作答题目，计算未答题号并弹出提示，终止提交
    if (submittedQuestions < totalQuestions) {
      const incompleteQuestionNumbers: number[] = []
      for (let i = 0; i < totalQuestions; i++) {
        if (!answeredQuestionIndices.includes(i)) {
          incompleteQuestionNumbers.push(i + 1)
        }
      }

      isSubmitting.value = false
      await showIncompleteHomeworkDialog(
        totalQuestions,
        submittedQuestions,
        incompleteQuestionNumbers,
      )
      return
    }

    // 4. 提取本地作答数据，并提交流程至云端
    const questionAnswerList = prepareSubmitData()
    await submitHomeworkAnswers(questionAnswerList)

    showMessage('提交成功', 'success')
    isHomeworkSubmitted.value = true // 修改界面状态为已提交

    // 5. 自动同步客观题错题记录到错题本
    await autoRecordMistakes()

    // 6. 持久化该作业的已提交状态至本地 IndexedDB 数据库
    if (route.params.homeworkId) {
      await homeworkStore.saveCurrentHomeworkSubmission(route.params.homeworkId as string, true)
    }
  } catch (error) {
    console.error('[HomeworkAnswerView] 提交答案异常:', error)
    showMessage(error instanceof Error ? error.message : '提交失败，请重试', 'error')
  } finally {
    isSubmitting.value = false
  }
}

// 根据 currentQuestionIndex 恢复当前选中的作业题目并初始化状态
onMounted(async () => {
  const homeworkId = route.params.homeworkId as string

  // 1. 优先从本地 IndexedDB 恢复作业的提交状态
  if (homeworkId) {
    const dbData = await homeworkStore.loadHomeworkSubmissionFromDB(homeworkId)
    if (dbData) {
      // 如果允许重复提交 (resubmitType 为 '1')，则解锁编辑模式；否则恢复真实的提交状态
      if (resubmitType.value === '1') {
        isHomeworkSubmitted.value = false
      } else {
        isHomeworkSubmitted.value = dbData.isSubmitted
      }
    }
  }

  // 2. 如果题目列表为空，直接终止后续的初始化逻辑
  if (!externalQuestions.value.length) {
    return
  }

  // 3. 初始化题目本地作答字段结构
  externalQuestions.value.forEach((question) => {
    initExerciseAnswerFields(question)
  })

  // 4. 计算需要高亮并选中的目标题目索引（优先恢复 Store 记录的索引，越界则默认首题）
  let targetIndex = currentQuestionIndex.value ?? -1
  if (targetIndex < 0 || targetIndex >= externalQuestions.value.length) {
    targetIndex = 0
  }

  await nextTick()

  // 6. 将当前选中题目同步并加载到右侧的白板和作答区域
  const targetQuestion = externalQuestions.value[targetIndex]
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
  background: #f7f6ff;
}

.answer-body-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f7f6ff;
  min-height: 0;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  box-shadow: 0px 0px 29px 0px rgba(94, 128, 254, 0.18);
  overflow: hidden;
  z-index: 1;
}

.answer-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #ffffff;
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
  background: linear-gradient(to right, #0f002e 4%, #ffffff 6%);
  width: 100%;
}

.panel-bg2 {
  height: 100%;
  background: linear-gradient(to left, #0f002e 4%, #ffffff 6%);
  width: 100%;
}

.panel-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
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
  background: #fbfaff;
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
  justify-content: space-between;
  padding: 0 24px;
  z-index: 50;
  background-color: #ffffff;
}

.question-render-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
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
  flex: 1 0 0; /* 默认展开占满剩余空间 */
  min-height: 0;
  transition: flex 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  margin: 0;
  position: relative;
  will-change: flex;
  contain: layout paint;
}

.question-image-section.collapsed {
  flex: 0.25 0 0; /* 收起时占约 20% */
}

.question-image-content {
  flex: 1;
  padding: 0;
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
  flex: 0 0 auto; /* 改为自适应内容高度，不强占空间 */
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0; /* 边距移动到内容区域以实现无内容时高度完全为 0 */
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

.question-solve-card.is-submitted {
  background: #ffffff;
}

.question-html-preview {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 16px;
  background: #fbfaff;
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
  padding: 16px;
}

.result-section:empty {
  display: none; /* 无内容时隐藏，彻底不占高度 */
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
  position: relative;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 12px;
  background: transparent;
}

.toolbar-center-wrapper {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
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

/* 草稿纸弹窗样式 */
.draft-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.draft-dialog-container {
  width: 90vw;
  height: 85vh;
  background: #ffffff;
  border-radius: 24px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.8);
}

.draft-dialog-header {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f1f5f9;
}

.draft-dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}

.draft-dialog-close {
  color: #64748b;
  transition: color 0.2s;
  &:hover {
    color: #0f172a;
  }
}

.draft-dialog-body {
  flex: 1;
  min-height: 0;
  padding: 16px;
  background: #f8fafc;
}

.draft-dialog-footer {
  padding: 12px 24px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #ffffff;
}

.question-solve-card:not(.is-submitted) .question-image-section {
  flex: 1 0 0;
}

.markdown-question-container {
  position: relative;
  height: 100%;
  width: 100%;
}

.markdown-question-container :deep(.question-html-preview) {
  pointer-events: auto;
  color: #393548; /* 统一文字颜色 */
  font-size: 15px;
  line-height: 1.6;

  .left-panel-question-title {
    font-size: 16px;
    font-weight: 700;
    color: #393548;
    margin-bottom: 16px;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }

  th,
  td {
    border: 1px solid #e2e8f0;
    padding: 8px 12px;
    text-align: left;
  }

  th {
    background-color: #f8fafc;
    font-weight: 600;
    color: #475569;
  }
}
</style>
