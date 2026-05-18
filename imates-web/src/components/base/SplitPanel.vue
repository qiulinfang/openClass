<template>
  <div class="split-panel-container">
    <!-- 核心工作区 -->
    <div ref="workspaceRef" class="split-panel-workspace"
      @pointerup="handlePointerUp"
    >
      <div
        v-if="containerWidth > 0"
        class="split-panel-track"
        :style="{
          transform: `translateX(${offsetX}px)`,
          transition: `transform ${transitionDuration}s ${transitionEasing}`,
          pointerEvents: isLocked ? 'none' : 'auto'
        }"
      >
        <!-- 区域 1 (左侧) -->
        <div
          :style="{ width: w1Px + 'px' }"
          class="split-panel-col col-1"
          :class="{ 'no-transition': isDragging }"
        >
          <div class="split-panel-col-body">
            <slot name="left" :width="w1Px" :percent="p1" :isVisible="mode === 'left'" />
          </div>
        </div>

        <!-- 分隔条 1 -->
        <div
          class="split-panel-splitter"
          :class="{ 'splitter-hidden': mode === 'right' || !showSplitters, 'no-transition': isDragging }"
          :style="{ left: w1Px + 'px' }"
          @pointerdown="handleDrag1"
        >
          <img :src="seekbarIcon" alt="拖动" class="splitter-handle" />
        </div>

        <!-- 区域 2 (中间) -->
        <div
          :style="{ width: w2Px + 'px' }"
          class="split-panel-col col-2"
          :class="{ 'no-transition': isDragging }"
        >
          <div class="split-panel-col-body">
            <slot name="center" :width="w2Px" :percent="p2" />
          </div>
        </div>

        <!-- 分隔条 2 -->
        <div
          class="split-panel-splitter"
          :class="{ 'splitter-hidden': mode === 'left' || !showSplitters, 'no-transition': isDragging }"
          :style="{ left: w1Px + w2Px + 'px' }"
          @pointerdown="handleDrag2"
        >
          <img :src="seekbarIcon" alt="拖动" class="splitter-handle" />
        </div>

        <!-- 区域 3 (右侧) -->
        <div
          :style="{ width: w3Px + 'px' }"
          class="split-panel-col col-3"
          :class="{ 'no-transition': isDragging }"
        >
          <div class="split-panel-col-body">
            <slot name="right" :width="w3Px" :percent="p3" :isVisible="mode === 'right'" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, useSlots } from 'vue';
import seekbarIcon from '/icons/seekbar.svg';

interface Props {
  initialMode?: 'left' | 'right';
  /** 左侧面板配置: [默认%, 最小%, 最大%] */
  leftConfig?: [number, number, number];
  /** 中间面板配置: [默认%, 最小%, 最大%] */
  centerConfig?: [number, number, number];
  /** 右侧面板配置: [默认%, 最小%, 最大%] */
  rightConfig?: [number, number, number];
  transitionDuration?: number;
  transitionEasing?: string;
  showSplitters?: boolean;
  splitterClass?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  initialMode: 'left',
  leftConfig: () => [30, 30, 50],
  centerConfig: () => [70, 65, 70],
  rightConfig: () => [40, 35, 50],
  transitionDuration: 0.5,
  transitionEasing: 'cubic-bezier(0.3, 0.9, 0.4, 1.05)',
  showSplitters: true,
  splitterClass: '',
  disabled: false
});

interface Emits {
  (e: 'modeChange', mode: 'left' | 'right'): void;
  (e: 'resize', width: number): void;
  (e: 'toggle', mode: 'left' | 'right'): void;
}

const emit = defineEmits<Emits>();
const slots = useSlots();

const workspaceRef = ref<HTMLDivElement | null>(null);
const containerWidth = ref<number>(0);

const p1 = ref<number>(props.leftConfig[0]);
const p2 = ref<number>(props.centerConfig[0]);
const p3 = ref<number>(props.rightConfig[0]);

const mode = ref<'left' | 'right'>(props.initialMode);
const isLocked = ref<boolean>(false);

let resizeObserver: ResizeObserver | null = null;
let dragFrameId: number | null = null;
let pendingClientX: number | null = null;
let activePointerId: number | null = null;
let activeDragElement: Element | null = null;

onMounted(() => {
  if (workspaceRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      containerWidth.value = entries[0].contentRect.width;
      emit('resize', containerWidth.value);
    });
    resizeObserver.observe(workspaceRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  removeDragListeners();

  if (dragFrameId !== null) {
    cancelAnimationFrame(dragFrameId);
    dragFrameId = null;
  }
});

const handleToggle = () => {
  if (isLocked.value || props.disabled) return;

  isLocked.value = true;
  setTimeout(() => {
    isLocked.value = false;
  }, props.transitionDuration * 1000);

  if (mode.value === 'left') {
    // 切换到 AI 模式：right 使用其默认比例
    const targetRight = props.rightConfig[0];
    p3.value = targetRight;
    p2.value = 100 - targetRight;
    mode.value = 'right';
  } else {
    // 切换到题目模式：left 使用其默认比例
    const targetLeft = props.leftConfig[0];
    p1.value = targetLeft;
    p2.value = 100 - targetLeft;
    mode.value = 'left';
  }

  emit('toggle', mode.value);
  emit('modeChange', mode.value);
};

const dragState = ref<{
  isDragging: boolean;
  splitterIndex: number | null;
  startX: number;
  startP1: number;
  startP2: number;
}>({
  isDragging: false,
  splitterIndex: null,
  startX: 0,
  startP1: 0,
  startP2: 0
});

const isDragging = computed(() => dragState.value.isDragging);

const updateDragLayout = (clientX: number) => {
  const currentWidth = containerWidth.value;
  if (!currentWidth) return;

  const deltaX = clientX - dragState.value.startX;
  const deltaP = (deltaX / currentWidth) * 100;

  if (dragState.value.splitterIndex === 1) {
    const leftMax = Math.min(props.leftConfig[2], 100 - props.centerConfig[1]);
    const newP1 = Math.max(props.leftConfig[1], Math.min(dragState.value.startP1 + deltaP, leftMax));

    if (newP1 !== p1.value) {
      p1.value = newP1;
      p2.value = 100 - newP1;
    }
  } else if (dragState.value.splitterIndex === 2) {
    const centerMax = Math.min(props.centerConfig[2], 100 - props.rightConfig[1]);
    const newP2 = Math.max(props.centerConfig[1], Math.min(dragState.value.startP2 + deltaP, centerMax));

    if (newP2 !== p2.value) {
      p2.value = newP2;
      p3.value = 100 - newP2;
    }
  }
};

const flushDragFrame = () => {
  dragFrameId = null;

  if (!dragState.value.isDragging || pendingClientX === null) {
    return;
  }

  updateDragLayout(pendingClientX);
};

const scheduleDragUpdate = (clientX: number) => {
  pendingClientX = clientX;

  if (dragFrameId !== null) {
    return;
  }

  dragFrameId = requestAnimationFrame(flushDragFrame);
};

const handleWindowPointerMove = (e: PointerEvent) => {
  if (!dragState.value.isDragging) return;
  if (activePointerId !== null && e.pointerId !== activePointerId) return;

  scheduleDragUpdate(e.clientX);
};

const removeDragListeners = () => {
  window.removeEventListener('pointermove', handleWindowPointerMove);
  window.removeEventListener('pointerup', handlePointerUp);
  window.removeEventListener('pointercancel', handlePointerUp);
};

const addDragListeners = () => {
  removeDragListeners();
  window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);
};

const handleDrag1 = (e: PointerEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (isLocked.value || !props.showSplitters || props.disabled) return;

  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  activePointerId = e.pointerId;
  activeDragElement = e.currentTarget as Element;

  dragState.value = {
    isDragging: true,
    splitterIndex: 1,
    startX: e.clientX,
    startP1: p1.value,
    startP2: p2.value
  };

  addDragListeners();
};

const handleDrag2 = (e: PointerEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (isLocked.value || !props.showSplitters || props.disabled) return;

  (e.currentTarget as Element).setPointerCapture(e.pointerId);
  activePointerId = e.pointerId;
  activeDragElement = e.currentTarget as Element;

  dragState.value = {
    isDragging: true,
    splitterIndex: 2,
    startX: e.clientX,
    startP1: p1.value,
    startP2: p2.value
  };

  addDragListeners();
};

const handlePointerUp = (e?: PointerEvent) => {
  removeDragListeners();

  if (dragFrameId !== null) {
    cancelAnimationFrame(dragFrameId);
    dragFrameId = null;
  }

  if (pendingClientX !== null && dragState.value.isDragging) {
    updateDragLayout(pendingClientX);
  }

  if (e) {
    try {
      if (activeDragElement && activePointerId !== null) {
        activeDragElement.releasePointerCapture(activePointerId);
      }
    } catch {}
  }

  pendingClientX = null;
  activePointerId = null;
  activeDragElement = null;
  dragState.value.isDragging = false;
  dragState.value.splitterIndex = null;
};

// 暴露方法给父组件
interface Exposed {
  toggle: () => void;
  setMode: (newMode: 'left' | 'right') => void;
  getMode: () => 'left' | 'right';
  getWidths: () => { left: number; center: number; right: number };
}

defineExpose<Exposed>({
  toggle: handleToggle,
  setMode: (newMode: 'left' | 'right') => {
    if (newMode === mode.value) return;
    handleToggle();
  },
  getMode: () => mode.value,
  getWidths: () => ({
    left: w1Px.value,
    center: w2Px.value,
    right: w3Px.value
  })
});

const w1Px = computed(() => (p1.value / 100) * containerWidth.value);
const w2Px = computed(() => (p2.value / 100) * containerWidth.value);
const w3Px = computed(() => (p3.value / 100) * containerWidth.value);

const offsetX = computed(() => {
  const targetOffset = mode.value === 'left' ? 0 : -w1Px.value;
  return targetOffset;
});
</script>

<style scoped>
/* 核心布局样式 */
.split-panel-container {
  height: 100%;
  width: 100%;
  position: relative;
  overflow: hidden;
  background-color: #f8fafc;
  color: #1e293b;
  font-family: system-ui, -apple-system, sans-serif;
}

.split-panel-workspace {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background-color: #f8fafc;
  contain: layout paint;
}

.split-panel-track {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  width: max-content;
  height: 100%;
  will-change: transform;
  transform: translateZ(0);
}

.split-panel-col {
  height: 100%;
  flex-shrink: 0;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  transition: width 0.5s ease-in-out;
  will-change: width;
  contain: layout paint;
}

.split-panel-col.no-transition {
  transition: none;
}

.split-panel-col-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.col-1 { background-color: #ffffff}
.col-2 { background-color: rgba(248, 250, 252, 0.5); }
.col-3 { background-color: #ffffff}

.split-panel-splitter {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  margin-left: -20px;
  cursor: col-resize;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: left 0.5s ease-in-out, opacity 0.3s;
  touch-action: none;
  pointer-events: auto;
  will-change: left;
}

.split-panel-splitter::before {
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

.split-panel-splitter .splitter-handle {
  position: relative;
  z-index: 2;
}

.split-panel-splitter.no-transition {
  transition: opacity 0.3s;
}

.splitter-hidden {
  opacity: 0;
  pointer-events: none;
}

.splitter-hidden::before {
  pointer-events: none;
}

.splitter-handle {
  width: 24px;
  height: 48px;
  transition: transform 0.3s ease;
  cursor: col-resize;
  user-select: none;
  pointer-events: none;
}

.split-panel-splitter:hover .splitter-handle {
  transform: scale(1.1);
}
</style>
