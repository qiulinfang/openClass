import React, { useState, useRef, useCallback, useEffect } from 'react'
import './VoiceInput.css'

interface VoiceInputProps {
  onResult?: (text: string) => void
  onStart?: () => void
  onEnd?: () => void
  language?: string
  continuous?: boolean
}

// 简化类型声明
interface AnyFunction {
  (): void
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: AnyFunction | null
  onresult: AnyFunction | null
  onerror: AnyFunction | null
  onend: AnyFunction | null
  start: AnyFunction
  stop: AnyFunction
  abort: AnyFunction
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onResult,
  onStart,
  onEnd,
  language = 'zh-CN',
  continuous = false,
}) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition() as SpeechRecognitionInstance
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.lang = language

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
      onStart?.()
    }

    recognition.onresult = ((event: any) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript)
        onResult?.(finalTranscript)
      } else {
        setTranscript(interimTranscript)
      }
    }) as any

    recognition.onerror = ((event: any) => {
      setError(event.error)
      setIsListening(false)
      onEnd?.()
    }) as any

    recognition.onend = () => {
      setIsListening(false)
      onEnd?.()
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [language, continuous, onResult, onStart, onEnd])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return
    
    setTranscript('')
    setError(null)
    
    try {
      recognitionRef.current.start()
    } catch (err) {
      console.error('语音识别启动失败:', err)
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return
    recognitionRef.current.stop()
  }, [isListening])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const clearTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  if (!isSupported) {
    return (
      <div className="voice-input-unsupported">
        您的浏览器不支持语音识别
      </div>
    )
  }

  return (
    <div className="voice-input">
      <button
        type="button"
        className={`voice-input-btn ${isListening ? 'listening' : ''}`}
        onClick={toggleListening}
        title={isListening ? '停止录音' : '开始录音'}
      >
        {isListening ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M6 6h12v12H6z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        )}
      </button>

      {isListening && (
        <div className="voice-input-wave">
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
        </div>
      )}

      {transcript && !isListening && (
        <div className="voice-input-result">
          <span>{transcript}</span>
          <button type="button" onClick={clearTranscript} className="clear-btn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="voice-input-error">
          识别错误: {error}
        </div>
      )}
    </div>
  )
}

export default VoiceInput
