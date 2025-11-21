<template>
  <div class="note-panel-container">
    <div class="note-panel-scroll-wrapper">
      <!-- 列表滚动区域：使用 RubberBandList 实现橡皮筋滚动 -->
      <RubberBandList>
        <div class="note-panel-scroll-content">
          <q-card-section v-if="notes.length === 0" class="text-grey-5 q-pa-md">
            暂无笔记
          </q-card-section>
          <q-list v-else dense>
            <q-item
              v-for="note in notes"
              :key="note.id"
              clickable
              @click="handleSelect(note)"
              :class="['note-item', { 'note-item--active': note.id === selectedNoteId }]"
            >
              <!-- 左侧头像：姓名首字（使用 div 实现） -->
              <q-item-section avatar>
                <div class="note-avatar">
                  {{ getAvatarLetter(note) }}
                </div>
              </q-item-section>
              <q-item-section>
                <q-item-label class="note-item-meta">
                  <span class="note-item-author">{{ getAuthorName(note) }}</span>
                  <span class="note-item-separator"> - </span>
                  <span class="note-item-time">{{ formatNoteTime(note) }}</span>
                </q-item-label>
                <q-item-label class="note-item-content">
                  {{ note.text }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat round dense icon="more_vert">
                  <q-menu>
                    <q-list dense>
                      <q-item
                        clickable
                        @click.stop="() => { handleSelect(note); handleDelete(note) }"
                      >
                        <q-item-section>删除</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </RubberBandList>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RubberBandList from './RubberBandList.vue'

interface PageNote {
  id: string
  pageIndex: number
  x: number
  y: number
  text: string
  createdAt?: string | number
}

const props = defineProps<{
  // 笔记数据列表，由父组件提供
  notes: PageNote[]
  // 当前选中的笔记 ID（可选）
  selectedNoteId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', note: PageNote): void
  (e: 'delete', note: PageNote): void
}>()

const handleDelete = (note: PageNote) => {
  emit('delete', note)
}

// 列表滚动已改为使用 RubberBandList 橡皮筋滚动效果，不再依赖 BetterScroll
const handleSelect = (note: PageNote) => {
  emit('select', note)
}

const getAuthorName = (note: PageNote) => {
  try {
    const raw = localStorage.getItem('userInfo')
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return parsed?.name || ''
  } catch {
    return ''
  }
}

const getAvatarLetter = (note: PageNote) => {
  const name = getAuthorName(note)
  if (name && name.trim()) {
    return name.trim().charAt(0)
  }
  return '记'
}

const formatNoteTime = (note: PageNote) => {
  const ts = typeof note.createdAt === 'string' ? Number(note.createdAt) : note.createdAt
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${month}月${day}日 ${hh}:${mm}`
}
</script>

<style scoped>
.note-panel-container {
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  margin-left: auto;
  background-color: #fff;
}

.note-panel-scroll-wrapper {
  flex: 1;
  overflow: hidden;
}

.note-panel-scroll-content {
  min-height: 101%;
}

.note-panel-list .q-item {
  padding-top: 6px;
  padding-bottom: 6px;
}

.note-item-title {
  font-weight: 500;
  font-size: 13px;
}

.note-item-meta {
  font-size: 12px;
  line-height: 16px;
  color: #202124;
}

.note-item-author {
  font-weight: 500;
}

.note-item-separator {
  margin: 0 2px;
  color: #9aa0a6;
}

.note-item-time {
  color: #9aa0a6;
  font-size: 12px;
}

.note-item-content {
  font-size: 13px;
  line-height: 18px;
  color: #202124;
  margin-top: 2px;
  white-space: pre-wrap;
}

.note-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #6366f1;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.note-item {
  padding: 18px;
}

.note-item--active {
  background-color: #f3e8ff;
}
</style>
