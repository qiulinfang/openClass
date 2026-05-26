<template>
  <div class="test-nav-view q-pa-lg">
    <div class="header q-mb-xl">
      <h1 class="text-h4 text-weight-bold text-primary q-mb-sm">测试页面导航</h1>
      <p class="text-subtitle1 text-grey-7">统一管理和访问系统中的所有测试与调试页面</p>
    </div>

    <div class="row q-col-gutter-lg">
      <div v-for="item in navItems" :key="item.path" class="col-12 col-sm-6 col-md-4">
        <q-card class="test-card cursor-pointer" @click="$router.push(item.path)">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-avatar :icon="item.icon" color="primary" text-color="white" size="md" />
              <div class="text-h6 q-ml-md">{{ item.title }}</div>
            </div>
            <div class="text-body2 text-grey-8">{{ item.description }}</div>
          </q-card-section>
          
          <q-separator inset />
          
          <q-card-actions align="right">
            <q-btn flat color="primary" label="立即进入" icon-right="chevron_right" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <div class="footer q-mt-xl text-center">
      <q-btn outline color="grey-7" icon="home" label="返回首页" to="/" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'TestNavView'
})

const navItems = [
  {
    title: 'Markdown 渲染测试',
    path: '/markdown-test',
    icon: 'article',
    description: '测试 Markdown 渲染效果，支持 LaTeX 公式、表格、代码块等实时预览。'
  },
  {
    title: 'API 接口调试',
    path: '/debug-api',
    icon: 'api',
    description: '系统内部 API 接口调试工具，方便验证后端接口数据返回。'
  },
  {
    title: '会话管理测试',
    path: '/chat-session-test',
    icon: 'chat',
    description: '测试聊天会话的存储、同步以及消息流式输出效果。'
  },
  {
    title: 'Lottie 动画测试',
    path: '/lottie-test',
    icon: 'animation',
    description: '预览和调试系统中使用到的 Lottie 动画文件。'
  },
  {
    title: '基础渲染对比',
    path: '/render-test',
    icon: 'compare',
    description: '对比不同渲染引擎（MathJax vs KaTeX）在处理 LaTeX 时的表现。'
  },
  {
    title: '老师端功能调试',
    path: '/teacher-debug',
    icon: 'school',
    description: '专门用于模拟和调试老师端（WebSocket）下发消息和指令。'
  },
  {
    title: '习题组件测试',
    path: '/test-exercise',
    icon: 'quiz',
    description: '测试各类习题（选择、填空、判断）在不同数据下的渲染和交互。'
  }
]
</script>

<style scoped>
.test-nav-view {
  min-height: 100vh;
  background-color: #f8f9fa;
  max-width: 1200px;
  margin: 0 auto;
}

.test-card {
  height: 100%;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.test-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1) !important;
  border-color: var(--q-primary);
}

.text-h6 {
  font-weight: 600;
}
</style>
