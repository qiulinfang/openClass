import React, { useState, useEffect, useRef, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react'
// @ts-ignore
import lottie, { AnimationItem } from 'lottie-web'
import './LottieAnimation.css'

export interface LottieAnimationProps {
  // Lottie JSON模式
  animationPath?: string // Lottie JSON文件路径
  animationData?: any // 直接传入的动画数据

  // 图片序列模式
  imageSequencePath?: string // 图片序列文件夹路径，如 '/assets/animations/2秒/'
  frameCount?: number // 图片序列帧数
  startFrame?: number // 开始帧
  endFrame?: number // 结束帧

  // 通用配置
  width?: number | string
  height?: number | string
  frameRate?: number // 帧率，默认30fps
  loop?: boolean
  autoplay?: boolean
  speed?: number // 播放速度倍数

  // 调试和控制
  showControls?: boolean // 显示控制面板
  preloadFrames?: number // 预加载帧数

  // 事件
  onLoad?: (data: any) => void
  onError?: (error: Error) => void
  onComplete?: () => void
  onFrameChange?: (frame: number) => void
  onPlay?: () => void
  onPause?: () => void
}

export interface LottieAnimationRef {
  play: () => void
  pause: () => void
  restart: () => void
  seekTo: (frame: number) => void
}

const LottieAnimation = forwardRef<LottieAnimationRef, LottieAnimationProps>((props, ref) => {
  const {
    frameCount = 121,
    startFrame = 0,
    endFrame = 120,
    frameRate = 30,
    width = 400,
    height = 300,
    loop = true,
    autoplay = true,
    speed = 1,
    showControls = false,
    preloadFrames = 5,
    onLoad,
    onError,
    onComplete,
    onFrameChange,
    onPlay,
    onPause
  } = props

  const lottieContainerRef = useRef<HTMLDivElement>(null)
  const lottieAnimationRef = useRef<AnimationItem | null>(null)
  const [currentFrame, setCurrentFrame] = useState(startFrame)
  const [isPlaying, setIsPlaying] = useState(autoplay)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const animationIntervalRef = useRef<any>(null)
  const preloadedImagesRef = useRef<Map<number, HTMLImageElement>>(new Map())
  const [localSpeed, setLocalSpeed] = useState(speed)

  const useLottieMode = !!(props.animationPath || props.animationData)

  const currentFrameSrc = useMemo(() => {
    if (!props.imageSequencePath) return ''
    return `${props.imageSequencePath}12_${currentFrame}.jpg`
  }, [props.imageSequencePath, currentFrame])

  const containerStyle = useMemo(() => ({
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  }), [width, height])

  const imageStyle = useMemo(() => ({
    ...containerStyle,
    objectFit: 'contain' as const,
    display: 'block'
  }), [containerStyle])

  const actualFrameRate = frameRate * localSpeed

  const stopAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current)
      animationIntervalRef.current = null
    }
  }, [])

  const startAnimation = useCallback(() => {
    if (animationIntervalRef.current) return

    const interval = 1000 / actualFrameRate
    animationIntervalRef.current = setInterval(() => {
      setCurrentFrame(prevFrame => {
        let nextFrame = prevFrame + 1
        if (nextFrame > endFrame) {
          if (loop) {
            nextFrame = startFrame
          } else {
            stopAnimation()
            setIsPlaying(false)
            onComplete?.()
            return prevFrame
          }
        }
        onFrameChange?.(nextFrame)
        return nextFrame
      })
    }, interval)
  }, [actualFrameRate, endFrame, loop, startFrame, stopAnimation, onComplete, onFrameChange])

  const play = useCallback(() => {
    if (isPlaying) return
    setIsPlaying(true)

    if (useLottieMode && lottieAnimationRef.current) {
      lottieAnimationRef.current.play()
    } else {
      startAnimation()
    }
    onPlay?.()
  }, [isPlaying, useLottieMode, startAnimation, onPlay])

  const pause = useCallback(() => {
    if (!isPlaying) return
    setIsPlaying(false)

    if (useLottieMode && lottieAnimationRef.current) {
      lottieAnimationRef.current.pause()
    } else {
      stopAnimation()
    }
    onPause?.()
  }, [isPlaying, useLottieMode, stopAnimation, onPause])

  const restart = useCallback(() => {
    if (useLottieMode && lottieAnimationRef.current) {
      lottieAnimationRef.current.goToAndPlay(0)
    } else {
      setCurrentFrame(startFrame)
      if (isPlaying) {
        // Already playing, setCurrentFrame will trigger the next step in interval
      } else {
        play()
      }
    }
  }, [useLottieMode, startFrame, isPlaying, play])

  const seekTo = useCallback((frame: number) => {
    const clampedFrame = Math.max(startFrame, Math.min(endFrame, frame))
    setCurrentFrame(clampedFrame)
    onFrameChange?.(clampedFrame)
  }, [startFrame, endFrame, onFrameChange])

  useImperativeHandle(ref, () => ({
    play,
    pause,
    restart,
    seekTo
  }))

  const initLottieAnimation = useCallback(() => {
    if (!lottieContainerRef.current || !props.animationData) return

    if (lottieAnimationRef.current) {
      lottieAnimationRef.current.destroy()
    }

    try {
      lottieAnimationRef.current = lottie.loadAnimation({
        container: lottieContainerRef.current,
        renderer: 'svg',
        loop: loop,
        autoplay: autoplay,
        animationData: props.animationData,
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet'
        }
      })

      if (lottieAnimationRef.current) {
        lottieAnimationRef.current.setSpeed(localSpeed)

        lottieAnimationRef.current.addEventListener('DOMLoaded', () => {
          onLoad?.(lottieAnimationRef.current)
        })

        lottieAnimationRef.current.addEventListener('complete', () => {
          onComplete?.()
        })

        lottieAnimationRef.current.addEventListener('enterFrame', () => {
          const frame = lottieAnimationRef.current?.currentFrame || 0
          onFrameChange?.(Math.floor(frame))
        })
      }
    } catch (err) {
      console.error('Failed to initialize Lottie animation:', err)
      onError?.(err as Error)
    }
  }, [props.animationData, loop, autoplay, localSpeed, onLoad, onComplete, onFrameChange, onError])

  useEffect(() => {
    if (useLottieMode) {
      initLottieAnimation()
    } else if (props.imageSequencePath) {
      if (autoplay) {
        startAnimation()
      }
    }

    return () => {
      if (lottieAnimationRef.current) {
        lottieAnimationRef.current.destroy()
        lottieAnimationRef.current = null
      }
      stopAnimation()
    }
  }, [useLottieMode, initLottieAnimation, props.imageSequencePath, autoplay, startAnimation, stopAnimation])

  useEffect(() => {
    setLocalSpeed(speed)
  }, [speed])

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseInt(e.target.value))
  }

  return (
    <div className="lottie-animation-container" style={containerStyle}>
      {useLottieMode ? (
        <div ref={lottieContainerRef} style={containerStyle}></div>
      ) : props.imageSequencePath ? (
        <div className="image-sequence-player">
          <img
            src={currentFrameSrc}
            style={imageStyle}
            alt={`animation frame ${currentFrame}`}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError(`Failed to load frame ${currentFrame}`)
              onError?.(new Error(`Failed to load frame ${currentFrame}`))
            }}
          />

          {showControls && (
            <div className="animation-controls">
              <button onClick={() => isPlaying ? pause() : play()} className="control-btn">
                {isPlaying ? '暂停' : '播放'}
              </button>
              <button onClick={restart} className="control-btn">重播</button>
              <input
                type="range"
                min={startFrame}
                max={endFrame}
                value={currentFrame}
                onChange={handleSeekChange}
                className="frame-slider"
              />
              <span className="frame-info">{currentFrame}/{endFrame}</span>
              <div className="speed-control">
                <label>速度:</label>
                <select 
                  value={localSpeed} 
                  onChange={(e) => {
                    const newSpeed = parseFloat(e.target.value)
                    setLocalSpeed(newSpeed)
                  }}
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </div>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>加载动画中...</p>
        </div>
      ) : (
        <div className="error-state">
          <p>{error || '动画加载失败'}</p>
        </div>
      )}
    </div>
  )
})

LottieAnimation.displayName = 'LottieAnimation'

export default LottieAnimation
