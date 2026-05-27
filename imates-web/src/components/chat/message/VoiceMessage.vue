<template>
  <div class="voice-message" :class="{ 'voice-message-user': isUser }">
    <div class="voice-content" @click="togglePlayback">
      <!-- 播放按钮 -->
      <div class="voice-play-btn">
        <q-btn
          round
          :icon="isPlaying ? 'pause' : 'play_arrow'"
          :color="isUser ? 'white' : 'primary'"
          :text-color="isUser ? 'primary' : 'white'"
          size="sm"
          flat
          :loading="isLoading"
        />
      </div>
      
      <!-- 语音波形动画 -->
      <div class="voice-waveform">
        <div 
          v-for="i in 5" 
          :key="i"
          class="wave-bar"
          :class="{ 'wave-active': isPlaying }"
          :style="{ animationDelay: `${i * 0.1}s` }"
        ></div>
      </div>
      
      <!-- 时长显示 -->
      <div class="voice-duration">
        {{ formatDuration(duration) }}
      </div>
    </div>
    

  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { androidBridge } from '../../../services/business/android-bridge'
import { showMessage } from '../../../utils'

// 导入类型定义
import type { VoiceMessageProps } from '../../../types'

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

const togglePlayback = async () => {
  if (isLoading.value) return
  
  
  isLoading.value = true
  
  try {
    if (isPlaying.value) {
      // 停止播放
      const result = androidBridge.stopVoicePlayback()
      if (result.success) {
        stopPlayback()
      } else {
      }
    } else {
      // 开始播放
      const result = androidBridge.playVoiceMessage(props.filePath)
      if (result.success) {
        startPlayback()
      } else {
        showMessage(result.message || '播放失败', 'error')
      }
    }
  } catch (error) {
    showMessage('播放操作失败', 'error')
  } finally {
    isLoading.value = false
  }
}

const startPlayback = () => {
  
  isPlaying.value = true
  
  // 设置播放完成的定时器
  setTimeout(() => {
    if (isPlaying.value) {
      stopPlayback()
    }
  }, props.duration * 1000) // 按照音频时长
}

const stopPlayback = () => {
  isPlaying.value = false
}

// 监听Android端的播放完成事件
const handlePlaybackCompleted = (filePath: string) => {
  if (filePath === props.filePath && isPlaying.value) {
    stopPlayback()
  }
}

// 注册全局回调
if (typeof window !== 'undefined') {
  ;(window as any).onVoicePlaybackCompleted = handlePlaybackCompleted
}

onUnmounted(() => {
  // 清理全局回调
  if (typeof window !== 'undefined') {
    ;(window as any).onVoicePlaybackCompleted = undefined
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