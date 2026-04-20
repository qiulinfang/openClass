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
    
    <div class="stage-stepper">
      <div 
        v-for="(label, key) in stageNameMap" 
        :key="key"
        class="stepper-item"
        :class="{ active: currentStage === key, completed: isStageCompleted(key) }"
        @click="switchStage(String(key))"
      >
        <div class="stepper-node">{{ getStageIndex(String(key)) }}</div>
        <div class="stepper-label">{{ label }}</div>
      </div>
    </div>

    <div class="answer-body">
      <!-- 课前预习阶段：大卡片平铺流 -->
      <HomeworkPreviewKids
        v-if="currentStage === 'preview'"
        :external-questions="filteredQuestions"
        @submit="handlePreviewSubmit"
      />

      <!-- 核心探究阶段：分屏 AI 答疑 -->
      <ExerciseSolveViewJK
        v-else-if="currentStage === 'exploration'"
        :external-questions="filteredQuestions"
      />

      <!-- 课堂练习/课后作业阶段：原有 QuestionList + 画布 -->
      <HomeworkPracticeKids
        v-else
        :external-questions="filteredQuestions"
        @next="handleNextStage"
      />
    </div>

    <!-- 分层结果对话框 -->
    <Dialog
      v-model="showLayerDialog"
      title="预习结果"
      :confirmButtonText="'下一步'"
      :showCancelButton="false"
      @confirm="handleLayerConfirm"
    >
      <div class="layer-result-content">
        <div class="score-info">你已提交课前掌握情况，已掌握 <span>{{ previewScore }}</span> / {{ PREVIEW_HOMEWORK.questions.length }} 题</div>
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
import Dialog from '@/components/base/Dialog.vue'
import HomeworkPreviewKids from './components/HomeworkPreviewJK.vue'
import ExerciseSolveViewJK from './components/ExerciseSolveViewJK.vue'
import HomeworkPracticeKids from './components/HomeworkPracticeJK.vue'
import goBackIcon from '/icons/goback.svg'
import { useHomeworkStore } from '@/stores/homeworkStore'
import { PREVIEW_HOMEWORK, CORE_EXPLORATION, CLASSROOM_EXERCISE, POST_SCHOOL_HOMEWORK } from '../mocks/negativeNumbers'
import { showMessage } from '@/utils'

const route = useRoute()
const router = useRouter()
const homeworkStore = useHomeworkStore()

// --- 状态定义 ---
const currentStage = ref((route.query.stage as string) || 'preview')
const studentLayer = ref('3') // 默认基础层 (3)

const handlePreviewSubmit = (checklist: string[], goToPractice?: boolean) => {
  if (checklist.length === 0) {
    showMessage('请至少勾选一道你已掌握的题目', 'warning')
    return
  }
  
  // 根据勾选数量进行分层
  const count = checklist.length
  const total = PREVIEW_HOMEWORK.questions.length
  previewScore.value = count // 保存分数以便弹窗显示
  
  if (count >= total * 0.8) {
    studentLayer.value = '1' // 冲刺层
  } else if (count >= total * 0.5) {
    studentLayer.value = '2' // 提升层
  } else {
    studentLayer.value = '3' // 基础层
  }

  if (goToPractice) {
    // 如果点击的是"开始课堂练习"，直接切换环节
    switchStage('classroom')
    return
  }

  // 跳转到预习统计页面
  router.push({
    name: 'homeworkPreviewAnalysis',
    params: { homeworkId: route.params.homeworkId as string }
  })
}

// --- 适配小学生的逻辑 ---

const previewScore = ref(0)
const showLayerDialog = ref(false)

const { homeworkName, answerDataCache, questions: allStageQuestions } = storeToRefs(homeworkStore)

// 根据层次过滤后的题目列表
const filteredQuestions = computed(() => {
  const questions = allStageQuestions.value || []
  
  // 仅对课堂练习 (classroom) 和 课后作业 (postSchool) 进行分层过滤
  if (currentStage.value !== 'classroom' && currentStage.value !== 'postSchool') {
    return questions
  }

  // 这里的过滤逻辑取决于题目数据中如何标记层次
  // 假设题目 title 中包含 【基础题】、【提升题】、【拓展题】 等字样
  // 或者 ID/bmNo 中有特定前缀
  return questions.filter(q => {
    const title = q.title || ''
    if (studentLayer.value === '1') {
      // 冲刺层：看到拓展题/提升题
      return title.includes('拓展') || title.includes('提升') || title.includes('基础')
    } else if (studentLayer.value === '2') {
      // 提升层：看到提升题/基础题
      return title.includes('提升') || title.includes('基础')
    } else {
      // 基础层：仅看到基础题
      return title.includes('基础')
    }
  })
})

const stageNameMap: Record<string, string> = {
  preview: '课前预习',
  exploration: '核心探究',
  classroom: '课堂练习',
  postSchool: '课后作业'
}

const layerMap: Record<string, string> = {
  '1': '冲刺层',
  '2': '提升层',
  '3': '基础层'
}

// --- 计算属性 ---
const displayTitle = computed(() => homeworkName.value || '作业作答')

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
    case 'preview': return PREVIEW_HOMEWORK
    case 'exploration': return { homeworkName: '核心探究', questions: CORE_EXPLORATION }
    case 'classroom': return CLASSROOM_EXERCISE
    case 'postSchool': return POST_SCHOOL_HOMEWORK
    default: return PREVIEW_HOMEWORK
  }
}

const handleNextStage = () => {
  proceedToNextStage()
}

const handleLayerConfirm = () => {
  showLayerDialog.value = false
  proceedToNextStage()
}

const proceedToNextStage = () => {
  const stages = Object.keys(stageNameMap)
  const idx = stages.indexOf(currentStage.value)
  if (idx < stages.length - 1) switchStage(stages[idx + 1])
  else    showMessage('已完成所有环节', 'info')
}

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
}

.answer-header {
  height: 64px;
  background: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #e2e8f0;
}

.toolbar-left {
  display: flex;
  align-items: center;
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
.answer-title { flex: 1; text-align: center; font-size: 18px; font-weight: 600; margin-right: 40px; }

.stage-stepper {
  display: flex;
  justify-content: center;
  padding: 20px;
  gap: 40px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.stepper-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  opacity: 0.5;
  &.active { opacity: 1; .stepper-node { background: #6e55ff; color: white; } }
  &.completed { opacity: 0.8; .stepper-node { background: #10b981; color: white; } }
}

.stepper-node {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

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
  color: #94a3b8;
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
