import React, { useState, useEffect, useRef } from 'react'
import LottieAnimation, { LottieAnimationRef } from '@/components/display/LottieAnimation'
import './LottieTest.css'

const LottieTest: React.FC = () => {
  const animationRef = useRef<LottieAnimationRef>(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showEmbeddedControls, setShowEmbeddedControls] = useState(true)
  const [selectedJson, setSelectedJson] = useState<any>(null)
  const jsonFileInputRef = useRef<HTMLInputElement>(null)
  const [enablePreload, setEnablePreload] = useState(true)
  const [preloadFrames, setPreloadFrames] = useState(5)
  const [memoryUsage, setMemoryUsage] = useState('计算中...')

  useEffect(() => {
    const updateMemoryUsage = () => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory
        const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024)
        const totalMB = Math.round(memInfo.totalJSHeapSize / 1024 / 1024)
        setMemoryUsage(`${usedMB}MB / ${totalMB}MB`)
      } else {
        setMemoryUsage('不支持')
      }
    }

    const interval = setInterval(updateMemoryUsage, 1000)
    return () => clearInterval(interval)
  }, [])

  const onAnimationLoad = (data: any) => {
    console.log('动画加载完成:', data)
  }

  const onAnimationError = (error: Error) => {
    console.error('动画加载错误:', error)
  }

  const onAnimationComplete = () => {
    console.log('动画播放完成')
  }

  const onFrameChange = (frame: number) => {
    setCurrentFrame(frame)
  }

  const playAnimation = () => {
    animationRef.current?.play()
    setIsPlaying(true)
  }

  const pauseAnimation = () => {
    animationRef.current?.pause()
    setIsPlaying(false)
  }

  const restartAnimation = () => {
    animationRef.current?.restart()
    setIsPlaying(true)
  }

  const onJsonFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      setSelectedJson(JSON.parse(text))
      console.log('Lottie JSON文件加载成功')
    } catch (error) {
      console.error('解析Lottie JSON文件失败:', error)
      setSelectedJson(null)
    }
  }

  return (
    <div className="lottie-test-page">
      <div className="container">
        <h1>Lottie动画测试页面</h1>

        <div className="test-section">
          <h2>图片序列动画测试</h2>
          <p>使用"2秒"文件夹中的121帧图片序列创建动画</p>

          <div className="animation-container">
            <LottieAnimation
              ref={animationRef}
              imageSequencePath="/assets/animations/2秒/"
              frameCount={121}
              frameRate={30}
              width={600}
              height={400}
              loop={true}
              autoplay={true}
              showControls={showEmbeddedControls}
              onLoad={onAnimationLoad}
              onError={onAnimationError}
              onComplete={onAnimationComplete}
              onFrameChange={onFrameChange}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>

          <div className="controls">
            <button onClick={playAnimation} className="btn">播放</button>
            <button onClick={pauseAnimation} className="btn">暂停</button>
            <button onClick={restartAnimation} className="btn">重播</button>
            <button onClick={() => setShowEmbeddedControls(!showEmbeddedControls)} className="btn">
              {showEmbeddedControls ? '隐藏控制面板' : '显示控制面板'}
            </button>
          </div>

          <div className="animation-info">
            <p><strong>当前帧:</strong> {currentFrame}</p>
            <p><strong>动画状态:</strong> {isPlaying ? '播放中' : '已暂停'}</p>
            <p><strong>总帧数:</strong> 121帧 (12_0.jpg - 12_120.jpg)</p>
            <p><strong>帧率:</strong> 30 FPS</p>
          </div>
        </div>

        <div className="test-section">
          <h2>Lottie JSON动画测试</h2>
          <p>如果您有Lottie JSON文件，可以在这里测试</p>

          <div className="json-upload">
            <input
              type="file"
              accept=".json"
              onChange={onJsonFileSelect}
              ref={jsonFileInputRef}
              className="file-input"
            />
            <button onClick={() => jsonFileInputRef.current?.click()} className="btn">选择Lottie JSON文件</button>
          </div>

          {selectedJson && (
            <div className="animation-container">
              <LottieAnimation
                animationData={selectedJson}
                width={400}
                height={300}
                loop={true}
                autoplay={false}
              />
            </div>
          )}
        </div>

        <div className="test-section">
          <h2>性能测试</h2>
          <div className="performance-controls">
            <label>
              <input 
                type="checkbox" 
                checked={enablePreload} 
                onChange={(e) => setEnablePreload(e.target.checked)} 
              />
              启用预加载 ({preloadFrames}帧)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={preloadFrames}
              onChange={(e) => setPreloadFrames(parseInt(e.target.value))}
            />
            <span>{preloadFrames}帧</span>
          </div>

          <div className="performance-info">
            <p><strong>预加载状态:</strong> {enablePreload ? '已启用' : '已禁用'}</p>
            <p><strong>内存使用:</strong> {memoryUsage}</p>
          </div>
        </div>

        <div className="test-section">
          <h2>使用示例代码</h2>
          <div className="code-example">
            <pre><code>{`// 基本使用
<LottieAnimation
  imageSequencePath="/assets/animations/2秒/"
  frameCount={121}
  frameRate={30}
  width={400}
  height={300}
  loop={true}
  autoplay={true}
/>

// 带控制面板
<LottieAnimation
  imageSequencePath="/assets/animations/2秒/"
  frameCount={121}
  showControls={true}
  width={600}
  height={400}
/>`}</code></pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LottieTest
