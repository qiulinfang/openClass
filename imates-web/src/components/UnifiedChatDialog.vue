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
      <!-- 左侧聊天记录（分类展示） -->
      <div class="left-panel">
        <!-- 分类切换标签 -->
        <div class="category-tabs">
          <q-tabs 
            v-model="activeCategory" 
            dense 
            class="text-grey"
            active-color="primary"
            indicator-color="primary"
            align="justify"
          >
            <q-tab name="ai" label="AI聊天" icon="smart_toy" />
            <q-tab name="teacher" label="教师答疑" icon="school" />
          </q-tabs>
        </div>

        <!-- AI聊天会话列表 -->
        <div v-show="activeCategory === 'ai'" class="session-list-container">
          <SessionList 
            ref="aiSessionListRef"
            :records="aiRecords"
            :selected-record-id="aiGeneralStore.currentSession?.sessionId"
            title="AI聊天记录"
            @record-click="handleAiRecordClick"
            @record-rename="handleAiRecordRename"
            @record-pin="handleAiRecordPin"
            @record-delete="handleAiRecordDelete"
            @batch-delete="handleAiBatchDelete"
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
                      ? '新增对话'
                      : aiGeneralStore.isCreatingSession
                        ? '创建中...'
                        : '请先在当前会话中发送消息'
                  }}
                </q-tooltip>
              </q-btn>
            </template>
          </SessionList>
        </div>

        <!-- 教师答疑会话列表 -->
        <div v-show="activeCategory === 'teacher'" class="session-list-container">
          <SessionList 
            ref="teacherSessionListRef"
            :records="teacherRecords"
            :selected-record-id="teacherSessionId"
            title="教师答疑记录"
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
                @click="handleTeacherNewChat"
              >
                <q-tooltip>新增对话</q-tooltip>
              </q-btn>
            </template>
          </SessionList>
        </div>
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
        <div v-else-if="activeCategory === 'teacher' && !teacherSessionId" class="empty-chat">
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
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { useUserStore } from '@/stores/userStore'
import { showMessage } from '@/utils'
import DraggableDialog from './DraggableDialog.vue'
import SessionList from './SessionList.vue'
import ChatView from './ChatView.vue'
import ChatSessionDebugPanel from './debug/ChatSessionDebugPanel.vue'
import type { QuestionRecord, AiGeneralSession } from '@/types'

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

// ==================== 响应式数据 ====================
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const activeCategory = ref<'ai' | 'teacher'>(props.initialCategory)
const showDebugPanel = ref(false)

// AI会话相关
const aiSessionListRef = ref<InstanceType<typeof SessionList> | null>(null)

// 教师会话相关
const teacherSessionId = ref<string>('')
const teacherSessionListRef = ref<InstanceType<typeof SessionList> | null>(null)
const teacherSessions = ref<Array<{
  sessionId: string
  sessionName: string
  subject: string
  createTime: number
}>>([])

// ==================== 计算属性 ====================

// AI聊天记录
const aiRecords = computed<QuestionRecord[]>(() => {
  return aiGeneralStore.sessions.map((session: AiGeneralSession) => ({
    id: session.sessionId,
    question: session.sessionName,
    answer: '',
    timestamp: session.updateTime,
    pinned: session.pinned || false,
  }))
})

// 教师答疑记录
const teacherRecords = computed<QuestionRecord[]>(() => {
  return teacherSessions.value.map(session => ({
    id: session.sessionId,
    question: session.sessionName,
    answer: session.subject === 'biology' ? '生物老师' : '数学老师',
    timestamp: session.createTime,
    pinned: false
  }))
})

// ==================== AI聊天相关方法 ====================

// 处理AI记录点击
const handleAiRecordClick = async (record: QuestionRecord) => {
  await aiGeneralStore.switchSession(record.id)
}

// 处理AI新增对话
const handleAiNewChatClick = async () => {
  if (!aiGeneralStore.canCreateSession) {
    if (!aiGeneralStore.isCreatingSession) {
      showMessage('请先在当前会话中发送消息', 'warning')
    }
    return
  }
  aiGeneralStore.resetState()
}

// 处理AI记录重命名
const handleAiRecordRename = async (record: QuestionRecord, newName: string) => {
  try {
    await aiGeneralStore.renameSession(record.id, newName)
    const index = aiGeneralStore.sessions.findIndex(
      (s: AiGeneralSession) => s.sessionId === record.id,
    )
    if (index >= 0) {
      aiGeneralStore.sessions[index].sessionName = newName
      await aiGeneralStore.saveSessions()
    }
  } catch (error) {
    console.error('重命名失败:', error)
  }
}

// 处理AI记录置顶
const handleAiRecordPin = async (record: QuestionRecord) => {
  try {
    await aiGeneralStore.togglePin(record.id)
  } catch (error) {
    console.error('置顶操作失败:', error)
    showMessage('操作失败', 'error')
  }
}

// 处理AI记录删除
const handleAiRecordDelete = async (record: QuestionRecord) => {
  try {
    await aiGeneralStore.deleteSession(record.id)
    showMessage('删除成功', 'success')
  } catch (error) {
    console.error('删除失败:', error)
    showMessage('删除失败', 'error')
  }
}

// 处理AI批量删除
const handleAiBatchDelete = async (recordIds: string[]) => {
  try {
    for (const id of recordIds) {
      await aiGeneralStore.deleteSession(id)
    }
    showMessage(`已删除 ${recordIds.length} 个会话`, 'success')
  } catch (error) {
    console.error('批量删除失败:', error)
    showMessage('批量删除失败', 'error')
  }
}

// ==================== 教师答疑相关方法 ====================

// 加载教师会话列表
const loadTeacherSessions = () => {
  console.log('[UnifiedChatDialog] 🔄 loadTeacherSessions() - 开始加载会话列表')
  
  const sessions: typeof teacherSessions.value = []
  const sessionIds = new Set<string>()
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('teacher_chat_') && key.endsWith('_session')) {
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
            const expectedKey = `teacher_chat_${session.sessionId}_session`
            if (key !== expectedKey) {
              localStorage.removeItem(key)
            }
            continue
          }
          
          const expectedKey = `teacher_chat_${session.sessionId}_session`
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

// 处理教师记录点击
const handleTeacherRecordClick = async (record: QuestionRecord) => {
  const session = teacherSessions.value.find(s => s.sessionId === record.id)
  if (!session) return
  
  teacherSessionId.value = session.sessionId
  
  const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
  localStorage.setItem('currentTeacherSubject', storeSubject)
  
  teacherStore.setSession(session)
  await teacherStore.loadChatHistory(session.sessionId)
  
  console.log('[UnifiedChatDialog] ✅ 选择教师会话:', session.sessionId)
}

// 处理教师记录删除
const handleTeacherRecordDelete = async (record: QuestionRecord) => {
  try {
    localStorage.removeItem(`teacher_chat_${record.id}_session`)
    await teacherStore.clearChatHistory(record.id)
    loadTeacherSessions()
    
    if (teacherSessionId.value === record.id) {
      teacherSessionId.value = ''
      teacherStore.clearSession()
    }
    
    showMessage('会话已删除', 'success')
  } catch (error) {
    console.error('删除会话失败:', error)
    showMessage('删除失败，请重试', 'error')
  }
}

// 处理教师批量删除
const handleTeacherBatchDelete = async (recordIds: string[]) => {
  try {
    let successCount = 0
    let failedCount = 0
    
    for (const id of recordIds) {
      try {
        localStorage.removeItem(`teacher_chat_${id}_session`)
        await teacherStore.clearChatHistory(id)
        
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
    
    loadTeacherSessions()
    
    if (failedCount === 0) {
      showMessage(`已删除 ${successCount} 个会话`, 'success')
    } else {
      showMessage(`成功删除 ${successCount} 个，失败 ${failedCount} 个`, 'warning')
    }
  } catch (error) {
    console.error('批量删除失败:', error)
    showMessage('批量删除失败，请重试', 'error')
  }
}

// 处理教师新建对话
const handleTeacherNewChat = async () => {
  await createTeacherSession(props.initialTeacherSubject)
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

    const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem('currentTeacherSubject', storeSubject)
    
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
    
    await nextTick()
    
    if (teacherSessionListRef.value) {
      teacherSessionListRef.value.scrollToTop()
    }
    
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
    const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem('currentTeacherSubject', storeSubject)
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

    .category-tabs {
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      padding: 0 8px;

      :deep(.q-tabs) {
        min-height: 40px;
      }

      :deep(.q-tab) {
        min-height: 40px;
        font-size: 13px;
      }
    }

    .session-list-container {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
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

