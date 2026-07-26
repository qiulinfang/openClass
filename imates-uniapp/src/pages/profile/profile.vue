<template>
  <view class="profile-page">
    <!-- 用户顶部卡片 -->
    <view class="user-header-card">
      <view class="avatar-container">
        <text class="avatar-text">👤</text>
      </view>
      <view class="user-info">
        <text class="username">{{ userInfo?.name || account || '学伴用户' }}</text>
        <text class="account-id">账号: {{ account || '未登录' }}</text>
      </view>
    </view>

    <!-- 常用功能矩阵卡片列表 (对齐 imates-web MyProfileView) -->
    <view class="feature-grid">
      <view class="feature-card" @click="handleJoinClass">
        <text class="card-icon">🏫</text>
        <text class="card-title">加入课堂</text>
      </view>

      <view class="feature-card" @click="handleTeacherQA">
        <text class="card-icon">👨‍🏫</text>
        <text class="card-title">老师答疑</text>
      </view>

      <view class="feature-card" @click="handleFavorites">
        <text class="card-icon">⭐</text>
        <text class="card-title">我的收藏</text>
      </view>

      <view class="feature-card" @click="handleFeedback">
        <text class="card-icon">💬</text>
        <text class="card-title">意见反馈</text>
      </view>
    </view>

    <!-- 底部设置与退出登录操作 -->
    <view class="actions-section">
      <button class="logout-btn" @click="handleLogoutConfirm">退出当前账号</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AuthService } from '@/services'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const account = ref('')
const userInfo = ref<any>(null)

onMounted(() => {
  const initialState = AuthService.getInitialLoginState()
  account.value = initialState.account
  userInfo.value = userStore.userInfo
})

const handleJoinClass = () => {
  uni.showToast({ title: '课堂互动功能已就绪', icon: 'none' })
}

const handleTeacherQA = () => {
  uni.showToast({ title: '老师在线答疑功能已就绪', icon: 'none' })
}

const handleFavorites = () => {
  uni.showToast({ title: '我的收藏功能已就绪', icon: 'none' })
}

const handleFeedback = () => {
  uni.showToast({ title: '意见反馈功能已就绪', icon: 'none' })
}

const handleLogoutConfirm = () => {
  uni.showModal({
    title: '退出确认',
    content: '确定要退出当前账号登录吗？',
    success: (res) => {
      if (res.confirm) {
        AuthService.logout()
        uni.showToast({ title: '已退出登录', icon: 'success' })
        setTimeout(() => {
          uni.reLaunch({
            url: '/pages/login/login'
          })
        }, 800)
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.profile-page {
  padding: 30rpx;
  background-color: #f5f7fa;
  min-height: 100%;
  box-sizing: border-box;
}

.user-header-card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 40rpx 30rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  margin-bottom: 30rpx;
}

.avatar-container {
  width: 110rpx;
  height: 110rpx;
  border-radius: 55rpx;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
}

.avatar-text {
  font-size: 56rpx;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.username {
  font-size: 36rpx;
  font-weight: bold;
  color: #1f2937;
}

.account-id {
  font-size: 26rpx;
  color: #6b7280;
  margin-top: 8rpx;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.feature-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.03);

  &:active {
    opacity: 0.8;
  }
}

.card-icon {
  font-size: 52rpx;
  margin-bottom: 12rpx;
}

.card-title {
  font-size: 28rpx;
  color: #374151;
  font-weight: 500;
}

.actions-section {
  margin-top: 60rpx;
}

.logout-btn {
  background: #ef4444;
  color: #ffffff;
  border-radius: 16rpx;
  font-size: 32rpx;
  height: 84rpx;
  line-height: 84rpx;
}
</style>
