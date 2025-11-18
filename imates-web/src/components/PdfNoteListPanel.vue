<template>
  <q-slide-transition>
    <div v-if="visible" class="note-panel-container">
      <q-card class="note-panel-card">
        <q-card-section class="row items-center justify-between q-pa-sm">
          <div class="text-subtitle2">笔记列表</div>
          <q-btn dense flat round icon="close" @click="close" />
        </q-card-section>
        <q-separator />
        <q-card-section v-if="notes.length === 0" class="text-grey-5 q-pa-md">
          暂无笔记
        </q-card-section>
        <q-list v-else dense class="note-panel-list">
          <q-item v-for="note in notes" :key="note.id" clickable @click="handleSelect(note)">
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white" size="32px">
                {{ getAvatarLetter(note) }}
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="note-item-title">
                笔记 · 第 {{ note.pageIndex + 1 }} 页
              </q-item-label>
              <q-item-label class="note-item-subtitle" caption>
                {{ note.text }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="more_vert" size="18px" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>
  </q-slide-transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface PageNote {
  id: string
  pageIndex: number
  x: number
  y: number
  text: string
}

const props = defineProps<{
  visible: boolean
  notes: PageNote[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', note: PageNote): void
}>()

const close = () => {
  emit('update:visible', false)
}

const handleSelect = (note: PageNote) => {
  emit('select', note)
}

const getAvatarLetter = (note: PageNote) => {
  if (!note.text) return '记'
  return note.text.trim().charAt(0) || '记'
}
</script>

<style scoped>
.note-panel-container {
  height: 100%;
  display: flex;
  align-items: stretch;
  margin-left: auto;
}

.note-panel-card {
  width: 320px;
  max-width: 90vw;
  height: 100%;
  max-height: 100vh;
  border-radius: 0;
}

.note-panel-list {
  max-height: 60vh;
  overflow-y: auto;
}

.note-item-title {
  font-weight: 500;
  font-size: 13px;
}

.note-item-subtitle {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
