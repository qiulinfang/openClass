<template>
  <div class="bubble-popup-wrapper">
    <!-- 触发元素 -->
    <div
      ref="triggerRef"
      class="bubble-popup-trigger"
      @click.stop="handleTriggerClick"
    >
      <slot name="trigger" />
    </div>

    <!-- 气泡框挂到 body，避免被父容器 overflow 截断 -->
    <Teleport to="body">
      <transition name="bubble-fade">
        <div
          v-if="isVisible"
          ref="popupRef"
          class="bubble-popup"
          :class="`bubble-popup--${currentPlacement}`"
          :style="popupStyle"
        >
          <div class="bubble-popup__content">
            <slot />
          </div>
          <div
            v-if="showArrow"
            class="bubble-popup__arrow"
            :class="`bubble-popup__arrow--${currentPlacement}`"
          />
        </div>
      </transition>
    </Teleport>
  </div>
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

const triggerRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)

// 简单调试日志：线上环境改为空实现，避免多余输出
const debugLog = (..._args: unknown[]) => {}

const isVisible = ref<boolean>(props.modelValue ?? false)

// 触发模式，默认 click
const triggerMode = computed(() => props.trigger ?? 'click')

const currentPlacement = ref<Placement>('bottom')

const normalizeSize = (value: number | string | undefined) => {
  if (value === undefined || value === null) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

const popupStyle = computed(() => {
  const zIndexValue = props.zIndex ?? 100050
  return {
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

const position = ref({ top: 0, left: 0 })

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

  debugLog('setVisible()', { value })

  if (value) {
    // 记录显示时间戳，用于防止刚显示就被误关闭
    visibleSince = Date.now()
    bindGlobalListeners()
    // 等待气泡 DOM 渲染后再计算位置
    nextTick(() => {
      updatePosition()
      // 某些场景（例如父级抽屉/过渡动画、首次 Teleport 渲染）首帧布局未稳定，
      // 需要在下一帧再计算一次，避免首次打开定位/placement 不准。
      requestAnimationFrame(() => {
        updatePosition()
      })
    })
  } else {
    unbindGlobalListeners()
  }
}

const updatePosition = () => {
  const popupEl = popupRef.value
  if (!popupEl) return

  const popupRect = popupEl.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const offset = props.offset ?? 8

  // 原有的 triggerRef 定位逻辑
  const triggerEl = triggerRef.value
  if (!triggerEl) return

  const triggerRect = triggerEl.getBoundingClientRect()

  let placement: Placement = 'bottom'

  if (props.placement && props.placement !== 'auto') {
    placement = props.placement
  } else {
    // 根据可用空间自动选择
    const spaceBelow = viewportHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top
    const spaceRight = viewportWidth - triggerRect.right
    const spaceLeft = triggerRect.left

    if (spaceBelow >= popupRect.height + offset) {
      placement = 'bottom'
    } else if (spaceAbove >= popupRect.height + offset) {
      placement = 'top'
    } else if (spaceRight >= popupRect.width + offset) {
      placement = 'right'
    } else if (spaceLeft >= popupRect.width + offset) {
      placement = 'left'
    } else {
      placement = 'bottom'
    }
  }

  currentPlacement.value = placement

  let top = 0
  let left = 0

  switch (placement) {
    case 'bottom': {
      top = triggerRect.bottom + offset
      left = triggerRect.left + (triggerRect.width - popupRect.width) / 2
      break
    }
    case 'top': {
      top = triggerRect.top - popupRect.height - offset
      left = triggerRect.left + (triggerRect.width - popupRect.width) / 2
      break
    }
    case 'right': {
      top = triggerRect.top + (triggerRect.height - popupRect.height) / 2
      left = triggerRect.right + offset
      break
    }
    case 'left': {
      top = triggerRect.top + (triggerRect.height - popupRect.height) / 2
      left = triggerRect.left - popupRect.width - offset
      break
    }
  }

  // 边界裁剪
  const margin = 8
  const maxLeft = viewportWidth - popupRect.width - margin
  const minLeft = margin
  left = Math.min(Math.max(left, minLeft), maxLeft)

  const maxTop = viewportHeight - popupRect.height - margin
  const minTop = margin
  top = Math.min(Math.max(top, minTop), maxTop)

  position.value = { top, left }

  debugLog('updatePosition()', {
    placement,
    triggerRect: {
      top: triggerRect.top,
      left: triggerRect.left,
      width: triggerRect.width,
      height: triggerRect.height,
    },
    popupRect: {
      width: popupRect.width,
      height: popupRect.height,
    },
    position: position.value,
  })
}

let onResize: (() => void) | null = null
let onScroll: (() => void) | null = null
let onClickOutside: ((e: PointerEvent) => void) | null = null
// 记录气泡显示的时间戳，用于防止刚显示就被误关闭
let visibleSince = 0

const bindGlobalListeners = () => {
  if (!onResize) {
    onResize = () => {
      updatePosition()
    }
    window.addEventListener('resize', onResize)
  }

  if (!onScroll) {
    onScroll = () => {
      updatePosition()
    }
    window.addEventListener('scroll', onScroll, true)
  }

  if (!onClickOutside) {
    onClickOutside = (e: PointerEvent) => {
      // 防止刚显示就被误关闭：如果距离显示时间不足 300ms，忽略此次事件
      const elapsed = Date.now() - visibleSince
      if (elapsed < 300) {
        debugLog('ignore pointerdown within 300ms of showing', { elapsed })
        return
      }

      const target = e.target as Node | null
      const triggerEl = triggerRef.value
      const popupEl = popupRef.value

      if (!triggerEl || !popupEl) return

      if (!triggerEl.contains(target) && !popupEl.contains(target)) {
        debugLog('click outside, close popup')
        setVisible(false)
      }
    }
    // 使用 pointerdown 以兼容鼠标和触摸设备
    document.addEventListener('pointerdown', onClickOutside)
  }
}

const unbindGlobalListeners = () => {
  if (onResize) {
    window.removeEventListener('resize', onResize)
    onResize = null
  }
  if (onScroll) {
    window.removeEventListener('scroll', onScroll, true)
    onScroll = null
  }
  if (onClickOutside) {
    document.removeEventListener('pointerdown', onClickOutside)
    onClickOutside = null
  }
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
