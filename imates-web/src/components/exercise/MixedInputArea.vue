<template>
  <div class="mixed-input-area" :class="[`type-${questionType}`, { 'is-disabled': disabled }]">
    <div class="mixed-input-header q-mb-sm">
      <slot name="header-left">
        <div class="input-label text-weight-bold" v-if="label">{{ label }}</div>
      </slot>
      <div class="input-controls" v-if="!disabled">
        <div class="input-type-tabs">
          <div 
            class="type-tab" 
            :class="{ active: currentType === 'text' }"
            @click="switchType('text')"
          >键盘</div>
          <div 
            class="type-tab" 
            :class="{ active: currentType === 'drawing' }"
            @click="switchType('drawing')"
          >手写</div>
        </div>
        <q-btn 
          flat 
          round 
          dense 
          color="grey-7" 
          icon="delete_outline" 
          size="sm"
          class="clear-btn q-ml-sm"
          @click="handleClear"
        >
          <q-tooltip>清空内容</q-tooltip>
        </q-btn>
      </div>
    </div>

    <div class="mixed-input-body">
      <!-- 文本输入 -->
      <div v-if="currentType === 'text'" class="text-input-wrapper">
        <q-input
          v-model="textContent"
          :type="isTextArea ? 'textarea' : 'text'"
          filled
          dense
          :rows="isTextArea ? 12 : 1"
          :placeholder="placeholder"
          :disable="disabled"
          @update:model-value="handleTextUpdate"
          @focus="$emit('focus')"
          @blur="$emit('blur')"
        />
      </div>

      <!-- 画板输入 -->
      <div v-else class="drawing-board-wrapper" :style="{ height: boardHeight }">
        <DrawingBoardNew
          ref="drawingBoardRef"
          :showGrid="false"
          :show-toolbar="false"
          :disabled="disabled"
          :show-zoom-controls="false"
          :show-debug-panel="false"
          :initial-zoom="100"
          :min-zoom="1"
          :max-zoom="1"
          :allow-zoom="false"
          @save="handleBoardSave"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, type ComponentPublicInstance } from 'vue'
import DrawingBoardNew from '../drawing/drawingBoardNew.vue'

interface SubjectiveAnswer {
  type: 'text' | 'board'
  textContent?: string
  boardData?: unknown
  timestamp?: number
}

type MixedModelValue = string | SubjectiveAnswer

interface Props {
  modelValue?: MixedModelValue
  questionType?: 'fill' | 'subjective'
  label?: string
  placeholder?: string
  disabled?: boolean
  rows?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  questionType: 'fill',
  disabled: false,
  rows: 3
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: MixedModelValue): void
  (e: 'change', value: MixedModelValue): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

const drawingBoardRef = ref<ComponentPublicInstance & { loadData: (data: unknown) => void; saveData: () => unknown; clearAll: () => void } | null>(null)
const currentType = ref<'text' | 'drawing'>('text')
const textContent = ref('')

const isTextArea = computed(() => props.questionType === 'subjective')
const boardHeight = computed(() => props.questionType === 'subjective' ? '400px' : '160px')

// 解析数据并初始化模式
const initFromValue = (val: MixedModelValue | undefined) => {
  if (!val) {
    currentType.value = 'text'
    textContent.value = ''
    return
  }

  // 填空题：直接判断是否是 JSON 格式的画板数据
  if (props.questionType === 'fill') {
    const valStr = typeof val === 'string' ? val : ''
    if (valStr.startsWith('{') && valStr.includes('"objects"')) {
      currentType.value = 'drawing'
    } else {
      currentType.value = 'text'
      textContent.value = valStr
    }
  } 
  // 主观题：通过 type 字段显式判断
  else {
    const subVal = val as SubjectiveAnswer
    if (subVal.type === 'board') {
      currentType.value = 'drawing'
    } else {
      currentType.value = 'text'
      textContent.value = subVal.textContent || ''
    }
  }
}

onMounted(() => {
  initFromValue(props.modelValue)
  // 画板数据加载
  if (currentType.value === 'drawing' && drawingBoardRef.value) {
    let data = null
    if (props.questionType === 'fill') {
      const val = typeof props.modelValue === 'string' ? props.modelValue : ''
      if (val) {
        try {
          data = JSON.parse(val)
        } catch (e) {
          console.error('Parse drawing data failed', e)
        }
      }
    } else {
      const subVal = props.modelValue as SubjectiveAnswer | undefined
      data = subVal?.boardData
    }
    
    if (data) {
      drawingBoardRef.value.loadData(data)
    }
  }
})

watch(() => props.modelValue, (newVal) => {
  if (currentType.value === 'drawing' && drawingBoardRef.value) {
    let data = null
    if (props.questionType === 'fill') {
      const val = typeof newVal === 'string' ? newVal : ''
      if (val) {
        try {
          data = JSON.parse(val)
        } catch (e) {
          console.error('Parse drawing data failed', e)
        }
      }
    } else {
      const subVal = newVal as SubjectiveAnswer | undefined
      data = subVal?.boardData
    }

    if (data) {
      const currentData = drawingBoardRef.value.saveData()
      if (JSON.stringify(currentData) !== JSON.stringify(data)) {
        drawingBoardRef.value.loadData(data)
      }
    }
  } else if (currentType.value === 'text') {
    if (props.questionType === 'fill') {
      textContent.value = typeof newVal === 'string' ? newVal : ''
    } else {
      const subVal = newVal as SubjectiveAnswer | undefined
      textContent.value = subVal?.textContent || ''
    }
  }
}, { deep: true })

const switchType = (type: 'text' | 'drawing') => {
  currentType.value = type
}

const handleTextUpdate = (val: string | number | null) => {
  const finalVal = val === null ? '' : String(val)
  if (props.questionType === 'fill') {
    emit('update:modelValue', finalVal)
    emit('change', finalVal)
  } else {
    const subVal = (props.modelValue || { type: 'text' }) as SubjectiveAnswer
    const newValue: SubjectiveAnswer = {
      ...subVal,
      type: 'text',
      textContent: finalVal,
      timestamp: Date.now()
    }
    emit('update:modelValue', newValue)
    emit('change', newValue)
  }
}

const handleBoardSave = (boardData: unknown) => {
  if (props.questionType === 'fill') {
    const str = JSON.stringify(boardData)
    emit('update:modelValue', str)
    emit('change', str)
  } else {
    const subVal = (props.modelValue || { type: 'board' }) as SubjectiveAnswer
    const newValue: SubjectiveAnswer = {
      ...subVal,
      boardData,
      type: 'board',
      timestamp: Date.now()
    }
    emit('update:modelValue', newValue)
    emit('change', newValue)
  }
}

const handleClear = () => {
  if (currentType.value === 'drawing') {
    drawingBoardRef.value?.clearAll()
  } else {
    textContent.value = ''
    handleTextUpdate('')
  }
}

defineExpose({
  clear: handleClear,
  getDrawingBoard: () => drawingBoardRef.value
})
</script>

<style scoped lang="scss">
.mixed-input-area {
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;

  &.is-active {
    border-color: #615efe;
    box-shadow: 0 0 0 2px rgba(97, 94, 254, 0.1);
  }
}

.mixed-input-area {
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;

  &.is-active {
    border-color: #615efe;
    box-shadow: 0 0 0 2px rgba(97, 94, 254, 0.1);
  }
}

.mixed-input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-controls {
  display: flex;
  align-items: center;
}

.input-type-tabs {
  display: flex;
  background: #e2e8f0;
  padding: 2px;
  border-radius: 6px;
  gap: 2px;

  .type-tab {
    padding: 2px 10px;
    font-size: 12px;
    border-radius: 4px;
    cursor: pointer;
    color: #64748b;
    transition: all 0.2s;

    &:hover {
      color: #334155;
    }

    &.active {
      background: white;
      color: #615efe;
      font-weight: bold;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
  }
}

.drawing-board-wrapper {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  
  &:focus-within {
    border-color: #615efe;
  }
}

.is-disabled {
  .drawing-board-wrapper {
    background: #f8fafc;
  }
}
</style>
