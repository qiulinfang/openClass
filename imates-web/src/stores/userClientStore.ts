/**
 * 用户客户端聊天 Store
 * 职责：管理用户客服场景下的聊天消息和WebSocket连接
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatBubble } from '../types'
import { showMessage } from '../utils'
import { getImBaseUrl } from '@/config/env-config'
import { getUserId } from '../services'
import { generateUniqueId } from './utils/chatStoreUtils'

// WebSocket消息类型定义
interface WebSocketMessage {
  type: 'CHAT' | 'SYSTEM' | 'ERROR' | 'USER_JOIN' | 'USER_LEAVE' | 'AGENT_JOIN' | 'READ_STATUS'
  content?: string
  timestamp?: string
  messageId?: string
  from: string  // 统一使用from字段标识发送者
  to?: string
  userId?: string
  conversationId?: string
  offline?: boolean
  status?: string
  msgType?: string
  attachments?: Array<{ filename: string; width?: number; height?: number; size?: number }>
  imageList?: Array<{ url: string }>
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
}

export const useUserClientStore = defineStore('userClient', () => {
  // ==================== 状态定义 ====================

  /** 消息列表 */
  const messages = ref<ChatBubble[]>([])

  /** WebSocket连接 */
  const ws = ref<WebSocket | null>(null)

  /** 连接状态 */
  const isConnected = ref(false)


  /** 连接状态文本 */
  const connectionStatus = ref('未连接')

  /** 正在发送状态 */
  const isSending = ref(false)

  /** 对话框打开状态 */
  const isDialogOpen = ref(false)

  /** 分页加载状态 */
  const isLoadingHistory = ref(false)
  const hasMoreHistory = ref(true)
  const currentPage = ref(0)
  const pageSize = ref(10) // 每次加载10条消息
  const loadedMessageIds = ref<Set<string>>(new Set()) // 已加载的消息ID集合

  // ==================== 计算属性 ====================

  /** 是否可以发送消息 */
  const canSendMessage = computed(() => {
    return isConnected.value && !isSending.value
  })



  // 加载聊天历史（首次加载最近10条）
  const loadChatHistory = async (): Promise<void> => {
    if (isLoadingHistory.value) return

    console.log('[历史记录] 首次加载: 开始从服务器加载聊天历史')
    try {
      isLoadingHistory.value = true

      // 从服务器API加载消息历史
      const userId = getUserId()
      if (!userId) {
        console.error('[历史记录] 用户ID为空，无法加载聊天历史')
        return
      }
      const conversationId = `user-client-session-${userId}`
      const apiUrl = `${getImBaseUrl()}/im/api/conversations/${conversationId}/messages?page=1&pageSize=${pageSize.value}`

      console.log(`[历史记录] 调用API: ${apiUrl}`)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // 如果需要token验证，可以在这里添加
          // 'token': getXuebanToken()
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`[历史记录] 服务器返回数据:`, result)

        if (result.messages && Array.isArray(result.messages)) {
          console.log(`[历史记录] 首次加载: 服务器返回 ${result.messages.length} 条消息，总共 ${result.totalCount} 条`)

          // 将服务器消息转换为前端格式
          const convertedMessages = result.messages.map((serverMsg: ServerChatMessage) => {
            // 转换服务器消息格式为前端ChatBubble格式
            const convertedMsg: ChatBubble = {
              id: serverMsg.messageId || `msg_${Date.now()}_${Math.random()}`,
              messageId: serverMsg.messageId,
              content: serverMsg.msgType === 'IMAGE' ? '' : (serverMsg.content || ''), // 图片消息content为空
              timestamp: serverMsg.createdAt ? new Date(serverMsg.createdAt).toISOString() : new Date().toISOString(),
              sender: serverMsg.fromId === userId ? 'user' : 'teacher', // 客服消息当作teacher类型
              type: serverMsg.fromId === userId ? 'user' : 'teacher',
              messageType: serverMsg.msgType === 'IMAGE' ? 'image' : 'text', // 根据msgType设置正确的消息类型
              isRead: serverMsg.read !== undefined ? serverMsg.read : false,
              sessionId: conversationId,
              // 为图片消息构造 imageData 对象，使用 content 作为图片URL
              imageData: serverMsg.msgType === 'IMAGE' && serverMsg.content ? {
                filePath: '',
                width: serverMsg.attachments?.[0]?.width || 0,
                height: serverMsg.attachments?.[0]?.height || 0,
                fileSize: serverMsg.attachments?.[0]?.size || 0,
                base64DataUrl: serverMsg.content // 使用 content 字段作为图片URL
              } : undefined,
            }
            return convertedMsg
          })

          // 按时间正序排列（最早的在前面）
          const sortedMessages = convertedMessages.sort((a: ChatBubble, b: ChatBubble) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )

          console.log(`[历史记录] 转换后的消息数量: ${sortedMessages.length}`)

          // 更新消息列表和分页状态
          messages.value = sortedMessages
          currentPage.value = 1
          hasMoreHistory.value = result.hasMore || false

          // 记录已加载的消息ID
          loadedMessageIds.value.clear()
          sortedMessages.forEach((msg: ChatBubble) => loadedMessageIds.value.add(msg.id))

          console.log(`[历史记录] 首次加载: 完成，当前显示 ${sortedMessages.length} 条消息${hasMoreHistory.value ? `，还有更多历史消息可加载` : ''}`)
        } else {
          console.log('[历史记录] 首次加载: 服务器返回的消息数据格式不正确')
          // 没有历史消息，重置状态
          messages.value = []
          currentPage.value = 0
          hasMoreHistory.value = false
          loadedMessageIds.value.clear()
        }
      } else {
        console.warn(`[历史记录] API调用失败: ${response.status} ${response.statusText}`)
        // API调用失败时，回退到空状态
        messages.value = []
        currentPage.value = 0
        hasMoreHistory.value = false
        loadedMessageIds.value.clear()
      }
    } catch (error) {
      console.error('[历史记录] 从服务器加载失败:', error)
      // 网络错误或其他异常时，回退到空状态
      messages.value = []
      currentPage.value = 0
      hasMoreHistory.value = false
      loadedMessageIds.value.clear()
    } finally {
      isLoadingHistory.value = false
    }
  }

  // 加载更多历史消息
  const loadMoreHistory = async (): Promise<void> => {
    if (isLoadingHistory.value || !hasMoreHistory.value) return

    console.log(`[历史记录] 加载更多: 开始从服务器加载第 ${currentPage.value + 1} 页历史记录`)
    try {
      isLoadingHistory.value = true

      // 从服务器API加载更多历史消息
      const userId = getUserId()
      if (!userId) {
        console.error('[历史记录] 加载更多: 用户ID为空，无法加载更多历史')
        hasMoreHistory.value = false
        return
      }

      const conversationId = `user-client-session-${userId}`
      const nextPage = currentPage.value + 1
      const apiUrl = `https://www.imates.com.cn/im/api/conversations/${conversationId}/messages?page=${nextPage}&pageSize=${pageSize.value}`

      console.log(`[历史记录] 加载更多: 调用API: ${apiUrl}`)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // 如果需要token验证，可以在这里添加
          // 'token': getXuebanToken()
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`[历史记录] 加载更多: 服务器返回数据:`, result)

        if (result.messages && Array.isArray(result.messages)) {
          if (result.messages.length > 0) {
            console.log(`[历史记录] 加载更多: 加载第 ${nextPage} 页，获取到 ${result.messages.length} 条较早消息`)

            // 将服务器消息转换为前端格式
            const convertedMessages = result.messages.map((serverMsg: ServerChatMessage) => {
              const convertedMsg: ChatBubble = {
                id: serverMsg.messageId || `msg_${Date.now()}_${Math.random()}`,
                messageId: serverMsg.messageId,
                content: serverMsg.msgType === 'IMAGE' ? '' : (serverMsg.content || ''), // 图片消息content为空
                timestamp: serverMsg.createdAt ? new Date(serverMsg.createdAt).toISOString() : new Date().toISOString(),
                sender: serverMsg.fromId === userId ? 'user' : 'teacher',
                type: serverMsg.fromId === userId ? 'user' : 'teacher',
                messageType: serverMsg.msgType === 'IMAGE' ? 'image' : 'text',
                isRead: serverMsg.read !== undefined ? serverMsg.read : false,
                sessionId: conversationId,
                // 为图片消息构造 imageData 对象，使用 content 作为图片URL
                imageData: serverMsg.msgType === 'IMAGE' && serverMsg.content ? {
                  filePath: '',
                  width: serverMsg.attachments?.[0]?.width || 0,
                  height: serverMsg.attachments?.[0]?.height || 0,
                  fileSize: serverMsg.attachments?.[0]?.size || 0,
                  base64DataUrl: serverMsg.content // 使用 content 字段作为图片URL
                } : undefined,
              }
              return convertedMsg
            })

            // 将新消息添加到列表前面（因为时间更早）
            const newMessages = convertedMessages.reverse() // 确保时间顺序正确
            messages.value.unshift(...newMessages)

            // 更新分页状态
            currentPage.value = nextPage
            hasMoreHistory.value = result.hasMore || false

            // 记录已加载的消息ID
            newMessages.forEach((msg: ChatBubble) => loadedMessageIds.value.add(msg.id))

            console.log(`[历史记录] 加载更多: 完成，当前共 ${messages.value.length} 条消息${hasMoreHistory.value ? `，还有更多历史消息可加载` : ''}`)
          } else {
            console.log('[历史记录] 加载更多: 服务器返回空消息列表')
            hasMoreHistory.value = false
          }
        } else {
          console.log('[历史记录] 加载更多: 服务器返回的数据格式不正确')
          hasMoreHistory.value = false
        }
      } else {
        console.warn(`[历史记录] 加载更多: API调用失败: ${response.status} ${response.statusText}`)
        hasMoreHistory.value = false
      }
    } catch (error) {
      console.error('[历史记录] 加载更多: 从服务器加载失败', error)
      hasMoreHistory.value = false
    } finally {
      isLoadingHistory.value = false
    }
  }

  // ==================== WebSocket 管理 ====================

  /** 连接到WebSocket服务器 */
  const connect = async (): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        // 调用IM服务的用户认证接口，获取IM专用token（独立部署，永远不传递token）
        try {
          const userId = getUserId() || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
          }

          const authResponse = await fetch(`${getImBaseUrl()}/im/api/auth/user-login`, {
            method: 'POST',
            headers,
            body: `userId=${encodeURIComponent(userId)}`
          })

          if (!authResponse.ok) {
            const errorData = await authResponse.json()
            connectionStatus.value = '认证失败'
            showMessage(errorData.message || 'IM认证失败', 'error')
            resolve(false)
            return
          }

          const authData = await authResponse.json()
          if (!authData.success) {
            connectionStatus.value = '无权限'
            showMessage(authData.message || '您没有IM权限', 'warning')
            resolve(false)
            return
          }

          // 使用IM专用token建立WebSocket连接
          const imToken = authData.data.token
          connectionStatus.value = '连接中...'
          isConnected.value = false

          const wsUrl = `wss://${getImBaseUrl().replace('https://', '')}/im/ws/im?token=${encodeURIComponent(imToken)}&role=user`
          ws.value = new WebSocket(wsUrl)

        } catch (authError) {
          console.error('IM认证异常:', authError)
          connectionStatus.value = '认证异常'
          showMessage('IM认证服务异常，请稍后重试', 'error')
          resolve(false)
          return
        }

        ws.value.onopen = () => {
          onConnected()
          resolve(true)
        }

        ws.value.onmessage = (event) => {
          onMessage(event)
        }

        ws.value.onclose = () => {
          onDisconnected()
        }

        ws.value.onerror = (error) => {
          onError(error)
          resolve(false)
        }

      } catch (error) {
        console.error('连接失败:', error)
        connectionStatus.value = '连接错误'
        resolve(false)
      }
    })
  }

  /** 断开WebSocket连接 */
  const disconnect = () => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.close()
    }
    ws.value = null
    isConnected.value = false
    connectionStatus.value = '已断开'
  }

  /** WebSocket事件处理 */
  const onConnected = () => {
    console.log('[用户端] WebSocket连接成功')
    connectionStatus.value = '已连接'
    isConnected.value = true

    // 发送用户加入消息
    sendUserJoinMessage()
  }

  const onMessage = (event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      handleMessage(message)
    } catch (error) {
      console.error('解析消息失败:', error)
      addErrorMessage('收到无效消息格式')
    }
  }

  const onDisconnected = () => {
    connectionStatus.value = '已断开'
    isConnected.value = false
    // addSystemMessage('与服务器断开连接')
  }

  const onError = (error: Event) => {
    console.error('WebSocket错误:', error)
    connectionStatus.value = '连接错误'
    isConnected.value = false
    // addErrorMessage('连接出现错误，请稍后重试。')
  }

  /** 处理接收到的消息 */
  const handleMessage = (message: WebSocketMessage) => {
    console.log('[用户端] 📨 收到WebSocket消息:', {
      type: message.type,
      from: message.from,
      content: message.content?.substring(0, 50) + (message.content && message.content.length > 50 ? '...' : ''),
      timestamp: message.timestamp
    })

    switch (message.type) {
      case 'CHAT':
        console.log('[用户端] 处理CHAT消息')
        addReceivedMessage(message)

        // 如果对话框处于打开状态，立刻发送已读状态
        if (isDialogOpen.value) {
          console.log('[用户端] 对话框已打开，立刻发送已读状态')
          sendReadStatusToAgent()
        }
        break
      case 'SYSTEM':
        console.log('[用户端] 处理SYSTEM消息:', message.content)
        if (message.content) {
          addSystemMessage(message.content)
        }
        break
      case 'ERROR':
        console.log('[用户端] 处理ERROR消息:', message.content)
        addErrorMessage(message.content || '收到错误消息')
        break
      case 'AGENT_JOIN':
        console.log('[用户端] 处理AGENT_JOIN消息')
        handleAgentJoin(message)
        break
      case 'READ_STATUS':
        console.log('[用户端] 处理READ_STATUS消息')
        handleReadStatus(message)
        break
      default:
        console.log('[用户端] 未知消息类型:', message.type)
        break
    }
  }

  /** 处理聊天消息 */
  const handleAgentJoin = (message: WebSocketMessage) => {
    console.log(`收到客服上线通知: ${message.userId}`)
    // 客服上线时，自动标记所有用户消息为已读
    // 因为客服上线意味着客服已经准备好处理消息
    markAllUserMessagesAsRead()
  }

  const handleReadStatus = (message: WebSocketMessage) => {
    console.log(`📖 收到已读状态同步: ${message.from} -> ${message.status}`)
    // 客服标记消息为已读，更新用户端的消息状态
    if (message.from && message.status === 'read') {
      console.log('✅ 执行markAllUserMessagesAsRead')
      markAllUserMessagesAsRead()
      // markAllUserMessagesAsRead已经包含了saveChatHistory调用
    } else {
      console.log('❌ READ_STATUS条件不满足:', { from: message.from, status: message.status })
    }
  }


  // ==================== 消息管理 ====================

  /** 发送图片消息 */
  const sendImagesMessage = async (
    imageList: Array<{
      filePath: string
      width: number
      height: number
      fileSize: number
      base64DataUrl?: string
    }>,
    textContent?: string
  ): Promise<void> => {
    const now = Date.now()

    console.log('[用户端] 本地存储多图消息 - 原始imageList长度:', imageList.length)
    console.log('[用户端] 本地存储多图消息 - 原始imageList:', imageList.map((img, i) => ({
      index: i,
      hasBase64: !!img.base64DataUrl,
      base64Length: img.base64DataUrl ? img.base64DataUrl.length : 0
    })))

    // 本地插入多图消息气泡
    const chatBubble: ChatBubble = {
      id: generateUniqueId(),
      sender: 'user',
      type: 'user',
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

    console.log('[用户端] 本地存储多图消息 - chatBubble.imageList长度:', chatBubble.imageList?.length || 0)
    console.log('[用户端] 本地存储多图消息 - chatBubble:', chatBubble)

    messages.value.push(chatBubble)

    // 发送多张图片到后端
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      addErrorMessage('WebSocket未连接，无法发送图片')
      return
    }

    isSending.value = true
    try {
      // 上传所有图片
      const uploadPromises = imageList.map(async (imageInfo, index) => {
        if (!imageInfo.base64DataUrl) return null

        console.log(`[用户端] 上传第${index + 1}张图片...`)

        // 将base64转换为blob
        const base64Data = imageInfo.base64DataUrl.split(',')[1]
        const mimeType = imageInfo.base64DataUrl.split(',')[0].split(':')[1].split(';')[0]
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: mimeType })

        // 上传图片
        const formData = new FormData()
        formData.append('file', blob, `image_${index}.${mimeType.split('/')[1]}`)

        const uploadResponse = await fetch(`${getImBaseUrl()}/im/api/images/upload`, {
          method: 'POST',
          body: formData
        })

        const uploadResult = await uploadResponse.json()

        if (!uploadResponse.ok || !uploadResult.success) {
          console.error(`[用户端] 第${index + 1}张图片上传失败:`, uploadResult.message)
          return null
        }

        return uploadResult.data.url
      })

      const imageUrls = await Promise.all(uploadPromises)
      const validUrls = imageUrls.filter(url => url !== null)

      if (validUrls.length === 0) {
        addErrorMessage('所有图片上传失败')
        throw new Error('所有图片上传失败')
      }

      // 发送包含图片URL的消息
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const message: WebSocketMessage = {
        type: 'CHAT',
        msgType: 'multi_image',
        content: textContent || '',
        timestamp: new Date().toISOString(),
        from: getUserId() || '',
        to: 'Agent_007',
        messageId: messageId,
        conversationId: `user-client-session-${getUserId()}`,
        imageList: validUrls.map(url => ({ url })),
      }

      console.log('[用户端] 发送多图消息 - 完整数据:', message)
      console.log('[用户端] 发送多图消息 - 序列化后:', JSON.stringify(message, null, 2))

      ws.value.send(JSON.stringify(message))
      console.log('[用户端] 多图消息发送成功')

    } catch (error) {
      console.error('[用户端] 发送多图消息失败:', error)
      addErrorMessage('发送失败，请重试')
    } finally {
      isSending.value = false
    }
  }

  const sendImageMessage = async (
    imageInfo: {
      filePath: string
      width: number
      height: number
      fileSize: number
      base64DataUrl?: string
    },
    textContent?: string
  ): Promise<void> => {
    // 与 aiGeneralChatStore 的图片处理流程保持一致：
    // 1) 先在本地插入图片气泡（image/messageType=image）
    // 2) 若包含 base64DataUrl，则构造与 aiGeneral 相似的请求体（包含 dstUrl / imageList）并通过 WS 发送（后端会按该字段走截图接口）
    // 3) 若没有 base64，则回退到原先通过 msgType=IMAGE 的 WS 发送（只发送基本信息）
    const now = Date.now()

    // 本地插入图片气泡（sessionId 带时间戳以保证唯一）
    const chatBubble: ChatBubble = {
      id: generateUniqueId(),
      sender: 'user',
      type: 'user',
      content: textContent || '',
      timestamp: new Date().toISOString(),
      sessionId: `user-client-session-${now}`,
      messageType: imageInfo.base64DataUrl ? 'image' : 'text',
      imageData: imageInfo.base64DataUrl
        ? {
            filePath: imageInfo.filePath || '',
            width: imageInfo.width || 0,
            height: imageInfo.height || 0,
            fileSize: imageInfo.fileSize || 0,
            base64DataUrl: imageInfo.base64DataUrl,
          }
        : undefined,
    }
    messages.value.push(chatBubble)

    // 统一处理：先上传图片获取URL，然后发送URL
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      addErrorMessage('WebSocket未连接，无法发送图片')
      return
    }

    isSending.value = true
    try {
      let imageUrl: string

      if (imageInfo.base64DataUrl) {
        // 如果有base64，先上传获取URL
        console.log('[用户端] 检测到base64图片，开始上传...')

        // 将base64转换为blob
        const base64Data = imageInfo.base64DataUrl.split(',')[1]
        const mimeType = imageInfo.base64DataUrl.split(',')[0].split(':')[1].split(';')[0]
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: mimeType })

        // 上传图片
        const formData = new FormData()
        formData.append('file', blob, `image.${mimeType.split('/')[1]}`)

        const uploadResponse = await fetch(`${getImBaseUrl()}/im/api/images/upload`, {
          method: 'POST',
          body: formData
        })

        const uploadResult = await uploadResponse.json()

        if (!uploadResponse.ok || !uploadResult.success) {
          // 直接使用后端返回的错误信息
          addErrorMessage(uploadResult.message || `上传失败 (${uploadResponse.status})`)
          throw new Error(uploadResult.message || '上传失败')
        }

        imageUrl = uploadResult.data.url
        console.log('[用户端] base64图片上传成功，URL:', imageUrl)

      } else {
        // 如果没有base64，先上传图片获取URL
        console.log('[用户端] 开始上传图片文件...')

        const fileResponse = await fetch(imageInfo.filePath)
        const blob = await fileResponse.blob()
        const formData = new FormData()
        formData.append('file', blob, imageInfo.filePath.split('/').pop() || 'image.jpg')

        const uploadResponse = await fetch(`${getImBaseUrl()}/im/api/images/upload`, {
          method: 'POST',
          body: formData
        })

        const uploadResult = await uploadResponse.json()

        if (!uploadResponse.ok || !uploadResult.success) {
          // 直接使用后端返回的错误信息
          addErrorMessage(uploadResult.message || `上传失败 (${uploadResponse.status})`)
          throw new Error(uploadResult.message || '上传失败')
        }

        imageUrl = uploadResult.data.url
        console.log('[用户端] 图片上传成功，URL:', imageUrl)
      }

      // 发送标准的WebSocket消息格式
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 如果有文本内容，将图片URL和文本组合在一起
      const messageContent = textContent && textContent.trim()
        ? `${imageUrl}\n\n${textContent.trim()}`
        : imageUrl

      const wsPayload = {
        type: 'CHAT',
        content: messageContent, // 发送图片URL和文本内容
        timestamp: new Date().toISOString(),
        from: getUserId() || '',
        to: 'Agent_007',
        messageId: messageId,
        conversationId: `user-client-session-${getUserId()}`,
        msgType: 'IMAGE', // 明确标识为图片消息
        attachments: [
          {
            filename: 'image.jpg', // 简化文件名
            contentType: 'image/jpeg'
          },
        ],
      }

      console.log('[用户端] 发送图片消息:', {
        from: wsPayload.from,
        to: wsPayload.to,
        msgType: wsPayload.msgType,
        contentLength: wsPayload.content.length,
        imageUrl: wsPayload.content
      })

      ws.value.send(JSON.stringify(wsPayload))
    } catch (error) {
      console.error('发送图片失败:', error)
      addErrorMessage('发送图片失败，请重试。')
      throw error
  } finally {
    isSending.value = false
  }
}

  /** 发送消息 */
  const sendMessage = async (content: string): Promise<void> => {
    if (!content.trim() || !ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return
    }

    isSending.value = true

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const message: WebSocketMessage = {
      type: 'CHAT',
      content: content,
      timestamp: new Date().toISOString(),
      from: getUserId() || '',
      to: 'Agent_007',
      messageId: messageId,
      conversationId: `user-client-session-${getUserId()}`
    }

    console.log('[用户端] 发送消息:', {
      from: message.from,
      to: message.to,
      content: message.content,
      timestamp: message.timestamp
    })

    try {
      ws.value.send(JSON.stringify(message))
      console.log('[用户端] 消息发送成功')
      addSentMessage(message)
    } catch (error) {
      console.error('[用户端] 发送消息失败:', error)
      addErrorMessage('发送消息失败，请重试。')
    } finally {
      isSending.value = false
    }
  }

  /** 检查并插入时间分隔符 */
  const checkAndInsertTimeSeparator = (messageTimestamp: string) => {
    if (messages.value.length === 0) return // 第一条消息不需要分隔符

    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage.messageType === 'time_separator') return // 已经有时间分隔符了

    const currentTime = new Date(messageTimestamp).getTime()
    const lastTime = new Date(lastMessage.timestamp).getTime()
    const timeDiff = currentTime - lastTime

    // 如果时间间隔超过1小时，插入时间分隔符
    if (timeDiff > 60 * 60 * 1000) { // 1分钟 = 60 * 1000 毫秒
      const timeSeparator: ChatBubble = {
        id: `time_separator_${messageTimestamp}_${Date.now()}`,
        content: '',
        sender: 'ai',
        type: 'ai',
        timestamp: new Date(new Date(messageTimestamp).getTime() - 1).toISOString(), // 比消息时间戳早1毫秒，确保排序在消息之前
        messageType: 'time_separator',
        isSystemMessage: false, // 这个要保存到历史记录中
        sessionId: 'user-client-session'
      }
      messages.value.push(timeSeparator)
    }
  }

  /** 添加发送的消息 */
  const addSentMessage = (message: WebSocketMessage) => {
    const messageTimestamp = message.timestamp || new Date().toISOString()

    // 检查是否需要插入时间分隔符
    checkAndInsertTimeSeparator(messageTimestamp)

    const chatBubble: ChatBubble = {
      id: generateUniqueId(),
      sender: 'user',
      type: 'user',
      content: message.content || '',
      timestamp: messageTimestamp,
      sessionId: 'user-client-session',
      isRead: false // 发送的消息初始状态为已读
    }
    messages.value.push(chatBubble)
  }

  /** 添加接收的消息 */
  const addReceivedMessage = (message: WebSocketMessage) => {
    const messageTimestamp = message.timestamp || new Date().toISOString()

    // 检查是否需要插入时间分隔符
    checkAndInsertTimeSeparator(messageTimestamp)

    const chatBubble: ChatBubble = {
      id: generateUniqueId(),
      sender: message.from === getUserId() ? 'user' : 'teacher', // 根据from字段判断发送者
      type: message.from === getUserId() ? 'user' : 'teacher',
      content: message.msgType === 'IMAGE' ? '' : (message.content || ''), // 图片消息content为空
      timestamp: messageTimestamp,
      sessionId: 'user-client-session',
      // 如果后端通过 msgType 标记为 IMAGE，则在本地也标记为 image，方便前端渲染
      messageType: message.msgType === 'IMAGE' ? 'image' : undefined,
      // 为图片消息构造 imageData 对象，使用 content 作为图片URL
      imageData: message.msgType === 'IMAGE' && message.content ? {
        filePath: '',
        width: message.attachments?.[0]?.width || 0,
        height: message.attachments?.[0]?.height || 0,
        fileSize: message.attachments?.[0]?.size || 0,
        base64DataUrl: message.content // 使用 content 字段作为图片URL
      } : undefined,
      isRead: isDialogOpen.value // 如果对话框打开，新消息直接标记为已读
    }
    messages.value.push(chatBubble)

    // 收到客服消息时，立即将所有用户发送的消息标记为已读（类似主流IM应用逻辑）
    markAllUserMessagesAsRead()

    // 只在对话框打开时发送已读状态给客服
    if (isDialogOpen.value) {
      sendReadStatusToAgent()
    }
  }

  /** 添加系统消息 */
  const addSystemMessage = (content: string) => {
    const chatBubble: ChatBubble = {
      id: generateUniqueId(),
      sender: 'ai',
      type: 'ai',
      content: content,
      timestamp: new Date().toISOString(),
      messageType: 'system',
      sessionId: 'user-client-session'
    }
    messages.value.push(chatBubble)
  }

  /** 添加错误消息 */
  const addErrorMessage = (content: string) => {
    const chatBubble: ChatBubble = {
      id: generateUniqueId(),
      sender: 'ai',
      type: 'ai',
      content: content,
      timestamp: new Date().toISOString(),
      isError: true,
      sessionId: 'user-client-session'
    }
    messages.value.push(chatBubble)
  }

  /** 标记单个客服消息为已读 */
  const markMessageAsRead = (messageId: string) => {
    const message = messages.value.find(msg => msg.id === messageId)
    if (message && message.sender === 'ai' && !message.isRead) {
      message.isRead = true
      console.log(`客服消息已读: ${messageId}`)
    }
  }

  /** 发送用户加入消息 */
  const sendUserJoinMessage = () => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return
    }

    const joinMessage: WebSocketMessage = {
      type: 'USER_JOIN',
      from: getUserId() || '',
      to: 'Agent_007', // 客服ID
      conversationId: `user-client-session-${getUserId()}`,
      timestamp: new Date().toISOString(),
      userId: getUserId() || ''
    }

    console.log('[用户端] 发送用户加入消息:', {
      from: joinMessage.from,
      to: joinMessage.to,
      type: joinMessage.type,
      userId: joinMessage.userId
    })

    ws.value.send(JSON.stringify(joinMessage))
  }

  /** 向客服发送已读状态确认 */
  const sendReadStatusToAgent = () => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return
    }

    const readStatusMessage: WebSocketMessage = {
      type: 'READ_STATUS',
      from: getUserId() || '',
      to: 'Agent_007', // 客服ID
      conversationId: `user-client-session-${getUserId()}`,
      timestamp: new Date().toISOString(),
      status: 'read'
    }

    console.log('[用户端] 发送已读状态:', {
      from: readStatusMessage.from,
      to: readStatusMessage.to,
      type: readStatusMessage.type,
      status: readStatusMessage.status
    })

    try {
      ws.value.send(JSON.stringify(readStatusMessage))
      console.log('[用户端] 已读状态发送成功')
    } catch (error) {
      console.error('[用户端] 发送已读状态失败:', error)
    }
  }

  /** 标记所有用户消息为已读 */
  const markAllUserMessagesAsRead = () => {
    // 将所有用户发送的消息标记为已读
    messages.value.forEach(msg => {
      if (msg.sender === 'user' && !msg.isRead) {
        msg.isRead = true
      }
    })
    console.log('已读: 标记所有用户消息为已读')
  }

  /** 标记所有客服消息为已读 */
  const markAllAIMessagesAsRead = () => {
    // 将所有客服发送的消息标记为已读
    messages.value.forEach(msg => {
      if ((msg.sender === 'ai' || msg.sender === 'teacher') && !msg.isRead) {
        msg.isRead = true
      }
    })
    console.log('已读: 标记所有客服消息为已读')
  }


  // ==================== 工具函数 ====================


  // ==================== 工具函数 ====================

  return {
    // 状态
    messages,
    isConnected,
    connectionStatus,
    isSending,
    canSendMessage,
    isLoadingHistory,
    hasMoreHistory,

    // 方法
    connect,
    disconnect,
    sendMessage,
    sendImageMessage,
    sendImagesMessage,
    addSystemMessage,
    loadChatHistory,
    loadMoreHistory,
    markMessageAsRead,
    markAllUserMessagesAsRead,
    markAllAIMessagesAsRead,
    sendUserJoinMessage,
    sendReadStatusToAgent,

    // 设置对话框打开状态
    setDialogOpen: (open: boolean) => {
      isDialogOpen.value = open
    },

    // 未读消息数（只计算客服发送的未读消息）
    unreadCount: computed(() => {
      return messages.value.filter(msg => (msg.sender === 'ai' || msg.sender === 'teacher') && !msg.isRead).length
    })

  }
})
