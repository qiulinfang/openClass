<template>
  <div class="test-exercise-view q-pa-md">
    <h1 class="text-h4 q-mb-lg">题目组件集成测试页面</h1>

    <div class="row q-col-gutter-md">
      <!-- 左侧：测试用例列表 -->
      <div class="col-12 col-md-4">
        <q-list bordered separator class="bg-white rounded-borders">
          <q-item-label header>测试用例</q-item-label>
          <q-item 
            v-for="(item, index) in testQuestions" 
            :key="item.id"
            clickable
            :active="currentIndex === index"
            active-class="bg-primary text-white"
            @click="currentIndex = index"
          >
            <q-item-section>
              <q-item-label>{{ index + 1 }}. {{ item.title }}</q-item-label>
              <q-item-label caption :class="currentIndex === index ? 'text-white' : ''">
                类型: {{ item.question.type }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <div class="q-mt-md bg-grey-2 q-pa-sm rounded-borders">
          <div class="text-weight-bold">当前实时数据 (v-model):</div>
          <pre class="q-ma-none text-caption">{{ currentAnswer }}</pre>
        </div>
      </div>

      <!-- 右侧：预览与渲染 -->
      <div class="col-12 col-md-8">
        <q-card flat bordered class="full-height">
          <q-toolbar class="bg-grey-1">
            <q-toolbar-title>渲染预览: {{ currentQuestion.title }}</q-toolbar-title>
          </q-toolbar>

          <q-card-section class="q-pa-lg scroll" style="max-height: 70vh">
            <!-- 渲染逻辑分支 -->
            <CompositeQuestion 
              v-if="currentQuestion.question.type === 'composite'"
              :question="safeQuestion"
              v-model="compositeAnswers"
            />

            <!-- 2. 普通题型 -->
            <component 
              v-else
              :is="getComponent(currentQuestion.question.type || '')" 
              :question="currentQuestion.question" 
              v-model="answers[currentQuestion.id]"
              show-title
            />
          </q-card-section>

          <q-separator />

          <q-card-actions align="right">
            <q-btn flat label="查看解析" color="primary" @click="showAnalysis = true" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <!-- 解析对话框 -->
    <q-dialog v-model="showAnalysis">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">题目解析</div>
        </q-card-section>
        <q-card-section class="q-pt-none markdown-content">
          <div class="text-subtitle2 text-grey-7 q-mb-xs">参考答案:</div>
          <div v-html="renderMessageContent(safeQuestion.answer || '无')"></div>
          <q-separator class="q-my-md" />
          <div class="text-subtitle2 text-grey-7 q-mb-xs">详细解析:</div>
          <div v-html="renderMessageContent(safeQuestion.structuredContent?.analysis || '暂无解析')"></div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="关闭" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import ChoiceQuestion from '@/components/exercise/ChoiceQuestion.vue'
import FillBlankQuestion from '@/components/exercise/FillBlankQuestion.vue'
import JudgmentQuestion from '@/components/exercise/JudgmentQuestion.vue'
import CompositeQuestion from '@/components/exercise/CompositeQuestion.vue'
import BaseQuestion from '@/components/exercise/BaseQuestion.vue'
import type { ExerciseItem } from '@/types/exercise'
import { useMessageRenderer } from '@/composables/useMessageRenderer'

const { renderMessageContent } = useMessageRenderer()

// 测试用例数据
const testQuestions = [
  {
    id: 'test_composite_nested',
    title: '嵌套复合材料题 (用户指定用例)',
    question: ({
      "id": "q_1001",
      "subject": "math",
      "score": 5.0,
      "type": "composite",
      "material": "这是主题干",
      "subQuestions": [
        {
          "id": "cq_1",
          "bmNo": "BM_SUB_1",
          "type": "composite",
          "material": "子题干，这题还带两个子题",
          "subQuestions": [
            {
              "id": "cq_2_1",
              "bmNo": "BM_SUB_2_1",
              "type": "subjective",
              "structuredContent": {
                "stem": "第一小题的第一小小题干",
                "answer": "答案for第一小题的第一小小题干",
                "analysis": "解析for第一小题的第一小小题干"
              }
            },
            {
              "id": "cq_2_2",
              "bmNo": "BM_SUB_2_2",
              "type": "single_choice",
              "structuredContent": {
                "stem": "第一小题的第二小小题干",
                "options": [
                  {
                    "id": "A",
                    "content": "a选项内容"
                  },
                  {
                    "id": "B",
                    "content": "b选项内容（设置为正确选项）"
                  }
                ],
                "answer": "B"
              }
            }
          ]
        }
      ]
    } as unknown) as ExerciseItem
  },
  {
    id: 'test_choice',
    title: '单选题测试',
    question: ({
      id: 'q_001',
      type: 'single_choice',
      structuredContent: {
        stem: '1+1 等于几？',
        options: [
          { id: 'A', content: '1' },
          { id: 'B', content: '2' },
          { id: 'C', content: '3' }
        ]
      },
      answer: 'B'
    } as unknown) as ExerciseItem
  },
  {
    id: 'test_fill',
    title: '填空题测试',
    question: ({
      id: 'q_002',
      type: 'fill_in_blank',
      structuredContent: {
        stem: '床前明月光，[blank_1]，举头望明月，[blank_2]。',
        blanks: 2
      },
      answer: '疑是地上霜, 低头思故乡'
    } as unknown) as ExerciseItem
  }
]

const currentIndex = ref(0)
const currentQuestion = computed(() => testQuestions[currentIndex.value])
const safeQuestion = computed(() => currentQuestion.value.question)
const showAnalysis = ref(false)

// 响应式答案存储
const answers = reactive<Record<string, any>>({})
const compositeAnswers = ref<Record<string, any>>({})

const currentAnswer = computed(() => {
  const qId = currentQuestion.value.id
  if (currentQuestion.value.question.type === 'composite') {
    return compositeAnswers.value
  }
  return answers[qId]
})

// 组件映射
const getComponent = (type: string) => {
  switch (type) {
    case 'single_choice':
    case 'multiple_choice':
      return ChoiceQuestion
    case 'fill_in_blank':
      return FillBlankQuestion
    case 'true_false':
      return JudgmentQuestion
    default:
      return BaseQuestion
  }
}
</script>

<style scoped>
.test-exercise-view {
  background-color: #f5f5f5;
  min-height: 100vh;
}
.composite-container {
  border-left: 4px solid #1976D2;
  padding-left: 16px;
}
.sub-question-item {
  border-top: 1px dashed #ddd;
  padding-top: 16px;
}
.markdown-content {
  line-height: 1.6;
  font-size: 1.1rem;
}
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
