<template>
  <div v-if="isDev" class="debug-panel">
    <div class="debug-title">宽度调试面板</div>
    <div class="debug-row">
      <label>左侧宽度: {{ modelValue.toFixed(1) }}%</label>
      <input
        type="range"
        :value="modelValue"
        @input="$emit('update:modelValue', Number($event.target.value))"
        :min="minOffset"
        :max="maxOffset"
        step="0.5"
      />
    </div>
    <div class="debug-row">
      <label>最小左侧宽度 (minOffset): {{ minOffset }}%</label>
      <input
        type="number"
        :value="minOffset"
        @input="$emit('update:minOffset', Number($event.target.value))"
        min="10"
        max="50"
        step="1"
      />
    </div>
    <div class="debug-row">
      <label>最大左侧宽度 (maxOffset): {{ maxOffset }}%</label>
      <input
        type="number"
        :value="maxOffset"
        @input="$emit('update:maxOffset', Number($event.target.value))"
        :min="50"
        max="90"
        step="1"
      />
    </div>
    <div class="debug-info">
      <div>右侧宽度: {{ (100 - modelValue).toFixed(1) }}%</div>
      <div>右侧最小宽度: {{ (100 - maxOffset).toFixed(1) }}%</div>
      <div>右侧最大宽度: {{ (100 - minOffset).toFixed(1) }}%</div>
    </div>
  </div>
</template>

<script setup>
const isDev = import.meta.env.DEV

defineProps({
  modelValue: {
    type: Number,
    required: true
  },
  minOffset: {
    type: Number,
    required: true
  },
  maxOffset: {
    type: Number,
    required: true
  }
})

defineEmits(['update:modelValue', 'update:minOffset', 'update:maxOffset'])
</script>

<style scoped>
/* 宽度调试面板样式 */
.debug-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 16px;
  border-radius: 8px;
  z-index: 99999;
  min-width: 280px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.debug-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #4ade80;
}

.debug-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.debug-row label {
  flex: 1;
  margin-right: 8px;
}

.debug-row input[type="range"] {
  flex: 1;
  cursor: pointer;
}

.debug-row input[type="number"] {
  width: 60px;
  padding: 4px;
  border: 1px solid #4b5563;
  background: #1f2937;
  color: white;
  border-radius: 4px;
}

.debug-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #374151;
  font-size: 11px;
  color: #9ca3af;
}

.debug-info div {
  margin-bottom: 4px;
}
</style>
