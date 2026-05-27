<template>
  <Modal
    v-model="localVisible"
    title="在线客服"
    :initial-width="900"
    :initial-height="750"
    :min-width="700"
    :min-height="600"
    title-align="center"
    header-background-color="#f8f9fa"
    class="user-client-dialog"
  >
    <div class="user-client-content">

      <!-- 使用ChatView处理对话 -->
      <div class="chat-view-container">
        <ChatView
          type="user-client"
          :compressed-height="305"
          input-mode="full"
          :show-footer-text="false"
          :show-toolbar="false"
          :show-action-buttons="false"
          :enable-long-press="false"
          :show-read-status="true"
          :show-time="true"
        />
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { showMessage } from '@/utils'
import Modal from '@/components/base/Modal.vue'
import ChatView from '@/components/chat/ChatView.vue'
import { useUserClientStore } from '@/stores/userClientStore'


interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const store = useUserClientStore()


// 监听对话框打开
watch(() => props.modelValue, (newValue) => {
  // 设置对话框打开状态
  store.setDialogOpen(newValue)

  if (newValue) {
    initializeClient()
  }
  // 注意：不在对话框关闭时进行cleanup，避免与ChatView的beforeUnmount重复
  // cleanup由ChatView的beforeUnmount统一处理
})

const initializeClient = async () => {
  try {
    // 检查WebSocket连接状态，如果未连接则自动连接
    if (!store.isConnected) {
      console.log('[用户端] WebSocket未连接，开始自动连接...')
      const connectResult = await store.connect()
      if (!connectResult) {
        showMessage('连接客服失败，请稍后重试', 'error')
        return
      }
      console.log('[用户端] WebSocket连接成功')
    }

    await store.loadChatHistory()
    // 在对话框挂载时标记所有客服消息为已读
    store.markAllAIMessagesAsRead()
    // 在对话框挂载时发送已读状态
    store.sendReadStatusToAgent()
  } catch (error) {
    console.error('[用户端] 初始化失败', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    showMessage('初始化失败: ' + errorMessage, 'error')
  }
}




</script>

<style lang="scss" scoped>
.user-client-dialog {
  :deep(.text-h6) {
    font-size: 18px !important;
    font-weight: 600 !important;
    color: #495057 !important;
  }

  :deep(.dialog-header-section) {
    border-bottom: 1px solid #dee2e6 !important;
  }
}

.user-client-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 10px;
  overflow: hidden;
}
.connection-status {
  font-size: 12px;
  color: #666;
  padding: 4px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  
}
.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s;
  text-transform: none;

  &.large {
    padding: 14px 28px;
    font-size: 16px;
  }

  &.btn-warning {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
}
@media (max-width: 768px) {
  .user-client-content {
    margin: 10px;
  }
}
.chat-view-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

</style>

