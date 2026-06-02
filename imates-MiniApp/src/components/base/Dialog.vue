<template>
  <view v-if="modelValue || internalVisible" class="dialog-root" @click="handleBackdropClick">
    <view class="dialog-overlay"></view>
    <view class="dialog-inner-content" @click.stop>
      <view class="dialog-header">
        <text class="dialog-title">
          {{ title }}
        </text>
        <button @click="closeDialog" class="dialog-close-top" aria-label="关闭">
          <text class="close-icon">✕</text>
        </button>
      </view>

      <view class="dialog-content-text">
        <slot> </slot>
      </view>

      <view class="dialog-actions">
        <Button
          :label="cancelButtonText"
          size="mdCompact"
          variant="ghost"
          @click="handleCancel"
        />
        <Button
          :label="confirmButtonText"
          size="mdCompact"
          variant="primary"
          @click="handleConfirm"
        />
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, defineProps, defineEmits, defineExpose, watch } from 'vue'
import Button from './Button.vue'

// 定义组件属性
const props = defineProps({
  title: {
    type: String,
    default: '操作确认',
  },
  confirmButtonText: {
    type: String,
    default: '确认执行',
  },
  cancelButtonText: {
    type: String,
    default: '取消',
  },
  modelValue: {
    type: Boolean,
    default: false,
  },
})

// 定义组件事件
const emit = defineEmits(['confirm', 'cancel', 'update:modelValue'])

const internalVisible = ref(false)

/**
 * 打开对话框
 */
const openDialog = () => {
  internalVisible.value = true
  emit('update:modelValue', true)
}

/**
 * 关闭对话框
 */
const closeDialog = () => {
  internalVisible.value = false
  emit('update:modelValue', false)
}

const handleConfirm = () => {
  emit('confirm')
  closeDialog()
}

const handleCancel = () => {
  emit('cancel')
  closeDialog()
}

/**
 * 点击背景关闭对话框
 */
const handleBackdropClick = () => {
  closeDialog()
}

// 监听 modelValue 变化，控制对话框显示/隐藏
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      openDialog()
    } else {
      closeDialog()
    }
  }
)

// 暴露打开和关闭方法，以便父组件可以控制对话框
defineExpose({
  openDialog,
  closeDialog,
})
</script>

<style scoped>
/* ---------------------------------- */
/* 1. 对话框基础和动画样式 */
/* ---------------------------------- */
.dialog-root {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
}

.dialog-inner-content {
  position: relative;
  border-radius: 1rem;
  width: 80%;
  max-width: 400px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  background-color: white;
  padding: 2rem;
  z-index: 1;
  animation: fadeIn 0.3s ease-out;
}
@media (min-width: 768px) {
  .dialog-inner-content {
    padding: 2rem;
  }
}

/* 头部 */
.dialog-header {
  display: flex;
  justify-content: space-between;
  /* 标题和关闭按钮在一行左右两侧，垂直居中 */
  align-items: center;
  margin-bottom: 1rem;
}

/* 标题 */
.dialog-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1f2937;
}

/* 顶部关闭按钮 */
.dialog-close-top {
  color: #9ca3af;
  padding: 0.25rem;
  border-radius: 9999px;
  transition: color 0.15s, background-color 0.15s;
  border: none;
  background: none;
  cursor: pointer;
}
.dialog-close-top:hover {
  color: #4b5563;
  background-color: #f3f4f6;
}

/* SVG图标尺寸 */
.icon-close {
  width: 1.25rem;
  height: 1.25rem;
}

/* 内容文本 */
.dialog-content-text {
  color: #4b5563;
  margin-bottom: 1.5rem;
}

/* 动作按钮容器 */
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>