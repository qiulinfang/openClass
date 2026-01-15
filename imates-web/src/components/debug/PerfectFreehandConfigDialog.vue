<template>
  <DraggableDialog
    v-model="visible"
    title="笔迹参数"
    :initial-width="460"
    :initial-height="520"
    :min-width="420"
    :min-height="420"
    title-align="left"
    header-background-color="#ffffff"
    :show-footer="true"
    :confirm-text="'关闭'"
    @confirm="visible = false"
    @cancel="visible = false"
  >
    <div class="pf-config-panel">
      <div class="pf-config-row">
        <div class="pf-config-label">
          风格
          <q-icon name="help_outline" size="16px" class="pf-config-help">
            <q-tooltip>
              预设是一组参数组合，用来快速得到不同笔迹感觉（例如钢笔更有笔锋、马克笔更均匀）。
            </q-tooltip>
          </q-icon>
        </div>
        <CommonSelect v-model="preset" :options="presetOptions" placeholder="自定义" />
        <div class="pf-config-desc">提示：选择预设会覆盖当前参数；如需微调，请选完预设后再手动调下面参数。</div>
      </div>

      <div class="pf-config-row">
        <div class="pf-config-label">
          Size
          <q-icon name="help_outline" size="16px" class="pf-config-help">
            <q-tooltip>
              笔迹粗细基准（单位约等于 px）。越大越粗；也会影响 taper 的视觉长度。
            </q-tooltip>
          </q-icon>
        </div>
        <q-slider v-model="size" :min="1" :max="40" :step="1" label />
        <div class="pf-config-desc">建议：细字 2-6；常规 6-12；粗笔 12-20。</div>
      </div>

      <div class="pf-config-row">
        <div class="pf-config-label">
          Thinning
          <q-icon name="help_outline" size="16px" class="pf-config-help">
            <q-tooltip>
              “速度/压力”对线宽变化的强度。0 表示几乎恒定线宽；越大笔锋变化越明显。
            </q-tooltip>
          </q-icon>
          
        </div>
        <q-slider v-model="thinning" :min="0" :max="1" :step="0.05" label />
        <div class="pf-config-desc">建议：想更像签字笔可调高（0.6-0.9）；想更稳定可调低（0-0.4）。</div>
      </div>

      <div class="pf-config-row">
        <div class="pf-config-label">
          Smoothing
          <q-icon name="help_outline" size="16px" class="pf-config-help">
            <q-tooltip>
              轮廓平滑度（对边缘“圆润”更明显）。越高越柔和，过高可能导致拐角变钝。
            </q-tooltip>
          </q-icon>
        </div>
        <q-slider v-model="smoothing" :min="0" :max="1" :step="0.05" label />
        <div class="pf-config-desc">建议：0.6-0.9。出现“糊/钝”可降一点。</div>
      </div>

      <div class="pf-config-row">
        <div class="pf-config-label">
          Streamline
          <q-icon name="help_outline" size="16px" class="pf-config-help">
            <q-tooltip>
              跟手/稳定权衡（输入点的“惯性/滞后”）。越高越稳但更跟不上；越低更跟手但更抖。
            </q-tooltip>
          </q-icon>
        </div>
        <q-slider v-model="streamline" :min="0" :max="1" :step="0.05" label />
        <div class="pf-config-desc">建议：0.75-0.95 更稳；0.4-0.7 更跟手。</div>
      </div>

      <div class="pf-config-row">
        <div class="pf-config-label">
          Taper
          <q-icon name="help_outline" size="16px" class="pf-config-help">
            <q-tooltip>
              起笔/收笔的渐细长度（与 size 一起决定“笔尖”效果）。越大起收笔越尖、越长。
            </q-tooltip>
          </q-icon>
        </div>
        <q-slider v-model="taper" :min="0" :max="40" :step="1" label />
        <div class="pf-config-desc">建议：0-6 更像马克笔；6-16 更像中性笔；过大可能拉长起收笔。</div>
      </div>

      <q-expansion-item dense label="高级参数" header-class="pf-adv-header">
        <div class="pf-config-row">
          <div class="pf-config-label">
            SimulatePressure
            <q-icon name="help_outline" size="16px" class="pf-config-help">
              <q-tooltip>
                是否在没有真实压感输入时自动“模拟压力”。开启后笔锋变化更明显；关闭后线宽更稳定。
              </q-tooltip>
            </q-icon>
          </div>
          <q-toggle v-model="simulatePressure" />
          <div class="pf-config-desc">建议：普通书写开启；做荧光笔/马克笔风格可关闭。</div>
        </div>

        <div class="pf-config-row">
          <div class="pf-config-label">
            Easing
            <q-icon name="help_outline" size="16px" class="pf-config-help">
              <q-tooltip>
                线宽/笔锋变化的“曲线形状”。linear 最自然；easeOut 更偏“收笔有力”；easeInOut 更柔和。
              </q-tooltip>
            </q-icon>
          </div>
          <CommonSelect v-model="easingName" :options="easingOptions" placeholder="linear" />
          <div class="pf-config-desc">建议：一般用 linear；想更有笔锋可试 easeOut。</div>
        </div>

        <div class="pf-config-row">
          <div class="pf-config-label">
            StartTaper
            <q-icon name="help_outline" size="16px" class="pf-config-help">
              <q-tooltip>
                起笔渐细长度（仅影响起笔）。数值越大起笔越尖、越长。
              </q-tooltip>
            </q-icon>
          </div>
          <q-slider v-model="startTaper" :min="0" :max="40" :step="1" label />
          <div class="pf-config-desc">建议：与 Taper 接近即可；想起笔更干脆可适当降低。</div>
        </div>
        <div class="pf-config-row">
          <div class="pf-config-label">
            EndTaper
            <q-icon name="help_outline" size="16px" class="pf-config-help">
              <q-tooltip>
                收笔渐细长度（仅影响收笔）。数值越大收笔越尖、越长。
              </q-tooltip>
            </q-icon>
          </div>
          <q-slider v-model="endTaper" :min="0" :max="40" :step="1" label />
          <div class="pf-config-desc">建议：写字通常略大于 StartTaper；画图可设为 0 让末端更平。</div>
        </div>
        <div class="pf-config-row">
          <div class="pf-config-label">
            StartCap
            <q-icon name="help_outline" size="16px" class="pf-config-help">
              <q-tooltip>
                起笔是否“封口/圆帽”。开启会让起点更圆润；关闭会更尖锐。
              </q-tooltip>
            </q-icon>
          </div>
          <q-toggle v-model="startCap" />
          <div class="pf-config-desc">建议：写字通常开启更自然；想要尖锐笔尖可关闭。</div>
        </div>
        <div class="pf-config-row">
          <div class="pf-config-label">
            EndCap
            <q-icon name="help_outline" size="16px" class="pf-config-help">
              <q-tooltip>
                收笔是否“封口/圆帽”。开启更圆润；关闭会更尖锐（搭配 taper 更像钢笔）。
              </q-tooltip>
            </q-icon>
          </div>
          <q-toggle v-model="endCap" />
          <div class="pf-config-desc">建议：写字开启更顺滑；要更尖锐的收笔可关闭并配合较大的 EndTaper。</div>
        </div>
      </q-expansion-item>

      <div class="pf-config-row pf-config-actions">
        <CommonActionButton label="重置默认" size="mdCompact" variant="outline" @click="$emit('reset')" />
      </div>
    </div>
  </DraggableDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DraggableDialog from '../dialog/DraggableDialog.vue'
import CommonActionButton from '../base/Button.vue'
import CommonSelect from '../base/Select.vue'

type PfConfig = {
  size: number
  thinning: number
  smoothing: number
  streamline: number
  taper: number
  startTaper: number
  endTaper: number
  startCap: boolean
  endCap: boolean
  simulatePressure: boolean
  easingName: string
}

const props = defineProps<{
  modelValue: boolean
  pfConfig: PfConfig
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:pfConfig', v: PfConfig): void
  (e: 'reset'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const update = (patch: Partial<PfConfig>) => {
  emit('update:pfConfig', { ...props.pfConfig, ...patch })
}

const presetOptions = [
  { label: '自定义', value: 'custom' },
  { label: '圆珠笔', value: 'ballpoint' },
  { label: '中性笔', value: 'gel' },
  { label: '钢笔', value: 'fountain' },
  { label: '马克笔', value: 'marker' },
  { label: '毛笔', value: 'brush' },
]

const easingOptions = [
  { label: 'linear', value: 'linear' },
  { label: 'easeIn', value: 'easeIn' },
  { label: 'easeOut', value: 'easeOut' },
  { label: 'easeInOut', value: 'easeInOut' },
]

const preset = ref('ballpoint')

watch(preset, (v) => {
  if (v === 'ballpoint') {
    emit('update:pfConfig', {
      ...props.pfConfig,
      thinning: 0.15,
      smoothing: 0.65,
      streamline: 0.7,
      taper: 0,
      startTaper: 0,
      endTaper: 0,
      startCap: true,
      endCap: true,
      simulatePressure: false,
      easingName: 'linear',
    })
    return
  }
  if (v === 'gel') {
    emit('update:pfConfig', {
      ...props.pfConfig,
      thinning: 0.6,
      smoothing: 0.8,
      streamline: 0.85,
      taper: 8,
      startTaper: 8,
      endTaper: 8,
      startCap: true,
      endCap: true,
      simulatePressure: true,
      easingName: 'linear',
    })
    return
  }
  if (v === 'fountain') {
    emit('update:pfConfig', {
      ...props.pfConfig,
      thinning: 0.8,
      smoothing: 0.85,
      streamline: 0.9,
      taper: 14,
      startTaper: 14,
      endTaper: 14,
      startCap: true,
      endCap: true,
      simulatePressure: true,
      easingName: 'easeOut',
    })
    return
  }
  if (v === 'marker') {
    emit('update:pfConfig', {
      ...props.pfConfig,
      thinning: 0.0,
      smoothing: 0.75,
      streamline: 0.8,
      taper: 0,
      startTaper: 0,
      endTaper: 0,
      startCap: true,
      endCap: true,
      simulatePressure: false,
      easingName: 'linear',
    })
    return
  }
  if (v === 'brush') {
    emit('update:pfConfig', {
      ...props.pfConfig,
      thinning: 0.9,
      smoothing: 0.9,
      streamline: 0.92,
      taper: 18,
      startTaper: 18,
      endTaper: 18,
      startCap: true,
      endCap: true,
      simulatePressure: true,
      easingName: 'easeInOut',
    })
    return
  }
})

const size = computed({
  get: () => props.pfConfig.size,
  set: (v: number) => update({ size: v }),
})

const thinning = computed({
  get: () => props.pfConfig.thinning,
  set: (v: number) => update({ thinning: v }),
})

const smoothing = computed({
  get: () => props.pfConfig.smoothing,
  set: (v: number) => update({ smoothing: v }),
})

const streamline = computed({
  get: () => props.pfConfig.streamline,
  set: (v: number) => update({ streamline: v }),
})

const taper = computed({
  get: () => props.pfConfig.taper,
  set: (v: number) => update({ taper: v }),
})

const startTaper = computed({
  get: () => props.pfConfig.startTaper,
  set: (v: number) => update({ startTaper: v }),
})

const endTaper = computed({
  get: () => props.pfConfig.endTaper,
  set: (v: number) => update({ endTaper: v }),
})

const startCap = computed({
  get: () => props.pfConfig.startCap,
  set: (v: boolean) => update({ startCap: v }),
})

const endCap = computed({
  get: () => props.pfConfig.endCap,
  set: (v: boolean) => update({ endCap: v }),
})

const simulatePressure = computed({
  get: () => props.pfConfig.simulatePressure,
  set: (v: boolean) => update({ simulatePressure: v }),
})

const easingName = computed({
  get: () => props.pfConfig.easingName,
  set: (v: string) => update({ easingName: v }),
})
</script>

<style scoped>
.pf-config-help {
  margin-left: 6px;
  color: #9aa0a6;
}

.pf-config-desc {
  margin-top: 6px;
  font-size: 12px;
  line-height: 16px;
  color: #6b6b6b;
}
</style>
