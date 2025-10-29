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
import { apiService } from '@/services/api-service'
import { useQuasar } from 'quasar'
import { androidBridge } from '@/services/android-bridge'
import ChatView from '@/components/ChatView.vue'
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
  // 流程：点击卡片 -> 显示学科选择对话框
  showSubjectDialog.value = true
}

// 选择学科
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
    // 注意：这里暂时使用localStorage存储科目，因为exerciseStore可能需要初始化
    localStorage.setItem('currentTeacherSubject', storeSubject)
    
    // 第5步：生成临时会话ID供后续使用
    teacherSessionId.value = `teacher-chat-${Date.now()}`
    
    // 第6步：初始化教师消息监听器（ChatView会创建实际会话）
    androidBridge.initTeacherMessageListener()

    // 第7步：检查是否是拍照模式
    if (pendingPhotoCapture.value) {
      // 拍照模式：准备就绪后直接触发拍照，不打开对话框
      pendingPhotoCapture.value = false
      $q.notify({
        type: 'positive',
        message: `已选择${subject === 'biology' ? '生物' : '数学'}老师`,
        position: 'top'
      })
      $q.loading.hide()
      
      // 延迟一下确保会话已准备好
      setTimeout(() => {
        startPhotoCapture()
      }, 300)
    } else {
      // 对话模式：打开教师对话Dialog，ChatView会自动初始化会话
      showTeacherChatDialog.value = true
      $q.notify({
        type: 'positive',
        message: '已进入教师答疑',
        position: 'top'
      })
      $q.loading.hide()
    }
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
  // 第1步：检查是否已有教师会话
  if (!teacherSessionId.value) {
    // 第2步：无会话 -> 显示学科选择对话框，并标记为拍照模式
    $q.notify({
      type: 'info',
      message: '请先选择要咨询的学科老师',
      position: 'top'
    })
    showSubjectDialog.value = true
    // 标记拍照模式，在selectSubject中会直接触发拍照
    pendingPhotoCapture.value = true
    return
  }

  // 第3步：已有会话 -> 直接开始拍照流程
  startPhotoCapture()
}

// 标记是否有待处理的拍照操作
const pendingPhotoCapture = ref(false)

// 开始拍照流程
const startPhotoCapture = () => {
  // 第1步：设置图片捕获回调
  androidBridge.onImageCapture(async (imageInfo) => {
    if (imageInfo && imageInfo.filePath) {
      try {
        // 第2步：显示发送中提示
        $q.loading.show({ message: '正在发送图片...' })

        // 第3步：发送图片给老师
        const success = androidBridge.sendPictureToTeacher(
          imageInfo.filePath,
          teacherSessionId.value,
          selectedSubject.value
        )
        
        if (success) {
          // 第4步：发送成功 -> 显示成功提示
          $q.notify({
            type: 'positive',
            message: '图片已发送给老师',
            position: 'top'
          })
          
          // 第5步：打开教师对话界面，让用户可以看到发送的图片和后续对话
          showTeacherChatDialog.value = true
        } else {
          $q.notify({
            type: 'negative',
            message: '发送图片失败，请重试',
            position: 'top'
          })
        }
      } catch (error) {
        console.error('发送图片失败:', error)
        $q.notify({
          type: 'negative',
          message: '发送图片失败，请重试',
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

// 学科选择对话框样式
.subject-dialog {
  min-width: 340px;

  .subject-tip {
    color: #6b7280;
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
