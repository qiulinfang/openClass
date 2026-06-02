/**
 * 用户客服聊天 Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatBubble, AttachedScreenshot } from '../types'
import { Sender } from '../types'

export const useUserClientStore = defineStore('userClient', () => {
  const messages = ref<ChatBubble[]>([])
  const isConnected = ref(false)
  const isSending = ref(false)
  const isDialogOpen = ref(false)
  const connectionStatus = ref('未连接')
  
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])
  const inputScreenshotDrawingStates = ref<Record<string, any>>({})

  const canSendMessage = computed(() => isConnected.value && !isSending.value)

  const connect = async (): Promise<boolean> => {
    // 模拟连接逻辑
    connectionStatus.value = '已连接'
    isConnected.value = true
    return true
  }

  const disconnect = () => {
    isConnected.value = false
    connectionStatus.value = '已断开'
  }

  const sendMessage = async (content: string): Promise<void> => {
    if (!content.trim() || !isConnected.value) return
    
    isSending.value = true
    const userMessage: ChatBubble = {
      id: Date.now().toString(),
      content,
      sender: Sender.USER,
      type: Sender.USER,
      timestamp: new Date().toISOString(),
      sessionId: 'user-client-session',
      messageType: 'text'
    }
    messages.value.push(userMessage)
    
    // 模拟回复
    setTimeout(() => {
      const reply: ChatBubble = {
        id: (Date.now() + 1).toString(),
        content: '你好，我是人工客服，请问有什么可以帮您？',
        sender: Sender.TEACHER,
        type: Sender.TEACHER,
        timestamp: new Date().toISOString(),
        sessionId: 'user-client-session',
        messageType: 'text'
      }
      messages.value.push(reply)
      isSending.value = false
    }, 1500)
  }

  const resetState = () => {
    messages.value = []
    isConnected.value = false
    isSending.value = false
  }

  return {
    messages,
    isConnected,
    isSending,
    isDialogOpen,
    connectionStatus,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    canSendMessage,
    connect,
    disconnect,
    sendMessage,
    resetState
  }
})
