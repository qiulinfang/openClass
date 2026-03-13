<template>
  <div
    class="session-item"
    :class="{
      'is-selected': isSelected,
      'is-checked': isChecked,
      'is-selectable': isSelectionMode,
      'is-pinned': record.pinned,
    }"
  >
    <!-- 批量选择复选框 -->
    <div v-if="isSelectionMode" class="session-checkbox">
      <q-checkbox
        :model-value="isChecked"
        @update:model-value="$emit('checkbox-change', $event)"
        color="primary"
        size="sm"
      />
    </div>
    <!-- 会话内容 -->
    <div
      class="session-content"
      @click="$emit('click')"
      @contextmenu.prevent="$emit('contextmenu')"
    >
      <!-- 会话缩略图 -->
      <div
        v-if="record.thumbnailImage"
        :class="[
          'session-thumbnail',
          {
            'thumbnail-is-selected': isSelected,
          },
        ]"
        @click.stop="handleThumbnailClick"
      >
        <q-img
          :src="record.thumbnailImage"
          :ratio="210 / 122"
          fit="cover"
          class="thumbnail-image"
        />
        <div class="thumbnail-overlay">
          <q-icon name="zoom_in" size="20px" />
        </div>
      </div>
      <!-- 标题和答案区域 -->
      <div class="session-header">
        <!-- 会话标题 -->
        <div class="session-title-row">
          <div class="session-title">{{ recordName }}</div>
        </div>
        <!-- 会话答案 -->
        <div v-if="record.answer" class="session-subtitle">
          {{ truncatedAnswer }}
        </div>
      </div>
    </div>
    <!-- 状态图标（收藏和置顶，始终显示） -->
    <div class="session-status-icons">
      <!-- 置顶图标 -->
      <img v-if="record.pinned" :src="pinIcon" alt="已置顶" class="status-icon pin-icon" />
    </div>
    <!-- 操作按钮 -->
    <div class="session-actions">
      <!-- 更多按钮 -->
      <BubblePopup v-model="showMoreMenu" placement="bottom" :offset="8" :show-arrow="false">
        <template #trigger>
          <q-btn flat round dense icon="more_horiz" size="sm" class="more-btn" />
        </template>

        <!-- 置顶 -->
        <div class="more-menu-item-row" @click="closeMenuAndExecute(() => $emit('pin'))">
          <img :src="record.pinned ? pinOutlinedIcon : pinIcon" alt="置顶" width="18" height="18" />
          <div>{{ record.pinned ? '取消置顶' : '置顶' }}</div>
        </div>

        <!-- 收藏 -->
        <div class="session-more-menu-divider"></div>

        <!-- 删除 -->
        <div class="session-more-menu-delete-wrapper">
          <div class="more-menu-item-row" @click="closeMenuAndExecute(() => $emit('delete'))">
            <img :src="deleteIcon" alt="删除" width="18" height="18" />
            <div class="text-delete">删除</div>
          </div>
        </div>
      </BubblePopup>
    </div>

    <!-- 图片预览对话框 -->
    <ImageViewer v-model="imageViewerVisible" :image-url="currentImageUrl" alt="会话图片" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AiTextbookSession } from '@/types'
import ImageViewer from './ImageViewer.vue'
import BubblePopup from './base/Popover.vue'
import pinIcon from '/icons/zhiding.svg'
import pinOutlinedIcon from '/icons/quxiaozhiding.svg'
import deleteIcon from '/icons/delete.svg'

// 辅助函数：获取会话ID（兼容 id 和 sessionId）
const getRecordId = (record: AiTextbookSession): string => {
  return record.sessionId || record.id || ''
}

// 辅助函数：获取会话名称（兼容 question 和 sessionName）
const getRecordName = (record: AiTextbookSession): string => {
  return record.question || record.sessionName || ''
}

// 截断文本
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Props
interface Props {
  record: AiTextbookSession
  selectedRecordId?: string
  isSelectionMode: boolean
  selectedRecordIds?: Set<string> | string[] // 传入选中的记录ID集合
}

const props = withDefaults(defineProps<Props>(), {
  selectedRecordIds: () => new Set<string>(),
})

// Emits
defineEmits<{
  click: []
  contextmenu: []
  'checkbox-change': [checked: boolean]
  pin: []
  delete: []
}>()

// 图片预览相关状态
const imageViewerVisible = ref(false)
const currentImageUrl = ref<string>('')

// 气泡弹框状态
const showMoreMenu = ref(false)

// 关闭气泡弹框并执行操作
const closeMenuAndExecute = (action: () => void) => {
  showMoreMenu.value = false
  action()
}

// 处理缩略图点击
const handleThumbnailClick = () => {
  if (props.record.thumbnailImage) {
    currentImageUrl.value = props.record.thumbnailImage
    imageViewerVisible.value = true
  }
}

// 计算属性
const recordId = computed(() => getRecordId(props.record))
const recordName = computed(() => getRecordName(props.record))
const truncatedAnswer = computed(() => {
  if (!props.record.answer) return ''
  return truncateText(props.record.answer, 100)
})
const isSelected = computed(() => props.selectedRecordId === recordId.value)

// 计算是否被选中（用于批量选择模式）
const isChecked = computed(() => {
  if (props.selectedRecordIds instanceof Set) {
    return props.selectedRecordIds.has(recordId.value)
  }
  if (Array.isArray(props.selectedRecordIds)) {
    return props.selectedRecordIds.includes(recordId.value)
  }
  return false
})
</script>

<style lang="scss" scoped>
.session-item {
  border-radius: 12px;
  margin: 0 12px 10px;
  display: flex;
  align-items: stretch;
  position: relative;
  background: #f7f6ff;
  padding: 5px;

  &.is-selected {
    background: #ffffff;

    // 被pin且选中时，背景色为#e8e9ff
    &.is-pinned {
      background: #e8e9ff;
    }
  }

  &.is-checked {
    background: #e3f2fd;
    border-color: #1976d2;
  }

  &.is-selectable {
    cursor: pointer;

    .session-content {
      padding-left: 8px;
    }
  }

  .session-checkbox {
    display: flex;
    align-items: center;
    padding: 0 8px 0 12px;
  }

  .session-content {
    flex: 1;
    padding: 0;
    cursor: pointer;
    min-width: 0;
    display: flex;
    align-items: flex-start;
  }

  .session-header {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
    justify-content: center;
    align-items: flex-start;
    overflow: hidden;
    padding-left: 10px;
  }

  .session-thumbnail {
    flex-shrink: 0;
    width: 104px;
    height: 56px;
    aspect-ratio: 210 / 122;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;

    position: relative;
    cursor: pointer;

    .thumbnail-image {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      object-fit: cover;
    }

    .thumbnail-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      border-radius: 8px;
      transition: opacity 0.2s;

      .q-icon {
        color: white;
      }
    }

    &:hover .thumbnail-overlay {
      opacity: 1;
    }
  }

  .thumbnail-is-selected {
    border: 1.5px solid #6e55ff;
  }

  // 状态图标容器（收藏和置顶，始终显示）
  .session-status-icons {
    position: absolute;
    top: 38%;
    right: 9px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 1;

    .status-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .star-icon {
      width: 1rem;
      height: 1rem;
    }

    .pin-icon {
      width: 1rem;
      height: 1rem;
    }
  }

  .session-actions {
    position: absolute;
    top: 32%;
    right: 9px;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.2s;

    .more-btn {
      color: #333;
      display: inline-block;
      transform: rotate(90deg);
      transition: transform 0.2s ease;
    }
  }

  // hover或选中时，状态图标向左移动，为更多按钮留出空间
  &:hover .session-status-icons,
  &.is-selected .session-status-icons {
    right: 45px;
  }

  &:hover .session-actions,
  &.is-selected .session-actions {
    opacity: 1;
  }

  .favorite-star {
    position: absolute;
    bottom: 12px;
    right: 12px;
  }

  .session-title-row {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .session-title {
    font-size: 0.9rem;
    color: #1a1a1a;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    flex: 1;
    min-width: 0;
    padding-right: 30px;
  }

  .session-subtitle {
    font-size: 13px;
    color: #666;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

// 复用 SessionTree 的更多菜单行样式
.more-menu-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.4;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 8px;

  &:hover {
    background-color: rgba(15, 23, 42, 0.03);
  }

  img {
    flex-shrink: 0;
  }
}

.session-more-menu-divider {
  height: 1px;
  background-color: #f0f0f0;
  margin: 8px 0;
}

.session-more-menu-delete-wrapper {
  .more-menu-item-row {
    color: #f44336;

    &:hover {
      background-color: rgba(244, 67, 54, 0.08);
    }
  }
}

.text-delete {
  color: #f44336;
}
</style>
