<template>
  <div v-if="props.fullscreen && localVisible" class="mini-class-fullscreen-overlay">
    <div class="fullscreen-header">
      <div class="fullscreen-title">{{ props.questionTitle || '微课' }}</div>
      <div class="fullscreen-header-slot" v-if="$slots.header">
        <slot name="header"></slot>
      </div>
      <button v-if="props.showCloseButton" class="fullscreen-close-btn" @click="localVisible = false">
        <q-icon name="close" size="24px" />
      </button>
    </div>
    <div class="mini-class-container">
      <div v-if="is404" class="empty-container">
        <q-icon name="ondemand_video" size="64px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">该题目暂无微课内容</div>
        <div class="text-body2 q-mt-sm text-grey-6">微课资源可能尚未上传或已被移除</div>
      </div>

      <div v-else-if="classUrl" class="video-container">
        <iframe
          ref="iframePlayer"
          :src="iframeSrc"
          class="iframe-player"
          frameborder="0"
          scrolling="no"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          @load="handleIframeLoad"
          @error="handleIframeError"
        ></iframe>

        <div v-if="loading" class="loading-overlay">
          <Loading text="正在加载微课..." :size="48" />
        </div>
      </div>

      <div v-else class="empty-container">
        <q-icon name="ondemand_video" size="64px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">暂无微课内容</div>
      </div>
    </div>
  </div>

  <Modal 
    v-else
    v-model="localVisible" 
    :title="props.questionTitle || '微课'"
    :initial-width="1200"
    :initial-height="700"
    :min-width="800"
    :min-height="500"
  >
    <div class="mini-class-container">
      <div v-if="is404" class="empty-container">
        <q-icon name="ondemand_video" size="64px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">该题目暂无微课内容</div>
        <div class="text-body2 q-mt-sm text-grey-6">微课资源可能尚未上传或已被移除</div>
      </div>

      <div v-else-if="classUrl" class="video-container">
        <iframe
          ref="iframePlayer"
          :src="iframeSrc"
          class="iframe-player"
          frameborder="0"
          scrolling="auto"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          @load="handleIframeLoad"
          @error="handleIframeError"
        ></iframe>

        <div v-if="loading" class="loading-overlay">
          <Loading text="正在加载微课..." :size="48" />
        </div>
      </div>

      <div v-else class="empty-container">
        <q-icon name="ondemand_video" size="64px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">暂无微课内容</div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted, nextTick } from 'vue'
import Modal from './base/Modal.vue'
import Loading from './base/Loading.vue'

// ==================== Props & Emits ====================
interface Props {
  modelValue?: boolean
  classUrl?: string
  questionTitle?: string
  fullscreen?: boolean
  showCloseButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  classUrl: '',
  questionTitle: '',
  modelValue: false,
  fullscreen: false,
  showCloseButton: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

// ==================== 响应式数据 ====================
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    if (!value) {
      emit('close')
    }
  }
})

const loading = ref(false)
const error = ref<string | null>(null)
const is404 = ref(false)  // 404状态标识
const iframePlayer = ref<HTMLIFrameElement | null>(null)
const iframeSrc = ref<string>('')
let loadTimeout: ReturnType<typeof setTimeout> | null = null  // 加载超时定时器
let check404Timeout: ReturnType<typeof setTimeout> | null = null  // 404检测超时定时器

const clearLoadTimers = () => {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
  if (check404Timeout) {
    clearTimeout(check404Timeout)
    check404Timeout = null
  }
}

const startLoadTimeout = () => {
  loadTimeout = setTimeout(() => {
    loading.value = false
    error.value = '加载超时，请检查网络连接或URL是否正确'
    loadTimeout = null
  }, 30000)
}

const resetForNewLoad = () => {
  loading.value = true
  error.value = null
  is404.value = false
  iframeSrc.value = ''
  startLoadTimeout()
}

const setIframeSrcAndTriggerLoad = (src: string) => {
  let target = src
  
  // 注入用户信息参数 (使用 localStorage 中的 xuebanuserid)
  const userId = localStorage.getItem('xuebanuserid')
  if (userId) {
    const separator = target.includes('?') ? '&' : '?'
    target = `${target}${separator}userName=${encodeURIComponent(userId)}`
  }

  iframeSrc.value = 'about:blank'
  nextTick(() => {
    iframeSrc.value = target
  })
}

const precheckWk404 = async (url: string): Promise<boolean> => {
  if (!isMicroClassWkUrl(url)) {
    return false
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-cache',
    })

    if (response.status === 404) {
      loading.value = false
      is404.value = true
      return true
    }
  } catch {
    loading.value = false
    is404.value = true
    return true
  }

  return false
}

const isMicroClassWkUrl = (url: string): boolean => {
  return typeof url === 'string' && url.includes('/wk/')
}

// 处理iframe加载
const handleIframeLoad = async () => {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
  
  if (check404Timeout) {
    clearTimeout(check404Timeout)
    check404Timeout = null
  }
  
  loading.value = false
  
  const url = iframePlayer.value?.src
  if (url && url !== 'about:blank') {
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
      })

      if (response.status === 404) {
        is404.value = true
        error.value = null
        return
      }

      // 微课检测通过
    } catch (e) {
      // 兜底：微课 wk 链接检测失败时，直接进入 404 占位
      if (isMicroClassWkUrl(url)) {
        is404.value = true
        error.value = null
        return
      }
    }
  }

  // 检测完成，清除状态
  is404.value = false
  error.value = null
}

// 处理iframe错误
const handleIframeError = async () => {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
  
  if (check404Timeout) {
    clearTimeout(check404Timeout)
    check404Timeout = null
  }
  
  loading.value = false
  
  // 尝试检测是否为404
  if (iframePlayer.value?.src) {
    try {
      const response = await fetch(iframePlayer.value.src, {
        method: 'GET',
        cache: 'no-cache'
      })
      if (response.status === 404) {
        is404.value = true
        error.value = null
        return
      }
    } catch {
      // 兜底：微课 wk 链接检测失败时，直接进入 404 占位
      if (isMicroClassWkUrl(iframePlayer.value.src)) {
        is404.value = true
        error.value = null
        return
      }
    }
  }
  
  // 不是404，显示一般错误
  is404.value = false
  error.value = '页面加载失败，请检查URL是否正确'
}


// 加载内容的函数
const loadContent = async (url: string) => {
  if (!url) return

  clearLoadTimers()

  if (await precheckWk404(url)) {
    return
  }

  resetForNewLoad()

  nextTick(async () => {
    if (!iframePlayer.value) {
      clearLoadTimers()
      loading.value = false
      return
    }

    setIframeSrcAndTriggerLoad(url)
  })
}

// 监听对话框显示状态 + URL 变化
watch(
  () => [localVisible.value, props.classUrl] as const,
  ([visible, url]) => {
    if (!visible) {
      // 关闭时清理
      iframeSrc.value = ''

      if (loadTimeout) {
        clearTimeout(loadTimeout)
        loadTimeout = null
      }
      if (check404Timeout) {
        clearTimeout(check404Timeout)
        check404Timeout = null
      }

      loading.value = false
      is404.value = false
      error.value = null
      return
    }

    if (url) {
      is404.value = false
      error.value = null
      nextTick(() => {
        loadContent(url)
      })
    }
  },
  { immediate: true }
)

// 清理资源
// 处理安卓原生事件转发
function handleNativeImageResult(e: any) {
  console.log('[MiniClass] 捕获到原生图片事件，准备广播给 iframe:', e.detail);
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'nativeImageCaptureResult',
        detail: e.detail
      }, '*');
    }
  });
}

onMounted(() => {
  window.addEventListener('nativeImageCaptureResult', handleNativeImageResult);
})

onUnmounted(() => {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
  if (check404Timeout) {
    clearTimeout(check404Timeout)
    check404Timeout = null
  }
  window.removeEventListener('nativeImageCaptureResult', handleNativeImageResult);
})
</script>

<style lang="scss" scoped>
.mini-class-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.loading-container,
.empty-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.video-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: auto;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.75);
  z-index: 1;
}

.iframe-player {
  width: 100%;
  height: 100%;
  border: none;
  background-color: #fff;
  display: block;
  flex: 1;
  min-height: 0;
}

.mini-class-fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .fullscreen-header {
    height: 56px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;

    .fullscreen-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .fullscreen-header-slot {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0 16px;
    }

    .fullscreen-close-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: none;
      background: #f1f5f9;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
    }
  }

  .mini-class-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

</style>

