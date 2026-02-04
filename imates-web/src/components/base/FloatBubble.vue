<template>
  <div class="bubble-container" ref="containerRef">
    <FloatBubbleDebugPanel
      v-if="isDev"
      :visible="debugPanelVisible"
      :debug="debug"
      @update:visible="(v) => (debugPanelVisible = v)"
      @update:debug="(v) => Object.assign(debug, v)"
    />

    <!-- 气泡菜单 -->
    <transition name="bubble-pop">
      <div 
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
          
          <!-- 文本标签 -->
          <span class="item-label">{{ item.label }}</span>
        </div>
      </div>
    </transition>

    <!-- 触发器插槽 -->
    <div
      class="trigger-wrapper"
      :class="{ pressed: isPressed }"
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
import FloatBubbleDebugPanel from './FloatBubbleDebugPanel.vue'

// --- Props 定义 (简化版) ---
const props = defineProps({
  // 菜单数据配置: [{ label: string, icon: string }]
  items: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select'])
const isVisible = ref(false)
const isPressed = ref(false)
const containerRef = ref(null)

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
  forceVisible: false,
  disableOutsideClose: false,
  // 菜单项绝对定位：[{x: number, y: number}, ...]
  itemPositions: [{ x: 64, y: 32 }, { x: 74, y: 120 }],
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

const getItemStyle = (index) => {
  const pos = debug.itemPositions[index] || { x: 50, y: 40 }
  return {
    position: 'absolute',
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  }
}

const toggleMenu = () => {
  if (isDev && debug.forceVisible) return
  isVisible.value = !isVisible.value
}

const handlePressStart = () => {
  isPressed.value = true
}

const handlePressEnd = () => {
  isPressed.value = false
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
})

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
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

/* 左侧布局 */
.bubble-menu.left {
  right: 100%;
  transform-origin: center right;
}

.bubble-menu.right {
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
}

.menu-item:hover {
  transform: scale(1.05);
}

.item-label {
  color: #939292ac;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 1px;
}

.icon-image {
  width: 50px;
  height: 50px;
  object-fit: contain;
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