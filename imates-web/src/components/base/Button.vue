<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label?: string
  loading?: boolean
  disabled?: boolean
  size?: 'xs' | 'sm' | 'mdCompact' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'expired'
  icon?: string
  iconPosition?: 'left' | 'right'
  type?: 'button' | 'submit' | 'reset'
}>()

const emit = defineEmits<{
  click: [evt: MouseEvent]
}>()

const loading = computed(() => props.loading ?? false)
const disabled = computed(() => props.disabled ?? false)
const iconPos = computed(() => props.iconPosition ?? 'left')

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
  <!-- 只显示图标按钮 (有 icon 属性或 icon 插槽，且没有文字 label 或默认插槽) -->
  <button
    v-if="(icon || $slots.icon) && !label && !$slots.default"
    class="icon-button"
    :type="type || 'button'"
    :disabled="disabled || loading"
    :class="[sizeClass, variantClass, { 'icon-button--disabled': disabled }]"
    @click="handleClick"
  >
    <slot name="icon">
      <img :src="icon" alt="" class="icon-image" />
    </slot>
  </button>
  
  <!-- 普通按钮（支持带图标或不带图标，支持通过 slot 传递内容） -->
  <button
    v-else
    class="common-action-btn"
    :type="type || 'button'"
    :disabled="disabled || loading"
    :class="[
      sizeClass,
      variantClass,
      { 'icon-text-btn': icon || $slots.icon },
      { 'flex-row-reverse': iconPos === 'right' }
    ]"
    @click="handleClick"
  >
    <span v-if="loading" class="spinner"></span>
    <template v-else-if="icon || $slots.icon">
      <slot name="icon">
        <img :src="icon" :alt="label" class="btn-icon" />
      </slot>
    </template>
    <span class="label">
      <slot>{{ label }}</slot>
    </span>
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
  gap: 8px;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  box-shadow: none;
  white-space: nowrap;
}

/* 统一控制插槽中的 SVG，使其大小和颜色跟随按钮文字 */
.common-action-btn :deep(svg),
.icon-button :deep(svg) {
  width: 1.25em;
  height: 1.25em;
  fill: currentColor;
  display: block;
}

.flex-row-reverse {
  flex-direction: row-reverse;
}

.common-action-btn--xs {
  min-width: 60px;
  min-height: 28px;
  font-size: 12px;
  border-radius: 6px;
  padding: 4px 12px;
  gap: 4px;
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
  gap: 6px;
}

.common-action-btn--sm .label {
  font-size: 13px;
}

/* 介于 sm 和默认 md 之间的紧凑尺寸 */
.common-action-btn--mdCompact {
  min-width: 80px;
  min-height: 36px;
  font-size: 15px;
  gap: 6px;
}

.common-action-btn--mdCompact .label {
  font-size: 14px;
}

.common-action-btn--lg {
  min-width: 100px;
  min-height: 44px;
  font-size: 18px;
  gap: 8px;
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

/* 成功/完成按钮样式 */
.common-action-btn--success {
  background-color: #10b981;
  color: #ffffff;
  border: none;
}

.common-action-btn--success:hover:not(:disabled) {
  background-color: #059669;
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

/* 图标+文字按钮样式 */
.icon-text-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-text-btn .btn-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.icon-text-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 图标按钮样式 */
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease, background-color 0.15s ease;
  border-radius: 8px;
  color: inherit;
}

.icon-button:hover:not(.icon-button--disabled):not(:disabled) {
  background-color: rgba(0, 0, 0, 0.05);
  transform: scale(1.05);
}

.icon-button--disabled,
.icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-button--disabled:hover,
.icon-button:disabled:hover {
  opacity: 0.5;
  transform: none;
  background-color: transparent;
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
  padding: 4px;
}

.icon-button.common-action-btn--sm {
  border-radius: 6px;
  height: 32px;
  width: 32px;
  padding: 6px;
}

.icon-button.common-action-btn--md {
  border-radius: 8px;
  height: 44px;
  width: 44px;
  padding: 10px;
}

.icon-button.common-action-btn--lg {
  border-radius: 10px;
  height: 56px;
  width: 56px;
  padding: 14px;
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
