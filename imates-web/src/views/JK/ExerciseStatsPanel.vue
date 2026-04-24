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
              @click="emit('update:currentSort', opt.value)"
            >
              {{ opt.label }}
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

      <div class="question-stats-list">
        <div 
          v-for="stat in filteredAndSortedStats" 
          :key="stat.questionId" 
          class="question-stat-card"
        >
          <div class="card-left-panel">
            <div class="question-header">
              <div class="q-title-row">
                <span class="q-index">题{{ stat.index }}</span>
                <span class="q-type-tag" :class="stat.type">{{ stat.type === 'choice' ? '选择' : '判断' }}</span>
              </div>
              <span class="q-id">{{ stat.bmNo }}</span>
            </div>

            <!-- 题目内容展示 -->
            <div class="question-content q-mb-md">
              <div class="q-title">{{ stat.title }}</div>
              
              <!-- 选择题/判断题选项展示 -->
              <div v-if="(stat.type === 'choice' || stat.type === 'judgment') && stat.options" class="q-options-list q-mt-sm">
                <div 
                  v-for="opt in stat.options" 
                  :key="opt.label"
                  class="q-option-item"
                  :class="{ 'is-correct': opt.label === getCorrectAnswerLabel(stat) }"
                >
                  <span class="opt-label">{{ opt.label === '对' || opt.label === '错' ? '' : opt.label + '.' }}</span>
                  <span class="opt-text">{{ opt.text }}</span>
                </div>
              </div>
            </div>

            <!-- 全班正确率展示 -->
            <div class="class-accuracy-section">
              <div class="class-info-header">
                <div class="class-label">全班正确率</div>
                <div class="submit-count">提交人数: <span>{{ stat.submitCount }}</span></div>
              </div>
              <div class="class-bar-container">
                <div 
                  class="class-bar" 
                  :style="{ 
                    width: stat.classAccuracy + '%',
                    backgroundColor: '#6e55ff'
                  }"
                ></div>
                <span class="class-val">{{ stat.classAccuracy }}%</span>
              </div>
            </div>
          </div>
          
          <div class="card-right-panel">
            <div class="layer-stats-accordion">
              <div class="accordion-title">分层作答正确率</div>
              <div 
                v-for="layer in layers" 
                :key="layer" 
                class="accordion-item"
                :class="{ 
                  'is-expanded': expandedLayerKey === `${stat.questionId}-${layer}`
                }"
              >
                <!-- 手琴头部 -->
                <div 
                  class="accordion-header"
                  @click="toggleLayerDetail(stat.questionId, layer)"
                >
                  <div class="header-left">
                    <div class="layer-dot" :style="{ backgroundColor: getLayerColor(layer) }"></div>
                    <span class="layer-label">{{ layerLabelMap[layer] }}</span>
                  </div>
                  
                  <div class="header-center">
                    <div class="mini-bar-bg">
                      <div 
                        class="mini-bar-fill" 
                        :style="{ 
                          width: stat.layerStats[layer].accuracy + '%',
                          backgroundColor: getBarColor(stat.layerStats[layer].accuracy)
                        }"
                      ></div>
                    </div>
                    <span class="accuracy-val">{{ stat.layerStats[layer].accuracy }}%</span>
                  </div>

                  <div class="header-right">
                    <q-icon 
                      name="keyboard_arrow_down" 
                      size="20px"
                      class="arrow-icon"
                    />
                  </div>
                </div>

                <!-- 手风琴内容 (选项分布) -->
                <div class="accordion-content">
                  <div class="dist-header">
                    <span>选项分布统计</span>
                    <span class="correct-ans">正确答案: {{ getCorrectAnswer(stat.questionId) }}</span>
                  </div>
                  
                  <div 
                    v-for="opt in stat.layerStats[layer].optionDist" 
                    :key="opt.label"
                    class="opt-row"
                    :class="{ 'is-correct': opt.label === getCorrectAnswerLabel(stat) }"
                  >
                    <div class="opt-id">{{ opt.label }}</div>
                    <div class="opt-bar-wrapper">
                      <div 
                        class="opt-bar-fill" 
                        :style="{ 
                          width: opt.percent + '%',
                          backgroundColor: opt.label === getCorrectAnswerLabel(stat) ? '#10b981' : '#e2e8f0'
                        }"
                      ></div>
                    </div>
                    <div class="opt-stats">
                      <span class="p">{{ opt.percent }}%</span>
                      <span class="c">{{ opt.count }}人</span>
                    </div>
                  </div>
                </div>
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
}>()

const emit = defineEmits<{
  (e: 'update:currentSort', value: string): void
  (e: 'update:currentFilter', value: string): void
}>()

// --- 配置项 ---
const sortOptions = [
  { label: '题号顺序', value: 'index' },
  { label: '正确率低→高', value: 'accuracy-asc' },
  { label: '正确率高→低', value: 'accuracy-desc' }
]

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
  try {
    const filterDate = props.date || new Date().toISOString().split('T')[0]
    const sortParam = props.currentSort === 'accuracy-asc' ? 'accuracy_asc' : props.currentSort === 'accuracy-desc' ? 'accuracy_desc' : 'index'
    const response = await fetch(`${ADDRESS_CATALOG.OPEN_CLASS_API}/api/exercise/stats?lessonId=L123&sort=${sortParam}&date=${filterDate}`)
    const result = await response.json()
    if (result.success) {
      // 将后端模拟数据映射到前端展示格式
      mockStatsData.value = result.data.map((item: any, idx: number) => {
        const originalQ = CLASSROOM_EXERCISE.questions.find(q => q.id === item.questionId) || CLASSROOM_EXERCISE.questions[0]
        return {
          index: idx + 1,
          questionId: item.questionId,
          bmNo: originalQ.bmNo,
          title: originalQ.title,
          options: originalQ.structuredContent?.options || [
            { label: '对', text: '对' },
            { label: '错', text: '错' }
          ],
          type: originalQ.type as any,
          classAccuracy: item.classAccuracy,
          submitCount: item.submitCount || 0,
          layerStats: item.layerStats // 直接使用后端的真实计算结果
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

// 监听排序和日期变化
watch(() => [props.currentSort, props.date], () => {
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
    if (props.currentSort === 'index') {
      return a.index - b.index
    } else if (props.currentSort === 'accuracy-asc') {
      return a.classAccuracy - b.classAccuracy
    } else if (props.currentSort === 'accuracy-desc') {
      return b.classAccuracy - a.classAccuracy
    }
    return 0
  })

  return result
})
</script>

<style lang="scss" scoped>
.stats-fullscreen-content {
  padding: 40px 24px;
  background: #f8fafc;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stats-container {
  width: 100%;
  max-width: 1200px;
}

.stats-controls-row {
  display: flex;
  align-items: center;
  gap: 32px;
  background: white;
  padding: 16px 24px;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);

  .control-group {
    display: flex;
    align-items: center;
    gap: 12px;

    .control-label {
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
    }

    .btn-toggle {
      display: flex;
      background: #f1f5f9;
      padding: 4px;
      border-radius: 10px;
      gap: 4px;

      .toggle-btn {
        border: none;
        background: transparent;
        padding: 6px 14px;
        border-radius: 7px;
        font-size: 13px;
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
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
      }
    }
  }
}

.stats-summary {
  background: white;
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  margin-bottom: 24px;
  
  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .label { font-size: 14px; font-weight: 600; color: #64748b; }
    .value {
      font-weight: 800; font-size: 16px;
      &.layer-1 { color: #475569; }
      &.layer-2 { color: #64748b; }
      &.layer-3 { color: #94a3b8; }
    }
  }
}

.question-stats-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  padding-bottom: 40px;
}

.question-stat-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  display: flex;
  flex-direction: column; // 纵向排列以适应窄列
  overflow: hidden;

  &:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  }

  .card-left-panel {
    padding: 24px;
    border-right: none;
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;
    display: flex;
    flex-direction: column;
  }

  .card-right-panel {
    padding: 24px;
    background: #fcfcfd;
  }

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    .q-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      
      .q-index { font-weight: 800; color: #1e293b; font-size: 18px; }
      .q-type-tag {
        font-size: 12px; padding: 2px 8px; border-radius: 6px; font-weight: 600;
        &.choice { background: #eff6ff; color: #3b82f6; }
        &.judgment { background: #f5f3ff; color: #8b5cf6; }
      }
    }
    .q-id { color: #94a3b8; font-size: 12px; font-family: monospace; }
  }

  .question-content {
    font-size: 15px;
    line-height: 1.6;
    color: #334155;
    background: #f8fafc;
    padding: 12px 16px;
    border-radius: 8px;
    border-left: 4px solid #e2e8f0;
    word-break: break-all;

    .q-title {
      font-weight: 600;
    }

    .q-options-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      
      .q-option-item {
        display: flex;
        gap: 8px;
        font-size: 14px;
        color: #64748b;
        padding: 4px 8px;
        border-radius: 4px;

        &.is-correct {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          font-weight: 700;
        }

        .opt-label {
          flex-shrink: 0;
        }
      }
    }
  }
}

.class-accuracy-section {
  background: #f5f3ff;
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid #ddd6fe;
  
  .class-info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;

    .class-label {
      font-size: 13px;
      font-weight: 700;
      color: #6e55ff;
    }

    .submit-count {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 600;
      span {
        color: #6e55ff;
        font-weight: 800;
        margin-left: 2px;
      }
    }
  }

  .class-bar-container {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .class-bar {
      flex: 1;
      height: 10px;
      border-radius: 5px;
      transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .class-val {
      font-size: 18px;
      font-weight: 900;
      color: #6e55ff;
      width: 50px;
      text-align: right;
    }
  }
}

.layer-stats-accordion {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .accordion-title {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    margin: 0 0 8px 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .accordion-item {
    border: 1px solid #f1f5f9;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &.is-expanded {
      border-color: #e2e8f0;
      background: #fcfcfd;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
      
      .accordion-header {
        background: #f8fafc;
        .arrow-icon {
          transform: rotate(180deg);
        }
      }
      
      .accordion-content {
        max-height: 800px;
        opacity: 1;
        padding: 20px;
      }
    }
  }

  .accordion-header {
    height: 52px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    background: white;
    transition: background 0.2s;

    &:hover {
      background: #f8fafc;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100px;
      
      .layer-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .layer-label {
        font-size: 14px;
        font-weight: 700;
        color: #475569;
      }
    }

    .header-center {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 12px;

      .mini-bar-bg {
        flex: 1;
        height: 8px;
        background: #f1f5f9;
        border-radius: 4px;
        overflow: hidden;
        
        .mini-bar-fill {
          height: 100%;
          transition: width 0.6s ease;
        }
      }
      
      .accuracy-val {
        font-size: 14px;
        font-weight: 800;
        color: #1e293b;
        width: 45px;
        text-align: right;
      }
    }

    .header-right {
      .arrow-icon {
        color: #94a3b8;
        transition: transform 0.3s;
      }
    }
  }

  .accordion-content {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    background: white;
    padding: 0 20px;
    border-top: 1px solid #f8fafc;

    .dist-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #f1f5f9;
      
      .correct-ans {
        color: #10b981;
      }
    }

    .opt-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 12px;
      
      &:last-child {
        margin-bottom: 4px;
      }

      &.is-correct {
        .opt-id { color: #10b981; }
      }

      .opt-id {
        width: 20px;
        font-size: 14px;
        font-weight: 800;
        color: #64748b;
      }

      .opt-bar-wrapper {
        flex: 1;
        height: 6px;
        background: #f8fafc;
        border-radius: 3px;
        overflow: hidden;
        
        .opt-bar-fill {
          height: 100%;
          transition: width 0.5s;
        }
      }

      .opt-stats {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        width: 50px;
        
        .p {
          font-size: 12px;
          font-weight: 800;
          color: #475569;
          line-height: 1.2;
        }
        .c {
          font-size: 10px;
          color: #94a3b8;
        }
      }
    }
  }
}
</style>
