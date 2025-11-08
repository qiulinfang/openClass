<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="聊天对话"
    :initial-width="1000"
    :initial-height="600"
    :min-width="600"
    :min-height="400"
  >
    <div class="unified-chat-content">
      <!-- 左侧聊天记录（树形结构） -->
      <div class="left-panel">
        <SessionTree
          ref="sessionTreeRef"
          :ai-sessions="aiGeneralStore.sessions"
          :teacher-sessions="teacherSessions"
          :selected-session-id="selectedSessionId"
          title="聊天记录"
          @ai-session-click="handleAiSessionClick"
          @teacher-session-click="handleTeacherSessionClick"
          @ai-session-rename="handleAiSessionRename"
          @ai-session-pin="handleAiSessionPin"
          @ai-session-delete="handleAiSessionDelete"
          @teacher-session-delete="handleTeacherSessionDelete"
          @ai-new-chat="handleAiNewChatClick"
          @teacher-new-chat="handleTeacherNewChat"
        >
          <template #header-actions>
            <q-btn
              v-if="isDev"
              flat
              round
              dense
              icon="bug_report"
              color="orange"
              size="sm"
              class="debug-btn"
              @click="showDebugPanel = true"
            >
              <q-tooltip>调试面板</q-tooltip>
            </q-btn>
            <q-btn
              v-if="shouldShowNewChatButton"
              flat
              round
              dense
              icon="add"
              color="primary"
              size="sm"
              class="new-chat-btn"
              :disable="!canCreateNewChat"
              @click="handleAiNewChatClick"
            >
              <q-tooltip>
                {{
                  canCreateNewChat
                    ? (isTeacherCategory ? '新增老师对话' : '新增AI对话')
                    : aiGeneralStore.isCreatingSession
                      ? '创建中...'
                      : '请先在当前会话中发送消息'
                }}
              </q-tooltip>
            </q-btn>
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
          </template>
        </SessionTree>
      </div>

      <!-- 右侧聊天界面 -->
      <div class="right-panel">
        <!-- 聊天界面 - 根据当前选中的对话类型动态确定 type -->
        <ChatView 
          v-if="activeCategory === 'ai-general'"
          type="ai-general"
          @open-teacher-dialog="handleOpenTeacherDialog"
          @switch-to-teacher="handleSwitchToTeacher"
        />
        <ChatView 
          v-else-if="activeCategory === 'teacher' && teacherSessionId"
          type="teacher"
          :session-id="teacherSessionId"
          :key="teacherSessionId"
        />
        <!-- 空状态 -->
        <div v-else class="empty-chat">
          <q-icon name="chat" size="64px" color="grey-4" />
          <div class="text-grey-6 q-mt-md">请选择或创建一个会话</div>
        </div>
      </div>
    </div>

    <!-- 调试面板 -->
    <ChatSessionDebugPanel v-if="isDev" v-model="showDebugPanel" />

    <!-- 老师选择对话框 -->
    <q-dialog v-model="showTeacherSelectDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">选择老师</div>
        </q-card-section>

        <q-card-section>
          <q-list>
            <q-item
              v-for="teacher in availableTeachers"
              :key="teacher.subject"
              clickable
              v-close-popup
              @click="handleTeacherSelect(teacher.subject)"
            >
              <q-item-section avatar>
                <q-icon name="person" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ teacher.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherGeneralChatStore } from '@/stores/teacherGeneralChatStore'
import { useUserStore } from '@/stores/userStore'
import { showMessage } from '@/utils'
import { getCurrentUserIdOrDefault } from '@/utils/user/userId'
import DraggableDialog from './DraggableDialog.vue'
import SessionTree from './SessionTree.vue'
import ChatView from './ChatView.vue'
import ChatSessionDebugPanel from './debug/ChatSessionDebugPanel.vue'
import type { AiGeneralSession } from '@/types'
import type { TeacherSession } from '@/stores/teacherGeneralChatStore'
import type { ChatBubble } from '@/types'

// 第1步：判断是否显示调试功能（仅通过环境变量控制）
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

// ==================== Props & Emits ====================
interface Props {
  modelValue: boolean
  initialTeacherSubject?: 'biology' | 'math' // 初始教师科目（用于创建新会话）
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  initialTeacherSubject: 'math'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'session-created': [sessionId: string, type: 'ai-general' | 'teacher'] // 新会话创建事件
}>()

// ==================== Store ====================
const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherGeneralChatStore()
const userStore = useUserStore()

// SessionTree 组件引用
const sessionTreeRef = ref<InstanceType<typeof SessionTree> | null>(null)

// ==================== 响应式数据 ====================
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 当前激活的分类（根据选中的会话自动判断）
const activeCategory = ref<'ai-general' | 'teacher'>('ai-general')
const showDebugPanel = ref(false)

// 教师会话相关
const teacherSessionId = ref<string>('')
const teacherSessions = ref<TeacherSession[]>([])

// 老师选择对话框
const showTeacherSelectDialog = ref(false)
const availableTeachers = ref<Array<{ subject: 'biology' | 'math', name: string }>>([])

// 通用的选中会话ID（可以是AI会话或教师会话）
const selectedSessionId = computed(() => {
  if (activeCategory.value === 'ai-general' && aiGeneralStore.currentSession?.sessionId) {
    return aiGeneralStore.currentSession.sessionId
  } else if (activeCategory.value === 'teacher' && teacherSessionId.value) {
    return teacherSessionId.value
  }
  return undefined
})

// 判断当前选中的分类是否为老师类型
const isTeacherCategory = computed(() => {
  const selectedCategory = sessionTreeRef.value?.getSelectedCategory()
  return selectedCategory === 'biology' || selectedCategory === 'math'
})

// 判断是否可以创建新对话
const canCreateNewChat = computed(() => {
  if (isTeacherCategory.value) {
    // 老师类型：只要有可选的老师就可以创建
    return teacherChatStore.getAvailableTeachers().length > 0
  } else {
    // AI类型：需要满足原有条件
    return aiGeneralStore.canCreateSession
  }
})

// 判断是否应该显示新增按钮
const shouldShowNewChatButton = computed(() => {
  if (isTeacherCategory.value) {
    // 老师类型：只有当有可选的老师时才显示
    return teacherChatStore.getAvailableTeachers().length > 0
  } else {
    // AI类型：始终显示（但可能被禁用）
    return true
  }
})

// ==================== AI聊天相关方法 ====================

// 处理AI会话点击
const handleAiSessionClick = async (sessionId: string) => {
  console.log('handleAiSessionClick', sessionId)
  await aiGeneralStore.switchSession(sessionId)
  activeCategory.value = 'ai-general'
  // selectedSessionId 会自动更新（通过 computed）
}

// 处理AI新增对话
const handleAiNewChatClick = async () => {
  // 根据当前选中的节点类型来决定创建哪种类型的对话
  const selectedCategory = sessionTreeRef.value?.getSelectedCategory()
  
  if (selectedCategory === 'biology' || selectedCategory === 'math') {
    // 如果选中的是教师分类，显示老师选择对话框
    availableTeachers.value = teacherChatStore.getAvailableTeachers()
    
    if (availableTeachers.value.length === 0) {
      showMessage('所有老师都有对话记录', 'info')
      return
    }
    
    showTeacherSelectDialog.value = true
    return
  }
  
  // 默认创建AI对话
  if (!aiGeneralStore.canCreateSession) {
    if (!aiGeneralStore.isCreatingSession) {
      showMessage('请先在当前会话中发送消息', 'warning')
    }
    return
  }
  aiGeneralStore.resetState()
  activeCategory.value = 'ai-general'
}

// 处理老师选择
const handleTeacherSelect = async (subject: 'biology' | 'math') => {
  showTeacherSelectDialog.value = false
  await handleTeacherNewChat(subject)
}

// 处理AI会话重命名
const handleAiSessionRename = async (sessionId: string, newName: string) => {
  try {
    await aiGeneralStore.renameSession(sessionId, newName)
    const index = aiGeneralStore.sessions.findIndex(
      (s: AiGeneralSession) => s.sessionId === sessionId,
    )
    if (index >= 0) {
      aiGeneralStore.sessions[index].sessionName = newName
      await aiGeneralStore.saveSessions()
    }
  } catch (error) {
    console.error('重命名失败:', error)
  }
}

// 处理AI会话置顶
const handleAiSessionPin = async (sessionId: string) => {
  try {
    await aiGeneralStore.togglePin(sessionId)
  } catch (error) {
    console.error('置顶操作失败:', error)
    showMessage('操作失败', 'error')
  }
}

// 处理AI会话删除
const handleAiSessionDelete = async (sessionId: string) => {
  try {
    await aiGeneralStore.deleteSession(sessionId)
    showMessage('删除成功', 'success')
    // 如果删除的是当前会话，切换到AI分类
    if (aiGeneralStore.currentSession?.sessionId === sessionId) {
      activeCategory.value = 'ai-general'
    }
  } catch (error) {
    console.error('删除失败:', error)
    showMessage('删除失败', 'error')
  }
}

// ==================== 教师通用对话相关方法 ====================

// 加载教师会话列表
const loadTeacherSessions = () => {
  // 第1步：获取当前用户ID并构建会话前缀
  const userId = getCurrentUserIdOrDefault()
  const sessionPrefix = `${userId}_teacher-general-`
  
  const sessions: TeacherSession[] = []
  const sessionIds = new Set<string>()
  
  // 第2步：遍历localStorage查找所有教师会话（仅当前用户）
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(sessionPrefix) && key.endsWith('_session')) {
      try {
        const sessionData = localStorage.getItem(key)
        if (sessionData) {
          const session = JSON.parse(sessionData)
          
          if (!session || !session.sessionId || !session.sessionName) {
            console.warn('[UnifiedChatDialog] ⚠️ 跳过无效会话数据:', key)
            continue
          }
          
          if (sessionIds.has(session.sessionId)) {
            console.warn('[UnifiedChatDialog] ⚠️ 发现重复的会话ID，跳过:', session.sessionId)
            const expectedKey = `${sessionPrefix}${session.sessionId}_session`
            if (key !== expectedKey) {
              localStorage.removeItem(key)
            }
            continue
          }
          
          const expectedKey = `${sessionPrefix}${session.sessionId}_session`
          if (key !== expectedKey) {
            console.warn('[UnifiedChatDialog] ⚠️ 键名与sessionId不匹配:', key)
            const correctKeyData = localStorage.getItem(expectedKey)
            if (correctKeyData) {
              localStorage.removeItem(key)
              continue
            } else {
              localStorage.removeItem(key)
              localStorage.setItem(expectedKey, sessionData)
            }
          }
          
          sessions.push(session)
          sessionIds.add(session.sessionId)
        }
      } catch (error) {
        console.error('[UnifiedChatDialog] ❌ 解析会话数据失败:', key, error)
      }
    }
  }
  
  sessions.sort((a, b) => b.createTime - a.createTime)
  teacherSessions.value = sessions
}

// 处理教师会话点击
const handleTeacherSessionClick = async (sessionId: string, subject: string) => {
  console.log('handleTeacherSessionClick', sessionId, subject)
  const session = teacherSessions.value.find(s => s.sessionId === sessionId)
  if (!session) return
  
  teacherSessionId.value = session.sessionId
  
  const userId = getCurrentUserIdOrDefault()
  const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
  localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
  
  teacherChatStore.setSession(session)
  await teacherChatStore.loadChatHistory(session.sessionId)
  
  activeCategory.value = 'teacher'
  // selectedSessionId 会自动更新（通过 computed）
}

// 处理教师会话删除
const handleTeacherSessionDelete = async (sessionId: string) => {
  try {
    const userId = getCurrentUserIdOrDefault()
    const sessionPrefix = `${userId}_teacher-general-`
    localStorage.removeItem(`${sessionPrefix}${sessionId}_session`)
    await teacherChatStore.clearChatHistory(sessionId)
    loadTeacherSessions()
    
    if (teacherSessionId.value === sessionId) {
      teacherSessionId.value = ''
      teacherChatStore.clearSession()
      activeCategory.value = 'ai-general' // 删除后切换到AI分类
    }
    
    showMessage('会话已删除', 'success')
  } catch (error) {
    console.error('删除会话失败:', error)
    showMessage('删除失败，请重试', 'error')
  }
}

// 处理教师新建对话
const handleTeacherNewChat = async (subject: 'biology' | 'math') => {
  await createTeacherSession(subject || props.initialTeacherSubject)
}

// 创建教师会话（供外部调用）
const createTeacherSession = async (subject: 'biology' | 'math') => {
  try {
    teacherChatStore.clearSession()
    
    const userInfo = userStore.userInfo || {
      id: '',
      name: '',
      avatar: '',
      roles: [] as string[]
    }
    
    if (!userInfo.id) {
      showMessage('无法获取用户信息，请重新登录', 'error')
      return
    }

    const userId = getCurrentUserIdOrDefault()
    const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
    
    // 使用 teacherChatStore.createTeacherSession 统一创建会话
    // 生成 aiSessionId（格式与 ChatView 保持一致）
    const aiSessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const aiSessionName = subject === 'biology' ? '生物' : '数学'
    
    // 调用 teacherChatStore.createTeacherSession，它会检查是否已存在相同会话并复用
    const createdSession = teacherChatStore.createTeacherSession(
      aiSessionId,
      aiSessionName,
      subject
    )
    
    if (createdSession) {
      teacherSessionId.value = createdSession.sessionId
      
      await teacherChatStore.initMessageReceiver()
      loadTeacherSessions()
      
      emit('session-created', createdSession.sessionId, 'teacher')
      
      // 切换到教师分类
      activeCategory.value = 'teacher'
    } else {
      showMessage('创建教师会话失败，请重试', 'error')
    }
  } catch (error) {
    console.error('[UnifiedChatDialog] ❌ 准备教师对话失败:', error)
    showMessage('准备教师对话失败，请重试', 'error')
  }
}

// 设置当前教师会话（供外部调用）
const setTeacherSession = (sessionId: string) => {
  teacherSessionId.value = sessionId
  const session = teacherSessions.value.find(s => s.sessionId === sessionId)
  if (session) {
    teacherChatStore.setSession(session)
    const userId = getCurrentUserIdOrDefault()
    const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
  }
  activeCategory.value = 'teacher'
}

// 处理从ChatView转发后跳转到老师对话的事件（对话框已打开，只需设置会话）
const handleOpenTeacherDialog = async ({ sessionId }: { sessionId: string; message?: ChatBubble }) => {
  try {
    // 确保会话列表已加载（如果还未加载）
    if (teacherSessions.value.length === 0) {
      loadTeacherSessions()
    }
    
    // 设置指定的会话（会自动切换到教师分类）
    setTeacherSession(sessionId)
    
    // SessionTree 会自动通过 selectedSessionId computed 更新选中状态
  } catch (error) {
    console.error('设置老师会话失败:', error)
    showMessage('设置老师会话失败', 'error')
  }
}

// 处理批量转发后跳转到老师对话的事件（对话框已打开，只需设置会话）
const handleSwitchToTeacher = async (forwardData?: { 
  messages?: ChatBubble[]; 
  currentQuestion?: unknown; 
  additionalMessage?: string;
  forwardMode?: string;
  successCount?: number;
  sessionId?: string;
}) => {
  if (!forwardData?.sessionId) {
    return
  }
  
  try {
    // 确保会话列表已加载（如果还未加载）
    if (teacherSessions.value.length === 0) {
      loadTeacherSessions()
    }
    
    // 设置指定的会话（会自动切换到教师分类）
    setTeacherSession(forwardData.sessionId)
    
    // SessionTree 会自动通过 selectedSessionId computed 更新选中状态
  } catch (error) {
    console.error('设置老师会话失败:', error)
    showMessage('设置老师会话失败', 'error')
  }
}

// 切换到指定分类
const switchCategory = (category: 'ai-general' | 'teacher') => {
  activeCategory.value = category
}

// 暴露方法供外部调用
defineExpose({
  createTeacherSession,
  setTeacherSession,
  switchCategory,
  loadTeacherSessions
})

// ==================== 监听器 ====================

// 监听对话框打开/关闭
let refreshTimer: ReturnType<typeof setInterval> | null = null

watch(localVisible, async (isOpen) => {
  if (isOpen) {
    // 加载AI会话列表
    await aiGeneralStore.loadSessions()
    
    // 加载教师会话列表
    loadTeacherSessions()
    
    // 等待下一个 tick，确保数据已更新
    await nextTick()
    
    // 根据当前选中的会话自动判断分类
    // 优先检查是否有当前AI会话
    if (aiGeneralStore.currentSession?.sessionId) {
      activeCategory.value = 'ai-general'
      await aiGeneralStore.switchSession(aiGeneralStore.currentSession.sessionId)
    } else if (aiGeneralStore.sessions.length > 0) {
      // 如果有AI会话，选中第一个
      const firstSession = aiGeneralStore.sessions[0]
      await aiGeneralStore.switchSession(firstSession.sessionId)
      activeCategory.value = 'ai-general'
    } else if (teacherSessionId.value && teacherSessions.value.length > 0) {
      // 如果有教师会话ID，选中对应的教师会话
      const session = teacherSessions.value.find(s => s.sessionId === teacherSessionId.value)
      if (session) {
        await handleTeacherSessionClick(session.sessionId, session.subject)
      }
    } else if (teacherSessions.value.length > 0) {
      // 如果有教师会话，选中第一个
      const firstTeacherSession = teacherSessions.value[0]
      await handleTeacherSessionClick(firstTeacherSession.sessionId, firstTeacherSession.subject)
    } else {
      // 默认使用AI分类
      activeCategory.value = 'ai-general'
    }
    
    // 每5秒自动刷新一次（用于显示自动生成的标题）
    refreshTimer = setInterval(() => {
      loadTeacherSessions()
    }, 5000)
  } else {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }
})

// 监听会话恢复事件，立即刷新会话列表
onMounted(() => {
  const handleSessionRestored = () => {
    loadTeacherSessions()
  }
  
  window.addEventListener('teacher-session-restored', handleSessionRestored)
  
  // 在组件卸载时移除监听器
  onUnmounted(() => {
    window.removeEventListener('teacher-session-restored', handleSessionRestored)
  })
})

// ==================== 清理 ====================
onUnmounted(async () => {
  if (teacherSessionId.value) {
    await teacherChatStore.cleanupMessageReceiver()
  }
  
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style lang="scss" scoped>
.unified-chat-content {
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
    background: #ffffff;
    border-radius: 8px;
    margin: 8px;
    
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

// 响应式设计
@media (max-width: 768px) {
  .unified-chat-content {
    flex-direction: column;
    
    .left-panel {
      width: 100%;
      height: 40%;
      border-right: none;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .right-panel {
      height: 60%;
    }
  }
}
</style>

