<template>
  <view class="lottie-animation-container">
    <!-- Lottie JSON动画模式 -->
    <view
      v-if="animationData && useLottieMode"
      ref="lottieContainer"
      :style="lottieContainerStyle"
    ></view>

    <!-- 图片序列动画模式 -->
    <view v-else-if="imageSequencePath" class="image-sequence-player">
      <image
        ref="animationImage"
        :src="currentFrameSrc"
        :style="imageStyle"
        mode="aspectFit"
        @load="onImageLoad"
        @error="onImageError"
      />

      <!-- 控制面板（开发模式下显示） -->
      <view v-if="showControls" class="animation-controls">
        <button @click="togglePlayPause" class="control-btn">
          <text>{{ isPlaying ? '暂停' : '播放' }}</text>
        </button>
        <button @click="restart" class="control-btn">重播</button>
        <slider
          :value="currentFrame"
          :min="0"
          :max="frameCount - 1"
          @change="(e) => seekTo(e.detail.value)"
          class="frame-slider"
        />
        <text class="frame-info">{{ currentFrame }}/{{ frameCount - 1 }}</text>
        <view class="speed-control">
          <text>速度:</text>
          <!-- 小程序中没有 select，通常使用 picker -->
          <text>{{ localSpeed }}x</text>
        </view>
      </view>
    </view>

    <!-- 加载状态 -->
    <view v-else-if="loading" class="loading-state">
      <view class="loading-spinner"></view>
      <text>加载动画中...</text>
    </view>

    <!-- 错误状态 -->
    <view v-else class="error-state">
      <text>动画加载失败</text>
      <button @click="retryLoad" class="retry-btn">重试</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import lottie, { AnimationItem } from 'lottie-web'

interface Props {
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
}

interface Emits {
  (e: 'load', data: any): void
  (e: 'error', error: Error): void
  (e: 'complete'): void
  (e: 'frame-change', frame: number): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'update:speed', speed: number): void
}

const props = withDefaults(defineProps<Props>(), {
  frameCount: 121, // 12_0.jpg 到 12_120.jpg 共121帧
  startFrame: 0,
  endFrame: 120,
  frameRate: 30,
  width: 400,
  height: 300,
  loop: true,
  autoplay: true,
  speed: 1,
  showControls: false,
  preloadFrames: 5
})

const emit = defineEmits<Emits>()

// 响应式数据
const animationImage = ref<HTMLImageElement>()
const lottieContainer = ref<HTMLDivElement>()
const lottieAnimation = ref<AnimationItem | null>(null)
const currentFrame = ref(props.startFrame)
const isPlaying = ref(props.autoplay)
const loading = ref(false)
const error = ref<string | null>(null)
const animationInterval = ref<NodeJS.Timeout | null>(null)
const preloadedImages = ref<Map<number, HTMLImageElement>>(new Map())

// 本地状态变量（用于双向绑定）
const localSpeed = ref(props.speed)

// 计算属性
const useLottieMode = computed(() => {
  return !!(props.animationPath || props.animationData)
})

const currentFrameSrc = computed(() => {
  if (!props.imageSequencePath) return ''
  return `${props.imageSequencePath}12_${currentFrame.value}.jpg`
})

const imageStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  objectFit: 'contain' as const,
  display: 'block'
}))

const lottieContainerStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  display: 'block'
}))

const actualFrameRate = computed(() => {
  return props.frameRate * localSpeed.value
})

// Lottie动画事件处理
const initLottieAnimation = () => {
  if (!lottieContainer.value || !props.animationData) return

  // 销毁之前的动画实例
  if (lottieAnimation.value) {
    lottieAnimation.value.destroy()
  }

  try {
    lottieAnimation.value = lottie.loadAnimation({
      container: lottieContainer.value,
      renderer: 'svg',
      loop: props.loop,
      autoplay: props.autoplay,
      animationData: props.animationData,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet'
      }
    })

    // 设置播放速度
    if (lottieAnimation.value) {
      lottieAnimation.value.setSpeed(props.speed)

      // 绑定事件
      lottieAnimation.value.addEventListener('DOMLoaded', () => {
        console.log('Lottie animation DOM loaded')
        emit('load', lottieAnimation.value)
      })

      lottieAnimation.value.addEventListener('complete', () => {
        console.log('Lottie animation completed')
        emit('complete')
      })

      lottieAnimation.value.addEventListener('loopComplete', () => {
        console.log('Lottie animation loop completed')
      })

      lottieAnimation.value.addEventListener('enterFrame', () => {
        const currentFrame = lottieAnimation.value?.currentFrame || 0
        emit('frame-change', Math.floor(currentFrame))
      })
    }
  } catch (error) {
    console.error('Failed to initialize Lottie animation:', error)
    emit('error', error as Error)
  }
}

const onImageLoad = () => {
  loading.value = false
  emit('frame-change', currentFrame.value)
}

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  console.error('Failed to load image:', img.src)
  error.value = `Failed to load frame ${currentFrame.value}`
  emit('error', new Error(`Failed to load frame ${currentFrame.value}`))
}

// 控制方法
const togglePlayPause = () => {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

const play = () => {
  if (isPlaying.value) return
  isPlaying.value = true

  if (useLottieMode.value && lottieAnimation.value) {
    // Lottie 动画播放
    lottieAnimation.value.play()
  } else {
    // 图片序列动画播放
    startAnimation()
  }

  emit('play')
}

const pause = () => {
  if (!isPlaying.value) return
  isPlaying.value = false

  if (useLottieMode.value && lottieAnimation.value) {
    // Lottie 动画暂停
    lottieAnimation.value.pause()
  } else {
    // 图片序列动画暂停
    stopAnimation()
  }

  emit('pause')
}

const restart = () => {
  if (useLottieMode.value && lottieAnimation.value) {
    // Lottie 动画重播
    lottieAnimation.value.goToAndPlay(0)
  } else {
    // 图片序列动画重播
    currentFrame.value = props.startFrame
    if (isPlaying.value) {
      play()
    }
  }
}

const seekToFrame = (event: Event) => {
  const target = event.target as HTMLInputElement
  const frame = parseInt(target.value)
  seekTo(frame)
}

const seekTo = (frame: number) => {
  const clampedFrame = Math.max(props.startFrame, Math.min(props.endFrame, frame))
  currentFrame.value = clampedFrame
  emit('frame-change', clampedFrame)
}

const updateSpeed = () => {
  if (useLottieMode.value && lottieAnimation.value) {
    // Lottie 动画设置速度
    lottieAnimation.value.setSpeed(localSpeed.value)
  } else {
    // 图片序列动画重启以应用新速度
    if (isPlaying.value) {
      stopAnimation()
      startAnimation()
    }
  }
  // 通知父组件速度变化
  emit('update:speed', localSpeed.value)
}

// 动画循环
const startAnimation = () => {
  if (animationInterval.value) return

  const interval = 1000 / actualFrameRate.value
  animationInterval.value = setInterval(() => {
    let nextFrame = currentFrame.value + 1

    // 检查是否到达结束帧
    if (nextFrame > props.endFrame) {
      if (props.loop) {
        nextFrame = props.startFrame
      } else {
        pause()
        emit('complete')
        return
      }
    }

    currentFrame.value = nextFrame

    // 预加载后续帧
    preloadNextFrames(nextFrame)
  }, interval)
}

const stopAnimation = () => {
  if (animationInterval.value) {
    clearInterval(animationInterval.value)
    animationInterval.value = null
  }
}

// 预加载功能
const preloadNextFrames = (startFrame: number) => {
  // 小程序中通常不需要手动 new Image() 预加载，可以通过隐藏的 image 标签或特定 API
}

const preloadAllFrames = async () => {
  if (!props.imageSequencePath) return

  // 小程序中简化预加载逻辑
  loading.value = false
}

const retryLoad = () => {
  error.value = null
  loading.value = true
  nextTick(() => {
    preloadAllFrames()
  })
}

// 生命周期
onMounted(() => {
  if (useLottieMode.value) {
    // 初始化 Lottie 动画
    nextTick(() => {
      initLottieAnimation()
    })
  } else if (props.imageSequencePath) {
    // 预加载所有帧
    preloadAllFrames()

    // 如果自动播放，开始动画
    if (props.autoplay) {
      nextTick(() => {
        startAnimation()
      })
    }
  }
})

onUnmounted(() => {
  // 销毁 Lottie 动画实例
  if (lottieAnimation.value) {
    lottieAnimation.value.destroy()
    lottieAnimation.value = null
  }

  stopAnimation()
  preloadedImages.value.clear()
})

// 监听属性变化
watch(() => props.speed, (newSpeed) => {
  localSpeed.value = newSpeed
  updateSpeed()
})

watch(() => props.autoplay, (newVal) => {
  if (newVal && !isPlaying.value) {
    play()
  } else if (!newVal && isPlaying.value) {
    pause()
  }
})

// 监听 animationData 变化，重新初始化 Lottie 动画
watch(() => props.animationData, (newData) => {
  if (newData && useLottieMode.value) {
    nextTick(() => {
      initLottieAnimation()
    })
  }
})
</script>

<style scoped>
.lottie-animation-container {
  position: relative;
  display: inline-block;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
}

.image-sequence-player {
  position: relative;
}

.image-sequence-player img {
  border-radius: 8px;
}

.animation-controls {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.control-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.control-btn:hover {
  background: #0056b3;
}

.frame-slider {
  flex: 1;
  min-width: 100px;
}

.frame-info {
  font-size: 11px;
  color: #ccc;
  min-width: 50px;
  text-align: center;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.speed-control select {
  background: #333;
  color: white;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 11px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #dc3545;
}

.retry-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.retry-btn:hover {
  background: #c82333;
}
</style>
