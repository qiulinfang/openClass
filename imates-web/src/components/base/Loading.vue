<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'Loading'
})

const props = defineProps<{
  text?: string
  size?: number
  theme?: 'dark' | 'light'
  horizontal?: boolean
}>()

const sizePx = computed(() => props.size ?? 48)
</script>

<template>
  <div class="base-loading" :class="[`is-${props.theme ?? 'dark'}`, { 'is-horizontal': horizontal }]" role="status" aria-live="polite">
    <span class="spinner" :style="{ width: `${sizePx}px`, height: `${sizePx}px` }"></span>
    <div v-if="text" class="text">{{ text }}</div>
  </div>
</template>

<style scoped>
.base-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.base-loading.is-horizontal {
  flex-direction: row;
  gap: 8px;
}

.spinner {
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-sizing: border-box;
}

.base-loading.is-dark .spinner {
  border: 3px solid rgba(0, 0, 0, 0.12);
  border-top-color: #6e55ff;
}

.base-loading.is-light .spinner {
  border: 3px solid rgba(255, 255, 255, 0.35);
  border-top-color: rgba(255, 255, 255, 0.95);
}

.text {
  font-size: 16px;
  font-weight: 500;
}

.base-loading:not(.is-horizontal) .text {
  margin-top: 12px;
}

.base-loading.is-dark .text {
  color: #6b7280;
}

.base-loading.is-light .text {
  color: rgba(255, 255, 255, 0.92);
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
