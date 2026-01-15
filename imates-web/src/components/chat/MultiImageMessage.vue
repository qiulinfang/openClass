<template>
  <div>
    <div class="multi-image-grid">
      <div
        v-for="(img, index) in images"
        :key="index"
        class="multi-image-item"
        @click.stop="handleClick(img, index)"
      >
        <img :src="img.base64DataUrl || img.url" alt="图片" class="multi-image-img"
             @load="() => console.log('图片加载成功:', index, img.base64DataUrl || img.url)"
             @error="(e) => console.error('图片加载失败:', index, img.base64DataUrl || img.url, e)" />
      </div>
    </div>
    <!-- 如果有文本内容，也显示文本 -->
    <div v-if="textContent && textContent.trim()" class="multi-image-text">
      {{ textContent }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

interface ImageItem {
  filePath?: string
  width?: number
  height?: number
  fileSize?: number
  base64DataUrl?: string
  url?: string  // 支持后端发送的URL格式
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
  textContent: {
    type: String,
    default: '',
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

.multi-image-text {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.4;
  color: inherit;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
