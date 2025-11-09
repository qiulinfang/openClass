/**
 * 转发消息工具类
 * 提供通用的转发消息功能，供各个策略使用
 */

import type { ChatBubble } from '../../../types'
import { apiService } from '../../../services/api-service'
import { useTeacherGeneralChatStore } from '../../../stores/teacherGeneralChatStore'
import { useTeacherExerciseChatStore } from '../../../stores/teacherExerciseChatStore'
import { Dialog } from 'quasar'
import type { ForwardResult, ForwardOptions } from './ChatStrategy'

/**
 * 转发会话类型
 */
export type ForwardSessionType = 'general' | 'exercise'

/**
 * 转换消息格式用于转发
 */
export function convertMessageForForwarding(msg: ChatBubble) {
  // 获取数据类型，默认为text
  const dataType = msg.messageType || 'text'
  const messageType = dataType.toUpperCase() // text -> TEXT, voice -> VOICE, image -> IMAGE
  let messageContent = msg.content || ''

  // 根据角色类型添加前缀
  if (msg.type === 'user') {
    messageContent = '[学生] ' + messageContent
  } else if (msg.type === 'ai') {
    messageContent = '[AI助手] ' + messageContent
  }

  const cleanedContent = messageContent
    ? messageContent
        .replace(/\$[^$]*\$/g, '') // 移除 $...$ 格式的LaTeX
        .replace(/\\[a-zA-Z]+/g, '') // 移除 \command 格式的LaTeX命令
        .replace(/[{}()[\]]/g, '') // 移除LaTeX括号
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim()
    : ''
  
  const result = {
    id: msg.id,
    type: messageType,
    content: cleanedContent,
    timestamp: '',
  }
  
  return result
}

/**
 * 选择或创建老师会话（通用会话）
 */
export async function selectOrCreateTeacherSession(
  subject: 'biology' | 'math' | null,
  onSubjectSelected?: (subject: 'biology' | 'math') => Promise<'biology' | 'math'>
): Promise<{ sessionId: string; sessionName: string; subject: 'biology' | 'math' } | null> {
  const teacherStore = useTeacherGeneralChatStore()
  
  // 如果科目为null，需要用户选择
  if (subject === null) {
    if (!onSubjectSelected) {
      // 如果没有提供选择回调，使用默认对话框
      return new Promise<{ sessionId: string; sessionName: string; subject: 'biology' | 'math' } | null>((resolve) => {
        Dialog.create({
          title: '选择老师',
          message: '请选择要转发的老师类型：',
          options: {
            type: 'radio',
            model: '',
            items: [
              {
                label: '生物老师',
                value: 'biology',
                color: 'green',
              },
              {
                label: '数学老师',
                value: 'math',
                color: 'blue',
              },
            ],
          },
          cancel: {
            label: '取消',
            color: 'grey',
            flat: true,
          },
          ok: {
            label: '确定',
            color: 'primary',
            unelevated: true,
          },
          persistent: false,
        }).onOk(async (selectedSubject: string) => {
          const result = await selectOrCreateTeacherSession(selectedSubject as 'biology' | 'math')
          resolve(result)
        }).onCancel(() => {
          resolve(null)
        })
      })
    } else {
      // 使用提供的选择回调（这种情况不应该发生，因为 subject 为 null）
      // 但为了类型安全，我们仍然处理
      if (subject === null) {
        return null
      }
      const selectedSubject = await onSubjectSelected(subject)
      return selectOrCreateTeacherSession(selectedSubject)
    }
  }
  
  // 初始化老师消息监听器
  await teacherStore.initMessageReceiver()
  
  // 加载老师会话列表
  const sessions = teacherStore.allSessions
  
  // 查找对应科目的会话
  const existingSession = sessions.find((s: { subject: string }) => s.subject === subject)
  
  if (existingSession) {
    // 如果已存在，复用已有会话
    teacherStore.setSession(existingSession)
    await teacherStore.loadChatHistory(existingSession.sessionId)
    return {
      sessionId: existingSession.sessionId,
      sessionName: existingSession.sessionName,
      subject: existingSession.subject as 'biology' | 'math',
    }
  } else {
    // 如果不存在，创建新会话
    const subjectName = subject === 'biology' ? '生物' : '数学'
    const aiSessionId = `teacher_general_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const aiSessionName = `${subjectName}`
    
    const createdSession = teacherStore.createTeacherSession(
      aiSessionId,
      aiSessionName,
      subject as 'biology' | 'math'
    )
    
    if (createdSession) {
      return {
        sessionId: createdSession.sessionId,
        sessionName: createdSession.sessionName,
        subject: createdSession.subject as 'biology' | 'math',
      }
    }
    
    return null
  }
}

/**
 * 选择或创建老师题目会话
 */
export async function selectOrCreateTeacherExerciseSession(
  questionId: string,
  questionTitle: string,
  subject: 'biology' | 'math'
): Promise<{ sessionId: string; sessionName: string; subject: 'biology' | 'math' } | null> {
  const teacherExerciseStore = useTeacherExerciseChatStore()
  
  // 创建或获取题目会话
  const session = teacherExerciseStore.createOrGetSession(questionId, questionTitle, subject)
  
  // 加载聊天历史
  await teacherExerciseStore.loadChatHistory(session.sessionId)
  
  return {
    sessionId: session.sessionId,
    sessionName: session.sessionName,
    subject: session.subject,
  }
}

/**
 * 转发消息到老师
 */
export async function forwardMessageToTeacher(
  messages: ChatBubble[],
  sessionId: string,
  sessionType: ForwardSessionType = 'general'
): Promise<boolean> {
  // 第1步：转换消息格式
  const cleanedMessages = messages.map(convertMessageForForwarding)

  // 第2步：序列化消息数据
  let selectedMessagesData: string
  try {
    selectedMessagesData = JSON.stringify(cleanedMessages)
  } catch (error) {
    console.error('[ForwardMessageHelper] ❌ 序列化失败:', error)
    return false
  }
  
  // 第3步：调用API转发
  try {
    const success = await apiService.forwardAiChatToTeacher(
      selectedMessagesData,
      sessionId,
    )
    
    if (success) {
      // 第4步：保存转发消息到本地存储
      const convertedMessages = messages.map((msg) => {
        // 确定消息类型
        let messageType: 'text' | 'voice' | 'image' = (msg.messageType || 'text') as 'text' | 'voice' | 'image'
        if (!messageType || (messageType !== 'text' && messageType !== 'voice' && messageType !== 'image')) {
          // 如果没有 messageType 或类型不正确，根据数据判断
          if (msg.imageData?.filePath || msg.imageData?.base64DataUrl) {
            messageType = 'image'
          } else if (msg.voiceData?.filePath) {
            messageType = 'voice'
          } else {
            messageType = 'text'
          }
        }
        
        return {
          ...msg,
          id: msg.id.startsWith('forwarded_') ? msg.id : 'forwarded_' + msg.id,
          sender: 'user' as const,
          type: 'user' as const,
          messageType: messageType
        }
      })
      
      // 根据会话类型选择不同的 store
      if (sessionType === 'exercise') {
        const teacherExerciseStore = useTeacherExerciseChatStore()
        // 直接添加到老师题目消息存储并持久化
        teacherExerciseStore.messages.push(...convertedMessages)
        // 立即保存，避免防抖问题导致消息丢失
        await teacherExerciseStore.saveChatHistory(true)
      } else {
        const teacherStore = useTeacherGeneralChatStore()
        // 直接添加到老师通用消息存储并持久化
        teacherStore.messages.push(...convertedMessages)
        // 立即保存，避免防抖问题导致消息丢失
        await teacherStore.saveChatHistory()
      }
    }
    
    return success
  } catch (error) {
    console.error('[ForwardMessageHelper] ❌ forwardMessageToTeacher 异常:', error)
    return false
  }
}

/**
 * 逐条转发消息
 */
export async function forwardMessagesSeparately(
  messages: ChatBubble[],
  sessionId: string,
  sessionType: ForwardSessionType = 'general'
): Promise<{ successCount: number; totalCount: number }> {
  let successCount = 0
  
  for (const message of messages) {
    const selectedMessagesData = JSON.stringify([convertMessageForForwarding(message)])
    
    const success = await apiService.forwardAiChatToTeacher(
      selectedMessagesData,
      sessionId,
    )
    
    if (success) {
      successCount++
    }
    
    // 每条消息之间延迟50ms，避免发送过快
    if (messages.indexOf(message) < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  // 如果至少有一条消息转发成功，保存所有消息到本地存储
  if (successCount > 0) {
    const convertedMessages = messages.map((msg) => ({
      ...msg,
      id: msg.id.startsWith('forwarded_') ? msg.id : 'forwarded_' + msg.id,
      sender: 'user' as const,
      type: 'user' as const,
    }))
    
    // 根据会话类型选择不同的 store
    if (sessionType === 'exercise') {
      const teacherExerciseStore = useTeacherExerciseChatStore()
      // 直接添加到老师题目消息存储
      teacherExerciseStore.messages.push(...convertedMessages)
      // 立即保存，避免防抖问题导致消息丢失
      await teacherExerciseStore.saveChatHistory(true)
    } else {
      const teacherStore = useTeacherGeneralChatStore()
      // 直接添加到老师通用消息存储
      teacherStore.messages.push(...convertedMessages)
      // 立即保存，避免防抖问题导致消息丢失
      await teacherStore.saveChatHistory()
    }
  }
  
  return { successCount, totalCount: messages.length }
}

/**
 * 显示转发成功对话框
 */
export function showForwardSuccessDialog(
  result: ForwardResult,
  options: ForwardOptions,
  onNavigateToTeacher?: (sessionId: string) => void | Promise<void>
) {
  if (!options.showDialog) {
    return
  }
  
  const message = result.successCount && result.successCount > 1
    ? `已成功转发 ${result.successCount} 条消息给老师，是否前往老师对话查看？`
    : '消息已成功转发给老师，是否前往老师对话查看？'
  
  Dialog.create({
    title: '转发成功',
    message: message,
    cancel: {
      label: '留在当前会话',
      color: 'grey-7',
      flat: true,
    },
    ok: {
      label: '前往老师对话',
      color: 'primary',
      unelevated: true,
    },
    persistent: false,
  }).onOk(() => {
    if (result.sessionId && onNavigateToTeacher) {
      onNavigateToTeacher(result.sessionId)
    }
    if (options.onSuccess) {
      options.onSuccess(result)
    }
  }).onCancel(() => {
    if (options.onSuccess) {
      options.onSuccess(result)
    }
  })
}

