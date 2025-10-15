<template>
  <div class="my-resources-view">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">我的资源</h1>
      <p class="page-subtitle">管理您的学习资源和下载内容</p>
    </div>

    <!-- 资源统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon">
          <img src="/icons/downloadResources.svg" alt="下载资源" />
        </div>
        <div class="stat-content">
          <div class="stat-number">{{ totalDownloads }}</div>
          <div class="stat-label">总下载</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <img src="/icons/book.svg" alt="文档资源" />
        </div>
        <div class="stat-content">
          <div class="stat-number">{{ documentCount }}</div>
          <div class="stat-label">文档资源</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">
          <img src="/icons/toolBox.svg" alt="工具资源" />
        </div>
        <div class="stat-content">
          <div class="stat-number">{{ toolCount }}</div>
          <div class="stat-label">工具资源</div>
        </div>
      </div>
    </div>

    <!-- 资源筛选和搜索 -->
    <div class="filter-section">
      <div class="search-box">
        <input 
          v-model="searchKeyword" 
          type="text" 
          placeholder="搜索资源..." 
          class="search-input"
        />
        <img src="/icons/search.svg" alt="搜索" class="search-icon" />
      </div>
      
      <div class="filter-tabs">
        <button 
          v-for="category in categories" 
          :key="category.value"
          :class="['filter-tab', { active: activeCategory === category.value }]"
          @click="activeCategory = category.value"
        >
          {{ category.label }}
        </button>
      </div>
    </div>

    <!-- 资源列表 -->
    <div class="resources-container">
      <div class="resources-header">
        <h2 class="section-title">资源列表</h2>
        <div class="view-controls">
          <button 
            :class="['view-btn', { active: viewMode === 'grid' }]"
            @click="viewMode = 'grid'"
          >
            <img src="/icons/grid.svg" alt="网格视图" />
          </button>
          <button 
            :class="['view-btn', { active: viewMode === 'list' }]"
            @click="viewMode = 'list'"
          >
            <img src="/icons/list.svg" alt="列表视图" />
          </button>
        </div>
      </div>

      <!-- 资源网格/列表 -->
      <div :class="['resources-list', viewMode]">
        <div 
          v-for="resource in filteredResources" 
          :key="resource.id"
          class="resource-item"
        >
          <div class="resource-icon">
            <img :src="resource.icon" :alt="resource.name" />
          </div>
          
          <div class="resource-info">
            <h3 class="resource-name">{{ resource.name }}</h3>
            <p class="resource-description">{{ resource.description }}</p>
            <div class="resource-meta">
              <span class="resource-type">{{ resource.type }}</span>
              <span class="resource-size">{{ resource.size }}</span>
              <span class="resource-date">{{ formatDate(resource.downloadDate) }}</span>
            </div>
          </div>
          
          <div class="resource-actions">
            <button class="action-btn download" @click="downloadResource(resource)">
              <img src="/icons/download.svg" alt="下载" />
              重新下载
            </button>
            <button class="action-btn delete" @click="deleteResource(resource)">
              <img src="/icons/delete.svg" alt="删除" />
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filteredResources.length === 0" class="empty-state">
        <img src="/icons/empty-resources.svg" alt="暂无资源" class="empty-icon" />
        <h3 class="empty-title">暂无资源</h3>
        <p class="empty-description">
          {{ searchKeyword ? '没有找到匹配的资源' : '您还没有下载任何资源' }}
        </p>
        <button v-if="!searchKeyword" class="explore-btn" @click="goToFindExercise">
          去发现资源
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// 路由
const router = useRouter()

// 响应式数据
const searchKeyword = ref('')
const activeCategory = ref('all')
const viewMode = ref<'grid' | 'list'>('grid')

// 资源数据
const resources = ref([
  {
    id: 1,
    name: '高中数学必修一',
    description: '高中数学必修一完整教材PDF',
    type: 'PDF文档',
    size: '15.2 MB',
    downloadDate: new Date('2024-01-15'),
    icon: '/icons/pdf.svg',
    category: 'document'
  },
  {
    id: 2,
    name: '物理实验工具包',
    description: '包含各种物理实验的模拟工具',
    type: '工具包',
    size: '8.7 MB',
    downloadDate: new Date('2024-01-10'),
    icon: '/icons/toolBox.svg',
    category: 'tool'
  },
  {
    id: 3,
    name: '化学元素周期表',
    description: '交互式化学元素周期表',
    type: '交互工具',
    size: '3.1 MB',
    downloadDate: new Date('2024-01-08'),
    icon: '/icons/chemistry.svg',
    category: 'tool'
  },
  {
    id: 4,
    name: '英语词汇手册',
    description: '高中英语核心词汇整理',
    type: 'PDF文档',
    size: '12.5 MB',
    downloadDate: new Date('2024-01-05'),
    icon: '/icons/pdf.svg',
    category: 'document'
  },
  {
    id: 5,
    name: '数学公式大全',
    description: '高中数学所有重要公式汇总',
    type: 'PDF文档',
    size: '6.8 MB',
    downloadDate: new Date('2024-01-03'),
    icon: '/icons/pdf.svg',
    category: 'document'
  }
])

// 分类选项
const categories = [
  { label: '全部', value: 'all' },
  { label: '文档', value: 'document' },
  { label: '工具', value: 'tool' },
  { label: '视频', value: 'video' }
]

// 计算属性
const totalDownloads = computed(() => resources.value.length)
const documentCount = computed(() => resources.value.filter(r => r.category === 'document').length)
const toolCount = computed(() => resources.value.filter(r => r.category === 'tool').length)

const filteredResources = computed(() => {
  let filtered = resources.value

  // 按分类筛选
  if (activeCategory.value !== 'all') {
    filtered = filtered.filter(resource => resource.category === activeCategory.value)
  }

  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    filtered = filtered.filter(resource => 
      resource.name.toLowerCase().includes(keyword) ||
      resource.description.toLowerCase().includes(keyword) ||
      resource.type.toLowerCase().includes(keyword)
    )
  }

  return filtered
})

// 方法
const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const downloadResource = (resource: any) => {
  console.log('重新下载资源:', resource.name)
  // TODO: 实现重新下载逻辑
}

const deleteResource = (resource: any) => {
  if (confirm(`确定要删除资源"${resource.name}"吗？`)) {
    const index = resources.value.findIndex(r => r.id === resource.id)
    if (index > -1) {
      resources.value.splice(index, 1)
    }
  }
}

const goToFindExercise = () => {
  router.push({ name: 'findExercise' })
}

// 生命周期
onMounted(() => {
  console.log('我的资源页面已加载')
})
</script>

<style lang="scss" scoped>
.my-resources-view {
  padding: 24px;
  background: #100035;
  min-height: 100vh;
  color: white;
}

// 页面标题
.page-header {
  margin-bottom: 32px;
  
  .page-title {
    font-size: 32px;
    font-weight: 600;
    color: white;
    margin: 0 0 8px 0;
  }
  
  .page-subtitle {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
  }
}

// 统计卡片
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
  
  .stat-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    
    .stat-icon {
      width: 48px;
      height: 48px;
      background: #9059FF;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      
      img {
        width: 24px;
        height: 24px;
        filter: brightness(0) invert(1);
      }
    }
    
    .stat-content {
      .stat-number {
        font-size: 24px;
        font-weight: 600;
        color: white;
        margin-bottom: 4px;
      }
      
      .stat-label {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
      }
    }
  }
}

// 筛选区域
.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
  
  .search-box {
    position: relative;
    flex: 1;
    max-width: 400px;
    
    .search-input {
      width: 100%;
      padding: 12px 16px 12px 44px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: white;
      font-size: 14px;
      
      &::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }
      
      &:focus {
        outline: none;
        border-color: #9059FF;
      }
    }
    
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      filter: brightness(0) invert(1);
      opacity: 0.5;
    }
  }
  
  .filter-tabs {
    display: flex;
    gap: 8px;
    
    .filter-tab {
      padding: 8px 16px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &.active {
        background: #9059FF;
        border-color: #9059FF;
        color: white;
      }
      
      &:hover:not(.active) {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.2);
      }
    }
  }
}

// 资源容器
.resources-container {
  .resources-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: white;
      margin: 0;
    }
    
    .view-controls {
      display: flex;
      gap: 8px;
      
      .view-btn {
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        
        &.active {
          background: #9059FF;
          border-color: #9059FF;
        }
        
        img {
          width: 16px;
          height: 16px;
          filter: brightness(0) invert(1);
        }
      }
    }
  }
}

// 资源列表
.resources-list {
  &.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  
  &.list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .resource-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: all 0.2s ease;
    
    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }
    
    .resource-icon {
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      
      img {
        width: 24px;
        height: 24px;
        filter: brightness(0) invert(1);
      }
    }
    
    .resource-info {
      flex: 1;
      min-width: 0;
      
      .resource-name {
        font-size: 16px;
        font-weight: 600;
        color: white;
        margin: 0 0 4px 0;
      }
      
      .resource-description {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0 0 8px 0;
        line-height: 1.4;
      }
      
      .resource-meta {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        
        span {
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
      }
    }
    
    .resource-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      
      .action-btn {
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 4px;
        
        &.download {
          background: #9059FF;
          color: white;
          border: none;
          
          &:hover {
            background: #7c4dff;
          }
        }
        
        &.delete {
          background: transparent;
          color: #ff6b6b;
          border: 1px solid #ff6b6b;
          
          &:hover {
            background: #ff6b6b;
            color: white;
          }
        }
        
        img {
          width: 14px;
          height: 14px;
          filter: brightness(0) invert(1);
        }
      }
    }
  }
}

// 空状态
.empty-state {
  text-align: center;
  padding: 60px 20px;
  
  .empty-icon {
    width: 80px;
    height: 80px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
  
  .empty-title {
    font-size: 20px;
    font-weight: 600;
    color: white;
    margin: 0 0 8px 0;
  }
  
  .empty-description {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 24px 0;
  }
  
  .explore-btn {
    padding: 12px 24px;
    background: #9059FF;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: #7c4dff;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .my-resources-view {
    padding: 16px;
  }
  
  .stats-cards {
    grid-template-columns: 1fr;
  }
  
  .filter-section {
    flex-direction: column;
    align-items: stretch;
    
    .search-box {
      max-width: none;
    }
    
    .filter-tabs {
      justify-content: center;
    }
  }
  
  .resources-list.grid {
    grid-template-columns: 1fr;
  }
  
  .resource-item {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
    
    .resource-actions {
      justify-content: center;
    }
  }
}
</style>
