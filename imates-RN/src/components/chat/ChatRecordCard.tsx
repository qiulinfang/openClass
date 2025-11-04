/**
 * ChatRecordCard - 聊天记录卡片组件（React Native 版本）
 * 显示聊天记录的折叠/展开卡片，包含消息预览和统计信息
 */

import React, { useState, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import type { ChatRecordCardProps } from '../../types/chat'
import type { ChatBubble } from '../../types/chat'

const ChatRecordCard: React.FC<ChatRecordCardProps> = ({
  messages,
  additionalMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // 计算消息数量
  const messageCount = useMemo(() => messages.length, [messages.length])
  
  // 切换展开/折叠状态
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }
  
  // 获取消息预览文本
  const getMessagePreview = (message: ChatBubble): string => {
    if (message.messageType === 'voice') {
      return '[语音消息]'
    } else if (message.messageType === 'image') {
      return '[图片消息]'
    } else if (message.messageType === 'chat_record') {
      return '[聊天记录]'
    } else {
      // 文本消息，截取前50个字符
      const content = message.content || ''
      return content.length > 50 ? content.substring(0, 50) + '...' : content
    }
  }
  
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={toggleExpanded}
      activeOpacity={0.7}
    >
      {/* 卡片头部 */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.iconText}>💬</Text>
          <Text style={styles.headerTitle}>聊天记录</Text>
          <View style={styles.messageCountBadge}>
            <Text style={styles.messageCountText}>{messageCount}条消息</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.expandIcon}>
            {isExpanded ? '▲' : '▼'}
          </Text>
        </View>
      </View>

      {/* 展开的内容 */}
      {isExpanded && (
        <View style={styles.cardContent}>
          <ScrollView 
            style={styles.messagesPreview}
            nestedScrollEnabled={true}
          >
            {messages.map((message) => (
              <View key={message.id} style={styles.previewMessage}>
                <View style={styles.previewAvatar}>
                  <Text style={styles.avatarText}>👤</Text>
                </View>
                <View style={styles.previewContent}>
                  <Text style={styles.previewSender}>我</Text>
                  <Text style={styles.previewText}>
                    {getMessagePreview(message)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 附加消息 */}
      {additionalMessage && (
        <View style={styles.additionalMessage}>
          <Text style={styles.additionalIcon}>📝</Text>
          <Text style={styles.additionalText}>{additionalMessage}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    maxWidth: '80%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconText: {
    fontSize: 20,
  },
  headerTitle: {
    fontWeight: '500',
    color: '#2c3e50',
    fontSize: 14,
  },
  messageCountBadge: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  messageCountText: {
    fontSize: 12,
    color: '#6c757d',
  },
  headerRight: {
    alignItems: 'center',
  },
  expandIcon: {
    fontSize: 16,
    color: '#6c757d',
  },
  cardContent: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 8,
  },
  messagesPreview: {
    maxHeight: 200,
  },
  previewMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  previewAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
  },
  previewContent: {
    flex: 1,
    minWidth: 0,
  },
  previewSender: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6c757d',
    marginBottom: 2,
  },
  previewText: {
    fontSize: 13,
    color: '#2c3e50',
    lineHeight: 18,
  },
  additionalMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 6,
    paddingLeft: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2196f3',
  },
  additionalIcon: {
    fontSize: 16,
  },
  additionalText: {
    fontSize: 13,
    color: '#2c3e50',
    fontStyle: 'italic',
    flex: 1,
  },
})

export default ChatRecordCard

