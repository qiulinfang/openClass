<template>
  <div class="pdf-gesture-debug-panel">
    <div class="panel-header">
      <div class="title">PDF 手势调试</div>
    </div>
    <div class="panel-body">
      <div class="field">
        <label>最小缩放倍数</label>
        <input type="number" step="0.05" v-model.number="localMinScale" @change="emitMinScale" />
        <p class="hint">数值越小，页面可以缩得越小（看到更大范围）；数值越大，最小缩小比例越受限制。</p>
      </div>
      <div class="field">
        <label>最大缩放倍数</label>
        <input type="number" step="0.1" v-model.number="localMaxScale" @change="emitMaxScale" />
        <p class="hint">数值越大，可以放得越大（细节更清晰）；数值越小，最大放大倍数越受限制。</p>
      </div>
      <div class="field">
        <label>缩放判定阈值 (比例变化)</label>
        <input type="number" step="0.01" v-model.number="localZoomThreshold" @change="emitZoomThreshold" />
        <p class="hint">数值越大，捏合动作需要更明显才会触发缩放（不易误触）；数值越小，轻微捏合就会开始缩放。</p>
      </div>
      <div class="field">
        <label>拖动判定阈值 (像素)</label>
        <input type="number" step="1" v-model.number="localPanThreshold" @change="emitPanThreshold" />
        <p class="hint">数值越大，需要滑动更长距离才识别为拖动；数值越小，轻微滑动就会开始滚动。</p>
      </div>
      <div class="field">
        <label>惯性摩擦 (越大越快停)</label>
        <input type="number" step="0.0005" v-model.number="localFriction" @change="emitFriction" />
        <p class="hint">数值越大，惯性滑动更快停下；数值越小，惯性更长、更“顺滑”。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  minScale: number
  maxScale: number
  zoomThreshold: number
  panThreshold: number
  friction: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:minScale', value: number): void
  (e: 'update:maxScale', value: number): void
  (e: 'update:zoomThreshold', value: number): void
  (e: 'update:panThreshold', value: number): void
  (e: 'update:friction', value: number): void
}>()

const localMinScale = ref(props.minScale)
const localMaxScale = ref(props.maxScale)
const localZoomThreshold = ref(props.zoomThreshold)
const localPanThreshold = ref(props.panThreshold)
const localFriction = ref(props.friction)

watch(
  () => props.minScale,
  v => {
    localMinScale.value = v
  },
)

watch(
  () => props.maxScale,
  v => {
    localMaxScale.value = v
  },
)

watch(
  () => props.zoomThreshold,
  v => {
    localZoomThreshold.value = v
  },
)

watch(
  () => props.panThreshold,
  v => {
    localPanThreshold.value = v
  },
)

watch(
  () => props.friction,
  v => {
    localFriction.value = v
  },
)

const emitMinScale = () => {
  emit('update:minScale', localMinScale.value)
}

const emitMaxScale = () => {
  emit('update:maxScale', localMaxScale.value)
}

const emitZoomThreshold = () => {
  emit('update:zoomThreshold', localZoomThreshold.value)
}

const emitPanThreshold = () => {
  emit('update:panThreshold', localPanThreshold.value)
}

const emitFriction = () => {
  emit('update:friction', localFriction.value)
}
</script>

<style scoped>
.pdf-gesture-debug-panel {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 2000;
  width: 260px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px 10px;
  font-size: 12px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.title {
  font-size: 13px;
  font-weight: 600;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.field label {
  opacity: 0.85;
}

.hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.75;
}

.field input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 12px;
}

.field input:focus {
  outline: none;
  border-color: #00bcd4;
}
</style>
