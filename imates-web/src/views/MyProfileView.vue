<template>
  <div class="profile-container">
    <!-- 功能卡片区域 -->
    <RubberBandList>
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
    </RubberBandList>

    <!-- 加入课堂确认对话框：使用可拖拽对话框组件 -->
    <DraggableDialog
      v-model="showJoinClassDialog"
      class="join-class-dialog"
      title="课堂提示"
      :show-footer="true"
      :auto-size="true"
      :confirm-text="isInClass ? '确认退出' : '确认加入'"
      :cancel-text="'取消'"
      :confirm-variant="isInClass ? 'danger' : 'primary'"
      :confirm-disabled="!canConfirmJoinClass"
      @cancel="showJoinClassDialog = false"
      @confirm="confirmJoinClass"
    >
      <div class="exit-classroom" v-if="isInClass">
        <div class="exit-icon">!</div>
        <div class="exit-text">
          <div class="primary">确认退出课堂？</div>
          <div class="secondary">退出后将不能和老师互动，且投屏会结束。</div>
        </div>
      </div>

      <!-- 加入课堂场景：展示教室选择 UI -->
      <div class="join-classroom-content" v-else>
        <div class="join-classroom-body">
          <div v-if="isLoadingClassrooms" class="status-text">正在加载教室列表...</div>
          <div v-else-if="classroomLoadError" class="status-text error">{{ classroomLoadError }}</div>
          <div v-else-if="!classroomTree || cityOptions.length === 0" class="status-text">暂无可用教室，请稍后重试</div>
          <div v-else class="selector-grid">
            <div class="selector-column">
              <div class="label">城市</div>
              <CommonSelect
                v-model="selectedCity"
                :options="cityOptions.map(city => ({ label: city, value: city }))"
                placeholder="请选择城市"
              />
            </div>

            <div class="selector-column" :class="{ disabled: !selectedCity }">
              <div class="label">学校</div>
              <CommonSelect
                v-model="selectedSchool"
                :options="schoolOptions.map(school => ({ label: school, value: school }))"
                :placeholder="selectedCity ? '请选择学校' : '请先选择城市'"
              />
            </div>

            <div class="selector-column" :class="{ disabled: !selectedSchool }">
              <div class="label">教室</div>
              <CommonSelect
                v-model="selectedClassroom"
                :options="classroomOptions.map(room => ({ label: roomLabel(room), value: roomKey(room) }))"
                :placeholder="selectedSchool ? '请选择教室' : '请先选择学校'"
              />
            </div>
          </div>
        </div>
      </div>
    </DraggableDialog>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Dialog } from 'quasar'
import { useTeacherGeneralChatStore } from '@/stores/teacherGeneralChatStore'
import { useImagePicker } from '@/composables/useImagePicker'
import { androidBridge } from '@/services/business/android-bridge'
import { showMessage } from '@/utils'
import { authService, getUserInfo, getCurrentUserIdOrDefault, getXuebanToken, setUserInfo } from '../services'
import type { BridgeClassroomStatus, BridgeUserInfo } from '@/types/bridge'
import type { ChatBubble } from '@/types'
import UnifiedChatDialog from '@/components/UnifiedChatDialog.vue'
import RubberBandList from '@/components/RubberBandList.vue'
import DraggableDialog from '@/components/DraggableDialog.vue'
import CommonSelect from '@/components/CommonSelect.vue'

// 导入 SVG 图标
import joinClassIcon from '/icons/join_class.svg'
import teacherQaIcon from '/icons/teacher_qa.svg'
import scanHomeworkIcon from '/icons/scan_homework.svg'
import myFavoritesIcon from '/icons/my_favorites.svg'
import feedbackIcon from '/icons/feedback.svg'

const router = useRouter()
const teacherStore = useTeacherGeneralChatStore()

// 注入父组件提供的方法（从 MainView 提供）
const closeToolbox = inject<() => void>('closeToolbox')
const openTeacherChatDialog = inject<(subject?: 'biology' | 'math') => void>('openTeacherChatDialog')
const openMainChatPanel = inject<() => void>('openMainChatPanel')
const openFeedbackDialog = inject<() => void>('openFeedbackDialog')
const getTeacherChatDialogRef = inject<() => InstanceType<typeof UnifiedChatDialog> | null>('getTeacherChatDialogRef')

// 响应式数据
const isInClass = ref(false)
const isProjecting = ref(false)
const showJoinClassDialog = ref(false)

// 教室选择相关状态
const classroomTree = ref<any | null>(null)
const isLoadingClassrooms = ref(false)
const classroomLoadError = ref<string | null>(null)
const selectedCity = ref('')
const selectedSchool = ref('')
const selectedClassroom = ref('')
// 全局图片选择器
const { pickImage } = useImagePicker()

// 教室选择下拉选项
const cityOptions = computed<string[]>(() => {
  if (!classroomTree.value) return []

  // 优先使用后端直接提供的 cities 列表
  if (Array.isArray((classroomTree.value as any).cities)) {
    return (classroomTree.value as any).cities as string[]
  }

  // 回退：将顶层 key 视为城市
  return Object.keys(classroomTree.value)
})

const schoolOptions = computed<string[]>(() => {
  if (!classroomTree.value || !selectedCity.value) return []

  const tree: any = classroomTree.value

  // 常见结构1：schoolsMap[city] 为学校列表
  if (tree.schoolsMap && Array.isArray(tree.schoolsMap[selectedCity.value])) {
    return tree.schoolsMap[selectedCity.value] as string[]
  }

  // 常见结构2：schools[city] 为学校列表
  if (tree.schools && Array.isArray(tree.schools[selectedCity.value])) {
    return tree.schools[selectedCity.value] as string[]
  }

  // 回退：假设 classroomTree[city] 是一个以学校为 key 的对象
  const cityNode = tree[selectedCity.value]
  if (cityNode && typeof cityNode === 'object') {
    return Object.keys(cityNode)
  }

  return []
})

const canConfirmJoinClass = computed(() => {
  if (isInClass.value) return true
  if (isLoadingClassrooms.value) return false
  if (classroomLoadError.value) return false
  if (!classroomTree.value) return false
  return !!selectedCity.value && !!selectedSchool.value && !!selectedClassroom.value
})

const classroomOptions = computed<any[]>(() => {
  if (!classroomTree.value || !selectedCity.value || !selectedSchool.value) return []

  const tree: any = classroomTree.value

  // 常见结构1：classroomsMap[city][school] 为教室数组
  if (tree.classroomsMap && tree.classroomsMap[selectedCity.value] && Array.isArray(tree.classroomsMap[selectedCity.value][selectedSchool.value])) {
    return tree.classroomsMap[selectedCity.value][selectedSchool.value] as any[]
  }

  // 常见结构2：以城市、学校为 key 的嵌套对象
  const cityNode = tree[selectedCity.value]
  const schoolNode = cityNode && cityNode[selectedSchool.value]
  if (Array.isArray(schoolNode)) {
    return schoolNode as any[]
  }

  return []
})

// 教室选项 key 与显示文案
const roomKey = (room: any): string => {
  if (!room) return ''
  return room.id || room.classroomId || room.name || String(room)
}

const roomLabel = (room: any): string => {
  if (!room) return ''
  return room.name || room.displayName || roomKey(room)
}

// 使用 Store 管理用户信息 - 使用 computed 监听 localStorage 变化
// 注意：这里直接导入 getUserInfo，因为 authStorage 不依赖 userStore，不会有循环依赖
const userInfo = computed(() => {
  return getUserInfo() || {
  id: '',
  name: '',
  avatar: '',
  roles: [] as string[]
  }
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
    // 第1步：尝试从持久化存储加载
    const cached = getUserInfo()
    if (cached) {
      return
    }

    // 第2步：从统一存储获取XUEBAN_TOKEN
    const token = getXuebanToken()
    if (!token) {
      console.warn('未找到 XUEBAN_TOKEN')
      return
    }

    // 第3步：调用 /admin/info 接口获取用户信息
    const userData = await authService.getUserInfo(token)
    
    // 第4步：更新用户信息并持久化
    if (userData) {
      setUserInfo({
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

// 加载教室树数据
const loadClassroomTree = () => {
  if (!androidBridge.isAndroidBridgeAvailable()) {
    console.warn('[Classroom][Tree] AndroidBridge unavailable, use mock classroom tree in web')
    classroomLoadError.value = null
    isLoadingClassrooms.value = false
    classroomTree.value = {
      cities: ['北京', '上海'],
      schoolsMap: {
        北京: ['第一中学', '第二中学'],
        上海: ['实验中学']
      },
      classroomsMap: {
        北京: {
          第一中学: [
            { id: 'BJ-1-101', name: '高一(1)班' },
            { id: 'BJ-1-102', name: '高一(2)班' },
          ],
          第二中学: [
            { id: 'BJ-2-201', name: '初二(1)班' },
          ],
        },
        上海: {
          实验中学: [
            { id: 'SH-EX-301', name: '高二(3)班' },
          ],
        },
      },
    }
    return
  }

  isLoadingClassrooms.value = true
  classroomLoadError.value = null

  try {
    const traceId = `CT_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`
    console.log('[Classroom][Tree] start', { traceId })
    const data = androidBridge.fetchClassroomTree()
    console.log('[Classroom][Tree] native =', { traceId, type: typeof data, isArray: Array.isArray(data) })

    const isEmptyObject =
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      Object.keys(data).length === 0

    if (!data || isEmptyObject) {
      classroomTree.value = null
      classroomLoadError.value = '获取教室列表失败，请稍后重试'
      console.warn('[Classroom][Tree] empty', { traceId })
    } else {
      classroomTree.value = data
      console.log('[Classroom][Tree] ok', { traceId, keys: Object.keys(data || {}).length })
    }
  } catch (error) {
    console.error('[Classroom][Tree] error:', error)
    classroomTree.value = null
    classroomLoadError.value = '获取教室列表异常，请稍后重试'
  } finally {
    isLoadingClassrooms.value = false
  }
}

// 切换加入课堂状态
const toggleJoinClass = () => {
  // 进入加入课堂弹窗时，如果还未加载过教室列表，则尝试加载
  if (!isInClass.value && !classroomTree.value && !isLoadingClassrooms.value) {
    loadClassroomTree()
  }

  showJoinClassDialog.value = true
}

// 确认加入/退出课堂
const confirmJoinClass = () => {
  // 流程：关闭确认弹窗 -> 分支(在课堂/不在课堂) -> 调用原生接口 -> 根据结果同步状态与提示
  showJoinClassDialog.value = false

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

  // 加入课堂前校验教室选择
  if (!classroomTree.value) {
    showMessage('教室列表未加载完成，请稍后重试', 'error')
    return
  }
  if (!selectedCity.value || !selectedSchool.value || !selectedClassroom.value) {
    showMessage('请先选择城市、学校和教室', 'error')
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

// 与老师对话（从卡片进入）
// 期望行为：优先打开主页右侧统一聊天面板（MainChatPanel），而不是直接弹出全屏对话框
const chatWithTeacher = async () => {
  // 第1步：关闭工具箱
  if (closeToolbox) {
    closeToolbox()
  }

  // 第2步：打开主页右侧统一聊天面板
  if (openMainChatPanel) {
    openMainChatPanel()
    return
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
    const studentUserId = localStorage.getItem('studentUserId') || ''
    const aiSessionId = `${studentUserId ? studentUserId + '_' : ''}teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
        
        // 第7步：直接创建消息并保存到持久化存储
        await nextTick() // 确保会话已设置完成
        
        // 创建图片消息
        const imageMessage: ChatBubble = {
          id: Date.now().toString(),
          content: '',
          type: 'user',
          timestamp: new Date().toISOString(),
          sender: 'user',
          messageType: 'image',
          imageData: {
            filePath: imageInfo.filePath,
            width: imageInfo.width,
            height: imageInfo.height,
            fileSize: imageInfo.fileSize,
            base64DataUrl: imageInfo.base64DataUrl,
          },
        }
        
        // 添加到 store
        teacherStore.addMessage(imageMessage)
        
        // 保存到持久化存储
        await teacherStore.saveChatHistory()
        
        // 发送图片消息到后端
        try {
          await teacherStore.sendMessage('', {
            filePath: imageInfo.filePath,
            width: imageInfo.width,
            height: imageInfo.height,
            fileSize: imageInfo.fileSize,
            base64DataUrl: imageInfo.base64DataUrl,
          })
        } catch (error) {
          console.error('[MyProfileView] ❌ 发送图片消息失败:', error)
          showMessage('发送图片消息失败，请重试', 'error')
        }
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
  height: 100%;      // 或 min-height: 100%; 看外层情况
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

// 功能卡片区域
.features-section {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  height: 100%;
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
// 清除所有会话确认弹窗内容样式
.delete-confirm-content {
  height: 100%;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  border: none;
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
