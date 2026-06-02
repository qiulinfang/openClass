/**
 * 教师对话 Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiService } from '../services/http/api-service'
import type { ChatBubble } from '../types'
import { Sender } from '../types'

export interface TeacherSession {
  sessionId: string
  sessionName: string
  subject: string
  createTime: number
}

export const useTeacherChatStore = defineStore('teacherChat', () => {
  const messages = ref<ChatBubble[]>([])
  const currentSession = ref<TeacherSession | null>(null)
  const isChatLoading = ref(false)
  
  const setSession = (session: TeacherSession) => {
    currentSession.value = session
    loadChatHistory(session.sessionId)
  }

  const sendMessage = async (content: string, imageData?: any) => {
    if (!currentSession.value) return

    const userMessage: ChatBubble = {
      id: Date.now().toString(),
      content,
      sender: Sender.USER,
      type: Sender.USER,
      timestamp: new Date().toISOString(),
      sessionId: currentSession.value.sessionId,
      messageType: imageData ? 'image' : 'text'
    }
    messages.value.push(userMessage)

    isChatLoading.value = true
    // 模拟教师回复
    setTimeout(() => {
      const teacherReply: ChatBubble = {
        id: (Date.now() + 1).toString(),
        content: '你好，我是老师，正在看你的问题...',
        sender: Sender.TEACHER,
        type: Sender.TEACHER,
        timestamp: new Date().toISOString(),
        sessionId: currentSession.value?.sessionId || '',
        messageType: 'text'
      }
      messages.value.push(teacherReply)
      isChatLoading.value = false
    }, 1500)
  }

  const loadChatHistory = async (sessionId: string) => {
    isChatLoading.value = true
    try {
      // 模拟加载逻辑
      messages.value = []
    } finally {
      isChatLoading.value = false
    }
  }

  const loadAllSessions = (): Record<string, TeacherSession> => {
    // 模拟返回写死的会话
    return {
      'teacher_math': { sessionId: 'teacher_math', sessionName: '数学老师', subject: 'MATH', createTime: Date.now() },
      'teacher_biology': { sessionId: 'teacher_biology', sessionName: '生物老师', subject: 'BIOLOGY', createTime: Date.now() }
    }
  }

  const clearMessages = () => {
    messages.value = []
  }

  const activateTeacherSession = async (sessionId: string) => {
    const sessions = loadAllSessions()
    if (sessions[sessionId]) {
      setSession(sessions[sessionId])
      return true
    }
    return false
  }

  return {
    messages,
    currentSession,
    isChatLoading,
    setSession,
    sendMessage,
    loadChatHistory,
    loadAllSessions,
    clearMessages,
    activateTeacherSession
  }
})
