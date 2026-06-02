<template>
  <scroll-view
    class="rubber-band-scroll-view no-scrollbar"
    scroll-y
    :scroll-top="scrollTopVal"
    :refresher-enabled="enableRefresh"
    :refresher-triggered="isRefreshing"
    @refresherrefresh="onRefresherRefresh"
    @scrolltolower="onScrollToLower"
    @scroll="onScroll"
  >
    <view class="content-wrapper">
      <!-- 内容插槽 -->
      <slot></slot>

      <!-- 底部加载更多状态插槽 -->
      <view class="list-footer">
        <slot name="footer">
          <view v-if="loading" class="loading-more">
            <view class="spinner"></view>
            <text>正在加载...</text>
          </view>
        </slot>
      </view>
    </view>
  </scroll-view>
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

const isRefreshing = ref(false)
const scrollTopVal = ref(0)

const scrollToTop = () => {
  scrollTopVal.value = scrollTopVal.value === 0 ? 0.01 : 0
}

const onRefresherRefresh = () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  emit('refresh')
}

const onScrollToLower = () => {
  if (props.enableLoadMore && !props.loading) {
    emit('loadMore')
  }
}

const onScroll = (e: any) => {
  if (props.enableLoadTop && e.detail.scrollTop <= props.loadTopThreshold) {
    emit('loadTop')
  }
}

const finishRefresh = () => {
  isRefreshing.value = false
}

defineExpose({ finishRefresh, scrollToTop })
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

.spinner {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: #3b82f6;
  animation: spin 1s linear infinite;
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