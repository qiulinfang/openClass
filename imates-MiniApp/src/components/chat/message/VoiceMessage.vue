<template>
  <view class="voice-message" :class="{ 'voice-message-user': isUser }">
    <view class="voice-content" @click="togglePlayback">
      <!-- 播放按钮 -->
      <view class="voice-play-btn">
        <BaseButton
          :label="isPlaying ? '‖' : '▶'"
          :variant="isUser ? 'ghost' : 'primary'"
          size="sm"
          :loading="isLoading"
        />
      </view>
      
      <!-- 语音波形动画 -->
      <view class="voice-waveform">
        <view 
          v-for="i in 5" 
          :key="i"
          class="wave-bar"
          :class="{ 'wave-active': isPlaying }"
          :style="{ animationDelay: `${i * 0.1}s` }"
        ></view>
      </view>
      
      <!-- 时长显示 -->
      <view class="voice-duration">
        <text>{{ formatDuration(duration) }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import BaseButton from '../../base/Button.vue'
import { showMessage } from '../../../utils/index.js'

// 导入类型定义
import type { VoiceMessageProps } from '../../../types/index.js'

// 定义Props
interface Props extends VoiceMessageProps {}

const props = withDefaults(defineProps<Props>(), {
  isUser: false
})

const isPlaying = ref(false)
const isLoading = ref(false)

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

let audioContext: any = null

const togglePlayback = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  
  try {
    if (isPlaying.value) {
      if (audioContext) {
        audioContext.stop()
      }
      stopPlayback()
    } else {
      if (!audioContext) {
        audioContext = uni.createInnerAudioContext()
        audioContext.onPlay(() => {
          isPlaying.value = true
          isLoading.value = false
        })
        audioContext.onStop(() => {
          isPlaying.value = false
        })
        audioContext.onEnded(() => {
          isPlaying.value = false
        })
        audioContext.onError((res: any) => {
          console.error(res.errMsg)
          isPlaying.value = false
          isLoading.value = false
          showMessage('播放失败', 'error')
        })
      }
      audioContext.src = props.filePath
      audioContext.play()
    }
  } catch (error) {
    showMessage('播放操作失败', 'error')
    isLoading.value = false
  }
}

const startPlayback = () => {
  isPlaying.value = true
}

const stopPlayback = () => {
  isPlaying.value = false
}

onUnmounted(() => {
  if (audioContext) {
    audioContext.destroy()
    audioContext = null
  }
})
</script>

<style scoped>
.voice-message {
  min-width: 120px;
  max-width: 200px;
  cursor: pointer;
  user-select: none;
}

.voice-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 18px;
  background: #f0f0f0;
  transition: all 0.2s ease;
}

.voice-message-user .voice-content {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.voice-content:hover {
  transform: scale(1.02);
}

.voice-play-btn {
  flex-shrink: 0;
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  height: 20px;
  justify-content: center;
}

.wave-bar {
  width: 3px;
  height: 8px;
  background: #666;
  border-radius: 2px;
  transition: all 0.2s ease;
}

.voice-message-user .wave-bar {
  background: rgba(255, 255, 255, 0.8);
}

.wave-active {
  animation: wave-pulse 1s ease-in-out infinite;
}

@keyframes wave-pulse {
  0%, 100% {
    height: 8px;
    opacity: 0.6;
  }
  50% {
    height: 16px;
    opacity: 1;
  }
}

.voice-duration {
  font-size: 12px;
  color: #666;
  font-weight: 500;
  flex-shrink: 0;
  min-width: 30px;
  text-align: right;
}

.voice-message-user .voice-duration {
  color: rgba(255, 255, 255, 0.9);
}



/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .voice-content {
    background: #3a3a3a;
  }
  
  .wave-bar {
    background: #ccc;
  }
  
  .voice-duration {
    color: #ccc;
  }
}
</style>