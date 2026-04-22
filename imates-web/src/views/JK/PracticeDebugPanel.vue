<template>
  <div class="practice-debug-panel" :class="{ 'is-collapsed': isCollapsed }">
    <div class="panel-header" @click="isCollapsed = !isCollapsed">
      <div class="header-title">
        <q-icon name="analytics" size="20px" />
        <span>作答情况统计 (Debug)</span>
      </div>
      <q-btn
        flat
        round
        dense
        :icon="isCollapsed ? 'expand_less' : 'expand_more'"
        size="sm"
      />
    </div>

    <div class="panel-content" v-if="!isCollapsed">
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
          :class="{ 'needs-review': getMinAccuracy(stat) < 60 }"
        >
          <div class="question-header">
            <div class="q-title-row">
              <span class="q-index">题{{ stat.index }}</span>
              <span class="q-type-tag" :class="stat.type">{{ stat.type === 'choice' ? '选择' : '判断' }}</span>
              <q-badge v-if="getMinAccuracy(stat) < 60" color="red" label="需讲评" pulse />
            </div>
            <span class="q-id">{{ stat.bmNo }}</span>
          </div>
          
          <div class="layer-stats-grid">
            <div 
              v-for="layer in layers" 
              :key="layer" 
              class="layer-stat-container"
            >
              <div 
                class="layer-stat-item"
                :class="{ 
                  'is-current': mockStudentInfo.layer === layer,
                  'is-expanded': expandedLayerKey === `${stat.questionId}-${layer}`
                }"
                @click="toggleLayerDetail(stat.questionId, layer)"
              >
                <div class="layer-name-cell">
                  <div class="layer-dot" :style="{ backgroundColor: getLayerColor(layer) }"></div>
                  <span>{{ layerLabelMap[layer] }}</span>
                </div>
                <div class="accuracy-bar-container">
                  <div 
                    class="accuracy-bar" 
                    :style="{ 
                      width: stat.layerStats[layer].accuracy + '%',
                      backgroundColor: getBarColor(stat.layerStats[layer].accuracy)
                    }"
                  ></div>
                </div>
                <div class="accuracy-text-cell">
                  <span class="val">{{ stat.layerStats[layer].accuracy }}%</span>
                  <q-icon 
                    :name="expandedLayerKey === `${stat.questionId}-${layer}` ? 'keyboard_arrow_up' : 'keyboard_arrow_down'" 
                    size="16px"
                  />
                </div>
              </div>

              <!-- 选项分布详情 (教师诊断视角) -->
              <transition name="fade">
                <div 
                  v-if="expandedLayerKey === `${stat.questionId}-${layer}`" 
                  class="option-dist-detail"
                >
                  <div class="dist-header">
                    <span>选项分布</span>
                    <span class="correct-hint">正确答案: {{ getCorrectAnswer(stat.questionId) }}</span>
                  </div>
                  <div 
                    v-for="opt in stat.layerStats[layer].optionDist" 
                    :key="opt.label"
                    class="opt-item"
                    :class="{ 
                      'is-correct-opt': opt.label === getCorrectAnswer(stat.questionId),
                      'is-common-error': opt.label !== getCorrectAnswer(stat.questionId) && opt.percent > 30
                    }"
                  >
                    <div class="opt-info">
                      <span class="opt-label">{{ opt.label }}</span>
                      <q-icon v-if="opt.label === getCorrectAnswer(stat.questionId)" name="check" color="positive" size="12px" />
                    </div>
                    <div class="opt-bar-bg">
                      <div 
                        class="opt-bar-fill" 
                        :style="{ 
                          width: opt.percent + '%',
                          backgroundColor: getOptBarColor(opt.label, stat.questionId, opt.percent)
                        }"
                      ></div>
                    </div>
                    <div class="opt-data">
                      <span class="p">{{ opt.percent }}%</span>
                      <span class="c">{{ opt.count }}人</span>
                    </div>
                  </div>
                </div>
              </transition>
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
  layerStats: Record<string, LayerStat>
}

const isCollapsed = ref(false)
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
  const colors: any = { '1': '#ef4444', '2': '#f59e0b', '3': '#3b82f6' }
  return colors[layer]
}

const getOptBarColor = (label: string, questionId: string, percent: number) => {
  const correct = getCorrectAnswer(questionId)
  if (label === correct) return '#10b981' // 正确选项绿色
  if (percent > 30) return '#ef4444' // 高频错误选项红色
  return '#cbd5e1' // 普通错误选项灰色
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
  if (accuracy >= 85) return '#10b981'
  if (accuracy >= 60) return '#6e55ff'
  return '#f59e0b'
}
</script>

<style scoped lang="scss">
.practice-debug-panel {
  position: fixed;
  right: 20px;
  top: 80px;
  width: 340px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  min-height: 0;
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-collapsed {
    height: 48px;
    overflow: hidden;
    width: 200px;
  }
}

.panel-header {
  padding: 0 16px;
  height: 48px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  border-radius: 12px 12px 0 0;

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    color: #334155;
    font-size: 14px;
  }
}

.panel-content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  background: #fdfdfd;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
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

  &.needs-review {
    border-color: #fee2e2;
    background: #fffafa;
  }

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

.layer-stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 2px;

  &:hover { background: #f1f5f9; }
  &.is-current { background: #f8fafc; border: 1px solid #6e55ff; }
  &.is-expanded { background: #f1f5f9; }

  .layer-name-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 60px;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
    .layer-dot { width: 6px; height: 6px; border-radius: 50%; }
  }

  .accuracy-bar-container {
    flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;
    .accuracy-bar { height: 100%; transition: width 0.6s ease; }
  }

  .accuracy-text-cell {
    width: 65px; display: flex; align-items: center; justify-content: flex-end; gap: 4px;
    .val { font-size: 13px; font-weight: 700; color: #1e293b; }
  }
}

.option-dist-detail {
  margin: 6px 4px 10px 40px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  border: 1px solid #f1f5f9;

  .dist-header {
    display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;
    color: #94a3b8; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px dashed #f1f5f9;
    .correct-hint { color: #10b981; }
  }

  .opt-item {
    display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
    
    &:last-child { margin-bottom: 0; }
    &.is-correct-opt .opt-label { color: #10b981; }
    &.is-common-error .opt-label { color: #ef4444; }

    .opt-info {
      width: 24px; display: flex; align-items: center; gap: 2px;
      .opt-label { font-size: 12px; font-weight: 700; color: #64748b; }
    }

    .opt-bar-bg {
      flex: 1; height: 5px; background: #f8fafc; border-radius: 3px; overflow: hidden;
      .opt-bar-fill { height: 100%; transition: width 0.5s; }
    }

    .opt-data {
      display: flex; flex-direction: column; align-items: flex-end; width: 45px;
      .p { font-size: 11px; font-weight: 700; color: #475569; line-height: 1; }
      .c { font-size: 9px; color: #94a3b8; }
    }
  }
}

.fade-enter-active, .fade-leave-active { transition: all 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateX(10px); }
</style>
