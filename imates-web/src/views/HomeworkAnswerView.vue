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
            <div class="panel-card question-solve-card">
              <!-- 情况 A: 交互式组件 (仅限 选择 和 判断) -->
              <div 
                class="question-render-container" 
                v-if="currentAnswerQuestion && ['single_choice', 'multiple_choice', 'true_false'].includes(currentAnswerQuestion.type || '')"
              >
                <!-- 模拟画板工具栏布局的顶部栏 (仅在未锁定/未提交时显示) -->
                <div class="question-render-toolbar" v-if="!isHomeworkLocked">
                  <div class="toolbar-right">
                    <Button
                      v-if="!isHomeworkLocked"
                      :label="homeworkButtonText"
                      variant="primary"
                      size="mdCompact"
                      @click="handleBoardUpload"
                    />
                    <div v-else class="submitted-tip">
                      <q-icon name="check_circle" color="green" size="24px" />
                      <span>{{ isHomeworkSubmitted ? '作业已提交' : '作业已截止' }}</span>
                    </div>
                  </div>
                </div>

                <div 
                  class="question-render-area" 
                  ref="currentQuestionRenderRef"
                >
                  <ChoiceQuestion
                    v-if="currentAnswerQuestion.type === 'single_choice' || currentAnswerQuestion.type === 'multiple_choice'"
                    :question="currentAnswerQuestion"
                    v-model="currentQuestionChooseList"
                    :disabled="isHomeworkSubmitted"
                    show-title
                  />
                  <JudgmentQuestion
                    v-else-if="currentAnswerQuestion.type === 'true_false'"
                    :question="currentAnswerQuestion"
                    v-model="currentQuestionJudgment"
                    :disabled="isHomeworkSubmitted"
                    show-title
                  />

                  <!-- 单道题提交后的答案和解析 -->
                  <div v-if="isHomeworkSubmitted" class="answer-analysis-wrapper">
                    <div class="divider"></div>
                    <div class="analysis-card answer-card">
                      <div class="card-title">
                        <div class="title-left">
                          <q-icon name="check_circle" color="green" size="20px" />
                          <span>标准答案 (作业已提交)</span>
                        </div>
                        <q-btn
                          v-if="!isCurrentQuestionCorrect"
                          flat
                          dense
                          color="primary"
                          class="add-mistake-book-btn"
                          @click="handleAddToMistakeBook"
                        >
                          <q-icon name="add_circle_outline" size="18px" class="q-mr-xs" />
                          <span>加入错题本</span>
                        </q-btn>
                      </div>
                      <div class="card-content" v-html="renderMessageContent(currentAnswerQuestion.answer)"></div>
                    </div>
                    <div class="analysis-card explanation-card">
                      <div class="card-title">
                        <span>题目解析</span>
                      </div>
                      <div class="card-content" v-html="renderMessageContent(currentAnswerQuestion.explanation)"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 情况 B: 白板手写 (填空、问答 及 其他) -->
              <div class="question-render-container" v-else-if="currentAnswerQuestion">
                <!-- 模拟画板工具栏布局的顶部栏 (仅在未锁定/未提交时显示) -->
                <div class="question-render-toolbar" v-if="!isHomeworkLocked">
                  <div class="toolbar-right">
                    <Button
                      :label="homeworkButtonText"
                      variant="primary"
                      size="mdCompact"
                      @click="handleBoardUpload"
                    />
                  </div>
                </div>

                <div class="question-render-area">
                  <div class="drawing-board-wrapper" :class="{ 'is-submitted': isHomeworkLocked }">
                    <!-- 预览层：在截图生成前立即显示渲染后的 HTML，实现零延迟感 -->
                    <div 
                      v-if="!questionBgImage && currentAnswerQuestion" 
                      class="question-html-preview markdown-content" 
                      v-html="questionHtml"
                    ></div>

                    <DrawingBoardNew
                      :ref="(el) => setDrawingBoardRef(el, 0)"
                      :showGrid="false"
                      :enableAskAi="true"
                      :show-toolbar="!isHomeworkLocked"
                      :disabled="isHomeworkLocked"
                      :show-zoom-controls="false"
                      :background-image="questionBgImage"
                      :initial-zoom="70"
                      @clear="handleClearRequest"
                    />
                  </div>

                  <!-- 提交后的答案和解析 -->
                  <div v-if="isHomeworkLocked" class="answer-analysis-wrapper">
                    <div class="divider"></div>
                    <div class="analysis-card answer-card">
                      <div class="card-title">
                        <div class="title-left">
                          <q-icon name="check_circle" color="green" size="20px" />
                          <span>标准答案 (作业已提交)</span>
                        </div>
                        <q-btn
                          v-if="!isCurrentQuestionCorrect"
                          flat
                          dense
                          color="primary"
                          class="add-mistake-book-btn"
                          @click="handleAddToMistakeBook"
                        >
                          <q-icon name="add_circle_outline" size="18px" class="q-mr-xs" />
                          <span>加入错题本</span>
                        </q-btn>
                      </div>
                      <div class="card-content" v-html="renderMessageContent((currentAnswerQuestion.answer || '').replace(/\$\s+/g, '$').replace(/\s+\$/g, '$'))"></div>
                    </div>
                    <div class="analysis-card explanation-card">
                      <div class="card-title">
                        <span>题目解析</span>
                      </div>
                      <div class="card-content" v-html="renderMessageContent((currentAnswerQuestion.explanation || '').replace(/\$\s+/g, '$').replace(/\s+\$/g, '$'))"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="empty-render-area">
                <div class="empty-tip">请选择题目开始作答</div>
              </div>

              <!-- 底部留白 -->
              <div class="action-footer-placeholder" v-if="currentAnswerQuestion"></div>
            </div>
            <!-- IP 悬浮功能 -->
            <div
              :class="['textbookip-float', mode === 'left' ? 'float-right' : 'float-left']"
              @click="handleToggle"
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
          v-model="currentQuestionChooseList"
        />
        <FillBlankQuestion
          v-else-if="currentAnswerQuestion.type === 'fill_in_blank'"
          :question="currentAnswerQuestion"
          v-model="currentQuestionFillList"
        />
        <JudgmentQuestion
          v-else-if="currentAnswerQuestion.type === 'true_false'"
          :question="currentAnswerQuestion"
          v-model="currentQuestionJudgment"
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
import QuestionList from '@/components/QuestionList.vue'
import DrawingBoardNew from '@/components/drawingBoardNew.vue'
import FloatBubble from '@/components/base/FloatBubble.vue'
import Button from '@/components/base/Button.vue'
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
import { getHomeworkButtonText } from '@/constants/homework'
import Dialog from '@/components/base/Dialog.vue'
import StatusTag from '@/components/base/StatusTag.vue'
import HomeworkChatPanel from '@/components/chat/chatpanel/HomeworkChatPanel.vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { addMistake } from '@/services/storage/mistake-storage'
import { AI_ROLE_OPTIONS } from '@/constants/options'
import goBackIcon from '/icons/goback.svg'
import pagePrevIcon from '/icons/left.svg'
import pageAddIcon from '/icons/addPaper.svg'
import pageNextIcon from '/icons/right.svg'
import textbookipIcon from '/icons/textbookip.png'
import wodezuodaSelectIcon from '/icons/wodezuoda_select.svg'
import xuebandayiUnselectIcon from '/icons/xuebandayi_unselect.svg'
import askXuebanIcon from '/icons/askXueban.svg'
import MultiSelect from '@/components/base/MultiSelect.vue'
import ChoiceQuestion from '@/components/exercise/ChoiceQuestion.vue'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion.vue'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion.vue'
import BaseQuestion from '@/components/exercise/BaseQuestion.vue'
import { parseQuestionStructure, mapBackendTypeToFrontend } from '@/utils/business/exercise-utils'

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
  answerDataCache,
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
const MAX_BOARD_PAGES = 3
const drawingBoardRefs = ref<Array<InstanceType<typeof DrawingBoardNew> | null>>([])

const setDrawingBoardRef = (el: any, pageIndex: number) => {
  drawingBoardRefs.value[pageIndex] = el as InstanceType<typeof DrawingBoardNew> | null
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

const currentQuestionJudgment = computed({
  get: () => {
    const questionKey = getQuestionKey(currentAnswerQuestion.value)
    if (!questionKey) return ''
    const cache = (answerDataCache.value as Record<string, any>)[questionKey]
    return cache?.judgmentValue || ''
  },
  set: (value: string) => {
    const questionKey = getQuestionKey(currentAnswerQuestion.value)
    if (!questionKey) return
    const cache = (answerDataCache.value as Record<string, any>)[questionKey] || {}
    cache.judgmentValue = value
    ;(answerDataCache.value as Record<string, any>)[questionKey] = cache
  },
})

const currentQuestionFillList = computed({
  get: () => {
    const questionKey = getQuestionKey(currentAnswerQuestion.value)
    if (!questionKey) return []
    const cache = (answerDataCache.value as Record<string, any>)[questionKey]
    return cache?.fillList || []
  },
  set: (value: string[]) => {
    const questionKey = getQuestionKey(currentAnswerQuestion.value)
    if (!questionKey) return
    const cache = (answerDataCache.value as Record<string, any>)[questionKey] || {}
    cache.fillList = value
    ;(answerDataCache.value as Record<string, any>)[questionKey] = cache
  },
})

/** 是否有任何题目已作答 */
const isAnyQuestionAnswered = computed(() => {
  return externalQuestions.value.some(q => getQuestionStatus(q) === 'answered')
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
    handleToggle()
  } else if (item.label === '我的作答') {
    if (mode.value === 'right') {
      handleToggle()
    }
    return
  }
}

// 切换模式并发送题目给 AI
const handleToggle = async (question?: ExerciseItem) => {
  console.log('[HOMEWORK_ANSWER_VIEW] handleToggle 触发, 传入题目 ID:', (question as any)?.bmNo || '无')
  
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

  // 逻辑调整：
  // 1. 如果传入了题目（点击了问问学伴图标），确保面板是打开的
  if (question && (question as any).bmNo) {
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
  if (question && (question as any).bmNo && homeworkChatPanelRef.value) {
    console.log('[HOMEWORK_ANSWER_VIEW] 准备调用 HomeworkChatPanel.sendQuestion:', (question as any).bmNo)
    nextTick(() => {
      // 假设 HomeworkChatPanel 有 sendQuestion 方法
      // 如果方法名不同，请根据组件内部定义修改
      (homeworkChatPanelRef.value as any).sendQuestion?.(question)
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
  const hasFillData = Array.isArray(cache.fillList) && cache.fillList.some((v: string) => v && v.trim() !== '')
  const hasJudgmentData = !!cache.judgmentValue

  // 已作答：任一作答数据存在即可
  if (hasBoardData || hasSelectedOption || hasFillData || hasJudgmentData) return 'answered'

  // 未作答
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
const saveCurrentPage = async (questionToSave: ExerciseItem | null = currentAnswerQuestion.value, asyncImage = false) => {
  if (!questionToSave) return

  const questionKey = getQuestionKey(questionToSave)
  if (!questionKey) return

  console.log(`[HOMEWORK_IMAGE_PROCESS] 开始保存题目数据: ${questionKey}, 是否异步: ${asyncImage}`)

  // 1. 保存笔迹数据 (JSON)
  const board = drawingBoardRefs.value[0]
  if (board && questionToSave === currentAnswerQuestion.value) {
    const boardData = board.saveData()
    if (boardData) {
      const existingCache = (answerDataCache.value as Record<string, any>)[questionKey] || {}
      ;(answerDataCache.value as Record<string, any>)[questionKey] = {
        ...existingCache,
        boardData: boardData,
        timestamp: Date.now(),
      }
      
      // 2. 保存画板图片数据 (笔迹 + 背景)
      const captureBoardImage = () => {
        const imageData = board.exportToJpg?.(0.9)
        if (imageData) {
          const currentCache = (answerDataCache.value as Record<string, any>)[questionKey] || {}
          ;(answerDataCache.value as Record<string, any>)[questionKey] = {
            ...currentCache,
            imageData: imageData
          }
          console.log(`[HOMEWORK_IMAGE_PROCESS] 画板截图完成: ${questionKey}`)
        }
      }

      if (asyncImage) {
        setTimeout(captureBoardImage, 0)
      } else {
        captureBoardImage()
      }
    }
  } 
  
  // 3. 结构化题目（选择、填空、判断）的截图处理 - 统一使用隐藏渲染容器 questionRenderRef 确保样式完整
  const isStructured = ['single_choice', 'multiple_choice', 'judgment', 'fill'].includes(questionToSave.type || '')
  if (isStructured && questionRenderRef.value) {
    const renderEl = questionRenderRef.value
    
    const captureStructuredImage = async () => {
      try {
        // 确保 MathJax 渲染完成
        await MathJaxUtils.renderMathAndWait(renderEl)
        
        // 等待所有图片加载
        const imgs = Array.from(renderEl.querySelectorAll('img'))
        await Promise.all(imgs.map(img => {
          if (img.complete) return Promise.resolve()
          return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })
        }))

        const dataUrl = await htmlToImage.toPng(renderEl, {
          backgroundColor: '#ffffff',
          pixelRatio: 1.5, // 提高采样率保证清晰度
          cacheBust: true,
          style: {
            // 强制应用一些关键样式，防止丢失
            transform: 'scale(1)',
            transformOrigin: 'top left'
          }
        })

        const existingCache = (answerDataCache.value as Record<string, any>)[questionKey] || {}
        ;(answerDataCache.value as Record<string, any>)[questionKey] = {
          ...existingCache,
          imageData: dataUrl,
          timestamp: Date.now(),
        }
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

/** 判断当前客观题是否回答正确 */
const isCurrentQuestionCorrect = computed(() => {
  if (!currentAnswerQuestion.value || !isHomeworkSubmitted.value) return true
  const question = currentAnswerQuestion.value
  const answer = question.answer

  // 1. 选择题判断
  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    const userChoices = currentQuestionChooseList.value
    if (!userChoices || userChoices.length === 0) return false

    let standardChoices: string[] = []
    if (Array.isArray(answer)) {
      standardChoices = answer
    } else if (typeof answer === 'string') {
      // 兼容 "A,B" 或 "A" 格式
      standardChoices = answer.split(',').map((s) => s.trim()).filter(Boolean)
    }

    if (userChoices.length !== standardChoices.length) return false
  return userChoices.every((c: string) => standardChoices.includes(c))
}

  // 2. 判断题判断
  if (question.type === 'judgment') {
    const userVal = currentQuestionJudgment.value
    if (!userVal) return false
    const trimAnswer = (answer || '').trim()
    if (userVal === '对' || userVal === '正确') return [true, '对', '√', '正确', 'true'].includes(trimAnswer)
    if (userVal === '错' || userVal === '错误') return [false, '错', '×', '错误', 'false'].includes(trimAnswer)
    return false
  }

  // 3. 其他题型（填空、问答等）无法自动判题，默认显示“加入错题本”入口
  return false
})

/** 加入错题本逻辑 */
const handleAddToMistakeBook = async () => {
  if (!currentAnswerQuestion.value) return

  try {
    const question = currentAnswerQuestion.value
    const subject = question.subject || getSubject() || 'math'
    
    // 1. 同时调用后端接口，保持同步
    const success = await apiService.addQuestionToList(question, subject)
    
    // 2. 保存到本地错题本数据库，包含原始作答和来源信息
    const questionKey = getQuestionKey(question)
    const originalAnswer = (answerDataCache.value as Record<string, any>)[questionKey]
    const homeworkId = route.params.homeworkId as string
    
    await addMistake({
      id: `${questionKey}_${homeworkId || 'manual'}`, // 使用题目 ID 和作业 ID 组合作为唯一标识
      bmNo: questionKey,
      homeworkId: homeworkId,
      homeworkName: homeworkName.value,
      originalAnswer: originalAnswer,
      questionData: question
    })

    if (success) {
      showMessage('已成功加入错题本', 'success')
    } else {
      showMessage('题目已加入本地错题本，但同步到云端失败', 'warning')
    }
  } catch (error) {
    console.error('[HomeworkAnswerView] 加入错题本异常:', error)
    showMessage('加入错题本失败', 'error')
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
    await saveCurrentPage(oldQuestion, false)
  }

  // 2. 立即更新 UI 状态
  currentAnswerQuestion.value = question
  previousQuestionKey.value = questionKey
  questionBgImage.value = ''
  
  const isChoice = question.type === 'single_choice' || question.type === 'multiple_choice'
  const raw = (!isChoice && question.questionContent)
    ? question.questionContent
    : (question.question || question.title || '').toString()
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

    // 等待所有图片加载完成，确保截图包含图片内容
    const imgs = Array.from(el.querySelectorAll('img'))
    if (imgs.length > 0) {
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve) => {
            img.onload = resolve
            img.onerror = resolve
          })
        })
      )
    }
    if (isStale()) return

    // el规范图像
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
  const board = drawingBoardRefs.value[0]

  if (!questionKey) {
    // 没有题目，清空画布
    board?.clearAll()
    return
  }

  if (!board) {
    console.warn('[HomeworkAnswerView] 画板 Ref 尚未准备好，无法恢复笔迹:', questionKey)
    return
  }

  const rawCache = (answerDataCache.value as Record<string, any>)[questionKey]
  if (rawCache && rawCache.boardData) {
    // 加载缓存的画板状态数据
    board.loadData(rawCache.boardData as any)
    console.log('[HomeworkAnswerView] 从缓存成功恢复画布数据:', questionKey)
  } else {
    // 没有缓存数据，清空画布
    board.clearAll()
    console.log('[HomeworkAnswerView] 该题目没有缓存数据，已清空画布:', questionKey)
  }
}

// 返回作业列表页面
const goBack = async () => {
  const homeworkId = route.params.homeworkId as string
  if (homeworkId) {
    try {
      console.log('[HOMEWORK_BACK] 准备保存当前进度并持久化到本地...')
      // 1. 同步保存当前题目的数据到内存缓存
      await saveCurrentPage()
      // 2. 将整个作答缓存同步到本地数据库
      await homeworkStore.saveCurrentHomeworkSubmission(homeworkId, isHomeworkSubmitted.value)
      console.log('[HOMEWORK_BACK] 进度已成功保存')
    } catch (err) {
      console.error('[HOMEWORK_BACK] 返回前持久化失败:', err)
    }
  }
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
  await saveCurrentPage()

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
  if (homeworkId) {
    // 优先从 IndexedDB 加载已提交的历史数据
    const dbData = await homeworkStore.loadHomeworkSubmissionFromDB(homeworkId)
    if (dbData) {
      // 判断逻辑：如果 resubmitType 为 '1' (允许重复提交)，则不锁定提交状态
      if (resubmitType.value === '1') {
        isHomeworkSubmitted.value = false
        console.log('[HomeworkAnswerView] 作业允许重复提交，解锁编辑模式')
      } else {
        isHomeworkSubmitted.value = dbData.isSubmitted
      }
      console.log('[HomeworkAnswerView] 已从 DB 恢复作业提交状态:', dbData.isSubmitted)
    }
  }

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

.toolbar-right {
  position: absolute;
  right: 24px;
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

.ai-chat-card {
  border-radius: 20px;
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

.right-panel-options {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
}

.drawing-board-wrapper {
  width: 100%;
  height: 600px;
  position: relative;
  flex-shrink: 0;
  transition: height 0.3s ease-in-out;
}

.drawing-board-wrapper.is-submitted {
  height: 320px;
  margin-bottom: 20px;
}

/* 立即渲染的预览层样式 */
.question-html-preview {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 10px 20px;
  background: #ffffff;
  z-index: 0;
  overflow-y: auto;
  pointer-events: none; /* 确保不影响画板书写 */
}

.answer-analysis-wrapper {
  margin-top: 30px;
  .divider {
    height: 1px;
    background: #e2e8f0;
    margin-bottom: 24px;
  }
}

.analysis-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;

  .card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    
    .title-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    span {
      font-weight: 600;
      font-size: 15px;
      color: #334155;
    }
  }

  .card-content {
    font-size: 15px;
    line-height: 1.6;
    color: #475569;
    white-space: pre-wrap;
  }
}

.submitted-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #10b981;
  font-weight: 500;
  font-size: 16px;
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

.xueban-action-btn {
  width: 28px !important;
  height: 28px !important;
  margin-right: 4px;
}

.xueban-action-btn .action-icon {
  width: 22px !important;
  height: 22px !important;
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
.analysis-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #e2e8f0;

  .card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;

    .title-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .add-mistake-book-btn {
      font-size: 13px;
      font-weight: normal;
      padding: 2px 8px;
      border-radius: 6px;
      
      &:hover {
        background: rgba(97, 94, 254, 0.05);
      }
    }
  }

  .card-content {
    font-size: 15px;
    line-height: 1.6;
    color: #334155;
    word-break: break-all;
  }
}
</style>
