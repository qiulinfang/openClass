<template>
  <div class="jk-stats-dashboard">
    <!-- 顶部导航栏 -->
    <div class="stats-header">
      <div class="header-content">
        <div class="title-section">
          <q-icon name="analytics" size="32px" color="primary" />
          <h1 class="text-h5 text-weight-bold q-ma-none">课堂学情分析看板</h1>
        </div>
        
        <!-- Tab 切换 -->
        <div class="tab-navigator">
          <div 
            v-for="tab in tabs" 
            :key="tab.value"
            class="nav-item"
            :class="{ active: currentTab === tab.value }"
            @click="currentTab = tab.value"
          >
            <q-icon :name="tab.icon" size="20px" class="q-mr-sm" />
            {{ tab.label }}
          </div>
        </div>

        <div class="date-display">
          <q-btn flat round icon="chevron_left" @click="changeDate(-1)" />
          <DatePicker 
            v-model="selectedDate" 
            placeholder="选择日期"
            class="q-mx-sm"
          />
          <q-btn flat round icon="chevron_right" @click="changeDate(1)" />
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="stats-body">
      <transition name="fade" mode="out-in">
        <div :key="currentTab" class="content-container">
          <!-- 班级分层统计 -->
          <ClassLayerStatsPanel 
            v-if="currentTab === 'layer'" 
            :preview-results="[]"
            :date="selectedDate"
          />
          
          <!-- 课堂练习详情 -->
          <ExerciseStatsPanel 
            v-else-if="currentTab === 'exercise'" 
            v-model:current-sort="exerciseSort"
            v-model:current-filter="exerciseFilter"
            :date="selectedDate"
          />
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DatePicker from '@/components/base/DatePicker.vue'
import ClassLayerStatsPanel from './ClassLayerStatsPanel.vue'
import ExerciseStatsPanel from './ExerciseStatsPanel.vue'

const currentTab = ref('layer') // 'layer' | 'exercise'
const exerciseSort = ref('index')
const exerciseFilter = ref('all')

// 统一管理日期，初始化为今天
const selectedDate = ref(new Date().toISOString().split('T')[0])

const tabs = [
  { label: '班级分层结果', value: 'layer', icon: 'groups' },
  { label: '课堂练习统计', value: 'exercise', icon: 'assignment' }
]

const todayDate = computed(() => {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
})

const changeDate = (offset: number) => {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + offset)
  selectedDate.value = d.toISOString().split('T')[0]
}
</script>

<script lang="ts">
export default {
  name: 'JKStatsDashboard'
}
</script>

<style lang="scss" scoped>
.jk-stats-dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8fafc;
  overflow: hidden;
}

.stats-header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 24px;
  height: 72px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.header-content {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
  h1 {
    color: #1e293b;
    letter-spacing: -0.5px;
  }
}

.tab-navigator {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  gap: 4px;

  .nav-item {
    padding: 8px 24px;
    border-radius: 9px;
    font-size: 15px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;

    &:hover {
      color: #1e293b;
      background: rgba(255, 255, 255, 0.5);
    }

    &.active {
      background: white;
      color: #6e55ff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }
}

.stats-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.content-container {
  height: 100%;
  overflow: hidden;
}

/* 切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 深度选择器，确保子组件内部的 padding 不会冲突 */
:deep(.class-layer-stats-wrapper),
:deep(.stats-fullscreen-content) {
  padding-top: 24px !important;
  background: transparent !important;
}
</style>
