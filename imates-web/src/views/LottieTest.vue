<template>
  <div class="lottie-test-page">
    <div class="container">
      <h1>Lottie动画测试页面</h1>

      <div class="test-section">
        <h2>图片序列动画测试</h2>
        <p>使用"2秒"文件夹中的121帧图片序列创建动画</p>

        <div class="animation-container">
          <LottieAnimation
            ref="animationRef"
            imageSequencePath="/assets/animations/2秒/"
            :frameCount="121"
            :frameRate="30"
            :width="600"
            :height="400"
            :loop="true"
            :autoplay="true"
            :showControls="true"
            @load="onAnimationLoad"
            @error="onAnimationError"
            @complete="onAnimationComplete"
            @frame-change="onFrameChange"
          />
        </div>

        <div class="controls">
          <button @click="playAnimation" class="btn">播放</button>
          <button @click="pauseAnimation" class="btn">暂停</button>
          <button @click="restartAnimation" class="btn">重播</button>
          <button @click="toggleControls" class="btn">
            {{ showEmbeddedControls ? '隐藏控制面板' : '显示控制面板' }}
          </button>
        </div>

        <div class="animation-info">
          <p><strong>当前帧:</strong> {{ currentFrame }}</p>
          <p><strong>动画状态:</strong> {{ isPlaying ? '播放中' : '已暂停' }}</p>
          <p><strong>总帧数:</strong> 121帧 (12_0.jpg - 12_120.jpg)</p>
          <p><strong>帧率:</strong> 30 FPS</p>
        </div>
      </div>

      <div class="test-section">
        <h2>Lottie JSON动画测试</h2>
        <p>如果您有Lottie JSON文件，可以在这里测试</p>

        <div class="json-upload">
          <input
            type="file"
            accept=".json"
            @change="onJsonFileSelect"
            ref="jsonFileInput"
            class="file-input"
          />
          <button @click="$refs.jsonFileInput.click()" class="btn">选择Lottie JSON文件</button>
        </div>

        <div v-if="selectedJson" class="animation-container">
          <LottieAnimation
            :animationData="selectedJson"
            :width="400"
            :height="300"
            :loop="true"
            :autoplay="false"
          />
        </div>
      </div>

      <div class="test-section">
        <h2>性能测试</h2>
        <div class="performance-controls">
          <label>
            <input type="checkbox" v-model="enablePreload" @change="togglePreload" />
            启用预加载 ({{ preloadFrames }}帧)
          </label>
          <input
            type="range"
            min="1"
            max="10"
            v-model.number="preloadFrames"
            @input="updatePreloadFrames"
          />
          <span>{{ preloadFrames }}帧</span>
        </div>

        <div class="performance-info">
          <p><strong>预加载状态:</strong> {{ enablePreload ? '已启用' : '已禁用' }}</p>
          <p><strong>内存使用:</strong> {{ memoryUsage }}</p>
        </div>
      </div>

      <div class="test-section">
        <h2>使用示例代码</h2>
        <div class="code-example">
          <pre><code>&lt;!-- 基本使用 --&gt;
&lt;LottieAnimation
  imageSequencePath="/assets/animations/2秒/"
  :frameCount="121"
  :frameRate="30"
  :width="400"
  :height="300"
  :loop="true"
  :autoplay="true"
/&gt;

&lt;!-- 带控制面板 --&gt;
&lt;LottieAnimation
  imageSequencePath="/assets/animations/2秒/"
  :frameCount="121"
  :showControls="true"
  :width="600"
  :height="400"
/&gt;</code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import LottieAnimation from '@/components/LottieAnimation.vue'

// 响应式数据
const animationRef = ref()
const currentFrame = ref(0)
const isPlaying = ref(true)
const showEmbeddedControls = ref(true)
const selectedJson = ref(null)
const jsonFileInput = ref()
const enablePreload = ref(true)
const preloadFrames = ref(5)
const memoryUsage = ref('计算中...')

// 计算属性
const animationInstance = computed(() => animationRef.value?.$refs?.animationImage)

// 事件处理
const onAnimationLoad = (data: any) => {
  console.log('动画加载完成:', data)
}

const onAnimationError = (error: Error) => {
  console.error('动画加载错误:', error)
}

const onAnimationComplete = () => {
  console.log('动画播放完成')
}

const onFrameChange = (frame: number) => {
  currentFrame.value = frame
}

// 控制方法
const playAnimation = () => {
  animationRef.value?.play()
  isPlaying.value = true
}

const pauseAnimation = () => {
  animationRef.value?.pause()
  isPlaying.value = false
}

const restartAnimation = () => {
  animationRef.value?.restart()
  isPlaying.value = true
}

const toggleControls = () => {
  showEmbeddedControls.value = !showEmbeddedControls.value
  // 这里可以动态更新组件的showControls属性
  if (animationRef.value) {
    animationRef.value.showControls = showEmbeddedControls.value
  }
}

// 文件处理
const onJsonFileSelect = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    selectedJson.value = JSON.parse(text)
    console.log('Lottie JSON文件加载成功')
  } catch (error) {
    console.error('解析Lottie JSON文件失败:', error)
    selectedJson.value = null
  }
}

// 性能测试
const togglePreload = () => {
  if (animationRef.value) {
    animationRef.value.preloadFrames = enablePreload.value ? preloadFrames.value : 0
  }
}

const updatePreloadFrames = () => {
  if (enablePreload.value && animationRef.value) {
    animationRef.value.preloadFrames = preloadFrames.value
  }
}

const updateMemoryUsage = () => {
  if ('memory' in performance) {
    const memInfo = (performance as any).memory
    const usedMB = Math.round(memInfo.usedJSHeapSize / 1024 / 1024)
    const totalMB = Math.round(memInfo.totalJSHeapSize / 1024 / 1024)
    memoryUsage.value = `${usedMB}MB / ${totalMB}MB`
  } else {
    memoryUsage.value = '不支持'
  }
}

// 生命周期
onMounted(() => {
  // 定期更新内存使用信息
  setInterval(updateMemoryUsage, 1000)
})
</script>

<style scoped>
.lottie-test-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

h1 {
  color: #333;
  text-align: center;
  margin-bottom: 40px;
  font-size: 2.5rem;
}

.test-section {
  margin-bottom: 50px;
  padding: 25px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

h2 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-size: 1.5rem;
}

.animation-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 30px 0;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
}

.controls {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin: 20px 0;
  flex-wrap: wrap;
}

.btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn:hover {
  background: #0056b3;
}

.animation-info {
  background: #e8f4f8;
  padding: 15px;
  border-radius: 6px;
  margin-top: 20px;
}

.animation-info p {
  margin: 5px 0;
  color: #2c3e50;
}

.json-upload {
  display: flex;
  gap: 15px;
  align-items: center;
  margin: 20px 0;
}

.file-input {
  display: none;
}

.performance-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.performance-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.performance-info {
  background: #fff3cd;
  padding: 15px;
  border-radius: 6px;
  margin-top: 15px;
}

.code-example {
  background: #2d3748;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
}

.code-example code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .container {
    padding: 20px;
  }

  .controls {
    flex-direction: column;
    align-items: center;
  }

  .btn {
    width: 100%;
    max-width: 200px;
  }

  .animation-container {
    padding: 10px;
  }
}
</style>


