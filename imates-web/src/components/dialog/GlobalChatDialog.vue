<template>
  <Modal
    v-model="localVisible"
    title="聊天对话"
    :initial-width="1000"
    :initial-height="600"
    :min-width="600"
    :min-height="400"
    :fullscreen="true"
    @toggle-fullscreen="emit('toggle-mode')"
  >
    <div class="global-chat-content">
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
                    ? isTeacherCategory
                      ? '新增老师对话'
                      : '新增AI对话'
                    : aiGeneralStore.isCreatingSession
                    ? '创建中...'
                    : '请先在当前会话中发送消息'
                }}
              </q-tooltip>
            </q-btn>
            <!-- 刷新列表按钮 -->
            <q-btn flat dense round icon="refresh" size="sm" @click="aiGeneralStore.loadSessions()">
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
          :compressed-height="325"
          @open-teacher-dialog="handleOpenTeacherDialog"
          @switch-to-teacher="handleSwitchToTeacher"
        >
          <!-- 新增会话按钮 -->
          <template #header-right>
            <div @click="handleNewChatClick" class="add-session-btn">
              <img :src="addSessionIcon" class="add-session-icon" alt="新增会话" />
            </div>
          </template>
        </ChatView>
        <!-- 教师聊天界面 -->
        <ChatView
          v-else-if="activeCategory === 'teacher' && teacherChatStore.currentSession?.sessionId"
          type="teacher"
          :compressed-height="325"
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
    <TeacherSelectionDialog
      v-model="showTeacherSelectDialog"
      :available-teachers="availableTeachers"
      @confirm="handleTeacherSelect"
      @cancel="showTeacherSelectDialog = false"
    />
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'
import { showMessage } from '../../utils'
import { getUserInfo, getUserId } from '@/services'
import Modal from '../base/Modal.vue'
import SessionTree from '../SessionTree.vue'
import ChatView from '../ChatView.vue'
import ChatSessionDebugPanel from '../debug/ChatSessionDebugPanel.vue'
import TeacherSelectionDialog from './TeacherSelectionDialog.vue'
import addSessionIcon from '/icons/addsession.png'
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
  initialTeacherSubject: 'math',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'session-created': [sessionId: string, type: 'ai-general' | 'teacher'] // 新会话创建事件
  'toggle-mode': []
}>()

// ==================== Store ====================
const aiGeneralStore = useAiGeneralChatStore()
const teacherChatStore = useTeacherChatStore()

// SessionTree 组件引用
const sessionTreeRef = ref<InstanceType<typeof SessionTree> | null>(null)

// ==================== 响应式数据 ====================
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// 当前激活的分类（根据选中的会话自动判断）
const activeCategory = ref<'ai-general' | 'teacher'>('ai-general')
const showDebugPanel = ref(false)

// 教师会话相关（已移除，现在直接从 store 获取）

// 老师选择对话框
const showTeacherSelectDialog = ref(false)
const availableTeachers = ref<Array<{ subject: 'BIOLOGY' | 'MATH'; name: string }>>([])

// 判断当前选中的分类是否为老师类型
const isTeacherCategory = computed(() => {
  const selectedCategory = sessionTreeRef.value?.getSelectedCategory()
  return selectedCategory === 'BIOLOGY' || selectedCategory === 'MATH'
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
const handleSessionSwitched = (type: 'ai' | 'teacher', _sessionId: string) => {
  // 只更新分类，所有切换逻辑已在 SessionTree 内部完成
  activeCategory.value = type === 'ai' ? 'ai-general' : 'teacher'
}

// 处理新增对话（可以是AI对话或教师对话）
const handleNewChatClick = async () => {
  // 根据当前选中的节点类型来决定创建哪种类型的对话
  const selectedCategory = sessionTreeRef.value?.getSelectedCategory()

  if (selectedCategory === 'BIOLOGY' || selectedCategory === 'MATH') {
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
const handleTeacherSelect = async (subject: 'BIOLOGY' | 'MATH') => {
  showTeacherSelectDialog.value = false

  // 根据学科找到对应的写死会话
  const userId = getUserId() || 'default'
  const sessionId = `teacher_${userId}_${subject}`
  const allSessions = Object.values(teacherChatStore.loadAllSessions())
  const session = allSessions.find((s) => s.sessionId === sessionId)

  if (session) {
    // 设置当前会话
    teacherChatStore.setSession(session)

    // 初始化消息接收器
    await teacherChatStore.initMessageReceiver()

    // 切换到教师分类
    activeCategory.value = 'teacher'

    // 触发会话创建事件
    emit('session-created', session.sessionId, 'teacher')
  } else {
    console.error('[GlobalChatDialog] 未找到对应的教师会话:', sessionId)
    showMessage('未找到对应的教师会话', 'error')
  }
}

// 处理AI会话删除结果（由 SessionTree 直接调用 store 删除后通知）
const handleAiSessionDeleted = (
  sessionId: string,
  success: boolean,
  wasCurrentSession: boolean
) => {
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
const handleTeacherSessionDeleted = (
  sessionId: string,
  success: boolean,
  wasCurrentSession: boolean
) => {
  if (!success) {
    // 失败情况已在 SessionTree 中显示错误消息
    return
  }

  // 如果删除的是当前会话，切换到AI分类（store 的 currentSession 已由删除逻辑清空）
  if (wasCurrentSession) {
    activeCategory.value = 'ai-general'
  }
}

// 设置当前教师会话（内部方法，通过 watch store 自动同步 UI）
const setTeacherSession = (sessionId: string) => {
  const allSessions = Object.values(teacherChatStore.loadAllSessions())
  const session = allSessions.find((s) => s.sessionId === sessionId)
  if (session) {
    teacherChatStore.setSession(session)
    const userId = getUserId()
    const storeSubject = session.subject
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
    // UI 状态会通过 watch teacherChatStore.currentSession 自动同步
  }
}

// 处理从ChatView转发后跳转到老师对话的事件（对话框已打开，只需设置会话）
const handleOpenTeacherDialog = async ({
  sessionId,
}: {
  sessionId: string
  message?: ChatBubble
}) => {
  try {
    // 设置指定的会话（会自动切换到教师分类）
    // SessionTree 会直接从 store 获取最新数据，无需手动加载
    setTeacherSession(sessionId)

    // 通知 SessionTree 更新选中状态
    sessionTreeRef.value?.switchToSession('teacher', sessionId)
  } catch (error) {
    console.error('设置老师会话失败:', error)
    showMessage('设置老师会话失败', 'error')
  }
}

// 处理批量转发后跳转到老师对话的事件（对话框已打开，只需设置会话）
const handleSwitchToTeacher = async (forwardData?: {
  messages?: ChatBubble[]
  currentQuestion?: unknown
  additionalMessage?: string
  forwardMode?: string
  successCount?: number
  sessionId?: string
}) => {
  if (!forwardData?.sessionId) {
    return
  }

  try {
    // 设置指定的会话（会自动切换到教师分类）
    // SessionTree 会直接从 store 获取最新数据，无需手动加载
    setTeacherSession(forwardData.sessionId)

    // 通知 SessionTree 更新选中状态
    sessionTreeRef.value?.switchToSession('teacher', forwardData.sessionId)
  } catch (error) {
    console.error('设置老师会话失败:', error)
    showMessage('设置老师会话失败', 'error')
  }
}

// 切换到指定分类
const switchCategory = (category: 'ai-general' | 'teacher') => {
  activeCategory.value = category
}

// 设置教师会话并切换分类
const switchToTeacherSession = async (sessionId: string) => {
  // 使用store的connectToTeacherSession方法，它会处理会话设置和WebSocket连接
  const connected = await teacherChatStore.connectToTeacherSession(sessionId)

  if (connected) {
    // 切换到教师分类
    activeCategory.value = 'teacher'

    // 等待组件更新，SessionTree 应该会自动检测到 store 变化并更新选中状态
    await nextTick()

    console.log('[GlobalChatDialog] 成功切换到教师会话并建立连接:', sessionId)
  } else {
    console.warn('[GlobalChatDialog] 切换到教师会话失败:', sessionId)
  }
}

// 暴露方法供外部调用
defineExpose({
  switchCategory,
  switchToTeacherSession,
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

// ==================== 组件生命周期 ====================
onMounted(async () => {
  console.log('[GlobalChatDialog] onMounted: 初始化写死教师会话')
  // 写死会话通过 loadAllSessions() 方法动态获取，无需预加载
})

// ==================== 清理 ====================
onUnmounted(async () => {
  if (teacherChatStore.currentSession?.sessionId) {
    await teacherChatStore.cleanupMessageReceiver()
  }
})
</script>

<style lang="scss" scoped>
.global-chat-content {
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
    max-width: 100%;

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

.add-session-btn {
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.add-session-icon {
  width: 38px;
  height: 38px;
  display: block;
}

// 响应式设计
@media (max-width: 768px) {
  .global-chat-content {
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
