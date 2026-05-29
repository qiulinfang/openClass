import { create } from 'zustand'
import type { ChatBubble, AttachedScreenshot } from '@/types'
import { showMessage } from '@/utils'
import { getImBaseUrl, getImWebSocketUrl } from '@/config/env-config'
import { getUserId } from '@/services/http/auth-service'
import { generateUniqueId } from '@/stores/utils/chatStoreUtils'
import { apiService } from '@/services/http/api-service'
import { Sender } from '@/types/enums'

// WebSocket消息类型定义
interface WebSocketMessage {
  type: 'CHAT' | 'SYSTEM' | 'ERROR' | 'USER_JOIN' | 'USER_LEAVE' | 'AGENT_JOIN' | 'READ_STATUS'
  content?: string
  timestamp?: string
  messageId?: string
  from: string
  to?: string
  userId?: string
  conversationId?: string
  offline?: boolean
  status?: string
  msgType?: string
  attachments?: Array<{ filename: string; width?: number; height?: number; size?: number }>
  imageList?: Array<{ url: string; width?: number; height?: number; size?: number }>
}

// 服务器消息格式定义
interface ServerChatMessage {
  messageId: string
  conversationId: string
  fromId: string
  toId: string
  content: string
  createdAt: string
  read?: boolean
  msgType?: string
  attachments?: Array<{ filename: string; width?: number; height?: number; size?: number }>
  imageList?: Array<{ url: string; width?: number; height?: number; size?: number }>
}

interface UserClientChatState {
  messages: ChatBubble[]
  inputAttachedScreenshots: AttachedScreenshot[]
  inputScreenshotDrawingStates: Record<string, unknown>
  ws: WebSocket | null
  isConnected: boolean
  connectionStatus: string
  isSending: boolean
  isDialogOpen: boolean
  isLoadingHistory: boolean
  hasMoreHistory: boolean
  currentPage: number
  pageSize: number
  loadedMessageIds: Set<string>
  
  // Actions
  setMessages: (messages: ChatBubble[]) => void
  addMessage: (message: ChatBubble) => void
  clearMessages: () => void
  setIsSending: (loading: boolean) => void
  setIsDialogOpen: (open: boolean) => void
  
  connect: () => Promise<boolean>
  disconnect: () => void
  sendMessage: (content: string) => Promise<void>
  sendImagesMessage: (imageList: any[], textContent?: string) => Promise<void>
  sendImageMessage: (imageInfo: { filePath: string; width: number; height: number; fileSize: number; base64DataUrl?: string }, textContent?: string) => Promise<void>
  loadChatHistory: () => Promise<void>
  loadMoreHistory: () => Promise<void>
  
  // Helpers
  canSendMessage: () => boolean
  markAllUserMessagesAsRead: () => void
  sendReadStatusToAgent: () => void
}

export const useUserClientChatStore = create<UserClientChatState>((set, get) => {
  const handleMessage = (message: WebSocketMessage) => {
    const { isDialogOpen, sendReadStatusToAgent, markAllUserMessagesAsRead } = get()
    
    switch (message.type) {
      case 'CHAT':
        addReceivedMessage(message)
        if (isDialogOpen) {
          sendReadStatusToAgent()
        }
        break
      case 'SYSTEM':
        if (message.content) {
          // addSystemMessage logic
        }
        break
      case 'AGENT_JOIN':
        markAllUserMessagesAsRead()
        break
      case 'READ_STATUS':
        if (message.from && message.status === 'read') {
          markAllUserMessagesAsRead()
        }
        break
    }
  }

  const addReceivedMessage = (message: WebSocketMessage) => {
    const { messages, isDialogOpen, markAllUserMessagesAsRead } = get()
    const messageTimestamp = message.timestamp || new Date().toISOString()
    
    // Time separator logic can be added here
    
    const chatBubble: ChatBubble = {
      id: generateUniqueId(),
      sender: message.from === getUserId() ? Sender.USER : Sender.TEACHER,
      type: message.from === getUserId() ? Sender.USER : Sender.TEACHER,
      content: message.content || '',
      timestamp: messageTimestamp,
      sessionId: 'user-client-session',
      messageType: message.msgType === 'multi_image' ? 'multi_image' : undefined,
      imageList: message.imageList ? message.imageList.map(img => ({
        filePath: '',
        width: img.width || 0,
        height: img.height || 0,
        fileSize: img.size || 0,
        base64DataUrl: img.url,
        url: img.url
      })) : undefined,
      isRead: isDialogOpen
    }
    
    set({ messages: [...messages, chatBubble] })
    markAllUserMessagesAsRead()
  }

  return {
    messages: [],
    inputAttachedScreenshots: [],
    inputScreenshotDrawingStates: {},
    ws: null,
    isConnected: false,
    connectionStatus: '未连接',
    isSending: false,
    isDialogOpen: false,
    isLoadingHistory: false,
    hasMoreHistory: true,
    currentPage: 0,
    pageSize: 10,
    loadedMessageIds: new Set(),

    canSendMessage: () => {
      const { isConnected, isSending } = get()
      return isConnected && !isSending
    },

    setMessages: (messages: ChatBubble[]) => set({ messages }),
    addMessage: (message: ChatBubble) => set((state) => ({ messages: [...state.messages, message] })),
    clearMessages: () => set({ messages: [] }),
    setIsSending: (isSending: boolean) => set({ isSending }),
    setIsDialogOpen: (isDialogOpen: boolean) => set({ isDialogOpen }),

    connect: async () => {
      return new Promise(async (resolve) => {
        try {
          const userId = getUserId() || `guest_${Date.now()}`
          const authUrl = `${getImBaseUrl()}/api/auth/user-login`
          
          const authResponse = await fetch(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `userId=${encodeURIComponent(userId)}`
          })

          if (!authResponse.ok) {
            set({ connectionStatus: '认证失败' })
            resolve(false)
            return
          }

          const authData = await authResponse.json()
          if (!authData.success) {
            set({ connectionStatus: '无权限' })
            resolve(false)
            return
          }

          const imToken = authData.data.token
          const wsUrl = `${getImWebSocketUrl()}?token=${encodeURIComponent(imToken)}&role=user`
          const ws = new WebSocket(wsUrl)
          
          ws.onopen = () => {
            set({ ws, isConnected: true, connectionStatus: '已连接' })
            // Send join message
            ws.send(JSON.stringify({ type: 'USER_JOIN', from: userId }))
            resolve(true)
          }

          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data)
              handleMessage(message)
            } catch (e) { console.error('Parse error', e) }
          }

          ws.onclose = () => {
            set({ ws: null, isConnected: false, connectionStatus: '已断开' })
          }

          ws.onerror = () => {
            set({ isConnected: false, connectionStatus: '连接错误' })
            resolve(false)
          }

        } catch (e) {
          set({ connectionStatus: '连接异常' })
          resolve(false)
        }
      })
    },

    disconnect: () => {
      const { ws } = get()
      if (ws) ws.close()
      set({ ws: null, isConnected: false, connectionStatus: '已断开' })
    },

    sendMessage: async (content: string) => {
      const { ws, isConnected } = get()
      if (!content.trim() || !ws || !isConnected) return

      set({ isSending: true })
      const userId = getUserId() || ''
      const messageId = `msg_${Date.now()}`
      
      const payload: WebSocketMessage = {
        type: 'CHAT',
        content,
        timestamp: new Date().toISOString(),
        from: userId,
        to: 'Agent_007',
        messageId,
        conversationId: `user-client-session-${userId}`
      }

      try {
        ws.send(JSON.stringify(payload))
        const bubble: ChatBubble = {
          id: generateUniqueId(),
          sender: Sender.USER,
          type: Sender.USER,
          content,
          timestamp: payload.timestamp!,
          sessionId: 'user-client-session',
          isRead: false
        }
        set((state) => ({ messages: [...state.messages, bubble] }))
      } catch (e) {
        showMessage('发送失败', 'error')
      } finally {
        set({ isSending: false })
      }
    },

    sendImagesMessage: async (imageList: any[], textContent?: string) => {
      const now = Date.now()
      const { ws, messages, markAllUserMessagesAsRead } = get()

      const chatBubble: ChatBubble = {
        id: generateUniqueId(),
        sender: Sender.USER,
        type: Sender.USER,
        content: textContent || '',
        timestamp: new Date().toISOString(),
        sessionId: `user-client-session-${now}`,
        messageType: 'multi_image',
        imageList: imageList.map(img => ({
          filePath: img.filePath || '',
          width: img.width || 0,
          height: img.height || 0,
          fileSize: img.fileSize || 0,
          base64DataUrl: img.base64DataUrl,
          isLargeImage: false,
        })),
      }

      set({ messages: [...messages, chatBubble] })

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        showMessage('WebSocket未连接，无法发送图片', 'error')
        return
      }

      set({ isSending: true })
      try {
        const uploadPromises = imageList.map(async (imageInfo) => {
          if (!imageInfo.base64DataUrl) return null
          try {
            return await apiService.uploadImageAndGetUrl(imageInfo.base64DataUrl)
          } catch (e) { return null }
        })

        const imageUrls = (await Promise.all(uploadPromises)).filter(url => url !== null)

        if (imageUrls.length === 0) {
          throw new Error('所有图片上传失败')
        }

        const messageId = `msg_${Date.now()}`
        const userId = getUserId() || ''

        const message: WebSocketMessage = {
          type: 'CHAT',
          msgType: 'multi_image',
          content: textContent || '',
          timestamp: new Date().toISOString(),
          from: userId,
          to: 'Agent_007',
          messageId,
          conversationId: `user-client-session-${userId}`,
          imageList: imageUrls.map(url => ({ url })),
        }

        ws.send(JSON.stringify(message))
        markAllUserMessagesAsRead()
      } catch (error) {
        showMessage('发送失败，请重试', 'error')
      } finally {
        set({ isSending: false })
      }
    },

    sendImageMessage: async (imageInfo, textContent) => {
      const now = Date.now()
      const { ws, messages, markAllUserMessagesAsRead } = get()

      const chatBubble: ChatBubble = {
        id: generateUniqueId(),
        sender: Sender.USER,
        type: Sender.USER,
        content: textContent || '',
        timestamp: new Date().toISOString(),
        sessionId: `user-client-session-${now}`,
        messageType: imageInfo.base64DataUrl ? 'image' : 'text',
        imageData: imageInfo.base64DataUrl ? {
          filePath: imageInfo.filePath || '',
          width: imageInfo.width || 0,
          height: imageInfo.height || 0,
          fileSize: imageInfo.fileSize || 0,
          base64DataUrl: imageInfo.base64DataUrl,
        } : undefined,
      }
      set({ messages: [...messages, chatBubble] })

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        showMessage('WebSocket未连接，无法发送图片', 'error')
        return
      }

      set({ isSending: true })
      try {
        let imageUrl: string
        if (imageInfo.base64DataUrl) {
          imageUrl = await apiService.uploadImageAndGetUrl(imageInfo.base64DataUrl)
        } else {
          const fileResponse = await fetch(imageInfo.filePath)
          const blob = await fileResponse.blob()
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          imageUrl = await apiService.uploadImageAndGetUrl(base64Data)
        }

        const imageMessageId = `msg_${Date.now()}`
        const imagePayload: WebSocketMessage = {
          type: 'CHAT',
          content: imageUrl,
          timestamp: new Date().toISOString(),
          from: getUserId() || '',
          to: 'Agent_007',
          messageId: imageMessageId,
          conversationId: `user-client-session-${getUserId()}`,
          msgType: 'IMAGE',
          attachments: [{ filename: 'image.jpg' }]
        }
        ws.send(JSON.stringify(imagePayload))

        if (textContent?.trim()) {
          const textMessageId = `msg_${Date.now() + 1}`
          const textPayload: WebSocketMessage = {
            type: 'CHAT',
            content: textContent.trim(),
            timestamp: new Date().toISOString(),
            from: getUserId() || '',
            to: 'Agent_007',
            messageId: textMessageId,
            conversationId: `user-client-session-${getUserId()}`
          }
          ws.send(JSON.stringify(textPayload))
        }
        markAllUserMessagesAsRead()
      } catch (error) {
        showMessage('发送失败', 'error')
      } finally {
        set({ isSending: false })
      }
    },

    loadChatHistory: async () => {
      const { isLoadingHistory, pageSize } = get()
      if (isLoadingHistory) return

      set({ isLoadingHistory: true })
      try {
        const userId = getUserId()
        if (!userId) return

        const conversationId = `user-client-session-${userId}`
        const apiUrl = `${getImBaseUrl()}/api/conversations/${conversationId}/messages?page=1&pageSize=${pageSize}`
        
        const response = await fetch(apiUrl)
        if (response.ok) {
          const result = await response.json()
          if (result.messages && Array.isArray(result.messages)) {
            const converted = result.messages.map((serverMsg: ServerChatMessage) => ({
              id: serverMsg.messageId,
              messageId: serverMsg.messageId,
              content: serverMsg.content || '',
              timestamp: new Date(serverMsg.createdAt).toISOString(),
              sender: serverMsg.fromId === userId ? Sender.USER : Sender.TEACHER,
              type: serverMsg.fromId === userId ? Sender.USER : Sender.TEACHER,
              messageType: serverMsg.msgType === 'multi_image' ? 'multi_image' : 'text',
              isRead: serverMsg.read || false,
              sessionId: conversationId,
              imageList: serverMsg.imageList?.map(img => ({
                filePath: '', width: img.width || 0, height: img.height || 0,
                fileSize: img.size || 0, base64DataUrl: img.url, url: img.url
              }))
            }))
            set({ 
              messages: converted.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
              currentPage: 1,
              hasMoreHistory: result.hasMore || false
            })
          }
        }
      } finally {
        set({ isLoadingHistory: false })
      }
    },

    loadMoreHistory: async () => {
      // Implementation similar to web...
    },

    markAllUserMessagesAsRead: () => {
      set((state) => ({
        messages: state.messages.map(m => m.sender === Sender.USER ? { ...m, isRead: true } : m)
      }))
    },

    sendReadStatusToAgent: () => {
      const { ws, isConnected } = get()
      if (ws && isConnected) {
        ws.send(JSON.stringify({
          type: 'READ_STATUS',
          from: getUserId() || '',
          to: 'Agent_007',
          status: 'read'
        }))
      }
    }
  }
})
