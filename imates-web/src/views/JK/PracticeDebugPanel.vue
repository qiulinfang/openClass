<template>
  <div class="stats-container">
    <div class="stats-summary q-mb-md">
      <div class="summary-item">
        <div class="label">当前学生层次</div>
        <div class="value" :class="'layer-' + mockStudentInfo.layer">
          {{ layerLabelMap[mockStudentInfo.layer] }}
        </div>
      </div>
    </div>

    <div class="question-stats-list">
      <div 
        v-for="stat in mockStatsData" 
        :key="stat.questionId" 
        class="question-stat-card"
      >
        <div class="question-header">
          <div class="q-title-row">
            <span class="q-index">题{{ stat.index }}</span>
            <span class="q-type-tag" :class="stat.type">{{ stat.type === 'choice' ? '选择' : '判断' }}</span>
          </div>
          <span class="q-id">{{ stat.bmNo }}</span>
        </div>

        <!-- 全班正确率展示 -->
        <div class="class-accuracy-section q-mb-md">
          <div class="class-label">全班正确率</div>
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
        
        <div class="layer-stats-accordion">
          <div class="accordion-title">分层作答详情</div>
          <div 
            v-for="layer in layers" 
            :key="layer" 
            class="accordion-item"
            :class="{ 
              'is-expanded': expandedLayerKey === `${stat.questionId}-${layer}`
            }"
          >
            <!-- 手风琴头部 -->
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
                :class="{ 'is-correct': opt.label === getCorrectAnswer(stat.questionId) }"
              >
                <div class="opt-id">{{ opt.label }}</div>
                <div class="opt-bar-wrapper">
                  <div 
                    class="opt-bar-fill" 
                    :style="{ 
                      width: opt.percent + '%',
                      backgroundColor: opt.label === getCorrectAnswer(stat.questionId) ? '#10b981' : '#e2e8f0'
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CLASSROOM_EXERCISE } from '@/mocks/negativeNumbers'

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
  type: 'choice' | 'judgment'
  classAccuracy: number // 新增：全班正确率
  layerStats: Record<string, LayerStat>
}

const expandedLayerKey = ref<string | null>(null)

const layers = ['1', '2', '3']
const layerLabelMap: Record<string, string> = {
  '1': '冲刺层',
  '2': '提升层',
  '3': '基础层'
}

const getCorrectAnswer = (questionId: string) => {
  const q = CLASSROOM_EXERCISE.questions.find(item => item.id === questionId)
  return q?.answer || ''
}

const getMinAccuracy = (stat: QuestionStat) => {
  return Math.min(...Object.values(stat.layerStats).map(s => s.accuracy))
}

const getLayerColor = (layer: string) => {
  const colors: any = { '1': '#475569', '2': '#64748b', '3': '#94a3b8' }
  return colors[layer]
}

const toggleLayerDetail = (questionId: string, layer: string) => {
  const key = `${questionId}-${layer}`
  expandedLayerKey.value = expandedLayerKey.value === key ? null : key
}

// Mock 当前学生信息
const mockStudentInfo = {
  name: '张同学',
  layer: '2'
}

// Mock 统计数据
const mockStatsData = ref<QuestionStat[]>([
  {
    index: 1,
    questionId: 'exe-base-sel-1',
    bmNo: 'EXE_BASE_SEL_001',
    type: 'choice',
    classAccuracy: 78, // 全班正确率
    layerStats: {
      '1': { 
        accuracy: 95, correctCount: 19, totalCount: 20,
        optionDist: [
          { label: 'A', count: 0, percent: 0 },
          { label: 'B', count: 1, percent: 5 },
          { label: 'C', count: 19, percent: 95 },
          { label: 'D', count: 0, percent: 0 }
        ]
      },
      '2': { 
        accuracy: 82, correctCount: 41, totalCount: 50,
        optionDist: [
          { label: 'A', count: 2, percent: 4 },
          { label: 'B', count: 5, percent: 10 },
          { label: 'C', count: 41, percent: 82 },
          { label: 'D', count: 2, percent: 4 }
        ]
      },
      '3': { 
        accuracy: 65, correctCount: 65, totalCount: 100,
        optionDist: [
          { label: 'A', count: 10, percent: 10 },
          { label: 'B', count: 15, percent: 15 },
          { label: 'C', count: 65, percent: 65 },
          { label: 'D', count: 10, percent: 10 }
        ]
      }
    }
  },
  {
    index: 2,
    questionId: 'exe-base-jud-1',
    bmNo: 'EXE_BASE_JUD_001',
    type: 'judgment',
    classAccuracy: 62, // 全班正确率
    layerStats: {
      '1': { 
        accuracy: 90, correctCount: 18, totalCount: 20,
        optionDist: [
          { label: '对', count: 2, percent: 10 },
          { label: '错', count: 18, percent: 90 }
        ]
      },
      '2': { 
        accuracy: 55, correctCount: 27, totalCount: 50,
        optionDist: [
          { label: '对', count: 23, percent: 46 },
          { label: '错', count: 27, percent: 54 }
        ]
      },
      '3': { 
        accuracy: 42, correctCount: 42, totalCount: 100,
        optionDist: [
          { label: '对', count: 58, percent: 58 },
          { label: '错', count: 42, percent: 42 }
        ]
      }
    }
  }
])

const getBarColor = (accuracy: number) => {
  return '#6e55ff' // 统一使用主题紫，不进行颜色评价
}
</script>

<style scoped lang="scss">
.stats-container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.stats-summary {
  background: white;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  
  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .label { font-size: 12px; color: #64748b; }
    .value {
      font-weight: 700; font-size: 14px;
      &.layer-1 { color: #ef4444; }
      &.layer-2 { color: #f59e0b; }
      &.layer-3 { color: #3b82f6; }
    }
  }
}

.question-stat-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 16px;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    
    .q-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .q-index { font-weight: 800; color: #1e293b; font-size: 15px; }
      .q-type-tag {
        font-size: 10px; padding: 1px 6px; border-radius: 4px;
        &.choice { background: #eff6ff; color: #3b82f6; }
        &.judgment { background: #f5f3ff; color: #8b5cf6; }
      }
    }
    .q-id { color: #94a3b8; font-size: 11px; font-family: monospace; }
  }
}

.class-accuracy-section {
  background: #f1f0ff;
  padding: 10px 12px;
  border-radius: 8px;
  
  .class-label {
    font-size: 11px;
    font-weight: 600;
    color: #6e55ff;
    margin-bottom: 6px;
  }

  .class-bar-container {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .class-bar {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      transition: width 0.6s ease;
    }
    
    .class-val {
      font-size: 14px;
      font-weight: 800;
      color: #6e55ff;
      width: 40px;
      text-align: right;
    }
  }
}

.layer-stats-accordion {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .accordion-title {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    margin: 8px 0 2px 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .accordion-item {
    border: 1px solid #f1f5f9;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &.is-expanded {
      border-color: #e2e8f0;
      background: #fcfcfd;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      
      .accordion-header .arrow-icon {
        transform: rotate(180deg);
      }
      
      .accordion-content {
        max-height: 500px;
        opacity: 1;
        padding: 12px;
      }
    }
  }

  .accordion-header {
    height: 44px;
    padding: 0 12px;
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
      gap: 8px;
      width: 80px;
      
      .layer-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .layer-label {
        font-size: 13px;
        font-weight: 600;
        color: #475569;
      }
    }

    .header-center {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 8px;

      .mini-bar-bg {
        flex: 1;
        height: 6px;
        background: #f1f5f9;
        border-radius: 3px;
        overflow: hidden;
        
        .mini-bar-fill {
          height: 100%;
          transition: width 0.6s ease;
        }
      }
      
      .accuracy-val {
        font-size: 12px;
        font-weight: 700;
        color: #1e293b;
        width: 38px;
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
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: white;
    padding: 0 12px;
    border-top: 1px solid #f8fafc;

    .dist-header {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #f1f5f9;
      
      .correct-ans {
        color: #10b981;
      }
    }

    .opt-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      
      &:last-child {
        margin-bottom: 4px;
      }

      &.is-correct {
        .opt-id { color: #10b981; }
      }

      .opt-id {
        width: 16px;
        font-size: 12px;
        font-weight: 700;
        color: #64748b;
      }

      .opt-bar-wrapper {
        flex: 1;
        height: 5px;
        background: #f8fafc;
        border-radius: 2.5px;
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
        width: 45px;
        
        .p {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          line-height: 1;
        }
        .c {
          font-size: 9px;
          color: #94a3b8;
        }
      }
    }
  }
}

.fade-enter-active, .fade-leave-active { transition: all 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateX(10px); }
</style>
