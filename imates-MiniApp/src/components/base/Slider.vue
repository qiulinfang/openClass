<template>
  <view
    class="purple-slider-container"
    ref="containerRef"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- 背景轨道 -->
    <view class="slider-track-bg"></view>

    <!-- 激活轨道 (进度条) -->
    <view class="slider-track-fill" :style="{ width: percent + '%' }"></view>

    <!-- 滑块按钮 -->
    <view class="slider-thumb" :style="{ left: percent + '%' }">
      <!-- 数值提示 (总是显示或悬停/拖拽时显示，根据需求可以调整) -->
      <view v-if="showLabel && (dragging || showLabelAlways)" class="slider-label">
        <text>{{ displayValue }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    showLabelAlways?: boolean
    showLabel?: boolean
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    showLabelAlways: true,
    showLabel: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const dragging = ref(false)

// 计算当前进度的百分比
const percent = computed(() => {
  const range = props.max - props.min
  if (range === 0) return 0
  const p = ((props.modelValue - props.min) / range) * 100
  return Math.min(100, Math.max(0, p))
})

// 格式化显示值，避免浮点数精度问题
const displayValue = computed(() => {
  // 如果step是整数，返回整数
  if (props.step >= 1) {
    return Math.round(props.modelValue)
  }
  // 否则根据step的精度来决定显示精度
  const precision = props.step.toString().split('.')[1]?.length || 0
  return Number(props.modelValue.toFixed(precision))
})

// 根据鼠标/触摸位置计算数值
const calculateValue = (clientX: number) => {
  if (!containerRef.value) return props.min

  const rect = containerRef.value.getBoundingClientRect()
  const width = rect.width
  const left = rect.left

  // 计算在轨道上的相对位置 (0-1)
  let ratio = (clientX - left) / width
  ratio = Math.min(1, Math.max(0, ratio))

  // 映射到 min-max 范围
  const rawValue = props.min + ratio * (props.max - props.min)

  // 处理步长 (step)
  // 如果步长是0.5，我们需要让结果落在 1, 1.5, 2 等位置
  const steps = Math.round((rawValue - props.min) / props.step)
  let steppedValue = props.min + steps * props.step

  // 精度修正 (解决浮点数精度问题)
  // 例如 step=0.1, 1.1 + 0.1 可能变成 1.20000000002
  const precision = props.step.toString().split('.')[1]?.length || 0
  if (precision > 0) {
    steppedValue = parseFloat(steppedValue.toFixed(precision))
  }

  return Math.min(props.max, Math.max(props.min, steppedValue))
}

const updateValue = (clientX: number) => {
  // 小程序中通过 ref 测量容器位置通常需要 createSelectorQuery
  // 这里简化处理，假设已经有 clientX
  const newValue = calculateValue(clientX)
  if (newValue !== props.modelValue) {
    emit('update:modelValue', newValue)
  }
}

// 移除不适用的鼠标事件，统一使用小程序触摸事件
const handleTouchStart = (e: TouchEvent) => {
  dragging.value = true
  updateValue(e.touches[0].clientX)
}

const handleTouchMove = (e: TouchEvent) => {
  if (!dragging.value) return
  updateValue(e.touches[0].clientX)
}

const handleTouchEnd = () => {
  dragging.value = false
  emit('change', props.modelValue)
}

onUnmounted(() => {
})
</script>

<style scoped lang="scss">
.purple-slider-container {
  position: relative;
  width: 100%;
  height: 24px; /* 增加点击区域高度 */
  display: flex;
  align-items: center;
  user-select: none;
  cursor: pointer;
  touch-action: none;

  &:hover {
    .slider-track-bg {
      background-color: #d1d5db;
    }
  }
}

.slider-track-bg {
  position: absolute;
  width: 100%;
  height: 4px;
  background-color: #e5e7eb;
  border-radius: 2px;
  transition: background-color 0.2s;
}

.slider-track-fill {
  position: absolute;
  height: 4px;
  background-color: #9059ff; /* 主紫色 */
  border-radius: 2px;
  pointer-events: none;
}

.slider-thumb {
  position: absolute;
  width: 16px;
  height: 16px;
  background-color: white;
  border: 2px solid #9059ff;
  border-radius: 50%;
  transform: translate(-50%, 0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition:
    transform 0.1s,
    box-shadow 0.1s;
  z-index: 2;

  /* 垂直居中 */
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover,
  &.dragging {
    transform: translate(-50%, 0) scale(1.1);
    box-shadow: 0 2px 5px rgba(144, 89, 255, 0.4);
  }
}

.slider-label {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #9059ff;
  color: white;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;

  /* 小箭头 */
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 4px;
    border-style: solid;
    border-color: #9059ff transparent transparent transparent;
  }
}
</style>
