<script setup lang="ts">
const props = defineProps<{
  modelValue: string[]
  options: string[]
  vertical?: boolean
  className?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const handleSelect = (opt: string) => {
  const set = new Set(props.modelValue)
  if (set.has(opt)) {
    set.delete(opt)
  } else {
    set.add(opt)
  }
  emit('update:modelValue', Array.from(set))
}
</script>

<template>
  <div
    class="multi-select"
    :class="[
      { 'multi-select--vertical': vertical },
      className,
    ]"
  >
    <button
      v-for="opt in options"
      :key="opt"
      class="multi-select__option"
      :class="{ 'is-active': modelValue.includes(opt) }"
      type="button"
      @click="handleSelect(opt)"
    >
      {{ opt }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.multi-select {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}

.multi-select--vertical {
  flex-direction: column;
}

.multi-select__option {
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

.multi-select__option:hover {
  border-color: #6e55ff;
}

.multi-select__option.is-active {
  border-color: #6e55ff;
  background: #6e55ff;
  color: #ffffff;
}
</style>
