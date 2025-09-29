<template>
  <div class="voice-recorder" :class="{ 'recording': isRecording }">
    <!-- 录音状态显示 -->
    <div v-if="isRecording" class="recording-status">
      <div class="recording-animation">
        <div class="pulse-circle"></div>
        <q-icon name="mic" size="24px" color="white" />
      </div>
      <div class="recording-info">
        <div class="recording-text">正在录音...</div>
        <div class="recording-time">{{ formatTime(recordingTime) }}</div>
      </div>
      <div class="recording-hint">
        <div class="hint-text">松开发送，上滑取消</div>
        <q-icon name="keyboard_arrow_up" size="16px" />
      </div>
    </div>
    
    <!-- 取消录音提示 -->
    <div v-if="props.showCancelHint" class="cancel-hint">
      <q-icon name="delete" size="24px" color="red" />
      <div class="cancel-text">松开取消发送</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

// 导入类型定义
import type { VoiceRecorderProps } from '../../types'

// 定义Props
interface Props extends VoiceRecorderProps {}

const props = withDefaults(defineProps<Props>(), {
  showCancelHint: false
})

const recordingTime = ref(0)
let recordingTimer: number | null = null

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const startTimer = () => {
  recordingTime.value = 0
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  recordingTimer = window.setInterval(() => {
    recordingTime.value++
  }, 1000)
}

const stopTimer = () => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  recordingTime.value = 0
}

// 监听录音状态变化
watch(() => props.isRecording, (newValue, oldValue) => {
  if (newValue) {
    startTimer()
  } else {
    stopTimer()
  }
}, { immediate: true })

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.voice-recorder {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
}

.voice-recorder.recording {
  opacity: 1;
  visibility: visible;
}

.recording-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  color: white;
  text-align: center;
}

.recording-animation {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: #ff4444;
  border-radius: 50%;
  box-shadow: 0 4px 20px rgba(255, 68, 68, 0.4);
}

.pulse-circle {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.recording-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recording-text {
  font-size: 18px;
  font-weight: 500;
}

.recording-time {
  font-size: 24px;
  font-weight: bold;
  color: #ff4444;
}

.recording-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.8;
}

.hint-text {
  font-size: 14px;
}

.cancel-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #ff4444;
  text-align: center;
}

.cancel-text {
  font-size: 16px;
  font-weight: 500;
}

/* 动画效果 */
.voice-recorder.recording .recording-animation {
  animation: recording-bounce 0.3s ease-out;
}

@keyframes recording-bounce {
  0% {
    transform: scale(0.8);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
</style>