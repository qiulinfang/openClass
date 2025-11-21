<template>
  <div class="newgrap-debug-panel" v-if="modelValue">
    <div class="header">
      <span>NewGrap 调试面板</span>
      <button class="close-btn" @click="$emit('update:modelValue', false)">×</button>
    </div>
    <div class="content">
      <div class="section">
        <h4>轨道参数</h4>
        <label>
          <span class="param-name">轨道横向半径</span>
          <span class="param-desc">orbitRadiusX: 椭圆轨道的X轴半径</span>
          <input type="number" v-model.number="localParams.orbitRadiusX" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">轨道纵向半径</span>
          <span class="param-desc">orbitRadiusY: 椭圆轨道的Y轴半径</span>
          <input type="number" v-model.number="localParams.orbitRadiusY" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">轨道中心X偏移</span>
          <span class="param-desc">orbitCenterXOffset: 轨道中心相对于容器右边界的偏移</span>
          <input type="number" v-model.number="localParams.orbitCenterXOffset" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">轨道中心Y偏移</span>
          <span class="param-desc">orbitCenterYOffset: 轨道中心相对于容器中心的偏移</span>
          <input type="number" v-model.number="localParams.orbitCenterYOffset" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">聚焦角度</span>
          <span class="param-desc">focusAngle: 聚焦时目标位置的角度（弧度，3.14≈左侧，0≈右侧）</span>
          <input type="number" step="0.1" v-model.number="localParams.focusAngle" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">旋转速度</span>
          <span class="param-desc">rotationSpeed: 月球绕轨道旋转的速度</span>
          <input type="number" step="0.01" v-model.number="localParams.rotationSpeed" @change="emitChange" />
        </label>
      </div>

      <div class="section">
        <h4>月球参数</h4>
        <label>
          <span class="param-name">月球基础半径</span>
          <span class="param-desc">moonRadiusBase: 普通状态下月球的半径</span>
          <input type="number" v-model.number="localParams.moonRadiusBase" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">月球聚焦半径</span>
          <span class="param-desc">moonRadiusFocusBase: 聚焦状态下月球的半径</span>
          <input type="number" v-model.number="localParams.moonRadiusFocusBase" @change="emitChange" />
        </label>
      </div>

      <div class="section">
        <h4>卫星参数</h4>
        <label>
          <span class="param-name">卫星聚焦半径</span>
          <span class="param-desc">satelliteRadiusFocus: 聚焦状态下卫星圆点的半径</span>
          <input type="number" v-model.number="localParams.satelliteRadiusFocus" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">卫星基础距离</span>
          <span class="param-desc">satelliteDistBase: 卫星距离月球的基础距离</span>
          <input type="number" v-model.number="localParams.satelliteDistBase" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">每个卫星轨道增长量</span>
          <span class="param-desc">satelliteOrbitGrowthPerSat: 每增加一个卫星，轨道半径增加的量</span>
          <input type="number" v-model.number="localParams.satelliteOrbitGrowthPerSat" @change="emitChange" />
        </label>
      </div>

      <div class="section">
        <h4>指示器参数</h4>
        <label>
          <span class="param-name">指示器右边距</span>
          <span class="param-desc">indicatorRightMargin: 指示器距离右边的距离</span>
          <input type="number" v-model.number="localParams.indicatorRightMargin" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">指示器间距</span>
          <span class="param-desc">indicatorGap: 指示器圆点之间的间距</span>
          <input type="number" v-model.number="localParams.indicatorGap" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">指示器半径</span>
          <span class="param-desc">indicatorRadius: 普通状态指示器圆点半径</span>
          <input type="number" v-model.number="localParams.indicatorRadius" @change="emitChange" />
        </label>
        <label>
          <span class="param-name">激活指示器半径</span>
          <span class="param-desc">indicatorActiveRadius: 激活状态指示器圆点半径</span>
          <input type="number" v-model.number="localParams.indicatorActiveRadius" @change="emitChange" />
        </label>
      </div>

      <div class="section actions">
        <button @click="reset">重置为默认</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'

export interface NewGrapDebugParams {
  orbitRadiusX: number
  orbitRadiusY: number
  orbitCenterXOffset: number
  orbitCenterYOffset: number
  focusAngle: number
  rotationSpeed: number
  moonRadiusBase: number
  moonRadiusFocusBase: number
  satelliteDistBase: number
  satelliteOrbitGrowthPerSat: number
  satelliteRadiusFocus: number
  indicatorRightMargin: number
  indicatorGap: number
  indicatorRadius: number
  indicatorActiveRadius: number
}

const props = defineProps<{
  modelValue: boolean
  params: NewGrapDebugParams
  defaultParams: NewGrapDebugParams
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:params', value: NewGrapDebugParams): void
}>()

const localParams = reactive<NewGrapDebugParams>({ ...props.params })

watch(
  () => props.params,
  (val) => {
    Object.assign(localParams, val)
  },
  { deep: true }
)

const emitChange = () => {
  emit('update:params', { ...localParams })
}

const reset = () => {
  Object.assign(localParams, props.defaultParams)
  emitChange()
}
</script>

<style scoped>
.newgrap-debug-panel {
  position: fixed;
  left: 16px;
  bottom: 16px;
  width: 320px;
  max-height: 80vh;
  background: rgba(0, 0, 0, 1);
  color: #fff;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  overflow: auto;
  z-index: 9999;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.close-btn {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
}

.section {
  margin-bottom: 8px;
}

.section h4 {
  margin: 4px 0;
  font-size: 12px;
}

.section label {
  display: flex;
  flex-direction: column;
  margin: 6px 0;
  gap: 2px;
}

.param-name {
  font-weight: bold;
  color: #4fc3f7;
  font-size: 11px;
}

.param-desc {
  color: #aaa;
  font-size: 10px;
  line-height: 1.3;
}

.section input[type='number'] {
  width: 100%;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid #555;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.section.actions {
  display: flex;
  justify-content: flex-end;
}

.section.actions button {
  font-size: 12px;
}
</style>
