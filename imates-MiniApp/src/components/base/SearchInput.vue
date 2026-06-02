<template>
  <view class="search-input-wrapper" :class="{ 'is-active': active || isFocused }">
    <!-- 前置插槽 -->
    <view v-if="$slots.prepend" class="input-prepend">
      <slot name="prepend"></slot>
    </view>

    <!-- 输入框 -->
    <input
      class="search-input"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled || readonly"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @confirm="handleEnter"
    />

    <!-- 后置插槽 -->
    <view v-if="$slots.append" class="input-append">
      <slot name="append"></slot>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  modelValue?: string
  placeholder?: string
  readonly?: boolean
  disabled?: boolean
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  readonly: false,
  disabled: false,
  active: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'focus': [event: FocusEvent]
  'blur': [event: FocusEvent]
  'enter': [event: KeyboardEvent]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)

const handleInput = (event: any) => {
  emit('update:modelValue', event.detail.value)
}

const handleFocus = (event: any) => {
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event: any) => {
  isFocused.value = false
  emit('blur', event)
}

const handleEnter = (event: any) => {
  emit('enter', event)
}

// 暴露方法供父组件调用
defineExpose({
})
</script>

<style lang="scss" scoped>
.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  background-color: #ffffff;
  border-radius: 10px;
  transition: all 0.2s ease;
  border: 1px solid #D4D1DD;

  &.is-active {
    border-color: #7b6dff;
  }

  .input-prepend,
  .input-append {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: #999;
  }
 
  .search-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: #333;
    line-height: 1.5;
    height: 1.5;

    &::placeholder {
      color: #999;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    &:read-only {
      cursor: default;
    }
  }
}
</style>
