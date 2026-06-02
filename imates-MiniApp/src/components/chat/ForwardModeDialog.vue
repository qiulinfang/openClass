<template>
  <Modal
    v-model="show"
    title="选择转发方式"
    :initialWidth="400"
    :initialHeight="500"
    :showFooter="false"
    :closeOnOverlayClick="true"
    @hide="onHide"
  >
    <view class="forward-mode-dialog">
      <!-- 头部区域 (Modal 已经有标题和关闭按钮，这里可以简化) -->
      <view class="dialog-subtitle q-px-md q-pb-md">
        <image src="/icons/chat.svg" style="width: 16px; height: 16px;" class="q-mr-xs" />
        <text>已选择 {{ messageCount }} 条消息</text>
      </view>

      <!-- 选项区域 -->
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
                <view class="option-title">合并转发</view>
              </view>
              <view class="option-check">
                <image 
                  v-if="selectedMode === 'merge'" 
                  src="/icons/check.svg" 
                  style="width: 20px; height: 20px;"
                />
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
                <view class="option-title">逐条转发</view>
              </view>
              <view class="option-check">
                <image 
                  v-if="selectedMode === 'separate'" 
                  src="/icons/check.svg" 
                  style="width: 20px; height: 20px;"
                />
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 附加留言输入区域 -->
      <view v-if="selectedMode" class="additional-message-section">
        <view class="section-divider" />
        <view class="input-section">
          <view class="input-label q-mb-sm">
            <image src="/icons/edit.svg" style="width: 16px; height: 16px;" class="q-mr-xs" />
            <text>附加留言（可选）</text>
          </view>
          <textarea
            v-model="additionalMessage"
            placeholder="添加转发说明..."
            class="message-input"
            maxlength="200"
          />
          <view class="text-right text-grey-6 text-caption q-mt-xs">
            {{ additionalMessage.length }}/200
          </view>
        </view>
      </view>

      <!-- 底部操作按钮 -->
      <view class="dialog-actions q-mt-lg">
        <BaseButton 
          variant="outline"
          class="gemini-secondary-btn q-mr-md"
          @click="onCancel"
        >
          取消
        </BaseButton>
        <BaseButton
          class="gemini-primary-btn"
          @click="onConfirm"
          :disabled="!selectedMode"
        >
          确认转发
        </BaseButton>
      </view>
    </view>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '../base/Modal.vue'
import BaseButton from '../base/Button.vue'

// 导入类型定义
import type { ForwardModeDialogProps } from '../../types'

// 定义Props
interface Props extends ForwardModeDialogProps {}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [mode: 'merge' | 'separate', additionalMessage: string]
}>()

const show = ref(props.modelValue)
const selectedMode = ref<'merge' | 'separate' | null>(null)
const additionalMessage = ref('')

watch(() => props.modelValue, (newValue: boolean) => {
  show.value = newValue
  if (newValue) {
    // 重置状态
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
    onHide()
  }
}

const onCancel = () => {
  onHide()
}

const onHide = () => {
  show.value = false
  emit('update:modelValue', false)
}
</script>

<style scoped>
@import '../../styles/gemini-dialogs.scss';
/* 对话框主容器 - Material Design 3 风格 */
.forward-mode-dialog {
  min-width: 320px;
  max-width: 400px;
  border-radius: 20px;
  box-shadow: 
    0 16px 24px 2px rgba(0, 0, 0, 0.12),
    0 6px 30px 5px rgba(0, 0, 0, 0.08),
    0 8px 10px -5px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  background: #ffffff;
}

/* 头部区域 */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px 12px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.header-content {
  flex: 1;
}

.dialog-title {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.2;
  margin-bottom: 4px;
}

.dialog-subtitle {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #5f6368;
  font-weight: 500;
}

.close-btn {
  color: #5f6368;
  margin-left: 16px;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

/* 选项区域 */
.options-section {
  padding: 8px 20px 12px 20px;
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 选项卡片 */
.option-card {
  border: 2px solid #e8eaed;
  border-radius: 16px;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: #ffffff;
  position: relative;
  overflow: hidden;
}

.option-card:hover {
  border-color: #1a73e8;
  box-shadow: 0 2px 8px rgba(26, 115, 232, 0.12);
  transform: translateY(-1px);
}

.option-card.option-selected {
  border-color: #1a73e8;
  background: linear-gradient(135deg, #e8f0fe 0%, #f8f9fa 100%);
  box-shadow: 0 4px 12px rgba(26, 115, 232, 0.15);
}

.option-card:focus {
  outline: none;
  border-color: #1a73e8;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.12);
}

.option-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  gap: 12px;
}


.option-text {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.option-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.3;
}


.option-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

/* 附加留言区域 */
.additional-message-section {
  padding: 12px 20px;
  background: #fafbfc;
}

.section-divider {
  margin: 0 0 16px 0;
  background: rgba(0, 0, 0, 0.08);
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-label {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.message-input {
  background: #ffffff;
  border-radius: 12px;
}

.message-input :deep(.q-field__control) {
  border-radius: 12px;
  border: 1px solid #e8eaed;
  transition: all 0.2s ease;
}

.message-input :deep(.q-field__control:hover) {
  border-color: #1a73e8;
}

.message-input :deep(.q-field--focused .q-field__control) {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.12);
}

/* 底部操作按钮 */
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 20px 16px 20px;
  background: #ffffff;
}

/* 按钮样式已移至全局Gemini样式 */

/* 响应式设计 */
@media (max-width: 600px) {
  .forward-mode-dialog {
    min-width: 100%;
    max-width: 100%;
    border-radius: 16px;
    margin: 16px;
    max-height: calc(100vh - 32px);
  }
  
  .dialog-header {
    padding: 16px 16px 10px 16px;
  }
  
  .dialog-title {
    font-size: 18px;
  }
  
  .options-section {
    padding: 6px 16px 10px 16px;
  }
  
  .option-content {
    padding: 14px;
    gap: 10px;
  }
  
  .additional-message-section {
    padding: 10px 16px;
  }
  
  .dialog-actions {
    padding: 10px 16px 16px 16px;
    flex-direction: column-reverse;
  }
  
  .cancel-btn,
  .confirm-btn {
    width: 100%;
    justify-content: center;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .forward-mode-dialog {
    background: #1f1f1f;
    box-shadow: 
      0 24px 38px 3px rgba(0, 0, 0, 0.3),
      0 9px 46px 8px rgba(0, 0, 0, 0.2),
      0 11px 15px -7px rgba(0, 0, 0, 0.4);
  }
  
  .dialog-header {
    background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%);
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }
  
  .dialog-title {
    color: #ffffff;
  }
  
  .dialog-subtitle {
    color: #9aa0a6;
  }
  
  .option-card {
    background: #2d2d2d;
    border-color: #3c4043;
  }
  
  .option-card:hover {
    border-color: #4285f4;
  }
  
  .option-card.option-selected {
    background: linear-gradient(135deg, #1a73e8 0%, #2d2d2d 100%);
  }
  
  .option-title {
    color: #ffffff;
  }
  
  .option-description {
    color: #9aa0a6;
  }
  
  .additional-message-section {
    background: #2d2d2d;
  }
  
  .dialog-actions {
    background: #1f1f1f;
  }
}
</style>
