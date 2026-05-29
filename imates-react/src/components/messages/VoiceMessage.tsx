import React, { useState, useRef, useEffect } from 'react'
import '@/components/messages/VoiceMessage.css'

interface VoiceMessageProps {
  filePath: string
  duration: number
  isUser: boolean
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  filePath,
  duration,
  isUser,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
    if (audioRef.current) {
      audioRef.current.currentTime = 0
    }
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`voice-message ${isUser ? 'user' : 'ai'}`}>
      <audio
        ref={audioRef}
        src={filePath}
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
        <div className="voice-progress" style={{ width: `${progress}%` }} />
        <div className="voice-waveform-bars">
          {Array.from({ length: 20 }).map((_, i) => (
            <div 
              key={i} 
              className="waveform-bar"
              style={{ 
                height: `${20 + Math.random() * 60}%`,
                opacity: i / 20 <= progress / 100 ? 1 : 0.3
              }}
            />
          ))}
        </div>
      </div>
      <span className="voice-duration-text">
        {isPlaying ? formatDuration(currentTime) : formatDuration(duration)}
      </span>
    </div>
  )
}

export default VoiceMessage
