<template>
  <div class="debug-panel-wrapper" :class="{ expanded: isVisible }">
    <!-- 侧边栏面板 -->
    <q-card class="debug-panel-card">
      <!-- 头部 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">🔧 知识图谱调试面板</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="isVisible = false" />
      </q-card-section>

      <!-- 参数控制区域 -->
      <q-card-section>
        <!-- 椭圆半径参数 -->
        <q-expansion-item
          icon="radio_button_checked"
          label="椭圆轨迹参数"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- X轴半径 -->
            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="horizontal_rule" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">X轴半径 (radiusX)</div>
                  <div class="text-caption text-grey-7 q-mt-xs">控制椭圆轨迹的水平半径，影响节点在水平方向的运动范围</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.radiusX"
                :min="300"
                :max="1000"
                :step="10"
                label
                :label-value="`${localParams.radiusX}px`"
                color="primary"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusX"
                />
                <span class="text-caption text-grey-6">默认: 569px</span>
              </div>
            </div>

            <!-- Y轴半径 -->
            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="vertical_align_center" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">Y轴半径 (radiusY)</div>
                  <div class="text-caption text-grey-7 q-mt-xs">控制椭圆轨迹的垂直半径，影响节点在垂直方向的运动范围</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.radiusY"
                :min="200"
                :max="800"
                :step="10"
                label
                :label-value="`${localParams.radiusY}px`"
                color="primary"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusY"
                />
                <span class="text-caption text-grey-6">默认: 400px</span>
              </div>
            </div>
          </q-card-section>
        </q-expansion-item>

        <!-- 滑动灵敏度参数 -->
        <q-expansion-item
          icon="touch_app"
          label="滑动灵敏度参数"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 基础灵敏度倍数 -->
            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="tune" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">基础灵敏度倍数</div>
                  <div class="text-caption text-grey-7 q-mt-xs">控制普通滑动操作时节点的移动灵敏度，值越大响应越快</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.baseSensitivity"
                :min="0.5"
                :max="3.0"
                :step="0.1"
                label
                :label-value="`${localParams.baseSensitivity.toFixed(1)}x`"
                color="orange"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetBaseSensitivity"
                />
                <span class="text-caption text-grey-6">默认: 1.2x</span>
              </div>
            </div>

            <!-- 快速滑动灵敏度倍数 -->
            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="speed" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">快速滑动灵敏度倍数</div>
                  <div class="text-caption text-grey-7 q-mt-xs">控制快速滑动操作时节点的移动灵敏度，通常比基础灵敏度更高</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.fastSensitivity"
                :min="1.0"
                :max="5.0"
                :step="0.1"
                label
                :label-value="`${localParams.fastSensitivity.toFixed(1)}x`"
                color="orange"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetFastSensitivity"
                />
                <span class="text-caption text-grey-6">默认: 1.8x</span>
              </div>
            </div>

            <!-- 滑动速度阈值 -->
            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="threshold" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">滑动速度阈值 (像素/毫秒)</div>
                  <div class="text-caption text-grey-7 q-mt-xs">判断滑动是否为快速滑动的速度标准，超过此值将使用快速灵敏度</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.swipeThreshold"
                :min="0.1"
                :max="2.0"
                :step="0.1"
                label
                :label-value="`${localParams.swipeThreshold.toFixed(1)} px/ms`"
                color="orange"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetSwipeThreshold"
                />
                <span class="text-caption text-grey-6">默认: 0.5 px/ms</span>
              </div>
            </div>
          </q-card-section>
        </q-expansion-item>

        <!-- 拖拽参数 -->
        <q-expansion-item
          icon="pan_tool"
          label="拖拽参数"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 拖拽阈值 -->
            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="gesture" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">拖拽阈值 (像素)</div>
                  <div class="text-caption text-grey-7 q-mt-xs">判断是否为拖拽操作的最小移动距离，小于此值的移动将被忽略</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.dragThreshold"
                :min="1"
                :max="20"
                :step="1"
                label
                :label-value="`${localParams.dragThreshold}px`"
                color="purple"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetDragThreshold"
                />
                <span class="text-caption text-grey-6">默认: 3px</span>
              </div>
            </div>
          </q-card-section>
        </q-expansion-item>

        <!-- 背景半径参数 -->
        <q-expansion-item
          icon="brightness_1"
          label="背景圆形参数"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 最小背景半径 -->
            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="crop_square" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">最小背景半径 (像素)</div>
                  <div class="text-caption text-grey-7 q-mt-xs">节点背景圆形的最小显示半径，确保节点始终可见且易于交互</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.minBackgroundRadius"
                :min="80"
                :max="200"
                :step="5"
                label
                :label-value="`${localParams.minBackgroundRadius}px`"
                color="teal"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetMinBackgroundRadius"
                />
                <span class="text-caption text-grey-6">默认: 120px</span>
              </div>
            </div>

            <!-- 背景半径缩放因子 -->
            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="zoom_out_map" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">节点数 ≤ 2 时的半径缩放</div>
                  <div class="text-caption text-grey-7 q-mt-xs">当知识图谱中节点数量较少（≤2个）时，背景半径的缩放比例</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.radiusScaleSmall"
                :min="0.5"
                :max="1.2"
                :step="0.05"
                label
                :label-value="`${(localParams.radiusScaleSmall * 100).toFixed(0)}%`"
                color="teal"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusScaleSmall"
                />
                <span class="text-caption text-grey-6">默认: 80%</span>
              </div>
            </div>

            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="zoom_out_map" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">节点数 3-4 时的半径缩放</div>
                  <div class="text-caption text-grey-7 q-mt-xs">当知识图谱中节点数量中等（3-4个）时，背景半径的缩放比例</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.radiusScaleMedium"
                :min="0.8"
                :max="1.5"
                :step="0.05"
                label
                :label-value="`${(localParams.radiusScaleMedium * 100).toFixed(0)}%`"
                color="teal"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusScaleMedium"
                />
                <span class="text-caption text-grey-6">默认: 100%</span>
              </div>
            </div>

            <div class="q-mb-md">
              <div class="row items-center q-mb-sm">
                <q-icon name="zoom_out_map" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2">节点数 > 4 时的半径缩放</div>
                  <div class="text-caption text-grey-7 q-mt-xs">当知识图谱中节点数量较多（>4个）时，背景半径的缩放比例</div>
                </div>
              </div>
              <q-slider
                v-model="localParams.radiusScaleLarge"
                :min="0.9"
                :max="1.6"
                :step="0.05"
                label
                :label-value="`${(localParams.radiusScaleLarge * 100).toFixed(0)}%`"
                color="teal"
                @update:model-value="updateParams"
              />
              <div class="row justify-between q-mt-xs">
                <q-btn
                  flat
                  dense
                  size="sm"
                  label="重置"
                  @click="resetRadiusScaleLarge"
                />
                <span class="text-caption text-grey-6">默认: 110%</span>
              </div>
            </div>
          </q-card-section>
        </q-expansion-item>

        <!-- 操作按钮 -->
        <q-card-section class="q-pt-md">
          <div class="row q-gutter-sm">
            <q-btn
              outline
              color="primary"
              icon="refresh"
              label="重置所有参数"
              @click="resetAllParams"
              size="sm"
            />
            <q-btn
              outline
              color="secondary"
              icon="save"
              label="保存到本地"
              @click="saveToLocalStorage"
              size="sm"
            />
            <q-btn
              outline
              color="positive"
              icon="restore"
              label="从本地加载"
              @click="loadFromLocalStorage"
              size="sm"
            />
          </div>
        </q-card-section>

        <!-- 当前参数显示 -->
        <q-separator class="q-my-md" />
        <q-card-section>
          <q-banner class="bg-info text-white" rounded>
            <template v-slot:avatar>
              <q-icon name="info" size="md" />
            </template>
            <div class="text-subtitle2">当前参数值</div>
            <div class="text-caption">
              radiusX: {{ localParams.radiusX }}px | 
              radiusY: {{ localParams.radiusY }}px<br/>
              基础灵敏度: {{ localParams.baseSensitivity.toFixed(1) }}x | 
              快速灵敏度: {{ localParams.fastSensitivity.toFixed(1) }}x<br/>
              拖拽阈值: {{ localParams.dragThreshold }}px | 
              滑动阈值: {{ localParams.swipeThreshold.toFixed(1) }} px/ms
            </div>
          </q-banner>
        </q-card-section>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

// 定义参数接口
export interface KnowledgeGraphDebugParams {
  radiusX: number
  radiusY: number
  baseSensitivity: number
  fastSensitivity: number
  swipeThreshold: number
  dragThreshold: number
  minBackgroundRadius: number
  radiusScaleSmall: number
  radiusScaleMedium: number
  radiusScaleLarge: number
}

// Props
interface Props {
  modelValue: boolean
  params?: Partial<KnowledgeGraphDebugParams>
}

const props = withDefaults(defineProps<Props>(), {
  params: () => ({})
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:params': [params: KnowledgeGraphDebugParams]
}>()

// 默认参数值
const defaultParams: KnowledgeGraphDebugParams = {
  radiusX: 569,
  radiusY: 400,
  baseSensitivity: 1.2,
  fastSensitivity: 1.8,
  swipeThreshold: 0.5,
  dragThreshold: 3,
  minBackgroundRadius: 120,
  radiusScaleSmall: 0.8,
  radiusScaleMedium: 1.0,
  radiusScaleLarge: 1.1
}

// 响应式数据
const isVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const localParams = ref<KnowledgeGraphDebugParams>({
  ...defaultParams,
  ...props.params
})

// 监听外部参数变化
watch(() => props.params, (newParams) => {
  if (newParams && Object.keys(newParams).length > 0) {
    localParams.value = { ...localParams.value, ...newParams }
  }
}, { deep: true })

// 更新参数并通知父组件
const updateParams = () => {
  emit('update:params', { ...localParams.value })
}

// 重置函数
const resetRadiusX = () => {
  localParams.value.radiusX = defaultParams.radiusX
  updateParams()
}

const resetRadiusY = () => {
  localParams.value.radiusY = defaultParams.radiusY
  updateParams()
}

const resetBaseSensitivity = () => {
  localParams.value.baseSensitivity = defaultParams.baseSensitivity
  updateParams()
}

const resetFastSensitivity = () => {
  localParams.value.fastSensitivity = defaultParams.fastSensitivity
  updateParams()
}

const resetSwipeThreshold = () => {
  localParams.value.swipeThreshold = defaultParams.swipeThreshold
  updateParams()
}

const resetDragThreshold = () => {
  localParams.value.dragThreshold = defaultParams.dragThreshold
  updateParams()
}

const resetMinBackgroundRadius = () => {
  localParams.value.minBackgroundRadius = defaultParams.minBackgroundRadius
  updateParams()
}

const resetRadiusScaleSmall = () => {
  localParams.value.radiusScaleSmall = defaultParams.radiusScaleSmall
  updateParams()
}

const resetRadiusScaleMedium = () => {
  localParams.value.radiusScaleMedium = defaultParams.radiusScaleMedium
  updateParams()
}

const resetRadiusScaleLarge = () => {
  localParams.value.radiusScaleLarge = defaultParams.radiusScaleLarge
  updateParams()
}

const resetAllParams = () => {
  localParams.value = { ...defaultParams }
  updateParams()
}

// 保存到本地存储
const saveToLocalStorage = () => {
  try {
    localStorage.setItem('knowledgeGraphDebugParams', JSON.stringify(localParams.value))
    console.log('✅ 参数已保存到本地存储')
  } catch (error) {
    console.error('❌ 保存参数失败:', error)
  }
}

// 从本地存储加载
const loadFromLocalStorage = () => {
  try {
    const saved = localStorage.getItem('knowledgeGraphDebugParams')
    if (saved) {
      const parsed = JSON.parse(saved)
      localParams.value = { ...defaultParams, ...parsed }
      updateParams()
      console.log('✅ 参数已从本地存储加载')
    } else {
      console.log('ℹ️ 本地存储中没有保存的参数')
    }
  } catch (error) {
    console.error('❌ 加载参数失败:', error)
  }
}

// 组件挂载时尝试从本地存储加载
onMounted(() => {
  loadFromLocalStorage()
})
</script>

<style lang="scss" scoped>
.debug-panel-wrapper {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  z-index: 3000;
  display: flex;
  align-items: center;
  
  .debug-panel-card {
    width: 380px;
    max-width: calc(100vw - 60px);
    height: 100%;
    border-radius: 0;
    border-right: 1px solid rgba(0, 0, 0, 0.12);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
    overflow-y: auto;
    transition: transform 0.3s ease-in-out;
    transform: translateX(-100%);
    
    // 展开状态
    .expanded & {
      transform: translateX(0);
    }
  }
  
  // 展开状态时面板完全显示
  &.expanded .debug-panel-card {
    transform: translateX(0);
  }
  
}

// 展开状态时隐藏切换按钮
.debug-panel-wrapper.expanded .debug-panel-toggle {
  display: none;
}

:deep(.q-expansion-item__header) {
  font-weight: 500;
}

:deep(.q-slider__track) {
  height: 8px;
}

:deep(.q-slider__thumb) {
  width: 20px;
  height: 20px;
}
</style>
