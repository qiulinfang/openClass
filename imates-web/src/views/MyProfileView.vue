<template>
  <div class="profile-container">
    <!-- 功能卡片区域 -->
    <RubberBandList>
      <div class="features-section">
        <div class="content-wrapper">
          <!-- 加入课堂卡片 -->
          <div
            class="feature-card"
            :class="{ 'in-class': isInClass }"
            @click="toggleJoinClass"
          >
            <img :src="joinClassIcon" alt="加入课堂" class="card-icon" />
          </div>
          <!-- 老师答疑卡片 -->
          <!-- <div class="feature-card" @click="openTeacherQADialog">
            <img :src="teacherQAIcon" alt="老师答疑" class="card-icon" />
          </div> -->
          <!-- 我的收藏卡片 -->
          <!-- <div class="feature-card" @click="showFavorites">
            <img :src="myFavoritesIcon" alt="我的收藏" class="card-icon" />
          </div> -->
          <!-- 草稿本卡片 -->
          <!-- <div class="feature-card" @click="openDraftNotebook">
            <img :src="drawIcon" alt="草稿本" class="card-icon" />
          </div> -->
          <!-- 意见反馈卡片 -->
          <!-- <div class="feature-card" @click="showFeedback">
            <img :src="feedbackIcon" alt="在线客服" class="card-icon" />
            <span class="notification-badge" v-if="userClientUnreadCount > 0">{{
              userClientUnreadCount
            }}</span>
          </div> -->
        </div>
        <!-- 退出登录按钮 -->
        <div class="logout-section">
          <div class="logout-button" @click="handleLogout">
            <span class="logout-text">退出登录</span>
          </div>
        </div>
      </div>
    </RubberBandList>

    <!-- 加入课堂确认对话框：使用基础对话框组件 -->
    <Dialog
      ref="joinClassDialogRef"
      :title="isInClass ? '确认退出课堂' : '课堂提示'"
      :confirmButtonText="isInClass ? '确认退出' : '确认加入'"
      :cancelButtonText="'取消'"
      @confirm="confirmJoinClass"
      @cancel="handleJoinClassDialogCancel"
    >
      <div class="exit-classroom" v-if="isInClass">
        <div class="exit-icon">!</div>
        <div class="exit-text">
          <div class="primary">确认退出课堂？</div>
          <div class="secondary">退出后将不能和老师互动，且投屏会结束。</div>
        </div>
      </div>

      <div class="join-classroom-content" v-else>
        <div class="join-classroom-body">
          <div class="status-text">确认加入课堂？</div>
        </div>
      </div>
    </Dialog>

    <!-- 退出登录确认对话框 -->
    <Dialog
      ref="logoutDialogRef"
      title="退出确认"
      :confirmButtonText="'退出'"
      :cancelButtonText="'取消'"
      @confirm="confirmLogout"
      @cancel="cancelLogout"
    >
      确定要退出登录吗？
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useUserClientStore } from '@/stores/userClientStore'
import { androidBridge } from '@/services/business/android-bridge'
import { showMessage } from '@/utils'
import {
  authService,
  getUserInfo,
  getUserId,
  getXuebanToken,
  setUserInfo,
  getCurrentYanbanUserId,
} from '../services'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'
import RubberBandList from '@/components/base/VirtualList.vue'
import Dialog from '@/components/base/Dialog.vue'

// 导入 SVG 图标
import drawIcon from '/icons/draw.svg'
import joinClassIcon from '/icons/join_class.svg'
import myFavoritesIcon from '/icons/my_favorites.svg'
import feedbackIcon from '/icons/feedback.svg'
import teacherQAIcon from '/icons/teacher_qa.svg'

const router = useRouter()
const userClientStore = useUserClientStore()

// 注入父组件提供的方法（从 MainView 提供）
const closeToolbox = inject<() => void>('closeToolbox')
const openMainChatPanel = inject<() => void>('openMainChatPanel')
const openFeedbackDialog = inject<() => void>('openFeedbackDialog')
const openToolboxFromParent = inject<() => void>('openToolbox')
const openTeacherQADialogFromParent = inject<() => void>('openTeacherQADialog')

// 响应式数据
const isInClass = ref(false)
const isProjecting = ref(false)
const isLoggingOut = ref(false)
const logoutDialogRef = ref<InstanceType<typeof Dialog>>()
const joinClassDialogRef = ref<InstanceType<typeof Dialog>>()

// 用户端未读消息数
const userClientUnreadCount = computed(() => userClientStore.unreadCount)

// 使用 Store 管理用户信息 - 使用 computed 监听 localStorage 变化
// 注意：这里直接导入 getUserInfo，因为 authStorage 不依赖 userStore，不会有循环依赖
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

// 检查课堂状态的函数
const checkClassroomStatus = () => {
  // 流程：读取原生课堂状态 -> 更新前端状态
  console.log('[Classroom][Status] start')
  const status = androidBridge.getClassroomStatus() as BridgeClassroomStatus | null
  console.log('[Classroom][Status] native =', status)

  if (status && status.isInClass === true) {
    isInClass.value = true
    isProjecting.value = status.status === 'streaming'
  } else {
    isInClass.value = false
    isProjecting.value = false
  }
}

// 初始化
onMounted(() => {
  // 流程：页面初始化 -> 加载用户信息 -> 读取原生课堂状态 -> 绑定课堂事件
  loadUserInfo()

  // 流程：读取原生课堂状态 -> 更新前端状态
  checkClassroomStatus()

  // 流程：绑定课堂事件 -> 根据原生回调同步前端状态
  androidBridge.onClassroomJoined(() => {
    console.log('[MyProfileView] onClassroomJoined')
    isInClass.value = true
    showMessage('已加入课堂', 'success')
  })
  androidBridge.onClassroomExited(() => {
    console.log('[MyProfileView] onClassroomExited')
    isInClass.value = false
    showMessage('已退出课堂', 'info')
  })
  androidBridge.onClassroomStatusChanged((newStatus: BridgeClassroomStatus) => {
    console.log('[MyProfileView] onClassroomStatusChanged:', newStatus)
    const inClass = !!newStatus?.isInClass
    if (isInClass.value !== inClass) {
      isInClass.value = inClass
    }
    const projecting = newStatus?.status === 'streaming'
    if (isProjecting.value !== projecting) {
      isProjecting.value = projecting
    }
  })

  androidBridge.onScreenProjectionStarted(() => {
    console.log('[MyProfileView] onScreenProjectionStarted')
    isProjecting.value = true
  })
  androidBridge.onScreenProjectionStopped(() => {
    console.log('[MyProfileView] onScreenProjectionStopped')
    isProjecting.value = false
  })
})

// 组件卸载时清理
onUnmounted(async () => {
  // 清理工作由 UnifiedChatDialog 组件内部处理
})

// 加载用户信息
const loadUserInfo = async () => {
  try {
    // 尝试从持久化存储加载
    const cached = getUserInfo()
    if (cached) {
      return
    }

    // 从统一存储获取XUEBAN_TOKEN
    const token = getXuebanToken()
    if (!token) {
      console.warn('未找到 XUEBAN_TOKEN')
      return
    }

    // 调用 /admin/info 接口获取用户信息
    const userData = await authService.getUserInfo(token)

    // 更新用户信息并持久化
    if (userData) {
      setUserInfo({
        id: userData.id || '',
        name: userData.name || '用户',
        avatar: userData.avatar || '',
        roles: userData.roles || [],
      })
    }
  } catch (error) {
    console.error('加载用户信息失败:', error)
  }
}

// 切换加入课堂状态
const toggleJoinClass = () => {
  joinClassDialogRef.value?.openDialog()
}

// 处理加入课堂对话框取消
const handleJoinClassDialogCancel = () => {
  // 取消时关闭对话框
  joinClassDialogRef.value?.closeDialog()
}

// 确认加入/退出课堂
const confirmJoinClass = () => {
  // 流程：关闭确认弹窗 -> 分支(在课堂/不在课堂) -> 调用原生接口 -> 根据结果同步状态与提示
  joinClassDialogRef.value?.closeDialog()

  const traceId = `JC_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`
  console.log('[Classroom][Action] start', { traceId, isInClass: isInClass.value })

  if (!androidBridge.isAndroidBridgeAvailable()) {
    console.error('[Classroom][Action] AndroidBridge unavailable', { traceId })
    showMessage('Web 演示模式：已完成教室选择，但当前环境不支持真实加入课堂', 'info')
    return
  }

  if (isInClass.value) {
    // 流程：调用原生退出课堂 -> 成功则更新状态
    console.log('[Classroom][Exit] call native', { traceId })
    const ok = androidBridge.exitClassroom()
    if (ok) {
      isInClass.value = false
      isProjecting.value = false
      console.log('[Classroom][Exit] ok', { traceId })
      showMessage('已退出课堂', 'success')
    } else {
      console.error('[Classroom][Exit] failed', { traceId })
      showMessage('退出课堂失败', 'error')
    }
    return
  }

  // 流程：准备加入参数 -> 优先使用userStore中的用户信息 -> 其次尝试原生用户信息 -> 兜底使用现有昵称并启用游客模式
  // 优先使用 userStore 中的用户ID（支持 id 或 userId 字段）
  const storeUserId = userInfo.value.id || userInfo.value.userId || ''
  const nativeUser = androidBridge.getUserInfo() as Partial<BridgeUserInfo> | null
  const nativeUserId = nativeUser?.userId || nativeUser?.id || ''

  // 优先使用 store 中的用户ID，如果没有再使用原生用户ID
  const studentId = storeUserId || nativeUserId
  const studentName =
    (nativeUser?.nickName ?? nativeUser?.userName ?? userInfo.value.name) || '用户'

  // 只有当完全没有用户ID时才认为是游客模式
  const isGuest = !studentId

  // 流程：调用原生加入课堂 -> 成功则更新状态
  console.log('[Classroom][Join] call native', { traceId, studentId, studentName, isGuest })
  const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
  if (ok) {
    isInClass.value = true
    console.log('[Classroom][Join] ok (waiting teacher cmd)', { traceId })
    showMessage('已加入课堂', 'success')
  } else {
    console.error('[Classroom][Join] failed', { traceId })
    showMessage('加入课堂失败', 'error')
  }
}




// 显示反馈对话框
const showFeedback = () => {
  // 关闭工具箱
  if (closeToolbox) {
    closeToolbox()
  }
  // 显示反馈对话框
  if (openFeedbackDialog) {
    openFeedbackDialog()
  }
}

// 显示我的收藏
const showFavorites = () => {
  // 关闭工具箱
  if (closeToolbox) {
    closeToolbox()
  }
  // 导航到我的收藏页面
  router.push({ name: 'myFavorites' })
}

// 打开草稿本
const openDraftNotebook = () => {
  if (closeToolbox) {
    closeToolbox()
  }
  // 调用父组件提供的打开草稿本方法
  if (openToolboxFromParent) {
    openToolboxFromParent() // 打开对话框而不是路由跳转
  }
}

// 打开老师答疑对话框
const openTeacherQADialog = () => {
  // 关闭工具箱
  if (closeToolbox) {
    closeToolbox()
  }
  // 通知父组件显示老师答疑对话框
  if (openTeacherQADialogFromParent) {
    openTeacherQADialogFromParent()
  }
}

// 处理退出登录
const handleLogout = () => {
  logoutDialogRef.value?.openDialog()
}

const cancelLogout = () => {
  logoutDialogRef.value?.closeDialog()
}

// 确认退出登录
const confirmLogout = async () => {
  try {
    isLoggingOut.value = true
    logoutDialogRef.value?.closeDialog()

    // 如果在课堂中，先退出课堂
    if (androidBridge.isAndroidBridgeAvailable()) {
      try {
        androidBridge.stopScreenProjection()
      } catch {
        // 忽略停止投屏的错误
      }
      try {
        androidBridge.exitClassroom()
      } catch {
        // 忽略退出课堂的错误
      }
    }

  // 关闭工具箱
    if (closeToolbox) {
      closeToolbox()
    }

    // 跳转到登录页面，清除本地存储等逻辑在路由守卫或登录页面处理
    await router.push('/login')

    showMessage('已退出登录', 'success')
  } catch (error) {
    console.error('退出登录失败:', error)
    showMessage('退出登录失败，请重试', 'error')
  } finally {
    isLoggingOut.value = false
  }
}

</script>

<style lang="scss" scoped>
// 变量定义
$primary-color: #1976d2;
$text-primary: #1f2937;
$text-secondary: #6b7280;
$text-tertiary: #9ca3af;
$bg-gray: #f9fafb;

// 主要样式
.profile-container {
  padding: 20px 16px;
  height: 100%; // 或 min-height: 100%; 看外层情况
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  :deep(.rubber-band-scroll-view){
    overflow: visible;
  }
}

// 功能卡片区域
.features-section {
  display: block;
  min-height: 0;
  height: 90vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-bottom: 24px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.content-wrapper {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
  place-items: center;
  padding-top:20px;

  .logout-section {
    display: flex;
    justify-content: center;
    padding: 0 20px;
    margin-top: 24px;
  }

  // 响应式：小屏幕时每行2个
  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
  }

  // 响应式：超小屏幕时每行1个
  @media (max-width: 360px) {
    grid-template-columns: repeat(1, 1fr);
  }
}

.feature-card {
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;


  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 8px;
  flex-shrink: 0;

  .card-icon {
    width: 150%;
    height: 150%;
    object-fit: contain;
    position: relative;
    z-index: 1;
  }

  .notification-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    background: #ef4444;
    color: white;
    border-radius: 9px;
    border: 2px solid #ffffff;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    box-sizing: border-box;
    z-index: 2;
  }


  // 已加入课堂状态 - 更深的绿色
  &.in-class {
    position: relative;

      &::before {
        content: '';
        position: absolute;
        top: -23px;
        left: -23px;
        right: -23px;
        bottom: -23px;
        background: radial-gradient(circle, rgba(147, 51, 234, 1.2) 0%, rgba(147, 51, 234, 0.9) 20%, rgba(147, 51, 234, 0.6) 40%, rgba(147, 51, 234, 0.3) 60%, rgba(147, 51, 234, 0.1) 80%, rgba(147, 51, 234, 0.02) 100%);
        border-radius: 50%;
        z-index: 0;
        animation: breathe 2s ease-in-out infinite;
      }

    .card-icon {
      position: relative;
      z-index: 1;
    }
  }

  // 圆形呼吸灯效果动画
  @keyframes breathe {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
    100% {
      opacity: 1;
    }
  }

}

// 退出登录按钮区域
.logout-section {
  margin-top: 24px;
  padding: 0 20px;

  .logout-button {
    width: 90%;
    max-width: 680px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 14px; /* less rounded */
    padding: 10px 20px; /* shorter height */
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.14s ease;
    border: 1px solid rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(6px);

    &:hover {
      background: rgba(255, 255, 255, 0.12);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
      background: rgba(255, 255, 255, 0.06);
    }
  }

  .logout-text {
    color: #ffffff;
    font-size: 16px;
    font-weight: 400; /* normal weight */
    text-align: center;
  }
}

.exit-classroom {
  height: 100%;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  align-items: center;

  .exit-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
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
    gap: 6px;
    min-width: 0;

    .primary {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      line-height: 1.3;
    }

    .secondary {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.4;
    }
  }
}

.join-classroom-content {
  height: 100%;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .join-classroom-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
  }

  .status-text {
    font-size: 13px;
    color: #6b7280;

    &.error {
      color: #ef4444;
    }
  }

  .selector-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .selector-column {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    min-width: 0;

    .label {
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
      width: 44px;
      flex-shrink: 0;
    }

    :deep(.common-select) {
      flex: 1;
      min-width: 0;
    }

    &.disabled {
      opacity: 0.55;
      pointer-events: none;
    }
  }
}

// 对话框样式 - 统一的设计风格
:deep(.join-class-dialog) {
  .q-dialog__inner {
    padding: 16px;
  }

  .q-card {
    border-radius: 20px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.08);
    background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
    border: 1px solid rgba(0, 0, 0, 0.06);
    min-width: 300px;
    max-width: 400px;
    width: 90vw;
    animation: dialog-enter 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }
}

.dialog-header {
  padding: 24px 24px 16px 24px;
  border-bottom: none;

  .dialog-title {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.4;
    margin: 0;
  }
}

.dialog-content {
  padding: 8px 24px 20px 24px;

  .dialog-message {
    font-size: 15px;
    font-weight: 400;
    color: #4b5563;
    line-height: 1.6;
    margin: 0;
  }
}

.dialog-actions {
  padding: 0 24px 24px 24px;
  border-top: none;
  gap: 12px;
  display: flex;
  justify-content: flex-end;
}

// 按钮样式
.dialog-btn-cancel {
  min-width: 80px;
  height: 40px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  text-transform: none;
  color: #6b7280;
  background: transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(107, 114, 128, 0.08);
    color: #374151;
  }

  &:active {
    background: rgba(107, 114, 128, 0.12);
  }

  :deep(.q-btn__content) {
    color: inherit;
  }
}

.dialog-btn-confirm {
  min-width: 80px;
  height: 40px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  text-transform: none;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
  }

  :deep(.q-btn__content) {
    color: white;
  }
}

// 对话框进入动画
@keyframes dialog-enter {
  0% {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

// 响应式设计 - 对话框
@media (max-width: 480px) {
  :deep(.join-class-dialog) {
    .q-card {
      max-width: 95vw;
      margin: 8px;
    }
  }

  .dialog-header {
    padding: 20px 20px 12px 20px;

    .dialog-title {
      font-size: 18px;
    }
  }

  .dialog-content {
    padding: 8px 20px 16px 20px;

    .dialog-message {
      font-size: 14px;
    }
  }

  .dialog-actions {
    padding: 0 20px 20px 20px;
    flex-direction: row;
    gap: 8px;
  }

  .dialog-btn-cancel,
  .dialog-btn-confirm {
    flex: 1;
    min-width: auto;
  }
}

:deep(.list-footer){
  display: none;
}

// 响应式设计
@media (max-width: 768px) {
  .profile-container {
    padding: 16px 12px;
  }

}

@media (max-width: 480px) {
  .features-section {
    gap: 12px;
  }

  .feature-card {
    padding: 10px 6px;
    width: 50px;
    height: 50px;
  }
}
</style>
