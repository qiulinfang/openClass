<template>
  <view class="title-wrapper">
    <rich-text class="card-title markdown-title" :nodes="renderedTitle"></rich-text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import { MathJaxUtils } from '../../utils/math/mathjax'

const props = defineProps<{
  title: string
}>()

const { renderMessageContent } = useMessageRenderer()

// 截断 20 字符
const truncateTitle = (text: string): string => {
  const maxLength = 20
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const renderedTitle = computed(() => {
  // 直接使用原始标题，清洗逻辑已移除
  const content = props.title || '新会话'
  const truncated = truncateTitle(content)
  const rendered = renderMessageContent(truncated)
  return `<strong>${rendered}</strong>`
})

onMounted(async () => {
  await nextTick()
  // MathJax 渲染（如果需要）
})
</script>

<style scoped>
.title-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 24px;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: -0.01em;
  white-space: nowrap;
  line-height: 24px;
  height: 24px;
  overflow: hidden;
}

:deep(.math) {
  display: inline-block;
  vertical-align: middle;
  font-size: 0.85em;
}
</style>
