<template>
  <q-dialog v-model="isOpen" position="standard" @hide="handleClose">
    <q-card 
      class="draggable-dialog-card"
      :style="dialogStyle"
      @mousemove="handleDrag"
      @mouseup="stopDrag"
      @touchmove="handleDrag"
      @touchend="stopDrag"
    >
      <q-card-section 
        class="dialog-header-section draggable-header"
        @mousedown.prevent="startDrag"
        @touchstart.prevent="startDrag"
      >
        <div class="text-h6">{{ title }}</div>
        <q-btn flat round dense icon="close" @click="handleClose" />
      </q-card-section>

      <q-card-section class="dialog-content-section">
        <slot></slot>
      </q-card-section>

      <div 
        class="resize-handle"
        @mousedown.prevent.stop="startResize"
        @touchstart.prevent.stop="startResize"
      ></div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  modelValue: boolean
  title: string
  initialWidth?: number
  initialHeight?: number
  minWidth?: number
  minHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  initialWidth: 800,
  initialHeight: 600,
  minWidth: 400,
  minHeight: 300
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const dialogPosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const dialogSize = ref({ width: props.initialWidth, height: props.initialHeight })
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

const dialogStyle = computed(() => ({
  transform: `translate(${dialogPosition.value.x}px, ${dialogPosition.value.y}px)`,
  width: `${dialogSize.value.width}px`,
  height: `${dialogSize.value.height}px`
}))

const startDrag = (event: MouseEvent | TouchEvent) => {
  isDragging.value = true
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  dragOffset.value = {
    x: clientX - dialogPosition.value.x,
    y: clientY - dialogPosition.value.y
  }
}

const handleDrag = (event: MouseEvent | TouchEvent) => {
  if (isDragging.value) {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
    
    dialogPosition.value = {
      x: clientX - dragOffset.value.x,
      y: clientY - dragOffset.value.y
    }
  } else if (isResizing.value) {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
    
    const deltaX = clientX - resizeStart.value.x
    const deltaY = clientY - resizeStart.value.y
    
    const newWidth = Math.max(props.minWidth, resizeStart.value.width + deltaX)
    const newHeight = Math.max(props.minHeight, resizeStart.value.height + deltaY)
    
    dialogSize.value = {
      width: Math.min(newWidth, window.innerWidth * 0.9),
      height: Math.min(newHeight, window.innerHeight * 0.9)
    }
  }
}

const stopDrag = () => {
  isDragging.value = false
  isResizing.value = false
}

const startResize = (event: MouseEvent | TouchEvent) => {
  isResizing.value = true
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  resizeStart.value = {
    x: clientX,
    y: clientY,
    width: dialogSize.value.width,
    height: dialogSize.value.height
  }
}

const handleClose = () => {
  isOpen.value = false
}

watch(isOpen, (newValue) => {
  if (newValue) {
    dialogSize.value = { width: props.initialWidth, height: props.initialHeight }
    dialogPosition.value = { x: 0, y: 0 }
  }
})
</script>

<style lang="scss" scoped>
.draggable-dialog-card {
  max-width: 90vw;
  max-height: 90vh;
  transition: transform 0.1s ease-out;
  position: relative;
  display: flex;
  flex-direction: column;
  
  .dialog-header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: rgba(144, 89, 255, 0.2);
    border-bottom: 1px solid rgba(144, 89, 255, 0.3);
    
    &.draggable-header {
      cursor: move;
      user-select: none;
    }
  }
  
  .dialog-content-section {
    flex: 1;
    padding: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  
  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
    z-index: 10;
    
    &::after {
      content: '';
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 12px;
      height: 12px;
      border-right: 2px solid rgba(144, 89, 255, 0.6);
      border-bottom: 2px solid rgba(144, 89, 255, 0.6);
    }
    
    &:hover::after {
      border-color: rgba(144, 89, 255, 1);
    }
  }
}
</style>

