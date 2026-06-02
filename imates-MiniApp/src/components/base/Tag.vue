<template>
  <view
    :class="['status-tag', sizeClass, variantClass]"
    :style="tagStyle"
  >
    <view v-if="dot" class="status-dot" :style="dotStyle" />
    <text>{{ text }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SizeType = 'xs' | 'sm' | 'md' | 'lg'
type ColorType = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray' | 'primary'
type VariantType = 'solid' | 'text'

interface Props {
  // 标签文字（必填）
  text: string
  // 尺寸
  size?: SizeType
  // 是否显示左侧圆点
  dot?: boolean
  // 展示变体
  variant?: VariantType
  // 预设颜色类型（可选，用于快速设置颜色）
  type?: ColorType
  // 自定义颜色（优先级高于 type）
  color?: string
  // 自定义背景色（优先级高于 type）
  bgColor?: string
  // 自定义边框颜色（优先级高于 type）
  borderColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  dot: false,
  variant: 'solid',
})

const sizeClass = computed(() => {
  return `size-${props.size}`
})

const variantClass = computed(() => {
  return `variant-${props.variant}`
})

// 预设颜色映射
const colorMap: Record<ColorType, { color: string; bgColor: string; borderColor: string }> = {
  red: { color: '#ff6767', bgColor: '#fff3f3', borderColor: '#ffabab' },
  orange: { color: '#ff8c00', bgColor: '#fff2d4', borderColor: '#ffdd8d' },
  yellow: { color: '#eab308', bgColor: '#fefce8', borderColor: '#fef08a' },
  green: { color: '#00bc32', bgColor: '#e0f7e6', borderColor: '#b1ebc0' },
  blue: { color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
  purple: { color: '#8b5cf6', bgColor: '#f5f3ff', borderColor: '#ddd6fe' },
  gray: { color: '#6b7280', bgColor: '#f9fafb', borderColor: '#e5e7eb' },
  primary: { color: '#0f002e', bgColor: '#f0f0f5', borderColor: '#d1d1db' },
}

const tagStyle = computed(() => {
  // 优先使用自定义颜色，其次使用预设类型，最后默认 gray
  const colorConfig = colorMap[props.type || 'gray']

  const isText = props.variant === 'text'

  const finalBorderColor = props.borderColor
    ? props.borderColor
    : (isText ? '#e5e7eb' : colorConfig.borderColor)

  const finalBgColor = props.bgColor
    ? props.bgColor
    : (isText ? '#ffffff' : colorConfig.bgColor)

  return {
    color: props.color || colorConfig.color,
    backgroundColor: finalBgColor,
    border: `1px solid ${finalBorderColor}`,
  }
})

const dotStyle = computed(() => {
  const colorConfig = colorMap[props.type || 'gray']
  return {
    backgroundColor: props.color || colorConfig.color,
  }
})
</script>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-weight: 500;
  border-radius: 6px;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

/* Size variants */
.size-xs {
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 3px;
}

.size-sm {
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 4px;
}

.size-md {
  padding: 4px 12px;
  font-size: 14px;
  border-radius: 6px;
}

.size-lg {
  padding: 6px 16px;
  font-size: 16px;
  border-radius: 8px;
}
</style>
