<template>
  <div class="homework-answer-view" :class="{ 'is-component': isComponent }">
    <header class="answer-header" v-if="!isComponent">
      <div class="header-left">
        <div class="back-btn" @click="goBack">
          <img :src="goBackIcon" alt="返回" class="back-icon" />
        </div>
      </div>
      
      <div class="header-center">
        <div class="stage-toggle">
          <button 
            v-for="(label, key) in stageNameMap" 
            :key="key"
            class="toggle-btn"
            :class="{ active: currentStage === key }"
            @click="switchStage(String(key))"
          >
            {{ label }}
          </button>
        </div>
      </div>

      <div class="header-right">
        <div class="answer-title">{{ displayTitle }}</div>
      </div>
    </header>
    
    <div class="answer-body">
      <!-- 课堂练习/课后作业阶段：原有 QuestionList + 画布 -->
      <HomeworkPracticeKids
        :external-questions="filteredQuestions"
        :stage="currentStage"
      />
    </div>

    <!-- 分层结果对话框 -->
    <Dialog
      v-model="showLayerDialog"
      title="预习结果"
      :confirmButtonText="'下一步'"
      :showCancelButton="false"
      @confirm="showLayerDialog = false"
    >
      <div class="layer-result-content">
        <div class="score-info">你已提交课前掌握情况</div>
        <div class="layer-info">
          根据你的掌握情况，你被分配到：
          <div class="layer-name" :class="'layer-' + studentLayer">
            {{ layerMap[studentLayer] }}
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getUserId } from '@/services'
import Dialog from '@/components/base/Dialog.vue'
import HomeworkPracticeKids from './HomeworkPracticeJK.vue'
import goBackIcon from '/icons/goback.svg'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { CLASSROOM_EXERCISE, POST_SCHOOL_HOMEWORK } from '../../mocks/negativeNumbers'
import { showMessage } from '@/utils'

const props = defineProps<{
  isComponent?: boolean
}>()

const route = useRoute()
const router = useRouter()
const homeworkStore = useHomeworkStore()

const { homeworkName, answerDataCache, questions: allStageQuestions } = storeToRefs(homeworkStore)

// --- 状态定义 ---
const currentStage = ref((route.query.stage as string) || 'classroom')
const studentLayer = ref('3') // 默认基础层 (3)
const previewScore = ref(0)
const showLayerDialog = ref(false)

const layerMap: Record<string, string> = {
  '1': '冲刺层',
  '2': '提升层',
  '3': '基础层'
}

// 根据层次过滤后的题目列表
const filteredQuestions = computed(() => {
  return allStageQuestions.value || []
})


// --- 计算属性 ---
const displayTitle = computed(() => homeworkName.value || '作业作答')

const stageNameMap: Record<string, string> = {
  classroom: '课堂练习',
  postSchool: '课后作业'
}

// --- 方法 ---
const getStageIndex = (stage: string) => Object.keys(stageNameMap).indexOf(stage) + 1
const isStageCompleted = (stage: string) => Object.keys(stageNameMap).indexOf(stage) < Object.keys(stageNameMap).indexOf(currentStage.value)

const switchStage = (stage: string) => {
  currentStage.value = stage
  const data = getStageData(stage)
  homeworkStore.questions = data.questions
  homeworkStore.homeworkName = data.homeworkName
}

const getStageData = (stage: string) => {
  switch (stage) {
    case 'classroom': return CLASSROOM_EXERCISE
    case 'postSchool': return POST_SCHOOL_HOMEWORK
    default: return CLASSROOM_EXERCISE
  }
}

// 暴露给父组件的方法
defineExpose({
  switchStage,
  stageNameMap
})

const goBack = () => router.back()

onMounted(() => {
  const data = getStageData(currentStage.value)
  homeworkStore.questions = data.questions
  homeworkStore.homeworkName = data.homeworkName
})
</script>

<style scoped lang="scss">
.homework-answer-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;

  &.is-component {
    height: 100%;
    background: transparent;
  }
}

.answer-header {
  height: 64px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e2e8f0;
}

.header-left {
  display: flex;
  align-items: center;
  width: 200px;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.header-right {
  width: 200px;
  display: flex;
  justify-content: flex-end;
}

.stage-toggle {
  display: flex;
  gap: 32px;
}

.toggle-btn {
  padding: 8px 4px;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &.active {
    color: white;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 3px;
      background: #8b80ff;
      border-radius: 2px;
    }
  }

  &:hover:not(.active) {
    color: rgba(255, 255, 255, 0.8);
  }
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #f1f5f9;
  }
}

.back-icon { width: 24px; height: 24px; }
.answer-title { font-size: 18px; font-weight: 600; color: white; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.answer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 20px;
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

.right-panel { flex: 1; background: white; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }

.interactive-container { flex: 1; display: flex; flex-direction: column; }
.question-render-area { padding: 20px; border-bottom: 1px solid #e2e8f0; }
.drawing-board-wrapper { flex: 1; }

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
  color: #f8fafc;
  font-size: 16px;
  font-weight: 500;
}

.layer-result-content {
  text-align: center;
  padding: 20px;
}

.score-info {
  font-size: 18px;
  color: #1e293b;
  margin-bottom: 20px;

  span {
    font-size: 24px;
    font-weight: 800;
    color: #6e55ff;
    margin: 0 4px;
  }
}

.layer-info {
  font-size: 16px;
  color: #64748b;
}

.layer-name {
  font-size: 32px;
  font-weight: 800;
  margin-top: 16px;
  &.layer-1 { color: #ef4444; }
  &.layer-2 { color: #f59e0b; }
  &.layer-3 { color: #3b82f6; }
}
</style>
