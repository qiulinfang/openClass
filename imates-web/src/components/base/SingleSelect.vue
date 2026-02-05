<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  options: string[]
  vertical?: boolean
  className?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const handleSelect = (opt: string) => {
  if (opt === props.modelValue) return
  emit('update:modelValue', opt)
}
</script>

<template>
  <div
    class="single-select"
    :class="[
      { 'single-select--vertical': vertical },
      className,
    ]"
  >
    <button
      v-for="opt in options"
      :key="opt"
      class="single-select__option"
      :class="{ 'is-active': modelValue === opt }"
      type="button"
      @click="handleSelect(opt)"
    >
      {{ opt }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.single-select {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}

.single-select--vertical {
  flex-direction: column;
}

.single-select__option {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1.5px solid #7e68ff;
  background: #f6f5ff;
  color: #6e55ff;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s ease;
}

.single-select__option:hover {
  border-color: #6e55ff;
}

.single-select__option.is-active {
  border-color: #6e55ff;
  background: #6e55ff;
  color: #ffffff;
}
</style>
