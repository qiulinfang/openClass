<template>
  <div class="common-select" ref="rootRef">
    <button
      class="select-trigger"
      type="button"
      @click="toggleDropdown"
    >
      <span class="select-label">
        <slot name="label" :label="currentLabel">
          {{ currentLabel }}
        </slot>
      </span>
      <span v-if="showArrow" class="select-icon-wrapper" :class="{ 'select-icon--open': isOpen }">
        <img :src="arrowIcon" alt="arrow" class="select-icon" />
      </span>
    </button>

    <transition name="fade-scale">
      <div v-if="isOpen" class="select-dropdown">
        <ul class="select-options">
          <li
            v-for="option in options"
            :key="option.value"
            class="select-option"
            :class="{ 'select-option--active': option.value === modelValue }"
            @click="handleSelect(option.value)"
          >
            {{ option.label }}
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import arrowIcon from '/icons/arrow.svg'

interface Option {
  label: string
  value: string | number
}

export default defineComponent({
  name: 'CommonSelect',
  props: {
    options: {
      type: Array as unknown as () => Option[],
      required: true,
    },
    modelValue: {
      type: [String, Number, null] as unknown as () => string | number | null,
      default: null,
    },
    showArrow: {
      type: Boolean,
      default: true,
    },
    placeholder: {
      type: String,
      default: undefined,
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const isOpen = ref(false)
    const rootRef = ref<HTMLElement | null>(null)

    const currentLabel = computed(() => {
      const found = props.options.find((o) => o.value === props.modelValue)
      if (found) return found.label
      return props.placeholder ?? '请选择'
    })

    const toggleDropdown = () => {
      isOpen.value = !isOpen.value
    }

    const handleSelect = (value: string | number) => {
      emit('update:modelValue', value)
      emit('change', value)
      isOpen.value = false
    }

    const handleClickOutside = (event: MouseEvent) => {
      const root = rootRef.value
      if (!root) return
      if (!root.contains(event.target as Node)) {
        isOpen.value = false
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      arrowIcon,
      isOpen,
      rootRef,
      currentLabel,
      toggleDropdown,
      handleSelect,
    }
  },
})
</script>

<style scoped>
.common-select {
  position: relative;
  display: inline-block;
}

.select-trigger {
  width: 180px;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 14px;
  color: #111827;
}

.select-trigger:hover {
  border-color: #c7d2fe;
}

.select-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.select-icon-wrapper {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.select-icon-wrapper.select-icon--open {
  transform: rotate(180deg);
}

.select-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.select-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 180px;
  background-color: #ffffff;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(15, 0, 46, 0.15);
  padding: 8px 0;
  z-index: 20;
}

.select-options {
  list-style: none;
  margin: 0;
  padding: 0 5px;
  max-height: 320px;
  overflow-y: auto;
}

.select-option {
  padding: 8px 20px;
  font-size: 14px;
  color: #1f2933;
  cursor: pointer;
  border-radius: 7px;
}

.select-option:hover {
  background-color: #f3f4ff;
}

.select-option--active {
  background-color: #f3f4ff;
  font-weight: 600;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
