<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  loading?: boolean
  disabled?: boolean
  size?: 'xs' | 'sm' | 'mdCompact' | 'md' | 'lg'
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'expired'  // 按钮样式变体
  icon?: string  // 图标路径，如果提供则显示图标而不是文字
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

<template>
  <!-- 如果有图标，直接显示图片，保持点击事件 -->
  <div
    v-if="icon"
    class="icon-button"
    :class="[sizeClass, { 'icon-button--disabled': disabled }]"
    @click="handleClick"
  >
    <img :src="icon" :alt="label" class="icon-image" />
  </div>
  <!-- 否则显示普通按钮 -->
  <button
    v-else
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

.common-action-btn--xs {
  min-width: 60px;
  min-height: 28px;
  font-size: 12px;
  border-radius: 6px;
  padding: 4px 12px;
}

.common-action-btn--xs .label {
  font-size: 12px;
}

.common-action-btn--xs .spinner {
  width: 12px;
  height: 12px;
}

.common-action-btn--sm {
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
  min-width: 80px;
  min-height: 36px;
  font-size: 15px;
}

.common-action-btn--mdCompact .label {
  font-size: 14px;
}

.common-action-btn--lg {
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

.common-action-btn--expired {
  background-color: #d1d5db;
  color: #ffffff;
  border: none;
  box-shadow: none;
  border-radius: 12px;
}

.common-action-btn--expired:hover:not(:disabled) {
  background-color: #c5cbd3;
}

.common-action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.common-action-btn--expired:disabled {
  opacity: 1;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  animation: spin 0.8s linear infinite;
}

/* 图标按钮样式 */
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
  border-radius: 8px;
}

.icon-button:hover:not(.icon-button--disabled) {
  opacity: 0.8;
  transform: scale(1.05);
}

.icon-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-button--disabled:hover {
  opacity: 0.5;
  transform: none;
}

.icon-image {
  display: block;
  object-fit: contain;
  height: 100%;
}

/* 不同尺寸的图标按钮 */
.icon-button.common-action-btn--xs {
  border-radius: 4px;
  height: 28px;
  width: 28px;
}

.icon-button.common-action-btn--sm {
  border-radius: 6px;
  height: 32px;
}

.icon-button.common-action-btn--md {
  border-radius: 8px;
  height: 66px;
}

.icon-button.common-action-btn--lg {
  border-radius: 10px;
  height: 56px;
}

/* 图标按钮样式 */
.common-action-btn--icon {
  padding: 6px;
  min-width: 32px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.button-icon {
  width: 16px;
  height: 16px;
  display: block;
  object-fit: contain;
}

/* 小尺寸图标按钮 */
.common-action-btn--xs.common-action-btn--icon {
  min-width: 24px;
  width: 24px;
  height: 24px;
  padding: 3px;
}

.common-action-btn--xs .button-icon {
  width: 12px;
  height: 12px;
}

.common-action-btn--sm.common-action-btn--icon {
  min-width: 28px;
  width: 28px;
  height: 28px;
  padding: 4px;
}

.common-action-btn--sm .button-icon {
  width: 14px;
  height: 14px;
}

/* 大尺寸图标按钮 */
.common-action-btn--lg.common-action-btn--icon {
  min-width: 40px;
  width: 40px;
  height: 40px;
  padding: 8px;
}

.common-action-btn--lg .button-icon {
  width: 20px;
  height: 20px;
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
