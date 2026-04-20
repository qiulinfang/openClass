<template>
  <div class="exercise-solve-jk">
    <!-- 主要内容区域 -->
    <div class="main-content">
      <q-splitter v-model="splitterModel" :limits="[20, 50]" class="splitter-container">
        <!-- 左侧题目列表 -->
        <template v-slot:before>
          <div class="question-panel">
            <q-card flat bordered class="full-height">
              <q-card-section class="q-pa-none full-height">
                <QuestionListJK
                  ref="questionListRef"
                  type="homework"
                  :show-photo-search="false"
                  :show-send-to-ai="false"
                  :show-question-actions="true"
                  :search-query="searchQuery"
                  :external-questions="externalQuestions"
                  @question-selected="handleQuestionSelected"
                  @open-mini-class="handleOpenMiniClass"
                  @update:search-query="searchQuery = $event"
                />
              </q-card-section>
            </q-card>
          </div>
        </template>

        <!-- 分隔条标记 -->
        <template v-slot:separator>
          <div class="splitter-handle">
            <div class="splitter-dots">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </template>

        <!-- 右侧功能区域 -->
        <template v-slot:after>
          <div class="function-panel">
            <q-card flat class="full-height">
              <q-card-section class="function-content q-pa-none">
                <!-- AI聊天界面 -->
                <ChatViewJK
                  ref="aiChatViewRef"
                  v-if="currentQuestion"
                  type="ai-textbook"
                  :compressed-height="327"
                  :question="currentQuestion"
                  :hide-ask-teacher-icon="true"
                  @scroll-to-bottom="scrollToBottom"
                />
                <div v-else class="empty-chat-state">
                  <div class="empty-tip">请在左侧选择题目开始探究</div>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </template>
      </q-splitter>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import QuestionListJK from '@/components/QuestionListJK.vue'
import ChatViewJK from '@/components/ChatViewJK.vue'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { useAiExerciseChatStore } from '@/stores/aiExerciseChatStore'
import { useUIStore } from '@/stores/uiStore'
import { showMessage } from '@/utils'

const props = defineProps<{
  externalQuestions: any[]
}>()

const homeworkStore = useHomeworkStore()
const aiExerciseStore = useAiExerciseChatStore()
const uiStore = useUIStore()

const { currentQuestion, answerDataCache } = storeToRefs(homeworkStore)

const splitterModel = ref(30)
const searchQuery = ref('')
const questionListRef = ref<any>(null)
const aiChatViewRef = ref<any>(null)

// --- 题目状态逻辑 ---
const getQuestionKey = (q: any) => q ? (q.bmNo || q.id).toString() : ''
const getQuestionStatus = (q: any) => {
  const key = getQuestionKey(q)
  const cache = (answerDataCache.value as any)[key]
  if (!cache) return 'unanswered'
  return (cache.boardData?.objects?.length > 0 || cache.chooseList?.length > 0) ? 'answered' : 'unanswered'
}
const getQuestionStatusText = (q: any) => getQuestionStatus(q) === 'answered' ? '已探究' : '未探究'
const getQuestionStatusType = (q: any) => getQuestionStatus(q) === 'answered' ? 'green' : 'yellow'

const handleQuestionSelected = async (question: any) => {
  if (question) {
    const index = props.externalQuestions.findIndex(q => (q.bmNo || q.id) === (question.bmNo || question.id))
    if (index > -1) {
      await homeworkStore.selectQuestion(index)
    }
    
    const questionId = question.bmNo || question.id
    await aiExerciseStore.loadChatHistory(questionId)
    
    if (aiExerciseStore.sessions.length === 0) {
      await aiExerciseStore.createNewSession(questionId)
    }
  }
}

const handleOpenMiniClass = (question: any) => {
  try {
    const bmNo = (question.bmNo || '').trim()
    if (!bmNo) {
      showMessage('题目编号缺失，无法打开微课', 'warning')
      return
    }
    const subjectPrefix = question.subject || 'math'
    const classUrl = `https://www.imates.com.cn:9099/wk/${subjectPrefix}/${bmNo}/${bmNo}.html`
    const questionTitle = question.title || question.question?.substring(0, 50) || ''
    uiStore.openMiniClassDialog(classUrl, questionTitle)
  } catch (error) {
    console.error(`[ExerciseSolveViewJK] 打开微课失败:`, error)
    showMessage('打开微课失败', 'error')
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    // 自动滚动到聊天底部逻辑
  })
}

// 监听题目变化以自动加载历史
watch(() => currentQuestion.value, (newVal) => {
  if (newVal) {
    const questionId = newVal.bmNo || newVal.id
    aiExerciseStore.loadChatHistory(questionId).then(() => {
      if (aiExerciseStore.sessions.length === 0) {
        aiExerciseStore.createNewSession(questionId)
      }
    })
  }
}, { immediate: true })

</script>

<style scoped lang="scss">
.exercise-solve-jk {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.splitter-container {
  height: 100%;
  width: 100%;
}

.question-panel, .function-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.full-height {
  height: 100%;
}

.function-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.empty-chat-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  .empty-tip {
    color: #94a3b8;
    font-size: 16px;
    font-weight: 500;
  }
}

.splitter-handle {
  width: 12px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  cursor: col-resize;
  border-left: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;

  .splitter-dots {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .dot {
      width: 4px;
      height: 4px;
      background: #cbd5e1;
      border-radius: 50%;
    }
  }
}

:deep(.q-splitter__separator) {
  width: 1px;
  background: #e2e8f0;
  z-index: 10;
}
</style>
