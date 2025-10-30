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
              <p class="user-grade">{{ userInfo.roles.length > 0 ? userInfo.roles.join('、') : '学生' }}</p>
            </div>
          </div>

          <!-- 功能卡片区域 -->
          <div class="features-section">
            <!-- 加入课堂卡片 -->
            <q-card 
              class="feature-card join-class-card"
              @click="toggleJoinClass"
            >
              <q-card-section class="card-content">
                <div class="card-icon card-icon-yellow">
                  <q-icon name="groups" size="28px" />
                </div>
                <div class="card-text">
                  <div class="card-title">加入课堂</div>
                  <div class="card-description">进入实时互动课堂</div>
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

    <!-- 学科选择对话框 -->
    <q-dialog v-model="showSubjectDialog">
      <q-card class="dialog-card subject-dialog">
        <q-card-section class="dialog-header">
          <div class="text-h6">选择学科</div>
        </q-card-section>
        <q-card-section class="dialog-content">
          <p class="subject-tip">请选择您要咨询的学科老师</p>
          <div class="subject-buttons">
            <q-btn
              unelevated
              color="primary"
              label="生物老师"
              icon="science"
              class="subject-btn"
              @click="selectSubject('biology')"
            />
            <q-btn
              unelevated
              color="secondary"
              label="数学老师"
              icon="calculate"
              class="subject-btn"
              @click="selectSubject('math')"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right" class="dialog-actions">
          <q-btn flat label="取消" @click="showSubjectDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 教师对话全屏对话框 -->
    <q-dialog 
      v-model="showTeacherChatDialog" 
      maximized 
      transition-show="slide-up" 
      transition-hide="slide-down"
    >
      <q-card class="teacher-chat-card-dialog">
        <!-- 对话框头部 -->
        <q-toolbar class="teacher-chat-toolbar">
          <q-btn flat round dense icon="arrow_back" @click="closeTeacherChat" />
          <q-toolbar-title>
            <div class="toolbar-title-content">
              <q-icon :name="selectedSubject === 'biology' ? 'science' : 'calculate'" size="24px" class="q-mr-sm" />
              <span>{{ selectedSubject === 'biology' ? '生物' : '数学' }}老师答疑</span>
            </div>
          </q-toolbar-title>
        </q-toolbar>

        <!-- ChatView组件 -->
        <q-card-section class="teacher-chat-content q-pa-none">
          <ChatView 
            v-if="teacherSessionId"
            type="teacher"
            :key="teacherSessionId"
            @scroll-to-bottom="handleScrollToBottom"
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/uiStore'
import { apiService } from '@/services/api-service'
import { useQuasar } from 'quasar'
import { androidBridge } from '@/services/android-bridge'
import ChatView from '@/components/ChatView.vue'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'
import avatarIcon from '/icons/avatar.svg'

const router = useRouter()
const $q = useQuasar()
const uiStore = useUIStore()

// 响应式数据
const userInfo = ref({
  id: '',
  name: '',
  avatar: '',
  roles: [] as string[]
})
const isInClass = ref(false)
const appVersion = ref('1.0.0')
const showLogoutDialog = ref(false)
const showJoinClassDialog = ref(false)

// 教师对话相关状态
const showSubjectDialog = ref(false)
const showTeacherChatDialog = ref(false)
const selectedSubject = ref<'biology' | 'math'>('biology')
const teacherSessionId = ref<string>('')

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

// 组件卸载时清理
onUnmounted(() => {
  // 流程：清理教师消息监听器
  if (teacherSessionId.value) {
    androidBridge.cleanupTeacherMessageListener()
  }
})

// 加载用户信息
const loadUserInfo = async () => {
  try {
    // 第1步：从localStorage获取XUEBAN_TOKEN
    const token = localStorage.getItem('XUEBAN_TOKEN')
    if (!token) {
      console.warn('未找到 XUEBAN_TOKEN')
      return
    }

    // 第2步：调用 /admin/info 接口获取用户信息
    const userData = await apiService.getUserInfo(token)
    
    // 第3步：更新用户信息
    if (userData) {
      userInfo.value = {
        id: userData.id || '',
        name: userData.name || '用户',
        avatar: userData.avatar || '',
        roles: userData.roles || []
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
  const studentName = (nativeUser?.nickName ?? nativeUser?.userName ?? userInfo.value.name) || '用户'
  const isGuest = !studentId

  // 流程：调用原生加入课堂 -> 成功则更新状态
  const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
  console.log('joinClassroom', ok)
  if (ok) {
    isInClass.value = true
    $q.notify({ type: 'positive', message: '已加入课堂', position: 'top' })
  } else {
    $q.notify({ type: 'negative', message: '加入课堂失败', position: 'top' })
  }
}

// 与老师对话
const chatWithTeacher = () => {
  // 第1步：打开教师对话框
  uiStore.openTeacherChatDialog()
}

// 选择学科（保留用于其他功能）
const selectSubject = async (subject: 'biology' | 'math') => {
  // 第1步：关闭学科选择对话框
  showSubjectDialog.value = false
  
  // 第2步：保存选择的学科
  selectedSubject.value = subject

  try {
    // 第3步：显示加载提示
    $q.loading.show({ message: '正在准备教师对话...' })

    // 第4步：设置exerciseStore中的科目信息（biology -> BIOLOGY, math -> MATH）
    const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem('currentTeacherSubject', storeSubject)
    
    // 第5步：生成临时会话ID供后续使用
    teacherSessionId.value = `teacher-chat-${Date.now()}`
    
    // 第6步：初始化教师消息监听器
    androidBridge.initTeacherMessageListener()

    // 第7步：打开教师对话Dialog
    showTeacherChatDialog.value = true
    $q.notify({
      type: 'positive',
      message: '已进入教师答疑',
      position: 'top'
    })
    $q.loading.hide()
  } catch (error) {
    console.error('准备教师对话失败:', error)
    $q.notify({
      type: 'negative',
      message: '准备教师对话失败，请重试',
      position: 'top'
    })
    $q.loading.hide()
  }
}

// 关闭教师对话
const closeTeacherChat = () => {
  // 流程：关闭对话框 -> 清理会话ID
  showTeacherChatDialog.value = false
  // 注意：不清理teacherSessionId，保留会话以便下次继续
}

// 处理滚动到底部
const handleScrollToBottom = () => {
  // ChatView内部已处理滚动，这里可以添加额外逻辑
}

// 拍照给老师
const takePictureToTeacher = async () => {
  // 第1步：设置图片捕获回调
  androidBridge.onImageCapture(async (imageInfo) => {
    if (imageInfo && imageInfo.filePath) {
      try {
        // 第2步：显示处理中提示
        $q.loading.show({ message: '正在处理图片...' })
        
        // 第3步：打开 AI 聊天对话框
        uiStore.openAIChatDialog()
        
        // 第4步：显示成功提示
        $q.notify({
          type: 'positive',
          message: '图片已准备好，请在 AI 聊天对话框中继续',
          position: 'top'
        })
      } catch (error) {
        console.error('处理图片失败:', error)
        $q.notify({
          type: 'negative',
          message: '处理图片失败，请重试',
          position: 'top'
        })
      } finally {
        $q.loading.hide()
      }
    }
  })

  // 第2步：调用原生拍照
  const result = androidBridge.captureImageFromCamera()
  if (!result.success) {
    $q.notify({
      type: 'negative',
      message: result.message || '无法启动相机',
      position: 'top'
    })
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

// 学科选择对话框样式
.subject-dialog {
  min-width: 340px;

  .subject-tip {
    color: $text-secondary;
    margin-bottom: 20px;
    text-align: center;
  }

  .subject-buttons {
    display: flex;
    gap: 16px;

    .subject-btn {
      flex: 1;
      height: 80px;
      font-size: 16px;
      font-weight: 600;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  }
}

// 教师对话全屏对话框样式
.teacher-chat-card-dialog {
  height: 100%;
  display: flex;
  flex-direction: column;

  .teacher-chat-toolbar {
    background: $primary-color;
    color: white;
    flex-shrink: 0;

    .toolbar-title-content {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .teacher-chat-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
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
