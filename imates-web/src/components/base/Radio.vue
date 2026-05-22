<template>
  <div
    class="base-radio"
    :class="{ 'is-checked': checked, 'is-disabled': disabled }"
    @click="handleClick"
  >
    <div class="base-radio__input">
      <span class="base-radio__inner"></span>
    </div>
    <span class="base-radio__label" v-if="$slots.default || label">
      <slot>{{ label }}</slot>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: any
  val: any
  label?: string
  disabled?: boolean
  color?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'change': [value: any]
}>()

const checked = computed(() => props.modelValue === props.val)

const handleClick = () => {
  if (props.disabled || checked.value) return
  emit('update:modelValue', props.val)
  emit('change', props.val)
}
</script>

<style scoped lang="scss">
.base-radio {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  margin-right: 16px;
  outline: none;

  &.is-disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &__input {
    display: inline-block;
    line-height: 1;
    position: relative;
    vertical-align: middle;
  }

  &__inner {
    border: 3px solid #e5e6eb;
    border-radius: 50%;
    width: 26px;
    height: 26px;
    background-color: #fff;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    transition: all 0.2s ease;

    &::after {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #babcc6;
      content: "";
      transition: all 0.2s ease-in-out;
    }
  }

  &.is-checked {
    .base-radio__inner {
      border-color: #cdccff;
      background-color: #fff;

      &::after {
        background-color: #614dff;
      }
    }
    
    .base-radio__label {
      color: #1e293b;
      font-weight: 600;
    }
  }

  &__label {
    font-size: 18px;
    padding-left: 12px;
    color: #334155;
    transition: color 0.2s ease;
    line-height: 1;
  }

  &:hover:not(.is-disabled):not(.is-checked) {
    .base-radio__inner {
      border-color: #94a3b8;
    }
  }
}
</style>
