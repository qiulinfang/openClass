<template>
  <div class="homework-render-test q-pa-md">
    <div class="text-h5 q-mb-md">HomeworkAnswerView 渲染极限测试</div>
    
    <q-card class="q-mb-md shadow-2">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold">测试配置</div>
        <div class="row q-gutter-md q-mt-sm items-center">
          <q-toggle v-model="isSubmitted" label="已提交状态 (查看解析/批改结果)" color="green" />
          <q-select 
            v-model="selectedSubject" 
            :options="subjectOptions" 
            label="科目" 
            dense 
            outlined 
            emit-value
            map-options
            style="width: 150px"
          />
          <q-badge color="orange" label="Edge Cases Enabled" />
        </div>
      </q-card-section>
      
      <q-card-actions align="right" class="q-pb-md q-pr-md">
        <q-btn color="primary" icon="play_arrow" label="启动测试" @click="startTest" />
      </q-card-actions>
    </q-card>

    <q-card class="shadow-1">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold">待测试题目列表 ({{ mockQuestions.length }} 题)</div>
        <q-list bordered separator class="q-mt-sm">
          <q-item v-for="q in mockQuestions" :key="q.id">
            <q-item-section avatar>
              <q-chip :color="getTypeColor(q.type || '')" text-color="white" size="sm">
                {{ q.type }}
              </q-chip>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ q.title }}</q-item-label>
              <q-item-label caption>
                <div v-html="truncateHtml(q.question || q.questionContent || '')"></div>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHomeworkStore } from '@/stores/homeworkStore'
import type { ExerciseItem } from '@/types/exercise'

const router = useRouter()
const homeworkStore = useHomeworkStore()

const isSubmitted = ref(false)
const selectedSubject = ref('math')
const subjectOptions = [
  { label: '数学', value: 'math' },
  { label: '语文', value: 'chinese' },
  { label: '物理', value: 'physics' },
  { label: '化学', value: 'chemistry' }
]

const TEST_HOMEWORK_ID = 'test-limit-render-999'

const mockQuestions: ExerciseItem[] = [
  {
    id: 'q1001',
    bmNo: 'BM1001',
    title: '单项选择题',
    type: 'single_choice',
    structuredContent: {
      id: 'q1001',
      subject: 'math',
      score: 5,
      type: 'single_choice',
      stem: '下列关于细胞膜的叙述，正确的是（ ）。',
      options: [
        { id: 'A', content: '主要由脂质和蛋白质组成' },
        { id: 'B', content: '具有完全的通透性' },
        { id: 'C', content: '参与细胞间的信息交流' },
        { id: 'D', content: '其结构特点是具有选择透过性' }
      ],
      answer: ['A'],
      analysis: '根据细胞膜的成分和功能，A正确。'
    },
    questionReason: '标准单选题结构测试'
  },
  {
    id: 'q1002',
    bmNo: 'BM1002',
    title: '多项选择题',
    type: 'multiple_choice',
    structuredContent: {
      id: 'q1002',
      subject: 'math',
      score: 5,
      type: 'multiple_choice',
      stem: '下列关于细胞膜的叙述，正确的是（ ）。',
      options: [
        { id: 'A', content: '主要由脂质和蛋白质组成' },
        { id: 'B', content: '具有完全的通透性' },
        { id: 'C', content: '参与细胞间的信息交流' },
        { id: 'D', content: '其结构特点是具有选择透过性' }
      ],
      answer: ['A', 'C'],
      analysis: 'AC正确。'
    },
    questionReason: '标准多选题结构测试'
  },
  {
    id: 'q1003',
    bmNo: 'BM1003',
    title: '判断题',
    type: 'true_false',
    structuredContent: {
      id: 'q1003',
      subject: 'physics',
      score: 5,
      type: 'true_false',
      stem: '无论在任何惯性参考系中，真空中的光速都是不变的。',
      options: [
        { id: 'true', content: '正确' },
        { id: 'false', content: '错误' }
      ],
      answer: 'true',
      analysis: '爱因斯坦相对论基本假设。'
    },
    questionReason: '标准判断题结构测试'
  },
  {
    id: 'q1004',
    bmNo: 'BM1004',
    title: '填空题',
    type: 'fill_in_blank',
    structuredContent: {
      id: 'q1004',
      subject: 'math',
      score: 5,
      type: 'fill_in_blank',
      stem: '在标况下，$22.4L$ 的 $O_2$ 所含的分子数约为 [blank_1]；其质量为 [blank_2] 克。',
      blanks: [
        {
          id: 'blank_1',
          answer: ["$6.02 \\times 10^{23}$", "$N_A$"], 
        },
        {
          id: 'blank_2',
          answer: ["32", "32.0"],
        }
      ],
      analysis: '标况下1摩尔气体体积为22.4L。'
    },
    questionReason: '标准填空题结构测试'
  },
  {
    id: 'q1005',
    bmNo: 'BM1005',
    title: '主观解答题',
    type: 'subjective',
    structuredContent: {
      id: 'q1005',
      subject: 'history',
      score: 10,
      type: 'subjective',
      stem: '阅读下列材料，简述辛亥革命的历史意义。',
      answer: "推翻了清朝统治，结束了中国两千多年的封建君主专制制度，建立了亚洲第一个资产阶级民主共和国。",
      analysis: '考察辛亥革命的历史意义。'
    },
    questionReason: '标准主观题结构测试'
  },
  {
    id: 'q1006',
    bmNo: 'BM1006',
    title: '复合材料题',
    type: 'composite',
    material: "Here is a long passage about global warming... (公共阅读文本或图表)",
    subQuestions: [
      {
        id: 'cq_1',
        type: 'single_choice',
        structuredContent: {
          id: 'cq_1',
          type: 'single_choice',
          stem: "What is the main idea of paragraph 1?",
          options: [
            { id: "A", content: "The definition of global warming." },
            { id: "B", content: "The causes of climate change." }
          ],
          answer: ["A"],
          analysis: "文章第一段主要定义了全球变暖。"
        }
      },
      {
        id: 'cq_2',
        type: 'subjective',
        structuredContent: {
          id: 'cq_2',
          type: 'subjective',
          stem: "Translate the underlined sentence into Chinese.",
          answer: "这是文章中划线句子的中文翻译。",
          analysis: "考核翻译能力。"
        }
      }
    ],
    structuredContent: {
      id: 'q1006',
      type: 'composite',
      stem: '材料题干内容'
    },
    questionReason: '标准复合题结构测试'
  }
]

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    single_choice: 'blue',
    multiple_choice: 'indigo',
    true_false: 'orange',
    fill_in_blank: 'teal',
    subjective: 'deep-orange',
    composite: 'purple'
  }
  return colors[type] || 'grey'
}

const truncateHtml = (html: string) => {
  const text = html.replace(/<[^>]*>/g, '')
  return text.length > 50 ? text.substring(0, 50) + '...' : text
}

const startTest = async () => {
  console.log('[TEST] 正在注入模拟数据...')
  
  // 1. 设置 Store 数据
  homeworkStore.setHomeworkName('渲染极限压力测试作业 (Devin Generated)')
  await homeworkStore.setQuestions(mockQuestions, selectedSubject.value)
  
  // 2. 持久化到 IndexedDB 以供 HomeworkAnswerView 加载
  await homeworkStore.saveCurrentHomeworkSubmission(TEST_HOMEWORK_ID, isSubmitted.value)
  
  console.log('[TEST] 数据注入完成，正在跳转...')
  
  // 3. 跳转到作业页面
  router.push({
    name: 'homeworkAnswer',
    params: { homeworkId: TEST_HOMEWORK_ID }
  })
}
</script>

<style scoped>
.homework-render-test {
  max-width: 900px;
  margin: 0 auto;
}
.shadow-2 {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
}
</style>
