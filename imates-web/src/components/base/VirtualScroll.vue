<template>
  <div 
    ref="scrollContainerRef" 
    class="rubber-band-scroll-view no-scrollbar"
    @scroll="handleScroll"
  >
    <div 
      ref="wrapperRef" 
      class="content-wrapper"
    >
      <!-- 顶部刷新指示器 -->
      <div class="refresh-indicator" v-if="enableRefresh">
        <div class="indicator-content">
          <svg v-if="isRefreshing" class="icon spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg
            v-else
            class="icon arrow"
            :style="{ transform: `rotate(${pullProgress * 180}deg)` }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
          </svg>
          <span class="text">{{ refreshText }}</span>
        </div>
      </div>

      <!-- 内容插槽 -->
      <slot></slot>

      <!-- 底部加载更多状态插槽 -->
      <div class="list-footer">
        <slot name="footer">
          <div v-if="loading" class="loading-more">
            <svg class="icon spin small" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>正在加载...</span>
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {}
</script>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  maxDrag: { type: Number, default: 200 },
  dampingFactor: { type: Number, default: 0.6 },

  // 下拉刷新
  enableRefresh: { type: Boolean, default: false },
  refreshThreshold: { type: Number, default: 100 },

  // 自动加载更多（底部）
  enableLoadMore: { type: Boolean, default: false },
  loadMoreThreshold: { type: Number, default: 50 },

  // 自动加载更多（顶部）
  enableLoadTop: { type: Boolean, default: false },
  loadTopThreshold: { type: Number, default: 50 },

  loading: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'loadMore'): void
  (e: 'loadTop'): void
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)
const wrapperRef = ref<HTMLElement | null>(null)

const isRefreshing = ref(false)
const pullProgress = ref(0)

let startY = 0
let currentTranslateY = 0
let isDragging = false

const refreshText = computed(() => {
  if (!props.enableRefresh) return ''
  if (isRefreshing.value) return '正在刷新...'
  return currentTranslateY > props.refreshThreshold ? '释放刷新' : '下拉刷新'
})

const handleScroll = (e: Event) => {
  if (isRefreshing.value || props.loading) return

  const target = e.target as HTMLElement
  const { scrollTop, clientHeight, scrollHeight } = target

  // 检查顶部加载
  if (props.enableLoadTop && scrollTop <= props.loadTopThreshold) {
    emit('loadTop')
  }

  // 检查底部加载
  if (props.enableLoadMore) {
    const distanceToBottom = scrollHeight - scrollTop - clientHeight
    if (distanceToBottom <= props.loadMoreThreshold + 1) {
      emit('loadMore')
    }
  }
}

const calculateDamping = (distance: number) => {
  const screenHeight = window.innerHeight
  const damping =
    (1 - Math.exp(-Math.abs(distance) / (screenHeight * props.dampingFactor))) *
    props.maxDrag
  return damping * (distance > 0 ? 1 : -1)
}

const startDrag = (y: number) => {
  if (isRefreshing.value) return
  isDragging = true
  startY = y
  if (wrapperRef.value) {
    wrapperRef.value.classList.remove('spring-back')
  }
}

const moveDrag = (y: number, e: TouchEvent | MouseEvent) => {
  if (!isDragging || !scrollContainerRef.value || !wrapperRef.value) return
  if (isRefreshing.value) return

  const container = scrollContainerRef.value
  const deltaY = y - startY
  const { scrollTop, scrollHeight, clientHeight } = container

  const isPullingDown = scrollTop <= 0 && deltaY > 0
  const isPullingUp =
    scrollTop + clientHeight >= scrollHeight - 1 && deltaY < 0 && !props.loading

  if (isPullingDown || isPullingUp) {
    if ('cancelable' in e && e.cancelable) e.preventDefault()
    currentTranslateY = calculateDamping(deltaY)
    wrapperRef.value.style.transform = `translate3d(0, ${currentTranslateY}px, 0)`

    if (props.enableRefresh && isPullingDown) {
      pullProgress.value = Math.min(currentTranslateY / props.refreshThreshold, 1)
    }
  } else {
    currentTranslateY = 0
    pullProgress.value = 0
    wrapperRef.value.style.transform = 'translate3d(0, 0, 0)'
    startY = y
  }
}

const endDrag = () => {
  if (!isDragging) return
  isDragging = false
  pullProgress.value = 0

  if (!wrapperRef.value) return

  if (
    props.enableRefresh &&
    currentTranslateY > props.refreshThreshold &&
    !isRefreshing.value
  ) {
    isRefreshing.value = true
    wrapperRef.value.classList.add('spring-back')
    wrapperRef.value.style.transform = `translate3d(0, ${props.refreshThreshold}px, 0)`
    emit('refresh')
  } else if (currentTranslateY !== 0) {
    wrapperRef.value.classList.add('spring-back')
    wrapperRef.value.style.transform = 'translate3d(0, 0, 0)'
    currentTranslateY = 0
  }
}

const finishRefresh = () => {
  isRefreshing.value = false
  currentTranslateY = 0
  if (wrapperRef.value) {
    wrapperRef.value.classList.add('spring-back')
    wrapperRef.value.style.transform = 'translate3d(0, 0, 0)'
  }
}

defineExpose({ finishRefresh, scrollContainerRef })

const handleTouchStart = (e: TouchEvent) => startDrag(e.touches[0].clientY)
const handleTouchMove = (e: TouchEvent) => moveDrag(e.touches[0].clientY, e)
const handleTouchEnd = () => endDrag()

const handleMouseDown = (e: MouseEvent) => startDrag(e.clientY)
const handleMouseMove = (e: MouseEvent) => moveDrag(e.clientY, e)
const handleMouseUp = () => endDrag()

onMounted(() => {
  const el = scrollContainerRef.value
  if (el) {
    el.addEventListener('touchstart', handleTouchStart, { passive: false })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)

    el.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }
})

onUnmounted(() => {
  const el = scrollContainerRef.value
  if (el) {
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('touchcancel', handleTouchEnd)
    el.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
})
</script>


<style scoped>
.rubber-band-scroll-view {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  position: relative;
  overscroll-behavior-y: none;
  touch-action: pan-y;
}

.content-wrapper {
  min-height: 100%;
  position: relative;
  will-change: transform;
}

/* 隐藏滚动条 */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* 回弹动画曲线 */
.spring-back {
  transition: transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* 顶部刷新指示器 */
.refresh-indicator {
  position: absolute;
  top: -60px;
  left: 0;
  width: 100%;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.indicator-content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 0.875rem;
}

.icon {
  width: 20px;
  height: 20px;
}

.icon.small {
  width: 16px;
  height: 16px;
}

.icon.spin {
  color: #3b82f6;
  animation: spin 1s linear infinite;
}

.icon.arrow {
  transition: transform 0.3s;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 底部加载更多区域样式 */
.list-footer {
  padding: 16px 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.loading-more {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 0.875rem;
}
</style>