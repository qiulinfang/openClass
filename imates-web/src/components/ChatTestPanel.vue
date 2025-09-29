<template>
  <div class="chat-test-panel">
    <q-card flat bordered class="q-pa-md">
      <div class="text-h6 q-mb-md">🧪 聊天测试面板</div>
      
      <!-- 测试模式控制 -->
      <div class="row q-gutter-md q-mb-md">
        <q-toggle
          v-model="testMode"
          label="测试模式"
          @update:model-value="onTestModeToggle"
          color="primary"
        />
        
        <q-btn
          color="primary"
          outline
          size="sm"
          @click="toggleAutoReply"
          :disable="!testMode"
        >
          {{ autoReplyEnabled ? '停止自动回复' : '启动自动回复' }}
        </q-btn>
        
        <q-btn
          color="secondary"
          outline
          size="sm"
          @click="generateTestHistory"
          :disable="!testMode"
        >
          生成测试历史
        </q-btn>
        
        <q-btn
          color="negative"
          outline
          size="sm"
          @click="clearChatHistory"
          :disable="!testMode"
        >
          清除聊天记录
        </q-btn>
        
        <q-btn
          color="purple"
          outline
          size="sm"
          @click="generateBatchTestData"
          :disable="!testMode"
        >
          批量生成测试数据
        </q-btn>
        
        <q-btn
          color="teal"
          outline
          size="sm"
          @click="exportChatData"
          :disable="!testMode || !currentQuestion"
        >
          导出聊天数据
        </q-btn>
      </div>

      <!-- 测试统计信息 -->
      <div v-if="testMode" class="test-stats q-mb-md">
        <div class="text-subtitle2 q-mb-sm">测试统计</div>
        <div class="row q-gutter-md">
          <q-chip color="blue" text-color="white">
            消息总数: {{ messageCount }}
          </q-chip>
          <q-chip color="green" text-color="white">
            AI回复: {{ aiMessageCount }}
          </q-chip>
          <q-chip color="orange" text-color="white">
            用户消息: {{ userMessageCount }}
          </q-chip>
          <q-chip color="purple" text-color="white">
            自动回复: {{ autoReplyCount }}
          </q-chip>
        </div>
      </div>

      <!-- 模拟发送区域 -->
      <div v-if="testMode" class="simulate-send q-mb-md">
        <div class="text-subtitle2 q-mb-sm">模拟发送</div>
        <div class="row q-gutter-sm">
          <q-input
            v-model="simulateMessage"
            placeholder="输入模拟消息..."
            outlined
            dense
            class="col"
          />
          <q-btn
            color="primary"
            @click="sendSimulateMessage"
            :disable="!simulateMessage.trim()"
          >
            发送
          </q-btn>
          <q-btn
            color="secondary"
            @click="sendRandomUserMessage"
          >
            随机用户消息
          </q-btn>
          <q-btn
            color="accent"
            @click="sendRandomAiMessage"
          >
            随机AI回复
          </q-btn>
        </div>
      </div>

      <!-- 聊天记录预览 -->
      <div v-if="testMode && previewMessages.length > 0" class="chat-preview">
        <div class="text-subtitle2 q-mb-sm">聊天记录预览 (最新5条)</div>
        <div class="chat-preview-list">
          <div
            v-for="message in previewMessages"
            :key="message.id"
            class="message-preview"
            :class="`message-${message.sender}`"
          >
            <div class="message-header">
              <q-chip
                :color="message.sender === 'user' ? 'blue' : 'green'"
                text-color="white"
                size="sm"
              >
                {{ message.sender === 'user' ? '用户' : 'AI' }}
              </q-chip>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-content">{{ message.content }}</div>
          </div>
        </div>
      </div>

      <!-- 测试日志 -->
      <div v-if="testMode && testLogs.length > 0" class="test-logs">
        <div class="text-subtitle2 q-mb-sm">测试日志</div>
        <div class="log-list">
          <div
            v-for="(log, index) in testLogs.slice(-10)"
            :key="index"
            class="log-item"
            :class="`log-${log.type}`"
          >
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useExerciseStore } from '../stores/exerciseStore'
import { apiService } from '../services/api-service'
import { asyncStorage } from '../services/async-storage'
import type { ChatBubble } from '../types'

const exerciseStore = useExerciseStore()

// 响应式数据
const testMode = ref(false)
const autoReplyEnabled = ref(false)
const simulateMessage = ref('')
const autoReplyCount = ref(0)
const testLogs = ref<Array<{ type: string, message: string, timestamp: number }>>([])

// 自动回复停止函数
let stopAutoReply: (() => void) | null = null

// 计算属性
const messageCount = computed(() => exerciseStore.chatMessages.length)
const aiMessageCount = computed(() => 
  exerciseStore.chatMessages.filter(msg => msg.sender === 'ai').length
)
const userMessageCount = computed(() => 
  exerciseStore.chatMessages.filter(msg => msg.sender === 'user').length
)
const previewMessages = computed(() => 
  exerciseStore.chatMessages.slice(-5).reverse()
)

// 安全获取当前题目
const currentQuestion = computed(() => exerciseStore.currentQuestion)

// 方法
const onTestModeToggle = (enabled: boolean) => {
  apiService.setTestMode(enabled)
  addLog('info', `测试模式${enabled ? '开启' : '关闭'}`)
  
  if (!enabled) {
    // 关闭测试模式时停止自动回复
    if (stopAutoReply) {
      stopAutoReply()
      stopAutoReply = null
      autoReplyEnabled.value = false
    }
  }
}

const toggleAutoReply = () => {
  if (autoReplyEnabled.value) {
    // 停止自动回复
    if (stopAutoReply) {
      stopAutoReply()
      stopAutoReply = null
    }
    autoReplyEnabled.value = false
    addLog('info', '自动回复已停止')
  } else {
    // 启动自动回复
    if (currentQuestion.value) {
      stopAutoReply = apiService.startAutoReplyTest(
        currentQuestion.value.id,
        async (message: ChatBubble) => {
          console.log(`[CHAT_DEBUG] 🤖 自动回复触发: ${currentQuestion.value?.id || '无题目'}`)
          
          // 添加自动回复消息到聊天记录
          console.log(`[CHAT_DEBUG] 📝 添加自动回复消息到内存:`, {
            id: message.id,
            content: message.content.substring(0, 50) + '...',
            sender: message.sender
          })
          exerciseStore.chatMessages.push(message)
          
          // 保存聊天记录到存储
          console.log(`[CHAT_DEBUG] 💾 保存自动回复到存储...`)
          await exerciseStore.saveChatHistory()
          console.log(`[CHAT_DEBUG] ✅ 自动回复保存完成`)
          
          autoReplyCount.value++
          addLog('success', `自动回复: ${message.content.substring(0, 30)}...`)
        },
        15000 // 15秒间隔
      )
      autoReplyEnabled.value = true
      addLog('info', '自动回复已启动 (15秒间隔)')
    } else {
      addLog('error', '请先选择一道题目')
    }
  }
}

const generateTestHistory = async () => {
  if (currentQuestion.value) {
    try {
      const questionId = currentQuestion.value.id
      
      // 生成并保存测试数据到存储
      await asyncStorage.generateAndSaveTestChatHistory(questionId, 8)
      
      // 重新加载聊天记录
      await exerciseStore.loadChatHistory()
      
      addLog('success', `生成了${exerciseStore.chatMessages.length}条测试聊天记录并保存到存储`)
    } catch (error) {
      addLog('error', `生成测试历史失败: ${error}`)
    }
  } else {
    addLog('error', '请先选择一道题目')
  }
}

const clearChatHistory = async () => {
  if (currentQuestion.value) {
    await exerciseStore.clearChatHistory()
    autoReplyCount.value = 0
    addLog('info', '聊天记录已清除')
  } else {
    addLog('error', '请先选择一道题目')
  }
}

const sendSimulateMessage = async () => {
  if (!simulateMessage.value.trim() || !currentQuestion.value) return
  
  try {
    const message = simulateMessage.value.trim()
    await exerciseStore.sendChatMessage(message, 'ai', 'mate')
    simulateMessage.value = ''
    addLog('success', `发送模拟消息: ${message}`)
  } catch (error) {
    addLog('error', `发送失败: ${error}`)
  }
}

const sendRandomUserMessage = async () => {
  if (!currentQuestion.value) return
  
  const randomMessage = apiService.generateMockUserMessage()
  simulateMessage.value = randomMessage
  await sendSimulateMessage()
}

const sendRandomAiMessage = async () => {
  if (!currentQuestion.value) return
  
  console.log(`[CHAT_DEBUG] 🤖 开始添加随机AI回复: ${currentQuestion.value.id}`)
  
  const randomResponse = apiService.generateMockResponse('math')
  const aiMessage: ChatBubble = {
    id: `test_ai_${Date.now()}`,
    content: randomResponse,
    sender: 'ai',
    type: 'ai',
    timestamp: new Date().toISOString(),
    messageId: `test_msg_${Date.now()}`,
    messageType: 'text'
  }
  
  console.log(`[CHAT_DEBUG] 📝 添加AI消息到内存:`, {
    id: aiMessage.id,
    content: aiMessage.content.substring(0, 50) + '...',
    sender: aiMessage.sender
  })
  
  exerciseStore.chatMessages.push(aiMessage)
  
  // 保存聊天记录到存储
  console.log(`[CHAT_DEBUG] 💾 保存聊天记录到存储...`)
  await exerciseStore.saveChatHistory()
  console.log(`[CHAT_DEBUG] ✅ 随机AI回复添加完成`)
  
  addLog('success', `添加随机AI回复: ${randomResponse.substring(0, 30)}...`)
}

const generateBatchTestData = async () => {
  try {
    if (exerciseStore.questions.length === 0) {
      addLog('error', '没有题目数据，请先加载题目')
      return
    }
    
    // 为前5个题目生成测试数据
    const questionIds = exerciseStore.questions.slice(0, 5).map(q => q.id)
    await asyncStorage.generateBatchTestChatHistory(questionIds, 6)
    
    addLog('success', `为${questionIds.length}个题目生成了测试聊天记录`)
  } catch (error) {
    addLog('error', `批量生成测试数据失败: ${error}`)
  }
}

const exportChatData = async () => {
  if (!currentQuestion.value) return
  
  try {
    const questionId = currentQuestion.value.id
    const data = await asyncStorage.exportChatHistory(questionId)
    
    if (data) {
      addLog('success', `聊天数据已导出到控制台: ${questionId}`)
      console.log('📤 导出的聊天数据:', data)
    } else {
      addLog('info', '当前题目没有聊天记录')
    }
  } catch (error) {
    addLog('error', `导出聊天数据失败: ${error}`)
  }
}

const addLog = (type: string, message: string) => {
  testLogs.value.push({
    type,
    message,
    timestamp: Date.now()
  })
}

const formatTime = (timestamp: string | number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

// 监听当前题目变化
watch(() => currentQuestion.value, (newQuestion) => {
  if (newQuestion && testMode.value) {
    const questionTitle = newQuestion.title || newQuestion.id || '未知题目'
    addLog('info', `切换到题目: ${questionTitle}`)
  }
})

// 监听消息数量变化
watch(() => exerciseStore.chatMessages.length, (newCount, oldCount) => {
  if (testMode.value && newCount > oldCount) {
    addLog('info', `消息数量: ${oldCount} → ${newCount}`)
  }
})
</script>

<style lang="scss" scoped>
.chat-test-panel {
  margin: 16px 0;
  
  .test-stats {
    background-color: #f5f5f5;
    padding: 12px;
    border-radius: 8px;
  }
  
  .simulate-send {
    background-color: #f0f8ff;
    padding: 12px;
    border-radius: 8px;
  }
  
  .chat-preview {
    background-color: #f9f9f9;
    padding: 12px;
    border-radius: 8px;
    
    .chat-preview-list {
      max-height: 300px;
      overflow-y: auto;
      
      .message-preview {
        margin-bottom: 8px;
        padding: 8px;
        border-radius: 6px;
        
        &.message-user {
          background-color: #e3f2fd;
          margin-left: 20px;
        }
        
        &.message-ai {
          background-color: #f1f8e9;
          margin-right: 20px;
        }
        
        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        
        .message-time {
          font-size: 12px;
          color: #666;
        }
        
        .message-content {
          font-size: 14px;
          line-height: 1.4;
        }
      }
    }
  }
  
  .test-logs {
    background-color: #fafafa;
    padding: 12px;
    border-radius: 8px;
    
    .log-list {
      max-height: 200px;
      overflow-y: auto;
      
      .log-item {
        display: flex;
        align-items: center;
        margin-bottom: 4px;
        padding: 4px 8px;
        border-radius: 4px;
        
        &.log-info {
          background-color: #e3f2fd;
        }
        
        &.log-success {
          background-color: #e8f5e8;
        }
        
        &.log-error {
          background-color: #ffebee;
        }
        
        .log-time {
          font-size: 12px;
          color: #666;
          margin-right: 8px;
          min-width: 80px;
        }
        
        .log-message {
          font-size: 13px;
          flex: 1;
        }
      }
    }
  }
}
</style>
