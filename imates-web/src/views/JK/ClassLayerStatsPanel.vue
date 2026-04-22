<template>
  <div class="class-layer-stats-wrapper">
    <div class="stats-content">
      <!-- 顶部概览卡片 -->
      <div class="overview-section q-mb-xl">
        <div class="overview-card">
          <div class="card-header">
            <q-icon name="groups" size="32px" color="primary" />
            <div class="header-text">
              <h3>班级分层结果概览</h3>
              <p>基于课前预习完成情况自动生成</p>
            </div>
          </div>
          <div class="stats-row">
            <div 
              v-for="layer in layerSummary" 
              :key="layer.id" 
              class="stat-item"
            >
              <div class="stat-value" :style="{ color: layer.color }">{{ layer.count }}<span>人</span></div>
              <div class="stat-label">{{ layer.name }}</div>
              <div class="stat-percent">{{ layer.percent }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部三列布局：展示每个层级的详细名单（带手风琴功能） -->
      <div class="layers-detail-grid">
        <div 
          v-for="layer in layerDetails" 
          :key="layer.id" 
          class="layer-detail-column"
          :class="{ 'is-expanded': expandedLayerIds.includes(layer.id) }"
          :style="{ borderTopColor: layer.color }"
        >
          <div class="column-header" @click="toggleLayer(layer.id)">
            <div class="title-info">
              <span class="l-name" :style="{ color: layer.color }">{{ layer.name }}</span>
              <div class="header-right">
                <span class="l-count">{{ layer.students.length }}人</span>
                <q-icon 
                  name="keyboard_arrow_down" 
                  size="20px" 
                  class="arrow-icon"
                />
              </div>
            </div>
          </div>
          <div class="student-list-wrapper">
            <div class="student-list">
              <div v-for="student in layer.students" :key="student.id" class="student-tag">
                <q-avatar size="28px" :style="{ backgroundColor: layer.color + '15', color: layer.color }">
                  {{ student.name.charAt(0) }}
                </q-avatar>
                <span class="student-name">{{ student.name }}</span>
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
import { computed, ref } from 'vue'

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
}>()

// 控制三列的手风琴状态，默认全部收起
const expandedLayerIds = ref<string[]>([])

const toggleLayer = (id: string) => {
  const index = expandedLayerIds.value.indexOf(id)
  if (index > -1) {
    expandedLayerIds.value.splice(index, 1)
  } else {
    expandedLayerIds.value.push(id)
  }
}

// 基于预习结果生成的 Mock 分层数据
const layerDetails = computed<LayerInfo[]>(() => [
  {
    id: '1',
    name: '冲刺层',
    color: '#6e55ff',
    students: [
      { id: 's1', name: '张三' },
      { id: 's2', name: '李四' },
      { id: 's3', name: '王五' },
      { id: 's4', name: '赵六' },
    ]
  },
  {
    id: '2',
    name: '提升层',
    color: '#10b981',
    students: [
      { id: 's5', name: '孙七' },
      { id: 's6', name: '周八' },
      { id: 's7', name: '吴九' },
      { id: 's8', name: '郑十' },
      { id: 's9', name: '陈十一' },
    ]
  },
  {
    id: '3',
    name: '基础层',
    color: '#f59e0b',
    students: [
      { id: 's10', name: '林十二' },
      { id: 's11', name: '黄十三' },
      { id: 's12', name: '朱十四' },
    ]
  }
])

const layerSummary = computed(() => {
  const total = layerDetails.value.reduce((acc, layer) => acc + layer.students.length, 0)
  return layerDetails.value.map(layer => ({
    id: layer.id,
    name: layer.name,
    count: layer.students.length,
    percent: Math.round((layer.students.length / total) * 100),
    color: layer.color
  }))
})
</script>

<style lang="scss" scoped>
.class-layer-stats-wrapper {
  padding: 40px 24px;
  background: #f8fafc;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stats-content {
  width: 100%;
  max-width: 1200px;
}

.overview-card {
  background: white;
  padding: 32px;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);

  .card-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
    
    h3 { margin: 0; font-size: 24px; font-weight: 800; color: #1e293b; }
    p { margin: 4px 0 0; color: #64748b; font-size: 14px; }
  }

  .stats-row {
    display: flex;
    justify-content: space-around;
    
    .stat-item {
      text-align: center;
      padding: 16px 32px;
      border-radius: 20px;
      transition: all 0.3s;
      position: relative;

      .stat-value {
        font-size: 42px;
        font-weight: 900;
        line-height: 1;
        span { font-size: 16px; margin-left: 4px; color: #94a3b8; }
      }
      .stat-label { margin-top: 8px; font-weight: 700; color: #475569; }
      .stat-percent { margin-top: 4px; font-size: 13px; color: #94a3b8; font-weight: 600; }
    }
  }
}

.layers-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: start;
}

.layer-detail-column {
  background: white;
  border-radius: 24px;
  border: 1px solid #e2e8f0;
  border-top: 6px solid #6e55ff;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  height: fit-content;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.is-expanded {
    .student-list-wrapper {
      max-height: 1000px;
      opacity: 1;
      margin-top: 20px;
    }
    .arrow-icon {
      transform: rotate(180deg);
    }
  }

  .column-header {
    cursor: pointer;
    user-select: none;
    
    .title-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .l-name { font-size: 18px; font-weight: 800; }
      
      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .l-count { font-size: 13px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; }
        .arrow-icon { color: #94a3b8; transition: transform 0.3s ease; }
      }
    }
  }

  .student-list-wrapper {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .student-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 8px;
  }

  .student-tag {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #f1f5f9;
    transition: all 0.2s;

    &:hover {
      transform: translateX(4px);
      background: white;
      border-color: #e2e8f0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }
    
    .student-name { font-size: 14px; font-weight: 600; color: #334155; }
  }
}
</style>
