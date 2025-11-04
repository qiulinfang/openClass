/**
 * VoiceMessage - 语音消息组件（React Native 版本）
 * 显示和播放语音消息，支持播放控制、波形动画和时长显示
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native'
// TODO: 根据项目使用的音频库导入
// import { Audio } from 'expo-av'
// 或使用 react-native-sound
// import Sound from 'react-native-sound'

export interface VoiceMessageProps {
  filePath: string // 语音文件路径
  duration: number // 语音时长（秒）
  isUser?: boolean // 是否为用户消息
}

const VoiceMessage: React.FC<VoiceMessageProps> = ({
  filePath,
  duration,
  isUser = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const waveformAnimations = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.6))
  ).current

  // 格式化时长
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 启动波形动画
  const startWaveformAnimation = () => {
    const animations = waveformAnimations.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            delay: index * 100,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.6,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      )
    })

    Animated.parallel(animations).start()
  }

  // 停止波形动画
  const stopWaveformAnimation = () => {
    waveformAnimations.forEach((anim) => {
      anim.stopAnimation()
      anim.setValue(0.6)
    })
  }

  // 播放/暂停切换
  const togglePlayback = async () => {
    if (isLoading) return

    setIsLoading(true)

    try {
      if (isPlaying) {
        // 停止播放
        await stopPlayback()
      } else {
        // 开始播放
        await startPlayback()
      }
    } catch (error) {
      console.error('[VoiceMessage] 播放操作失败:', error)
      // TODO: 显示错误提示
    } finally {
      setIsLoading(false)
    }
  }

  // 开始播放
  const startPlayback = async () => {
    try {
      // TODO: 使用实际的音频库实现
      // 示例：使用 expo-av
      // const { sound } = await Audio.Sound.createAsync(
      //   { uri: filePath },
      //   { shouldPlay: true }
      // )
      // await sound.playAsync()

      // 临时实现：直接设置播放状态
      setIsPlaying(true)
      startWaveformAnimation()

      // 设置播放完成的定时器
      setTimeout(() => {
        if (isPlaying) {
          stopPlayback()
        }
      }, duration * 1000)
    } catch (error) {
      console.error('[VoiceMessage] 播放失败:', error)
      throw error
    }
  }

  // 停止播放
  const stopPlayback = async () => {
    try {
      // TODO: 使用实际的音频库实现
      // 示例：使用 expo-av
      // await sound.stopAsync()

      setIsPlaying(false)
      stopWaveformAnimation()
    } catch (error) {
      console.error('[VoiceMessage] 停止播放失败:', error)
      throw error
    }
  }

  // 组件卸载时停止播放
  useEffect(() => {
    return () => {
      stopPlayback()
    }
  }, [])

  return (
    <View style={[styles.container, isUser && styles.containerUser]}>
      <TouchableOpacity
        style={[styles.voiceContent, isUser && styles.voiceContentUser]}
        onPress={togglePlayback}
        activeOpacity={0.8}
      >
        {/* 播放按钮 */}
        <View style={styles.playButton}>
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={isUser ? '#1976d2' : '#fff'}
            />
          ) : (
            <Text style={[styles.playIcon, isUser && styles.playIconUser]}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          )}
        </View>

        {/* 语音波形动画 */}
        <View style={styles.waveform}>
          {waveformAnimations.map((anim, index) => {
            const height = anim.interpolate({
              inputRange: [0.6, 1],
              outputRange: [8, 16],
            })

            return (
              <Animated.View
                key={index}
                style={[
                  styles.waveBar,
                  isUser && styles.waveBarUser,
                  { height },
                  { opacity: isPlaying ? anim : 0.6 },
                ]}
              />
            )
          })}
        </View>

        {/* 时长显示 */}
        <Text style={[styles.duration, isUser && styles.durationUser]}>
          {formatDuration(duration)}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minWidth: 120,
    maxWidth: 200,
  },
  containerUser: {
    // 用户消息样式
  },
  voiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
  },
  voiceContentUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 14,
    color: '#fff',
  },
  playIconUser: {
    color: '#fff',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  waveBar: {
    width: 3,
    height: 8,
    backgroundColor: '#666',
    borderRadius: 2,
  },
  waveBarUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  duration: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'right',
  },
  durationUser: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
})

export default VoiceMessage
