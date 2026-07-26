<template>
  <view class="streaming-message">
    <view class="message-content">
      <!-- 骨架屏：当正在生成且处于 HTML/空内容状态时展示 -->
      <view
        v-if="props.isStreaming && (props.messageType === 'html' || !props.content)"
        class="skeleton-card"
      >
        <text class="skeleton-tip">🤖 AI 思考生成中...</text>
      </view>

      <!-- 流式生成文本 -->
      <view v-else-if="props.isStreaming" class="streaming-content">
        <rich-text class="message-rich-text" :nodes="renderedHtmlContent" selectable></rich-text>
        <text class="typing-cursor">|</text>
      </view>

      <!-- HTML 网页类型卡片 -->
      <view v-else-if="props.messageType === 'html'" class="html-message-container">
        <view v-for="seg in htmlSegments" :key="seg.key" class="html-segment-wrapper">
          <view v-if="seg.type === 'text'" class="html-text-segment">
            <rich-text class="message-rich-text" :nodes="seg.rendered" selectable></rich-text>
          </view>
          <view
            v-else
            class="html-card"
            @click.stop="openHtmlDialog(seg.url)"
          >
            <view class="html-card-content">
              <image
                v-if="seg.url && props.rawHtmlMap?.[seg.url]?.[1]"
                :src="props.rawHtmlMap?.[seg.url]?.[1]"
                mode="aspectFit"
                class="html-card-img"
              />
              <view v-else class="html-loading-box">
                <text class="loading-text">📄 HTML 预览加载中...</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 普通打字机完成文本 -->
      <view v-else class="typewriter-content">
        <rich-text class="message-rich-text" :nodes="renderedHtmlContent" selectable></rich-text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMessageRenderer } from '@/composables/useMessageRenderer'

interface Props {
  content: string
  isStreaming?: boolean
  messageType?: 'text' | 'html'
  rawHtmlMap?: Record<string, [string, string?]>
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  messageType: 'text',
  rawHtmlMap: () => ({})
})

const emit = defineEmits<{
  (e: 'reload-html-image', url: string): void
  (e: 'open-html-preview', payload: { url: string; html?: string }): void
}>()

const { renderMessageContent } = useMessageRenderer()

const openHtmlDialog = (urlArg?: string) => {
  if (!urlArg) return
  const cachedHtml = props.rawHtmlMap?.[urlArg]?.[0]
  emit('open-html-preview', { url: urlArg, html: cachedHtml })
}

const displayedContent = computed(() => {
  const content = props.content || ''
  if (props.messageType === 'html') {
    const filtered = content.replace(/(`?!\[\]\()?\s*https:\/\/[a-z0-9.-]*kelvin-cosin\.cloud\/.*?\.html\s*(\)`?)?.*?(\n|$)/gi, '')
    return filtered.trim()
  }
  return content
})

const renderedHtmlContent = computed(() => {
  return renderMessageContent(displayedContent.value)
})

const htmlSegments = computed(() => {
  if (props.messageType !== 'html') return []
  const content = props.content || ''
  const regex = /(`?!\[\]\()?(\s*https:\/\/[a-z0-9.-]*kelvin-cosin\.cloud\/.*?\.html\s*)(\)`?)?/gi
  const segments: { key: string; type: 'text' | 'link'; rendered?: string; url?: string }[] = []

  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const url = match[2].trim()
    const start = match.index

    if (start > lastIndex) {
      const textPart = content.slice(lastIndex, start)
      if (textPart) {
        segments.push({
          key: `t-${lastIndex}-${start}`,
          type: 'text',
          rendered: renderMessageContent(textPart)
        })
      }
    }

    segments.push({
      key: `l-${start}-${regex.lastIndex}`,
      type: 'link',
      url
    })

    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    const textPart = content.slice(lastIndex)
    if (textPart) {
      segments.push({
        key: `t-${lastIndex}-end`,
        type: 'text',
        rendered: renderMessageContent(textPart)
      })
    }
  }

  return segments
})
</script>

<style lang="scss" scoped>
.streaming-message {
  display: flex;
  align-items: flex-end;
  gap: 4rpx;
}

.message-content {
  flex: 1;
  word-break: break-all;
}

.message-rich-text {
  font-size: 28rpx;
  line-height: 1.75;
  color: #1f2937;
  word-break: break-word;

  :deep(.katex) {
    font-size: 1.05em;
    line-height: 1.2;
    vertical-align: baseline;
    white-space: normal;
  }

  :deep(.katex-display) {
    display: block;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 12rpx 0;
    margin: 12rpx 0;
    -webkit-overflow-scrolling: touch;
  }

  :deep(.katex-display > .katex) {
    white-space: nowrap;
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-size: 32rpx;
    line-height: 1.5;
    font-weight: 600;
    margin: 16rpx 0;
    color: #0f172a;
  }

  :deep(p) {
    margin: 12rpx 0;
    line-height: 1.65;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 40rpx;
    margin: 12rpx 0;
  }

  :deep(li) {
    font-size: 28rpx;
    line-height: 1.6;
    font-weight: 400;
    margin: 6rpx 0;
  }

  :deep(blockquote) {
    border-left: 6rpx solid #7a7cff;
    padding-left: 20rpx;
    color: #64748b;
    margin: 16rpx 0;
    background: #f8fafc;
    border-radius: 0 12rpx 12rpx 0;
    padding-top: 8rpx;
    padding-bottom: 8rpx;
  }

  :deep(hr) {
    border: none;
    border-top: 1rpx solid #e2e8f0;
    margin: 24rpx 0;
  }

  :deep(pre) {
    background-color: #1e293b;
    color: #f8fafc;
    padding: 20rpx;
    border-radius: 16rpx;
    overflow-x: auto;
    font-family: monospace;
    margin: 16rpx 0;
  }

  :deep(code) {
    background-color: rgba(122, 124, 255, 0.1);
    color: #4f46e5;
    padding: 4rpx 10rpx;
    border-radius: 8rpx;
    font-family: monospace;
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 16rpx 0;
  }

  :deep(th),
  :deep(td) {
    border: 1rpx solid #cbd5e1;
    padding: 12rpx 16rpx;
    font-size: 26rpx;
  }

  :deep(th) {
    background-color: #f1f5f9;
    font-weight: 600;
  }

  :deep(img),
  :deep(img.markdown-image) {
    max-width: 100%;
    height: auto;
    border-radius: 12rpx;
    margin: 12rpx 0;
  }
}

.skeleton-card {
  width: 520rpx;
  min-height: 320rpx;
  background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 50%, #f8fafc 100%);
  background-size: 200% 200%;
  animation: pulse-skeleton 1.8s ease-in-out infinite;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #e2e8f0;
}

.skeleton-tip {
  font-size: 26rpx;
  color: #64748b;
  font-weight: 500;
}

@keyframes pulse-skeleton {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.typing-cursor {
  display: inline-block;
  font-weight: bold;
  color: #1976d2;
  font-size: 28rpx;
  margin-left: 4rpx;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.html-message-container {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: flex-start;
  width: 100%;
}

.html-card {
  width: 100%;
  min-height: 360rpx;
  background: #f4f6ff;
  border: 1rpx solid #7a7cff;
  border-radius: 24rpx;
  overflow: hidden;
  position: relative;
  transition: all 0.2s ease;
}

.html-card-content {
  width: 100%;
  height: 360rpx;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.html-card-img {
  width: 100%;
  height: 100%;
  border-radius: 24rpx;
}

.html-loading-box {
  padding: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-text {
  font-size: 26rpx;
  color: #7a7cff;
}
</style>
