<template>
  <view class="main-layout">
    <!-- 上部内容区域，根据当前选中的 tab 动态渲染对应页面 -->
    <view class="main-content">
      <HomePage v-if="currentTab === 'resources'" />
      <ChatPage v-else-if="currentTab === 'chat'" />
      <ProfilePage v-else-if="currentTab === 'profile'" />
    </view>

    <!-- 底部固定导航栏 (TabBar) -->
    <view class="bottom-tab-bar">
      <view
        v-for="item in tabList"
        :key="item.key"
        class="tab-item"
        :class="{ active: currentTab === item.key }"
        @click="currentTab = item.key"
      >
        <text class="tab-icon">{{ item.icon }}</text>
        <text class="tab-text">{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import HomePage from '../home/home.vue'
import ChatPage from '../chat/chat.vue'
import ProfilePage from '../profile/profile.vue'

type TabType = 'resources' | 'chat' | 'profile'

const currentTab = ref<TabType>('resources')

interface TabItem {
  key: TabType
  label: string
  icon: string
}

const tabList: TabItem[] = [
  { key: 'resources', label: '资源与学习', icon: '📚' },
  { key: 'chat', label: 'AI 聊天', icon: '💬' },
  { key: 'profile', label: '我的信息', icon: '👤' }
]
</script>

<style lang="scss" scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #f8f8f8;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow: hidden;
  padding-bottom: 110rpx; /* 为底部固定导航栏留出间距 */
}

.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 110rpx;
  background-color: #ffffff;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 999;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  color: #888888;
  transition: color 0.2s;

  &.active {
    color: #6e55ff;

    .tab-text {
      font-weight: 600;
    }
  }
}

.tab-icon {
  font-size: 40rpx;
  margin-bottom: 4rpx;
}

.tab-text {
  font-size: 22rpx;
}
</style>
