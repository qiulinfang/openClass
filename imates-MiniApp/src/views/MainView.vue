<template>
  <view class="main-view">
    <!-- 内容区域 -->
    <view class="content-area">
      <slot></slot>
    </view>

    <!-- 自定义底部导航（针对小程序适配） -->
    <view class="tab-bar" v-if="showTabBar">
      <view
        v-for="item in navItems"
        :key="item.key"
        class="tab-item"
        :class="{ active: activeNavItem === item.key }"
        @click="handleNavItemClick(item)"
      >
        <image :src="getNavIcon(item)" mode="aspectFit" class="tab-icon" />
        <text class="tab-label">{{ item.label }}</text>
        <view class="badge" v-if="item.key === 'toolbox' && unreadCount > 0">
          {{ unreadCount }}
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore'

defineOptions({
  name: 'MainView',
})

const userStore = useUserStore()
const activeNavItem = ref('knowledge')
const showTabBar = ref(true)

const unreadCount = computed(() => 0) // 占位

const navItems = [
  { key: 'knowledge', label: '知识图谱', icon: '/static/icons/knowledge_graph.svg', activeIcon: '/static/icons/knowledge_graph_select.svg', route: '/pages/knowledge/graph' },
  { key: 'exercises', label: '我的习题', icon: '/static/icons/my_exercises.svg', activeIcon: '/static/icons/my_exercises_select.svg', route: '/pages/exercise/list' },
  { key: 'homework', label: '我的作业', icon: '/static/icons/homework.png', activeIcon: '/static/icons/homework_select.png', route: '/pages/homework/list' },
  { key: 'mistakeBook', label: '错题本', icon: '/static/icons/cuotiben.svg', activeIcon: '/static/icons/cuotiben_select.svg', route: '/pages/mistakes/list' },
  { key: 'profile', label: '个人中心', icon: '/static/icons/avatar.svg', activeIcon: '/static/icons/avatar.svg', route: '/pages/profile/profile' }
]

const getNavIcon = (item: any) => {
  return activeNavItem.value === item.key ? item.activeIcon : item.icon
}

const handleNavItemClick = (item: any) => {
  activeNavItem.value = item.key
  uni.switchTab({
    url: item.route,
    fail: () => {
      uni.navigateTo({ url: item.route })
    }
  })
}

onMounted(() => {
  // 初始化逻辑
})
</script>

<style scoped>
.main-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.content-area {
  flex: 1;
  overflow: hidden;
}

.tab-bar {
  height: 120rpx;
  background-color: #ffffff;
  display: flex;
  border-top: 2rpx solid #eee;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.tab-icon {
  width: 48rpx;
  height: 48rpx;
  margin-bottom: 4rpx;
}

.tab-label {
  font-size: 20rpx;
  color: #999;
}

.tab-item.active .tab-label {
  color: #6e55ff;
}

.badge {
  position: absolute;
  top: 10rpx;
  right: 20rpx;
  background-color: #ef4444;
  color: #ffffff;
  font-size: 18rpx;
  padding: 2rpx 8rpx;
  border-radius: 20rpx;
  min-width: 24rpx;
  text-align: center;
}
</style>
