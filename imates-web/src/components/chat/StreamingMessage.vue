<template>
  <div class="streaming-message">
    <div class="message-content">
      <!-- 流式模式：直接显示内容 -->
      <div v-if="props.isStreaming" class="streaming-content" :ref="(el) => setStreamingContentRef(el)">
        <span v-html="renderedContent"></span>
        <span class="typing-cursor">▊</span>
      </div>
      <!-- 非流式模式：打字机效果 -->
      <div v-else class="typewriter-content" :ref="(el) => setTypewriterContentRef(el)">
        <span v-html="displayedContent"></span>
        <span v-if="isTyping" class="typing-cursor">|</span>
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
interface Props extends StreamingMessageProps {}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false,
  typewriterSpeed: streamingManager.getConfig().typewriterSpeed
})

const emit = defineEmits<{
  complete: []
  progress: [progress: number]
}>()

const displayedLength = ref(0)
const isTyping = ref(false)
let typingTimer: ReturnType<typeof setTimeout> | null = null

// 添加ref引用
const streamingContentRef = ref<HTMLElement>()
const typewriterContentRef = ref<HTMLElement>()

// 使用公共的 markdown 渲染器
const { renderMessageContent } = useMessageRenderer()

// 计算显示的内容（用于打字机效果）
const displayedContent = computed(() => {
  const content = props.isStreaming ? props.content : props.content.substring(0, displayedLength.value)
  return renderMessageContent(content)
})

// 渲染完整内容（用于流式模式）
const renderedContent = computed(() => {
  return renderMessageContent(props.content)
})

// 开始打字机效果
const startTypewriter = () => {
  if (props.isStreaming || props.content.length === 0) {
    return
  }

  isTyping.value = true
  displayedLength.value = 0
  
  const typeNextChar = () => {
    if (displayedLength.value < props.content.length) {
      displayedLength.value++
      
      const progress = (displayedLength.value / props.content.length) * 100
      emit('progress', progress)
      
      typingTimer = setTimeout(typeNextChar, props.typewriterSpeed)
    } else {
      isTyping.value = false
      emit('complete')
    }
  }
  
  typeNextChar()
}

// 停止打字机效果
const stopTypewriter = () => {
  if (typingTimer) {
    clearTimeout(typingTimer)
    typingTimer = null
  }
  isTyping.value = false
  displayedLength.value = props.content.length
}

// 监听内容变化
watch(() => props.content, (newContent, oldContent) => {
  if (props.isStreaming) {
    // 流式模式：直接显示
    return
  }
  
  if (newContent !== oldContent) {
    // 非流式模式：重新开始打字机效果
    if (typingTimer) {
      clearTimeout(typingTimer)
    }
    startTypewriter()
  }
}, { immediate: true })

// 监听流式状态变化
watch(() => props.isStreaming, (streaming) => {
  if (!streaming && props.content) {
    // 流式结束，开始打字机效果
    startTypewriter()
  } else if (streaming) {
    // 开始流式，停止打字机效果
    stopTypewriter()
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
  if (!props.isStreaming && props.content) {
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
  color: #1976d2;
  font-weight: bold;
  animation: blink 1s infinite;
  font-size: 0.9em;
  line-height: 1;
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
  max-height: 400px;
  height: auto;
  border-radius: 8px;
  cursor: pointer;
  display: block;
  margin: 8px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
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