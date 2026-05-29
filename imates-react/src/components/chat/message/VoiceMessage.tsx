import React, { useState, useEffect } from 'react'
import { androidBridge } from '@/services/business/android-bridge'
import { showMessage } from '@/utils'
import '@/components/chat/message/VoiceMessage.css'

export interface VoiceMessageProps {
  filePath?: string
  duration?: number
  isUser?: boolean
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  filePath = '',
  duration = 0,
  isUser = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const handlePlaybackCompleted = (completedFilePath: string) => {
      if (completedFilePath === filePath) {
        setIsPlaying(false)
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
        const result = androidBridge.stopVoicePlayback()
        if (result.success) {
          setIsPlaying(false)
        }
      } else {
        const result = androidBridge.playVoiceMessage(filePath)
        if (result.success) {
          setIsPlaying(true)
          // Fallback timer if native callback fails
          setTimeout(() => {
            setIsPlaying(false)
          }, duration * 1000 + 500)
        } else {
          showMessage(result.message || '播放失败', 'error')
        }
      }
    } catch (error) {
      showMessage('播放操作失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`voice-message ${isUser ? 'voice-message-user' : ''}`} onClick={togglePlayback}>
      <div className="voice-content">
        <div className="voice-play-btn">
          {isLoading ? (
            <div className="voice-loading-spinner" />
          ) : isPlaying ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
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
