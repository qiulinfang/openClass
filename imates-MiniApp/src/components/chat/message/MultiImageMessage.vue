<template>
  <view>
    <view
      class="multi-image-grid"
      v-paste-to-draft="handlePasteFromDirective"
    >
      <view
        v-for="(img, index) in images"
        :key="index"
        class="multi-image-item"
        @click.stop="handleClick(img, index)"
      >
        <image :src="img.base64DataUrl || img.url" mode="aspectFill" class="multi-image-img" />
      </view>
    </view>
    <!-- 如果有文本内容，也显示文本 -->
    <view v-if="textContent && textContent.trim()" class="multi-image-text">
      <text>{{ textContent }}</text>
    </view>
  </view>
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
  (e: 'paste-to-draft', payload: { dataUrl: string; index: number }): void
}>()

const handleClick = (img: ImageItem, index: number) => {
  emit('image-click', { image: img, index })
}

const handlePasteFromDirective = (dataUrl: string) => {
  if (!dataUrl) return
  emit('paste-to-draft', { dataUrl, index: -1 })
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
