<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="profile-page">
        <div class="main-content">
          <!-- 用户信息区域 -->
          <div class="user-info-section">
            <div class="avatar-container">
              <q-avatar size="80px" class="user-avatar">
                <img :src="avatarIcon" alt="avatar" />
              </q-avatar>
              <q-btn
                round
                dense
                flat
                icon="camera_alt"
                size="sm"
                class="avatar-edit-btn"
                @click="changeAvatar"
              />
            </div>
            <div class="user-details">
              <h2 class="user-name">{{ userInfo.name || '用户' }}</h2>
              <p class="user-grade">{{ (userInfo.roles && userInfo.roles.length > 0) ? userInfo.roles.join('、') : '学生' }}</p>
            </div>
          </div>

          <!-- 功能卡片区域 -->
          <div class="features-section">
            <!-- 加入课堂卡片 -->
            <q-card 
              class="feature-card join-class-card"
              :class="{ 'in-class': isInClass }"
              @click="toggleJoinClass"
            >
              <q-card-section class="card-content">
                <div class="card-icon" :class="isInClass ? 'card-icon-red' : 'card-icon-yellow'">
                  <q-icon :name="isInClass ? 'logout' : 'groups'" size="28px" />
                </div>
                <div class="card-text">
                  <div class="card-title">{{ isInClass ? '退出课堂' : '加入课堂' }}</div>
                  <div class="card-description">{{ isInClass ? '结束实时互动课堂' : '进入实时互动课堂' }}</div>
                </div>
              </q-card-section>
            </q-card>

            <!-- 教师答疑卡片 -->
            <q-card class="feature-card teacher-chat-card" @click="chatWithTeacher">
              <q-card-section class="card-content">
                <div class="card-icon card-icon-green">
                  <q-icon name="chat_bubble" size="28px" />
                </div>
                <div class="card-text">
                  <div class="card-title">教师答疑</div>
                  <div class="card-description">查看教师解答记录</div>
                </div>
              </q-card-section>
            </q-card>

            <!-- 拍作业卡片 -->
            <q-card class="feature-card photo-teacher-card" @click="takePictureToTeacher">
              <q-card-section class="card-content">
                <div class="card-icon card-icon-blue">
                  <q-icon name="photo_camera" size="28px" />
                </div>
                <div class="card-text">
                  <div class="card-title">拍作业</div>
                  <div class="card-description">拍摄并上传作业</div>
                </div>
              </q-card-section>
            </q-card>

            <!-- 反馈与建议卡片 -->
            <q-card class="feature-card feedback-card" @click="showFeedback">
              <q-card-section class="card-content">
                <div class="card-icon card-icon-purple">
                  <q-icon name="feedback" size="28px" />
                </div>
                <div class="card-text">
                  <div class="card-title">反馈与建议</div>
                  <div class="card-description">欢迎您提出宝贵的意见！</div>
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- 退出账号按钮 -->
          <div class="logout-section">
            <q-card class="logout-button" @click="confirmLogout">
              <q-card-section class="logout-content">
                <q-icon name="logout" size="24px" color="negative" />
                <span class="logout-text">退出账号</span>
              </q-card-section>
            </q-card>
          </div>

          <!-- 版本信息 -->
          <div class="version-info">
            <p class="version-text">版本 {{ appVersion }}</p>
          </div>
        </div>
      </q-page>
    </q-page-container>

    <!-- 退出登录确认对话框 -->
    <q-dialog v-model="showLogoutDialog">
      <q-card class="dialog-card">
        <q-card-section class="dialog-header">
          <div class="text-h6">确认退出</div>
        </q-card-section>
        <q-card-section class="dialog-content">
          <p>确定要退出登录吗？</p>
        </q-card-section>
        <q-card-actions align="right" class="dialog-actions">
          <q-btn flat label="取消" @click="showLogoutDialog = false" />
          <q-btn color="primary" label="确认" @click="logout" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 加入课堂确认对话框 -->
    <q-dialog v-model="showJoinClassDialog">
      <q-card class="dialog-card">
        <q-card-section class="dialog-header">
          <div class="text-h6">课堂提示</div>
        </q-card-section>
        <q-card-section class="dialog-content">
          <p>{{ isInClass ? '退出课堂后将不能和老师互动，确认退出吗？' : '确定要加入课堂吗？' }}</p>
        </q-card-section>
        <q-card-actions align="right" class="dialog-actions">
          <q-btn flat label="取消" @click="showJoinClassDialog = false" />
          <q-btn color="primary" label="确认" @click="confirmJoinClass" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 教师对话框 -->
    <TeacherChatDialog 
      ref="teacherChatDialogRef"
      v-model="showTeacherChatDialog"
      @session-created="handleTeacherSessionCreated"
    />
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useImagePicker } from '@/composables/useImagePicker'
import { apiService } from '@/services/api-service'
import { androidBridge } from '@/services/android-bridge'
import { showMessage } from '@/utils'
import TeacherChatDialog from '@/components/TeacherChatDialog.vue'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'
import avatarIcon from '/icons/avatar.svg'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const teacherStore = useTeacherChatStore()

// DOM 引用
const teacherChatDialogRef = ref<InstanceType<typeof TeacherChatDialog> | null>(null)

// 响应式数据
const isInClass = ref(false)
const appVersion = ref('1.0.0')
const showLogoutDialog = ref(false)
const showJoinClassDialog = ref(false)
const showTeacherChatDialog = ref(false)
// 全局图片选择器
const { pickImage } = useImagePicker()

// 使用 Store 管理用户信息
const userInfo = computed(() => userStore.userInfo || {
  id: '',
  name: '',
  avatar: '',
  roles: [] as string[]
})


// 检查课堂状态的函数
const checkClassroomStatus = () => {
  console.log('[MyProfileView] 🔍 checkClassroomStatus() - 开始检查课堂状态')
  // 流程：读取原生课堂状态 -> 更新前端状态
  const status = androidBridge.getClassroomStatus() as BridgeClassroomStatus | null
  console.log('[MyProfileView] 📊 从原生端获取的课堂状态:', status)
  
  if (status && status.isInClass === true) {
    isInClass.value = true
    console.log('[MyProfileView] ✅ 课堂状态已更新: isInClass = true')
  } else {
    isInClass.value = false
    console.log('[MyProfileView] ✅ 课堂状态已更新: isInClass = false')
  }
  console.log('[MyProfileView] 🎯 checkClassroomStatus() - 检查完成, 当前状态:', isInClass.value)
}

// 初始化
onMounted(() => {
  // 流程：页面初始化 -> 加载用户信息 -> 加载版本号 -> 读取原生课堂状态 -> 绑定课堂事件
  loadUserInfo()
  loadAppVersion()

  // 流程：读取原生课堂状态 -> 更新前端状态
  checkClassroomStatus()

  // 流程：绑定课堂事件 -> 根据原生回调同步前端状态
  androidBridge.onClassroomJoined(() => {
    isInClass.value = true
    showMessage('已加入课堂', 'success')
  })
  androidBridge.onClassroomExited(() => {
    isInClass.value = false
    showMessage('已退出课堂', 'info')
  })
  androidBridge.onClassroomStatusChanged((newStatus: BridgeClassroomStatus) => {
    const inClass = !!newStatus?.isInClass
    if (isInClass.value !== inClass) {
      isInClass.value = inClass
    }
  })
})

// 监听路由变化，当进入此页面时重新检查课堂状态
watch(() => route.name, (routeName) => {
  if (routeName === 'myProfile') {
    // 流程：路由进入此页面 -> 重新检查课堂状态 -> 更新前端状态
    checkClassroomStatus()
  }
})

// 组件卸载时清理
onUnmounted(async () => {
  // 清理工作由 TeacherChatDialog 组件内部处理
})

// 加载用户信息
const loadUserInfo = async () => {
  try {
    // 第1步：尝试从持久化存储加载
    const hasCache = userStore.loadFromStorage()
    if (hasCache) {
      return
    }

    // 第2步：从localStorage获取XUEBAN_TOKEN
    const token = localStorage.getItem('XUEBAN_TOKEN')
    if (!token) {
      console.warn('未找到 XUEBAN_TOKEN')
      return
    }

    // 第3步：调用 /admin/info 接口获取用户信息
    const userData = await apiService.getUserInfo(token)
    
    // 第4步：更新用户信息并持久化
    if (userData) {
      userStore.setUserInfo({
        id: userData.id || '',
        name: userData.name || '用户',
        avatar: userData.avatar || '',
        roles: userData.roles || []
      })
    }
  } catch (error) {
    console.error('加载用户信息失败:', error)
  }
}

// 加载应用版本
const loadAppVersion = () => {
  // 这里可以从环境变量或配置中获取版本号
  appVersion.value = '1.0.0'
}

// 更换头像
const changeAvatar = () => {
  showMessage('更换头像功能开发中...', 'info')
}

// 切换加入课堂状态
const toggleJoinClass = () => {
  showJoinClassDialog.value = true
}

// 确认加入/退出课堂
const confirmJoinClass = () => {
  // 流程：关闭确认弹窗 -> 分支(在课堂/不在课堂) -> 调用原生接口 -> 根据结果同步状态与提示
  showJoinClassDialog.value = false

  if (isInClass.value) {
    // 流程：调用原生退出课堂 -> 成功则更新状态
    const ok = androidBridge.exitClassroom()
    if (ok) {
      isInClass.value = false
      showMessage('已退出课堂', 'success')
    } else {
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
  const studentName = (nativeUser?.nickName ?? nativeUser?.userName ?? userInfo.value.name) || '用户'
  
  // 只有当完全没有用户ID时才认为是游客模式
  const isGuest = !studentId
  
  console.log('🔍 加入课堂参数:', {
    storeUserId,
    nativeUserId,
    studentId,
    studentName,
    isGuest,
    userInfo: userInfo.value
  })

  // 流程：调用原生加入课堂 -> 成功则更新状态
  const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
  console.log('joinClassroom', ok)
  if (ok) {
    isInClass.value = true
    showMessage('已加入课堂', 'success')
  } else {
    showMessage('加入课堂失败', 'error')
  }
}

// 与老师对话（从卡片进入）
const chatWithTeacher = async () => {
  // 第1步：打开对话框（组件内部会自动加载会话列表）
  showTeacherChatDialog.value = true
  
  // 第2步：等待组件加载完成
  await nextTick()
  
  // 第3步：检查是否有会话，如果没有则创建新会话
  if (teacherChatDialogRef.value) {
    // 快速检查是否有会话（通过检查 localStorage）
    let hasSessions = false
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('teacher_chat_') && key.endsWith('_session')) {
        hasSessions = true
        break
      }
    }
    
    if (!hasSessions) {
      // 没有历史会话，创建新会话（默认数学）
      await teacherChatDialogRef.value.createNewSession('math')
    }
  }
}

// 初始化教师对话（供外部调用）
const selectSubject = async (subject: 'biology' | 'math') => {
  console.log('[MyProfileView] 🎯 selectSubject() - 初始化教师对话')
  try {
    // 第1步：确保用户信息已加载
    if (!userInfo.value?.id) {
      await loadUserInfo()
    }
    
    // 第2步：再次检查用户信息
    if (!userInfo.value?.id) {
      showMessage('无法获取用户信息，请重新登录', 'error')
      return
    }

    // 第3步：打开对话框
    showTeacherChatDialog.value = true
    
    // 第4步：等待组件加载完成
    await nextTick()
    
    // 第5步：通过组件创建新会话
    if (teacherChatDialogRef.value) {
      await teacherChatDialogRef.value.createNewSession(subject)
    }
    
    console.log('[MyProfileView] ✅ 教师对话准备完成')
  } catch (error) {
    console.error('[MyProfileView] ❌ 准备教师对话失败:', error)
    showMessage('准备教师对话失败，请重试', 'error')
  }
}

// 处理教师会话创建事件
const handleTeacherSessionCreated = (sessionId: string) => {
  console.log('[MyProfileView] ✅ 教师会话已创建:', sessionId)
  
  // 如果需要，可以在这里设置会话到 Store
  const sessionData = localStorage.getItem(`teacher_chat_${sessionId}_session`)
  if (sessionData) {
    const session = JSON.parse(sessionData)
    teacherStore.setSession(session)
  }
}

// 拍照给老师（总是新建一个教师会话后再发送）
const takePictureToTeacher = async () => {
  try {
    // 第1步：选择图片
    const imageInfo = await pickImage()
    if (!imageInfo) {
      return
    }

    // 第2步：无条件新建一个教师会话（默认数学）
    await selectSubject('math')
    await nextTick()

    // 第3步：获取新创建的会话ID（从组件或localStorage）
    let currentSessionId = ''
    if (teacherChatDialogRef.value) {
      // 从组件获取当前会话ID，或者从最新的会话获取
      // 查找最新的会话
      const sessions: Array<{ sessionId: string; createTime: number }> = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('teacher_chat_') && key.endsWith('_session')) {
          try {
            const sessionData = localStorage.getItem(key)
            if (sessionData) {
              const session = JSON.parse(sessionData)
              sessions.push(session)
            }
          } catch (error) {
            console.error('解析会话数据失败:', error)
          }
        }
      }
      
      if (sessions.length > 0) {
        sessions.sort((a, b) => b.createTime - a.createTime)
        currentSessionId = sessions[0].sessionId
        
        // 设置会话到 Store
        const sessionData = localStorage.getItem(`teacher_chat_${currentSessionId}_session`)
        if (sessionData) {
          teacherStore.setSession(JSON.parse(sessionData))
          // 设置到组件
          teacherChatDialogRef.value.setSession(currentSessionId)
        }
      }
    }

    // 第4步：验证图片数据完整性
    if (!imageInfo.filePath) {
      showMessage('图片路径不存在，请重试', 'error')
      return
    }
    if (!imageInfo.base64DataUrl) {
      showMessage('图片数据不完整，请重试', 'error')
      return
    }
    
    // 第5步：设置待发送图片，由ChatView的watch自动处理发送
    // 流程：设置pendingImage -> ChatView的watch监听到变化 -> 自动调用onImageSelected发送
    await nextTick() // 确保ChatView已经挂载完成
    teacherStore.setPendingImage(imageInfo)
  } catch (error) {
    console.error('[MyProfileView] ❌ 处理图片失败:', error)
    showMessage('处理图片失败，请重试', 'error')
  }
}

// 显示反馈
const showFeedback = () => {
  // 跳转到反馈页面
  router.push('/feedback')
}

// 确认退出登录
const confirmLogout = () => {
  showLogoutDialog.value = true
}

// 退出登录
const logout = async () => {
  showLogoutDialog.value = false
  
  try {
    // 第0步：如果正在课堂中，先退出课堂
    if (isInClass.value) {
      console.log('[MyProfileView] 🔍 退出账号 - 检测到正在课堂中，先退出课堂')
      const exitSuccess = androidBridge.exitClassroom()
      if (exitSuccess) {
        console.log('[MyProfileView] ✅ 退出账号 - 课堂退出成功')
        isInClass.value = false
      } else {
        console.warn('[MyProfileView] ⚠️ 退出账号 - 课堂退出失败，继续执行退出账号流程')
      }
    }
    
    // 第1步：清除本地存储的用户信息
    apiService.logoutStudent()
    
    // 第2步：清除 Store 中的用户信息和持久化数据
    userStore.clearUserInfo()
    
    showMessage('已安全退出', 'success')
    
    // 第3步：跳转到登录页面
    router.push('/login')
  } catch (error) {
    console.error('退出登录失败:', error)
    showMessage('退出登录失败', 'error')
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
.profile-page {
  min-height: 100vh;
  background: $bg-gray;
}

.main-content {
  padding: 20px 16px;
  max-width: 600px;
  margin: 0 auto;
}

// 用户信息区域
.user-info-section {
  background: white;
  border-radius: 20px;
  padding: 40px 24px 32px;
  margin-bottom: 20px;
  text-align: center;
}

.avatar-container {
  position: relative;
  display: inline-block;
  margin-bottom: 16px;
}

.user-avatar {
  border: none;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
}

.avatar-edit-btn {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: white;
  color: $primary-color;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.user-details {
  .user-name {
    font-size: 22px;
    font-weight: 600;
    color: $text-primary;
    margin: 0 0 6px 0;
  }

  .user-grade {
    font-size: 15px;
    color: $text-secondary;
    margin: 0;
    font-weight: 400;
  }
}

// 功能卡片区域
.features-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 24px;
}

.feature-card {
  background: white;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  aspect-ratio: 3;
  position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:active {
    transform: scale(0.98);
    opacity: 0.9;
  }

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  &.in-class {
    border: 2px solid #EF5350;
    box-shadow: 0 2px 8px rgba(239, 83, 80, 0.2);
  }

  .card-content {
    padding: 10px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    height: 100%;
    gap: 6px;
  }

  .card-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
  }

  .card-icon-yellow {
    background: #FFA726;
  }

  .card-icon-red {
    background: #EF5350;
  }

  .card-icon-green {
    background: #26A69A;
  }

  .card-icon-blue {
    background: #42A5F5;
  }

  .card-icon-purple {
    background: #AB47BC;
  }

  .card-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: $text-primary;
    margin: 0 0 4px 0;
  }

  .card-description {
    font-size: 11px;
    color: $text-secondary;
    margin: 0;
    font-weight: 400;
    line-height: 1.3;
  }
}

// 退出账号区域
.logout-section {
  margin: 16px 0 24px;
  display: flex;
  justify-content: center;
}

.logout-button {
  background: white;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 280px;
  max-width: 400px;

  &:active {
    transform: scale(0.98);
    opacity: 0.9;
  }

  .logout-content {
    padding: 14px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .logout-text {
    font-size: 15px;
    font-weight: 500;
    color: #f44336;
  }
}

// 版本信息
.version-info {
  text-align: center;
  padding: 20px 0;

  .version-text {
    font-size: 13px;
    color: $text-tertiary;
    margin: 0;
  }
}

// 对话框样式
.dialog-card {
  min-width: 300px;
  max-width: 400px;
}

.dialog-header {
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-content {
  padding: 20px 0;
}

.dialog-actions {
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}


// 响应式设计
@media (max-width: 768px) {
  .main-content {
    padding: 16px 12px;
  }

  .user-info-section {
    padding: 32px 20px 24px;
  }

  .feature-card {
    .card-content {
      padding: 8px 8px;
    }

    .card-icon {
      width: 28px;
      height: 28px;
    }
  }
}

@media (max-width: 480px) {
  .user-info-section {
    padding: 28px 16px 20px;
    border-radius: 16px;
  }

  .user-details {
    .user-name {
      font-size: 20px;
    }

    .user-grade {
      font-size: 14px;
    }
  }

  .features-section {
    gap: 8px;
  }

  .feature-card {
    .card-content {
      padding: 8px 8px;
      gap: 4px;
    }

    .card-icon {
      width: 26px;
      height: 26px;
    }

    .card-title {
      font-size: 12px;
    }

    .card-description {
      font-size: 9px;
    }

    .card-arrow {
      top: 6px;
      right: 6px;
      font-size: 12px;
    }
  }
}

</style>
