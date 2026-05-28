import React, { useState, useEffect, useRef } from 'react'
import './VoiceRecorder.css'

export interface VoiceRecorderProps {
  isRecording?: boolean
  showCancelHint?: boolean
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ 
  isRecording = false, 
  showCancelHint = false 
}) => {
  const [recordingTime, setRecordingTime] = useState(0)
  const timerRef = useRef<number | null>(null)

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0)
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setRecordingTime(0)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRecording])

  return (
    <div className={`voice-recorder ${isRecording ? 'recording' : ''}`}>
      {isRecording && !showCancelHint && (
        <div className="recording-status">
          <div className="recording-animation">
            <div className="pulse-circle"></div>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
            </svg>
          </div>
          <div className="recording-info">
            <div className="recording-text">正在录音...</div>
            <div className="recording-time">{formatTime(recordingTime)}</div>
          </div>
          <div className="recording-hint">
            <div className="hint-text">松开发送，上滑取消</div>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#999">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
            </svg>
          </div>
        </div>
      )}
      
      {showCancelHint && (
        <div className="cancel-hint">
          <img src="/icons/delete.svg" alt="取消录音" width="32" height="32" />
          <div className="cancel-text">松开取消发送</div>
        </div>
      )}
    </div>
  )
}

export default VoiceRecorder
