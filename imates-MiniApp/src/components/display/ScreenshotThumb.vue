<template>
  <view
    class="screenshot-thumb"
    :class="{ 'screenshot-thumb--active': active }"
    @click="handleClick"
  >
    <image :src="imageUrl" mode="aspectFit" class="screenshot-thumb-img" />
    <button
      v-if="showDelete"
      class="screenshot-thumb-close"
      @click.stop="emit('remove')"
    >
      <text class="close-icon">✕</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

interface Props {
  imageUrl: string
  active?: boolean
  showDelete?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  showDelete: false,
})

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'remove'): void
}>()

const handleClick = () => {
  emit('click')
}
</script>

<style scoped lang="scss">
.screenshot-thumb {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  background: #f5f5f5;
  position: relative;
  cursor: pointer;
}

.screenshot-thumb--active {
  border-color: #6e55ff;
  box-shadow: 0 0 0 2px rgba(110, 85, 255, 1);
}

.screenshot-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.screenshot-thumb-close {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
}

.close-icon {
  color: white;
  font-size: 12px;
}
</style>
