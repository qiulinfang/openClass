<template>
  <view class="profile-container">
    <!-- 功能卡片区域 -->
    <RubberBandList>
      <view class="features-section">
        <view class="content-wrapper">
          <!-- 加入课堂卡片 -->
          <view
            class="feature-card"
            :class="{ 'in-class': isInClass }"
            @click="toggleJoinClass"
          >
            <image :src="joinClassIcon" mode="aspectFit" class="card-icon" />
          </view>
          <!-- 老师答疑卡片 -->
          <view class="feature-card" @click="openTeacherQA">
            <image :src="teacherQAIcon" mode="aspectFit" class="card-icon" />
          </view>
          <!-- 我的收藏卡片 -->
          <view class="feature-card" @click="showFavorites">
            <image :src="myFavoritesIcon" mode="aspectFit" class="card-icon" />
          </view>
          <!-- 草稿本卡片 -->
          <view class="feature-card" @click="openDraftNotebook">
            <image :src="drawIcon" mode="aspectFit" class="card-icon" />
          </view>
          <!-- 意见反馈卡片 -->
          <view class="feature-card" @click="showFeedback">
            <image :src="feedbackIcon" mode="aspectFit" class="card-icon" />
            <view class="notification-badge" v-if="userClientUnreadCount > 0">
              <text>{{ userClientUnreadCount }}</text>
            </view>
          </view>
        </view>
      </view>
    </RubberBandList>

    <!-- 加入课堂确认对话框 -->
    <Dialog
      ref="joinClassDialogRef"
      :title="isInClass ? '确认退出课堂' : '课堂提示'"
      :confirmButtonText="isInClass ? '确认退出' : '确认加入'"
      cancelButtonText="取消"
      @confirm="confirmJoinClass"
      @cancel="handleJoinClassDialogCancel"
    >
      <view class="exit-classroom" v-if="isInClass">
        <view class="exit-icon">!</view>
        <view class="exit-text">
          <view class="primary">确认退出课堂？</view>
          <view class="secondary">退出后将不能和老师互动，且投屏会结束。</view>
        </view>
      </view>

      <view class="join-classroom-content" v-else>
        <view class="join-classroom-body">
          <view class="status-text">确认加入课堂？</view>
        </view>
      </view>
    </Dialog>

    <!-- 退出登录确认对话框 -->
    <Dialog
      ref="logoutDialogRef"
      title="退出确认"
      confirmButtonText="退出"
      cancelButtonText="取消"
      @confirm="confirmLogout"
      @cancel="cancelLogout"
    >
      <view class="logout-dialog-content">确定要退出登录吗？</view>
    </Dialog>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useUserClientStore } from '../stores/userClientStore'
import { androidBridge } from '../services/business/android-bridge'
import { showMessage } from '../utils'
import {
  authService,
  getUserInfo,
  getXuebanToken,
  setUserInfo,
} from '../services'
import RubberBandList from '../components/base/VirtualScroll.vue'
import Dialog from '../components/base/Dialog.vue'

// 资源路径适配
const drawIcon = '/static/icons/draw.svg'
const joinClassIcon = '/static/icons/join_class.svg'
const myFavoritesIcon = '/static/icons/my_favorites.svg'
const feedbackIcon = '/static/icons/feedback.svg'
const teacherQAIcon = '/static/icons/teacher_qa.svg'

const userClientStore = useUserClientStore()

// 状态
const isInClass = ref(false)
const isProjecting = ref(false)
const logoutDialogRef = ref<InstanceType<typeof Dialog> | null>(null)
const joinClassDialogRef = ref<InstanceType<typeof Dialog> | null>(null)

// 未读消息
const userClientUnreadCount = computed(() => userClientStore.unreadCount)

const userInfo = computed(() => {
  return (
    getUserInfo() || {
      id: '',
      name: '',
      avatar: '',
      roles: [] as string[],
    }
  )
})

const checkClassroomStatus = () => {
  const status = androidBridge.getClassroomStatus()
  if (status && status.isInClass === true) {
    isInClass.value = true
    isProjecting.value = status.status === 'streaming'
  } else {
    isInClass.value = false
    isProjecting.value = false
  }
}

onMounted(() => {
  loadUserInfo()
  checkClassroomStatus()

  androidBridge.onClassroomJoined(() => {
    isInClass.value = true
    showMessage('已加入课堂', 'success')
  })
  androidBridge.onClassroomExited(() => {
    isInClass.value = false
    showMessage('已退出课堂', 'info')
  })
})

const loadUserInfo = async () => {
  try {
    const cached = getUserInfo()
    if (cached) return

    const token = getXuebanToken()
    if (!token) return

    const userData = await authService.getUserInfo(token)
    if (userData) {
      setUserInfo(userData)
    }
  } catch (error) {
    console.error('加载用户信息失败:', error)
  }
}

const toggleJoinClass = () => {
  joinClassDialogRef.value?.openDialog()
}

const handleJoinClassDialogCancel = () => {
  joinClassDialogRef.value?.closeDialog()
}

const confirmJoinClass = () => {
  joinClassDialogRef.value?.closeDialog()

  if (isInClass.value) {
    const ok = androidBridge.exitClassroom()
    if (ok) {
      isInClass.value = false
      isProjecting.value = false
      showMessage('已退出课堂', 'success')
    } else {
      showMessage('退出课堂失败', 'error')
    }
    return
  }

  const studentId = userInfo.value.id || ''
  const studentName = userInfo.value.name || '用户'
  const isGuest = !studentId

  const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
  if (ok) {
    isInClass.value = true
    showMessage('已加入课堂', 'success')
  } else {
    showMessage('加入课堂失败', 'error')
  }
}

const showFeedback = () => {
  // 小程序端反馈通常跳转到专门的反馈页面或使用客服功能
  ;(uni as any).navigateTo({ url: '/pages/feedback/index' })
}

const showFavorites = () => {
  ;(uni as any).navigateTo({ url: '/pages/favorites/list' })
}

const openDraftNotebook = () => {
  ;(uni as any).navigateTo({ url: '/pages/canvas/canvas' })
}

const openTeacherQA = () => {
  ;(uni as any).navigateTo({ url: '/pages/chat/chat?type=teacher' })
}

const handleLogout = () => {
  logoutDialogRef.value?.openDialog()
}

const cancelLogout = () => {
  logoutDialogRef.value?.closeDialog()
}

const confirmLogout = async () => {
  try {
    logoutDialogRef.value?.closeDialog()

    if (androidBridge.isAndroidBridgeAvailable()) {
      try { androidBridge.stopScreenProjection() } catch {}
      try { androidBridge.exitClassroom() } catch {}
    }

    // 清理存储并重定向
    ;(uni as any).reLaunch({ url: '/pages/login/login' })
    showMessage('已退出登录', 'success')
  } catch (error) {
    console.error('退出登录失败:', error)
    showMessage('退出登录失败，请重试', 'error')
  }
}
</script>

<style scoped>
.profile-container {
  padding: 40rpx 32rpx;
  height: 100%;
  box-sizing: border-box;
}

.features-section {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-bottom: 48rpx;
  max-width: 1200rpx;
  margin-left: auto;
  margin-right: auto;
}

.content-wrapper {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 80rpx;
  padding-top: 40rpx;
}

.feature-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  flex-shrink: 0;
}

.card-icon {
  width: 168rpx;
  height: 168rpx;
  z-index: 1;
}

.notification-badge {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  min-width: 36rpx;
  height: 36rpx;
  background: #ef4444;
  color: white;
  border-radius: 18rpx;
  border: 4rpx solid #ffffff;
  font-size: 22rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
  box-sizing: border-box;
  z-index: 2;
}

.in-class::before {
  content: '';
  position: absolute;
  top: -46rpx;
  left: -46rpx;
  right: -46rpx;
  bottom: -46rpx;
  background: radial-gradient(circle, rgba(147, 51, 234, 1.2) 0%, rgba(147, 51, 234, 0.9) 20%, rgba(147, 51, 234, 0.6) 40%, rgba(147, 51, 234, 0.3) 60%, rgba(147, 51, 234, 0.1) 80%, rgba(147, 51, 234, 0.02) 100%);
  border-radius: 50%;
  z-index: 0;
  animation: breathe 2s ease-in-out infinite;
}

@keyframes breathe {
  0% { opacity: 1; }
  50% { opacity: 0.3; }
  100% { opacity: 1; }
}

.exit-classroom {
  display: flex;
  gap: 24rpx;
  align-items: center;
}

.exit-icon {
  width: 68rpx;
  height: 68rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  font-weight: 800;
  flex-shrink: 0;
}

.exit-text {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.exit-text .primary {
  font-size: 30rpx;
  font-weight: 600;
  color: #111827;
}

.exit-text .secondary {
  font-size: 26rpx;
  color: #6b7280;
}

.join-classroom-content {
  padding: 28rpx 32rpx;
}

.status-text {
  font-size: 26rpx;
  color: #6b7280;
}

.logout-dialog-content {
  font-size: 30rpx;
  color: #4b5563;
}

@media (max-width: 480px) {
  .content-wrapper {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
