<template>
  <button
    class="common-action-btn"
    type="button"
    :disabled="disabled || loading"
    :class="[sizeClass, variantClass]"
    @click="handleClick"
  >
    <span v-if="loading" class="spinner"></span>
    <span class="label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  loading?: boolean
  disabled?: boolean
  size?: 'sm' | 'mdCompact' | 'md' | 'lg'
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'  // 按钮样式变体
}>()

const emit = defineEmits<{
  click: [evt: MouseEvent]
}>()

const loading = computed(() => props.loading ?? false)
const disabled = computed(() => props.disabled ?? false)

const sizeClass = computed(() => {
  const size = props.size || 'md'
  return `common-action-btn--${size}`
})

const variantClass = computed(() => {
  const variant = props.variant || 'primary'
  return `common-action-btn--${variant}`
})

const handleClick = (evt: MouseEvent) => {
  if (loading.value || disabled.value) return
  emit('click', evt)
}
</script>

<style scoped>
.common-action-btn {
  font-size: 16px;
  padding: 6px 16px;
  width: auto;
  min-width: 80px;
  min-height: 40px;
  font-weight: 500;
  border-radius: 12px;
  background-color: #6e55ff;
  color: #ffffff;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  box-shadow: none;
  white-space: nowrap;
}

.common-action-btn--sm {
  padding: 6px 16px;
  min-width: 70px;
  min-height: 32px;
  font-size: 14px;
  border-radius: 8px;
}

.common-action-btn--sm .label {
  font-size: 13px;
}

/* 介于 sm 和默认 md 之间的紧凑尺寸 */
.common-action-btn--mdCompact {
  padding: 5px 14px;
  min-width: 80px;
  min-height: 36px;
  font-size: 15px;
}

.common-action-btn--mdCompact .label {
  font-size: 14px;
}

.common-action-btn--lg {
  padding: 8px 20px;
  min-width: 100px;
  min-height: 44px;
  font-size: 18px;
}

.common-action-btn--lg .label {
  font-size: 16px;
}

.common-action-btn .label {
  font-size: 14px;
}

/* 样式变体 */
.common-action-btn--primary {
  background-color: #6e55ff;
  color: #ffffff;
  border: none;
}

.common-action-btn--primary:hover:not(:disabled) {
  background-color: #5a4abd;
}

.common-action-btn--outline {
  background-color: transparent;
  color: #6e55ff;
  border: 1.5px solid #6e55ff;
}

.common-action-btn--outline:hover:not(:disabled) {
  background-color: rgba(110, 85, 255, 0.08);
}

.common-action-btn--ghost {
  background-color: #f9fafb;
  color: #333333;
  border: 1.5px solid #b0b0b0;
}

.common-action-btn--ghost:hover:not(:disabled) {
  background-color: rgba(0, 0, 0, 0.04);
  border-color: #b0b0b0;
}

/* 危险/删除按钮样式 */
.common-action-btn--danger {
  background-color: #ff6b6b;
  color: #ffffff;
  border: none;
}

.common-action-btn--danger:hover:not(:disabled) {
  background-color: #ee5a5a;
}

.common-action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
