<template>
  <div class="app-container">
    <!-- 主展示区 -->
    <main class="main-wrapper">
      <div class="split-pane-root">
        <div 
          ref="containerRef"
          class="split-pane-container"
        >
          <!-- 左侧区域 -->
          <div
            class="pane-left"
            :class="{ 'dragging': isDragging }"
            :style="leftPaneStyle"
          >
            <!-- 左侧内容插槽 -->
            <slot name="left">
              <div class="placeholder-text">左侧区域插槽内容</div>
            </slot>
          </div>

          <!-- 右侧区域 -->
          <div
            class="pane-right"
            :class="{ 'is-hidden': !isRightVisible }"
            :style="rightPaneStyle"
          >
              <div class="pane-content-wrapper">
                <!-- 右侧内容插槽 -->
                <slot name="right">
                  <div class="placeholder-text">右侧区域插槽内容</div>
                </slot>
              </div>

              <!-- 拖拽热区 -->
              <div
                class="resizer"
                @mousedown="startDragging"
                @touchstart="startDragging"
              >
                <img :src="seekbarIcon" alt="拖动" class="splitter-handle" />
              </div>
          </div>
        </div>
      </div>

      <!-- 宽度调试面板（仅开发模式） -->
      <!-- <DualPanelDebugPanel
        :model-value="offset"
        @update:model-value="offset = $event"
        :min-offset="minOffset"
        @update:min-offset="minOffset = $event"
        :max-offset="maxOffset"
        @update:max-offset="maxOffset = $event"
      /> -->
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import seekbarIcon from '/icons/seekbar.svg';
import DualPanelDebugPanel from '../debug/DualPanelDebugPanel.vue';

// Props 和 Emits 定义 v-model
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: true
  },
  initialRatio: {
    type: Number,
    default: 60 // 默认修改为 60 (左 60%，右 40%)
  },
  minRatio: {
    type: Number,
    default: 30
  },
  maxRatio: {
    type: Number,
    default: 70 // 调高最大上限以支持更宽的比例适配
  }
});

const emit = defineEmits(['update:modelValue']);

// 核心状态 - 同步 v-model
const isRightVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});
const offset = ref(props.initialRatio); // 使用传入的初始比例初始化
const isDragging = ref(false);
const containerRef = ref(null);

const minOffset = props.minRatio; // 使用 Prop 控制最小左侧占比
const maxOffset = props.maxRatio; // 使用 Prop 控制最大左侧占比

// 计算样式
const leftPaneStyle = computed(() => ({
  width: isRightVisible.value ? `${offset.value}%` : '100%',
  transition: isDragging.value ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
}));

const rightPaneStyle = computed(() => ({
  width: isRightVisible.value ? `${100 - offset.value}%` : '0%',
  transition: isDragging.value ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  opacity: isRightVisible.value ? 1 : 0,
  pointerEvents: isRightVisible.value ? 'auto' : 'none'
}));

// 拖拽逻辑
const startDragging = (e) => {
  e.preventDefault();
  isDragging.value = true;
};

const stopDragging = () => {
  isDragging.value = false;
};

const onDrag = (e) => {
  if (!isDragging.value || !containerRef.value || !isRightVisible.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  
  let newOffset = ((clientX - rect.left) / rect.width) * 100;

  if (newOffset >= minOffset && newOffset <= maxOffset) {
    offset.value = newOffset;
  }
};

onMounted(() => {
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDragging);
  window.addEventListener('touchmove', onDrag);
  window.addEventListener('touchend', stopDragging);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDragging);
  window.removeEventListener('touchmove', onDrag);
  window.removeEventListener('touchend', stopDragging);
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f9fafb;
  font-family: system-ui, -apple-system, sans-serif;
  color: #111827;
  overflow: hidden;
  position: relative;
}

/* 主展示区 */
.main-wrapper {
  flex: 1;
  height: 100%;
}

.split-pane-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: white;
}

.split-pane-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  background: #fdfdfd;
}

/* 左侧面板 */
.pane-left {
  overflow: auto;
  position: relative;
  z-index: 0;
}

/* 拖拽时添加遮罩，防止 iframe 捕获鼠标事件 */
.pane-left.dragging::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: transparent;
}

/* 右侧面板 */
.pane-right {
  position: relative;
  display: flex;
  z-index: 20;
  overflow: hidden;
  will-change: width, opacity;
}

.pane-right.is-hidden {
  /* 隐藏时不占位但保持 DOM 存在以便动画 */
  border: none;
  box-shadow: none;
}

.pane-content-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  border-top-left-radius: 32px;
  border-bottom-left-radius: 32px;
  box-shadow: -20px 0 40px -15px rgba(0, 0, 0, 0.08);
}

/* 拖拽条 - 参考 SplitPanel 样式 */
.resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  margin-left: -20px;
  cursor: col-resize;
  z-index: 50;
  display: flex;
  justify-content: center;
  align-items: center;
  touch-action: none;
  pointer-events: auto;
}

.resizer::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  background: transparent;
  pointer-events: auto;
  z-index: 1;
}

.resizer .splitter-handle {
  position: relative;
  z-index: 2;
  width: 24px;
  height: 48px;
  transition: transform 0.3s ease;
  cursor: col-resize;
  user-select: none;
  pointer-events: none;
}

.resizer:hover .splitter-handle {
  transform: scale(1.1);
}

/* 插槽占位样式 */
.placeholder-text {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  font-style: italic;
  font-size: 14px;
}

</style>