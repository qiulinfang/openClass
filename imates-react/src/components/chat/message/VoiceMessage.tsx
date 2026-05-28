import React, { useState, useRef, useEffect } from 'react'
import './VoiceMessage.css'

export interface VoiceMessageProps {
  audioUrl?: string
  duration?: number
  isUser?: boolean
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  audioUrl = '',
  duration = 0,
  isUser = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`voice-message ${isUser ? 'voice-message-user' : ''}`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <button className="voice-play-btn" onClick={togglePlay}>
        {isPlaying ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
      <div className="voice-waveform">
        <div className="voice-progress" style={{ width: `${progress}%` }}></div>
      </div>
      <span className="voice-duration">{formatDuration(duration)}</span>
    </div>
  )
}

export default VoiceMessage
