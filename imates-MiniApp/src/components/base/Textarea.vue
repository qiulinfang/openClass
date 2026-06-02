<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <view class="auto-height-textarea-container">
    <textarea
      auto-height
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="auto-height-textarea"
      @input="handleInput"
      @focus="$emit('focus', $event)"
      @blur="$emit('blur', $event)"
    />

    <button
      v-if="showActionButton"
      :class="['auto-action-btn', actionButtonClass]"
      :disabled="actionButtonDisabled || actionButtonLoading"
      @click="$emit('action-click', $event)"
    >
      <image :src="searchIcon" mode="aspectFit" class="action-icon" />
      <slot name="action-button"></slot>
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import searchIcon from '/icons/search.svg'

interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  maxlength?: number
  minHeight?: number
  maxHeight?: number
  showActionButton?: boolean
  actionButtonClass?: string
  actionButtonColor?: string
  actionButtonLoading?: boolean
  actionButtonDisabled?: boolean
  actionButtonRound?: boolean
  actionButtonSize?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'input', event: Event): void
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
  (e: 'action-click', event: Event): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  readonly: false,
  minHeight: 44,
  maxHeight: 120,
  showActionButton: false,
  actionButtonClass: '',
  actionButtonColor: 'primary',
  actionButtonLoading: false,
  actionButtonDisabled: false,
  actionButtonRound: true,
  actionButtonSize: ''
})

const emit = defineEmits<Emits>()

const handleInput = (event: any) => {
  const value = event.detail.value

  emit('update:modelValue', value)
  emit('input', event)
}

// 监听 modelValue 变化，调整高度
watch(() => props.modelValue, () => {
}, { immediate: true })

onMounted(() => {
})
</script>

<style scoped>
.auto-height-textarea-container {
  position: relative;
  width: 100%;
}

.auto-height-textarea {
  width: 100%;
  min-height: v-bind('props.minHeight + "px"');
  max-height: v-bind('props.maxHeight + "px"');
  padding: 12px 60px 12px 12px;
  border: 1px solid #7a7cff;
  border-radius: 16px;
  background: white;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  resize: none;
  overflow-y: auto;
  transition: all 0.2s ease;
  box-sizing: border-box;
  outline: none;
}

.auto-height-textarea:focus {
  border-color: #5a5cd8;
  box-shadow: 0 4px 16px rgba(122, 124, 255, 0.25), 0 2px 4px rgba(122, 124, 255, 0.15);
}

.auto-height-textarea::placeholder {
  color: #999;
  font-size: 14px;
}

.auto-height-textarea:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

/* Action button styles */
.auto-height-textarea-container :deep(.q-btn) {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  z-index: 10;
}

/* Native action button styling (replaces q-btn) */
.auto-height-textarea-container .auto-action-btn {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.auto-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  width: 40px;
  height: 40px;
  display: block;
  object-fit: contain;
}
</style>
