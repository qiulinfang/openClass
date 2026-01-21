<template>
  <div
  class="base-checkbox"
    :class="{ 'is-checked': modelValue, 'is-indeterminate': indeterminate }"
    role="checkbox"
    :aria-checked="modelValue"
    tabindex="0"
    @click="toggle"
    @keydown.space.prevent="toggle"
    @keydown.enter.prevent="toggle"
  >
    <span class="base-checkbox__bg">
      <svg v-if="modelValue" class="base-checkbox__check" viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span v-else-if="indeterminate" class="base-checkbox__indet" aria-hidden="true"></span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
const props = defineProps<{
  modelValue: boolean
  indeterminate?: boolean
  size?: 'sm' | 'md'
}>()

const modelValue = toRef(props, 'modelValue')
const indeterminate = toRef(props, 'indeterminate')

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const toggle = () => {
  const next = !modelValue.value
  emit('update:modelValue', next)
}
</script>

<style scoped>
.base-checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  box-sizing: border-box;
  cursor: pointer;
  outline: none;
}
.base-checkbox:focus {
  box-shadow: 0 0 0 4px rgba(122, 124, 255, 0.18);
  border-radius: 8px;
}
.base-checkbox__bg {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: transparent;
}
.base-checkbox.is-checked .base-checkbox__bg,
.base-checkbox.is-indeterminate .base-checkbox__bg {
  background: #6e55ff;
  border-color: transparent;
}
.base-checkbox__check {
  width: 12px;
  height: 12px;
  color: #ffffff;
}
.base-checkbox__indet {
  width: 12px;
  height: 2px;
  background: #ffffff;
  border-radius: 2px;
}
.base-checkbox.is-indeterminate .base-checkbox__indet {
  background: #ffffff;
}
</style>


