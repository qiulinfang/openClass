<template>
  <div class="learning-status-panel-wrapper" :class="{ expanded: isVisible }">
    <!-- 收缩/展开按钮（左侧边框垂直居中） -->
    <q-btn
      :icon="isVisible ? 'chevron_left' : 'chevron_right'"
      round
      dense
      unelevated
      class="toggle-button"
      :class="{ expanded: isVisible }"
      @click="isVisible = !isVisible"
    />

    <!-- 侧边栏面板 -->
    <q-card class="learning-status-panel-card">
      <!-- 头部 - 固定在顶部 -->
      <q-card-section class="panel-header">
        <div class="header-top">
          <div class="header-title">📚 学习状态控制面板</div>
          <q-space />
          <q-btn icon="close" flat round dense size="xs" @click="isVisible = false" />
        </div>
      </q-card-section>

      <!-- 内容区域 -->
      <q-card-section class="panel-content">
        <!-- 上次学习节点 -->
        <q-expansion-item
          icon="bookmark"
          label="上次学习节点"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <div v-if="lastLearnedNodeInfo" class="node-info-card">
              <div class="node-info-header">
                <q-icon name="school" color="primary" class="q-mr-sm" />
                <div class="flex-1">
                  <div class="text-subtitle2">{{ lastLearnedNodeInfo.name }}</div>
                  <div class="text-caption text-grey-7">节点ID: {{ lastLearnedNodeInfo.id }}</div>
                </div>
              </div>
              <q-btn
                flat
                dense
                color="negative"
                icon="delete"
                label="清除"
                size="sm"
                @click="clearLastLearned"
                class="q-mt-sm"
              />
            </div>
            <div v-else class="empty-state">
              <q-icon name="bookmark_border" size="32px" color="grey-5" />
              <div class="text-body2 text-grey-6 q-mt-sm">暂无上次学习节点</div>
            </div>
          </q-card-section>
        </q-expansion-item>

        <!-- 已学习节点列表 -->
        <q-expansion-item
          icon="check_circle"
          label="已学习节点"
          default-opened
          class="q-mb-sm"
        >
          <q-card-section>
            <div class="stats-info q-mb-md">
              <span class="text-body2">共 <strong>{{ learnedNodesList.length }}</strong> 个节点</span>
            </div>

            <!-- 已学习节点列表 -->
            <div v-if="learnedNodesList.length > 0" class="learned-nodes-list">
              <q-list separator>
                <q-item
                  v-for="node in learnedNodesList"
                  :key="node.id"
                  class="learned-node-item"
                >
                  <q-item-section avatar>
                    <q-icon name="check_circle" color="positive" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ node.name || '未知节点' }}</q-item-label>
                    <q-item-label caption>ID: {{ node.id }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn
                      flat
                      round
                      dense
                      icon="close"
                      color="negative"
                      size="sm"
                      @click="removeLearnedNode(node.id)"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
            <div v-else class="empty-state">
              <q-icon name="check_circle_outline" size="32px" color="grey-5" />
              <div class="text-body2 text-grey-6 q-mt-sm">暂无已学习节点</div>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons q-mt-md">
              <q-btn
                flat
                dense
                color="negative"
                icon="delete_sweep"
                label="清除全部"
                size="sm"
                @click="clearAllLearned"
                :disable="learnedNodesList.length === 0"
                class="full-width"
              />
            </div>
          </q-card-section>
        </q-expansion-item>

        <!-- 手动管理 -->
        <q-expansion-item
          icon="edit"
          label="手动管理节点"
          class="q-mb-sm"
        >
          <q-card-section>
            <!-- 添加已学习节点 -->
            <div class="section-title q-mb-sm">添加已学习节点</div>
            <q-select
              v-model="selectedNodeId"
              :options="availableNodes"
              option-label="label"
              option-value="id"
              behavior="menu"
              emit-value
              map-options
              outlined
              dense
              placeholder="选择节点..."
              class="q-mb-sm"
            >
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>ID: {{ scope.opt.id }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-btn
              flat
              dense
              color="primary"
              icon="add"
              label="添加到已学习"
              size="sm"
              @click="addLearnedNode"
              :disable="!selectedNodeId"
              class="full-width q-mb-md"
            />

            <!-- 设置上次学习节点 -->
            <div class="section-title q-mb-sm">设置上次学习节点</div>
            <q-select
              v-model="selectedLastLearnedId"
              :options="availableNodes"
              option-label="label"
              option-value="id"
              behavior="menu"
              emit-value
              map-options
              outlined
              dense
              placeholder="选择节点..."
              class="q-mb-sm"
            >
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>ID: {{ scope.opt.id }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-btn
              flat
              dense
              color="primary"
              icon="bookmark"
              label="设置为上次学习"
              size="sm"
              @click="setLastLearnedNode"
              :disable="!selectedLastLearnedId"
              class="full-width"
            />
          </q-card-section>
        </q-expansion-item>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { getCurrentUserIdOrDefault } from '../../utils/user/userId'

interface ChapterNode {
  id: string
  name: string
  label: string
  level?: number | null
  children?: ChapterNode[]
}

interface Props {
  modelValue: boolean
  chapterStructure?: ChapterNode[]
}

interface NodeInfo {
  id: string
  name: string
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  chapterStructure: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'refresh': []
}>()

const $q = useQuasar()

// 面板可见性
const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 获取带用户ID前缀的存储key
const getLastLearnedNodeKey = () => {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_LAST_LEARNED_NODE_ID`
}

const getLearnedNodesKey = () => {
  const userId = getCurrentUserIdOrDefault()
  return `${userId}_LEARNED_NODES`
}

// 上次学习的节点ID
const lastLearnedNodeId = ref<string | null>(null)

// 已学习的节点ID列表
const learnedNodeIds = ref<Set<string>>(new Set())

// 手动选择的节点ID（用于添加已学习）
const selectedNodeId = ref<string | null>(null)

// 手动选择的节点ID（用于设置上次学习）
const selectedLastLearnedId = ref<string | null>(null)

// 从localStorage加载最后学习的节点ID
const loadLastLearnedNodeId = () => {
  try {
    const key = getLastLearnedNodeKey()
    const saved = localStorage.getItem(key)
    if (saved) {
      lastLearnedNodeId.value = saved
    } else {
      lastLearnedNodeId.value = null
    }
  } catch (error) {
    console.error('加载最后学习的节点ID失败:', error)
    lastLearnedNodeId.value = null
  }
}

// 从localStorage加载已学习的节点ID列表
const loadLearnedNodeIds = () => {
  try {
    const key = getLearnedNodesKey()
    const saved = localStorage.getItem(key)
    if (saved) {
      const ids = JSON.parse(saved) as string[]
      learnedNodeIds.value = new Set(ids)
    } else {
      learnedNodeIds.value = new Set()
    }
  } catch (error) {
    console.error('加载已学习的节点ID列表失败:', error)
    learnedNodeIds.value = new Set()
  }
}

// 保存最后学习的节点ID到localStorage
const saveLastLearnedNodeId = (nodeId: string | null) => {
  try {
    const key = getLastLearnedNodeKey()
    const oldValue = lastLearnedNodeId.value
    lastLearnedNodeId.value = nodeId
    if (nodeId) {
      localStorage.setItem(key, nodeId)
    } else {
      localStorage.removeItem(key)
    }
    // 触发自定义事件，让同标签页的其他组件能够监听到变化
    window.dispatchEvent(new StorageEvent('storage', {
      key: key,
      newValue: nodeId,
      oldValue: oldValue,
      storageArea: localStorage
    }))
    emit('refresh')
  } catch (error) {
    console.error('保存最后学习的节点ID失败:', error)
    $q.notify({
      type: 'negative',
      message: '保存失败',
      position: 'top'
    })
  }
}

// 保存已学习的节点ID列表到localStorage
const saveLearnedNodeIds = () => {
  try {
    const key = getLearnedNodesKey()
    const ids = Array.from(learnedNodeIds.value)
    const oldValue = localStorage.getItem(key)
    if (ids.length > 0) {
      localStorage.setItem(key, JSON.stringify(ids))
    } else {
      localStorage.removeItem(key)
    }
    // 触发自定义事件，让同标签页的其他组件能够监听到变化
    window.dispatchEvent(new StorageEvent('storage', {
      key: key,
      newValue: ids.length > 0 ? JSON.stringify(ids) : null,
      oldValue: oldValue,
      storageArea: localStorage
    }))
    emit('refresh')
  } catch (error) {
    console.error('保存已学习的节点ID列表失败:', error)
    $q.notify({
      type: 'negative',
      message: '保存失败',
      position: 'top'
    })
  }
}

// 从章节结构中收集所有节点
const collectAllNodes = (nodes: ChapterNode[]): NodeInfo[] => {
  const result: NodeInfo[] = []
  
  const traverse = (node: ChapterNode) => {
    result.push({
      id: node.id,
      name: node.name || node.label,
      label: `${node.name || node.label} (${node.id})`
    })
    
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => traverse(child))
    }
  }
  
  nodes.forEach(node => traverse(node))
  return result
}

// 可用节点列表（从章节结构中获取）
const availableNodes = computed(() => {
  if (!props.chapterStructure || props.chapterStructure.length === 0) {
    return []
  }
  return collectAllNodes(props.chapterStructure)
})

// 根据ID查找节点信息
const findNodeInfo = (nodeId: string): NodeInfo | null => {
  const allNodes = collectAllNodes(props.chapterStructure)
  return allNodes.find(node => node.id === nodeId) || null
}

// 上次学习的节点信息
const lastLearnedNodeInfo = computed(() => {
  if (!lastLearnedNodeId.value) {
    return null
  }
  return findNodeInfo(lastLearnedNodeId.value)
})

// 已学习节点列表（带名称）
const learnedNodesList = computed(() => {
  return Array.from(learnedNodeIds.value).map(id => {
    const nodeInfo = findNodeInfo(id)
    return {
      id,
      name: nodeInfo?.name || '未知节点'
    }
  })
})

// 清除上次学习节点
const clearLastLearned = () => {
  $q.dialog({
    title: '确认清除',
    message: '确定要清除上次学习节点吗？',
    cancel: true,
    persistent: true
  }).onOk(() => {
    saveLastLearnedNodeId(null)
    $q.notify({
      type: 'positive',
      message: '已清除上次学习节点',
      position: 'top'
    })
  })
}

// 清除所有已学习节点
const clearAllLearned = () => {
  $q.dialog({
    title: '确认清除',
    message: `确定要清除所有已学习节点吗？共 ${learnedNodesList.value.length} 个节点`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    learnedNodeIds.value.clear()
    saveLearnedNodeIds()
    $q.notify({
      type: 'positive',
      message: '已清除所有已学习节点',
      position: 'top'
    })
  })
}

// 移除单个已学习节点
const removeLearnedNode = (nodeId: string) => {
  learnedNodeIds.value.delete(nodeId)
  saveLearnedNodeIds()
  $q.notify({
    type: 'positive',
    message: '已移除已学习节点',
    position: 'top'
  })
}

// 添加已学习节点
const addLearnedNode = () => {
  if (!selectedNodeId.value) {
    return
  }
  
  learnedNodeIds.value.add(selectedNodeId.value)
  saveLearnedNodeIds()
  selectedNodeId.value = null
  $q.notify({
    type: 'positive',
    message: '已添加到已学习节点',
    position: 'top'
  })
}

// 设置上次学习节点
const setLastLearnedNode = () => {
  if (!selectedLastLearnedId.value) {
    return
  }
  
  saveLastLearnedNodeId(selectedLastLearnedId.value)
  selectedLastLearnedId.value = null
  $q.notify({
    type: 'positive',
    message: '已设置上次学习节点',
    position: 'top'
  })
}

// 监听章节结构变化，刷新节点列表
watch(() => props.chapterStructure, () => {
  // 章节结构变化时，重新加载数据以确保节点信息是最新的
}, { deep: true })

// 监听面板可见性变化，当打开时刷新数据
watch(() => isVisible.value, (newValue) => {
  if (newValue) {
    loadLastLearnedNodeId()
    loadLearnedNodeIds()
  }
})

// 初始化时加载数据
onMounted(() => {
  loadLastLearnedNodeId()
  loadLearnedNodeIds()
})
</script>

<style scoped lang="scss">
.learning-status-panel-wrapper {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;

  // 隐藏状态下不拦截点击事件，让点击可以穿透到后面的元素
  &:not(.expanded) {
    pointer-events: none;
  }

  .learning-status-panel-card {
    width: 360px;
    max-height: 80vh;
    background: #ffffff;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
    border-radius: 0 12px 12px 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: transform 0.3s ease-in-out;
    transform: translateX(-100%);

    // 展开状态
    .expanded & {
      transform: translateX(0);
      pointer-events: auto;
    }

    .panel-header {
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;

      .header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .header-title {
          font-size: 16px;
          font-weight: 600;
          color: #1976d2;
        }
      }
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;

      .node-info-card {
        padding: 12px;
        background: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 8px;

        .node-info-header {
          display: flex;
          align-items: flex-start;
        }
      }

      .empty-state {
        text-align: center;
        padding: 24px;
        color: #9e9e9e;
      }

      .stats-info {
        padding: 8px 0;
        color: #666;
      }

      .learned-nodes-list {
        max-height: 300px;
        overflow-y: auto;

        .learned-node-item {
          padding: 8px;
          border-radius: 4px;
          transition: background 0.2s;

          &:hover {
            background: #f5f5f5;
          }
        }
      }

      .action-buttons {
        border-top: 1px solid #e0e0e0;
        padding-top: 12px;
      }

      .section-title {
        font-size: 14px;
        font-weight: 500;
        color: #1976d2;
        margin-bottom: 8px;
      }
    }
  }

  // 展开状态时面板完全显示
  &.expanded {
    pointer-events: auto;

    .learning-status-panel-card {
      transform: translateX(0);
    }
  }

  // 收缩/展开按钮
  .toggle-button {
    position: fixed;
    left: 0;
    top: 60%;
    transform: translateY(-50%) translateX(-50%);
    z-index: 2001;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-left: none;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    pointer-events: auto;
    transition: all 0.3s ease-in-out;
    width: 32px;
    height: 64px;
    border-radius: 0 8px 8px 0;

    &:hover {
      background: rgba(255, 255, 255, 1);
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
    }

    // 展开状态下的按钮位置（跟随面板右侧边框）
    &.expanded {
      left: 360px;
      transform: translateY(-50%) translateX(0);
      border-left: 1px solid rgba(0, 0, 0, 0.12);
      border-right: none;
      box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);

      &:hover {
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
      }
    }
  }
}
</style>

