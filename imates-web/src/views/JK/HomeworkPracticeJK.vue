<template>
  <div class="practice-body">
    <div class="left-panel">
      <QuestionList
        ref="questionListRef"
        type="homework"
        :search-query="questionSearchQuery"
        @update:searchQuery="(v) => (questionSearchQuery = v)"
        :external-questions="props.externalQuestions"
        :show-photo-search="false"
        :show-send-to-ai="false"
        :show-question-actions="false"
        @questionSelected="handleStartAnswer"
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
      <div class="interactive-container" v-if="showResults">
        <PracticeResultStatistics :results="practiceResults" />
        <div class="action-footer">
          <CommonActionButton
            label="重新练习"
            variant="outline"
            size="lg"
            @click="showResults = false"
          />
        </div>
      </div>
      <div class="interactive-container" v-else-if="currentAnswerQuestion">
        <div class="question-render-area">
          <ChoiceQuestion
            v-if="currentAnswerQuestion.type === 'choice'"
            :question="currentAnswerQuestion"
            v-model="currentQuestionChooseList"
            show-title
          />
          <JudgmentQuestion
            v-else-if="currentAnswerQuestion.type === 'judgment'"
            :question="currentAnswerQuestion"
            v-model="currentQuestionJudgment"
            show-title
          />
          <FillBlankQuestion
            v-else-if="currentAnswerQuestion.type === 'fill'"
            :question="currentAnswerQuestion"
            v-model="currentQuestionFillList"
            show-title
          />
          <BaseQuestion
            v-else
            :question="currentAnswerQuestion"
            show-title
          />
        </div>

        <div class="action-footer" v-if="props.stage === 'classroom'">
          <CommonActionButton
            label="上传作答"
            variant="primary"
            size="lg"
            :disabled="!currentAnswerQuestion"
            @click="handleBoardUpload"
          />
        </div>
      </div>
      <div class="empty-right-panel" v-else>
        <div class="empty-tip">请在左侧选择题目开始作答</div>
      </div>
    </div>

    <!-- 未完成提示对话框 -->
    <Dialog
      v-model="showUnfinishedDialog"
      title="提交提示"
      :show-cancel-button="false"
      confirm-button-text="去完成"
      class="high-level-dialog"
      @confirm="showUnfinishedDialog = false"
    >
      <div class="unfinished-dialog-content">
        <p>{{ unfinishedMessage }}</p>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from '@/utils'
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import QuestionList from '@/components/QuestionList.vue'
import StatusTag from '@/components/base/StatusTag.vue'
import CommonActionButton from '@/components/base/Button.vue'
import Dialog from '@/components/base/Dialog.vue'
import ChoiceQuestion from '@/components/exercise/ChoiceQuestion.vue'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion.vue'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion.vue'
import BaseQuestion from '@/components/exercise/BaseQuestion.vue'
import PracticeResultStatistics from './PracticeResultStatistics.vue'
import { useHomeworkStore } from '@/stores/homeworkStore'

const props = defineProps<{
  externalQuestions: any[]
  stage?: string
}>()

const emit = defineEmits<{
  (e: 'next'): void
}>()

const homeworkStore = useHomeworkStore()
const { answerDataCache } = storeToRefs(homeworkStore)

const questionSearchQuery = ref('')
const currentAnswerQuestion = ref<any>(null)
const showResults = ref(false)
const practiceResults = ref<any[]>([])

// 未完成提示相关
const showUnfinishedDialog = ref(false)
const unfinishedMessage = ref('')

const getQuestionKey = (q: any) => (q ? (q.bmNo || q.id).toString() : '')

const currentQuestionChooseList = computed({
  get: () => {
    const key = getQuestionKey(currentAnswerQuestion.value)
    return (answerDataCache.value as any)[key]?.chooseList || []
  },
  set: (val) => {
    const key = getQuestionKey(currentAnswerQuestion.value)
    if (!key) return
    const cache = (answerDataCache.value as any)[key] || {}
    cache.chooseList = val
    ;(answerDataCache.value as any)[key] = cache
  },
})

const currentQuestionJudgment = computed({
  get: () => {
    const key = getQuestionKey(currentAnswerQuestion.value)
    return (answerDataCache.value as any)[key]?.judgmentValue || ''
  },
  set: (val) => {
    const key = getQuestionKey(currentAnswerQuestion.value)
    if (!key) return
    const cache = (answerDataCache.value as any)[key] || {}
    cache.judgmentValue = val
    ;(answerDataCache.value as any)[key] = cache
  },
})

const currentQuestionFillList = computed({
  get: () => {
    const key = getQuestionKey(currentAnswerQuestion.value)
    return (answerDataCache.value as any)[key]?.fillList || []
  },
  set: (val) => {
    const key = getQuestionKey(currentAnswerQuestion.value)
    if (!key) return
    const cache = (answerDataCache.value as any)[key] || {}
    cache.fillList = val
    ;(answerDataCache.value as any)[key] = cache
  },
})

const getQuestionStatus = (q: any) => {
  const key = getQuestionKey(q)
  const cache = (answerDataCache.value as any)[key]
  if (!cache) return 'unanswered'
  
  const hasBoardData = cache.boardData?.objects?.length > 0
  const hasChoiceData = cache.chooseList?.length > 0
  const hasFillData = cache.fillList?.some((v: string) => v && v.trim() !== '')
  const hasJudgmentData = cache.judgmentValue !== undefined && cache.judgmentValue !== null && cache.judgmentValue !== ''

  return hasBoardData || hasChoiceData || hasFillData || hasJudgmentData
    ? 'answered'
    : 'unanswered'
}

const getQuestionStatusText = (q: any) =>
  getQuestionStatus(q) === 'answered' ? '已作答' : '未作答'
const getQuestionStatusType = (q: any) =>
  getQuestionStatus(q) === 'answered' ? 'green' : 'yellow'

const handleStartAnswer = (q: any) => {
  currentAnswerQuestion.value = q
}

const handleBoardUpload = () => {
  // 1. 校验是否所有题目都已作答
  const unAnsweredQuestions = props.externalQuestions.filter(q => getQuestionStatus(q) === 'unanswered')
  if (unAnsweredQuestions.length > 0) {
    const firstUnansweredIndex = props.externalQuestions.indexOf(unAnsweredQuestions[0]) + 1
    unfinishedMessage.value = `你还有题目未完成（第 ${firstUnansweredIndex} 题），请全部完成后再提交。`
    showUnfinishedDialog.value = true
    
    // 自动跳转到第一道未作答的题目
    handleStartAnswer(unAnsweredQuestions[0])
    return
  }

  // 2. 获取所有题目的作答数据并与标准答案对比
  const results = props.externalQuestions.map(q => {
    const key = getQuestionKey(q)
    const cache = (answerDataCache.value as any)[key] || {}
    let userAnswer: any = null
    let isCorrect = false

    if (q.type === 'choice') {
      userAnswer = cache.chooseList || []
      isCorrect = userAnswer.length === 1 && userAnswer[0] === q.answer
    } else if (q.type === 'judgment') {
      userAnswer = cache.judgmentValue
      const correctVal = q.structuredContent?.judgmentResult
      const mappedUserAnswer = userAnswer === '对' ? 'true' : (userAnswer === '错' ? 'false' : String(userAnswer))
      console.log(`[Judgment Check] Key: ${key}, User: ${userAnswer} -> ${mappedUserAnswer}, Correct: ${correctVal}`)
      isCorrect = mappedUserAnswer === String(correctVal)
    } else if (q.type === 'fill') {
      userAnswer = cache.fillList || []
      const correctAnswers = Array.isArray(q.structuredContent?.blanks) 
        ? q.structuredContent.blanks.map((b: any) => b.answer)
        : []
      isCorrect = userAnswer.length === correctAnswers.length && 
                  userAnswer.every((v: string, i: number) => v && v.trim() === correctAnswers[i])
    }

    return {
      id: q.id,
      title: q.title,
      type: q.type,
      userAnswer,
      correctAnswer: q.type === 'fill' ? (Array.isArray(q.structuredContent?.blanks) ? q.structuredContent.blanks.map((b: any) => b.answer) : q.answer) : q.answer,
      isCorrect
    }
  })

  practiceResults.value = results
  showResults.value = true
}

// 初始化选中第一题
onMounted(() => {
  if (props.externalQuestions.length > 0) {
    handleStartAnswer(props.externalQuestions[0])
  }
})

// 监听题目列表变化，自动选中第一题
watch(() => props.externalQuestions, (newVal) => {
  if (newVal.length > 0 && !currentAnswerQuestion.value) {
    handleStartAnswer(newVal[0])
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
.practice-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  gap: 20px;
}

.left-panel {
  width: 400px;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.right-panel {
  flex: 1;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.interactive-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; // 确保子元素溢出时能够正确触发滚动
}

.question-render-area {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

.action-footer {
  padding: 24px 30px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: center;
  gap: 20px;
  background: white;
}

.ml-2 {
  margin-left: 8px;
}

.empty-right-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
}

.empty-tip {
  color: #94a3b8;
  font-size: 16px;
  font-weight: 500;
}
.unfinished-dialog-content {
  padding: 20px 0;
  text-align: center;
  p {
    font-size: 16px;
    color: #475569;
    line-height: 1.6;
    margin: 0;
  }
}

// 确保弹窗层级高于全屏遮罩
:deep(.high-level-dialog) {
  z-index: 3000 !important;
  
  .q-dialog__inner {
    z-index: 3001 !important;
  }
}
</style>
