<template>
  <div class="profile-container">
    <!-- 功能卡片区域 -->
    <div class="features-section">
      <!-- 加入课堂卡片 -->
      <div 
        class="feature-card join-class-card"
        @click="toggleJoinClass"
      >
        <div class="card-icon-wrapper">
          <img :src="joinClassIcon" alt="加入课堂" class="card-icon" />
          <img v-if="isInClass" src="/icons/learned_star.svg" alt="已加入" class="check-icon" />
        </div>
        <div class="card-text">加入课堂</div>
      </div>

      <!-- 教师答疑卡片 -->
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

      <!-- 拍照搜题卡片 -->
      <div class="feature-card photo-search-card" @click="handlePhotoSearch">
        <div class="card-icon-wrapper">
          <q-icon name="camera_alt" class="card-icon" />
        </div>
        <div class="card-text">拍照搜题</div>
      </div>
    </div>

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

    <!-- 统一聊天对话框 -->
    <UnifiedChatDialog 
      ref="unifiedChatDialogRef"
      v-model="showUnifiedChatDialog"
      initial-category="teacher"
      :initial-teacher-subject="selectedSubject"
      @session-created="handleSessionCreated"
    />

    <!-- 反馈与建议对话框 -->
    <FeedbackDialog v-model="showFeedbackDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useImagePicker } from '@/composables/useImagePicker'
import { apiService } from '@/services/api-service'
import { androidBridge } from '@/services/android-bridge'
import { showMessage } from '@/utils'
import { useQuestionStore } from '@/stores/questionStore'
import UnifiedChatDialog from '@/components/UnifiedChatDialog.vue'
import FeedbackDialog from '@/components/FeedbackDialog.vue'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'

// 导入 SVG 图标
import joinClassIcon from '/icons/join_class.svg'
import teacherQaIcon from '/icons/teacher_qa.svg'
import scanHomeworkIcon from '/icons/scan_homework.svg'
import myFavoritesIcon from '/icons/my_favorites.svg'
import feedbackIcon from '/icons/feedback.svg'

const router = useRouter()
const userStore = useUserStore()
const teacherStore = useTeacherChatStore()
const questionStore = useQuestionStore()

// 不再需要 props，点击卡片不会关闭工具区域

// DOM 引用
const unifiedChatDialogRef = ref<InstanceType<typeof UnifiedChatDialog> | null>(null)

// 响应式数据
const isInClass = ref(false)
const showJoinClassDialog = ref(false)
const showUnifiedChatDialog = ref(false)
const showFeedbackDialog = ref(false)
const selectedSubject = ref<'biology' | 'math'>('math')
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
  // 第1步：设置默认科目并打开对话框（组件内部会自动加载会话列表）
  selectedSubject.value = 'math'
  showUnifiedChatDialog.value = true
  
  // 第2步：等待组件加载完成
  await nextTick()
  
  // 第3步：检查是否有会话，如果没有则创建新会话
  if (unifiedChatDialogRef.value) {
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
      await unifiedChatDialogRef.value.createTeacherSession('math')
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

    // 第3步：设置科目并打开对话框
    selectedSubject.value = subject
    showUnifiedChatDialog.value = true
    
    // 第4步：等待组件加载完成
    await nextTick()
    
    // 第5步：通过组件创建新会话
    if (unifiedChatDialogRef.value) {
      await unifiedChatDialogRef.value.createTeacherSession(subject)
    }
    
    console.log('[MyProfileView] ✅ 教师对话准备完成')
  } catch (error) {
    console.error('[MyProfileView] ❌ 准备教师对话失败:', error)
    showMessage('准备教师对话失败，请重试', 'error')
  }
}

// 处理会话创建事件
const handleSessionCreated = (sessionId: string, type: 'ai' | 'teacher') => {
  console.log('[MyProfileView] ✅ 会话已创建:', { sessionId, type })
  
  // 如果是教师会话，设置会话到 Store
  if (type === 'teacher') {
    const sessionData = localStorage.getItem(`teacher_chat_${sessionId}_session`)
    if (sessionData) {
      const session = JSON.parse(sessionData)
      teacherStore.setSession(session)
    }
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
    if (unifiedChatDialogRef.value) {
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
          unifiedChatDialogRef.value.setTeacherSession(currentSessionId)
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

// 显示反馈对话框
const showFeedback = () => {
  showFeedbackDialog.value = true
}

// 显示我的收藏
const showFavorites = () => {
  // 第1步：导航到我的收藏页面
  router.push({ name: 'myFavorites' })
}

// 拍照搜题处理
const handlePhotoSearch = () => {
  try {
    if (androidBridge && androidBridge.isAndroidBridgeAvailable()) {
      // 获取当前题目信息，如果存在则使用其学科，否则默认使用数学
      const currentQuestion = questionStore.currentQuestion
      let subjectName = 'math' // 默认使用数学
      
      if (currentQuestion?.subject) {
        // 从题目中获取学科信息
        const subjectMap: Record<string, string> = {
          'SUBJECT_MATH': 'math',
          'SUBJECT_BIOLOGY': 'biology',
          'SUBJECT_CHEMISTRY': 'chemistry',
          'SUBJECT_PHYSICS': 'physics',
          'SUBJECT_CHINESE': 'chinese',
          'SUBJECT_ENGLISH': 'english'
        }
        subjectName = subjectMap[currentQuestion.subject] || currentQuestion.subject.toLowerCase() || 'math'
      }
      
      // 调用原生拍照搜题功能
      androidBridge.takePicture(subjectName)
      
      // 导航到习题解答页面（如果不在该页面）
      const currentRoute = router.currentRoute.value
      if (currentRoute.name !== 'exerciseSolve') {
        router.push({ name: 'exerciseSolve' })
      }
    } else {
      showMessage('拍照功能暂不可用', 'warning')
    }
  } catch (error) {
    console.error('拍照搜题失败:', error)
    showMessage('拍照搜题失败', 'error')
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
      width: 28px;
      height: 28px;
      object-fit: contain;
      position: relative;
      z-index: 1;
    }
    
    .check-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-45%, -60%);
      z-index: 2;
      width: 16px;
      height: 16px;
      object-fit: contain;
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
    }
  }

  // 老师答疑 - 橙色
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

  // 拍照搜题 - 紫色
  &.photo-search-card {
    .card-icon-wrapper {
      background: #8A80FF;
    }
    
    .card-icon {
      font-size: 28px;
      color: white;
    }
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
  }
}

</style>
