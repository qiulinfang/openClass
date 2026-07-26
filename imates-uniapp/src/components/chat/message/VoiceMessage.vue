<template>
  <view class="voice-message" :class="{ 'voice-message-user': isUser }">
    <view class="voice-content" @click="togglePlayback">
      <!-- 播放图标按钮 -->
      <view class="voice-play-btn">
        <text class="play-icon">{{ isPlaying ? '⏸️' : '▶️' }}</text>
      </view>

      <!-- 语音波形动画条 (5条动效) -->
      <view class="voice-waveform">
        <view
          v-for="i in 5"
          :key="i"
          class="wave-bar"
          :class="{ 'wave-active': isPlaying }"
          :style="{ animationDelay: `${i * 0.15}s` }"
        />
      </view>

      <!-- 时长展示 (mm:ss) -->
      <view class="voice-duration">
        <text class="duration-text">{{ formattedDuration }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    filePath?: string
    duration?: number
    fileSize?: number
    isUser?: boolean
    voiceData?: {
      filePath?: string
      duration?: number
      fileSize?: number
    }
  }>(),
  {
    duration: 0,
    fileSize: 0,
    isUser: false
  }
)

const isPlaying = ref(false)
const isLoading = ref(false)
let innerAudioContext: any = null

const actualDuration = computed(() => {
  return props.duration || props.voiceData?.duration || 0
})

const actualFilePath = computed(() => {
  return props.filePath || props.voiceData?.filePath || ''
})

const formattedDuration = computed(() => {
  const seconds = actualDuration.value
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

const togglePlayback = () => {
  if (isPlaying.value) {
    stopPlayback()
  } else {
    startPlayback()
  }
}

const startPlayback = () => {
  if (!actualFilePath.value) {
    uni.showToast({ title: '语音播放演示', icon: 'none' })
    isPlaying.value = true
    setTimeout(() => {
      stopPlayback()
    }, (actualDuration.value || 3) * 1000)
    return
  }

  try {
    if (!innerAudioContext) {
      innerAudioContext = uni.createInnerAudioContext()
      innerAudioContext.onEnded(() => {
        stopPlayback()
      })
      innerAudioContext.onError(() => {
        stopPlayback()
        uni.showToast({ title: '播放语音失败', icon: 'none' })
      })
    }
    innerAudioContext.src = actualFilePath.value
    innerAudioContext.play()
    isPlaying.value = true
  } catch (e) {
    stopPlayback()
  }
}

const stopPlayback = () => {
  isPlaying.value = false
  if (innerAudioContext) {
    try {
      innerAudioContext.stop()
    } catch (e) {}
  }
}

onUnmounted(() => {
  if (innerAudioContext) {
    try {
      innerAudioContext.destroy()
    } catch (e) {}
  }
})
</script>

<style lang="scss" scoped>
.voice-message {
  min-width: 140rpx;
  max-width: 320rpx;
}

.voice-content {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  border-radius: 30rpx;
  background: #f1f5f9;
}

.voice-message-user .voice-content {
  background: #6e55ff;
  color: #ffffff;
}

.voice-play-btn {
  flex-shrink: 0;
  .play-icon {
    font-size: 26rpx;
  }
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex: 1;
  height: 32rpx;
  justify-content: center;
}

.wave-bar {
  width: 6rpx;
  height: 16rpx;
  background: #94a3b8;
  border-radius: 3rpx;

  .voice-message-user & {
    background: rgba(255, 255, 255, 0.8);
  }
}

.wave-active {
  animation: wave-pulse 0.8s ease-in-out infinite;
}

@keyframes wave-pulse {
  0%, 100% {
    height: 12rpx;
    opacity: 0.5;
  }
  50% {
    height: 28rpx;
    opacity: 1;
  }
}

.voice-duration {
  font-size: 24rpx;
  color: #64748b;
  font-weight: 500;
  flex-shrink: 0;

  .voice-message-user & {
    color: rgba(255, 255, 255, 0.9);
  }
}
</style>
