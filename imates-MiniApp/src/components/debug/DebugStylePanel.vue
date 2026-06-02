<template>
  <div v-if="isDev" class="debug-panel-overlay">
    <div class="debug-title">
      <span>{{ title }}</span>
      <button class="close-btn" @click="visible = !visible">{{ visible ? '收起' : '展开' }}</button>
    </div>
    <div v-show="visible">
      <div v-for="(item, key) in config" :key="key" class="debug-row">
        <template v-if="typeof item.value === 'number'">
          <span>{{ item.label }}:</span>
          <input 
            type="range" 
            :min="item.min" 
            :max="item.max" 
            :value="modelValue[key]" 
            @input="handleInput(key, $event)" 
          />
          <span>{{ modelValue[key] }}{{ item.unit || '' }}</span>
        </template>
        <template v-else-if="typeof item.value === 'boolean'">
          <span>{{ item.label }}:</span>
          <input 
            type="checkbox" 
            :checked="modelValue[key]" 
            @change="handleChange(key, $event)" 
          />
        </template>
      </div>
      <div class="debug-actions">
        <button @click="copyConfig">复制当前配置 JSON</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface ConfigItem {
  label: string
  value: number | boolean
  min?: number
  max?: number
  unit?: string
}

const props = defineProps<{
  modelValue: Record<string, any>
  config: Record<string, ConfigItem>
  title?: string
}>()

const emit = defineEmits(['update:modelValue'])

const visible = ref(true)
const isDev = computed(() => import.meta.env.DEV)

const updateValue = (key: string, value: any) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: value
  })
}

const handleInput = (key: string, event: Event) => {
  const target = event.target as HTMLInputElement
  updateValue(key, target.valueAsNumber)
}

const handleChange = (key: string, event: Event) => {
  const target = event.target as HTMLInputElement
  updateValue(key, target.checked)
}

const copyConfig = () => {
  const json = JSON.stringify(props.modelValue, null, 2)
  navigator.clipboard.writeText(json).then(() => {
    alert('配置已复制到剪贴板')
  })
}
</script>

<style lang="scss" scoped>
.debug-panel-overlay {
  position: fixed;
  left: 20px;
  bottom: 20px;
  width: 280px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 16px;
  border-radius: 12px;
  z-index: 10000;
  font-size: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1);

  .debug-title {
    font-weight: bold;
    margin-bottom: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.2);
    padding-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .close-btn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 10px;
      &:hover { background: rgba(255,255,255,0.2); }
    }
  }

  .debug-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;

    span:first-child {
      width: 60px;
      color: #aaa;
    }
    span:last-child {
      width: 45px;
      text-align: right;
      font-family: monospace;
      color: #00ff00;
    }

    input[type="range"] {
      flex: 1;
      cursor: pointer;
      accent-color: #615efe;
    }
    
    input[type="checkbox"] {
      cursor: pointer;
    }
  }

  .debug-actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    
    button {
      flex: 1;
      background: #615efe;
      border: none;
      color: white;
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      &:hover { opacity: 0.9; }
    }
  }
}
</style>
