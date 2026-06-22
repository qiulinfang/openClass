<template>
  <div class="test-dashboard-view">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <div class="dashboard-container">
      <!-- 侧边栏 -->
      <aside class="sidebar-panel">
        <div class="sidebar-header q-pa-lg">
          <div class="logo-area row items-center q-gutter-sm">
            <q-icon name="terminal" color="primary" size="32px" />
            <div class="text-h6 text-weight-bold">DevConsole</div>
          </div>
        </div>

        <nav class="sidebar-nav q-mt-md">
          <div 
            v-for="cat in categories" 
            :key="cat.id"
            class="nav-item"
            :class="{ active: activeCategory === cat.id }"
            @click="activeCategory = cat.id"
          >
            <q-icon :name="cat.icon" size="20px" class="q-mr-md" />
            <span>{{ cat.label }}</span>
            <q-badge v-if="getCategoryCount(cat.id)" rounded color="primary" class="q-ml-auto">
              {{ getCategoryCount(cat.id) }}
            </q-badge>
          </div>
        </nav>

        <div class="sidebar-footer q-pa-lg">
          <q-btn 
            flat 
            rounded 
            color="grey-7" 
            icon="home" 
            label="返回首页" 
            to="/" 
            class="full-width"
          />
        </div>
      </aside>

      <!-- 主内容区 -->
      <main class="main-panel">
        <!-- 顶部工具栏 -->
        <header class="header-toolbar">
          <div class="header-left">
            <h1 class="text-h5 text-weight-bold q-ma-none">测试页面导航</h1>
            <p class="text-caption text-grey-7 q-ma-none">系统测试与调试中心 · V1.0.4</p>
          </div>
          
          <div class="header-right row items-center q-gutter-md">
            <q-input
              v-model="searchText"
              dense
              standout
              rounded
              placeholder="搜索测试模块... (/)"
              class="search-input"
              ref="searchInputRef"
            >
              <template v-slot:prepend>
                <q-icon name="search" size="20px" />
              </template>
              <template v-slot:append v-if="searchText">
                <q-icon name="close" @click="searchText = ''" class="cursor-pointer" size="16px" />
              </template>
            </q-input>
            
            <q-btn round flat icon="notifications_none" color="grey-8">
              <q-badge floating color="red" rounded />
            </q-btn>
            <q-avatar size="32px">
              <img src="https://cdn.quasar.dev/img/avatar.png">
            </q-avatar>
          </div>
        </header>

        <!-- 内容网格 -->
        <div class="scroll-area q-pa-xl">
          <div v-if="filteredItems.length === 0" class="empty-state q-pa-xl text-center">
            <q-icon name="search_off" size="64px" color="grey-4" />
            <div class="text-h6 text-grey-5 q-mt-md">未找到匹配的测试模块</div>
          </div>

          <div class="row q-col-gutter-xl">
            <transition-group 
              appear
              enter-active-class="animated fadeInUp"
              leave-active-class="animated fadeOutDown"
            >
              <div 
                v-for="(item, index) in filteredItems" 
                :key="item.path" 
                class="col-12 col-sm-6 col-md-4"
              >
                <div 
                  class="glass-card cursor-pointer" 
                  :style="{ animationDelay: `${index * 0.05}s` }"
                  @click="$router.push(item.path)"
                >
                  <div class="card-glow" :style="{ background: item.color || 'var(--q-primary)' }"></div>
                  <div class="card-content">
                    <div class="row items-start justify-between q-mb-lg">
                      <div class="icon-wrapper" :style="{ background: `${item.color || 'var(--q-primary)'}15` }">
                        <q-icon :name="item.icon" :style="{ color: item.color || 'var(--q-primary)' }" size="28px" />
                      </div>
                      <q-badge outline :label="getCategoryLabel(item.category)" color="grey-6" />
                    </div>
                    
                    <div class="text-h6 text-weight-bold q-mb-xs">{{ item.title }}</div>
                    <div class="text-body2 text-grey-7 line-clamp-2 description">
                      {{ item.description }}
                    </div>
                    
                    <div class="card-footer q-mt-xl row items-center justify-between">
                      <div class="status-indicator row items-center">
                        <div class="dot active"></div>
                        <span class="text-caption text-grey-6 q-ml-xs">稳定版</span>
                      </div>
                      <q-icon name="arrow_forward" color="primary" size="20px" class="enter-icon" />
                    </div>
                  </div>
                </div>
              </div>
            </transition-group>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

defineOptions({
  name: 'TestNavView'
})

const searchText = ref('')
const activeCategory = ref('all')
const searchInputRef = ref<HTMLInputElement | null>(null)

const categories = [
  { id: 'all', label: '全部模块', icon: 'grid_view' },
  { id: 'render', label: '渲染引擎', icon: 'auto_awesome' },
  { id: 'business', label: '业务流程', icon: 'account_tree' },
  { id: 'debug', label: '开发调试', icon: 'bug_report' },
  { id: 'component', label: '底层组件', icon: 'extension' }
]

const navItems = [
  {
    title: 'Markdown 渲染测试',
    path: '/markdown-test',
    icon: 'article',
    category: 'render',
    color: '#3498db',
    description: '测试 Markdown 渲染效果，支持 LaTeX 公式、表格、代码块等实时预览。'
  },
  {
    title: 'API 接口调试',
    path: '/debug-api',
    icon: 'api',
    category: 'debug',
    color: '#e67e22',
    description: '系统内部 API 接口调试工具，方便验证后端接口数据返回。'
  },
  {
    title: '会话管理测试',
    path: '/chat-session-test',
    icon: 'chat',
    category: 'business',
    color: '#9b59b6',
    description: '测试聊天会话的存储、同步以及消息流式输出效果。'
  },
  {
    title: 'Lottie 动画测试',
    path: '/lottie-test',
    icon: 'animation',
    category: 'render',
    color: '#e91e63',
    description: '预览和调试系统中使用到的 Lottie 动画文件。'
  },
  {
    title: '基础渲染对比',
    path: '/render-test',
    icon: 'compare',
    category: 'render',
    color: '#00bcd4',
    description: '对比不同渲染引擎（MathJax vs KaTeX）在处理 LaTeX 时的表现。'
  },
  {
    title: '老师端功能调试',
    path: '/teacher-debug',
    icon: 'school',
    category: 'business',
    color: '#4caf50',
    description: '专门用于模拟和调试老师端（WebSocket）下发消息和指令。'
  },
  {
    title: '习题组件测试',
    path: '/test-exercise',
    icon: 'quiz',
    category: 'component',
    color: '#795548',
    description: '测试各类习题（选择、填空、判断）在不同数据下的渲染和交互。'
  },
  {
    title: '作业渲染极限测试',
    path: '/homework-render-test',
    icon: 'assignment_turned_in',
    category: 'render',
    color: '#673ab7',
    description: '测试 HomeworkAnswerView 的各种题型渲染情况，包含复杂 LaTeX、长文本、多图等边缘情况。'
  },
  {
    title: 'HomeworkHeader 极限长度测试',
    path: '/homework-header-test',
    icon: 'menu',
    category: 'component',
    color: '#3f51b5',
    description: '测试 HomeworkHeader 头部组件在不同标题长度、不同题目数量下的布局与交互表现。'
  }
]

const filteredItems = computed(() => {
  return navItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchText.value.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchText.value.toLowerCase())
    const matchesCategory = activeCategory.value === 'all' || item.category === activeCategory.value
    return matchesSearch && matchesCategory
  })
})

const getCategoryCount = (catId: string) => {
  if (catId === 'all') return navItems.length
  return navItems.filter(item => item.category === catId).length
}

const getCategoryLabel = (catId: string) => {
  return categories.find(c => c.id === catId)?.label || catId
}

// 快捷键监听
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault()
    searchInputRef.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.test-dashboard-view {
  width: 100vw;
  height: 100vh;
  background-color: #f0f2f5;
  overflow: hidden;
  position: relative;
}

/* 背景装饰 */
.bg-decoration {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  z-index: 0;
}

.blob-1 {
  width: 500px;
  height: 500px;
  background: #3498db33;
  top: -100px;
  right: -100px;
}

.blob-2 {
  width: 400px;
  height: 400px;
  background: #9b59b622;
  bottom: -50px;
  left: -50px;
}

.blob-3 {
  width: 300px;
  height: 300px;
  background: #2ecc7111;
  top: 40%;
  left: 30%;
}

.dashboard-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 1;
}

/* 侧边栏 */
.sidebar-panel {
  width: 260px;
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.sidebar-nav {
  flex: 1;
  padding: 0 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin: 4px 0;
  border-radius: 12px;
  cursor: pointer;
  color: #5f6368;
  transition: all 0.2s ease;
  font-weight: 500;
}

.nav-item:hover {
  background: rgba(0, 0, 0, 0.03);
  color: #1a73e8;
}

.nav-item.active {
  background: #1a73e815;
  color: #1a73e8;
}

/* 主内容区 */
.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header-toolbar {
  height: 80px;
  padding: 0 40px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-input {
  width: 300px;
  transition: width 0.3s ease;
}

.search-input:focus-within {
  width: 400px;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* 现代化卡片 */
.glass-card {
  position: relative;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 24px;
  padding: 32px;
  height: 100%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  overflow: hidden;
}

.glass-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
  border-color: rgba(26, 115, 232, 0.3);
}

.card-glow {
  position: absolute;
  top: -50px;
  right: -50px;
  width: 100px;
  height: 100px;
  filter: blur(40px);
  opacity: 0.15;
  transition: all 0.4s ease;
}

.glass-card:hover .card-glow {
  opacity: 0.3;
  transform: scale(1.5);
}

.icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.description {
  height: 40px;
  line-height: 1.5;
  overflow: hidden;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

.dot.active {
  background: #2ecc71;
  box-shadow: 0 0 8px #2ecc7188;
}

.enter-icon {
  opacity: 0.3;
  transform: translateX(-10px);
  transition: all 0.3s ease;
}

.glass-card:hover .enter-icon {
  opacity: 1;
  transform: translateX(0);
}

/* 动画效果 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animated {
  animation-duration: 0.6s;
  animation-fill-mode: both;
}

.fadeInUp {
  animation-name: fadeInUp;
}
</style>
