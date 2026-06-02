<template>
  <view class="bubble-popup-wrapper">
    <!-- 触发元素 -->
    <view
      ref="triggerRef"
      class="bubble-popup-trigger"
      @click.stop="handleTriggerClick"
    >
      <slot name="trigger" />
    </view>

    <!-- 气泡框 -->
    <view
      v-if="isVisible"
      ref="popupRef"
      class="bubble-popup"
      :class="`bubble-popup--${currentPlacement}`"
      :style="popupStyle"
    >
      <view class="bubble-popup__content">
        <slot />
      </view>
      <view
        v-if="showArrow"
        class="bubble-popup__arrow"
        :class="`bubble-popup__arrow--${currentPlacement}`"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Placement = 'top' | 'bottom' | 'left' | 'right'

type AutoPlacement = Placement | 'auto'

const props = defineProps<{
  /** 是否显示（支持 v-model） */
  modelValue?: boolean
  /** 优先方向，auto 会自动根据屏幕空间选择 */
  placement?: AutoPlacement
  /** 触发元素与气泡之间的间距 */
  offset?: number
  /** 是否展示三角箭头，默认展示 */
  showArrow?: boolean
  /** 触发模式：click=内部点击触发，manual=完全由外部 v-model 控制 */
  trigger?: 'click' | 'manual'
  /** 气泡的 z-index 层级 */
  zIndex?: number
  /** 气泡宽度（number 会自动转 px） */
  width?: number | string
  /** 气泡最小宽度（number 会自动转 px） */
  minWidth?: number | string
  /** 气泡最大宽度（number 会自动转 px），可覆盖默认 CSS 的 max-width: 280px */
  maxWidth?: number | string
  /** 气泡最大高度（number 会自动转 px） */
  maxHeight?: number | string
  /** 额外样式（直接作用在气泡容器上，会覆盖同名属性） */
  popupStyle?: CSSProperties
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const triggerRef = ref<any>(null)
const popupRef = ref<any>(null)

// 简单调试日志：线上环境改为空实现，避免多余输出
const debugLog = (..._args: unknown[]) => {}

const isVisible = ref<boolean>(props.modelValue ?? false)

// 触发模式，默认 click
const triggerMode = computed(() => props.trigger ?? 'click')

const currentPlacement = ref<Placement>(props.placement === 'auto' || !props.placement ? 'bottom' : props.placement)

const normalizeSize = (value: number | string | undefined) => {
  if (value === undefined || value === null) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

const position = ref({ top: 0, left: 0 })

const popupStyle = computed(() => {
  const zIndexValue = props.zIndex ?? 100050
  return {
    position: 'fixed',
    top: `${position.value.top}px`,
    left: `${position.value.left}px`,
    zIndex: zIndexValue,
    width: normalizeSize(props.width),
    minWidth: normalizeSize(props.minWidth),
    maxWidth: normalizeSize(props.maxWidth),
    maxHeight: normalizeSize(props.maxHeight),
    ...props.popupStyle,
  }
})

const showArrow = computed(() => props.showArrow ?? true)

const toggle = () => {
  debugLog('toggle()', { from: isVisible.value })
  setVisible(!isVisible.value)
}

const handleTriggerClick = () => {
  // manual 模式下不处理内部点击，完全交给外部控制
  if (triggerMode.value !== 'click') return
  toggle()
}

const setVisible = (value: boolean) => {
  if (isVisible.value === value) return
  isVisible.value = value
  emit('update:modelValue', value)

  if (value) {
    visibleSince = Date.now()
    // 小程序中通过组件生命周期或事件监听点击外部
    nextTick(() => {
      updatePosition()
    })
  }
}

const updatePosition = () => {
  if (!isVisible.value) return

  // 在小程序中使用 uni.createSelectorQuery 获取位置
  const query = uni.createSelectorQuery().in(instance)
  query.select('.bubble-popup-trigger').boundingClientRect()
  query.selectViewport().scrollOffset()
  
  query.exec((res) => {
    if (!res || !res[0]) return
    
    const triggerRect = res[0]
    const scrollOffset = res[1] || { scrollTop: 0, scrollLeft: 0 }
    
    const offset = props.offset ?? 8
    let top = 0
    let left = 0
    
    // 基础定位：计算 trigger 的中心点
    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    
    // 默认处理 placement='bottom'
    if (currentPlacement.value === 'bottom') {
      top = triggerRect.bottom + offset
      left = triggerCenterX
    } else if (currentPlacement.value === 'top') {
      top = triggerRect.top - offset
      left = triggerCenterX
    } else if (currentPlacement.value === 'left') {
      top = triggerRect.top + triggerRect.height / 2
      left = triggerRect.left - offset
    } else if (currentPlacement.value === 'right') {
      top = triggerRect.top + triggerRect.height / 2
      left = triggerRect.right + offset
    }
    
    position.value = { top, left }
  })
}

import { getCurrentInstance } from 'vue'
const instance = getCurrentInstance()

let visibleSince = 0

const bindGlobalListeners = () => {
}

const unbindGlobalListeners = () => {
}

watch(
  () => props.modelValue,
  (val) => {
    if (typeof val === 'boolean') {
      debugLog('props.modelValue changed', { val })
      setVisible(val)
    }
  }
)

onMounted(() => {
  if (isVisible.value) {
    debugLog('mounted with visible = true，bind listeners & update position')
    bindGlobalListeners()
    nextTick(() => {
      updatePosition()
    })
  }
})

onBeforeUnmount(() => {
  unbindGlobalListeners()
})
</script>

<style scoped>
.bubble-popup-wrapper {
  display: inline-block;
}

.bubble-popup {
  position: fixed;
  z-index: 100050;
  max-width: 280px;
  background-color: #ffffff;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
  padding: 8px 12px;
  color: #1f2933;
  font-size: 13px;
  line-height: 1.5;
}

.bubble-popup__content {
  position: relative;
  z-index: 1;
}

.bubble-popup__arrow {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: #ffffff;
  transform: rotate(45deg);
  box-shadow: -2px -2px 4px rgba(15, 23, 42, 0.08);
}

/* 箭头位置 */
.bubble-popup__arrow--bottom {
  top: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
}

.bubble-popup__arrow--top {
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
}

.bubble-popup__arrow--right {
  left: -5px;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
}

.bubble-popup__arrow--left {
  right: -5px;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
}

/* 动画 */
.bubble-fade-enter-active,
.bubble-fade-leave-active {
  transition: opacity 0.12s ease-out, transform 0.12s ease-out;
}

.bubble-fade-enter-from,
.bubble-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
