<template>
  <div class="homework-header-test q-pa-md">
    <div class="header-section q-mb-lg">
      <div class="row items-center justify-between">
        <div>
          <h1 class="text-h5 text-weight-bold q-ma-none">HomeworkHeader 极限与长度测试</h1>
          <p class="text-caption text-grey-7 q-ma-none">测试不同标题长度、不同题目数量下的布局与交互表现</p>
        </div>
        <q-btn color="primary" flat icon="arrow_back" label="返回导航" to="/test-nav" />
      </div>
    </div>

    <!-- 场景 1: 标准内容长度 (少题目、中等标题) -->
    <q-card class="q-mb-xl shadow-2">
      <q-card-section class="bg-primary text-white">
        <div class="text-subtitle1 text-weight-bold">场景 1: 标准内容长度 (5个题目，标准标题)</div>
        <div class="text-caption opacity-80">最常见的日常作业头部样式</div>
      </q-card-section>
      <q-card-section class="q-pa-none">
        <div class="header-container-mock">
          <HomeworkHeader
            :questions="shortQuestions"
            :currentIndex="shortCurrentIndex"
            :showDraft="shortShowDraft"
            @back="onBack('short')"
            @select-question="(q, idx) => shortCurrentIndex = idx"
            @toggle-draft="shortShowDraft = !shortShowDraft"
          >
            <template #left-action>
              <div class="back-btn" @click="onBack('short')">
                <img :src="goBackIcon" alt="返回" class="back-icon" />
              </div>
              <span class="homework-name">七年级数学上册第一次月考试卷</span>
            </template>
          </HomeworkHeader>
        </div>
      </q-card-section>
      <q-card-section class="bg-grey-1 text-grey-8">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <strong>当前状态:</strong>
            <ul class="q-pl-md q-my-xs">
              <li>当前选中题号: {{ shortCurrentIndex + 1 }}</li>
              <li>草稿纸状态: {{ shortShowDraft ? '已开启' : '已关闭' }}</li>
            </ul>
          </div>
          <div class="col-12 col-md-6 text-right">
            <q-btn size="sm" color="secondary" label="模拟切换到下一题" @click="shortCurrentIndex = (shortCurrentIndex + 1) % shortQuestions.length" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- 场景 2: 中等长度 (15个题目，超长标题测试) -->
    <q-card class="q-mb-xl shadow-2">
      <q-card-section class="bg-indigo text-white">
        <div class="text-subtitle1 text-weight-bold">场景 2: 超长标题与中等题目数量 (15个题目)</div>
        <div class="text-caption opacity-80">测试标题过长时是否会被优雅截断，以及15题容器的居中与缩放</div>
      </q-card-section>
      <q-card-section class="q-pa-none">
        <div class="header-container-mock">
          <HomeworkHeader
            :questions="mediumQuestions"
            :currentIndex="mediumCurrentIndex"
            :showDraft="mediumShowDraft"
            @back="onBack('medium')"
            @select-question="(q, idx) => mediumCurrentIndex = idx"
            @toggle-draft="mediumShowDraft = !mediumShowDraft"
          >
            <template #left-action>
              <div class="back-btn" @click="onBack('medium')">
                <img :src="goBackIcon" alt="返回" class="back-icon" />
              </div>
              <!-- 极其冗长的标题，用以测试截断效果 -->
              <span class="homework-name" title="2026年秋季学期七年级数学第一次月考暨阶段性教学质量评估检测学术水平诊断测试卷（实验班专用拔高卷）">
                2026年秋季学期七年级数学第一次月考暨阶段性教学质量评估检测学术水平诊断测试卷（实验班专用拔高卷）
              </span>
            </template>
          </HomeworkHeader>
        </div>
      </q-card-section>
      <q-card-section class="bg-grey-1 text-grey-8">
        <div class="row items-center justify-between">
          <span>当前第 <strong>{{ mediumCurrentIndex + 1 }}</strong> 题 / 共 15 题</span>
          <q-btn-group outline>
            <q-btn size="sm" outline label="上一题" @click="mediumCurrentIndex = Math.max(0, mediumCurrentIndex - 1)" :disabled="mediumCurrentIndex === 0" />
            <q-btn size="sm" outline label="下一题" @click="mediumCurrentIndex = Math.min(mediumQuestions.length - 1, mediumCurrentIndex + 1)" :disabled="mediumCurrentIndex === mediumQuestions.length - 1" />
          </q-btn-group>
        </div>
      </q-card-section>
    </q-card>

    <!-- 场景 3: 极限长度 (50个题目，超长标题，支持横向滚动) -->
    <q-card class="q-mb-xl shadow-2">
      <q-card-section class="bg-deep-purple text-white">
        <div class="text-subtitle1 text-weight-bold">场景 3: 极限题目数量压力测试 (50个题目)</div>
        <div class="text-caption opacity-80">测试当题目非常多时，题号列表的横向滚动效果及左右渐变遮罩 (Fading Mask) 的渲染</div>
      </q-card-section>
      <q-card-section class="q-pa-none">
        <div class="header-container-mock">
          <HomeworkHeader
            :questions="longQuestions"
            :currentIndex="longCurrentIndex"
            :showDraft="longShowDraft"
            @back="onBack('long')"
            @select-question="(q, idx) => longCurrentIndex = idx"
            @toggle-draft="longShowDraft = !longShowDraft"
          >
            <template #left-action>
              <div class="back-btn" @click="onBack('long')">
                <img :src="goBackIcon" alt="返回" class="back-icon" />
              </div>
              <span class="homework-name">理科综合能力测试 - 50题大作业压力测试</span>
            </template>
          </HomeworkHeader>
        </div>
      </q-card-section>
      <q-card-section class="bg-grey-1 text-grey-8">
        <div class="row items-center justify-between">
          <div class="row items-center q-gutter-sm">
            <q-badge color="purple" :label="`第 ${longCurrentIndex + 1} 题`" />
            <span class="text-caption text-grey-6">左右滑动题号查看更多</span>
          </div>
          <div class="row q-gutter-sm">
            <q-btn size="xs" color="purple" label="跳转到中间 (第25题)" @click="longCurrentIndex = 24" />
            <q-btn size="xs" color="purple" label="跳转到最后 (第50题)" @click="longCurrentIndex = 49" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- 场景 4: 交互式自定义游乐场 -->
    <q-card class="q-mb-xl shadow-2">
      <q-card-section class="bg-teal text-white">
        <div class="text-subtitle1 text-weight-bold">场景 4: 自定义交互配置面板 (Playground)</div>
        <div class="text-caption opacity-80">手动增减题量、控制每道题的答题状态，实时观测 Header 的响应性</div>
      </q-card-section>
      <q-card-section class="q-pa-md bg-grey-1">
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-12 col-md-4">
            <q-input v-model="playTitle" label="自定义标题" dense outlined class="bg-white" />
          </div>
          <div class="col-12 col-md-4">
            <div class="row items-center q-gutter-sm no-wrap">
              <span class="text-subtitle2 text-grey-7 shrink-none">题目数量:</span>
              <q-slider v-model="playCount" :min="1" :max="100" label label-always color="teal" />
            </div>
          </div>
          <div class="col-12 col-md-4 row items-center q-gutter-sm">
            <q-btn size="sm" color="teal" label="随机标记5题为已答" @click="randomlyMarkAnswered" />
            <q-btn size="sm" color="grey-6" flat label="重置状态" @click="resetPlayground" />
          </div>
        </div>
      </q-card-section>
      <q-card-section class="q-pa-none">
        <div class="header-container-mock">
          <HomeworkHeader
            :questions="playQuestions"
            :currentIndex="playCurrentIndex"
            :showDraft="playShowDraft"
            @back="onBack('playground')"
            @select-question="(q, idx) => playCurrentIndex = idx"
            @toggle-draft="playShowDraft = !playShowDraft"
          >
            <template #left-action>
              <div class="back-btn" @click="onBack('playground')">
                <img :src="goBackIcon" alt="返回" class="back-icon" />
              </div>
              <span class="homework-name">{{ playTitle || '未设置标题' }}</span>
            </template>
          </HomeworkHeader>
        </div>
      </q-card-section>
      <q-card-section class="bg-white">
        <div class="text-subtitle2 q-mb-xs">题目答题状态详情:</div>
        <div class="row q-gutter-xs">
          <q-btn
            v-for="(q, idx) in playQuestions"
            :key="idx"
            size="xs"
            :color="q.structuredContent?.userAnswer ? 'teal-5' : 'grey-4'"
            :text-color="q.structuredContent?.userAnswer ? 'white' : 'black'"
            :label="`${idx + 1}:${q.structuredContent?.userAnswer ? '已答' : '未答'}`"
            @click="toggleSingleQuestionAnswerState(idx)"
          />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import HomeworkHeader from '@/components/header/HomeworkHeader.vue'
import goBackIcon from '/icons/goback.svg'
import type { ExerciseItem } from '@/types'

defineOptions({
  name: 'HomeworkHeaderTestView'
})

const onBack = (type: string) => {
  console.log(`[Test] Back clicked on header variant: ${type}`)
}

// 辅助方法: 生成模拟 ExerciseItem 列表
const generateMockQuestions = (count: number, answeredIndices: number[] = []): ExerciseItem[] => {
  return Array.from({ length: count }, (_, idx) => {
    const isAnswered = answeredIndices.includes(idx)
    return {
      id: `mock-q-${idx + 1}`,
      bmNo: `BM-${idx + 1}`,
      type: 'single_choice',
      structuredContent: {
        id: `mock-q-${idx + 1}`,
        type: 'single_choice',
        stem: `测试题目第 ${idx + 1} 题`,
        // 这里的 userAnswer 或者是 boardData 有值，则在 HomeworkHeader 里会被识别为 "已答 (answered)" 状态
        userAnswer: isAnswered ? ['A'] : null
      }
    }
  })
}

// --- 场景 1 变量 ---
const shortQuestions = ref<ExerciseItem[]>(generateMockQuestions(5, [0, 2]))
const shortCurrentIndex = ref(0)
const shortShowDraft = ref(false)

// --- 场景 2 变量 ---
const mediumQuestions = ref<ExerciseItem[]>(generateMockQuestions(15, [0, 1, 4, 9, 12]))
const mediumCurrentIndex = ref(2)
const mediumShowDraft = ref(true)

// --- 场景 3 变量 ---
const longQuestions = ref<ExerciseItem[]>(generateMockQuestions(50, [1, 5, 8, 12, 19, 25, 30, 42, 49]))
const longCurrentIndex = ref(10)
const longShowDraft = ref(false)

// --- 场景 4 变量 ---
const playTitle = ref('我的自定义大作业测试案例')
const playCount = ref(25)
const playCurrentIndex = ref(0)
const playShowDraft = ref(false)
const playgroundAnsweredIndices = ref<number[]>([2, 5, 7, 10])

const playQuestions = computed(() => {
  return generateMockQuestions(playCount.value, playgroundAnsweredIndices.value)
})

watch(playCount, (newVal) => {
  if (playCurrentIndex.value >= newVal) {
    playCurrentIndex.value = newVal - 1
  }
})

const toggleSingleQuestionAnswerState = (idx: number) => {
  const index = playgroundAnsweredIndices.value.indexOf(idx)
  if (index > -1) {
    playgroundAnsweredIndices.value.splice(index, 1)
  } else {
    playgroundAnsweredIndices.value.push(idx)
  }
}

const randomlyMarkAnswered = () => {
  const temp: number[] = []
  for (let i = 0; i < 5; i++) {
    const randomIdx = Math.floor(Math.random() * playCount.value)
    if (!temp.includes(randomIdx)) {
      temp.push(randomIdx)
    }
  }
  playgroundAnsweredIndices.value = temp
}

const resetPlayground = () => {
  playgroundAnsweredIndices.value = []
  playCurrentIndex.value = 0
}
</script>

<style scoped lang="scss">
.homework-header-test {
  max-width: 1200px;
  margin: 0 auto;
}

.header-container-mock {
  border: 2px dashed #B3A7FF;
  border-radius: 8px;
  padding: 16px;
  background-color: #fafaff;
  margin: 16px;
}

.opacity-80 {
  opacity: 0.8;
}

.shrink-none {
  flex-shrink: 0;
}
</style>
