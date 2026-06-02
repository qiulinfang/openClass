<template>
  <Toolbar
    :tools="tools"
    variant="browser"
    :selected-tool="selectedTool"
    :tool-states="toolStates"
    :tool-config="toolConfig"
    :backgroundColor="backgroundColor"
    :allow-popup="allowPopup"
    @tool-change="(tool) => emit('tool-change', tool)"
    @config-change="(cfg) => emit('config-change', cfg)"
    @undo="emit('undo')"
    @redo="emit('redo')"
    @clear="emit('clear')"
    @back="handleBack"
    @search="emit('search')"
    @help="emit('help')"
  >
    <template #left-actions>
      <slot name="left">
        <BaseButton
          v-if="showBack"
          @click="handleBack"
          class="goback-btn"
          variant="ghost"
          size="sm"
        >
          <image :src="goBackIcon" mode="aspectFit" class="goback-icon" />
        </BaseButton>
      </slot>
    </template>
    <template #right-actions>
      <slot name="right"></slot>
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
import Toolbar from '../drawing/Toolbar.vue'
import BaseButton from '../base/Button.vue'
import goBackIcon from '/icons/goback.svg'

interface Props {
  tools: any
  selectedTool?: string
  toolStates?: Record<string, boolean>
  toolConfig?: any
  backgroundColor?: string
  showBack?: boolean
  allowPopup?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedTool: '',
  toolStates: () => ({}),
  toolConfig: () => ({}),
  backgroundColor: '#0A0020',
  showBack: true,
  allowPopup: true,
})

const emit = defineEmits<{
  'tool-change': [tool: string]
  'config-change': [config: any]
  undo: []
  redo: []
  clear: []
  back: []
  search: []
  help: []
}>()

const handleBack = () => {
  emit('back')
}
</script>

<style lang="scss" scoped>
.goback-btn {
  padding: 8px;
}

.goback-icon {
  width: 24px;
  height: 24px;
  display: block;
}

// 确保在 browser 模式下，Toolbar 能够填满宽度
:deep(.unified-toolbar-browser) {
  width: 100%;
}
</style>
