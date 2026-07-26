<template>
  <view v-if="show" class="forward-mask" @click="onCancel">
    <view class="forward-mode-dialog" @click.stop>
      <!-- 头部区域 -->
      <view class="dialog-header">
        <view class="header-content">
          <text class="dialog-title">选择转发方式</text>
          <text class="dialog-subtitle">💬 已选择 {{ messageCount }} 条消息</text>
        </view>
        <text class="close-btn" @click="onCancel">✕</text>
      </view>

      <!-- 选项区域（合并转发 / 逐条转发） -->
      <view class="options-section">
        <view class="options-container">
          <!-- 合并转发 -->
          <view
            class="option-card"
            :class="{ 'option-selected': selectedMode === 'merge' }"
            @click="selectMode('merge')"
          >
            <view class="option-content">
              <view class="option-text">
                <text class="option-title">合并转发</text>
              </view>
              <view class="option-check">
                <text v-if="selectedMode === 'merge'" class="check-icon">✓</text>
              </view>
            </view>
          </view>

          <!-- 逐条转发 -->
          <view
            class="option-card"
            :class="{ 'option-selected': selectedMode === 'separate' }"
            @click="selectMode('separate')"
          >
            <view class="option-content">
              <view class="option-text">
                <text class="option-title">逐条转发</text>
              </view>
              <view class="option-check">
                <text v-if="selectedMode === 'separate'" class="check-icon">✓</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 附加留言输入区域 -->
      <view v-if="selectedMode" class="additional-message-section">
        <view class="input-section">
          <text class="input-label">✏️ 附加留言（可选）</text>
          <textarea
            v-model="additionalMessage"
            placeholder="添加转发说明..."
            class="message-input"
            maxlength="200"
          />
          <text class="count-tip">{{ additionalMessage.length }}/200</text>
        </view>
      </view>

      <!-- 底部操作按钮 -->
      <view class="dialog-actions">
        <button class="gemini-secondary-btn" @click="onCancel">取消</button>
        <button
          class="gemini-primary-btn"
          :class="{ disabled: !selectedMode }"
          :disabled="!selectedMode"
          @click="onConfirm"
        >
          确认转发
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  modelValue?: boolean
  visible?: boolean
  messageCount?: number
  selectedCount?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'confirm', mode: 'merge' | 'separate', additionalMessage: string): void
  (e: 'forward', target: 'ai' | 'teacher'): void
}>()

const show = ref(props.modelValue || props.visible || false)
const selectedMode = ref<'merge' | 'separate' | null>(null)
const additionalMessage = ref('')

const count = computed(() => props.messageCount ?? props.selectedCount ?? 0)

watch(() => props.modelValue || props.visible, (newValue) => {
  show.value = !!newValue
  if (newValue) {
    selectedMode.value = null
    additionalMessage.value = ''
  }
})

const selectMode = (mode: 'merge' | 'separate') => {
  selectedMode.value = mode
}

const onConfirm = () => {
  if (selectedMode.value) {
    emit('confirm', selectedMode.value, additionalMessage.value)
    emit('forward', 'ai')
    onHide()
  }
}

const onCancel = () => {
  onHide()
}

const onHide = () => {
  show.value = false
  emit('update:modelValue', false)
  emit('close')
}
</script>

<style lang="scss" scoped>
.forward-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.forward-mode-dialog {
  width: 600rpx;
  background-color: #ffffff;
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: 0 16rpx 32rpx rgba(0, 0, 0, 0.12);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 28rpx 32rpx 20rpx;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.header-content {
  flex: 1;
}

.dialog-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1a1a;
  display: block;
  margin-bottom: 6rpx;
}

.dialog-subtitle {
  font-size: 24rpx;
  color: #5f6368;
}

.close-btn {
  font-size: 32rpx;
  color: #5f6368;
  padding: 0 10rpx;
}

.options-section {
  padding: 20rpx 32rpx;
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.option-card {
  border: 2px solid #e8eaed;
  border-radius: 20rpx;
  padding: 20rpx;
  background: #ffffff;
  transition: all 0.2s ease;

  &.option-selected {
    border-color: #6e55ff;
    background: linear-gradient(135deg, #eef2ff 0%, #f8f9fa 100%);
  }
}

.option-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.option-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.check-icon {
  font-size: 32rpx;
  color: #6e55ff;
  font-weight: bold;
}

.additional-message-section {
  padding: 16rpx 32rpx;
  background: #fafbfc;
  border-top: 1px solid #e8eaed;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.input-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.message-input {
  width: 100%;
  height: 120rpx;
  background: #ffffff;
  border: 1px solid #e8eaed;
  border-radius: 16rpx;
  padding: 12rpx;
  font-size: 26rpx;
  color: #1a1a1a;
  box-sizing: border-box;
}

.count-tip {
  font-size: 20rpx;
  color: #9ca3af;
  text-align: right;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  padding: 20rpx 32rpx 28rpx;
  background: #ffffff;

  button {
    height: 72rpx;
    line-height: 72rpx;
    padding: 0 32rpx;
    border-radius: 36rpx;
    font-size: 26rpx;
    margin: 0;
  }
}

.gemini-secondary-btn {
  background: #f1f5f9;
  color: #64748b;
}

.gemini-primary-btn {
  background: #6e55ff;
  color: #ffffff;

  &.disabled {
    background: #cbd5e1;
    color: #94a3b8;
  }
}
</style>
