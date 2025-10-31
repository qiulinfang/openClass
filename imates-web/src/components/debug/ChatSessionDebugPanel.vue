<template>
  <q-dialog v-model="isVisible" position="right" maximized>
    <q-card style="width: 600px; max-width: 90vw">
      <!-- 头部 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">🔧 调试面板 - 会话管理</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- 统计信息 -->
      <q-card-section>
        <q-banner class="bg-info text-white" rounded>
          <template v-slot:avatar>
            <q-icon name="analytics" size="md" />
          </template>
          <div class="text-subtitle2">存储统计</div>
          <div class="text-caption">
            总会话数: {{ sessions.length }} | 
            总消息数: {{ totalMessages }} | 
            存储大小: {{ storageSize }}
          </div>
        </q-banner>
      </q-card-section>

      <!-- 操作按钮组 -->
      <q-card-section class="q-pt-none">
        <div class="row q-gutter-sm">
          <q-btn
            outline
            color="primary"
            icon="refresh"
            label="刷新"
            @click="refreshData"
            size="sm"
          />
          <q-btn
            outline
            color="negative"
            icon="delete_sweep"
            label="清空所有会话"
            @click="clearAllSessions"
            size="sm"
          />
          <q-btn
            outline
            color="secondary"
            icon="download"
            label="导出数据"
            @click="exportData"
            size="sm"
          />
          <q-btn
            outline
            color="positive"
            icon="upload"
            label="导入数据"
            @click="importData"
            size="sm"
          />
        </div>
      </q-card-section>

      <!-- 会话列表 -->
      <q-separator />
      
      <q-card-section class="q-pa-none" style="max-height: 60vh; overflow-y: auto">
        <q-list separator>
          <q-item
            v-for="session in sortedSessions"
            :key="session.sessionId"
            clickable
            @click="selectSession(session)"
          >
            <q-item-section avatar>
              <q-avatar :color="session.pinned ? 'orange' : 'primary'" text-color="white">
                <q-icon :name="session.pinned ? 'push_pin' : 'chat'" />
              </q-avatar>
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ session.sessionName }}</q-item-label>
              <q-item-label caption>
                ID: {{ session.sessionId.substring(0, 20) }}...
              </q-item-label>
              <q-item-label caption>
                创建: {{ formatDate(session.createTime) }} | 
                更新: {{ formatDate(session.updateTime) }} | 
                消息: {{ session.msgCount }}
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="info"
                  color="blue"
                  @click.stop="viewSessionDetail(session)"
                >
                  <q-tooltip>查看详情</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="delete"
                  color="negative"
                  @click.stop="deleteSession(session)"
                >
                  <q-tooltip>删除会话</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>

          <q-item v-if="sessions.length === 0">
            <q-item-section class="text-center text-grey-6">
              <div class="q-py-md">
                <q-icon name="inbox" size="48px" />
                <div class="q-mt-sm">暂无会话数据</div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 会话详情对话框 -->
  <q-dialog v-model="showDetailDialog" maximized>
    <q-card v-if="selectedSession" style="width: 800px; max-width: 95vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">会话详情</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-list bordered separator>
          <q-item>
            <q-item-section>
              <q-item-label caption>会话ID</q-item-label>
              <q-item-label>{{ selectedSession.sessionId }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>会话名称</q-item-label>
              <q-item-label>{{ selectedSession.sessionName }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>创建时间</q-item-label>
              <q-item-label>{{ formatFullDate(selectedSession.createTime) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>最后更新</q-item-label>
              <q-item-label>{{ formatFullDate(selectedSession.updateTime) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>消息数量</q-item-label>
              <q-item-label>{{ selectedSession.msgCount }} 条</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label caption>是否置顶</q-item-label>
              <q-item-label>{{ selectedSession.pinned ? '是' : '否' }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <!-- 消息列表 -->
      <q-card-section v-if="sessionMessages.length > 0">
        <div class="text-subtitle2 q-mb-md">消息列表 ({{ sessionMessages.length }}条)</div>
        <q-scroll-area style="height: 400px">
          <q-list bordered separator>
            <q-item v-for="(msg, index) in sessionMessages" :key="msg.id">
              <q-item-section avatar>
                <q-avatar :color="msg.type === 'user' ? 'primary' : 'secondary'" text-color="white">
                  {{ msg.type === 'user' ? '我' : 'AI' }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label caption>#{{ index + 1 }} - {{ formatDate(new Date(msg.timestamp).getTime()) }}</q-item-label>
                <q-item-label class="q-mt-xs">{{ msg.content }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 导入文件输入 -->
  <input
    ref="fileInputRef"
    type="file"
    accept=".json"
    style="display: none"
    @change="handleFileImport"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAiGeneralChatStore } from '@/stores/aiGeneralChatStore'
import type { AiGeneralSession, ChatBubble } from '@/types'
import localforage from 'localforage'

// Props
interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Store
const aiGeneralStore = useAiGeneralChatStore()

// 响应式数据
const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const sessions = ref<AiGeneralSession[]>([])
const storageSize = ref('0 KB')
const selectedSession = ref<AiGeneralSession | null>(null)
const sessionMessages = ref<ChatBubble[]>([])
const showDetailDialog = ref(false)
const fileInputRef = ref<HTMLInputElement>()

// 计算属性
const totalMessages = computed(() => {
  return sessions.value.reduce((sum, s) => sum + s.msgCount, 0)
})

const sortedSessions = computed(() => {
  return [...sessions.value].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.updateTime - a.updateTime
  })
})

// 第1步：刷新数据
const refreshData = async () => {
  try {
    // 从Store加载
    await aiGeneralStore.loadSessions()
    sessions.value = [...aiGeneralStore.sessions]
    
    // 计算存储大小
    await calculateStorageSize()
  } catch (error) {
    console.error('刷新失败:', error)
  }
}

// 第2步：计算存储大小
const calculateStorageSize = async () => {
  try {
    let totalSize = 0
    
    // 计算会话列表大小
    const sessionsData = JSON.stringify(sessions.value)
    totalSize += new Blob([sessionsData]).size
    
    // 计算所有会话的消息大小
    for (const session of sessions.value) {
      const key = `chat_history_session_${session.sessionId}`
      const data = await localforage.getItem(key)
      if (data) {
        totalSize += new Blob([JSON.stringify(data)]).size
      }
    }
    
    // 格式化大小
    if (totalSize < 1024) {
      storageSize.value = `${totalSize} B`
    } else if (totalSize < 1024 * 1024) {
      storageSize.value = `${(totalSize / 1024).toFixed(2)} KB`
  } else {
      storageSize.value = `${(totalSize / 1024 / 1024).toFixed(2)} MB`
    }
  } catch (error) {
    console.error('计算存储大小失败:', error)
    storageSize.value = '未知'
  }
}

// 第3步：清空所有会话
const clearAllSessions = async () => {
  try {
    // 删除所有会话的聊天历史
    for (const session of sessions.value) {
      const key = `chat_history_session_${session.sessionId}`
      await localforage.removeItem(key)
    }
    
    // 清空会话列表
    await localforage.removeItem('ai_general_sessions')
    
    // 重置Store
    aiGeneralStore.sessions = []
    aiGeneralStore.currentSession = null
    aiGeneralStore.messages = []
    
    // 刷新数据
    await refreshData()
  } catch (error) {
    console.error('清空失败:', error)
  }
}

// 第4步：删除单个会话
const deleteSession = async (session: AiGeneralSession) => {
  try {
    await aiGeneralStore.deleteSession(session.sessionId)
    await refreshData()
  } catch (error) {
    console.error('删除失败:', error)
  }
}

// 第5步：查看会话详情
const viewSessionDetail = async (session: AiGeneralSession) => {
  try {
    selectedSession.value = session
    
    // 加载会话消息
    const key = `chat_history_session_${session.sessionId}`
    const historyData = await localforage.getItem(key) as any
    
    if (historyData && historyData.messages) {
      sessionMessages.value = historyData.messages
    } else {
      sessionMessages.value = []
    }
    
    showDetailDialog.value = true
  } catch (error) {
    console.error('加载会话详情失败:', error)
  }
}

// 第6步：选择会话
const selectSession = (session: AiGeneralSession) => {
  aiGeneralStore.switchSession(session.sessionId)
}

// 第7步：导出数据
const exportData = async () => {
  try {
    const exportData: any = {
      version: '1.0',
      exportTime: Date.now(),
      sessions: sessions.value,
      messages: {}
    }
    
    // 导出所有会话的消息
    for (const session of sessions.value) {
      const key = `chat_history_session_${session.sessionId}`
      const data = await localforage.getItem(key)
      if (data) {
        exportData.messages[session.sessionId] = data
      }
    }
    
    // 创建下载
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-chat-sessions-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
  }
}

// 第8步：导入数据
const importData = () => {
  fileInputRef.value?.click()
}

// 第9步：处理文件导入
const handleFileImport = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  try {
    const text = await file.text()
    const importData = JSON.parse(text)
    
    // 验证数据格式
    if (!importData.sessions || !importData.messages) {
      throw new Error('无效的数据格式')
    }
    
    try {
      // 导入会话列表
      await localforage.setItem('ai_general_sessions', importData.sessions)
      
      // 导入消息
      for (const sessionId in importData.messages) {
        const key = `chat_history_session_${sessionId}`
        await localforage.setItem(key, importData.messages[sessionId])
      }
      
      // 刷新数据
      await refreshData()
      await aiGeneralStore.loadSessions()
    } catch (error) {
      console.error('导入失败:', error)
    }
  } catch (error) {
    console.error('读取文件失败:', error)
  }
  
  // 清空文件输入
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// 格式化日期
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

const formatFullDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN')
}

// 组件挂载时加载数据
onMounted(() => {
  refreshData()
})
</script>

<style lang="scss" scoped>
:deep(.q-dialog__inner) {
  max-width: 600px;
}
</style>
