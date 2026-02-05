  <template>
  <div v-if="visible" class="debug-panel" @click.stop>
    <div class="debug-header">
      <span class="debug-title">FloatBubble Debug</span>
      <button class="debug-btn" type="button" @click.stop="emit('update:visible', false)">×</button>
    </div>

    <div class="debug-row">
      <label class="debug-label">side</label>
      <select v-model="local.side" class="debug-input" @change="commit">
        <option value="left">left</option>
        <option value="right">right</option>
      </select>
    </div>

    <div class="debug-row">
      <label class="debug-label">forceVisible</label>
      <input v-model="local.forceVisible" class="debug-checkbox" type="checkbox" @change="commit" />
    </div>

    <div class="debug-row">
      <label class="debug-label">disableOutsideClose</label>
      <input v-model="local.disableOutsideClose" class="debug-checkbox" type="checkbox" @change="commit" />
    </div>

    <div class="debug-grid">
      <div class="debug-row">
        <label class="debug-label">width</label>
        <input v-model.number="local.width" class="debug-input" type="number" min="80" step="1" @input="commit" />
      </div>
      <div class="debug-row">
        <label class="debug-label">height</label>
        <input v-model.number="local.height" class="debug-input" type="number" min="80" step="1" @input="commit" />
      </div>
      <div class="debug-row">
        <label class="debug-label">gap</label>
        <input v-model.number="local.gap" class="debug-input" type="number" min="0" step="1" @input="commit" />
      </div>
      <div class="debug-row">
        <label class="debug-label">padX</label>
        <input v-model.number="local.paddingX" class="debug-input" type="number" min="0" step="1" @input="commit" />
      </div>
      <div class="debug-row">
        <label class="debug-label">padY</label>
        <input v-model.number="local.paddingY" class="debug-input" type="number" min="0" step="1" @input="commit" />
      </div>
      <div class="debug-row">
        <label class="debug-label">offsetX</label>
        <input v-model.number="local.offsetX" class="debug-input" type="number" step="1" @input="commit" />
      </div>
      <div class="debug-row">
        <label class="debug-label">offsetY</label>
        <input v-model.number="local.offsetY" class="debug-input" type="number" step="1" @input="commit" />
      </div>
      <div class="debug-row">
        <label class="debug-label">zIndex</label>
        <input v-model.number="local.zIndex" class="debug-input" type="number" step="1" @input="commit" />
      </div>
    </div>

    <!-- 菜单项位置调节 -->
    <div class="debug-section">
      <div class="debug-section-title">Item Positions</div>
      <div v-for="(pos, index) in local.itemPositions" :key="index" class="debug-item-pos">
        <div class="debug-item-header">
          <span class="debug-item-label">Item {{ index + 1 }}</span>
        </div>
        <div class="debug-row">
          <label class="debug-label">X</label>
          <input v-model.number="pos.x" class="debug-input" type="number" step="1" @input="commit" />
        </div>
        <div class="debug-row">
          <label class="debug-label">Y</label>
          <input v-model.number="pos.y" class="debug-input" type="number" step="1" @input="commit" />
        </div>
        <div class="debug-row">
          <label class="debug-label">Rotate</label>
          <input
            v-model.number="local.itemRotations[index]"
            class="debug-input"
            type="number"
            step="1"
            @input="commit"
          />
        </div>
      </div>
    </div>
  </div>

  <button
    v-else
    class="debug-fab"
    type="button"
    @click.stop="emit('update:visible', true)"
  >
    DBG
  </button>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'

export type FloatBubbleDebugConfig = {
  side: 'left' | 'right'
  width: number
  height: number
  gap: number
  paddingX: number
  paddingY: number
  offsetX: number
  offsetY: number
  zIndex: number
  forceVisible: boolean
  disableOutsideClose: boolean
  itemPositions: { x: number; y: number }[]
  itemRotations: number[]
}

const props = defineProps<{
  visible: boolean
  debug: FloatBubbleDebugConfig
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'update:debug', v: FloatBubbleDebugConfig): void
}>()

const local = reactive<FloatBubbleDebugConfig>({
  ...props.debug,
  itemRotations: props.debug.itemRotations ?? props.debug.itemPositions.map(() => 0),
})

watch(
  () => props.debug,
  (v) => {
    Object.assign(local, v)
    if (!Array.isArray(local.itemRotations)) {
      local.itemRotations = []
    }
    if (local.itemRotations.length < local.itemPositions.length) {
      local.itemRotations = local.itemPositions.map((_, i) => local.itemRotations[i] ?? 0)
    }
  },
  { deep: true },
)

const commit = () => {
  emit('update:debug', { ...local })
}
</script>

<style scoped>
.debug-fab {
  position: absolute;
  top: -10px;
  z-index: 999;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(20, 20, 20, 0.7);
  color: #fff;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 8px;
}

.debug-panel {
  position: absolute;
  top: -200%;
  right: 300%;
  transform: translate(20px, -10px);
  width: 300px;
  z-index: 999;
  background: rgba(20, 20, 20, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  padding: 10px;
  color: #fff;
  font-size: 12px;
  backdrop-filter: blur(8px);
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.debug-title {
  font-weight: 600;
}

.debug-btn {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 16px;
  line-height: 1;
}

.debug-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.debug-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.debug-label {
  opacity: 0.9;
  white-space: nowrap;
}

.debug-input {
  width: 100px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #fff;
  padding: 4px 6px;
}

.debug-checkbox {
  width: 16px;
  height: 16px;
}

.debug-section {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.debug-section-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  opacity: 0.9;
}

.debug-item-pos {
  margin-bottom: 8px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.debug-item-header {
  margin-bottom: 4px;
}

.debug-item-label {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.8;
}
</style>
