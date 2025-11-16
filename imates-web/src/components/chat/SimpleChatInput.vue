<template>
  <div class="simple-chat-input-wrapper">
    <div class="simple-input-container">
      <input
        ref="inputRef"
        v-model="localInputValue"
        class="simple-chat-input"
        type="text"
        :placeholder="placeholder"
        @keydown.enter.prevent="handleEnter"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <button
        type="button"
        class="simple-send-btn"
        :disabled="!localInputValue.trim() || isLoading"
        @click="handleSend"
      >
        <q-icon 
          :name="isLoading ? 'hourglass_empty' : 'send'" 
          size="18px" 
          color="white" 
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

// Props
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    isLoading?: boolean
  }>(),
  {
    placeholder: '输入你的问题',
    isLoading: false,
  }
)

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: [message: string]
  focus: []
  blur: []
}>()

// 本地输入值
const localInputValue = ref(props.modelValue)
const inputRef = ref<HTMLInputElement>()

// 监听外部值变化
watch(
  () => props.modelValue,
  (newValue) => {
    localInputValue.value = newValue
  }
)

// 监听本地值变化，同步到外部
watch(localInputValue, (newValue) => {
  emit('update:modelValue', newValue)
})

// 处理发送
const handleSend = () => {
  const message = localInputValue.value.trim()
  if (!message || props.isLoading) return
  
  // 先让输入框失焦，关闭键盘
  inputRef.value?.blur()
  
  // 延迟发送消息，等待键盘关闭动画完成
  setTimeout(() => {
    emit('send', message)
    localInputValue.value = ''
  }, 100) // 100ms 延迟，给键盘关闭动画时间
}

// 处理回车
const handleEnter = () => {
  handleSend()
}

// 处理焦点
const handleFocus = () => {
  emit('focus')
}

const handleBlur = () => {
  emit('blur')
}

// 暴露方法给父组件
defineExpose({
  focus: () => {
    inputRef.value?.focus()
  },
  blur: () => {
    inputRef.value?.blur()
  },
})
</script>

<style lang="scss" scoped>
/* 主容器 - 白色背景，紫色边框的圆角矩形（与 ChatInput 一致） */
.simple-chat-input-wrapper {
  background: #ffffff;
  border-radius: 16px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  width: 100%;
  z-index: 1000;
  max-width: 100%;
  box-sizing: border-box;
}

.simple-input-container {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.simple-chat-input {
  flex: 1;
  height: 40px;
  padding: 0 16px;
  border: 2px solid transparent;
  border-radius: 20px;
  background-image: linear-gradient(#fff, #fff), linear-gradient(90deg, #7a7cff, #c072ff);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  font-size: 14px;
  outline: none;
  color: #333;

  &::placeholder {
    color: #999;
  }
}

.simple-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #7A7CFF;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: #6A6CE8;
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
}
</style>
