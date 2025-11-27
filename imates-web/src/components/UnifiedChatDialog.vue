<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="聊天对话"
    :initial-width="1000"
    :initial-height="600"
    :min-width="600"
    :min-height="400"
    :fullscreen="true"
    @toggle-fullscreen="emit('toggle-mode')"
  >
    <div class="unified-chat-content">
      <!-- 左侧聊天记录（树形结构） -->
      <div class="left-panel">
        <SessionTree
          ref="sessionTreeRef"
          @session-switched="handleSessionSwitched"
          @ai-session-deleted="handleAiSessionDeleted"
          @teacher-session-deleted="handleTeacherSessionDeleted"
          @category-should-change="handleCategoryShouldChange"
        >
          <template #header-actions>
            <!-- 调试按钮 -->
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
            <!-- 新增对话按钮 -->
            <q-btn
              flat
              round
              dense
              icon="add"
              color="primary"
              size="sm"
              class="new-chat-btn"
              :disable="!canCreateNewChat"
              @click="handleNewChatClick"
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
            <!-- 刷新列表按钮 -->
            <q-btn 
              flat 
              dense 
              round 
              icon="refresh" 
              size="sm" 
              @click="aiGeneralStore.loadSessions()"
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
          v-if="activeCategory === 'ai-general'"
          type="ai-general"
          :compressed-height="225"
          @open-teacher-dialog="handleOpenTeacherDialog"
          @switch-to-teacher="handleSwitchToTeacher"
        >
        </ChatView>
        <!-- 教师聊天界面 -->
        <ChatView
          v-else-if="activeCategory === 'teacher' && teacherChatStore.currentSession?.sessionId"
          type="teacher-general"
          :compressed-height="225"
          :session-id="teacherChatStore.currentSession.sessionId"
          :key="teacherChatStore.currentSession.sessionId"
        >
        </ChatView>
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
import { ref, computed, onUnmounted } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherGeneralChatStore } from '@/stores/teacherGeneralChatStore'
import { showMessage } from '../utils'
import { authStorageService } from '@/services/auth-storage-service'
import DraggableDialog from './DraggableDialog.vue'
import SessionTree from './SessionTree.vue'
import ChatView from './ChatView.vue'
import ChatSessionDebugPanel from './debug/ChatSessionDebugPanel.vue'
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
  'session-created': [sessionId: string, type: 'ai-general' | 'teacher-general'] // 新会话创建事件
  'toggle-mode': []
}>()

// ==================== Store ====================
const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherGeneralChatStore()

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

// 教师会话相关（已移除，现在直接从 store 获取）

// 老师选择对话框
const showTeacherSelectDialog = ref(false)
const availableTeachers = ref<Array<{ subject: 'biology' | 'math', name: string }>>([])

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


// ==================== AI聊天相关方法 ====================

// 处理会话切换（接收 SessionTree 的最终结果）
const handleSessionSwitched = (type: 'ai' | 'teacher', sessionId: string) => {
  // 只更新分类，所有切换逻辑已在 SessionTree 内部完成
  activeCategory.value = type === 'ai' ? 'ai-general' : 'teacher'
}

// 处理新增对话（可以是AI对话或教师对话）
const handleNewChatClick = async () => {
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
  await createTeacherSession(subject)
}

// 处理AI会话删除结果（由 SessionTree 直接调用 store 删除后通知）
const handleAiSessionDeleted = (sessionId: string, success: boolean, wasCurrentSession: boolean) => {
  if (!success) {
    // 失败情况已在 SessionTree 中显示错误消息
    return
  }
  
    // 如果删除的是当前会话，切换到AI分类
  if (wasCurrentSession) {
      activeCategory.value = 'ai-general'
  }
  
}

// ==================== 教师通用对话相关方法 ====================

// 处理教师会话删除结果（由 SessionTree 直接调用 store 删除后通知）
const handleTeacherSessionDeleted = (sessionId: string, success: boolean, wasCurrentSession: boolean) => {
  if (!success) {
    // 失败情况已在 SessionTree 中显示错误消息
    return
  }
  
  // 如果删除的是当前会话，切换到AI分类（store 的 currentSession 已由删除逻辑清空）
  if (wasCurrentSession) {
    activeCategory.value = 'ai-general'
    }
}

// 创建教师会话（供外部调用）
// 职责：封装完整的会话创建流程，包括验证用户信息、设置localStorage、创建会话、初始化消息接收器等
const createTeacherSession = async (subject: 'biology' | 'math') => {
  try {
    // 第1步：验证用户信息
    const { getUserInfo } = await import('../services/auth-storage-service')
    const userInfo = getUserInfo() || {
      id: '',
      name: '',
      avatar: '',
      roles: [] as string[]
    }
    
    if (!userInfo.id) {
      console.error('[UnifiedChatDialog] ❌ 无法获取用户信息，请重新登录')
      showMessage('无法获取用户信息，请重新登录', 'error')
      return
    }

    // 第2步：设置 localStorage 中的 currentTeacherSubject
    const userId = authStorageService.getCurrentUserIdOrDefault()
    const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
    
    // 第3步：生成 sessionId 和 sessionName
    const aiSessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const aiSessionName = subject === 'biology' ? '生物' : '数学'
    
    // 第4步：调用 createTeacherSession 创建或复用会话
    const createdSession = teacherChatStore.createTeacherSession(aiSessionId, aiSessionName, subject)
    
    if (!createdSession) {
      console.error('[UnifiedChatDialog] ❌ 创建教师会话失败')
      showMessage('创建教师会话失败，请重试', 'error')
      return
    }
    
    // 第5步：初始化消息接收器
    await teacherChatStore.initMessageReceiver()
    
    // 第6步：切换到教师分类（store 的 currentSession 已由 createTeacherSession 设置）
    activeCategory.value = 'teacher'

    // 第8步：触发会话创建事件
    emit('session-created', createdSession.sessionId, 'teacher-general')
  } catch (error) {
    console.error('[UnifiedChatDialog] ❌ 创建教师会话失败:', error)
    showMessage('创建教师会话失败，请重试', 'error')
  }
}

// 设置当前教师会话（内部方法，通过 watch store 自动同步 UI）
const setTeacherSession = (sessionId: string) => {
  const allSessions = teacherChatStore.getAllSessions()
  const session = allSessions.find(s => s.sessionId === sessionId)
  if (session) {
    teacherChatStore.setSession(session)
    const userId = authStorageService.getCurrentUserIdOrDefault()
    const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
    // UI 状态会通过 watch teacherChatStore.currentSession 自动同步
  }
}

// 处理从ChatView转发后跳转到老师对话的事件（对话框已打开，只需设置会话）
const handleOpenTeacherDialog = async ({ sessionId }: { sessionId: string; message?: ChatBubble }) => {
  try {
    // 设置指定的会话（会自动切换到教师分类）
    // SessionTree 会直接从 store 获取最新数据，无需手动加载
    setTeacherSession(sessionId)
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
    // 设置指定的会话（会自动切换到教师分类）
    // SessionTree 会直接从 store 获取最新数据，无需手动加载
    setTeacherSession(forwardData.sessionId)
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
  switchCategory
})

// ==================== 监听器 ====================

// 处理分类应该改变的事件（由 SessionTree 发出）
const handleCategoryShouldChange = (category: 'ai-general' | 'teacher') => {
  if (category === 'teacher') {
    activeCategory.value = 'teacher'
  } else if (activeCategory.value === 'teacher') {
    // 如果当前是教师分类但会话被清空，切换到 AI 分类
    activeCategory.value = 'ai-general'
  }
}


// ==================== 清理 ====================
onUnmounted(async () => {
  if (teacherChatStore.currentSession?.sessionId) {
    await teacherChatStore.cleanupMessageReceiver()
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

