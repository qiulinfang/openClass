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
      <div class="interactive-container" v-if="currentAnswerQuestion">
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
          <BaseQuestion
            v-else
            :question="currentAnswerQuestion"
            show-title
          />
        </div>

        <div class="drawing-board-wrapper">
          <DrawingBoardNew
            ref="drawingBoardRef"
            :initial-zoom="70"
            @clear="handleClearRequest"
          >
            <template #toolbar-right>
              <CommonActionButton
                label="下一步"
                variant="outline"
                size="sm"
                class="ml-2"
                @click="emit('next')"
              />
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
      <div class="empty-right-panel" v-else>
        <div class="empty-tip">请在左侧选择题目开始作答</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import QuestionList from '@/components/QuestionList.vue'
import StatusTag from '@/components/base/StatusTag.vue'
import DrawingBoardNew from '@/components/drawingBoardNew.vue'
import CommonActionButton from '@/components/base/Button.vue'
import ChoiceQuestion from '@/components/exercise/ChoiceQuestion.vue'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion.vue'
import BaseQuestion from '@/components/exercise/BaseQuestion.vue'
import { useHomeworkStore } from '@/stores/homeworkStore'

const props = defineProps<{
  externalQuestions: any[]
}>()

const emit = defineEmits<{
  (e: 'next'): void
}>()

const homeworkStore = useHomeworkStore()
const { answerDataCache } = storeToRefs(homeworkStore)

const questionSearchQuery = ref('')
const currentAnswerQuestion = ref<any>(null)
const drawingBoardRef = ref<any>(null)

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

const getQuestionStatus = (q: any) => {
  const key = getQuestionKey(q)
  const cache = (answerDataCache.value as any)[key]
  if (!cache) return 'unanswered'
  return cache.boardData?.objects?.length > 0 || cache.chooseList?.length > 0
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

const handleClearRequest = () => {
  // 画布清理逻辑
  if (drawingBoardRef.value) {
    drawingBoardRef.value.clear()
  }
}

const handleBoardUpload = () => {
  // 上传逻辑
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
}

.question-render-area {
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.drawing-board-wrapper {
  flex: 1;
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
</style>
