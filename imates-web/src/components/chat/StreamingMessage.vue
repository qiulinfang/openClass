<template>
  <div class="streaming-message">
    <div class="message-content">
      <!-- 流式模式 & 非流式模式统一使用打字机效果，区别仅在于流式模式下内容会持续追加 -->
      <div
        v-if="props.isStreaming"
        class="streaming-content"
        :ref="(el) => setStreamingContentRef(el)"
      >
        <span v-html="displayedContent"></span><span class="typing-cursor">|</span>
      </div>
      <div v-else class="typewriter-content" :ref="(el) => setTypewriterContentRef(el)">
        <span v-html="displayedContent"></span><span v-if="isTyping" class="typing-cursor">|</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { streamingManager } from '../../config/streaming'
import { useMessageRenderer } from '../../composables/useMessageRenderer'
import { MathJaxUtils } from '../../utils/math/mathjax'

// 导入类型定义
import type { StreamingMessageProps } from '../../types'

// 定义Props
interface Props extends StreamingMessageProps {
  enableTypewriter: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  typewriterSpeed: streamingManager.getConfig().typewriterSpeed,
  enableTypewriter: true,
})

const emit = defineEmits<{
  complete: []
  progress: [progress: number]
}>()

const displayedLength = ref(0)
const isTyping = ref(false)
// 记录上一次完整内容长度，用于计算新增内容长度
const lastContentLength = ref(0)
let typingTimer: ReturnType<typeof setTimeout> | null = null

// 添加ref引用
const streamingContentRef = ref<HTMLElement>()
const typewriterContentRef = ref<HTMLElement>()

// 使用公共的 markdown 渲染器
const { renderMessageContent } = useMessageRenderer()

// 计算显示的内容（用于打字机效果，流式与非流式统一使用 displayedLength 控制）
const displayedContent = computed(() => {
  const safeLength = Math.min(displayedLength.value, props.content.length)
  const content = props.content.substring(0, safeLength)
  return renderMessageContent(content)
})

// 开始或继续打字机效果（支持流式 & 非流式）
const startTypewriter = () => {
  // 关闭打字机模式时，直接展示完整内容
  if (!props.enableTypewriter) {
    displayedLength.value = props.content.length
    isTyping.value = false
    return
  }

  if (props.content.length === 0) {
    return
  }

  // 如果当前已全部显示，则无需继续
  if (displayedLength.value >= props.content.length) {
    isTyping.value = false
    return
  }

  isTyping.value = true

  const typeNextChar = () => {
    if (displayedLength.value < props.content.length) {
      displayedLength.value++

      const progress = (displayedLength.value / props.content.length) * 100
      emit('progress', progress)

      typingTimer = setTimeout(typeNextChar, props.typewriterSpeed)
    } else {
      isTyping.value = false
      typingTimer = null
      emit('complete')
    }
  }

  if (!typingTimer) {
    typeNextChar()
  }
}

// 停止打字机效果，并直接展示全部内容
const stopTypewriter = () => {
  if (typingTimer) {
    clearTimeout(typingTimer)
    typingTimer = null
  }
  isTyping.value = false
  displayedLength.value = props.content.length
  lastContentLength.value = props.content.length
}

// 监听内容变化：只要内容长度增加，就对新增部分做打字机效果
watch(
  () => props.content,
  (newContent, oldContent = '') => {
    const newLen = newContent.length
    const oldLen = oldContent.length

    // 关闭打字机：任何时候内容变化都直接展示完整内容
    if (!props.enableTypewriter) {
      displayedLength.value = newLen
      lastContentLength.value = newLen
      return
    }

    // 内容被整体替换为更短（例如错误态），直接展示完整内容
    if (newLen <= oldLen) {
      displayedLength.value = newLen
      lastContentLength.value = newLen
      return
    }

    // 内容有新增部分：从当前 displayedLength 继续打字
    if (typingTimer) {
      // 已有打字任务在跑，更新 lastContentLength 即可
      lastContentLength.value = newLen
    } else {
      // 没有打字任务，启动新的打字任务
      startTypewriter()
    }
  },
  { immediate: true },
)

// 监听流式状态变化：结束流式时，如果还有未显示完的内容，继续打字直到完成
watch(() => props.isStreaming, (streaming) => {
  if (!streaming && props.content) {
    // 关闭打字机时，直接展示完整内容
    if (!props.enableTypewriter) {
      displayedLength.value = props.content.length
      isTyping.value = false
      return
    }

    // 流式结束，如有剩余内容未展示，继续打字直至完成
    if (displayedLength.value < props.content.length) {
      startTypewriter()
    } else {
      isTyping.value = false
    }
  }
})

// 处理 Markdown 渲染出的图片
const processMarkdownImages = (container: HTMLElement) => {
  // 第1步：查找容器内所有的图片元素
  const allImages = container.querySelectorAll('img')
  
  allImages.forEach((img) => {
    // 第2步：检查图片是否在 MathJax 公式容器内，如果是则跳过
    const mathContainer = img.closest('.mjx-chtml, .mjx-math, [data-mjx-texclass]')
    if (mathContainer) {
      return
    }
    
    // 第3步：检查图片是否已经被处理过
    if (img.classList.contains('markdown-image')) {
      return
    }
    
    // 第4步：添加标记类名和样式类名
    img.classList.add('markdown-image')
  })
}

// 监听内容变化，重新渲染MathJax和处理图片（防抖处理）
let mathJaxRenderTimeout: ReturnType<typeof setTimeout> | null = null
watch(() => props.content, () => {
  // 防抖处理，避免频繁渲染MathJax和处理图片
  if (mathJaxRenderTimeout) {
    clearTimeout(mathJaxRenderTimeout)
  }
    mathJaxRenderTimeout = setTimeout(() => {
      nextTick(() => {
        // 重新渲染MathJax，使用懒加载模式
        if (streamingContentRef.value) {
          MathJaxUtils.renderMath(streamingContentRef.value, true)
          // 处理图片
          processMarkdownImages(streamingContentRef.value)
        }
        if (typewriterContentRef.value) {
          MathJaxUtils.renderMath(typewriterContentRef.value, true)
          // 处理图片
          processMarkdownImages(typewriterContentRef.value)
        }
      })
    }, 300) // 300ms防抖
})

onMounted(() => {
  if (props.content) {
    // 初次挂载时：如果关闭打字机，直接展示完整内容
    if (!props.enableTypewriter) {
      displayedLength.value = props.content.length
      lastContentLength.value = props.content.length
      isTyping.value = false
      return
    }

    // 初次挂载时，如果有内容，从头开始打字
    displayedLength.value = 0
    lastContentLength.value = props.content.length
    startTypewriter()
  }
})

onUnmounted(() => {
  if (typingTimer) {
    clearTimeout(typingTimer)
  }
  if (mathJaxRenderTimeout) {
    clearTimeout(mathJaxRenderTimeout)
  }
})

// MathJax渲染处理
const setStreamingContentRef = (el: any) => {
  if (el && el instanceof HTMLElement) {
    streamingContentRef.value = el
    // 对于流式内容，使用懒加载模式
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
      // 处理图片
      processMarkdownImages(el)
    })
  }
}

const setTypewriterContentRef = (el: any) => {
  if (el && el instanceof HTMLElement) {
    typewriterContentRef.value = el
    // 对于打字机内容，使用懒加载模式
    nextTick(() => {
      MathJaxUtils.renderMath(el, true)
      // 处理图片
      processMarkdownImages(el)
    })
  }
}
</script>

<style scoped>
.streaming-message {
  display: flex;
  align-items: flex-end;
  gap: 2px;
}

.message-content {
  flex: 1;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.typing-cursor {
  display: inline;
  color: #1976d2;
  font-weight: bold;
  animation: blink 1s infinite;
  font-size: 0.9em;
  line-height: 1;
  vertical-align: baseline;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

/* Markdown 渲染出的图片样式 */
:deep(img.markdown-image) {
  max-width: 100%;
}

:deep(img.markdown-image:hover) {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

:deep(img.markdown-image.image-error) {
  opacity: 0.5;
  filter: grayscale(100%);
}
</style>