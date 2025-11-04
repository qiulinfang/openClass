/**
 * ChatScreen - 聊天界面主屏幕
 * 负责消息列表展示、消息输入、流式响应处理、会话管理等核心功能
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useAiGeneralChatStore } from '../stores/aiGeneralChatStore'
import { useUserStore } from '../stores/userStore'
import type { RootStackParamList } from '../navigation/types'
import type { ChatBubble } from '../types/chat'
import ChatInput from '../components/chat/ChatInput'
import ChatMessage from '../components/chat/ChatMessage'
import SessionDrawer from '../components/chat/SessionDrawer'
import type { ChatInputHandle } from '../components/chat/ChatInput'

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>

const ChatScreen: React.FC = () => {
  const route = useRoute<ChatScreenRouteProp>()
  const navigation = useNavigation<ChatScreenNavigationProp>()
  const { type, sessionId, questionId } = route.params

  // Store 状态管理
  const store = useAiGeneralChatStore()
  const userStore = useUserStore()

  // 组件状态
  const [inputMessage, setInputMessage] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false)

  // 引用
  const flatListRef = useRef<FlatList<ChatBubble>>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)

  // 计算属性：会话列表（排序后）
  const sortedSessions = useMemo(() => {
    return [...store.sessions].sort((a, b) => {
      // 置顶会话优先
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      // 按更新时间倒序
      return b.updateTime - a.updateTime
    })
  }, [store.sessions])

  // 初始化：加载会话列表和当前会话
  useEffect(() => {
    const initialize = async () => {
      try {
        // 加载会话列表
        await store.loadSessions()
        
        // 如果有传入 sessionId，切换到该会话
        if (sessionId) {
          await store.switchSession(sessionId)
        } else if (store.sessions.length > 0) {
          // 否则切换到第一个会话（如果有）
          await store.switchSession(store.sessions[0].sessionId)
        }
      } catch (error) {
        console.error('[ChatScreen] 初始化失败:', error)
      }
    }
    
    initialize()
  }, [])

  // 监听消息更新，自动滚动到底部
  useEffect(() => {
    if (store.messages.length > 0) {
      // 延迟一点时间，确保消息已渲染
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [store.messages])

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && store.messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true })
    }
  }, [store.messages.length])

  // 发送消息
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim()) return

    try {
      await store.sendMessage(
        inputMessage.trim(),
        userStore.userInfo,
        userStore.subject,
        selectedModel || 'mate'
      )
      setInputMessage('')
      chatInputRef.current?.clearInputContent()
      // 自动滚动到底部
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    } catch (error) {
      console.error('[ChatScreen] 发送消息失败:', error)
      Alert.alert('发送失败', '请稍后重试')
    }
  }, [inputMessage, store, userStore, scrollToBottom])

  // AI角色选择状态
  const [selectedModel, setSelectedModel] = useState('mate')

  // 联网搜索状态
  const [enableWebSearch, setEnableWebSearch] = useState(false)

  // 会话切换
  const handleSessionSwitch = useCallback(async (sessionId: string) => {
    try {
      // 切换前保存当前会话
      if (store.currentSession) {
        await store.saveChatHistory()
      }
      // 切换到新会话
      await store.switchSession(sessionId)
      // 关闭抽屉
      setIsSessionDrawerOpen(false)
      // 滚动到底部
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    } catch (error) {
      console.error('[ChatScreen] 切换会话失败:', error)
      Alert.alert('切换失败', '请稍后重试')
    }
  }, [store, scrollToBottom])

  // 创建新会话
  const handleCreateSession = useCallback(() => {
    // 创建新会话会在用户发送第一条消息时自动创建
    // 这里只是关闭抽屉，让用户可以输入消息
    setIsSessionDrawerOpen(false)
  }, [])

  // 会话操作回调
  const handleSessionRename = useCallback(async (sessionId: string, newName: string) => {
    try {
      await store.renameSession(sessionId, newName)
    } catch (error) {
      console.error('[ChatScreen] 重命名会话失败:', error)
      Alert.alert('错误', '重命名失败，请重试')
      throw error
    }
  }, [store])

  const handleSessionPin = useCallback(async (sessionId: string) => {
    try {
      await store.togglePin(sessionId)
    } catch (error) {
      console.error('[ChatScreen] 置顶会话失败:', error)
      Alert.alert('错误', '操作失败，请重试')
      throw error
    }
  }, [store])

  const handleSessionDelete = useCallback(async (sessionId: string) => {
    try {
      await store.deleteSession(sessionId)
    } catch (error) {
      console.error('[ChatScreen] 删除会话失败:', error)
      Alert.alert('错误', '删除失败，请重试')
      throw error
    }
  }, [store])

  const handleBatchDelete = useCallback(async (sessionIds: string[]) => {
    try {
      for (const sessionId of sessionIds) {
        await store.deleteSession(sessionId)
      }
    } catch (error) {
      console.error('[ChatScreen] 批量删除会话失败:', error)
      Alert.alert('错误', '批量删除失败，请重试')
      throw error
    }
  }, [store])

  // 处理消息重试
  const handleRetry = useCallback(async (messageId: string) => {
    try {
      await store.retryMessage(
        messageId,
        userStore.userInfo,
        userStore.subject,
        selectedModel
      )
      // 自动滚动到底部
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    } catch (error) {
      console.error('[ChatScreen] 重试消息失败:', error)
      Alert.alert('重试失败', error instanceof Error ? error.message : '请稍后重试')
    }
  }, [store, userStore.userInfo, userStore.subject, selectedModel, scrollToBottom])

  // 渲染消息项
  const renderMessage = useCallback(({ item, index }: { item: ChatBubble; index: number }) => {
    return (
      <ChatMessage
        message={item}
        type={type}
        isSelected={selectedMessages.has(item.id)}
        isSelectionMode={isSelectionMode}
        messageIndex={index}
        onToggleSelection={(messageId) => {
          setSelectedMessages((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(messageId)) {
              newSet.delete(messageId)
            } else {
              newSet.add(messageId)
            }
            return newSet
          })
        }}
        onMessageClick={(message) => {
          // TODO: 实现消息点击逻辑
        }}
        onForwardMessage={(message) => {
          // TODO: 实现转发逻辑
        }}
        onEnterMultiSelect={() => {
          setIsSelectionMode(true)
        }}
        onEditMessage={(message) => {
          // TODO: 实现编辑逻辑
        }}
        onRetry={handleRetry}
      />
    )
  }, [type, selectedMessages, isSelectionMode, handleRetry])

  // 设置导航栏
  useEffect(() => {
    navigation.setOptions({
      title: store.currentSession?.sessionName || '聊天',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => setIsSessionDrawerOpen(true)}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>☰</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleCreateSession}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>+</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation, store.currentSession, handleCreateSession])

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 消息列表 */}
        <FlatList
          ref={flatListRef}
          data={store.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToBottom}
          inverted={false}
          removeClippedSubviews={true}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无消息</Text>
              <Text style={styles.emptyHint}>开始对话吧</Text>
            </View>
          }
        />

        {/* 聊天输入组件 */}
        <ChatInput
          ref={chatInputRef}
          value={inputMessage}
          placeholderText="输入消息..."
          isLoading={store.isChatLoading}
          isRecording={false}
          enableWebSearch={enableWebSearch}
          selectedModel={selectedModel}
          type={type}
          uploadedFiles={[]}
          activeMode={null}
          canSend={!!inputMessage.trim() && !store.isChatLoading}
          onChange={(value) => setInputMessage(value)}
          onSend={handleSendMessage}
          onToggleWebSearch={() => setEnableWebSearch((prev) => !prev)}
          onSelectedModelChange={setSelectedModel}
        />
      </KeyboardAvoidingView>

      {/* 会话列表抽屉 */}
      <SessionDrawer
        visible={isSessionDrawerOpen}
        currentSessionId={store.currentSession?.sessionId}
        onClose={() => setIsSessionDrawerOpen(false)}
        onSessionSwitch={handleSessionSwitch}
        onSessionCreate={handleCreateSession}
        onSessionRename={handleSessionRename}
        onSessionPin={handleSessionPin}
        onSessionDelete={handleSessionDelete}
        onBatchDelete={handleBatchDelete}
      />
    </View>
  )
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageItem: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  streamingIndicator: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#ccc',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  inputText: {
    fontSize: 16,
    color: '#000',
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tempInputContainer: {
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  tempInput: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
    padding: 8,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '75%',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sessionItemActive: {
    backgroundColor: '#e3f2fd',
  },
  sessionContent: {
    flex: 1,
    marginRight: 8,
  },
  sessionName: {
    fontSize: 16,
    color: '#000',
    marginBottom: 4,
  },
  sessionPinned: {
    fontWeight: '600',
  },
  sessionTime: {
    fontSize: 12,
    color: '#999',
  },
  sessionMoreButton: {
    padding: 8,
  },
  sessionMoreText: {
    fontSize: 20,
    color: '#666',
  },
  emptySessionsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptySessionsText: {
    fontSize: 16,
    color: '#999',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 4,
  },
  headerButtonText: {
    fontSize: 20,
    color: '#007AFF',
  },
})

export default ChatScreen

