<template>
  <div
    ref="fabRef"
    class="draggable-fab"
    :class="{
      'draggable-fab--active': isPressing,
      'draggable-fab--dragging': isDragging,
    }"
    :style="fabStyle"
    @pointerdown="onPointerDown"
  >
    <CommonActionButton
      :label="label"
      :size="size"
      :icon="icon"
      @click="onClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import CommonActionButton from './Button.vue'

interface Position {
  x: number
  y: number
}

interface Props {
  label: string
  icon: string
  size?: 'sm' | 'mdCompact' | 'md' | 'lg' | 'xl'
  initialPos?: { left?: number; right?: number; bottom?: number; top?: number; x?: number; y?: number }
  boundsContainer?: string // 限制范围的容器选择器
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const emit = defineEmits<{
  'click': []
}>()

const fabRef = ref<HTMLElement | null>(null)
const pos = ref<Position>({ x: 0, y: 0 })
const isDragging = ref(false)
const isPressing = ref(false)
const moved = ref(false)
const lastDragEndAt = ref(0)
const pointerId = ref<number | null>(null)

const dragStart = ref({
  pointerX: 0,
  pointerY: 0,
  startX: 0,
  startY: 0,
})

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const fabStyle = computed(() => ({
  transform: `translate(${pos.value.x}px, ${pos.value.y}px) scale(var(--fab-scale, 1))`,
}))

const getContainerRect = () => {
  if (props.boundsContainer) {
    const container = document.querySelector(props.boundsContainer)
    if (container) return container.getBoundingClientRect()
  }
  return { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 }
}

const onPointerMove = (e: PointerEvent) => {
  if (pointerId.value === null || e.pointerId !== pointerId.value) return

  const dx = e.clientX - dragStart.value.pointerX
  const dy = e.clientY - dragStart.value.pointerY

  if (!moved.value && Math.hypot(dx, dy) > 4) {
    moved.value = true
  }

  isDragging.value = true

  const rect = getContainerRect()
  const btnSize = fabRef.value?.offsetWidth || 56

  const nextX = dragStart.value.startX + dx
  const nextY = dragStart.value.startY + dy

  pos.value = {
    x: clamp(nextX, 8, rect.width - btnSize - 8),
    y: clamp(nextY, 8, rect.height - btnSize - 8),
  }
}

const onPointerUp = (e: PointerEvent) => {
  if (pointerId.value === null || e.pointerId !== pointerId.value) return

  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)

  pointerId.value = null
  isDragging.value = false
  isPressing.value = false
  
  if (moved.value) {
    lastDragEndAt.value = Date.now()
  }
}

const onPointerDown = (e: PointerEvent) => {
  if (pointerId.value !== null) return
  pointerId.value = e.pointerId
  moved.value = false
  isPressing.value = true

  try {
    ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  } catch {}

  const current = pos.value
  dragStart.value = {
    pointerX: e.clientX,
    pointerY: e.clientY,
    startX: current.x,
    startY: current.y,
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

const onClick = () => {
  // 防止拖拽结束后触发点击
  if (Date.now() - lastDragEndAt.value < 200) return
  emit('click')
}

onMounted(() => {
  // 初始化位置
  const rect = getContainerRect()
  const btnSize = 56 // 估算值
  
  let initialX = 0
  let initialY = 0

  if (props.initialPos) {
    if (props.initialPos.x !== undefined) initialX = props.initialPos.x
    else if (props.initialPos.right !== undefined) initialX = rect.width - btnSize - props.initialPos.right
    else if (props.initialPos.left !== undefined) initialX = props.initialPos.left
    
    if (props.initialPos.y !== undefined) initialY = props.initialPos.y
    else if (props.initialPos.bottom !== undefined) initialY = rect.height - btnSize - props.initialPos.bottom
    else if (props.initialPos.top !== undefined) initialY = props.initialPos.top
  } else {
    // 默认右下角
    initialX = rect.width - btnSize - 16
    initialY = rect.height - btnSize - 16
  }

  pos.value = {
    x: clamp(initialX, 8, rect.width - btnSize - 8),
    y: clamp(initialY, 8, rect.height - btnSize - 8),
  }
})
</script>

<style scoped lang="scss">
.draggable-fab {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  user-select: none;
  will-change: transform;
  touch-action: none;
  cursor: grab;
  /* 默认不带 transition，避免初始化从 (0,0) 滑动到目标位置 */
  transition: none;

  &:active {
    cursor: grabbing;
  }

  &--active {
    --fab-scale: 0.95;
    /* 激活状态（点击缩放）时可以带一点过渡 */
    transition: transform 0.12s ease;
  }

  &--dragging {
    transition: none !important;
  }
}
</style>
