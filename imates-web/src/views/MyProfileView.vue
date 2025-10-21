<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <q-page class="profile-page">
        <div class="main-content">
          <!-- 用户信息区域 -->
          <div class="user-info-section">
            <div class="avatar-container">
              <q-avatar size="80px" color="primary" text-color="white" class="user-avatar">
                <q-icon name="person" size="40px" />
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
              <h2 class="user-name">{{ userInfo.nickName || '用户' }}</h2>
              <p class="user-grade">{{ userInfo.grade || '高三(1)班' }}</p>
            </div>
          </div>

          <!-- 功能卡片区域 -->
          <div class="features-section">
            <!-- 加入课堂卡片 -->
            <q-card 
              class="feature-card join-class-card"
              :class="{ 'active': isInClass }"
              @click="toggleJoinClass"
            >
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="class" size="32px" />
                </div>
                <div class="card-text">
                  <div class="card-title">{{ isInClass ? '退出课堂' : '加入课堂' }}</div>
                  <div class="card-description">
                    {{ isInClass ? '点击退出当前课堂' : '加入课堂与老师互动' }}
                  </div>
                </div>
                <q-icon 
                  :name="isInClass ? 'exit_to_app' : 'login'" 
                  size="24px" 
                  class="card-arrow"
                />
              </q-card-section>
            </q-card>

            <!-- 与老师对话卡片 -->
            <q-card class="feature-card teacher-chat-card" @click="chatWithTeacher">
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="chat" size="32px" />
                </div>
                <div class="card-text">
                  <div class="card-title">与老师对话</div>
                  <div class="card-description">向老师提问，获得专业指导</div>
                </div>
                <q-icon name="arrow_forward_ios" size="24px" class="card-arrow" />
              </q-card-section>
            </q-card>

            <!-- 拍照给老师卡片 -->
            <q-card class="feature-card photo-teacher-card" @click="takePictureToTeacher">
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="camera_alt" size="32px" />
                </div>
                <div class="card-text">
                  <div class="card-title">拍照给老师</div>
                  <div class="card-description">拍照上传题目，获得解答</div>
                </div>
                <q-icon name="arrow_forward_ios" size="24px" class="card-arrow" />
              </q-card-section>
            </q-card>

            <!-- 反馈卡片 -->
            <q-card class="feature-card feedback-card" @click="showFeedback">
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="feedback" size="32px" />
                </div>
                <div class="card-text">
                  <div class="card-title">意见反馈</div>
                  <div class="card-description">提交建议和问题反馈</div>
                </div>
                <q-icon name="arrow_forward_ios" size="24px" class="card-arrow" />
              </q-card-section>
            </q-card>

            <!-- 退出登录卡片 -->
            <q-card class="feature-card logout-card" @click="confirmLogout">
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="logout" size="32px" />
                </div>
                <div class="card-text">
                  <div class="card-title">退出登录</div>
                  <div class="card-description">安全退出当前账户</div>
                </div>
                <q-icon name="arrow_forward_ios" size="24px" class="card-arrow" />
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
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiService } from '@/services/api-service'
import { useQuasar } from 'quasar'
import { androidBridge } from '@/services/android-bridge'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'

const router = useRouter()
const $q = useQuasar()

// 响应式数据
const userInfo = ref({
  nickName: '',
  grade: '高三(1)班'
})
const isInClass = ref(false)
const appVersion = ref('1.0.0')
const showLogoutDialog = ref(false)
const showJoinClassDialog = ref(false)

// 初始化
onMounted(() => {
  // 流程：页面初始化 -> 加载用户信息 -> 加载版本号 -> 读取原生课堂状态 -> 绑定课堂事件
  loadUserInfo()
  loadAppVersion()

  // 流程：读取原生课堂状态 -> 更新前端状态
  const status = androidBridge.getClassroomStatus() as BridgeClassroomStatus | null
  if (status && status.isInClass === true) {
    isInClass.value = true
  }

  // 流程：绑定课堂事件 -> 根据原生回调同步前端状态
  androidBridge.onClassroomJoined(() => {
    isInClass.value = true
    $q.notify({ type: 'positive', message: '已加入课堂', position: 'top' })
  })
  androidBridge.onClassroomExited(() => {
    isInClass.value = false
    $q.notify({ type: 'positive', message: '已退出课堂', position: 'top' })
  })
  androidBridge.onClassroomStatusChanged((newStatus: BridgeClassroomStatus) => {
    const inClass = !!newStatus?.isInClass
    if (isInClass.value !== inClass) {
      isInClass.value = inClass
    }
  })
})

// 加载用户信息
const loadUserInfo = async () => {
  try {
    // 从localStorage获取用户信息
    const token = localStorage.getItem('YANBAN_TOKEN')
    if (token) {
      const userData = await apiService.getUserInfo(token)
      userInfo.value = {
        nickName: userData.nickName || '用户',
        grade: userData.grade || '高三(1)班'
      }
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
  $q.notify({
    type: 'info',
    message: '更换头像功能开发中...',
    position: 'top'
  })
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
      $q.notify({ type: 'positive', message: '已退出课堂', position: 'top' })
    } else {
      $q.notify({ type: 'negative', message: '退出课堂失败', position: 'top' })
    }
    return
  }

  // 流程：准备加入参数 -> 优先读取原生用户信息 -> 兜底使用现有昵称并启用游客模式
  const nativeUser = androidBridge.getUserInfo() as Partial<BridgeUserInfo> | null
  const studentId = nativeUser?.userId ?? ''
  const studentName = (nativeUser?.nickName ?? nativeUser?.userName ?? userInfo.value.nickName) || '用户'
  const isGuest = !studentId

  // 流程：调用原生加入课堂 -> 成功则更新状态
  const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
  if (ok) {
    isInClass.value = true
    $q.notify({ type: 'positive', message: '已加入课堂', position: 'top' })
  } else {
    $q.notify({ type: 'negative', message: '加入课堂失败', position: 'top' })
  }
}

// 与老师对话
const chatWithTeacher = () => {
  // 这里可以调用Android Bridge或跳转到聊天页面
  $q.notify({
    type: 'info',
    message: '正在打开与老师的对话...',
    position: 'top'
  })
  
  // 模拟调用Android Bridge - 使用现有的方法
  if (typeof window !== 'undefined' && window.AndroidBridge?.sendMessageToTeacher) {
    const messageData = {
      content: '开始与老师对话',
      type: 'user',
      chatRole: 'student'
    }
    window.AndroidBridge.sendMessageToTeacher(JSON.stringify(messageData))
  }
}

// 拍照给老师
const takePictureToTeacher = () => {
  // 这里可以调用Android Bridge打开相机
  $q.notify({
    type: 'info',
    message: '正在打开相机...',
    position: 'top'
  })
  
  // 模拟调用Android Bridge - 使用现有的方法
  if (typeof window !== 'undefined' && window.AndroidBridge?.captureImageFromCamera) {
    window.AndroidBridge.captureImageFromCamera()
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
    // 清除本地存储的用户信息
    apiService.logoutStudent()
    
    $q.notify({
      type: 'positive',
      message: '已安全退出',
      position: 'top'
    })
    
    // 跳转到登录页面
    router.push('/login')
  } catch (error) {
    console.error('退出登录失败:', error)
    $q.notify({
      type: 'negative',
      message: '退出登录失败',
      position: 'top'
    })
  }
}
</script>

<style lang="scss" scoped>
// 变量定义
$border-color: #e5e7eb;
$primary-color: #1976d2;
$card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
$card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.15);

// 主要样式
.profile-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.main-content {
  padding: 24px;
  max-width: 600px;
  margin: 0 auto;
}

// 用户信息区域
.user-info-section {
  background: white;
  border-radius: 16px;
  padding: 32px 24px;
  margin-bottom: 24px;
  box-shadow: $card-shadow;
  text-align: center;
}

.avatar-container {
  position: relative;
  display: inline-block;
  margin-bottom: 20px;
}

.user-avatar {
  border: 4px solid white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.avatar-edit-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  background: $primary-color;
  color: white;
  border: 2px solid white;
}

.user-details {
  .user-name {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 8px 0;
  }

  .user-grade {
    font-size: 16px;
    color: #6b7280;
    margin: 0;
  }
}

// 功能卡片区域
.features-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}

.feature-card {
  background: white;
  border-radius: 12px;
  box-shadow: $card-shadow;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $card-shadow-hover;
  }

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;

    .card-icon {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .card-title,
    .card-description {
      color: white;
    }

    .card-arrow {
      color: white;
    }
  }

  .card-content {
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .card-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: #f3f4f6;
    color: $primary-color;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .card-text {
    flex: 1;
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 4px 0;
  }

  .card-description {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }

  .card-arrow {
    color: #9ca3af;
    flex-shrink: 0;
  }
}

// 特殊卡片样式
.join-class-card {
  &.active {
    .card-icon {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}

.teacher-chat-card {
  .card-icon {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
}

.photo-teacher-card {
  .card-icon {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
  }
}

.feedback-card {
  .card-icon {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
  }
}

.logout-card {
  .card-icon {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
    color: white;
  }
}

// 版本信息
.version-info {
  text-align: center;
  padding: 16px 0;

  .version-text {
    font-size: 14px;
    color: #9ca3af;
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
    padding: 16px;
  }

  .user-info-section {
    padding: 24px 20px;
  }

  .feature-card {
    .card-content {
      padding: 16px 20px;
    }
  }
}

@media (max-width: 480px) {
  .user-info-section {
    padding: 20px 16px;
  }

  .user-details {
    .user-name {
      font-size: 20px;
    }

    .user-grade {
      font-size: 14px;
    }
  }

  .feature-card {
    .card-content {
      padding: 14px 16px;
      gap: 12px;
    }

    .card-icon {
      width: 40px;
      height: 40px;
    }

    .card-title {
      font-size: 15px;
    }

    .card-description {
      font-size: 13px;
    }
  }
}
</style>
