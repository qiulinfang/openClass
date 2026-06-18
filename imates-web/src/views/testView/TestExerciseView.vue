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
import { initExerciseAnswerFields } from '@/services/boundary/exercise'

const { renderMessageContent } = useMessageRenderer()

// 测试用例数据
const testQuestions = [
  {
    id: 'test_composite_nested',
    title: '物理过山车 (嵌套复合题测试)',
    question: ({
      "id": "416431632091811840",
      "subject": "物理",
      "score": 10.0,
      "type": "composite",
      "material": "模型的修正和完善伴随着我们对物理本质更深入的认识。某学习小组对过山车的运动进行了深入研究。已知重力加速度为 g，不计摩擦及空气阻力。",
      "subQuestions": [
        {
          "id": "sub_group_1",
          "type": "composite",
          "material": "(1) 先将过山车用可视为质点的小球来替代。\n<img src=\"https://k12-picture.tos-cn-beijing.volces.com/ocr_uploads/2f9ffb9acbb5/manual_region_0_98020054.jpg\" style=\"display:block;\"/>",
          "subQuestions": [
            {
              "id": "sub_1_a",
              "type": "subjective",
              "stem": "a. 求小球在圆轨道最高点的速度大小  $v_{1}$；",
              "answer": "$v_{1} = \\sqrt{gR}$"
            },
            {
              "id": "sub_1_b",
              "type": "subjective",
              "stem": "b. 实际的过山车竖直回环轨道不是正圆，而是设计成图乙所示的扁轨道，可将其简化为图丙所示的轨道。研究一般的曲线运动时，我们可将运动过程分割为许多很短的小段，每小段的运动均可看作是圆周运动的一部分。若轨道承压足够大，请比较小球从同一位置 P 由静止释放，分别沿扁轨道、正圆轨道到达最高点 Q 时轨道对其压力的大小关系，并说明这种设计的优点。\n<img src=\"https://k12-picture.tos-cn-beijing.volces.com/ocr_uploads/2f9ffb9acbb5/manual_region_1_3501d816.jpg\" style=\"display:block;\"/>\n\n<img src=\"https://k12-picture.tos-cn-beijing.volces.com/ocr_uploads/2f9ffb9acbb5/manual_region_2_cd08c57d.jpg\" style=\"display:block;\"/>",
              "answer": "扁轨道压力更大。优点：压力大，更不易脱轨，安全性更高。"
            }
          ]
        },
        {
          "id": "sub_group_2",
          "type": "composite",
          "material": "(2) 实际的过山车并不能视为质点。如图丁所示，一列长为 L、质量为 M 的玩具过山车，在无动力情况下，从水平轨道冲上半径为 r 的竖直圆轨道。已知  $L > 2\\pi r$，不计过山车自身高度及相邻车体间碰撞。在车体始终布满轨道的一段时间内，过山车的速率保持不变，请在该段时间内分析下列问题：",
          "subQuestions": [
            {
              "id": "sub_2_a",
              "type": "subjective",
              "stem": "a. 推导最高点处车体之间的拉力大小  $T=\\frac{2r}{L}Mg$；",
              "answer": "$T = \\frac{2r}{L} Mg$"
            },
            {
              "id": "sub_2_b",
              "type": "subjective",
              "stem": "b. 取轨道最高点处的一小段长度为 s 的车体为研究对象。若此时左、右侧车体对其拉力大小可视为相等，且两力的合力大小为 a 问中拉力的  \\frac{s}{r} 倍，求该小段车体通过最高点时的最小速度  $v_{m}$。",
              "answer": "$v_{\\mathrm{m}} = \\sqrt{3gr}$"
            }
          ]
        }
      ]
    } as unknown) as ExerciseItem
  },
  {
    id: 'test_composite_flat',
    title: '多子题扁平复合题 (测试 Tab 导航与已答状态)',
    question: ({
      "id": "q_1002",
      "subject": "english",
      "score": 10.0,
      "type": "composite",
      "material": "阅读下面的短文，完成下列各题：<br/>Reading is a very good habit. It helps us learn new things, keep our minds active, and improve our language skills.",
      "subQuestions": [
        {
          "id": "cq_f1",
          "type": "single_choice",
          "structuredContent": {
            "stem": "1. What is the passage mainly about?",
            "options": [
              { "id": "A", "content": "The importance of reading" },
              { "id": "B", "content": "How to write a book" },
              { "id": "C", "content": "Different types of habits" }
            ],
            "answer": "A"
          }
        },
        {
          "id": "cq_f2",
          "type": "true_false",
          "structuredContent": {
            "stem": "2. Reading does not help us learn new things. (True/False)",
            "answer": "False"
          }
        },
        {
          "id": "cq_f3",
          "type": "fill_in_blank",
          "structuredContent": {
            "stem": "3. According to the text, reading is a very [blank_1] habit.",
            "blanks": 1
          },
          "answer": "good"
        },
        {
          "id": "cq_f4",
          "type": "subjective",
          "structuredContent": {
            "stem": "4. Why do you like reading? Write down your own reason.",
            "answer": "I like reading because..."
          }
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
  },
  {
    id: 'test_judgment',
    title: '判断题测试',
    question: ({
      id: 'q_003',
      type: 'true_false',
      structuredContent: {
        stem: '光在真空中传播的速度大约是 30 万千米每秒。',
        options: [
          { id: 'true', content: '正确' },
          { id: 'false', content: '错误' }
        ]
      },
      answer: 'true'
    } as unknown) as ExerciseItem
  },
  {
    id: 'test_multiple_choice',
    title: '多选题测试',
    question: ({
      id: 'q_004',
      type: 'multiple_choice',
      structuredContent: {
        stem: '以下哪些属于太阳系内的八大行星？',
        options: [
          { id: 'A', content: '地球' },
          { id: 'B', content: '火星' },
          { id: 'C', content: '冥王星' },
          { id: 'D', content: '木星' }
        ]
      },
      answer: 'A,B,D'
    } as unknown) as ExerciseItem
  },
  {
    id: 'test_subjective',
    title: '主观题测试',
    question: ({
      id: 'q_005',
      type: 'subjective',
      structuredContent: {
        stem: '请简述牛顿第一运动定律的内容并举出一个生活中的例子。',
        analysis: '牛顿第一定律又称惯性定律：任何物体都要保持匀速直线运动或静止状态，直到外力迫使它改变运动状态为止。例如：汽车紧急刹车时，乘客会向前倾。'
      },
      answer: '一切物体在没有受到外力作用的时候，总保持匀速直线运动状态或静止状态。例如，乘车人因汽车紧急刹车而向前倾倒。'
    } as unknown) as ExerciseItem
  }
]

// 运行初始化以给测试大题及子题补全 structuredContent 属性
testQuestions.forEach(item => {
  initExerciseAnswerFields(item.question)
})

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
