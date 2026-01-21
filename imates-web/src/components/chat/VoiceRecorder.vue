<template>
  <div class="voice-recorder" :class="{ 'recording': isRecording }">
    <!-- 录音状态显示 -->
    <div v-if="isRecording && !props.showCancelHint" class="recording-status">
      <div class="recording-animation">
        <div class="pulse-circle"></div>
        <q-icon name="mic" size="32px" color="white" />
      </div>
      <div class="recording-info">
        <div class="recording-text">正在录音...</div>
        <div class="recording-time">{{ formatTime(recordingTime) }}</div>
      </div>
      <div class="recording-hint">
        <div class="hint-text">松开发送，上滑取消</div>
        <q-icon name="keyboard_arrow_up" size="18px" color="#999" />
      </div>
    </div>
    
    <!-- 取消录音提示 -->
    <div v-if="props.showCancelHint" class="cancel-hint">
      <img :src="deleteIcon" alt="取消录音" width="32" height="32" />
      <div class="cancel-text">松开取消发送</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

// 导入类型定义
import type { VoiceRecorderProps } from '../../types'

// 导入图标
import deleteIcon from '/icons/delete.svg'

// 定义Props
const props = withDefaults(defineProps<VoiceRecorderProps>(), {
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
watch(() => props.isRecording, (newValue) => {
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
/* 第1步：主容器样式 - 无遮罩层，仅显示内容 */
.voice-recorder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s;
}

/* 第2步：录音状态激活时的样式 */
.voice-recorder.recording {
  opacity: 1;
  visibility: visible;
}

/* 第3步：录音状态容器布局 */
.recording-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  color: #333;
  text-align: center;
  padding: 24px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 第4步：录音动画容器 - 麦克风图标和脉冲效果 */
.recording-animation {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  background: linear-gradient(135deg, #ff4444 0%, #ff6666 100%);
  border-radius: 50%;
  box-shadow: 
    0 8px 32px rgba(255, 68, 68, 0.4),
    0 4px 16px rgba(255, 68, 68, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.2);
  animation: recording-bounce 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 第5步：脉冲圆圈动画效果 */
.pulse-circle {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid rgba(255, 255, 255, 0.4);
  border-radius: 50%;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

/* 第6步：脉冲动画关键帧 */
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    opacity: 0.4;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

/* 第7步：录音信息容器 */
.recording-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* 第8步：录音文字样式 */
.recording-text {
  font-size: 16px;
  font-weight: 500;
  color: #666;
  letter-spacing: 0.5px;
}

/* 第9步：录音时间显示样式 */
.recording-time {
  font-size: 32px;
  font-weight: 700;
  color: #ff4444;
  text-shadow: 0 2px 4px rgba(255, 68, 68, 0.2);
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  min-width: 80px;
}

/* 第10步：录音提示容器 */
.recording-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20px;
  transition: all 0.3s ease;
}

.recording-hint:hover {
  background: rgba(0, 0, 0, 0.06);
}

/* 第11步：提示文字样式 */
.hint-text {
  font-size: 13px;
  color: #999;
  font-weight: 400;
}

/* 第12步：取消提示容器 */
.cancel-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #ff4444;
  text-align: center;
  padding: 24px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  animation: fadeInScale 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 第13步：取消提示图标容器 */
.cancel-hint :deep(.q-icon) {
  width: 48px;
  height: 48px;
  background: rgba(255, 68, 68, 0.15);
  border-radius: 50%;
  padding: 12px;
  animation: shake 0.5s ease-in-out infinite;
}

/* 第14步：取消文字样式 */
.cancel-text {
  font-size: 18px;
  font-weight: 600;
  color: #ff4444;
  letter-spacing: 0.5px;
}

/* 第15步：录音动画进入效果 */
@keyframes recording-bounce {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 第16步：淡入上移动画 */
@keyframes fadeInUp {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 第17步：淡入缩放动画 */
@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 第18步：摇晃动画（用于取消提示） */
@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

/* 第19步：响应式设计 - 平板设备 */
@media (min-width: 769px) and (max-width: 1024px) {
  .recording-animation {
    width: 112px;
    height: 112px;
  }
  
  .recording-time {
    font-size: 36px;
  }
  
  .recording-text {
    font-size: 18px;
  }
  
  .hint-text {
    font-size: 14px;
  }
}

/* 第20步：响应式设计 - 手机设备 */
@media (max-width: 768px) {
  .recording-status {
    gap: 24px;
    padding: 20px;
  }
  
  .recording-animation {
    width: 88px;
    height: 88px;
  }
  
  .recording-time {
    font-size: 28px;
  }
  
  .recording-text {
    font-size: 15px;
  }
  
  .hint-text {
    font-size: 12px;
  }
  
  .cancel-text {
    font-size: 16px;
  }
  
  .cancel-hint {
    gap: 12px;
    padding: 20px;
  }
}

/* 第21步：响应式设计 - 小屏手机 */
@media (max-width: 480px) {
  .recording-animation {
    width: 80px;
    height: 80px;
  }
  
  .recording-time {
    font-size: 24px;
  }
  
  .recording-status {
    gap: 20px;
    padding: 16px;
  }
}
</style>