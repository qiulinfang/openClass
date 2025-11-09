<template>
  <DraggableDialog 
    v-model="localVisible" 
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
          ref="sessionListRef"
          :records="teacherRecords"
          :selected-record-id="teacherSessionId"
          title="聊天记录"
          :show-favorite="false"
          @record-click="handleRecordClick"
          @record-delete="handleRecordDelete"
          @batch-delete="handleBatchDelete"
        >
          <template #header-actions>
            <q-btn 
              flat 
              dense 
              round 
              icon="refresh" 
              size="sm" 
              @click="loadSessions"
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
              @click="handleNewChat"
            >
              <q-tooltip>新增对话</q-tooltip>
            </q-btn>
          </template>
        </SessionList>
      </div>

      <!-- 右侧聊天界面 -->
      <div class="right-panel">
        <ChatView
          v-if="localVisible && teacherSessionId"
          type="teacher-general"
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useTeacherGeneralChatStore } from '@/stores/teacherGeneralChatStore'
import { useUserStore } from '@/stores/userStore'
import { showMessage } from '@/utils'
import { getCurrentUserIdOrDefault } from '@/utils/user/userId'
import DraggableDialog from './DraggableDialog.vue'
import SessionList from './SessionList.vue'
import ChatView from './ChatView.vue'
import type { QuestionRecord } from '@/types'

// ==================== Props & Emits ====================
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'session-created': [sessionId: string] // 新会话创建事件
}>()

// ==================== Store ====================
const teacherStore = useTeacherGeneralChatStore()
const userStore = useUserStore()

// ==================== 响应式数据 ====================
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const teacherSessionId = ref<string>('')
const sessionListRef = ref<InstanceType<typeof SessionList> | null>(null)

const teacherSessions = ref<Array<{
  sessionId: string
  sessionName: string
  subject: string
  createTime: number
}>>([])

// ==================== 计算属性 ====================
// 将教师会话映射为QuestionRecord格式
const teacherRecords = computed<QuestionRecord[]>(() => {
  return teacherSessions.value.map(session => ({
    id: session.sessionId,
    question: session.sessionName,
    answer: session.subject === 'biology' ? '生物老师' : '数学老师',
    timestamp: session.createTime,
    pinned: false
  }))
})

// ==================== 方法 ====================
// 加载教师会话列表
const loadSessions = () => {
  
  // 第1步：从localStorage获取所有会话（仅当前用户）
  const userId = getCurrentUserIdOrDefault()
  const sessionPrefix = `${userId}_teacher_chat_`
  const sessions: typeof teacherSessions.value = []
  const sessionIds = new Set<string>()
  const seenKeys = new Set<string>() // 记录已处理的键，用于检测重复
  
  // 第2步：遍历localStorage查找所有教师会话（仅当前用户）
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(sessionPrefix) && key.endsWith('_session')) {
      try {
        const sessionData = localStorage.getItem(key)
        if (sessionData) {
          const session = JSON.parse(sessionData)
          
          // 验证会话数据完整性
          if (!session || !session.sessionId || !session.sessionName) {
            console.warn('[TeacherChatDialog] ⚠️ 跳过无效会话数据:', key)
            continue
          }
          
          // 检查sessionId是否已存在（去重）
          if (sessionIds.has(session.sessionId)) {
            console.warn('[TeacherChatDialog] ⚠️ 发现重复的会话ID，跳过:', {
              sessionId: session.sessionId,
              key: key,
              sessionName: session.sessionName
            })
            // 如果键名与sessionId不匹配，可能是旧数据，删除它
            const expectedKey = `${sessionPrefix}${session.sessionId}_session`
            if (key !== expectedKey) {
              localStorage.removeItem(key)
            }
            continue
          }
          
          // 验证键名是否与sessionId匹配
          const expectedKey = `${sessionPrefix}${session.sessionId}_session`
          if (key !== expectedKey) {
            console.warn('[TeacherChatDialog] ⚠️ 键名与sessionId不匹配:', {
              key: key,
              expectedKey: expectedKey,
              sessionId: session.sessionId
            })
            // 如果已有正确键名的会话，删除不匹配的键
            const correctKeyData = localStorage.getItem(expectedKey)
            if (correctKeyData) {
              localStorage.removeItem(key)
              continue
            } else {
              // 如果正确键名不存在，使用当前数据但用正确键名保存
              localStorage.removeItem(key)
              localStorage.setItem(expectedKey, sessionData)
            }
          }
          
          // 添加到列表
          sessions.push(session)
          sessionIds.add(session.sessionId)
          seenKeys.add(key)
        }
      } catch (error) {
        console.error('[TeacherChatDialog] ❌ 解析会话数据失败:', key, error)
        // 解析失败的数据可能是损坏的，可以考虑删除
      }
    }
  }
  
  // 第3步：按创建时间降序排序（最新的在前面）
  sessions.sort((a, b) => b.createTime - a.createTime)
  
  // 第4步：更新列表
  teacherSessions.value = sessions
  

}

// 处理记录点击
const handleRecordClick = async (record: QuestionRecord) => {
  // 第1步：从teacherSessions中找到对应的会话
  const session = teacherSessions.value.find(s => s.sessionId === record.id)
  if (!session) return
  
  // 第2步：设置当前会话ID
  teacherSessionId.value = session.sessionId
  
  // 第3步：设置科目
  const userId = getCurrentUserIdOrDefault()
  const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
  localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
  
  // 第4步：设置 teacherStore 的会话
  teacherStore.setSession(session)
  
  // 第5步：加载聊天历史
  await teacherStore.loadChatHistory(session.sessionId)
}

// 处理记录删除
const handleRecordDelete = async (record: QuestionRecord) => {
  try {
    // 第1步：删除localStorage中的会话数据（加上用户ID前缀）
    const userId = getCurrentUserIdOrDefault()
    localStorage.removeItem(`${userId}_teacher_chat_${record.id}_session`)
    
    // 第2步：删除IndexedDB中的聊天历史
    await teacherStore.clearChatHistory(record.id)
    
    // 第3步：刷新列表
    loadSessions()
    
    // 第4步：如果删除的是当前会话，清空选择
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

// 处理批量删除会话
const handleBatchDelete = async (recordIds: string[]) => {
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
    loadSessions()
    
    // 第3步：显示结果
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

// 创建新会话（供外部调用）
const createNewSession = async (subject: 'biology' | 'math') => {
  try {
    // 第1步：清空上一个会话的聊天记录
    teacherStore.clearSession()
    
    // 第2步：确保用户信息已加载
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

    // 第3步：设置科目信息（biology -> BIOLOGY, math -> MATH）
    const userId = getCurrentUserIdOrDefault()
    const storeSubject = subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
    
    // 第4步：生成临时会话ID供后续使用（新的会话ID）
    const newSessionId = `teacher-${Date.now()}`
    // 第5步：创建并保存会话信息（这样 loadSessions 才能加载到新会话）
    const newSession = {
      sessionId: newSessionId,
      sessionName: subject === 'biology' ? '生物' : '数学',
      subject: subject,
      createTime: Date.now()
    }
    localStorage.setItem(`teacher_chat_${newSessionId}_session`, JSON.stringify(newSession))
    // 第6步：设置为当前会话ID
    teacherSessionId.value = newSessionId
    
    // 第7步：初始化教师消息监听器（使用 Store 统一方法）
    await teacherStore.initMessageReceiver()

    // 第8步：刷新会话列表（现在可以加载到新会话了）
    loadSessions()
    // 第9步：等待一帧确保DOM更新
    await nextTick()
    
    // 第10步：滚动到SessionList顶部
    if (sessionListRef.value) {
      sessionListRef.value.scrollToTop()
    }
    
    // 第11步：通知外部新会话已创建
    emit('session-created', newSessionId)
  } catch (error) {
    console.error('[TeacherChatDialog] ❌ 准备教师对话失败:', error)
    showMessage('准备教师对话失败，请重试', 'error')
  }
}

// 处理新建对话按钮点击
const handleNewChat = async () => {
  
  // 默认使用数学学科创建新会话
  await createNewSession('math')
}

// 设置当前会话（供外部调用）
const setSession = (sessionId: string) => {
  teacherSessionId.value = sessionId
  const session = teacherSessions.value.find(s => s.sessionId === sessionId)
  if (session) {
    teacherStore.setSession(session)
    const userId = getCurrentUserIdOrDefault()
    const storeSubject = session.subject === 'biology' ? 'BIOLOGY' : 'MATH'
    localStorage.setItem(`${userId}_currentTeacherSubject`, storeSubject)
  }
}

// 暴露方法供外部调用
defineExpose({
  createNewSession,
  setSession,
  loadSessions
})

// ==================== 监听器 ====================
// 监听对话框打开/关闭，自动刷新会话列表
let refreshTimer: ReturnType<typeof setInterval> | null = null

watch(localVisible, (isOpen) => {
  if (isOpen) {
    // 对话框打开时，初始加载一次
    loadSessions()
    
    // 然后每5秒自动刷新一次（用于显示自动生成的标题）
    refreshTimer = setInterval(() => {
      loadSessions()
    }, 5000)
  } else {
    // 对话框关闭时，清除定时器
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }
})

// ==================== 清理 ====================
onUnmounted(async () => {
  // 清理教师消息监听器（使用 Store 统一方法）
  if (teacherSessionId.value) {
    await teacherStore.cleanupMessageReceiver()
  }
  
  // 清理刷新定时器
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style lang="scss" scoped>
// 教师聊天内容布局样式
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

// 响应式设计
@media (max-width: 768px) {
  .teacher-chat-content {
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
