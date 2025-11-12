/**
 * ChatMessage - 聊天消息组件
 * 负责消息渲染和交互操作（复制、转发、编辑、多选、重试等）
 */

import React, { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import Markdown from 'react-native-markdown-display'
import * as Clipboard from '@react-native-community/clipboard'
import { renderMessageContent as preprocessMessageContent } from '../../utils/render/markdownRenderer'
import VoiceMessage from './VoiceMessage'
import ImageMessage from './ImageMessage'
import StreamingMessage from './StreamingMessage'
import ChatRecordCard from './ChatRecordCard'
import type { ChatMessageProps } from '../../types/chat'

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  type,
  isSelected = false,
  isSelectionMode = false,
  messageIndex = 0,
  onToggleSelection,
  onMessageClick,
  onForwardMessage,
  onEnterMultiSelect,
  onEditMessage,
  onRetry,
}) => {
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // 判断是否可以转发（仅在AI通用、AI题目和AI教材对话场景下可用）
  const canForward = useMemo(() => {
    return type === 'ai-general' || type === 'ai-exercise' || type === 'ai-textbook'
  }, [type])

  // 判断是否可以编辑（第一个消息不能编辑）
  const canEdit = useMemo(() => {
    return message.sender === 'user' && messageIndex !== 0
  }, [message.sender, messageIndex])

  // 头像图标
  const avatarIcon = useMemo(() => {
    if (type === 'ai-general' || type === 'ai-exercise' || type === 'ai-textbook') {
      return '🤖'
    } else {
      return '👨‍🏫'
    }
  }, [type])

  // 处理点击
  const handlePress = useCallback(() => {
    if (isSelectionMode) {
      onToggleSelection?.(message.id)
    } else {
      onMessageClick?.(message)
    }
  }, [isSelectionMode, message, onToggleSelection, onMessageClick])

  // 处理长按
  const handleLongPress = useCallback(() => {
    if (!isSelectionMode) {
      setShowActionMenu(true)
      // 显示操作菜单（使用 Alert 暂时替代）
      Alert.alert(
        '消息操作',
        message.content.substring(0, 50) + '...',
        [
          {
            text: '复制',
            onPress: handleCopy,
          },
          canEdit && {
            text: '编辑',
            onPress: () => {
              onEditMessage?.(message)
              setShowActionMenu(false)
            },
          },
          canForward && {
            text: '转发',
            onPress: () => {
              onForwardMessage?.(message)
              setShowActionMenu(false)
            },
          },
          {
            text: '多选',
            onPress: () => {
              onEnterMultiSelect?.()
              setShowActionMenu(false)
            },
          },
          {
            text: '取消',
            style: 'cancel',
            onPress: () => setShowActionMenu(false),
          },
        ].filter(Boolean) as any
      )
    }
  }, [isSelectionMode, message, canEdit, canForward, onEditMessage, onForwardMessage, onEnterMultiSelect])

  // 复制消息
  const handleCopy = useCallback(async () => {
    try {
      let textContent = ''
      
      if (message.messageType === 'voice') {
        textContent = '[语音消息]'
      } else if (message.messageType === 'image') {
        textContent = '[图片消息]'
      } else if (message.messageType === 'chat_record') {
        textContent = '[聊天记录]'
      } else {
        textContent = message.content
        // 移除 Markdown 格式标记（简化处理）
        textContent = textContent
          .replace(/\*\*(.*?)\*\*/g, '$1') // 粗体
          .replace(/\*(.*?)\*/g, '$1') // 斜体
          .replace(/`(.*?)`/g, '$1') // 代码
      }
      
      await Clipboard.setString(textContent)
      Alert.alert('成功', '已复制到剪贴板')
      setShowActionMenu(false)
    } catch (error) {
      console.error('复制失败:', error)
      Alert.alert('错误', '复制失败')
    }
  }, [message])

  // 处理重试
  const handleRetry = useCallback(async () => {
    if (!message.canRetry || isRetrying || !onRetry) {
      return
    }

    try {
      setIsRetrying(true)
      await onRetry(message.id)
      Alert.alert('成功', '正在重新生成消息')
    } catch (error) {
      console.error('重试失败:', error)
      Alert.alert('错误', '重试失败，请稍后重试')
    } finally {
      setIsRetrying(false)
    }
  }, [message, isRetrying, onRetry])

  // 渲染消息内容
  const renderMessageContent = useCallback(() => {
    // 语音消息
    if (message.messageType === 'voice' && message.voiceData) {
      return (
        <VoiceMessage
          filePath={message.voiceData.filePath}
          duration={message.voiceData.duration / 1000}
          isUser={message.sender === 'user'}
        />
      )
    }

    // 图片消息（只显示图片，文字已拆分为独立消息）
    if (message.messageType === 'image' && message.imageData && message.imageData.base64DataUrl) {
      return (
        <ImageMessage
          base64DataUrl={message.imageData.base64DataUrl}
          width={message.imageData.width}
          height={message.imageData.height}
          fileSize={message.imageData.fileSize}
          isUser={message.sender === 'user'}
          showInfo={true}
        />
      )
    }

    // 聊天记录卡片
    if (message.messageType === 'chat_record' && message.chatRecordData) {
      return (
        <ChatRecordCard
          messages={message.chatRecordData.messages}
          additionalMessage={message.chatRecordData.additionalMessage}
        />
      )
    }

    // 文本消息
    if (message.isStreaming) {
      return (
        <StreamingMessage
          content={message.content}
          isStreaming={true}
          typewriterSpeed={30}
        />
      )
    }

    // 错误消息
    if (message.isError) {
      const renderedContent = preprocessMessageContent(message.content)
      return (
        <View style={styles.errorMessageWrapper}>
          <Markdown style={markdownStyles}>{renderedContent}</Markdown>
          {message.retryCount !== undefined && message.retryCount > 0 && (
            <Text style={styles.retryCount}>
              {message.retryCount}/3
            </Text>
          )}
        </View>
      )
    }

    // 普通文本消息
    const renderedContent = preprocessMessageContent(message.content)
    return (
      <View style={styles.messageText}>
        <Markdown style={markdownStyles}>{renderedContent}</Markdown>
      </View>
    )
  }, [message])

  // 用户消息布局
  if (message.sender === 'user') {
    return (
      <TouchableOpacity
        style={[
          styles.messageItem,
          isSelected && styles.messageSelected,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
      >
        {/* 选择模式下的复选框 */}
        {isSelectionMode && (
          <View style={styles.checkbox}>
            <Text style={styles.checkboxText}>
              {isSelected ? '✓' : '○'}
            </Text>
          </View>
        )}

        <View style={[styles.messageContent, styles.userMessageContent]}>
          <View style={[styles.messageBubble, styles.userBubble]}>
            {renderMessageContent()}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // AI/老师消息布局
  return (
    <TouchableOpacity
      style={[
        styles.messageItem,
        isSelected && styles.messageSelected,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      {/* 选择模式下的复选框 */}
      {isSelectionMode && (
        <View style={styles.checkbox}>
          <Text style={styles.checkboxText}>
            {isSelected ? '✓' : '○'}
          </Text>
        </View>
      )}

      {/* AI 头像 */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatarIcon}</Text>
      </View>

      <View style={[styles.messageContent, styles.aiMessageContent]}>
        <View style={[styles.messageBubble, styles.aiBubble]}>
          {renderMessageContent()}
        </View>
        
        {/* 错误消息重试按钮 */}
        {message.isError && message.canRetry && (
          <TouchableOpacity
            style={[styles.retryButton, isRetrying && styles.retryButtonLoading]}
            onPress={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <Text style={styles.retryButtonText}>重试中...</Text>
            ) : (
              <Text style={styles.retryButtonText}>重试</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  messageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  messageSelected: {
    backgroundColor: 'rgba(25, 118, 210, 0.08)',
    borderRadius: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  checkboxText: {
    fontSize: 16,
    color: '#007AFF',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  avatarText: {
    fontSize: 20,
  },
  messageContent: {
    flex: 1,
    maxWidth: '80%',
  },
  userMessageContent: {
    alignItems: 'flex-end',
  },
  aiMessageContent: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: '#7A7CFF',
  },
  aiBubble: {
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000',
  },
  streamingIndicator: {
    fontSize: 14,
    color: '#666',
  },
  voiceMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  imageMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  chatRecordMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  retryButtonLoading: {
    opacity: 0.6,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#6c757d',
  },
  errorMessageWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryCount: {
    fontSize: 12,
    color: '#999',
  },
})

// Markdown 样式配置
const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 0,
  },
})

export default ChatMessage

