import React, { useState, useEffect } from 'react'
import { androidBridge } from '@/services/business/android-bridge'
import '@/components/messages/VoiceMessage.css'

interface VoiceMessageProps {
  filePath: string
  duration: number
  isUser?: boolean
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  filePath,
  duration,
  isUser = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const togglePlayback = async () => {
    if (isLoading) return
    setIsLoading(true)

    try {
      if (isPlaying) {
        // 停止播放
        const result = androidBridge.stopVoicePlayback()
        if (result.success) {
          stopPlayback()
        }
      } else {
        // 开始播放
        const result = androidBridge.playVoiceMessage(filePath)
        if (result.success) {
          startPlayback()
        }
      }
    } catch (error) {
      console.error('播放操作失败', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startPlayback = () => {
    setIsPlaying(true)
    // 设置播放完成的定时器
    setTimeout(() => {
      setIsPlaying((prev) => {
        if (prev) {
          stopPlayback()
        }
        return false
      })
    }, duration * 1000)
  }

  const stopPlayback = () => {
    setIsPlaying(false)
  }

  useEffect(() => {
    // 监听Android端的播放完成事件
    const handlePlaybackCompleted = (completedFilePath: string) => {
      if (completedFilePath === filePath) {
        stopPlayback()
      }
    }

    if (typeof window !== 'undefined') {
      (window as any).onVoicePlaybackCompleted = handlePlaybackCompleted
    }

    return () => {
      if (typeof window !== 'undefined') {
        (window as any).onVoicePlaybackCompleted = undefined
      }
    }
  }, [filePath])

  return (
    <div className={`voice-message ${isUser ? 'voice-message-user' : ''}`}>
      <div className="voice-content" onClick={togglePlayback}>
        <div className="voice-play-btn">
          <button className={`play-btn ${isUser ? 'user' : 'ai'}`}>
            {isLoading ? (
              <div className="btn-loading" />
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
        </div>
        
        <div className="voice-waveform">
          {[1, 2, 3, 4, 5].map((i) => (
            <div 
              key={i}
              className={`wave-bar ${isPlaying ? 'wave-active' : ''}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        
        <div className="voice-duration">
          {formatDuration(duration)}
        </div>
      </div>
    </div>
  )
}

export default VoiceMessage
