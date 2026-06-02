<template>
  <div v-if="visible" class="drag-debug-panel" @click.stop>
    <div class="debug-header">
      <span class="debug-title">拖动调试面板</span>
      <button class="debug-btn" type="button" @click.stop="emit('update:visible', false)">×</button>
    </div>

    <!-- 拖动状态显示 -->
    <div class="debug-section">
      <div class="debug-section-title">拖动状态</div>
      <div class="debug-grid">
        <div class="debug-row">
          <label class="debug-label">拖动中</label>
          <span class="debug-value" :class="{ active: dragState.isDragging }">{{ dragState.isDragging ? '是' : '否' }}</span>
        </div>
        <div class="debug-row">
          <label class="debug-label">起始Y</label>
          <span class="debug-value">{{ dragState.dragStartY }}px</span>
        </div>
        <div class="debug-row">
          <label class="debug-label">当前偏移</label>
          <span class="debug-value">{{ dragState.dragOffsetY }}px</span>
        </div>
        <div class="debug-row">
          <label class="debug-label">持久偏移</label>
          <span class="debug-value">{{ dragState.persistentOffsetY }}px</span>
        </div>
        <div class="debug-row">
          <label class="debug-label">总偏移</label>
          <span class="debug-value">{{ dragState.persistentOffsetY + dragState.dragOffsetY }}px</span>
        </div>
      </div>
    </div>

    <!-- 拖动范围设置 -->
    <div class="debug-section">
      <div class="debug-section-title">拖动范围限制</div>
      <div class="debug-grid">
        <div class="debug-row">
          <label class="debug-label">最小Y</label>
          <input 
            v-model.number="local.minY" 
            class="debug-input" 
            type="number" 
            step="10" 
            @input="commit"
          />
        </div>
        <div class="debug-row">
          <label class="debug-label">最大Y</label>
          <input 
            v-model.number="local.maxY" 
            class="debug-input" 
            type="number" 
            step="10" 
            @input="commit"
          />
        </div>
      </div>
      <div class="debug-row" style="margin-top: 8px;">
        <label class="debug-label">启用限制</label>
        <input 
          v-model="local.enableLimit" 
          class="debug-checkbox" 
          type="checkbox" 
          @change="commit"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="debug-section">
      <div class="debug-section-title">操作</div>
      <div class="debug-actions">
        <button class="debug-action-btn" type="button" @click="resetPosition">重置位置</button>
        <button class="debug-action-btn" type="button" @click="recordPosition">记录当前位置</button>
      </div>
    </div>

    <!-- 记录的位置 -->
    <div v-if="recordedPositions.length > 0" class="debug-section">
      <div class="debug-section-title">记录的位置</div>
      <div class="recorded-positions">
        <div 
          v-for="(pos, index) in recordedPositions" 
          :key="index" 
          class="recorded-position-item"
          @click="applyPosition(pos)"
        >
          <span class="recorded-index">#{{ index + 1 }}</span>
          <span class="recorded-value">{{ pos }}px</span>
          <button 
            class="recorded-delete" 
            type="button" 
            @click.stop="deletePosition(index)"
          >×</button>
        </div>
      </div>
    </div>

    <!-- 可视化范围指示器 -->
    <div class="debug-section">
      <div class="debug-section-title">范围可视化</div>
      <div class="range-visualizer">
        <div class="range-bar">
          <div
            class="range-indicator"
            :style="{
              bottom: `${getIndicatorPercent}%`,
              backgroundColor: isOutOfRange ? '#ff4444' : '#44ff44'
            }"
          ></div>
          <div
            v-if="local.enableLimit"
            class="range-min"
            :style="{ bottom: `${getMinPercent}%` }"
          ></div>
          <div
            v-if="local.enableLimit"
            class="range-max"
            :style="{ bottom: `${getMaxPercent}%` }"
          ></div>
        </div>
        <div class="range-info">
          <span v-if="local.enableLimit" class="range-label">范围: {{ local.minY }}px ~ {{ local.maxY }}px</span>
          <span v-else class="range-label">无限制</span>
          <span v-if="isOutOfRange" class="range-warning">超出范围!</span>
        </div>
      </div>
    </div>
  </div>

  <button
    v-else
    class="drag-debug-fab"
    type="button"
    @click.stop="emit('update:visible', true)"
  >
    拖动调试
  </button>
</template>

<script setup lang="ts">
import { reactive, watch, computed } from 'vue'

export interface DragDebugConfig {
  minY: number
  maxY: number
  enableLimit: boolean
}

export interface DragState {
  isDragging: boolean
  dragStartY: number
  dragOffsetY: number
  persistentOffsetY: number
}

const props = defineProps<{
  visible: boolean
  config: DragDebugConfig
  dragState: DragState
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'update:config', v: DragDebugConfig): void
  (e: 'reset-position'): void
  (e: 'apply-position', v: number): void
}>()

const local = reactive<DragDebugConfig>({
  ...props.config,
})

const recordedPositions = reactive<number[]>([])

watch(
  () => props.config,
  (v) => {
    Object.assign(local, v)
  },
  { deep: true },
)

const commit = () => {
  emit('update:config', { ...local })
}

const resetPosition = () => {
  emit('reset-position')
}

const recordPosition = () => {
  const totalOffset = props.dragState.persistentOffsetY + props.dragState.dragOffsetY
  recordedPositions.push(totalOffset)
}

const applyPosition = (pos: number) => {
  emit('apply-position', pos)
}

const deletePosition = (index: number) => {
  recordedPositions.splice(index, 1)
}

const isOutOfRange = computed(() => {
  if (!local.enableLimit) return false
  const totalOffset = props.dragState.persistentOffsetY + props.dragState.dragOffsetY
  return totalOffset < local.minY || totalOffset > local.maxY
})

const getIndicatorPercent = computed(() => {
  const totalOffset = props.dragState.persistentOffsetY + props.dragState.dragOffsetY
  // 假设可视范围为 -500px 到 500px
  const minRange = -500
  const maxRange = 500
  const percent = ((totalOffset - minRange) / (maxRange - minRange)) * 100
  return Math.max(0, Math.min(100, percent))
})

const getMinPercent = computed(() => {
  const minRange = -500
  const maxRange = 500
  const percent = ((local.minY - minRange) / (maxRange - minRange)) * 100
  return Math.max(0, Math.min(100, percent))
})

const getMaxPercent = computed(() => {
  const minRange = -500
  const maxRange = 500
  const percent = ((local.maxY - minRange) / (maxRange - minRange)) * 100
  return Math.max(0, Math.min(100, percent))
})
</script>

<style scoped>
.drag-debug-fab {
  position: absolute;
  top: -10px;
  right: -10px;
  z-index: 999;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(20, 20, 20, 0.7);
  color: #fff;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
}

.drag-debug-panel {
  position: absolute;
  top: -200%;
  right: 150%;
  transform: translate(20px, -10px);
  width: 280px;
  max-height: 80vh;
  overflow-y: auto;
  z-index: 999;
  background: rgba(20, 20, 20, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  padding: 12px;
  color: #fff;
  font-size: 12px;
  backdrop-filter: blur(8px);
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.debug-title {
  font-weight: 600;
  font-size: 13px;
}

.debug-btn {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.debug-section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}

.debug-section-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  opacity: 0.9;
}

.debug-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.debug-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.debug-label {
  opacity: 0.8;
  white-space: nowrap;
  font-size: 11px;
}

.debug-value {
  font-family: monospace;
  font-size: 11px;
  opacity: 0.9;
}

.debug-value.active {
  color: #44ff44;
  font-weight: 600;
}

.debug-input {
  width: 70px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #fff;
  padding: 4px 6px;
  font-size: 11px;
}

.debug-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.debug-actions {
  display: flex;
  gap: 8px;
}

.debug-action-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.debug-action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.recorded-positions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.recorded-position-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.recorded-position-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.recorded-index {
  font-size: 10px;
  opacity: 0.6;
  width: 24px;
}

.recorded-value {
  font-family: monospace;
  font-size: 11px;
  flex: 1;
}

.recorded-delete {
  background: transparent;
  border: none;
  color: #ff6666;
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
}

.range-visualizer {
  margin-top: 8px;
}

.range-bar {
  position: relative;
  height: 100px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.range-indicator {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
  transition: bottom 0.1s ease, background-color 0.2s ease;
}

.range-min,
.range-max {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 0, 0.5);
  transform: translateX(-50%);
}

.range-min::after,
.range-max::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 0, 0.7);
  border-radius: 2px;
}

.range-min::after {
  top: -5px;
}

.range-max::after {
  bottom: -5px;
}

.range-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  font-size: 10px;
}

.range-label {
  opacity: 0.7;
}

.range-warning {
  color: #ff4444;
  font-weight: 600;
}
</style>
