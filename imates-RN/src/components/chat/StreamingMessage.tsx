/**
 * StreamingMessage - 流式消息组件（React Native 版本）
 * 显示流式消息和打字机效果，支持实时流式更新和打字机动画
 */

import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import Markdown from 'react-native-markdown-display'
import { renderMessageContent } from '../../utils/render/markdownRenderer'

export interface StreamingMessageProps {
  content: string // 消息内容
  isStreaming?: boolean // 是否为流式模式
  typewriterSpeed?: number // 打字机速度（毫秒）
  onComplete?: () => void // 打字机完成回调
  onProgress?: (progress: number) => void // 进度回调
}

const DEFAULT_TYPEWRITER_SPEED = 30

const StreamingMessage: React.FC<StreamingMessageProps> = ({
  content,
  isStreaming = false,
  typewriterSpeed = DEFAULT_TYPEWRITER_SPEED,
  onComplete,
  onProgress,
}) => {
  const [displayedLength, setDisplayedLength] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorOpacity = useRef(new Animated.Value(1)).current

  // 光标闪烁动画
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    )

    if (isTyping || isStreaming) {
      animation.start()
    } else {
      animation.stop()
      cursorOpacity.setValue(1)
    }

    return () => {
      animation.stop()
    }
  }, [isTyping, isStreaming])

  // 开始打字机效果
  const startTypewriter = () => {
    if (isStreaming || content.length === 0) {
      return
    }

    setIsTyping(true)
    setDisplayedLength(0)

    const typeNextChar = () => {
      if (displayedLength < content.length) {
        const newLength = displayedLength + 1
        setDisplayedLength(newLength)

        const progress = (newLength / content.length) * 100
        onProgress?.(progress)

        typingTimerRef.current = setTimeout(typeNextChar, typewriterSpeed)
      } else {
        setIsTyping(false)
        onComplete?.()
      }
    }

    typeNextChar()
  }

  // 停止打字机效果
  const stopTypewriter = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = null
    }
    setIsTyping(false)
    setDisplayedLength(content.length)
  }

  // 监听内容变化
  useEffect(() => {
    if (isStreaming) {
      // 流式模式：直接显示完整内容
      stopTypewriter()
      setDisplayedLength(content.length)
      return
    }

    // 非流式模式：重新开始打字机效果
    stopTypewriter()
    if (content.length > 0) {
      startTypewriter()
    }

    return () => {
      stopTypewriter()
    }
  }, [content, isStreaming])

  // 监听流式状态变化
  useEffect(() => {
    if (!isStreaming && content.length > 0) {
      // 流式结束，开始打字机效果
      startTypewriter()
    } else if (isStreaming) {
      // 开始流式，停止打字机效果
      stopTypewriter()
      setDisplayedLength(content.length)
    }
  }, [isStreaming])

  // 计算显示的内容（用于打字机效果）
  const displayedContent = isStreaming
    ? content
    : content.substring(0, displayedLength)

  // 渲染内容（预处理）
  const renderedContent = renderMessageContent(displayedContent)

  // 渲染完整内容（用于流式模式）
  const fullRenderedContent = renderMessageContent(content)

  return (
    <View style={styles.container}>
      <View style={styles.messageContent}>
        {isStreaming ? (
          // 流式模式：直接显示内容
          <View>
            <Markdown style={markdownStyles}>{fullRenderedContent}</Markdown>
            <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>
              ▊
            </Animated.Text>
          </View>
        ) : (
          // 非流式模式：打字机效果
          <View>
            <Markdown style={markdownStyles}>{renderedContent}</Markdown>
            {isTyping && (
              <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>
                |
              </Animated.Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  messageContent: {
    flex: 1,
    flexWrap: 'wrap',
  },
  cursor: {
    color: '#1976d2',
    fontWeight: 'bold',
    fontSize: 14,
    lineHeight: 16,
  },
})

// Markdown 样式配置
const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 0,
  },
})

export default StreamingMessage
