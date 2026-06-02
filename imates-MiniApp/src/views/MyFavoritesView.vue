<template>
  <view class="my-favorites-view">
    <!-- 顶部工具栏 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <image src="/static/icons/arrow.svg" mode="aspectFit" class="back-icon" />
      </view>
      <view class="tabs">
        <view
          v-for="item in navItems"
          :key="item.key"
          class="tab-item"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key"
        >
          <text>{{ item.label }}</text>
        </view>
      </view>
      <view class="header-right"></view>
    </view>

    <!-- 内容区域 -->
    <view class="content-area">
      <RubberBandList
        ref="listRef"
        class="list-container"
        :enable-refresh="true"
        :loading="isLoading"
        @refresh="handleRefresh"
      >
        <view v-if="displayList.length === 0 && !isLoading" class="empty-state">
          <image src="/static/icons/folder_open.svg" mode="aspectFit" class="empty-icon" />
          <text class="empty-text">暂无{{ activeTab === 'session' ? '会话' : '练习' }}收藏</text>
        </view>

        <view v-else class="favorites-list">
          <view
            v-for="item in displayList"
            :key="item.id"
            class="favorite-card"
            @click="handleItemClick(item)"
          >
            <view class="card-content">
              <view class="card-text">
                <rich-text :nodes="getItemContent(item)"></rich-text>
              </view>
              <text class="card-timestamp">{{ formatTimestamp(item.timestamp) }}</text>
            </view>
          </view>
        </view>
      </RubberBandList>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import RubberBandList from '../components/base/VirtualScroll.vue'
import { getFavoriteSessions, getFavoriteExercises } from '../utils/storage/favorites.js'

defineOptions({
  name: 'MyFavoritesView',
})

const activeTab = ref<'session' | 'exercise'>('session')
const qaFavorites = ref<any[]>([])
const exerciseFavorites = ref<any[]>([])
const isLoading = ref(false)
const listRef = ref(null)

const navItems = [
  { key: 'session', label: '会话收藏' },
  { key: 'exercise', label: '练习收藏' }
]

const displayList = computed(() => {
  return activeTab.value === 'session' ? qaFavorites.value : exerciseFavorites.value
})

const loadFavorites = async () => {
  isLoading.value = true
  try {
    if (activeTab.value === 'session') {
      qaFavorites.value = getFavoriteSessions().sort((a: any, b: any) => b.timestamp - a.timestamp)
    } else {
      exerciseFavorites.value = getFavoriteExercises().sort((a: any, b: any) => b.timestamp - a.timestamp)
    }
  } finally {
    isLoading.value = false
  }
}

const handleRefresh = async () => {
  await loadFavorites()
  if (listRef.value) {
    (listRef.value as any).finishRefresh()
  }
}

const handleItemClick = (item: any) => {
  if (activeTab.value === 'session') {
    uni.navigateTo({
      url: `/pages/chat/chat?sessionId=${item.session.sessionId}`
    })
  } else {
    uni.navigateTo({
      url: `/pages/exercise/solve?id=${item.item.bmNo || item.item.id}`
    })
  }
}

const getItemContent = (item: any) => {
  if (activeTab.value === 'session') {
    return item.session.sessionName || '未命名会话'
  }
  return item.item.question || item.item.title || '题目'
}

const formatTimestamp = (ts: number) => {
  const date = new Date(ts)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

const goBack = () => {
  uni.navigateBack()
}

watch(activeTab, () => {
  loadFavorites()
})

onMounted(() => {
  loadFavorites()
})
</script>

<style scoped>
.my-favorites-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f6f8ff;
}

.header {
  height: 100rpx;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  border-bottom: 2rpx solid #eee;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
}

.back-icon {
  width: 40rpx;
  height: 40rpx;
  transform: rotate(180deg);
}

.tabs {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 60rpx;
}

.tab-item {
  position: relative;
  padding: 20rpx 0;
  font-size: 30rpx;
  color: #999;
}

.tab-item.active {
  color: #333;
  font-weight: bold;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4rpx;
  background-color: #6e55ff;
  border-radius: 2rpx;
}

.header-right {
  width: 60rpx;
}

.content-area {
  flex: 1;
  overflow: hidden;
}

.list-container {
  height: 100%;
}

.favorites-list {
  padding: 24rpx;
}

.favorite-card {
  background-color: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.card-text {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 20rpx;
}

.card-timestamp {
  font-size: 24rpx;
  color: #999;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-icon {
  width: 200rpx;
  height: 200rpx;
  opacity: 0.5;
}

.empty-text {
  margin-top: 24rpx;
  font-size: 28rpx;
  color: #999;
}
</style>
