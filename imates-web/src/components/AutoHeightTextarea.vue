<template>
  <div class="auto-height-textarea-container">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      class="auto-height-textarea"
      @input="handleInput"
      @keydown="handleKeydown"
      @focus="$emit('focus', $event)"
      @blur="$emit('blur', $event)"
    />

    <q-btn
      v-if="showActionButton"
      :class="actionButtonClass"
      :color="actionButtonColor"
      :icon="actionButtonIcon"
      :loading="actionButtonLoading"
      :disable="actionButtonDisabled"
      :round="actionButtonRound"
      :size="actionButtonSize"
      @click="$emit('action-click', $event)"
    >
      <slot name="action-button"></slot>
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'

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
  actionButtonIcon?: string
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
  actionButtonIcon: '',
  actionButtonLoading: false,
  actionButtonDisabled: false,
  actionButtonRound: true,
  actionButtonSize: ''
})

const emit = defineEmits<Emits>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  const value = target.value

  emit('update:modelValue', value)
  emit('input', event)

  // 自动调整高度
  adjustHeight()
}

const handleKeydown = (event: KeyboardEvent) => {
  emit('keydown', event)
}

const adjustHeight = () => {
  if (!textareaRef.value) return

  const textarea = textareaRef.value

  // 重置高度以获取正确的 scrollHeight
  textarea.style.height = 'auto'

  // 计算新的高度
  const scrollHeight = textarea.scrollHeight
  const newHeight = Math.min(Math.max(scrollHeight, props.minHeight), props.maxHeight)

  textarea.style.height = `${newHeight}px`
}

// 监听 modelValue 变化，调整高度
watch(() => props.modelValue, () => {
  nextTick(() => {
    adjustHeight()
  })
}, { immediate: true })

onMounted(() => {
  adjustHeight()
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
</style>
