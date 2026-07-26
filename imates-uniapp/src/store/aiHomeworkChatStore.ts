/**
 * AI 作业聊天 Store (UniApp 适配版)
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AttachedScreenshot, ChatBubble } from '@/types/chat'
import { useAiExerciseChatStore } from './aiExerciseChatStore'

export const useAiHomeworkChatStore = defineStore('aiHomeworkChat', () => {
  const exerciseStore = useAiExerciseChatStore()

  const messages = ref<ChatBubble[]>([])
  const isChatLoading = ref(false)
  const enableWebSearch = ref(false)
  const inputAttachedScreenshots = ref<AttachedScreenshot[]>([])
  const inputScreenshotDrawingStates = ref<Record<string, unknown>>({})

  const sendMessage = async (
    content: string,
    currentQuestion: any,
    userInfo: any = null,
    subject: 'MATH' | 'BIOLOGY' = 'MATH',
    selectedModel: string = 'mate',
    skipUserMessage?: boolean,
    quotedMessage?: any,
    imageData?: any,
    imageList?: any[],
  ) => {
    return await exerciseStore.sendMessage(
      content,
      currentQuestion,
      userInfo,
      subject,
      selectedModel,
      skipUserMessage,
      quotedMessage,
      imageData,
      imageList,
    )
  }

  return {
    messages: exerciseStore.messages,
    isChatLoading: exerciseStore.isChatLoading,
    enableWebSearch: exerciseStore.enableWebSearch,
    inputAttachedScreenshots,
    inputScreenshotDrawingStates,
    sendMessage,
    deleteMessage: exerciseStore.deleteMessage,
    saveChatHistory: exerciseStore.saveChatHistory,
    loadChatHistory: exerciseStore.loadChatHistory,
  }
})
