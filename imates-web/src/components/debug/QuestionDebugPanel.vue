<template>
  <q-dialog v-model="isVisible" position="right" maximized>
    <q-card style="width: 700px; max-width: 90vw">
      <!-- 头部 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">🔧 调试面板 - 题目管理</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- 统计信息 -->
      <q-card-section>
        <q-banner class="bg-info text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="analytics" size="md" />
          </template>
          <div class="text-subtitle2">存储统计</div>
          <div class="text-caption">
            题目总数: {{ questions.length }} | 
            当前选中: {{ currentQuestionIndex >= 0 ? `#${currentQuestionIndex + 1}` : '无' }} | 
            存储大小: {{ storageSize }}
          </div>
          <div class="text-caption q-mt-xs">
            科目分布: {{ subjectStatistics }}
          </div>
        </q-banner>
      </q-card-section>

      <!-- 操作按钮组 -->
      <q-card-section class="q-pt-none">
        <div class="row q-gutter-sm">
          <q-btn
            outline
            color="primary"
            icon="refresh"
            label="刷新"
            @click="refreshData"
            size="sm"
          />
          <q-btn
            outline
            color="negative"
            icon="delete_sweep"
            label="清空本地数据"
            @click="clearLocalData"
            size="sm"
          />
          <q-btn
            outline
            color="secondary"
            icon="download"
            label="导出数据"
            @click="exportData"
            size="sm"
          />
          <q-btn
            outline
            color="positive"
            icon="upload"
            label="导入数据"
            @click="importData"
            size="sm"
          />
        </div>
      </q-card-section>

      <!-- 搜索和筛选 -->
      <q-card-section class="q-pt-none">
        <div class="row q-gutter-sm">
          <q-input
            v-model="searchText"
            placeholder="搜索题目..."
            outlined
            dense
            clearable
            class="col"
          >
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
          <q-select
            v-model="filterSubject"
            :options="subjectFilterOptions"
            option-value="value"
            option-label="label"
            behavior="menu"
            emit-value
            map-options
            outlined
            dense
            clearable
            placeholder="筛选科目"
            style="min-width: 120px"
          />
        </div>
      </q-card-section>

      <!-- 题目列表 -->
      <q-separator />
      
      <q-card-section class="q-pa-none" style="max-height: 60vh; overflow-y: auto">
        <q-list separator>
          <q-item
            v-for="(question, index) in filteredQuestions"
            :key="question.id || index"
            clickable
            :class="{ 'bg-blue-1': index === currentQuestionIndex }"
            @click="selectQuestion(index)"
          >
            <q-item-section avatar>
              <q-avatar :color="index === currentQuestionIndex ? 'primary' : 'grey-5'" text-color="white">
                <q-icon :name="index === currentQuestionIndex ? 'check_circle' : 'description'" />
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ question.title || question.question || '无标题' }}</q-item-label>
              <q-item-label caption>
                ID: {{ question.id || question.bmNo || 'N/A' }} | 
                科目: {{ question.subject || '未知' }}
              </q-item-label>
              <q-item-label caption v-if="question.bmNo">
                bmNo: {{ question.bmNo }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="info"
                  color="blue"
                  @click.stop="viewQuestionDetail(question)"
                >
                  <q-tooltip>查看详情</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="delete"
                  color="negative"
                  @click.stop="deleteQuestion(index)"
                >
                  <q-tooltip>删除题目</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>

          <q-item v-if="filteredQuestions.length === 0">
            <q-item-section class="text-center text-grey-6">
              <div class="q-py-md">
                <q-icon name="inbox" size="48px" />
                <div class="q-mt-sm">暂无题目数据</div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 题目详情对话框 -->
  <q-dialog v-model="showDetailDialog" maximized>
    <q-card v-if="selectedQuestion" style="width: 800px; max-width: 95vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">题目详情</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-list bordered separator>
          <q-item>
            <q-item-section>
              <q-item-label caption>题目ID</q-item-label>
              <q-item-label>{{ selectedQuestion.id || 'N/A' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="selectedQuestion.bmNo">
            <q-item-section>
              <q-item-label caption>bmNo</q-item-label>
              <q-item-label>{{ selectedQuestion.bmNo }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>题目标题</q-item-label>
              <q-item-label>{{ selectedQuestion.title || '无标题' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>科目</q-item-label>
              <q-item-label>{{ selectedQuestion.subject || '未知' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="selectedQuestion.question || selectedQuestion.title">
            <q-item-section>
              <q-item-label caption>题目内容</q-item-label>
              <q-item-label class="q-mt-xs">{{ selectedQuestion.question || selectedQuestion.title }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="selectedQuestion.answer">
            <q-item-section>
              <q-item-label caption>答案</q-item-label>
              <q-item-label class="q-mt-xs">{{ selectedQuestion.answer }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="selectedQuestion.explanation">
            <q-item-section>
              <q-item-label caption>解析</q-item-label>
              <q-item-label class="q-mt-xs">{{ selectedQuestion.explanation }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="selectedQuestion.analysisData">
            <q-item-section>
              <q-item-label caption>分析数据</q-item-label>
              <q-item-label class="q-mt-xs">{{ selectedQuestion.analysisData }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- 原始JSON数据 -->
      <q-card-section>
        <div class="text-subtitle2 q-mb-md">原始 JSON 数据</div>
        <q-scroll-area style="height: 300px">
          <pre class="q-pa-md bg-grey-1 rounded-borders">{{ jsonData }}</pre>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 导入文件输入 -->
  <input
    ref="fileInputRef"
    type="file"
    accept=".json"
    style="display: none"
    @change="handleFileImport"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useQuestionStore } from '../../stores/questionStore'
import type { ExerciseItem } from '../../types'
import { SUBJECT_OPTIONS } from '../../constants/subjects'
import {
  clearAllQuestionsFromIndexedDB,
  loadQuestionsFromIndexedDB
} from '@/services/storage/question-storage'

// Props
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Store
const questionStore = useQuestionStore()

// 响应式数据
const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const questions = ref<ExerciseItem[]>([])
const storageSize = ref('0 KB')
const selectedQuestion = ref<ExerciseItem | null>(null)
const showDetailDialog = ref(false)
const fileInputRef = ref<HTMLInputElement>()

// 搜索和筛选
const searchText = ref('')
const filterSubject = ref<string | null>(null)

const subjectFilterOptions = [
  { label: '全部', value: null },
  ...SUBJECT_OPTIONS.filter((opt) => opt.value).map((opt) => ({ label: opt.label, value: opt.value })),
]

// 计算属性
const currentQuestionIndex = computed(() => {
  return questionStore.currentQuestionIndex
})

const subjectStatistics = computed(() => {
  const stats: Record<string, number> = {}
  questions.value.forEach(q => {
    const subject = q.subject || '未知'
    stats[subject] = (stats[subject] || 0) + 1
  })
  return Object.entries(stats)
    .map(([subject, count]) => `${subject}: ${count}`)
    .join(' | ')
})

const filteredQuestions = computed(() => {
  let filtered = [...questions.value]
  
  // 科目筛选
  if (filterSubject.value) {
    filtered = filtered.filter(q => 
      (q.subject || '').toLowerCase() === filterSubject.value?.toLowerCase()
    )
  }
  
  // 搜索筛选
  if (searchText.value) {
    const searchLower = searchText.value.toLowerCase()
    filtered = filtered.filter(q => {
      const title = (q.title || q.question || '').toLowerCase()
      const id = (q.id || q.bmNo || '').toLowerCase()
      return title.includes(searchLower) || id.includes(searchLower)
    })
  }
  
  return filtered
})

const jsonData = computed(() => {
  if (!selectedQuestion.value) return ''
  return JSON.stringify(selectedQuestion.value, null, 2)
})

// 刷新数据
const refreshData = async () => {
  try {
    questions.value = [...questionStore.questions]
    await calculateStorageSize()
  } catch (error) {
    console.error('刷新失败:', error)
  }
}

// 计算存储大小
const calculateStorageSize = async () => {
  try {
    let totalSize = 0
    
    // 计算内存中的题目数据大小
    const questionsData = JSON.stringify(questions.value)
    totalSize += new Blob([questionsData]).size
    
    // 计算 IndexedDB 中的存储大小
    const allSubjects = ['math', 'biology', 'chemistry', 'physics', 'chinese', 'english']
    for (const subject of allSubjects) {
      const data = await loadQuestionsFromIndexedDB(subject)
      if (data && Array.isArray(data)) {
        totalSize += new Blob([JSON.stringify(data)]).size
      }
    }
    
    // 格式化大小
    if (totalSize < 1024) {
      storageSize.value = `${totalSize} B`
    } else if (totalSize < 1024 * 1024) {
      storageSize.value = `${(totalSize / 1024).toFixed(2)} KB`
    } else {
      storageSize.value = `${(totalSize / 1024 / 1024).toFixed(2)} MB`
    }
  } catch (error) {
    console.error('计算存储大小失败:', error)
    storageSize.value = '未知'
  }
}

// 清空本地数据
const clearLocalData = async () => {
  try {
    // 确认对话框
    const confirmed = window.confirm('确定要清空所有本地题目数据吗？此操作不可恢复！')
    if (!confirmed) return
    
    // 清空 IndexedDB
    await clearAllQuestionsFromIndexedDB()
    
    // 清空 Store
    questionStore.questions = []
    questionStore.currentQuestionIndex = -1
    
    // 刷新数据
    await refreshData()
  } catch (error) {
    console.error('清空失败:', error)
  }
}

// 选择题目
const selectQuestion = async (index: number) => {
  try {
    // 找到原始索引（因为 filteredQuestions 是过滤后的）
    const question = filteredQuestions.value[index]
    const originalIndex = questions.value.findIndex(q => 
      q.id === question.id || (q.bmNo && q.bmNo === question.bmNo)
    )
    
    if (originalIndex >= 0) {
      await questionStore.selectQuestion(originalIndex)
      await refreshData()
    }
  } catch (error) {
    console.error('选择题目失败:', error)
  }
}

// 删除题目
const deleteQuestion = async (index: number) => {
  try {
    const question = filteredQuestions.value[index]
    const originalIndex = questions.value.findIndex(q => 
      q.id === question.id || (q.bmNo && q.bmNo === question.bmNo)
    )
    
    if (originalIndex < 0) {
      return
    }

    const questionId = question.id || question.bmNo

    // 使用 Quasar 对话框，提供是否删除聊天记录的选项
    const { default: { dialog } } = await import('quasar')

    dialog({
      title: '删除确认',
      message: '确定要删除这道题目吗？',
      cancel: true,
      ok: {
        label: '删除',
        color: 'negative',
      },
      options: {
        type: 'toggle',
        model: [],
        items: [
          {
            label: '同时删除该题目的对话记录',
            value: 'deleteChat',
          },
        ],
      },
    }).onOk(async (data: { options?: string[] }) => {
      try {
        const deleteChat = data?.options?.includes('deleteChat')

        // 先删除题目
        await questionStore.deleteQuestion(originalIndex, question.subject)

        // 如果勾选了同时删除对话记录，则清理对应题目的 AI 练习聊天记录
        if (deleteChat && questionId) {
          const aiExerciseStore = useAiExerciseChatStore()
          await aiExerciseStore.clearChatHistory(questionId)
        }

        await refreshData()
      } catch (error) {
        console.error('删除失败:', error)
      }
    })
  } catch (error) {
    console.error('删除失败:', error)
  }
}

// 查看题目详情
const viewQuestionDetail = (question: ExerciseItem) => {
  selectedQuestion.value = question
  showDetailDialog.value = true
}

// 导出数据
const exportData = async () => {
  try {
    const exportData: any = {
      version: '1.0',
      exportTime: Date.now(),
      questions: questions.value,
      statistics: {
        total: questions.value.length,
        bySubject: {} as Record<string, number>
      }
    }
    
    // 统计科目分布
    questions.value.forEach(q => {
      const subject = q.subject || '未知'
      exportData.statistics.bySubject[subject] = 
        (exportData.statistics.bySubject[subject] || 0) + 1
    })
    
    // 创建下载
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `questions-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
  }
}

// 导入数据
const importData = () => {
  fileInputRef.value?.click()
}

// 处理文件导入
const handleFileImport = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  try {
    const text = await file.text()
    const importData = JSON.parse(text)
    
    // 验证数据格式
    if (!importData.questions || !Array.isArray(importData.questions)) {
      throw new Error('无效的数据格式：缺少 questions 数组')
    }
    
    // 导入题目到 Store
    await questionStore.setQuestions(importData.questions)
    
    // 刷新数据
    await refreshData()
  } catch (error) {
    console.error('导入失败:', error)
    alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
  
  // 清空文件输入
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// 监听 Store 变化，自动更新数据
watch(() => questionStore.questions, () => {
  refreshData()
}, { deep: true })

watch(() => questionStore.currentQuestionIndex, () => {
  refreshData()
})

// 组件挂载时加载数据
onMounted(() => {
  refreshData()
})
</script>

<style lang="scss" scoped>
:deep(.q-dialog__inner) {
  max-width: 700px;
}

pre {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
}
</style>

