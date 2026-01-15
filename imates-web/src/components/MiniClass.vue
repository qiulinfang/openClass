<template>
  <!-- 对话框模式 -->
  <DraggableDialog 
    v-if="useDialog"
    v-model="localVisible" 
    title="微课"
    :initial-width="1200"
    :initial-height="700"
    :min-width="800"
    :min-height="500"
  >
    <div class="mini-class-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <q-spinner color="primary" size="48px" />
        <div class="text-h6 q-mt-md text-grey-7">正在加载微课...</div>
      </div>

      <!-- 404占位符 -->
      <div v-else-if="is404" class="empty-container">
        <q-icon name="ondemand_video" size="64px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">该题目暂无微课内容</div>
        <div class="text-body2 q-mt-sm text-grey-6">微课资源可能尚未上传或已被移除</div>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="error" class="error-container">
        <q-icon name="error_outline" size="64px" color="negative" />
        <div class="text-h6 q-mt-md text-grey-7">{{ error }}</div>
        <q-btn
          color="primary"
          outline
          class="q-mt-md"
          @click="retryLoad"
        >
          重试
        </q-btn>
      </div>

      <!-- 视频播放器 -->
      <div v-else-if="classUrl && !is404" class="video-container">
        <!-- 如果URL是视频文件，使用video标签 -->
        <video
          v-if="isVideoUrl(classUrl)"
          ref="videoPlayer"
          :src="classUrl"
          controls
          class="video-player"
          @loadstart="handleVideoLoadStart"
          @loadeddata="handleVideoLoaded"
          @error="handleVideoError"
        >
          您的浏览器不支持视频播放。
        </video>

        <!-- 如果URL是网页，使用iframe -->
        <iframe
          v-else
          ref="iframePlayer"
          :src="normalizeUrl(classUrl) || ''"
          class="iframe-player"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          @load="handleIframeLoad"
          @error="handleIframeError"
        ></iframe>

        <!-- 视频控制栏 -->
        <div v-if="showControls && isVideoUrl(classUrl)" class="video-controls">
          <q-btn
            flat
            round
            :icon="isPlaying ? 'pause' : 'play_arrow'"
            @click="togglePlay"
          />
          <q-slider
            v-model="currentTime"
            :min="0"
            :max="duration"
            @change="seekTo"
            class="time-slider"
          />
          <div class="time-display">
            {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
          </div>
          <q-btn
            flat
            round
            icon="fullscreen"
            @click="toggleFullscreen"
          />
        </div>
      </div>

      <!-- 无URL状态 -->
      <div v-else class="empty-container">
        <q-icon name="ondemand_video" size="64px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">暂无微课内容</div>
      </div>
    </div>
  </DraggableDialog>
  
  <!-- 嵌入式模式 -->
  <div v-else class="mini-class-container embedded">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-container">
      <q-spinner color="primary" size="48px" />
      <div class="text-h6 q-mt-md text-grey-7">正在加载微课...</div>
    </div>

    <!-- 404占位符 -->
    <div v-else-if="is404" class="empty-container">
      <q-icon name="ondemand_video" size="64px" color="grey-5" />
      <div class="text-h6 q-mt-md text-grey-7">该题目暂无微课内容</div>
      <div class="text-body2 q-mt-sm text-grey-6">微课资源可能尚未上传或已被移除</div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-container">
      <q-icon name="error_outline" size="64px" color="negative" />
      <div class="text-h6 q-mt-md text-grey-7">{{ error }}</div>
      <q-btn
        color="primary"
        outline
        class="q-mt-md"
        @click="retryLoad"
      >
        重试
      </q-btn>
    </div>

    <!-- 视频播放器 -->
    <div v-else-if="classUrl && !is404" class="video-container">
      <!-- 如果URL是视频文件，使用video标签 -->
      <video
        v-if="isVideoUrl(classUrl)"
        ref="videoPlayer"
        :src="classUrl"
        controls
        class="video-player"
        @loadstart="handleVideoLoadStart"
        @loadeddata="handleVideoLoaded"
        @error="handleVideoError"
      >
        您的浏览器不支持视频播放。
      </video>

      <!-- 如果URL是网页，使用iframe -->
      <iframe
        v-else
        ref="iframePlayer"
        :src="normalizeUrl(classUrl) || ''"
        class="iframe-player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        @load="handleIframeLoad"
        @error="handleIframeError"
      ></iframe>

      <!-- 视频控制栏 -->
      <div v-if="showControls && isVideoUrl(classUrl)" class="video-controls">
        <q-btn
          flat
          round
          :icon="isPlaying ? 'pause' : 'play_arrow'"
          @click="togglePlay"
        />
        <q-slider
          v-model="currentTime"
          :min="0"
          :max="duration"
          @change="seekTo"
          class="time-slider"
        />
        <div class="time-display">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
        <q-btn
          flat
          round
          icon="fullscreen"
          @click="toggleFullscreen"
        />
      </div>
    </div>

    <!-- 无URL状态 -->
    <div v-else class="empty-container">
      <q-icon name="ondemand_video" size="64px" color="grey-5" />
      <div class="text-h6 q-mt-md text-grey-7">暂无微课内容</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import DraggableDialog from './dialog/DraggableDialog.vue'

// ==================== Props & Emits ====================
interface Props {
  modelValue?: boolean  // 对话框模式需要，嵌入式模式不需要
  classUrl?: string
  questionTitle?: string
  useDialog?: boolean  // 是否使用对话框模式，默认 true（兼容旧代码）
}

const props = withDefaults(defineProps<Props>(), {
  classUrl: '',
  questionTitle: '',
  useDialog: true,
  modelValue: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

// ==================== 响应式数据 ====================
const localVisible = computed({
  get: () => props.useDialog ? props.modelValue : true,  // 嵌入式模式始终显示
  set: (value) => {
    if (props.useDialog) {
      emit('update:modelValue', value)
      if (!value) {
        emit('close')
      }
    }
  }
})

const loading = ref(false)
const error = ref<string | null>(null)
const is404 = ref(false)  // 404状态标识
const videoPlayer = ref<HTMLVideoElement | null>(null)
const iframePlayer = ref<HTMLIFrameElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const showControls = ref(true)
let loadTimeout: ReturnType<typeof setTimeout> | null = null  // 加载超时定时器
let check404Timeout: ReturnType<typeof setTimeout> | null = null  // 404检测超时定时器

// 监听 is404 状态变化，用于调试占位页显示问题
watch(is404, (newVal, oldVal) => {
  console.log('[MiniClass] is404 changed:', { old: oldVal, new: newVal })
  if (newVal) {
    console.log('[MiniClass] should show placeholder UI')
  }
})

// 规范化 URL，确保是正确的绝对 URL
const normalizeUrl = (url: string): string | null => {
  if (!url || url.trim() === '') {
    return null
  }
  
  const trimmedUrl = url.trim()

  // 兼容：本地 html 文件（例如 steiner-lab-tablet.html）
  // 这类路径包含 '.'，但不应该被当成域名自动补 https://
  // 在 file:// (android_asset) 或 dev server 下都应该按相对路径解析。
  if (
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmedUrl) &&
    /\.html?(\?.*)?(#.*)?$/i.test(trimmedUrl)
  ) {
    try {
      return new URL(trimmedUrl, window.location.href).href
    } catch (e) {
      console.warn('[MiniClass] local html URL 解析失败:', trimmedUrl, e)
    }
  }
  
  try {
    // 尝试解析为完整 URL
    const urlObj = new URL(trimmedUrl)
    
    // 如果协议是 http 或 https，检查 host 是否异常
    if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
      // 检查 host 是否包含域名（例如：localhost:5173/www.baidu.com）
      // 这种情况说明 URL 格式错误，需要提取实际的域名
      const hostMatch = urlObj.host.match(/^[^/]+(\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))?/i)
      if (hostMatch && hostMatch[2]) {
        // host 中包含路径形式的域名（如：localhost:5173/www.baidu.com）
        // 提取实际的域名
        const actualDomain = hostMatch[2]
        const pathname = urlObj.pathname
        const search = urlObj.search
        const hash = urlObj.hash
        
        // 检查是否还有路径名（去除已提取的域名部分）
        const cleanPathname = pathname.replace(/^\/[^/]+/, '')
        
        return `${urlObj.protocol}//${actualDomain}${cleanPathname}${search}${hash}`
      }
      
      // 检查 pathname 中是否包含域名格式（例如：/www.baidu.com#/login）
      const pathnameMatch = urlObj.pathname.match(/^\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/.*)?$/i)
      if (pathnameMatch) {
        // pathname 中包含域名（例如：/www.baidu.com#/login）
        const actualDomain = pathnameMatch[1]
        const pathAfterDomain = pathnameMatch[2] || ''
        const search = urlObj.search
        const hash = urlObj.hash
        
        // 如果 hash 中包含路径（例如：#/login），保留它
        return `${urlObj.protocol}//${actualDomain}${pathAfterDomain}${search}${hash}`
      }
      
      // URL 格式正常，直接返回
      return trimmedUrl
    }
    
    // 其他协议（如 file:, data:）可能不支持，但先返回
    return trimmedUrl
  } catch {
    // URL 解析失败，可能是相对路径或域名
    // 检查是否包含协议
    if (/^https?:\/\//i.test(trimmedUrl)) {
      // 包含协议但解析失败，可能是格式错误
      // 例如：http://localhost:5173/www.baidu.com#/login
      
      // 尝试提取域名：查找第一个看起来像域名的部分
      // 匹配格式：协议://主机/域名/路径#哈希 或 协议://主机/域名#哈希
      const complexMatch = trimmedUrl.match(/^https?:\/\/[^/]+\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/.*)?(#.*)?$/i)
      if (complexMatch) {
        const domain = complexMatch[1]
        const pathAfterDomain = complexMatch[2] || ''
        const hash = complexMatch[3] || ''
        const protocol = trimmedUrl.match(/^(https?:)/i)?.[1] || 'https:'
        
        return `${protocol}//${domain}${pathAfterDomain}${hash}`
      }
      
      // 如果无法修复，返回原 URL（可能仍然会失败，但至少尝试）
      console.warn('[MiniClass] URL 格式异常，无法规范化:', trimmedUrl)
      return trimmedUrl
    }
    
    // 不包含协议，可能是域名或相对路径
    // 检查是否是域名格式（包含点且看起来像域名）
    const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?(#.*)?$/i
    if (domainPattern.test(trimmedUrl)) {
      // 是域名格式，添加 https:// 协议
      return `https://${trimmedUrl}`
    }
    
    // 可能是相对路径，尝试基于当前页面构建完整 URL
    try {
      // 注意：file:// 环境下 currentUrl.host 为空，拼 protocol//host 会导致 file//... 这种非法地址
      // 统一使用 window.location.href 作为 base 解析相对路径
      return new URL(trimmedUrl, window.location.href).href
    } catch (e2) {
      // 如果仍然失败，返回原 URL
      console.warn('[MiniClass] URL 规范化失败:', trimmedUrl, e2)
      return trimmedUrl
    }
  }
}

// 判断是否为视频URL
const isVideoUrl = (url: string): boolean => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.flv', '.m3u8']
  const lowerUrl = url.toLowerCase()
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || 
         lowerUrl.includes('video/') ||
         lowerUrl.includes('video')
}

const isMicroClassWkUrl = (url: string): boolean => {
  return typeof url === 'string' && url.includes('/wk/')
}

// 处理视频加载开始
const handleVideoLoadStart = () => {
  loading.value = true
  error.value = null
}

// 处理视频加载完成
const handleVideoLoaded = () => {
  loading.value = false
  if (videoPlayer.value) {
    duration.value = videoPlayer.value.duration || 0
    
    // 监听播放时间更新
    videoPlayer.value.addEventListener('timeupdate', () => {
      if (videoPlayer.value) {
        currentTime.value = videoPlayer.value.currentTime
      }
    })
    
    // 监听播放状态
    videoPlayer.value.addEventListener('play', () => {
      isPlaying.value = true
    })
    
    videoPlayer.value.addEventListener('pause', () => {
      isPlaying.value = false
    })
    
    // 监听视频结束
    videoPlayer.value.addEventListener('ended', () => {
      isPlaying.value = false
      currentTime.value = 0
    })
  }
}

// 处理视频错误
const handleVideoError = async () => {
  loading.value = false
  
  // 尝试检测是否为404
  if (videoPlayer.value?.src) {
    try {
      const response = await fetch(videoPlayer.value.src, {
        method: 'GET',
        cache: 'no-cache'
      })
      if (response.status === 404) {
        is404.value = true
        error.value = null
        return
      }
    } catch {
      // 兜底：微课 wk 链接检测失败时，直接进入 404 占位（避免一直白屏/报错）
      if (isMicroClassWkUrl(videoPlayer.value.src)) {
        is404.value = true
        error.value = null
        return
      }
    }
  }
  
  // 不是404，显示一般错误
  is404.value = false
  error.value = '视频加载失败，请检查URL是否正确'
}

// 处理iframe加载
const handleIframeLoad = async () => {
  console.log('[MiniClass] iframe load:', {
    src: iframePlayer.value?.src,
    is404: is404.value,
    error: error.value,
    loading: loading.value,
  })
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
  
  if (check404Timeout) {
    clearTimeout(check404Timeout)
    check404Timeout = null
  }
  
  loading.value = false
  
  // 简化检测：直接 ajax 探测当前 iframe URL
  const url = iframePlayer.value?.src
  if (url && url !== 'about:blank') {
    try {
      console.log('[MiniClass] 开始检测微课URL:', url)
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
      })

      if (response.status === 404) {
        console.warn('[MiniClass] 微课404检测成功:', { url })
        is404.value = true
        error.value = null
        return
      }

      console.log('[MiniClass] 微课检测通过:', { url, status: response.status })
    } catch (e) {
      // 兜底：微课 wk 链接检测失败时，直接进入 404 占位
      if (isMicroClassWkUrl(url)) {
        console.warn('[MiniClass] 微课检测失败，进入占位页:', { url, error: e })
        is404.value = true
        error.value = null
        return
      }
      console.warn('[MiniClass] 微课检测失败但不是wk链接:', { url, error: e })
    }
  }

  // 检测完成，清除状态
  is404.value = false
  error.value = null
}

// 处理iframe错误
const handleIframeError = async () => {
  console.error('[MiniClass] iframe error:', {
    src: iframePlayer.value?.src,
  })
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
        console.warn('[MiniClass] iframe 404 detected by HEAD in error handler:', { src: iframePlayer.value.src })
        is404.value = true
        error.value = null
        return
      }
    } catch {
      // 兜底：微课 wk 链接检测失败时，直接进入 404 占位
      if (isMicroClassWkUrl(iframePlayer.value.src)) {
        console.warn('[MiniClass] iframe HEAD failed in error handler, fallback to is404 for /wk/ url:', { src: iframePlayer.value.src })
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

// 切换播放/暂停
const togglePlay = () => {
  if (videoPlayer.value) {
    if (isPlaying.value) {
      videoPlayer.value.pause()
    } else {
      videoPlayer.value.play()
    }
  }
}

// 跳转到指定时间
const seekTo = (time: number) => {
  if (videoPlayer.value) {
    videoPlayer.value.currentTime = time
  }
}

// 切换全屏
const toggleFullscreen = () => {
  if (videoPlayer.value) {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      videoPlayer.value.requestFullscreen()
    }
  }
}

// 格式化时间
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 重试加载
const retryLoad = () => {
  if (props.classUrl) {
    is404.value = false
    error.value = null
    loadContent(props.classUrl)
  }
}

// 加载内容的函数
const loadContent = async (url: string) => {
  if (!url) return

  console.log('[MiniClass] loadContent:', {
    url,
    useDialog: props.useDialog,
    localVisible: localVisible.value,
  })
  
  // 规范化 URL
  const normalizedUrl = normalizeUrl(url)
  if (!normalizedUrl) {
    console.warn('[MiniClass] normalizeUrl failed:', { url })
    error.value = 'URL 无效，请检查URL格式'
    loading.value = false
    is404.value = false
    return
  }

  console.log('[MiniClass] normalizedUrl:', {
    original: url,
    normalized: normalizedUrl,
    isVideo: isVideoUrl(normalizedUrl),
  })
  
  // 如果 URL 被修改，输出警告
  if (normalizedUrl !== url) {
    console.warn('[MiniClass] URL 已规范化:', {
      original: url,
      normalized: normalizedUrl
    })
  }
  
  // 清除之前的超时定时器
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
  
  if (check404Timeout) {
    clearTimeout(check404Timeout)
    check404Timeout = null
  }
  
  // 预检测：如果是微课 /wk/ 链接，先ajax检测是否404
  if (isMicroClassWkUrl(normalizedUrl)) {
    try {
      console.log('[MiniClass] 预检测微课URL:', normalizedUrl)
      const response = await fetch(normalizedUrl, {
        method: 'GET',
        cache: 'no-cache',
      })
      
      if (response.status === 404) {
        console.warn('[MiniClass] 预检测发现微课404，直接显示占位符:', { url: normalizedUrl })
        loading.value = false
        is404.value = true
        return
      }
      
      console.log('[MiniClass] 预检测通过:', { url: normalizedUrl, status: response.status })
    } catch (e) {
      console.warn('[MiniClass] 预检测失败:', { url: normalizedUrl, error: e })
      // 检测失败也直接显示占位符，避免显示404页面
      loading.value = false
      is404.value = true
      return
    }
  }
  
  // 非微课链接或预检测通过的微课链接，走正常加载流程
  loading.value = true
  error.value = null
  is404.value = false
  
  // 设置加载超时（30秒）
  loadTimeout = setTimeout(() => {
    console.warn('[MiniClass] 加载超时')
    loading.value = false
    error.value = '加载超时，请检查网络连接或URL是否正确'
    loadTimeout = null
  }, 30000)
  
  // 使用 nextTick 确保 DOM 已更新
  nextTick(() => {
    if (isVideoUrl(normalizedUrl)) {
      if (videoPlayer.value) {
        videoPlayer.value.src = normalizedUrl
        videoPlayer.value.load()
      } else {
        // 如果 video 元素不存在，清除 loading 状态
        if (loadTimeout) {
          clearTimeout(loadTimeout)
          loadTimeout = null
        }
        loading.value = false
      }
    } else {
      if (iframePlayer.value) {
        // 先清除旧的 src，确保 load 事件能触发
        iframePlayer.value.src = 'about:blank'
        nextTick(() => {
          if (iframePlayer.value) {
            iframePlayer.value.src = normalizedUrl
          }
        })
      } else {
        // 如果 iframe 元素不存在，清除 loading 状态
        if (loadTimeout) {
          clearTimeout(loadTimeout)
          loadTimeout = null
        }
        loading.value = false
      }
    }
  })
}

// 监听URL变化，重新加载
watch(() => props.classUrl, (newUrl) => {
  if (newUrl && localVisible.value) {
    // 只有当对话框可见时才加载
    loadContent(newUrl)
  }
})

// 监听对话框显示状态
watch(localVisible, (newValue) => {
  if (!newValue) {
    // 关闭时清理
    if (videoPlayer.value) {
      videoPlayer.value.pause()
      isPlaying.value = false
      currentTime.value = 0
    }
    // 清除加载超时定时器
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
  } else if (newValue && props.classUrl) {
    // 打开时，如果 URL 存在，加载内容
    // 延迟一下确保 DOM 已经渲染
    is404.value = false
    error.value = null
    nextTick(() => {
      setTimeout(() => {
        loadContent(props.classUrl)
      }, 100)
    })
  } else if (!newValue) {
    // 关闭时重置404状态
    is404.value = false
  }
})

// 清理资源
onUnmounted(() => {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
    loadTimeout = null
  }
  if (check404Timeout) {
    clearTimeout(check404Timeout)
    check404Timeout = null
  }
  if (videoPlayer.value) {
    videoPlayer.value.pause()
    videoPlayer.value.src = ''
  }
})
</script>

<style lang="scss" scoped>
.mini-class-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  &.embedded {
    height: 100%;
    min-height: 0;
  }
}

.loading-container,
.error-container,
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
  overflow: hidden;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background-color: #000;
}

.iframe-player {
  width: 100%;
  height: 100%;
  border: none;
  background-color: #fff;
}

.video-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  color: white;
  opacity: 0;
  transition: opacity 0.3s;
}

.video-container:hover .video-controls {
  opacity: 1;
}

.time-slider {
  flex: 1;
  max-width: 400px;
}

.time-display {
  font-size: 12px;
  white-space: nowrap;
  min-width: 100px;
  text-align: center;
}
</style>

