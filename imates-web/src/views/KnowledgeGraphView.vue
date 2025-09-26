<template>
  <div class="knowledge-graph-layout">
    <!-- 第一列：功能箱/侧边栏（最左侧） -->
    <div class="function-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <!-- 展开/收起按钮 -->
      <div class="sidebar-toggle">
        <q-btn 
          flat 
          dense 
          round 
          class="toggle-btn"
          @click="toggleSidebar"
        >
          <q-icon name="menu" size="20px" color="grey-6" />
        </q-btn>
      </div>

      <!-- 功能菜单 -->
      <div class="function-menu" v-show="!sidebarCollapsed">
        <div class="nav-item" :class="{ active: false }">
          <q-icon name="apps" size="24px" color="grey-6" />
          <span class="nav-text">功能箱</span>
        </div>
        <div class="nav-item active">
          <q-icon name="account_tree" size="24px" color="white" />
          <span class="nav-text">知识图谱</span>
        </div>
        <div class="nav-item">
          <q-icon name="school" size="24px" color="grey-6" />
          <span class="nav-text">学习进度</span>
        </div>
        <div class="nav-item">
          <q-icon name="analytics" size="24px" color="grey-6" />
          <span class="nav-text">数据分析</span>
        </div>
      </div>
    </div>

    <!-- 第二列：章节目录/内容导航（中间） -->
    <div class="chapter-sidebar" :class="{ collapsed: chapterCollapsed }">
      <!-- 收起按钮 -->
      <div class="chapter-toggle">
        <q-btn 
          flat 
          dense 
          round 
          class="toggle-btn"
          @click="toggleChapter"
        >
          <q-icon name="chevron_left" size="20px" color="grey-6" />
        </q-btn>
      </div>

      <!-- 科目和版本信息 -->
      <div class="subject-info" v-show="!chapterCollapsed">
        <div class="subject-header">
          <q-icon name="menu_book" size="20px" color="grey-7" />
          <span class="subject-text">数学</span>
        </div>
        <div class="textbook-info">
        <q-select
          v-model="selectedTextbook"
          :options="textbookOptions"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          outlined
          dense
          class="textbook-select"
          popup-content-class="textbook-popup"
          @update:model-value="onTextbookChange"
        >
            <template v-slot:selected>
              <div class="textbook-selected">
                <span class="textbook-text">{{ selectedTextbookLabel }}</span>
                <q-icon name="keyboard_arrow_down" size="16px" color="grey-6" />
              </div>
            </template>
          </q-select>
        </div>
      </div>

      <!-- 章节目录列表 -->
      <div class="chapter-list" v-show="!chapterCollapsed">
        <div 
          v-for="(chapter, index) in chapters" 
          :key="index"
          class="chapter-item"
          :class="{ active: index === selectedChapter }"
          @click="selectChapter(index)"
        >
          <span class="chapter-text">{{ chapter }}</span>
          <div class="chapter-progress" v-if="index === selectedChapter">
            <q-linear-progress 
              :value="0.6" 
              color="primary" 
              size="2px"
              class="progress-bar"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 第三列：核心内容/知识图谱（最右侧） -->
    <div class="main-content">
      <!-- 筛选器 -->
      <div class="filter-section">
        <div class="filter-tags">
          <q-chip 
            v-for="status in learningStatuses" 
            :key="status.value"
            :color="status.color"
            :text-color="status.textColor"
            :outline="selectedStatus !== status.value"
            clickable
            @click="selectStatus(status.value)"
            class="status-chip"
          >
            {{ status.label }}
          </q-chip>
        </div>
        <div class="filter-actions">
          <q-btn 
            flat 
            dense 
            icon="search" 
            @click="showSearchDialog = true"
            class="search-btn"
          >
            <q-tooltip>搜索知识点</q-tooltip>
          </q-btn>
          <q-btn 
            flat 
            dense 
            icon="filter_list" 
            @click="showFilterDialog = true"
            class="filter-btn"
          >
            <q-tooltip>高级筛选</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- 知识图谱容器 -->
      <div class="graph-container" ref="graphContainer">
        <div id="knowledge-graph" class="graph-canvas">
          <!-- 中心节点 -->
          <div class="center-node">
            <div class="star-node main-star">
              <span class="node-number">2.1</span>
            </div>
            <div class="node-title">方程组的解集</div>
            <div class="node-underline"></div>
          </div>

          <!-- 周围节点 -->
          <div class="surrounding-nodes">
            <div 
              v-for="(node, index) in surroundingNodes" 
              :key="index"
              class="star-node"
              :class="node.status"
              :style="node.style"
            >
              <span class="node-number">{{ node.number }}</span>
              <div class="node-label">{{ node.label }}</div>
              <div v-if="node.tag" class="node-tag">{{ node.tag }}</div>
            </div>
          </div>

          <!-- 图例 -->
          <div class="legend">
            <div class="legend-item">
              <div class="legend-star not-learned"></div>
              <span>未学习</span>
            </div>
            <div class="legend-item">
              <div class="legend-star learning"></div>
              <span>正在学</span>
            </div>
            <div class="legend-item">
              <div class="legend-star learned"></div>
              <span>已学习</span>
            </div>
          </div>
        </div>
        
        <!-- 加载状态 -->
        <div v-if="loading" class="loading-overlay">
          <q-spinner-dots size="40px" color="primary" />
          <div class="loading-text">正在加载知识图谱...</div>
        </div>
      </div>
    </div>

    <!-- 教材选择对话框 -->
    <q-dialog v-model="showTextbookDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">选择教材</div>
        </q-card-section>
        <q-card-section>
          <q-list>
            <q-item clickable v-close-popup>
              <q-item-section>上册/人教版/必修一</q-item-section>
            </q-item>
            <q-item clickable v-close-popup>
              <q-item-section>下册/人教版/必修二</q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- 搜索对话框 -->
    <q-dialog v-model="showSearchDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">搜索知识点</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="searchQuery"
            placeholder="输入知识点名称..."
            outlined
            @keyup.enter="searchNodes"
          >
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" @click="showSearchDialog = false" />
          <q-btn color="primary" label="搜索" @click="searchNodes" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 筛选对话框 -->
    <q-dialog v-model="showFilterDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">筛选条件</div>
        </q-card-section>
        <q-card-section>
          <div class="q-gutter-md">
            <q-select
              v-model="selectedTypes"
              :options="nodeTypes"
              label="知识点类型"
              multiple
              outlined
              use-chips
            />
            <q-range
              v-model="difficultyRange"
              :min="1"
              :max="5"
              :step="1"
              label="难度范围"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" @click="showFilterDialog = false" />
          <q-btn color="primary" label="应用筛选" @click="applyFilter" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 添加节点对话框 -->
    <q-dialog v-model="showAddNodeDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">添加知识点</div>
        </q-card-section>
        <q-card-section>
          <div class="q-gutter-md">
            <q-input
              v-model="newNode.label"
              label="知识点名称"
              outlined
              required
            />
            <q-select
              v-model="newNode.type"
              :options="nodeTypes"
              label="知识点类型"
              outlined
              required
            />
            <q-input
              v-model="newNode.description"
              label="描述"
              type="textarea"
              outlined
              rows="3"
            />
            <q-input
              v-model.number="newNode.difficulty"
              label="难度等级"
              type="number"
              min="1"
              max="5"
              outlined
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="取消" @click="cancelAddNode" />
          <q-btn color="primary" label="添加" @click="addNode" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, computed } from 'vue'

// 响应式数据
const loading = ref(true)
const showNodeDetails = ref(false)
const showSearchDialog = ref(false)
const showFilterDialog = ref(false)
const showAddNodeDialog = ref(false)
const showTextbookDialog = ref(false)
const searchQuery = ref('')
const selectedTypes = ref<string[]>([])
const difficultyRange = ref({ min: 1, max: 5 })
const selectedNode = ref<Record<string, unknown> | null>(null)
const selectedChapter = ref(0)
const graphContainer = ref<HTMLElement>()

// 布局控制
const sidebarCollapsed = ref(false)
const chapterCollapsed = ref(false)
const selectedStatus = ref('all')

// 教材选择器
const selectedTextbook = ref('math-up-renjiao-bixiu1')
const textbookOptions = ref([
  { value: 'math-up-renjiao-bixiu1', label: '上册/人教版/必修一' },
  { value: 'math-down-renjiao-bixiu1', label: '下册/人教版/必修一' },
  { value: 'math-up-renjiao-bixiu2', label: '上册/人教版/必修二' },
  { value: 'math-down-renjiao-bixiu2', label: '下册/人教版/必修二' },
  { value: 'math-up-beishida-bixiu1', label: '上册/北师大版/必修一' },
  { value: 'math-down-beishida-bixiu1', label: '下册/北师大版/必修一' },
  { value: 'math-up-beishida-bixiu2', label: '上册/北师大版/必修二' },
  { value: 'math-down-beishida-bixiu2', label: '下册/北师大版/必修二' }
])

// 计算属性：当前选中的教材标签
const selectedTextbookLabel = computed(() => {
  const option = textbookOptions.value.find(opt => opt.value === selectedTextbook.value)
  return option ? option.label : '上册/人教版/必修一'
})

// 学习状态选项
const learningStatuses = ref([
  { value: 'all', label: '全部', color: 'grey-5', textColor: 'white' },
  { value: 'not-learned', label: '未学习', color: 'red-4', textColor: 'white' },
  { value: 'learning', label: '正在学', color: 'orange-4', textColor: 'white' },
  { value: 'learned', label: '已学习', color: 'green-4', textColor: 'white' }
])

// 章节数据
const chapters = ref([
  '第一章 集合与常用逻辑用语',
  '第二章 集合与常用逻辑用语',
  '第三章 集合',
  '第四章 集合与常用逻辑用语的的的...',
  '第五章 集合与常用逻辑用语'
])

// 周围节点数据
const surroundingNodes = ref([
  {
    number: '2.1',
    label: '方程组的解集',
    status: 'not-learned',
    style: { top: '20%', left: '10%' }
  },
  {
    number: '2.1',
    label: '方程组的解集',
    status: 'not-learned',
    style: { top: '20%', right: '10%' }
  },
  {
    number: '2.1',
    label: '方程组的解集',
    status: 'last-learned',
    tag: '上次学到',
    style: { top: '40%', right: '15%' }
  },
  {
    number: '2.1',
    label: '方程组的解集',
    status: 'learned',
    style: { top: '60%', left: '15%' }
  },
  {
    number: '2.1',
    label: '方程组的解集',
    status: 'learned',
    style: { top: '60%', right: '15%' }
  },
  {
    number: '2.2',
    label: '方程组的解集',
    status: 'faded',
    style: { top: '10%', right: '5%' }
  },
  {
    number: '2.2',
    label: '方程组的解集',
    status: 'faded',
    style: { bottom: '10%', right: '5%' }
  }
])

// 图谱数据
const nodes = ref<Record<string, unknown>[]>([])
const edges = ref<Record<string, unknown>[]>([])

// 节点类型
const nodeTypes = [
  { label: '概念', value: 'concept' },
  { label: '定理', value: 'theorem' },
  { label: '公式', value: 'formula' },
  { label: '方法', value: 'method' },
  { label: '应用', value: 'application' }
]

// 新节点数据
const newNode = reactive({
  label: '',
  type: 'concept',
  description: '',
  difficulty: 1
})

// 初始化图谱数据
const initGraphData = () => {
  // 模拟数据
  nodes.value = [
    {
      id: '1',
      label: '线性代数',
      type: 'concept',
      description: '数学的一个重要分支，研究向量空间和线性变换',
      difficulty: 3,
      x: 0,
      y: 0,
      related: [
        { id: '2', label: '矩阵', type: 'concept' },
        { id: '3', label: '向量', type: 'concept' }
      ]
    },
    {
      id: '2',
      label: '矩阵',
      type: 'concept',
      description: '由数字排列成的矩形阵列',
      difficulty: 2,
      x: 200,
      y: 100,
      related: [
        { id: '1', label: '线性代数', type: 'concept' },
        { id: '4', label: '矩阵乘法', type: 'method' }
      ]
    },
    {
      id: '3',
      label: '向量',
      type: 'concept',
      description: '具有大小和方向的量',
      difficulty: 2,
      x: -200,
      y: 100,
      related: [
        { id: '1', label: '线性代数', type: 'concept' },
        { id: '5', label: '向量运算', type: 'method' }
      ]
    },
    {
      id: '4',
      label: '矩阵乘法',
      type: 'method',
      description: '两个矩阵相乘的运算方法',
      difficulty: 3,
      x: 300,
      y: 200,
      related: [
        { id: '2', label: '矩阵', type: 'concept' }
      ]
    },
    {
      id: '5',
      label: '向量运算',
      type: 'method',
      description: '向量的加法、减法、数乘等运算',
      difficulty: 2,
      x: -300,
      y: 200,
      related: [
        { id: '3', label: '向量', type: 'concept' }
      ]
    }
  ]

  edges.value = [
    { from: '1', to: '2', label: '包含' },
    { from: '1', to: '3', label: '包含' },
    { from: '2', to: '4', label: '应用' },
    { from: '3', to: '5', label: '应用' }
  ]
}

// 获取节点颜色
const getNodeColor = (type: unknown) => {
  const colors: { [key: string]: string } = {
    concept: 'primary',
    theorem: 'secondary',
    formula: 'positive',
    method: 'warning',
    application: 'info'
  }
  return colors[String(type)] || 'grey'
}

// 初始化图谱
const initGraph = async () => {
  loading.value = true
  
  try {
    // 模拟加载延迟
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    initGraphData()
    
    // 这里可以集成真实的图谱库，如 vis.js, d3.js, cytoscape.js 等
    // 目前使用简单的DOM渲染
    await nextTick()
    renderGraph()
    
  } catch (error) {
    console.error('初始化知识图谱失败:', error)
  } finally {
    loading.value = false
  }
}

// 渲染图谱
const renderGraph = () => {
  const container = document.getElementById('knowledge-graph')
  if (!container) return

  // 简单的图谱渲染实现
  container.innerHTML = `
    <div class="graph-nodes">
      ${nodes.value.map(node => `
        <div 
          class="graph-node ${getNodeColor(node.type)}"
          style="left: ${(node.x as number) + 400}px; top: ${(node.y as number) + 200}px;"
          data-node-id="${node.id}"
        >
          <div class="node-label">${node.label}</div>
          <div class="node-type">${nodeTypes.find(t => t.value === node.type)?.label}</div>
        </div>
      `).join('')}
    </div>
    <svg class="graph-edges">
      ${edges.value.map(edge => {
        const fromNode = nodes.value.find(n => n.id === edge.from)
        const toNode = nodes.value.find(n => n.id === edge.to)
        if (!fromNode || !toNode) return ''
        
        const x1 = (fromNode.x as number) + 400 + 50
        const y1 = (fromNode.y as number) + 200 + 25
        const x2 = (toNode.x as number) + 400 + 50
        const y2 = (toNode.y as number) + 200 + 25
        
        return `
          <line 
            x1="${x1}" y1="${y1}" 
            x2="${x2}" y2="${y2}" 
            stroke="#666" 
            stroke-width="2"
            marker-end="url(#arrowhead)"
          />
          <text 
            x="${(x1 + x2) / 2}" 
            y="${(y1 + y2) / 2 - 5}" 
            text-anchor="middle" 
            font-size="12" 
            fill="#666"
          >
            ${edge.label}
          </text>
        `
      }).join('')}
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
        </marker>
      </defs>
    </svg>
  `

  // 添加节点点击事件
  container.querySelectorAll('.graph-node').forEach(nodeEl => {
    nodeEl.addEventListener('click', (e) => {
      const nodeId = (e.currentTarget as HTMLElement).dataset.nodeId
      const node = nodes.value.find(n => n.id === nodeId)
      if (node) {
        selectedNode.value = node
        showNodeDetails.value = true
      }
    })
  })
}

// 搜索节点
const searchNodes = () => {
  if (!searchQuery.value.trim()) return
  
  const query = searchQuery.value.toLowerCase()
  const filteredNodes = nodes.value.filter(node => 
    String(node.label).toLowerCase().includes(query) ||
    String(node.description).toLowerCase().includes(query)
  )
  
  console.log('搜索结果:', filteredNodes)
  showSearchDialog.value = false
}

// 应用筛选
const applyFilter = () => {
  console.log('应用筛选:', { selectedTypes: selectedTypes.value, difficultyRange: difficultyRange.value })
  showFilterDialog.value = false
}

// 教材切换
const onTextbookChange = (value: string) => {
  console.log('切换教材:', value)
  // 这里可以根据选择的教材重新加载对应的知识图谱数据
  // 例如：重新初始化图谱数据、更新章节列表等
  initGraphData()
  renderGraph()
}

// 添加节点
const addNode = () => {
  if (!newNode.label.trim()) return
  
  const id = (nodes.value.length + 1).toString()
  const newNodeData = {
    ...newNode,
    id,
    x: Math.random() * 400 - 200,
    y: Math.random() * 400 - 200,
    related: []
  }
  
  nodes.value.push(newNodeData)
  renderGraph()
  
  // 重置表单
  cancelAddNode()
  showAddNodeDialog.value = false
}

// 取消添加节点
const cancelAddNode = () => {
  newNode.label = ''
  newNode.type = 'concept'
  newNode.description = ''
  newNode.difficulty = 1
}

// 选择章节
const selectChapter = (index: number) => {
  selectedChapter.value = index
  // 这里可以添加切换章节的逻辑
  console.log('选择章节:', chapters.value[index])
}

// 布局控制方法
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const toggleChapter = () => {
  chapterCollapsed.value = !chapterCollapsed.value
}

// 选择学习状态
const selectStatus = (status: string) => {
  selectedStatus.value = status
  // 这里可以根据状态筛选节点
  filterNodesByStatus(status)
}

// 根据状态筛选节点
const filterNodesByStatus = (status: string) => {
  if (status === 'all') {
    // 显示所有节点
    surroundingNodes.value.forEach(node => {
      (node as Record<string, unknown>).visible = true
    })
  } else {
    // 只显示指定状态的节点
    surroundingNodes.value.forEach(node => {
      (node as Record<string, unknown>).visible = node.status === status
    })
  }
}

// 组件挂载时初始化
onMounted(() => {
  initGraph()
})
</script>

<style lang="scss" scoped>
.knowledge-graph-layout {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #f8f7ff 0%, #ffffff 100%);
}

// 第一列：功能箱/侧边栏（最左侧）
.function-sidebar {
  width: 60px;
  background: white;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: relative;
  
  &.collapsed {
    width: 60px;
  }
  
  &:not(.collapsed) {
    width: 200px;
  }
}

.sidebar-toggle {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: center;
}

.function-menu {
  flex: 1;
  padding: 16px 0;
  
  .nav-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    margin: 4px 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      
      .nav-text {
        color: white;
      }
    }
    
    &:hover:not(.active) {
      background: #f3f4f6;
    }
    
    .nav-text {
      margin-left: 12px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }
  }
}

// 第二列：章节目录/内容导航（中间）
.chapter-sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: relative;
  
  &.collapsed {
    width: 50px;
  }
}

.chapter-toggle {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.subject-info {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.subject-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  
  .subject-text {
    font-size: 16px;
    font-weight: 500;
    color: #374151;
  }
}

.textbook-info {
  .textbook-select {
    width: 100%;
    
    .q-field__control {
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: white;
      
      &:hover {
        background: #f9fafb;
      }
    }
    
    .q-field__native {
      padding: 8px 12px;
    }
  }
  
  .textbook-selected {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  
  .textbook-text {
    font-size: 14px;
    color: #374151;
    font-weight: 500;
  }
}

// 教材选择器弹出样式
:deep(.textbook-popup) {
  .q-menu {
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid #e5e7eb;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .q-item {
    padding: 12px 16px;
    font-size: 14px;
    color: #374151;
    
    &:hover {
      background: #f3f4f6;
    }
    
    &.q-item--active {
      background: #eff6ff;
      color: #2563eb;
    }
  }
}

.chapter-list {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
  
  .chapter-item {
    padding: 12px 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    
    &.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      
      .chapter-text {
        color: white;
      }
    }
    
    &:hover:not(.active) {
      background: #f3f4f6;
    }
    
    .chapter-text {
      font-size: 14px;
      color: #374151;
    }
    
    .chapter-progress {
      margin-top: 8px;
      
      .progress-bar {
        height: 2px;
        border-radius: 1px;
      }
    }
  }
}

// 第三列：核心内容/知识图谱（最右侧）
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.filter-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  
  .filter-tags {
    display: flex;
    gap: 8px;
    
    .status-chip {
      cursor: pointer;
      transition: all 0.2s ease;
      
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
    }
  }
  
  .filter-actions {
    display: flex;
    gap: 8px;
    
    .search-btn, .filter-btn {
      color: #6b7280;
      
      &:hover {
        color: #374151;
        background: #f3f4f6;
      }
    }
  }
}

.user-section {
  display: flex;
  align-items: center;
  padding: 0 20px 20px;
  gap: 12px;
}

.user-avatar {
  flex-shrink: 0;
}

.subject-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  
  .subject-text {
    font-size: 16px;
    font-weight: 500;
    color: #374151;
  }
}

.textbook-selector {
  padding: 0 20px 20px;
}

.textbook-btn {
  width: 100%;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .textbook-text {
    font-size: 14px;
    color: #374151;
  }
}

.navigation-menu {
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.active {
    background: #8b5cf6;
    
    .nav-text {
      color: white;
    }
  }
  
  .nav-text {
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
  }
}

.chapter-list {
  flex: 1;
  padding: 0 20px;
  overflow-y: auto;
}

.chapter-item {
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 4px;
  
  &.active {
    background: #f3f0ff;
    
    .chapter-text {
      color: #8b5cf6;
      font-weight: 500;
    }
  }
  
  .chapter-text {
    font-size: 14px;
    color: #6b7280;
    line-height: 1.4;
  }
}

.bottom-menu {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.menu-btn {
  position: relative;
}

.graph-container {
  flex: 1;
  position: relative;
  background: 
    radial-gradient(circle at 20% 20%, rgba(139, 92, 246, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.8) 0%, transparent 50%);
}

.graph-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 中心节点
.center-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 10;
}

.star-node {
  width: 80px;
  height: 80px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    background: #8b5cf6;
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
    z-index: -1;
  }
  
  &.main-star {
    width: 100px;
    height: 100px;
    
    &::before {
      background: #8b5cf6;
    }
  }
  
  &.not-learned {
    &::before {
      background: #e5e7eb;
    }
  }
  
  &.learning {
    &::before {
      background: #fbbf24;
    }
  }
  
  &.learned {
    &::before {
      background: #8b5cf6;
    }
  }
  
  &.last-learned {
    &::before {
      background: #f97316;
    }
  }
  
  &.faded {
    opacity: 0.3;
    
    &::before {
      background: #d1d5db;
    }
  }
  
  &:hover {
    transform: scale(1.1);
  }
}

.node-number {
  color: white;
  font-size: 18px;
  font-weight: 600;
  z-index: 1;
}

.node-title {
  margin-top: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #374151;
  text-align: center;
}

.node-underline {
  width: 60px;
  height: 2px;
  background: #8b5cf6;
  margin-top: 4px;
}

.node-label {
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  z-index: 1;
}

.node-tag {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: #ef4444;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  z-index: 1;
}

// 周围节点
.surrounding-nodes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

// 图例
.legend {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.legend-star {
  width: 16px;
  height: 16px;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  }
  
  &.not-learned::before {
    background: #e5e7eb;
  }
  
  &.learning::before {
    background: #fbbf24;
  }
  
  &.learned::before {
    background: #8b5cf6;
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 1000;

  .loading-text {
    margin-top: 16px;
    color: #666;
    font-size: 14px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .left-sidebar {
    width: 240px;
  }
  
  .star-node {
    width: 60px;
    height: 60px;
    
    &.main-star {
      width: 80px;
      height: 80px;
    }
  }
  
  .node-number {
    font-size: 14px;
  }
  
  .node-title {
    font-size: 14px;
  }
  
  .legend {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
