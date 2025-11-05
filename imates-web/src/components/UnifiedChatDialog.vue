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
          :selected-ai-session-id="aiGeneralStore.currentSession?.sessionId"
          :selected-teacher-session-id="teacherSessionId"
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
              flat
              round
              dense
              icon="add"
              color="primary"
              size="sm"
              class="new-chat-btn"
              :disable="!aiGeneralStore.canCreateSession"
              @click="handleAiNewChatClick"
            >
              <q-tooltip>
                {{
                  aiGeneralStore.canCreateSession
                    ? '新增AI对话'
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
        <!-- AI聊天界面 -->
        <ChatView 
          v-if="activeCategory === 'ai'"
          type="ai-general"
        />
        <!-- 教师答疑界面 -->
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
  </DraggableDialog>

  <!-- 调试面板 -->
  <ChatSessionDebugPanel v-if="isDev" v-model="showDebugPanel" />
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useUserStore } from '@/stores/userStore'
import { showMessage } from '@/utils'
import { getCurrentUserIdOrDefault } from '@/utils/userId'
import DraggableDialog from './DraggableDialog.vue'
import SessionTree from './SessionTree.vue'
import ChatView from './ChatView.vue'
import ChatSessionDebugPanel from './debug/ChatSessionDebugPanel.vue'
import type { AiGeneralSession } from '@/types'
import type { TeacherSession } from '@/stores/teacherChatStore'

// 第1步：判断是否显示调试功能（仅通过环境变量控制）
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true'

// ==================== Props & Emits ====================
interface Props {
  modelValue: boolean
  initialCategory?: 'ai' | 'teacher' // 初始显示的分类
  initialTeacherSubject?: 'biology' | 'math' // 初始教师科目（用于创建新会话）
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  initialCategory: 'ai',
  initialTeacherSubject: 'math'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'session-created': [sessionId: string, type: 'ai' | 'teacher'] // 新会话创建事件
}>()

// ==================== Store ====================
const aiGeneralStore = useAiGeneralChatStore()
const teacherStore = useTeacherChatStore()
const userStore = useUserStore()

// SessionTree 组件引用
const sessionTreeRef = ref<InstanceType<typeof SessionTree> | null>(null)

// ==================== 响应式数据 ====================
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 当前激活的分类（根据选中的会话自动判断）
const activeCategory = ref<'ai' | 'teacher'>(props.initialCategory)
const showDebugPanel = ref(false)

// 教师会话相关
const teacherSessionId = ref<string>('')
const teacherSessions = ref<TeacherSession[]>([])

// ==================== AI聊天相关方法 ====================

// 处理AI会话点击
const handleAiSessionClick = async (sessionId: string) => {
  await aiGeneralStore.switchSession(sessionId)
  activeCategory.value = 'ai'
}

// 处理AI新增对话
const handleAiNewChatClick = async () => {
    // 根据当前选中的节点类型来决定创建哪种类型的对话
  const selectedCategory = sessionTreeRef.value?.getSelectedCategory()
  
  if (selectedCategory === 'biology' || selectedCategory === 'math') {
    // 如果选中的是教师分类，创建对应科目的教师对话
    await handleTeacherNewChat(selectedCategory)
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
  activeCategory.value = 'ai'
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
      activeCategory.value = 'ai'
    }
  } catch (error) {
    console.error('删除失败:', error)
    showMessage('删除失败', 'error')
  }
}

// ==================== 教师答疑相关方法 ====================

// 加载教师会话列表
const loadTeacherSessions = () => {
  console.log('[UnifiedChatDialog] 🔄 loadTeacherSessions() - 开始加载会话列表')
  
  // 第1步：获取当前用户ID并构建会话前缀
  const userId = getCurrentUserIdOrDefault()
  const sessionPrefix = `${userId}_teacher_chat_`
  
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
  
  console.log('[UnifiedChatDialog] ✅ loadTeacherSessions() - 加载完成:', sessions.length)
}

// 处理教师会话点击
const handleTeacherSessionClick = async (sessionId: string, subject: string) => {
  const session = teacherSessions.value.find(s => s.sessionId === sessionId)
  if (!session) return
  
  teacherSessionId.value = session.sessionId
  
  const userId = getCurrentUserIdOrDefault()
  const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
  localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
  
  teacherStore.setSession(session)
  await teacherStore.loadChatHistory(session.sessionId)
  
  activeCategory.value = 'teacher'
  
  console.log('[UnifiedChatDialog] ✅ 选择教师会话:', session.sessionId)
}

// 处理教师会话删除
const handleTeacherSessionDelete = async (sessionId: string) => {
  try {
    const userId = getCurrentUserIdOrDefault()
    const sessionPrefix = `${userId}_teacher_chat_`
    localStorage.removeItem(`${sessionPrefix}${sessionId}_session`)
    await teacherStore.clearChatHistory(sessionId)
    loadTeacherSessions()
    
    if (teacherSessionId.value === sessionId) {
      teacherSessionId.value = ''
      teacherStore.clearSession()
      activeCategory.value = 'ai' // 删除后切换到AI分类
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
  console.log('[UnifiedChatDialog] 🎯 createTeacherSession() - 初始化教师对话')
  try {
    teacherStore.clearSession()
    
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
    
    const newSessionId = `teacher-${Date.now()}`
    
    const newSession = {
      sessionId: newSessionId,
      sessionName: subject === 'biology' ? '生物答疑' : '数学答疑',
      subject: subject,
      createTime: Date.now()
    }
    localStorage.setItem(`teacher_chat_${newSessionId}_session`, JSON.stringify(newSession))
    
    teacherSessionId.value = newSessionId
    
    await teacherStore.initMessageReceiver()
    loadTeacherSessions()
    
    emit('session-created', newSessionId, 'teacher')
    
    // 切换到教师分类
    activeCategory.value = 'teacher'
    
    console.log('[UnifiedChatDialog] ✅ 教师对话准备完成')
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
    teacherStore.setSession(session)
    const userId = getCurrentUserIdOrDefault()
    const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
  }
  activeCategory.value = 'teacher'
}

// 切换到指定分类
const switchCategory = (category: 'ai' | 'teacher') => {
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
    // 根据 initialCategory 切换分类
    activeCategory.value = props.initialCategory
    
    // 加载AI会话列表
    await aiGeneralStore.loadSessions()
    
    // 如果没有当前AI会话且有会话列表，加载第一个会话
    if (!aiGeneralStore.currentSession && aiGeneralStore.sessions.length > 0) {
      const firstSession = aiGeneralStore.sessions[0]
      await aiGeneralStore.switchSession(firstSession.sessionId)
    }
    
    // 加载教师会话列表
    loadTeacherSessions()
    
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

// ==================== 清理 ====================
onUnmounted(async () => {
  if (teacherSessionId.value) {
    await teacherStore.cleanupMessageReceiver()
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

