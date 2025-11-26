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
      <!-- 收藏图标 -->
      <img
        v-if="showFavorite && isFavorite"
        :src="starIcon"
        alt="已收藏"
        class="status-icon star-icon"
      />
      <!-- 置顶图标 -->
      <img
        v-if="record.pinned"
        :src="pinIcon"
        alt="已置顶"
        class="status-icon pin-icon"
      />
    </div>
    <!-- 操作按钮 -->
    <div class="session-actions">
      <!-- 更多按钮 -->
      <q-btn
        flat
        round
        dense
        icon="more_horiz"
        size="sm"
        class="more-btn"
        @click.stop
      >
        <q-menu
          anchor="bottom right"
          self="top right"
          :offset="[8, 8]"
          class="action-menu"
        >
          <q-list class="action-menu-list">
            <!-- 置顶 -->
            <q-item clickable v-close-popup @click="$emit('pin')">
              <q-item-section avatar>
                <q-icon name="push_pin" size="xs" />
              </q-item-section>
              <q-item-section>{{ record.pinned ? '取消置顶' : '置顶' }}</q-item-section>
            </q-item>
            <!-- 收藏 -->
            <q-item
              v-if="showFavorite"
              clickable
              v-close-popup
              @click="handleFavorite"
            >
              <q-item-section avatar>
                <q-icon
                  :name="isFavorite ? 'star' : 'star_border'"
                  size="xs"
                  :color="isFavorite ? 'warning' : undefined"
                />
              </q-item-section>
              <q-item-section>{{ isFavorite ? '取消收藏' : '收藏' }}</q-item-section>
            </q-item>
            <!-- 分割线 -->
            <q-separator spaced />
            <!-- 删除 -->
            <q-item
              clickable
              v-close-popup
              @click="$emit('delete')"
              class="text-negative"
            >
              <q-item-section avatar>
                <q-icon name="delete" size="xs" />
              </q-item-section>
              <q-item-section>删除</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- 图片预览对话框 -->
    <ImageViewer
      v-model="imageViewerVisible"
      :image-url="currentImageUrl"
      alt="会话图片"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AiTextbookSession, AiGeneralSession } from '@/types'
import ImageViewer from './ImageViewer.vue'
import { isQaFavorite, toggleQaFavorite, isSessionFavorite, toggleSessionFavorite } from '@/utils/storage/favorites'
import { showMessage } from '@/utils'
import starIcon from '/icons/star.svg'
import pinIcon from '/icons/pin.svg'

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
  showFavorite: boolean
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

// 收藏状态
const isFavorite = ref(false)
const favoriteType = ref<'qa' | 'session' | null>(null) // 记录收藏类型

// 初始化收藏状态
const initFavoriteStatus = () => {
  if (!props.showFavorite) {
    isFavorite.value = false
    favoriteType.value = null
    return
  }
  
  const recordIdValue = recordId.value
  const isQa = isQaFavorite(recordIdValue)
  const isSession = isSessionFavorite(recordIdValue)
  
  // 优先显示会话收藏状态（如果存在）
  if (isSession) {
    isFavorite.value = true
    favoriteType.value = 'session'
  } else if (isQa) {
    isFavorite.value = true
    favoriteType.value = 'qa'
  } else {
    isFavorite.value = false
    favoriteType.value = null
  }
}

// 监听 record 变化，更新收藏状态
watch(
  () => props.record,
  () => {
    initFavoriteStatus()
  },
  { immediate: true }
)

// 处理收藏/取消收藏
const handleFavorite = () => {
  if (!props.showFavorite) return

  const wasFavorite = isFavorite.value
  
  let success = false
  
  if (favoriteType.value === 'session') {
    // 如果是会话收藏，切换会话收藏状态
    // 需要将 AiTextbookSession 转换为 AiGeneralSession
    const session: AiGeneralSession = {
      sessionId: props.record.sessionId,
      sessionName: props.record.sessionName,
      createTime: props.record.createTime,
      updateTime: props.record.updateTime,
      msgCount: props.record.msgCount,
      pinned: props.record.pinned
    }
    success = toggleSessionFavorite(session)
  } else if (favoriteType.value === 'qa') {
    // 如果是问答收藏，切换问答收藏状态
    success = toggleQaFavorite(props.record)
  } else {
    // 如果都没有收藏，优先添加会话收藏（因为我们在会话收藏标签页中使用）
    // 但为了向后兼容，先尝试添加问答收藏
    // 如果 record 有 sessionId，说明可能是会话，尝试添加会话收藏
    if (props.record.sessionId && !props.record.resourceId) {
      // 可能是 AI 通用会话，尝试添加会话收藏
      const session: AiGeneralSession = {
        sessionId: props.record.sessionId,
        sessionName: props.record.sessionName,
        createTime: props.record.createTime,
        updateTime: props.record.updateTime,
        msgCount: props.record.msgCount,
        pinned: props.record.pinned
      }
      success = toggleSessionFavorite(session)
      if (success) {
        favoriteType.value = 'session'
      }
    }
    
    // 如果会话收藏失败，尝试问答收藏（向后兼容）
    if (!success) {
      success = toggleQaFavorite(props.record)
      if (success) {
        favoriteType.value = 'qa'
      }
    }
  }

  if (success) {
    isFavorite.value = !wasFavorite
    // 重新检查收藏状态
    initFavoriteStatus()
    showMessage(!wasFavorite ? '已收藏' : '已取消收藏', 'success')
  } else {
    showMessage('操作失败，请重试', 'error')
  }
}
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
      color: #999;

      &:hover {
        color: #333;
      }
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

.action-menu {
  border-radius: 12px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid #f0f0f0 !important;
}

.action-menu-list {
  padding: 6px;
  min-width: 130px;

  .q-item {
    border-radius: 6px;
    min-height: 40px;
  }

  .q-item__section--avatar {
    min-width: 36px;
    padding-right: 4px;
  }

  .q-separator {
    background-color: #f0f0f0;
  }
}
</style>

