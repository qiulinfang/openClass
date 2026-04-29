<template>
  <div class="exercise-solve-container">
    <!-- 核心工作区 -->
    <div class="exercise-body">
      <SplitPanel
        ref="splitPanelRef"
        :initial-mode="mode"
        :left-config="[36, 30, 50]"
        :center-config="[64, 50, 80]"
        :right-config="[36, 36, 60]"
        :transition-duration="0.5"
        :transition-easing="'ease-in-out'"
        :show-splitters="true"
        :splitter-class="mode === 'left' ? 'handle-blue' : 'handle-indigo'"
        @mode-change="handleModeChange"
        @toggle="onToggle"
      >
        <!-- 左侧：题目面板 -->
        <template #left="{ isVisible }">
          <div
            class="panel-bg1"
          >
            <div
              class="panel-content"
              :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
              :style="{ width: '100%', minWidth: '300px' }"
            >
              <div class="panel-card problem-card">
                <div class="panel-card-body">
                  <QuestionList
                    ref="questionListRef"
                    :type="currentType"
                    :external-questions="props.externalQuestions"
                    :show-photo-search="true"
                    :show-send-to-ai="true"
                    :show-question-actions="false"
                    :selected-subject-filter="selectedSubjectFilter"
                    @question-selected="handleQuestionSelected"
                    @question-deleted="handleQuestionDeleted"
                    @start-ai-guidance="handleStartAiGuidance"
                    @open-mini-class="handleOpenMiniClass"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 中间：题目渲染区域 -->
        <template #center="{}">
          <div class="panel-bg"></div>
          <div class="panel-content" :style="{ width: '100%', minWidth: '500px' }">
            <div class="panel-card question-solve-card">
              <div class="question-render-area" v-if="currentQuestion">
                <ChoiceQuestion
                  v-if="currentQuestion.type === 'choice'"
                  :question="currentQuestion"
                  v-model="currentQuestionChooseList"
                  :disabled="isCurrentQuestionSubmitted"
                  show-title
                />
                <JudgmentQuestion
                  v-else-if="currentQuestion.type === 'judgment'"
                  :question="currentQuestion"
                  v-model="currentQuestionJudgment"
                  :disabled="isCurrentQuestionSubmitted"
                  show-title
                />
                <FillBlankQuestion
                  v-else-if="currentQuestion.type === 'fill'"
                  :question="currentQuestion"
                  v-model="currentQuestionFillList"
                  :disabled="isCurrentQuestionSubmitted"
                  show-title
                />
                <BaseQuestion
                  v-else
                  :question="currentQuestion"
                  show-title
                />

                <!-- 单道题提交后的答案和解析 -->
                <div v-if="isCurrentQuestionSubmitted" class="answer-analysis-wrapper">
                  <div class="divider"></div>
                  <div class="analysis-card answer-card">
                    <div class="card-title">
                      <span>标准答案</span>
                    </div>
                    <div class="card-content" v-html="currentQuestion.answer"></div>
                  </div>
                  <div class="analysis-card explanation-card">
                    <div class="card-title">
                      <span>题目解析</span>
                    </div>
                    <div class="card-content" v-html="currentQuestion.explanation"></div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-render-area">
                <div class="empty-tip">请选择题目开始作答</div>
              </div>

              <!-- 底部操作区 -->
              <div class="action-footer" v-if="currentQuestion && props.showSubmitBtn">
                <div v-if="!isCurrentQuestionSubmitted" class="submit-action-wrapper">
                  <button 
                    class="ai-action-btn submit-btn" 
                    :disabled="!isCurrentQuestionAnswered"
                    @click="handleSingleQuestionSubmit"
                  >
                    <span class="btn-text">提交本题</span>
                  </button>
                </div>
                <div v-else class="submitted-tip-wrapper">
                  <div class="submitted-content">
                    <div class="submitted-tip">
                      <div class="success-icon-wrapper">
                        <q-icon name="check_circle" color="green" size="24px" />
                      </div>
                      <span class="submitted-text">本题已提交</span>
                    </div>
                    <div class="divider"></div>
                    <button class="ai-action-btn" @click="mode === 'left' ? handleAskAiClick() : handleToggle()">
                      <span class="btn-text">{{ mode === 'left' ? '问问AI' : '返回作答' }}</span>
                      <q-icon 
                        :name="mode === 'left' ? 'auto_awesome' : 'keyboard_return'" 
                        size="18px" 
                        class="btn-icon"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <!-- IP 悬浮功能 -->
            <div
              v-if="!isComponent"
              :class="['textbookip-float', mode === 'left' ? 'float-right' : 'float-left']"
              @click="handleToggle"
            >
              <img :src="textbookipIcon" alt="textbookip" class="textbookip-icon" />
            </div>
          </div>
        </template>

        <!-- 右侧：AI 面板 -->
        <template #right="{ isVisible }">
          <div
            class="panel-bg2"
          >
            <div
              class="panel-content"
              :class="{ 'panel-hidden': !isVisible, 'panel-visible': isVisible }"
              :style="{ width: '100%', minWidth: '300px' }"
            >
              <div class="panel-card ai-chat-card">
                <div class="panel-card-body">
                  <ChatView
                    ref="aiGeneralChatViewRef"
                    type="ai-general"
                    :compressed-height="360"
                    :model-options="AI_ROLE_OPTIONS_JK"
                    @open-teacher-dialog="handleOpenTeacherDialog"
                    @switch-to-teacher="handleSwitchToTeacher"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
      </SplitPanel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showMessage } from '@/utils'
import { CLASSROOM_EXERCISE } from '@/mocks/negativeNumbers'
import { useScreenSnapshot } from '@/composables/useScreenSnapshot'
import { useMessageRenderer } from '@/composables/useMessageRenderer'
import { MathJaxUtils } from '@/utils/math/mathjax'
import SplitPanel from '@/components/base/SplitPanel.vue'
import QuestionList from '@/components/QuestionList.vue'
import ChoiceQuestion from '@/components/exercise/ChoiceQuestion.vue'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion.vue'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion.vue'
import BaseQuestion from '@/components/exercise/BaseQuestion.vue'
import ChatView from '@/components/ChatView.vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import FloatBubble from '@/components/base/FloatBubble.vue'
import CommonSelect from '@/components/base/Select.vue'
import CommonActionButton from '@/components/base/Button.vue'
import { AI_ROLE_OPTIONS_JK } from '@/constants/options'
import { useQuestionStore } from '@/stores/questionStore'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { storeToRefs } from 'pinia'
import { useExerciseChatPanel } from '@/composables/useExerciseChatPanel'
import { ADDRESS_CATALOG } from '@/config/env-config'
import goBackIcon from '/icons/goback.svg'
import textbookipIcon from '/icons/textbookip.png'

// Markdown + 公式渲染工具
const { renderMessageContent } = useMessageRenderer()

// 截图工具
const { captureScreenSnapshot } = useScreenSnapshot()

// 学科过滤相关
const selectedSubjectFilter = ref<string>('') // 空字符串表示显示所有学科

// 学科过滤变化处理
const onSubjectFilterChange = async () => {
  console.log('[ExerciseSolveViewNewJK] 学科过滤条件改变:', selectedSubjectFilter.value)
}

// 模式: 'left' = 题目+聊天, 'right' = 聊天+AI
const mode = ref<'left' | 'right'>('left')

// --- 环境配置 ---
type EnvType = 'mock' | 'dev' | 'prod'
const currentEnv = ref<EnvType>('dev') // 可在此处切换环境: 'mock', 'dev', 'prod'

// ExerciseChatPanel 全局状态同步
const { isExerciseChatPanelVisible } = useExerciseChatPanel()
watch(isExerciseChatPanelVisible, (visible) => {
  if (visible && mode.value !== 'right') {
    mode.value = 'right'
    splitPanelRef.value?.toggle?.()
  }
})

const props = withDefaults(
  defineProps<{
    isComponent?: boolean;
    externalQuestions?: any[];
    stage?: string;
    showSubmitBtn?: boolean;
  }>(),
  {
    showSubmitBtn: true
  }
)

// Refs
const splitPanelRef = ref<InstanceType<typeof SplitPanel> | null>(null)
const questionListRef = ref(null)
const aiGeneralStore = useAiGeneralChatStore()
const aiGeneralChatViewRef = ref<InstanceType<typeof ChatView> | null>(null)

// Router & Route
const router = useRouter()
const route = useRoute()

// 场景识别
const isFromHomework = computed(() => route.query.scene === 'homework' || props.stage)
const currentType = computed(() => isFromHomework.value ? 'homework' : 'exercise')

// 返回上一页
const goBack = () => {
  router.back()
}

// Store
const homeworkStore = useHomeworkStore()
const questionStore = useQuestionStore()
const aiExerciseStore = useAiExerciseChatStore()

// 统一的 currentQuestion 来源
const { currentQuestion: exerciseCurrentQuestion } = storeToRefs(questionStore)
const { currentQuestion: homeworkCurrentQuestion } = storeToRefs(homeworkStore)

const currentQuestion = computed(() => {
  // 如果有 props 传入的 externalQuestions，优先从当前 externalQuestions 中根据索引获取题目
  if (props.externalQuestions && props.externalQuestions.length > 0) {
    const store = isFromHomework.value ? homeworkStore : questionStore
    // 确保索引在有效范围内
    const index = Math.max(0, Math.min(store.currentQuestionIndex, props.externalQuestions.length - 1))
    return props.externalQuestions[index]
  }
  return isFromHomework.value ? homeworkCurrentQuestion.value : exerciseCurrentQuestion.value
})

const { currentSessionId } = storeToRefs(aiExerciseStore)
const { answerDataCache } = storeToRefs(homeworkStore)

// 题目作答和提交逻辑
const submittedQuestionIds = ref<Set<string>>(new Set()) // 已单独提交的题目 ID 集合

const getQuestionKey = (q: any) => (q ? (q.bmNo || q.id).toString() : '')

const currentQuestionChooseList = computed({
  get: () => {
    const key = getQuestionKey(currentQuestion.value)
    return (answerDataCache.value as any)[key]?.chooseList || []
  },
  set: (val) => {
    const key = getQuestionKey(currentQuestion.value)
    if (!key) return
    const cache = (answerDataCache.value as any)[key] || {}
    cache.chooseList = val
    ;(answerDataCache.value as any)[key] = cache
  },
})

const currentQuestionJudgment = computed({
  get: () => {
    const key = getQuestionKey(currentQuestion.value)
    return (answerDataCache.value as any)[key]?.judgmentValue || ''
  },
  set: (val) => {
    const key = getQuestionKey(currentQuestion.value)
    if (!key) return
    const cache = (answerDataCache.value as any)[key] || {}
    cache.judgmentValue = val
    ;(answerDataCache.value as any)[key] = cache
  },
})

const currentQuestionFillList = computed({
  get: () => {
    const key = getQuestionKey(currentQuestion.value)
    return (answerDataCache.value as any)[key]?.fillList || []
  },
  set: (val) => {
    const key = getQuestionKey(currentQuestion.value)
    if (!key) return
    const cache = (answerDataCache.value as any)[key] || {}
    cache.fillList = val
    ;(answerDataCache.value as any)[key] = cache
  },
})

const getQuestionStatus = (q: any) => {
  if (!q) return 'unanswered'
  const key = getQuestionKey(q)
  const cache = (answerDataCache.value as any)[key]
  if (!cache) return 'unanswered'
  
  // 作业场景下可能包含 boardData
  const hasBoardData = cache.boardData?.objects?.length > 0
  const hasChoiceData = cache.chooseList?.length > 0
  const hasFillData = cache.fillList?.some((v: string) => v && v.trim() !== '')
  const hasJudgmentData = cache.judgmentValue !== undefined && cache.judgmentValue !== null && cache.judgmentValue !== ''

  return hasBoardData || hasChoiceData || hasFillData || hasJudgmentData
    ? 'answered'
    : 'unanswered'
}

const isCurrentQuestionAnswered = computed(() => {
  if (!currentQuestion.value) return false
  return getQuestionStatus(currentQuestion.value) === 'answered'
})

const isCurrentQuestionSubmitted = computed(() => {
  if (!currentQuestion.value) return false
  const key = getQuestionKey(currentQuestion.value)
  return submittedQuestionIds.value.has(key)
})

const handleSingleQuestionSubmit = async () => {
  if (!currentQuestion.value) return
  const key = getQuestionKey(currentQuestion.value)
  
  // 1. 准备作答结果
  const cache = (answerDataCache.value as any)[key] || {}
  let userAnswer: any = null
  let isCorrect = false

  const targetQuestion = currentQuestion.value as any

  if (targetQuestion.type === 'choice') {
    userAnswer = cache.chooseList || []
    isCorrect = userAnswer.length === 1 && userAnswer[0] === targetQuestion.answer
  } else if (targetQuestion.type === 'judgment') {
    userAnswer = cache.judgmentValue
    const correctVal = targetQuestion.structuredContent?.judgmentResult
    const mappedUserAnswer = userAnswer === '对' ? 'true' : (userAnswer === '错' ? 'false' : String(userAnswer))
    isCorrect = mappedUserAnswer === String(correctVal)
  } else if (targetQuestion.type === 'fill') {
    userAnswer = cache.fillList || []
    const correctAnswers = Array.isArray(targetQuestion.structuredContent?.blanks) 
      ? targetQuestion.structuredContent.blanks.map((b: any) => b.answer)
      : []
    isCorrect = userAnswer.length === correctAnswers.length && 
                userAnswer.every((v: string, i: number) => v && v.trim() === correctAnswers[i])
  }

  // 如果是 Mock 环境，直接模拟成功并返回
  if (currentEnv.value === 'mock') {
    setTimeout(() => {
      submittedQuestionIds.value.add(key)
      showMessage('提交成功 (Mock)', 'success')
    }, 500)
    return
  }

  // 2. 调用 Node.js 练习提交接口
  try {
    const baseUrl = currentEnv.value === 'dev' 
      ? 'http://localhost:36565' 
      : ADDRESS_CATALOG.OPEN_CLASS_API

    const response = await fetch(`${baseUrl}/api/homework/exercise-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: localStorage.getItem('xuebanuserid') || 'guest',
        lessonId: 'L123',
        results: [{
          questionId: targetQuestion.id,
          isCorrect,
          selectedOption: Array.isArray(userAnswer) ? userAnswer[0] : userAnswer,
          type: targetQuestion.type
        }],
        date: new Date().toISOString().split('T')[0]
      })
    });
    
    const result = await response.json();
    if (result.success) {
      submittedQuestionIds.value.add(key)
      showMessage('提交成功', 'success')
    }
  } catch (error) {
    console.error('[ExerciseSolveViewNewJK] 练习提交失败:', error)
    showMessage('提交失败，请重试', 'error')
  }
}

// 切换模式
const handleToggle = () => {
  splitPanelRef.value?.toggle()
}

// SplitPanel 事件
const handleModeChange = (newMode: 'left' | 'right') => {
  mode.value = newMode
  // 切换到 AI 模式时，自动刷新通用对话列表
  if (newMode === 'right') {
    aiGeneralStore.loadSessions()
  }
}

const onToggle = (newMode: 'left' | 'right') => {
}

// 处理题目选择
const handleQuestionSelected = async () => {
  if (!currentQuestion.value) {
    return
  }

  await nextTick()

  // 渲染数学公式
  const contentEl = document.querySelector('.question-render-area')
  if (contentEl) {
    await MathJaxUtils.renderMathAndWait(contentEl as HTMLElement)
  }

  // 同步 AI 会话：切换题目时，自动加载该题目的专用会话，实现会话隔离
  const questionBmNo = currentQuestion.value?.bmNo
  if (questionBmNo) {
    const sessionId = `q-session-${questionBmNo}`
    const existingSession = aiGeneralStore.sessions.find(s => s.sessionId === sessionId)
    
    if (existingSession) {
      // 如果已有会话，切换过去
      await aiGeneralStore.switchSession(sessionId)
    } else {
      // 如果没有会话，创建一个以题目 ID 命名的专用会话
      // 避免污染通用会话列表，这里我们直接手动初始化 store 状态或调用一个专门的初始化方法
      // 但为了简单且符合当前 Store 设计，我们直接重置消息并设置当前会话
      aiGeneralStore.messages = []
      aiGeneralStore.currentSession = {
        sessionId: sessionId,
        sessionName: `题目: ${currentQuestion.value?.title || questionBmNo}`,
        createTime: Date.now(),
        updateTime: Date.now(),
        msgCount: 0
      }
      // 加载历史（如果本地有存储但不在 sessions 列表中）
      await aiGeneralStore.loadChatHistory(sessionId)
    }
  }
}

const handleStartAiGuidance = (question?: any) => {
  // 切换到 AI 模式
  if (mode.value === 'left' && splitPanelRef.value) {
    splitPanelRef.value.toggle()
  }
  
  // 如果传入了题目且不是当前题目，则启动 AI 指导
  if (question && (!currentQuestion.value || question.bmNo !== currentQuestion.value.bmNo)) {
    sendToAi(question)
  }
}

const handleOpenMiniClass = (question: any) => {
}

// 处理题目删除
const handleQuestionDeleted = (payload: { questionId: string; withDraft: boolean }) => {
}

const scrollToBottom = () => {
}

// 处理推荐问题点击：直接发送消息
const handleSendSuggestion = (message: string) => {
  if (aiGeneralChatViewRef.value?.sendMessage) {
    // 设置输入内容并发送
    ;(aiGeneralChatViewRef.value as any).inputMessage = message
    ;(aiGeneralChatViewRef.value as any).sendMessage()
  }
}

const handleCloseChatPanel = () => {
  // 关闭聊天面板，切换回题目模式
  if (mode.value === 'right' && splitPanelRef.value) {
    splitPanelRef.value.toggle()
  }
}

const handleOpenTeacherDialog = () => {
}

const handleSwitchToTeacher = () => {
}

// 发送给AI
const sendToAi = async (question: any) => {
  try {
    
    // 发出事件通知父组件切换到AI聊天界面
    handleStartAiGuidance()
    const aiExerciseStore = useAiExerciseChatStore()

    // 根据题目 subject 计算要传给 AI 的学科
    const s = (question.subject || '').toLowerCase()
    const aiSubject = s === 'biology' ? 'BIOLOGY' : 'MATH'

    const currentStore = isFromHomework.value ? homeworkStore : questionStore

    const storeIndex = currentStore.questions.findIndex(
      (q: any) => q.bmNo === question.bmNo
    )
    if (storeIndex < 0) {
      showMessage('题目数据不同步，请重新加载', 'warning')
      return
    }

    await currentStore.selectQuestion(storeIndex)

    const current = currentStore.currentQuestion
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
      aiSubject as any,
      'mate',
      undefined,
      true,
    )
  } catch (error) {
    console.error('[ExerciseSolveViewNewJK] 启动AI指导失败:', error)
    showMessage('启动AI指导失败', 'error')
  }
}

// 问AI按钮点击处理 - 针对不同题型构造精细化的内容
const handleAskAiClick = async () => {
  try {
    // 1. 显示 AI 面板
    if (mode.value === 'left' && splitPanelRef.value) {
      splitPanelRef.value.toggle()
    }

    // 2. 构造精细化的题目内容
    nextTick(async () => {
      const chatView = aiGeneralChatViewRef.value as any
      if (!chatView) return

      const q = currentQuestion.value
      if (!q) return

      let questionContext = ''
      const title = q.title || ''
      const stem = q.structuredContent?.stem || ''

      // 根据题型构造不同的上下文
      switch (q.type) {
        case 'choice': {
          const options = q.structuredContent?.options || q.options || []
          const optionsText = options
            .map((opt: any) => {
              const label = opt.label || ''
              const content = opt.text || opt.content || ''
              return `${label}. ${content}`
            })
            .filter((t: string) => t !== '. ')
            .join('\n')
          questionContext = `【选择题】\n题干：${title}\n${stem}\n\n选项：\n${optionsText}`
          break
        }
        case 'judgment': {
          questionContext = `【判断题】\n题干：${stem}\n\n请判断上述说法是否正确。`
          break
        }
        case 'fill': {
          const blanks = q.structuredContent?.blanks || []
          const blanksCount = blanks.length
          questionContext = `【填空题】\n题干：${title}\n${stem}\n\n注：本题共有 ${blanksCount} 个空格。`
          break
        }
        default: {
          questionContext = `【题目】\n${title}\n${stem}`
          break
        }
      }

      const fullText = `能帮我讲讲这道题吗？\n\n${questionContext.trim()}`

      // 3. 调用 sendMessage 发送内容
      if (chatView.sendMessage) {
        await chatView.sendMessage(undefined, fullText)
      } else {
        showMessage('聊天功能暂不可用', 'warning')
      }
    })
  } catch (error) {
    console.error('启动AI指导失败:', error)
    showMessage('启动失败，请重试', 'warning')
  }
}

const handleAddSessionCard = async () => {
  if (aiGeneralChatViewRef.value?.addSessionCard) {
    await (aiGeneralChatViewRef.value as any).addSessionCard()
  }
}

// 页面加载后自动选择第一题
onMounted(async () => {
  // 检查是否需要切换到 AI 模式（从 HtmlPreviewView 返回时）
  if (isExerciseChatPanelVisible.value && mode.value !== 'right') {
    mode.value = 'right'
    await nextTick()
    splitPanelRef.value?.toggle?.()
  }

  // 如果不是从作业场景进入，强制使用 CLASSROOM_EXERCISE 数据
  // if (!isFromHomework.value) {
  //   console.log('[ExerciseSolveViewNewJK] 习题模式：加载 CLASSROOM_EXERCISE 题目')
  //   questionStore.setQuestions(CLASSROOM_EXERCISE.questions)
  // }

  // 延迟确保 QuestionList 组件已渲染并有数据
  await nextTick()
  if (questionListRef.value && typeof (questionListRef.value as any).scrollToQuestionAndSelect === 'function') {
    const currentStore = isFromHomework.value ? homeworkStore : questionStore
    let targetIndex = currentStore.currentQuestionIndex
    if (targetIndex < 0 || targetIndex >= currentStore.questions.length) {
      targetIndex = 0
    }
    
    if (currentStore.questions.length > 0) {
      (questionListRef.value as any).scrollToQuestionAndSelect(targetIndex)
      // 手动触发题目选择后的加载逻辑
      await handleQuestionSelected()
    }
  }
})
</script>

<style scoped>
/* 顶部导航栏样式 */
.exercise-solve-header {
  height: 56px;
  flex-shrink: 0;
  background: #0f002e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  box-sizing: border-box;
  z-index: 100;
  color: #ffffff;
}

.header-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.header-center {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
}

.header-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-right: 8px;
}

/* 左侧 Header 返回按钮 */
.left-header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 40px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 50%;
}

.left-header-back:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.left-header-back .back-icon {
  width: 24px;
  height: 24px;
  display: block;
}

/* 主容器 */
.exercise-solve-container {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  overflow: hidden;
}

/* 主体区域 */
.exercise-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.center-header-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
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

.exercise-chat-card {
  height: 100%;
  background: transparent;
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

.question-render-area {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
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

/* 答案解析样式 */
.answer-analysis-wrapper {
  margin-top: 30px;
}

.answer-analysis-wrapper .divider {
  height: 1px;
  background: #e2e8f0;
  margin-bottom: 24px;
}

.analysis-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.analysis-card .card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.analysis-card .card-title span {
  font-weight: 600;
  font-size: 15px;
  color: #334155;
}

.analysis-card .card-content {
  font-size: 15px;
  line-height: 1.6;
  color: #475569;
  white-space: pre-wrap;
}

.action-footer {
  padding: 24px 30px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: center;
  gap: 20px;
  background: white;
}

.submitted-tip-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  animation: fadeIn 0.3s ease-out;
}

.submitted-content {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #ffffff;
  border-radius: 99px;
  border: 1.5px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.submitted-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 8px;
  padding-right: 16px;
}

.success-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #10b981;
}

.submitted-text {
  color: #475569;
  font-weight: 600;
  font-size: 17px;
  white-space: nowrap;
}

.divider {
  width: 1px;
  height: 24px;
  background: #e2e8f0;
  margin-right: 12px;
}

.ai-action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: #6e55ff;
  color: white;
  border: none;
  border-radius: 99px;
  cursor: pointer;
  font-weight: 600;
  font-size: 16px;
  outline: none;
}

.ai-action-btn:hover {
  background: #5b44d9;
}

.ai-action-btn:active:not(:disabled) {
  background: #4a38b3;
}

.submit-action-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  animation: fadeIn 0.3s ease-out;
}

.ai-action-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.ai-action-btn.submit-btn {
  padding: 12px 40px;
  font-size: 18px;
}

.btn-icon {
}

.ai-action-btn:hover .btn-icon {
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 左侧题目面板圆角 */
.problem-card {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

/* 统一字体大小为聊天消息大小（19px） */
.exercise-solve-container :deep(*) {
  font-size: 19px;
}

/* 排除 header 和特定提示文案，保持原大小 */
.exercise-solve-container :deep(.panel-card-header *),
.exercise-solve-container :deep(.chat-tabs *),
.exercise-solve-container :deep(.chat-footer-text) {
  font-size: initial !important;
}

/* 特殊处理：图标和一些需要更小字体的元素 */
.exercise-solve-container :deep(.q-icon),
.exercise-solve-container :deep(.q-btn__content i),
.exercise-solve-container :deep(.back-icon) {
  font-size: inherit;
}

.exercise-solve-container :deep(.q-btn) {
  font-size: 19px;
}

/* 调大题目列表字体大小 */
.problem-card :deep(.question-number) {
  font-size: 19px !important;
}

.problem-card :deep(.question-content) {
  font-size: 19px !important;
  line-height: 1.6 !important;
}

.problem-card :deep(.native-empty-state .text-h6) {
  font-size: 22px !important;
}

.problem-card :deep(.pagination-info) {
  font-size: 17px !important;
}

/* 题目渲染区域字体同步 */
.question-render-area :deep(*) {
  font-size: 19px !important;
}

.question-render-area :deep(h1),
.question-render-area :deep(h2),
.question-render-area :deep(h3) {
  font-size: 24px !important;
}

.question-render-area :deep(h4),
.question-render-area :deep(h5),
.question-render-area :deep(h6) {
  font-size: 20px !important;
}

.textbookip-float {
  position: absolute;
  z-index: 2000;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.5s ease-in-out; /* 与 SplitPanel 步调一致 */
}

.textbookip-float:active {
  transform: scale(0.9);
}

.textbookip-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.float-right {
  right: 20px;
  bottom: 100px;
}

.float-left {
  left: 20px;
  bottom: 100px;
}
</style>
