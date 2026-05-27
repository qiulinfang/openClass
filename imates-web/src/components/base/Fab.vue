<template>
  <div class="bubble-container" ref="containerRef">
    <FloatBubbleDebugPanel
      v-if="isDev"
      :visible="debugPanelVisible"
      :debug="debug"
      @update:visible="(v) => (debugPanelVisible = v)"
      @update:debug="(v) => Object.assign(debug, v)"
    />

    <!-- 拖动调试面板 -->
    <DragDebugPanel
      v-if="isDev"
      :visible="dragDebugVisible"
      :config="dragDebugConfig"
      :drag-state="{ isDragging, dragStartY, dragOffsetY, persistentOffsetY }"
      @update:visible="(v) => (dragDebugVisible = v)"
      @update:config="(v) => Object.assign(dragDebugConfig, v)"
      @reset-position="handleResetPosition"
      @apply-position="handleApplyPosition"
    />

    <!-- 气泡菜单 -->
    <transition name="bubble-pop">
      <div
        v-if="isSingleItem"
        v-show="menuVisible"
        class="bubble-menu-single"
        :class="bubbleSideClass"
        :style="bubbleMenuSingleStyle"
        @click="handleItemClick(items[0])"
      >
        <img :src="items[0].icon" class="single-icon" :style="singleIconStyle" alt="" />
        <span class="single-label" :style="singleLabelStyle">{{ items[0].label }}</span>
      </div>
      <div
        v-else
        v-show="menuVisible"
        class="bubble-menu"
        :class="bubbleSideClass"
        :style="bubbleMenuStyle"
      >
        <div 
          v-for="(item, index) in items" 
          :key="index" 
          class="menu-item"
          :style="getItemStyle(index)"
          @click="handleItemClick(item)"
        >
          <img :src="item.icon" class="icon-image" alt="" />
        </div>
      </div>
    </transition>

    <!-- 触发器插槽 -->
    <div
      class="trigger-wrapper"
      :class="{ pressed: isPressed, dragging: isDragging }"
      :style="{ transform: `translateY(${persistentOffsetY + dragOffsetY}px)` }"
      @click.stop="toggleMenu"
      @mousedown.stop="handlePressStart"
      @mouseup.stop="handlePressEnd"
      @mouseleave.stop="handlePressEnd"
      @touchstart.stop="handlePressStart"
      @touchend.stop="handlePressEnd"
      @touchcancel.stop="handlePressEnd"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, reactive } from 'vue'
import FloatBubbleDebugPanel from '../chat/FloatBubbleDebugPanel.vue'
import DragDebugPanel from '../debug/DragDebugPanel.vue'

// --- Props 定义 (简化版) ---
const props = defineProps({
  // 菜单数据配置: [{ label: string, icon: string }]
  items: {
    type: Array,
    default: () => []
  },
  // 是否只作为切换按钮使用（不弹出菜单，点击直接触发 toggle 事件）
  toggleOnly: {
    type: Boolean,
    default: false
  },
  // 是否启用拖动
  draggable: {
    type: Boolean,
    default: true
  },
  // 拖动范围限制：最小 Y 偏移（负数表示向上拖动）
  dragMinY: {
    type: Number,
    default: -300
  },
  // 拖动范围限制：最大 Y 偏移（正数表示向下拖动）
  dragMaxY: {
    type: Number,
    default: 300
  }
})

const items = computed(() => props.items || [])
const isSingleItem = computed(() => items.value.length === 1)

const emit = defineEmits(['select', 'toggle'])
const isVisible = ref(false)
const isPressed = ref(false)
const containerRef = ref(null)

// 拖动相关状态
const isDragging = ref(false)
const dragStartY = ref(0)
const dragOffsetY = ref(0)
const persistentOffsetY = ref(0)

const isDev = import.meta.env.DEV
const debugPanelVisible = ref(false)
const debug = reactive({
  side: 'left',
  width: 200,
  height: 211,
  gap: 25,
  paddingX: 20,
  paddingY: 22,
  offsetX: 56,
  offsetY: -18,
  zIndex: 10,
  singleWidth: 76,
  singleHeight: 76,
  singleOffsetX: 0,
  singleOffsetY: -18,
  singleIconSize: 32,
  singleFontSize: 12,
  singleLabelGap: 6,
  forceVisible: false,
  disableOutsideClose: false,
  // 菜单项绝对定位：[{x: number, y: number}, ...]
  itemPositions: [{ x: 69, y: 32 }, { x: 72, y: 120 }],
  itemRotations: [28, -28],
})

// 拖动调试面板
const dragDebugVisible = ref(false)
const dragDebugConfig = reactive({
  minY: -300,
  maxY: 30,
  enableLimit: false,
})

const menuVisible = computed(() => (isDev && debug.forceVisible ? true : isVisible.value))

const bubbleSideClass = computed(() => {
  return debug.side === 'right' ? 'right' : 'left'
})

const bubbleMenuStyle = computed(() => {
  return {
    width: `${debug.width}px`,
    height: `${debug.height}px`,
    gap: `${debug.gap}px`,
    padding: `${debug.paddingY}px ${debug.paddingX}px`,
    zIndex: String(debug.zIndex),
    backgroundImage: `url('/icons/qipao_coagao.svg')`,
    '--bubble-offset-x': `${debug.offsetX}px`,
    '--bubble-offset-y': `${debug.offsetY}px`,
    '--bubble-enter-x': debug.side === 'right' ? '-100px' : '100px',
  }
})

const bubbleMenuSingleStyle = computed(() => {
  return {
    width: `${debug.singleWidth}px`,
    height: `${debug.singleHeight}px`,
    zIndex: String(debug.zIndex),
    '--bubble-offset-x': `${debug.singleOffsetX}px`,
    '--bubble-offset-y': `${debug.singleOffsetY}px`,
    '--bubble-enter-x': debug.side === 'right' ? '-100px' : '100px',
  }
})

const singleIconStyle = computed(() => {
  return {
    width: `${debug.singleIconSize}px`,
  }
})

const singleLabelStyle = computed(() => {
  return {
    marginTop: `${debug.singleLabelGap}px`,
    fontSize: `${debug.singleFontSize}px`,
  }
})

const getItemStyle = (index) => {
  const pos = debug.itemPositions[index] || { x: 50, y: 40 }
  const item = props.items?.[index] || {}
  const rotate =
    typeof debug.itemRotations?.[index] === 'number'
      ? debug.itemRotations[index]
      : typeof item.rotate === 'number'
        ? item.rotate
        : typeof item.rotation === 'number'
          ? item.rotation
          : 0
  return {
    position: 'absolute',
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    '--item-rotate': `${rotate}deg`,
  }
}

const toggleMenu = () => {
  if (isDev && debug.forceVisible) return
  // 如果 toggleOnly 模式，直接触发 toggle 事件而不显示菜单
  if (props.toggleOnly) {
    emit('toggle')
    return
  }
  isVisible.value = !isVisible.value
}

const handlePressStart = (event) => {
  isPressed.value = true
  // 只有启用了拖动才进入拖动状态
  if (props.draggable) {
    isDragging.value = true
    dragStartY.value = event.clientY || event.touches?.[0]?.clientY || 0
    dragOffsetY.value = 0
  }
}

const handlePressEnd = () => {
  isPressed.value = false
  isDragging.value = false
  // 如果拖动距离很小（小于5px），视为点击，不保存位置
  if (Math.abs(dragOffsetY.value) < 5) {
    dragOffsetY.value = 0
    return
  }
  // 保存拖动后的位置
  persistentOffsetY.value += dragOffsetY.value
  dragOffsetY.value = 0
}

const handleDrag = (event) => {
  if (!isDragging.value || !props.draggable) return

  const currentY = event.clientY || event.touches?.[0]?.clientY || 0
  const deltaY = currentY - dragStartY.value

  // 应用范围限制
  const totalOffset = persistentOffsetY.value + deltaY
  // 限制在最小值和最大值之间
  const clampedOffset = Math.max(props.dragMinY, Math.min(props.dragMaxY, totalOffset))
  dragOffsetY.value = clampedOffset - persistentOffsetY.value
}

// 全局拖动事件监听
const handleGlobalMouseMove = (event) => {
  handleDrag(event)
}

const handleGlobalTouchMove = (event) => {
  handleDrag(event)
}

const handleGlobalMouseUp = () => {
  handlePressEnd()
}

const handleGlobalTouchEnd = () => {
  handlePressEnd()
}

// 调试面板处理函数
const handleResetPosition = () => {
  persistentOffsetY.value = 0
  dragOffsetY.value = 0
}

const handleApplyPosition = (pos) => {
  persistentOffsetY.value = pos
  dragOffsetY.value = 0
}

const closeMenu = () => {
  if (isDev && debug.forceVisible) return
  isVisible.value = false
}

const handleItemClick = (item) => {
  emit('select', item)
  closeMenu()
}

// 点击外部关闭逻辑
const handleClickOutside = (event) => {
  if (isDev && debug.disableOutsideClose) return
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    closeMenu()
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
  // 添加全局拖动事件监听
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('touchmove', handleGlobalTouchMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
  window.addEventListener('touchend', handleGlobalTouchEnd)
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
  // 移除全局拖动事件监听
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('touchmove', handleGlobalTouchMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
  window.removeEventListener('touchend', handleGlobalTouchEnd)
})
</script>

<style scoped>
.bubble-container {
  position: relative;
  display: inline-block; /* 关键：包裹内容 */
}

.trigger-wrapper {
  cursor: pointer;
  position: relative;
  z-index: 20;
  transition: transform 0.12s ease;
  transform-origin: center;
}

.trigger-wrapper.pressed {
  transform: scale(0.9);
}

.trigger-wrapper.dragging {
  cursor: grabbing;
  transition: none;
  user-select: none;
}

/* --- 气泡菜单样式 --- */
.bubble-menu {
  position: absolute;
  top: 50%;
  --bubble-offset-x: 0px;
  --bubble-offset-y: 0px;
  --bubble-enter-x: 100px;
  transform: translateY(-50%) translate(var(--bubble-offset-x), var(--bubble-offset-y));
  background-repeat: no-repeat;
  background-size: contain;
  background-position: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.bubble-menu-single {
  position: absolute;
  top: 50%;
  --bubble-offset-x: 0px;
  --bubble-offset-y: 0px;
  --bubble-enter-x: 100px;
  transform: translateY(-50%) translate(var(--bubble-offset-x), var(--bubble-offset-y));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-image: none;
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 0;
  gap: 0;
  backdrop-filter: blur(6px);
  cursor: pointer;
}

/* 左侧布局 */
.bubble-menu.left {
  right: 100%;
  transform-origin: center right;
}

.bubble-menu-single.left {
  right: 100%;
  transform-origin: center right;
}

.bubble-menu.right {
  left: 100%;
  transform-origin: center left;
}

.bubble-menu-single.right {
  left: 100%;
  transform-origin: center left;
}

/* 菜单项样式 */
.menu-item {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
  transform: rotate(var(--item-rotate, 0deg));
  transform-origin: center;
}

.menu-item:hover:not(.single) {
  transform: rotate(var(--item-rotate, 0deg)) scale(1.05);
}

.icon-image {
  width: 50px;
  object-fit: contain;
}

.single-icon {
  width: 32px;
  object-fit: contain;
}

.single-label {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: rgba(124, 92, 255, 0.95);
}

/* --- 动画 --- */
.bubble-pop-enter-active,
.bubble-pop-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2);
}

.bubble-pop-enter-from,
.bubble-pop-leave-to {
  opacity: 0;
  transform: translateY(-50%) translate(var(--bubble-offset-x), var(--bubble-offset-y)) scale(0.1) translateX(var(--bubble-enter-x));
}

.bubble-pop-enter-to,
.bubble-pop-leave-from {
  opacity: 1;
  transform: translateY(-50%) translate(var(--bubble-offset-x), var(--bubble-offset-y)) scale(1) translateX(0);
}
</style>