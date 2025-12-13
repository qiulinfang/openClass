<template>
  <div class="multi-image-grid">
    <div
      v-for="(img, index) in images"
      :key="index"
      class="multi-image-item"
      @click.stop="handleClick(img, index)"
    >
      <img :src="img.base64DataUrl" alt="图片" class="multi-image-img" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

interface ImageItem {
  filePath?: string
  width: number
  height: number
  fileSize: number
  base64DataUrl?: string
}

const props = defineProps({
  images: {
    type: Array as PropType<ImageItem[]>,
    required: true,
  },
  isUser: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'image-click', payload: { image: ImageItem; index: number }): void
}>()

const handleClick = (img: ImageItem, index: number) => {
  emit('image-click', { image: img, index })
}
</script>

<style scoped lang="scss">
.multi-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); // 已从 auto-fill 改为 auto-fit
  gap: 6px;
  max-width: 260px;
}

.multi-image-item {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  aspect-ratio: 1 / 1;
  min-height: 80px;
}

.multi-image-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
