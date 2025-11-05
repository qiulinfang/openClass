<template>
  <div class="session-tree">
    <!-- 顶部标题栏 -->
    <div v-if="showHeader" class="tree-header">
      <div class="header-center">
        <q-input
          v-model="searchKeyword"
          dense
          outlined
          placeholder="搜索会话..."
          clearable
          class="search-input"
        >
          <template v-slot:prepend>
            <q-icon name="search" size="xs" />
          </template>
        </q-input>
      </div>
      <div class="header-actions">
        <!-- 自定义按钮插槽 -->
        <slot name="header-actions"></slot>
      </div>
    </div>

    <!-- 树形结构 -->
    <div v-if="treeNodes.length > 0" ref="treeWrapper" class="tree-wrapper">
      <q-tree
        :nodes="treeNodes"
        node-key="id"
        :expanded="expandedNodes"
        @update:expanded="(val) => expandedNodes = Array.isArray(val) ? [...val] : []"
        :selected="selectedNodeId"
        @update:selected="handleNodeSelect"
        default-expand-all
        no-connectors
      >
        <template v-slot:default-header="prop">
          <div class="tree-node-header" :class="{ 'is-selected': isSelectedNode(prop.node) }">
            <!-- 一级节点（分类） -->
            <div v-if="prop.node.level === 1" class="category-node">
              <q-icon :name="getCategoryIcon(prop.node.category)" size="sm" class="category-icon" />
              <span class="category-label">{{ prop.node.label }}</span>
              <span class="category-count">({{ prop.node.children?.length || 0 }})</span>
            </div>

            <!-- 二级节点（会话） -->
            <div v-else-if="prop.node.level === 2" class="session-node">
              <div class="session-content" @click.stop="handleSessionClick(prop.node)">
                <div class="session-title-row">
                  <div class="session-title">{{ prop.node.label }}</div>
                  <div class="session-time">{{ formatTime(prop.node.timestamp) }}</div>
                </div>
                <div v-if="prop.node.subtitle" class="session-subtitle">
                  {{ prop.node.subtitle }}
                </div>
              </div>
              <div class="session-actions">
                <q-btn flat round dense icon="more_vert" size="sm" class="more-btn" @click.stop>
                  <q-menu anchor="bottom right" self="top right" :offset="[0, 8]">
                    <q-list style="min-width: 150px">
                      <q-item
                        v-if="prop.node.category === 'ai'"
                        clickable
                        v-close-popup
                        @click="handleRename(prop.node)"
                      >
                        <q-item-section avatar>
                          <q-icon name="edit" size="xs" />
                        </q-item-section>
                        <q-item-section>重命名</q-item-section>
                      </q-item>

                      <q-item
                        v-if="prop.node.category === 'ai'"
                        clickable
                        v-close-popup
                        @click="handlePin(prop.node)"
                      >
                        <q-item-section avatar>
                          <q-icon name="push_pin" size="xs" />
                        </q-item-section>
                        <q-item-section>
                          {{ prop.node.pinned ? '取消置顶' : '置顶' }}
                        </q-item-section>
                      </q-item>

                      <q-separator />

                      <q-item
                        clickable
                        v-close-popup
                        @click="handleDelete(prop.node)"
                        class="text-negative"
                      >
                        <q-item-section avatar>
                          <q-icon name="delete" size="xs" color="negative" />
                        </q-item-section>
                        <q-item-section>删除</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
            </div>
          </div>
        </template>
      </q-tree>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <q-icon name="chat" size="48px" color="grey-5" />
      <div class="q-mt-md text-h6 text-grey-6">
        {{ searchKeyword ? '未找到匹配的会话' : '暂无会话' }}
      </div>
      <div class="q-mt-sm text-caption text-grey-5">
        {{ searchKeyword ? '尝试使用其他关键词搜索' : '您的会话记录将显示在这里' }}
      </div>
    </div>

    <!-- 重命名对话框 -->
    <q-dialog v-model="showRenameDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">重命名会话</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="newSessionName"
            autofocus
            dense
            label="会话名称"
            @keyup.enter="confirmRename"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" color="grey" v-close-popup />
          <q-btn flat label="确定" color="primary" @click="confirmRename" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AiGeneralSession } from '@/types'
import type { TeacherSession } from '@/stores/teacherChatStore'

// 定义 props
interface Props {
  // AI会话列表
  aiSessions?: AiGeneralSession[]
  // 教师会话列表（按科目分组）
  teacherSessions?: TeacherSession[]
  // 当前选中的AI会话ID
  selectedAiSessionId?: string
  // 当前选中的教师会话ID
  selectedTeacherSessionId?: string
  // 是否显示头部
  showHeader?: boolean
  // 标题文字
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  aiSessions: () => [],
  teacherSessions: () => [],
  selectedAiSessionId: undefined,
  selectedTeacherSessionId: undefined,
  showHeader: true,
  title: '聊天记录',
})

// 定义 emits
const emit = defineEmits<{
  'ai-session-click': [sessionId: string]
  'teacher-session-click': [sessionId: string, subject: string]
  'ai-session-rename': [sessionId: string, newName: string]
  'ai-session-pin': [sessionId: string]
  'ai-session-delete': [sessionId: string]
  'teacher-session-delete': [sessionId: string]
  'ai-new-chat': []
  'teacher-new-chat': [subject: 'biology' | 'math']
}>()

// 搜索关键词
const searchKeyword = ref('')

// 展开的节点
const expandedNodes = ref<string[]>([])

// 选中的节点ID
const selectedNodeId = ref<string | null>(null)

// 重命名对话框
const showRenameDialog = ref(false)
const currentSessionNode = ref<{ sessionId: string; label: string } | null>(null)
const newSessionName = ref('')

// 树形节点引用
const treeWrapper = ref<HTMLElement | null>(null)

// ==================== 计算属性 ====================

// 获取分类图标
const getCategoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    ai: 'smart_toy',
    biology: 'biotech',
    math: 'calculate',
  }
  return icons[category] || 'folder'
}

// 按科目分组教师会话
const teacherSessionsBySubject = computed(() => {
  const biology: TeacherSession[] = []
  const math: TeacherSession[] = []

  props.teacherSessions.forEach((session) => {
    if (session.subject === 'biology') {
      biology.push(session)
    } else if (session.subject === 'math') {
      math.push(session)
    }
  })

  return { biology, math }
})

// 过滤会话列表（根据搜索关键词）
const filterSessions = <T extends { sessionName?: string }>(sessions: T[], keyword: string): T[] => {
  if (!keyword || !keyword.trim()) {
    return sessions
  }

  const lowerKeyword = keyword.toLowerCase().trim()
  return sessions.filter((session) => {
    const name = session.sessionName?.toLowerCase() || ''
    return name.includes(lowerKeyword)
  })
}

// 树节点类型定义
interface TreeNode {
  id: string
  label: string
  category: 'ai' | 'biology' | 'math'
  level: number
  children?: TreeNode[]
  sessionId?: string
  timestamp?: number
  subtitle?: string
  pinned?: boolean
}

// 构建树形节点
const treeNodes = computed<TreeNode[]>(() => {
  const nodes: TreeNode[] = []

  // 1. AI聊天（学伴）分类
  const filteredAiSessions = filterSessions(props.aiSessions, searchKeyword.value)
  const aiSessions = filteredAiSessions
    .sort((a, b) => {
      // 置顶的排在前面
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      // 按更新时间倒序
      return b.updateTime - a.updateTime
    })
    .map((session): TreeNode => ({
      id: `ai_${session.sessionId}`,
      label: session.sessionName,
      timestamp: session.updateTime,
      sessionId: session.sessionId,
      category: 'ai' as const,
      level: 2,
      pinned: session.pinned || false,
    }))

  if (filteredAiSessions.length > 0 || !searchKeyword.value) {
    nodes.push({
      id: 'category_ai',
      label: '学伴',
      category: 'ai' as const,
      level: 1,
      children: aiSessions,
    })
  }

  // 2. 生物老师分类
  const filteredBiologySessions = filterSessions(
    teacherSessionsBySubject.value.biology,
    searchKeyword.value,
  )
  const biologySessions = filteredBiologySessions
    .sort((a, b) => b.createTime - a.createTime)
    .map((session): TreeNode => ({
      id: `teacher_biology_${session.sessionId}`,
      label: session.sessionName,
      timestamp: session.createTime,
      subtitle: '生物老师',
      sessionId: session.sessionId,
      category: 'biology' as const,
      level: 2,
    }))

  if (filteredBiologySessions.length > 0 || !searchKeyword.value) {
    nodes.push({
      id: 'category_biology',
      label: '生物老师',
      category: 'biology' as const,
      level: 1,
      children: biologySessions,
    })
  }

  // 3. 数学老师分类
  const filteredMathSessions = filterSessions(
    teacherSessionsBySubject.value.math,
    searchKeyword.value,
  )
  const mathSessions = filteredMathSessions
    .sort((a, b) => b.createTime - a.createTime)
    .map((session): TreeNode => ({
      id: `teacher_math_${session.sessionId}`,
      label: session.sessionName,
      timestamp: session.createTime,
      subtitle: '数学老师',
      sessionId: session.sessionId,
      category: 'math' as const,
      level: 2,
    }))

  if (filteredMathSessions.length > 0 || !searchKeyword.value) {
    nodes.push({
      id: 'category_math',
      label: '数学老师',
      category: 'math' as const,
      level: 1,
      children: mathSessions,
    })
  }

  return nodes
})

// 判断节点是否被选中
const isSelectedNode = (node: TreeNode): boolean => {
  if (node.level === 1) return false // 分类节点不可选中

  if (node.category === 'ai') {
    return props.selectedAiSessionId === node.sessionId
  } else if (node.category === 'biology' || node.category === 'math') {
    return props.selectedTeacherSessionId === node.sessionId
  }

  return false
}

// ==================== 方法 ====================

// 处理节点选择
const handleNodeSelect = (nodeId: string | null) => {
  selectedNodeId.value = nodeId
}

// 处理会话点击
const handleSessionClick = (node: TreeNode) => {
  if (node.level !== 2 || !node.sessionId) return

  if (node.category === 'ai') {
    emit('ai-session-click', node.sessionId)
  } else if (node.category === 'biology' || node.category === 'math') {
    emit('teacher-session-click', node.sessionId, node.category)
  }
}

// 处理重命名
const handleRename = (node: TreeNode) => {
  if (node.level !== 2 || node.category !== 'ai' || !node.sessionId) return

  currentSessionNode.value = { sessionId: node.sessionId, label: node.label }
  newSessionName.value = node.label
  showRenameDialog.value = true
}

// 确认重命名
const confirmRename = () => {
  if (currentSessionNode.value && newSessionName.value.trim()) {
    emit('ai-session-rename', currentSessionNode.value.sessionId, newSessionName.value.trim())
    showRenameDialog.value = false
    currentSessionNode.value = null
  }
}

// 处理置顶
const handlePin = (node: TreeNode) => {
  if (node.level !== 2 || node.category !== 'ai' || !node.sessionId) return
  emit('ai-session-pin', node.sessionId)
}

// 处理删除
const handleDelete = (node: TreeNode) => {
  if (node.level !== 2 || !node.sessionId) return

  if (node.category === 'ai') {
    emit('ai-session-delete', node.sessionId)
  } else if (node.category === 'biology' || node.category === 'math') {
    emit('teacher-session-delete', node.sessionId)
  }
}

// 格式化时间（相对时间）
const formatTime = (timestamp: number): string => {
  if (!timestamp) return ''

  const now = Date.now()
  const diff = now - timestamp

  // 小于1分钟：刚刚
  if (diff < 60 * 1000) {
    return '刚刚'
  }

  // 小于1小时：X分钟前
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes}分钟前`
  }

  // 小于24小时：X小时前
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours}小时前`
  }

  // 小于48小时：昨天
  if (diff < 48 * 60 * 60 * 1000) {
    const date = new Date(timestamp)
    return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 小于7天：X天前
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days}天前`
  }

  // 其他：显示月/日 时:分
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  // 如果年份不是今年，显示年份
  const currentYear = new Date().getFullYear()
  if (date.getFullYear() !== currentYear) {
    return `${date.getFullYear()}/${month}/${day} ${hours}:${minutes}`
  }

  return `${month}/${day} ${hours}:${minutes}`
}

// 获取当前选中节点对应的分类
// 返回：'ai' | 'biology' | 'math' | null
// 如果选中的是一级分类节点，返回该分类
// 如果选中的是二级会话节点，返回该会话的分类
const getSelectedCategory = (): 'ai' | 'biology' | 'math' | null => {
  if (!selectedNodeId.value) {
    return null
  }

  // 查找选中的节点
  const findNodeById = (nodes: TreeNode[], targetId: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return node
      }
      if (node.children) {
        const found = findNodeById(node.children, targetId)
        if (found) return found
      }
    }
    return null
  }

  const selectedNode = findNodeById(treeNodes.value, selectedNodeId.value)
  if (!selectedNode) {
    return null
  }

  // 如果是一级分类节点，直接返回分类
  if (selectedNode.level === 1) {
    return selectedNode.category as 'ai' | 'biology' | 'math'
  }

  // 如果是二级会话节点，返回会话的分类
  if (selectedNode.level === 2) {
    return selectedNode.category as 'ai' | 'biology' | 'math'
  }

  return null
}

// 暴露方法供父组件调用
defineExpose({
  getSelectedCategory,
})

// 监听选中状态变化，更新树形组件的选中状态
watch(
  () => [props.selectedAiSessionId, props.selectedTeacherSessionId],
  () => {
    if (props.selectedAiSessionId) {
      selectedNodeId.value = `ai_${props.selectedAiSessionId}`
    } else if (props.selectedTeacherSessionId) {
      // 需要找到对应的节点ID
      const biologyNode = treeNodes.value
        .find((n) => n.id === 'category_biology')
        ?.children?.find((c) => c.sessionId === props.selectedTeacherSessionId)
      const mathNode = treeNodes.value
        .find((n) => n.id === 'category_math')
        ?.children?.find((c) => c.sessionId === props.selectedTeacherSessionId)

      if (biologyNode) {
        selectedNodeId.value = biologyNode.id
      } else if (mathNode) {
        selectedNodeId.value = mathNode.id
      }
    } else {
      selectedNodeId.value = null
    }
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
.session-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// 顶部标题栏
.tree-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;

  .header-center {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;

    .search-input {
      width: 100%;
      font-size: 14px;
    }
  }

  .header-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
}

// 树形结构容器
.tree-wrapper {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
}

// 树节点头部
.tree-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 40px;

  &.is-selected {
    background-color: #f0f7ff;
    border-radius: 6px;
  }
}

// 分类节点（一级）
.category-node {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  font-weight: 500;
  font-size: 14px;
  color: #333;

  .category-icon {
    color: #9059ff;
  }

  .category-label {
    flex: 1;
  }

  .category-count {
    font-size: 12px;
    color: #999;
    font-weight: normal;
  }
}

// 会话节点（二级）
.session-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
  min-height: 56px;
  padding: 8px 12px;
  margin: 0 -8px;

  .session-content {
    flex: 1;
    min-width: 0;
    cursor: pointer;
    padding: 4px 0;
  }

  .session-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .session-title {
    font-size: 13px;
    font-weight: 500;
    color: #333;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    flex: 1;
    min-width: 0;
  }

  .session-time {
    font-size: 11px;
    color: #999;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .session-subtitle {
    font-size: 12px;
    color: #666;
    line-height: 1.4;
  }

  .session-actions {
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 0.2s ease;

    .more-btn {
      color: #666;

      &:hover {
        color: #333;
      }
    }
  }

  &:hover .session-actions {
    opacity: 1;
  }
}

// 空状态
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
</style>
