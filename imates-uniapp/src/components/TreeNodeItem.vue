<template>
  <view class="tree-node">
    <!-- 当前节点渲染 -->
    <view class="node-row" @click="handleNodeClick">
      <text v-if="hasChildren" class="expand-icon">{{ isExpanded ? '▼' : '▶' }}</text>
      <text v-else class="bullet-icon">📄</text>
      <text class="node-name" :class="{ 'is-leaf': !hasChildren }">
        {{ node.name || node.label || node.title || '节点' }}
      </text>
      <text v-if="!hasChildren && node.url" class="view-tag">点击查看 ›</text>
    </view>

    <!-- 子节点递归渲染 -->
    <view v-if="hasChildren && isExpanded" class="node-children">
      <TreeNodeItem
        v-for="(child, idx) in node.children"
        :key="child.id || idx"
        :node="child"
        @select-file="onSubFileSelect"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  node: any
}>()

const emit = defineEmits(['select-file'])

const isExpanded = ref(true)

const hasChildren = computed(() => {
  return props.node && Array.isArray(props.node.children) && props.node.children.length > 0
})

const handleNodeClick = () => {
  if (hasChildren.value) {
    isExpanded.value = !isExpanded.value
  } else {
    emit('select-file', props.node)
  }
}

const onSubFileSelect = (subNode: any) => {
  emit('select-file', subNode)
}
</script>

<style lang="scss" scoped>
.tree-node {
  display: flex;
  flex-direction: column;
}

.node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 20rpx;
  background: #ffffff;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
  border: 1px solid #e5e7eb;

  &:active {
    background: #f3f4f6;
  }
}

.expand-icon {
  font-size: 20rpx;
  color: #6b7280;
  margin-right: 16rpx;
  width: 24rpx;
}

.bullet-icon {
  font-size: 26rpx;
  margin-right: 16rpx;
}

.node-name {
  flex: 1;
  font-size: 28rpx;
  color: #1f2937;
  font-weight: 500;

  &.is-leaf {
    color: #374151;
  }
}

.view-tag {
  font-size: 22rpx;
  color: #6e55ff;
  font-weight: 500;
}

.node-children {
  padding-left: 32rpx;
  border-left: 2px dashed #e5e7eb;
  margin-left: 12rpx;
  margin-bottom: 12rpx;
}
</style>
