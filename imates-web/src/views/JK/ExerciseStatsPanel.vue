<template>
  <div class="stats-fullscreen-content">
    <div class="stats-container">
      <!-- 统计控制栏（排序与筛选） -->
      <div class="stats-controls-row q-mb-lg">
        <div class="control-group">
          <span class="control-label">排序:</span>
          <div class="btn-toggle">
            <button 
              v-for="opt in sortOptions" 
              :key="opt.value"
              class="toggle-btn"
              :class="{ active: currentSort === opt.value }"
              @click="handleSortChange(opt.value)"
            >
              {{ opt.label }}
              <q-icon 
                v-if="currentSort === opt.value"
                name="unfold_more" 
                size="12px"
                class="q-ml-xs"
                :style="{ transform: sortOrder === 'asc' ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }"
              />
            </button>
          </div>
        </div>

        <div class="control-group">
          <span class="control-label">题型:</span>
          <div class="btn-toggle">
            <button 
              v-for="opt in filterOptions" 
              :key="opt.value"
              class="toggle-btn"
              :class="{ active: currentFilter === opt.value }"
              @click="emit('update:currentFilter', opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="question-stats-grid">
        <div 
          v-for="stat in filteredAndSortedStats" 
          :key="stat.questionId" 
          class="question-stat-compact-card"
        >
          <div class="card-main">
            <div class="q-header">
              <span class="q-index">Q{{ stat.index }}</span>
              <span class="q-type-tag" :class="stat.type">{{ stat.type === 'choice' ? '选择' : '判断' }}</span>
            </div>

            <!-- 全班正确率展示：采用与分层相同的布局 -->
            <div class="class-accuracy-minimal">
              <div class="accuracy-bar-container">
                <div 
                  class="accuracy-bar" 
                  :style="{ 
                    width: stat.classAccuracy + '%',
                    backgroundColor: '#6e55ff'
                  }"
                ></div>
              </div>
              <div class="accuracy-info">
                <span class="accuracy-val">{{ stat.classAccuracy }}%</span>
                <span class="submit-count">{{ stat.submitCount }}人</span>
              </div>
            </div>

            <!-- 详情展开按钮 -->
            <button class="detail-toggle-btn" @click="toggleLayerDetail(stat.questionId, 'all')">
              <span>分层详情</span>
              <q-icon 
                name="keyboard_arrow_down" 
                size="16px"
                :class="{ 'is-rotated': expandedLayerKey?.startsWith(stat.questionId) }"
              />
            </button>
          </div>
          
          <!-- 展开的内容：分层统计 -->
          <div v-if="expandedLayerKey?.startsWith(stat.questionId)" class="card-details">
            <div 
              v-for="layer in layers" 
              :key="layer" 
              class="layer-row"
            >
              <div class="layer-info">
                <div class="layer-dot" :style="{ backgroundColor: getLayerColor(layer) }"></div>
                <span class="layer-label">{{ layerLabelMap[layer] }}</span>
              </div>
              <div class="layer-bar-wrapper">
                <div 
                  class="layer-bar-fill" 
                  :style="{ 
                    width: stat.layerStats[layer].accuracy + '%',
                    backgroundColor: getBarColor(stat.layerStats[layer].accuracy)
                  }"
                ></div>
              </div>
              <div class="layer-stats-info">
                <span class="layer-val">{{ stat.layerStats[layer].accuracy }}%</span>
                <span class="layer-count">{{ stat.layerStats[layer].totalCount }}人</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'ExerciseStatsPanel'
}
</script>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { CLASSROOM_EXERCISE } from '@/mocks/negativeNumbers'
import { ADDRESS_CATALOG } from '@/config/env-config'

// 统计相关接口定义
interface OptionDist {
  label: string
  count: number
  percent: number
}

interface LayerStat {
  accuracy: number
  correctCount: number
  totalCount: number
  optionDist: OptionDist[]
}

interface QuestionStat {
  index: number
  questionId: string
  bmNo: string
  title: string
  options?: { label: string; text: string }[]
  type: 'choice' | 'judgment'
  classAccuracy: number
  submitCount: number
  layerStats: Record<string, LayerStat>
}

const props = defineProps<{
  currentSort: string
  currentFilter: string
  date?: string // 外部传入的过滤日期
  env?: 'dev' | 'prod'
}>()

const emit = defineEmits<{
  (e: 'update:currentSort', value: string): void
  (e: 'update:currentFilter', value: string): void
}>()

// --- 配置项 ---
// 注释掉内部的 currentEnv，使用外部传入的 env prop
// type EnvType = 'mock' | 'dev' | 'prod'
// const currentEnv = ref<EnvType>('dev') 

const sortOptions = [
  { label: '题号', value: 'index' },
  { label: '正确率', value: 'accuracy' },
  { label: '提交人数', value: 'count' }
]

const sortOrder = ref<'asc' | 'desc'>('asc')

const handleSortChange = (val: string) => {
  if (props.currentSort === val) {
    // 如果点击的是当前已选中的排序字段，则切换升降序
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    // 如果点击的是新字段，默认降序（通常用户更关心高数据）
    emit('update:currentSort', val)
    sortOrder.value = 'desc'
  }
}

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '选择题', value: 'choice' },
  { label: '判断题', value: 'judgment' }
]

// Mock 当前学生信息
const mockStudentInfo = {
  name: '张同学',
  layer: '2'
}

// --- 辅助函数 ---
const getCorrectAnswer = (questionId: string) => {
  const q = CLASSROOM_EXERCISE.questions.find(item => item.id === questionId)
  return q?.answer || ''
}

const getCorrectAnswerLabel = (stat: QuestionStat) => {
  if (stat.type === 'choice') {
    return getCorrectAnswer(stat.questionId)
  } else if (stat.type === 'judgment') {
    const rawAnswer = getCorrectAnswer(stat.questionId)
    return rawAnswer === '√' || rawAnswer === '对' ? '对' : '错'
  }
  return ''
}

const getLayerColor = (layer: string) => {
  const colors: any = { '1': '#475569', '2': '#64748b', '3': '#94a3b8' }
  return colors[layer]
}

const getBarColor = (accuracy: number) => {
  return '#6e55ff'
}

const toggleLayerDetail = (questionId: string, layer: string) => {
  const key = `${questionId}-${layer}`
  expandedLayerKey.value = expandedLayerKey.value === key ? null : key
}

// --- 统计逻辑 ---
const expandedLayerKey = ref<string | null>(null)
const layers = ['1', '2', '3']
const layerLabelMap: Record<string, string> = {
  '1': '冲刺层',
  '2': '提升层',
  '3': '基础层'
}

const mockStatsData = ref<QuestionStat[]>([])
const isLoading = ref(false)

// 从后端加载统计数据
const fetchExerciseStats = async () => {
  isLoading.value = true
  
  // 如果没有 env prop，默认行为（可根据需要调整）
  const targetEnv = props.env || 'dev'

  if (targetEnv === ( 'mock' as any)) {
    setTimeout(() => {
      const targetQuestionIds = CLASSROOM_EXERCISE.questions.slice(0, 10).map(q => q.id)
      mockStatsData.value = targetQuestionIds.map((qId, idx) => {
        const originalQ = CLASSROOM_EXERCISE.questions.find(q => q.id === qId)!
        // 生成模拟的正确率
        const mockAccuracy = Math.floor(Math.random() * 40) + 60; // 60-100%
        
        return {
          index: idx + 1,
          questionId: qId,
          bmNo: originalQ.bmNo,
          title: originalQ.title,
          options: originalQ.structuredContent?.options || [
            { label: '对', text: '对' },
            { label: '错', text: '错' }
          ],
          type: originalQ.type as any,
          classAccuracy: mockAccuracy,
          submitCount: 45,
          layerStats: {
            '1': { accuracy: Math.min(100, mockAccuracy + 15), correctCount: 15, totalCount: 15, optionDist: [] },
            '2': { accuracy: mockAccuracy, correctCount: 12, totalCount: 15, optionDist: [] },
            '3': { accuracy: Math.max(0, mockAccuracy - 15), correctCount: 8, totalCount: 15, optionDist: [] }
          }
        }
      })
      isLoading.value = false
    }, 500)
    return
  }

  try {
    const filterDate = props.date || new Date().toISOString().split('T')[0]
    
    // 强制只展示 CLASSROOM_EXERCISE 的前10道题，并保持顺序
    const targetQuestionIds = CLASSROOM_EXERCISE.questions.slice(0, 10).map(q => q.id)
    const questionIdsParam = targetQuestionIds.join(',')

    const baseUrl = targetEnv === 'dev' 
      ? 'http://localhost:36565' 
      : ADDRESS_CATALOG.OPEN_CLASS_API

    const response = await fetch(`${baseUrl}/api/exercise/stats/batch?lessonId=L123&questionIds=${questionIdsParam}&date=${filterDate}`)
    const result = await response.json()
    
    if (result.success) {
      // 按照 targetQuestionIds 的顺序映射数据
      mockStatsData.value = targetQuestionIds.map((qId, idx) => {
        const item = result.data.find((d: any) => d.questionId === qId)
        const originalQ = CLASSROOM_EXERCISE.questions.find(q => q.id === qId)!
        
        return {
          index: idx + 1,
          questionId: qId,
          bmNo: originalQ.bmNo,
          title: originalQ.title,
          options: originalQ.structuredContent?.options || [
            { label: '对', text: '对' },
            { label: '错', text: '错' }
          ],
          type: originalQ.type as any,
          classAccuracy: item?.classAccuracy || 0,
          submitCount: item?.submitCount || 0,
          layerStats: item?.layerStats || {
            '1': { accuracy: 0, correctCount: 0, totalCount: 0, optionDist: [] },
            '2': { accuracy: 0, correctCount: 0, totalCount: 0, optionDist: [] },
            '3': { accuracy: 0, correctCount: 0, totalCount: 0, optionDist: [] }
          }
        }
      })
    }
  } catch (error) {
    console.error('[ExerciseStatsPanel] 加载失败:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchExerciseStats()
})

// 监听排序、日期、环境变化
watch(() => [props.currentSort, props.date, props.env], () => {
  fetchExerciseStats()
}, { deep: true })

const filteredAndSortedStats = computed(() => {
  let result = [...mockStatsData.value]

  // 1. 筛选
  if (props.currentFilter !== 'all') {
    result = result.filter(item => item.type === props.currentFilter)
  }

  // 2. 排序
  result.sort((a, b) => {
    const order = sortOrder.value === 'asc' ? 1 : -1
    if (props.currentSort === 'index') {
      return (a.index - b.index) * order
    } else if (props.currentSort === 'accuracy') {
      return (a.classAccuracy - b.classAccuracy) * order
    } else if (props.currentSort === 'count') {
      return (a.submitCount - b.submitCount) * order
    }
    return 0
  })

  return result
})
</script>

<style lang="scss" scoped>
.question-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  width: 100%;
}

.question-stat-compact-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.2s;

  &:hover {
    border-color: #6e55ff;
    box-shadow: 0 4px 12px rgba(110, 85, 255, 0.08);
  }

  .card-main {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .q-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 48px;
    
    .q-index {
      font-weight: 800;
      font-size: 16px;
      color: #1e293b;
    }
    
    .q-type-tag {
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 4px;
      font-weight: 600;
      &.choice { background: #eff6ff; color: #3b82f6; }
      &.judgment { background: #f5f3ff; color: #8b5cf6; }
    }
  }

  .class-accuracy-minimal {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f8fafc;
    padding: 8px 12px;
    border-radius: 8px;

    .accuracy-bar-container {
      flex: 1;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      
      .accuracy-bar {
        height: 100%;
        transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
    }

    .accuracy-info {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 65px;
      justify-content: flex-end;

      .accuracy-val {
        font-size: 16px;
        font-weight: 800;
        color: #6e55ff;
        text-align: right;
      }
      
      .submit-count {
        font-size: 10px;
        font-weight: 600;
        color: #94a3b8;
        background: #f1f5f9;
        padding: 1px 4px;
        border-radius: 4px;
        min-width: 28px;
        text-align: center;
      }
    }
  }

  .detail-toggle-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #94a3b8;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.2s;
    
    &:hover {
      background: #f1f5f9;
      color: #64748b;
    }

    span {
      font-size: 10px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .arrow-icon {
      transition: transform 0.3s;
      &.is-rotated {
        transform: rotate(180deg);
      }
    }
  }

  .card-details {
    padding: 12px 16px;
    background: #fcfcfd;
    border-top: 1px solid #f1f5f9;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .layer-row {
      display: flex;
      align-items: center;
      gap: 8px;

      .layer-info {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 60px;
        
        .layer-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .layer-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }
      }

      .layer-bar-wrapper {
        flex: 1;
        height: 4px;
        background: #f1f5f9;
        border-radius: 2px;
        overflow: hidden;
        
        .layer-bar-fill {
          height: 100%;
        }
      }

      .layer-stats-info {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 65px;
        justify-content: flex-end;

        .layer-val {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-align: right;
        }

        .layer-count {
          font-size: 9px;
          font-weight: 600;
          color: #94a3b8;
          background: #f1f5f9;
          padding: 1px 4px;
          border-radius: 4px;
          min-width: 28px;
          text-align: center;
        }
      }
    }
  }
}

.stats-fullscreen-content {
  padding: 24px;
  background: #f8fafc;
  height: 100%;
  overflow-y: auto;
}

.stats-container {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
}

.stats-controls-row {
  display: flex;
  align-items: center;
  gap: 24px;
  background: white;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;

  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;

    .control-label {
      font-size: 13px;
      font-weight: 700;
      color: #64748b;
    }

    .btn-toggle {
      display: flex;
      background: #f1f5f9;
      padding: 2px;
      border-radius: 8px;
      gap: 2px;

      .toggle-btn {
        border: none;
        background: transparent;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          color: #1e293b;
        }

        &.active {
          background: white;
          color: #6e55ff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
      }
    }
  }
}
</style>
