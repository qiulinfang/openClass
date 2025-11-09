<template>
  <div class="profile-container">
    <!-- 功能卡片区域 -->
    <div class="features-section">
      <!-- 加入课堂卡片 -->
      <div 
        class="feature-card join-class-card"
        :class="{ 'in-class': isInClass }"
        @click="toggleJoinClass"
      >
        <div class="card-icon-wrapper" :class="{ 'in-class': isInClass }">
          <img :src="joinClassIcon" alt="加入课堂" class="card-icon" />
        </div>
        <div class="card-text">{{ isInClass ? '离开课堂' : '加入课堂' }}</div>
      </div>

      <!-- 教师通用对话卡片 -->
      <div class="feature-card teacher-chat-card" @click="chatWithTeacher">
        <div class="card-icon-wrapper">
          <img :src="teacherQaIcon" alt="老师答疑" class="card-icon" />
        </div>
        <div class="card-text">老师答疑</div>
      </div>

      <!-- 拍作业卡片 -->
      <div class="feature-card photo-teacher-card" @click="takePictureToTeacher">
        <div class="card-icon-wrapper">
          <img :src="scanHomeworkIcon" alt="拍作业" class="card-icon" />
        </div>
        <div class="card-text">拍作业</div>
      </div>

      <!-- 我的收藏卡片 -->
      <div class="feature-card favorites-card" @click="showFavorites">
        <div class="card-icon-wrapper">
          <img :src="myFavoritesIcon" alt="我的收藏" class="card-icon" />
        </div>
        <div class="card-text">我的收藏</div>
      </div>

      <!-- 意见反馈卡片 -->
      <div class="feature-card feedback-card" @click="showFeedback">
        <div class="card-icon-wrapper">
          <img :src="feedbackIcon" alt="意见反馈" class="card-icon" />
        </div>
        <div class="card-text">意见反馈</div>
      </div>
    </div>

    <!-- 加入课堂确认对话框 -->
    <q-dialog v-model="showJoinClassDialog" class="join-class-dialog">
      <q-card class="dialog-card">
        <q-card-section class="dialog-header">
          <div class="dialog-title">课堂提示</div>
        </q-card-section>
        <q-card-section class="dialog-content">
          <p class="dialog-message">{{ isInClass ? '退出课堂后将不能和老师互动，确认退出吗？' : '确定要加入课堂吗？' }}</p>
        </q-card-section>
        <q-card-actions align="right" class="dialog-actions">
          <q-btn 
            flat 
            label="取消" 
            class="dialog-btn-cancel"
            @click="showJoinClassDialog = false" 
          />
          <q-btn 
            label="确认" 
            class="dialog-btn-confirm"
            @click="confirmJoinClass" 
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Dialog } from 'quasar'
import { useUserStore } from '@/stores/userStore'
import { useTeacherGeneralChatStore } from '@/stores/teacherGeneralChatStore'
import { useImagePicker } from '@/composables/useImagePicker'
import { apiService } from '@/services/api-service'
import { androidBridge } from '@/services/android-bridge'
import { showMessage } from '@/utils'
import { getCurrentUserIdOrDefault } from '@/utils/user/userId'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'
import UnifiedChatDialog from '@/components/UnifiedChatDialog.vue'

// 导入 SVG 图标
import joinClassIcon from '/icons/join_class.svg'
import teacherQaIcon from '/icons/teacher_qa.svg'
import scanHomeworkIcon from '/icons/scan_homework.svg'
import myFavoritesIcon from '/icons/my_favorites.svg'
import feedbackIcon from '/icons/feedback.svg'

const router = useRouter()
const userStore = useUserStore()
const teacherStore = useTeacherGeneralChatStore()

// 注入父组件提供的方法（从 MainView 提供）
const closeToolbox = inject<() => void>('closeToolbox')
const openTeacherChatDialog = inject<(subject?: 'biology' | 'math') => void>('openTeacherChatDialog')
const openFeedbackDialog = inject<() => void>('openFeedbackDialog')
const getTeacherChatDialogRef = inject<() => InstanceType<typeof UnifiedChatDialog> | null>('getTeacherChatDialogRef')

// 响应式数据
const isInClass = ref(false)
const showJoinClassDialog = ref(false)
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
  // 流程：读取原生课堂状态 -> 更新前端状态
  const status = androidBridge.getClassroomStatus() as BridgeClassroomStatus | null
  
  if (status && status.isInClass === true) {
    isInClass.value = true
  } else {
    isInClass.value = false
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

// 组件卸载时清理
onUnmounted(async () => {
  // 清理工作由 UnifiedChatDialog 组件内部处理
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

  // 流程：调用原生加入课堂 -> 成功则更新状态
  const ok = androidBridge.joinClassroom(studentId, studentName, isGuest)
  if (ok) {
    isInClass.value = true
    showMessage('已加入课堂', 'success')
  } else {
    showMessage('加入课堂失败', 'error')
  }
}

// 与老师对话（从卡片进入）
const chatWithTeacher = async () => {
  // 第1步：关闭工具箱
  if (closeToolbox) {
    closeToolbox()
  }
  // 第2步：打开教师聊天对话框（默认数学）
  if (openTeacherChatDialog) {
    openTeacherChatDialog('math')
  }
}

// 初始化教师对话（供外部调用）
// 职责：封装完整的会话创建流程，包括验证用户信息、设置localStorage、创建会话、初始化消息接收器等
const selectSubject = async (subject: 'biology' | 'math') => {
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

    // 第3步：设置 localStorage 中的 currentTeacherSubject
    const userId = getCurrentUserIdOrDefault()
    const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
    
    // 第4步：生成 sessionId 和 sessionName
    const aiSessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const aiSessionName = subject === 'biology' ? '生物' : '数学'
    
    // 第5步：调用 createTeacherSession 创建或复用会话
    const session = teacherStore.createTeacherSession(aiSessionId, aiSessionName, subject)
    
    if (!session) {
      console.error('[MyProfileView] ❌ 创建教师会话失败')
      showMessage('创建教师会话失败，请重试', 'error')
      return
    }
    
    // 第6步：初始化消息接收器
    await teacherStore.initMessageReceiver()

    // 第7步：打开教师聊天对话框
    // 注意：store 的 currentSession 已经通过 createTeacherSession 设置
    // UnifiedChatDialog 会通过 watch 自动同步 UI 状态，无需手动调用 setTeacherSession
    if (openTeacherChatDialog) {
      openTeacherChatDialog(subject)
    }
  } catch (error) {
    console.error('[MyProfileView] ❌ 准备教师对话失败:', error)
    showMessage('准备教师对话失败，请重试', 'error')
  }
}

// 拍照给老师（选择照片后需要选择老师）
const takePictureToTeacher = async () => {
  try {
    // 第1步：关闭工具箱
    if (closeToolbox) {
      closeToolbox()
    }
    // 第2步：选择图片
    const imageInfo = await pickImage()
    if (!imageInfo) {
      return
    }

    // 第3步：验证图片数据完整性
    if (!imageInfo.filePath) {
      showMessage('图片路径不存在，请重试', 'error')
      return
    }
    if (!imageInfo.base64DataUrl) {
      showMessage('图片数据不完整，请重试', 'error')
      return
    }
    
    // 第4步：显示老师选择对话框
    Dialog.create({
      title: '选择老师',
      message: '请选择要发送图片的老师：',
      options: {
        type: 'radio',
        model: '',
        items: [
          {
            label: '生物老师',
            value: 'biology',
            color: 'green',
          },
          {
            label: '数学老师',
            value: 'math',
            color: 'blue',
          },
        ],
      },
      cancel: {
        label: '取消',
        color: 'grey',
        flat: true,
      },
      ok: {
        label: '确定',
        color: 'primary',
        unelevated: true,
      },
      persistent: false,
    }).onOk(async (selectedSubject: 'biology' | 'math') => {
      try {
        // 第5步：创建或切换到对应的教师会话（selectSubject 会处理所有逻辑）
        await selectSubject(selectedSubject)
        await nextTick()

        // 第6步：确保对话框已打开并设置会话
        const dialogRef = getTeacherChatDialogRef?.()
        if (!dialogRef) {
          showMessage('无法打开聊天对话框，请重试', 'error')
          return
        }
        
        // 从 store 获取当前会话（createTeacherSession 已经设置了）
        const currentSession = teacherStore.currentSession
        if (currentSession && currentSession.subject === selectedSubject) {
          // store 的 currentSession 已经设置，UnifiedChatDialog 会通过 watch 自动同步 UI 状态
        } else {
          // 如果 store 中没有，从所有会话中查找
          const allSessions = teacherStore.getAllSessions()
          const targetSession = allSessions.find(s => s.subject === selectedSubject)
          if (targetSession) {
            // 设置 localStorage
            const userId = getCurrentUserIdOrDefault()
            const storeSubject = targetSession.subject === 'biology' ? 'BIOLOGY' : 'MATH'
            localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
            // 调用 store 的 setSession，UnifiedChatDialog 会通过 watch 自动同步 UI 状态
            teacherStore.setSession(targetSession)
          } else {
            showMessage('创建会话失败，请重试', 'error')
            return
          }
        }
        
        // 第7步：设置待发送图片，由ChatView的watch自动处理发送
    // 流程：设置pendingImage -> ChatView的watch监听到变化 -> 自动调用onImageSelected发送
    await nextTick() // 确保ChatView已经挂载完成
    teacherStore.setPendingImage(imageInfo)
      } catch (error) {
        console.error('[MyProfileView] ❌ 发送图片失败:', error)
        showMessage('发送图片失败，请重试', 'error')
      }
    }).onCancel(() => {
      // 用户取消了选择，不做任何操作
      console.log('[MyProfileView] 用户取消了老师选择')
    })
  } catch (error) {
    console.error('[MyProfileView] ❌ 处理图片失败:', error)
    showMessage('处理图片失败，请重试', 'error')
  }
}

// 显示反馈对话框
const showFeedback = () => {
  // 第1步：关闭工具箱
  if (closeToolbox) {
    closeToolbox()
  }
  // 第2步：显示反馈对话框
  if (openFeedbackDialog) {
    openFeedbackDialog()
  }
}

// 显示我的收藏
const showFavorites = () => {
  // 第1步：关闭工具箱
  if (closeToolbox) {
    closeToolbox()
  }
  // 第2步：导航到我的收藏页面
  router.push({ name: 'myFavorites' })
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
  min-height: 100%;
  background: transparent;
}

// 功能卡片区域
.features-section {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 24px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
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
  padding: 12px 8px;
  flex: 0 0 calc(33.333% - 14px); // 每行3个，考虑gap
  min-width: 70px;
  max-width: 100px;
  
  // 响应式：小屏幕时每行2个
  @media (max-width: 480px) {
    flex: 0 0 calc(50% - 10px);
    max-width: none;
  }
  
  // 响应式：超小屏幕时每行1个
  @media (max-width: 360px) {
    flex: 0 0 100%;
    max-width: none;
  }

  &:active {
    transform: scale(0.95);
    opacity: 0.9;
  }

  .card-icon-wrapper {
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
      width: 100%;
      height: 100%;
      object-fit: contain;
      position: relative;
      z-index: 1;
    }
  }

  .card-text {
    font-size: 12px;
    font-weight: 500;
    color: white;
    text-align: center;
    white-space: nowrap;
    margin-top: 4px;
    line-height: 1.2;
  }

  // 加入课堂 - 绿色
  &.join-class-card {
    .card-icon-wrapper {
      background: #34D399;
      transition: all 0.3s ease;
      
      // 已加入课堂状态 - 更深的绿色
      &.in-class {
        background: #10B981;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
      }
    }
    
    // 已加入课堂状态 - 卡片整体更醒目
    &.in-class {
      .card-icon-wrapper {
        animation: pulse-highlight 2s ease-in-out infinite;
      }
      
      .card-text {
        font-weight: 600;
        color: #10B981;
        text-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
      }
    }
  }
  
  // 加入课堂成功的高亮动画
  @keyframes pulse-highlight {
    0%, 100% {
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.5), 0 0 12px rgba(16, 185, 129, 0.3);
    }
  }

  // 老师通用对话 - 橙色
  &.teacher-chat-card {
    .card-icon-wrapper {
      background: #F59E0B;
    }
  }

  // 拍作业 - 粉色
  &.photo-teacher-card {
    .card-icon-wrapper {
      background: #F87171;
    }
  }

  // 我的收藏 - 黄色
  &.favorites-card {
    .card-icon-wrapper {
      background: #FBBF24;
    }
  }

  // 意见反馈 - 蓝色
  &.feedback-card {
    .card-icon-wrapper {
      background: #60A5FA;
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
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
    background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
    border: 1px solid rgba(0, 0, 0, 0.06);
    min-width: 300px;
    max-width: 400px;
    width: 90vw;
    animation: dialog-enter 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
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
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  
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
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
  
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

  // 响应式设计
@media (max-width: 768px) {
  .profile-container {
    padding: 16px 12px;
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
  .features-section {
    gap: 12px;
  }

  .feature-card {
    padding: 10px 6px;
    
    .card-icon-wrapper {
      width: 50px;
      height: 50px;
    }
    
    .card-text {
      font-size: 11px;
    }
    
    // 拍照搜题图标在小屏幕时也需要调整字体大小
    &.photo-search-card {
      .card-icon {
        font-size: 50px;
      }
    }
  }
}

</style>
