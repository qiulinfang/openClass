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
    <DraggableDialog 
      v-model="showTeacherChatDialog" 
      title="教师答疑"
      :initial-width="1000"
      :initial-height="600"
      :min-width="600"
      :min-height="400"
    >
      <div class="teacher-chat-content">
        <!-- 左侧聊天记录 -->
        <div class="left-panel">
          <SessionList 
            :records="teacherRecords"
            :selected-record-id="teacherSessionId"
            title="聊天记录"
            @record-click="handleTeacherRecordClick"
            @record-delete="handleTeacherRecordDelete"
            @batch-delete="handleTeacherBatchDelete"
          >
            <template #header-actions>
              <q-btn 
                flat 
                dense 
                round 
                icon="refresh" 
                size="sm" 
                @click="loadTeacherSessions"
              >
                <q-tooltip>刷新列表</q-tooltip>
              </q-btn>
              <q-btn 
                flat 
                dense 
                round 
                icon="add" 
                color="primary"
                size="sm" 
                @click="handleNewTeacherChat"
              >
                <q-tooltip>新增对话</q-tooltip>
              </q-btn>
            </template>
          </SessionList>
        </div>

        <!-- 右侧聊天界面 -->
        <div class="right-panel">
          <ChatView 
            v-if="showTeacherChatDialog && teacherSessionId"
            type="teacher"
            :session-id="teacherSessionId"
            :key="teacherSessionId"
          />
          <div v-else class="empty-chat">
            <q-icon name="chat" size="64px" color="grey-4" />
            <div class="text-grey-6 q-mt-md">请选择或创建一个会话</div>
          </div>
        </div>
      </div>
    </DraggableDialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/uiStore'
import { useUserStore } from '@/stores/userStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { apiService } from '@/services/api-service'
import { useQuasar } from 'quasar'
import { androidBridge } from '@/services/android-bridge'
import DraggableDialog from '@/components/DraggableDialog.vue'
import ChatView from '@/components/ChatView.vue'
import SessionList from '@/components/SessionList.vue'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'
import type { QuestionRecord } from '@/types'
import avatarIcon from '/icons/avatar.svg'

const router = useRouter()
const $q = useQuasar()
const uiStore = useUIStore()
const userStore = useUserStore()
const teacherStore = useTeacherChatStore()

// 响应式数据
const isInClass = ref(false)
const appVersion = ref('1.0.0')
const showLogoutDialog = ref(false)
const showJoinClassDialog = ref(false)
const showTeacherChatDialog = ref(false)
const teacherSessionId = ref<string>('')
const teacherSessions = ref<Array<{
  sessionId: string
  sessionName: string
  subject: string
  createTime: number
}>>([])

// 计算属性：将教师会话映射为QuestionRecord格式
const teacherRecords = computed<QuestionRecord[]>(() => {
  return teacherSessions.value.map(session => ({
    id: session.sessionId,
    question: session.sessionName,
    answer: session.subject === 'biology' ? '生物老师' : '数学老师',
    timestamp: session.createTime,
    pinned: false
  }))
})

// 使用 Store 管理用户信息
const userInfo = computed(() => userStore.userInfo || {
  id: '',
  name: '',
  avatar: '',
  roles: [] as string[]
})


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

// 自动刷新定时器
let refreshTimer: ReturnType<typeof setInterval> | null = null

// 监听教师对话框的打开/关闭，自动刷新会话列表
watch(showTeacherChatDialog, (isOpen) => {
  if (isOpen) {
    // 对话框打开时，初始加载一次
    loadTeacherSessions()
    
    // 然后每5秒自动刷新一次（用于显示自动生成的标题）
    refreshTimer = setInterval(() => {
      loadTeacherSessions()
    }, 5000)
  } else {
    // 对话框关闭时，清除定时器
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }
})

// 组件卸载时清理
onUnmounted(async () => {
  // 流程：清理教师消息监听器（使用 Store 统一方法）
  if (teacherSessionId.value) {
    await teacherStore.cleanupMessageReceiver()
  }
  
  // 清理刷新定时器
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
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

// 加载教师会话列表
const loadTeacherSessions = () => {
  // 第1步：从localStorage获取所有会话
  const sessions: typeof teacherSessions.value = []
  const sessionIds = new Set<string>()
  
  // 第2步：遍历localStorage查找所有教师会话
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('teacher_chat_') && key.endsWith('_session')) {
      try {
        const sessionData = localStorage.getItem(key)
        if (sessionData) {
          const session = JSON.parse(sessionData)
          
          // 检查是否重复
          if (!sessionIds.has(session.sessionId)) {
            sessions.push(session)
            sessionIds.add(session.sessionId)
          }
        }
      } catch (error) {
        console.error('解析会话数据失败:', error)
      }
    }
  }
  
  // 第3步：按创建时间降序排序（最新的在前面）
  sessions.sort((a, b) => b.createTime - a.createTime)
  
  // 第4步：更新列表
  teacherSessions.value = sessions
}

// 处理教师记录点击
const handleTeacherRecordClick = async (record: QuestionRecord) => {
  // 第1步：从teacherSessions中找到对应的会话
  const session = teacherSessions.value.find(s => s.sessionId === record.id)
  if (!session) return
  
  // 第2步：设置当前会话ID
  teacherSessionId.value = session.sessionId
  
  // 第3步：设置科目
  const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
  localStorage.setItem('currentTeacherSubject', storeSubject)
  
  // 第4步：设置 teacherStore 的会话
  teacherStore.setSession(session)
  
  // 第5步：加载聊天历史
  await teacherStore.loadChatHistory(session.sessionId)
  
  console.log('[MyProfileView] ✅ 选择会话:', session.sessionId)
}

// 处理教师记录删除
const handleTeacherRecordDelete = (record: QuestionRecord) => {
  $q.dialog({
    title: '确认删除',
    message: '确定要删除这个会话吗？删除后无法恢复。',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      // 第1步：删除localStorage中的会话数据
      localStorage.removeItem(`teacher_chat_${record.id}_session`)
      
      // 第2步：删除IndexedDB中的聊天历史
      await teacherStore.clearChatHistory(record.id)
      
      // 第3步：刷新列表
      loadTeacherSessions()
      
      // 第4步：如果删除的是当前会话，清空选择
      if (teacherSessionId.value === record.id) {
        teacherSessionId.value = ''
        teacherStore.clearSession()
      }
      
      $q.notify({
        type: 'positive',
        message: '会话已删除',
        position: 'top'
      })
    } catch (error) {
      console.error('删除会话失败:', error)
      $q.notify({
        type: 'negative',
        message: '删除失败，请重试',
        position: 'top'
      })
    }
  })
}

// 处理批量删除教师会话
const handleTeacherBatchDelete = (recordIds: string[]) => {
  $q.dialog({
    title: '确认删除',
    message: `确定要删除选中的 ${recordIds.length} 个会话吗？删除后无法恢复。`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      let successCount = 0
      let failedCount = 0
      
      // 第1步：批量删除
      for (const id of recordIds) {
        try {
          // 删除localStorage中的会话数据
          localStorage.removeItem(`teacher_chat_${id}_session`)
          
          // 删除IndexedDB中的聊天历史
          await teacherStore.clearChatHistory(id)
          
          // 如果删除的是当前会话，清空选择
          if (teacherSessionId.value === id) {
            teacherSessionId.value = ''
            teacherStore.clearSession()
          }
          
          successCount++
        } catch (error) {
          console.error(`删除会话 ${id} 失败:`, error)
          failedCount++
        }
      }
      
      // 第2步：刷新列表
      loadTeacherSessions()
      
      // 第3步：显示结果
      if (failedCount === 0) {
        $q.notify({
          type: 'positive',
          message: `已删除 ${successCount} 个会话`,
          position: 'top'
        })
      } else {
        $q.notify({
          type: 'warning',
          message: `成功删除 ${successCount} 个，失败 ${failedCount} 个`,
          position: 'top'
        })
      }
    } catch (error) {
      console.error('批量删除失败:', error)
      $q.notify({
        type: 'negative',
        message: '批量删除失败，请重试',
        position: 'top'
      })
    }
  })
}

// 与老师对话（从卡片进入）
const chatWithTeacher = () => {
  // 第1步：加载会话列表
  loadTeacherSessions()
  
  // 第2步：如果有历史会话，直接打开对话框
  if (teacherSessions.value.length > 0) {
    showTeacherChatDialog.value = true
  } else {
    // 第3步：没有历史会话，直接使用数学学科
    selectSubject('math')
  }
}

// 新建教师对话（从SessionList的新增按钮进入）
const handleNewTeacherChat = () => {
  // 直接使用数学学科
  selectSubject('math')
}

// 初始化教师对话（直接使用数学学科）
const selectSubject = async (subject: 'biology' | 'math') => {
  try {
    // 第1步：显示加载提示
    $q.loading.show({ message: '正在准备教师对话...' })

    // 第2步：确保用户信息已加载（修复"用户未登录"错误）
    if (!userInfo.value?.id) {
      await loadUserInfo()
    }
    
    // 第3步：再次检查用户信息
    if (!userInfo.value?.id) {
      $q.loading.hide()
      $q.notify({
        type: 'negative',
        message: '无法获取用户信息，请重新登录',
        position: 'top'
      })
      return
    }

    // 第4步：设置科目信息（biology -> BIOLOGY, math -> MATH）
    const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem('currentTeacherSubject', storeSubject)
    
    // 第5步：生成临时会话ID供后续使用
    teacherSessionId.value = `teacher-chat-${Date.now()}`
    
    // 第6步：初始化教师消息监听器（使用 Store 统一方法）
    await teacherStore.initMessageReceiver()

    // 第7步：刷新会话列表
    loadTeacherSessions()
    
    // 第8步：打开教师对话Dialog
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
    // 第1步：清除本地存储的用户信息
    apiService.logoutStudent()
    
    // 第2步：清除 Store 中的用户信息和持久化数据
    userStore.clearUserInfo()
    
    $q.notify({
      type: 'positive',
      message: '已安全退出',
      position: 'top'
    })
    
    // 第3步：跳转到登录页面
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

// 教师聊天对话框样式
.teacher-chat-content {
  display: flex;
  height: 100%;
  overflow: hidden;
  
  .left-panel {
    width: 280px;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
    overflow: hidden;
  }
  
  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: white;
    
    .empty-chat {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 60px 20px;
    }
  }
}
</style>
