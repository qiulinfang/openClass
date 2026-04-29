<template>
  <div class="class-layer-stats-wrapper">
    <div class="stats-content">
      <!-- 顶部概览：突出百分比 -->
      <div class="dashboard-header q-mb-xl">
        <div 
          v-for="layer in layerSummary" 
          :key="layer.id" 
          class="metric-card-vertical"
          :style="{ borderTop: `4px solid ${layer.color}` }"
        >
          <div class="metric-percent" :style="{ color: layer.color }">{{ layer.percent }}%</div>
          <div class="metric-label">{{ layer.name }}</div>
          <div class="metric-value">{{ layer.count }}<span class="unit">人</span></div>
        </div>
      </div>

      <!-- 详细名单：手风琴模式 (原生实现) -->
      <div class="layers-accordion">
        <div 
          v-for="layer in layerDetails" 
          :key="layer.id" 
          class="accordion-item-native"
          :class="{ active: expandedLayerIds.includes(layer.id) }"
        >
          <div class="accordion-header-native" @click="toggleLayer(layer.id)">
            <div class="header-left">
              <div class="layer-dot" :style="{ backgroundColor: layer.color }"></div>
              <span class="layer-name">{{ layer.name }}</span>
              <span class="layer-count">{{ layer.students.length }}人</span>
            </div>
            <div class="expand-icon" :class="{ rotated: expandedLayerIds.includes(layer.id) }">
              <q-icon name="keyboard_arrow_down" size="24px" color="grey-6" />
            </div>
          </div>
          
          <div 
            class="accordion-content-wrapper" 
            :style="{ 
              gridTemplateRows: expandedLayerIds.includes(layer.id) ? '1fr' : '0fr',
              opacity: expandedLayerIds.includes(layer.id) ? 1 : 0
            }"
          >
            <div class="accordion-content-inner">
              <div class="student-grid">
                <div 
                  v-for="student in layer.students" 
                  :key="student.id"
                  class="student-item-mini"
                >
                  <div class="avatar">{{ student.id.charAt(0).toUpperCase() }}</div>
                  <span class="name">{{ student.id }}</span>
                </div>
              </div>
              <div v-if="layer.students.length === 0" class="empty-state">
                暂无学生
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
  name: 'ClassLayerStatsPanel'
}
</script>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { ADDRESS_CATALOG } from '@/config/env-config'

// 班级分层数据接口
interface Student {
  id: string
  name: string
}

interface LayerInfo {
  id: string
  name: string
  color: string
  students: Student[]
}

const props = defineProps<{
  previewResults: any[] // 课前预习结果（Mock）
  date?: string // 外部传入的过滤日期
  env?: 'dev' | 'prod'
}>()

// 控制三列的手风琴状态，默认全部收起
const expandedLayerIds = ref<string[]>([])
const layerDetails = ref<LayerInfo[]>([])
const isLoading = ref(false)

const toggleLayer = (id: string) => {
  const index = expandedLayerIds.value.indexOf(id)
  if (index > -1) {
    expandedLayerIds.value.splice(index, 1)
  } else {
    expandedLayerIds.value.push(id)
  }
}

// --- 配置项 ---
type EnvType = 'mock' | 'dev' | 'prod'
const currentEnv = ref<EnvType>('prod') // 可在此处切换环境: 'mock', 'dev', 'prod'

// 从后端加载数据
const fetchLayerStats = async () => {
  isLoading.value = true
  try {
    const filterDate = props.date || new Date().toISOString().split('T')[0]
    
    // 优先使用内部的 currentEnv，如果是 mock 则返回 mock 数据
    if (currentEnv.value === 'mock') {
      setTimeout(() => {
        layerDetails.value = [
          { id: 'A', name: '冲刺层', color: '#6e55ff', students: [] },
          { id: 'B', name: '提升层', color: '#10b981', students: [] },
          { id: 'C', name: '基础层', color: '#f59e0b', students: [] },
          { id: 'D', name: '待提升', color: '#94a3b8', students: [] }
        ]
        isLoading.value = false
      }, 500)
      return
    }

    const baseUrl = currentEnv.value === 'prod' 
      ? ADDRESS_CATALOG.OPEN_CLASS_API 
      : 'http://localhost:36565'

    const response = await fetch(`${baseUrl}/api/homework/layer-stats?homeworkId=H123&date=${filterDate}`)
    const result = await response.json()
    if (result.success) {
      // 转换后端数据到前端视图模型
      const colors = ['#6e55ff', '#10b981', '#f59e0b', '#94a3b8']
      layerDetails.value = result.data.layers.map((layer: any, index: number) => ({
        id: layer.level,
        name: layer.level === 'A' ? '冲刺层' : layer.level === 'B' ? '提升层' : layer.level === 'C' ? '基础层' : '待提升',
        color: colors[index] || '#64748b',
        students: layer.students.map((id: string) => ({ id, name: id.replace('S', '学生') }))
      }))
    }
  } catch (error) {
    console.error('[ClassLayerStatsPanel] 加载失败:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchLayerStats()
})

// 监听日期或环境变化并刷新
watch(() => [props.date, props.env], () => {
  fetchLayerStats()
})

const layerSummary = computed(() => {
  const total = layerDetails.value.reduce((acc, layer) => acc + layer.students.length, 0)
  return layerDetails.value.map(layer => ({
    id: layer.id,
    name: layer.name,
    count: layer.students.length,
    percent: total > 0 ? Math.round((layer.students.length / total) * 100) : 0,
    color: layer.color
  }))
})
</script>

<style lang="scss" scoped>
.class-layer-stats-wrapper {
  padding: 24px;
  background: #f8fafc;
  height: 100%;
  overflow-y: auto;
}

.stats-content {
  max-width: 1200px;
  margin: 0 auto;
}

/* 顶部指标卡片 - 突出百分比 */
.dashboard-header {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.metric-card-vertical {
  background: white;
  padding: 32px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-4px);
  }

  .metric-percent {
    font-size: 48px;
    font-weight: 900;
    font-family: 'Din Alternate', sans-serif;
    line-height: 1;
    margin-bottom: 8px;
  }

  .metric-label {
    font-size: 16px;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 4px;
  }

  .metric-value {
    font-size: 20px;
    font-weight: 800;
    color: #1e293b;
    
    .unit {
      font-size: 14px;
      font-weight: 600;
      margin-left: 4px;
      color: #94a3b8;
    }
  }
}

/* 手风琴列表优化 - 原生 CSS Grid 动画提升性能 */
.layers-accordion {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.accordion-item-native {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.3s ease;

  &.active {
    border-color: #6e55ff30;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  }
}

.accordion-header-native {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  background: white;
  user-select: none;

  &:hover {
    background: #fcfcfd;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .layer-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .layer-name {
      font-weight: 800;
      font-size: 18px;
      color: #1e293b;
    }

    .layer-count {
      font-size: 13px;
      font-weight: 700;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 2px 10px;
      border-radius: 20px;
    }
  }

  .expand-icon {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    
    &.rotated {
      transform: rotate(180deg);
    }
  }
}

/* 使用 CSS Grid 实现平滑高度动画 */
.accordion-content-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease, opacity 0.3s ease;
  background: #fcfcfd;
}

.accordion-content-inner {
  overflow: hidden;
}

.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  padding: 0 24px 24px;
  /* 开启 GPU 加速 */
  transform: translateZ(0);
}

.student-item-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  contain: content;
  
  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
    color: #64748b;
  }

  .name {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
  }
}

.empty-state {
  padding: 0 24px 32px;
  text-align: center;
  color: #cbd5e1;
  font-size: 14px;
}
</style>
