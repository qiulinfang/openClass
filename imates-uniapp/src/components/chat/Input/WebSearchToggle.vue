<template>
  <view
    class="web-search-toggle"
    :class="{ active: enableWebSearch }"
    @click="toggleSearch"
  >
    <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
    <text class="search-label">联网搜索</text>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  enableWebSearch: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-web-search'): void
}>()

const toggleSearch = () => {
  emit('toggle-web-search')
}
</script>

<style lang="scss" scoped>
.web-search-toggle {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 24rpx;
  color: #64748b;
  background-color: #f1f5f9;
  border-radius: 32rpx;
  padding: 10rpx 22rpx;
  font-weight: 500;
  transition: all 0.2s ease;

  &.active {
    background-color: #f0f2fe;
    border: 1px solid #e0e4ff;
    color: #7a7cff;
    font-weight: 600;

    .search-icon {
      stroke: #7a7cff;
    }
  }

  &:active {
    opacity: 0.85;
  }
}

.search-icon {
  stroke: #64748b;
}
</style>
