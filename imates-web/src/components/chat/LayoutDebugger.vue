<template>
  <div class="layout-debugger" v-if="visible">
    <div class="debugger-header">
      <span>布局调试面板</span>
      <button @click="visible = false" class="close-btn">×</button>
    </div>
    <div class="debugger-content">
      <div v-for="(value, key) in modelValue" :key="key" class="debug-item">
        <label>{{ key }}: {{ value }}{{ getUnit(key) }}</label>
        <input
          type="range"
          :min="getMin(key)"
          :max="getMax(key)"
          :step="getStep(key)"
          :value="value"
          @input="updateValue(key, $event)"
        />
      </div>
    </div>
    <div class="debugger-footer">
      <button @click="copyConfig" class="copy-btn">复制配置 JSON</button>
    </div>
  </div>
  <button v-else @click="visible = true" class="open-debugger-btn">打开调试</button>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue: Record<string, number>
}>()

const emit = defineEmits(['update:modelValue'])

const visible = ref(false)

const getUnit = (key: string) => {
  if (key.toLowerCase().includes('size') || key.toLowerCase().includes('padding') || key.toLowerCase().includes('margin') || key.toLowerCase().includes('height') || key.toLowerCase().includes('top') || key.toLowerCase().includes('left')) {
    return 'px'
  }
  return ''
}

const getMin = (key: string) => {
  if (key.includes('top') || key.includes('left')) return -50
  return 0
}

const getMax = (key: string) => {
  if (key.includes('Width') || key.includes('Height')) return 300
  if (key.includes('Size')) return 100
  return 50
}

const getStep = (key: string) => 1

const updateValue = (key: string, event: Event) => {
  const newValue = parseInt((event.target as HTMLInputElement).value)
  emit('update:modelValue', { ...props.modelValue, [key]: newValue })
}

const copyConfig = () => {
  const json = JSON.stringify(props.modelValue, null, 2)
  navigator.clipboard.writeText(json).then(() => {
    alert('配置已复制到剪贴板')
  })
}
</script>

<style scoped>
.layout-debugger {
  position: fixed;
  right: 20px;
  top: 20px;
  width: 260px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  border-radius: 8px;
  z-index: 9999;
  font-family: monospace;
  font-size: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
}

.debugger-header {
  padding: 10px;
  border-bottom: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 18px;
  cursor: pointer;
}

.debugger-content {
  padding: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.debug-item {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}

.debug-item label {
  margin-bottom: 4px;
  color: #ddd;
}

.debug-item input {
  width: 100%;
}

.debugger-footer {
  padding: 10px;
  border-top: 1px solid #444;
}

.copy-btn {
  width: 100%;
  padding: 6px;
  background: #6366f1;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.open-debugger-btn {
  position: fixed;
  right: 20px;
  top: 20px;
  z-index: 9999;
  padding: 6px 12px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.5;
}

.open-debugger-btn:hover {
  opacity: 1;
}
</style>
