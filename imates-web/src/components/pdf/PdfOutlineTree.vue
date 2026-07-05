<template>
  <q-list dense class="pdf-outline-list">
    <template v-for="(item, idx) in items" :key="idx">
      <!-- 如果有子目录层级，使用 q-expansion-item 展开 -->
      <q-expansion-item
        v-if="item.children && item.children.length > 0"
        dense
        dense-toggle
        :default-opened="item.open"
        class="outline-expansion-node"
      >
        <template #header>
          <div class="outline-item-row" @click.stop="handleSelect(item)">
            <span class="outline-item-title">{{ item.title }}</span>
            <span v-if="item.page !== null" class="outline-item-page">P.{{ item.page + 1 }}</span>
          </div>
        </template>
        
        <div class="outline-item-children">
          <PdfOutlineTree :items="item.children" @select="handleSelect" />
        </div>
      </q-expansion-item>
      
      <!-- 如果是叶子项直接展示 -->
      <q-item
        v-else
        clickable
        v-close-popup
        @click="handleSelect(item)"
        class="outline-item-leaf"
      >
        <q-item-section>
          <div class="outline-item-row">
            <span class="outline-item-title">{{ item.title }}</span>
            <span v-if="item.page !== null" class="outline-item-page">P.{{ item.page + 1 }}</span>
          </div>
        </q-item-section>
      </q-item>
    </template>
  </q-list>
</template>

<script setup lang="ts">
import PdfOutlineTree from './PdfOutlineTree.vue'

interface OutlineItem {
  title: string
  page: number | null
  uri?: string
  open?: boolean
  children?: OutlineItem[]
}

defineProps<{
  items: OutlineItem[]
}>()

const emit = defineEmits<{
  (e: 'select', item: OutlineItem): void
}>()

const handleSelect = (item: OutlineItem) => {
  emit('select', item)
}
</script>

<style scoped lang="scss">
.pdf-outline-list {
  padding: 0;
  width: 100%;
}
.outline-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 4px 0;
}
.outline-item-title {
  font-size: 13.5px;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  text-align: left;
}
.outline-item-page {
  font-size: 11px;
  color: #64748b;
  margin-left: 8px;
  font-weight: 600;
}
.outline-item-children {
  padding-left: 10px;
  border-left: 1px dashed #e2e8f0;
  margin-left: 16px;
  margin-bottom: 2px;
}
.outline-expansion-node {
  border-radius: 6px;
  margin: 1px 4px;
  :deep(.q-item) {
    padding: 6px 8px;
    min-height: 32px;
  }
}
.outline-item-leaf {
  padding: 6px 12px;
  min-height: 32px;
  border-radius: 6px;
  margin: 1px 4px;
  &:hover {
    background-color: #f1f5f9;
  }
}
</style>
