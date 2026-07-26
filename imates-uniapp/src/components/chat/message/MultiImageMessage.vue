<template>
  <view class="multi-image-wrapper">
    <view class="multi-image-grid">
      <view
        v-for="(img, index) in normalizedImages"
        :key="index"
        class="multi-image-item"
        @click.stop="handleClick(img, index)"
      >
        <image
          :src="img.base64DataUrl || img.url || img.filePath"
          mode="aspectFill"
          class="multi-image-img"
        />
      </view>
    </view>
    <!-- 如果有附带的文本内容，在此展示 -->
    <view v-if="textContent && textContent.trim()" class="multi-image-text">
      <text class="text-content">{{ textContent }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ImageItem {
  filePath?: string
  width?: number
  height?: number
  fileSize?: number
  base64DataUrl?: string
  url?: string
}

const props = withDefaults(
  defineProps<{
    images?: ImageItem[]
    imageList?: ImageItem[]
    isUser?: boolean
    textContent?: string
  }>(),
  {
    images: () => [],
    imageList: () => [],
    isUser: false,
    textContent: ''
  }
)

const emit = defineEmits<{
  (e: 'image-click', payload: { image: ImageItem; index: number }): void
}>()

const normalizedImages = computed<ImageItem[]>(() => {
  if (Array.isArray(props.images) && props.images.length > 0) return props.images
  if (Array.isArray(props.imageList) && props.imageList.length > 0) return props.imageList
  return []
})

const handleClick = (img: ImageItem, index: number) => {
  emit('image-click', { image: img, index })
  const urls = normalizedImages.value
    .map(i => i.base64DataUrl || i.url || i.filePath || '')
    .filter(Boolean)

  if (urls.length > 0) {
    uni.previewImage({
      current: index,
      urls
    })
  }
}
</script>

<style lang="scss" scoped>
.multi-image-wrapper {
  display: flex;
  flex-direction: column;
}

.multi-image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  max-width: 480rpx;
}

.multi-image-item {
  width: 140rpx;
  height: 140rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background-color: #f1f5f9;
}

.multi-image-img {
  width: 100%;
  height: 100%;
}

.multi-image-text {
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 1.5;
  color: inherit;
  word-break: break-all;
}
</style>
