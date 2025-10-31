<template>
  <DraggableDialog 
    v-model="localVisible" 
    title="与AI聊天"
    :initial-width="1000"
    :initial-height="600"
    :min-width="600"
    :min-height="400"
  >
    <div class="ai-chat-content">
      <!-- 左侧聊天记录 -->
      <div class="left-panel">
        <SessionList 
          :records="questionRecords"
          :selected-record-id="aiGeneralStore.currentSession?.sessionId"
          title="聊天记录"
          @record-click="handleQuestionRecordClick"
          @record-rename="handleRecordRename"
          @record-pin="handleRecordPin"
          @record-delete="handleRecordDelete"
          @batch-delete="handleBatchDelete"
        >
          <template #header-actions>
            <q-btn
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
              @click="handleNewChatClick"
            >
              <q-tooltip>
                {{ 
                  aiGeneralStore.canCreateSession 
                    ? '新增对话' 
                    : (aiGeneralStore.isCreatingSession 
                        ? '创建中...' 
                        : '请先在当前会话中发送消息')
                }}
              </q-tooltip>
            </q-btn>
          </template>
        </SessionList>
      </div>

      <!-- 右侧聊天界面 -->
      <div class="right-panel">
        <ChatView 
          type="ai-general"
        />
      </div>
    </div>
  </DraggableDialog>

  <!-- 调试面板 -->
  <ChatSessionDebugPanel v-model="showDebugPanel" />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import { showMessage } from '@/utils'
import DraggableDialog from './DraggableDialog.vue'
import SessionList from './SessionList.vue'
import ChatView from './ChatView.vue'
import ChatSessionDebugPanel from './debug/ChatSessionDebugPanel.vue'
import type { QuestionRecord, AiGeneralSession } from '@/types'

// ==================== Props & Emits ====================
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// ==================== Store ====================
const aiGeneralStore = useAiGeneralChatStore()

// ==================== 响应式数据 ====================
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const showDebugPanel = ref(false)

// ==================== 计算属性 ====================
// 问题记录数据（计算属性：从AI通用会话转换）
const questionRecords = computed<QuestionRecord[]>(() => {
  return aiGeneralStore.sessions.map((session: AiGeneralSession) => ({
    id: session.sessionId,
    question: session.sessionName,
    answer: '',
    timestamp: session.updateTime,
    pinned: session.pinned || false
  }))
})

// ==================== 方法 ====================
// 处理问题记录点击
const handleQuestionRecordClick = async (record: QuestionRecord) => {
  // 第1步：切换到对应的会话
  await aiGeneralStore.switchSession(record.id)
}

// 处理新增对话点击
const handleNewChatClick = async () => {
  // 第1步：检查是否可以创建
  if (!aiGeneralStore.canCreateSession) {
    if (!aiGeneralStore.isCreatingSession) {
      showMessage('请先在当前会话中发送消息', 'warning')
    }
    return
  }
  
  // 第2步：重置状态，准备新对话
  // 不立即创建会话，等用户发送第一条消息时，sendMessage会自动创建
  // 会话名称将使用用户的第一条消息内容（前30个字符）
  aiGeneralStore.resetState()
}

// 处理记录重命名
const handleRecordRename = async (record: QuestionRecord, newName: string) => {
  try {
    // 第1步：更新会话名称
    await aiGeneralStore.renameSession(record.id, newName)
    
    // 第2步：更新本地记录名称
    const index = aiGeneralStore.sessions.findIndex((s: AiGeneralSession) => s.sessionId === record.id)
    if (index >= 0) {
      aiGeneralStore.sessions[index].sessionName = newName
      await aiGeneralStore.saveSessions()
    }
    
  } catch (error) {
    console.error('重命名失败:', error)
  }
}

// 处理记录置顶/取消置顶
const handleRecordPin = async (record: QuestionRecord) => {
  try {
    await aiGeneralStore.togglePin(record.id)
  } catch (error) {
    console.error('置顶操作失败:', error)
    showMessage('操作失败', 'error')
  }
}

// 处理记录删除
const handleRecordDelete = async (record: QuestionRecord) => {
  try {
    // 第1步：删除会话
    await aiGeneralStore.deleteSession(record.id)
    showMessage('删除成功', 'success')
  } catch (error) {
    console.error('删除失败:', error)
    showMessage('删除失败', 'error')
  }
}

// 处理批量删除会话
const handleBatchDelete = async (recordIds: string[]) => {
  try {
    // 第1步：批量删除会话
    for (const id of recordIds) {
      await aiGeneralStore.deleteSession(id)
    }
    showMessage(`已删除 ${recordIds.length} 个会话`, 'success')
  } catch (error) {
    console.error('批量删除失败:', error)
    showMessage('批量删除失败', 'error')
  }
}

// ==================== 监听器 ====================
// 监听对话框打开，自动加载会话列表
watch(localVisible, async (isOpen) => {
  if (isOpen) {
    // 第1步：加载会话列表
    await aiGeneralStore.loadSessions()
    
    // 第2步：如果没有当前会话且有会话列表，加载第一个会话
    if (!aiGeneralStore.currentSession && aiGeneralStore.sessions.length > 0) {
      const firstSession = aiGeneralStore.sessions[0]
      await aiGeneralStore.switchSession(firstSession.sessionId)
    }
  }
})
</script>

<style lang="scss" scoped>
// AI聊天内容布局样式
.ai-chat-content {
  display: flex;
  height: 100%;
  overflow: hidden;
  
  .left-panel {
    width: 30%;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    background: #f5f5f5;
    overflow: hidden;
    
    // 按钮样式（通过 slot 传递）
    .debug-btn {
      color: rgba(255, 152, 0, 0.9);
      transition: all 0.2s ease;
      
      &:hover {
        color: #ff9800;
        background: rgba(255, 152, 0, 0.1);
      }
    }
    
    .new-chat-btn {
      color: #9059ff;
      transition: all 0.2s ease;
      
      &:hover:not(.disabled) {
        color: #7647cc;
        background: rgba(144, 89, 255, 0.1);
      }
      
      &.disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }
  }
  
  .right-panel {
    flex: 1;
    background: white;
    overflow: hidden;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .ai-chat-content {
    flex-direction: column;
    
    .left-panel {
      width: 100%;
      height: 40%;
      border-right: none;
      border-bottom: 1px solid rgba(144, 89, 255, 0.3);
    }
    
    .right-panel {
      height: 60%;
    }
  }
}
</style>
